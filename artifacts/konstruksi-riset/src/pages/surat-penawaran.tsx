import { useState, useRef, useMemo, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Printer, RefreshCw, Building2, Phone, Mail, Calendar, CircleCheck, TriangleAlert, Database, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Target, ChartBar, ExternalLink, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";
import { useListResearchItems, useTriggerSchedulerForSource, getListResearchItemsQueryKey, useListOutputProducts, getListOutputProductsQueryKey, useListCompetitorSignals, getListCompetitorSignalsQueryKey } from "@workspace/api-client-react";

// ── IjinTender Competitor Price Panel (Task #23) ─────────────────────────────

function IjinTenderPricePanel({ selectedCategory, ourTotal }: { selectedCategory: string; ourTotal: number }) {
  const [expanded, setExpanded] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch live intel items (non-pricing) from ijintender.co.id
  const liveQueryParams = { dataSourceSite: "ijintender.co.id", limit: 10 } as const;
  const { data: liveItems, isLoading: isLoadingLive } = useListResearchItems(
    liveQueryParams,
    { query: { staleTime: 5 * 60 * 1000, queryKey: getListResearchItemsQueryKey(liveQueryParams) } }
  );

  // Fetch competitor price signals from competitor_signals table (populated by scheduler)
  const signalQueryParams = { dataSourceSite: "www.ijintender.co.id", limit: 50 } as const;
  const { data: competitorSignals, isLoading: isLoadingPrices } = useListCompetitorSignals(
    signalQueryParams,
    { query: { staleTime: 10 * 60 * 1000, queryKey: getListCompetitorSignalsQueryKey(signalQueryParams) } }
  );

  const isLoading = isLoadingLive || isLoadingPrices;

  // Trigger crawl mutation
  const { mutate: triggerCrawl, isPending: isCrawling } = useTriggerSchedulerForSource({
    mutation: {
      onSuccess: () => {
        setCrawlError(null);
        // Invalidate live intel items query
        void queryClient.invalidateQueries({
          queryKey: getListResearchItemsQueryKey(liveQueryParams),
        });
        // Invalidate competitor signals query so price table refreshes
        void queryClient.invalidateQueries({
          queryKey: getListCompetitorSignalsQueryKey(signalQueryParams),
        });
      },
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Gagal menjalankan crawl. Coba lagi.";
        setCrawlError(msg);
      },
    },
  });

  // Decode price rows from competitor_signals (scheduler-populated); fall back to statics if empty
  const allPriceRows = useMemo<CompetitorPriceRow[]>(() => {
    if (competitorSignals && competitorSignals.length > 0) {
      const parsed = competitorSignals.flatMap((sig) => {
        const row = parseCompetitorPriceRow({ title: sig.title, summary: sig.summary, category: sig.category });
        return row ? [row] : [];
      });
      if (parsed.length > 0) return parsed;
    }
    // Static fallback so the panel is always informative even before first crawl
    return STATIC_COMPETITOR_PRICES;
  }, [competitorSignals]);

  const relevantPrices = useMemo(() => {
    if (selectedCategory === "ALL") return allPriceRows;
    return allPriceRows.filter((p) => p.subCategory === selectedCategory);
  }, [allPriceRows, selectedCategory]);

  const avgCompetitor = relevantPrices.length > 0
    ? relevantPrices.reduce((sum, p) => sum + (p.minPrice + p.maxPrice) / 2, 0) / relevantPrices.length
    : 0;

  // "live intel" items from research items query (scheduler-collected articles)
  const hasLiveData = liveItems && liveItems.filter((i) => i.category !== "COMPETITOR_PRICING").length > 0;
  // Whether we're showing live signals from competitor_signals table (vs static fallback)
  const isLiveSignals = !!(competitorSignals && competitorSignals.length > 0 && allPriceRows !== STATIC_COMPETITOR_PRICES);

  return (
    <Card className="border-blue-200/60 bg-blue-50/30">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Database className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-mono font-bold text-blue-800 tracking-wider">REFERENSI PASAR KOMPETITOR</span>
            <span className="text-[9px] font-mono bg-blue-600 text-white px-1.5 py-0.5 rounded-sm">
              VIA IJINTENDER.CO.ID · MKT-IJINTENDER-001
            </span>
            {(isLoading || isCrawling) && <LoaderCircle className="h-3 w-3 animate-spin text-blue-500" />}
            {hasLiveData && !isCrawling && (
              <span className="text-[9px] font-mono bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-sm">
                {liveItems?.length ?? 0} INTEL AKTIF
              </span>
            )}
            {isLiveSignals && !isCrawling && (
              <span className="text-[9px] font-mono bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-sm">
                {competitorSignals?.length ?? 0} SINYAL HARGA LIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => triggerCrawl({ params: { sourceId: "ijintender" } })}
              disabled={isCrawling}
              className="text-[10px] font-mono text-blue-700 hover:text-blue-900 border border-blue-300 hover:border-blue-500 bg-white hover:bg-blue-50 px-2 py-0.5 rounded-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
            >
              {isCrawling
                ? <><LoaderCircle className="h-3 w-3 animate-spin" /> MENGAMBIL DATA…</>
                : <><RefreshCw className="h-3 w-3" /> AMBIL DATA SEKARANG</>
              }
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] font-mono text-blue-600 hover:text-blue-800 flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "TUTUP" : "LIHAT DETAIL"}
            </button>
          </div>
        </div>
        {crawlError && (
          <p className="text-[10px] font-mono text-red-600 mt-1 flex items-center gap-1">
            <TriangleAlert className="h-3 w-3 shrink-0" />
            {crawlError}
          </p>
        )}
        <p className="text-[10px] font-mono text-blue-600 mt-0.5">
          Pantau posisi harga kami vs kompetitor sebelum mengirim surat penawaran
        </p>
      </CardHeader>
      {expanded && (
        <CardContent className="px-4 pb-3 pt-0 space-y-3">

          {/* Live intel from API (scheduler-collected articles; excludes pricing rows) */}
          {isLoadingLive ? (
            <div className="flex items-center gap-2 py-3 text-xs font-mono text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Memuat intel harga dari ijintender.co.id…
            </div>
          ) : hasLiveData ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono font-semibold text-emerald-700 uppercase tracking-wider">
                Intel Terkumpul dari IjinTender.co.id
              </p>
              {(liveItems ?? []).filter((i) => i.category !== "COMPETITOR_PRICING").map((item) => (
                <div key={item.id} className="border border-emerald-100 rounded-sm px-3 py-2 bg-white/60 space-y-0.5">
                  <p className="text-xs font-medium leading-snug">{item.title}</p>
                  {item.summary && (
                    <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2" title={item.summary}>{item.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {item.tags && (
                      <span className="text-[9px] font-mono bg-blue-50 text-blue-600 border border-blue-100 px-1 py-0.5 rounded-sm">{item.tags}</span>
                    )}
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {item.collectedAt ? new Date(item.collectedAt).toLocaleDateString("id-ID") : item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : ""}
                    </span>
                  </div>
                </div>
              ))}
              <Separator className="my-2" />
            </div>
          ) : (
            <div className="border border-dashed border-blue-200 rounded-sm px-4 py-4 bg-white/40 text-center space-y-2">
              <Database className="h-6 w-6 text-blue-300 mx-auto" />
              <p className="text-xs font-mono text-muted-foreground">
                Belum ada intel kompetitor — ambil data langsung dari IjinTender.co.id
              </p>
              <Button
                size="sm"
                variant="outline"
                className="font-mono text-[10px] border-blue-300 text-blue-700 hover:bg-blue-50 h-7"
                disabled={isCrawling}
                onClick={() => triggerCrawl({ params: { sourceId: "ijintender" } })}
              >
                {isCrawling
                  ? <><LoaderCircle className="h-3 w-3 mr-1.5 animate-spin" /> MENGAMBIL DATA…</>
                  : <><RefreshCw className="h-3 w-3 mr-1.5" /> AMBIL DATA SEKARANG</>
                }
              </Button>
            </div>
          )}

          {/* Reference price table — loaded from DB (COMPETITOR_PRICING research items) */}
          <div className="overflow-x-auto">
            <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Kisaran Harga Referensi
            </p>
            {isLoadingPrices ? (
              <div className="flex items-center gap-2 py-3 text-xs font-mono text-muted-foreground">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Memuat harga referensi…
              </div>
            ) : relevantPrices.length === 0 ? (
              <p className="text-[10px] font-mono text-muted-foreground py-2">
                Belum ada data harga referensi untuk kategori ini.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-blue-200 sticky top-0 bg-background z-10">
                    <th className="text-left py-1.5 font-mono text-[10px] text-muted-foreground">LAYANAN KOMPETITOR</th>
                    <th className="text-right py-1.5 font-mono text-[10px] text-muted-foreground">MIN</th>
                    <th className="text-right py-1.5 font-mono text-[10px] text-muted-foreground">MAX</th>
                    <th className="text-left py-1.5 font-mono text-[10px] text-muted-foreground pl-3">CATATAN</th>
                  </tr>
                </thead>
                <tbody>
                  {relevantPrices.map((p, i) => (
                    <tr key={i} className="border-b border-blue-100/50">
                      <td className="py-1.5 font-medium">{p.service}</td>
                      <td className="py-1.5 text-right font-mono text-green-700">Rp {(p.minPrice / 1_000_000).toFixed(1)}M</td>
                      <td className="py-1.5 text-right font-mono text-orange-600">Rp {(p.maxPrice / 1_000_000).toFixed(1)}M</td>
                      <td className="py-1.5 text-[10px] text-muted-foreground pl-3">{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {ourTotal > 0 && avgCompetitor > 0 && (
            <div className={cn(
              "flex items-center gap-2 border rounded-sm px-3 py-2 text-xs font-mono",
              ourTotal < avgCompetitor
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-orange-200 bg-orange-50 text-orange-800"
            )}>
              {ourTotal < avgCompetitor
                ? <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                : <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
              <span>
                Harga paket kami (Rp {(ourTotal / 1_000_000).toFixed(1)}M) vs rata-rata kompetitor (Rp {(avgCompetitor / 1_000_000).toFixed(1)}M) —{" "}
                {ourTotal < avgCompetitor
                  ? `KOMPETITIF: ${((avgCompetitor - ourTotal) / avgCompetitor * 100).toFixed(0)}% di bawah pasar`
                  : `Harga di atas rata-rata: pertimbangkan justifikasi nilai tambah`}
              </span>
            </div>
          )}
          <p className="text-[9px] font-mono text-muted-foreground">
            {isLiveSignals
              ? `Harga live dari tabel competitor_signals · ${competitorSignals?.length ?? 0} sinyal · Sumber: ijintender.co.id · Harga aktual dapat berbeda`
              : "Data statis — belum ada sinyal dari scheduler · Klik \"AMBIL DATA SEKARANG\" untuk memperbarui · Harga aktual dapat berbeda"
            }
          </p>
        </CardContent>
      )}
    </Card>
  );
}
// ── Service Catalog ──────────────────────────────────────────────────────────
interface ServiceItem {
  id: string;
  no: string;
  category: string;
  name: string;
  unit: string;
  price: number | null;
  priceUsd: number | null;
  currency: "IDR" | "USD" | "NEGO";
  processingDays: number | null;
  note?: string;
}

const SERVICE_CATALOG: ServiceItem[] = [
  // SMAP
  {
    id: "smap-doc",
    no: "1",
    category: "SMAP",
    name: "Dokumen Penerapan SMAP (SNI ISO 37001:2016)",
    unit: "1 Paket",
    price: 2_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 4,
    note: "Termasuk SOP, prosedur, dan form penerapan",
  },
  {
    id: "smap-iso",
    no: "2",
    category: "SMAP",
    name: "Sertifikat ISO 37001:2016 (Non KAN)",
    unit: "1 Sertifikat",
    price: 15_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 7,
    note: "Sertifikasi anti-penyuapan untuk pemenuhan SBU",
  },
  // Sewa Alat
  {
    id: "alat-kecil",
    no: "3.1",
    category: "Sewa Alat",
    name: "Sewa Alat SBU — Kualifikasi Kecil (3 tahun)",
    unit: "1 Unit",
    price: 5_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
    note: "Pemenuhan aset alat untuk persyaratan SBU Kecil",
  },
  {
    id: "alat-menengah",
    no: "3.2",
    category: "Sewa Alat",
    name: "Sewa Alat SBU — Kualifikasi Menengah & Spesialis BUJKN (3 tahun)",
    unit: "1 Unit",
    price: 7_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
  },
  {
    id: "alat-besar",
    no: "3.3",
    category: "Sewa Alat",
    name: "Sewa Alat SBU — Kualifikasi Besar BUJKN / PMA (3 tahun)",
    unit: "1 Unit",
    price: 10_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
  },
  {
    id: "alat-bujka",
    no: "3.4",
    category: "Sewa Alat",
    name: "Sewa Alat SBU — Kantor Perwakilan BUJKA (3 tahun)",
    unit: "1 Unit",
    price: 12_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
  },
  // Sewa SKK
  {
    id: "skk-7",
    no: "4.1",
    category: "Sewa SKK",
    name: "Sewa SKK Jenjang 7 untuk pemenuhan SBU (3 tahun)",
    unit: "1 Orang",
    price: 10_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 10,
    note: "Termasuk verifikasi kelayakan dan penugasan",
  },
  {
    id: "skk-8",
    no: "4.2",
    category: "Sewa SKK",
    name: "Sewa SKK Jenjang 8 untuk pemenuhan SBU (3 tahun)",
    unit: "1 Orang",
    price: 12_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 10,
  },
  {
    id: "skk-9",
    no: "4.3",
    category: "Sewa SKK",
    name: "Sewa SKK Jenjang 9 untuk pemenuhan SBU (3 tahun)",
    unit: "1 Orang",
    price: 15_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 10,
  },
  // Sertifikat Standar
  {
    id: "sertif-bujkn",
    no: "5.1",
    category: "Sertifikat Standar",
    name: "Sertifikat Standar BUJKN & PMA (per KBLI)",
    unit: "1 KBLI",
    price: 1_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
    note: "Termasuk pengurusan OSS dan MBKI",
  },
  {
    id: "sertif-bujka-konsultansi",
    no: "5.2",
    category: "Sertifikat Standar",
    name: "Sertifikat Standar Kantor Perwakilan BUJKA — Konsultansi Konstruksi",
    unit: "1 Sertifikat",
    price: null,
    priceUsd: 11_000,
    currency: "USD",
    processingDays: null,
    note: "Hubungi kami untuk detil proses",
  },
  {
    id: "sertif-bujka-pekerjaan",
    no: "5.3",
    category: "Sertifikat Standar",
    name: "Sertifikat Standar Kantor Perwakilan BUJKA — Pekerjaan Konstruksi",
    unit: "1 Sertifikat",
    price: null,
    priceUsd: 12_000,
    currency: "USD",
    processingDays: null,
  },
  {
    id: "sertif-bujka-terintegrasi",
    no: "5.4",
    category: "Sertifikat Standar",
    name: "Sertifikat Standar Kantor Perwakilan BUJKA — Terintegrasi",
    unit: "1 Sertifikat",
    price: null,
    priceUsd: 13_000,
    currency: "USD",
    processingDays: null,
  },
  // Lainnya
  {
    id: "kap-audit",
    no: "6",
    category: "Audit & Keuangan",
    name: "Laporan Audit KAP (Kantor Akuntan Publik)",
    unit: "1 Laporan",
    price: null,
    priceUsd: null,
    currency: "NEGO",
    processingDays: null,
    note: "Harga sesuai total aset perusahaan — hubungi kami",
  },
  {
    id: "skup-migas",
    no: "7.1",
    category: "Izin Khusus",
    name: "SKUP MIGAS (Surat Kemampuan Usaha Penunjang Migas)",
    unit: "1 Layanan",
    price: null,
    priceUsd: null,
    currency: "NEGO",
    processingDays: null,
    note: "Hubungi kami untuk konsultasi awal",
  },
  {
    id: "iujp",
    no: "7.2",
    category: "Izin Khusus",
    name: "IUJP (Izin Usaha Jasa Pertambangan)",
    unit: "1 Layanan",
    price: null,
    priceUsd: null,
    currency: "NEGO",
    processingDays: null,
  },
  {
    id: "sbu-listrik",
    no: "7.3",
    category: "Izin Khusus",
    name: "SBU Listrik dan SERKOM",
    unit: "1 Layanan",
    price: null,
    priceUsd: null,
    currency: "NEGO",
    processingDays: null,
  },
  {
    id: "tkdn",
    no: "8",
    category: "Sertifikasi Industri",
    name: "TKDN Industri (Tingkat Kandungan Dalam Negeri)",
    unit: "1 Layanan",
    price: null,
    priceUsd: null,
    currency: "NEGO",
    processingDays: null,
  },
  // ISO & Sistem Manajemen
  {
    id: "iso-9001",
    no: "9.1",
    category: "ISO & Sistem Manajemen",
    name: "Dokumen Penerapan ISO 9001:2015 (Manajemen Mutu)",
    unit: "1 Paket",
    price: 3_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 5,
    note: "Manual mutu, SOP, form kontrol, dan rekam mutu",
  },
  {
    id: "iso-9001-cert",
    no: "9.2",
    category: "ISO & Sistem Manajemen",
    name: "Sertifikat ISO 9001:2015 (Non KAN)",
    unit: "1 Sertifikat",
    price: 18_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 14,
    note: "Surveillance audit 1x/tahun termasuk",
  },
  {
    id: "iso-45001",
    no: "9.3",
    category: "ISO & Sistem Manajemen",
    name: "Dokumen Penerapan ISO 45001:2018 (K3) + SMK3 Konstruksi",
    unit: "1 Paket",
    price: 4_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 5,
    note: "Terintegrasi dengan RKK sesuai Permen PUPR",
  },
  {
    id: "smkk-rkk",
    no: "9.4",
    category: "ISO & Sistem Manajemen",
    name: "Rencana Keselamatan Konstruksi (RKK) per Proyek",
    unit: "1 Proyek",
    price: 2_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
    note: "Sesuai template PUPR, siap tanda tangan PPK",
  },
  // Konsultasi & Pelatihan
  {
    id: "konsul-sbu",
    no: "10.1",
    category: "Konsultasi & Pelatihan",
    name: "Konsultasi SBU / SKK (1 sesi, 90 menit)",
    unit: "1 Sesi",
    price: 750_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 1,
    note: "Via Zoom / tatap muka — analisa gap + roadmap",
  },
  {
    id: "pelatihan-sbu",
    no: "10.2",
    category: "Konsultasi & Pelatihan",
    name: "Pelatihan Persiapan Uji Kompetensi SKK (In-House, 1 hari)",
    unit: "1 Hari",
    price: 5_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: null,
    note: "Maksimal 15 peserta, materi + simulasi ujian",
  },
  {
    id: "riset-pasar",
    no: "10.3",
    category: "Konsultasi & Pelatihan",
    name: "Laporan Riset Pasar Konstruksi (Custom per Segmen)",
    unit: "1 Laporan",
    price: null,
    priceUsd: null,
    currency: "NEGO",
    processingDays: null,
    note: "Data kompetitor, peluang tender, analisa VOC — hubungi kami",
  },
  // Audit & Due Diligence
  {
    id: "audit-kesiapan-tender",
    no: "11.1",
    category: "Audit & Due Diligence",
    name: "Audit Kesiapan Tender (Pre-Bid Eligibility Check)",
    unit: "1 Paket",
    price: 2_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 2,
    note: "Cek kelayakan SBU, SKK, SMAP, keuangan, dan pengalaman sebelum mengajukan tender",
  },
  {
    id: "audit-post-tender",
    no: "11.2",
    category: "Audit & Due Diligence",
    name: "Analisis Post-Tender (Mengapa Kalah / Menang)",
    unit: "1 Paket",
    price: 1_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
    note: "Review dokumen penawaran, evaluasi pemenang, rekomendasi perbaikan strategi",
  },
  {
    id: "due-diligence-bujk",
    no: "11.3",
    category: "Audit & Due Diligence",
    name: "Due Diligence Profil BUJK (Background Check)",
    unit: "1 Perusahaan",
    price: 3_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 5,
    note: "Verifikasi legalitas, SBU/SKK, track record, dan reputasi untuk kebutuhan subkon atau kemitraan",
  },
  {
    id: "competitive-intel",
    no: "11.4",
    category: "Audit & Due Diligence",
    name: "Laporan Intelijen Kompetitor (per Tender / per Proyek)",
    unit: "1 Laporan",
    price: 4_000_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
    note: "Analisis peserta tender, estimasi harga kompetitor, strategi penawaran",
  },
  // TKDN & Digitalisasi
  {
    id: "tkdn-verifikasi",
    no: "12.1",
    category: "TKDN & Digitalisasi",
    name: "Verifikasi TKDN Material & Produk Konstruksi (per item)",
    unit: "1 Layanan",
    price: 2_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 3,
    note: "Termasuk dokumen KEMENPERIN + sertifikat pendukung penawaran tender",
  },
  {
    id: "tkdn-bom",
    no: "12.2",
    category: "TKDN & Digitalisasi",
    name: "Penyusunan BOM (Bill of Material) berbasis TKDN untuk Tender",
    unit: "1 Proyek",
    price: 4_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 5,
    note: "Sesuai SE LKPP 10/2024 — wajib TKDN ≥40% untuk proyek APBN",
  },
  {
    id: "bim-advisory",
    no: "12.3",
    category: "TKDN & Digitalisasi",
    name: "Advisory BIM Konstruksi — Gap Analysis & Roadmap",
    unit: "1 Sesi",
    price: 3_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 2,
    note: "Sesuai Permen PUPR 9/2023 — proyek >Rp100M wajib BIM. Analisis gap + rekomendasi tools",
  },
  {
    id: "bim-training",
    no: "12.4",
    category: "TKDN & Digitalisasi",
    name: "Pelatihan BIM Dasar untuk Tim Proyek (In-House, 2 Hari)",
    unit: "1 Paket",
    price: 9_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 2,
    note: "Maks 12 peserta · Revit/Archicad dasar + IFC export + koordinasi clash detection",
  },
  {
    id: "skk-bim",
    no: "12.5",
    category: "TKDN & Digitalisasi",
    name: "Pendampingan SKK BIM (Sertifikasi Kompetensi Digital Konstruksi)",
    unit: "1 Orang",
    price: 6_500_000,
    priceUsd: null,
    currency: "IDR",
    processingDays: 14,
    note: "LPJK · proses uji kompetensi digital konstruksi + portofolio BIM",
  },
];

const CATEGORIES = [...new Set(SERVICE_CATALOG.map(s => s.category))];

function formatPrice(item: ServiceItem): string {
  if (item.currency === "NEGO") return "Hubungi Kami";
  if (item.currency === "USD" && item.priceUsd) return `USD ${item.priceUsd.toLocaleString()}`;
  if (item.price) return `Rp ${item.price.toLocaleString("id-ID")}`;
  return "—";
}

interface LetterForm {
  nomorSurat: string;
  tanggal: string;
  namaKlien: string;
  jabatanKlien: string;
  namaPerusahaan: string;
  alamatPerusahaan: string;
  kotaPerusahaan: string;
  perihal: string;
}

export default function SuratPenawaran() {
  const today = new Date();
  const dateStr = today.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const isoDate = today.toISOString().split("T")[0];

  // Read query params for prefill (from Workroom "Buat Surat Penawaran" buttons)
  const search = useSearch();
  const qp = useMemo(() => new URLSearchParams(search), [search]);

  const { data: allOutputProducts = [] } = useListOutputProducts(undefined, { query: { queryKey: getListOutputProductsQueryKey() } });
  const readyProducts = allOutputProducts.filter(p => p.status === 'REVIEW' || p.status === 'READY');

  // #155 — mobile deep-link params: ?nama=...&kota=...&jenis=PT|SMA|SMK&akr=A&badan=BAN-PT&sisa=42
  // These arrive when the user taps "Buat SP" in the mobile app's AkreditasiPanel.
  const mobileNama  = qp.get("nama");
  const mobileKota  = qp.get("kota");
  const mobileJenis = qp.get("jenis");
  const mobileBadan = qp.get("badan");
  const mobileSisa  = qp.get("sisa");

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Surat Penawaran — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [form, setForm] = useState<LetterForm>(() => {
    // Mobile deep-link prefill takes priority, then Workroom prefill params
    if (mobileNama) {
      const perihalAkr = mobileBadan && mobileSisa
        ? `Penawaran Jasa Konstruksi Sarana-Prasarana — Persiapan Akreditasi ${mobileBadan} (${mobileSisa} hari)`
        : "Penawaran Jasa Konstruksi Sarana-Prasarana";
      return {
        nomorSurat: `001/INTEL-PENAWARAN/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`,
        tanggal: isoDate,
        namaKlien: `Kepala ${mobileJenis ?? "Lembaga"} / Direktur Utama`,
        jabatanKlien: `Kepala ${mobileJenis ?? "Institusi"}`,
        namaPerusahaan: mobileNama,
        alamatPerusahaan: "",
        kotaPerusahaan: mobileKota ?? "",
        perihal: perihalAkr,
      };
    }
    return {
      nomorSurat: `001/INTEL-PENAWARAN/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`,
      tanggal: isoDate,
      namaKlien: qp.get("namaKlien") ?? "",
      jabatanKlien: qp.get("jabatanKlien") ?? "Direktur Utama / PJBU",
      namaPerusahaan: qp.get("namaPerusahaan") ?? "",
      alamatPerusahaan: qp.get("alamatPerusahaan") ?? "",
      kotaPerusahaan: qp.get("kotaPerusahaan") ?? "",
      perihal: qp.get("perihal") ?? "Penawaran Layanan Jasa Pengurusan dan Perpanjangan SBU / SKK",
    };
  });

  // When navigating from Workroom or mobile, show a prefill notice
  const [prefillBanner, setPrefillBanner] = useState(() => !!qp.get("namaPerusahaan") || !!mobileNama);

  // domain param from inspirasi/sinyal-pasar links — pre-set active category filter
  const domainParam = qp.get("domain") ?? qp.get("jenis") ?? null;

  // Map known domain/segment codes to service categories
  const DOMAIN_CATEGORY_MAP: Record<string, string> = {
    "SBU": "SBU", "SKK": "SKK", "SMAP": "SMAP",
    "SEG-PROPERTI": "SBU", "SEG-INDUSTRI": "SBU", "SEG-INFRASTRUKTUR": "SBU",
    "SEG-ENERGI": "SBU", "SEG-AGRIBISNIS": "SBU",
    "SBU_PERPANJANGAN": "SBU", "AKREDITASI": "Akreditasi",
  };

  const [selectedServices, setSelectedServices] = useState<Set<string>>(() => {
    const servicesParam = qp.get("services");
    if (servicesParam) {
      return new Set(servicesParam.split(",").map(s => s.trim()).filter(Boolean));
    }
    return new Set(["smap-doc", "sertif-bujkn"]);
  });
  const [activeCategory, setActiveCategory] = useState<string>(() => {
    if (domainParam && DOMAIN_CATEGORY_MAP[domainParam]) return DOMAIN_CATEGORY_MAP[domainParam];
    return "ALL";
  });
  const [showPreview, setShowPreview] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const toggleService = (id: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = SERVICE_CATALOG.filter(s => selectedServices.has(s.id));
  const totalIdr = selectedItems.filter(s => s.currency === "IDR" && s.price).reduce((sum, s) => sum + (s.price ?? 0), 0);
  const hasNego = selectedItems.some(s => s.currency === "NEGO" || s.currency === "USD");

  const filteredCatalog = activeCategory === "ALL" ? SERVICE_CATALOG : SERVICE_CATALOG.filter(s => s.category === activeCategory);

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Surat Penawaran</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 2cm; color: #000; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        th, td { border: 1px solid #000; padding: 6px 8px; font-size: 10pt; }
        th { background: #f0f0f0; }
        h1 { font-size: 14pt; text-align: center; }
        .header-box { text-align: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 16px; }
        .letter-body { line-height: 1.8; }
        .total-row { font-weight: bold; background: #f9f9f9; }
        @media print { body { margin: 1.5cm; } }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const displayDate = form.tanggal
    ? new Date(form.tanggal + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    : dateStr;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            SURAT PENAWARAN
          </h1>
          <p className="text-muted-foreground font-mono mt-1 text-sm flex items-center gap-2">
            GENERATOR KONSEP SURAT PENAWARAN LAYANAN JASA SBU / SKK / SMAP
            {readyProducts.length > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                {readyProducts.length} produk siap
              </span>
            )}
            {selectedServices.size > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                {selectedServices.size} layanan dipilih
              </span>
            )}
            {activeCategory !== "ALL" && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Bidang: {activeCategory.replace(/_/g, " ")}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showPreview ? "default" : "outline"}
            size="sm"
            className="font-mono text-xs"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? "Sembunyikan Preview" : "Tampilkan Preview"}
          </Button>
          <Button size="sm" className="font-mono text-xs" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> CETAK / EXPORT
          </Button>
        </div>
      </div>

      {/* Prefill banner — shown when navigated from Workroom */}
      {prefillBanner && (
        <div className="flex items-center justify-between gap-3 border border-primary/30 rounded-sm px-4 py-2.5 bg-primary/5">
          <div className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-mono">
              <span className="font-bold">Data prefill dari Workroom:</span>{" "}
              Formulir telah diisi otomatis untuk{" "}
              <span className="font-bold text-primary">{form.namaPerusahaan || "kontraktor yang dipilih"}</span>.
              Periksa dan sesuaikan jika perlu.
            </p>
          </div>
          <button
            onClick={() => setPrefillBanner(false)}
            className="text-[10px] font-mono text-muted-foreground hover:text-foreground shrink-0"
          >
            ✕ Tutup
          </button>
        </div>
      )}

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="surat-penawaran" />

      {/* Offer Intelligence Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> OFFER INTELLIGENCE RADAR — Efektivitas Penawaran per Segmen Klien
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Segmen Klien", "Nilai Proposal Rata-rata", "Win Rate Est.", "Objeksi Utama", "Counter Argument", "Upsell Peluang"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "BUJK Kecil Baru SBU", val: "Rp 4–8jt", win: "72%", obj: "Harga terlalu mahal", counter: "ROI 10× dalam 3 bulan tender menang", upsell: "Bundle SKK + SBU", winColor: "text-emerald-700" },
                { seg: "BUJK Menengah SMAP", val: "Rp 10–22jt", win: "65%", obj: "Butuh pertimbangan lebih lama", counter: "Deadline SMAP enforcement mempersingkat waktu", upsell: "Add-on ISO 9001 + K3", winColor: "text-emerald-700" },
                { seg: "Tenaga Ahli SKK", val: "Rp 3–10jt", win: "80%", obj: "Tidak ada waktu proses", counter: "Express 5 hari kerja + urus semua dokumen", upsell: "Upgrade jenjang berikutnya", winColor: "text-emerald-700" },
                { seg: "Kontraktor Tender APBN", val: "Rp 8–20jt", win: "58%", obj: "Sudah ada konsultan langganan", counter: "Intel tender real-time + eligibility check 24 jam", upsell: "Retainer intel bulanan", winColor: "text-blue-700" },
                { seg: "Klien Riset Custom", val: "Rp 15–50jt", win: "45%", obj: "Harga riset terlalu tinggi", counter: "ROI 5–20× dari satu keputusan berbasis data", upsell: "Platform SaaS + white-label", winColor: "text-blue-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.seg}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.val}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.winColor}`}>{r.win}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground italic">{r.obj}</td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.counter}</td>
                  <td className="px-3 py-2 text-[10px]">{r.upsell}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proposal Close Rate Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> PROPOSAL CLOSE RATE TRACKER — Efektivitas Penawaran per Tahap Follow-up
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
          {[
            { stage: "Proposal Terkirim", val: "100%", color: "text-primary", bg: "bg-primary" },
            { stage: "Dibuka / Dilihat", val: "82%", color: "text-blue-700", bg: "bg-blue-500" },
            { stage: "Respon Awal", val: "64%", color: "text-violet-700", bg: "bg-violet-500" },
            { stage: "Negosiasi", val: "48%", color: "text-orange-700", bg: "bg-orange-500" },
            { stage: "Deal Closed", val: "38%", color: "text-emerald-700", bg: "bg-emerald-500" },
            { stage: "Upsell berhasil", val: "22%", color: "text-emerald-700", bg: "bg-emerald-600" },
          ].map((s, i) => (
            <div key={s.stage} className="border rounded-sm p-2 text-center">
              <p className={`text-xl font-black font-mono leading-none ${s.color}`}>{s.val}</p>
              <div className={`h-1 ${s.bg} rounded-full mt-1 mb-0.5`} style={{ opacity: 1 - i * 0.12 }} />
              <p className="text-[9px] font-mono text-muted-foreground">{s.stage}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { insight: "Kirim follow-up dalam 48 jam", impact: "+18% close rate", color: "text-emerald-700" },
            { insight: "Tambahkan video testimonial klien di proposal", impact: "+12% respon awal", color: "text-blue-700" },
            { insight: "Tawarkan konsultasi gratis 30 mnt sebelum deal", impact: "+25% negosiasi sukses", color: "text-violet-700" },
          ].map((r) => (
            <div key={r.insight} className="border rounded-sm p-2 bg-muted/20">
              <p className="text-[9px] text-muted-foreground">{r.insight}</p>
              <p className={`text-[9px] font-mono font-bold ${r.color} mt-0.5`}>{r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Confidence Meter */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> PRICING CONFIDENCE METER — Kekuatan Penawaran vs Pasar
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Harga vs Kompetitor", score: 82, desc: "8–12% di bawah rata-rata IjinTender", color: "bg-emerald-500" },
            { label: "Kelengkapan Layanan", score: 95, desc: "12 kategori · 40+ varian layanan", color: "bg-blue-500" },
            { label: "Kecepatan Proses", score: 88, desc: "Avg 3–7 hari kerja vs industri 14+ hari", color: "bg-violet-500" },
            { label: "Urgency Trigger", score: 91, desc: "SMAP mandatory · SBU expiry pressure", color: "bg-orange-500" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-mono text-muted-foreground">{m.label}</p>
                <span className="text-lg font-black font-mono leading-none">{m.score}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.score}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Strategy Intel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-primary" /> PRICING STRATEGY INTEL — Strategi Penetapan Harga per Segmen Klien
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              seg: "BUJK Baru / Startup",
              strategy: "PENETRASI",
              desc: "Tawarkan paket bundling SBU+SKK+SMAP dengan diskon 20% — bangun trust & database referral",
              anchor: "Rp 8–12jt",
              usp: "Gratis konsultasi 2x + fast-track 7 hari",
              color: "border-blue-200 bg-blue-50/20",
              badge: "bg-blue-100 text-blue-700",
            },
            {
              seg: "BUJK Upgrade Kualifikasi",
              strategy: "VALUE-BASED",
              desc: "Posisikan layanan sebagai investasi ROI — kalau SBU Menengah bisa ikut tender Rp 50M, layanan Rp 20jt hanya 0.04% dari nilai tender",
              anchor: "Rp 15–25jt",
              usp: "Jaminan proses + review teknis kualifikasi",
              color: "border-violet-200 bg-violet-50/20",
              badge: "bg-violet-100 text-violet-700",
            },
            {
              seg: "BUJK Expiry Urgent",
              strategy: "PREMIUM EKSPRES",
              desc: "SBU expired = tender blokir. Jual urgency: layanan cepat 3–5 hari kerja dengan garansi selesai sebelum deadline tender",
              anchor: "Rp 10–18jt",
              usp: "Prioritas antrian + garansi atau refund",
              color: "border-red-200 bg-red-50/20",
              badge: "bg-red-100 text-red-700",
            },
            {
              seg: "Klien Recurring (Langganan)",
              strategy: "RETENSI / BUNDLING",
              desc: "Tawarkan paket tahunan: monitor expiry SBU+SKK semua tenaga + reminder otomatis + laporan compliance — recurring revenue",
              anchor: "Rp 2–5jt/bln",
              usp: "Dashboard monitoring + WA alert otomatis",
              color: "border-emerald-200 bg-emerald-50/20",
              badge: "bg-emerald-100 text-emerald-700",
            },
          ].map((s) => (
            <div key={s.seg} className={`border rounded-sm p-3 ${s.color}`}>
              <div className="flex items-start justify-between mb-1.5 gap-1">
                <p className="text-[10px] font-bold leading-tight">{s.seg}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${s.badge}`}>{s.strategy}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{s.desc}</p>
              <p className="text-sm font-black font-mono text-primary mb-0.5">{s.anchor}</p>
              <p className="text-[9px] font-mono text-emerald-700">✓ {s.usp}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Sesuaikan strategi dengan konteks klien sebelum mencetak surat penawaran. Value-based pricing rata-rata 2–3× lebih tinggi dari cost-plus pricing untuk jasa konsultansi.</p>
      </div>

      {/* SMAP Alert */}
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-4 flex gap-3">
          <TriangleAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">Peringatan SMAP LPJK Aktif</p>
            <p className="text-xs text-amber-700 mt-0.5">
              LPJK telah menerbitkan daftar BUJK yang belum memenuhi komitmen SMAP SNI ISO 37001:2016.
              Perusahaan dalam daftar berpotensi mendapat sanksi administratif dan SBU-nya dicabut.{" "}
              <a href="https://lpjk.pu.go.id/laporan-lpjk/ketidaksesuaian-smap" target="_blank" rel="noopener noreferrer"
                className="underline font-mono transition-colors hover:text-primary/80">Lihat daftar LPJK →</a>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className={cn("grid gap-6", showPreview ? "lg:grid-cols-2" : "grid-cols-1")}>
        {/* LEFT: Form + Service Selection */}
        <div className="space-y-5">
          {/* Letter Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground">DATA SURAT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono">Nomor Surat</Label>
                  <Input
                    value={form.nomorSurat}
                    onChange={e => setForm(f => ({ ...f, nomorSurat: e.target.value }))}
                    className="font-mono text-xs h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono">Tanggal</Label>
                  <Input
                    type="date"
                    value={form.tanggal}
                    onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))}
                    className="font-mono text-xs h-8"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Nama Penerima (Yth.)</Label>
                <Input
                  value={form.namaKlien}
                  onChange={e => setForm(f => ({ ...f, namaKlien: e.target.value }))}
                  placeholder="Bapak/Ibu Direktur Utama"
                  className="text-sm h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Jabatan</Label>
                <Input
                  value={form.jabatanKlien}
                  onChange={e => setForm(f => ({ ...f, jabatanKlien: e.target.value }))}
                  placeholder="Direktur Utama / PJBU"
                  className="text-sm h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Nama Perusahaan Klien</Label>
                <Input
                  value={form.namaPerusahaan}
                  onChange={e => setForm(f => ({ ...f, namaPerusahaan: e.target.value }))}
                  placeholder="PT. …"
                  className="text-sm h-8"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-mono">Alamat</Label>
                  <Input
                    value={form.alamatPerusahaan}
                    onChange={e => setForm(f => ({ ...f, alamatPerusahaan: e.target.value }))}
                    placeholder="Jl. …"
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono">Kota</Label>
                  <Input
                    value={form.kotaPerusahaan}
                    onChange={e => setForm(f => ({ ...f, kotaPerusahaan: e.target.value }))}
                    placeholder="Jakarta"
                    className="text-sm h-8"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Perihal</Label>
                <Input
                  value={form.perihal}
                  onChange={e => setForm(f => ({ ...f, perihal: e.target.value }))}
                  className="text-sm h-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* Service Catalog */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono tracking-widest text-muted-foreground">PILIH LAYANAN</CardTitle>
                <span className="text-xs font-mono text-muted-foreground">{selectedServices.size} dipilih</span>
              </div>
              {/* Category tabs */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  onClick={() => setActiveCategory("ALL")}
                  className={cn("px-2 py-0.5 text-[10px] font-mono font-bold rounded-sm border transition-colors",
                    activeCategory === "ALL" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                  )}
                >
                  Semua
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn("px-2 py-0.5 text-[10px] font-mono font-bold rounded-sm border transition-colors",
                      activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredCatalog.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleService(item.id)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-sm border cursor-pointer transition-colors w-full text-left",
                    selectedServices.has(item.id)
                      ? "bg-primary/5 border-primary/40"
                      : "hover:bg-muted/50 border-border"
                  )}
                >
                  <Checkbox
                    checked={selectedServices.has(item.id)}
                    onCheckedChange={() => toggleService(item.id)}
                    className="mt-0.5 shrink-0"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium leading-snug">{item.name}</p>
                      <div className="text-right shrink-0">
                        <div className={cn(
                          "text-xs font-bold font-mono whitespace-nowrap",
                          item.currency === "NEGO" ? "text-muted-foreground" :
                          item.currency === "USD" ? "text-blue-600" : "text-green-700"
                        )}>
                          {formatPrice(item)}
                        </div>
                        {item.processingDays && (
                          <div className="text-[10px] text-muted-foreground font-mono">{item.processingDays} hr kerja</div>
                        )}
                      </div>
                    </div>
                    {item.note && <p className="text-[10px] text-muted-foreground mt-0.5">{item.note}</p>}
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Summary total */}
          {selectedItems.length > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-mono text-muted-foreground">ESTIMASI TOTAL PAKET</p>
                    <p className="text-2xl font-black font-mono text-green-700">
                      Rp {totalIdr.toLocaleString("id-ID")}
                    </p>
                    {hasNego && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        + layanan lain sesuai negosiasi
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-muted-foreground">{selectedItems.length} layanan dipilih</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      Max {Math.max(...selectedItems.map(s => s.processingDays ?? 0))} hari kerja
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* IjinTender Competitor Price Reference — Task #23 */}
          <IjinTenderPricePanel selectedCategory={activeCategory} ourTotal={totalIdr} />
        </div>

        {/* RIGHT: Letter Preview */}
        {showPreview && (
          <div>
            <div className="sticky top-20">
              <div className="text-xs font-mono text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> PREVIEW SURAT
              </div>
              <div className="border rounded-sm bg-white shadow-sm overflow-hidden" style={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
                <div ref={printRef} className="p-8 text-sm" style={{ fontFamily: "'Times New Roman', serif", lineHeight: "1.8", color: "#000" }}>
                  {/* Letterhead */}
                  <div className="header-box text-center border-b-2 border-double border-black pb-4 mb-6">
                    <h1 className="text-base font-bold tracking-wide">INTEL-KONSTRUKSI</h1>
                    <p className="text-xs">Platform Riset Marketing Konstruksi Indonesia</p>
                    <p className="text-xs">Telp: +62 821-2295-3749 | Email: info@intel-konstruksi.id</p>
                    <p className="text-xs">Website: intel-konstruksi.id</p>
                  </div>

                  {/* Letter meta */}
                  <div className="grid grid-cols-2 gap-0 mb-4 text-xs">
                    <div>
                      <table className="border-none" style={{ border: "none" }}>
                        <tbody>
                          <tr><td className="pr-4 border-none" style={{ border: "none" }}>Nomor</td><td className="border-none" style={{ border: "none" }}>: {form.nomorSurat || "—"}</td></tr>
                          <tr><td className="pr-4 border-none" style={{ border: "none" }}>Lampiran</td><td className="border-none" style={{ border: "none" }}>: 1 (Satu) Set Dokumen</td></tr>
                          <tr><td className="pr-4 border-none" style={{ border: "none" }}>Hal</td><td className="border-none" style={{ border: "none" }}>: <strong>{form.perihal}</strong></td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="text-right">
                      <p>Jakarta, {displayDate}</p>
                    </div>
                  </div>

                  {/* Addressee */}
                  <div className="mb-4 text-xs">
                    <p>Kepada Yth.</p>
                    <p><strong>{form.jabatanKlien || "Direktur Utama / Penanggung Jawab Badan Usaha (PJBU)"}</strong></p>
                    <p><strong>{form.namaPerusahaan || "Perusahaan Jasa Konstruksi (BUJK)"}</strong></p>
                    {form.alamatPerusahaan && <p>{form.alamatPerusahaan}</p>}
                    {form.kotaPerusahaan && <p>{form.kotaPerusahaan}</p>}
                  </div>

                  <p className="mb-4 text-xs">Dengan hormat,</p>

                  {/* Body */}
                  <div className="letter-body text-xs space-y-3 text-justify">
                    <p>
                      Bersama surat ini, kami dari <strong>INTEL-KONSTRUKSI</strong> bermaksud memperkenalkan diri sebagai
                      platform riset dan konsultasi marketing konstruksi yang menyediakan layanan pengurusan dan
                      pendampingan Sertifikat Badan Usaha (SBU), Sertifikat Kompetensi Kerja (SKK), serta pemenuhan
                      persyaratan regulasi konstruksi lainnya di Indonesia.
                    </p>
                    <p>
                      Mengacu pada kewajiban penerapan Sistem Manajemen Anti Penyuapan (SMAP) berdasarkan SNI ISO 37001:2016
                      bagi seluruh Badan Usaha Jasa Konstruksi (BUJK), serta adanya sanksi administratif berupa
                      pencatatan ketidaksesuaian oleh LPJK bagi perusahaan yang belum memenuhi komitmen SMAP,
                      kami dengan ini menawarkan layanan profesional untuk membantu{" "}
                      <strong>{form.namaPerusahaan || "perusahaan Bapak/Ibu"}</strong> dalam memenuhi seluruh persyaratan
                      tersebut secara cepat, tepat, dan sesuai regulasi yang berlaku.
                    </p>
                    <p>
                      Daftar BUJK yang belum memenuhi komitmen SMAP dapat dilihat di:{" "}
                      <span style={{ fontFamily: "monospace", fontSize: "10pt" }}>
                        lpjk.pu.go.id/laporan-lpjk/ketidaksesuaian-smap
                      </span>
                    </p>
                    <p>
                      Berikut kami sampaikan daftar layanan yang kami tawarkan beserta estimasi biaya dan waktu penyelesaian:
                    </p>
                  </div>

                  {/* Services Table */}
                  <table style={{ width: "100%", borderCollapse: "collapse", margin: "16px 0", fontSize: "9.5pt" }}>
                    <thead>
                      <tr style={{ background: "#f0f0f0" }}>
                        <th style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", width: "5%" }}>No</th>
                        <th style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "left" }}>Uraian Layanan</th>
                        <th style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", width: "10%" }}>Satuan</th>
                        <th style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right", width: "18%" }}>Harga</th>
                        <th style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", width: "14%" }}>Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.length > 0 ? selectedItems.map((item, idx) => (
                        <tr key={item.id} style={{ background: idx % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>{item.no}</td>
                          <td style={{ border: "1px solid #000", padding: "4px 6px" }}>
                            {item.name}
                            {item.note && <div style={{ fontSize: "8.5pt", color: "#666", marginTop: "2px" }}>{item.note}</div>}
                          </td>
                          <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>{item.unit}</td>
                          <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "right", fontWeight: "bold" }}>
                            {formatPrice(item)}
                          </td>
                          <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>
                            {item.processingDays ? `${item.processingDays} hari kerja` : "Hubungi kami"}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} style={{ border: "1px solid #000", padding: "12px", textAlign: "center", color: "#999", fontStyle: "italic" }}>
                            Pilih layanan di panel kiri untuk ditampilkan di sini
                          </td>
                        </tr>
                      )}
                      {totalIdr > 0 && (
                        <tr style={{ background: "#f0f8f0", fontWeight: "bold" }}>
                          <td colSpan={3} style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right" }}>
                            Total Estimasi (IDR)
                          </td>
                          <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "right" }}>
                            Rp {totalIdr.toLocaleString("id-ID")}
                          </td>
                          <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center" }}>—</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Terms */}
                  <div className="text-xs space-y-2 mt-4">
                    <p><strong>Ketentuan Umum:</strong></p>
                    <ul style={{ paddingLeft: "20px", listStyleType: "disc" }}>
                      <li>Seluruh harga dinyatakan dalam mata uang Rupiah Indonesia (IDR) kecuali disebutkan lain.</li>
                      <li>Harga belum termasuk pajak yang berlaku (apabila dikenakan).</li>
                      <li>Waktu penyelesaian dihitung setelah seluruh dokumen persyaratan diterima secara lengkap dan pembayaran telah dikonfirmasi.</li>
                      <li>Harga khusus tersedia untuk permintaan beberapa layanan sekaligus atau kerja sama paket korporasi.</li>
                      <li>Harga dapat berubah sewaktu-waktu mengikuti regulasi yang berlaku.</li>
                    </ul>
                  </div>

                  {/* Closing */}
                  <div className="text-xs mt-6 space-y-3">
                    <p>
                      Kami berharap mendapat kesempatan untuk mendampingi{" "}
                      <strong>{form.namaPerusahaan || "perusahaan Bapak/Ibu"}</strong> dalam memenuhi
                      kewajiban regulasi yang berlaku. Untuk informasi lebih lanjut atau penjadwalan konsultasi,
                      silakan menghubungi kami melalui kontak di bawah ini.
                    </p>
                    <p>Atas perhatian dan kepercayaan Bapak/Ibu, kami ucapkan terima kasih.</p>
                  </div>

                  {/* Signature */}
                  <div className="grid grid-cols-2 gap-8 mt-8 text-xs">
                    <div></div>
                    <div className="text-center">
                      <p>Hormat kami,</p>
                      <div style={{ height: "60px" }}></div>
                      <p><strong>Tim INTEL-KONSTRUKSI</strong></p>
                      <p className="text-muted-foreground" style={{ fontSize: "9pt" }}>Platform Riset Marketing Konstruksi</p>
                    </div>
                  </div>

                  {/* Value Proof Block */}
                  <div style={{ marginTop: "20px", padding: "12px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "4px" }}>
                    <p style={{ fontSize: "9pt", color: "#166534", fontWeight: "700", marginBottom: "8px" }}>✅ BUKTI NILAI LAYANAN KAMI</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                      {[
                        { label: "Klien Dilayani", val: "500+", note: "sejak 2020" },
                        { label: "SBU Berhasil", val: "98%", note: "tingkat sukses" },
                        { label: "Waktu Proses", val: "14 hr", note: "rata-rata express" },
                        { label: "Sumber Intelijen", val: "64", note: "dipantau harian" },
                        { label: "SKK Terbit", val: "1.200+", note: "tenaga ahli" },
                        { label: "NPS Kepuasan", val: "9.1/10", note: "survei klien" },
                      ].map((s) => (
                        <div key={s.label} style={{ textAlign: "center", padding: "6px", background: "#fff", borderRadius: "4px", border: "1px solid #bbf7d0" }}>
                          <p style={{ fontSize: "14pt", fontWeight: "900", color: "#166534", margin: 0 }}>{s.val}</p>
                          <p style={{ fontSize: "7pt", color: "#374151", margin: 0 }}>{s.label}</p>
                          <p style={{ fontSize: "7pt", color: "#6b7280", margin: 0 }}>{s.note}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Timeline Deliverable */}
                  <div style={{ marginTop: "16px", padding: "12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "4px" }}>
                    <p style={{ fontSize: "9pt", color: "#1e40af", fontWeight: "700", marginBottom: "8px" }}>📅 TIMELINE PENGERJAAN</p>
                    <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
                      {[
                        { hari: "H+1", label: "Kick-off & Verifikasi Dokumen", color: "#2563eb" },
                        { hari: "H+3", label: "Pengajuan ke LPJK / BNSP", color: "#7c3aed" },
                        { hari: "H+7", label: "Monitoring & Update Progress", color: "#059669" },
                        { hari: "H+14", label: "Terbit Sertifikat (Express)", color: "#16a34a" },
                        { hari: "H+21", label: "Terbit Sertifikat (Reguler)", color: "#ca8a04" },
                      ].map((t, i) => (
                        <div key={i} style={{ textAlign: "center", minWidth: "100px", flex: 1 }}>
                          <div style={{ width: "100%", height: "3px", backgroundColor: t.color, borderRadius: "2px", marginBottom: "4px" }} />
                          <p style={{ fontSize: "8pt", fontWeight: "900", color: t.color, margin: 0 }}>{t.hari}</p>
                          <p style={{ fontSize: "7pt", color: "#374151", margin: 0, lineHeight: "1.3" }}>{t.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Closing pitch */}
                  <div style={{ marginTop: "20px", padding: "12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px" }}>
                    <p style={{ fontSize: "9pt", color: "#374151", fontWeight: "600", marginBottom: "6px" }}>📌 MENGAPA PT MAHESWARA JAYA PERSADA?</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      {[
                        { icon: "🔍", text: "Riset real-time dari 64 sumber intelijen nasional" },
                        { icon: "⚡", text: "Proses ekspres — SBU/SKK selesai dalam 14–21 hari kerja" },
                        { icon: "🛡️", text: "Monitoring aktif + alert 90/60/30 hari sebelum jatuh tempo" },
                        { icon: "📊", text: "Laporan analisis pasar dan kompetitor bulanan" },
                      ].map((pt, i) => (
                        <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                          <span style={{ fontSize: "12pt" }}>{pt.icon}</span>
                          <p style={{ fontSize: "8.5pt", color: "#4b5563", lineHeight: "1.4", margin: 0 }}>{pt.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Contact footer */}
                  <div style={{ marginTop: "24px", borderTop: "1px solid #ccc", paddingTop: "10px", fontSize: "9pt", color: "#666" }}>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                      <span>📞 +62 821-2295-3749</span>
                      <span>✉️ info@intel-konstruksi.id</span>
                      <span>🌐 intel-konstruksi.id</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}

/** Shape decoded from a competitor_signals row */
interface CompetitorPriceRow {
  service: string;
  subCategory: string;
  minPrice: number;
  maxPrice: number;
  notes: string;
}

/** Parse a CompetitorSignal (or research item) into a price row via JSON summary */
function parseCompetitorPriceRow(item: { title: string; summary?: string | null; category?: string | null }): CompetitorPriceRow | null {
  try {
    const parsed = JSON.parse(item.summary ?? "");
    return {
      service: item.title,
      subCategory: parsed.subCategory ?? item.category ?? "",
      minPrice: Number(parsed.minPrice) || 0,
      maxPrice: Number(parsed.maxPrice) || 0,
      notes: parsed.notes ?? "",
    };
  } catch {
    return null;
  }
}

/** Static fallback competitor prices — shown before the first scheduler crawl populates live data */
const STATIC_COMPETITOR_PRICES: CompetitorPriceRow[] = [
  { service: "Sewa SKK Jenjang 7 (kompetitor)", subCategory: "Sewa SKK", minPrice: 8_000_000, maxPrice: 12_000_000, notes: "Referensi pasar — data statis" },
  { service: "Sewa SKK Jenjang 8 (kompetitor)", subCategory: "Sewa SKK", minPrice: 10_000_000, maxPrice: 15_000_000, notes: "Referensi pasar — data statis" },
  { service: "Sewa SKK Jenjang 9 (kompetitor)", subCategory: "Sewa SKK", minPrice: 13_000_000, maxPrice: 20_000_000, notes: "Referensi pasar — data statis" },
  { service: "Sewa Alat SBU Kecil (kompetitor)", subCategory: "Sewa Alat", minPrice: 4_000_000, maxPrice: 7_000_000, notes: "Referensi pasar — data statis" },
  { service: "Sewa Alat SBU Menengah (kompetitor)", subCategory: "Sewa Alat", minPrice: 6_000_000, maxPrice: 10_000_000, notes: "Referensi pasar — data statis" },
  { service: "Dokumen ISO 9001:2015 (kompetitor)", subCategory: "ISO & Sistem Manajemen", minPrice: 2_500_000, maxPrice: 5_000_000, notes: "Referensi pasar — data statis" },
  { service: "Sertifikat ISO 9001:2015 Non-KAN (kompetitor)", subCategory: "ISO & Sistem Manajemen", minPrice: 12_000_000, maxPrice: 22_000_000, notes: "Referensi pasar — data statis" },
];
