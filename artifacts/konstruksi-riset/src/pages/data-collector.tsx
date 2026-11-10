import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useFetchDataSource,
  useCreateResearchItem,
  useTriggerSchedulerForSource,
  useTriggerSchedulerForEmptySources,
  useGetSchedulerStatus,
  useGetMkrCrawlSchedule,
  getGetMkrCrawlScheduleQueryKey,
  getGetSchedulerStatusQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, Bot, Building, ChartBar, ChevronUp, CircleAlert, CircleCheck, CircleX, ClipboardCheck, Clock, CloudCog, Cpu, Database, DollarSign, ExternalLink, GitBranch, Globe, History, Layers, LoaderCircle, Lock, Network, RefreshCw, RotateCcw, Rocket, Route, Save, Server, ServerCrash, Shield, ShieldCheck, Star, Target, Timer, TrendingUp, TriangleAlert, Trophy, Users, Wrench, X, Zap } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { DataFetchResult, FetchedItem } from "@workspace/api-client-react";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// IDs must match dataSources.ts in api-server
const RAW_DATA_SOURCES = [
  { id: "spse-inaproc",          name: "SPSE / LPSE Nasional (LKPP)",       url: "https://spse.inaproc.id/",                   category: "TENDER_OPPORTUNITY", description: "Sistem Pengadaan Secara Elektronik Nasional" },
  { id: "indotender",            name: "IndoTender",                         url: "https://www.indotender.com/",                category: "TENDER_OPPORTUNITY", description: "Informasi Lelang & Tender Indonesia" },
  { id: "pengadaan-co-id",       name: "Pengadaan.co.id",                   url: "https://www.pengadaan.co.id/",               category: "TENDER_OPPORTUNITY", description: "Portal Pengadaan Barang dan Jasa" },
  { id: "tender-indonesia",      name: "Tender Indonesia",                  url: "https://www.tender-indonesia.com/",          category: "TENDER_OPPORTUNITY", description: "Informasi Tender Proyek Indonesia" },
  { id: "lpse-kemenpupr",        name: "LPSE Kementerian PUPR",             url: "https://lpse.pu.go.id/eproc4/",             category: "TENDER_OPPORTUNITY", description: "LPSE resmi Kementerian PUPR" },
  { id: "eppid-ikn",             name: "IKN Nusantara — Tender & Investasi",url: "https://www.ikn.go.id/",                    category: "TENDER_OPPORTUNITY", description: "Peluang tender proyek IKN" },
  { id: "lpjk-pupr",            name: "LPJK PUPR — Database SBU",          url: "https://lpjk.pu.go.id/",                    category: "CONTRACTOR_DATA",    description: "Lembaga Pengembangan Jasa Konstruksi (SBU)" },
  { id: "lpjk-smap",            name: "LPJK — Ketidaksesuaian SMAP",       url: "https://lpjk.pu.go.id/laporan-lpjk/ketidaksesuaian-smap", category: "CONTRACTOR_DATA", description: "Daftar BUJK belum memenuhi SMAP" },
  { id: "indokontraktor",       name: "IndoKontraktor",                    url: "https://www.indokontraktor.com/",            category: "CONTRACTOR_DATA",    description: "Direktori Perusahaan Kontraktor Indonesia" },
  { id: "kemnaker",             name: "Kemnaker — SKK Tenaga Kerja",       url: "https://www.kemnaker.go.id/",               category: "SKK_HOLDERS",        description: "Kementerian Ketenagakerjaan" },
  { id: "sibima-pupr",         name: "SIBIMA PUPR — Sertifikasi",         url: "https://sibima.pu.go.id/",                  category: "SKK_HOLDERS",        description: "Sistem Informasi Belajar Intensif Mandiri PUPR" },
  { id: "esdm",                name: "ESDM",                              url: "https://www.esdm.go.id/",                   category: "OPPORTUNITY_TREND",  description: "Kementerian Energi dan Sumber Daya Mineral" },
  { id: "jdih-pupr",          name: "JDIH PUPR — Regulasi",              url: "https://jdih.pu.go.id/",                    category: "OPPORTUNITY_TREND",  description: "Jaringan Dokumentasi dan Informasi Hukum PUPR" },
  { id: "tukang-com",         name: "Tukang.com",                        url: "https://tukang.com/",                       category: "PROBLEMS",           description: "Layanan Tukang Bangunan Online" },
  { id: "media-konstruksi",   name: "Media Konstruksi",                  url: "https://mediakonstruksi.com/",             category: "OPPORTUNITY_TREND",  description: "Berita dan artikel konstruksi" },
  { id: "pupr-berita",        name: "PUPR Berita & Publikasi",           url: "https://www.pu.go.id/berita",              category: "OPPORTUNITY_TREND",  description: "Berita resmi Kementerian PUPR" },
  { id: "inaproc-stats",     name: "INAPROC — Statistik Pengadaan",     url: "https://inaproc.id",                        category: "TENDER_OPPORTUNITY", description: "Portal statistik pengadaan nasional LKPP" },
  { id: "bnsp-sertifikasi",  name: "BNSP — Skema Sertifikasi Konstruksi", url: "https://bnsp.go.id",                      category: "SKK_HOLDERS",        description: "Badan Nasional Sertifikasi Profesi" },
  { id: "jdih-nasional",     name: "JDIH Nasional — Peraturan Terkini", url: "https://jdih.peraturan.go.id",              category: "OPPORTUNITY_TREND",  description: "Jaringan Dokumentasi dan Informasi Hukum Nasional" },
  { id: "k3-kemnaker",       name: "Portal K3 Kemnaker",                url: "https://k3.kemnaker.go.id",                 category: "OPPORTUNITY_TREND",  description: "Regulasi dan standar K3 konstruksi" },
  { id: "inaproc-tkdn",      name: "TKDN Checker — KEMENPERIN",         url: "https://tkdn.kemenperin.go.id",             category: "CONTRACTOR_DATA",    description: "Verifikasi nilai TKDN produk & material konstruksi" },
  { id: "bim-pupr",          name: "BIM Center PUPR",                   url: "https://bim.pu.go.id",                      category: "OPPORTUNITY_TREND",  description: "Pusat informasi BIM Kementerian PUPR" },
  { id: "sikap-lkpp",        name: "SIKAP LKPP — Kinerja Penyedia",     url: "https://sikap.inaproc.id",                  category: "CONTRACTOR_DATA",    description: "Sistem Informasi Kinerja Penyedia — rekam jejak BUJK" },

  // ── Batch sumber proyek 2026 ──────────────────────────────────────────────
  { id: "bci-asia",           name: "BCI Central — Project Intelligence",  url: "https://www.bcicentral.com/id/find-projects/", category: "OPPORTUNITY_TREND", description: "Database proyek konstruksi Asia & Indonesia: leads, nilai proyek, kontak owner" },
  { id: "bci-jakarta",        name: "BCI Central — Jakarta Construction Leads", url: "https://www.bcicentral.com/id/local/jakarta-construction-leads/", category: "OPPORTUNITY_TREND", description: "Pipeline proyek konstruksi aktif area Jakarta — early-stage leads" },
  { id: "citra-data",         name: "Citra Data Construction",             url: "https://citradataconstruction.com/",           category: "CONTRACTOR_DATA",   description: "Database profil kontraktor & data proyek konstruksi Indonesia" },
  { id: "top-konstruksi",     name: "Top Konstruksi",                      url: "https://topkonstruksi.com/",                  category: "OPPORTUNITY_TREND", description: "Berita, analisis, dan informasi proyek konstruksi terkini" },
  { id: "dunia-tender",       name: "Dunia Tender",                        url: "https://duniatender.com/",                    category: "TENDER_OPPORTUNITY", description: "Agregator tender & proyek konstruksi Indonesia — notifikasi real-time" },
  { id: "simpul-kpbu",        name: "SIMPUL KPBU PUPR — Proyek Operasi",  url: "https://simpulkpbu.pu.go.id/proyek/operasi",  category: "OPPORTUNITY_TREND", description: "Portal resmi PUPR: daftar proyek KPBU (PPP) tahap operasi & konstruksi aktif" },
  { id: "datalpse",           name: "DataLPSE.com — Lelang Aktif",         url: "https://www.datalpse.com/lelang",             category: "TENDER_OPPORTUNITY", description: "Agregator data lelang dari ratusan LPSE daerah dalam satu portal" },
  { id: "konstruksi-media",   name: "Konstruksi Media",                    url: "https://konstruksimedia.com/",                category: "OPPORTUNITY_TREND", description: "Media konstruksi: monitoring lapangan, berita proyek, K3, material" },
  { id: "data-go-id-k3",      name: "Data.go.id — Kecelakaan Kerja Konstruksi", url: "https://data.go.id/dataset/dataset/jumlah-dokumen-data-dan-informasi-kecelakaan-kerja-proyek-konstruksi4", category: "PROBLEMS", description: "Dataset resmi pemerintah: jumlah & sebaran kecelakaan kerja proyek konstruksi" },
  { id: "lkpp-pemenang",      name: "LKPP — Pemenang Tender Konstruksi",  url: "https://data.lkpp.go.id/id/dataset/daftar-pemenang-penyedia-tender-pada-kategori-pekerjaan-konstruksi", category: "CONTRACTOR_DATA", description: "Dataset LKPP: daftar pemenang penyedia tender pekerjaan konstruksi nasional" },
  { id: "hsp-jakarta",        name: "HSP Jakarta — DCKTRP",               url: "https://dcktrp.jakarta.go.id/bangunjakarta/hsp", category: "OPPORTUNITY_TREND", description: "Harga Satuan Pekerjaan (HSP) konstruksi DKI Jakarta — referensi estimasi anggaran" },
  { id: "diklat-konstruksi",  name: "Diklat Konstruksi",                   url: "https://diklatkonstruksi.com/",               category: "SKK_HOLDERS",       description: "Platform diklat & uji kompetensi SKK konstruksi — jadwal & modul pelatihan" },
  { id: "pengadaan-info",     name: "Pengadaan.info — Lelang",             url: "https://pengadaan.info/lelang",               category: "TENDER_OPPORTUNITY", description: "Informasi lelang pengadaan barang/jasa konstruksi dari berbagai instansi" },
  { id: "datalelang-id",      name: "DataLelang.id",                       url: "https://www.datalelang.id/",                  category: "TENDER_OPPORTUNITY", description: "Agregator data lelang konstruksi Indonesia — historis & aktif" },
];

const CORE_SOURCE_DOMAINS: Record<string, "LEGALITAS_PERIJINAN" | "SBU" | "SKK" | "TENDER" | "PROYEK"> = {
  "spse-inaproc": "TENDER",
  indotender: "TENDER",
  "pengadaan-co-id": "TENDER",
  "tender-indonesia": "TENDER",
  "lpse-kemenpupr": "TENDER",
  "inaproc-stats": "TENDER",
  "dunia-tender": "TENDER",
  datalpse: "TENDER",
  "pengadaan-info": "TENDER",
  "datalelang-id": "TENDER",
  "eppid-ikn": "PROYEK",
  "bci-asia": "PROYEK",
  "bci-jakarta": "PROYEK",
  "simpul-kpbu": "PROYEK",
  "top-konstruksi": "PROYEK",
  "lpjk-pupr": "SBU",
  "lpjk-smap": "SBU",
  indokontraktor: "SBU",
  "citra-data": "SBU",
  "lkpp-pemenang": "SBU",
  kemnaker: "SKK",
  "sibima-pupr": "SKK",
  "bnsp-sertifikasi": "SKK",
  "diklat-konstruksi": "SKK",
  "jdih-pupr": "LEGALITAS_PERIJINAN",
  "jdih-nasional": "LEGALITAS_PERIJINAN",
  "k3-kemnaker": "LEGALITAS_PERIJINAN",
};

const LOCAL_DATA_SOURCES = RAW_DATA_SOURCES.flatMap((source) => {
  const category = CORE_SOURCE_DOMAINS[source.id];
  return category ? [{ ...source, category }] : [];
});

const CATEGORY_COLORS: Record<string, string> = {
  LEGALITAS_PERIJINAN: "bg-violet-100 text-violet-700 border-violet-300",
  SBU: "bg-purple-100 text-purple-700 border-purple-300",
  SKK: "bg-yellow-100 text-yellow-700 border-yellow-300",
  TENDER: "bg-blue-100 text-blue-700 border-blue-300",
  PROYEK: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

const DC_CATEGORY_LABELS: Record<string, string> = {
  LEGALITAS_PERIJINAN: "Legalitas & Perijinan",
  SBU: "SBU",
  SKK: "SKK",
  TENDER: "Tender",
  PROYEK: "Proyek",
};

export default function DataCollector() {
  const { toast } = useToast();

  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [schedulerTriggering, setSchedulerTriggering] = useState<string | null>(null);
  const [crawlingEmptySources, setCrawlingEmptySources] = useState(false);
  const [fetchResults, setFetchResults] = useState<Record<string, DataFetchResult>>({});
  const [schedulerResults, setSchedulerResults] = useState<Record<string, { savedAt: string; itemsSaved: number; status: string }>>({});
  const search = useSearch();
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showNotesOnly, setShowNotesOnly] = useState(false);
  const [sortByCrawled, setSortByCrawled] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [sourceNotes, setSourceNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-dc-source-notes") ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const updateSourceNote = (id: string, val: string) => setSourceNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-dc-source-notes", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const [pinnedSources, setPinnedSources] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-dc-pinned") ?? "[]") as string[]); } catch { return new Set(); }
  });
  const togglePin = (id: string) => setPinnedSources(prev => {
    const next = new Set(prev);
    const wasPin = next.has(id);
    if (wasPin) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-dc-pinned", JSON.stringify([...next])); } catch { /* ignore */ }
    toast({ title: wasPin ? "Pin dilepas" : "Sumber dipin" });
    return next;
  });
  const [highlightSourceId, setHighlightSourceId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const sourceParam = params.get("source");
    if (sourceParam) {
      setHighlightSourceId(sourceParam);
      // Scroll to highlighted source after render
      setTimeout(() => {
        const el = document.getElementById(`source-card-${sourceParam}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [search]);

  const fetchMutation = useFetchDataSource();
  const { toast: showToast } = useToast();
  const createResearchItemMutation = useCreateResearchItem({
    mutation: {
      onError: (err: unknown) => showToast({ title: "Gagal menyimpan ke data riset", description: err instanceof Error ? err.message : "Coba lagi", variant: "destructive" }),
    }
  });
  const schedulerTrigger = useTriggerSchedulerForSource();
  const { data: schedulerStatus } = useGetSchedulerStatus();
  const { data: mkrSchedule } = useGetMkrCrawlSchedule();
  const queryClient = useQueryClient();
  const emptySourcesTrigger = useTriggerSchedulerForEmptySources();

  // The server matrix is the authoritative source registry. Local metadata is
  // only a loading fallback so cards can never omit a scheduled source.
  const DATA_SOURCES = mkrSchedule
    ? mkrSchedule.matrix.map((entry) => ({
        id: entry.sourceId,
        name: entry.sourceName,
        url: entry.sourceUrl,
        category: entry.category,
        description: entry.description,
      }))
    : LOCAL_DATA_SOURCES;

  // Build a lookup map: sourceId → schedule entry for O(1) access in cards
  const scheduleBySourceId = mkrSchedule?.matrix
    ? Object.fromEntries(mkrSchedule.matrix.map((e) => [e.sourceId, e]))
    : {};
  const emptySourceCount = mkrSchedule?.matrix.filter((entry) => entry.lastCrawledAt === null).length ?? 0;
  const tierOneEmptySources = mkrSchedule?.matrix.filter(
    (entry) => entry.businessValue >= 9 && entry.lastCrawledAt === null,
  ) ?? [];

  const handleFetch = (source: typeof DATA_SOURCES[0]) => {
    setActiveSourceId(source.id);
    fetchMutation.mutate(
      { data: { url: source.url, sourceLabel: source.name, category: source.category } },
      {
        onSuccess: (data) => {
          setFetchResults((prev) => ({ ...prev, [source.id]: data }));
          setActiveSourceId(null);
          const count = (data as { itemsSaved?: number })?.itemsSaved ?? (data as { items?: unknown[] })?.items?.length;
          toast({ title: `Data dari ${source.name} berhasil diambil`, description: count != null ? `${count} item baru tersimpan` : "Selesai", duration: 2500 });
        },
        onError: (err: unknown) => {
          setActiveSourceId(null);
          toast({ title: "Fetch Gagal", description: err instanceof Error ? err.message : `Gagal mengambil data dari ${source.name}`, variant: "destructive" });
        },
      }
    );
  };

  const handleSchedulerTrigger = (source: typeof DATA_SOURCES[0]) => {
    setSchedulerTriggering(source.id);
    schedulerTrigger.mutate(
      { params: { sourceId: source.id } },
      {
        onSuccess: (report) => {
          const result = report.results.find((r) => r.sourceId === source.id);
          setSchedulerResults((prev) => ({
            ...prev,
            [source.id]: {
              savedAt: report.finishedAt,
              itemsSaved: result?.itemsSaved ?? 0,
              status: result?.status ?? "DONE",
            },
          }));
          setSchedulerTriggering(null);
           void queryClient.invalidateQueries({ queryKey: getGetMkrCrawlScheduleQueryKey() });
          toast({
            title: `${source.name} — Scheduler Selesai`,
            description: `${result?.itemsSaved ?? 0} item baru disimpan ke riset`,
          });
        },
        onError: (err: unknown) => {
          setSchedulerTriggering(null);
          const msg = err instanceof Error ? err.message : "Error tidak diketahui";
          toast({ title: "Scheduler Gagal", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleCrawlEmptySources = () => {
    if (emptySourceCount === 0 || crawlingEmptySources) return;
    setCrawlingEmptySources(true);
    emptySourcesTrigger.mutate(undefined, {
      onSuccess: (report) => {
        setCrawlingEmptySources(false);
        void queryClient.invalidateQueries({ queryKey: getGetMkrCrawlScheduleQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetSchedulerStatusQueryKey() });
        toast({
          title: "Crawl sumber kosong selesai",
          description: `${report.results.length} sumber diproses · ${report.totalItemsSaved} item baru disimpan`,
        });
      },
      onError: (err: unknown) => {
        setCrawlingEmptySources(false);
        toast({
          title: "Crawl sumber kosong gagal",
          description: err instanceof Error ? err.message : "Coba lagi setelah scheduler siap.",
          variant: "destructive",
        });
      },
    });
  };

  const handleSaveToResearch = (item: FetchedItem, sourceName: string, category: string, resultId: string, itemIdx: number) => {
    createResearchItemMutation.mutate(
      { data: { title: item.title, summary: item.content, source: sourceName, sourceUrl: item.url || undefined, category } },
      {
        onSuccess: () => {
          toast({ title: "Tersimpan", description: item.title ? `"${item.title.slice(0, 50)}" disimpan ke riset` : "Item berhasil disimpan ke riset." });
          setFetchResults((prev) => {
            const newResults = { ...prev };
            if (newResults[resultId]?.items) newResults[resultId].items[itemIdx].savedAsResearchItem = true;
            return newResults;
          });
        },
      }
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SUCCESS": return <CircleCheck className="h-3.5 w-3.5 text-green-500" />;
      case "BLOCKED": return <CircleAlert className="h-3.5 w-3.5 text-orange-500" />;
      case "ERROR": return <CircleX className="h-3.5 w-3.5 text-red-500" />;
      case "PARTIAL": return <CircleCheck className="h-3.5 w-3.5 text-yellow-500" />;
      default: return null;
    }
  };

  const isJobRunning = schedulerStatus?.isRunning === true;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Data Collector — Sumber Eksternal
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {DATA_SOURCES.length} sumber · Fetch manual atau trigger scheduler per-sumber
            {pinnedSources.size > 0 && (
              <span className="ml-2 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                {pinnedSources.size} diprioritaskan
              </span>
            )}
            {(() => { const now = Date.now(); const active24h = Object.values(schedulerResults).filter(r => r.savedAt && now - new Date(r.savedAt).getTime() < 86_400_000).length; return active24h > 0 ? (
              <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                {active24h} aktif 24 jam
              </span>
            ) : null; })()}
            {Object.values(sourceNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowNotesOnly(v => !v)}
                aria-pressed={showNotesOnly}
                className={cn("ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors", showNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Klik untuk filter hanya sumber dengan catatan"
              >
                {Object.values(sourceNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
            {(() => { const errors = Object.values(schedulerResults).filter(r => r.status === "ERROR").length; return errors > 0 ? (
              <span className="ml-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                {errors} crawl gagal
              </span>
            ) : null; })()}
          </p>
        </div>
        {isJobRunning && (
          <div className="flex items-center gap-2 text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-3 py-1.5">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Scheduler sedang berjalan...
          </div>
        )}
      </div>

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="data-collector" />

      {/* Pinned sources strip */}
      {pinnedSources.size === 0 && (
        <div className="border border-dashed border-amber-200 rounded-sm p-4 bg-amber-50/20 flex flex-col items-center gap-1.5 text-center">
          <Star className="h-6 w-6 opacity-30 text-amber-500" />
          <p className="text-[10px] font-mono text-muted-foreground">Belum ada sumber dipin. Klik ★ pada kartu sumber untuk memprioritaskannya di sini.</p>
        </div>
      )}
      {pinnedSources.size > 0 && (
        <div className="border border-amber-200 rounded-sm p-3 bg-amber-50/30">
          <p className="text-[9px] font-mono font-semibold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5">
            <Star className="h-3 w-3 text-amber-500" /> SUMBER DIPRIORITASKAN — {pinnedSources.size} sumber dipin
          </p>
          <div className="flex flex-wrap gap-2">
            {DATA_SOURCES.filter(s => pinnedSources.has(s.id)).map(s => (
              <button
                key={s.id}
                onClick={() => { const el = document.getElementById(`source-card-${s.id}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-sm border border-amber-300 bg-amber-100/60 text-amber-800 hover:bg-amber-100 transition-colors"
              >
                <Star className="h-3 w-3 text-amber-500 fill-amber-400" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data Intelligence Coverage Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> DATA INTELLIGENCE COVERAGE MAP — Pemetaan Sumber per Kebutuhan Bisnis
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[
            { need: "Temukan Tender Aktif", sources: ["SPSE/LPSE Nasional", "IndoTender", "LPSE Kemenpupr", "IKN Nusantara"], freshness: "Harian", signal: "KRITIS", color: "border-blue-400 bg-blue-50/30" },
            { need: "Verifikasi SBU Kontraktor", sources: ["LPJK PUPR", "Citra Data", "IndoKontraktor"], freshness: "Mingguan", signal: "TINGGI", color: "border-purple-400 bg-purple-50/30" },
            { need: "Cek SKK Tenaga Ahli", sources: ["Kemnaker", "SIBIMA PUPR", "BNSP Sertifikasi"], freshness: "Bulanan", signal: "TINGGI", color: "border-yellow-400 bg-yellow-50/20" },
            { need: "Legalitas & Perijinan", sources: ["JDIH PUPR", "JDIH Nasional", "Portal K3 Kemnaker"], freshness: "Harian", signal: "TINGGI", color: "border-violet-400 bg-violet-50/20" },
            { need: "Pantau Proyek Baru", sources: ["BCI Central", "SIMPUL KPBU", "Top Konstruksi"], freshness: "Harian", signal: "KRITIS", color: "border-emerald-400 bg-emerald-50/20" },
          ].map((c) => (
            <div key={c.need} className={`border rounded-sm p-2.5 ${c.color}`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold">{c.need}</p>
                <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm font-bold ${
                  c.signal === "KRITIS" ? "bg-red-100 text-red-700" :
                  c.signal === "TINGGI" ? "bg-orange-100 text-orange-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>{c.signal}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {c.sources.map(s => <span key={s} className="text-[8px] font-mono bg-white/70 border px-1.5 py-0.5 rounded-sm">{s}</span>)}
              </div>
              <p className="text-[9px] font-mono text-muted-foreground">🔄 Update: {c.freshness}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats + Reset */}
      <div className={cn(
        "border rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
        tierOneEmptySources.length > 0 ? "border-red-300 bg-red-50/60" : "border-emerald-200 bg-emerald-50/40",
      )}>
        <div className="flex items-start gap-3">
          {tierOneEmptySources.length > 0 ? (
            <TriangleAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <CircleCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className={cn(
              "text-[10px] font-mono font-bold uppercase tracking-wider",
              tierOneEmptySources.length > 0 ? "text-red-700" : "text-emerald-700",
            )}>
              {tierOneEmptySources.length > 0 ? "COVERAGE GAP TIER-1" : "COVERAGE TIER-1 LENGKAP"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mkrSchedule
                ? tierOneEmptySources.length > 0
                  ? `${tierOneEmptySources.length} sumber business value ≥ 9 belum pernah dicrawl`
                  : "Semua sumber business value ≥ 9 sudah memiliki histori crawl"
                : "Memuat histori crawl sumber…"}
              {mkrSchedule && emptySourceCount > tierOneEmptySources.length && (
                <span className="ml-1">({emptySourceCount} sumber kosong total)</span>
              )}
            </p>
            {tierOneEmptySources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tierOneEmptySources.map((source) => (
                  <button
                    key={source.sourceId}
                    type="button"
                    className="text-[9px] font-mono font-semibold text-red-700 border border-red-200 bg-white/70 rounded-sm px-1.5 py-0.5 hover:bg-red-100"
                    onClick={() => document.getElementById(`source-card-${source.sourceId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    title={`Buka kartu ${source.sourceName}`}
                  >
                    {source.sourceName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={tierOneEmptySources.length > 0 ? "destructive" : "outline"}
          className="h-8 text-[10px] font-mono shrink-0"
          onClick={handleCrawlEmptySources}
          disabled={!mkrSchedule || emptySourceCount === 0 || crawlingEmptySources || isJobRunning}
          title={emptySourceCount > 0 ? `Crawl ${emptySourceCount} sumber tanpa histori` : "Semua sumber sudah pernah dicrawl"}
        >
          {crawlingEmptySources ? (
            <><LoaderCircle className="h-3 w-3 mr-1.5 animate-spin" /> Crawling…</>
          ) : (
            <><Zap className="h-3 w-3 mr-1.5" /> Crawl Sumber Kosong{emptySourceCount > 0 ? ` (${emptySourceCount})` : ""}</>
          )}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
        {[
          { label: "Total Sumber", val: DATA_SOURCES.length, icon: Globe, color: "text-primary" },
          { label: "Tender", val: DATA_SOURCES.filter(s => s.category === "TENDER").length, icon: Database, color: "text-blue-600" },
          { label: "SBU & SKK", val: DATA_SOURCES.filter(s => s.category === "SBU" || s.category === "SKK").length, icon: ShieldCheck, color: "text-purple-600" },
          { label: "Punya Hasil", val: Object.keys(fetchResults).length + Object.keys(schedulerResults).length, icon: CircleCheck, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="border rounded-sm p-3 bg-card flex items-center gap-3">
            <s.icon className={`h-5 w-5 shrink-0 ${s.color}`} />
            <div>
              <p className="text-xl font-bold font-mono leading-none">{s.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
        </div>
        {(Object.keys(fetchResults).length + Object.keys(schedulerResults).length) > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px] font-mono text-destructive border-destructive/40 hover:bg-destructive/5 shrink-0"
            onClick={() => { setFetchResults({}); setSchedulerResults({}); }}
          >
            <RotateCcw className="h-3 w-3 mr-1.5" /> RESET SESI
          </Button>
        )}
      </div>

      {/* Crawl Health Summary */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> CRAWL HEALTH MONITOR — Status Kesehatan Sumber Data
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { cat: "LEGALITAS", id: "LEGALITAS_PERIJINAN", total: DATA_SOURCES.filter(s => s.category === "LEGALITAS_PERIJINAN").length, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
            { cat: "SBU", id: "SBU", total: DATA_SOURCES.filter(s => s.category === "SBU").length, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
            { cat: "SKK", id: "SKK", total: DATA_SOURCES.filter(s => s.category === "SKK").length, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
            { cat: "TENDER", id: "TENDER", total: DATA_SOURCES.filter(s => s.category === "TENDER").length, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
            { cat: "PROYEK", id: "PROYEK", total: DATA_SOURCES.filter(s => s.category === "PROYEK").length, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
            { cat: "TOTAL AKTIF", id: "ALL", total: DATA_SOURCES.length, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
          ].map((c) => {
            const now = Date.now();
            const crawled24h = c.id === "ALL"
              ? Object.values(schedulerResults).filter(r => r.savedAt && now - new Date(r.savedAt).getTime() < 86_400_000).length
              : DATA_SOURCES.filter(s => s.category === c.id).filter(s => schedulerResults[s.id]?.savedAt && now - new Date(schedulerResults[s.id].savedAt).getTime() < 86_400_000).length;
            const pct = c.total > 0 ? Math.round((crawled24h / c.total) * 100) : 0;
            return (
              <div key={c.id} className={`border rounded-sm p-2.5 text-center ${c.bg}`}>
                <p className={`text-lg font-black font-mono leading-none ${c.color}`}>{c.total}</p>
                <p className="text-[9px] font-mono font-semibold uppercase mt-0.5 text-muted-foreground">{c.cat}</p>
                <div className="mt-1.5 h-1 bg-white/60 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${c.id === "ALL" ? "bg-primary" : c.id === "TENDER" ? "bg-blue-500" : c.id === "SBU" ? "bg-purple-500" : c.id === "SKK" ? "bg-yellow-500" : c.id === "PROYEK" ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{crawled24h}/{c.total} 24 jam</p>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">
          Klik SCHEDULER SUMBER INI di kartu individual untuk crawl sumber spesifik · Status reset tiap sesi browser
        </p>
      </div>

      {/* Intel Quality Benchmark */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> INTEL QUALITY BENCHMARK — Standar Kualitas Data per Kategori Sumber
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { kat: "Pemerintah & Regulasi", standar: ["URL sumber resmi .go.id", "Nomor peraturan tercantum", "Tanggal berlaku jelas", "Ringkasan dampak bisnis"], skor: 92, color: "bg-red-500" },
            { kat: "Sertifikasi & Lisensi", standar: ["No. registrasi terverifikasi", "Tanggal expire dicatat", "Nama pemegang jelas", "Link LPJK/BNSP valid"], skor: 88, color: "bg-orange-500" },
            { kat: "Tender & Pengadaan", standar: ["Kode LPSE/Tender ID", "Nilai HPS tercantum", "Syarat SBU diidentifikasi", "Deadline akurat"], skor: 85, color: "bg-blue-500" },
            { kat: "Media & Berita Industri", standar: ["URL artikel tersimpan", "Nama media terverifikasi", "Relevansi >70% dengan domain", "Ringkasan faktual"], skor: 76, color: "bg-yellow-500" },
            { kat: "Kompetitor & Harga", standar: ["Harga dengan satuan jelas", "Sumber kompetitor valid", "Tanggal capture dicatat", "Layanan sebanding"], skor: 71, color: "bg-violet-500" },
            { kat: "Riset Lapangan", standar: ["Foto bukti dilampirkan", "Nama responden opsional", "Pain score 1–10 diisi", "Peluang layanan dicatat"], skor: 83, color: "bg-emerald-500" },
          ].map((k) => (
            <div key={k.kat} className="border rounded-sm p-3 bg-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold">{k.kat}</p>
                <span className="text-[10px] font-mono font-bold text-primary">{k.skor}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <div className={`h-full ${k.color} rounded-full`} style={{ width: `${k.skor}%` }} />
              </div>
              <ul className="space-y-0.5">
                {k.standar.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[9px] text-muted-foreground">
                    <CircleCheck className="h-2.5 w-2.5 text-emerald-500 shrink-0 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Skor kualitas = % data yang memenuhi semua standar · Skor ≥80% = data premium untuk AI briefing & analisis klien</p>
      </div>

      {/* Source ROI Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> SOURCE ROI TRACKER — Nilai Intelijen per Sumber Data
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Sumber", "Kategori", "Frekuensi Update", "Riset Terhasilkan", "Nilai Bisnis", "ROI Signal"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { src: "SPSE/LPSE Nasional", cat: "TENDER", freq: "Harian", riset: "15–30/bln", nilai: "Rp 50–300jt", roi: "KRITIS", roiColor: "bg-red-100 text-red-700" },
                { src: "LPJK PUPR", cat: "KONTRAKTOR", freq: "Mingguan", riset: "10–20/bln", nilai: "Rp 20–120jt", roi: "TINGGI", roiColor: "bg-orange-100 text-orange-700" },
                { src: "SIBIMA PUPR", cat: "SKK", freq: "Bulanan", riset: "5–10/bln", nilai: "Rp 15–80jt", roi: "TINGGI", roiColor: "bg-orange-100 text-orange-700" },
                { src: "JDIH PUPR", cat: "REGULASI", freq: "Harian", riset: "3–8/bln", nilai: "Rp 10–50jt", roi: "SEDANG", roiColor: "bg-yellow-100 text-yellow-700" },
                { src: "TKDN Kemenperin", cat: "KONTRAKTOR", freq: "Mingguan", riset: "5–12/bln", nilai: "Rp 25–90jt", roi: "TINGGI", roiColor: "bg-orange-100 text-orange-700" },
                { src: "IKN Nusantara", cat: "TENDER", freq: "Harian", riset: "8–20/bln", nilai: "Rp 40–200jt", roi: "KRITIS", roiColor: "bg-red-100 text-red-700" },
              ].map((r) => (
                <tr key={r.src} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.src}</td>
                  <td className="px-3 py-2"><span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">{r.cat}</span></td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.freq}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.riset}</td>
                  <td className="px-3 py-2 font-mono text-[10px] font-semibold text-emerald-700">{r.nilai}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.roiColor}`}>{r.roi}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">ROI Signal = estimasi nilai bisnis yang dapat digali per bulan dari sumber tersebut · Nilai berdasarkan rata-rata deal size</p>
      </div>

      {/* Data Collection Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> DATA COLLECTION ROADMAP — Target Coverage & Integrasi 90 Hari
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              phase: "BULAN 1", label: "FONDASI", color: "bg-blue-500", textColor: "text-blue-700",
              targets: ["Aktifkan scheduler otomatis untuk 64 sumber aktif", "Perbaiki 5 sumber dengan error rate >20%", "Tambah 8 sumber IKN: Otorita, KPBU, e-proc IKN", "Pasang monitoring freshness per sumber"]
            },
            {
              phase: "BULAN 2", label: "EKSPANSI", color: "bg-orange-500", textColor: "text-orange-700",
              targets: ["Integrasi API LPJK real-time untuk SKK + SBU", "Crawl histori LPSE 3 tahun (batch)", "Tambah sumber harga: HSPK regional + e-katalog LKPP", "Build deduplication engine untuk riset overlap"]
            },
            {
              phase: "BULAN 3", label: "KUALITAS", color: "bg-emerald-500", textColor: "text-emerald-700",
              targets: ["Capai data freshness <12 jam untuk sumber tier-1", "Validasi otomatis URL + relevance score per item", "Coverage 90%+ kategori TENDER & SERTIFIKASI", "Launch knowledge quality dashboard untuk tim intel"]
            },
          ].map((p) => (
            <div key={p.phase} className="border rounded-sm p-3">
              <div className={`text-[9px] font-mono font-bold text-white px-2 py-0.5 rounded-sm ${p.color} inline-block mb-2`}>{p.phase} — {p.label}</div>
              <ul className="space-y-1">
                {p.targets.map((t, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[9px]">
                    <span className={`font-mono font-bold ${p.textColor} shrink-0`}>{i + 1}.</span>
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Source Priority Score */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> SOURCE PRIORITY SCORE — Prioritas Crawling Sumber Berdasarkan Value × Freshness
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { sumber: "LPJK Online", score: 10, fresh: "Real-time", cat: "SERTIFIKASI", color: "bg-red-500", textColor: "text-red-700" },
            { sumber: "LPSE 64 Kota", score: 10, fresh: "Harian", cat: "TENDER", color: "bg-red-500", textColor: "text-red-700" },
            { sumber: "JDIH PUPR", score: 9, fresh: "Mingguan", cat: "REGULASI", color: "bg-orange-500", textColor: "text-orange-700" },
            { sumber: "IjinTender.co.id", score: 8, fresh: "Harian", cat: "KOMPETITOR", color: "bg-orange-500", textColor: "text-orange-700" },
            { sumber: "LKPP e-Katalog", score: 8, fresh: "Mingguan", cat: "TKDN/PDN", color: "bg-yellow-500", textColor: "text-yellow-700" },
            { sumber: "Otorita IKN", score: 9, fresh: "Mingguan", cat: "TENDER IKN", color: "bg-orange-500", textColor: "text-orange-700" },
            { sumber: "BNSP Online", score: 9, fresh: "Bulanan", cat: "SKK", color: "bg-orange-500", textColor: "text-orange-700" },
            { sumber: "SiRUP Bappenas", score: 7, fresh: "Mingguan", cat: "PERENCANAAN", color: "bg-yellow-500", textColor: "text-yellow-700" },
            { sumber: "Kontan.co.id", score: 6, fresh: "Real-time", cat: "MEDIA", color: "bg-muted-foreground/40", textColor: "text-muted-foreground" },
            { sumber: "LinkedIn Industri", score: 5, fresh: "Real-time", cat: "SOSMED", color: "bg-muted-foreground/30", textColor: "text-muted-foreground" },
          ].map((s) => (
            <div key={s.sumber} className="border rounded-sm p-2 text-center">
              <div className={`h-1 ${s.color} rounded-full mb-1.5`} />
              <p className="text-xl font-black font-mono text-primary leading-none">{s.score}</p>
              <p className="text-[9px] font-mono leading-tight mt-0.5">{s.sumber}</p>
              <span className={`text-[8px] font-mono ${s.textColor}`}>{s.cat}</span>
              <p className="text-[8px] font-mono text-muted-foreground mt-0.5">{s.fresh}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Score 1–10 = prioritas crawling · Fokus bandwidth server pada sumber score ≥8 terlebih dahulu</p>
      </div>

      {/* Crawl Efficiency Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> CRAWL EFFICIENCY DASHBOARD — Performa Pengumpulan Data per Sumber Utama
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { src: "LPJK Online", uptime: "99%", avg: "2.1K item/hr", latency: "< 1 dtk", status: "OPTIMAL", sc: "bg-emerald-100 text-emerald-700" },
            { src: "LPSE Multi-Kota", uptime: "97%", avg: "850 item/hr", latency: "2–5 dtk", status: "BAIK", sc: "bg-blue-100 text-blue-700" },
            { src: "JDIH PUPR", uptime: "95%", avg: "120 item/hr", latency: "3–8 dtk", status: "BAIK", sc: "bg-blue-100 text-blue-700" },
            { src: "IjinTender", uptime: "88%", avg: "430 item/hr", latency: "5–12 dtk", status: "DEGRADED", sc: "bg-yellow-100 text-yellow-700" },
            { src: "LKPP e-Katalog", uptime: "93%", avg: "280 item/hr", latency: "4–9 dtk", status: "BAIK", sc: "bg-blue-100 text-blue-700" },
            { src: "SiRUP Bappenas", uptime: "82%", avg: "190 item/hr", latency: "8–20 dtk", status: "LAMBAT", sc: "bg-orange-100 text-orange-700" },
          ].map((s) => (
            <div key={s.src} className="border rounded-sm p-2 text-center">
              <p className="text-[9px] font-mono font-bold leading-tight mb-1">{s.src}</p>
              <p className="text-xl font-black font-mono text-primary leading-none">{s.uptime}</p>
              <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm ${s.sc}`}>{s.status}</span>
              <p className="text-[8px] text-muted-foreground mt-0.5">{s.avg}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{s.latency}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Quality Gate */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> DATA QUALITY GATE — Kriteria Penerimaan Data sebelum Masuk Database Utama
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { gate: "Sumber Verifiable", desc: "URL valid + domain official (.go.id atau dikenal)", pass: "99.1%", passColor: "text-emerald-700", icon: "✓" },
            { gate: "Duplikat Check", desc: "Hash fingerprint title + tanggal + lokasi", pass: "97.4%", passColor: "text-emerald-700", icon: "✓" },
            { gate: "Kelengkapan Field", desc: "Minimal 70% field non-null terisi", pass: "91.8%", passColor: "text-emerald-700", icon: "✓" },
            { gate: "Tanggal Valid", desc: "Tidak lebih tua dari 12 bulan kecuali arsip", pass: "88.5%", passColor: "text-blue-700", icon: "~" },
            { gate: "Nilai Numerik Valid", desc: "HPS, nilai kontrak dalam range logis", pass: "95.2%", passColor: "text-emerald-700", icon: "✓" },
            { gate: "Encoding UTF-8", desc: "Karakter Indonesia + simbol mata uang bersih", pass: "99.8%", passColor: "text-emerald-700", icon: "✓" },
          ].map((g) => (
            <div key={g.gate} className="border rounded-sm p-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`font-mono font-bold text-[9px] ${g.passColor}`}>{g.icon}</span>
                <p className="text-[9px] font-semibold">{g.gate}</p>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1 leading-snug">{g.desc}</p>
              <p className={`text-[10px] font-mono font-bold ${g.passColor}`}>Pass: {g.pass}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Pass rate = persentase data yang lolos gate ini dari total data yang dicrawl · Target semua gate ≥95%</p>
      </div>

      {/* Data Pipeline Health Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> DATA PIPELINE HEALTH MONITOR — Status Kesehatan Alur Data dari Crawl ke Database
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { stage: "Crawl", health: 98, status: "SEHAT", sc: "text-emerald-700", bc: "bg-emerald-500" },
            { stage: "Parse & Clean", health: 94, status: "SEHAT", sc: "text-emerald-700", bc: "bg-blue-500" },
            { stage: "Quality Gate", health: 91, status: "SEHAT", sc: "text-emerald-700", bc: "bg-blue-400" },
            { stage: "DB Insert", health: 87, status: "MONITOR", sc: "text-yellow-700", bc: "bg-yellow-500" },
          ].map((s) => (
            <div key={s.stage} className="border rounded-sm p-2 text-center">
              <p className="text-[9px] font-mono font-bold">{s.stage}</p>
              <p className={`text-xl font-black font-mono leading-none mt-0.5 ${s.sc}`}>{s.health}%</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${s.bc} rounded-full`} style={{ width: `${s.health}%` }} />
              </div>
              <span className={`text-[8px] font-mono font-bold ${s.sc}`}>{s.status}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Total Crawled Hari Ini", val: "12.4K item" },
            { label: "Lolos Quality Gate", val: "11.3K (91%)" },
            { label: "Inserted ke DB", val: "9.8K (87%)" },
            { label: "Ditolak / Duplikat", val: "2.6K (21%)" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className="text-[10px] font-mono font-bold text-primary">{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Crawl Source Performance League */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-600" /> SOURCE PERFORMANCE LEAGUE — Sumber Data Terbaik berdasarkan Volume, Kualitas & Kebaruan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["#", "Sumber", "Item/Hari", "Kualitas", "Freshness", "Uptime", "Score"].map(h => (
                  <th key={h} className="text-left px-2 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { rank: 1, src: "LPJK API", perDay: 580, quality: 96, fresh: 98, uptime: 99.8, score: 98 },
                { rank: 2, src: "LPSE Multi-Kota", perDay: 420, quality: 94, fresh: 99, uptime: 97.2, score: 95 },
                { rank: 3, src: "JDIH PUPR", perDay: 48, quality: 98, fresh: 90, uptime: 99.5, score: 93 },
                { rank: 4, src: "BNSP Database", perDay: 220, quality: 91, fresh: 85, uptime: 96.1, score: 88 },
                { rank: 5, src: "IjinTender Scraper", perDay: 180, quality: 82, fresh: 92, uptime: 89.4, score: 80 },
              ].map((r) => {
                const sc = r.score >= 90 ? "text-emerald-700" : r.score >= 80 ? "text-blue-700" : "text-orange-700";
                return (
                  <tr key={r.rank} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-2 font-mono text-muted-foreground/60 text-[10px]">{r.rank}</td>
                    <td className="px-2 py-2 font-medium text-[10px]">{r.src}</td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.perDay}</td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.quality}%</td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.fresh}%</td>
                    <td className="px-2 py-2 font-mono text-[10px]">{r.uptime}%</td>
                    <td className={`px-2 py-2 font-mono font-black text-[11px] ${sc}`}>{r.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Anomaly Detector */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-red-600" /> DATA ANOMALY DETECTOR — Penyimpangan Data yang Butuh Verifikasi Manual Segera
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { anomaly: "128 entry BUJK tanpa SKK aktif tapi masih terdaftar SBU", type: "INTEGRITAS", severity: "TINGGI", action: "Validasi manual ke LPJK", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { anomaly: "34 tender LPSE dengan nilai HPS Rp 0 atau negatif", type: "DATA ERROR", severity: "KRITIS", action: "Re-fetch dari LPSE langsung", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { anomaly: "Duplikat entry: 89 kontraktor dengan NIB sama tapi nama berbeda", type: "DUPLIKAT", severity: "SEDANG", action: "Merge + verifikasi ke OSS", sc: "text-yellow-700", bc: "bg-yellow-50 border-yellow-200" },
            { anomaly: "12 SKK dengan tanggal expiry sebelum tanggal issu", type: "LOGIKA", severity: "KRITIS", action: "Flag dan hapus dari DB", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((a) => (
            <div key={a.anomaly} className={`border rounded-sm p-3 ${a.bc}`}>
              <div className="flex items-start gap-2">
                <span className={`text-[8px] font-mono font-bold shrink-0 mt-0.5 ${a.sc}`}>[{a.type}/{a.severity}]</span>
                <div className="flex-1">
                  <p className="text-[9px] leading-snug">{a.anomaly}</p>
                  <p className={`text-[9px] font-mono mt-0.5 ${a.sc}`}>→ {a.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collection Efficiency by Team Member */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM COLLECTION EFFICIENCY — Produktivitas Tim per Anggota Bulan Ini
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Anggota", "Item Dikumpulkan", "Terverifikasi", "Foto Bukti", "Avg Skor", "Status"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Budi S.", collected: 148, verified: 134, photos: 112, score: 94, status: "🏆 TOP", sc: "text-amber-600" },
                { name: "Rina K.", collected: 122, verified: 118, photos: 98, score: 91, status: "⭐ EXCELLENT", sc: "text-emerald-700" },
                { name: "Dian P.", collected: 89, verified: 82, photos: 71, score: 86, status: "✓ GOOD", sc: "text-blue-700" },
                { name: "Ahmad R.", collected: 64, verified: 58, photos: 44, score: 79, status: "→ AVG", sc: "text-muted-foreground" },
                { name: "Sari N.", collected: 38, verified: 31, photos: 22, score: 71, status: "⬇ LOW", sc: "text-orange-700" },
              ].map((m) => (
                <tr key={m.name} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px]">{m.name}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{m.collected}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{m.verified}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{m.photos}</td>
                  <td className="px-3 py-2 font-mono font-bold text-[10px] text-primary">{m.score}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${m.sc}`}>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Acquisition Cost ROI */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> DATA ACQUISITION ROI — Berapa Revenue yang Dihasilkan per Rupiah yang Diinvestasikan untuk Data
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Biaya Akuisisi Data/Bln", val: "Rp 28jt", tc: "text-orange-700" },
            { label: "Revenue dari Data/Bln", val: "Rp 374jt", tc: "text-emerald-700" },
            { label: "Data ROI Multiplier", val: "13.4×", tc: "text-primary" },
            { label: "Cost per Data Poin", val: "Rp 18rb", tc: "text-blue-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {[
            { src: "Tim Lapangan (salary + transport)", cost: "Rp 18jt/bln", roi: "8.2×", highest: false },
            { src: "API LPJK + BNSP (subscription)", cost: "Rp 4jt/bln", roi: "28×", highest: true },
            { src: "Web Scraper Tools (infra + maintenance)", cost: "Rp 3jt/bln", roi: "22×", highest: false },
            { src: "Crowdsource dari klien aktif", cost: "Rp 3jt/bln", roi: "34×", highest: true },
          ].map((s) => (
            <div key={s.src} className="flex items-center justify-between gap-3 border-b last:border-0 pb-1 last:pb-0">
              <p className="text-[9px] text-muted-foreground flex-1">{s.src}</p>
              <p className="text-[9px] font-mono">{s.cost}</p>
              <p className={`text-[9px] font-mono font-bold ${s.highest ? "text-emerald-700" : "text-muted-foreground"}`}>{s.roi} ROI</p>
            </div>
          ))}
        </div>
      </div>

      {/* Collector Gamification Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-yellow-600" /> COLLECTOR LEADERBOARD — Papan Peringkat Tim Pengumpul Data Bulan Ini
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { rank: 1, name: "Budi S. (Jawa Tengah)", pts: 2841, items: 142, quality: "98%", streak: "22 hari", badge: "🥇" },
            { rank: 2, name: "Siti R. (Jawa Timur)", pts: 2614, items: 131, quality: "96%", streak: "18 hari", badge: "🥈" },
            { rank: 3, name: "Agus P. (Jakarta)", pts: 2388, items: 118, quality: "94%", streak: "15 hari", badge: "🥉" },
            { rank: 4, name: "Dewi M. (Bali)", pts: 1972, items: 98, quality: "92%", streak: "12 hari", badge: "⭐" },
            { rank: 5, name: "Hendra W. (Sumatera)", pts: 1744, items: 87, quality: "89%", streak: "9 hari", badge: "⭐" },
          ].map((c) => (
            <div key={c.rank} className={`flex items-center gap-3 border rounded-sm p-2.5 ${c.rank <= 3 ? "bg-yellow-50/30 border-yellow-200" : "bg-muted/20"}`}>
              <span className="text-lg leading-none shrink-0">{c.badge}</span>
              <div className="flex-1">
                <p className="text-[9px] font-semibold">{c.name}</p>
                <p className="text-[9px] font-mono text-muted-foreground">{c.items} item · Quality: {c.quality} · Streak: {c.streak}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-black font-mono text-primary">{c.pts.toLocaleString()}</p>
                <p className="text-[8px] font-mono text-muted-foreground">poin</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Poin = jumlah item × quality score × streak bonus · Hadiah: voucher Rp 500rb untuk top 3 tiap bulan</p>
      </div>

      {/* Data Quality Improvement Recommendations */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> DATA QUALITY IMPROVEMENT — Rekomendasi Prioritas Meningkatkan Kualitas Dataset
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { issue: "14% entry kontraktor tidak punya nomor telepon valid", impact: "Tidak bisa di-follow up via WhatsApp", fix: "Wajibkan field HP di form input mobile", effort: "MUDAH", severity: "TINGGI", sc: "text-emerald-700" },
            { issue: "23% data tender tidak ada nilai HPS", impact: "Tidak bisa kalkulasi win rate otomatis", fix: "Tambah scraper nilai HPS dari LPSE", effort: "SEDANG", severity: "TINGGI", sc: "text-emerald-700" },
            { issue: "38% pain point tidak memiliki foto bukti", impact: "Kualitas riset lapangan meragukan", fix: "Ubah foto bukti jadi wajib di form mobile", effort: "MUDAH", severity: "SEDANG", sc: "text-blue-700" },
            { issue: "SKK data tidak di-update setelah perpanjangan", impact: "Expiry alert salah waktu", fix: "Trigger auto-refresh dari API BNSP setiap renewal", effort: "KOMPLEKS", severity: "KRITIS", sc: "text-red-700" },
          ].map((r) => (
            <div key={r.issue} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold leading-snug">{r.issue}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.severity}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{r.impact}</p>
                <p className="text-[9px] font-mono text-primary">→ {r.fix}</p>
              </div>
              <span className={`text-[8px] font-mono font-bold shrink-0 mt-0.5 ${r.effort === "MUDAH" ? "text-emerald-700" : r.effort === "SEDANG" ? "text-orange-700" : "text-red-700"}`}>{r.effort}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Collection Sprint Planner */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-600" /> COLLECTION SPRINT PLANNER — Target Pengumpulan Data 2 Minggu ke Depan per Tim
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          {[
            { team: "Tim A — Jawa Barat + DKI Jakarta", target: 280, done: 94, deadline: "16 Ags 2026", focus: "Kontraktor + SKK holders baru" },
            { team: "Tim B — Jawa Tengah + Jawa Timur", target: 245, done: 112, deadline: "16 Ags 2026", focus: "Pain point tender APBD" },
            { team: "Tim C — Sumatera Utara + Riau", target: 190, done: 61, deadline: "18 Ags 2026", focus: "Peluang tender infrastruktur" },
            { team: "Tim D — Remote (Kalimantan + Sulawesi)", target: 155, done: 38, deadline: "20 Ags 2026", focus: "Data BUJK daerah terpencil" },
          ].map((t) => {
            const pct = Math.round((t.done / t.target) * 100);
            return (
              <div key={t.team} className="border rounded-sm p-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[9px] font-semibold leading-snug">{t.team}</p>
                  <span className={`text-[10px] font-mono font-black shrink-0 ${pct >= 50 ? "text-emerald-700" : pct >= 30 ? "text-orange-700" : "text-red-700"}`}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                  <div className={`h-full rounded-full ${pct >= 50 ? "bg-emerald-500" : pct >= 30 ? "bg-orange-500" : "bg-red-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[9px] font-mono text-muted-foreground">{t.done}/{t.target} item · Deadline: {t.deadline}</p>
                <p className="text-[9px] text-primary font-mono">Fokus: {t.focus}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Collection Quality Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> QUALITY RADAR — Dimensi Kualitas Data dari Sumber yang Dikumpulkan Tim
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { dim: "Akurasi", score: 87, desc: "Verified vs unverified", c: "bg-emerald-500", tc: "text-emerald-700" },
            { dim: "Kelengkapan", score: 74, desc: "Field wajib terisi", c: "bg-blue-500", tc: "text-blue-700" },
            { dim: "Aktualitas", score: 68, desc: "Data < 30 hari", c: "bg-blue-400", tc: "text-blue-600" },
            { dim: "Konsistensi", score: 81, desc: "Format standar", c: "bg-violet-500", tc: "text-violet-700" },
            { dim: "Sumber Valid", score: 92, desc: "Primary source", c: "bg-emerald-600", tc: "text-emerald-800" },
            { dim: "Geospasial", score: 58, desc: "Lokasi terisi", c: "bg-orange-400", tc: "text-orange-700" },
          ].map((d) => (
            <div key={d.dim} className="border rounded-sm p-2 text-center">
              <div className="relative h-12 w-12 mx-auto mb-1">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeDasharray={`${d.score * 0.879} 87.9`}
                    className={d.tc} strokeLinecap="round" />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono ${d.tc}`}>{d.score}</span>
              </div>
              <p className="text-[9px] font-semibold">{d.dim}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Category ListFilter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">ListFilter:</span>
        {["", "LEGALITAS_PERIJINAN", "SBU", "SKK", "TENDER", "PROYEK"].map((cat) => {
          const catCount = cat === "" ? DATA_SOURCES.length : DATA_SOURCES.filter(s => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              aria-pressed={categoryFilter === cat}
              className={`text-[10px] font-mono px-2.5 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              <span title={cat === "" ? "Semua kategori sumber data" : (DC_CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " "))}>{cat === "" ? "Semua" : (DC_CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " "))}</span>
              <span className={`text-[8px] font-bold ${categoryFilter === cat ? "opacity-80" : "opacity-60"}`}>({catCount})</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowPinnedOnly(v => !v)}
          aria-pressed={showPinnedOnly}
          title={showPinnedOnly ? "Menampilkan sumber yang dipin — klik untuk tampilkan semua" : "Filter hanya sumber yang dipin (bintang emas)"}
          className={cn("ml-auto text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1", showPinnedOnly ? "bg-amber-100 text-amber-700 border-amber-400" : "border-border text-muted-foreground hover:bg-muted")}
        >
          <Star className={cn("h-3 w-3", showPinnedOnly && "fill-amber-400 text-amber-500")} />
          {showPinnedOnly ? `${pinnedSources.size} dipin` : "Semua"}
        </button>
        <button
          onClick={() => setSortByCrawled(v => !v)}
          aria-pressed={sortByCrawled}
          className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1", sortByCrawled ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
          title="Urutkan berdasarkan terakhir di-crawl"
        >
          <RefreshCw className="h-3 w-3" /> {sortByCrawled ? "↑ Terbaru Crawl" : "↓ Default"}
        </button>
        {(categoryFilter || sortByCrawled || showPinnedOnly || showNotesOnly) && (
          <button
            onClick={() => { setCategoryFilter(""); setSortByCrawled(false); setShowPinnedOnly(false); setShowNotesOnly(false); }}
            className="text-[10px] font-mono px-2 py-1 rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0"
            title="Reset semua filter"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        )}
        <span className="text-[10px] font-mono text-muted-foreground">
          {(() => { const n = DATA_SOURCES.filter(s => !categoryFilter || s.category === categoryFilter).length; return n < DATA_SOURCES.length ? `${n} dari ${DATA_SOURCES.length}` : `${n}`; })()} sumber
        </span>
      </div>

      {/* Data Freshness & Coverage Health */}
      <div className="border rounded-sm p-4 bg-card mb-2">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> DATA FRESHNESS & COVERAGE HEALTH — Status Kesehatan 64 Sumber Intel
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Sumber Aktif Crawl Harian", val: "24", sub: "gov + media + sosmed", color: "text-emerald-700" },
            { label: "Sumber Mingguan", val: "18", sub: "analitik + profil kompetitor", color: "text-blue-700" },
            { label: "Sumber Bulanan", val: "14", sub: "riset mendalam + laporan", color: "text-orange-700" },
            { label: "Sumber Manual / On-Demand", val: "8", sub: "khusus + validasi tim", color: "text-muted-foreground" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2.5 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
              <p className="text-[9px] text-muted-foreground/70">{m.sub}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Kategori Sumber", "Jumlah", "Freshness Target", "Intel Value", "Paket Layanan Terpicu"].map(h => (
                  <th key={h} className="text-left px-3 py-1.5 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { kat: "Pemerintah & Regulasi", jml: "16", fresh: "24 jam", val: "KRITIS", valColor: "bg-red-100 text-red-700", layanan: "Regulatory advisory + alert otomatis" },
                { kat: "Sertifikasi (LPJK, BNSP)", jml: "12", fresh: "24 jam", val: "KRITIS", valColor: "bg-red-100 text-red-700", layanan: "SBU/SKK pipeline + renewal push" },
                { kat: "Pengadaan & Tender", jml: "14", fresh: "24 jam", val: "TINGGI", valColor: "bg-orange-100 text-orange-700", layanan: "Tender intelligence + kualifikasi" },
                { kat: "Media & Berita Industri", jml: "10", fresh: "6 jam", val: "SEDANG", valColor: "bg-yellow-100 text-yellow-700", layanan: "Sinyal pasar + konten marketing" },
                { kat: "Kompetitor & Harga", jml: "8", fresh: "Mingguan", val: "TINGGI", valColor: "bg-orange-100 text-orange-700", layanan: "Pricing intel + positioning" },
                { kat: "Riset Akademik & Laporan", jml: "4", fresh: "Bulanan", val: "RENDAH", valColor: "bg-slate-100 text-slate-600", layanan: "Knowledge base + advisory mendalam" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5 font-medium">{r.kat}</td>
                  <td className="px-3 py-1.5 font-mono font-bold text-primary">{r.jml}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{r.fresh}</td>
                  <td className="px-3 py-1.5"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.valColor}`}>{r.val}</span></td>
                  <td className="px-3 py-1.5 text-[10px] text-primary">{r.layanan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Freshness Budget Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> FRESHNESS BUDGET TRACKER — Berapa % Data yang Masih Segar vs Sudah Kadaluarsa Saat Ini
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { label: "Data Segar (<7 hari)", pct: 41, c: "bg-emerald-500", tc: "text-emerald-700" },
            { label: "Agak Usang (7–30 hari)", pct: 33, c: "bg-yellow-400", tc: "text-yellow-700" },
            { label: "Perlu Update (30–90 hari)", pct: 19, c: "bg-orange-500", tc: "text-orange-700" },
            { label: "Kadaluarsa (>90 hari)", pct: 7, c: "bg-red-500", tc: "text-red-700" },
          ].map((b) => (
            <div key={b.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-2xl font-black font-mono ${b.tc} leading-none`}>{b.pct}%</p>
              <p className="text-[9px] font-mono text-muted-foreground leading-snug mt-0.5">{b.label}</p>
            </div>
          ))}
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500" style={{ width: "41%" }} />
          <div className="h-full bg-yellow-400" style={{ width: "33%" }} />
          <div className="h-full bg-orange-500" style={{ width: "19%" }} />
          <div className="h-full bg-red-500" style={{ width: "7%" }} />
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Target: Segar ≥55% · Kadaluarsa {'<'}5% · Update agenda prioritas: Tender (daily) → SKK (weekly) → Pain Point (bi-weekly)</p>
      </div>

      {/* Collection Capacity Planner */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> COLLECTION CAPACITY PLANNER — Berapa Data yang Bisa Dikumpulkan Bulan Ini vs Target Platform
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { resource: "Tim Lapangan", cap: "34 kunjungan/bln", util: 91, util_c: "text-orange-700", bg: "bg-orange-500" },
            { resource: "API Crawl Budget", cap: "12.000 request/bln", util: 68, util_c: "text-blue-700", bg: "bg-blue-500" },
            { resource: "Manual Upload", cap: "200 dokumen/bln", util: 44, util_c: "text-emerald-700", bg: "bg-emerald-500" },
            { resource: "Scheduler Slots", cap: "8 sumber/hari", util: 75, util_c: "text-violet-700", bg: "bg-violet-500" },
          ].map((r) => (
            <div key={r.resource} className="border rounded-sm p-2">
              <p className="text-[9px] font-semibold mb-0.5">{r.resource}</p>
              <p className="text-[8px] font-mono text-muted-foreground mb-1">{r.cap}</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                <div className={`h-full ${r.bg} rounded-full`} style={{ width: `${r.util}%` }} />
              </div>
              <p className={`text-[9px] font-mono font-bold ${r.util_c}`}>{r.util}% terpakai</p>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-2 bg-amber-50 border-amber-200">
          <p className="text-[9px] font-mono font-bold text-amber-700">⚠️ BOTTLENECK: Tim Lapangan hampir penuh (91%) — pertimbangkan rekrut 2 freelance field researcher untuk kuartal berikutnya</p>
        </div>
      </div>

      {/* Data ROI per Sumber */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> DATA ROI PER SUMBER — Sumber Data yang Paling Berkontribusi ke Revenue vs yang Kurang Efisien
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { src: "LPJK — Data SKK/SBU Real-Time", cost: "Rp 1.2jt/bln", rev: "Rp 186jt/bln", roi: "154×", c: "text-emerald-700", bar: "bg-emerald-500" },
            { src: "LPSE Scraper — Tender APBN/APBD", cost: "Rp 0.4jt/bln", rev: "Rp 78jt/bln", roi: "195×", c: "text-emerald-700", bar: "bg-emerald-600" },
            { src: "Tim Lapangan — Pain Point Survey", cost: "Rp 34jt/bln", rev: "Rp 102jt/bln", roi: "3×", c: "text-blue-700", bar: "bg-blue-500" },
            { src: "IjinTender — Harga Kompetitor", cost: "Rp 0.8jt/bln", rev: "Rp 18jt/bln", roi: "22×", c: "text-blue-700", bar: "bg-blue-400" },
            { src: "Web Crawl — Regulasi & Berita", cost: "Rp 0.2jt/bln", rev: "Rp 9jt/bln", roi: "45×", c: "text-blue-700", bar: "bg-blue-300" },
          ].map((r) => (
            <div key={r.src} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-medium">{r.src}</p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[8px] font-mono text-muted-foreground">Biaya: {r.cost}</span>
                  <span className="text-[8px] font-mono text-primary">Rev: {r.rev}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className={`h-1.5 w-16 rounded-full bg-muted overflow-hidden`}>
                  <div className={`h-full ${r.bar} rounded-full`} style={{ width: `${Math.min(100, parseInt(r.roi) / 2)}%` }} />
                </div>
                <p className={`text-[9px] font-mono font-black w-12 text-right ${r.c}`}>{r.roi} ROI</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collection Error Log Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> COLLECTION ERROR LOG INTELLIGENCE — Pola Error Paling Sering Terjadi + Cara Mitigasinya
        </p>
        <div className="flex flex-col gap-2">
          {[
            { error: "Rate limit exceeded (HTTP 429)", freq: "34×/bln", source: "LPJK API", impact: "48 SKK refresh terlambat rata-rata 2.3 jam", fix: "Implementasi exponential backoff + cache TTL 6 jam", c: "text-red-700", bc: "bg-red-50 border-red-200" },
            { error: "Connection timeout (>30s)", freq: "21×/bln", source: "LPSE Crawler", impact: "31 tender tidak ter-scan dalam jadwal harian", fix: "Retry queue + fallback ke mirror LPSE", c: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { error: "Format HTML berubah (parsing gagal)", freq: "8×/bln", source: "Web Crawl Regulasi", impact: "Artikel baru tidak terindeks selama 1–3 hari", fix: "AI-assisted parser + alert ke tim jika hitRate <70%", c: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { error: "Auth token expired (401)", freq: "4×/bln", source: "IjinTender API", impact: "Harga kompetitor tidak terupdate selama max 8 jam", fix: "Auto-refresh token sebelum expire + monitoring alert", c: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.error} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-mono font-bold ${r.c}`}>{r.error}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.source}</span>
                  <span className={`text-[8px] font-mono font-bold ${r.c}`}>{r.freq}</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">Dampak: {r.impact}</p>
              <p className={`text-[9px] font-mono ${r.c}`}>→ {r.fix}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Governance Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> DATA GOVERNANCE SCORECARD — Kualitas, Keamanan, dan Kepatuhan Data per Dimensi Tata Kelola
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { dim: "Akurasi", score: 91, desc: "3 sumber gagal validasi silang bulan ini", c: "bg-emerald-500", tc: "text-emerald-700" },
            { dim: "Kebaruan", score: 84, desc: "4 sumber terakhir update >48 jam lalu", c: "bg-blue-500", tc: "text-blue-700" },
            { dim: "Kelengkapan", score: 76, desc: "23% entri masih missing 1+ kolom penting", c: "bg-orange-400", tc: "text-orange-700" },
            { dim: "Konsistensi", score: 88, desc: "Format tanggal ada 2 varian di SKK sources", c: "bg-blue-400", tc: "text-blue-700" },
            { dim: "Ketersediaan", score: 97, desc: "SLA uptime terpenuhi; 1 downtime <30 menit", c: "bg-emerald-600", tc: "text-emerald-700" },
            { dim: "Lineage", score: 62, desc: "38% data tidak memiliki trace origin lengkap", c: "bg-red-400", tc: "text-red-700" },
            { dim: "Keamanan", score: 94, desc: "Semua API key dirotasi; akses log bersih", c: "bg-emerald-500", tc: "text-emerald-700" },
            { dim: "Retensi/PII", score: 100, desc: "Tidak ada data personal tersimpan — compliant", c: "bg-emerald-600", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.dim} className="border rounded-sm p-2.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{r.dim}</p>
                <p className={`text-[14px] font-black font-mono leading-none ${r.tc}`}>{r.score}</p>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.score}%` }} />
              </div>
              <p className="text-[8px] text-muted-foreground leading-snug">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Overall Governance Score: <span className="font-bold text-primary">86.5/100</span> · Lineage adalah area improvement terbesar — prioritaskan tagging origin per entry</p>
      </div>

      {/* Source Intelligence Dependency Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> SOURCE DEPENDENCY MAP — Seberapa Bergantung Tiap Halaman Platform terhadap Sumber Data Spesifik
        </p>
        <div className="flex flex-col gap-2">
          {[
            { source: "LPSE Nasional (tender feed)", dependents: ["Intel Tender", "Radar Kompetitor", "Dashboard", "Surat Penawaran"], criticalLevel: "KRITIS", revenue: "Rp 89jt/bln", c: "text-red-700", bc: "bg-red-50 border-red-200" },
            { source: "LPJK API (profil BUJK + SKK)", dependents: ["Database SKK", "Direktori Kontraktor", "Dashboard KPI", "AI Rekomendasi"], criticalLevel: "KRITIS", revenue: "Rp 128jt/bln", c: "text-red-700", bc: "bg-red-50 border-red-200" },
            { source: "IjinTender (harga kompetitor)", dependents: ["Radar Kompetitor", "Surat Penawaran"], criticalLevel: "TINGGI", revenue: "Rp 34jt/bln", c: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { source: "JDIH / Web Regulasi PUPR", dependents: ["Regulasi", "Briefing Harian", "Knowledge Registry"], criticalLevel: "TINGGI", revenue: "Rp 47jt/bln", c: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { source: "Riset Lapangan Tim (manual)", dependents: ["Pain Points", "Workroom", "Perumusan Masalah"], criticalLevel: "MEDIUM", revenue: "Rp 28jt/bln", c: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold">{r.source}</p>
                <div className="flex gap-2 shrink-0">
                  <span className={`text-[8px] font-mono font-bold ${r.c}`}>{r.criticalLevel}</span>
                  <span className={`text-[9px] font-mono font-black ${r.c}`}>{r.revenue}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.dependents.map((d) => (
                  <span key={d} className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm border ${r.bc} ${r.c}`}>{d}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">LPJK API down = 4 halaman utama terganggu → perlu fallback cache + degraded mode untuk setiap dependency kritis</p>
      </div>

      {/* Data Quality Incident Timeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-orange-600" /> DATA QUALITY INCIDENT TIMELINE — Insiden Kualitas Data 30 Hari Terakhir + Lesson Learned
        </p>
        <div className="flex flex-col gap-2">
          {[
            { date: "28 Jul 2026", incident: "LPJK API returned stale SKK data (24-hour lag)", impact: "47 kontraktor menunjukkan status SKK salah selama 4 jam", resolution: "Tambah staleness check: jika response timestamp >6jam, gunakan cache + alert Slack", severity: "SEDANG", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { date: "21 Jul 2026", incident: "LPSE crawler blocked by Cloudflare rate limit", impact: "18 tender baru tidak ter-scan selama 8 jam", resolution: "Implementasi rotating user-agent + exponential backoff berhasil bypass", severity: "TINGGI", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { date: "14 Jul 2026", incident: "IjinTender harga kompetitor update parsial (hanya 40%)", impact: "Radar Kompetitor menampilkan harga lama untuk 12 vendor", resolution: "Validator ambang batas: jika coverage <80%, tolak batch dan gunakan cache sebelumnya", severity: "RENDAH", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.date} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[8px] font-mono font-bold ${r.sc}`}>{r.date} · {r.severity}</p>
              </div>
              <p className="text-[9px] font-bold mb-0.5">{r.incident}</p>
              <p className="text-[9px] text-muted-foreground mb-0.5">Dampak: {r.impact}</p>
              <p className={`text-[9px] font-mono ${r.sc}`}>✓ Solusi: {r.resolution}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Source Performance Benchmark */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> SOURCE PERFORMANCE BENCHMARK — Ranking Performa Sumber Data Berdasarkan Kualitas, Kecepatan, dan ROI
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Sumber</th>
                {["Kualitas", "Freshness", "Rel.", "ROI", "Grade"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { src: "Tim Lapangan (manual)", q: 94, f: 88, r: 97, roi: "A+", grade: "S", gc: "text-emerald-700 bg-emerald-50" },
                { src: "LPSE Crawler", q: 88, f: 91, r: 89, roi: "A", grade: "A", gc: "text-emerald-700 bg-emerald-50" },
                { src: "LPJK API", q: 91, f: 84, r: 94, roi: "A", grade: "A", gc: "text-emerald-700 bg-emerald-50" },
                { src: "IjinTender API", q: 86, f: 87, r: 91, roi: "A", grade: "A", gc: "text-emerald-700 bg-emerald-50" },
                { src: "Web Crawl Regulasi", q: 78, f: 72, r: 81, roi: "B+", grade: "B", gc: "text-blue-700 bg-blue-50" },
                { src: "AI Synthesis Output", q: 89, f: 96, r: 86, roi: "A", grade: "A", gc: "text-emerald-700 bg-emerald-50" },
                { src: "Forum Online / Sosmed", q: 61, f: 94, r: 58, roi: "C+", grade: "C", gc: "text-orange-700 bg-orange-50" },
              ].map((r) => (
                <tr key={r.src} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 text-[9px] font-medium">{r.src}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.q >= 85 ? "text-emerald-700" : "text-orange-600"}`}>{r.q}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.f >= 85 ? "text-emerald-700" : "text-orange-600"}`}>{r.f}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.r >= 85 ? "text-emerald-700" : "text-orange-600"}`}>{r.r}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-center text-muted-foreground">{r.roi}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center rounded-sm ${r.gc}`}>{r.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Forum/Sosmed grade C — pertimbangkan deprioritaskan untuk menghemat compute · Fokus pada S & A grade sources</p>
      </div>

      {/* Data Freshness SLA Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> DATA FRESHNESS SLA MONITOR — Apakah Setiap Sumber Data Memenuhi SLA Freshness yang Telah Ditetapkan?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { source: "LPSE Tender Crawl", sla: "4 jam", actual: "3.2 jam", breach: false, lastRun: "2 jam lalu", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "LPJK Profil BUJK", sla: "24 jam", actual: "19 jam", breach: false, lastRun: "6 jam lalu", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "IjinTender Harga Kompetitor", sla: "12 jam", actual: "9.8 jam", breach: false, lastRun: "4 jam lalu", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "JDIH/PUPR Regulasi", sla: "48 jam", actual: "61 jam", breach: true, lastRun: "61 jam lalu", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { source: "Pain Point Tim Lapangan", sla: "Realtime", actual: "~15 menit", breach: false, lastRun: "15 menit lalu", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "AI Synthesis Output", sla: "24 jam", actual: "22 jam", breach: false, lastRun: "1 jam lalu", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-3 ${r.bc} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold">{r.source}</p>
                  {r.breach && <span className="text-[8px] font-mono font-bold text-red-700 bg-red-100 px-1 rounded">⚠ SLA Terlampaui</span>}
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span title={`SLA (Service Level Agreement): data harus terperbarui dalam ${r.sla} sejak fetch terakhir`}>SLA: {r.sla}</span>
                  <span>Actual: <span className={`font-bold ${r.sc}`}>{r.actual}</span></span>
                  <span title={`Terakhir dijalankan: ${r.lastRun}`}>Last run: {r.lastRun}</span>
                </div>
              </div>
              <div className={`text-[20px] shrink-0 ${r.breach ? "text-red-500" : "text-emerald-500"}`}>
                {r.breach ? "✗" : "✓"}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">1 SLA breach saat ini: JDIH Regulasi — trigger manual crawl sekarang atau otomatis akan retry dalam 2 jam</p>
      </div>

      {/* Data Pipeline Architecture Diagram */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> DATA PIPELINE HEALTH — Status Setiap Layer dalam Pipeline Data MJP dari Sumber hingga Insight
        </p>
        <div className="flex flex-col gap-2">
          {[
            { layer: "Layer 1: Data Ingestion", desc: "64 sumber aktif → LPSE, LPJK, IjinTender, Tim Lapangan", status: "HEALTHY", items: "2.847 records/hari avg", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { layer: "Layer 2: Data Validation", desc: "Schema check + duplicate removal + quality scoring", status: "HEALTHY", items: "94.7% pass rate (target >90%)", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { layer: "Layer 3: Data Enrichment", desc: "AI tagging + geolocation + entity resolution", status: "DEGRADED", items: "Entity resolution 87% accuracy (target >92%)", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { layer: "Layer 4: Knowledge Synthesis", desc: "AI summarization + cross-reference + insight generation", status: "HEALTHY", items: "341 insights/hari · avg 8.7min synthesis time", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { layer: "Layer 5: Delivery (Briefing/Platform)", desc: "WhatsApp delivery, web platform, API to mobile", status: "HEALTHY", items: "99.2% delivery success rate · avg 2.3min delay", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.layer} className={`border rounded-sm p-3 ${r.bc} flex items-start gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold">{r.layer}</p>
                  <span className={`text-[8px] font-mono font-bold ${r.sc}`}>{r.status}</span>
                </div>
                <p className="text-[8px] text-muted-foreground mb-0.5">{r.desc}</p>
                <p className={`text-[8px] font-mono ${r.sc}`}>{r.items}</p>
              </div>
              <span className={`text-[18px] shrink-0 ${r.status === "HEALTHY" ? "text-emerald-500" : "text-orange-500"}`}>
                {r.status === "HEALTHY" ? "✓" : "⚠"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Layer 3 DEGRADED: entity resolution perlu model update · 8 tim entitas ambigu belum di-resolved dengan benar</p>
      </div>

      {/* Data Collection Cost vs Value Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> DATA COLLECTION COST vs VALUE — Biaya Operasional Pengumpulan Data per Sumber vs Nilai Bisnis yang Dihasilkan
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Sumber Data</th>
                {["Biaya/bln", "Records/bln", "Cost/rec", "Rev Impact", "ROI"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { src: "Tim Lapangan", cost: "Rp 18jt", records: "860", cpr: "Rp 21k", rev: "Rp 94jt", roi: "422%", good: true },
                { src: "LPSE Crawler (server)", cost: "Rp 2.4jt", records: "2.847", cpr: "Rp 843", rev: "Rp 47jt", roi: "1858%", good: true },
                { src: "LPJK API", cost: "Rp 1.8jt", records: "487", cpr: "Rp 3.7k", rev: "Rp 41jt", roi: "2178%", good: true },
                { src: "IjinTender API", cost: "Rp 3.2jt", records: "124", cpr: "Rp 25.8k", rev: "Rp 28jt", roi: "775%", good: true },
                { src: "Web Crawl Regulasi", cost: "Rp 0.8jt", records: "47", cpr: "Rp 17k", rev: "Rp 12jt", roi: "1400%", good: true },
                { src: "Forum / Sosmed", cost: "Rp 1.1jt", records: "218", cpr: "Rp 5k", rev: "Rp 3.4jt", roi: "209%", good: false },
              ].map((r) => (
                <tr key={r.src} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${!r.good ? "opacity-70" : ""}`}>
                  <td className="px-2 py-1 text-[9px] font-medium">{r.src}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-center">{r.cost}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-center">{r.records}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-center text-muted-foreground">{r.cpr}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-center text-emerald-700 font-bold">{r.rev}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.good ? "text-emerald-700" : "text-orange-700"}`}>{r.roi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">LPJK API = ROI tertinggi (2178%) · Forum/Sosmed terendah (209%) → pertimbangkan realokasi budget ke LPJK + tim lapangan</p>
      </div>

      {/* Crawler Failure Pattern Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleAlert className="h-3.5 w-3.5 text-orange-500" /> CRAWLER FAILURE PATTERN ANALYSIS — Pola Kegagalan Crawling yang Berulang dan Solusi Permanen yang Diimplementasikan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { pattern: "LPSE Cloudflare Block (rate limiting)", frequency: "3–4×/minggu", impact: "Rata-rata 6 tender terlewat per kejadian", solution: "Rotating IP + User-Agent + exponential backoff — implementasi berhasil kurangi 89%", status: "MITIGATED", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { pattern: "LPJK API 504 Timeout (Sabtu malam)", frequency: "Setiap Sabtu 22.00–02.00", impact: "SKK status refresh tertunda 4 jam", solution: "Reschedule LPJK batch ke Minggu 08.00 + cache last known good state", status: "RESOLVED", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { pattern: "IjinTender CAPTCHA Challenge", frequency: "1–2×/minggu", impact: "Harga kompetitor stale selama 2–6 jam", solution: "Fallback ke cached data + Slack alert ke tim untuk manual verify jika stale >4jam", status: "PARTIAL FIX", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { pattern: "JDIH Pagination Inconsistency (HTML structure change)", frequency: "Setiap kali ada update JDIH", impact: "Regulasi baru tidak ter-crawl hingga ditemukan manual", solution: "Schema validation + alert jika hasil crawl <50% dari baseline — PERLU IMPLEMENTASI", status: "OPEN BUG", sc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.pattern} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1">{r.pattern}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.status}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>Freq: {r.frequency}</span>
                <span>Impact: {r.impact}</span>
              </div>
              <p className={`text-[9px] font-mono ${r.sc}`}>→ Fix: {r.solution}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Governance & Access Control */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" /> DATA GOVERNANCE & ACCESS CONTROL — Siapa yang Boleh Mengakses Data Apa di Platform MJP + Status Kepatuhan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { role: "Director (Lisa)", access: "Full: semua data termasuk keuangan + klien sensitif", restriction: "Tidak ada — full admin", compliance: 100, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { role: "Senior Analyst (Sari)", access: "Read-all: knowledge, riset, pain point, kompetitor, tender", restriction: "Tidak bisa edit keuangan + data personal klien lainnya", compliance: 100, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { role: "Field Researcher (Budi, Andi)", access: "Read: public intel + tenderharga. Write: pain point + riset baru", restriction: "Tidak bisa akses profil klien lain (privasi antar klien)", compliance: 100, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { role: "Account Manager (Reza)", access: "Read: klien yang dia handle. Write: notes + status klien sendiri", restriction: "Tidak bisa baca klien AM lain + tidak bisa akses database crawl mentah", compliance: 94, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { role: "Klien (via portal)", access: "Read-only: intel briefing yang mereka subscribe + SKK status mereka sendiri", restriction: "Tidak bisa lihat data klien MJP lain — strict isolation", compliance: 100, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.role} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.role}</p>
                <span className={`text-[8px] font-mono font-bold ml-auto ${r.tc}`}>Compliance: {r.compliance}%</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">✓ {r.access}</p>
              <p className="text-[8px] font-mono text-muted-foreground">🚫 {r.restriction}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">AM compliance 94% — 1 gap: Reza pernah akses data crawler mentah sekali (perlu pelatihan ulang). Review audit log setiap Senin.</p>
      </div>

      {/* Data Collection SLA & Uptime Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> DATA COLLECTION SLA DASHBOARD — Target Uptime dan Freshness per Sumber + Status Aktual Bulan Ini
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Sumber</th>
                {["SLA Uptime", "Aktual", "SLA Freshness", "Aktual", "SLA Breach?"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { src: "LPJK API", slaUp: "99.5%", actualUp: "99.8%", slaFresh: "<6 jam", actualFresh: "4.2 jam avg", breach: false },
                { src: "LPSE Crawler", slaUp: "98%", actualUp: "97.1%", slaFresh: "<2 jam", actualFresh: "1.8 jam avg", breach: false },
                { src: "IjinTender API", slaUp: "97%", actualUp: "94.3%", slaFresh: "<6 jam", actualFresh: "8.1 jam avg", breach: true },
                { src: "JDIH PUPR", slaUp: "95%", actualUp: "96.2%", slaFresh: "<12 jam", actualFresh: "11.4 jam avg", breach: false },
                { src: "Tim Lapangan", slaUp: "N/A", actualUp: "N/A", slaFresh: "<48 jam", actualFresh: "31.4 jam avg", breach: false },
                { src: "Forum/Sosmed", slaUp: "95%", actualUp: "91.7%", slaFresh: "<1 jam", actualFresh: "0.8 jam avg", breach: true },
              ].map((r) => (
                <tr key={r.src} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${r.breach ? "bg-red-50/30" : ""}`}>
                  <td className="px-2 py-1 text-[9px] font-medium">{r.src}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-center text-muted-foreground">{r.slaUp}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.actualUp >= r.slaUp || r.actualUp === "N/A" ? "text-emerald-700" : "text-red-700"}`}>{r.actualUp}</td>
                  <td className="px-2 py-1 text-[9px] font-mono text-center text-muted-foreground">{r.slaFresh}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${!r.breach ? "text-emerald-700" : "text-red-700"}`}>{r.actualFresh}</td>
                  <td className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${r.breach ? "text-red-700" : "text-emerald-700"}`}>{r.breach ? "BREACH ⚠" : "OK ✓"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">2 SLA breach: IjinTender (freshness) + Forum/Sosmed (uptime) → IjinTender fix urgent karena berdampak ke Radar Kompetitor klien premium</p>
      </div>

      {/* Data Enrichment Pipeline Status */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> DATA ENRICHMENT PIPELINE — Setiap Data Mentah yang Masuk Diperkaya Melalui Beberapa Layer Sebelum Menjadi Intel
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { layer: "Layer 1: Ingestion & Deduplication", throughput: "4.8k records/hr", errorRate: 0.3, latency: "< 1 mnt", status: "HEALTHY", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { layer: "Layer 2: Schema Validation & Normalization", throughput: "4.6k records/hr", errorRate: 0.9, latency: "< 2 mnt", status: "HEALTHY", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { layer: "Layer 3: Entity Resolution (BUJK, Tender, Person)", throughput: "3.9k records/hr", errorRate: 4.1, latency: "< 8 mnt", status: "DEGRADED", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { layer: "Layer 4: AI Synthesis & Tagging", throughput: "3.7k records/hr", errorRate: 1.2, latency: "< 15 mnt", status: "HEALTHY", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { layer: "Layer 5: Knowledge Registry Update", throughput: "3.4k records/hr", errorRate: 0.4, latency: "< 5 mnt", status: "HEALTHY", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.layer} className={`border rounded-sm p-2.5 ${r.sb} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-[9px] font-bold ${r.sc}`}>{r.layer}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.status}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>Throughput: {r.throughput}</span>
                  <span className={r.errorRate > 2 ? "text-orange-700 font-bold" : ""}>Error: {r.errorRate}%</span>
                  <span>Latency: {r.latency}</span>
                </div>
              </div>
              <div className="h-8 w-6 bg-muted rounded-sm overflow-hidden flex items-end shrink-0">
                <div className={`w-full ${r.status === "DEGRADED" ? "bg-orange-400" : "bg-emerald-400"} rounded-sm`} style={{ height: `${100 - (r.errorRate * 10)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Layer 3 degraded (4.1% error) = entity resolution perlu model update · 380 entities per hari tidak ter-resolve dengan benar</p>
      </div>

      {/* Data Freshness Heatmap per Source per Day */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> FRESHNESS HEATMAP — Kualitas Data per Sumber per Hari (7 Hari Terakhir): Mana yang Sering Stale?
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { source: "LPSE Pusat", scores: [98, 96, 99, 97, 98, 96, 99] },
            { source: "LPJK Registry", scores: [94, 92, 95, 91, 93, 94, 92] },
            { source: "IjinTender.co.id", scores: [87, 84, 78, 91, 72, 68, 85] },
            { source: "OSM Konstruksi", scores: [71, 74, 68, 75, 72, 69, 71] },
            { source: "Forum/Sosmed", scores: [62, 58, 71, 64, 53, 59, 67] },
            { source: "Internal Survey", scores: [99, 99, 98, 99, 99, 99, 99] },
            { source: "BPJT Database", scores: [88, 91, 87, 90, 89, 88, 92] },
          ].map((r) => (
            <div key={r.source} className="flex items-center gap-2">
              <p className="text-[9px] w-32 shrink-0">{r.source}</p>
              {r.scores.map((score, i) => (
                <div key={i} className={`flex-1 h-7 rounded-sm flex items-center justify-center text-[8px] font-mono font-bold ${score >= 92 ? "bg-emerald-200 text-emerald-800" : score >= 80 ? "bg-blue-100 text-blue-700" : score >= 65 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                  {score}
                </div>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[8px] w-32 shrink-0 font-mono text-muted-foreground">Hari ke:</p>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <p key={d} className="flex-1 text-center text-[7px] font-mono text-muted-foreground">{d}</p>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">IjinTender drop ke 68 (Sat) — crawler weekend tidak stabil · Forum/Sosmed consistently rendah — pertimbangkan downgrade frekuensi crawl</p>
      </div>

      {/* Data Lineage & Provenance Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> DATA LINEAGE TRACKER — Dari Mana Setiap Intel di Platform MJP Berasal? Audit Trail dari Sumber ke Keputusan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { intel: "HPS Benchmark Report (bulan ini)", chain: "IjinTender → Layer 1 Ingestion → Layer 3 Entity Resolution → AI Synthesis → Intel Briefing → Klien", lastVerified: "2 Agt 2026 07:14", freshness: 98, versions: 47, issues: 0, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { intel: "SKK Renewal Alert untuk CV Sukses Mandiri", chain: "LPJK Registry → Layer 1 → Layer 3 → Scheduler Notif Engine → WhatsApp/Email → Klien", lastVerified: "1 Agt 2026 12:31", freshness: 91, versions: 3, issues: 0, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { intel: "Profil Kompetitor 'Konsultan A Surabaya'", chain: "IjinTender (stale 3hr) + Forum Sosmed → Layer 3 (4.1% error risk) → Knowledge Registry", lastVerified: "31 Jul 2026 19:02", freshness: 74, versions: 12, issues: 1, tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { intel: "Radar Tender Alert Sept Batch (312 tenders)", chain: "LPSE Pusat (22 cabang) + LPSE Regional (14) → Layer 1 → Dedup → Relevance Scoring → Push", lastVerified: "2 Agt 2026 06:58", freshness: 97, versions: 1, issues: 0, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.intel} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc} flex-1`}>{r.intel}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {r.issues > 0 && <span className="text-[7px] font-mono font-bold text-orange-700">{r.issues} issue</span>}
                  <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.freshness}%</span>
                </div>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground mb-0.5 leading-snug">Chain: {r.chain}</p>
              <div className="flex gap-3 text-[8px] font-mono text-muted-foreground">
                <span>Last verified: {r.lastVerified}</span>
                <span>v{r.versions}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data lineage = compliance + trust. Enterprise klien akan meminta audit trail ini sebagai syarat kontrak mulai 2027</p>
      </div>

      {/* Crawler Infrastructure Health */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" /> CRAWLER INFRASTRUCTURE HEALTH — Status Teknis Infrastruktur Pengumpulan Data MJP (Uptime, Rate Limit, Queue)
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { component: "LPSE Crawler Pool (24 workers)", status: "HEALTHY", uptime: 99.2, queue: "0 backlog", rateLimit: "OK (2req/s per IP, 12 IPs)", lastError: "3 hari lalu — CAPTCHA bypass failed → solved", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { component: "IjinTender API Client", status: "DEGRADED", uptime: 87.4, queue: "47 pending (backlogged)", rateLimit: "WARN — 85% dari limit harian", lastError: "Weekend rate limit exceeded → queue backlog", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { component: "LPJK Registry Sync", status: "HEALTHY", uptime: 96.8, queue: "0 backlog", rateLimit: "OK (batch mode per malam)", lastError: "1 minggu lalu — timeout → retry sukses", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { component: "Forum/Sosmed Scraper", status: "DEGRADED", uptime: 74.1, queue: "128 pending", rateLimit: "OK", lastError: "Kemarin — Instagram block → fallback ke cached", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { component: "OSM Konstruksi Feed", status: "HEALTHY", uptime: 99.7, queue: "0 backlog", rateLimit: "OK (public RSS feed)", lastError: "2 minggu lalu — encoding issue → fixed", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { component: "AI Synthesis Workers (8 GPU)", status: "HEALTHY", uptime: 98.1, queue: "12 jobs (~4 mnt)", rateLimit: "OK (LLM token budget 80% used)", lastError: "4 hari lalu — model timeout → queued OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
          ].map((c) => (
            <div key={c.component} className={`border rounded-sm p-2.5 ${c.sb} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[9px] font-bold ${c.sc}`}>{c.component}</p>
                  <span className={`text-[7px] font-mono font-bold shrink-0 ${c.sc}`}>{c.status}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>Uptime: {c.uptime}%</span>
                  <span>Queue: {c.queue}</span>
                  <span className={c.rateLimit.startsWith("WARN") ? "text-orange-700 font-bold" : ""}>{c.rateLimit}</span>
                </div>
                <p className="text-[8px] text-muted-foreground mt-0.5">Last error: {c.lastError}</p>
              </div>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.status === "HEALTHY" ? "#10b981" : "#f97316" }} />
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">2 komponen degraded (IjinTender + Forum) → priority fix minggu ini sebelum Oct surge season</p>
      </div>

      {/* Data Collection Cost Optimization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> DATA COLLECTION COST OPTIMIZATION — Berapa Biaya Nyata Setiap Sumber Data dan Apakah ROI-nya Justifies the Cost?
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { source: "LPSE Crawler (24 workers, 36 LPSE)", monthlyCost: "Rp 2.8jt", dataPoints: "47k tender/bln", revenueAttrib: "Rp 312jt/thn", roi: "925%", status: "SCALE UP", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { source: "IjinTender API (commercial license)", monthlyCost: "Rp 4.2jt", dataPoints: "12k profil + harga", revenueAttrib: "Rp 84jt/thn", roi: "167%", status: "RENEGOTIATE", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
            { source: "LPJK Registry Sync (official API)", monthlyCost: "Rp 1.4jt", dataPoints: "487k SKK records", revenueAttrib: "Rp 218jt/thn", roi: "1.295%", status: "KEEP", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { source: "Forum/Sosmed Scraper (DIY)", monthlyCost: "Rp 800rb", dataPoints: "3.4k posts/bln", revenueAttrib: "Rp 14jt/thn", roi: "146%", status: "DOWNGRADE", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { source: "AI Synthesis (LLM inference)", monthlyCost: "Rp 7.8jt", dataPoints: "all intel layer", revenueAttrib: "Rp 847jt/thn (platform wide)", roi: "905%", status: "SCALE UP", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-2.5 ${r.sb} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[9px] font-bold ${r.sc}`}>{r.source}</p>
                  <span className={`text-[7px] font-mono font-bold shrink-0 ${r.sc}`}>{r.status}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>Cost: {r.monthlyCost}/bln</span>
                  <span>{r.dataPoints}</span>
                  <span className={`font-bold ${r.sc}`}>ROI: {r.roi}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[10px] font-black font-mono ${r.sc} leading-none`}>{r.revenueAttrib}</p>
                <p className={`text-[7px] font-mono ${r.sc}`}>attrib/thn</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Total data cost: Rp 17jt/bln (Rp 204jt/thn) vs total revenue Rp 847jt/thn = cost ratio 24% · Industry avg SaaS: 15–20% — masih bisa dioptimasi</p>
      </div>

      {/* Data Source Expansion Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> DATA SOURCE EXPANSION ROADMAP — Sumber Data Baru yang Akan Ditambahkan MJP 12 Bulan ke Depan untuk Meningkatkan Kedalaman Intel
        </p>
        <div className="flex flex-col gap-2">
          {[
            { source: "SIMBG (Sistem Informasi Manajemen Bangunan Gedung)", timeline: "Q4 2026", data: "Izin mendirikan bangunan (IMB) + SLF seluruh Indonesia real-time", value: "Deteksi early-stage proyek sebelum masuk LPSE — 6–12 bln lead time lebih panjang", complexity: "HIGH — perlu izin resmi dari Kemen PUPR", status: "NEGOTIATION", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { source: "BPS Konstruksi Data (Badan Pusat Statistik)", timeline: "Q4 2026", data: "Volume konstruksi quarterly, upah buruh, material price index", value: "Makro context untuk Intel Briefing — klien tahu kondisi industri, bukan hanya project-level", complexity: "LOW — data publik, API tersedia", status: "IN PROGRESS", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "OSP (Oss.go.id) — Data Perizinan Usaha Konstruksi", timeline: "Q1 2027", data: "NIB dan SBU semua BUJK terdaftar — lengkap dan resmi", value: "Ganti web scraping manual dengan official API — lebih reliable dan lebih legal", complexity: "MEDIUM — pending API access dari BKPM", status: "PLANNED", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { source: "E-Procurement BUMN (vendor terpilih)", timeline: "Q1 2027", data: "Tender dan hasil pengadaan langsung dari internal BUMN", value: "Intel BUMN yang saat ini tidak ter-capture di LPSE publik — 30–40% market yang hilang", complexity: "VERY HIGH — perlu partnership B2B dengan setiap BUMN", status: "RESEARCH", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { source: "LinkedIn Indonesia + Kaskus Konstruksi", timeline: "Q3 2027", data: "Job posting konstruksi (proxy proyek baru), diskusi industri, reputasi BUJK informal", value: "Sinyal sosial yang lebih reliable vs scraping Instagram yang sering di-block", complexity: "MEDIUM", status: "PLANNED", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-0.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold ${r.tc}`}>{r.source}</p>
                    <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
                    <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.timeline}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">Data: {r.data}</p>
                  <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>Value: {r.value}</p>
                  <p className="text-[8px] text-muted-foreground">Complexity: {r.complexity}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Governance Policy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-emerald-600" /> DATA GOVERNANCE POLICY — Aturan yang Mengatur Pengumpulan, Penyimpanan, dan Penggunaan Data di Platform MJP
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { policy: "P1: Data klien tidak pernah dijual atau dibagikan ke pihak ketiga", rationale: "Trust adalah foundation bisnis MJP. Satu breach = kehilangan reputasi yang tidak bisa dibeli kembali.", enforcement: "Tidak ada API partner yang punya akses ke raw client data. Hanya aggregate/anonymized stats yang bisa dibagikan.", status: "ENFORCED", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { policy: "P2: Semua data kompetitor dikumpulkan dari sumber publik saja", rationale: "Legal risk: jika MJP menggunakan insider info atau data yang tidak boleh dipublikasikan, bisa kena tuntutan.", enforcement: "Source tagging wajib di semua knowledge assets. Crawler hanya akses halaman publik (no login bypass).", status: "ENFORCED", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { policy: "P3: Data personal klien (nama, nomor HP, KTP) disimpan encrypted", rationale: "PDPA Indonesia berlaku — data personal butuh proteksi di level teknis, bukan hanya policy.", enforcement: "Database encryption at rest (AES-256). KTP number hashed. Phone number masked di semua log.", status: "PARTIAL — KTP hash belum diimplementasi", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { policy: "P4: Data tender publik (LPSE) bebas dikurasi dan didistribusikan", rationale: "LPSE adalah public domain — MJP menambahkan nilai lewat curation dan personalization, bukan monopoli data.", enforcement: "Legal review: distribusi Intel Briefing berbasis LPSE = legal. Menambahkan AI analysis di atasnya = value add.", status: "ENFORCED", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.policy} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-0.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold ${r.tc} flex-1`}>{r.policy}</p>
                    <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
                  <p className={`text-[8px] font-mono ${r.tc}`}>Enforcement: {r.enforcement}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Crawler Failure Runbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> CRAWLER FAILURE RUNBOOK — Apa yang Tim MJP Lakukan Ketika Crawler Gagal dan Bagaimana Memastikan Klien Tidak Kehilangan Intel Penting?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              scenario: "LPSE sumber memblok IP crawler (HTTP 403)",
              detect: "Monitor deteksi 3× 403 berturut-turut dalam 1 jam → alert otomatis ke #tech-ops Slack",
              immediate: "Rotate ke backup IP pool (8 IP pool tersedia). SLA: <30 menit resolved.",
              fallback: "Jika semua IP diblok: switch ke manual scrape jadwal 2× sehari. Alert klien afektif via briefing.",
              worstCase: "LPSE tidak dapat diakses > 12 jam: notify klien bahwa intel dari LPSE X mungkin tidak lengkap hari ini",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              scenario: "LPSE mengubah struktur HTML (crawler parse 0 records)",
              detect: "Alert: record count drop > 50% dari baseline harian → immediate investigation",
              immediate: "Engineer on-call analisis selisih struktur HTML. Fix selector biasanya < 4 jam.",
              fallback: "Selama fix: serve last-known data dengan watermark 'DATA TERAKHIR DIPERBARUI [timestamp]'",
              worstCase: "Fix > 24 jam: escalate ke founder. Manual data enrichment dari LPSE website untuk tender paling kritis.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              scenario: "IjinTender API degraded (latency > 30 detik)",
              detect: "Health check setiap 5 menit. Latency > 15 detik = WARNING. > 30 detik = CIRCUIT BREAKER open",
              immediate: "Circuit breaker open → serve dari cache (last 6 jam). Badge 'CACHE' di UI.",
              fallback: "Cache expired > 6 jam: hide IjinTender panel, show 'Harga kompetitor sedang tidak tersedia'",
              worstCase: "IjinTender down > 24 jam: communicate ke klien + offer alternative HPS benchmark dari internal DB.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.scenario}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 text-[8px]">
                <div><span className="font-bold">Detect: </span><span className="text-muted-foreground">{r.detect}</span></div>
                <div><span className="font-bold">Immediate: </span><span className="text-muted-foreground">{r.immediate}</span></div>
                <div><span className="font-bold">Fallback: </span><span className="text-muted-foreground">{r.fallback}</span></div>
                <div><span className={`font-bold ${r.tc}`}>Worst case: </span><span className="text-muted-foreground">{r.worstCase}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Pipeline Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> DATA PIPELINE ARCHITECTURE — Perjalanan Data dari Source ke Intel yang Diterima Klien: 7 Stage dan Berapa Lama Tiap Stage?
        </p>
        <div className="flex flex-col gap-1">
          {[
            { stage: "Stage 1: Crawl", latency: "0–15 mnt", desc: "Crawler baca LPSE, LPJK, SIMBG, OSS, media konstruksi. Frekuensi per source berbeda (4 jam–24 jam). Raw HTML/JSON disimpan ke staging area.", volume: "~4.200 records/hari", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { stage: "Stage 2: Parse & Normalize", latency: "15–25 mnt", desc: "Extractor tarik field yang relevan (nama proyek, HPS, kategori, lokasi, tanggal, BUJK). Normalize format date, currency, dan nama entitas.", volume: "~3.800 records pass parse", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { stage: "Stage 3: Entity Resolution", latency: "25–45 mnt", desc: "Match entitas (nama kontraktor, nama proyek) ke existing database. Prevent duplicates. Current error rate: 4.1%. Fix in progress (Sprint 23).", volume: "3.6% records flagged for manual review", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { stage: "Stage 4: Enrichment", latency: "45–90 mnt", desc: "Tambahkan context: HPS benchmark, historical win pattern dari kontraktor, regulasi relevan, geographic tags. LLM-assisted enrichment untuk description.", volume: "~3.400 records enriched fully", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { stage: "Stage 5: Personalization Scoring", latency: "90–120 mnt", desc: "Score setiap record terhadap setiap klien profile. 487 klien × ~3.400 records = 1.66M scoring operations per hari. Batch processing dengan priority queue.", volume: "1.66M scores/hari (avg 1.3 detik/1000 scores)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { stage: "Stage 6: Alert Generation", latency: "120–180 mnt", desc: "Trigger alert untuk record dengan score > 0.72 untuk klien yang profil-nya match. Generate briefing copy via template + LLM for narrative.", volume: "~840 alerts/hari ke ~320 klien unik", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { stage: "Stage 7: Delivery", latency: "180–360 mnt (capped di 06:45 untuk 07:00 briefing)", desc: "Queue ke WhatsApp API, email, dan in-app. Retry logic untuk failed delivery. Batched per klien untuk atomic delivery.", volume: "99.4% delivery success rate", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.stage} className={`border rounded-sm p-2.5 ${r.bc} mb-1`}>
              <div className="flex items-center gap-3 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.stage}</p>
                <span className={`text-[7px] font-mono ${r.tc}`}>{r.latency}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>{r.volume}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">End-to-end: {'<'}6 jam dari crawl ke delivery. Bottleneck: Stage 3 (entity resolution). Fix akan cut total pipeline latency ~30 mnt.</p>
      </div>

      {/* Data Quality Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> DATA QUALITY METRICS — 6 Dimensi Kualitas Data yang MJP Ukur Setiap Hari untuk Menjaga Kepercayaan Klien
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {[
            { metric: "Completeness", score: "94.2%", desc: "Records dengan semua field wajib terisi", target: "95%", status: "YELLOW", tc: "text-orange-700" },
            { metric: "Accuracy", score: "91.8%", desc: "Records yang di-verify via secondary source", target: "95%", status: "YELLOW", tc: "text-orange-700" },
            { metric: "Timeliness", score: "99.3%", desc: "Records delivered dalam SLA window", target: "99%", status: "GREEN", tc: "text-emerald-700" },
            { metric: "Uniqueness", score: "99.1%", desc: "Records tanpa duplicate (post-dedup)", target: "99.5%", status: "YELLOW", tc: "text-orange-700" },
            { metric: "Consistency", score: "96.4%", desc: "Format field konsisten antar sumber", target: "98%", status: "YELLOW", tc: "text-orange-700" },
            { metric: "Entity Resolution", score: "95.9%", desc: "Entitas matched dengan benar (4.1% error)", target: "99%", status: "RED", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.metric} className="border rounded-sm p-2 bg-muted/20">
              <div className="flex items-center gap-1 mb-0.5">
                <p className="text-[9px] font-bold flex-1">{r.metric}</p>
                <span className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.status}</span>
              </div>
              <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.score}</p>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>target: {r.target}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Composite Data Quality Score: 96.1% (target: 98%). Entity resolution adalah satu-satunya RED metric — Sprint 23 priority. Fix expected +2.5pp improvement ke composite score.</p>
      </div>

      {/* Crawler Technology Stack */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> CRAWLER TECH STACK — Teknologi yang Dipakai MJP untuk Crawling, Parsing, dan Enrichment Data dari 14 Sumber
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "Crawler Layer", tech: "Playwright (headless Chromium)", why: "LPSE Indonesia banyak yang butuh JavaScript rendering. Puppeteer-based alternatives tidak handle LPSE's CAPTCHA variants.", perf: "247 pages/menit avg throughput", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { layer: "HTML Parser", tech: "Cheerio + custom selectors per LPSE variant", why: "7 variant LPSE (pusat, kabupaten, kota, BUMN) punya DOM structure berbeda. Generic parser error rate terlalu tinggi.", perf: "<200ms per page parse", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { layer: "IP Rotation & Anti-Block", tech: "8 IP pool via Residential Proxy + User-agent rotation", why: "LPSE Jatim pernah block IP statis kami di 2024. Residential proxy lebih sulit dideteksi.", perf: "Block incident: 0 selama 8 bulan terakhir", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { layer: "Entity Resolution", tech: "Custom fuzzy matching (Levenshtein + phonetic) + PostgreSQL pg_trgm", why: "LPSE sering ada typo atau variasi nama BUJK ('PT Jaya' vs 'PT. JAYA' vs 'PT Jaya Konstruksi'). LLM terlalu lambat untuk 4.200 records/hari.", perf: "95.9% match rate (4.1% error — Sprint 23 fix)", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { layer: "Enrichment / NLP", tech: "GPT-4o-mini via Replit AI Integrations (batched)", why: "Generate intel narrative dari structured data. Cost-efficient: mini model cukup untuk template-guided enrichment.", perf: "Rp 0.018/record avg cost · <3 detik/batch 50 records", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { layer: "Scheduling & Orchestration", tech: "Custom cron scheduler (Node.js) + PostgreSQL job queue", why: "Setiap source punya frequency berbeda (4 jam, 12 jam, 24 jam). Simple cron lebih reliable dari Airflow/Temporal untuk ukuran current operation.", perf: "Job success rate: 99.3% · avg job duration: 4.2 mnt", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.layer} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.layer}</p>
                <span className={`text-[7px] font-mono ${r.tc}`}>{r.perf}</span>
              </div>
              <p className="text-[8px] font-bold mb-0.5">Tech: {r.tech}</p>
              <p className="text-[8px] text-muted-foreground">{r.why}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Stack ini dibangun iteratively dari 2023. Next upgrade: migrate entity resolution ke ML-based model untuk crack the 4.1% error. ETA: Q4 2026.</p>
      </div>

      {/* Data Collection Ethics & Compliance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> DATA ETHICS & COMPLIANCE — Bagaimana MJP Memastikan Semua Data yang Dikumpulkan Legal, Ethical, dan Compliant dengan UU PDP?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              area: "UU PDP (Perlindungan Data Pribadi) Compliance",
              status: "COMPLIANT ✓",
              details: ["MJP hanya crawl data publik — tidak ada PII yang dikumpulkan dari LPSE tanpa consent", "Klien data (nama, email, no HP) disimpan dengan enkripsi AES-256 at rest", "Data retention policy: client data dihapus 90 hari setelah terminasi subscription", "DPA (Data Processing Agreement) tersedia untuk enterprise klien yang minta"],
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              area: "Web Crawling Ethics — Robots.txt & Rate Limiting",
              status: "COMPLIANT ✓",
              details: ["Semua crawler respect robots.txt dari setiap source", "Rate limiting: max 1 request/2 detik per source domain", "User-agent string identifies MJP crawler secara transparan ('MJP-Bot/1.0')", "Tidak pernah bypass authentication atau scrape behind login walls"],
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              area: "Data Attribution & Copyright",
              status: "REVIEW NEEDED",
              details: ["LPSE data: government data, bebas digunakan untuk komersial ✓", "Media news articles: diparaphrase, bukan di-reproduce verbatim ✓", "IjinTender data: PERLU legal review — terms of service mereka sedang dikaji Hendra", "Association publications: perlu explicit permission letter untuk kutip secara komersial"],
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.area} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.area}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              {r.details.map((d, i) => <p key={i} className="text-[8px] text-muted-foreground">• {d}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Legal review scheduled Q3 2026 dengan law firm mitra untuk formal compliance audit. Target: no open legal risks sebelum raise investor round.</p>
      </div>

      {/* Crawler Performance Benchmarks */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> CRAWLER BENCHMARKS — Performa Aktual Crawler MJP vs Target untuk Setiap Source dalam 30 Hari Terakhir
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left p-1 text-muted-foreground">Source</th>
                <th className="p-1 text-center text-muted-foreground">Records/hari</th>
                <th className="p-1 text-center text-muted-foreground">Uptime</th>
                <th className="p-1 text-center text-muted-foreground">Avg Latency</th>
                <th className="p-1 text-center text-muted-foreground">Error Rate</th>
                <th className="p-1 text-center text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { source: "LPSE Pusat", rec: "1.847", up: "99.8%", lat: "2.1h", err: "0.3%", status: "GREEN", tc: "text-emerald-700" },
                { source: "LPSE Jateng (LPSE terbesar)", rec: "412", up: "99.2%", lat: "1.8h", err: "0.4%", status: "GREEN", tc: "text-emerald-700" },
                { source: "LPSE Sulawesi Selatan", rec: "89", up: "94.1%", lat: "3.7h", err: "4.2%", status: "YELLOW", tc: "text-orange-700" },
                { source: "LPSE Kalimantan Timur", rec: "67", up: "91.3%", lat: "4.1h", err: "6.8%", status: "YELLOW", tc: "text-orange-700" },
                { source: "LPJK Registry", rec: "234", up: "99.7%", lat: "6.2h", err: "0.1%", status: "GREEN", tc: "text-emerald-700" },
                { source: "IjinTender.co.id", rec: "156", up: "87.4%", lat: "5.8h", err: "8.1%", status: "RED", tc: "text-red-700" },
                { source: "Media Konstruksi (7 sites)", rec: "312", up: "98.9%", lat: "8.4h", err: "1.2%", status: "GREEN", tc: "text-emerald-700" },
              ].map((r) => (
                <tr key={r.source} className="border-b hover:bg-muted/40 transition-colors">
                  <td className="p-1 font-bold">{r.source}</td>
                  <td className="p-1 text-center font-mono">{r.rec}</td>
                  <td className="p-1 text-center font-mono">{r.up}</td>
                  <td className="p-1 text-center font-mono">{r.lat}</td>
                  <td className={`p-1 text-center font-mono ${r.tc}`}>{r.err}</td>
                  <td className={`p-1 text-center font-bold font-mono ${r.tc}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">IjinTender.co.id = RED (8.1% error, 87.4% uptime). Circuit breaker aktif saat error {'>'} 10%. LPSE KTI + Sulsel = YELLOW — perlu dedicated crawler tuning untuk daerah-daerah ini.</p>
      </div>

      {/* Data Freshness SLA */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> DATA FRESHNESS SLA — Untuk Setiap Jenis Data, Berapa Lama Maksimal Data Boleh "Stale" Sebelum Dianggap Pelanggaran SLA?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { dataType: "Pengumuman tender baru (LPSE)", maxAge: "4 jam", frequency: "Crawl setiap 4 jam (6× per hari)", current: "Avg 1.4 jam", status: "ON TARGET ✓", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { dataType: "Hasil award / pemenang tender", maxAge: "24 jam", frequency: "Crawl setiap 6 jam", current: "Avg 8.2 jam", status: "ON TARGET ✓", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { dataType: "SKK registry (LPJK)", maxAge: "48 jam", frequency: "Crawl setiap 12 jam", current: "Avg 11.4 jam", status: "ON TARGET ✓", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { dataType: "Profil kompetitor (dari IjinTender)", maxAge: "72 jam", frequency: "Crawl setiap 24 jam", current: "Avg 31 jam (circuit breaker delays)", status: "BORDERLINE ⚠", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { dataType: "Knowledge assets (regulasi, HPS benchmark)", maxAge: "30 hari", frequency: "Manual review cycle", current: "Saat ini 89 items > 30 hari (audit backlog)", status: "BREACH — 15%", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { dataType: "Market news (media konstruksi)", maxAge: "12 jam", frequency: "Crawl setiap 8 jam", current: "Avg 7.1 jam", status: "ON TARGET ✓", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.dataType} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.dataType}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono">
                <span className="text-muted-foreground">SLA max age: {r.maxAge}</span>
                <span className="text-muted-foreground">{r.frequency}</span>
                <span className={r.tc}>Current: {r.current}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Knowledge assets freshness = only category with BREACH. Fix: Sari dedicated 3 jam/minggu untuk refresh queue. Target: all items {'<'} 25 hari by Oct 2026.</p>
      </div>

      {/* Crawler Infrastructure Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> CRAWLER INFRASTRUCTURE — Arsitektur Teknis Sistem Pengumpulan Data MJP dan Keputusan Desain di Baliknya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              component: "Scheduler Engine (Node.js + cron)",
              role: "Orchestrate semua crawl jobs — trigger setiap source sesuai frequency, handle retries, log semua run ke database",
              design_decision: "Menggunakan cron-based scheduler (bukan queue) karena simplicity beats complexity at current scale. Single point of control.",
              tradeoff: "Risk: scheduler downtime = all crawls stop. Mitigasi: health check + auto-restart via process monitor.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              component: "Per-source Crawlers (TypeScript functions)",
              role: "Setiap sumber punya dedicated crawler function — handles auth, pagination, error, rate limiting, dan normalization",
              design_decision: "Dedicated per-source (bukan generic) agar setiap sumber bisa dioptimalkan. LPSE punya captcha handling logic yang tidak relevan untuk sumber lain.",
              tradeoff: "More code to maintain. But: when LPSE changes their format, we fix only LPSE crawler without risk to others.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              component: "Entity Resolution Layer (AI + rule-based)",
              role: "Match records dari sumber berbeda ke entitas tunggal. BUJK yang sama muncul di LPSE dan LPJK dengan nama berbeda → direcognize sebagai same entity",
              design_decision: "Hybrid AI + rule-based: AI handles fuzzy matching, rules handle clear cases (same NPWP = same entity).",
              tradeoff: "Current accuracy 95.9% — 4.1% error rate masih terlalu tinggi untuk J9 competitive intel. Sprint 23 priority fix.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              component: "Circuit Breaker (per-source)",
              role: "Detect dan isolate failing sources. Jika error rate > 10% dalam 30 menit, circuit breaker trips — crawl pause selama 4 jam sebelum retry",
              design_decision: "Prevents cascading failures and excessive error noise. Inspired by Netflix's resilience patterns.",
              tradeoff: "Temporary data gaps saat circuit breaker active. Trade-off: better a known gap than corrupted data stream.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.component} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.component}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Role: {r.role}</p>
              <p className="text-[8px] mb-0.5"><span className="font-bold">Design:</span> {r.design_decision}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Tradeoff: {r.tradeoff}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Infrastructure berjalan dengan Rp 3.2jt/bln cloud cost. Efficient untuk 400K+ records/bln. Scale-up plan: jika volume 3×, migrate scheduler ke distributed queue (BullMQ). Current setup optimal up to 1.2M records/bln.</p>
      </div>

      {/* Data Quality Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> DATA QUALITY METRICS — Bagaimana MJP Mengukur dan Menjaga Kualitas Data yang Menjadi Fondasi Seluruh Intelligence Product?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { metric: "Record Completeness", definition: "% fields yang terisi dari total required fields per record type", current: "94.1%", target: "> 95%", trend: "↑ dari 91.2% (Jan 2026)", status: "NEAR TARGET", tc: "text-blue-700" },
            { metric: "Entity Resolution Accuracy", definition: "% records yang correctly matched ke unique entity (nama yang sama = BUJK yang sama)", current: "95.9%", target: "> 98%", trend: "Stagnant (bug di Sprint 23)", status: "BELOW TARGET — P0 fix", tc: "text-red-700" },
            { metric: "HPS Estimation Error", definition: "Rata-rata absolute error antara MJP HPS estimate dan actual HPS di-announce", current: "3.8%", target: "<5%", trend: "↓ dari 5.1% (2025) via better regional model", status: "ON TARGET ✓", tc: "text-emerald-700" },
            { metric: "Duplicate Record Rate", definition: "% records yang adalah duplikat dari record yang sudah ada di database", current: "2.3%", target: "<3%", trend: "Stable — dedup job runs daily", status: "ON TARGET ✓", tc: "text-emerald-700" },
            { metric: "Source Attribution Rate", definition: "% data points yang punya clear traceable source (bisa diverifikasi)", current: "88.7%", target: "> 90%", trend: "↑ dari 84.1% (Jan 2026)", status: "NEAR TARGET", tc: "text-blue-700" },
            { metric: "Data Freshness Compliance", definition: "% data categories yang memenuhi freshness SLA (tidak stale)", current: "83.3% (5/6 categories)", target: "100%", trend: "1 category breach (Knowledge Assets — refresh backlog)", status: "1 BREACH", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.metric} className="flex gap-2 border-b pb-1.5 items-start">
              <div className="w-40 shrink-0">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.metric}</p>
                <p className="text-[7px] text-muted-foreground">{r.definition}</p>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-2 text-[8px] font-mono">
                  <span className={`font-bold ${r.tc}`}>{r.current}</span>
                  <span className="text-muted-foreground">target: {r.target}</span>
                  <span className="text-muted-foreground">{r.trend}</span>
                </div>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.status}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data quality report dihasilkan otomatis setiap minggu. Hendra review setiap Senin. P0 metric: entity resolution accuracy. Fix due Sprint 23. All other metrics healthy or on track.</p>
      </div>

      {/* Data Source Expansion Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-violet-500" /> SOURCE EXPANSION ROADMAP — Sumber Data Baru yang Sedang Dievaluasi MJP untuk Meningkatkan Kualitas dan Cakupan Intelligence
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              source: "SLIK (Sistem Layanan Informasi Keuangan) — OJK",
              data: "Credit history BUJK dan pemilik. Payment reliability, existing loans, credit rating.",
              value: "Massively improves Trust Score accuracy. Subkon screening lebih reliable.",
              status: "BLOCKED", blocker: "SLIK akses terbatas — butuh izin formal dari OJK. Hendra mengajukan izin Q3 2026. Expected timeline: 12–18 bulan.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              source: "BPJS Ketenagakerjaan — Worker Registration Data",
              data: "Jumlah karyawan aktif per BUJK, turnover rate, UMR compliance signal.",
              value: "Better company size estimation. Worker stability sebagai proxy untuk company health.",
              status: "IN LEGAL REVIEW", blocker: "Data sharing agreement dibutuhkan. Legal mitra MJP sedang evaluate feasibility.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              source: "E-court PN (Pengadilan Negeri) — Dispute Records",
              data: "Sengketa hukum yang melibatkan BUJK — kontrak disputes, tenaga kerja, subkon konflik.",
              value: "Direct input ke Trust Score. Klien bisa tahu jika potential partner sedang dalam dispute aktif.",
              status: "READY TO BUILD", blocker: "E-court data public. Crawler butuh 2 minggu build time by Hendra Jr. Q4 2026 candidate.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              source: "Marketplace Material Konstruksi (Tokopedia B2B, Indotrading)",
              data: "Harga material: besi, semen, pasir, bata, keramik — real-time dari pasar B2B.",
              value: "Improves HPS model accuracy (material cost = 40–60% of HPS). Margin protection alerts.",
              status: "PAUSED", blocker: "H5 hypothesis testing showed low engagement when framed as 'material tracker'. Need reframe as 'HPS accuracy input'. Q1 2027 re-evaluate.",
              tc: "text-slate-600", bc: "bg-slate-50 border-slate-200"
            },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.source}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Data: {r.data}</p>
              <p className="text-[8px] mb-0.5">Value: {r.value}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Blocker: {r.blocker}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Crawler Architecture Diagram */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> CRAWLER ARCHITECTURE — Penjelasan Teknis Cara Kerja Sistem Pengumpulan Data MJP dan Mengapa Arsitektur Ini Dipilih
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { layer: "Layer 1: Scheduler (Cron + BullMQ)", role: "Orchestrator", desc: "Job scheduler yang trigger crawl sesuai frekuensi per source. Hourly untuk LPSE tender, daily untuk LPJK. Queue-based untuk rate limiting dan retry.", tech: "Node.js + BullMQ + Redis", tc: "text-violet-700" },
            { layer: "Layer 2: Source Adapters (per-site)", role: "Crawler", desc: "Each source has its own adapter: LPSE adapter (standardized API), LPJK adapter (HTML scraping + PDF parsing), ijintender adapter (structured data). Adapters are isolated — one breaking doesn't affect others.", tech: "Playwright + Cheerio + pdf-parse", tc: "text-blue-700" },
            { layer: "Layer 3: Normalizer & Deduplicator", role: "Data cleaning", desc: "Raw data dari berbagai sumber di-normalize ke schema yang sama. Entity resolution: 'PT Karya Sejati Tbk' = 'PT Karya Sejati' = BUJK yang sama. Fuzzy matching dengan confidence score.", tech: "Custom NLP + Levenshtein distance", tc: "text-blue-700" },
            { layer: "Layer 4: Enrichment Pipeline", role: "Data augmentation", desc: "Enriched dengan: regional metadata, KBLI mapping, cross-reference ke existing records, computed fields (HPS estimate, competition intensity). Makes raw data actionable.", tech: "PostgreSQL functions + Node.js enrichers", tc: "text-emerald-700" },
            { layer: "Layer 5: Quality Gate & Storage", role: "Quality assurance", desc: "Automated checks before write: completeness score, anomaly detection (HPS 10× avg = flag for review), source credibility scoring. Only records passing threshold → DB write.", tech: "Custom validation + Drizzle ORM + PostgreSQL", tc: "text-emerald-700" },
            { layer: "Layer 6: Circuit Breaker & Monitoring", role: "Reliability", desc: "Per-source circuit breaker: jika failure rate {'>'} 30% → pause crawl, alert Hendra Jr via Telegram. Auto-retry with exponential backoff. Dashboard realtime status.", tech: "Custom circuit breaker + alert webhook", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.layer} className="flex gap-2 items-start border-b pb-1.5 pt-0.5">
              <div className="w-32 shrink-0">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.layer}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.role}</p>
              </div>
              <div className="flex-1">
                <p className="text-[8px] text-muted-foreground mb-0.5">{r.desc}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>Tech: {r.tech}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Architecture choice: monolith-first with adapter pattern. Could split into microservices at 5M+ records/bln. Current scale: adapters + BullMQ single process = sufficient. Over-engineering now = complexity debt.</p>
      </div>

      {/* Tech Debt Register */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> TECH DEBT REGISTER — Hutang Teknis yang Diketahui MJP dan Kapan Akan Dibayar: Transparansi Internal yang Mencegah Surprise Failures
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { debt: "Entity Resolution — Levenshtein matching at > 50K entities gets slow (O(n²))", severity: "P0", impact: "Response time for company search {'>'} 3 seconds at current scale. At 80K+ entities: will hit 10s timeout.", plan: "Sprint 24: index-based ANN (approximate nearest neighbor) matching. Estimated 50× speedup.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { debt: "No automated test suite for crawler adapters", severity: "P1", impact: "Crawler changes often break silently. Only discovered when data gaps noticed days later.", plan: "Q4 2026: add Playwright record-replay tests for all 6 source adapters. Hendra Jr. sprint 2 weeks.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { debt: "Session management: JWT with no refresh token rotation", severity: "P1", impact: "Security vulnerability: stolen JWT = full access until expiry (7 days). No way to revoke.", plan: "Q4 2026: implement refresh token rotation + Redis session store. 3-day sprint.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { debt: "Frontend bundle size: 2.4MB (uncompressed) — first load > 4s on 3G", severity: "P2", impact: "Bad UX for field users on mobile 3G. KTI expansion will worsen this.", plan: "Q1 2027: code splitting per route + lazy loading. Target <800KB initial bundle.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { debt: "No DB query optimization — all queries are N+1 in list views", severity: "P2", impact: "At 500+ klien, some list pages will become slow. API response time creep.", plan: "Q1 2027: audit + optimize top 10 slowest queries. DataLoader for nested relations.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.debt} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.debt}</p>
                <span className={`text-[8px] font-mono font-black shrink-0 ${r.tc}`}>{r.severity}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Impact: {r.impact}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Plan: {r.plan}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tech debt register reviewed setiap sprint. P0 = must fix this sprint. P1 = fix within 2 sprints. P2 = scheduled. Naming and tracking debt prevents it from being ignored until it causes outage or security incident.</p>
      </div>

      {/* Data Pipeline Performance SLA */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> PIPELINE SLA — Target SLA untuk Setiap Tahap Data Pipeline MJP: Dari Raw Data ke Klien-Ready Intelligence
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { stage: "Crawl → Raw DB", sla: "< 4 jam setelah source update", actual: "2.1 jam avg", compliance: "97.3%", breach_cause: "Source downtime (LPSE maintenance)", tc: "text-emerald-700" },
            { stage: "Raw DB → Normalized + Enriched", sla: "< 1 jam setelah raw insert", actual: "23 min avg", compliance: "99.1%", breach_cause: "Entity resolution timeout (P0 bug fix in progress)", tc: "text-emerald-700" },
            { stage: "Enriched → Quality Gate + Production DB", sla: "< 30 menit", actual: "8 min avg", compliance: "99.7%", breach_cause: "Almost never breaches", tc: "text-emerald-700" },
            { stage: "New Record → Search Index", sla: "< 5 menit (near-real-time)", actual: "3.2 min avg", compliance: "98.4%", breach_cause: "Search index rebuild during schema updates", tc: "text-emerald-700" },
            { stage: "New Record → Alert System (L1 regulatory)", sla: "< 30 menit dari detection", actual: "18 min avg", compliance: "96.1%", breach_cause: "Sari review step can delay if not at desk", tc: "text-blue-700" },
            { stage: "Alert → Client Delivery (email + WA)", sla: "< 5 menit dari approve", actual: "2.4 min avg", compliance: "99.8%", breach_cause: "WA API rate limits during peak hours (rare)", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stage} className="flex gap-2 items-start border-b py-1">
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.stage}</p>
                <p className="text-[7px] text-muted-foreground">SLA: {r.sla} | Actual: {r.actual}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>Breach cause: {r.breach_cause}</p>
              </div>
              <span className={`text-[9px] font-black shrink-0 ${r.tc}`}>{r.compliance}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pipeline SLA adalah direct determinant of product quality. End-to-end: tender announced → klien receives actionable intel {'<'} 4.5 jam. This speed is 10× faster than manual monitoring that non-MJP BUJK do. Speed advantage is compounding.</p>
      </div>

      {/* Entity Resolution Engine Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" /> ENTITY RESOLUTION — Cara Kerja Engine Penggabungan Entitas MJP: Bagaimana 12.400 BUJK Unik di Database Dikenali dari Berbagai Sumber yang Tidak Konsisten?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Problem: LPSE Jawa Timur menyebut perusahaan sebagai "PT. KARYA BANGUN NUSANTARA". LPJK menyimpan "PT KARYA BANGUN NUSANTARA" (no dot). Klien sends surat penawaran ke "PT Karya Bangun Nusantara". Same entity — but 3 different strings across 3 sources.</p>
          {[
            { step: "Step 1: Canonical Name Normalization", detail: "Remove: 'PT.', 'CV.', 'UD.', case normalize, strip double-space, remove trailing punctuation. Result: 'pt karya bangun nusantara'. This step alone resolves 67% of disambiguation cases.", tc: "text-emerald-700" },
            { step: "Step 2: NPWP Matching (highest confidence)", detail: "Cross-match NPWP across LPJK, LPSE, TKDN sources. NPWP is authoritative identifier. 43% of entities have NPWP available from at least one source. When matched: confidence = 0.99.", tc: "text-emerald-700" },
            { step: "Step 3: Levenshtein Distance + Jaro-Winkler Scoring", detail: "For remaining ambiguous names: edit distance < 3 AND Jaro-Winkler > 0.94 = likely same entity. Current bottleneck: O(n²) at 50K+ entities. Fix in Sprint 24.", tc: "text-orange-700" },
            { step: "Step 4: Address Correlation", detail: "Same city + similar name = additional confidence boost. Different province = confidence penalty. Helps distinguish between PT X Jakarta vs PT X Surabaya (franchise/branch vs namesake).", tc: "text-blue-700" },
            { step: "Step 5: Manual Review Queue", detail: "Low-confidence matches (score 0.75–0.89) go into manual review queue. Dewi reviews 15–20 cases/week. Each verified match teaches the system (training data for future ML model).", tc: "text-blue-700" },
          ].map((r, i) => (
            <div key={r.step} className="flex gap-2 items-start border-b pb-1.5">
              <span className="text-[8px] font-bold text-primary w-4 shrink-0">{i + 1}.</span>
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.step}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>{r.detail}</p>
              </div>
            </div>
          ))}
          <div className="border rounded-sm p-2 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Current accuracy: 94.7% auto-resolution rate. 5.3% flagged for human review. Target Q4 2026: 97.5% auto (ANN indexing).</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Entity resolution quality = data quality foundation. Everything else — Trust Scores, Competitor Radar, Tender History — depends on correctly identifying that 'PT Karya Bangun Nusantara' dan 'PT KARYA BANGUN NUSANTARA' are the same BUJK.</p>
      </div>

      {/* Source Reliability Scoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> SOURCE RELIABILITY — Bagaimana MJP Menilai Tingkat Kepercayaan dari Setiap Sumber Data dan Bagaimana Skor Ini Mempengaruhi Penggunaan Data?
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left p-1 text-muted-foreground">Data Source</th>
                <th className="p-1 text-center">Reliability</th>
                <th className="p-1 text-center">Timeliness</th>
                <th className="p-1 text-center">Completeness</th>
                <th className="p-1 text-center text-primary">Overall</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["LPSE Nasional (LKPP)", "9.1/10", "9.4/10", "8.7/10", "9.1 ★★★★★"],
                ["LPJK Jasa Konstruksi", "8.8/10", "7.2/10 (monthly)", "7.9/10", "8.0 ★★★★"],
                ["LPSE Provinsi (32 provinsi)", "8.1/10", "8.6/10", "6.4/10 (varies widely)", "7.7 ★★★★"],
                ["Dewi community reports", "7.4/10 (subjective)", "9.8/10 (real-time)", "5.2/10 (sparse)", "7.5 ★★★★"],
                ["Budi field interviews", "9.3/10 (primary source)", "7.1/10 (periodic)", "4.8/10 (sample)", "7.1 ★★★★"],
                ["IjinTender.co.id", "6.8/10", "8.1/10", "6.1/10", "7.0 ★★★"],
                ["BPS press releases", "9.4/10", "5.3/10 (quarterly)", "7.4/10", "7.4 ★★★★"],
                ["Media konstruksi (web crawl)", "6.1/10 (rumors)", "8.9/10", "5.7/10", "6.9 ★★★"],
              ].map(([src, rel, time, comp, overall], i) => (
                <tr key={i} className="border-b hover:bg-muted/20">
                  <td className="p-1 font-bold">{src}</td>
                  <td className="p-1 text-center">{rel}</td>
                  <td className="p-1 text-center">{time}</td>
                  <td className="p-1 text-center">{comp}</td>
                  <td className="p-1 text-center font-bold text-primary">{overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Reliability scores used internally: low-reliability sources are labeled in UI ('community observation — verify independently') vs high-reliability ('LPSE official data'). Clients can trust MJP because MJP is transparent about its data's provenance and confidence levels.</p>
      </div>

      {/* Data Incident History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-orange-500" /> INCIDENT HISTORY — Riwayat Insiden Data MJP: 5 Kegagalan Terbesar yang Pernah Terjadi, Dampaknya, dan Apa yang Berubah Setelahnya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { incident: "LPSE Crawler Silent Failure (Maret 2025, 72 jam)", description: "Crawler LPSE Jawa Tengah gagal karena update struktur HTML LPSE tapi tidak ada alert. 72 jam tanpa data Jateng. 23 klien Jateng tidak menerima tender alerts selama 3 hari.", impact: "3 Enterprise klien miss 2 tender deadlines. 1 non-renewal citing this. Rp 28jt revenue at risk.", fix: "Added: crawler health check every 15 menit + Telegram alert jika 0 records in 30 menit. Added: Sari manual spot-check every Tuesday morning.", tc: "text-red-700" },
            { incident: "Wrong Regulatory Alert — Salah Tanggal Berlaku (Oktober 2024)", description: "Sari mengirim L1 alert dengan tanggal efektif 1 November, padahal masa transisi sampai 1 Februari. Klien panik dan mulai process yang belum perlu.", impact: "12 klien took immediate (unnecessary) action. 2 klien complaint. 0 churn but significant trust erosion.", fix: "Interpretation SOP Step 3 (transition period check) added. Double-check requirement for all dates before L1 alert approval.", tc: "text-orange-700" },
            { incident: "Entity Duplication — 34 BUJK tercatat dua kali (Juli 2024)", description: "Database migration error caused 34 entities to be duplicated. Trust Scores split incorrectly. Some klien saw competitor with inflated (split) tender count.", impact: "Competitor Radar data misleading for 6 days. Sari spotted during QBR review. Emergency cleanup.", fix: "Entity deduplication validation script added to every import job. Unique constraint on (normalized_name, NPWP) pair.", tc: "text-orange-700" },
            { incident: "Research Budget Cut Aftermath (Q3–Q4 2024)", description: "Hendra cut research budget 30% to manage cashflow. Sari reduced output, Dewi stopped monitoring 8 sources. Intel quality declined.", impact: "4 Enterprise klien churn in next quarter citing 'alerts less relevant'. Revenue impact: -Rp 42jt ARR. Cashflow saved: Rp 32jt. Net: -Rp 10jt.", fix: "Research budget now protected as CapEx commitment, not variable cost. Hendra approved: research never cut even in tight months.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.incident} className="border-l-2 border-orange-300 pl-3 py-1.5">
              <p className="text-[9px] font-bold mb-0.5">{r.incident}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[8px] font-mono ${r.tc} mb-0.5`}>Impact: {r.impact}</p>
              <p className="text-[8px]">Fix: {r.fix}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Incident history adalah most valuable learning resource MJP has. Every failure is documented, root-caused, and fixed. Rule: every incident must produce at least 1 process change or automated protection. We never have the same incident twice. Current status: 0 incidents in 2026 YTD that weren't caught within 4 hours.</p>
      </div>

      {/* Data Pipeline Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> PIPELINE ARCHITECTURE — Perjalanan Data dari Sumber ke Layar Klien: 6 Layer Pipeline MJP dan Apa yang Terjadi di Setiap Tahap?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { layer: "Layer 1: Ingestion (Hendra Jr. — automated)", detail: "Crawlers pull from LPSE, LPJK, BPS, media sources. Technologies: Cheerio (HTML parsing), Playwright (JS-heavy sites), direct API (BPS, LKPP). Schedule: LPSE every 2 hours, LPJK daily, BPS monthly. Raw data → staging table.", tc: "text-blue-700" },
            { layer: "Layer 2: Normalization (automated + Sari spot-check weekly)", detail: "Date format standardization, currency cleaning (remove Rp, Jt notation → raw integers), province code mapping, Levenshtein entity matching. 94.2% auto-normalized. 5.8% flagged for manual review.", tc: "text-blue-700" },
            { layer: "Layer 3: Entity Resolution (ML-assisted, reviewed by Dewi)", detail: "Name matching, NPWP cross-reference, address clustering. Output: canonical entity IDs. New entity or match confidence < 0.78 → Dewi manual review queue. Avg 12 reviews/day.", tc: "text-orange-700" },
            { layer: "Layer 4: Enrichment (Sari + Dewi + Budi field intel)", detail: "Trust Score calculation, Opportunity Score, freshness stamps, domain + urgency tags, community intel layer overlay. Human-in-the-loop: Sari approves all enrichment for regulatory items.", tc: "text-orange-700" },
            { layer: "Layer 5: Alert Engine (BullMQ + Hendra Jr.)", detail: "Watchers configured per client watchlist. Trigger evaluation: every 15 min for L1 conditions, hourly for L2, nightly for L3 + daily briefing. Alert generated → WA/email/in-app delivery queue.", tc: "text-emerald-700" },
            { layer: "Layer 6: Analytics Layer (Hendra Jr. + Hendra review)", detail: "Event tracking (views, shares, bookmarks, action taken). Win outcome feedback loop: klien marks tender 'won' or 'lost' → feeds ML training set. Monthly cohort analysis for churn prediction.", tc: "text-emerald-700" },
          ].map((r, i) => (
            <div key={r.layer} className="flex gap-2 items-start border-b pb-1.5">
              <span className={`text-[8px] font-black w-4 shrink-0 ${r.tc}`}>{i + 1}.</span>
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.layer}</p>
                <p className="text-[8px] text-muted-foreground">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">End-to-end latency: L1 trigger to klien WA delivery: avg 18 menit (LPSE announcement → crawler → normalize → entity resolve → enrich → alert). L1 SLA target: {'<'} 30 menit. 96.1% SLA compliance YTD. Bottleneck: Layer 4 Sari enrichment queue for regulatory items during busy periods.</p>
      </div>

      {/* LPSE Structure Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> LPSE STRUCTURE — Anatomi Sistem LPSE Indonesia yang MJP Harus Navigasi: Mengapa Kompleksitas LPSE adalah MJP's Moat?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-2.5 bg-muted/10 mb-1">
            <p className="text-[9px] font-bold mb-0.5">The LPSE Complexity Problem:</p>
            <p className="text-[8px] text-muted-foreground">Indonesia tidak punya satu sistem LPSE — ada 500+ LPSE instances (1 per kementerian, provinsi, kabupaten/kota, BUMN). Setiap instance punya struktur HTML berbeda, URL scheme berbeda, rate limit berbeda. MJP crawl 312 active instances hari ini.</p>
          </div>
          {[
            { type: "LPSE Nasional (LKPP)", count: "1", coverage: "Semua kementerian + lembaga pusat", tech: "Standardized — easiest to crawl. Most data quality. Direct API tersedia untuk sebagian.", tc: "text-emerald-700" },
            { type: "LPSE Provinsi", count: "34", coverage: "Pemprov + UPT Provinsi", tech: "Semi-standardized. Mostly same base system (LPSE version 6+). 2 provinces still on LPSE v4 (legacy).", tc: "text-emerald-700" },
            { type: "LPSE Kabupaten/Kota", count: "415 covered (of 514)", coverage: "Pemkab + Pemkot", tech: "Highly variable. Some on LPSE v6, many on custom implementations. 99 kabupaten still have no LPSE or LPSE inaccessible externally.", tc: "text-orange-700" },
            { type: "LPSE BUMN/BUMD", count: "62 covered", coverage: "Major BUMN: PLN, Pertamina, Waskita, etc.", tech: "Custom procurement portals. Not standardized at all. Each requires custom crawler maintenance.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.type} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.type}</p>
                <span className={`text-[7px] font-mono ${r.tc} shrink-0`}>{r.count} instances</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Coverage: {r.coverage}</p>
              <p className={`text-[7px] ${r.tc}`}>Tech: {r.tech}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Why complexity = moat:</p>
            <p className="text-[8px]">Building and maintaining 312 custom crawlers is 3 years of Hendra Jr. work. A new competitor would need the same investment before serving any data. Plus: LPSE instances update their HTML regularly → crawler maintenance is ongoing cost. MJP has 3 years of learning on crawler resilience. This is technical debt that works in MJP's favor.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">LPSE coverage gap (99 kabupaten uncovered) = Rp 41 triliun of annual procurement not indexed by MJP. Most are remote/small kabupaten. Adding 50 more = 6-week Hendra Jr. sprint. Prioritized for Q1 2027.</p>
      </div>

      {/* Data Quality Incidents Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semiboid uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> INCIDENT LOG — 6 Insiden Kualitas Data Terbesar yang MJP Alami: Root Cause, Dampak ke Klien, dan Perbaikan Permanen yang Diimplementasikan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { date: "Mar 2023", incident: "LPSE Kemenkes down 3 hari — crawler tidak error, terus loop request. 0 tender dari sumber ini selama 3 hari, tidak ada alert to klien.", rootcause: "No circuit breaker on crawler. Infinite retry saat 5xx response.", impact: "72 klien missed 18 tenders. 3 klien complained.", fix: "Circuit breaker + source health dashboard. SLA now: alert if any source down > 1 hour." },
            { date: "Jul 2023", incident: "KBLI mapping error: 47 tender mis-tagged ke klien yang salah kategori. Alert sent to wrong klien.", rootcause: "Manual KBLI mapping table had 2 transposed codes. Affected sub-categories 41011 and 41110.", impact: "47 wrong alerts. 0 klien acted on them (too irrelevant). Reputational impact.", fix: "Automated KBLI validation against LKPP official list. Monthly reconciliation." },
            { date: "Jan 2024", incident: "LPJK blacklist scrape failed silently for 19 days. 6 blacklisted BUJKs not flagged in platform.", rootcause: "LPJK changed HTML structure. Crawler returned 200 OK but empty data. No empty-result alarm.", impact: "No klien made bad decisions based on this (luck). Discovered in internal audit.", fix: "Min-record alarm: if LPJK scrape returns < 50 records → alert Hendra Jr. immediately." },
            { date: "Jun 2024", incident: "HPS model retrained on wrong date range. Included IKN tenders in general model, inflating estimates by avg 8% for non-IKN tenders.", rootcause: "Training pipeline bug: IKN filter not applied in June retrain. IKN projects have atypical cost structures.", impact: "213 klien received slightly inflated HPS estimates for 6 weeks. Reza spent 1 week re-communicating to affected klien.", fix: "IKN flag in training data. Separate model for IKN tenders. Retrain QA checklist." },
            { date: "Nov 2024", incident: "Daily briefing duplicate sent to 89 klien — 2 copies of same briefing on same morning.", rootcause: "Scheduler timeout caused double execution. Both runs completed successfully.", impact: "Klien confused. 12 queries to support. No revenue impact.", fix: "Idempotency key on briefing sends. Deduplication at WA/email gateway." },
          ].map((r) => (
            <div key={r.date} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.incident}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.date}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5"><strong>Root cause:</strong> {r.rootcause}</p>
              <p className="text-[7px] text-orange-700 mb-0.5"><strong>Impact:</strong> {r.impact}</p>
              <p className="text-[7px] text-emerald-700"><strong>Fix:</strong> {r.fix}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Incident log is public internally — every team member reads it in onboarding. Hendra's rule: incidents are learning opportunities, not blame targets. The person who discovers and reports an incident gets credit, not punishment. Result: rapid voluntary incident reporting culture. Average time-to-discover has dropped from 19 days (LPJK incident) to {'<'} 4 hours average YTD 2026.</p>
      </div>

      {/* Infrastructure Cost Structure */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" /> INFRA COST — Anatomi Biaya Infrastruktur MJP: Berapa yang Dihabiskan untuk Cloud, AI API, WhatsApp Gateway, dan Bagaimana Ini Berskala dengan Pertumbuhan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Cost Category</th>
                  <th className="p-1 text-center">Current (bln)</th>
                  <th className="p-1 text-center">% COGS</th>
                  <th className="p-1 text-center">Scaling model</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Cloud compute (crawlers + API)", "Rp 8.2jt", "9%", "~Linear with klien count"],
                  ["AI API (Claude + embeddings)", "Rp 4.7jt", "5%", "~Linear with briefings"],
                  ["WhatsApp Business API gateway", "Rp 3.1jt", "3%", "Per-message cost (decreasing per klien at scale)"],
                  ["Object storage (photos/PDF)", "Rp 1.8jt", "2%", "Grows with data volume (slow)"],
                  ["Email delivery (SMTP)", "Rp 0.4jt", "0.5%", "Linear with klien count"],
                  ["Monitoring + logging tools", "Rp 1.2jt", "1.5%", "Fixed until 10× scale"],
                  ["TOTAL INFRA", "Rp 19.4jt/bln", "21%", "Target: <18% at 1.000 klien"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${i === 6 ? "font-bold bg-primary/5" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className={`p-1 text-center ${i === 6 ? "text-primary" : "text-muted-foreground"}`}>{row[1]}</td>
                    <td className={`p-1 text-center ${parseFloat(row[2]) >= 9 ? "text-orange-700 font-bold" : "text-muted-foreground"}`}>{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Scale economics:</p>
            <p className="text-[8px]">At 487 klien: 21% COGS ratio. At 1.000 klien (2× scale): projection is 18% COGS (monitoring tools are fixed, WA gateway has volume discount at 1M messages/bln). At 2.000 klien: 15% target. Cloud compute is the one linear cost — Hendra Jr. has optimization backlog (crawler efficiency sprint, Q4 2026) targeting 25% reduction in compute cost.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Infrastructure transparency is part of MJP's Series A narrative: 83% gross margin (before headcount) is defensible because infra cost structure is favorable and improving with scale. Biggest single risk: AI API cost if usage patterns shift (e.g., if NLQ query volume spikes). Hendra Jr. has implemented per-klien AI usage budget cap as safety valve.</p>
      </div>

      {/* Data Freshness SLA by Source */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> FRESHNESS SLA — Komitmen Data Freshness per Sumber: Berapa Lama Data Bisa Menjadi Stale Sebelum Klien Mendapat Informasi yang Salah?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Data Source</th>
                  <th className="p-1 text-center">Poll Frequency</th>
                  <th className="p-1 text-center">Max Staleness</th>
                  <th className="p-1 text-center">Alert Trigger</th>
                  <th className="p-1 text-center">2026 YTD SLA</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPSE Nasional (LKPP)", "Every 1 hour", "< 2 jam", "New tender announcement", "98.7% ✅"],
                  ["LPSE Provinsi (34)", "Every 2 jam", "< 3 jam", "New tender announcement", "96.4% ✅"],
                  ["LPSE Kab/Kota (278 covered)", "Every 4 jam", "< 6 jam", "New tender announcement", "93.1% 🟡"],
                  ["LPJK Blacklist", "Every 1 jam", "< 2 jam", "New entry added", "99.1% ✅"],
                  ["LPJK SBU/SKK database", "Every 6 jam", "< 12 jam", "Expiry < 30 days", "97.8% ✅"],
                  ["LKPP Regulation portal", "Every 4 jam", "< 8 jam", "New document published", "96.2% ✅"],
                  ["PUPR website", "Every 4 jam", "< 8 jam", "New announcement", "94.8% ✅"],
                  ["BUMN procurement portals (62)", "Every 12 jam", "< 24 jam", "New tender", "89.3% 🟡"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${row[4].includes("🟡") ? "bg-orange-50" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center font-bold ${row[4].includes("✅") ? "text-emerald-700" : "text-orange-700"}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700">Two 🟡 sources — action plans:</p>
            <p className="text-[8px]">LPSE Kab/Kota (93.1%): 3 kabupaten with persistent crawl failures due to custom portal implementations. Hendra Jr. rewriting scrapers in Q3 2026. BUMN portals (89.3%): 8 BUMN portals have dynamic JS rendering — headless browser required. High compute cost. Considering selective coverage (top 25 BUMN only) vs full automation.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Freshness SLA is publicly committed in MJP's Enterprise DPA. The SLA column is from actual monitoring data, not aspirational targets. 96%+ SLA on most sources = platform alert is reliable enough that klien can trust 'if I didn't get an alert, there probably wasn't one.' This confidence is the core of MJP's value proposition.</p>
      </div>

      {/* Hendra Jr. Technical Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> TECH ROADMAP — Roadmap Teknis Hendra Jr. 2026–2027: 8 Proyek Infrastruktur yang Memungkinkan Platform Scale ke 10× Klien Saat Ini Tanpa Tambah Biaya Operasional Secara Linier
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { project: "NLQ (Natural Language Query) Engine", timeline: "Q4 2026", status: "70% built", impact: "Highest — opens self-serve intelligence to non-technical klien. $Series A demo feature.", complexity: "⭐⭐⭐⭐⭐", tc: "text-red-700" },
            { project: "Headless Browser Crawler Upgrade (BUMN portals)", timeline: "Q3 2026", status: "In progress", impact: "High — adds 27 BUMN portals to crawl coverage. Fixes 89.3% SLA gap.", complexity: "⭐⭐⭐⭐", tc: "text-orange-700" },
            { project: "Per-klien AI Usage Budget Cap", timeline: "Q2 2026 ✅ Done", status: "Live", impact: "Medium — prevents AI cost runaway. Unlocks NLQ rollout safely.", complexity: "⭐⭐", tc: "text-emerald-700" },
            { project: "Platform Observability Stack (metrics dashboard)", timeline: "Q3 2026", status: "40% built", impact: "Medium — Hendra Jr. + Hendra need real-time pipeline health visibility.", complexity: "⭐⭐⭐", tc: "text-orange-700" },
            { project: "Enterprise API v2 (GraphQL)", timeline: "Q1 2027", status: "Design phase", impact: "High — enterprise klien want flexible data extraction. Unlocks API tier revenue expansion.", complexity: "⭐⭐⭐⭐", tc: "text-blue-700" },
            { project: "Knowledge Asset Semantic Search", timeline: "Q4 2026", status: "Dependent on NLQ", impact: "High — klien can find assets by meaning, not just keyword. Key for 3.200-asset discovery.", complexity: "⭐⭐⭐", tc: "text-blue-700" },
            { project: "Mobile Push Notification Service", timeline: "Q3 2026", status: "Backlog (after headless crawler)", impact: "Medium — increases mobile alert delivery reliability (currently 67%).", complexity: "⭐⭐", tc: "text-muted-foreground" },
            { project: "Automated BIM Compliance Checker alpha", timeline: "Q4 2026", status: "Research phase", impact: "Very High if BIM mandate accelerates — automated doc compliance for > Rp 100M projects.", complexity: "⭐⭐⭐⭐⭐", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.project} className="flex gap-2 border-b py-1.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[8px] font-bold ${r.tc}`}>{r.project}</p>
                  <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.timeline}</span>
                </div>
                <div className="flex gap-3">
                  <p className="text-[7px] text-muted-foreground">Status: {r.status}</p>
                  <p className="text-[7px] text-muted-foreground">Complexity: {r.complexity}</p>
                </div>
                <p className={`text-[7px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hendra Jr. capacity: 40–45 hours/week. Estimated time for all 8 projects if sequential: 18 months. To hit Q4 2026 targets: NLQ + headless crawler + observability in parallel (Hendra Jr. is the bottleneck). Decision: hire 1 junior engineer (target Q3 2026, budget approved in Series A plan) to handle crawler maintenance + observability, freeing Hendra Jr. for NLQ full focus. NLQ slipping = Series A narrative weakened.</p>
      </div>

      {/* Data Incident Response Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> INCIDENT RESPONSE — Protokol Respons Insiden Data MJP: Apa yang Dilakukan dalam 60 Menit Pertama Jika Crawler Mati, Data Salah Masuk ke Klien, atau Server Down
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              type: "P0 — Crawler Total Failure (all LPSE sources down)",
              detection: "Monitoring dashboard: zero ingestion for > 30 menit. Auto-alert to Hendra Jr. WA.",
              response: [
                "T+0: Hendra Jr. confirms failure. Messages MJP-Ops WA group.",
                "T+10: Root cause analysis (infra issue vs. LPSE-side change). If infra: fix immediately. If LPSE-side: document affected sources.",
                "T+30: Sari alerted. If affecting today's briefing: Sari manually sources top 3 items from LPSE directly.",
                "T+60: Klien alert if outage > 2 hours: 'Sistem monitoring kami sedang recovery — alert akan terlambat hingga [time]. Tim kami sedang menangani.'",
              ],
              owner: "Hendra Jr. (tech), Sari (content backup), Hendra (klien comms if needed)",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              type: "P1 — Incorrect Data Published to Klien (wrong HPS, wrong blacklist status)",
              detection: "Klien report via WA/email. Or Sari spots in quality review.",
              response: [
                "T+0: Hendra confirms scope. Who received incorrect data? What decisions may they have made?",
                "T+15: Sari drafts correction. Hendra reviews. Send corrected data via WA to all affected klien.",
                "T+30: Root cause fix. Was it data source, processing error, or annotation error?",
                "T+24h: Post-mortem in Notion. All team informed. Prevention measure documented.",
                "For high-impact errors (wrong blacklist status affecting > 1 bid decision): Hendra personal call to affected Enterprise klien.",
              ],
              owner: "Hendra (ownership), Sari (content correction), Hendra Jr. (technical fix)",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              type: "P2 — Platform Downtime (web/mobile inaccessible)",
              detection: "UptimeRobot alert (configured at < 5-min intervals). Also Hendra Jr. phone alert.",
              response: [
                "T+0: Hendra Jr. investigates. Most outages resolve in < 5 menit (auto-restart).",
                "T+15: If not auto-resolved: manual intervention. Check server logs. Rollback if recent deployment caused it.",
                "T+60: If > 1 hour: send WA status update to all Pro + Enterprise klien.",
                "Post-incident: update status page (Notion public page).",
              ],
              owner: "Hendra Jr. (primary). Hendra on-call for communication if > 2 hours.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.type} className={`border rounded-sm p-2.5 ${r.bc} mb-1`}>
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Detection: {r.detection}</p>
              <div className="mb-0.5">{r.response.map((s, i) => <p key={i} className="text-[7px]">• {s}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>Owner: {r.owner}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Incident response protocol tested via annual drill (Hendra Jr. simulates failure, team responds). 2025 drill: P0 total crawler failure. Result: 47 minutes to full recovery. Target: {'<'}60 menit. On track. P1 (incorrect data) is the highest-fear scenario — one bad blacklist status could send an Enterprise klien into a damaging consortium decision. Zero P1 incidents in 2025 (2 near-misses caught by Sari's quality gate before reaching klien).</p>
      </div>

      {/* Crawler Architecture Evolution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> CRAWLER EVOLUTION — Evolusi Arsitektur Crawler MJP dari 2022 hingga 2026: Dari 1 Script Python ke 312 Source Stateless Engine dan Kenapa Rewrite di 2024 adalah Keputusan Paling Berani Hendra Jr.
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { version: "v1 (2022) — Single monolith", desc: "1 Python script, loops through all LPSE. Ran on Hendra Jr.'s laptop. Fragile: if 1 LPSE returned unexpected HTML, entire crawl failed. No error isolation. Daily manual restart.", limitation: "Manual, fragile, no parallelism. Max 12 LPSE instances practical.", tc: "text-muted-foreground" },
            { version: "v2 (2023) — Source-separated scripts", desc: "Each LPSE got its own script. 47 scripts total. Managed by cron jobs. Better isolation but: 47 separate files to maintain, no shared logic, bugs fixed 47 times.", limitation: "Maintenance nightmare. When LPSE changed their HTML: update 47 files.", tc: "text-muted-foreground" },
            { version: "v3 (2024) — Stateless modular engine (CURRENT)", desc: "Complete rewrite (2 months, Hendra Jr. only). Single crawler engine + source config files. Adding new source = 1 config JSON, not 1 new script. Error isolation per source. Horizontal scaling possible.", limitation: "Complex initial architecture but maintenance is now O(1) per new source, not O(n).", tc: "text-primary" },
            { version: "v4 (planned 2026) — Headless browser tier", desc: "Layer on top of v3 for JS-rendered LPSE portals (27 BUMN sources that v3 can't handle). Puppeteer/Playwright-based. Higher compute cost but enables full BUMN coverage.", limitation: "Compute cost ~3× per JS-rendered source. Selective deployment planned for high-value sources only.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.version} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.version}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Limitation: {r.limitation}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mt-1">
            <p className="text-[9px] font-bold text-blue-700">The 2024 rewrite story:</p>
            <p className="text-[8px]">Hendra Jr. proposed the v3 rewrite in Q3 2023. Hendra's first reaction: 'Can we afford 2 months of no new features?' Hendra Jr.'s counter: 'Can we afford 1 year of crawl maintenance that's already taking 40% of my time?' Approved. 2-month rewrite. Result: maintenance time reduced from 40% to 8% of Hendra Jr.'s week. Freed 32% capacity for NLQ and other product work. The most ROI-positive decision in MJP's technical history.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">v3 architecture also serves as Hendra Jr.'s best recruiting asset: 'I built a stateless distributed crawler covering 312 government procurement sources with automatic failure isolation.' This is the kind of technical work that attracts senior engineers. Hendra: 'Give good engineers hard problems to solve well — that's how you keep them and how you attract the next one.'</p>
      </div>

      {/* Data Infrastructure Cost Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" /> INFRA COST MODEL — Model Biaya Infrastruktur MJP: Dari Rp 4.2jt/bln di 2023 ke Rp 18.7jt/bln di 2026 — Breakdown Per Komponen dan Proyeksi Biaya Saat Klien Tumbuh 3× ke 1.500
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Komponen</th>
                  <th className="p-1 text-center">2023</th>
                  <th className="p-1 text-center">2024</th>
                  <th className="p-1 text-center">2026 (current)</th>
                  <th className="p-1 text-center">2028 (proj. 1.500 klien)</th>
                  <th className="p-1 text-left">Scaling behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["App servers (EC2/VM)", "Rp 1.2jt", "Rp 2.1jt", "Rp 4.8jt", "Rp 9.6jt", "~Linear with traffic"],
                  ["Database (PostgreSQL RDS)", "Rp 0.8jt", "Rp 1.4jt", "Rp 3.2jt", "Rp 6.5jt", "Sub-linear (queries optimized)"],
                  ["Crawler compute", "Rp 0.6jt", "Rp 1.8jt", "Rp 4.1jt", "Rp 7.2jt", "Linear with source count, not klien"],
                  ["Storage (S3/blob)", "Rp 0.3jt", "Rp 0.7jt", "Rp 2.1jt", "Rp 4.8jt", "Linear with knowledge corpus"],
                  ["CDN + bandwidth", "Rp 0.2jt", "Rp 0.4jt", "Rp 1.8jt", "Rp 4.2jt", "Linear with active users"],
                  ["WA notification (Business API)", "Rp 0.1jt", "Rp 0.6jt", "Rp 1.7jt", "Rp 4.1jt", "Linear with notification volume"],
                  ["AI/LLM inference (briefing + NLQ)", "Rp 0jt", "Rp 0.2jt", "Rp 1.0jt", "Rp 5.5jt", "Super-linear if NLQ usage grows fast"],
                  ["TOTAL", "Rp 3.2jt", "Rp 7.2jt", "Rp 18.7jt", "Rp 41.9jt", "~2.2× per klien doubling"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${i === 7 ? "font-bold bg-muted/10" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-primary">{row[3]}</td>
                    <td className="p-1 text-center text-blue-700">{row[4]}</td>
                    <td className="p-1 text-muted-foreground">{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Unit economics of infrastructure:</p>
            <p className="text-[8px]">Current: Rp 18.7jt/bln for 487 klien = Rp 38.4k/klien/bln. At Rp 1.5jt ARR per Pro klien/bln: infra is 2.6% of revenue per klien. At 1.500 klien (2028): Rp 41.9jt/bln / 1.500 klien = Rp 27.9k/klien/bln (29% improvement from scale). Hendra: 'We have a sub-linear infra cost curve — that's a strong unit economics story for Series A.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Infrastructure cost model maintained by Hendra Jr. — reviewed monthly against actual cloud bills. Main risk: LLM inference costs for NLQ could be super-linear if klien usage is higher than predicted. Mitigation: NLQ query budget per user (Pro: 100 queries/month, Enterprise: unlimited). Model does not include post-Series A headless browser tier (v4 crawler) — adds estimated Rp 8–12jt/bln for full BUMN coverage.</p>
      </div>

      {/* Hendra Jr.'s Technical Debt Register */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Wrench className="h-3.5 w-3.5 text-orange-500" /> TECH DEBT REGISTER — Register Utang Teknis MJP yang Dikelola Hendra Jr.: 8 Item Utang Teknis Saat Ini, Dampak jika Tidak Diselesaikan, dan Jadwal Resolusi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Hendra Jr. maintains a living technical debt register in Notion. Current active items:</p>
          {[
            { item: "TD-01 — Single-threaded crawler queue", severity: "MEDIUM", impact: "If 1 large LPSE (e.g., LPSE PUPR Nasional) is slow, all subsequent sources wait. During LPSE maintenance windows: full crawl delay.", plan: "Async queue refactor — planned Q4 2026. Estimated 3 days work.", tc: "text-orange-700" },
            { item: "TD-02 — No automated rollback for DB migrations", severity: "HIGH", impact: "A bad migration requires manual intervention. In a P0 incident during migration, recovery takes 2–4 hours instead of <30 minutes.", plan: "Add migration rollback in deploy script — Q3 2026 (current quarter). 1 day work.", tc: "text-red-700" },
            { item: "TD-03 — HPS model v2 hardcoded KBLI weights", severity: "LOW", impact: "When new KBLI added or weight needs updating: code change required. Should be config-driven.", plan: "Refactor to config file — bundled into next HPS model update (Q1 2027).", tc: "text-muted-foreground" },
            { item: "TD-04 — Daily Briefing generator has no A/B test framework", severity: "LOW", impact: "Cannot test briefing format variations without manual switching. Slow iteration on briefing quality.", plan: "Add feature flag system — Q1 2027 (needed before NLQ launch anyway).", tc: "text-muted-foreground" },
            { item: "TD-05 — Mobile app does not sync offline queue on network restore", severity: "MEDIUM", impact: "Pain point data collected offline may sync in wrong order if multiple offline sessions.", plan: "Add timestamp-based queue ordering — Q3 2026 (Hendra Jr. patching now).", tc: "text-orange-700" },
            { item: "TD-06 — No API rate limiting on klien-facing endpoints", severity: "HIGH", impact: "A misconfigured klien integration or malicious actor could degrade API for all users.", plan: "Add Redis rate limiting — Q3 2026. 2 days work. PRIORITY.", tc: "text-red-700" },
            { item: "TD-07 — Trust Score cache TTL too long (24h)", severity: "MEDIUM", impact: "Blacklist change takes up to 24h to reflect in Trust Score. Our SLA says 3h. Gap.", plan: "Reduce TTL to 3h, add event-driven invalidation for blacklist changes — Q3 2026.", tc: "text-orange-700" },
            { item: "TD-08 — No test coverage for NLQ entity extraction", severity: "HIGH (pre-launch)", impact: "NLQ entity extraction untested — regression risk when adding new KBLI synonyms. Must fix before October launch.", plan: "Write test suite — 5 days. Hendra Jr. allocating September 2026.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.item} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.item}</p>
                <span className={`text-[7px] font-mono shrink-0 font-bold ${r.tc}`}>{r.severity}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Impact: {r.impact}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Plan: {r.plan}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Technical debt register reviewed monthly (Hendra + Hendra Jr., last Friday of month). Principle: no new feature ships in the same week a HIGH severity TD item is overdue. TD-06 (API rate limiting) and TD-07 (Trust Score cache TTL) are Q3 2026 priorities. Hendra Jr.'s self-assessment: 'Our debt level is acceptable for our stage. We have 2 HIGH items that need Q3 resolution — both are infrastructure risk, not feature risk. I sleep fine at night about TD-03 and TD-04.'</p>
      </div>

      {/* Source Coverage Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5 text-primary" /> COVERAGE ROADMAP — Roadmap Ekspansi Cakupan Sumber Data MJP dari 312 ke 450+ Sumber: BUMN, Portal Swasta, dan Sumber Internasional — Dengan Estimasi ROI per Kategori Sumber
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Sumber kategori</th>
                  <th className="p-1 text-center">Current</th>
                  <th className="p-1 text-center">Target</th>
                  <th className="p-1 text-center">Blocker</th>
                  <th className="p-1 text-center">ROI</th>
                  <th className="p-1 text-left">Timeline</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPSE Pemerintah (APBN/APBD)", "312", "320", "Few missing regencies", "Medium", "Q3 2026"],
                  ["BUMN (procurement portals)", "12", "62", "JS rendering blocks v3 crawler — needs v4", "HIGH — Rp 47T BUMN procurement", "Q2 2027 (v4 crawler)"],
                  ["Otorita IKN portal", "1", "3", "IKN expanding to new sub-portals", "HIGH — IKN PSN growth", "Q4 2026"],
                  ["KPBU (PPP projects)", "0", "8", "KPBU portal has API (requires registration)", "Medium — limited BUJK scope", "Q1 2027"],
                  ["Material price indices (BPS BIHK)", "0", "3", "Manual download — needs parse automation", "Medium — improves HPS model", "Q3 2026 (2 days work)"],
                  ["Peraturan Daerah (local regulation)", "0", "34", "34 provincial JDIH portals inconsistent", "Low per source, high aggregate", "Q3 2027 (post-Series A)"],
                  ["DJBC (customs data for material import)", "0", "1", "DJBC API — requires formal application", "High for MEP HPS model", "Q4 2026 (application submitted)"],
                  ["ADB/World Bank project tenders", "0", "2", "International portals, English-language", "Low for current klien base", "2027 (export vertical prerequisite)"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${row[4] === "HIGH — Rp 47T BUMN procurement" || row[4] === "HIGH — IKN PSN growth" ? "bg-amber-50/30" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-primary font-bold">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 font-bold ${row[4].includes("HIGH") ? "text-orange-700" : "text-muted-foreground"}`}>{row[4]}</td>
                    <td className="p-1 text-muted-foreground">{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200">
            <p className="text-[9px] font-bold text-amber-700">Highest priority expansion: BUMN (62 portals, Rp 47T procurement)</p>
            <p className="text-[8px]">62 BUMN have active construction procurement portals. Currently: only 12 integrated (those with static HTML pages). The 50 remaining use JS-rendered portals that MJP's v3 crawler can't parse. v4 crawler (headless browser tier) is the unlock — estimated Rp 8–12jt/month additional infra cost but unlocks Rp 47T in procurement intelligence. This is the highest single-source ROI opportunity in MJP's pipeline.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Coverage roadmap drives Hendra Jr.'s Q3 2026 infrastructure priorities. DJBC application (filed Q2 2026) and BPS BIHK automation (2 days work) are quick wins this quarter. BUMN v4 crawler is the major investment — scoped for post-Series A budget. Hendra Jr.: 'At 312 sources, we're covering ~85% of government procurement value. At 450 sources (including 62 BUMN): we'd cover ~97%. That last 12% has disproportionate value because BUMN tenders are typically larger and less competitive than APBD tenders.'</p>
      </div>

      {/* Data Quality Assurance Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" /> DATA QA FRAMEWORK — Kerangka Jaminan Kualitas Data MJP: Bagaimana Hendra Jr. Memastikan 312 Sumber Menghasilkan Data Bersih — 5 Layer Validasi dan Apa yang Terjadi Saat Data Corrupt Mencapai Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "Layer QA1 — Source health monitoring (real-time)", desc: "Each LPSE source pinged every 4 hours. Response > 10 sec: flagged. HTTP > 400: immediate alert to Hendra Jr. Data output < 50% of 7-day average: anomaly alert (possible source structural change).", metric: "99.1% source uptime detected within 4 hours", tc: "text-primary" },
            { layer: "Layer QA2 — Parse validation (per record)", desc: "Each parsed record validated against schema: required fields (tender title, nilai pagu, KBLI, deadline, LPSE source), type checks, date format, value range (nilai pagu > 0 and < Rp 100T — outlier bound). Records failing validation: quarantine queue, manual review within 24h.", metric: "1.4% of records quarantined/week, 87% released after manual review", tc: "text-blue-700" },
            { layer: "Layer QA3 — Deduplication (cross-source)", desc: "Same tender may appear across multiple LPSE sources (national + regional). Dedup algorithm: exact match on title+LPSE code, fuzzy match on title+nilai pagu+deadline (Levenshtein < 0.15). Duplicate records merged, original source attributed.", metric: "12.3% of raw records are duplicates — removed before database load", tc: "text-orange-700" },
            { layer: "Layer QA4 — Semantic validation (Sari's spot audit)", desc: "Monthly: Sari reviews 50 random tender records from the top 10 KBLI categories. Checks: does the KBLI classification make sense given the tender title and scope description? Misclassifications trigger KBLI parser review.", metric: "KBLI misclassification rate: 2.1% (Q2 2026). Target: < 1% by year-end.", tc: "text-emerald-700" },
            { layer: "Layer QA5 — Klien feedback loop (reactive)", desc: "Klien can flag incorrect data directly from platform ('Report incorrect data' button on any tender or BUJK record). Flagged records reviewed within 8 hours by Hendra Jr. If confirmed error: corrected + klien notified. In 2025: 147 klien data reports. 89 confirmed errors. 58 were klien misinterpretation.", metric: "89 confirmed platform data errors in 2025 (0.0006% of 14.6M records)", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.layer} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.layer}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.metric}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-red-50 border-red-200 mt-1">
            <p className="text-[9px] font-bold text-red-700">What happens when corrupted data reaches a klien:</p>
            <p className="text-[8px]">In 2025: 11 confirmed cases where a data error affected a klien decision or nearly did. Protocol: (1) Hendra Jr. corrects data within 2 hours. (2) Hendra notifies klien directly (WA) within 4 hours. (3) If klien took action based on error: Sari drafts a corrective briefing. (4) Hendra logs to TD register for root cause fix. (5) If the error was in an L1 alert: monthly error rate tracked and published in internal QA report. No errors have resulted in a formal klien complaint — proactive notification prevents escalation.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">5-layer QA framework was designed after a Q2 2023 incident: a KBLI misclassification caused 14 klien to receive a tender alert for a scope outside their competency. Klien confusion but no material harm. The incident led to Layers QA3 and QA4 being added (previously only QA1, QA2, and QA5 existed). Hendra Jr.: 'Data quality is the foundation of every feature. A klien who trusts our Trust Score for a Rp 1T consortium decision trusts it because we've never given them a reason not to. Each data error is a trust withdrawal from an account we spent years building.'</p>
      </div>

      {/* Infrastructure Cost Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CloudCog className="h-3.5 w-3.5 text-primary" /> INFRA ECONOMICS — Ekonomi Infrastruktur MJP: Breakdown Biaya Teknis per Bulan, Apa yang Paling Mahal, dan Bagaimana Biaya Ini akan Berubah Saat MJP Tumbuh dari 487 ke 3.000 Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Komponen infrastruktur</th>
                  <th className="p-1 text-center">Biaya/bulan (2026)</th>
                  <th className="p-1 text-center">Scaling behavior</th>
                  <th className="p-1 text-left">Hendra Jr.'s note</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["PostgreSQL + Supabase (DB)", "Rp 680k", "Step-function (+Rp 400k at 5M records)", "At 5M records currently. BUMN expansion triggers first step-up."],
                  ["Crawling infra (312 sources, concurrent)", "Rp 1.2jt", "Linear with sources (+Rp 4k/source/month)", "BUMN v4 crawler will add Rp 800k-1.2jt when launched (62 sources × Rp 15-20k/source headless browser cost)."],
                  ["LLM API (OpenAI GPT-4o)", "Rp 2.8jt", "Linear with usage (tokens)", "NLQ v1 launch will increase LLM costs 3-4×. Estimated Rp 8-11jt/month post-NLQ v1 launch. MJP-LLM (2028) reduces this 60%."],
                  ["Object Storage (photos, PDF)", "Rp 340k", "Linear with data volume", "Pain point photos + generated PDFs. Growing 12% MoM. Not material for 18 months."],
                  ["WhatsApp Business API", "Rp 890k", "Linear with message volume", "487 klien × avg 3 WA/day × 30 days = 43k messages/month. At 3.000 klien: Rp 5.5jt/month."],
                  ["Email delivery (SES)", "Rp 120k", "Linear — very low cost", "Volume: 14k/month (daily briefings). At 3.000 klien: Rp 740k/month. Email is cheapest delivery channel."],
                  ["Hosting + CDN (Replit/cloud)", "Rp 1.1jt", "Step-function", "Current compute handles <600 concurrent users. Next step-up at > 1.000 concurrent."],
                  ["Total infrastructure", "Rp 7.13jt", "See scaling notes", "Monthly infra = 4.9% of subscription revenue (Rp 146jt). Healthy margin profile."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${i === 7 ? "font-bold bg-muted/10" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className={`p-1 text-center ${i === 7 ? "text-primary" : "text-muted-foreground"}`}>{row[1]}</td>
                    <td className="p-1 text-center text-blue-700">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Infrastructure cost scaling to 3.000 klien: Total infra ~Rp 24–28jt/month (3.4× increase for 6.2× klien growth). Infrastructure cost as % of revenue at 3.000 klien (est. Rp 900jt/month): 2.7–3.1%. Even better margin profile at scale. Largest scaling risk: LLM API cost post-NLQ (Hendra Jr.'s primary cost concern). Mitigation plan: MJP-LLM fine-tuning (2028) reduces reliance on GPT-4o. At 3.000 klien with MJP-LLM: LLM cost drops back to Rp 3–4jt/month despite 6× more users. This is the cost thesis for the in-house model investment.</p>
      </div>

      {/* Crawler Architecture Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-primary" /> CRAWLER ARCHITECTURE — Arsitektur Crawler MJP: Bagaimana 312 Sumber Dikrawl Secara Paralel Tanpa Memblokir Satu Sama Lain — Desain Antrian, Retry Logic, dan Cara Sistem Bertahan Saat LPSE Berubah Struktur HTML-nya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { component: "C1 — Source Registry (the 'what to crawl' layer)", desc: "312 sources registered with metadata: URL, LPSE version (v3/v4/v5), crawl frequency (every 15–60 min), parser type (HTML/API/headless browser), and SLA tier (L1 < 8min, L2 < 4h, L3 daily). Frequency is configurable per source — LPSE Pusat (highest tender volume) is polled every 15 min. A small kabupaten LPSE with 3 tenders/month is polled every 60 min.", tc: "text-primary" },
            { component: "C2 — Priority Queue (the 'when to crawl' layer)", desc: "Crawl jobs enter a priority queue. Priority factors: (1) Source SLA tier (L1 sources preempt L2 and L3), (2) Time since last successful crawl (sources not crawled in 30% of their scheduled interval are bumped to high priority), (3) Alert pending from this source (if a klien's KBLI alert is pending and this source hasn't returned yet: preempt). Queue is processed by 8 concurrent worker threads.", tc: "text-blue-700" },
            { component: "C3 — Parser Engine (the 'what to extract' layer)", desc: "3 parser types: (1) HTML static parser (80% of sources — standard LPSE structure, regex + CSS selectors), (2) Headless browser parser (12% — sources with JavaScript-rendered content, BUMN portals), (3) API parser (8% — sources with formal API, e.g. LKPP SPSE v4 API). Parser failure → automatic retry (3 attempts) → fallback to 6-hour rescan → alert to Hendra Jr. if source silent > 24h.", tc: "text-orange-700" },
            { component: "C4 — Change Detection (the 'is this new?' layer)", desc: "Every crawl result is hashed. Hash compared to last crawl hash. If identical: no processing (saves compute). If different: diff computed — new tenders extracted, updated tenders flagged, closed tenders archived. Only net-new tenders trigger the alert pipeline. This prevents re-alerting klien for the same tender across multiple crawl cycles.", tc: "text-emerald-700" },
            { component: "C5 — HTML Structure Change Detection (the 'LPSE broke their website' layer)", desc: "When a new LPSE version is deployed by the regional government, the HTML structure often changes without notice. C5 monitors expected field locations (tender title, HPS value, deadline) per source. If an expected field is missing in > 5 consecutive crawls: Hendra Jr. is alerted. He has 24h SLA to update the parser. In 2025: 14 such events across 312 sources. Avg Hendra Jr. fix time: 3.2h.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.component} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.component}</p>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Crawler architecture is Hendra Jr.'s most sophisticated engineering work. The system processes 312 sources × avg 4 crawls/hour = 1.248 crawl jobs/hour, 24/7. In 2025: 10.6M successful crawl executions. Net-new tenders extracted: 847.000. Tenders matched to at least one klien KBLI profile: 412.000 (49%). Tenders that triggered a klien alert: 287.000 (34%). The 34% is not a failure — it's precision. Not every matched tender warrants an L1 alert; many are captured in the Daily Briefing instead. Hendra Jr.: 'The crawler is boring. It runs silently, all day, every day. The most important feature in MJP is the one nobody thinks about.'</p>
      </div>

      {/* BUMN Procurement Portal — Next Frontier */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Building className="h-3.5 w-3.5 text-primary" /> BUMN FRONTIER — Portal Pengadaan BUMN: Frontier Terbesar yang Belum Dikrawl MJP — 63 BUMN dengan Portal Pengadaan Sendiri, Tantangan Teknis, dan Mengapa Ini Bernilai Lebih dari 50 LPSE Kabupaten Digabung
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "63", label: "BUMN with independent procurement portals (PLN, Pertamina, WIKA, etc.)", tc: "text-primary" },
              { stat: "Rp 847T", label: "Estimated total BUMN procurement value/year (BKPM 2025 data)", tc: "text-orange-700" },
              { stat: "12", label: "BUMN portals currently crawled by MJP (partial coverage)", tc: "text-blue-700" },
              { stat: "51", label: "BUMN portals remaining to add — Hendra Jr.'s Q3 2026 target", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-sm font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { challenge: "Why BUMN portals are harder to crawl than LPSE", detail: "LPSE is standardized by LKPP — all LPSE portals share the same base software (SPSE). BUMN portals are custom-built: PLN uses SAP Ariba, Pertamina uses a custom Oracle system, WIKA uses an in-house portal. Each requires a custom parser. Additionally, BUMN portals sometimes require vendor registration to view full tender details — Hendra Jr. uses registered vendor credentials (a BUJK has granted MJP read access to their vendor account for research purposes).", tc: "text-orange-700" },
            { challenge: "Why BUMN coverage matters more per portal than LPSE", detail: "A single BUMN tender can have HPS of Rp 100M–500M (vs. typical LPSE average Rp 8.7jt). J9 klien who win BUMN tenders generate disproportionate revenue. MJP's 12 currently-crawled BUMN portals generate 8% of total alert volume but 31% of Enterprise klien's self-reported 'most valuable alerts.' The revenue concentration per BUMN alert is 12× that of an LPSE alert.", tc: "text-primary" },
            { challenge: "BUMN v4 crawler roadmap (Hendra Jr., Q3–Q4 2026)", detail: "Phase 1 (Q3 2026): Add 20 highest-priority BUMN portals (by tender volume and MJP klien requests). Phase 2 (Q4 2026): Add remaining 31. Total investment: 6–8 weeks of Hendra Jr.'s engineering time + H2 backend engineer support. Expected incremental alert volume: +23% (new BUMN tenders). Expected impact on Enterprise klien engagement: +18% open rate (BUMN alerts are the highest-engagement alert type).", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.challenge} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.challenge}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUMN portal coverage is the single-highest-impact infrastructure investment available to MJP in 2026–2027. It requires no new product features, no new team members, and no regulatory approval — only Hendra Jr.'s engineering time. The incremental value is immediate: Enterprise klien who currently hunt BUMN tenders manually would receive automated alerts for the first time. Reza's sales impact: BUMN coverage is the most frequently requested feature in Enterprise renewal conversations. 'BUMN coverage' is Reza's current answer to 'what's coming that makes the Enterprise tier even more valuable?' After BUMN v4 launch: that answer becomes 'it's already here.'</p>
      </div>

      {/* R96: Crawler Infrastructure Cost Optimization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Building className="h-3.5 w-3.5 text-primary" /> CRAWLER INFRASTRUCTURE COST OPTIMIZATION — Model Biaya Infrastruktur per Sumber Data, Trade-off antara Frekuensi Crawl dan Biaya Server, dan Rencana Hendra Jr. untuk Scale ke 3.000 Klien Tanpa Linear Cost Scaling
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Resource Category</th>
                  <th className="p-1 text-center">Saat ini (487 klien)</th>
                  <th className="p-1 text-center">Projected (1.500 klien)</th>
                  <th className="p-1 text-center">Projected (3.000 klien)</th>
                  <th className="p-1 text-center">Scaling type</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Crawler compute (VPS/cloud)", "Rp 1.8jt/bln", "Rp 2.4jt/bln", "Rp 3.2jt/bln", "SUB-LINEAR", "text-emerald-700"],
                  ["Database storage (PostgreSQL)", "Rp 400k/bln", "Rp 900k/bln", "Rp 1.8jt/bln", "LINEAR", "text-orange-700"],
                  ["API delivery (notifications)", "Rp 340k/bln", "Rp 890k/bln", "Rp 1.7jt/bln", "LINEAR", "text-orange-700"],
                  ["PDF generation compute", "Rp 180k/bln", "Rp 320k/bln", "Rp 500k/bln", "SUB-LINEAR", "text-emerald-700"],
                  ["Backup & redundancy", "Rp 250k/bln", "Rp 500k/bln", "Rp 750k/bln", "LINEAR", "text-orange-700"],
                  ["TOTAL INFRA COST", "Rp 2.97jt/bln", "Rp 5.01jt/bln", "Rp 7.95jt/bln", "SUB-LINEAR overall", "text-emerald-700"],
                ].map((row, i) => (
                  <tr key={row[0]} className={`border-b hover:bg-muted/20 ${i === 5 ? "bg-primary/5 font-bold" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-primary">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center text-[7px] font-bold ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Why crawler compute scales sub-linearly: data is shared, not per-klien", detail: "MJP crawls LPSE regardless of whether 487 or 3.000 klien are subscribed — the source data is the same. More klien = same crawl, more efficient cost-per-klien. At 3.000 klien, infra cost per klien = Rp 2.650/bln vs Rp 6.094/bln today. Gross margin expands naturally as klien base grows without any engineering optimization needed.", tc: "text-emerald-700" },
            { insight: "Database storage adalah linear cost yang perlu dioptimasi", detail: "PostgreSQL storage scales linearly karena setiap tender, BUJK record, dan notification history disimpan per-entry (tidak deduplicated per-klien). Hendra Jr. mempertimbangkan 'hot/cold storage' architecture untuk Q1 2027: data >12 bulan ke cold storage (3x cheaper), hanya 12 bulan terakhir di hot DB. Estimasi savings: Rp 600k/bln pada 3.000 klien.", tc: "text-orange-700" },
            { insight: "Implied gross margin at 3.000 klien dari infrastructure alone", detail: "At 3.000 klien × Rp 399k/bln average = Rp 1.197jt ARR/bln. Infra cost Rp 7.95jt/bln = 0.66% of revenue. Bahkan dengan Sari+apprentice salary (Rp 25jt/bln) + Hendra Jr. (Rp 18jt) + full team: total COGS tetap di bawah 28% of revenue. Gross margin 72%+ di skala 3.000 klien — Hendra's Unit Economics thesis validated by projections.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Infrastructure cost model dibuat Hendra Jr. setelah investor pertama bertanya: 'Apakah cost Anda naik linier dengan klien?' Hendra Jr. tahu jawabannya sub-linier tapi belum bisa membuktikannya dengan angka. Model ini dibangun dalam 3 hari — menggunakan actual AWS billing history (Hendra Jr. screenshots semua invoice sejak 2022) dan projected forward dengan konservatif. Hendra Jr.: 'Ini adalah slide favorit saya di deck investor. Satu grafik yang menunjukkan revenue naik linier dan infra cost naik sub-linier. Dua garis yang diverge. Itu adalah visual proof of a scalable business.' Model di-update setiap quarter berdasarkan actual billing vs projected.</p>
      </div>

      {/* R97: Ethical Crawling & Legal Compliance Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> ETHICAL CRAWLING {"&"} LEGAL COMPLIANCE FRAMEWORK — Bagaimana MJP Memastikan Crawling Dilakukan Secara Etis dan Legal: robots.txt Policy, Rate Limiting, Data Source Attribution, dan Response Jika Server Sumber Mengirim Cease{"&"}Desist
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { rule: "R1: robots.txt compliance — mandatory untuk semua sources", detail: "Hendra Jr. memeriksa robots.txt setiap source sebelum crawling. Jika source melarang crawling via robots.txt: MJP tidak crawl — period. Sejauh ini: semua government sources (LPSE, LPJK, JDIH, BNSP) tidak melarang crawling karena mereka adalah platform publik yang by design harus accessible.", exception: "Exception: jika source update robots.txt post-crawl untuk block. Alert ke Hendra Jr. dalam 24 jam, crawling suspended immediately pending legal review.", tc: "text-emerald-700" },
            { rule: "R2: Rate limiting — MJP tidak melebihi 1 request per 3 detik per source", detail: "Rate limit ini dipilih berdasarkan 'tidak mengganggu normal traffic' principle. Government LPSE servers sering understaffed dan fragile — high rate crawling bisa slow down the server for actual users (BUJK trying to view tenders). Hendra: 'Kita mendapat data dari infrastruktur publik. Kita punya tanggung jawab untuk tidak membebani infrastruktur itu.'", exception: "Untuk sources yang sering timeout: adaptive rate limiting — mundur ke 1 request per 10 detik jika error rate >5%.", tc: "text-primary" },
            { rule: "R3: Data attribution — setiap item mencantumkan sumber dan tanggal crawl", detail: "Setiap tender, regulasi, dan BUJK record yang ditampilkan kepada klien menampilkan: 'Source: [LPSE Provinsi X], crawled [date]'. Ini adalah transparency feature AND legal protection: MJP tidak claim data sebagai milik sendiri.", exception: "Agregasi dan analysis (HPS estimate, Trust Score, RICE score) adalah milik MJP — bukan raw data re-publishing.", tc: "text-blue-700" },
            { rule: "R4: Personal Data — tidak crawl atau store data pribadi individual", detail: "SKK holders: MJP hanya crawl dan store nama perusahaan, nomor sertifikat, jenjang, dan jabatan kerja. Tidak store alamat rumah, nomor KTP, atau informasi kontak personal. BNSP public registry dipublish untuk professional verification purposes — MJP menggunakannya sesuai intended purpose.", exception: "UU PDP compliance (berlaku 2024): Hendra melakukan PDP compliance review Q4 2024 dengan konsultan hukum IT. Conclusion: MJP's data handling is compliant with UU PDP as of current architecture.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.rule} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.rule}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Exception/Note: {r.exception}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Legal compliance framework tidak diminta oleh investor atau regulator — Hendra membangunnya secara proaktif setelah membaca tentang beberapa startup data intelligence di US yang mendapat cease-and-desist dari sources yang di-crawl tanpa permission. Hendra: 'MJP bergantung pada akses ke public data. Jika salah satu source utama kita block us, itu adalah existential risk. Prevention adalah jauh lebih murah dari remediation.' Legal review dilakukan setahun sekali oleh law firm IT yang Hendra engage per-project basis. Q4 2026: review akan mencakup implikasi UU AI (jika disahkan) dan update UU PDP implementasi guidelines.</p>
      </div>

      {/* R98: Data Source Reliability Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" /> DATA SOURCE RELIABILITY SCORECARD — Penilaian Internal MJP terhadap Setiap Sumber Data: Uptime, Data Freshness, Structural Stability, dan Historical Incident Score dari 2022 hingga 2026
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Source</th>
                  <th className="p-1 text-center">Uptime 2025</th>
                  <th className="p-1 text-center">Schema stability</th>
                  <th className="p-1 text-center">Incident count</th>
                  <th className="p-1 text-center">Reliability grade</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPSE (aggregate)", "97.4%", "UNSTABLE (4 changes)", "6", "B+", "text-orange-700"],
                  ["LPJK/SIJAPK", "99.1%", "STABLE (1 change)", "1", "A", "text-emerald-700"],
                  ["JDIH (regulasi)", "94.2%", "UNSTABLE (3 changes)", "8", "B", "text-orange-700"],
                  ["BNSP portal", "99.7%", "VERY STABLE (0 changes)", "0", "A+", "text-emerald-700"],
                  ["ijintender.co.id", "88.4%", "UNSTABLE (6 changes)", "11", "C+", "text-red-700"],
                  ["Peraturan.go.id", "96.8%", "STABLE (2 changes)", "2", "A-", "text-emerald-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[1]) >= 99 ? "text-emerald-700" : parseFloat(row[1]) >= 96 ? "text-orange-700" : "text-red-700"}`}>{row[1]}</td>
                    <td className={`p-1 text-center text-[7px] ${row[2].startsWith("VERY") ? "text-emerald-700" : row[2].startsWith("STABLE") ? "text-blue-700" : "text-red-700"}`}>{row[2]}</td>
                    <td className={`p-1 text-center ${parseInt(row[3]) === 0 ? "text-emerald-700 font-bold" : parseInt(row[3]) > 5 ? "text-red-700 font-bold" : "text-orange-700"}`}>{row[3]}</td>
                    <td className={`p-1 text-center font-bold ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "BNSP A+: most reliable source MJP uses — and most valuable for SKK vertical", detail: "BNSP portal memiliki 0 downtime incidents dan 0 schema changes dalam 4 tahun. This is unusual for a government portal — most change schema frequently during 'system upgrades'. BNSP stability is likely because it's a read-heavy portal (certificates are viewed, not submitted) with lower traffic pressure than LPSE.", tc: "text-emerald-700" },
            { insight: "ijintender.co.id C+: least reliable, most volatile — strategic risk", detail: "11 schema changes dan 88.4% uptime: worst source in MJP's stack. Yet valuable because no other source has competitor price bid data. Hendra Jr.'s mitigation: graceful degradation — if ijintender down or schema broken, MJP shows 'Price data temporarily unavailable' rather than showing stale/wrong data.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Source reliability scorecard adalah Hendra Jr.'s operational bible. Every time a source degrades, he updates the scorecard and reviews whether the source's grade warrants architectural changes. Sources with grade B or below get: (1) automated health monitoring (ping every 15 minutes vs 4 hours for A-grade sources). (2) More aggressive fallback caching (48 hours vs 24 hours). (3) Schema change alert emails to Hendra Jr.'s personal phone — not just Slack. Hendra: 'Kita sangat bergantung pada infrastructure yang tidak kita kontrol. Semakin buruk track record sebuah source, semakin paranoid kita harus tentang monitoring dan backup.'</p>
      </div>

      {/* R99: Crawler Infrastructure Disaster Recovery */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ServerCrash className="h-3.5 w-3.5 text-primary" /> CRAWLER INFRASTRUCTURE DISASTER RECOVERY — 4 Skenario Kegagalan yang Paling Ditakutkan Hendra Jr., Bagaimana Setiap Skenario Akan Muncul, dan Recovery Protocol yang Telah Dilatih
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { scenario: "DR-1: IP block dari LPSE (semua crawler diblok serentak)", likelihood: "LOW but HIGH impact", trigger: "Rate limit breach, automated bot detection, atau LPSE system upgrade yang include aggressive blocking.", detection: "Alert dalam 15 menit: crawler failure rate jumps from <0.1% to > 80% dalam 5 menit window.", recovery: "Protocol: (1) Immediately switch to backup residential IP pool (pre-paid, 50 IPs). (2) Reduce crawl frequency to 20% of normal untuk 48 jam. (3) Contact LPSE LPSE helpdesk if block persists — MJP registered as institutional user. (4) If unresolved in 72 jam: emergency data purchase from backup data vendor. Estimated downtime: 2–6 hours for initial recovery, full recovery 24–48 hours.", tc: "text-red-700" },
            { scenario: "DR-2: Database corruption atau partial data loss", likelihood: "VERY LOW (PostgreSQL with WAL + daily backup)", trigger: "Infrastructure provider failure, botched migration, or hardware failure.", detection: "Automated data integrity checks run every hour. Alert triggers if row count drops > 5% vs expected trend.", recovery: "Point-in-time recovery (PITR) to last clean backup — typically < 1 hour data loss. Full recovery from daily backup: 2–4 hours. RTO target: < 4 hours. RPO target: < 1 hour.", tc: "text-orange-700" },
            { scenario: "DR-3: Regulatory data source takeover atau significant restructure", likelihood: "MEDIUM — JDIH and Peraturan.go.id have undergone structural changes", trigger: "Government portal migration, domain change, or API requirement introduction.", detection: "Schema diff monitor: alerts Hendra Jr. if HTML structure changes > 30% in any single crawl run.", recovery: "Sari maintains manual backup protocol: JDIH critical regulations manually reviewed and re-entered into Knowledge Registry if crawl fails for > 7 days. Long-term: maintain raw PDF archive of all downloaded regulations as ultimate fallback.", tc: "text-orange-700" },
            { scenario: "DR-4: Platform DDoS atau significant traffic attack", likelihood: "LOW — MJP not high-profile enough for targeted attack", trigger: "Competitor sabotage (extreme case), automated scan traffic, or botnet collateral.", detection: "Cloudflare (CDN layer) handles initial spike; alerts at 10x normal traffic. Hendra Jr. manual response protocol if Cloudflare auto-mitigation insufficient.", recovery: "Cloudflare Rate Limiting already configured. Emergency: enable 'under attack mode' in Cloudflare — shows CAPTCHA for all visitors. Platform stays up but degraded. Recovery: typically automatic after attack subsides.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.scenario}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.likelihood}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Detection: {r.detection}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Recovery: {r.recovery}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Disaster recovery planning dimulai setelah DR-3 almost became reality: Q1 2025, JDIH migration caused 11-day crawl failure — the longest data gap in MJP's history. 3 klien churned in that period, citing 'regulasi tidak update.' Post-incident: Hendra Jr. spent 2 weeks building proper DR protocols for each scenario. Before this: MJP had implicit DR ('we'd figure it out'). After: explicit documented protocols with detection thresholds, step-by-step recovery playbooks, and designated decision-makers. Hendra: 'Platform yang tidak punya disaster recovery plan bukan platform yang belum diuji. Platform yang belum diuji itu seperti jembatan yang belum pernah ada beban berat. Kamu tidak tahu apakah itu akan jatuh sampai ada truk yang melintas.'</p>
      </div>

      {/* R100: Data Freshness SLA per Source */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> DATA FRESHNESS SLA PER SOURCE — Komitmen MJP kepada Klien tentang Seberapa Baru Data yang Ditampilkan: Target SLA, Pengukuran Aktual, dan Mengapa Beberapa Sumber Sengaja Di-crawl Lebih Jarang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Source</th>
                  <th className="p-1 text-center">Crawl frequency</th>
                  <th className="p-1 text-center">SLA target</th>
                  <th className="p-1 text-center">Actual (Q2 2026)</th>
                  <th className="p-1 text-center">Client-facing label</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPSE tender listings", "Every 2 hours", "< 4 hours", "2.8 hours avg", "LIVE — updated 2–4 hours", "text-emerald-700"],
                  ["LPJK BUJK registry", "Every 6 hours", "< 12 hours", "8.4 hours avg", "FRESH — updated every 6–12 hours", "text-emerald-700"],
                  ["BNSP SKK registry", "Daily (2am)", "< 26 hours", "24.1 hours avg", "DAILY — updated nightly", "text-blue-700"],
                  ["JDIH regulasi", "Every 4 hours", "< 8 hours", "6.2 hours avg", "FRESH — updated every 4–8 hours", "text-emerald-700"],
                  ["ijintender.co.id prices", "Every 8 hours", "< 24 hours", "9.3 hours avg (when up)", "DAILY — updated 2–3x daily when available", "text-orange-700"],
                  ["Knowledge Registry (Sari)", "Manual, 15+/month", "< 48 hours for CRITICAL regulations", "31 hours avg for CRITICAL tier", "EDITORIAL — curator-verified before publish", "text-blue-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold text-[7px]">{row[0]}</td>
                    <td className="p-1 text-center text-[7px]">{row[1]}</td>
                    <td className={`p-1 text-center text-[7px] font-bold ${row[5]}`}>{row[2]}</td>
                    <td className={`p-1 text-center text-[7px] font-bold ${row[5]}`}>{row[3]}</td>
                    <td className="p-1 text-muted-foreground text-[6px]">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">Why not crawl everything every 15 minutes?</p>
            <p className="text-[7px] text-muted-foreground">Rate limiting and infrastructure cost. LPSE has implicit rate limits: crawl too fast = IP block. Hendra Jr.'s calculation: optimal crawl frequency is the minimum that meets klien SLA without triggering defensive responses from sources. LPSE every 2 hours satisfies 95% of klien use cases (tender announcements are rarely last-minute critical). BNSP daily is sufficient because SKK changes are batch-processed by BNSP weekly. ijintender 3x/day is aggressive given their reliability grade — but price data staleness would be most visible to klien, justifying the risk.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data freshness SLA adalah competitive claim yang MJP mempertahankan dengan measurement. Hendra Jr. runs monthly freshness audit: pull 100 random data points, check timestamp, compare to actual source. If actual lag exceeds SLA: ticket opened, root cause analyzed. Q2 2026 audit: all sources met SLA with LPSE performing best (2.8 hours vs 4-hour target). ijintender performance: 9.3 hours average but 88.4% uptime means 11.6% of time data is stale beyond SLA. Client-facing label 'when available' discloses this. Transparency about limitations builds more trust than inflated freshness claims that sometimes fail. Hendra Jr.: 'Saya lebih suka klien tahu bahwa data ijintender kadang tidak update daripada mereka discover sendiri bahwa angka yang kita show adalah stale. Surprise dalam data quality adalah churn risk yang paling tinggi.'</p>
      </div>

      {/* R101: New Source Onboarding Process */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> NEW SOURCE ONBOARDING PROCESS — Bagaimana MJP Menambahkan Sumber Data Baru: 6-Step Process dari Discovery hingga Production, Average Timeline, dan Mengapa Onboarding Sumber Baru Butuh Jauh Lebih Lama dari yang Orang Perkirakan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { step: "Step 1: Discovery & feasibility (1–3 hari)", desc: "Identifikasi source: tersedia secara publik? robots.txt review: apakah crawling diizinkan? Rate limit analysis: berapa request per menit yang aman? Data structure assessment: HTML scraping atau API? Authentication required?", owner: "Hendra Jr.", tc: "text-primary" },
            { step: "Step 2: Legal & compliance review (3–7 hari)", desc: "Terms of Service review: apakah ada explicit prohibition on data aggregation? Data Privacy check: apakah data yang di-crawl mengandung PII yang dilindungi UU PDP? Sari reviews jika source adalah regulatory document platform (different compliance requirements).", owner: "Hendra + Sari (regulatory sources)", tc: "text-orange-700" },
            { step: "Step 3: Prototype crawler (2–5 hari)", desc: "Build minimal crawler for 1 data type from source. Test against 100 sample records. Validate data quality: completeness, accuracy, consistency. Identify edge cases and anomalies that will need special handling.", owner: "Hendra Jr.", tc: "text-blue-700" },
            { step: "Step 4: Schema integration & mapping (3–7 hari)", desc: "Map source data schema to MJP's internal schema. Design transformation logic. Handle missing fields, different date formats, encoding issues. Most complex step for sources with non-standard data structures.", owner: "Hendra Jr.", tc: "text-blue-700" },
            { step: "Step 5: QA & validation (5–14 hari)", desc: "Run full crawler against complete source. Compare output vs manual verification of 200+ records. Check for duplicate detection, freshness SLA feasibility, failure handling. Load testing untuk rate limits.", owner: "Hendra Jr. + Hendra (business logic review)", tc: "text-emerald-700" },
            { step: "Step 6: Production launch & monitoring setup (1–3 hari)", desc: "Deploy to production with: health monitoring alerts, schema change detection, error rate dashboards. Add to Data Source Reliability Scorecard. 30-day hypercare period: Hendra Jr. reviews source health daily.", owner: "Hendra Jr.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.step}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>Owner: {r.owner}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">New source onboarding average: 15–39 hari total end-to-end. Most people assume adding a new data source is a matter of hours — 'just scrape it.' Reality: Step 4 (schema integration) alone averages 5+ days for complex sources because MJP's internal data model has been carefully designed for consistency, and forcing a new source to fit that model without breaking existing queries is non-trivial engineering work. Step 5 (QA) is the most often underestimated: discovering that a crawler correctly extracts data in 98% of cases but fails in 2% of edge cases (which are often the most important: tenders with special characters in names, BUJK with unusual registration formats) is only possible through thorough testing at scale. Hendra Jr.: 'Setiap source yang masuk production dengan baik adalah source yang tidak akan menyebabkan incident 3 bulan kemudian. Setiap shortcut di Steps 3–5 adalah incident yang ditunda.'</p>
      </div>

      {/* R102: Infrastructure Cost Management */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" /> INFRASTRUCTURE COST MANAGEMENT — Berapa Biaya Menjalankan MJP's Data Infrastructure per Bulan: Breakdown Cloud Cost, Optimisasi yang Sudah Dilakukan, dan Target Cost Efficiency untuk 2027
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { component: "Crawler fleet (compute)", cost: "Rp 8.4jt/month", detail: "671 LPSE portals + 4 specialized sources. Tier-1 LPSE crawled every 2 hours (high compute), Tier-3 daily (low). Optimization done: moved from on-demand to spot instances for Tier-3 crawlers (saves 62% for that fleet). Remaining opportunity: intelligent crawl frequency based on source update patterns.", savings_potential: "Additional 20–30% reducible with ML-driven crawl scheduling (Hendra Jr. Q3 2026 project).", tc: "text-primary" },
            { component: "Database storage (PostgreSQL + object store)", cost: "Rp 3.2jt/month", detail: "Core data: 47GB (tender records 5 years, BUJK profiles, SKK data). Object store: 28GB (knowledge registry assets, audit logs, attachments). Growth rate: +4GB/month. At current rate: 2028 storage = ~180GB. Optimization done: cold archive for tender data > 2 years (40% storage reduction). Hot storage only for last 24 months.", savings_potential: "Minimal — storage is already optimized. Cost will scale linearly with data volume.", tc: "text-blue-700" },
            { component: "WhatsApp Business API + SMTP", cost: "Rp 4.1jt/month", detail: "WhatsApp: Rp 3.6jt (2.847 daily digest deliveries × Rp 42/message). SMTP: Rp 480k (email delivery via SendGrid). Primary cost driver: active daily klien count. As klien grows: this cost scales linearly. Optimization: WhatsApp message batching (group alerts vs individual) reduced cost 23% vs naive implementation.", savings_potential: "Limited — variable cost tied to core product delivery. Will scale proportionally with klien growth.", tc: "text-emerald-700" },
            { component: "AI/ML inference", cost: "Rp 2.8jt/month", detail: "NLQ processing (Rp 1.4jt), recommendation engine inference (Rp 0.9jt), HPS estimation (Rp 0.5jt). Cost structure: per-token for LLM-based NLQ, per-inference for ML models. Optimization: response caching for identical NLQ queries saves ~28% on LLM costs.", savings_potential: "30–40% reducible with fine-tuned smaller models (replacing large general LLM for NLQ). Hendra Jr. Q1 2027 project: domain-specific NLQ model training.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.component} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.component}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.cost}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Savings potential: {r.savings_potential}</p>
            </div>
          ))}
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">Total infra COGS: Rp 18.5jt/month · Target 2027: Rp 14jt/month at 1.200 klien</p>
            <p className="text-[7px] text-muted-foreground">Gross margin on infrastructure: currently 97% (Rp 580jt ARR / Rp 18.5jt COGS). Target 2027: maintain {'>'} 95% gross margin even as klien grows 40%. Achievable through: ML-driven crawl optimization + domain-specific NLQ model. The goal: infrastructure cost per klien decreases as we scale (economies of density in data infrastructure).</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Infrastructure cost management adalah monthly discipline yang Hendra Jr. runs — cloud bill review on first Monday of each month. MJP has never had a 'cloud bill surprise' (a common startup horror story) because: (1) all infrastructure has cost alerts set at 120% of expected monthly spend, (2) new features require cost impact analysis before production deploy, (3) Hendra Jr. builds cost modeling into feature design. Cost obsession philosophy: 'Gross margin is a choice, not a destiny. Every Rp that doesn't go to infrastructure goes to product development or team.' Total infra/ARR ratio: 3.2% — best-in-class for a data infrastructure SaaS. Industry average for comparable companies: 8–12%. The difference represents 4–9 percentage points of additional gross margin — which is the compounding advantage of engineering discipline applied consistently over 5 years.</p>
      </div>

      {/* R103: Data Pipeline Incident Postmortems */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ServerCrash className="h-3.5 w-3.5 text-primary" /> DATA PIPELINE INCIDENT POSTMORTEMS — 4 Kejadian Besar yang Menghentikan Data Collection MJP: Root Cause, Downtime Duration, Dampak ke Klien, dan Sistem yang Dibangun untuk Mencegah Recurrence
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { incident: "INC-2022-01: LPSE Jakarta CAPTCHA implementation (8-day partial outage)", desc: "LPSE Jakarta deployed CAPTCHA without announcement. MJP's crawler failed silently — no data from Jakarta LPSE for 8 days before Hendra Jr. noticed via monitoring. 247 klien affected (those monitoring Jakarta tenders).", root_cause: "No alerting for 0-record crawl. Empty crawl result was treated as 'no new tenders' instead of 'crawler failed'.", fix: "Added 'impossibly low result' alert: if any Tier-1 LPSE returns < 3 records in 24-hour window, immediate Hendra Jr. alert. Also added: CAPTCHA bypass via service that Hendra Jr. vetted legally. Recurrence: none.", tc: "text-red-700" },
            { incident: "INC-2023-01: Database migration that corrupted tender-BUJK links (4-hour data integrity issue)", desc: "Schema migration for new Trust Score fields ran on production without transaction wrapper. Partial migration + rollback left 14.200 tender records with null BUJK foreign key. Affect: Trust Score for those tenders showed N/A for 4 hours.", root_cause: "No database migration test on staging that replicated production data volume. Staging had 1.000 records; production had 847.000. Migration was slower than timeout, triggering partial rollback.", fix: "All migrations now run in transactions. Staging database seeded with 100k random records to simulate volume. Migration must complete on staging in < timeout/2 before production deploy.", tc: "text-orange-700" },
            { incident: "INC-2024-01: WhatsApp Business API rate limit breach (2-day degraded delivery)", desc: "MJP added 143 new klien in October 2024 (Reza's best month). WhatsApp API rate limit was per-minute, not per-month. Sudden spike in daily digest delivery breached per-minute limit. 38% of klien received alerts 6–18 hours late for 2 days.", root_cause: "WhatsApp API rate limits poorly documented. MJP assumed per-day limit (which was fine). Actual limit: per-minute concurrent requests.", fix: "Alert delivery now uses exponential backoff queue. Enterprise alerts sent first, then Pro, then Starter. Load distributed across 3-hour window instead of simultaneous batch. Also: WhatsApp API alternative (direct BSP) established as backup.", tc: "text-blue-700" },
            { incident: "INC-2025-01: BNSP website redesign broke SKK crawler (11-day full outage, SKK data)", desc: "BNSP launched new website without notice. HTML structure changed completely. MJP's CSS selector-based SKK crawler: 100% failure. SKK database stopped updating for 11 days.", root_cause: "CSS selector-based scraping is fragile — any website redesign breaks it. MJP had no monitoring for SKK crawler specifically (only LPSE monitoring existed).", fix: "SKK crawler rewritten with semantic HTML parsing + regex fallback (more resilient to layout changes). Also: added SKK-specific monitoring alert. And: accelerated BNSP API negotiation (incident demonstrated fragility of crawler approach). Recurrence: none since rewrite.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.incident} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.incident}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Root cause: {r.root_cause}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Fix: {r.fix}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Incident postmortem culture adalah Hendra Jr.'s engineering legacy at MJP — every incident becomes a learning, every learning becomes a system change, every system change is documented. The 4 incidents above represent MJP's complete history of significant data outages across 5 years of operation. 4 incidents in 5 years: roughly one per year. By industry standards for a data-intensive startup: quite good, though not incident-free (which is unrealistic). Average Time to Detect (TTD): 6.2 hours. Average Time to Resolve (TTR): 18.4 hours. Both metrics improving year-over-year as monitoring systems mature. Hendra Jr.'s principle: 'Postmortem bukan tentang siapa yang salah. Postmortem adalah tentang memahami mengapa sistem gagal dan membuatnya lebih sulit untuk gagal lagi. Blame culture membuat orang bersembunyi. Blameless culture membuat orang jujur tentang apa yang sebenarnya terjadi.'</p>
      </div>

      {/* R104: Data Roadmap 2027 — New Sources and Intelligence Categories */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> DATA ROADMAP 2027 — 5 Sumber Data Baru yang Hendra Jr. Rencanakan untuk Di-onboard Setelah Series A: Estimasi Timeline, Dampak ke Platform, dan Mengapa Urutan Prioritas Ini
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { source: "DR-1: BNSP API (formal)", timeline: "Q1 2027 (if MOU signed Q4 2026)", impact: "Replaces SKK crawler with real-time API. Freshness: 24h → < 1h for SKK data. Legal risk: eliminated (formal agreement vs crawler). Data completeness: 100% of BNSP records (vs current 97.3%). Engineer cost: 2 weeks integration. Annual API cost: Rp 30–80jt (vs Rp 0 for crawler but > in Hendra Jr. maintenance time).", priority: "Highest priority — addresses MJP's most critical single-point data reliability risk.", tc: "text-primary" },
            { source: "DR-2: OSS-RBA (Online Single Submission Risk-Based Approach)", timeline: "Q2 2027", impact: "Business registration data for all Indonesian companies (not just BUJK). Cross-referencing BUJK registration with OSS-RBA would: reveal actual beneficial owners (anti-ghost-company), verify declared business scale, and improve Trust Score financial dimension accuracy.", priority: "HIGH — completes Trust Score V5's financial reliability scoring.", tc: "text-blue-700" },
            { source: "DR-3: PUPR e-monitoring database (infrastruktur proyek)", timeline: "Q2–Q3 2027 (requires government relationship)", impact: "PUPR monitors all ongoing infrastructure projects over Rp 10M. Data: project status, contractor performance, completion percentages, delays. Currently: Trust Score has no post-award performance data. With e-monitoring: Trust Score tracks contractor track record from project execution, not just bid history.", priority: "HIGH — transforms Trust Score from bid-time intelligence to lifecycle intelligence.", tc: "text-emerald-700" },
            { source: "DR-4: BUMN procurement portals (PLN, Pertamina, WIKA, etc.)", timeline: "Q3–Q4 2027", impact: "Access to semi-public procurement from BUMN — currently invisible to MJP's crawler (only LPSE-based government tenders captured). BUMN procurement: estimated Rp 400T/year in construction-related procurement. Adding BUMN portals: potentially doubles MJP's addressable tender universe.", priority: "MEDIUM — significant TAM expansion but complex to implement (each BUMN portal has different format and access policies).", tc: "text-orange-700" },
            { source: "DR-5: Pengadilan (court records for construction disputes)", timeline: "Q4 2027 (longest lead time — requires legal navigation)", impact: "Construction contract dispute records: when BUJK takes another to court (or is taken to court), public records reveal payment disputes, breach of contract history. Currently: Trust Score has no dispute signal. With court data: detect 'serial bad actors' in construction procurement.", priority: "MEDIUM — high value for Trust Score V5 but legal complexity (public records law in Indonesia still evolving on digital access).", tc: "text-primary" },
          ].map((r) => (
            <div key={r.source} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.source}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.timeline}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.impact}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Priority: {r.priority}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data roadmap 2027 adalah Hendra Jr.'s 18-month engineering vision — the first time MJP will have dedicated engineering capacity beyond Hendra Jr. alone (Series A capital enables 3 additional engineers). Current constraint: Hendra Jr. cannot onboard new data sources while also building product features and maintaining existing infrastructure. Series A engineers: one will be dedicated to data infrastructure (DR-1 through DR-3 as primary projects). The prioritization logic: DR-1 (BNSP API) first because it removes existing reliability risk. DR-2 (OSS-RBA) second because it improves existing Trust Score. DR-3 (PUPR e-monitoring) third because it unlocks new Trust Score dimensions. DR-4 and DR-5 are longer-term bets that require either legal relationships or regulatory navigation beyond current capacity. Hendra Jr.: 'Setiap data source baru yang kita onboard adalah dimensi baru dari intelligence yang kita bisa tawarkan. Dalam 18 bulan ke depan: MJP akan punya lebih banyak data tentang konstruksi Indonesia daripada setiap entitas lain, publik maupun swasta.'</p>
      </div>

      {/* R105: Engineering Capacity Model — What Gets Built When */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" /> ENGINEERING CAPACITY MODEL — Bagaimana Hendra Jr. Membagi Waktunya: 4 Kategori Pekerjaan, Trade-off yang Dia Buat Setiap Minggu, dan Mengapa 1 Engineer untuk Platform Sebesar Ini adalah Hal yang Mustahil Sekaligus Nyata
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "EC-1: Feature development (new capabilities)", alloc: "35% of Hendra Jr. time", detail: "Building new features: average 2 new features per month at current velocity. Mix: 70% web platform features, 20% mobile app features, 10% API/data pipeline improvements. Velocity constraint: every feature must be buildable and maintainable solo — Hendra Jr. will not build something he cannot debug alone at 11pm.", constraint: "Feature velocity drops to ~1.5/month when a major infrastructure task (like BNSP API integration) is running simultaneously.", tc: "text-primary" },
            { category: "EC-2: Crawler maintenance and data quality", alloc: "25% of Hendra Jr. time", detail: "Monitoring 671 LPSE crawlers, handling broken adapters, managing session pool health, investigating data quality anomalies. Not glamorous but non-negotiable: every hour not spent on maintenance → potential data freshness or completeness degradation that klien notice.", constraint: "LPSE version upgrades (v3→v4 migrations) spike maintenance time by 2–3x for affected portals. Currently: 3 LPSE in migration → maintenance at 35% vs normal 25%.", tc: "text-blue-700" },
            { category: "EC-3: Infrastructure and reliability", alloc: "20% of Hendra Jr. time", detail: "Database optimization, API performance, monitoring/alerting, security patches, backup verification, Replit deployment management. Reliability work: invisible when it works (klien don't notice), catastrophic when it doesn't (Task #28: photo orphan prevention). Hendra Jr.'s rule: infrastructure debt compounds like financial debt — every month deferred adds interest.", constraint: "Post-Series A: dedicated infrastructure engineer would absorb this 20%, freeing Hendra Jr. for 55% feature development — 57% velocity increase.", tc: "text-emerald-700" },
            { category: "EC-4: Product collaboration (with Hendra, Sari, Budi)", alloc: "20% of Hendra Jr. time", detail: "Weekly product syncs with Hendra. Sari requests (new data structures for Knowledge Registry assets). Budi requests (mobile field research features). Reviewing Budi's mobile UX feedback from field trips. Translating Sari's knowledge curation needs into database schema changes. This is the 'connecting layer' between engineering and product/content.", constraint: "Most enjoyable work for Hendra Jr. — and the work most likely to produce insight-driven features. But it's time-bounded: can't exceed 20% or feature + maintenance work falls behind.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.category}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.alloc}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Constraint: {r.constraint}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Engineering capacity model adalah the document Hendra uses in Series A conversations to explain why the first post-close hire is an engineer (not sales or marketing). The math: at current 35% feature velocity, MJP ships ~2 features/month. Roadmap backlog: 67 features in RICE-prioritized queue (P-UNR-1 through P-UNR-8 plus others). At 2/month: 33 months to clear backlog — nearly 3 years, during which the backlog will grow faster than it's cleared. With 2 additional engineers: feature velocity triples to 6/month (some features require collaboration, not parallelization). Backlog cleared in 11 months. This is the Series A engineering ROI case: 3 engineers × Rp 25jt/month fully loaded = Rp 75jt/month → 3× feature velocity → faster NPS improvement → faster ARR growth. Hendra Jr.: 'Satu orang membangun platform untuk 847 klien dengan 671 crawler dan 15 halaman intelligence yang terus berkembang. Ini bisa karena sistemnya dirancang untuk maintenance solo. Tapi skalanya tidak bisa.'</p>
      </div>

      {/* R106: The Data Quality Philosophy — Why MJP Has a Data Bill of Rights */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> DATA QUALITY PHILOSOPHY — MJP's Data Bill of Rights: 5 Komitmen yang Hendra Jr. Buat kepada Setiap Klien tentang Kualitas Data, dan Apa yang Terjadi Ketika Komitmen Itu Dilanggar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { right: "DBoR-1: Setiap data punya sumber yang bisa diverifikasi", commitment: "Every data point in MJP's platform — tender, BUJK profile, SKK record, regulatory asset — has an original source that is publicly accessible and that klien can verify. MJP never displays data without source attribution. If a data point cannot be source-attributed: it is not displayed.", violation_case: "2023: A BUJK profile showed a track record project that Hendra Jr. had inferred from LPSE data — but the inference was not correctly attributed to source. When klien used this data in a dispute, the inferred nature wasn't clear. Fix: all inferred data is now explicitly labeled 'Estimated from X' not 'Confirmed as Y.'", tc: "text-primary" },
            { right: "DBoR-2: Freshness adalah janji, bukan aspirasi", commitment: "Tier-1 LPSE: {'<'} 2.8 hours average freshness. This is a commitment, not a target. If MJP cannot maintain this freshness due to crawler issues: klien are notified proactively (banner in platform) rather than silently serving stale data.", violation_case: "INC-2024-01 (from data pipeline postmortems): LPSE authentication change took 4.2 hours to fix. During that time: freshness for 34 LPSE portals was degraded. MJP showed a stale data banner for 4.2 hours. 3 Enterprise klien noticed and wrote in appreciation of the transparency. 0 klien wrote in complaint.", tc: "text-blue-700" },
            { right: "DBoR-3: Tidak ada data BUJK yang disembunyikan dari BUJK yang bersangkutan", commitment: "Any BUJK can request their own MJP profile data and receive a full export. If there is incorrect data in their profile: MJP has a correction request process. Corrections are reviewed by Hendra Jr. and applied within 72 hours if the correction is supported by verifiable documentation.", violation_case: "3 BUJK have submitted correction requests. All 3 were legitimate: one had a duplicate SKK record, one had wrong KBLI classification from SIKI source data, one had a trust score dimension that included a data point from the wrong entity (similar name). All 3 corrected within 48 hours.", tc: "text-emerald-700" },
            { right: "DBoR-4: Probabilistic data selalu dikomunikasikan sebagai probabilistic", commitment: "HPS estimation, Trust Score, win rate prediction: always shown with confidence range and explicit statement that these are estimates based on historical pattern analysis, not certainties. MJP never states 'HPS is Rp X' — always 'Based on similar tenders, HPS is estimated at Rp X–Y (68% confidence).'", violation_case: "Product review Q3 2025: Hendra Jr. found that mobile app was displaying Trust Score without confidence range (a display bug — truncated the UX). Fixed immediately. But the detection came from a self-audit, not a klien complaint — suggesting some klien may have been using Trust Score as fact rather than estimate during that period.", tc: "text-orange-700" },
            { right: "DBoR-5: Penghapusan data diproses dalam 30 hari", commitment: "If a BUJK requests deletion of their data from MJP's platform (per UU PDP): MJP processes the deletion within 30 days. Exceptions: data that is part of legally required audit trails or data derived entirely from public government sources (which can be removed from profile display but may remain in aggregate analytics).", violation_case: "1 BUJK requested deletion in 2025. Request processed in 23 days. BUJK confirmed receipt. No dispute. Hendra: 'Hak untuk dihapus dari sistem kita adalah hak yang genuine — bukan formalitas yang kita buat sulit.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.right} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.right}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Commitment: {r.commitment}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Violation case: {r.violation_case}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data Bill of Rights adalah the document Hendra includes in every Enterprise contract negotiation when the topic of 'what data do you have and what can I trust?' comes up. It's not legally binding in the formal sense — it's a voluntary commitment that MJP makes to demonstrate that data quality is not just a product feature but an organizational value. The 5 commitments are all tested by the violation cases above: none of the violations were catastrophic, and all were handled in ways that maintained or increased klien trust. The violation handling IS the commitment — the test of data quality philosophy is not whether MJP is perfect but whether MJP is honest and responsive when it's not. Hendra Jr.: 'Data yang sempurna tidak ada. Data yang jujur tentang ketidaksempurnaannya — itu yang bisa kita build dan maintain. DBoR adalah cara kami mendefinisikan apa artinya jujur tentang data.'</p>
      </div>

      {/* R107: Infrastructure Reliability as Trust Signal */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> INFRASTRUCTURE RELIABILITY AS TRUST SIGNAL — MJP's 5-Year Uptime Record, Mengapa Reliability Bukan Hanya Technical Metric tapi Trust Asset, dan Bagaimana Hendra Jr. Mengkomunikasikan Status ke Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { metric: "Platform uptime: 99.1% over 5 years (excluding scheduled maintenance)", detail: "MJP has had 4 significant outages in 5 years (documented in postmortem panel). Combined downtime: ~43 hours over 43.800 operating hours (5 years × 24h). 99.1% uptime. For comparison: industry standard SLA for B2B SaaS is typically 99.9% (down 8.7h/year) or 99.5% (down 43.8h/year). MJP at 99.1% is below 99.5% standard — but context: solo engineer, no dedicated ops team, no redundancy infrastructure until 2024.", trend: "Trend: improving. 2022–2023: 3 of the 4 outages occurred. 2024–2026 (so far): 1 outage. Trajectory is toward 99.5%+. Post-Series A: dedicated DevOps investment targeting 99.9%.", tc: "text-primary" },
            { metric: "Crawler data freshness reliability (% of days meeting freshness SLA)", detail: "Tier-1 LPSE freshness target {'<'} 2.8h average: met 94.3% of days (not hours — daily average). On 5.7% of days: at least one Tier-1 LPSE temporarily degraded above 2.8h threshold. Causes: LPSE authentication changes (most common), infrastructure maintenance, regional internet issues.", trend: "Freshness reliability is the metric Hendra Jr. takes most personally. '94.3% sounds like a passing grade. But 5.7% of days where data might be stale for some klien is 5.7% too many.' BNSP API (DR-1) addresses the BNSP freshness dimension; Tier-1 LPSE freshness improvement requires additional monitoring investment.", tc: "text-blue-700" },
            { metric: "API response time (p95): 340ms average over 2025–2026", detail: "p95 API response time (95th percentile, meaning 95% of requests faster): 340ms. p99: 1.2s. These numbers are for the current Replit deployment environment. For a platform serving 847 klien with 671 LPSE crawler data: competitive with commercial B2B SaaS at significantly lower infrastructure cost.", trend: "Hendra Jr. optimized core queries heavily in 2024 (reducing p95 from 890ms to 340ms — 62% improvement) without infrastructure upgrade. Primary technique: query caching for frequently accessed data (tender lists, Trust Score profiles). Post-Series A infrastructure: dedicated database server expected to reduce p95 to {'<'} 150ms.", tc: "text-emerald-700" },
            { metric: "Status page communication: every incident visible to all klien within 1 hour", detail: "MJP runs an informal status page (Hendra Jr. maintains a public status update channel for Enterprise klien). Policy: any outage {'>'} 15 minutes triggers a status update within 1 hour of detection. Post-incident: root cause summary within 48 hours. All 4 significant outages: communicated this way. 3 Enterprise klien have specifically praised this transparency in NPS surveys.", trend: "Post-Series A: proper status page (statuspage.io equivalent) replacing informal channel. Auto-detection of freshness degradation → auto-status update. Currently: Hendra Jr. manually posts status updates when he detects an issue. Auto-detection reduces lag between issue start and communication.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.metric} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.metric}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Trend: {r.trend}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Infrastructure reliability as trust signal adalah Hendra Jr.'s most direct contribution to MJP's retention — not through features, but through the platform being there when klien need it. The most important reliability metric for MJP is not uptime in absolute terms — it's uptime during critical windows: Monday morning (peak usage: 340% above baseline), tender deadline minus 3 days (peak usage: 280% above baseline), and aanwijzing day (peak usage: 190% above baseline). These are the moments when klien absolutely cannot afford MJP to be slow or unavailable. All 4 significant outages occurred during non-peak windows — not by design, but fortunate timing. Hendra Jr.'s highest reliability priority: ensuring the platform has no outages during peak usage windows, even if it means maintenance during low-usage periods. The status page transparency is equally important as the uptime itself: Hendra Jr.'s finding is that klien accept outages if they're communicated honestly and resolved quickly. What klien cannot accept: discovering an outage themselves and realizing MJP didn't tell them. Trust is maintained not by being perfect but by being honest about imperfection. Hendra Jr.: 'Infrastruktur yang saya bangun tidak akan pernah sempurna. Yang bisa saya jamin adalah bahwa ketika ada masalah, klien akan tahu sebelum masalah itu mempengaruhi keputusan bisnis mereka.'</p>
      </div>

      {/* R108: The 671 LPSE Challenge — Hendra Jr.'s Infrastructure War Stories */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5 text-primary" /> 671 LPSE WAR STORIES — 4 Infrastruktur Tantangan Terbesar yang Hendra Jr. Hadapi dalam Mengoperasikan Jaringan Crawler 671 Portal LPSE: Masalah Teknis yang Tidak Ada di Buku Manapun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { challenge: "CHALLENGE-1: LPSE authentication drift — portal mengubah mekanisme login tanpa notifikasi", what_happened: "Every 3–4 months on average, a Tier-1 LPSE portal changes its authentication mechanism — adding CAPTCHA, changing session token format, updating API endpoint structure. These changes: not announced. Discovery method: crawler error rate spikes above 15% for a specific portal, triggering Hendra Jr.'s monitoring alert. Average time from change to detection: 2.1 hours. Average fix time: 6–14 hours.", current_mitigation: "Hendra Jr. built an 'authentication health monitor' that runs an authenticated test session against each Tier-1 portal every 4 hours. If the test session fails: immediate Slack alert + automatic fallback to last cached data + klien-facing data freshness warning for that portal. The monitor has reduced MTTR (mean time to recovery) from 14 hours to 6 hours over 3 years of optimization.", tc: "text-primary" },
            { challenge: "CHALLENGE-2: Rate limiting yang tidak konsisten — portal yang sama rate-limits secara berbeda dari hari ke hari", what_happened: "Some LPSE portals use dynamic rate limiting: the same portal that allows 30 requests/minute on Monday allows only 8 on Wednesday (possibly due to server load, maintenance schedules, or arbitrary configuration). When Hendra Jr.'s crawler hit a rate limit: it would receive HTTP 429 (Too Many Requests) or, worse, silently return empty results (making it appear the portal had no new tenders when it actually had data the crawler couldn't access).", current_mitigation: "Adaptive rate limiting: Hendra Jr.'s crawler tracks the rate limit behavior of each portal over time and dynamically adjusts crawl frequency based on observed patterns. Portals with erratic rate limiting: assigned to a 'cautious mode' crawler that uses conservative request intervals. Silent empty response detection: cross-checks empty crawler results against the portal's known tender publication schedule — if a portal has never been silent for {'>'} 12 hours historically and is now silent for {'>'} 12 hours: trigger manual investigation.", tc: "text-blue-700" },
            { challenge: "CHALLENGE-3: Portal maintenance windows yang tidak terduga — LPSE down di tengah crawl cycle", what_happened: "Government IT maintenance often happens without notice on weeknights and weekends. The 2023 major outage (4.2 hours) traced to a scenario where 7 Tier-1 LPSE portals simultaneously underwent scheduled maintenance on a Sunday evening — the crawler returned empty data for all 7, the freshness monitoring system interpreted this as 7 simultaneous data quality issues, and the alert storm overwhelmed Hendra Jr.'s on-call system before he could investigate.", current_mitigation: "Multi-portal maintenance correlation detection: when {'>'} 3 portals show simultaneous data gaps, the system now first checks whether they're all hosted on the same government data center (gov.go.id cluster) before alerting. Multiple simultaneous failures on the same cluster → probable maintenance window → single alert + data freshness notification to affected klien, not individual portal alerts. This reduced false alarm rate by 73% during the following 6 months.", tc: "text-emerald-700" },
            { challenge: "CHALLENGE-4: Tender data normalization — 671 portals dengan 47 variasi format data yang berbeda", what_happened: "LPSE portals were built by different vendors at different times using different technical specifications. Result: 47 detected variations in how tender data is structured. Tender value fields: some portals use 'nilai_pagu' (original budget), others use 'nilai_hps' (estimated price), others combine both. Date formats: 15+ variations of date string format. KBLI codes: some portals use full KBLI (5-digit), some use abbreviated (4-digit), some use free-text descriptions.", current_mitigation: "MJP's normalization layer: 47 data format templates mapped to a canonical data model. Each portal is assigned to a template on first crawl (requires manual validation by Hendra Jr.) and then auto-normalized for every subsequent crawl. Template drift detection: when a portal's data structure changes significantly from its template, auto-flag for re-mapping. As of 2026: 671 portals mapped, 3 under re-mapping review (recent platform upgrades).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.challenge} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.challenge}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What happened: {r.what_happened}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Mitigation: {r.current_mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">671 LPSE war stories adalah Hendra Jr.'s most valuable institutional knowledge — because the challenges above are not in any textbook, not solved by any existing library, and not faced by any competitor who hasn't actually operated at this scale. Each challenge required MJP to invent a solution because no prior art existed for crawling 671 Indonesian government procurement portals at production quality. CHALLENGE-1 (authentication drift) → authentication health monitor. CHALLENGE-2 (erratic rate limiting) → adaptive rate limiting with behavior tracking. CHALLENGE-3 (portal maintenance windows) → multi-portal correlation detection. CHALLENGE-4 (data normalization) → 47-template canonical mapping. Each solution took 40–120 hours to build and test. Together: they represent approximately 600 hours of infrastructure problem-solving that a new entrant would need to replicate before achieving comparable data quality. Hendra Jr.'s concern: this institutional knowledge currently exists only in his head and in the code. The engineering documentation project (REGRET-4 from the dashboard page) is specifically about capturing this knowledge. Post-Series A: Hendra Jr.'s first hire (a backend engineer with distributed systems experience) will need to absorb 5 years of LPSE infrastructure knowledge in 3 months. The documentation is the only way to make that possible. Hendra Jr.: '671 portal bukan hanya angka besar. Setiap portal adalah hubungan yang perlu dijaga — ada yang mudah, ada yang susah, ada yang susah sekali. Saya mengenal karakter setiap satu dari mereka. Yang perlu saya lakukan sekarang: menuliskan itu sebelum ada orang lain yang perlu mengenal mereka juga.'</p>
      </div>

      {/* R109: Data Partnerships MJP Is Actively Pursuing */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> DATA PARTNERSHIP PIPELINE — 4 Kemitraan Data yang Sedang Dikejaran Hendra: Bagaimana Data Partnership yang Tepat Bisa Melipat-gandakan Kualitas Intelligence MJP Tanpa Membangun dari Nol
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { partnership: "DP-1: BNSP — formalisasi akses API dari monitoring-only ke partnership resmi", current_status: "Current: MJP queries BNSP's public verification API. Status: technically compliant but without formal agreement. BNSP has informally acknowledged MJP's usage as legitimate. Hendra's goal: formalize the relationship with a data access agreement that provides (1) guaranteed API rate limits (currently subject to BNSP's discretion), (2) access to additional SKK data fields not publicly available (assessment history, jenjang upgrade path, LSP recommendation scores), (3) official recognition as a BNSP data partner (useful for klien trust and investor positioning).", negotiation_stage: "MOU negotiation ongoing (started Q4 2025). BNSP's primary ask: MJP provides BNSP with anonymized aggregate SKK demand data (which KBLI categories are most searched, which jabatan kerja have highest demand). Value exchange: MJP gets data depth + official status; BNSP gets market intelligence for policy planning.", tc: "text-primary" },
            { partnership: "DP-2: Bank BUMN pilot expansion — dari proof-of-concept ke production integration", current_status: "Pilot with Bank X (Bank BUMN, undisclosed): Bank X uses MJP's Trust Score as one input to its construction sector credit risk model. Current stage: pilot running on 200 construction company loan applications. Results: Trust Score correlates at 0.43 with historical loan default rates in Bank X's portfolio — statistically significant predictive value. Bank X procurement: considering expanding to all construction sector credit applications (~2.400/year).", negotiation_stage: "Data licensing agreement negotiation: Bank X wants API access to Trust Score with 1-year SLA commitment. MJP wants: data license fee (Rp 150–200jt/year) + right to reference 'Bank X uses MJP Trust Score' in investor materials (case study value). Bank X's concern: exclusivity terms (wants exclusivity for banking sector for 2 years). Hendra's position: limited exclusivity acceptable (banking sector only, 2 years) in exchange for higher licensing fee.", tc: "text-blue-700" },
            { partnership: "DP-3: GAPENSI data exchange — member directory + procurement history", current_status: "GAPENSI (Gabungan Pelaksana Konstruksi Nasional Indonesia) has 14.000 member BUJK across Indonesia. Current status: GAPENSI and MJP have an informal referral relationship (GAPENSI refers members to MJP, MJP pays Rp 100k/referral for conversions). Target: formalize and expand to data exchange — GAPENSI provides member directory data (verified BUJK profiles, membership status, disciplinary records) in exchange for MJP providing GAPENSI's policy team with market intelligence reports.", negotiation_stage: "Licensing pilot discussion: GAPENSI exploring making MJP available to all 14.000 members at discounted rate (Rp 149k/month institutional license vs standard Rp 249k). If approved: instant access to 14.000 GAPENSI members, estimated 1.000–2.000 conversion at 7–14% trial-to-paid rate. ARR impact: Rp 1.8–3.6B additional from GAPENSI channel. Negotiation sticking point: GAPENSI wants MJP exclusivity for their referral relationship.", tc: "text-emerald-700" },
            { partnership: "DP-4: OIKN (Otorita IKN) — intelligence partner for IKN procurement transparency", current_status: "OIKN manages IKN's procurement process under different legal framework from LKPP. Currently: IKN tenders are published both on LPSE (covered by MJP's crawlers) and on OIKN's own portal (not crawled by MJP). The OIKN portal has additional information: project specifications, BUJK qualification requirements, IKN-specific compliance checklists — not available on LPSE.", negotiation_stage: "Exploratory meeting (Q1 2026): Hendra met with OIKN's procurement technology team. OIKN interest: using MJP's BUJK Trust Score as part of IKN vendor pre-qualification process. MJP interest: official access to OIKN's additional procurement data + right to use 'OIKN Partner' designation. Status: early exploratory, no formal negotiation yet. Timeline: expect formal discussion to begin Q3 2026 when OIKN's procurement technology roadmap is finalized.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.partnership} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.partnership}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current status: {r.current_status}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Negotiation stage: {r.negotiation_stage}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data partnership pipeline adalah MJP's strategic approach to expanding data depth without proportional infrastructure investment. Each of the 4 partnerships above offers data assets that would take MJP 12–24+ months to build independently — formal BNSP data access, Bank BUMN credit correlation data, GAPENSI member directory, OIKN IKN-specific procurement data. Partnership approaches: each requires a different negotiation framing. BNSP (government): value exchange framing (MJP data helps BNSP policy, BNSP data helps MJP service). Bank X (commercial): licensing revenue framing with exclusivity as premium lever. GAPENSI (association): institutional discount + referral formalization with exclusivity negotiation. OIKN (government): public interest framing (IKN procurement transparency aligns with OIKN's mission). The common element: Hendra always enters partnership negotiations with a clear understanding of what value MJP provides to the partner, not just what MJP wants to receive. Partnerships negotiated from 'what can you give us' fail. Partnerships negotiated from 'here is what we bring and here is what we would like in return' succeed. The BNSP MOU negotiation (DP-1) is the most important in Hendra's prioritization: formal BNSP partnership unlocks the SKK intelligence improvements that drive Enterprise tier value. Post-Series A timeline: DP-1 (BNSP) targeted for closure Q3 2026, DP-2 (Bank X) targeted for production Q4 2026, DP-3 (GAPENSI) targeted for pilot Q1 2027, DP-4 (OIKN) targeted for formal negotiation Q3 2026. Hendra: 'Partnership data yang tepat adalah cara membangun 2 tahun data depth dalam 6 bulan negosiasi. Tapi hanya jika kita memiliki sesuatu yang bernilai untuk ditawarkan — dan karena MJP punya Trust Score, LPSE coverage, dan Knowledge Registry, kita punya leverage yang tidak dimiliki startup data lainnya di Indonesia.'</p>
      </div>

      {/* R110: Hendra Jr.'s Daily Engineering Monitoring Dashboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> MORNING ENGINEERING DASHBOARD — 8 Metrik yang Hendra Jr. Cek Setiap Pagi pukul 06:00: Sistem Monitoring Personal yang Memungkinkan Satu Engineer Mengoperasikan Infrastruktur Kelas Produksi yang Melayani 847 Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { metric: "M-1: Crawl success rate (target: >98.5%)", check_method: "Dashboard aggregates: successful crawl cycles / total scheduled crawl cycles over past 24 hours. Threshold: below 98.5% triggers immediate investigation. Common causes of crawl failures: portal authentication drift (Portal re-issued authentication cookies with new format), portal maintenance windows (portal went offline overnight), rate limiting (portal blocked MJP's crawler after unusual traffic pattern). Each failure: auto-categorized by Hendra Jr.'s error classification system.", action_if_bad: "Below 95%: Hendra Jr. pauses non-engineering work and investigates. The 3 most recent below-95% events: all traced to simultaneous portal maintenance windows (Monday post-weekend server restarts across multiple portals). Resolution each time: wait 2–4 hours for maintenance windows to complete, re-crawl missed cycles.", tc: "text-primary" },
            { metric: "M-2: Alert delivery latency (target: <4 hours for 95th percentile)", check_method: "For each tender published overnight: time elapsed between portal publication timestamp and alert delivery to first matching klien. The p95 latency target: {'<'}4 hours. Currently: p50 = 1.8 hours, p95 = 3.6 hours, p99 = 6.1 hours (p99 outliers: primarily Tier-3 portals with 24-hour crawl cycles, by design).", action_if_bad: "p95 above 4 hours: investigate crawler queue depth (possible backup from high-volume day). p95 above 6 hours: investigate scheduler health (possible scheduler restart loop). Alert delivery latency above 8 hours for any individual klien: manual investigation + Reza notification if Enterprise klien affected.", tc: "text-blue-700" },
            { metric: "M-3: Normalization accuracy for prior day (target: >97.5% field completion)", check_method: "Daily audit: of all tenders processed in the prior 24 hours, what percentage have complete canonical fields (tender ID, title, HPS, KBLI, province, aanwijzing date)? The 97.5% target: allows for the known ~2.5% of portals with inconsistent field exposure. If accuracy drops below 97.5%: likely indicates a new portal has updated its HTML template (triggering normalization errors until new template is added).", action_if_bad: "Template miss: Hendra Jr. identifies which portals are producing normalization errors (by checking which portals have {'>'} 10% missing-field rate in past 24 hours), loads the portal in his development environment, reads the new HTML structure, adds new template entry. Template addition: typically 1–2 hours per portal.", tc: "text-emerald-700" },
            { metric: "M-4: BNSP API response status (target: 100% availability during 06:00–22:00 window)", check_method: "BNSP's public verification API is checked by Hendra Jr.'s health monitor every 15 minutes during business hours. API response time target: {'<'}2 seconds. Any response above 5 seconds: logged as degraded. Any HTTP error: logged as failed. BNSP API availability in past 90 days: 98.7% (2 unplanned outages totaling 37 minutes). During BNSP API outages: Trust Score SKK dimension shows 'status tidak dapat diverifikasi saat ini' rather than serving stale data.", action_if_bad: "BNSP API down: automatic fallback to cached SKK data (24-hour old, flagged as 'verifikasi tertunda'). If BNSP API down for {'>'} 2 hours: Hendra Jr. posts in team Slack ('BNSP API down — SKK verification degraded') so Reza can inform any Enterprise klien who might ask about SKK status during this period.", tc: "text-orange-700" },
            { metric: "M-5 through M-8: Database health, queue depth, server resources, error rates", check_method: "M-5 (Database): query latency p95 target {'<'}50ms (current: 38ms). Any p95 above 100ms: investigate — likely a missing index or inefficient query triggered by new data volume. M-6 (Queue depth): alert delivery queue depth target {'<'}2000 (current average: 847). If queue depth {'>'} 5000: scheduler may be backing up — investigate. M-7 (Server): CPU target {'<'}70%, Memory target {'<'}80% (current morning averages: 42% CPU, 61% memory — comfortable with room for peak load). M-8 (Error rates): application errors target {'<'}0.1% of requests. Any spike above 0.3%: investigate immediately.", action_if_bad: "M-7 (resources) consistently above target: hardware scaling conversation with Hendra. Currently: single VPS (current spec). Post-Series A: distributed infrastructure (T-ROAD-4). M-8 spike: error log review is always first action — most spikes trace to a new edge case in normalization or a BNSP API timeout cascade. Hendra Jr.'s alert protocol: all M-5 through M-8 violations trigger Slack self-notification before he's finished morning coffee.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.metric} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.metric}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.check_method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>If bad: {r.action_if_bad}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Morning engineering dashboard adalah Hendra Jr.'s operational discipline — the 8 metrics he reviews within 15 minutes of starting his day, 365 days a year. The dashboard check takes 10–15 minutes when everything is normal (all metrics green). When something is amber or red: it takes as long as the investigation requires. The metrics are structured in dependency order: M-1 (crawl success) is the foundation — if crawling fails, M-2 (latency) and M-3 (accuracy) are both affected. M-4 (BNSP API) is independent of the crawler but critical for Trust Score. M-5 through M-8 are the platform health indicators that ensure everything else runs at scale. The 06:00 check time is not arbitrary: it precedes Sari's morning briefing curation (05:00–07:00) and the scheduler's PDF delivery cycle. If Hendra Jr. identifies a crawler failure at 06:00: he has 60 minutes to resolve or mitigate before briefing delivery. The dashboard is Hendra Jr.'s most important reliability tool — but also his most important communication tool. On mornings when something is amber or red: Hendra Jr.'s Slack message ('M-3 normalization issue: Template miss on 3 portals, fix in progress') tells Hendra and Reza what they need to know before any Enterprise klien contacts MJP about a data issue. The principle: the team knows before the klien knows. Hendra Jr.: 'Dashboard pagi saya adalah cara saya memastikan bahwa hari baik berarti: klien tidak menyadari ada sesuatu yang salah, karena saya sudah memperbaikinya sebelum mereka bangun. Hari buruk berarti: saya memperbaikinya saat mereka sarapan, bukan saat mereka menelepon saya.'</p>
      </div>

      {/* R111: 3 Crawler Near-Failures */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> 3 NEAR-FAILURE INFRASTRUKTUR CRAWLER — Cerita di Balik 3 Momen Terkritis dalam 5 Tahun Operasi: Apa yang Hampir Menghentikan MJP, Bagaimana Hendra Jr. Mengatasinya, dan Sistem yang Lahir dari Setiap Krisis
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { incident: "NEAR-FAIL-1: LKPP portal structure change — 22 jam downtime (Q2 2022)", what_happened: "LKPP silently updated the HTML structure of the main LPSE portal in a routine maintenance window — no announcement, no deprecation notice. The crawler's parser was built against the old structure. Detection: Hendra Jr.'s morning check at 06:00 showed M-1 (crawl success rate) at 4% (from normal 98%). Root cause identification: 2 hours. The LKPP portal had changed its tender listing HTML structure in a way that broke MJP's primary parser. Impact: 22 hours of incomplete tender data covering the 6 LPSE portals that shared LKPP's CDN infrastructure.", resolution: "Fix: Hendra Jr. rebuilt the affected parser in 6 hours (the fastest parser rebuild in MJP's history). The 22-hour gap: backfilled using LKPP's archived tender data (a feature Hendra Jr. had built 'just in case' but had never needed). Zero Enterprise klien received incorrect alerts. 3 klien received alerts that were 22 hours delayed — Hendra proactively notified all 3 before they noticed. System born from this crisis: automated parser regression testing that runs daily against a sample of LPSE portals to detect structural changes before they cause widespread failure.", tc: "text-primary" },
            { incident: "NEAR-FAIL-2: BNSP API key expiration — Trust Score blind for 31 hours (Q4 2023)", what_happened: "BNSP's API for SKK verification was accessed via an API key with a 2-year expiration. Hendra Jr. had set a calendar reminder for the renewal but missed it during a high-workload week. The API key expired at 3:17am on a Tuesday. Detection: M-4 (BNSP API health) appeared amber at Hendra Jr.'s 06:00 dashboard check. Trust Score queries during the 31-hour window: returned without BNSP verification component — the Trust Score was displayed but the SKK dimension was marked 'unverified' with a UI warning. Impact: Trust Score was degraded but not broken. No BUJK was given an incorrectly high Trust Score — the system correctly flagged the degraded data.", resolution: "Fix: BNSP API key renewal required a manual process with BNSP's technical team (not instantaneous). Total resolution time: 31 hours. System born from this crisis: API key expiration monitoring added to the morning dashboard (M-4.1 — days until BNSP API key expiry). Current status: BNSP API key rotated proactively 30 days before expiry. All external API keys: now have expiration monitoring with 30-day and 7-day warning thresholds. Hendra Jr.: 'Saya menaruh reminder di kalender dan tetap saya lewatkan. Lesson: reminder di kalender adalah sistem yang bergantung pada manusia untuk tidak pernah gagal. Sistem monitoring yang otomatis: tidak bergantung pada itu.'", tc: "text-blue-700" },
            { incident: "NEAR-FAIL-3: Database growth crisis — query latency 47 detik (Q1 2024)", what_happened: "By Q1 2024, MJP's PostgreSQL database had grown to 87GB — 4.8× larger than when the initial index strategy was designed. A routine Drizzle migration in January 2024 ran without indexes on a critical join. Post-migration: tender search queries that previously returned in 0.8 seconds began taking 47 seconds. Detection: Hendra Jr. noticed M-2 (query latency) at 47s (vs 0.8s normal) at the morning dashboard check. Impact: tender search was effectively unusable for 6 hours. Enterprise klien who attempted NLQ queries during this period: received timeout errors. 11 Enterprise klien submitted support tickets within 2 hours.", resolution: "Fix: adding the missing index and running VACUUM ANALYZE on the affected tables: 3 hours from identification to resolution. The 6-hour window: the most klien-visible infrastructure failure in MJP's history — the 11 support tickets were Hendra's wake-up call. System born from this crisis: (1) migration pre-flight checklist that includes index verification on all join-heavy tables, (2) post-migration automated query latency benchmark that runs immediately after any schema change and alerts if P95 latency exceeds 2 seconds. Hendra: '11 tiket support dalam 2 jam: itu adalah harga yang saya bayar untuk tidak punya checklist yang benar. Setelah hari itu: checklist itu ada. Tidak ada krisis yang sama yang boleh terjadi dua kali.'", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.incident} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.incident}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">What happened: {r.what_happened}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Resolution and system born: {r.resolution}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">3 near-failure stories adalah the technical history that Hendra Jr. shares with every potential backend engineering hire — because they reveal more about MJP's engineering culture than any job description could. Each story has the same structure: problem, detection, fix, and most importantly, system born from the crisis. The 'system born' is the critical element: Hendra Jr.'s engineering philosophy is that every failure should produce something that prevents the same failure from recurring. Near-Fail-1 produced automated parser regression testing. Near-Fail-2 produced API key expiration monitoring. Near-Fail-3 produced migration pre-flight checklists and post-migration latency benchmarks. The cumulative effect of this philosophy: MJP's operational reliability has improved measurably each year, despite growing 5× in klien volume and 8× in data volume. The morning dashboard (8 metrics) is itself the product of 5 years of 'systems born from crises' — each metric was added because something failed and its failure was not detected fast enough. Hendra Jr.'s summary of 5 years of infrastructure engineering: 'Sistem yang handal bukan yang tidak pernah gagal — itu adalah sistem yang gagal dengan cara yang bisa dideteksi cepat, diperbaiki cepat, dan tidak bisa gagal dengan cara yang sama dua kali. Tiga near-failure ini: masing-masing membuat sistem berikutnya sedikit lebih tidak mungkin untuk gagal secara diam-diam. Itu adalah target yang bisa dicapai, bahkan ketika target sempurna tidak bisa.'</p>
      </div>

      {/* R112: Data Quality Certification */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> DATA QUALITY CERTIFICATION — Bagaimana MJP Memverifikasi Klaim Akurasi Datanya Sendiri: 4 Quality Dimensions, Sampling Methodology yang Hendra Jr. Jalankan Setiap Bulan, dan Angka Aktual di Balik Klaim Data MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "DQ-1: LPSE completeness — apakah semua tender dari 671 portal tercapture?", methodology: "Monthly completeness audit: Hendra Jr. selects 30 random LPSE portals (stratified: 10 high-volume, 10 medium, 10 low) and manually verifies all publicly announced tenders from the past 30 days appear in MJP's database. Completeness rate target: 98.5%. Current rate: 97.8%. The 2.2% gap: attributable primarily to temporary portal unavailability during crawl windows (scheduled maintenance). Worst-performing portals: 7 in Eastern Indonesia with below-95% completeness due to irregular uptime. Response: crawl interval reduced from 4 hours to 1 hour with retry logic for these 7 portals. The gap translates to approximately 8–12 missed tenders per month — predominantly low-volume portals with small project values.", current_performance: "Completeness rate trend: 96.1% (Q1 2024) → 97.3% (Q4 2024) → 97.8% (Q2 2026). Steady improvement from portal relationship program and retry logic improvements. Expected Q3 2026: above 98% for all portals.", tc: "text-primary" },
            { dimension: "DQ-2: Trust Score accuracy — apakah skor mencerminkan kinerja BUJK sebenarnya?", methodology: "Quarterly Trust Score validation: Hendra Jr. and Sari select 20 BUJK with recent Trust Score updates and manually verify their score against direct LPSE portal lookup (win/loss record), BNSP certification registry (SKK validity), and LKPP qualification database (SBU and NPPBJ status). Any BUJK where MJP's Trust Score differs by 2 or more dimensions from manual verification: flagged as a data quality incident. Trust Score accuracy rate target: 96%.", current_performance: "Current accuracy: 94.3% (last validation). The 5.7% error rate: Error Type A (3.1%) — BUJK with SKK certifications from regional LSPs not yet integrated into MJP's data pipeline. Error Type B (2.6%) — BUJK that changed legal entity name without BUJK ID change (causing MJP to track two entities as separate). Both addressed in Q3 2026 through expanded LSP data feed coverage and legal entity change detection algorithm.", tc: "text-blue-700" },
            { dimension: "DQ-3: Knowledge Registry citation accuracy — apakah referensi regulasi sudah benar?", methodology: "Monthly citation audit (Sari): 15 randomly selected Knowledge Registry assets from the past 90-day publication period. For each asset: Sari accesses the primary source document (LKPP portal, JDIH, BNSP) and verifies all regulatory citations correctly reference the current version. Assets where any citation is inaccurate: full re-review triggered. Citation accuracy target: 99.0%. The 0.8% current error rate: entirely from citations to regulations amended after asset creation (accurate when published, became inaccurate due to regulatory change). Pre-interdependency-map error rate: 2.1%. Post-map: 0.8%. The mapping reduced citation error rate by 62%.", current_performance: "Current accuracy: 99.2% (last audit) — above target. The interdependency map now automatically flags 89% of citation-invalidating regulatory changes before they're discovered in audits. Remaining 11%: changes to secondary-referenced regulations not captured in MJP's primary monitoring list.", tc: "text-emerald-700" },
            { dimension: "DQ-4: HPS accuracy — apakah estimasi HPS dalam range aktual?", methodology: "Monthly HPS accuracy tracking: for all tenders where MJP generated an HPS estimate AND where actual award data is available (LPSE publishes award prices), calculate the percentage where the actual winning bid falls within MJP's estimated range (winner price within 20% of MJP's estimate). Sample: 80–120 tenders per month. Current accuracy: 71%. Trend: 61% (Q1 2024) → 67% (Q4 2024) → 71% (Q2 2026). Segmented accuracy: Government Building Works (84% — strongest), Road Infrastructure (76%), MEP Works (67%), Landscaping and Minor Works (48% — weakest, due to highly localized pricing that MJP's national price indices don't capture).", current_performance: "The 71% overall: weighted average. The improvement roadmap targets 78% by Q4 2027 by addressing MEP and Landscaping weak segments with regional pricing data from Budi's narasumber network and expanded LPSE award price analysis in secondary provinces.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Methodology: {r.methodology}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Current performance: {r.current_performance}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data quality certification adalah MJP's accountability mechanism for claims that are central to its value proposition. MJP's marketing claims — 'data you can bet your tender on,' '99.1% uptime,' '71% HPS accuracy' — are not marketing copy: they are measured, reported internally monthly, and available to Enterprise klien and investors on request. The quality certification framework (4 dimensions, monthly audits, published accuracy targets) is unusual for a company of MJP's size — most startups don't have formal data quality programs until they're much larger or forced by enterprise klien procurement requirements. Hendra's rationale for building the framework at current scale: 'Klien bertaruh uang nyata berdasarkan data kami. Kalau kami tidak bisa memverifikasi secara sistematis bahwa data kami akurat: kami tidak layak kepercayaan mereka, apapun yang dikatakan marketing kami.' The audit results are shared with the full team monthly — not as a compliance exercise but as a quality improvement signal. Each metric below target triggers a root cause analysis and a specific engineering or editorial action. The framework's secondary benefit: it gives Hendra a rigorous answer to investor diligence questions about data quality. Rather than 'our data is high quality' (subjective), Hendra can say '94.3% Trust Score accuracy on 20-BUJK monthly validation sample, with specific error types identified and addressed in Q3 2026' (objective and credible). The '99.1% uptime' figure: calculated from Hendra Jr.'s incident log — total planned and unplanned downtime over 24 months vs total expected uptime. 5 incidents exceeding 1 hour. Total downtime: 21.3 hours over 24 months. Uptime: 17.258 out of 17.280 expected hours = 99.88% for server-side; the 99.1% figure includes LPSE portal-side data delivery delays. Hendra Jr.: 'Kualitas data yang tidak diukur adalah keyakinan, bukan klaim. Saya tidak ingin membangun bisnis di atas keyakinan tentang data kami sendiri. Saya ingin tahu pasti — dan tahu pasti berarti mengukur.'</p>
      </div>

      {/* R113: Geographic Coverage Expansion Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> GEOGRAPHIC COVERAGE EXPANSION ROADMAP — Dari 671 ke 850 Portal LPSE pada 2028: Strategi Pertumbuhan Coverage, Mengapa 671 Bukan 671 Portal yang Setara, dan Hambatan Teknis yang Perlu Diatasi Hendra Jr. untuk Setiap Tier Ekspansi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "CURRENT STATE: 671 portal — distribusi dan kualitas yang tidak merata", coverage: "MJP's 671 LPSE portals: not uniformly distributed or uniformly reliable. Distribution by tier: TIER-A (High coverage, high quality, high tender value) — 89 portals covering the 34 provincial governments and 55 major city/kabupaten governments in Java, Bali, and major urban centers in Sumatra. These 89 portals: generate 67% of MJP's total tender value. TIER-B (Adequate coverage, moderate quality) — 247 portals covering most kabupaten-level governments in Java and major kabupaten in Outer Islands. TIER-C (Coverage exists but quality is inconsistent) — 335 portals covering smaller kabupaten in Eastern Indonesia, including portals with irregular uptime, slow data refresh, and occasionally non-standard document formats that require specialized parsers.", technical_challenge: "The quality distribution problem: MJP's portal coverage numbers (671) is less meaningful than the quality-weighted coverage. If a TIER-C portal misses 15% of tenders due to uptime issues: it contributes 85% of its theoretical data value to MJP's database. The 671 portals collectively deliver approximately 93% of theoretical data value — the 7% gap concentrated in TIER-C portals. Hendra Jr.'s quality improvement roadmap (within current 671): target 97% theoretical data value delivery by Q4 2026 through retry logic, scheduled crawl optimization, and format normalization for the 12 most common non-standard LPSE portal configurations.", tc: "text-primary" },
            { phase: "EXPANSION-1: 671 ke 720 portal (Q4 2026 target) — mengisi gap di Kalimantan dan Sulawesi", coverage: "Gap identification: Hendra Jr.'s current portal coverage map shows 47 kabupaten-level governments in Kalimantan and Sulawesi with active LPSE portals that MJP does not yet crawl. These portals: identified through LKPP's official LPSE portal registry (public list of all registered LPSE installations). The 47 uncovered portals: missed because they were added to LKPP's registry after MJP's last portal expansion (Q2 2024). Tender value in uncovered portals: estimated Rp 8.7T/year combined. The 47 portals cover regions relevant to approximately 120 of MJP's current subscribers (BUJK who operate in those provinces).", technical_challenge: "Technical challenge for EXPANSION-1: 11 of the 47 uncovered portals use an older LPSE version (LPSE 4.0) that requires a different parser than MJP's primary parser (built for LPSE 4.5+). Hendra Jr.'s estimate: 3 weeks of development time to build and test the LPSE 4.0 compatibility layer. This has been a known gap since Q3 2024 — repeatedly deprioritized in favor of NLQ accuracy improvements and SKK Express platform integration. Post-Series A prioritization: EXPANSION-1 is the first backend infrastructure project for the new Backend Engineer hire.", tc: "text-blue-700" },
            { phase: "EXPANSION-2: 720 ke 800 portal (Q2 2027 target) — Papua, Maluku, dan Nusa Tenggara Timur", coverage: "The Eastern Indonesia portal expansion: MJP's most significant infrastructure challenge. Current coverage in Papua, Maluku, and NTT: 31 portals (approximately 40% of all LPSE portals in those provinces). Uncovered: 48 portals in smaller kabupaten. The expansion rationale: not current subscriber demand (MJP has relatively few BUJK subscribers in these provinces) but growth strategy. Infrastructure projects in Eastern Indonesia: the fastest-growing segment of government procurement spending (APBN 2025: Eastern Indonesia infrastructure allocation up 23% from 2024). BUJK who are currently considering expansion into these provinces: MJP's most sophisticated Strategic Analyst archetype subscribers.", technical_challenge: "Technical challenges for EXPANSION-2: (1) Connectivity reliability — some Eastern Indonesia LPSE portals have inconsistent uptime (internet infrastructure limitations). Hendra Jr.'s solution: asynchronous crawling with extended retry windows (up to 24 hours vs current 4-hour window). (2) Local language variation — some kabupaten portals in NTT use Bahasa Indonesia with heavy regional terms for certain document categories. Parser accuracy on these portals: currently 78% (vs 94% average for Jawa portals). The 22% gap: primarily affecting material specification documents. Solution: transfer learning from the main parser with 500-document fine-tuning dataset (Hendra Jr. to build the dataset with help from Budi's Eastern Indonesia narasumber contacts).", tc: "text-emerald-700" },
            { phase: "EXPANSION-3: 800 ke 850 portal (Q4 2027 target) — historical portals dan specialized procurement agencies", coverage: "The final 50 portals in the roadmap: not geographic expansion but category expansion. Two categories: (1) Historical portals — 18 LPSE portals that have been decommissioned (their tender data is no longer live but historical award data from 2015–2022 is still accessible). Indexing these portals: improves MJP's historical bid data for HPS modeling (more historical reference points = better accuracy). (2) Specialized procurement agencies — 32 portals belonging to state-owned enterprises (BUMN) and specialized government agencies (BPJT toll road authority, PLN, Pertamina, PELINDO) that use LPSE-compliant platforms but are not technically government portals. These BUMN portals: generate Rp 45T+ in annual procurement activity and are increasingly relevant for larger BUJK.", technical_challenge: "Technical challenges for EXPANSION-3: BUMN portals often require separate authentication tokens (unlike government LPSE portals which allow public access). Hendra Jr.'s approach: register MJP as a 'data user' with each BUMN (not all allow this — legal review required for each). Of the 32 target BUMN portals: 14 have explicit public data access policy (straightforward to crawl), 12 require formal data user registration, and 6 have restrictive policies that may require negotiation or legal work. Target: cover all 14 open-access portals by Q4 2027 as first phase, 12 registration-required portals by Q2 2028.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Coverage: {r.coverage}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Technical challenge: {r.technical_challenge}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Geographic coverage expansion roadmap adalah Hendra Jr.'s 2-year infrastructure development plan that will take MJP from 671 to 850 LPSE portals by Q4 2027 — a 27% expansion in portal coverage. The expansion is not motivated by subscriber demand alone: it's motivated by the Series A pitch's geographic reach claim ('Indonesia's most comprehensive LPSE intelligence network'). At 671 portals: MJP covers approximately 78% of all registered LPSE portals in Indonesia. At 850 portals: approximately 99% coverage. The 21-percentage-point coverage gap between current and target: not uniformly distributed — MJP currently misses disproportionately in Eastern Indonesia (where coverage is 40%) and BUMN (where coverage is 30%). Both gaps are addressable through technical investment, not relationship barriers. The commercial case for expansion: coverage expansion primarily supports retention (existing subscribers who move operations to new regions don't need to switch platforms) and secondarily supports acquisition (new subscribers in currently uncovered regions are not currently considering MJP). Hendra's investor framing: 'Kami sudah membangun infrastruktur yang mencakup 78% dari semua portal LPSE di Indonesia. 22% berikutnya: ini adalah pekerjaan yang sudah dirancang, sudah ada solusi teknis, dan sudah ada timeline. Ini bukan pertanyaan tentang apakah kami bisa melakukannya — ini pertanyaan tentang kapan kami memiliki kapasitas engineering untuk menyelesaikannya. Series A memberikan kapasitas itu.'</p>
      </div>

      {/* R114: Crawler Ethics Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> CRAWLER ETHICS FRAMEWORK — Aturan MJP untuk Pengumpulan Data yang Bertanggung Jawab: 4 Prinsip Etis, Bagaimana Hendra Jr. Mengimplementasikannya dalam Kode, 2 Kasus di Mana MJP Berhenti Mengumpulkan Data Meski Secara Teknis Bisa, dan Mengapa Etika Crawler Adalah Keunggulan Kompetitif
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "ETHICS-PRINCIPLE-1: Hanya mengumpulkan data yang dipublikasikan secara publik untuk konsumsi publik", implementation: "MJP's crawler: only collects data from pages that are publicly accessible without authentication. Any LPSE page that requires login: not crawled. Any document that requires a specific LPSE user session to access: not collected. This principle eliminates a class of data that BUJK competitors might access through fake registrations or credential sharing — both of which violate LPSE terms of service. Hendra Jr.'s implementation: the crawler has a 'public access test' that runs before any new portal or page type is added to the crawl scope. The test: can the data be accessed by an anonymous browser with no authentication? If no: not crawled.", case_where_stopped: "Case: in 2023, Hendra Jr. discovered that one LPSE portal's administrative back-end (not the public page) was accessible due to a security misconfiguration. The back-end contained pre-publication tender data (tenders in preparation before public posting). Technical capability: yes, MJP could have collected this. Decision: Hendra reported the security misconfiguration to the portal administrator (LKPP liaison contact) and did not collect the pre-publication data. Reason: 'Data dari misconfiguration adalah bukan data yang dipublikasikan untuk konsumsi publik — ini adalah data yang bisa kami akses secara tidak sengaja.' Hendra's belief: acting ethically even when no one would know: is foundational to MJP's long-term institutional relationships.", tc: "text-primary" },
            { principle: "ETHICS-PRINCIPLE-2: Rate limiting yang menghormati kapasitas server portal", implementation: "MJP's crawler: implements rate limiting that is calibrated to each portal's server capacity. Default: 1 request per 3 seconds per portal. For smaller kabupaten portals with limited server infrastructure: 1 request per 10–15 seconds. The rate limiting: prevents MJP's crawler from causing performance degradation for the portal's legitimate users (government procurement staff and BUJK using the portal for official purposes). Hendra Jr.'s monitoring: any crawler session that takes more than 5% of a portal's response time above its baseline average triggers an automatic rate reduction. The technical implementation: a per-portal response time monitor that adjusts crawl rate dynamically.", case_where_stopped: "Case: in 2024, a portal in Papua upgraded from LPSE 4.0 to LPSE 4.5 and temporarily experienced performance issues during the upgrade period. MJP's monitoring detected response time degradation and automatically paused the portal crawl for 18 hours. When the portal stabilized: crawl resumed automatically. 0 data loss for MJP (queue preserved the missed crawl window). The portal administrator: unaware of the self-imposed pause. Hendra Jr.: 'Jika crawler kami menyebabkan portal pemerintah menjadi lebih lambat untuk BUJK yang menggunakannya untuk tujuan resmi: kita merusak ekosistem yang menjadi sumber nilai kita. Itu kontraproduktif dan tidak etis.'", tc: "text-blue-700" },
            { principle: "ETHICS-PRINCIPLE-3 dan 4: Tidak mengindeks dokumen pribadi dan transparansi kepada pengelola portal", implementation: "PRINCIPLE-3: MJP's crawler: collects tender announcements, award results, and official documentation — but not any personally identifiable information that might appear in document attachments (some BUJK-submitted qualification documents contain personal ID numbers, addresses, and bank details). Hendra Jr.'s PII filter: strips any string matching KTP number format, NPWP format, or bank account number format from collected data before database storage. PRINCIPLE-4: Transparency. MJP identifies its crawler with a specific User-Agent string ('MJPBot/2.0; +https://mjp.id/bot-policy') that allows portal administrators to identify and block MJP's crawler if they choose to. MJP's bot policy page: explains what data MJP collects and how it is used. This transparency: means portal administrators can make an informed choice about whether to allow MJP's crawler access. No portal has blocked MJP's crawler in 5 years of operation.", case_where_stopped: "In Q2 2025: Hendra Jr. discovered that one BUJK's qualification document (accidentally posted publicly on an LPSE portal instead of as a confidential attachment) contained the BUJK owner's personal bank account details. Hendra Jr. identified and purged the data from MJP's database within 2 hours of discovery. He notified the portal administrator about the exposure. He also notified the affected BUJK directly. Response from the BUJK: 'Saya tidak tahu bahwa dokumen saya terposting secara publik. Terima kasih telah memberitahu saya.' The BUJK became an MJP subscriber within 30 days — a direct result of the trust established by the notification. Hendra Jr.: 'Etika bukan hanya tentang apa yang benar untuk dilakukan — ini tentang membangun jenis reputasi yang tidak bisa dibeli dengan uang.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Implementation: {r.implementation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Case where MJP stopped despite capability: {r.case_where_stopped}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Crawler ethics framework adalah MJP's least-visible competitive advantage — because its value is primarily defensive and reputational rather than offensive and product-driven. The 4 principles (public data only, rate limiting, PII stripping, transparency) collectively: reduce MJP's regulatory risk, protect MJP's institutional relationships (LKPP, BNSP, portal administrators), and build a reputation for responsible data collection that differentiates MJP from competitors who may be less disciplined. The competitive advantage of ethical data collection: not immediately visible but compounding. A competitor who violates LPSE terms of service (fake user registrations, aggressive crawling) faces: eventual portal blocking, potential regulatory action, and reputational damage with the government stakeholders that MJP needs as long-term partners. MJP's clean ethical record: means Sari's LKPP working group relationships are not complicated by any history of MJP's data practices being challenged. The 2 cases where MJP stopped despite technical capability (security misconfiguration, exposed PII): both produced positive relational outcomes (misconfiguration case: LKPP liaison relationship deepened; PII case: new BUJK subscriber). This is the ethics-as-advantage thesis: acting ethically in moments where no one would know: builds the institutional trust that produces access and relationships unavailable to less-ethical competitors. Hendra Jr.'s summary principle: 'Crawler kita adalah wajah teknis dari reputasi perusahaan. Setiap keputusan yang saya buat tentang apa yang dikumpulkan dan bagaimana: mencerminkan apakah MJP adalah partner yang bisa dipercaya oleh ekosistem yang menjadi sumber nilai kami. Itu bukan keputusan teknis — itu keputusan bisnis.'</p>
      </div>

      {/* R115: Daily Scheduler Internals Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> DAILY SCHEDULER INTERNALS — Arsitektur Teknis 5-Langkah Scheduler Harian MJP: Idempotency Check, Parallel Data Collection, Notification Pipeline, Retry Logic, dan Failure Monitoring yang Memastikan 847 BUJK Menerima Briefing Pukul 06:00
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { component: "SCHEDULER-STEP-1: Trigger dan idempotency check (05:45 WIB)", detail: "The MJP daily scheduler: triggered via a cron job at 05:45 WIB every weekday. The trigger calls POST /scheduler/run, protected by an internal API key. First action: idempotency check — query scheduler_runs table for any run with status 'running' or 'completed' for today's date. If found: the scheduler exits immediately (no-op). This prevents duplicate runs caused by multiple cron trigger instances, container restarts, or manual triggers.", implementation: "The scheduler_runs table records each run with: run_id (UUID), run_date (date), status ('pending'/'running'/'completed'/'failed'), started_at, completed_at, notificationResult (JSONB — stores per-channel delivery outcome), and error_message. Hendra Jr.: 'Idempotency bukan fitur opsional untuk scheduler yang menyentuh subscriber data — ini persyaratan. Duplicate run adalah skenario terburuk: double-notification merusak kepercayaan lebih dari delayed notification.'", tc: "text-primary" },
            { component: "SCHEDULER-STEP-2 dan STEP-3: Data collection dan briefing generation (05:45–06:00 WIB)", detail: "STEP-2: collectDailyData() calls 4 data collection functions in parallel: fetchTenderAlerts() (new tenders last 24h filtered by subscriber settings), fetchRegulatoryUpdates() (Knowledge Registry assets updated last 24h), fetchCompetitorSignals() (new competitor intelligence signals), fetchMarketTrends() (DECAY-TYPE-4 signals). Parallel execution reduces collection from 4×8s serial to ~10s. STEP-3: generateBriefing() calls the LLM API with Sari's 4-section template prompt. The LLM call: ~Rp 12rb per run.", implementation: "Error handling in STEP-2: any individual collection function failure does not abort the scheduler. The error is logged to scheduler_runs, and the briefing is generated with available data plus a note that one source was unavailable. This partial-success design: ensured subscribers received briefings on all 7 occasions in 2025 when one data source was temporarily down — none of those 7 partial-success runs triggered subscriber complaints.", tc: "text-blue-700" },
            { component: "SCHEDULER-STEP-4: Notification dispatch dengan retry logic (06:00–06:15 WIB)", detail: "STEP-4: sendCollectionNotification() dispatches the briefing to all active subscribers via WhatsApp first, email second. Retry logic: any failed notification is retried twice with exponential backoff (15s, then 60s) before being marked 'failed' in notificationResult JSONB. The entire dispatch must complete before 06:20 WIB to ensure delivery before 07:00 when most BUJK start their workday.", implementation: "Parallel dispatch required at 847 subscribers: batches of 50 notifications dispatched simultaneously with 200ms between batches (to stay within WhatsApp API rate limits). Total dispatch time: ~9 minutes. With growth to 2.000 subscribers: dispatch time increases to ~22 minutes — still within the window but requiring a trigger time adjustment to 05:30 WIB. Hendra Jr. has pre-built this adjustment into the scheduler configuration as an environment variable.", tc: "text-emerald-700" },
            { component: "SCHEDULER-STEP-5: Result recording, monitoring, dan failure alerting (06:15 WIB)", detail: "STEP-5: scheduler writes the complete run result to scheduler_runs: notificationResult JSONB (per-channel delivery outcomes), completed_at, and final status ('completed' or 'failed_partial'). Monitoring: a Slack webhook alert fires if the scheduler_runs record for today has not been marked 'completed' by 06:30 WIB — giving Hendra Jr. a 30-minute window to diagnose and manually trigger a corrective run before the 07:00 delivery target.", implementation: "Failure history: in 5 years of operation, the scheduler has failed to produce an on-time briefing 4 times: 1 database connection failure (2021), 1 LLM API outage (2022), 1 WhatsApp API credential expiry (2023), 1 delayed recovery run (2024). All 4 failures: discovered through the monitoring alert before subscriber complaints. The 4 failures produced 7 subscriber inquiries and 0 churn. Annual reliability rate: 99.84% (1.250 runs, 4 failures). Hendra Jr.: 'Sistem monitoring yang baik bukan yang menghindari semua kegagalan — yang memastikan kita mengetahui kegagalan sebelum pelanggan kita melakukannya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.component} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.component}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Technical detail: {r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implementation notes: {r.implementation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Daily scheduler internals adalah Hendra Jr.'s most polished piece of production engineering — because the morning briefing is MJP's highest-visibility product feature (delivered to 847 BUJK every weekday at 06:00) and the one where failure is most immediately visible. The 5-step architecture reflects 5 years of incremental refinement: idempotency check added after a 2021 double-run incident, parallel data collection added in 2022, notification retry logic added after the 2023 WhatsApp credential issue, and the monitoring alert added after all 4 failures as a systematic prevention measure. The architecture embodies Hendra Jr.'s engineering philosophy: 'reliable systems are not systems that never fail — they are systems that fail predictably and recover quickly.' The idempotency check (prevents double-running), the partial-success data collection (prevents a single source failure from blocking the briefing), and the monitoring alert (detects failures before subscribers do): all reflect this philosophy. The architectural evolution also reflects a commercial reality: the morning briefing is MJP's most retained feature. Subscribers who miss even 1 briefing: show measurably higher churn probability in the subsequent 30 days. Each scheduler failure has a measurable retention cost. The 4 failures in 5 years: represents 99.84% annual reliability at 250 runs/year. The post-Series A target: maintain 99.84% or better at 2× subscriber volume — achievable with the dispatch time adjustment described in STEP-4 and the existing architecture's proven idempotency and retry design.</p>
      </div>

      {/* R116: Portal Coverage Expansion Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> PORTAL COVERAGE EXPANSION ROADMAP — Rencana Hendra Jr. untuk Menambahkan Portal Indonesia Timur: 3 Tahap Ekspansi, Tantangan Teknis per Wilayah, dan Mengapa 671 Portal Saat Ini Masih Meninggalkan 23% Pasar Tidak Tercakup
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { expansion_phase: "EXPANSION-PHASE-1: Sulawesi dan Maluku — 47 portal tambahan (Q3 2026, post-Series A funding)", current_coverage_gap: "Current MJP coverage: 671 LPSE portals across 34 provinces, but with significant density variance. Western Indonesia (Jawa, Sumatra, Bali/NTB): 94% portal coverage (nearly all portals with regular tender activity are indexed). Eastern Indonesia starts: 71% portal coverage across Sulawesi, Maluku, and Papua combined. The specific gap in Sulawesi and Maluku: 47 portals that Hendra Jr. has identified as 'active but uncrawled' — they issue tenders regularly but are not in MJP's current portal database. The commercial impact: BUJK subscribers from Sulawesi and Maluku who use MJP receive alerts that are 29% incomplete relative to their actual market. This gap: the Trust Score Regional Coverage Adjustment noted in the R115 Dispute Resolution panel — Eastern Indonesia BUJK with fewer award records because their portals aren't fully indexed.", technical_challenge: "Technical challenges for EXPANSION-PHASE-1: (1) Non-standard portal implementations — 11 of the 47 Sulawesi/Maluku portals use older LPSE versions that require different crawler configurations (non-standard HTML structures, different authentication flows). Hendra Jr.'s estimate: 3 weeks of additional crawler development per non-standard portal type (vs 2 days for standard portal addition). (2) Data quality issues — 8 portals have inconsistent award record publishing (they publish tender announcements but not always award results, creating incomplete contract cycle data). These portals: require a different data quality classification in MJP's database to avoid generating misleading Trust Score inputs. (3) Connectivity reliability — 6 portals in more remote Maluku areas have connectivity issues that cause crawls to time out more frequently. Hendra Jr.'s approach: extended crawl timeout settings plus a retry mechanism specifically for these portals.", tc: "text-primary" },
            { expansion_phase: "EXPANSION-PHASE-2: Papua dan Papua Barat — 38 portal tambahan (Q1 2027)", current_coverage_gap: "Papua and Papua Barat: MJP's most significant geographic coverage gap (currently 58% portal coverage vs 94% in Western Indonesia). The commercial rationale for Papua expansion: not current subscriber volume (less than 3% of MJP's subscribers are from Papua-region BUJK) but future commercial potential. Papua's infrastructure development pipeline: among the largest per-capita in Indonesia (driven by the Otonomi Khusus funding allocation and the new Ibu Kota Nusantara (IKN) development's upstream procurement activity in Eastern Indonesia). BUJK who position early in Papua's infrastructure procurement market: will have disproportionately high future tender opportunities. MJP's Papua coverage: a strategic investment in serving a high-growth market segment before that growth materializes in subscriber demand.", technical_challenge: "Technical challenges for EXPANSION-PHASE-2: (1) Language and format variation — some Papua regional portals use document templates that include Papuan local language annotations alongside Indonesian, creating parsing challenges for MJP's document extraction pipeline. Hendra Jr.'s solution: a locale-aware document parser that detects and handles bilingual document formats. (2) Portal authority fragmentation — Papua's administrative reorganization (splitting Papua into 4 new provinces in 2022) created new provincial procurement units that are still establishing their LPSE implementations. Several portals are technically active but with limited historical data (operating for less than 18 months). MJP's approach: index these portals with a 'New Portal' flag and lower Trust Score weight until sufficient historical data is accumulated. (3) Network reliability: significantly higher crawl failure rate (estimated 18% vs 2.1% for Western Indonesia portals). Hendra Jr.'s approach: a dedicated retry queue for Papua-region crawls with extended backoff intervals.", tc: "text-blue-700" },
            { expansion_phase: "EXPANSION-PHASE-3: Internasional — ASEAN cross-border procurement intelligence (2028, post-growth stage)", current_coverage_gap: "The most ambitious and longest-horizon expansion: monitoring ASEAN regional procurement opportunities that are accessible to Indonesian BUJK under ASEAN Economic Community frameworks. Specific target: Philippine public procurement portals (PhilGEPS — Philippine Government Electronic Procurement System) and Malaysian procurement portals (MyProcurement) where Indonesian BUJK with appropriate ASEAN certification can bid on infrastructure contracts. The current BUJK market for cross-border procurement: very small (estimated 0.3% of MJP's SAM has ever bid on ASEAN procurement). The growth potential: ASEAN infrastructure integration is a stated policy priority across all ASEAN governments — cross-border BUJK opportunities are expected to grow significantly as the ASEAN Common Framework for Mutual Recognition of Professional Qualifications expands to cover construction contractors.", technical_challenge: "Technical challenges for EXPANSION-PHASE-3: (1) Cross-jurisdiction legal compliance — crawling Philippine and Malaysian government portals requires review of each country's public procurement data policy (unlike Indonesian LPSE portals, which operate under a clear 'public information' principle from PP 16/2018). Hendra Jr. plans a legal review before any cross-border crawling begins. (2) Currency and regulatory translation — cross-border tender intelligence requires translating not just language (Filipino/Bahasa Malaysia) but also the regulatory framework (different qualification requirements, different tender procedure concepts) into a format intelligible to Indonesian BUJK. Sari would need to build a Knowledge Registry sub-section for ASEAN procurement frameworks — approximately 20–30 new assets covering Philippine and Malaysian procurement systems. (3) Market readiness — BUJK appetite for cross-border procurement is currently too small to justify the investment. The EXPANSION-PHASE-3 trigger: MJP's ASEAN subscriber count (Indonesian BUJK who have won at least one cross-border tender) reaching 50 — currently 3. Hendra Jr.: 'Ekspansi ASEAN adalah ketika kita berhenti mendefinisikan pasar sebagai Indonesia — dan itu akan terjadi pada waktunya. Tapi membangun infrastruktur teknis untuk itu sekarang: bukan investasi yang benar. Ini pengalihan dari prioritas yang lebih mendesak.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.expansion_phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.expansion_phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current coverage gap: {r.current_coverage_gap}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Technical challenges: {r.technical_challenge}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Portal coverage expansion roadmap adalah Hendra Jr.'s most strategically important infrastructure investment plan — because portal coverage determines the completeness of every data-dependent product feature (Trust Score, tender alerts, award history benchmarking). A Trust Score built on 671-portal coverage: systematically underscores Eastern Indonesia BUJK relative to Western Indonesia equivalents — a fairness problem that also represents a commercial problem (Eastern Indonesia BUJK are underserved subscribers with legitimate commercial need). The 3-phase expansion (Sulawesi/Maluku Q3 2026, Papua Q1 2027, ASEAN 2028+): sequenced by commercial impact and technical feasibility. PHASE-1 addresses the most commercially impactful gap (Sulawesi/Maluku BUJK are the largest Eastern Indonesia subscriber segment and the Trust Score adjustment issue was raised in a formal GAPENSI dispute). PHASE-2 addresses the strategic investment gap (Papua infrastructure growth pipeline). PHASE-3 addresses the long-term market definition question (is MJP an Indonesia company or an ASEAN company?). The technical complexity of Eastern Indonesia expansion: significantly higher than Western Indonesia maintenance. Hendra Jr.'s time allocation for PHASE-1: 8 weeks of engineering (vs 1 day per standard portal addition in Western Indonesia). This complexity: one of the reasons the new backend engineer hire in Year 1 post-Series A is prioritized for crawler and data infrastructure work rather than product feature development. PHASE-1 and PHASE-2 together: close MJP's Eastern Indonesia coverage gap from 29% to approximately 7% (residual gap from portals that are technically too unstable to index reliably). At 7% residual gap: the Trust Score Regional Coverage Adjustment note can be retired from all Eastern Indonesia BUJK profiles — a significant milestone toward Trust Score becoming a genuinely pan-Indonesia metric rather than a Western Indonesia-weighted metric.</p>
      </div>

      {/* R117: Real-Time vs Batch Data Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> REAL-TIME vs BATCH ARCHITECTURE — Keputusan Teknis untuk Kesegaran Data yang Berbeda: 3 Kategori Data dengan Kebutuhan Freshness Berbeda, Trade-off Setiap Arsitektur, dan Rencana Hendra Jr. untuk Kebutuhan Real-Time Post-Series A
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "DATA-CATEGORY-1: Tender alerts — near-real-time (target latency < 2 jam dari publikasi LPSE)", current_architecture: "Current architecture: batch crawl every 4 hours (6 cycles/day per portal). The 4-hour interval: a compromise between crawl frequency and server resource consumption. At 671 portals × 6 cycles/day: approximately 4.000 crawl events/day. The freshness result: average tender discovery lag of 2 hours (the midpoint of the 4-hour batch cycle). The 2-hour lag: acceptable for most BUJK use cases (tender registration deadlines are typically 7–21 days from publication — a 2-hour discovery delay is commercially irrelevant for most tenders).", scaling_challenge: "Scaling challenge for near-real-time: to reduce discovery lag to under 30 minutes (the next freshness tier), Hendra Jr. would need to increase crawl frequency to every 30 minutes = 48 cycles/day per portal = 32.000 crawl events/day (8× current volume). The infrastructure cost of 8× crawl volume: significant (estimated 4× server cost, plus rate-limiting risk from LPSE portals that detect high-frequency automated access). Hendra Jr.'s assessment: the 2-hour lag is not a competitive liability at current MJP scale. The genuine use case for sub-30-minute freshness (a BUJK who is actively monitoring a specific tender in real time): served by the manual refresh button in the tender monitoring feature rather than automated crawl acceleration. Post-Series A near-real-time consideration: a selective WebSocket-based push for high-priority portal monitoring (a BUJK who is tracking a specific tender's registration deadline) rather than blanket crawl frequency increase.", tc: "text-primary" },
            { category: "DATA-CATEGORY-2: Trust Score updates — tiered freshness (award data: daily, score calculation: weekly)", current_architecture: "Trust Score updates: two-layer freshness model. Layer 1 (award data ingestion): new LPSE award records are ingested during the daily crawl batch (6×/day) — so the underlying award database reflects new awards within 4 hours of publication. Layer 2 (Trust Score calculation): re-runs weekly (Sunday 02:00 WIB) using the week's cumulative award data. The weekly recalculation: a deliberate design choice, not a technical limitation. Recalculating Trust Score daily: would produce micro-fluctuations (a single new award every day) that create noise without meaningful signal change. Weekly recalculation: produces score changes that reflect meaningful performance trends (a week's worth of new awards) rather than individual-award noise.", scaling_challenge: "The trust score freshness debate: some Enterprise subscribers have asked Reza for 'real-time Trust Score.' Hendra Jr.'s response: real-time Trust Score would produce worse decisions, not better ones. A Trust Score that changes hourly based on individual new awards: is highly volatile (a BUJK who wins one large tender on Monday has a meaningfully different score on Monday than on Friday, not because their underlying track record changed but because one data point shifted the calculation). The weekly cadence: appropriate for a metric that measures multi-year track record — one week of data should not dramatically change a score built on 5 years of award history. The exception: a new Blacklist entry (LPSE blacklist update) is ingested and reflected in Trust Score within 4 hours (within the next crawl cycle) — because blacklist status is a binary, categorical change, not a continuous score update. Hendra Jr.: 'Freshness harus sesuai dengan sifat data. Award record: membutuhkan konsistensi mingguan. Status blacklist: membutuhkan perubahan segera. Aplikasi freshness yang sama ke keduanya: mengoptimalkan yang salah dari keduanya.'", tc: "text-blue-700" },
            { category: "DATA-CATEGORY-3: Material price references — asynchronous updates (harga bahan: sesuai permintaan Sari)", current_architecture: "Material price references in the Knowledge Registry: not crawler-sourced. They are manually updated by Sari when she identifies price changes through her market monitoring (narasumber conversations, BPS price index updates, PUPR construction cost reference releases). The freshness: variable (2–4 weeks between updates in stable markets, as quickly as 48 hours in rapid-change market conditions like the 2022 commodity price spike). The architecture: intentionally not automated. The reason: material prices require editorial judgment (a BPS price index change may or may not reflect actual BUJK-relevant procurement prices), and automated price scraping from general market sources would produce inaccurate references for construction-specific procurement contexts.", scaling_challenge: "Scaling challenge: Sari's manual price monitoring is a bottleneck as MJP's Knowledge Registry scope expands to more material categories and more regional price variants (PP-011 requires both national and regional price references). The post-Series A automation option: a crawler that ingests BPS price indices and PUPR construction cost reference documents on a weekly automated basis, which Sari reviews and approves (editorial gate) before publication. The editorial gate: maintains Sari's quality control while reducing the manual search effort. This hybrid model (automated data ingestion + editorial approval gate): the same model that Sari's Expert Contributor program uses for regulatory content — a pattern that scales well. The architectural principle: automate the data gathering, preserve the human editorial judgment layer. Hendra Jr.'s timeline for the BPS + PUPR automated ingestion feature: Q3 2026 (post-Series A backend engineer contribution). This feature: directly resolves PP-011's material price reference freshness gap in a scalable way.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current architecture: {r.current_architecture}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Scaling challenge and next step: {r.scaling_challenge}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Real-time vs batch architecture adalah Hendra Jr.'s most consequential infrastructure philosophy — because the instinct of most engineers is to make everything as real-time as possible (faster = better). Hendra Jr.'s counter-instinct: freshness is appropriate to the nature of the data, and making data more real-time than it needs to be creates noise, resource waste, and occasionally worse decisions. The 3-category freshness model (tender alerts: 2-hour batch, Trust Score: daily ingest + weekly calculation, material prices: manual + editorial gate): is not a single architectural decision but 3 domain-specific decisions. Each is calibrated to: (1) the minimum freshness that creates commercial value for subscribers, (2) the maximum crawl/computation resource that is economically justified at current scale, and (3) the editorial quality level that the data type requires. The most important architectural principle: batch is default, real-time is justified exception. Batch systems are simpler to maintain, more reliable under load, and easier to debug than event-driven real-time systems. At Hendra Jr.'s solo engineer scale: simplicity and reliability are more important than freshness optimization beyond the commercial threshold. Post-Series A: with a backend engineer hire, selective real-time enhancements (blacklist-triggered Trust Score alerts, selective WebSocket tender push for high-priority monitoring) become feasible without compromising the core batch system's reliability. The freshness architecture: a case study in pragmatic engineering — choosing the simplest solution that delivers the required commercial value rather than the most technically impressive solution that delivers marginal freshness improvements at significant engineering and infrastructure cost.</p>
      </div>

      {/* R118: LPSE Portal Authentication Types */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-primary" /> LPSE PORTAL AUTHENTICATION TYPES — 6 Tipe Autentikasi yang Dihadapi Hendra Jr. di 671 Portal: Distribusi, Tingkat Kesulitan, dan Solusi Teknis untuk Setiap Tipe
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { auth_type: "AUTH-TYPE-1: SPSE 4.x public access — 341 portal (51%) — paling mudah", description: "The majority of LPSE portals (341 of 671, or 51%): use LKPP's standard SPSE 4.x platform with public tender data access (no login required to view published tender documents and award records). The data: available as HTML pages with consistent structure (SPSE 4.x's standardized interface means the same CSS selectors work across all portals). Hendra Jr.'s crawler for this auth type: the most reliable and lowest-maintenance component of the crawl architecture.", technical_solution: "Technical solution: single shared crawler module with portal-specific URL prefix configuration. The same CSS selectors, same pagination logic, same award record extraction schema — only the portal's base URL changes. Maintenance requirement: low (LKPP releases SPSE 4.x updates approximately annually — a 2–3 day crawler update when each new version changes the HTML structure). New portal onboarding time for AUTH-TYPE-1: 15 minutes (URL configuration + test run). The 341 AUTH-TYPE-1 portals: the reason MJP could reach 671-portal coverage with a single engineer — the standardization that LKPP's SPSE platform provides is the technical foundation that makes crawler scaling feasible at all.", tc: "text-primary" },
            { auth_type: "AUTH-TYPE-2: SPSE 4.x with CAPTCHA — 89 portal (13%) — CAPTCHA solving required", description: "89 portals: use SPSE 4.x with added CAPTCHA protection on their public tender listings (unusual for public data but implemented by some regional government IT teams for anti-scraping purposes). The CAPTCHA: typically a simple image-based CAPTCHA (letter/number recognition) rather than advanced behavioral CAPTCHA (which would require human solving or expensive ML services). Hendra Jr.'s crawler: uses a CAPTCHA-solving integration (a commercial service that processes image CAPTCHAs in 1–3 seconds with 97% accuracy).", technical_solution: "Technical solution: the AUTH-TYPE-1 crawler module plus a CAPTCHA intercept middleware that identifies CAPTCHA challenges (via HTTP response headers and page content patterns), submits the CAPTCHA image to the solving service, and retries the request with the solution token. Cost: the CAPTCHA solving service costs approximately Rp 1.2jt/month for MJP's current volume (approximately 15.000 CAPTCHA solutions/month from AUTH-TYPE-2 portals). The CAPTCHA cost: the single largest variable operational cost in MJP's crawler infrastructure. Post-Series A: Hendra Jr. plans to evaluate replacing the commercial CAPTCHA service with a local ML-based CAPTCHA solver (a 4–6 week project estimated to reduce CAPTCHA cost to near-zero after setup). The CAPTCHA-protected portals: concentrated in certain regional governments (Jawa Barat and DKI Jakarta account for 31 of the 89 CAPTCHA portals).", tc: "text-blue-700" },
            { auth_type: "AUTH-TYPE-3: SPSE 3.x legacy — 94 portal (14%) — HTML structure differs significantly", description: "94 portals: run the older SPSE 3.x platform (some regional governments have not upgraded). The SPSE 3.x HTML structure: significantly different from SPSE 4.x (different CSS selectors, different pagination, different tender document link patterns). The AUTH-TYPE-3 crawler: a separate module maintained in parallel with the AUTH-TYPE-1/2 module. Maintenance complexity: double — every time LKPP releases a tool that changes SPSE 3.x behavior (rare but occasional), Hendra Jr. must update 2 crawler modules instead of 1.", technical_solution: "Technical solution: a portal-version detection layer that identifies whether a portal responds to SPSE 4.x or 3.x structure patterns (based on specific unique HTML elements present in the login/listing pages). The detection: routes each crawl request to the appropriate crawler module. The 94 AUTH-TYPE-3 portals: on a 2-year transition watchlist. LKPP's SPSE 4.x migration program: has been gradually upgrading regional governments since 2022. Hendra Jr. expects AUTH-TYPE-3 portal count to decrease to approximately 40–50 by 2028 (the gradual migration timeline). Each AUTH-TYPE-3 portal that migrates to AUTH-TYPE-4: requires a one-time module switch in MJP's crawler configuration — a 30-minute technical task per portal, amortized over the 2-year transition.", tc: "text-emerald-700" },
            { auth_type: "AUTH-TYPE-4: Non-SPSE custom portals — 78 portal (12%) — bespoke per-portal crawler required", description: "78 portals: use completely custom procurement portal implementations (not SPSE at all — built by local government IT departments or commercial software vendors who won regional e-procurement system contracts). These portals: have no shared structure, no standardized HTML, and often no stable URL patterns. Each AUTH-TYPE-4 portal: requires a bespoke crawler module written specifically for that portal's unique structure. The 78 bespoke modules: represent approximately 40% of Hendra Jr.'s total crawler maintenance time despite covering only 12% of portals.", technical_solution: "Technical solution: a per-portal configuration system where each AUTH-TYPE-4 portal has its own crawler specification file (defining the specific CSS selectors, pagination logic, and award record schema for that portal). New AUTH-TYPE-4 portal onboarding: 4–6 hours of development time (reverse-engineering the portal structure + writing and testing the bespoke module). The AUTH-TYPE-4 portals: concentrated in regions where regional governments contracted private vendors for their procurement systems before LKPP's SPSE standardization program. The post-Series A backend engineer hire: will absorb approximately 60% of AUTH-TYPE-4 portal maintenance from Hendra Jr. — the single largest engineering capacity relief from the hire, freeing Hendra Jr. for AUTH-TYPE-5 and AUTH-TYPE-6 expansion. Hendra Jr.: 'Setiap kali saya menulis modul crawler baru untuk portal AUTH-TYPE-4, saya berharap pemerintah tersebut bermigrasi ke SPSE. Sampai saat itu: 78 kepingan salju yang masing-masing harus ditangani dengan caranya sendiri.'", tc: "text-orange-700" },
            { auth_type: "AUTH-TYPE-5: Login-required portals — 41 portal (6%) — kredensi akses diperlukan", description: "41 portals: require user login to access tender data (unusual for public procurement data but implemented by some agencies who restrict data to registered users). Hendra Jr.'s crawler: maintains registered accounts on these portals (registered as a general 'interested party' user, not as a BUJK bidder). The account credentials: stored in MJP's secrets management system. Each portal's login session: maintained by the crawler with automatic re-login when session tokens expire.", technical_solution: "Technical solution: a session management layer that maintains active sessions for all 41 LOGIN portals — tracking session token expiry, re-authenticating automatically, and managing rate limiting (some portals limit the number of requests per authenticated session per hour). The legal and ethical consideration: Hendra Jr. consulted with an e-procurement law advisor (2022) to confirm that registering as an interested party to access public tender documents (which are legally public information under UU Keterbukaan Informasi Publik) is legally permissible even via automated access. Conclusion: permitted, with the caveat that MJP's crawler must comply with any portal's stated terms of service (all 41 portals were reviewed for ToS compatibility). The 41 login-required portals: disproportionately represent high-value procurement agencies (ministry-level agencies that restrict LPSE data to registered accounts). High-value = high-HPS tenders = high Trust Score data quality for the BUJK who win them.", tc: "text-purple-700" },
          ].map((r) => (
            <div key={r.auth_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.auth_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Description: {r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Technical solution: {r.technical_solution}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">LPSE portal authentication types adalah the most concrete illustration of why MJP's crawler coverage is difficult to replicate — not because of the number of portals (671 is a large but finite number) but because of the heterogeneity of portal implementations that requires different technical approaches for each authentication type. A competitor who decides to 'build a portal crawler' at Series A funding: encounters the same 6 authentication types that Hendra Jr. has spent 5 years characterizing, solving, and maintaining. The AUTH-TYPE-4 portals alone: require 4–6 hours of development per portal × 78 portals = 312–468 hours of bespoke crawler engineering just for the non-standard portals. That's 8–12 weeks of a single engineer's full capacity just for one auth type. Add the 41 AUTH-TYPE-5 login portals (legal research + account registration + session management), the 89 AUTH-TYPE-2 CAPTCHA portals (CAPTCHA service integration), and the ongoing maintenance burden of all 671 portals: MJP's crawler represents 3–4 years of dedicated engineering effort for an engineer who knows what they're building from the start (with Hendra Jr.'s architecture documentation). Without documentation, from scratch, the same coverage might take 6–8 years. The documentation project (DD-4, 60% complete): MJP's most important engineering asset for due diligence and new engineer onboarding. Series A investors evaluating MJP's crawler moat: the 6 auth types, their maintenance requirements, and Hendra Jr.'s engineering documentation completeness are the most technically detailed component of Hendra Jr.'s due diligence materials — and the most convincing evidence that the 671-portal coverage is a genuine moat, not just a count.</p>
      </div>

      {/* R119: LPSE Data Freshness SLA */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-primary" /> LPSE DATA FRESHNESS SLA — Internal SLA yang Hendra Jr. Pertahankan untuk Setiap Tier Sumber Data: 4 Tier SLA, Cara Monitoring, Eskalasi saat Breach, dan Mengapa Freshness SLA Adalah Janji Produk yang Paling Mendasar kepada Subscriber
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { tier: "SLA-TIER-1: LPSE tender publications — SLA 4 jam dari publikasi ke subscriber delivery", sla_definition: "SLA definition: any tender published in any of MJP's 671 monitored LPSE portals must appear in the next morning briefing if published before 04:00, or in the following morning briefing if published after 04:00 (with an emergency alert delivered same-day via WhatsApp for high-HPS tenders above Rp 5M published in business hours). The 4-hour SLA: from portal publication to Hendra Jr.'s crawler detection. The crawl window: 02:00–04:00 daily covers all 671 portals. Any tender published after 04:00 and before 18:00: detected in the following day's 02:00–04:00 crawl.", monitoring_and_breach: "Monitoring: Hendra Jr.'s crawler maintains a 'last successful crawl' timestamp per portal. Any portal that has not been successfully crawled in 8+ hours triggers an automated alert to Hendra Jr.'s monitoring dashboard. SLA breach escalation: Hendra Jr. investigates within 30 minutes of alert (typically a portal authentication issue — CAPTCHA change, session expiry, rate limit hit). The most common SLA-TIER-1 breach cause: a SPSE 4.x template update that changes HTML structure (occurs approximately 2× per year per LKPP release cycle). Average breach duration: 6–12 hours (the time to identify the broken selector and deploy a fix). Annual TIER-1 breach budget: Hendra Jr. targets below 3 breach-days per year (0.8% availability impact).", tc: "text-primary" },
            { tier: "SLA-TIER-2: BNSP certification database — SLA 24 jam untuk SKK expiry detection", sla_definition: "SLA definition: any SKK certificate in MJP's tracked BUJK personnel database that transitions from 'valid' to 'within-90-day-expiry' or 'expired' must be detected and reflected in the subscriber's alert system within 24 hours of the transition occurring. The BNSP database: updated by BNSP on a rolling basis as examination results are processed and certificates are issued or renewed. Hendra Jr.'s crawler: checks the BNSP database for all tracked personnel every 48 hours (spread across 3 batches: Monday, Wednesday, Friday to respect BNSP's rate limits).", monitoring_and_breach: "Monitoring: a daily reconciliation check that identifies any personnel whose certificate status in BNSP differs from MJP's last recorded status and has not been updated in MJP's database within the 24-hour SLA window. SLA breach escalation: Hendra Jr. manually updates the affected personnel records within 4 hours of breach detection. The most common SLA-TIER-2 breach cause: BNSP's rate limit enforcement (during peak examination result publication periods — typically June and December — BNSP publishes thousands of results simultaneously, causing the crawler to hit rate limits across multiple batches). Reza is notified of any TIER-2 breach that affects a subscriber with an active SKK case (the highest-priority subscribers for SKK data freshness).", tc: "text-blue-700" },
            { tier: "SLA-TIER-3: Government regulatory portals (LKPP, BNSP, PUPR) — SLA 72 jam untuk regulatory change detection", sla_definition: "SLA definition: any regulatory publication or update on LKPP, BNSP, PUPR, or monitored ministry websites must be detected and reflected in the morning briefing's 'Regulasi Baru' section within 72 hours of official publication. The 72-hour SLA: longer than LPSE (4 hours) because regulatory content requires Sari's editorial review before publication (Hendra Jr. flags the raw regulatory update; Sari reviews and writes the briefing section). The 72-hour window: Hendra Jr. detection (24 hours) + Sari editorial review (24 hours) + next morning briefing inclusion (24 hours).", monitoring_and_breach: "Monitoring: Hendra Jr.'s regulatory portal crawler runs every 6 hours (less frequent than LPSE because regulatory content changes at a much lower frequency — typically 0–3 new publications per week vs 50–200 new tenders per day). SLA breach escalation: if Hendra Jr.'s detection alert is not followed by Sari's editorial action within 24 hours, Hendra Jr. pings Sari directly in their shared communication channel. The most common TIER-3 breach cause: Sari's capacity constraint during high-load editorial periods (Q2 tender season, where briefing content volume peaks). Breach resolution: Hendra Jr. writes a basic draft of the regulatory alert section that Sari reviews and edits, rather than waiting for Sari to write from scratch.", tc: "text-emerald-700" },
            { tier: "SLA-TIER-4: Third-party market data (BPS, KPPU, regional government data) — SLA 7 hari (best effort)", sla_definition: "SLA definition: publications from third-party sources (BPS construction sector statistics, KPPU competition enforcement decisions, regional government procurement announcements outside LPSE) should be detected and reflected in the Knowledge Registry or briefing within 7 business days of publication. The 'best effort' qualifier: reflects that these sources are less critical to MJP's core tender and SKK Alert products (TIER-1 and TIER-2) and have much lower publication frequency. A KPPU decision published today: relevant to Trust Score calculation but not urgently needed by subscribers before 7 days.", monitoring_and_breach: "Monitoring: manual spot-checks by Hendra Jr. (not automated — the long-tail of non-LPSE, non-BNSP sources is difficult to fully automate given the variety of website structures). Post-Series A: the backend engineer hire will be tasked with expanding the automated crawler coverage to include the most important TIER-4 sources (KPPU database, BPS construction data tables, 3–5 key regional government sites not currently fully automated). The TIER-4 SLA breach: primarily a product quality risk (Trust Score may be calculated with slightly stale KPPU data) rather than a subscriber experience risk (subscribers are not aware of TIER-4 data freshness). Hendra Jr.'s internal rule: 'TIER-1 and TIER-2 breaches are production incidents. TIER-3 breaches are high-priority work items. TIER-4 gaps are backlog items. The triage: matches the urgency to the subscriber impact.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.tier} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">SLA definition: {r.sla_definition}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Monitoring and breach: {r.monitoring_and_breach}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">LPSE data freshness SLA adalah the operational specification of MJP's most fundamental product promise — that intelligence delivered late is not intelligence, it is history. The 4-tier SLA framework (4 hours, 24 hours, 72 hours, 7 days): explicitly acknowledges that different data types have different time-value curves, and that operational resources should be allocated proportional to time-sensitivity. TIER-1 (tender publications): highest operational priority because the 4-hour half-life of tender signal value means any SLA breach directly destroys subscriber value. TIER-2 (SKK expiry): medium-high priority because a 24-hour delay in detecting an expiry that was always going to require 90+ days to address creates minimal subscriber harm — but systematic TIER-2 failures would undermine subscriber trust in the SKK Alert V2 system. TIER-3 (regulatory): medium priority because the 72-hour SLA still provides 3–12× advantage over the average BUJK awareness timeline (which is measured in months, not hours). TIER-4 (third-party): low priority for immediate subscriber experience but important for Trust Score and Knowledge Registry long-term quality. The SLA framework: not just an internal engineering standard but a subscriber commitment that Hendra documents in the 'Platform Reliability' section of the Enterprise onboarding materials. Enterprise subscribers who have negotiated their Rp 3.5jt/month contract: expect the 4-hour TIER-1 SLA as a condition of their subscription value. Hendra's transparency principle: when TIER-1 SLA breaches occur, Enterprise subscribers are notified proactively ('Kami mengalami gangguan crawl 07:00–13:00 hari ini akibat perubahan SPSE template — tender yang dipublikasikan dalam periode ini akan muncul di briefing besok dan kami mengirim WhatsApp alert untuk tender HPS besar yang terdampak'). The proactive breach communication: the most trust-preserving response to inevitable operational imperfections.</p>
      </div>

      {/* R120: Data Ethics at Scale */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> DATA ETHICS AT SCALE — Bagaimana Hendra Jr. Menavigasi 5 Batas Etika dalam Pengumpulan Data Otomatis 671 Portal: Batasan Teknis vs Batasan Etis, Tempat MJP Berhenti Meski Secara Teknis Bisa Melanjutkan, dan Mengapa Batasan Etis Adalah Keunggulan Kompetitif Jangka Panjang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { boundary: "ETHICS-BOUNDARY-1: Rate limiting sebagai pilihan etis, bukan hanya sebagai teknis — MJP crawler tidak mengambil lebih banyak data dari yang portal bisa layani tanpa hambatan", technical_possibility: "Technical possibility: most LPSE portals can be crawled at 10–20 requests/second without returning HTTP 429 errors (server's technical rate limit). At this speed, MJP's crawler could complete a full 671-portal scan in approximately 45 minutes rather than the current 6-hour crawl window.", ethical_limit: "Ethical limit: Hendra Jr.'s crawler is deliberately throttled to 1–2 requests/second per portal — below the technical rate limit but also below the level that would degrade portal performance for human users (procurement managers accessing the portal simultaneously). The ethical reasoning: LPSE portals are public-funded infrastructure primarily designed for procurement participants accessing data for legitimate bid preparation. A crawler that saturates LPSE bandwidth during business hours (09:00–16:00, when most tender-related LPSE activity occurs): may slow portal access for BUJK trying to submit qualification documents close to deadline — a real harm to real people. MJP's crawler window (01:00–07:00): chosen specifically to minimize overlap with peak human usage. The rate limit and window choice: ethical constraints that MJP would apply even if no law required them, because the harm to other portal users is real even if unintentional.", tc: "text-primary" },
            { boundary: "ETHICS-BOUNDARY-2: No account creation or authentication bypass — MJP hanya mengakses data yang tersedia secara publik tanpa autentikasi", technical_possibility: "Technical possibility: some LPSE portals contain additional data (project documents, detailed qualification requirements, evaluation committee reports) that is accessible to registered users who create accounts. Hendra Jr. could create generic BUJK accounts on each portal to access this additional data layer — a practice technically possible and legally ambiguous (LPSE accounts are intended for procurement participants, not intelligence aggregators).", ethical_limit: "Ethical limit: MJP's crawler never creates LPSE accounts or accesses data requiring authentication. The ethical reasoning: account creation on a procurement portal intended for active bidders would be a misrepresentation of MJP's role (MJP is not a procurement participant, it is an intelligence aggregator) — even if no single portal rule explicitly prohibits it. Hendra Jr.'s principle: 'Jika kami perlu menyembunyikan siapa kami untuk mendapatkan data, kami tidak seharusnya mendapatkan data itu.' The authenticated data boundary: also a practical legal risk management decision (misrepresentation on government procurement portals: potential regulatory exposure for MJP). The ethical and legal considerations: aligned in this case — the boundary that is ethically right is also legally prudent.", tc: "text-blue-700" },
            { boundary: "ETHICS-BOUNDARY-3: No competitive intelligence on private company financials — MJP tidak crawl atau agregat informasi keuangan yang melebihi apa yang disclosed dalam dokumen pengadaan", technical_possibility: "Technical possibility: some BUJK financial information (revenue ranges, bonding capacity) is disclosed in tender qualification submissions and visible in LPSE award records. Additional financial intelligence (bank account information, tax filings, ownership structure beyond the level disclosed in pengadaan documents) is sometimes findable through cross-referencing multiple government databases (Ditjen Pajak records, AHU ownership registries).", ethical_limit: "Ethical limit: MJP's Trust Score never incorporates financial intelligence beyond what is explicitly disclosed in public procurement documents. Hendra Jr. does not cross-reference BUJK procurement data with tax authority databases or corporate registry details beyond basic legal status. The ethical reasoning: BUJK who disclose financial information in procurement submissions: do so in the context of a specific procurement evaluation, not with general consent for that information to be aggregated into a competitive intelligence product that other BUJK can purchase. Using procurement-disclosed financial information for purposes beyond procurement evaluation: a secondary use that the original discloser did not consent to — ethically problematic even if the data is technically public. MJP's financial data boundary: a proactive ethical choice that may become legally required as Indonesia's data privacy framework (UU PDP) matures.", tc: "text-emerald-700" },
            { boundary: "ETHICS-BOUNDARY-4: Transparent about data limitations — MJP tidak menyembunyikan gap, inkonsistensi, atau keterbatasan dalam data yang dikumpulkan", technical_possibility: "Technical possibility: MJP could present Trust Score and tender data without surfacing data confidence flags, data freshness indicators, or coverage gaps (portals not crawled successfully in the last 7 days). This would make the product appear more comprehensive and definitive than it actually is — potentially increasing subscriber satisfaction with the surface presentation while hiding underlying data quality limitations.", ethical_limit: "Ethical limit: every Trust Score, tender alert, and regulatory update in MJP's products carries explicit data confidence and freshness indicators. Portal crawl gaps are surfaced in the briefing (not hidden). Trust Score components with data age warnings are displayed with visible caveats. The ethical reasoning: subscribers make real financial decisions (bid/no-bid on specific tenders, compliance investments based on regulatory updates) based on MJP's data. A subscriber who makes a wrong decision because MJP hid a data quality limitation: has been harmed by MJP's editorial dishonesty. The transparency obligation: proportional to the decision stakes. MJP's decisions are high-stakes. The transparency standard: correspondingly high. Hendra Jr.'s principle: 'Data confidence indicators make our product look less polished. They make our product more trustworthy. We choose trustworthy every time — because a subscriber who trusts our confidence intervals will use our data more effectively than a subscriber who assumes perfect confidence and is surprised when the data is wrong.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.boundary} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.boundary}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Technical possibility: {r.technical_possibility}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Ethical limit: {r.ethical_limit}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data ethics at scale adalah the operational philosophy that distinguishes MJP's data infrastructure from the maximum-extraction approach that many data companies default to. The 4 ethical boundaries (rate limiting as choice, no authentication bypass, no beyond-disclosure financial data, transparent limitations): are all cases where MJP stops short of what is technically possible — deliberately. The competitive advantage of ethical self-constraint: counterintuitive but real. In the short term, ethical constraints mean MJP's data is slightly less comprehensive than what aggressive crawling would produce. In the long term: ethical constraints mean MJP's data infrastructure is not exposed to the regulatory, reputational, or legal risks that aggressive data collection practices accumulate over years of operation. Indonesia's UU PDP (Personal Data Protection Law): enacted 2022, with enforcement intensifying in 2024–2026. The LPSE-adjacent data landscape: increasingly scrutinized by government agencies who are aware that third-party crawlers aggregate public procurement data. MJP's ethical crawling practices: the reason Hendra Jr. is confident that MJP's data infrastructure will not need a compliance overhaul when regulatory scrutiny of automated data collection intensifies. The compliance readiness: built into the data collection design, not retrofitted after a regulatory notice. Hendra's investor communication on data ethics: 'We could have more data if we were less careful. We chose to be more careful because we are building a company that will be around in 20 years — and data companies that accumulated data through ethically questionable means in their early years consistently face painful regulatory reckoning in their mature years. We are making the 20-year bet: that our ethical data infrastructure will be a competitive advantage when Indonesian regulatory frameworks catch up to the practices of data aggregators in our sector.' The 20-year bet: the data ethics boundary that Hendra Jr. calls the most important architectural decision he made in MJP's infrastructure design — one that cannot be changed retroactively without rebuilding the entire data collection system from scratch.</p>
      </div>

      {/* Source Cards */}
      {(() => {
        let srcs = DATA_SOURCES.filter(s => !categoryFilter || s.category === categoryFilter);
        if (showPinnedOnly) srcs = srcs.filter(s => pinnedSources.has(s.id));
        if (showNotesOnly) srcs = srcs.filter(s => !!(sourceNotes[s.id] ?? "").trim());
        if (sortByCrawled) srcs = [...srcs].sort((a, b) => {
          const ta = schedulerResults[a.id]?.savedAt ? new Date(schedulerResults[a.id].savedAt).getTime() : 0;
          const tb = schedulerResults[b.id]?.savedAt ? new Date(schedulerResults[b.id].savedAt).getTime() : 0;
          return tb - ta;
        });
        if (srcs.length === 0) return (
          <div className="border border-dashed rounded-sm p-8 text-center text-muted-foreground text-sm font-mono col-span-full flex flex-col items-center gap-2">
            <span>Tidak ada sumber data sesuai filter.</span>
            <button
              className="text-xs font-mono text-primary underline underline-offset-2 hover:opacity-80"
              onClick={() => { setCategoryFilter(""); setShowPinnedOnly(false); setShowNotesOnly(false); }}
            >
              Reset filter
            </button>
          </div>
        );
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{srcs.map((source) => {
          const isFetching = activeSourceId === source.id;
          const isScheduling = schedulerTriggering === source.id;
          const fetchResult = fetchResults[source.id];
          const schedResult = schedulerResults[source.id];
          const catColor = CATEGORY_COLORS[source.category] ?? "bg-muted text-muted-foreground";
          const mkrEntry = scheduleBySourceId[source.id];

          return (
            <Card
              id={`source-card-${source.id}`}
              key={source.id}
              className={cn(
                "group flex flex-col transition-all duration-300 hover:bg-muted/40 hover:shadow-sm",
                highlightSourceId === source.id && "ring-2 ring-blue-400 ring-offset-2",
                pinnedSources.has(source.id) && "border-amber-300 bg-amber-50/40"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5 leading-tight">
                    <button
                      onClick={() => togglePin(source.id)}
                      aria-label={pinnedSources.has(source.id) ? "Hapus pin sumber ini" : "Pin sumber data ini"}
                      className={cn("shrink-0 transition-all", pinnedSources.has(source.id) ? "text-amber-500 opacity-100" : "text-muted-foreground/40 hover:text-amber-400 opacity-0 group-hover:opacity-100")}
                      title={pinnedSources.has(source.id) ? "Hapus pin" : "Pin sumber ini"}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                    <Globe className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate" title={source.name}>{source.name}</span>
                  </CardTitle>
                  {mkrEntry && (
                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${
                      mkrEntry.businessValue >= 9 ? "bg-red-100 text-red-700" :
                      mkrEntry.businessValue >= 7 ? "bg-orange-100 text-orange-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      BV {mkrEntry.businessValue}
                    </span>
                  )}
                  {mkrEntry?.businessValue >= 9 && mkrEntry.lastCrawledAt === null && (
                    <Badge
                      variant="destructive"
                      className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0"
                    >
                      BELUM ADA DATA
                    </Badge>
                  )}
                </div>
                <CardDescription className="font-mono text-[10px] mt-0.5" title={source.url}>
                  {source.url.replace("https://", "").slice(0, 40)}{source.url.replace("https://", "").length > 40 ? "…" : ""}
                </CardDescription>
                <div className="pt-1.5 flex flex-wrap gap-1.5 items-center">
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border ${catColor}`} title={source.category.replace(/_/g, " ")}>
                    {source.category.replace(/_/g, " ")}
                  </span>
                  {mkrEntry && (
                    <span className="text-[8px] font-mono text-muted-foreground flex items-center gap-0.5">
                      <Timer className="h-2.5 w-2.5" />
                      {mkrEntry.prioritasCrawl}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 text-xs text-muted-foreground pb-3">
                <p className="line-clamp-2" title={source.description}>{source.description}</p>

                {/* MKR schedule info — last crawled & next scheduled */}
                {mkrEntry && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1 font-mono text-[10px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> Terakhir
                      </span>
                      {mkrEntry.lastCrawledAt ? (() => {
                        const ageDays = (Date.now() - new Date(mkrEntry.lastCrawledAt).getTime()) / 86400000;
                        const color = ageDays < 3 ? "text-emerald-700" : ageDays < 7 ? "text-amber-600" : "text-red-600";
                        return (
                          <span className={cn("font-semibold", color)} title={ageDays < 3 ? "Data segar" : ageDays < 7 ? "Data mulai usang" : "Data sudah lama, pertimbangkan crawl ulang"}>
                            {format(new Date(mkrEntry.lastCrawledAt), "HH:mm dd/MM")}
                            {ageDays >= 7 && <span className="ml-1 text-[8px] font-bold border border-red-300 rounded-sm px-0.5">Kedaluwarsa</span>}
                          </span>
                        );
                      })() : (
                        <span className="text-muted-foreground/60">Belum pernah</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Timer className="h-2.5 w-2.5" /> Jadwal
                      </span>
                      {mkrEntry.nextScheduledAt ? (() => {
                        const minsLeft = Math.round((new Date(mkrEntry.nextScheduledAt).getTime() - Date.now()) / 60000);
                        const countdown = minsLeft <= 0 ? "Sekarang" : minsLeft < 60 ? `${minsLeft} mnt` : `${Math.floor(minsLeft / 60)}j ${minsLeft % 60}m`;
                        return (
                          <span className="text-primary font-semibold" title={format(new Date(mkrEntry.nextScheduledAt), "HH:mm dd/MM")}>
                            {countdown}
                          </span>
                        );
                      })() : (
                        <span className="text-muted-foreground/60">Manual</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Source health indicator (when no MKR entry and no results) */}
                {!mkrEntry && !fetchResult && !schedResult && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                    <span className="text-[9px] font-mono text-muted-foreground">Belum dicrawl sesi ini</span>
                  </div>
                )}

                {/* Scheduler result badge */}
                {schedResult && (
                  <div className="mt-3 pt-2.5 border-t border-border flex flex-col gap-1 font-mono text-[10px]">
                    <div className="flex items-center gap-1 text-emerald-700">
                      <CircleCheck className="h-3 w-3" />
                      <span className="font-semibold">Scheduler OK · {schedResult.itemsSaved} item</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(schedResult.savedAt), "HH:mm:ss dd/MM")}</span>
                    </div>
                  </div>
                )}

                {/* Fetch result */}
                {fetchResult && (
                  <div className="mt-3 pt-2.5 border-t border-border flex flex-col gap-1 font-mono text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="flex items-center gap-1 font-bold">
                        {getStatusIcon(fetchResult.status)} {fetchResult.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Waktu:</span>
                      <span>{format(new Date(fetchResult.fetchedAt), "HH:mm:ss")}</span>
                    </div>
                    {fetchResult.items && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Item:</span>
                        <span>{fetchResult.items.length} diekstrak</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="pt-0 flex flex-col gap-1.5">
                {/* Per-source quick note */}
                <textarea
                  value={sourceNotes[source.id] ?? ""}
                  onChange={(e) => updateSourceNote(source.id, e.target.value)}
                  onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                  placeholder="Catatan sumber..."
                  rows={1}
                  maxLength={300}
                  className="w-full border rounded-sm px-2 py-1 text-[10px] resize-none bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-background transition-colors"
                />
                <p className="text-[9px] font-mono text-muted-foreground text-right">{(sourceNotes[source.id] ?? "").length} / 300</p>
                {/* Scheduler per-source trigger */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full font-mono text-[10px] h-8 gap-1"
                  onClick={() => handleSchedulerTrigger(source)}
                  disabled={isScheduling || isFetching || isJobRunning}
                >
                  {isScheduling ? (
                    <><LoaderCircle className="h-3 w-3 animate-spin" /> Scheduler berjalan…</>
                  ) : (
                    <><Zap className="h-3 w-3" /> Jalankan Scheduler</>
                  )}
                </Button>
                {/* Manual fetch */}
                <Button
                  size="sm"
                  className="w-full font-mono text-[10px] h-8 gap-1"
                  onClick={() => handleFetch(source)}
                  disabled={isFetching || isScheduling}
                >
                  {isFetching ? (
                    <><LoaderCircle className="h-3 w-3 animate-spin" /> Mengambil…</>
                  ) : (
                    <><RefreshCw className="h-3 w-3" /> Ambil Manual</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}</div>})()}

      {/* Fetched items results */}
      {Object.entries(fetchResults).some(([, res]) => res.items && res.items.length > 0) && (
        <div className="flex flex-col gap-4">
          <h2 className="font-mono font-bold text-sm uppercase tracking-widest border-b pb-2">Hasil Fetch Manual</h2>
          <div className="grid gap-3">
            {Object.entries(fetchResults).map(([sourceId, res]) => {
              if (!res.items || res.items.length === 0) return null;
              const sourceInfo = DATA_SOURCES.find((s) => s.id === sourceId);
              return res.items.map((item: FetchedItem, idx: number) => (
                <Card key={`${sourceId}-${idx}`} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="p-3 bg-muted/20 border-r md:w-[180px] flex flex-col justify-between shrink-0 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <Badge className="font-mono text-[9px] bg-primary text-primary-foreground w-fit">{res.sourceLabel}</Badge>
                        {item.category && <Badge variant="outline" className={`font-mono text-[9px] w-fit ${CATEGORY_COLORS[item.category] ?? ""}`} title={DC_CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ")}>{DC_CATEGORY_LABELS[item.category] ?? item.category.replace(/_/g, " ")}</Badge>}
                      </div>
                      <a href={item.url || res.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-1 hover:underline font-mono transition-colors">
                        <ExternalLink className="h-3 w-3" /> Link Asli
                      </a>
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <h4 className="font-bold text-sm mb-1" title={item.title}>{item.title}</h4>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-3" title={item.content}>{item.content}</p>
                      <div className="mt-auto self-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-[10px] font-mono"
                          disabled={item.savedAsResearchItem || createResearchItemMutation.isPending}
                          onClick={() => handleSaveToResearch(item, res.sourceLabel, sourceInfo?.category || "LAINNYA", sourceId, idx)}
                        >
                          {item.savedAsResearchItem ? (
                            <><CircleCheck className="h-3 w-3 mr-1" /> Tersimpan</>
                          ) : createResearchItemMutation.isPending ? (
                            <><LoaderCircle className="h-3 w-3 mr-1 animate-spin" /> Menyimpan…</>
                          ) : (
                            <><Save className="h-3 w-3 mr-1" /> Simpan ke Riset</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ));
            })}
          </div>
        </div>
      )}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
