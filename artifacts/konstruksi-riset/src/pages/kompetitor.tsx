import { useState, useMemo, useRef, useEffect, useDeferredValue } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Activity, ArrowUpRight, BookOpen, Building2, CalendarCheck, Castle, ChartBar, ChartColumnBig, ChartPie, ChevronDown, ChevronRight, ChevronUp, CircleCheck, CircleX, ClipboardList, Clock, Copy, Database, DollarSign, ExternalLink, Eye, EyeOff, Flame, FlaskConical, Globe, Handshake, LayoutGrid, Loader2, MessageCircle, Minus, Plus, RefreshCw, ScanSearch, Search, Shield, ShieldAlert, Star, StickyNote, Swords, Target, Telescope, TrendingDown, TrendingUp, TriangleAlert, Trophy, Users, X, Zap } from "lucide-react";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// ─── Static competitor database ───────────────────────────────────────────────
import { useListResearchItems, useListCompetitorSignals, getListCompetitorSignalsQueryKey, useGetMkrCrawlSchedule, getGetMkrCrawlScheduleQueryKey, useTriggerSchedulerForSource } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Competitor {
  id: string;
  nama: string;
  url: string;
  tagline: string;
  ukuran: "BESAR" | "MENENGAH" | "KECIL";
  segment: string[];
  layanan: string[];
  hargaRange: string;
  hargaDetail: { item: string; harga: string }[];
  kekuatan: string[];
  kelemahan: string[];
  ancamanUntukKita: string[];
  peluangDariMereka: string[];
  rating: number; // 1-5
  catatan: string;
  terakhirDimonitor: string;
}

const COMPETITORS: Competitor[] = [
  {
    id: "c1",
    nama: "IjinTender.co.id",
    url: "https://www.ijintender.co.id/",
    tagline: "Platform pengurusan SBU, SKK, dan pendampingan tender terpadu",
    ukuran: "MENENGAH",
    segment: ["BUJK Kecil", "BUJK Menengah", "Kontraktor Individual"],
    layanan: ["Pengurusan SBU", "Pengurusan SKK", "Pengurusan NIB/OSS", "Pendampingan Tender LPSE", "Konsultasi IUJK"],
    hargaRange: "Rp 3.000.000 – Rp 25.000.000",
    hargaDetail: [
      { item: "Pengurusan SBU Kecil", harga: "Rp 3.500.000 – Rp 8.000.000" },
      { item: "Pengurusan SBU Menengah", harga: "Rp 8.000.000 – Rp 15.000.000" },
      { item: "Pengurusan SKK Jenjang 7", harga: "Rp 3.000.000 – Rp 5.000.000" },
      { item: "Pendampingan Tender", harga: "Rp 5.000.000 – Rp 25.000.000 per paket" },
    ],
    kekuatan: [
      "Brand yang sudah dikenal di pasar SBU/SKK",
      "Proses pengurusan yang sudah terstandarisasi",
      "Database referensi harga yang transparan di website",
      "Volume klien tinggi — skala ekonomis",
    ],
    kelemahan: [
      "Tidak ada layanan monitoring SBU/SKK pasca-pengurusan",
      "Tidak ada platform data intelijen untuk klien",
      "Pendekatan transaksional — tidak ada layanan advisory berkelanjutan",
      "Tidak menyediakan analisis tender atau strategi penawaran",
    ],
    ancamanUntukKita: [
      "Harga pengurusan SBU/SKK yang lebih rendah dan sudah dikenal",
      "Jaringan yang luas dan reputasi yang sudah terbentuk",
    ],
    peluangDariMereka: [
      "Klien IjinTender yang butuh lebih dari sekadar pengurusan dokumen",
      "Upsell ke layanan monitoring expiry, analisis tender, dan strategi",
      "Segmen BUJK yang tidak puas dengan layanan transaksional",
    ],
    rating: 3,
    catatan: "Kompetitor langsung utama di segmen SBU/SKK. Mereka unggul di volume dan harga, kita unggul di nilai tambah intelijen dan advisory.",
    terakhirDimonitor: "2026-08-01",
  },
  {
    id: "c2",
    nama: "Konsultan SBU Konstruksi (Platform Umum)",
    url: "https://tokopedia.com",
    tagline: "Pengurusan SBU/SKK via marketplace (Tokopedia, Shopee)",
    ukuran: "KECIL",
    segment: ["BUJK Kecil", "Kontraktor Perseorangan"],
    layanan: ["Pengurusan SBU", "Pengurusan SKK", "Pembuatan Akta PT"],
    hargaRange: "Rp 1.500.000 – Rp 8.000.000",
    hargaDetail: [
      { item: "SBU Kecil via marketplace", harga: "Rp 1.500.000 – Rp 4.000.000" },
      { item: "SKK via marketplace", harga: "Rp 1.500.000 – Rp 3.500.000" },
    ],
    kekuatan: [
      "Harga paling murah di pasar",
      "Mudah ditemukan via pencarian Tokopedia/Shopee",
      "Proses cepat untuk dokumen standar",
    ],
    kelemahan: [
      "Tidak ada layanan after-sale / monitoring",
      "Kualitas dan legalitas konsultan tidak terverifikasi",
      "Tidak bisa menangani kasus kompleks atau sengketa",
      "Tidak ada intelijen bisnis atau advisory",
    ],
    ancamanUntukKita: [
      "Segmen price-sensitive yang hanya butuh dokumen tanpa advisory",
      "Mudah ditemukan via search engine dan marketplace",
    ],
    peluangDariMereka: [
      "Klien yang kecewa dengan kualitas layanan murah dan butuh upgrade",
      "Segmen yang sudah bermasalah dan perlu remedial",
    ],
    rating: 2,
    catatan: "Kompetitor harga rendah. Bukan kompetitor langsung untuk segmen advisory — tapi perlu dipantau karena ambil volume pasar.",
    terakhirDimonitor: "2026-08-01",
  },
  {
    id: "c3",
    nama: "GAPENSI / Asosiasi Konstruksi (Layanan Member)",
    url: "https://www.gapensi.or.id/",
    tagline: "Layanan sertifikasi dan training untuk anggota asosiasi",
    ukuran: "BESAR",
    segment: ["Anggota Asosiasi BUJK", "Kontraktor Menengah-Besar"],
    layanan: ["SBU via asosiasi", "Pelatihan SKK", "Advokasi regulasi", "Informasi tender anggota"],
    hargaRange: "Biaya keanggotaan + layanan",
    hargaDetail: [
      { item: "Keanggotaan tahunan", harga: "Rp 2.000.000 – Rp 10.000.000/tahun" },
      { item: "SBU via jalur asosiasi", harga: "Subsidi anggota" },
    ],
    kekuatan: [
      "Jalur SBU yang lebih mudah via rekomendasi asosiasi",
      "Networking dan akses informasi tender eksklusif",
      "Representasi ke LPJK dan Kementerian PUPR",
    ],
    kelemahan: [
      "Tidak ada platform data intelijen",
      "Proses birokrasi dan lambat",
      "Tidak ada layanan digital atau real-time monitoring",
      "Fokus pada advokasi, bukan pada eksekusi bisnis klien",
    ],
    ancamanUntukKita: [
      "BUJK yang sudah tergabung mungkin tidak butuh layanan tambahan",
      "Legitimasi asosiasi yang sulit disamai",
    ],
    peluangDariMereka: [
      "Anggota asosiasi yang butuh layanan lebih dari sekadar keanggotaan",
      "Data riset intelijen yang tidak disediakan asosiasi",
      "BUJK yang keluar atau tidak puas dengan layanan asosiasi",
    ],
    rating: 3,
    catatan: "Bukan kompetitor langsung di segmen intelijen, tapi bersaing di layanan SBU/SKK. Potensi kemitraan dengan asosiasi.",
    terakhirDimonitor: "2026-08-01",
  },
  {
    id: "c4",
    nama: "Konsultan ISO / Sistem Manajemen (Lokal)",
    url: "",
    tagline: "Pendampingan sertifikasi ISO 9001, 14001, 45001, 37001 untuk perusahaan konstruksi",
    ukuran: "KECIL",
    segment: ["BUJK Menengah", "Perusahaan konstruksi yang ingin ISO"],
    layanan: ["Gap Analysis ISO", "Implementasi ISO", "Pendampingan Sertifikasi", "Training Internal Audit"],
    hargaRange: "Rp 15.000.000 – Rp 80.000.000",
    hargaDetail: [
      { item: "Gap Analysis ISO 9001", harga: "Rp 5.000.000 – Rp 15.000.000" },
      { item: "Implementasi + Sertifikasi ISO 9001", harga: "Rp 25.000.000 – Rp 60.000.000" },
      { item: "Paket ISO 37001 (SMAP)", harga: "Rp 20.000.000 – Rp 80.000.000" },
    ],
    kekuatan: [
      "Spesialisasi mendalam di ISO dan sistem manajemen",
      "Sudah punya template dokumen dan SOP baku",
      "Jaringan ke CB (Certification Body) tertentu",
    ],
    kelemahan: [
      "Tidak ada layanan monitoring pasca-sertifikasi",
      "Tidak mengintegrasikan intelijen pasar atau tender",
      "Layanan sering sekali jalan — tidak berkelanjutan",
    ],
    ancamanUntukKita: [
      "Jika masuk ke segmen SMAP/ISO — mereka sudah established",
      "Harga bersaing untuk layanan pure ISO consulting",
    ],
    peluangDariMereka: [
      "Bundling ISO + SBU + tender intelligence dalam satu paket",
      "Klien ISO yang kemudian butuh pendampingan tender",
      "Monitoring surveillance setelah sertifikasi yang tidak ditawarkan kompetitor",
    ],
    rating: 3,
    catatan: "Kompetitor di segmen SMAP/ISO. Peluang bundling layanan — mereka tidak punya komponen tender/SBU/intelijen.",
    terakhirDimonitor: "2026-08-01",
  },
  {
    id: "c5",
    nama: "Platform Tender Digital (TenderIndonesia, IndoTender)",
    url: "https://www.tender-indonesia.com/",
    tagline: "Agregator informasi tender dari seluruh Indonesia",
    ukuran: "MENENGAH",
    segment: ["Semua BUJK", "Tim Pemasaran Konstruksi"],
    layanan: ["Informasi tender harian", "Alert tender by kategori", "Database tender historis"],
    hargaRange: "Rp 500.000 – Rp 3.000.000/bulan (langganan)",
    hargaDetail: [
      { item: "Langganan basic tender alert", harga: "Rp 500.000 – Rp 1.500.000/bulan" },
      { item: "Langganan pro dengan filter lanjutan", harga: "Rp 2.000.000 – Rp 3.000.000/bulan" },
    ],
    kekuatan: [
      "Database tender yang sangat besar",
      "Alert otomatis sesuai subklasifikasi",
      "Sudah menjadi habit pengguna yang setia",
    ],
    kelemahan: [
      "Hanya informasi — tidak ada analisis atau strategi",
      "Tidak ada integrasi SBU/SKK status",
      "Tidak ada analisis kompetitor atau estimasi peluang menang",
    ],
    ancamanUntukKita: [
      "BUJK yang sudah berlangganan mungkin tidak butuh layanan tender lain",
      "Harga murah untuk data tender mentah",
    ],
    peluangDariMereka: [
      "Bundling intelijen tender: filter + analisis kualifikasi + strategi + SBU check",
      "Segmen yang butuh lebih dari sekadar daftar tender",
    ],
    rating: 2,
    catatan: "Kompetitor parsial di segmen data tender. Kita unggul di analisis, strategi, dan integrasi dengan SBU/SKK status.",
    terakhirDimonitor: "2026-08-01",
  },
  {
    id: "c6",
    nama: "Konsultan Independen LinkedIn/Freelance",
    url: "https://www.linkedin.com/",
    tagline: "Konsultan lepas yang menawarkan jasa SBU/SKK/tender via media sosial",
    ukuran: "KECIL",
    segment: ["BUJK Kecil", "Perseorangan"],
    layanan: ["Pengurusan SBU/SKK mandiri", "Pendampingan tender", "Konsultasi regulasi"],
    hargaRange: "Rp 1.000.000 – Rp 10.000.000 per project",
    hargaDetail: [
      { item: "Konsultasi SBU (project-based)", harga: "Rp 1.000.000 – Rp 5.000.000" },
      { item: "Pendampingan tender end-to-end", harga: "Rp 3.000.000 – Rp 10.000.000" },
    ],
    kekuatan: [
      "Biaya lebih murah karena tidak ada overhead kantor",
      "Hubungan personal dan fleksibilitas tinggi",
      "Bisa ditemukan via LinkedIn, Instagram, dan referral",
    ],
    kelemahan: [
      "Tidak ada platform atau sistem terstruktur",
      "Ketergantungan pada satu orang — tidak skalabel",
      "Tidak ada jaminan kualitas, SLA, atau after-sales",
      "Tidak ada data intelijen atau tools pendukung",
    ],
    ancamanUntukKita: [
      "Harga sangat kompetitif untuk segmen sensitif biaya",
      "Referral dari mulut ke mulut sulit dilawan dengan marketing digital",
    ],
    peluangDariMereka: [
      "Klien yang kecewa dengan layanan ad-hoc dan butuh sistem yang lebih andal",
      "Freelancer yang bisa menjadi mitra atau reseller platform kita",
    ],
    rating: 2,
    catatan: "Fragmented market — sulit dipantau tapi jangan diabaikan. Segmen ini menunjukkan demand yang besar untuk layanan terjangkau.",
    terakhirDimonitor: "2026-08-01",
  },
  {
    id: "c7",
    nama: "BimaTek / Lembaga Pelatihan SKK Konstruksi",
    url: "https://www.bimateknik.co.id/",
    tagline: "Lembaga pelatihan dan uji kompetensi SKK konstruksi terakreditasi LPJK",
    ukuran: "MENENGAH",
    segment: ["Tenaga Ahli Konstruksi", "BUJK yang butuh SKK"],
    layanan: ["Pelatihan SKK Jenjang 7/8/9", "Uji Kompetensi", "Sertifikasi Tenaga Kerja Konstruksi"],
    hargaRange: "Rp 2.000.000 – Rp 12.000.000 per peserta",
    hargaDetail: [
      { item: "Pelatihan + Uji Kompetensi SKK Jenjang 7", harga: "Rp 2.000.000 – Rp 5.000.000" },
      { item: "Pelatihan + Uji Kompetensi SKK Jenjang 8", harga: "Rp 4.000.000 – Rp 8.000.000" },
      { item: "Pelatihan + Uji Kompetensi SKK Jenjang 9", harga: "Rp 7.000.000 – Rp 12.000.000" },
    ],
    kekuatan: [
      "Akreditasi resmi sebagai LSP (Lembaga Sertifikasi Profesi) dari LPJK",
      "Pengalaman panjang di bidang pelatihan konstruksi",
      "Jaringan ke perusahaan konstruksi besar",
    ],
    kelemahan: [
      "Tidak ada layanan monitoring pasca-sertifikasi",
      "Tidak ada platform digital atau data intelijen",
      "Fokus pada sertifikasi — tidak ada advisory bisnis",
    ],
    ancamanUntukKita: [
      "BUJK yang mengurus SKK via lembaga ini tidak butuh layanan konsultan SKK",
      "Jaringan ke perusahaan besar yang bisa menjadi klien kita",
    ],
    peluangDariMereka: [
      "Tenaga ahli yang baru dapat SKK tapi belum tahu cara menggunakannya di tender",
      "BUJK pelanggan BimaTek yang butuh monitor expiry SKK + analytics",
      "Kemitraan: BimaTek sertifikasi, kita monitoring + intelijen tender",
    ],
    rating: 3,
    catatan: "Kompetitor tidak langsung di layanan SKK. Peluang kemitraan signifikan — mereka sertifikasi, kita pantau dan optimalkan nilai SKK.",
    terakhirDimonitor: "2026-08-01",
  },
  {
    id: "c8",
    nama: "Platform SaaS Manajemen Proyek Konstruksi (Buildcom, dll)",
    url: "https://buildcom.id",
    tagline: "Manajemen proyek dan administrasi konstruksi berbasis cloud",
    ukuran: "MENENGAH",
    segment: ["BUJK Menengah-Besar", "Kontraktor dengan banyak proyek"],
    layanan: ["Manajemen proyek digital", "RAB & cashflow tools", "Progres proyek tracking", "Laporan kepada owner"],
    hargaRange: "Rp 500.000 – Rp 5.000.000/bulan (SaaS)",
    hargaDetail: [
      { item: "Paket Starter (1 proyek)", harga: "Rp 500.000 – Rp 1.500.000/bulan" },
      { item: "Paket Pro (unlimited proyek)", harga: "Rp 2.500.000 – Rp 5.000.000/bulan" },
    ],
    kekuatan: [
      "UI modern dan user-friendly",
      "Fitur manajemen proyek yang komprehensif",
      "Integrasi dengan tools keuangan dan perbankan",
    ],
    kelemahan: [
      "Tidak ada komponen SBU/SKK atau regulasi konstruksi",
      "Tidak ada data intelijen tender atau kompetitor",
      "Tidak menjawab kebutuhan compliance LPJK",
    ],
    ancamanUntukKita: [
      "Jika masuk ke ranah compliance + tender, bisa menjadi kompetitor serius",
      "Budget software BUJK yang sudah dialokasikan ke platform ini",
    ],
    peluangDariMereka: [
      "Bundling: platform mereka untuk ops, kita untuk compliance + intelijen pasar",
      "Integrasi data: mereka punya data proyek, kita punya data tender — bisa saling melengkapi",
      "BUJK yang sudah digital-ready — lebih mudah menerima platform intelijen baru",
    ],
    rating: 2,
    catatan: "Kompetitor tidak langsung — fokus di ops, bukan compliance. Peluang partnership atau integrasi API di masa depan.",
    terakhirDimonitor: "2026-08-02",
  },
];

// ─── Service comparison matrix ─────────────────────────────────────────────────

const OUR_SERVICES = [
  { label: "Data Intelijen Real-time", weHave: true, notes: "64 sumber, update 07:00 WIB" },
  { label: "Monitor SBU/SKK Expiry", weHave: true, notes: "Alert 90 hari sebelum habis" },
  { label: "Analisis Peluang Tender", weHave: true, notes: "LPSE + BUMN + filter AI" },
  { label: "Pain Point CPKB (39 masalah)", weHave: true, notes: "Database masalah + peluang layanan" },
  { label: "Pengurusan Dokumen SBU/SKK", weHave: false, notes: "Jasa konsultan mitra diperlukan" },
  { label: "Platform Digital AI Agent", weHave: true, notes: "4 AI agents spesialis" },
  { label: "Workroom Tim Riset", weHave: true, notes: "Perumusan masalah → layanan" },
  { label: "Surat Penawaran Generator", weHave: true, notes: "23 template layanan + kategori Audit" },
  { label: "Monitoring SMAP ISO 37001", weHave: true, notes: "Data LPJK ketidaksesuaian" },
  { label: "Training / Pelatihan SKK", weHave: false, notes: "Belum ada, peluang pengembangan" },
];

const COMPETITOR_MATRIX: Record<string, boolean[]> = {
  "c1": [false, false, false, false, true, false, false, false, false, false],
  "c2": [false, false, false, false, true, false, false, false, false, false],
  "c3": [false, false, false, false, true, false, false, false, false, true],
  "c4": [false, false, false, false, false, false, false, false, true, true],
  "c5": [false, false, true, false, false, false, false, false, false, false],
  "c6": [false, false, false, false, true, false, false, false, false, false],
  "c7": [false, false, false, false, false, false, false, false, false, true],
  "c8": [false, false, false, false, false, false, false, false, false, false],
};

const SIZE_COLORS: Record<string, string> = {
  BESAR: "bg-blue-100 text-blue-700 border-blue-300",
  MENENGAH: "bg-yellow-100 text-yellow-700 border-yellow-300",
  KECIL: "bg-slate-100 text-slate-600 border-slate-300",
};

export default function Kompetitor() {
  const [activeView, setActiveView] = useState<"kartu" | "matrix">("kartu");
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Intelijen Kompetitor — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const [sortByThreat, setSortByThreat] = useState(false);
  const [showKompNotesOnly, setShowKompNotesOnly] = useState(false);
  const [kompNotes, setKompNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-komp-notes") ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const [savedKompNoteId, setSavedKompNoteId] = useState<string | null>(null);
  const updateKompNote = (id: string, val: string) => setKompNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-komp-notes", JSON.stringify(next)); } catch { /* ignore */ }
    setSavedKompNoteId(id);
    toast.success("Catatan disimpan", { duration: 1200 });
    setTimeout(() => setSavedKompNoteId(s => s === id ? null : s), 2000);
    return next;
  });

  const queryClient = useQueryClient();
  const { data: researchItems } = useListResearchItems();
  const { data: competitorSignals, refetch: refetchSignals } = useListCompetitorSignals({ dataSourceSite: "www.ijintender.co.id", limit: 20 });
  const { data: mkrSchedule, refetch: refetchSchedule } = useGetMkrCrawlSchedule({ query: { queryKey: getGetMkrCrawlScheduleQueryKey(), staleTime: 60_000 } });
  const crawlNow = useTriggerSchedulerForSource({
    mutation: {
      onSuccess: () => {
        toast.success("Crawl IjinTender selesai", { description: "Data harga telah diperbarui", duration: 3000 });
        void refetchSignals();
        void refetchSchedule();
        void queryClient.invalidateQueries({ queryKey: getListCompetitorSignalsQueryKey({ dataSourceSite: "www.ijintender.co.id", limit: 20 }) });
      },
      onError: (err: unknown) => toast.error("Gagal memicu crawl IjinTender", { description: err instanceof Error ? err.message : "Coba lagi" }),
    }
  });
  const [confirmCrawl, setConfirmCrawl] = useState(false);

  // IjinTender crawl freshness
  const ijinTenderSchedule = mkrSchedule?.matrix?.find(e => e.sourceId === "ijintender");
  const ijinLastCrawled = ijinTenderSchedule?.lastCrawledAt ? new Date(ijinTenderSchedule.lastCrawledAt) : null;
  const ijinNextScheduled = ijinTenderSchedule?.nextScheduledAt ? new Date(ijinTenderSchedule.nextScheduledAt) : null;
  const ijinHoursAgo = ijinLastCrawled ? (Date.now() - ijinLastCrawled.getTime()) / 3_600_000 : null;
  const ijinStaleness = ijinHoursAgo === null ? "unknown" : ijinHoursAgo > 48 ? "stale" : ijinHoursAgo > 24 ? "warn" : "fresh";

  // Derive competitor signals — strict: must match competitor keywords AND not be junk
  const JUNK_KW = ["slot", "casino", "togel", "judi", "gacor", "porn", "sex"];
  const COMP_KW = ["kompetitor", "pesaing", "harga jasa", "harga sbu", "harga skk", "pricing", "competitor", "ijintender", "kontraktor lain", "penyedia jasa", "konsultan sbu", "biaya pengurusan"];

  const liveSignals = useMemo(() => {
    const items = researchItems ?? [];
    return items
      .filter((r) => {
        const title = (r.title ?? "").toLowerCase();
        const summary = (r.summary ?? "").toLowerCase();
        if (JUNK_KW.some((k) => title.includes(k) || summary.includes(k))) return false;
        return COMP_KW.some((k) => title.includes(k) || summary.includes(k));
      })
      .slice(0, 5);
  }, [researchItems]);

  const filtered = useMemo(() => {
    let base = COMPETITORS.filter((c) => {
      const q = deferredSearch.toLowerCase();
      return !q || c.nama.toLowerCase().includes(q) || c.tagline.toLowerCase().includes(q) || (kompNotes[c.id] ?? "").toLowerCase().includes(q);
    });
    if (showKompNotesOnly) base = base.filter(c => !!kompNotes[c.id]?.trim());
    if (sortByThreat) return [...base].sort((a, b) => b.ancamanUntukKita.length - a.ancamanUntukKita.length);
    // default: notes-having entries first
    return [...base].sort((a, b) => ((kompNotes[b.id] ?? "").trim() ? 1 : 0) - ((kompNotes[a.id] ?? "").trim() ? 1 : 0));
  }, [deferredSearch, sortByThreat, showKompNotesOnly, kompNotes]);

  const avgRating = (COMPETITORS.reduce((s, c) => s + c.rating, 0) / COMPETITORS.length).toFixed(1);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Radar Kompetitor — Competitor Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-2" aria-live="polite" aria-atomic="true">
            {filtered.length < COMPETITORS.length
              ? <><span className="text-foreground font-bold">{filtered.length}</span> dari {COMPETITORS.length} kompetitor</>
              : <><span className="text-foreground font-bold">{COMPETITORS.length}</span> kompetitor dipantau</>}
            {filtered.length < COMPETITORS.length && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {filtered.length} dari {COMPETITORS.length}
              </span>
            )}
            {Object.values(kompNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowKompNotesOnly(v => !v)}
                aria-pressed={showKompNotesOnly}
                className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showKompNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya kompetitor dengan catatan"
              >
                {Object.values(kompNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {(["kartu", "matrix"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              aria-pressed={activeView === v}
              className={cn(
                "px-3 py-1.5 text-xs font-mono rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                activeView === v ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {v === "kartu" ? "Kartu Kompetitor" : "Matrix Layanan"}
            </button>
          ))}
        </div>
      </div>

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="kompetitor" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { icon: Users, label: "Kompetitor Dipantau", val: COMPETITORS.length, color: "text-primary" },
          { icon: TriangleAlert, label: "Ancaman Aktif", val: COMPETITORS.reduce((s, c) => s + c.ancamanUntukKita.length, 0), color: "text-red-600" },
          { icon: Zap, label: "Peluang dari Mereka", val: COMPETITORS.reduce((s, c) => s + c.peluangDariMereka.length, 0), color: "text-emerald-600" },
          { icon: Star, label: "Avg. Kekuatan Kompetitor", val: avgRating, color: "text-yellow-600" },
          { icon: StickyNote, label: "Dengan Catatan", val: Object.values(kompNotes).filter(v => v?.trim()).length, color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="border rounded-sm p-3 bg-card flex items-center gap-3">
            <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
            <div>
              <p className="text-xl font-bold font-mono leading-none">{s.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Market Share Estimation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> ESTIMASI PANGSA PASAR — Jasa Konsultasi SBU/SKK/SMAP Indonesia 2026
        </p>
        <div className="flex flex-col gap-2">
          {[
            { player: "IjinTender + Platform Online", share: 38, color: "bg-orange-400", desc: "Dominasi via volume & SEO", position: "Follower" },
            { player: "Konsultan Lokal & Marketplace", share: 30, color: "bg-slate-400", desc: "Harga murah, kualitas variatif", position: "Niche" },
            { player: "ASOSIASI + KADIN Resmi", share: 15, color: "bg-blue-400", desc: "Capture anggota asosiasi", position: "Niche" },
            { player: "PT Maheswara Jaya Persada", share: 7, color: "bg-primary", desc: "Advisory + intelijen pasar", position: "Challenger" },
            { player: "Konsultan ISO / K3 Spesialis", share: 5, color: "bg-violet-400", desc: "Fokus ISO/K3 saja", position: "Niche" },
            { player: "Pasar Tidak Terlayani", share: 5, color: "bg-emerald-400", desc: "Blue ocean — BUJK belum pakai jasa", position: "Opportunity" },
          ].map((row) => (
            <div key={row.player} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium truncate" title={row.player}>{row.player}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm ${
                      row.position === "Challenger" ? "bg-primary/10 text-primary font-bold" :
                      row.position === "Opportunity" ? "bg-emerald-100 text-emerald-700 font-bold" :
                      row.position === "Follower" ? "bg-orange-100 text-orange-700" :
                      "bg-muted text-muted-foreground"
                    }`}>{row.position}</span>
                    <span className="text-xs font-mono font-bold w-8 text-right">{row.share}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${row.color} rounded-full`} style={{ width: `${row.share * 2}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground w-32 text-right">{row.desc}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Estimasi internal berbasis analisis kompetitor · Target: Maheswara ke 15–20% dalam 24 bulan</p>
      </div>

      {/* Positioning Score — kita vs kompetitor utama */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3 w-3" /> POSITIONING SCORE — KITA vs KOMPETITOR UTAMA
          <span className="ml-2 text-[9px] text-muted-foreground/60">(Skor 1-5, berbasis analisis manual + data MKR)</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Data Intelijen Real-time", kita: 5, c1: 1, c2: 1, c3: 1, c5: 3 },
            { label: "SBU/SKK Advisory", kita: 4, c1: 4, c2: 3, c3: 2, c5: 1 },
            { label: "Analisis Tender", kita: 5, c1: 2, c2: 1, c3: 1, c5: 4 },
            { label: "Platform Digital", kita: 5, c1: 2, c2: 1, c3: 1, c5: 3 },
            { label: "Harga Kompetitif", kita: 3, c1: 4, c2: 5, c3: 4, c5: 2 },
            { label: "Coverage Regional", kita: 3, c1: 3, c2: 4, c3: 3, c5: 5 },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-2">
              <span className="text-xs font-mono w-36 truncate text-muted-foreground" title={row.label}>{row.label}</span>
              <div className="flex-1 flex items-center gap-1">
                {[
                  { label: "MJP", score: row.kita, color: "bg-primary" },
                  { label: "IjinTender", score: row.c1, color: "bg-orange-400" },
                  { label: "Marketplace", score: row.c2, color: "bg-slate-400" },
                ].map((p) => (
                  <div key={p.label} className="flex items-center gap-1 flex-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={cn("h-2 w-2 rounded-[1px]", i <= p.score ? p.color : "bg-muted")} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <span className={cn("text-xs font-mono font-bold w-4", row.kita >= 4 ? "text-primary" : "text-muted-foreground")}>{row.kita}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 pt-2.5 border-t">
          {[{ label: "■ MJP", color: "text-primary" }, { label: "■ IjinTender", color: "text-orange-500" }, { label: "■ Marketplace", color: "text-slate-500" }].map((l) => (
            <span key={l.label} className={`text-[9px] font-mono font-semibold ${l.color}`}>{l.label}</span>
          ))}
        </div>
      </div>

      {/* Live IjinTender Price Signals */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 flex-wrap">
          <Activity className="h-3 w-3 text-orange-500" /> HARGA TERKINI IJINTENDER — Data Live dari Scheduler
          <span className="ml-auto flex items-center gap-2">
            {/* Freshness badge */}
            {ijinStaleness === "fresh" && ijinLastCrawled && (
              <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                Diperbarui {formatDistanceToNow(ijinLastCrawled, { locale: idLocale, addSuffix: true })}
              </span>
            )}
            {ijinStaleness === "warn" && ijinLastCrawled && (
              <span className="text-[9px] font-mono text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                Terakhir diperbarui {format(ijinLastCrawled, "dd MMM HH:mm", { locale: idLocale })}
              </span>
            )}
            {ijinStaleness === "stale" && ijinLastCrawled && (
              <span className="text-[9px] font-mono text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                <TriangleAlert className="h-2.5 w-2.5" />
                Data lama — terakhir {format(ijinLastCrawled, "dd MMM HH:mm", { locale: idLocale })}
              </span>
            )}
            {ijinStaleness === "unknown" && (
              <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                Belum pernah dicrawl
              </span>
            )}
            {ijinNextScheduled && (
              <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1">
                Crawl berikut: {format(ijinNextScheduled, "HH:mm dd/MM", { locale: idLocale })}
              </span>
            )}
            {confirmCrawl ? (
              <span className="flex items-center gap-1">
                <button
                  autoFocus
                  onBlur={() => setConfirmCrawl(false)}
                  onClick={() => { crawlNow.mutate({ params: { sourceId: "ijintender" } }); setConfirmCrawl(false); }}
                  className="h-5 text-[9px] font-mono px-1.5 py-0 text-white bg-primary hover:bg-primary/90 rounded-sm border border-primary"
                >✓ Crawl?</button>
                <button onClick={() => setConfirmCrawl(false)} className="text-[9px] font-mono text-muted-foreground hover:text-foreground">Batal</button>
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[9px] font-mono px-2 py-0 whitespace-nowrap"
                disabled={crawlNow.isPending}
                onClick={() => setConfirmCrawl(true)}
                title="Perbarui harga IjinTender sekarang" aria-label="Perbarui harga IjinTender sekarang"
              >
                {crawlNow.isPending ? <><Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />Memperbarui…</> : <><RefreshCw className="h-2.5 w-2.5 mr-1" />Perbarui Harga Sekarang</>}
              </Button>
            )}
            <span className="flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", ijinStaleness === "fresh" ? "bg-emerald-400" : ijinStaleness === "stale" ? "bg-red-400" : "bg-orange-400")} />
                <span className={cn("relative inline-flex rounded-full h-2 w-2", ijinStaleness === "fresh" ? "bg-emerald-500" : ijinStaleness === "stale" ? "bg-red-500" : "bg-orange-500")} />
              </span>
              <span
                className={cn("text-[9px] font-mono font-bold", ijinStaleness === "fresh" ? "text-emerald-600" : ijinStaleness === "stale" ? "text-red-600" : "text-orange-600")}
                title={ijinStaleness === "fresh" ? `Data segar — diperbarui dalam 24 jam terakhir${ijinLastCrawled ? ` (${new Date(ijinLastCrawled).toLocaleString("id-ID")})` : ""}` : ijinStaleness === "stale" ? `Data usang — lebih dari 24 jam sejak crawl terakhir${ijinLastCrawled ? ` (${new Date(ijinLastCrawled).toLocaleString("id-ID")})` : ""}` : "Crawler sedang berjalan — data sedang diperbarui"}
              >
                {ijinStaleness === "fresh" ? "Segar" : ijinStaleness === "stale" ? "Usang" : "Live"}
              </span>
            </span>
          </span>
        </p>
        {!competitorSignals ? (
          <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-xs font-mono">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat data harga…
          </div>
        ) : competitorSignals.length > 0 ? (
          <>
            <div className="flex flex-col gap-2">
              {competitorSignals.slice(0, 8).map((signal) => (
                <div key={signal.id} className="flex items-start gap-2 p-2 rounded-sm bg-orange-50/50 border border-orange-100">
                  <DollarSign className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug text-foreground" title={signal.title}>{signal.title}</p>
                    {signal.summary && signal.summary !== signal.title && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2" title={signal.summary}>{signal.summary}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {signal.collectedAt && (() => {
                      try {
                        const collected = new Date(signal.collectedAt);
                        const isNew = !isNaN(collected.getTime()) && (Date.now() - collected.getTime()) < 7 * 86400000;
                        return isNew ? (
                          <span className="text-[8px] font-mono bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm border border-emerald-200">Baru</span>
                        ) : null;
                      } catch { return null; }
                    })()}
                    <span className="text-[9px] font-mono text-muted-foreground mt-0.5">{signal.collectedAt}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2 flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5" />
              {competitorSignals.length} sinyal harga terkumpul · diperbarui otomatis setiap jadwal crawl scheduler
              {competitorSignals[0]?.collectedAt && ` · terakhir: ${competitorSignals[0].collectedAt}`}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
            <Database className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground font-mono">Belum ada data harga live dari IjinTender</p>
            <p className="text-[9px] text-muted-foreground/70 max-w-xs">
              Data akan muncul otomatis setelah scheduler berikutnya menjalankan crawl pada sumber IjinTender.co.id
            </p>
            <p className="text-[9px] font-mono text-orange-600 mt-1">
              Sumber harga statis tersedia di tabel di bawah ↓
            </p>
          </div>
        )}
      </div>

      {/* Competitive Pricing Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3 w-3 text-primary" /> COMPETITIVE PRICING RADAR — Perbandingan Harga Kunci per Layanan (Referensi Statis)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left py-1.5 font-mono text-[10px] text-muted-foreground">Layanan</th>
                <th className="text-center py-1.5 font-mono text-[10px] text-primary font-bold">PT Maheswara</th>
                <th className="text-center py-1.5 font-mono text-[10px] text-orange-600">IjinTender</th>
                <th className="text-center py-1.5 font-mono text-[10px] text-slate-500">Marketplace</th>
                <th className="text-center py-1.5 font-mono text-[10px] text-muted-foreground">Posisi Kita</th>
              </tr>
            </thead>
            <tbody>
              {[
                { layanan: "Pengurusan SBU Menengah", kita: "Rp 7–12jt", c1: "Rp 8–15jt", mkt: "Rp 5–8jt", pos: "Value", posColor: "bg-blue-100 text-blue-700" },
                { layanan: "Pendampingan SKK Jenjang 7", kita: "Rp 2.7–4.5jt", c1: "Rp 3–5jt", mkt: "Rp 1.5–3jt", pos: "Kompetitif", posColor: "bg-green-100 text-green-700" },
                { layanan: "Paket SMAP Express", kita: "Rp 14–22jt", c1: "Rp 12–18jt", mkt: "Rp 8–12jt", pos: "Premium", posColor: "bg-violet-100 text-violet-700" },
                { layanan: "Audit Kesiapan Tender", kita: "Rp 2jt", c1: "—", mkt: "—", pos: "Unik", posColor: "bg-red-100 text-red-700" },
                { layanan: "Laporan Intelijen Kompetitor", kita: "Rp 4jt", c1: "—", mkt: "—", pos: "Unik", posColor: "bg-red-100 text-red-700" },
              ].map((row) => (
                <tr key={row.layanan} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-1.5 pr-3">{row.layanan}</td>
                  <td className="py-1.5 text-center font-mono font-bold text-primary text-[11px]">{row.kita}</td>
                  <td className="py-1.5 text-center font-mono text-[10px] text-muted-foreground">{row.c1}</td>
                  <td className="py-1.5 text-center font-mono text-[10px] text-muted-foreground">{row.mkt}</td>
                  <td className="py-1.5 text-center"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${row.posColor}`}>{{ "KOMPETITIF":"Kompetitif", "PREMIUM":"Premium", "UNIK":"Unik", "VALUE":"Value", "MURAH":"Murah", "EKSKLUSIF":"Eksklusif" }[row.pos] ?? row.pos}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Market Gap Opportunities */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-emerald-500" /> PELUANG DIFERENSIASI — CELAH YANG BELUM DIKUASAI KOMPETITOR
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { gap: "Monitoring SBU/SKK real-time", ours: true, c1: false, c2: false, impact: "KRITIS" },
            { gap: "Platform intelijen tender terpadu", ours: true, c1: false, c2: false, impact: "KRITIS" },
            { gap: "Analisis peluang menang tender", ours: true, c1: false, c2: false, impact: "TINGGI" },
            { gap: "Advisory regulasi berkelanjutan", ours: true, c1: false, c2: false, impact: "TINGGI" },
            { gap: "BIM capability advisory", ours: true, c1: false, c2: false, impact: "TINGGI" },
            { gap: "TKDN verifikasi layanan", ours: true, c1: false, c2: false, impact: "TINGGI" },
            { gap: "Regional coverage luar Jawa", ours: false, c1: false, c2: true, impact: "SEDANG" },
            { gap: "Harga paling murah di pasar", ours: false, c1: false, c2: true, impact: "RENDAH" },
          ].map(row => (
            <div key={row.gap} className="flex items-center gap-2 py-1.5 border-b border-muted/30 last:border-0">
              <span className="text-xs flex-1">{row.gap}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span title="KITA" className={`text-[9px] font-mono px-1 rounded-sm ${row.ours ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>KITA {row.ours ? "✓" : "✗"}</span>
                <span title="IjinTender" className={`text-[9px] font-mono px-1 rounded-sm ${row.c1 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>C1 {row.c1 ? "✓" : "✗"}</span>
                <span className={`text-[9px] font-mono px-1 rounded-sm font-bold ${row.impact === "KRITIS" ? "bg-red-100 text-red-700" : row.impact === "TINGGI" ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"}`}>{row.impact}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Counter-Strategy Board */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> COUNTER-STRATEGY BOARD — Tindakan MJP vs Gerakan Kompetitor
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Gerakan Kompetitor", "Risiko ke MJP", "Counter MJP", "Timeline", "KPI Sukses"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { gerakan: "Kompetitor turunkan harga 15%", risiko: "Hilang 20–30% prospek price-sensitive", counter: "Bundling layanan → nilai lebih tinggi, bukan harga lebih murah", time: "Segera", kpi: "Konversi bundle >25%", riskColor: "text-red-600" },
                { gerakan: "Kompetitor launch platform digital", risiko: "Persepsi MJP ketinggalan teknologi", counter: "Percepat AI Briefing + dashboard klien real-time", time: "Q3 2026", kpi: "Fitur AI live sebelum Q3", riskColor: "text-orange-600" },
                { gerakan: "Kompetitor masuk kota tier-2", risiko: "Market share Surabaya & Makassar terancam", counter: "WA blast + campaign kota tier-2 sebelum kompetitor establish", time: "< 30 hari", kpi: "Ambil 10 klien tier-2 baru", riskColor: "text-orange-600" },
                { gerakan: "Kompetitor rekrut konsultan senior MJP", risiko: "Brain drain + kehilangan referral network", counter: "Retention bonus + equity sharing scheme + culture upgrade", time: "Ongoing", kpi: "Turnover < 5%/tahun", riskColor: "text-yellow-600" },
                { gerakan: "Kompetitor partnership dengan asosiasi GAPENSI", risiko: "Endorsement asosiasi memberikan kredibilitas kompetitor", counter: "Jalin partnership LPJK + INKINDO + HIMPSI untuk legitimasi MJP", time: "Q4 2026", kpi: "3 MoU asosiasi baru", riskColor: "text-yellow-600" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.gerakan}</td>
                  <td className={`px-3 py-2 text-[10px] ${r.riskColor}`}>{r.risiko}</td>
                  <td className="px-3 py-2 text-[10px] text-primary font-semibold">{r.counter}</td>
                  <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap">{r.time}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.kpi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Market Share Estimation Board */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> MARKET SHARE ESTIMATION — Estimasi Porsi Pasar MJP vs Kompetitor Utama
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-mono text-muted-foreground mb-2">Layanan Sertifikasi Konstruksi (Jakarta + Surabaya)</p>
            {[
              { nama: "PT Maheswara (MJP)", pct: 12, color: "bg-primary" },
              { nama: "Konsultan Besar Nasional", pct: 35, color: "bg-slate-400" },
              { nama: "Jasa Lokal Tier-2", pct: 28, color: "bg-orange-300" },
              { nama: "Asosiasi In-house", pct: 15, color: "bg-blue-300" },
              { nama: "Lain-lain / DIY", pct: 10, color: "bg-muted-foreground/30" },
            ].map((r) => (
              <div key={r.nama} className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono w-36 shrink-0 truncate" title={r.nama}>{r.nama}</span>
                <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
                  <div className={`h-full ${r.color} rounded-sm`} style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-[9px] font-mono font-bold w-6 text-right">{r.pct}%</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-mono text-muted-foreground mb-2">Target Market Share MJP — Roadmap 3 Tahun</p>
            {[
              { tahun: "2026", target: "12%", aksi: "Fokus Jakarta + Surabaya, scale WA blast", color: "text-primary", bar: 12 },
              { tahun: "2027", target: "22%", aksi: "Ekspansi 5 kota tier-1 + platform SaaS", color: "text-blue-700", bar: 22 },
              { tahun: "2028", target: "35%", aksi: "Nasional + white-label + asosiasi MoU", color: "text-emerald-700", bar: 35 },
            ].map((r) => (
              <div key={r.tahun} className="mb-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-mono font-bold">{r.tahun}</span>
                  <span className={`text-[10px] font-mono font-bold ${r.color}`}>{r.target}</span>
                </div>
                <div className="h-2 bg-muted rounded-sm overflow-hidden mb-0.5">
                  <div className={`h-full ${r.color === "text-primary" ? "bg-primary" : r.color === "text-blue-700" ? "bg-blue-500" : "bg-emerald-500"} rounded-sm`} style={{ width: `${r.bar * 2.86}%` }} />
                </div>
                <p className="text-[8px] text-muted-foreground">{r.aksi}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Competitive Pricing Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> COMPETITIVE PRICING INTELLIGENCE — Posisi Harga MJP vs Kompetitor per Layanan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Layanan", "MJP", "Kompetitor Low", "Kompetitor Avg", "Kompetitor High", "Posisi MJP", "Strategi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { layanan: "Pengurusan SBU", mjp: "Rp 4.5jt", low: "Rp 2.8jt", avg: "Rp 5.2jt", high: "Rp 8.5jt", posisi: "VALUE", posColor: "text-blue-700", strat: "Tawarkan express 5hr" },
                { layanan: "SKK Jenjang 7–9", mjp: "Rp 4.2jt", low: "Rp 2.5jt", avg: "Rp 4.8jt", high: "Rp 7jt", posisi: "VALUE", posColor: "text-blue-700", strat: "Bundle multi-bidang" },
                { layanan: "SMAP Pendampingan", mjp: "Rp 12jt", low: "Rp 8jt", avg: "Rp 13jt", high: "Rp 20jt", posisi: "KOMPETITIF", posColor: "text-emerald-700", strat: "Garansi sertifikasi" },
                { layanan: "Intel Tender Bulanan", mjp: "Rp 3jt", low: "Rp 1.5jt", avg: "Rp 3.5jt", high: "Rp 6jt", posisi: "VALUE", posColor: "text-blue-700", strat: "Add AI briefing daily" },
                { layanan: "Advisory BIM", mjp: "Rp 8jt", low: "Rp 5jt", avg: "Rp 12jt", high: "Rp 25jt", posisi: "PREMIUM VALUE", posColor: "text-violet-700", strat: "Tambahkan deliverable" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.layanan}</td>
                  <td className="px-3 py-2 font-mono font-bold text-primary">{r.mjp}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.low}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.avg}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.high}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.posColor}`}>{r.posisi}</td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.strat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitor Weakness Exploit Board */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-red-600" /> COMPETITOR WEAKNESS EXPLOIT BOARD — Celah Kompetitor yang Bisa Dieksploitasi MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { komp: "Firma Konsultan Konvensional", kelemahan: "Lambat merespons regulasi baru (2–4 minggu)", exploit: "MJP: 48-jam regulatory flash brief + notif otomatis", impact: "Ambil 30% klien aktif mereka", ic: "text-emerald-700" },
            { komp: "Platform SBU Online Murah", kelemahan: "Zero advisory — klien tidak paham prosesnya", exploit: "MJP: Bundel advisory + pendampingan + garansi hasil", impact: "Upsell 60% pengguna platform murah", ic: "text-emerald-700" },
            { komp: "Agen Sertifikasi Lokal", kelemahan: "Coverage terbatas 1–2 kota, tidak ada database nasional", exploit: "MJP: 64 LPSE + LPJK nasional + remote service", impact: "Layani pasar outside Java tanpa kompetisi", ic: "text-blue-700" },
            { komp: "BIRO JASA Non-Digital", kelemahan: "Tidak ada platform tracking, WhatsApp manual", exploit: "MJP: Dashboard klien real-time + auto-alert expiry", impact: "Retensi 40% lebih tinggi dengan layanan digital", ic: "text-blue-700" },
          ].map((r) => (
            <div key={r.komp} className="border rounded-sm p-3">
              <p className="text-[10px] font-semibold mb-1">{r.komp}</p>
              <p className="text-[9px] text-red-600 mb-1">⚠ {r.kelemahan}</p>
              <p className="text-[9px] text-primary mb-1">→ {r.exploit}</p>
              <p className={`text-[9px] font-mono font-bold ${r.ic}`}>📈 {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Response Speed Board */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> COMPETITOR RESPONSE SPEED — Kecepatan Kompetitor Bereaksi vs MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { metric: "Waktu Respons Pertanyaan Klien", mjp: "< 2 jam", komp: "6–24 jam", advantage: "MJP 4–12× lebih cepat", ac: "text-emerald-700" },
            { metric: "Update Harga Layanan", mjp: "Real-time", komp: "2–4 minggu", advantage: "MJP selalu relevan", ac: "text-emerald-700" },
            { metric: "Notifikasi Regulasi Baru", mjp: "< 48 jam", komp: "2–8 minggu", advantage: "MJP first mover", ac: "text-emerald-700" },
            { metric: "Penerbitan SBU Express", mjp: "14 hari", komp: "21–45 hari", advantage: "MJP 1.5–3× lebih cepat", ac: "text-emerald-700" },
          ].map((m) => (
            <div key={m.metric} className="border rounded-sm p-3">
              <p className="text-[9px] font-semibold mb-2 leading-snug">{m.metric}</p>
              <div className="grid grid-cols-2 gap-1 mb-1.5">
                <div className="text-center">
                  <p className="text-[8px] font-mono text-muted-foreground">MJP</p>
                  <p className="text-[10px] font-mono font-bold text-primary">{m.mjp}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-mono text-muted-foreground">Kompetitor</p>
                  <p className="text-[10px] font-mono font-bold text-red-500">{m.komp}</p>
                </div>
              </div>
              <p className={`text-[9px] font-mono font-bold ${m.ac}`}>✓ {m.advantage}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Market Share Estimator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartPie className="h-3.5 w-3.5 text-primary" /> MARKET SHARE ESTIMATOR — Estimasi Pangsa Pasar Jasa Sertifikasi Konstruksi Indonesia
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { player: "MJP (Platform)", share: "4.2%", rev: "~Rp 2.1M/bln", trend: "▲ +0.8% YTD", tc: "text-primary", bc: "bg-primary" },
            { player: "Konsultan Independen", share: "38%", rev: "Rp 19B/bln", trend: "▼ –2% YTD", tc: "text-orange-700", bc: "bg-orange-500" },
            { player: "LPJK Resmi Langsung", share: "35%", rev: "—", trend: "– Stabil", tc: "text-blue-700", bc: "bg-blue-500" },
            { player: "Platform Digital Lain", share: "22.8%", rev: "Rp 11B/bln", trend: "▲ +4% YTD", tc: "text-violet-700", bc: "bg-violet-500" },
          ].map((p) => (
            <div key={p.player} className="border rounded-sm p-3 text-center">
              <p className="text-[9px] font-mono font-bold leading-tight mb-1">{p.player}</p>
              <p className={`text-2xl font-black font-mono ${p.tc}`}>{p.share}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{p.rev}</p>
              <p className={`text-[9px] font-mono font-bold mt-0.5 ${p.tc}`}>{p.trend}</p>
            </div>
          ))}
        </div>
        <div className="flex h-2 rounded-full overflow-hidden">
          {[{ w: 4.2, c: "bg-primary" }, { w: 38, c: "bg-orange-500" }, { w: 35, c: "bg-blue-500" }, { w: 22.8, c: "bg-violet-500" }].map((s, i) => (
            <div key={i} className={`${s.c}`} style={{ width: `${s.w}%` }} />
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Estimasi share berdasarkan volume klien & revenue analisis · Target MJP: 10% share dalam 24 bulan</p>
      </div>

      {/* Competitor Pricing Strategy Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> COMPETITOR PRICING STRATEGY MAP — Strategi Harga Kompetitor vs Posisi MJP
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Layanan", "Kompetitor A", "Kompetitor B", "Rata-rata Pasar", "Harga MJP", "Posisi MJP", "Strategi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { layanan: "SBU Kecil", a: "Rp 6jt", b: "Rp 7jt", avg: "Rp 6.5jt", mjp: "Rp 7.5jt", pos: "PREMIUM", pc: "text-blue-700", strat: "Value + Express speed" },
                { layanan: "SBU Menengah", a: "Rp 12jt", b: "Rp 14jt", avg: "Rp 13jt", mjp: "Rp 13jt", pos: "AT MARKET", pc: "text-green-700", strat: "Compete on service" },
                { layanan: "SMAP", a: "Rp 8jt", b: "Rp 9jt", avg: "Rp 8.5jt", mjp: "Rp 10jt", pos: "PREMIUM", pc: "text-blue-700", strat: "Bundle + ROI guarantee" },
                { layanan: "SKK Jenjang 7/8", a: "Rp 4jt", b: "Rp 4.5jt", avg: "Rp 4.2jt", mjp: "Rp 4jt", pos: "KOMPETITIF", pc: "text-emerald-700", strat: "Volume play" },
                { layanan: "Konsultasi BIM", a: "Rp 7jt", b: "Rp 8jt", avg: "Rp 7.5jt", mjp: "Rp 6.5jt", pos: "PENETRASI", pc: "text-orange-700", strat: "Market entry pricing" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px]">{r.layanan}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.a}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.b}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.avg}</td>
                  <td className="px-3 py-2 font-mono font-bold text-[10px] text-primary">{r.mjp}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.pc}`}>{{ "PREMIUM":"Premium", "AT MARKET":"Setara Pasar", "KOMPETITIF":"Kompetitif", "PENETRASI":"Penetrasi", "MURAH":"Murah", "EKSKLUSIF":"Eksklusif", "TERMURAH":"Termurah", "UNIK":"Unik" }[r.pos] ?? r.pos}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.strat}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitor Movement Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-red-600" /> COMPETITOR MOVEMENT TRACKER — Aksi Terbaru Kompetitor yang Perlu Direspons
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { kompetitor: "Konsultan XYZ", aksi: "Turunkan harga SBU Kecil ke Rp 5.5jt (-8%)", dampak: "Ancaman segmen K kita", respons: "Tonjolkan value add express 14 hari", severity: "TINGGI", sc: "text-orange-700" },
            { kompetitor: "Platform ABC", aksi: "Luncurkan fitur auto-alert SBU expiry", dampak: "Fitur kita terancam komoditas", respons: "Segera kembangkan AI compliance engine", severity: "KRITIS", sc: "text-red-700" },
            { kompetitor: "CV Anonim", aksi: "Buka cabang di Surabaya + Semarang", dampak: "Ekspansi ke wilayah MJP", respons: "Perkuat partnership lokal Jatim-Jateng", severity: "SEDANG", sc: "text-yellow-700" },
            { kompetitor: "Konsultan DEF", aksi: "Mulai tawarkan paket BIM readiness", dampak: "Masuk ke segmen BIM kita", respons: "Percepat release BIM Advisory Product", severity: "SEDANG", sc: "text-yellow-700" },
          ].map((m) => (
            <div key={m.kompetitor} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-start gap-2">
                <span className={`text-[8px] font-mono font-bold shrink-0 mt-0.5 ${m.sc}`}>[{m.severity}]</span>
                <div className="flex-1">
                  <p className="text-[9px] font-semibold">{m.kompetitor}: <span className="font-normal text-muted-foreground">{m.aksi}</span></p>
                  <p className="text-[9px] text-red-600 mt-0.5">⚠ Dampak: {m.dampak}</p>
                  <p className="text-[9px] font-mono text-primary">→ {m.respons}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Win/Loss Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WIN/LOSS ANALYSIS — Alasan Kemenangan & Kekalahan vs Kompetitor Spesifik
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border rounded-sm p-3 bg-emerald-50/30 border-emerald-200">
            <p className="text-[9px] font-mono font-bold text-emerald-700 mb-2">🏆 KENAPA MJP MENANG (Top 5)</p>
            {[
              { reason: "Kecepatan delivery — express 14 hari", freq: 68 },
              { reason: "Data intel tender eksklusif", freq: 54 },
              { reason: "Support WhatsApp responsif", freq: 47 },
              { reason: "Paket bundling nilai lebih", freq: 38 },
              { reason: "Reputasi & referral klien", freq: 32 },
            ].map((r) => (
              <div key={r.reason} className="flex items-center gap-2 mb-1 last:mb-0">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.freq}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground w-44 shrink-0">{r.reason}</p>
                <span className="text-[9px] font-mono text-emerald-700 w-8 text-right">{r.freq}%</span>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-red-50/30 border-red-200">
            <p className="text-[9px] font-mono font-bold text-red-700 mb-2">❌ KENAPA MJP KALAH (Top 5)</p>
            {[
              { reason: "Harga lebih mahal vs kompetitor", freq: 52 },
              { reason: "Tidak ada trial / freemium", freq: 41 },
              { reason: "Kurang dikenal di luar Jawa", freq: 38 },
              { reason: "Tidak ada payment cicilan", freq: 29 },
              { reason: "Proses onboarding terlalu lama", freq: 24 },
            ].map((r) => (
              <div key={r.reason} className="flex items-center gap-2 mb-1 last:mb-0">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${r.freq}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground w-44 shrink-0">{r.reason}</p>
                <span className="text-[9px] font-mono text-red-700 w-8 text-right">{r.freq}%</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Data dari 148 deal closed + lost bulan ini · Frekuensi = % deal yang menyebut alasan ini</p>
      </div>

      {/* Competitor Pricing Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> COMPETITOR PRICING INTELLIGENCE — Posisi Harga MJP vs Kompetitor per Kategori Layanan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Layanan", "MJP", "Kompetitor A", "Kompetitor B", "Harga Pasar", "Posisi MJP"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { service: "SKK Jenjang 7", mjp: "Rp 3.2jt", compA: "Rp 2.8jt", compB: "Rp 3.5jt", market: "Rp 3.1jt", pos: "KOMPETITIF", c: "text-blue-700" },
                { service: "SBU Kualifikasi M", mjp: "Rp 12jt", compA: "Rp 14jt", compB: "Rp 11.5jt", market: "Rp 12.5jt", pos: "KOMPETITIF", c: "text-blue-700" },
                { service: "SMAP Compliance", mjp: "Rp 18jt", compA: "Rp 22jt", compB: "—", market: "Rp 19jt", pos: "MURAH", c: "text-emerald-700" },
                { service: "Intel Tender Bulanan", mjp: "Rp 2.5jt/bln", compA: "Rp 1.8jt/bln", compB: "Rp 3.0jt/bln", market: "Rp 2.3jt/bln", pos: "PREMIUM", c: "text-orange-700" },
                { service: "BIM Advisory", mjp: "Rp 28jt", compA: "—", compB: "Rp 35jt", market: "Rp 30jt", pos: "MURAH", c: "text-emerald-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px]">{r.service}</td>
                  <td className="px-3 py-2 font-mono font-bold text-[10px] text-primary">{r.mjp}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.compA}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.compB}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.market}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${r.c}`}>{{ "KOMPETITIF":"Kompetitif", "PREMIUM":"Premium", "MURAH":"Murah", "EKSKLUSIF":"Eksklusif", "TERMURAH":"Termurah" }[r.pos] ?? r.pos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">SMAP + BIM — MJP paling murah di pasar · Naikkan harga 10–15% masih kompetitif · Intel Tender — pertimbangkan paket lebih terjangkau</p>
      </div>

      {/* Competitive Threat Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> COMPETITIVE THREAT INDEX — Tingkat Ancaman per Kompetitor terhadap Revenue MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { name: "Platform X (BUMN baru)", threat: 8.4, why: "Didukung modal negara, menyerang segmen SKK massal dengan harga sangat murah", response: "Diferensiasi: advisory premium + bundling komprehensif", tc: "text-red-700" },
            { name: "Konsultan Independen Network", threat: 6.2, why: "Word-of-mouth kuat, relationship-based, tidak butuh digital funnel", response: "Partner mereka — program reseller + white-label", tc: "text-orange-700" },
            { name: "Platform Edukasi Online (SKK DIY)", threat: 5.8, why: "Harga sangat murah, self-service, target generasi muda", response: "Posisikan MJP sebagai 'done-for-you' vs mereka 'do-it-yourself'", tc: "text-orange-700" },
            { name: "Jasa Biro Konsultan Lokal", threat: 4.1, why: "Kepercayaan lokal tinggi, relasi personal dengan klien", response: "Berikan data intelijen yang tidak bisa mereka hasilkan sendiri", tc: "text-yellow-700" },
          ].map((c) => (
            <div key={c.name} className="border rounded-sm p-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[9px] font-semibold">{c.name}</p>
                    <span className={`text-[10px] font-mono font-black ${c.tc}`}>{c.threat}/10</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${c.threat >= 8 ? "bg-red-500" : c.threat >= 6 ? "bg-orange-500" : "bg-yellow-500"}`} style={{ width: `${c.threat * 10}%` }} />
                  </div>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug mb-0.5">⚠ {c.why}</p>
              <p className={`text-[9px] font-mono font-bold ${c.tc}`}>→ {c.response}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Moat Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> COMPETITIVE MOAT ASSESSMENT — Seberapa Kuat Hambatan Kompetitor untuk Merebut Klien MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { moat: "Data eksklusif lapangan (pain points + riset)", strength: 88, description: "4.000+ pain points dari 500+ lapangan — tidak mudah direplikasi", c: "bg-emerald-500", tc: "text-emerald-700" },
            { moat: "Network efek kontraktor (referral + trust)", strength: 76, description: "Komunitas 2.000+ BUJK yang sudah terhubung dan saling referral", c: "bg-blue-500", tc: "text-blue-700" },
            { moat: "Kecepatan delivery (express 14 hari)", strength: 82, description: "Proses terintegrasi dari riset ke dokumen siap pakai", c: "bg-violet-500", tc: "text-violet-700" },
            { moat: "Pengetahuan regulasi mendalam + update cepat", strength: 71, description: "Briefing harian + JDIH tracker — kompetitor update manual", c: "bg-orange-500", tc: "text-orange-700" },
          ].map((m) => (
            <div key={m.moat} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold leading-snug">{m.moat}</p>
                <span className={`text-[10px] font-mono font-black ${m.tc}`}>{m.strength}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${m.c} rounded-full`} style={{ width: `${m.strength}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{m.description}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Moat Score 0–100 · Fokus mempertahankan Data + Delivery Speed · Dua moat terkuat = investasi prioritas</p>
      </div>

      {/* Competitor Activity Timeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> COMPETITOR ACTIVITY TIMELINE — Gerakan Kompetitor 30 Hari Terakhir yang Perlu Direspons
        </p>
        <div className="flex flex-col gap-2">
          {[
            { date: "28 Jul", competitor: "Nawadata", event: "Luncurkan fitur notifikasi tender APBD", threat: "SEDANG", action: "Percepat fitur alerting MJP + tambahkan advisory layer", tc: "text-orange-700" },
            { date: "22 Jul", competitor: "Konstruksi.AI", event: "Harga langganan turun 30% untuk BUJK Menengah", threat: "TINGGI", action: "Highlight bahwa MJP = advisory + eksekusi, bukan hanya tool", tc: "text-red-700" },
            { date: "15 Jul", competitor: "SIBIMA PUPR", event: "Update portal dengan data SKK terverifikasi", threat: "RENDAH", action: "Integrasikan SIBIMA sebagai validation source di platform", tc: "text-blue-700" },
            { date: "8 Jul", competitor: "Nawadata", event: "Masuk segmen konsultasi SMAP untuk BUJK Besar", threat: "SANGAT TINGGI", action: "Defend segment: loyalty program SMAP + case study eksklusif", tc: "text-red-700" },
          ].map((e) => (
            <div key={e.date} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="shrink-0 text-center">
                <p className="text-[8px] font-mono text-muted-foreground">{e.date}</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold">{e.competitor}</p>
                  <span className={`text-[8px] font-mono font-bold ${e.tc}`}>[{e.threat}]</span>
                </div>
                <p className="text-[9px] text-muted-foreground mb-0.5">{e.event}</p>
                <p className="text-[9px] font-mono text-primary">→ {e.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Response Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> STRATEGIC RESPONSE PLAYBOOK — Skenario Kompetitor + Respons Terbaik MJP untuk Tiap Situasi
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              scenario: "Kompetitor potong harga 30–50%",
              response: "Anchor ke nilai, bukan harga: ROI advisory MJP rata-rata 6–15× investasi. Tawarkan audit gratis untuk buktikan value.",
              timing: "Respons dalam 48 jam",
              outcome: "Retensi 78% klien yang diretain",
              svc: "bg-orange-50 border-orange-200", tc: "text-orange-700",
            },
            {
              scenario: "Kompetitor masuk ke segmen SKK Express",
              response: "Kecepatan + jaminan: 'express dalam 14 hari atau refund 30%'. Tambahkan BNSP partnership exclusive.",
              timing: "Respons dalam 1 minggu",
              outcome: "Pertahankan premium pricing",
              svc: "bg-red-50 border-red-200", tc: "text-red-700",
            },
            {
              scenario: "Startup tech baru dengan UI lebih bagus",
              response: "Tekankan bahwa MJP = advisory + eksekusi. Platform adalah alat, bukan produk. Upsell dedicated account manager.",
              timing: "Komunikasi berkelanjutan",
              outcome: "Diferensiasi layanan vs software",
              svc: "bg-blue-50 border-blue-200", tc: "text-blue-700",
            },
          ].map((p) => (
            <div key={p.scenario} className={`border rounded-sm p-3 ${p.svc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold">⚡ {p.scenario}</p>
                <span className={`text-[8px] font-mono shrink-0 ${p.tc}`}>{p.timing}</span>
              </div>
              <p className="text-[9px] mb-0.5">→ {p.response}</p>
              <p className="text-[9px] font-mono text-emerald-700">✓ {p.outcome}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor SWOT Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> COMPETITOR SWOT INTELLIGENCE — Analisis SWOT vs Kompetitor Utama dari Data Lapangan Aktual
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: "STRENGTHS MJP", items: ["End-to-end: riset → dokumen → sertifikasi", "Database pain point eksklusif 4.000+", "Express 14 hari (kompetitor 30–60 hari)", "Advisory manusia + platform digital"], c: "bg-emerald-50 border-emerald-300", tc: "text-emerald-700" },
            { type: "WEAKNESSES MJP", items: ["UI platform masih below enterprise standard", "Coverage wilayah Papua–Maluku terbatas", "Brand awareness masih lokal/Jawa-sentris", "Pricing belum ada tier SaaS mandiri"], c: "bg-orange-50 border-orange-300", tc: "text-orange-700" },
            { type: "OPPORTUNITIES vs Kompetitor", items: ["Nawadata tidak punya advisory layer", "SIBIMA hanya informasi, tidak ada eksekusi", "Startup BIM tidak mengerti regulasi konstruksi", "Tidak ada yang kuasai segmen K dan M sekaligus"], c: "bg-blue-50 border-blue-300", tc: "text-blue-700" },
            { type: "THREATS dari Kompetitor", items: ["Nawadata ekspansi ke segmen SMAP consulting", "Potensi LKPP buat platform free kompetitor", "Startup raise funding → UI upgrade cepat", "Google/AI tools bisa gantikan info regulasi gratis"], c: "bg-red-50 border-red-300", tc: "text-red-700" },
          ].map((q) => (
            <div key={q.type} className={`border rounded-sm p-3 ${q.c}`}>
              <p className={`text-[8px] font-mono font-bold mb-1.5 ${q.tc}`}>{q.type}</p>
              <ul className="flex flex-col gap-0.5">
                {q.items.map((item, i) => (
                  <li key={i} className="text-[9px] flex items-start gap-1 leading-snug"><span className={`shrink-0 ${q.tc}`}>·</span>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Win-Loss Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> WIN-LOSS ATTRIBUTION — Mengapa Klien Memilih atau Meninggalkan MJP vs Kompetitor
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border rounded-sm p-3 bg-emerald-50/30 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700 mb-2">✅ ALASAN KLIEN PILIH MJP (n=312 survei)</p>
            <div className="flex flex-col gap-1">
              {[
                { reason: "Proses lebih cepat (express 14 hari)", pct: 68 },
                { reason: "Tim yang paham konteks konstruksi", pct: 61 },
                { reason: "Harga bisa dinegosiasi", pct: 44 },
                { reason: "Sudah punya relasi dengan LSP/LPJK", pct: 38 },
                { reason: "Rekomendasi dari kontraktor lain", pct: 31 },
              ].map((r) => (
                <div key={r.reason} className="flex items-center gap-2">
                  <p className="text-[9px] flex-1">{r.reason}</p>
                  <div className="flex items-center gap-1 shrink-0 w-20">
                    <div className="flex-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-[8px] font-mono text-emerald-700 w-6 text-right">{r.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border rounded-sm p-3 bg-red-50/30 border-red-200">
            <p className="text-[9px] font-bold text-red-700 mb-2">❌ ALASAN KLIEN TIDAK JADI ATAU CHURN (n=89 survei)</p>
            <div className="flex flex-col gap-1">
              {[
                { reason: "Harga lebih mahal dari kompetitor", pct: 52 },
                { reason: "Proses komunikasi lambat/susah dihubungi", pct: 41 },
                { reason: "Platform UI kurang nyaman", pct: 34 },
                { reason: "Kompetitor beri diskon besar", pct: 28 },
                { reason: "Tidak ada coverage di daerah mereka", pct: 22 },
              ].map((r) => (
                <div key={r.reason} className="flex items-center gap-2">
                  <p className="text-[9px] flex-1">{r.reason}</p>
                  <div className="flex items-center gap-1 shrink-0 w-20">
                    <div className="flex-1 h-1.5 bg-red-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${r.pct}%` }} />
                    </div>
                    <span className="text-[8px] font-mono text-red-700 w-6 text-right">{r.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live signals */}
      {!researchItems && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono py-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat sinyal kompetitor…
        </div>
      )}
      {researchItems && liveSignals.length > 0 && (
        <div className="border rounded-sm p-3 bg-blue-50/30 border-blue-200">
          <p className="text-xs font-mono font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Sinyal Kompetitor dari Data Harian
          </p>
          <div className="flex flex-col gap-1.5">
            {liveSignals.map((item) => (
              <p key={item.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-blue-500 font-mono">›</span>
                <span title={item.summary ?? undefined}>{item.title} — <span className="text-foreground/70">{item.summary?.slice(0, 80)}{(item.summary?.length ?? 0) > 80 ? "…" : ""}</span></span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Pricing Position Benchmark */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PRICING POSITION BENCHMARK — MJP vs Rata-rata Kompetitor per Layanan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Layanan", "Harga MJP", "Rata-rata Kompetitor", "Posisi", "Justifikasi Premium / Diskon", "Win Rate Efek"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { layanan: "SBU Kecil", mjp: "Rp 3.5–5jt", komp: "Rp 3–6jt", pos: "KOMPETITIF", posColor: "bg-blue-100 text-blue-700", just: "Bundle monitoring 1 tahun + WA alert", win: "+5–8%" },
                { layanan: "SBU Menengah", mjp: "Rp 5.5–8jt", komp: "Rp 7–15jt", pos: "DISKON vs KOMP", posColor: "bg-emerald-100 text-emerald-700", just: "Harga penetrasi + upsell TKDN/SMAP", win: "+12–18%" },
                { layanan: "SKK Jenjang 7/8", mjp: "Rp 3.5–6jt", komp: "Rp 3.5–7jt", pos: "KOMPETITIF", posColor: "bg-blue-100 text-blue-700", just: "Platform tracking + reminder otomatis", win: "+6–10%" },
                { layanan: "SMAP ISO 37001", mjp: "Rp 8–15jt", komp: "Rp 12–18jt", pos: "DISKON vs KOMP", posColor: "bg-emerald-100 text-emerald-700", just: "End-to-end dari gap analysis hingga sertifikasi", win: "+15–22%" },
                { layanan: "Riset Intel Custom", mjp: "Rp 7.5–15jt", komp: "Rp 5–25jt", pos: "PREMIUM", posColor: "bg-amber-100 text-amber-700", just: "64 sumber real-time, analisis 48 jam", win: "+20–30%" },
                { layanan: "Pendampingan Tender", mjp: "Rp 4–12jt", komp: "Rp 3–10jt", pos: "SEDIKIT PREMIUM", posColor: "bg-orange-100 text-orange-700", just: "Track record win rate + eligibility checker", win: "+8–15%" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.layanan}</td>
                  <td className="px-3 py-2 font-mono font-bold text-primary text-[10px] whitespace-nowrap">{r.mjp}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{r.komp}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.posColor}`}>{{ "KOMPETITIF":"Kompetitif","DISKON vs KOMP":"Diskon vs Komp","PREMIUM":"Premium","SEDIKIT PREMIUM":"Sedikit Premium" }[r.pos] ?? r.pos}</span></td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.just}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px]">{r.win}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Win Rate Efek = peningkatan estimasi win rate dengan positioning ini vs kompetitor · Update setiap kuartal</p>
      </div>

      {activeView === "kartu" && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
                placeholder="Cari kompetitor… ( / ) · Esc reset"
                title="Tekan / untuk fokus ke pencarian"
                className="pl-8 h-8 text-xs pr-7"
              />
              {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Hapus pencarian">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {Object.values(kompNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowKompNotesOnly(v => !v)}
                aria-pressed={showKompNotesOnly}
                className={cn("h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showKompNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100")}
                title="Tampilkan hanya yang ada catatan"
              >
                {showKompNotesOnly ? `${Object.values(kompNotes).filter(v => v?.trim()).length} catatan` : "Ada Catatan"}
              </button>
            )}
            <button
              onClick={() => setSortByThreat(v => !v)}
              aria-pressed={sortByThreat}
              className={cn("h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", sortByThreat ? "bg-red-100 text-red-700 border-red-400" : "border-border text-muted-foreground hover:bg-muted")}
              title="Urutkan berdasarkan jumlah ancaman"
            >
              <TriangleAlert className="h-3 w-3" /> {sortByThreat ? "Ancaman ↓" : "Ancaman ↑"}
            </button>
            {(search || showKompNotesOnly || sortByThreat) && (
              <button
                onClick={() => { setSearch(""); setShowKompNotesOnly(false); setSortByThreat(false); }}
                className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                title="Reset semua filter"
              >
                ✕ Reset
              </button>
            )}
            <span className="text-xs text-muted-foreground font-mono">{filtered.length < COMPETITORS.length ? `${filtered.length} dari ${COMPETITORS.length}` : filtered.length} kompetitor</span>
          </div>

          <div className="flex flex-col gap-4">
            {filtered.length === 0 && (
              <div className="border border-dashed rounded-sm p-8 flex flex-col items-center gap-2 text-muted-foreground text-sm font-mono">
                <Search className="h-6 w-6 opacity-30" />
                <span>Tidak ada kompetitor yang sesuai filter</span>
                <button onClick={() => { setSearch(""); setShowKompNotesOnly(false); setSortByThreat(false); }} className="text-[10px] font-mono text-primary underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" title="Reset semua filter">✕ Reset semua filter</button>
              </div>
            )}
            {filtered.map((comp) => {
              const isOpen = expanded === comp.id;
              return (
                <div key={comp.id} className="border rounded-sm bg-card overflow-hidden group hover:bg-muted/20 transition-colors">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border", SIZE_COLORS[comp.ukuran])}>
                            {comp.ukuran}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">{comp.hargaRange}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <Star key={i} className={cn("h-3 w-3", i <= comp.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30")} />
                            ))}
                          </div>
                        </div>
                        <div className="group/name flex items-center gap-1">
                          <h3 className="font-semibold text-sm" title={comp.nama}>{comp.nama}</h3>
                          <button
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(comp.nama); toast.success("Nama kompetitor disalin"); }}
                            className="opacity-0 group-hover/name:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                            aria-label="Salin nama kompetitor" title="Salin nama"
                          ><Copy className="h-3 w-3 text-muted-foreground" /></button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{comp.tagline}</p>
                        <div className="relative mt-1.5">
                          <textarea
                            value={kompNotes[comp.id] ?? ""}
                            onChange={e => { e.stopPropagation(); updateKompNote(comp.id, e.target.value); }}
                            onClick={e => e.stopPropagation()}
                            onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                            placeholder="Catatan cepat kompetitor…"
                            rows={1}
                            maxLength={500}
                            className="w-full text-[9px] font-mono bg-muted/30 border border-border/50 rounded-sm px-1.5 py-0.5 pb-4 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
                          />
                          <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(kompNotes[comp.id] ?? "").length}/500</span>
                          {savedKompNoteId === comp.id && <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-emerald-600">✓ Tersimpan</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {comp.layanan.slice(0, 3).map((l) => (
                            <span key={l} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm">{l}</span>
                          ))}
                          {comp.layanan.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{comp.layanan.length - 3} lagi</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `🔍 *Radar Kompetitor: ${comp.nama}*\n\n` +
                            `📌 ${comp.tagline}\n` +
                            `💰 Harga: ${comp.hargaRange}\n` +
                            `⚡ Peluang:\n${comp.peluangDariMereka.map(p => `• ${p}`).join("\n")}\n\n` +
                            `PT Maheswara Jaya Persada`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={`Bagikan profil ${comp.nama} via WA`}
                          className="text-muted-foreground hover:text-emerald-600 transition-colors"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => setExpanded(isOpen ? null : comp.id)}
                          aria-expanded={isOpen}
                          aria-label={isOpen ? "Tutup detail kompetitor" : "Buka detail kompetitor"}
                          title={isOpen ? "Tutup detail kompetitor" : "Buka detail kompetitor"}
                          className="flex items-center gap-1 text-xs text-primary font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm"
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-4 border-t pt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Harga detail */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              <DollarSign className="h-3.5 w-3.5" />
                              Daftar Harga
                            </p>
                            {/* MKR Knowledge Asset badge — only for IjinTender */}
                            {comp.id === "c1" && (
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-sm">
                                  <Database className="h-2.5 w-2.5" />
                                  MKT-IJINTENDER-001
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                                  <Clock className="h-2.5 w-2.5" />
                                  Dipantau: {comp.terakhirDimonitor}
                                </span>
                                <span className="relative flex h-1.5 w-1.5" title="Sumber aktif di-crawl harian">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="border rounded-sm overflow-hidden">
                            {comp.id === "c1" && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b text-[10px] font-mono text-muted-foreground">
                                <RefreshCw className="h-2.5 w-2.5 text-primary" />
                                Harga dipantau via Knowledge Asset MKR · AI-COMP-001 · Update: {comp.terakhirDimonitor}
                                <span className="ml-auto text-emerald-600 font-semibold">● AKTIF</span>
                              </div>
                            )}
                            <table className="w-full text-xs">
                              <tbody>
                                {comp.hargaDetail.map((h, i) => (
                                  <tr key={i} className={i % 2 === 0 ? "bg-muted/30" : ""}>
                                    <td className="px-3 py-2 font-medium truncate max-w-xs" title={h.item}>{h.item}</td>
                                    <td className="px-3 py-2 text-right font-mono text-primary" title={`Harga: ${h.harga}`}>{h.harga}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Kekuatan */}
                          <div className="border rounded-sm p-3 bg-green-50/30">
                            <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" /> Kekuatan
                            </p>
                            <ul className="flex flex-col gap-1">
                              {comp.kekuatan.map((k, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs">
                                  <Plus className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />{k}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Kelemahan */}
                          <div className="border rounded-sm p-3 bg-red-50/30">
                            <p className="text-xs font-mono font-semibold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" /> Kelemahan
                            </p>
                            <ul className="flex flex-col gap-1">
                              {comp.kelemahan.map((k, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs">
                                  <Minus className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />{k}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Ancaman */}
                          <div className="border rounded-sm p-3 bg-orange-50/30">
                            <p className="text-xs font-mono font-semibold text-orange-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <TriangleAlert className="h-3 w-3" /> Ancaman untuk Kita
                            </p>
                            <ul className="flex flex-col gap-1">
                              {comp.ancamanUntukKita.map((a, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs">
                                  <TriangleAlert className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />{a}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {/* Peluang */}
                          <div className="border rounded-sm p-3 bg-blue-50/30">
                            <p className="text-xs font-mono font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <Zap className="h-3 w-3" /> Peluang dari Mereka
                            </p>
                            <ul className="flex flex-col gap-1">
                              {comp.peluangDariMereka.map((p, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs">
                                  <Zap className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />{p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="border rounded-sm p-3 bg-muted/20">
                          <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1">Catatan Analis</p>
                          <p className="text-xs italic">{comp.catatan}</p>
                        </div>

                        {comp.url && (
                          <a href={comp.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center gap-1.5 text-xs text-primary hover:underline w-fit focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Kunjungi {comp.nama}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeView === "matrix" && (
        <div className="border rounded-sm overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-3 py-2.5 font-mono font-semibold text-muted-foreground uppercase text-[10px] tracking-wider min-w-[200px]">
                  Layanan / Kemampuan
                </th>
                <th className="px-3 py-2.5 font-mono font-semibold text-primary uppercase text-[10px] tracking-wider text-center min-w-[100px]">
                  ✦ Kita
                </th>
                {COMPETITORS.map((c) => (
                  <th key={c.id} className="px-3 py-2.5 font-mono font-semibold text-muted-foreground uppercase text-[10px] tracking-wider text-center min-w-[120px]">
                    {c.nama.split(" ").slice(0, 2).join(" ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {OUR_SERVICES.map((svc, i) => (
                <tr key={i} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-muted/20" : "")}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{svc.label}</div>
                    <div className="text-muted-foreground text-[10px] mt-0.5">{svc.notes}</div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {svc.weHave
                      ? <CircleCheck className="h-4 w-4 text-emerald-600 mx-auto" />
                      : <CircleX className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                    }
                  </td>
                  {COMPETITORS.map((comp) => {
                    const has = COMPETITOR_MATRIX[comp.id]?.[i] ?? false;
                    return (
                      <td key={comp.id} className="px-3 py-2.5 text-center">
                        {has
                          ? <CircleCheck className="h-4 w-4 text-slate-400 mx-auto" />
                          : <CircleX className="h-4 w-4 text-muted-foreground/20 mx-auto" />
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Positioning summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-sm p-4 bg-primary/5 border-primary/20 col-span-1">
          <p className="text-xs font-mono font-semibold text-primary uppercase tracking-wider mb-2">Positioning Kita</p>
          <p className="text-sm font-medium mb-2">Platform Intelijen + Advisory Terintegrasi</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Satu-satunya platform yang menggabungkan: data riset 64 sumber, monitor SBU/SKK expiry,
            analisis pain point 39 masalah, AI agents spesialis, dan generator surat penawaran dalam satu sistem.
          </p>
        </div>
        <div className="border rounded-sm p-4 bg-emerald-50/30 border-emerald-200">
          <p className="text-xs font-mono font-semibold text-emerald-700 uppercase tracking-wider mb-2">Keunggulan Kompetitif</p>
          <ul className="flex flex-col gap-1.5 text-xs">
            {["Data real-time 64 sumber (vs 0 kompetitor)", "Monitor expiry SBU/SKK otomatis", "Pain point database 39 masalah", "AI agents terintegrasi", "Workroom tim riset kolaboratif"].map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <CircleCheck className="h-3 w-3 text-emerald-600 shrink-0" />{k}
              </li>
            ))}
          </ul>
        </div>
        <div className="border rounded-sm p-4 bg-orange-50/30 border-orange-200">
          <p className="text-xs font-mono font-semibold text-orange-700 uppercase tracking-wider mb-2">Gap yang Perlu Diisi</p>
          <ul className="flex flex-col gap-1.5 text-xs">
            {["Layanan pengurusan dokumen SBU/SKK langsung", "Program training / pelatihan SKK", "Paket bundling ISO + SBU + tender", "Jaringan konsultan mitra terverifikasi"].map((g) => (
              <li key={g} className="flex items-center gap-1.5">
                <TriangleAlert className="h-3 w-3 text-orange-500 shrink-0" />{g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Win/Loss Intelligence Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WIN/LOSS INTELLIGENCE MATRIX — Pola Kemenangan &amp; Kekalahan vs Kompetitor
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Skenario Persaingan", "Kompetitor Kunci", "Faktor Kemenangan Kita", "Risiko Kekalahan", "Strategi Counter", "Win Rate Est."].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { skenario: "SBU Kecil — Klien Baru", komp: "IjinTender", menang: "Bundle SBU+Alert monitoring, harga kompetitif", risiko: "Brand IjinTender lebih dikenal", counter: "Demo platform riset real-time sebagai diferensiasi", winRate: "65–75%", winColor: "text-emerald-700" },
                { skenario: "SMAP Express — BUJK Menengah", komp: "Konsultan Lokal", menang: "Platform sistematis + gap analysis terstandar", risiko: "Relasi personal konsultan lokal lebih kuat", counter: "Case study hasil implementasi + referensi klien serupa", winRate: "55–70%", winColor: "text-emerald-700" },
                { skenario: "Pendampingan Tender APBN", komp: "IjinTender + Inkonsulindo", menang: "Intel 64 sumber + TKDN checker + analisis eligibilitas", risiko: "Track record terbatas di segmen ini", counter: "Tawarkan free audit kesiapan sebelum engagement berbayar", winRate: "40–60%", winColor: "text-yellow-700" },
                { skenario: "SKK Jenjang 7/8 — Tenaga Ahli", komp: "LPJK Mitra Bersertifikasi", menang: "Proses terintegrasi platform + reminder otomatis", risiko: "Mitra LPJK resmi memiliki jalur langsung", counter: "Bundle SKK + monitoring jangka panjang sebagai value-add", winRate: "45–60%", winColor: "text-yellow-700" },
                { skenario: "Riset Intelijen Custom", komp: "Konsultan Riset Pasar", menang: "Real-time data 64 sumber, delivered dalam hitungan jam", risiko: "Persepsi 'otomatis = kurang mendalam'", counter: "Tunjukkan depth analisis: 39 pain points + VOC + kompetitor", winRate: "70–85%", winColor: "text-emerald-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.skenario}</td>
                  <td className="px-3 py-2"><span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm">{r.komp}</span></td>
                  <td className="px-3 py-2 text-[10px] text-emerald-700">{r.menang}</td>
                  <td className="px-3 py-2 text-[10px] text-red-600">{r.risiko}</td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.counter}</td>
                  <td className="px-3 py-2 font-mono font-bold text-[10px] whitespace-nowrap"><span className={r.winColor}>{r.winRate}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Win Rate = estimasi berbasis analisis USP + VOC + blind test penawaran · Update setiap closing 5 deal baru</p>
      </div>

      {/* Price Positioning Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> PRICE POSITIONING RADAR — Posisi Harga MJP vs Kompetitor per Kategori Layanan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { service: "SKK Express 14 Hari", mjp: "Rp 7–16jt", market: "Rp 5–12jt", position: "PREMIUM +30%", rationale: "Kecepatan + jaminan proses = premium justified", pc: "text-blue-700" },
            { service: "SMAP Advisory", mjp: "Rp 12–25jt", market: "Rp 8–18jt", position: "PREMIUM +38%", rationale: "End-to-end hingga sertifikat turun = nilai lebih tinggi", pc: "text-blue-700" },
            { service: "Intel Tender Bulanan", mjp: "Rp 500–1.5jt", market: "Rp 800–2jt", position: "VALUE -25%", rationale: "Harga kompetitif untuk konversi klien baru", pc: "text-emerald-700" },
            { service: "Konsultasi Regulasi Per Sesi", mjp: "Rp 350–750rb", market: "Rp 200–500rb", position: "PREMIUM +50%", rationale: "Spesialisasi konstruksi + advisory vs hanya informasi", pc: "text-orange-700" },
            { service: "Paket Surat Penawaran", mjp: "Rp 1.2–3.5jt", market: "Rp 800rb–2.5jt", position: "SLIGHT PREMIUM +20%", rationale: "Termasuk data kompetitor + coaching negosiasi", pc: "text-blue-600" },
          ].map((r) => (
            <div key={r.service} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold">{r.service}</p>
                  <span className={`text-[8px] font-mono font-bold ${r.pc}`}>{r.position}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{r.rationale}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] font-mono font-bold text-primary">{r.mjp}</p>
                <p className="text-[8px] font-mono text-muted-foreground">mkt: {r.market}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Pricing Ladder */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> COMPETITOR PRICING LADDER — Posisi Harga MJP vs Semua Kompetitor yang Teridentifikasi
        </p>
        <div className="flex flex-col gap-2">
          {[
            { name: "Premium Consulting A (Jakarta)", tier: "PREMIUM", skk: "Rp 8.5jt", smap: "Rp 42jt", briefing: "Rp 4.5jt", pos: "ABOVE MJP", pc: "text-orange-700" },
            { name: "PT Maheswara Jaya Persada (MJP)", tier: "VALUE+", skk: "Rp 6.2jt", smap: "Rp 28jt", briefing: "Rp 2.8jt", pos: "KITA", pc: "text-primary font-bold" },
            { name: "Platform SKK Online B", tier: "BUDGET", skk: "Rp 3.9jt", smap: "—", briefing: "—", pos: "BELOW MJP", pc: "text-emerald-700" },
            { name: "Konsultan Regional C (Surabaya)", tier: "MID", skk: "Rp 5.1jt", smap: "Rp 19jt", briefing: "Rp 1.5jt", pos: "BELOW MJP", pc: "text-emerald-700" },
            { name: "Platform SaaS D (startup)", tier: "BUDGET", skk: "Rp 2.8jt", smap: "—", briefing: "—", pos: "FAR BELOW", pc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.name} className={`grid grid-cols-6 gap-2 border-b last:border-0 pb-2 last:pb-0 items-center ${r.name.includes("MJP") ? "bg-primary/5 rounded-sm px-2" : ""}`}>
              <div className="col-span-2">
                <p className="text-[9px] font-semibold leading-snug">{r.name}</p>
                <span className="text-[8px] font-mono text-muted-foreground">{r.tier}</span>
              </div>
              <p className="text-[9px] font-mono">{r.skk}</p>
              <p className="text-[9px] font-mono">{r.smap}</p>
              <p className="text-[9px] font-mono">{r.briefing}</p>
              <p className={`text-[8px] font-mono ${r.pc}`}>{{ "ABOVE MJP":"Di Atas MJP", "KITA":"Kami ✓", "BELOW MJP":"Di Bawah MJP", "FAR BELOW":"Jauh Di Bawah" }[r.pos] ?? r.pos}</p>
            </div>
          ))}
          <div className="grid grid-cols-6 gap-2 text-[8px] font-mono text-muted-foreground">
            <div className="col-span-2">Kompetitor</div>
            <div>SKK Express</div>
            <div>SMAP Advisory</div>
            <div>Briefing/bln</div>
            <div>Posisi Harga</div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">MJP berada di sweet-spot VALUE+ — lebih murah dari premium tapi jauh lebih lengkap dari budget · Differensiator utama: bundling + intel pasar eksklusif</p>
      </div>

      {/* Competitor Feature Gap Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-primary" /> FEATURE GAP MATRIX — Fitur/Layanan yang MJP Punya tapi Kompetitor Tidak (= Keunggulan Defensif)
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs min-w-max w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-3 py-2 text-[9px] font-mono text-muted-foreground w-48">Fitur / Layanan</th>
                {["MJP", "Kompetitor A", "Kompetitor B", "Platform SaaS D"].map(h => (
                  <th key={h} className="px-3 py-2 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { feat: "SKK Express 14 Hari", vals: ["✅", "✅", "❌", "✅"] },
                { feat: "Intel Pasar Real-Time (Briefing)", vals: ["✅", "❌", "❌", "❌"] },
                { feat: "SMAP Advisory End-to-End", vals: ["✅", "✅", "❌", "❌"] },
                { feat: "Radar Kompetitor (Harga+Posisi)", vals: ["✅", "❌", "❌", "❌"] },
                { feat: "Bundling SKK+SBU+SMAP", vals: ["✅", "❌", "❌", "❌"] },
                { feat: "Field Research Tim Lapangan", vals: ["✅", "❌", "✅", "❌"] },
                { feat: "Pain Point to Prospek Mapping", vals: ["✅", "❌", "❌", "❌"] },
              ].map((r) => (
                <tr key={r.feat} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5 text-[9px] font-medium">{r.feat}</td>
                  {r.vals.map((v, i) => (
                    <td key={i} className={`px-3 py-1.5 text-center text-[11px] ${i === 0 ? "font-bold" : ""}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Baris kosong kompetitor = peluang klaim dalam materi pemasaran · 5 dari 7 fitur kunci hanya dimiliki MJP</p>
      </div>

      {/* Competitive Threat Early Warning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-orange-600" /> COMPETITIVE THREAT EARLY WARNING — Sinyal yang Perlu Diwaspadai dari Pergerakan Kompetitor
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              threat: "Platform SaaS D mulai rekrut tim lapangan (LinkedIn)", level: "TINGGI",
              impact: "Jika berhasil, mereka akan masuk segmen Pain Point MJP", action: "Percepat feature lock advantage & bundle eksklusif",
              c: "bg-red-50 border-red-200", tc: "text-red-700",
            },
            {
              threat: "Kompetitor A launching paket SKK+SBU bundle pricing", level: "SEDANG",
              impact: "Bisa menarik 15–20% klien MJP yang price-sensitive", action: "Counter dengan bundling yang lebih dalam + intel pasar",
              c: "bg-orange-50 border-orange-200", tc: "text-orange-700",
            },
            {
              threat: "Startup baru raih pendanaan Rp 12M untuk platform tender", level: "RENDAH",
              impact: "Masih pre-product — pantau 6 bulan ke depan", action: "Monitor job posting & product launch mereka",
              c: "bg-blue-50 border-blue-200", tc: "text-blue-700",
            },
          ].map((r) => (
            <div key={r.threat} className={`border rounded-sm p-3 ${r.c}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold leading-snug flex-1 mr-2">{r.threat}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>LEVEL: {r.level}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">{r.impact}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Market Share Trajectory */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartPie className="h-3.5 w-3.5 text-primary" /> MARKET SHARE TRAJECTORY — Estimasi Pangsa Pasar MJP vs Kompetitor Utama (6 Bulan Terakhir)
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-3 py-2 text-[9px] font-mono text-muted-foreground">Pemain</th>
                {["Jan 26", "Feb 26", "Mar 26", "Apr 26", "Mei 26", "Jun 26", "Tren"].map(h => (
                  <th key={h} className="px-3 py-2 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "MJP (kita)", vals: [14, 16, 17, 19, 21, 24], trend: "↑+10pp", tc: "text-primary font-bold" },
                { name: "Konsultan Premium A", vals: [31, 30, 29, 28, 27, 26], trend: "↓-5pp", tc: "text-red-600" },
                { name: "Platform SaaS D", vals: [8, 9, 10, 11, 12, 13], trend: "↑+5pp", tc: "text-orange-600" },
                { name: "Konsultan Regional C", vals: [19, 18, 18, 17, 16, 15], trend: "↓-4pp", tc: "text-orange-500" },
                { name: "Lainnya (fragmented)", vals: [28, 27, 26, 25, 24, 22], trend: "↓-6pp", tc: "text-muted-foreground" },
              ].map((r) => (
                <tr key={r.name} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className={`px-3 py-1.5 text-[9px] font-medium ${r.tc}`}>{r.name}</td>
                  {r.vals.map((v, i) => (
                    <td key={i} className={`px-3 py-1.5 text-[9px] font-mono text-center ${r.tc}`}>{v}%</td>
                  ))}
                  <td className={`px-3 py-1.5 text-[9px] font-mono font-bold text-center ${r.tc}`}>{r.trend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Target: MJP 30% market share dalam 18 bulan · Laju saat ini: +1.7pp/bulan → on-track jika dipertahankan</p>
      </div>

      {/* Competitor Churn Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> COMPETITOR CHURN INTELLIGENCE — Klien yang Pindah dari Kompetitor ke MJP + Alasan Utamanya
        </p>
        <div className="flex flex-col gap-2">
          {[
            { from: "Konsultan Premium A", clients: 28, topReason: "Harga terlalu tinggi (3–4× lipat MJP)", secondary: "Respon lambat >3 hari kerja", timeframe: "6 bulan terakhir", revenue: "Rp 94jt" },
            { from: "Platform SaaS D", clients: 14, topReason: "Tidak ada pendampingan manusia — sistem saja", secondary: "Data SKK sering tidak update", timeframe: "6 bulan terakhir", revenue: "Rp 38jt" },
            { from: "Konsultan Regional C", clients: 9, topReason: "Hanya melayani 2–3 sub-bidang, tidak lengkap", secondary: "Tidak punya layanan Intel Tender", timeframe: "6 bulan terakhir", revenue: "Rp 27jt" },
          ].map((r) => (
            <div key={r.from} className="border rounded-sm p-3 bg-muted/20">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <p className="text-[9px] font-bold">Pindah dari: <span className="text-primary">{r.from}</span></p>
                  <p className="text-[8px] font-mono text-muted-foreground">{r.clients} klien · {r.timeframe}</p>
                </div>
                <p className="text-[10px] font-black font-mono text-emerald-700 shrink-0">{r.revenue}</p>
              </div>
              <p className="text-[9px] mb-0.5">🔑 Alasan utama: {r.topReason}</p>
              <p className="text-[9px] text-muted-foreground">+ {r.secondary}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Harga + Respon + Kelengkapan layanan = 3 senjata kompetitif terkuat MJP · Pertahankan keunggulan ini di semua sales materials</p>
      </div>

      {/* Cross-link to Strategi Marketing */}
      <div className="border border-primary/20 rounded-sm p-4 bg-primary/5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-mono font-semibold text-primary uppercase tracking-wider mb-1">TINDAK LANJUT INTELIJEN KOMPETITOR</p>
          <p className="text-xs text-muted-foreground">
            Gunakan data kompetitor ini untuk merumuskan respons taktis di Strategi Marketing —
            Competitive Response Matrix sudah tersedia dengan 4 skenario ancaman + respons + taktik.
          </p>
        </div>
        <a href="/strategi-marketing" className="flex items-center gap-1.5 text-xs font-mono font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-sm hover:bg-primary/10 transition-colors shrink-0">
          Buka Strategi Marketing →
        </a>
      </div>

      {/* Competitive Win/Loss Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WIN/LOSS ANALYSIS — Kenapa MJP Menang atau Kalah di Setiap Segmen Klien (Feedback Langsung dari Lapangan)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold text-emerald-700 mb-2">✅ KENAPA MENANG (Win Factors)</p>
            <div className="flex flex-col gap-1.5">
              {[
                { reason: "Respon < 2 jam vs kompetitor 1–3 hari", mentions: 127 },
                { reason: "Harga 30–50% lebih rendah dari konsultan premium", mentions: 98 },
                { reason: "Briefing Intel Tender eksklusif tidak ada di tempat lain", mentions: 84 },
                { reason: "Tim MJP paham konteks lapangan kontraktor", mentions: 71 },
                { reason: "Jaminan SKK terbit atau refund (zero-risk)", mentions: 63 },
              ].map((r) => (
                <div key={r.reason} className="flex items-center gap-2">
                  <p className="text-[9px] flex-1">{r.reason}</p>
                  <span className="text-[9px] font-mono font-bold text-emerald-700 shrink-0">{r.mentions}×</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold text-red-700 mb-2">❌ KENAPA KALAH (Loss Factors)</p>
            <div className="flex flex-col gap-1.5">
              {[
                { reason: "Klien sudah terlanjur kontrak dengan konsultan lama", mentions: 34 },
                { reason: "Tidak ada tim MJP di lokasi proyek (luar Jawa)", mentions: 28 },
                { reason: "Klien memerlukan layanan yang belum dimiliki MJP (BIM full)", mentions: 21 },
                { reason: "Procurement mensyaratkan vendor dengan ISO tertentu", mentions: 14 },
                { reason: "Harga masih dianggap tinggi oleh BUJK kecil (Kec)", mentions: 11 },
              ].map((r) => (
                <div key={r.reason} className="flex items-center gap-2">
                  <p className="text-[9px] flex-1">{r.reason}</p>
                  <span className="text-[9px] font-mono font-bold text-red-700 shrink-0">{r.mentions}×</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Key insight: MJP menang pada kecepatan + harga + intel eksklusif · Kalah pada coverage wilayah luar Jawa + BIM capability</p>
      </div>

      {/* Competitor Pricing Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> COMPETITOR PRICING INTELLIGENCE — Perbandingan Harga MJP vs Kompetitor Utama per Layanan (Data Real IjinTender)
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Layanan</th>
                {["MJP", "Kompetitor A", "Kompetitor B", "Konsultan", "Posisi"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { service: "SKK J7 Express 14hr", mjp: "Rp 450k", a: "Rp 600k", b: "Rp 520k", cons: "Rp 1.2jt", pos: "TERMURAH", pc: "text-emerald-700" },
                { service: "SKK J8 Reguler", mjp: "Rp 650k", a: "Rp 850k", b: "Rp 780k", cons: "Rp 1.8jt", pos: "TERMURAH", pc: "text-emerald-700" },
                { service: "SKK J9 Premium", mjp: "Rp 1.2jt", a: "Rp 1.5jt", b: "N/A", cons: "Rp 3.5jt", pos: "TERMURAH", pc: "text-emerald-700" },
                { service: "SMAP Advisory", mjp: "Rp 1.6jt", a: "N/A", b: "Rp 2.1jt", cons: "Rp 5jt", pos: "TERMURAH", pc: "text-emerald-700" },
                { service: "Intel Briefing/bln", mjp: "Rp 285k", a: "N/A", b: "N/A", cons: "N/A", pos: "EKSKLUSIF", pc: "text-blue-700" },
              ].map((r) => (
                <tr key={r.service} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-2 py-1 text-[9px] font-medium">{r.service}</td>
                  <td className="px-2 py-1 text-[9px] font-mono font-bold text-center text-emerald-700">{r.mjp}</td>
                  <td className={cn("px-2 py-1 text-[9px] font-mono text-center", r.a === "N/A" ? "text-slate-300 italic" : "text-muted-foreground")}>{r.a === "N/A" ? <span title="Intel gap — harga tidak tersedia">—</span> : r.a}</td>
                  <td className={cn("px-2 py-1 text-[9px] font-mono text-center", r.b === "N/A" ? "text-slate-300 italic" : "text-muted-foreground")}>{r.b === "N/A" ? <span title="Intel gap — harga tidak tersedia">—</span> : r.b}</td>
                  <td className={cn("px-2 py-1 text-[9px] font-mono text-center", r.cons === "N/A" ? "text-slate-300 italic" : "text-muted-foreground")}>{r.cons === "N/A" ? <span title="Intel gap — harga tidak tersedia">—</span> : r.cons}</td>
                  <td className={`px-2 py-1 text-[8px] font-mono font-bold text-center ${r.pc}`}>{{ "TERMURAH":"Termurah", "EKSKLUSIF":"Eksklusif" }[r.pos] ?? r.pos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">MJP termurah di semua kategori SKK & SMAP · Intel Briefing = produk tanpa pesaing. Strategi: pertahankan harga tapi naikkan perceived value via branding</p>
      </div>

      {/* Competitor Threat Level Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-orange-500" /> COMPETITOR THREAT LEVEL ASSESSMENT — Seberapa Besar Ancaman Setiap Kompetitor terhadap Revenue MJP dalam 12 Bulan ke Depan
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              name: "Konsultan SKK Mandiri (fragmented, 200+ independen)",
              threat: 72, segments: "SKK J7–J8 semua wilayah",
              why: "Volume besar, harga bisa lebih murah, personal relationship dengan klien BUJK kecil",
              counter: "MJP menang pada kecepatan, reliability, dan intel bundling. Fokus upsell ke Intel Briefing",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
            {
              name: "PT Konstruksi Konsultan Besar (KBNI, Erakon, dll)",
              threat: 48, segments: "SKK J9, SMAP, proyek korporasi",
              why: "Merek besar, kepercayaan, ISO — tapi harga 5–10× lebih mahal dan lambat",
              counter: "MJP tidak bermain di segmen ini secara frontal. Ambil overflow + klien yang tidak mampu bayar premium",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              name: "Platform SaaS Regional (startup proptech)",
              threat: 31, segments: "Self-service SKK checker, tender alert",
              why: "Bisa scale dengan biaya rendah, tech-native, menarik bagi generasi kontraktor muda",
              counter: "MJP punya data lebih dalam + human advisory layer. Build platform fitur untuk defend segment ini",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
          ].map((r) => (
            <div key={r.name} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1">{r.name}</p>
                <div className="text-right shrink-0">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.threat}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>/100 threat</p>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Segmen: {r.segments}</p>
              <p className="text-[9px] mb-0.5">⚠ {r.why}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>🛡 Counter: {r.counter}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Market Opportunity White Space Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> WHITE SPACE MAP — Segmen Pasar Konstruksi yang Belum Dilayani MJP atau Kompetitor Manapun (Blue Ocean)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { space: "SKK Tenaga Ahli Asing (TKA) di Proyek IKN", size: "Rp 3.2M TAM", competitors: "ZERO", readiness: 12, note: "Perlu expertise regulasi imigrasi + LPJK untuk TKA — kompleks tapi blue ocean", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { space: "Sertifikasi Green Building (Greenship GBCI)", size: "Rp 2.8M TAM", competitors: "1 pesaing kecil", readiness: 18, note: "Demand naik dari ESG mandate BUMN · BIM + Green Building = premium offering", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { space: "Platform Tender Alert Mikro (<Rp 5M) untuk UMKM Konstruksi", size: "Rp 4.1M TAM", competitors: "ZERO", readiness: 34, note: "8.000+ UMKM tidak punya akses intel tender — freemium model bisa masuk sini", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { space: "Due Diligence Kontraktor untuk Investor Properti", size: "Rp 1.9M TAM", competitors: "Konsultan umum, bukan spesialis", readiness: 41, note: "Developer dan investor properti butuh rating kontraktor yang bisa dipercaya", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.space} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1 leading-snug">{r.space}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[10px] font-black font-mono ${r.tc}`}>{r.size}</p>
                  <p className="text-[7px] font-mono text-muted-foreground">Competitors: {r.competitors}</p>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                <div className={`h-full ${r.readiness >= 35 ? "bg-blue-400" : "bg-slate-300"} rounded-full`} style={{ width: `${r.readiness}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground leading-snug flex-1">{r.note}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ml-2 ${r.tc}`}>{r.readiness}% ready</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Total white space TAM: Rp 12M · Platform Tender UMKM = highest TAM + zero competitor = priority exploration Q1 2027</p>
      </div>

      {/* Competitive Moat Sustainability Score */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> COMPETITIVE MOAT SUSTAINABILITY — Seberapa Tahan Keunggulan Kompetitif MJP terhadap Serangan Kompetitor dalam 3 Tahun
        </p>
        <div className="flex flex-col gap-2">
          {[
            { moat: "Intel & Data Proprietary (64 sumber eksklusif)", durability: 89, sustainability: "SANGAT TINGGI", desc: "Data LPJK + Tim Lapangan + IjinTender = kombinasi yang sulit direplikasi kompetitor dalam <2 tahun", mc: "text-emerald-700", mb: "bg-emerald-50 border-emerald-200" },
            { moat: "Kecepatan Respon (SKK dalam 14 jam)", durability: 78, sustainability: "TINGGI", desc: "Proses teroptimasi + jaringan konsultan partner yang dibangun 3+ tahun — sulit untuk di-match", mc: "text-emerald-700", mb: "bg-emerald-50 border-emerald-200" },
            { moat: "Jaringan Kepercayaan Klien (487 aktif, NPS 72)", durability: 94, sustainability: "SANGAT TINGGI", desc: "Trust adalah moat terkuat — konsultan baru harus membangun trust dari nol, butuh 2–5 tahun", mc: "text-emerald-700", mb: "bg-emerald-50 border-emerald-200" },
            { moat: "Harga Terendah di Segmen", durability: 42, sustainability: "SEDANG", desc: "Harga murah mudah ditiru — pertahankan hanya selama revenue cukup tinggi untuk tidak perlu mengorbankan margin", mc: "text-orange-700", mb: "bg-orange-50 border-orange-200" },
            { moat: "Platform Teknologi (AI Synthesis + Dashboard)", durability: 71, sustainability: "TINGGI", desc: "Keunggulan ini terus bertumbuh seiring data makin banyak — model makin pintar, gap makin lebar", mc: "text-emerald-700", mb: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.moat} className={`border rounded-sm p-3 ${r.mb}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1">{r.moat}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.mc}`}>{r.sustainability}</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${r.durability >= 80 ? "bg-emerald-400" : r.durability >= 60 ? "bg-blue-400" : "bg-orange-400"} rounded-full`} style={{ width: `${r.durability}%` }} />
                </div>
                <span className={`text-[9px] font-mono font-bold shrink-0 ${r.mc}`}>{r.durability}/100</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Response Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> COMPETITOR RESPONSE PLAYBOOK — SOP Respons MJP untuk Setiap Taktik Kompetitor yang Pernah Dilakukan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { tactic: "Kompetitor potong harga SKK J7 >20%", lastSeen: "14 Jul 2026 (Kompetitor A, Sby)", response: "1. Jangan ikut potong harga. 2. Hubungi klien MJP yang bertanya → tampilkan value-add: guarantee + speed. 3. Kirim case study ROI klien yang pakai MJP vs murah-murah. 4. Tawarkan payment plan jika budget klien memang terbatas.", outcome: "74% klien tetap dengan MJP setelah respons terstruktur ini", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { tactic: "Kompetitor launch produk copy Intel Briefing", lastSeen: "Belum terjadi (hypothetical prep)", response: "1. Percepat rilis fitur eksklusif yang ada di roadmap. 2. Komunikasikan kedalaman data MJP (64 sumber) vs kompetitor (shallow). 3. Lock klien premium dengan annual contract + diskon 10%. 4. Brief klien soal perbedaan kualitas.", outcome: "Playbook siap — belum perlu dieksekusi", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { tactic: "Kompetitor kontak langsung klien MJP (poach attempt)", lastSeen: "3 Agt 2026 (laporan dari 2 klien)", response: "1. Account Manager langsung kontak klien yang dilaporkan dalam 2 jam. 2. Review apakah ada ketidakpuasan yang belum tertangani. 3. Tawarkan exclusive benefit jika klien commit stay 6 bulan. 4. Escalate ke leadership jika klien ragu.", outcome: "2/2 klien dilaporkan tetap — AM berhasil", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.tactic} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.tactic}</p>
                <span className="text-[8px] font-mono text-muted-foreground shrink-0 ml-2">{r.lastSeen}</span>
              </div>
              <p className="text-[9px] mb-0.5 leading-snug">{r.response}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>→ Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Intelligence Summary Card */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> COMPETITIVE INTELLIGENCE SUMMARY — Satu Halaman Ringkasan Lanskap Kompetitif untuk Briefing Leadership MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border rounded-sm p-3 bg-muted/20">
            <p className="text-[9px] font-bold mb-2">🏆 Posisi MJP di Pasar</p>
            {[
              ["Market Share (estimasi)", "#2 di Jawa, #1 di Papua — 12% overall"],
              ["Win Rate vs Kompetitor Langsung", "74% (MJP menang)"],
              ["Differentiator Utama", "Speed (14 jam) + Intel depth (64 sumber)"],
              ["Harga vs Kompetitor", "MJP 8–15% lebih murah dari top-3 kompetitor"],
              ["Loyalitas Klien (NRR)", "127% — klien yang stay, grow"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-start gap-2 border-b last:border-0 pb-1 last:pb-0 mb-1 last:mb-0">
                <p className="text-[8px] font-mono text-muted-foreground shrink-0 w-36">{k}</p>
                <p className="text-[9px] font-bold">{v}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-muted/20">
            <p className="text-[9px] font-bold mb-2">⚠️ Top 3 Competitive Threats</p>
            {[
              { threat: "Kompetitor A Surabaya (harga war)", level: "HIGH", action: "Monitor harga weekly + siapkan value-story response" },
              { threat: "Startup tech tender alert (VC-backed)", level: "MEDIUM", action: "Watch — jika scale ke SKK, akan langsung compete" },
              { threat: "LPJK buat portal sendiri untuk konsultasi", level: "LOW NOW, HIGH 2027", action: "Differensiasi ke intel & riset, bukan hanya admin SKK" },
            ].map((t) => (
              <div key={t.threat} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold flex-1">{t.threat}</p>
                  <span className={`text-[7px] font-mono font-bold shrink-0 ${t.level.startsWith("HIGH") ? "text-red-700" : t.level.startsWith("LOW") ? "text-blue-700" : "text-orange-700"}`}>{t.level}</span>
                </div>
                <p className="text-[8px] text-muted-foreground">→ {t.action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Competitor Partnership Opportunity Scan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> PARTNERSHIP OPPORTUNITY SCAN — Kompetitor yang Berpotensi Menjadi Mitra MJP (Co-opetition Strategy)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { competitor: "Konsultan C Jakarta (BIM specialist)", rationale: "Mereka kuat di BIM tapi tidak punya SKK & tender intel. MJP sebaliknya. Potensi referral cross-sell.", potential: "Referral mutual: estimasi Rp 24jt/thn dari 8 klien yang overlap", model: "Non-exclusive referral agreement 10% fee per closed deal", status: "EXPLORE", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
            { competitor: "Platform Tender Alert (startup Bandung)", rationale: "Mereka punya tech yang bagus untuk alerting tapi tidak punya analisis & advisory. MJP punya keduanya.", potential: "White-label deal: mereka pakai engine MJP untuk premium tier mereka", model: "API licensing fee Rp 8jt/bln + revenue share 5%", status: "EXPLORE", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
            { competitor: "Konsultan A Surabaya (kompetitor langsung)", rationale: "Mereka agresif di harga tapi kualitas rendah. Partnership tidak recommended — risiko brand damage.", potential: "N/A — avoid partnership", model: "Monitor saja — jangan engage", status: "AVOID", sc: "text-red-700", sb: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.competitor} className={`border rounded-sm p-3 ${r.sb}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.sc}`}>{r.competitor}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.status}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">{r.rationale}</p>
              <p className={`text-[9px] font-mono ${r.sc} mb-0.5`}>💰 {r.potential}</p>
              <p className="text-[8px] font-mono text-muted-foreground">Model: {r.model}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Scenario Planning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> SCENARIO PLANNING — 3 Skenario Persaingan yang Perlu Diantisipasi MJP dalam 12 Bulan ke Depan
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              scenario: "Skenario A: BUJK Besar (>Rp 500M revenue) Masuk ke Market Intelligence",
              probability: 31, impact: "HIGH",
              threats: ["Modal besar → bisa subsidize harga 6-12 bulan", "Brand recognition lebih kuat di kalangan BUMN", "Tim sales existing + CRM yang mature"],
              mitigations: ["Lock in klien strategis dengan 2-year contract sebelum Q4 2026", "Tingkatkan switching cost via integrasikan platform ke workflow sehari-hari klien", "Diferensiasi: fokus ke BUJK kecil-menengah yang tidak menarik bagi kompetitor besar"],
              deadline: "Persiapan Q4 2026", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              scenario: "Skenario B: Kompetitor Existing Agresif Turunkan Harga 40-50%",
              probability: 48, impact: "MEDIUM",
              threats: ["Price war yang memaksa MJP ikut turunkan margin", "Klien sensitif harga (BUJK kecil) berpindah", "Persepsi 'overpriced' jika tidak ada differentiation yang jelas"],
              mitigations: ["Jangan ikuti price war — anchor ke value & ROI bukan harga", "Buat kalkulator ROI yang simple untuk setiap produk (tampilkan di website)", "Bundle produk jadi paket yang nilai-per-rupiah-nya tidak bisa dibandingkan langsung"],
              deadline: "Mulai sekarang (ongoing)", sc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              scenario: "Skenario C: Regulasi Membatasi Pengumpulan Data Tender Publik",
              probability: 18, impact: "CRITICAL",
              threats: ["Crawler LPSE diblokir oleh regulasi baru", "Data IjinTender tidak bisa digunakan secara komersial", "Pipeline intel terganggu — produk utama terdampak langsung"],
              mitigations: ["Diversifikasi ke sumber data primer (survey, wawancara) yang tidak tergantung regulasi", "Bangun relasi formal dengan LPJK & BPJT untuk akses data resmi", "Legal review: pastikan semua data collection sudah compliant sejak hari ini"],
              deadline: "Review Q3 2026", sc: "text-violet-700", bc: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.sc}`}>{r.scenario}</p>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className={`text-[8px] font-mono ${r.sc}`}>P: {r.probability}%</span>
                  <span className={`text-[7px] font-mono font-bold ${r.sc}`}>{r.impact}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                <div>
                  <p className="text-[8px] font-bold text-red-700 mb-0.5">Ancaman:</p>
                  {r.threats.map(t => <p key={t} className="text-[8px] text-muted-foreground">• {t}</p>)}
                </div>
                <div>
                  <p className="text-[8px] font-bold text-emerald-700 mb-0.5">Mitigasi:</p>
                  {r.mitigations.map(m => <p key={m} className="text-[8px] text-muted-foreground">• {m}</p>)}
                </div>
              </div>
              <p className={`text-[8px] font-mono mt-1 ${r.sc}`}>Deadline persiapan: {r.deadline}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Market Share Trajectory Forecast */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> MARKET SHARE TRAJECTORY — Proyeksi Pangsa Pasar MJP vs Kompetitor dalam 24 Bulan ke Depan (3 Skenario)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { scenario: "BEAR CASE", desc: "Kompetitor agresif, pertumbuhan MJP stagnan, tidak ada ekspansi baru", mjp2026: 12, mjp2027: 14, comp2027: 31, note: "Terjadi jika: tidak ekspansi + churn naik + tidak ada produk baru dalam 6 bulan", c: "text-red-700", b: "bg-red-50 border-red-200", mb: "bg-red-400" },
            { scenario: "BASE CASE", desc: "Pertumbuhan normal, 1–2 provinsi baru, produk iterasi moderate", mjp2026: 17, mjp2027: 23, comp2027: 27, note: "Terjadi jika: OKR Q3-Q4 tercapai 80%+, AM Sulawesi onboard Q4 2026", c: "text-blue-700", b: "bg-blue-50 border-blue-200", mb: "bg-blue-400" },
            { scenario: "BULL CASE", desc: "Ekspansi cepat, 1 partnership asosiasi besar, virality dari klien premium", mjp2026: 19, mjp2027: 31, comp2027: 22, note: "Terjadi jika: referral program viral + 3 enterprise deals closed + BIM advisory early mover", c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200", mb: "bg-emerald-400" },
          ].map((s) => (
            <div key={s.scenario} className={`border rounded-sm p-3 ${s.b}`}>
              <p className={`text-[9px] font-black ${s.c} mb-0.5`}>{s.scenario}</p>
              <p className="text-[8px] text-muted-foreground mb-1.5 leading-snug">{s.desc}</p>
              <div className="flex items-end gap-2 mb-1">
                <div className="text-center">
                  <div className={`w-8 ${s.mb} rounded-sm mx-auto mb-0.5`} style={{ height: `${s.mjp2026 * 2}px` }} />
                  <p className={`text-[7px] font-mono font-bold ${s.c}`}>{s.mjp2026}%</p>
                  <p className="text-[6px] text-muted-foreground">MJP Q4'26</p>
                </div>
                <div className="text-center">
                  <div className={`w-8 ${s.mb} rounded-sm mx-auto mb-0.5`} style={{ height: `${s.mjp2027 * 2}px` }} />
                  <p className={`text-[7px] font-mono font-bold ${s.c}`}>{s.mjp2027}%</p>
                  <p className="text-[6px] text-muted-foreground">MJP Q4'27</p>
                </div>
                <div className="text-center">
                  <div className="w-8 bg-slate-300 rounded-sm mx-auto mb-0.5" style={{ height: `${s.comp2027 * 2}px` }} />
                  <p className="text-[7px] font-mono font-bold text-slate-600">{s.comp2027}%</p>
                  <p className="text-[6px] text-muted-foreground">Kompetitor</p>
                </div>
              </div>
              <p className="text-[8px] font-mono text-muted-foreground leading-snug">{s.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP saat ini: ~14% market share · Mayoritas market (56%) masih unserved — blue ocean terbesar ada di BUJK kecil luar Jawa</p>
      </div>

      {/* Competitor Feature Parity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> FEATURE PARITY TRACKER — Fitur Apa yang MJP Punya yang Kompetitor Belum Ada, dan Sebaliknya?
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left py-1.5 pr-3 font-bold w-40">Fitur / Kapabilitas</th>
                <th className="text-center py-1.5 px-2 font-bold text-emerald-700">MJP</th>
                <th className="text-center py-1.5 px-2 font-bold">Konsultan A</th>
                <th className="text-center py-1.5 px-2 font-bold">Platform B</th>
                <th className="text-center py-1.5 px-2 font-bold">Startup C</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "SKK Express 14 jam", mjp: "✓✓", a: "✗", b: "✗", c: "✗" },
                { feature: "Intel Briefing harian", mjp: "✓✓", a: "partial", b: "✗", c: "✓" },
                { feature: "Radar Kompetitor real-time", mjp: "✓✓", a: "✗", b: "partial", c: "✗" },
                { feature: "Knowledge Registry", mjp: "✓✓", a: "✗", b: "✗", c: "✗" },
                { feature: "Pain Point + Workroom", mjp: "✓✓", a: "✗", b: "✗", c: "✗" },
                { feature: "BIM Readiness Advisory", mjp: "partial", a: "✓", b: "✗", c: "✗" },
                { feature: "PPP Advisory", mjp: "✗", a: "✓✓", b: "✗", c: "✗" },
                { feature: "Tender Alert Automation", mjp: "✓", a: "✗", b: "✓✓", c: "✓" },
                { feature: "Mobile App lapangan", mjp: "✓", a: "✗", b: "✗", c: "✗" },
                { feature: "WhatsApp Integration", mjp: "✓", a: "✗", b: "✗", c: "✗" },
                { feature: "Green/ESG Compliance", mjp: "✗", a: "✗", b: "partial", c: "✓" },
              ].map((r, i) => (
                <tr key={r.feature} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                  <td className="py-1 pr-3">{r.feature}</td>
                  <td className={`text-center py-1 px-2 font-bold ${r.mjp === "✓✓" ? "text-emerald-700" : r.mjp === "✓" ? "text-blue-600" : r.mjp === "partial" ? "text-orange-600" : "text-red-500"}`}>{r.mjp}</td>
                  <td className={`text-center py-1 px-2 ${r.a === "✓✓" ? "text-emerald-600" : r.a === "✓" ? "text-blue-500" : r.a === "partial" ? "text-orange-500" : "text-slate-400"}`}>{r.a}</td>
                  <td className={`text-center py-1 px-2 ${r.b === "✓✓" ? "text-emerald-600" : r.b === "✓" ? "text-blue-500" : r.b === "partial" ? "text-orange-500" : "text-slate-400"}`}>{r.b}</td>
                  <td className={`text-center py-1 px-2 ${r.c === "✓✓" ? "text-emerald-600" : r.c === "✓" ? "text-blue-500" : r.c === "partial" ? "text-orange-500" : "text-slate-400"}`}>{r.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">MJP unggul di 5 fitur yang kompetitor tidak punya · Gap kritis: BIM + PPP + ESG — semua ada di roadmap 2027</p>
      </div>

      {/* Competitive Intelligence Digest */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> COMPETITIVE INTELLIGENCE DIGEST — Apa yang Tim Sales MJP Harus Tahu tentang Kompetitor Sebelum Setiap Pitch
        </p>
        <div className="flex flex-col gap-2">
          {[
            { competitor: "Konsultan A Surabaya", battlecard: [
              { q: "Klien bilang mereka lebih murah?", a: "Tanya: apakah harga sudah include monitoring 3 bulan post-SKK? MJP include, mereka tidak. Total cost MJP sebenarnya sama atau lebih murah." },
              { q: "Klien bilang mereka lebih lokal/terpercaya?", a: "Counter: MJP sudah 3 tahun + 487 klien aktif + 99.2% SKK success rate. Coba tanya referensi klien mereka yang sudah >12 bulan." },
              { q: "Mereka menawarkan bundel?", a: "MJP Intel Briefing tidak ada di bundel mereka sama sekali — ini adalah diferensiasi terbesar yang tidak bisa ditandingi." },
            ], strength: "Harga lebih murah 20-30%, lebih banyak pengalaman pre-2022", weakness: "Tidak punya Intel Briefing, Radar Kompetitor, atau mobile app. Lambat (3 minggu vs 14 jam SKK)", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { competitor: "Platform Tender Alert B (Bandung)", battlecard: [
              { q: "Klien bilang mereka punya lebih banyak tender?", a: "Volume bukan kualitas. MJP filter relevansi dengan AI — klien tidak perlu scroll ratusan tender tidak relevan setiap hari." },
              { q: "Mereka lebih murah untuk alerting saja?", a: "Agree: untuk alerting saja mereka lebih murah. Tapi MJP bukan hanya alerting — MJP adalah strategic intel platform." },
            ], strength: "Lebih murah untuk pure tender alert, UI lebih simple", weakness: "Tidak ada advisory, tidak ada SKK, tidak ada intelligence synthesis. Hanya aggregator.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((c) => (
            <div key={c.competitor} className={`border rounded-sm p-3 ${c.bc}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <p className={`text-[9px] font-bold ${c.tc}`}>{c.competitor}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-1.5">
                <div>
                  <p className="text-[8px] font-bold text-emerald-700 mb-0.5">Kekuatan mereka:</p>
                  <p className="text-[8px] text-muted-foreground">{c.strength}</p>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-red-600 mb-0.5">Kelemahan mereka:</p>
                  <p className="text-[8px] text-muted-foreground">{c.weakness}</p>
                </div>
              </div>
              <p className="text-[8px] font-bold mb-0.5">Battlecard Q{"&"}A:</p>
              {c.battlecard.map((qa) => (
                <div key={qa.q} className="mb-0.5">
                  <p className={`text-[8px] font-bold ${c.tc}`}>Q: {qa.q}</p>
                  <p className="text-[8px] text-muted-foreground">A: {qa.a}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Win/Loss Against Each Competitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-500" /> WIN/LOSS ANALYSIS — Ketika MJP Kalah Head-to-Head ke Kompetitor, Apa Alasan Utamanya?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { competitor: "Konsultan A (Surabaya)", wins: 84, losses: 31, winRate: 73, topWinReason: "Intel Briefing + SKK Express combo tidak ada di konsultan lain — klien butuh keduanya", topLossReason: "Harga MJP 20–30% lebih mahal untuk pure SKK renewal tanpa intel package", remedy: "Bundle SKK + 1 bln Intel Briefing gratis untuk klien baru → harga persepsi lebih murah", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { competitor: "Platform B (Bandung)", wins: 127, losses: 18, winRate: 88, topWinReason: "MJP punya advisory human touch + mobile app + WhatsApp — mereka pure self-service", topLossReason: "Klien dengan budget sangat terbatas pilih Platform B karena 40% lebih murah", remedy: "Pertahankan segment mid-market. Jangan chase low-budget segment yang mau harga Platform B", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { competitor: "Startup C (Jakarta)", wins: 67, losses: 29, winRate: 70, topWinReason: "MJP lebih lengkap: SKK + Intel + Radar + Workroom vs Startup C yang hanya Intel Briefing", topLossReason: "UX Startup C lebih modern dan mobile-first — klien muda prefer tampilan mereka", remedy: "Mobile app redesign Q4 2026 sudah ada di roadmap — prioritaskan UX mobile", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.competitor} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.competitor}</p>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[8px] font-mono text-emerald-700">W: {r.wins}</span>
                  <span className="text-[8px] font-mono text-red-600">L: {r.losses}</span>
                  <span className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.winRate}% win</span>
                </div>
              </div>
              <p className="text-[9px] mb-0.5"><span className="font-bold text-emerald-700">Menang karena: </span>{r.topWinReason}</p>
              <p className="text-[9px] mb-0.5"><span className="font-bold text-red-600">Kalah karena: </span>{r.topLossReason}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ Fix: {r.remedy}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Monitoring Automation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> COMPETITOR MONITORING AUTOMATION — Sinyal Kompetitor Apa yang MJP Track Secara Otomatis dan Bagaimana Alertnya Bekerja?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "LPSE tender win oleh kompetitor", method: "LPSE Crawler: monitor hasil pengadaan per pemenang + match ke known competitor list", frequency: "Setiap 4 jam", latency: "<6 jam dari penetapan pemenang", alert: "Intel Briefing: 'Konsultan A baru menang tender Rp 47M — kategori yang 3 klien MJP juga ikuti'", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { signal: "Kompetitor launch produk/fitur baru", method: "Website monitor (CSS diff) + Google Alerts + LinkedIn post scraper", frequency: "Daily check", latency: "<24 jam dari announcement", alert: "Slack alert internal tim MJP + update battlecard secara manual dalam 48 jam", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { signal: "Kompetitor pricing change", method: "Manual website check + klien report ('mereka turunkan harga')", frequency: "Weekly manual", latency: "3–7 hari", alert: "Notify Hendra langsung — pricing decision butuh founder involvement", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { signal: "Kompetitor hiring (proxy untuk expansion)", method: "LinkedIn job posting scraper: monitor keyword 'konsultan konstruksi', 'SKK', 'intel pasar'", frequency: "Weekly", latency: "<7 hari dari posting", alert: "Insight: 'Startup C posting 3 job di Sulawesi — kemungkinan akan expand ke sana Q1 2027'", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.signal} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.signal}</p>
                <span className={`text-[7px] font-mono ${r.tc}`}>{r.latency}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Method: {r.method}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Frekuensi: {r.frequency}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Alert: {r.alert}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Moat Defensibility */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-emerald-600" /> MOAT DEFENSIBILITY — Kenapa Kompetitor Akan Kesulitan Mereplikasi Platform MJP dalam 1–2 Tahun ke Depan?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { moat: "Data Network Effect (1.200+ data points/hari dari 487 klien)", strength: 9.2, explanation: "Setiap klien baru yang bergabung menghasilkan data win/loss dan pain point baru. Model AI kami semakin akurat seiring klien bertambah. Kompetitor yang start dari nol harus tunggu 2–3 tahun untuk punya data yang sebanding.", attackVector: "Kompetitor bermodal besar bisa buy data dari luar. Mitigasi: data relational kami (siapa yang head-to-head dengan siapa) tidak bisa dibeli.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { moat: "Regulatory Deep Expertise (Sari Wijaya + 3 tahun LPJK relationship)", strength: 8.4, explanation: "Interpretasi regulasi yang benar membutuhkan domain expertise + relationship. Sari adalah satu-satunya di industri yang punya keduanya dan dipercaya oleh LPJK regional.", attackVector: "Kompetitor bisa hire expert serupa. Mitigasi: relationship dan track record tidak transferable — waktu yang paling susah direplikasi.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { moat: "LPSE Crawler Infrastructure (7 platform, 247 kota, sub-6jam latency)", strength: 8.8, explanation: "Mengintegrasikan 7+ variant LPSE regional dengan reliability >99% butuh 18 bulan engineering. Kompetitor baru perlu waktu yang sama — dan masih akan encounter semua edge cases yang sudah kami solve.", attackVector: "LPSE bisa block crawler. Mitigasi: relationship dengan beberapa pemda untuk formal data partnership sedang diproses.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { moat: "Client Lock-in via Workflow Integration", strength: 7.1, explanation: "Klien yang sudah integrate MJP ke workflow harian mereka (briefing pagi, tender alert, Workroom) sangat jarang churn. Biaya switching bukan hanya uang — tapi waktu re-training tim dan hilangnya historical data mereka.", attackVector: "Kompetitor dengan UI lebih baik bisa attract new users. Mitigasi: agresifkan Workroom dan history features agar switching cost semakin tinggi.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.moat} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.moat}</p>
                <div className="text-right shrink-0">
                  <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.strength}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>/10 strength</p>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.explanation}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Attack vector: {r.attackVector}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Response Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> RESPONSE PLAYBOOK — Saat Kompetitor Melakukan Sesuatu, Apa Respons Taktis MJP dalam 24–72 Jam?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { trigger: "Kompetitor launch produk/fitur baru yang mirip dengan MJP", timeframe: "24 jam", response: ["1. Brief tim internal: 'Apa yang mereka lakukan berbeda dari kita?' — jujur dalam analisis", "2. Update battlecard dengan feature parity comparison", "3. Prepare AM talking point: cara merespons jika klien tanya 'Kompetitor X juga punya fitur ini'", "4. Jika fitur mereka lebih baik di satu area: acknowledge di internal dan roadmap fix"], attitude: "Jangan panik. Fitur bisa direplikasi — data moat tidak.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { trigger: "Kompetitor cut harga (>15% lebih murah dari MJP)", timeframe: "48 jam", response: ["1. Analisis: apakah mereka profitable di harga baru atau ini burning cash? Check funding news.", "2. DO NOT immediately price match — kita sedang jual value, bukan commodity", "3. AM siapkan 'Value Defense' script: '5 hal yang Anda dapat di MJP vs [Kompetitor]'", "4. Jika klien at-risk churn karena harga: berikan loyalty pricing secara case-by-case, bukan broad discount"], attitude: "Breadth war → we lose. Value war → we win.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { trigger: "Kompetitor approach klien MJP aktif untuk poach", timeframe: "72 jam", response: ["1. AM proactively reach out ke klien yang diketahui di-approach: 'Dengar ada tawaran di luar — ada yang bisa kami improve?'", "2. Berikan early access ke fitur baru sebagai token of appreciation", "3. Investigasi: apa yang membuat klien tersebut attractive ke kompetitor?", "4. Jika klien genuine unhappy dengan MJP: treat sebagai feedback, bukan enemy."], attitude: "Best defense = great product + personal relationship.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.trigger} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.trigger}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>Respons dalam {r.timeframe}</span>
              </div>
              {r.response.map((step, i) => <p key={i} className="text-[8px] text-muted-foreground">{step}</p>)}
              <p className={`text-[9px] font-mono font-bold ${r.tc} mt-0.5`}>💡 {r.attitude}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Scenario Planning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> SCENARIO PLANNING — 4 Skenario Kompetitif Terburuk yang Mungkin Terjadi dan Bagaimana MJP Bersiap?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { scenario: "Skenario 1: Google atau startup tech besar masuk ke market konstruksi Intel", probability: "12%", timeframe: "18–36 bulan", impact: "CATASTROPHIC", preparation: ["Percepat data moat: target 10.000+ historical records yang sangat domain-specific sebelum mereka bisa crawl", "Build community lock-in: GAPENSI partnership formal, tidak hanya informal", "Differentiate pada relationship + local knowledge yang tech besar tidak bisa replicate dengan cepat"], tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { scenario: "Skenario 2: Startup kompetitor dapat Series B besar (> Rp 50M) dan burn untuk growth", probability: "28%", timeframe: "6–18 bulan", impact: "HIGH", preparation: ["Tidak price match — kita tidak bisa out-burn mereka. Focus: defend existing clients dengan relationship", "Agresifkan champion program: klien yang paling happy menjadi vocal advocates", "Accelerate BIM + enterprise features yang kompetitor tidak bisa easily copy"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { scenario: "Skenario 3: Pemerintah (Kemenpu) launch platform intel konstruksi gratis berbasis LPSE", probability: "7%", timeframe: "24–48 bulan", impact: "MODERATE", preparation: ["Platform pemerintah biasanya bagus di data tapi lemah di UX, personalization, dan support", "MJP pivot: value ada di synthesis + action, bukan raw data. Embrace government data if available.", "Positioning: 'MJP adalah layer intelligence di atas data pemerintah, bukan kompetitor'"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { scenario: "Skenario 4: Key person departure — Sari dan/atau Hendra keluar", probability: "15%", timeframe: "Kapan saja", impact: "HIGH", preparation: ["Knowledge transfer: semua expertise Sari harus ter-dokumentasi di Knowledge Registry dan playbook", "Cross-train: Dewi dan Budi harus bisa cover 70% dari apa yang Sari bisa lakukan", "Succession plan: identifikasi kandidat replacement senior researcher sebelum dibutuhkan"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.scenario}</p>
                <div className="flex gap-2 shrink-0 text-[7px] font-mono">
                  <span className={r.tc}>P={r.probability}</span>
                  <span className={`font-bold ${r.tc}`}>{r.impact}</span>
                </div>
              </div>
              <p className="text-[8px] font-bold mb-0.5">Preparation:</p>
              {r.preparation.map((p, i) => <p key={i} className="text-[8px] text-muted-foreground">• {p}</p>)}
            </div>
          ))}
        </div>
      </div>

      {/* Market Share Trajectory */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> MARKET SHARE TRAJECTORY — Bagaimana Posisi MJP vs Kompetitor dalam 6 Kuartal Terakhir dan Proyeksi ke Depan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Player</th>
                  <th className="p-1 text-center text-muted-foreground">Q1'25</th>
                  <th className="p-1 text-center text-muted-foreground">Q2'25</th>
                  <th className="p-1 text-center text-muted-foreground">Q3'25</th>
                  <th className="p-1 text-center text-muted-foreground">Q4'25</th>
                  <th className="p-1 text-center text-muted-foreground">Q1'26</th>
                  <th className="p-1 text-center text-muted-foreground">Q2'26</th>
                  <th className="p-1 text-center text-muted-foreground">Q3'26E</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { player: "MJP (kita)", shares: ["0.18%","0.22%","0.28%","0.34%","0.41%","0.47%","0.55%E"], tc: "text-emerald-700" },
                  { player: "Konsultan Manual (terlambat)", shares: ["64%","62%","59%","56%","53%","51%","48%E"], tc: "text-slate-500" },
                  { player: "Startup A (lokal)", shares: ["0.08%","0.09%","0.11%","0.14%","0.16%","0.18%","0.21%E"], tc: "text-blue-600" },
                  { player: "Startup B (backed)", shares: ["0.04%","0.06%","0.08%","0.10%","0.13%","0.15%","0.19%E"], tc: "text-violet-600" },
                ].map((r) => (
                  <tr key={r.player} className="border-b hover:bg-muted/20">
                    <td className={`p-1 font-bold ${r.tc}`}>{r.player}</td>
                    {r.shares.map((s, i) => (
                      <td key={i} className={`p-1 text-center ${r.tc} ${i === r.shares.length - 1 ? 'italic' : ''}`}>{s}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">MJP tumbuh 2.6× lebih cepat dari nearest competitor. Tapi total addressable = 47.800 klien — kita semua masih {'<'}1%. Winner yang akan emerge dalam 3 tahun adalah yang bisa crack growth AND retention simultaneously.</p>
        </div>
      </div>

      {/* Competitive Intel Collection SOP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> INTEL COLLECTION SOP — Bagaimana Tim MJP Secara Sistematis Mengumpulkan Intel tentang Kompetitor Tanpa Melanggar Etika?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { method: "Tender Award Public Records (LPSE)", frequency: "Daily, automated", what: "Setiap tender yang dimenangkan kompetitor (BUJK yang juga posisikan diri sebagai consultant) tercatat otomatis. Pattern: berapa mereka bid, di wilayah mana, segmen apa.", ethical: "100% public data — legal dan ethical.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { method: "Klien yang Pernah Trial Kompetitor", frequency: "Ad-hoc, via AM", what: "AM tanyakan saat onboarding: 'Apakah pernah pakai layanan lain sebelum MJP? Apa yang kurang?' — ini goldmine intel tentang feature gaps kompetitor.", ethical: "Voluntary, tidak suruh client untuk spionase. Cukup tanya experience mereka.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { method: "Pricing Intelligence dari Lost Deals", frequency: "Monthly, dari Reza", what: "Setiap MJP kalah deal ('memilih kompetitor'), AM follow up 'boleh tahu kenapa? harganya?'. Compiled monthly menjadi pricing intel report.", ethical: "Prospect volunteered this info during normal sales conversation.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { method: "Social Media & Job Posting Monitoring", frequency: "Weekly, by Dewi", what: "Kompetitor yang posting job untuk 'Data Analyst Konstruksi' atau 'Sales Manager BUJK' = signal mereka akan expand. LinkedIn + Kalibrr monitored.", ethical: "All public. Standard competitive intelligence practice.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { method: "Asosiasi Conference Observation", frequency: "Per event, Sari atau Reza hadir", what: "Di GAPENSI atau LPJKN events, siapa yang pamerkan booth? Apa messaging mereka? Berapa orang yang antri?", ethical: "Public event, bukan infiltrasi. Asosiasi memang arena untuk semua player.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.method} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.method}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.frequency}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.what}</p>
              <p className={`text-[8px] font-mono italic ${r.tc}`}>Ethics: {r.ethical}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">All intel gathered via ethical, legal channels only. MJP reputasi sebagai trusted platform tidak boleh compromised oleh shady intel practices.</p>
      </div>

      {/* Competitive Differentiation Proof Points */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> DIFFERENTIATION PROOF POINTS — Klaim Kompetitif MJP yang Bisa Dibuktikan dengan Data, Bukan Sekadar Marketing
        </p>
        <div className="flex flex-col gap-2">
          {[
            { claim: "MJP klien menang tender 34% lebih sering vs non-MJP klien", proof: "A/B analysis: 487 klien MJP vs 1.200 BUJK non-MJP yang mengikuti tender yang sama. 34% vs 21% win rate. N signifikan, hasil konsisten 4 kuartal berturut.", howToUse: "Slide 1 di pitch deck dan AM opening statement.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { claim: "Intel Briefing dikirim dalam rata-rata 1.4 jam dari LPSE announcement", proof: "Timestamp data: LPSE publication time vs MJP alert delivery time. 38.400 data points. Avg: 1.4 jam. 99.3% dalam <2 jam SLA.", howToUse: "Counter to competitor klaim 'real-time'. Kita actual real-time, mereka daily digest.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { claim: "SKK Express 5 hari vs 14 hari self-serve rata-rata", proof: "Internal tracking: 247 SKK Express cases vs 89 self-serve cases yang dilaporkan klien. 5.1 hari avg vs 13.9 hari avg.", howToUse: "SKK Express pricing page dan kampanye deadline tender.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { claim: "HPS estimation error 3.8% vs industry standard 8.7%", proof: "Post-tender comparison: MJP estimate vs actual HPS published. 892 tenders, Q1 2025–Q2 2026. Internal accuracy: 3.8% avg error.", howToUse: "Dalam demo untuk klien yang skeptical tentang AI accuracy.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { claim: "NPS Score 47 (industri B2B software Indonesia avg: 31)", proof: "Monthly NPS survey. Jun 2026: 287 responses. Promoters 62%, Detractors 15%. NPS = 62-15 = 47.", howToUse: "Investor deck traction slide. Candidate hiring pitch ('our customers love us').", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.claim} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>"{r.claim}"</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Proof: {r.proof}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Use: {r.howToUse}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Win/Loss Analysis by Competitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> WIN/LOSS BREAKDOWN — Dari 487 Klien MJP yang Ikut Tender, Siapa yang Sering Mengalahkan Mereka dan Kenapa?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { competitor: "PT Karya Nusantara (J9, Semarang)", winsAgainstMJP: "247 kali", avgMargin: "−5.8% dari HPS (lebih rendah dari MJP klien avg)", pattern: "Agresif di tender gedung Jateng. Punya track record 15+ tahun di Kemenpu Jateng. Hampir impossible digeser di tender institutional.", mitigation: "Advise MJP klien untuk fokus di tender BUMN regional, bukan Kemenpu Jateng yang menjadi home turf mereka.", tc: "text-red-700" },
            { competitor: "CV Maju Sejahtera (J8, Surabaya)", winsAgainstMJP: "134 kali", avgMargin: "−7.1% dari HPS (sangat agresif)", pattern: "Price-warrior. Bid sangat rendah, kemudian sering subkontrak hampir semua pekerjaan. Risiko kualitas tinggi tapi panitia evaluasi tidak bisa screen ini.", mitigation: "Untuk klien yang sering kalah ke CV ini: fokus pada tender yang ada quality scoring (bukan hanya harga terendah menang).", tc: "text-orange-700" },
            { competitor: "Konsorsium BUJK Kaltim (ad-hoc)", winsAgainstMJP: "89 kali", avgMargin: "Kombinasi lokasi advantage + price", pattern: "Local companies forming consortium untuk tender IKN. Advantage: zero mobilization cost + local relationship. MJP klien dari Jawa tidak bisa easily compete.", mitigation: "Build Kaltim BUJK network untuk MJP klien yang ingin ekspansi KTI — connect dengan local partner untuk consortium.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.competitor} className="border rounded-sm p-3 bg-muted/10">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.competitor}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>Beat MJP klien: {r.winsAgainstMJP}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5" title={r.pattern}>Pattern: {r.pattern}</p>
              <p className={`text-[9px] font-mono ${r.tc}`} title={r.mitigation}>MJP strategy: {r.mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Win/loss data dicompile quarterly dari LPSE award announcements. Ini adalah intelligence product paling dicari J9 klien — siapa musuh mereka dan bagaimana menghadapinya.</p>
      </div>

      {/* Competitor Monitoring Cadence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CalendarCheck className="h-3.5 w-3.5 text-primary" /> MONITORING CADENCE — Seberapa Sering Tim MJP Melakukan Review Aktif terhadap Setiap Kompetitor dan Output Apa yang Dihasilkan?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { cadence: "Harian (otomatis)", activity: "Crawler scan LPSE untuk award baru yang melibatkan kompetitor yang ditrack", output: "Dashboard real-time update + alert ke AM jika kompetitor menang tender yang juga diikuti klien MJP", who: "Automated", tc: "text-emerald-700" },
            { cadence: "Mingguan (setiap Senin)", activity: "Sari review anomali: kompetitor tiba-tiba aktif di region baru, atau win rate spike/drop signifikan", output: "Weekly Competitor Brief — 1 halaman yang masuk Intel Briefing Senin pagi", who: "Sari", tc: "text-blue-700" },
            { cadence: "Bulanan (awal bulan)", activity: "Full profile update untuk top 15 kompetitor: win rate, kategori preference, price positioning, SKK status", output: "Monthly Competitor Profile refresh di Knowledge Registry — visible untuk Pro/Enterprise klien", who: "Sari + Dewi", tc: "text-blue-700" },
            { cadence: "Quarterly (akhir kuartal)", activity: "Deep competitive analysis: siapa yang naik/turun, siapa yang berpotensi menjadi MJP competitor (platform play), market share movement", output: "Quarterly Competitive Intelligence Report — presented ke Hendra, digunakan untuk product strategy", who: "Sari + Hendra", tc: "text-violet-700" },
            { cadence: "Event-triggered (ad hoc)", activity: "Kompetitor announce funding / partnership / new feature — immediate response brief dalam 48 jam", output: "Alert ke seluruh tim + assessment: 'threat, opportunity, atau noise?'", who: "Sari (24h turnaround)", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.cadence} className="flex gap-2 border-b pb-1.5 items-start">
              <div className="w-32 shrink-0">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.cadence}</p>
                <p className="text-[7px] text-muted-foreground">{r.who}</p>
              </div>
              <div className="flex-1">
                <p className="text-[8px]">{r.activity}</p>
                <p className={`text-[8px] font-mono ${r.tc}`}>→ {r.output}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total effort: ~8 jam/minggu (Sari 5h + Dewi 2h + automated 1h). ROI: klien yang pakai Radar Kompetitor win 31% lebih sering di head-to-head tenders vs kompetitor yang ditrack.</p>
      </div>

      {/* Competitor Counter-Strategy Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> MJP COMPETITOR DEFENSE — Jika Kompetitor SaaS Baru Masuk ke Pasar Intel Konstruksi, Apa 5 Hal yang Akan MJP Lakukan dalam 90 Hari Pertama?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { action: "Activate Champion Lock-In Program Immediately", timing: "Day 1–7", detail: "Hubungi 47 champion klien secara personal (Hendra atau Sari langsung). Tawarkan: lock-in 2 tahun dengan harga terjamin. Champions = most likely to be recruited by competitor. Secure mereka first.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { action: "Accelerate Data Moat — Publish 200 exclusive insights in 30 days", timing: "Day 1–30", detail: "Sprint produksi konten: 200 knowledge assets baru yang hyperlocal dan hyperspecific. Competitor bisa copy platform tapi tidak bisa copy 4 years of curated local knowledge overnight.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { action: "Price Anchor Move — Launch 'MJP Guaranteed ROI' pledge", timing: "Day 7–14", detail: "Announce: jika klien tidak win single additional tender dalam 90 hari dengan menggunakan MJP, satu bulan subscription refund. Forces competitor to match — they can't, they have no data yet.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { action: "Partnership Fortress — Formalize GAPENSI & LPJK relationships", timing: "Day 14–45", detail: "Accelerate informal partnerships ke formal co-branding. 'Recommended by GAPENSI' on every marketing touchpoint. Competitor needs to build these from scratch — takes 12+ months.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { action: "Intelligence Advantage Sprint — Launch features competitor can't copy in 6 months", timing: "Day 30–90", detail: "3 features in 90 days that require deep data: (1) Head-to-head win probability vs specific competitor, (2) Regional bid timing intelligence, (3) Post-award analysis. Requires 38K+ historical records.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.action} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.action}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.timing}</span>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Plan exists — tidak perlu panik jika competitor masuk. MJP defensive position: data moat + champion relationships + local expertise = 18–24 month lead time advantage that no funded startup can buy.</p>
      </div>

      {/* Competitive Pricing Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> COMPETITOR PRICING INTELLIGENCE — Berapa Biaya yang Dikeluarkan Klien jika Memilih Solusi Alternatif vs MJP?
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left p-1 text-muted-foreground">Alternatif</th>
                <th className="p-1 text-center text-muted-foreground">Biaya langsung</th>
                <th className="p-1 text-center text-muted-foreground">Hidden cost</th>
                <th className="p-1 text-center text-muted-foreground">Total real cost/bln</th>
                <th className="p-1 text-center text-emerald-700">vs MJP Growth</th>
              </tr>
            </thead>
            <tbody>
              {[
                { alt: "Do it yourself (manual LPSE monitoring)", direct: "Rp 0", hidden: "40 jam/bln × Rp 150rb/jam = Rp 6jt", total: "Rp 6jt/bln (opportunity cost)", vs: "4× lebih mahal", tc: "text-orange-700" },
                { alt: "Junior in-house analyst (part-time)", direct: "Rp 4–5jt/bln (gaji)", hidden: "Training Rp 1jt + management 5 jam/bln + errors/gaps", total: "Rp 5.5–7jt/bln", vs: "3.7–4.7× lebih mahal", tc: "text-orange-700" },
                { alt: "Konsultan ad-hoc (per project)", direct: "Rp 4.8jt per project", hidden: "Tidak ada ongoing monitoring. Gaps between projects.", total: "Rp 9.6jt/bln jika 2 projects/bln", vs: "6.4× lebih mahal", tc: "text-red-700" },
                { alt: "Asosiasi konstruksi (GAPENSI member)", direct: "Rp 500rb/thn membership", hidden: "Akses terbatas, tidak real-time, tidak personalized. 32 jam/bln still manual.", total: "Rp 4.8jt/bln (opportunity cost + membership)", vs: "3.2× lebih mahal", tc: "text-orange-700" },
                { alt: "MJP Growth Tier", direct: "Rp 1.5jt/bln", hidden: "Setup time: 2 jam one-time. No ongoing effort needed.", total: "Rp 1.5jt/bln all-in", vs: "Baseline", tc: "text-emerald-700" },
              ].map((r) => (
                <tr key={r.alt} className="border-b hover:bg-muted/20">
                  <td className="p-1 font-bold">{r.alt}</td>
                  <td className="p-1 text-center text-muted-foreground">{r.direct}</td>
                  <td className="p-1 text-center text-muted-foreground">{r.hidden}</td>
                  <td className="p-1 text-center font-bold">{r.total}</td>
                  <td className={`p-1 text-center font-bold ${r.tc}`}>{r.vs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tabel ini digunakan saat prospect bilang 'terlalu mahal'. Frame ulang: bukan Rp 1.5jt per bulan — tapi Rp 4.5jt yang Anda hemat dibanding alternatif terbaik (in-house analyst).</p>
      </div>

      {/* Competitive Intelligence Collection Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-primary" /> INTEL COLLECTION PROTOCOL — Bagaimana Tim MJP Mengumpulkan Informasi tentang Kompetitor secara Etis dan Sistematik?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { method: "Win/Loss Interview Analysis (Post-Decision)", when: "Setelah setiap klien memutuskan — join, stay, atau churn", how: "AM Reza tanya 3 pertanyaan standar: 'Apa yang membuatmu memilih kami?' / 'Apa yang hampir membuatmu tidak pilih kami?' / 'Tool lain apa yang kamu pakai atau pertimbangkan?'", insight: "Terbukti: 89% klien yang churned menyebut nama spesifik alternatif. Data ini tidak bisa didapat dari market research.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { method: "LinkedIn Job Posting Intelligence", when: "Monthly scan", how: "Cek LinkedIn job postings dari perusahaan yang potensial compete. 'We're hiring a Construction Data Analyst' = someone building a competitive product.", insight: "Ini early warning system terbaik untuk melihat siapa yang serius. Hiring = real product intent, not just talk.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { method: "Industry Event Intelligence", when: "Setiap event konstruksi besar: KONSTRUKSI INDONESIA, GAPENSI congress", how: "Hendra hadir dan map siapa yang exhibit di sektor 'data', 'digitalisasi konstruksi', 'platform BUJK'. Collect semua brochure, note pitch angle, talk to their sales reps.", insight: "Face-to-face intelligence yang tidak tersedia online. Dua kali lebih efisien dari online research.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { method: "Customer Reference Check (GAPENSI Network)", when: "Quarterly", how: "Tanya klien GAPENSI: 'Teman-teman di chapter lain pakai tool apa?' Informal referral network juga serves as competitive intelligence.", insight: "Community yang trusted = unfiltered intel. Members say what sales reps won't.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.method} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.method}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.when}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.how}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">All intel collected ethically — public info, direct interviews, community conversations. No scraping competitor platforms or deceptive tactics. Competitive advantage from better listening, not espionage.</p>
      </div>

      {/* Competitor Landscape 2027 Projection */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> LANDSCAPE 2027 — Proyeksi Lanskap Kompetitif: Siapa yang Mungkin Masuk, Bagaimana Pasar Akan Berubah, dan Posisi MJP?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              scenario: "Scenario A: Generic PropTech SaaS enters construction vertical",
              probability: "HIGH (70%)", timeline: "Q3–Q4 2027",
              who: "Startup B2B SaaS dengan funding Rp 10–50M. Team dari properti/fintech, not construction.",
              mjpResponse: "Advantage: They'll build generic, MJP has 6+ years of domain depth. Response: accelerate AI features, deepen hyperlocal intel that requires physical presence.",
              impact: "Low direct threat. Will expand market awareness — some of their lost clients will come to MJP.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              scenario: "Scenario B: Existing LPJK/LKPP digitalizes and offers free intel",
              probability: "MEDIUM (35%)", timeline: "2027–2028",
              who: "Government initiative to provide free BUJK intelligence via LPJK portal.",
              mjpResponse: "Government free tool = baseline. MJP adds value layer: interpretation, AI, local context, action recommendations. Similar to how Bloomberg exists alongside free government economic data.",
              impact: "Medium threat to Starter tier. No threat to Growth/Enterprise (analysis, not just data).",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              scenario: "Scenario C: Large consulting firm (big4/McKinsey equivalent) launches construction intel product",
              probability: "LOW (12%)", timeline: "2028+",
              who: "KPMG Indonesia, Deloitte, or local consulting arm builds infrastructure intelligence product.",
              mjpResponse: "High risk if they target J9 Enterprise with bundled consulting. MJP must own J8 completely and differentiate J9 value via AI + speed that consultants can never match.",
              impact: "High threat only to MJP Enterprise segment. J8 majority = protected.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.scenario}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={r.tc}>{r.probability}</span>
                  <span className="text-muted-foreground">{r.timeline}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Who: {r.who}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>MJP Response: {r.mjpResponse}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Scenario planning bukan tentang prediksi sempurna — tapi tentang tidak di-surprised. Setiap scenario sudah punya response plan yang bisa diaktifkan. MJP's job: build moat sebelum scenario terjadi.</p>
      </div>

      {/* Head-to-Head Win Rate by BUJK Segment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WIN RATE ANALYTICS — Data Win Rate Klien MJP Dibandingkan Non-Klien Berdasarkan BUJK Class dan Kategori Tender
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Segment</th>
                  <th className="p-1 text-center text-emerald-700">MJP Klien</th>
                  <th className="p-1 text-center text-muted-foreground">Non-MJP</th>
                  <th className="p-1 text-center text-primary">Lift</th>
                  <th className="p-1 text-center text-muted-foreground">n (bids observed)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["J8 Gedung Pemerintah", "31.2%", "19.4%", "+60%", "1.247"],
                  ["J8 Infrastruktur", "27.8%", "17.1%", "+63%", "892"],
                  ["J9 Multi-kategori", "38.4%", "26.7%", "+44%", "543"],
                  ["J7 Kecil (<Rp 1M)", "24.1%", "18.3%", "+32%", "2.108"],
                  ["Rehabilitasi (semua class)", "34.7%", "22.9%", "+52%", "1.431"],
                  ["BUMN-funded tender", "22.3%", "15.8%", "+41%", "674"],
                ].map(([seg, mjp, non, lift, n], i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{seg}</td>
                    <td className="p-1 text-center text-emerald-700 font-bold">{mjp}</td>
                    <td className="p-1 text-center text-muted-foreground">{non}</td>
                    <td className="p-1 text-center font-bold text-primary">{lift}</td>
                    <td className="p-1 text-center text-muted-foreground">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Overall MJP Klien Win Rate: 27.4% vs 18.0% non-MJP baseline = +52% lift</p>
            <p className="text-[8px] text-muted-foreground">Methodology: Historical tender outcomes matched against LPJK registry. MJP klien identified by company registration match. Sample: 6.895 bid observations. Statistical significance: p {'<'} 0.001.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Win rate data adalah MJP's single most powerful sales asset. When a prospect asks 'does it work?' — the answer is 27.4% vs 18% with 6.895 observations at p{'<'}0.001. This data is updated quarterly.</p>
      </div>

      {/* Competitor Response Monitoring Cadence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> MONITORING CADENCE — Jadwal dan Metode Pemantauan Kompetitor: Apa yang Diperiksa Kapan dan Oleh Siapa di Tim MJP?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            {
              cadence: "HARIAN (Dewi, 20 menit)",
              tasks: [
                "LPSE price alert: apakah ada kompetitor yang memenangkan tender di category yang MJP klien track?",
                "Social monitoring: apakah ada BUJK kompetitor besar yang posting news, awards, atau partnership announcements?",
                "AppStore / web monitoring: apakah ada startup yang launch new product di konstruksi intelligence space?",
              ],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              cadence: "MINGGUAN (Sari, 45 menit, Senin)",
              tasks: [
                "Aggregate tender wins oleh 20 tracked competitors — update Competitor Radar database",
                "Price movements: apakah kompetitor mengubah pricing atau launching promo di minggu ini?",
                "Community intelligence: apa yang dibicarakan BUJK di WhatsApp group, forum, komunitas?",
              ],
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              cadence: "BULANAN (Sari + Reza, 2 jam, minggu pertama)",
              tasks: [
                "Competitor win/loss analysis: dari klien yang report, kapan mereka kalah head-to-head dari kompetitor mana?",
                "Product update scan: apakah ada kompetitor yang launch feature baru? Implikasinya ke MJP roadmap?",
                "Market share estimate update: berapa % tender dalam tracked categories dimenangkan klien MJP vs baseline?",
              ],
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.cadence} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.cadence}</p>
              {r.tasks.map((t, i) => <p key={i} className="text-[8px] text-muted-foreground">• {t}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Monitoring cadence = competitive intelligence as a process, not an event. Total team time: 5.5 jam/minggu. Output: Competitor Radar updates + monthly report to Hendra. Early detection time goal: {'<'} 48 jam dari perubahan kompetitor ke MJP awareness.</p>
      </div>

      {/* Competitive Moat Score */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> COMPETITIVE MOAT SCORE — Seberapa Kuat Pertahanan Kompetitif MJP pada Q3 2026 dan Apa yang Harus Diperkuat Sebelum Kompetitor Serius Masuk?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { moat: "Data Network Effect", score: 8.2, max: 10, description: "12.400 BUJK × 487 clients × community intel = compounding. Each new user improves data for all. Takes years to replicate.", how_to_strengthen: "Formalize community data programs. Incentivize klien to submit field observations.", tc: "text-emerald-700" },
            { moat: "Domain Expert Relationships", score: 7.8, max: 10, description: "Sari's LSP relationships, Dewi's LPJK contacts, Budi's field network. 4+ years of trust. Cannot be bought.", how_to_strengthen: "Document all relationships. Knowledge transfer to backup contacts for each key relationship.", tc: "text-emerald-700" },
            { moat: "Brand Trust in Niche", score: 7.4, max: 10, description: "In the J8 construction intelligence niche, 'MJP' = intelligence platform. Aided brand awareness: est. 31% of J8 BUJK Jawa.", how_to_strengthen: "GAPENSI co-branding. Event presence. Published research reports as thought leadership.", tc: "text-blue-700" },
            { moat: "Historical Data Depth", score: 7.1, max: 10, description: "5 years of tender outcome + BUJK behavior data. Competitor starting today = 5-year data gap. Gap widens daily.", how_to_strengthen: "Archive all historical data explicitly. Backfill missing years from archival sources.", tc: "text-blue-700" },
            { moat: "Workflow Integration Lock-in", score: 4.8, max: 10, description: "Klien can switch platforms relatively easily — data still lives outside MJP. Lock-in is behavioral, not technical.", how_to_strengthen: "API access for Enterprise klien. Deeper integrations with klien internal workflows. SKK Express creates operational lock-in.", tc: "text-orange-700" },
            { moat: "Regulatory Moat", score: 3.2, max: 10, description: "No regulatory advantage. Easy for competitor to enter market legally.", how_to_strengthen: "Not achievable in this sector. Focus on other moat types.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.moat} className="flex gap-2 items-start border-b py-1.5">
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.moat}</p>
                <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>Strengthen: {r.how_to_strengthen}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className={`text-base font-black font-mono ${r.tc}`}>{r.score}</span>
                <span className="text-[7px] text-muted-foreground">/10</span>
              </div>
            </div>
          ))}
          <div className="border rounded-sm p-2 bg-muted/10">
            <p className="text-[9px] font-bold">Composite Moat Score: 6.4/10</p>
            <p className="text-[8px] text-muted-foreground">Target: 7.5/10 by Q4 2027. Biggest lever: Workflow integration lock-in (from 4.8 → 7.0).</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Moat score reviewed annually with Hendra + external advisor. Every product decision should ask: 'does this deepen any moat?' If not — it's feature parity with future competitors, not differentiation.</p>
      </div>

      {/* Competitive Sales Battle Card */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> SALES BATTLE CARD — Panduan Reza untuk Melawan Setiap Jenis Keberatan Calon Klien: Apa yang Mereka Katakan dan Apa Jawaban Terbaik MJP?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { objection: "\"Harga MJP terlalu mahal — Rp 1.5jt/bln itu besar untuk kontraktor kecil.\"", reframe: "Show compliance cost calculator: tanpa MJP, klien rata-rata kehilangan Rp 3.8jt/bln dalam compliance failures + missed opportunities. MJP net cost = Rp -2.3jt/bln (saves more than it costs). ROI positive from day 30 avg.", tc: "text-emerald-700" },
            { objection: "\"Kami sudah punya tim sendiri untuk monitor LPSE.\"", reframe: "Team monitor itu hanya 1 sumber. MJP agregasi 6+ sumber (LPJK, 32 LPSE provinsi, competitor data, regulatory, community). 'Tim Anda vs 487 klien kami yang crowdsource intel secara kolektif.' Coverage yang tidak mungkin direplikasi 1-2 orang.", tc: "text-emerald-700" },
            { objection: "\"Kami tidak perlu — bisnis kami sudah jalan baik tanpa ini.\"", reframe: "Ask: 'Kalau Bapak/Ibu tidak ikut 3 tender terakhir yang kami kirim alert-nya, berapa yang mungkin sudah Bapak/Ibu menangkan?' Convert to concrete missed revenue. Not selling problem they know — revealing problem they don't.", tc: "text-blue-700" },
            { objection: "\"Saya perlu pikir-pikir dulu.\"", reframe: "Ask what specifically they need to think about. If price: offer 30-day trial. If trust: offer to connect with 1 existing klien (Reza has 8 reference klien who agreed to take calls). If timing: show what tender opportunity they'll miss this month without it.", tc: "text-blue-700" },
            { objection: "\"Apakah ini bisa saya coba gratis dulu?\"", reframe: "Yes — 30 day trial available. But Reza frames it: 'Saya minta 1 komitmen: dalam 30 hari, coba ikut 1 tender pakai intel MJP. Kalau tidak dapat value, saya sendiri yang akan refund.' Sets expectation of active use, not passive browsing.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.objection} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.objection}</p>
              <p className="text-[8px] text-muted-foreground">{r.reframe}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Battle card diupdate quarterly berdasarkan actual Reza call logs. Each objection answer is tested: if Reza closes after using reframe {'>'} 60% of the time, it's validated. If {'<'}40%: reframe needs revision. Current validated: all 5 above at 61–78% close rate when objection + reframe matches.</p>
      </div>

      {/* Competitive Intelligence Collection SOP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5 text-primary" /> COLLECTION SOP — Bagaimana MJP Mengumpulkan Intel Kompetitor Setiap Minggu: Sumber Mana, Siapa yang Bertanggung Jawab, dan Apa yang Didokumentasikan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { source: "LPSE Award Crawl (automated, 3× weekly)", owner: "Hendra Jr. (crawler)", what: "Tender awards where competitor BUJK listed as winner. Scraped: winner name, contract value, buyer, date. Auto-fed to Competitor Radar database.", frequency: "Mon/Wed/Fri 11 PM batch", tc: "text-blue-700" },
            { source: "Google Alerts for competitor names (daily)", owner: "Dewi (10 min/hari monitoring)", what: "New coverage: expansions, partnerships, awards, issues. Dewi tags: GOOD (positive for competitor), WATCH (neutral), RISK (negative). Risk items = Sari reviews.", frequency: "Daily 8 AM digest", tc: "text-blue-700" },
            { source: "Budi field intel — BUJK site visits + industry events", owner: "Budi (continuous)", what: "What BUJK on site are saying about other BUJKs: quality complaints, sub-tender experiences, partnership reputation. High-signal, low-verifiability. Labeled COMMUNITY.", frequency: "On encounter — logged same day", tc: "text-orange-700" },
            { source: "LPJK Registration Monitor (monthly)", owner: "Dewi (2 hrs/bln)", what: "Competitor new classifications, SKK registrations, blacklist status changes. Tracks who upgraded class (new competitive threat).", frequency: "1st week of each month", tc: "text-orange-700" },
            { source: "LinkedIn + Media Konstruksi (weekly scan)", owner: "Sari (30 min/minggu)", what: "Competitor thought leadership: what are they publishing? What topics are they covering? Signals product/service direction before launch.", frequency: "Senin pagi (Research Sync prep)", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.source} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.source}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.frequency}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Owner: {r.owner}</p>
              <p className="text-[7px]">{r.what}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total team time: 5.5 jam/minggu competitor intelligence. Output: Competitor database updated, monthly report to Hendra. Rule: competitor intel dibagikan ke seluruh tim dalam Weekly Close, bukan disimpan sendiri oleh Sari atau Dewi. Shared intel = better collective response.</p>
      </div>

      {/* Competitor Feature Gap Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> FEATURE GAP ANALYSIS — Perbandingan Fitur Konkret MJP vs 3 Kompetitor Utama: Di Mana MJP Unggul dan Di Mana Masih Tertinggal?
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[7px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left p-1 text-muted-foreground">Feature</th>
                <th className="p-1 text-center">MJP</th>
                <th className="p-1 text-center">Kompetitor A<br/>(LPSE aggregator)</th>
                <th className="p-1 text-center">Kompetitor B<br/>(General B2B)</th>
                <th className="p-1 text-center">Kompetitor C<br/>(Consulting)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Competitor historical bid prices", "✅ Full (5yr)", "❌", "❌", "🔶 Manual report only"],
                ["SKK management + renewal service", "✅ Express 5 days", "❌", "❌", "❌"],
                ["Real-time LPSE multi-source", "✅ 2-hr refresh", "✅ Daily only", "❌", "❌"],
                ["Regulatory L1 alert system", "✅ WA within 30 min", "❌", "🔶 Email only (slow)", "❌"],
                ["BUJK Trust Score (community)", "✅ 12,400 BUJKs", "❌", "❌", "❌"],
                ["AI HPS estimation model", "✅ 7.8% MAE", "❌", "❌", "❌"],
                ["Daily intelligence briefing", "✅ AI-assisted Sari", "❌", "❌", "🔶 Monthly only"],
                ["WhatsApp native delivery", "✅ Primary channel", "❌", "❌", "❌"],
                ["Bahasa Indonesia native content", "✅ All content", "✅", "🔶 Partial", "✅"],
                ["Mobile app for field teams", "🔶 In progress", "❌", "❌", "❌"],
                ["BIM compliance guide", "🔶 In progress", "❌", "❌", "🔶 Generic"],
                ["ESG / Green certification guide", "🔶 2027 roadmap", "❌", "❌", "🔶 Generic"],
              ].map((row, i) => (
                <tr key={i} className="border-b hover:bg-muted/20">
                  <td className="p-1 font-bold">{row[0]}</td>
                  <td className="p-1 text-center font-bold text-emerald-700">{row[1]}</td>
                  <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                  <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                  <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP leads on 8 of 12 features tracked. Gaps: mobile app (in progress), BIM (in progress). No competitor offers SKK Express — unique to MJP. Competitor A is strongest in raw LPSE aggregation but zero intel layer. Feature gap updated quarterly by Dewi. Reza uses as slide 4 in Enterprise presentations.</p>
      </div>

      {/* Competitor Response Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> RESPONSE PLAYBOOK — Jika Kompetitor Melakukan X, MJP Merespons Y: Playbook Kompetitif untuk 5 Skenario Ancaman Terburuk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              scenario: "Skenario 1: Kompetitor A memangkas harga ke Rp 299K/bln (bawah MJP Basic)",
              response: "Tidak menurunkan harga. Justru komunikasi value lebih keras: 'MJP bukan LPSE aggregator — kami intelligence platform.' Reza diberikan counter-script: 'Coba bandingkan: mereka kirim data, kami kirim keputusan.' Target segment yang paling loyal (Enterprise + Pro) di-lock dengan annual contract discount.",
              why: "Price war = race to zero. MJP menang di value, bukan harga. If a Basic klien churns for cheaper competitor, they were never a high-value klien.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              scenario: "Skenario 2: Tokopedia / Gojek / telco launches construction intelligence product",
              response: "MJP accelerates differentiation: publish 3 deep research reports on construction-specific topics that large platform cannot match. Offer exclusive 'Indonesian Construction Intelligence Certification' bundled with MJP annual plan. Reza calls every Enterprise klien personally — 'Even if Tokopedia offers this, they'll never have Sari.'",
              why: "Large platforms win on distribution, lose on depth. MJP's moat is depth. Play to strength.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              scenario: "Skenario 3: Kompetitor berhasil hire Sari-equivalent (rare but possible)",
              response: "Accelerate Sari succession plan: document all her tacit knowledge in structured assets NOW. Invest in systematic data advantage so platform is less dependent on any single person. Review Sari's compensation + equity discussion.",
              why: "Key person risk is real. The answer is not to prevent her departure — it's to make knowledge less person-dependent while also making staying highly attractive.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              scenario: "Skenario 4: LKPP membuka API resmi untuk semua data LPSE secara gratis",
              response: "Expand value from 'data access' to 'analysis + interpretation'. If LPSE data becomes a commodity (free public API), MJP shifts to premium analysis layer: HPS model, Win probability, Competitor analysis, Regulatory interpretation. Raw data access was never MJP's core value.",
              why: "MJP's value is always the intelligence layer, not the data itself. A commoditized data layer forces MJP to compete on analysis — which is actually harder to copy.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.scenario}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Response: {r.response}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why: {r.why}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Playbook reviewed by Hendra annually. Hendra's rule: competitor threats are inputs for strengthening MJP, not reasons for panic. Every scenario ends with 'MJP doubles down on what makes it unique.' The companies that react to competitor moves by copying them end up as worse versions of their competitors.</p>
      </div>

      {/* Competitive Win/Loss Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WIN/LOSS — Analisis Win/Loss Kompetitif MJP: Kapan MJP Menang vs Kalah dalam Sales, dan Apa Faktor Pembeda Utamanya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
            {[
              { stat: "74%", label: "Deal close rate when demo is done", tc: "text-emerald-700" },
              { stat: "23%", label: "Close rate — no demo, email only", tc: "text-orange-700" },
              { stat: "91%", label: "Close rate — referral from existing klien", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-bold mb-1">Why MJP wins (from win analysis, n=147):</p>
          {[
            ["SKK Express uniqueness", "62% of deals", "No competitor offers this. When Dewi demos Express: 5-day SKK from scratch, eyes go wide. Closes the deal."],
            ["WhatsApp-first delivery", "54%", "Every competitor is web-only. MJP reaches them where they already are."],
            ["Construction domain depth", "48%", "Reza can explain KBLI, SBU, Perpres PBJ fluently. Generic platforms have zero domain language."],
            ["Case study social proof", "41%", "'I know someone who won using MJP.' Referral pipeline is MJP's strongest signal."],
          ].map(([factor, pct, detail]) => (
            <div key={factor} className="flex gap-2 items-start border-b py-1">
              <div className="flex-1">
                <p className="text-[8px] font-bold">{factor} <span className="font-normal text-emerald-700">({pct} of wins)</span></p>
                <p className="text-[7px] text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
          <p className="text-[9px] font-bold mt-1 mb-1">Why MJP loses (from loss analysis, n=61):</p>
          {[
            ["Price (perceived too expensive)", "34% of losses", "Usually Basic tier. Objection: 'Kenapa bayar kalau LPSE gratis?' Reza counter: '1 tender won = 10 years of subscription ROI.' 22% converted after reframe."],
            ["'Kami tidak aktif tender saat ini'", "28%", "Timing: they are between projects. Follow-up in 3 months. 18% re-engage when active again."],
            ["IT dept blocks new platform", "18%", "Enterprise: procurement/IT blocking. Solution: API + data export. Not always solvable."],
          ].map(([factor, pct, detail]) => (
            <div key={factor} className="flex gap-2 items-start border-b py-1">
              <div className="flex-1">
                <p className="text-[8px] font-bold">{factor} <span className="font-normal text-red-700">({pct} of losses)</span></p>
                <p className="text-[7px] text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Win/loss tracked by Reza in CRM notes. Analysis done by Sari quarterly. Key insight: MJP's sales motion is relationship-first — Reza's 23% cold close rate is actually very high for B2B SaaS. Industry avg is 8–12%. This reflects Reza's domain credibility. Reza is not selling software — he's selling intelligence from a construction insider.</p>
      </div>

      {/* Competitive Intelligence SLA */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> CI SLA — Service Level Agreement MJP untuk Competitor Intelligence: Komitmen Ke Klien tentang Freshness, Accuracy, dan Coverage Data Kompetitor
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">CI Data Type</th>
                  <th className="p-1 text-center">Refresh SLA</th>
                  <th className="p-1 text-center">Accuracy Target</th>
                  <th className="p-1 text-center">Coverage</th>
                  <th className="p-1 text-center">Current Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPSE tender awards", "< 48 jam post-announcement", "97%+", "312 LPSE instances", "✅ SLA met"],
                  ["Competitor bid prices (historical)", "Monthly update", "Sourced from LPSE official", "J7–J9 Jawa + Sumatra", "✅ SLA met"],
                  ["Competitor SBU changes", "Within 30 days of LPJK update", "92%", "Active BUJK tracked: 12.400", "🟡 28 days avg"],
                  ["Competitor blacklist status", "Real-time (< 1 jam after LPJK update)", "99%", "All registered BUJK", "✅ SLA met"],
                  ["Competitor project pipeline", "Quarterly (from field + LPSE)", "70% (inferred)", "Jawa focus, top 200 BUJK", "🟡 Manual process"],
                  ["BUJK Trust Score", "Monthly recalculation", "Model-based", "12.400 BUJKs", "✅ SLA met"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
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
            <p className="text-[9px] font-bold text-orange-700">Known limitations (disclosed to Enterprise klien):</p>
            <p className="text-[8px]">Competitor project pipeline (quarterly, inferred) is our weakest CI product. 70% accuracy means 30% of pipeline data may be stale or wrong. Transparent disclosure prevents trust damage when klien discovers a discrepancy. MJP label on pipeline data: 'INFERRED — quarterly, {'<'}75% confidence. Do not use as sole basis for consortium decisions.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">CI SLA document given to all Enterprise klien during onboarding. Written by Sari. Reviewed annually. Not a legal contract — it's a commitment statement. Enterprise klien who know the SLA proactively reach out when they see a potential breach, helping MJP catch issues faster. Transparency about SLA = partner relationship, not vendor relationship.</p>
      </div>

      {/* Reza's Competitive Battle Cards */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Swords className="h-3.5 w-3.5 text-primary" /> BATTLE CARDS — Reza's Competitive Battle Cards untuk 4 Skenario Persaingan Paling Umum: Script Tepat yang Digunakan Saat Calon Klien Menyebut Kompetitor
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              scenario: "Klien sebut: 'Kami sudah punya data LPSE dari staff internal'",
              rezaResponse: "'Betul, data LPSE bisa diakses semua orang. Bedanya: MJP memproses 312 LPSE sekaligus, tambahkan HPS estimate, koneksi ke status blacklist dan SBU real-time, dan semua sudah difilter sesuai profil BUJK Anda — datang ke WA sebelum jam kerja. Staff internal Anda butuh berapa jam untuk ini setiap hari?'",
              outcome: "Reframe from 'data access' to 'intelligence processing'. Client usually hadn't thought about processing burden.",
              winRate: "71% close after this reframe"
            },
            {
              scenario: "Klien sebut: 'Ada software tender gratis online'",
              rezaResponse: "'Software gratis biasanya agregasi saja tanpa analisis. Coba tanya: apakah mereka punya estimasi HPS? Apakah ada filter BUJK class otomatis? Apakah ada alert regulasi? Kalau tidak, itu direktori, bukan platform intelijen. Harga MJP = harga satu kesalahan estimasi tender yang bisa dihindari.'",
              outcome: "Anchor to cost of one avoided mistake vs. subscription cost.",
              winRate: "58% close rate on price-sensitive prospects"
            },
            {
              scenario: "Klien sebut: 'Kompetitor lain tawarkan harga lebih murah'",
              rezaResponse: "'Boleh saya tanya: kompetitor mana? Dan apakah mereka punya jaringan SKK Express, BUJK Trust Score, dan pre-bid brief? Kalau iya — bagus, pasar memvalidasi nilainya. Kalau tidak — bandingkan fitur dulu, baru bandingkan harga. MJP biasanya menang di value-per-rupiah setelah perbandingan apples-to-apples.'",
              outcome: "Reza never bad-mouths competitors. He asks questions. Competitor name reveals intelligence.",
              winRate: "Named competitors: 64% close. Generic 'cheaper option': 41% close."
            },
            {
              scenario: "Klien sebut: 'Kami sedang evaluasi beberapa vendor'",
              rezaResponse: "'Bagus — evaluasi yang benar sangat penting. Saya bisa bantu buat checklist kriteria apa yang perlu dievaluasi untuk platform intelligence konstruksi. Banyak klien pakai checklist kami justru karena ini membantu mereka membandingkan vendor lain secara apples-to-apples.' [Sends Sari's evaluation checklist — designed to highlight MJP's strengths]",
              outcome: "MJP-designed evaluation framework = MJP evaluates best on MJP's terms.",
              winRate: "When evaluation uses MJP checklist: 73% close"
            },
          ].map((r) => (
            <div key={r.scenario} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className="text-[8px] font-bold text-primary mb-0.5">{r.scenario}</p>
              <p className="text-[7px] italic text-muted-foreground mb-0.5">Reza: "{r.rezaResponse}"</p>
              <p className="text-[7px] mb-0.5">{r.outcome}</p>
              <p className="text-[7px] font-mono text-emerald-700 font-bold">{r.winRate}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Battle cards written by Reza + Hendra after 40 sales calls. Each card updated quarterly based on new competitive intelligence. The evaluation checklist (Card 4) is Hendra's most controversial tactic — 'isn't this manipulative?' — Hendra's answer: 'We design it to highlight real value, not fake it. If competitor genuinely exceeds us on something, the checklist reveals that too. We've lost deals where competitor was actually better — the checklist built trust even in loss.'</p>
      </div>

      {/* Competitor Monitoring Routine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> CI ROUTINE — Rutinitas Monitoring Kompetitor MJP yang Berjalan Tiap Minggu: Siapa Melakukan Apa, Kapan, dan Bagaimana Output-nya Masuk ke Produk dan Sales
        </p>
        <div className="flex flex-col gap-1 mb-3">
          {[
            { cadence: "Harian (Sari)", task: "LPSE scan: any competitor win in klien's watched sectors? Any blacklist update for tracked BUJKs? Flagged in daily briefing if material.", output: "Daily Briefing CI section (L2/L3 signals)", time: "~15 menit" },
            { cadence: "Mingguan (Sari)", task: "Competitor SBU/SKK database check: any significant upgrade/downgrade/expiry? Cross-reference against active MJP klien's competitive landscape.", output: "Weekly digest update + Sari's CI notes in Notion", time: "~30 menit" },
            { cadence: "Mingguan (Reza)", task: "Post-demo debrief: did any prospect mention competitor by name? Document in CRM competitor-mention field. Aggregate for Sari's monthly analysis.", output: "CRM competitor mention log", time: "~10 menit" },
            { cadence: "Bulanan (Sari + Hendra)", task: "Full competitor posture review: check each tracked competitor's LPSE activity, SBU changes, any public news (LinkedIn, media). Update competitor profiles in MJP's internal registry.", output: "Competitor profile refresh in Knowledge Registry (internal-only section)", time: "~2 jam" },
            { cadence: "Bulanan (Budi)", task: "Field CI: any BUJK mentioned a competitor name in conversation? Any construction community talk about alternative platforms? Budi documents verbatim (anonymized).", output: "Field CI report to Sari (WhatsApp voice note → transcribed)", time: "~varies" },
            { cadence: "Kuartalan (Sari)", task: "Win/loss analysis: from Reza's CRM data. Update battle cards. Update competitive positioning document. Share with Hendra for product roadmap implications.", output: "Quarterly Competitive Intelligence Report (internal)", time: "~4 jam" },
            { cadence: "Kuartalan (Hendra Jr.)", task: "Technical competitor analysis: check if any competitor launched new features, API, mobile app. Screenshot and document. Assess technical gap/parity.", output: "Feature parity table update", time: "~2 jam" },
          ].map((r) => (
            <div key={r.cadence + r.task} className="flex gap-2 border-b py-1">
              <p className="text-[7px] font-bold w-28 shrink-0 text-primary">{r.cadence}</p>
              <p className="text-[7px] flex-1">{r.task}</p>
              <div className="shrink-0 text-right">
                <p className="text-[7px] font-mono text-muted-foreground">{r.time}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total CI time investment per month: Sari ~5 jam, Reza ~45 menit, Budi ~varies, Hendra Jr. ~2 jam/quarter. This is MJP's competitive intelligence budget: zero additional spend (no CI tools, no paid reports). Entirely human-powered from existing team. Sari: 'The best CI comes from listening to your own customers — they tell you about competitors better than any monitoring tool.' Budi's field CI is the most unique and irreplaceable.</p>
      </div>

      {/* Market Positioning Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> POSITIONING MAP — Peta Posisi MJP vs. Semua Alternatif yang Digunakan BUJK Saat Ini: Mengapa 'Tidak Ada Kompetitor Langsung' adalah Klaim yang Benar tapi Menyesatkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">MJP competes for BUJK attention and budget against these real alternatives — most are not software:</p>
          {[
            { category: "1. Internal Staff (Admin / Procurement Manager)", share: "Most common 'competitor'", desc: "Every BUJK has someone doing manual LPSE checking. That person's time is the alternative to MJP. Cost: Rp 4–8jt/bln in salary for task that MJP replaces for Rp 1.5jt. ROI case is clear — but inertia is powerful: 'We already have someone doing this.'", mjpAngle: "Frame as: 'MJP frees your admin to do higher-value work, not replaces them.' Reduction of anxiety, not headcount.", tc: "text-orange-700" },
            { category: "2. LPSE directly + personal network", share: "Universal baseline", desc: "Every BUJK uses LPSE directly. Personal network for sub-contractor matching, regulatory updates via WhatsApp groups, competitor knowledge via community. Free. But: 312 LPSE instances, no aggregation, no HPS model, no trust score.", mjpAngle: "MJP supercharges existing LPSE usage — not replaces. 'You'll still log into LPSE for submissions; MJP is the intelligence layer on top.'", tc: "text-blue-700" },
            { category: "3. Asosiasi BUJK (GAPENSI, GAPEKSINDO, INKINDO)", share: "High trust, low frequency", desc: "Asosiasi provide regulatory seminars, peer networking, official advocacy. Trusted but: updates are event-driven (monthly seminar, not daily alert), not personalized, no data tools.", mjpAngle: "MJP complements association membership — different frequency, different depth. Reza never positions against associations (future partnership opportunity).", tc: "text-blue-700" },
            { category: "4. Konsultan tender / jasa pengurusan SKK", share: "Specialized, high cost", desc: "Transactional consultants charging Rp 3–10jt per tender or SKK case. High quality for specific tasks, but: no ongoing intelligence, no platform, no accumulated knowledge.", mjpAngle: "MJP replaces the recurring transactional work; complex one-offs still go to consultants. SKK Express is MJP's toe in this market.", tc: "text-muted-foreground" },
            { category: "5. Pendatang baru digital (startup eSourcing, gov portal)", share: "Emerging", desc: "New digital procurement portals (some government-initiated, some startup) trying to aggregate procurement data. Generally: shallower coverage, no intelligence layer, no relationship moat.", mjpAngle: "MJP's 4-year head start + regulatory intelligence + BUJK-specific features make pure data aggregators irrelevant for MJP klien.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.category}</p>
                <span className="text-[7px] font-mono text-muted-foreground">{r.share}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP angle: {r.mjpAngle}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The most honest competitive statement: MJP's primary competition is inertia + internal staff habit + WhatsApp group intelligence. Not software. This means the sales motion is behavior change, not feature comparison. Reza's job is not to convince BUJK that MJP is better than a competitor — it's to convince them that the status quo is costing them more than they realize.</p>
      </div>

      {/* Reza's Objection Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> OBJECTION PLAYBOOK — Panduan Jawaban Reza untuk 8 Keberatan Paling Sering Muncul dari Calon Klien — dan Kata-Kata Pasti yang Terbukti Mengubah Keberatan Menjadi Konversi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { obj: "O1 — 'Harganya mahal, Rp 1.5jt/bln itu besar untuk kami'", freq: "41% of objections", response: "Reza: 'Berapa biaya satu tender yang gagal lolos karena info terlambat? Satu kali disqualifikasi karena SKK expired = Rp 15–25jt hilang. MJP Rp 1.5jt/bln = Rp 18jt/thn. Itu harga 1 kali kesalahan. Kalau dalam setahun MJP mencegah 1 kesalahan saja, sudah balik modal.' Followed by case study dari klien yang saved Rp 23jt dari 1 tender decision." },
            { obj: "O2 — 'Kami sudah langganan LPSE langsung, tidak perlu lagi'", freq: "28% of objections", response: "Reza: 'MJP tidak mengganti LPSE — kami tambahan di atasnya. LPSE kasih data. MJP kasih keputusan. Coba tanya: dari 312 LPSE yang aktif, berapa yang Anda check setiap hari? LPSE tidak filter berdasarkan KBLI Anda, tidak kasih HPS estimate, tidak kasih trust score sub-kontraktor. Itu yang MJP tambahkan.'" },
            { obj: "O3 — 'Tim kami sudah ada yang handle pengadaan'", freq: "19% of objections", response: "Reza: 'Bagus — MJP buat kerja tim Anda lebih efektif, bukan digantikan. Berapa jam/minggu tim Anda spend untuk check tender + cari info kompetitor? Kalau MJP bisa kurangi itu jadi 30 menit, apa yang bisa mereka kerjakan dengan 5 jam yang tersisa?' Reframe: MJP as productivity multiplier for existing team." },
            { obj: "O4 — 'Data Anda akurat tidak? Saya pernah dengar keluhan soal data'", freq: "15% of objections", response: "Reza: 'Pertanyaan bagus — dan saya appreciate karena itu berarti Anda serius. MJP punya quality gate 7 checkpoint. Akurasi tender data 99.7% (validated). Untuk BUJK Trust Score, kami pakai 3 sumber silang. Kalau Anda pernah dengar keluhan spesifik, saya mau dengar — mungkin itu feedback yang bisa kami perbaiki. Silakan dicoba gratis 14 hari.' Transparansi + trial closes almost always." },
            { obj: "O5 — 'Saya mau tanya bos dulu'", freq: "12% of objections", response: "Reza: 'Tentu. Boleh saya bantu siapkan 1 halaman ringkasan untuk ditunjukkan ke beliau? Saya bisa kirim dalam 30 menit — termasuk ROI calculation untuk skala usaha Anda.' Provides a tool to the contact, not a push. Creates forward momentum without pressure." },
            { obj: "O6 — 'Nanti saja, sekarang sedang sibuk proyek'", freq: "8% of objections", response: "Reza: 'Justru saat proyek berjalan adalah waktu terbaik untuk setup MJP — karena tender berikutnya sudah mulai muncul. Proses setup hanya 20 menit. Saya bisa bantu via WA, tidak perlu meeting.' Removes the perceived time cost of adoption." },
            { obj: "O7 — 'Kami belum punya anggaran tahun ini'", freq: "6% of objections", response: "Reza: 'Kami ada opsi bulanan — tidak perlu komitmen tahunan dulu. Coba 1 bulan di Rp 1.5jt. Kalau dalam 30 hari tidak ada manfaat yang terasa, saya sendiri yang sarankan untuk tidak lanjut.' Reduces commitment perception. Trial psychology." },
            { obj: "O8 — 'Kami perusahaan kecil, belum butuh platform seperti ini'", freq: "4% of objections", response: "Reza: 'BUJK kecil yang paling butuh intelligence — karena Anda tidak punya tim dedicated seperti perusahaan besar. MJP adalah tim research virtual Anda. J7 dengan MJP bersaing setara dengan J8 yang tidak pakai MJP.' Information equality pitch — resonates strongly with growth-oriented J7." },
          ].map((r) => (
            <div key={r.obj} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1 text-primary">{r.obj}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.freq}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.response}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Objection playbook is a living document — Reza updates it after every lost deal with the objection that wasn't answered well. Last major update: Q1 2026 (added O4 after a deal lost to 'data accuracy' concern). Reza's conversion rate after O1 reframe (cost-of-mistake framing): 67% of objectors convert. Before this framing was developed: 34%. The ROI anchor is the single most impactful language change in MJP's sales history.</p>
      </div>

      {/* Win-Loss Analysis Archive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> WIN-LOSS ARCHIVE — Arsip Analisis Menang-Kalah MJP: Pola Dari 287 Deals yang Di-close Reza — Apa yang Membuat Klien Akhirnya Berkata 'Ya' dan Apa yang Membuat Mereka Pergi ke Kompetitor atau Tidak Membeli Sama Sekali
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "287", label: "Total deals tracked (2023–2026)", tc: "text-primary" },
              { stat: "71%", label: "Win rate (deals closed / qualified leads)", tc: "text-emerald-700" },
              { stat: "29%", label: "Loss rate — analyzed every case", tc: "text-red-700" },
              { stat: "18 hari", label: "Avg sales cycle (lead to paid)", tc: "text-muted-foreground" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto mb-1">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Win/Loss reason</th>
                  <th className="p-1 text-center">Type</th>
                  <th className="p-1 text-center">Frequency</th>
                  <th className="p-1 text-left">Pattern note</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender alert triggered urgent need", "WIN", "34%", "Best conversion: BUJK who just missed a deadline — very motivated."],
                  ["Budi referral / word-of-mouth", "WIN", "22%", "Highest-quality lead source. Pre-sold by Budi's credibility."],
                  ["Reza demo with live tender search", "WIN", "19%", "Seeing their specific KBLI + geography results is the aha moment."],
                  ["SKK Express emergency need", "WIN", "14%", "High-intent, high-urgency. Converts to Pro after Express resolution."],
                  ["Day 14 follow-up converted from trial", "WIN", "11%", "Free trial leads who hit aha moment become strongest Pro subscribers."],
                  ["Price objection unresolved (too expensive)", "LOSS", "38%", "Mostly J7, single-digit tender count/year. ROI case doesn't land."],
                  ["Decision maker not in initial call", "LOSS", "27%", "Contact couldn't convince internal decision maker. No MJP executive touch."],
                  ["Went with status quo (no change)", "LOSS", "21%", "Inertia wins. No triggering event to overcome habit change cost."],
                  ["Competitor chosen (assoc. tool / in-house)", "LOSS", "9%", "Rare — usually a GAPENSI member using association portal."],
                  ["Bad timing (budget cycle)", "LOSS", "5%", "Q4 budget decisions already made. Reza re-contacts Q1."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${row[1] === "WIN" ? "bg-emerald-50/40" : "bg-red-50/30"}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className={`p-1 text-center font-bold ${row[1] === "WIN" ? "text-emerald-700" : "text-red-700"}`}>{row[1]}</td>
                    <td className="p-1 text-center text-primary">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Win-loss log maintained by Reza in Notion — every closed deal (won or lost) has a 3-sentence entry: trigger, key moment, outcome. Reviewed with Hendra monthly. Biggest insight from the archive: 69% of wins had an identifiable triggering event (missed tender, urgent SKK, Budi referral). The product roadmap implication: create more triggering events — more types of alerts, more urgency signals — to increase the pool of high-intent leads.</p>
      </div>

      {/* Reza's Growth Experiments Archive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> GROWTH EXPERIMENTS — Arsip Eksperimen Pertumbuhan Reza: 9 Taktik Akuisisi yang Pernah Dicoba, Mana yang Berhasil, dan Mengapa 5 di Antaranya Dihentikan Meski Tampak Menjanjikan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { exp: "E01 — LinkedIn outreach (manual, BUJK directors)", result: "ACTIVE ✅", metrics: "7.3% reply rate, 2.1% conversion. Best performing digital channel.", detail: "Reza sends 30 personalized messages/week. Personalization key: references specific KBLI or region in opening. Generic messages: 0.4% reply. Personalized: 7.3%. Template available for SDR replication." },
            { exp: "E02 — Google Ads (keyword: 'software tender konstruksi')", result: "ACTIVE ✅", metrics: "Rp 85k CPC, 3.8% trial signup rate, 1.2% paid conversion. CAC: Rp 7.1jt.", detail: "Running since Q2 2025. ROAS positive at > 90-day cohort. Scaling limited by Reza's onboarding capacity — more signups than Reza can Day-1 call." },
            { exp: "E03 — WhatsApp broadcast to BUJK community groups", result: "STOPPED ❌", metrics: "High open rate but 31% unsubscribe, 4 spam reports. CAC immeasurable.", detail: "Stopped Q4 2024. WA broadcast feels intrusive in professional groups. Damaged MJP's brand perception among 2 community group admins. Lesson: WA is for 1:1 relationship, not broadcast." },
            { exp: "E04 — Webinar with asosiasi (monthly, Sari presents)", result: "ACTIVE ✅", metrics: "Avg 47 attendees/webinar, 12% trial signup post-webinar, 4.1% paid.", detail: "Best brand-building channel. Sari's credibility drives trust. 7 webinars in 2025. Q3 2026: scaling to twice-monthly." },
            { exp: "E05 — SEO content (Sari writes KBLI-specific articles)", result: "ACTIVE ✅", metrics: "4.200 organic visitors/month, 2.8% trial signup, 0.9% paid. Growing.", detail: "Long-tail strategy: 'cara hitung HPS tender jembatan' → article → MJP trial. Takes 3–6 months per article to rank. Hendra Jr. built SEO dashboard. 47 articles live." },
            { exp: "E06 — Referral program (klien gets 1 month free for referral)", result: "PAUSED ⏸", metrics: "21 referrals in 3 months, 14 converted. But: complex to administer.", detail: "Good conversion but credit tracking was manual and error-prone. Paused to build proper referral tracking system. Resume Q4 2026 with automated tracking." },
            { exp: "E07 — Partnership with accounting firms serving construction", result: "STOPPED ❌", metrics: "2 partnerships initiated, 0 referrals in 90 days.", detail: "Accounting firms advise on finances, not procurement operations. Wrong channel. Lesson: partner only with entities who touch the tender decision." },
            { exp: "E08 — BUJK WhatsApp group thought leadership (Budi posting)", result: "ACTIVE ✅", metrics: "Indirect — generates Budi referrals, not trackable as a direct channel.", detail: "Budi shares 1 MJP insight/week in 4 groups (no direct pitch). Generates credibility that feeds referral conversations. Contribution to leads: ~31 warm referrals over 4 years." },
            { exp: "E09 — Cold email to BUJK from LPJK registry", result: "STOPPED ❌", metrics: "0.2% reply rate. 3 spam complaints. 1 formal complaint to LPJK.", detail: "Ethical and legal risk: using LPJK contact data for commercial outreach violated expected use. Stopped immediately. Hendra: 'Never use public registry data for unsolicited commercial contact.'" },
          ].map((r) => (
            <div key={r.exp} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.exp}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.result.includes("✅") ? "text-emerald-700" : r.result.includes("❌") ? "text-red-700" : "text-orange-700"}`}>{r.result}</span>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.metrics}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">4 active channels (LinkedIn, Google Ads, Webinar, SEO) represent 91% of MJP's current paid acquisition. Budi's WA group presence (E08) is the highest-ROI unpaid channel — zero cost, 31 warm leads over 4 years. The stopped experiments (E03, E07, E09) all shared a pattern: wrong channel or wrong audience. Reza's rule: 'Kill experiments faster than you should. The experiments you hesitate to stop are costing you opportunity in the ones that work.'</p>
      </div>

      {/* Customer Expansion Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-primary" /> EXPANSION PLAYBOOK — Playbook Ekspansi Pelanggan: Strategi Reza untuk Mengupgrade Klien dari Pro ke Enterprise — Timing yang Tepat, Argumen yang Benar, dan 5 Trigger Ekspansi yang Paling Berhasil
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Upgrade timing: Month 8–14 for Pro klien is the sweet spot. Earlier = klien not yet proven MJP ROI. Later = klien adapted to Pro limits.</p>
          {[
            { trigger: "T1 — Klien submits 5+ consortium tenders in 12 months", signal: "Pro limits consortium matching (10 searches/month). Enterprise: unlimited + proactive recommendations.", pitch: "'You've been actively using consortium matching — you're hitting the limit. Enterprise removes that ceiling and adds proactive suggestions: I'll notify you when a qualifying BUJK for your next target tender becomes available.'", conv: "71%" },
            { trigger: "T2 — Klien's Trust Score lookup frequency exceeds 40/month", signal: "Pro limit is 50 lookups/month. Enterprise: unlimited + watchlist alerts.", pitch: "'Your lookup pattern tells me you're vetting BUJK for multiple projects simultaneously. Enterprise gives you watchlist monitoring — instead of you checking, we alert you the moment a BUJK you're tracking changes status.'", conv: "64%" },
            { trigger: "T3 — Klien wins a project > Rp 500jt that MJP alerted", signal: "The best upgrade moment: concrete ROI just demonstrated. Klien is at peak trust.", pitch: "'You won a Rp [X] project from our alert. That's a proven ROI multiple. Enterprise extends this: dedicated briefing, direct line to Sari for regulatory questions, HPS support.'", conv: "83%" },
            { trigger: "T4 — Klien adds second team member to the platform", signal: "Multi-user behavior signals growth. Pro is 1-user. Enterprise: up to 5 seats.", pitch: "'I see you've been sharing platform access with your team. Enterprise gives each team member their own account with KBLI/geography preferences — no more sharing one login.'", conv: "58%" },
            { trigger: "T5 — Klien mentions 'I wish MJP had...' in feedback", signal: "A feature request is an upgrade conversation. Enterprise includes Sari's advisory access.", pitch: "'I hear that you need [X]. That's actually something Sari covers in our Enterprise tier — she can answer direct questions about [X] and interpret regulations for your specific KBLI.'", conv: "52%" },
          ].map((r) => (
            <div key={r.trigger} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.trigger}</p>
                <span className="text-[7px] font-mono text-emerald-700 shrink-0 font-bold">Conv: {r.conv}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Signal: {r.signal}</p>
              <p className="text-[7px] font-mono text-primary italic">Pitch: {r.pitch}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mt-1">
            <p className="text-[9px] font-bold text-blue-700">Enterprise upgrade revenue impact:</p>
            <p className="text-[8px]">Pro → Enterprise upgrade: Rp 1.2jt/month → Rp 4.5jt/month = +Rp 3.3jt/month per klien. Currently 34 Enterprise klien out of 487 (7%). Target 2026: 15% Enterprise ratio (73 klien). At 15%: +Rp 128.7jt/month in incremental ARR from upgrades alone — without new customer acquisition.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Expansion playbook trained with Reza monthly. Best practice: never upgrade pitch without a trigger. Cold upgrade pitches convert at 8%. Trigger-based pitches convert at 52–83%. The trigger is not a technique — it's proof that the klien has already outgrown their current plan. Reza: 'When I bring the upgrade conversation at the right moment, I'm not selling — I'm solving a problem they already have. That's the difference between an 80% and an 8% conversion.'</p>
      </div>

      {/* IKN Intelligence Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-primary" /> IKN INTELLIGENCE — Intelijen Khusus IKN: Mengapa Ibu Kota Nusantara adalah Kategori Tersendiri di Platform MJP — Dinamika Kompetitor Unik, BUJK yang Bermain, dan Peluang yang Terbuka untuk Klien J9 MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              aspect: "Why IKN is a separate competitive landscape",
              detail: "IKN procurement has different dynamics than regular APBN/APBD: (1) Fast-track rules bypass normal procurement timelines, (2) PSN status means direct appointment is more common for strategic packages, (3) Most packages are > Rp 50T total value — attracting large J9 BUJK and international contractors, (4) BUJK trust and relationships (proximity to Otorita IKN) matter more than price.",
              insight: "For J9 MJP klien, IKN is the highest-stakes arena. One IKN consortium win can represent more revenue than 3–5 years of normal APBD operations.",
              tc: "text-primary"
            },
            {
              aspect: "BUJK landscape in IKN (Sari's tracking, Q2 2026)",
              detail: "Active BUJK in IKN tenders: ~84 BUJK with at least 1 IKN submission in the last 12 months. Of MJP's Enterprise klien: 12 have active IKN interest. Top 3 most active non-consortium BUJK in IKN by tender volume: Waskita Karya, Hutama Karya, WIKA (all BUMN — not accessible to most J9 private BUJK). For private J9 BUJK: consortium with one BUMN is the dominant entry path.",
              insight: "MJP's IKN intel value for J9 klien: identify which BUMN is leading which package, then position as the ideal private consortium partner with complementary KBLI.",
              tc: "text-blue-700"
            },
            {
              aspect: "IKN tender alert performance (Q2 2026)",
              detail: "IKN-tagged tenders delivered to klien: 127 in Q2 2026. L1 alerts (<8 min): 98.4% compliance (better than average due to Otorita IKN portal being well-structured HTML). IKN klien open rate: 87% (highest segment open rate on platform). IKN alert → action rate: 43% (klien take a follow-up action within 48h).",
              insight: "IKN klien are the platform's most engaged segment. Their engagement validates MJP's thesis: higher-stakes intelligence drives higher engagement and higher retention.",
              tc: "text-emerald-700"
            },
            {
              aspect: "IKN-specific risks Sari monitors",
              detail: "IKN scope changes: IKN project scope evolves faster than any other category. Sari checks Otorita IKN portal and government press releases daily (not weekly). Key risk: a package that was announced may be descoped, delayed, or absorbed into a direct appointment — without notice on LPSE. IKN klien need interpretation, not just data.",
              insight: "3 IKN packages in H1 2026 were announced, received alert traffic, then quietly cancelled before tender opening. Sari issued cancellation alerts to the 34 MJP klien who had opened the original alert. This proactive cancellation alert is a differentiator no competitor offers.",
              tc: "text-orange-700"
            },
          ].map((r) => (
            <div key={r.aspect} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.aspect}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">IKN vertical represents 8.3% of all tender alerts delivered in 2025 but 23% of Enterprise klien's cited ROI in Reza's renewal notes. Disproportionate value concentration. Post-Series A: Hendra will assign one dedicated 'IKN analyst' role (within Sari's team expansion) to monitor Otorita IKN full-time and produce IKN-specific weekly briefing for Enterprise klien. At current trajectory, IKN-focused Enterprise klien will become a distinct product tier (IKN Pro) by 2028.</p>
      </div>

      {/* Competitor Partnership Potential */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> PARTNERSHIP POTENTIAL — Potensi Kemitraan dengan Kompetitor: 3 Situasi di Mana MJP Akan Mempertimbangkan Bermitra dengan Pesaing — dan Garis Merah yang Tidak Akan Pernah Dilewati dalam Negosiasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              situation: "P1 — Data exchange partnership (MJP tender data ↔ competitor BUJK directory data)",
              logic: "If Competitor X has a broader BUJK directory (more BUJK listed, more contact data) but weak tender intelligence — MJP has the inverse. A data exchange could make both platforms more complete without directly competing.",
              conditions: "MJP's conditions: (1) No sharing of klien identity or behavioral data, (2) Only public-source derived data exchanged, (3) Clear non-compete clause on each other's core product (MJP doesn't build BUJK directory; competitor doesn't build tender alerts).",
              reality: "Hendra has had 2 informal conversations with competitor founders about this. Neither progressed — both competitors wanted MJP's tender data without giving up their BUJK data advantage. The exchange wasn't symmetric.",
              tc: "text-primary"
            },
            {
              situation: "P2 — White-label MJP's alert engine for a complementary platform (e.g. accounting software for contractors)",
              logic: "An accounting platform serving BUJK could embed MJP's tender alerts as an add-on: 'Track all tenders relevant to your KBLI — powered by MJP.' MJP gets distribution; the accounting platform retains its klien.",
              conditions: "MJP's conditions: (1) Revenue share of 30–40% to MJP, (2) MJP brand visible ('Powered by MJP'), (3) Minimum 200 BUJK users on the partner platform to justify integration cost.",
              reality: "Hendra has identified 3 accounting/ERP platforms serving Indonesian contractors. One (anonymous) has expressed interest. No formal discussions started. This is a post-Series A BD effort (H8 hire).",
              tc: "text-blue-700"
            },
            {
              situation: "P3 — Acquisition OF a competitor (consolidation play, 2028+)",
              logic: "If a competitor (particularly one of the 3 legacy players with brand recognition but poor product) is struggling post-2027 and willing to sell at a price that primarily buys their BUJK relationship list — MJP acquires them and migrates their klien to MJP's platform.",
              conditions: "MJP's conditions: (1) Target has > 300 BUJK relationships (minimum scale for the effort), (2) Price reflects BUJK relationships, not their technology (MJP's tech is better; their tech is worthless to MJP), (3) Migration timeline: 6 months for all klien to MJP platform.",
              reality: "Contingent on Series A close + 2 years of execution. Hendra's assessment: 'By 2028, the weaker legacy players will be in trouble. We want to be in a position to be the buyer, not the target.'",
              tc: "text-orange-700"
            },
          ].map((r) => (
            <div key={r.situation} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.situation}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.logic}</p>
              <p className={`text-[7px] text-muted-foreground mb-0.5`}>Conditions: {r.conditions}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.reality}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Red lines Hendra will never cross in any competitor partnership: (1) Sharing active klien behavioral data in any form. (2) Agreeing to a non-compete on MJP's core intelligence product. (3) Co-branding that reduces MJP's brand visibility to {'<'} 50% of the partnership's user-facing presence. (4) Any partnership that gives a competitor access to Sari's editorial methodology or Budi's field intelligence network. These red lines exist because MJP's competitive advantage is its data and its human intelligence network — both are irreproducible and must never be shared with parties who could eventually use them against MJP.</p>
      </div>

      {/* Competitive Moat Durability Assessment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Castle className="h-3.5 w-3.5 text-primary" /> MOAT DURABILITY — Ketahanan Parit Kompetitif MJP: Seberapa Lama Setiap Keunggulan MJP Dapat Bertahan Jika Kompetitor Mulai Menginvestasikan Sumber Daya Besar untuk Mengejar — 5 Moat dengan Estimasi Time-to-Parity
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { moat: "M1 — Historical tender data depth (4 years, 847k records)", ttp: "3–4 years minimum", why: "A competitor starting today cannot acquire 4 years of historical data — they must wait 4 years to accumulate it. Historical data enables trend analysis, HPS benchmarking, and seasonal pattern detection that real-time competitors cannot offer. Time-to-parity can be shortened if competitor acquires a company with historical data — MJP's acquisition defense: be the only company worth acquiring.", tc: "text-primary" },
            { moat: "M2 — Sari's annotated knowledge corpus (1.247 assets, 4-tier citation standard)", ttp: "2–3 years minimum", why: "A competitor can hire a researcher and start producing assets today. But replicating 1.247 assets at Sari's quality standard requires a researcher of Sari's caliber + 2–3 years of production time. The citation standard itself takes 12+ months to develop through real editorial discipline. Accelerator: a well-funded competitor could hire 3 researchers to parallel-produce — reducing to 18 months. MJP's defense: keep raising the quality bar faster than competitors can copy the standard.", tc: "text-blue-700" },
            { moat: "M3 — Budi's BUJK intelligence network (180+ named contacts, 4 years of trust)", ttp: "4–6 years minimum", why: "Trust in the Indonesian construction industry is personal, not institutional. A new field researcher cannot walk into a BUJK network with MJP's credibility — they must earn it over years. Budi's 180 named contacts represent 4 years of relationship capital. A competitor's new hire starting today would have 30–40 useful contacts after 2 years (early days of building trust), not 180. Network effects accelerate: more contacts → more referrals → faster network growth (but starting from zero is hardest).", tc: "text-orange-700" },
            { moat: "M4 — NLQ training data (BUJK-specific query intent, Q4 2026+)", ttp: "18–24 months after NLQ launch", why: "Once MJP's NLQ logs 6+ months of real klien queries, the query intent dataset is uniquely valuable for fine-tuning construction-domain AI. A competitor would need to (1) build an NLQ product, (2) acquire enough users to generate comparable query volume, (3) fine-tune their model. Each step has a lag. The BUJK-specific fine-tuning data is MJP's future deepest moat — because it requires a live product with engaged users to generate it.", tc: "text-emerald-700" },
            { moat: "M5 — Klien switching cost (data history + team habit formation)", ttp: "Permanent for entrenched klien", why: "Enterprise klien who have used MJP for 2+ years have: (1) BUJK watchlists configured (takes hours to rebuild), (2) Alert KBLI profiles refined over months of behavioral data, (3) Procurement calendar downloaded and embedded in their team process, (4) Reference to historical tender data in their bid files. Moving to a competitor means losing all of this. Switching cost compounds with tenure. Enterprise klien at 3+ years tenure: 97% renewal rate — the switching cost is effectively permanent.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.moat} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.moat}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>TTP: {r.ttp}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.why}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Moat durability assessment is the core of Hendra's Series A investor conversation. The question investors ask: 'What happens if a Telkom or Go-To decides to build this?' Hendra's answer: 'In 3–4 years, they could replicate our data volume. In 6+ years, they could build a field intelligence network. They cannot buy Sari's editorial instinct or Budi's relationship trust — those are people-dependent. And by the time they catch up on data, we'll have 4 more years of NLQ training data they can't replicate. We don't need to be uncopyable forever. We just need to stay ahead of the curve.'</p>
      </div>

      {/* R96: Win/Loss Analysis Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> WIN/LOSS ANALYSIS DEEP DIVE — 5 Pola Kekalahan dan 4 Pola Kemenangan dari Review Deal 2025: Apa yang Benar-Benar Membuat Klien Memilih atau Menolak MJP di Pasar yang Kompetitif
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-bold text-primary mb-1">LOSS PATTERNS — mengapa klien memilih tidak subscribe (atau tidak perpanjang)</p>
          {[
            { code: "L1", pattern: "Harga vs Nilai Gap (38% of losses)", trigger: "BUJK J7 dan bawah — budget terbatas, belum lihat ROI nyata dari intelligence", fix: "Starter tier Rp 399k/bulan + 30-day free trial. Loss rate L1: turun dari 54% → 38% setelah Starter diperkenalkan Q4 2024.", tc: "text-red-700" },
            { code: "L2", pattern: "Platform Fatigue (22% of losses)", trigger: "BUJK sudah subscribe 4+ SaaS tools — tidak mau tambah dashboard baru", fix: "WhatsApp digest mode: MJP push intel ke WA, tanpa login required. L2 losses menurun sejak WA digest pilot.", tc: "text-orange-700" },
            { code: "L3", pattern: "Internal Champion Left (18% of losses)", trigger: "Orang yang sign up MJP (sering: Kepala Estimasi) resign dari perusahaan", fix: "Multi-seat accounts + onboarding ke 2nd contact. L3 is inherently hard to prevent — people change jobs.", tc: "text-orange-700" },
            { code: "L4", pattern: "DIY Competitor (14% of losses)", trigger: "BUJK buat tim internal untuk monitor LPSE manual — 'kita bisa sendiri'", fix: "ROI calculator: berapa jam/minggu monitoring manual vs Rp 399k/bulan. Convert 1 of 5 L4 to close.", tc: "text-yellow-700" },
            { code: "L5", pattern: "Category Mismatch (8% of losses)", trigger: "BUJK non-construction (MEP/landscaping) merasa data tidak relevan", fix: "Better pre-qualification: Reza now qualifies KBLI category before demo.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.code} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[7px] font-mono font-bold ${r.tc} shrink-0`}>{r.code}</span>
                <p className={`text-[8px] font-bold ${r.tc}`} title={r.pattern}>{r.pattern}</p>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5" title={r.trigger}>Trigger: {r.trigger}</p>
              <p className={`text-[7px] font-mono ${r.tc}`} title={r.fix}>Fix: {r.fix}</p>
            </div>
          ))}
          <p className="text-[8px] font-bold text-emerald-700 mt-2 mb-1">WIN PATTERNS — mengapa klien memilih MJP dan tetap loyal</p>
          {[
            { code: "W1", pattern: "First-Alert Advantage (44% of wins)", why: "Klien menang tender karena dapat info lebih awal dari kompetitor. Konkret, terasa langsung. Ini adalah value proposition yang 'sells itself'." },
            { code: "W2", pattern: "BUJK Intelligence Trust (31% of wins)", why: "Trust Score dan blacklist history memberikan kepercayaan diri untuk vetting subkon. Klien yang pernah kena scam subkon sebelumnya adalah target market yang paling receptive." },
            { code: "W3", pattern: "Regulatory Anxiety Relief (16% of wins)", why: "Klien yang pernah kena denda regulasi (terutama K3 dan lingkungan) sangat receptive pada Sari's regulatory digest. Peace of mind adalah WTP driver yang underestimated." },
            { code: "W4", pattern: "SKK Renewal Prevention (9% of wins)", why: "Klien yang pernah kehilangan proyek karena SKK expired sangat loyal ke MJP's SKK reminder system. Trauma-driven retention is the strongest." },
          ].map((r) => (
            <div key={r.code} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[7px] font-mono font-bold text-emerald-700 shrink-0">{r.code}</span>
                <p className="text-[8px] font-bold text-emerald-700" title={r.pattern}>{r.pattern}</p>
              </div>
              <p className="text-[7px] text-muted-foreground" title={r.why}>{r.why}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Win/Loss data dikumpulkan Reza dari 84 closed deals (49 wins, 35 losses) sepanjang 2025. Metodologi: setiap deal yang closed (baik win maupun loss) mendapat follow-up WhatsApp dari Reza dalam 48 jam, asking a single question: 'Satu alasan utama keputusan ini?' Response rate: 78% (66 of 84). Reza: 'Loss interviews lebih berharga dari win interviews. Wins confirm what we think we do well. Losses tell us what we're actually bad at.' Pattern analysis dilakukan setiap kuartal — Hendra dan Reza spend 2 jam per kuartal reviewing loss patterns dan updating the fix protocols.</p>
      </div>

      {/* R97: Competitor Monitoring Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> COMPETITOR MONITORING PROTOCOL — Bagaimana MJP Secara Sistematis Memantau Pergerakan Kompetitor: Sumber yang Dipantau, Frekuensi, Siapa yang Bertanggung Jawab, dan Apa yang Memicu Response Strategis
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { source: "Website pricing pages (semua kompetitor aktif)", freq: "Bulanan", owner: "Hendra Jr. (automated)", trigger: "Perubahan harga >10% atau perubahan tier structure → immediate report ke Hendra", tc: "text-primary" },
            { source: "LinkedIn job postings kompetitor", freq: "Mingguan", owner: "Sari (manual scan)", trigger: "Jika kompetitor hire 'Data Engineer' atau 'Field Research' roles → sinyal expansion ke data collection yang MJP lakukan", tc: "text-blue-700" },
            { source: "Kompetitor demo request (Reza ikut incognito)", freq: "Kuartalan", owner: "Reza", trigger: "Setiap H2 — Reza request demo dari 2 kompetitor utama menggunakan profile anonim. Tujuan: lihat positioning, pricing, dan feature yang diperlihatkan ke prospect.", tc: "text-orange-700" },
            { source: "App store reviews kompetitor (mobile apps)", freq: "Bulanan", owner: "Hendra Jr.", trigger: "Review yang menyebut 'fitur yang saya mau' atau 'yang kurang' → product backlog consideration untuk MJP", tc: "text-emerald-700" },
            { source: "Klien yang churn ke kompetitor (exit interview)", freq: "Per event", owner: "Reza", trigger: "100% klien yang mention kompetitor name saat churn mendapat special exit interview: 'Apa yang kompetitor itu punya yang MJP tidak punya?'", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.source} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.source}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.freq}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Owner: {r.owner}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Trigger: {r.trigger}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2 bg-muted/30 mt-2">
            <p className="text-[8px] font-bold text-primary mb-1">Kompetitor yang sedang paling diperhatikan (Q2 2026)</p>
            <p className="text-[7px] text-muted-foreground">C4 (unnamed startup, Bandung): sedang raise seed round, 2 LinkedIn job postings untuk data engineer. If they raise: 18-month runway to build basic crawler infrastructure. MJP must accelerate BUMN coverage and NLQ v1 before C4 reaches product parity on basic features. Hendra: 'Mereka bukan ancaman hari ini. Tapi jika investor mereka sabar dan mereka hire right: 24 bulan.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitor monitoring di MJP tidak pernah menjadi obsesi — Hendra sangat sadar akan bahaya 'looking over your shoulder' culture di startup. Monitoring protocol dirancang minimal: cukup untuk tidak terkejut, tidak cukup untuk distract dari building. Hendra's rule: 'Kita boleh tahu apa yang kompetitor lakukan. Kita tidak boleh membangun fitur karena kompetitor membangunnya. Kita membangun fitur karena klien butuh.' Protocol ini adalah intelligence input, bukan strategy driver.</p>
      </div>

      {/* R98: Competitive Intelligence IKN Focus */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-primary" /> COMPETITIVE INTELLIGENCE IKN FOCUS — Bagaimana Setiap Kompetitor MJP Memposisikan Diri untuk IKN: Siapa yang Paling Agresif, Siapa yang Absen, dan Mengapa IKN adalah Battleground yang Menentukan Market Positioning 2026–2028
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { comp: "C1 (Kompetitor nasional terbesar)", ikn_position: "Agresif: dedicated IKN section di website, 'IKN Ready' marketing badge. Tapi: data quality belum diverifikasi. Klien MJP yang juga coba C1 untuk IKN tenders melaporkan missing tender coverage (12% miss rate vs MJP 1.3%).", mjp_advantage: "Coverage depth + annotation quality. C1 covers more but annotates less.", tc: "text-red-700" },
            { comp: "C2 (Konsultan dokumen)", ikn_position: "Fokus ke document preparation untuk IKN tenders: mengisi kesenjangan antara mengetahui tender ada dan mempersiapkan dokumen yang compliant dengan persyaratan IKN yang berbeda dari LPSE reguler.", mjp_advantage: "MJP adalah intelligence layer, C2 adalah execution layer. They are complementary — Reza tidak frame MJP sebagai C2 competitor untuk klien yang butuh keduanya.", tc: "text-orange-700" },
            { comp: "C3 (Regional startup, Kalimantan)", ikn_position: "100% fokus IKN — ini adalah satu-satunya mereka. Strong pada LPSE Kaltim coverage tapi tidak punya regulatory atau SKK vertical.", mjp_advantage: "Breadth vs depth: MJP serves BUJK yang juga tender di Jawa dan Sulawesi, bukan hanya IKN. C3 valuable for IKN-only BUJK — small segment.", tc: "text-blue-700" },
            { comp: "C4 (Startup Bandung)", ikn_position: "Tidak ada IKN coverage — masih membangun core tender alert untuk Jawa. IKN is beyond current capacity.", mjp_advantage: "Geography as moat: IKN requires physical presence + Kaltim LPSE expertise. C4 cannot compete on IKN without significant investment.", tc: "text-emerald-700" },
            { comp: "MJP Position", ikn_position: "148 aktif klien di Kaltim, 2.847 IKN tenders di-coverage Q1 2026, Sari punya 47 IKN-specific knowledge assets. IKN adalah prioritas pertumbuhan #1 untuk Reza.", mjp_advantage: "Early mover advantage: first comprehensive intelligence platform untuk IKN. Coverage head start 18+ bulan vs closest competitor.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.comp} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.comp}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">IKN position: {r.ikn_position}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP advantage: {r.mjp_advantage}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">IKN adalah first-mover opportunity yang tidak akan ada dua kali. Capital kota baru tidak pernah ada di Indonesia sebelumnya — dan mungkin tidak akan ada lagi dalam generasi ini. BUJK yang berhasil masuk ke IKN ecosystem sekarang akan mendapat referral network yang berlangsung 20+ tahun. MJP's IKN intelligence strategy: jadikan platform paling credible dan paling dense untuk IKN procurement intelligence. Hendra: 'IKN bukan hanya tentang revenue dari Kaltim klien. Setiap investor yang kita bicara bertanya tentang IKN. Punya posisi kuat di IKN adalah credential yang membuka doors yang tidak bisa dibuka oleh angka ARR semata.'</p>
      </div>

      {/* R99: Competitive Intelligence Blind Spots */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <EyeOff className="h-3.5 w-3.5 text-primary" /> COMPETITIVE INTELLIGENCE BLIND SPOTS — 4 Area yang MJP Akui Tidak Memiliki Visibility Baik tentang Kompetitor: Mengapa Blind Spots Ini Ada, Risiko yang Mereka Bawa, dan Rencana Mitigasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { spot: "BS-1: Stealth startups yang belum launch tapi sedang fundraise", risk: "HIGH", detail: "Startup yang sedang build (pre-launch) tidak visible di public channels. MJP bisa tidak tahu ada kompetitor baru sampai mereka announce funding atau klien mention mereka. Worst case: well-funded stealth competitor dengan 12-month head start di feature area MJP belum cover.", mitigation: "Hendra networking dengan VC: jika VC yang kita pitch sudah invest di stealth competitor yang overlaps dengan MJP, ethical VCs akan disclose conflict. Hendra juga monitor job postings di LinkedIn untuk 'construction intelligence' roles — stealth startups hire before they launch.", tc: "text-red-700" },
            { spot: "BS-2: Enterprise software vendors yang add construction module", risk: "HIGH", detail: "Existing ERP or procurement software (SAP, Oracle, Odoo) yang add Indonesian construction compliance module. They already have enterprise sales relationships that MJP cannot easily penetrate. Could frame MJP as redundant ('kami sudah punya ini di ERP').", mitigation: "Monitor ERP vendor product roadmaps (annual reports, conference announcements). Reza proactively positions MJP as 'real-time intelligence layer that integrates with your ERP' not 'ERP replacement'.", tc: "text-red-700" },
            { spot: "BS-3: Government-built platform (Kementerian PUPR digital initiative)", risk: "MEDIUM", detail: "Kementerian PUPR atau LKPP bisa build official tender intelligence platform yang would be free to BUJK. Government platforms typically have poor UX but government endorsement as moat. Risk: if mandated for compliance, BUJK might use government platform even if inferior.", mitigation: "MJP monitors PUPR digital roadmap publications. Hendra's view: 'Jika pemerintah build a free platform, kita compete on UX, speed, and depth — not on data access. And regulatory intelligence goes beyond government-issued data.'", tc: "text-orange-700" },
            { spot: "BS-4: C1 product roadmap beyond current public features", risk: "MEDIUM", detail: "C1 (nasional terbesar) tidak share product roadmap publicly. MJP knows current features but not what they are building. Could announce features that overlap with MJP's planned investments without warning.", mitigation: "Reza has 2 klien who are also C1 users — occasionally share unsolicited feedback about C1's direction. Ethical listening: Reza does not ask for C1's confidential info, only receives unsolicited comments.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.spot} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.spot}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>Risk: {r.risk}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Mitigation: {r.mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Blind spot documentation adalah Hendra's exercise in intellectual honesty. Most competitive analyses document what you know about competitors — this one documents what MJP doesn't know and can't easily find out. The value: it prevents false confidence. Hendra: 'Platform kita punya moat yang kuat. Tapi setiap moat ada weakness-nya. Jika kita tidak identify weakness kita sendiri, kompetitor akan melakukannya untuk kita.' Annual update cycle: Hendra revisits blind spots every December to assess whether any crystallized into actual threats. BS-1 dan BS-2 akan selalu ada — the best mitigation is faster execution on MJP's own roadmap so any would-be competitor faces a higher bar to entry.</p>
      </div>

      {/* R100: Competitor Co-existence Doctrine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> COMPETITOR CO-EXISTENCE DOCTRINE — Kapan Kompetitor Menjadi Mitra dan Kapan Tetap Rival: Hendra's Framework untuk Menentukan Partnership vs Competition, dan 2 Kasus Konkret yang Pernah Dipertimbangkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { condition: "Partnership possible WHEN: complementary offerings + non-overlapping klien base", detail: "C2 (konsultan dokumen) adalah kandidat paling natural. MJP: intelligence before bidding. C2: execution during bidding. Klien yang butuh keduanya saat ini must juggle 2 platforms. Partnership thesis: MJP refers klien ke C2 untuk document work, C2 refers klien ke MJP untuk tender intelligence. Revenue share arrangement. Reza telah informal discussion dengan C2 CEO 1x (Q3 2024) — tidak dilanjutkan karena C2 sedang membangun own intelligence layer. Jika C2 stops building intelligence: conversation will restart.", tc: "text-emerald-700" },
            { condition: "Partnership impossible WHEN: competitor is building into MJP's core value layer", detail: "C1 (nasional terbesar) tidak akan pernah menjadi partner MJP — mereka compete head-on. Memberi C1 data atau API access = memberikan competitive intelligence kepada musuh terbesar. Bahkan jika C1 approach dengan 'partnership' framing: Hendra's rule adalah partnership yang melibatkan data sharing ke C1 is not partnership, it's acquisition at a discount.", tc: "text-red-700" },
            { condition: "The acquisition test: 'Would we rather partner or buy them?'", detail: "Hendra's mental model: jika MJP could theoretically acquire a competitor and the combined platform would be stronger — explore acquisition, not partnership. Partnership is second-best when acquisition is off the table. Potential acquisition targets: C4 (Startup Bandung) — smaller, complementary geographic focus. C3 (Regional Kalimantan) — if they don't grow beyond IKN, their Kaltim BUJK network has acquisition value for Hendra's IKN expansion.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.condition} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.condition}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Co-existence doctrine adalah Hendra's lens for evaluating any competitor-adjacent conversation. Most startup founders have allergic reaction to competitors — either ignore them completely or obsess over them. Hendra deliberately positions MJP in between: monitor closely, engage selectively, partner where genuinely complementary. The doctrine prevents two failure modes: (1) missing partnership opportunities that could accelerate MJP's distribution, and (2) accidentally aiding competitors under the guise of partnership. Reza: 'Doctrine ini membuat conversation dengan klien yang juga menggunakan C2 lebih mudah — saya tidak positioning MJP sebagai anti-C2, saya positioning sebagai complement. Itu membuat klien lebih open karena mereka tidak merasa harus choose.'</p>
      </div>

      {/* R101: Competitive Intelligence Investment Budget */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> CI INVESTMENT BUDGET — Berapa MJP Investasikan untuk Competitive Intelligence: Breakdown Aktivitas, Waktu Tim yang Digunakan, dan Apakah Investasi Ini Menghasilkan Return yang Sepadan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { activity: "Weekly competitive monitoring (Hendra)", time: "90 menit/minggu = 78 jam/tahun", cost: "Estimated opportunity cost: Rp 39jt/tahun (Hendra's effective hourly rate × 78 hrs)", roi: "Prevented 2 surprise competitive moves in 2024–2025 that Hendra detected early and adjusted roadmap before launch. Estimated roadmap delay avoided: 3 months. Value: ~Rp 150jt in delayed ARR growth prevented.", tc: "text-primary" },
            { activity: "C1 feature tracking (Hendra Jr.)", time: "30 menit/bulan = 6 jam/tahun", cost: "Minimal — passive monitoring during regular platform use (Hendra Jr. is a registered C1 user under pseudonym for monitoring purposes).", roi: "Identified C1's aanwijzing calendar feature 3 months before it launched publicly — Hendra Jr. pre-built MJP's version in advance. First-mover feature reclaimed.", tc: "text-blue-700" },
            { activity: "Klien win/loss interviews (Reza)", time: "20 menit/loss × avg 3 losses/month = 12 jam/tahun", cost: "Reza's time: Rp 6jt/tahun opportunity cost. But win/loss data directly improves conversion rate.", roi: "Win/loss data led to 3 pitch deck pivots in 2025. Post-pivot conversion rate improvement: +8pp. At Reza's conversion rate, +8pp = ~Rp 180jt additional ARR per year from same prospect volume.", tc: "text-emerald-700" },
            { activity: "IjinTender and competitor pricing monitoring (automated)", time: "Fully automated via existing crawler infrastructure", cost: "Incremental compute: ~Rp 200k/month (Rp 2.4jt/year)", roi: "Competitor price data is used in IjinTender HPS panel. Enterprise klien who use this feature: 89% retention vs 67% non-users. Retention value attributable to this feature: estimated Rp 240jt ARR preserved annually.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.activity} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.activity}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Time/Cost: {r.time} · {r.cost}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>ROI: {r.roi}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">CI investment budget adalah framework yang Hendra designed untuk answer the question: 'Are we spending the right amount on CI?' The answer: yes, but mostly through human time (not money). Total monetary CI spend: ~Rp 5jt/year. Total time CI spend: ~96 hours/year from senior team. ROI dari activities yang bisa diukur: Rp 570jt+ in preserved/created ARR. Ratio: 113:1 conservative estimate. Hendra: 'CI yang dilakukan dengan cerdas adalah salah satu highest-ROI activities di MJP. Bukan karena kita takut kompetitor — tapi karena pemahaman yang tepat tentang competitive landscape adalah essential input untuk setiap product dan positioning decision yang kita buat.'</p>
      </div>

      {/* R102: Competitive Positioning Narrative by Segment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> COMPETITIVE POSITIONING NARRATIVE — Bagaimana Reza Menjawab Pertanyaan Kompetitor di Setiap Segmen: Script Aktual untuk C1 (Spesialis Tender), C2 (Konsultan), dan C3 (LPSE Internal) yang Terbukti Menghasilkan Conversion
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { scenario: "Prospek yang sudah pakai C1 (spesialis tender): 'Kami sudah punya alat tender'", reza_script: "'Bagus — C1 solid untuk notifikasi tender. Izin tanya: apakah C1 juga memberikan context tentang regulasi yang berlaku untuk tender yang kamu ikuti? Dan apakah ada Trust Score untuk BUJK yang kamu considering sebagai subkontraktor?' [Pause for response]. 'MJP melengkapi C1 untuk situasi di mana kamu perlu memahami konteks lebih dalam, bukan hanya notifikasi. Banyak klien kami menggunakan keduanya.' Conversion rate dari C1 users: 34% (vs 42% cold prospect — lower but still significant).", outcome: "Most converted C1+MJP users: use C1 for volume tender alerting, MJP for due diligence + regulatory intelligence before committing to bid preparation.", tc: "text-primary" },
            { scenario: "Prospek yang pakai konsultan (C2): 'Kami ada konsultan yang bantu'", reza_script: "'Konsultan sangat valuable — terutama untuk complex regulatory situations. MJP tidak replace konsultan tapi provides the baseline data yang biasanya konsultan charge untuk riset. Beberapa klien kami melaporkan bahwa MJP mengurangi consulting hours yang mereka butuhkan karena mereka datang ke konsultan dengan data yang lebih lengkap.' [Key: never position MJP as cheaper than consultants — position as complementary]. 'Apakah konsultan kamu juga memberikan real-time alert untuk perubahan regulasi?'", outcome: "Conversion rate dari heavy-consultant users: 28%. When converted: they use MJP as 'pre-work tool' before consulting sessions, reducing billable hours.", tc: "text-blue-700" },
            { scenario: "BUJK yang bergantung pada tim internal / LPSE langsung: 'Kami pantau sendiri'", reza_script: "'Respect — internal monitoring shows discipline. Berapa jam per minggu tim kamu habiskan untuk monitoring? [Listen]. Di MJP, 847 klien kami rata-rata menghemat 6 jam/minggu versus manual monitoring — karena kita aggregate dari 671 LPSE sekaligus, bukan hanya LPSE yang tim kamu bisa pantau. Kalau angkanya Rp 399k vs 6 jam waktu senior engineer per minggu — berapa nilai 6 jam itu?' 90% of internal-monitoring prospects underestimate their actual monitoring time cost.", outcome: "Conversion rate dari internal-monitoring prospect: 51% — highest of all segments. Self-monitoring prospects have proven willingness to invest in tender intelligence; the switch is just showing them the time math.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.scenario}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Reza: {r.reza_script}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Positioning scripts adalah Reza's living document — updated every quarter based on conversion data and new competitive dynamics. The principle behind all scripts: never position MJP as 'better than' a competitor, always position as 'needed in addition to' or 'replacing the inefficient version of.' Rationale: BUJK yang sudah invest in another solution feels defensive if you attack their choice. They feel smart if you show them how MJP extends their existing investment. One rule Reza never breaks: don't promise features MJP doesn't have. 'I have lost deals by being honest that we don't have X feature. I have never lost a client to churn because I was honest upfront.' Hendra: 'Reza's positioning maturity took 3 years to develop. Tidak bisa di-teach melalui training — harus dibangun melalui ratusan actual sales conversations.'</p>
      </div>

      {/* R103: Future Competitor Threat Modeling */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <EyeOff className="h-3.5 w-3.5 text-primary" /> FUTURE COMPETITOR THREAT MODELING — Siapa yang Paling Mungkin Menantang MJP dalam 3 Tahun ke Depan: 4 Threat Scenarios, Probabilitas, dan Pre-emptive Defense yang Sudah Hendra Bangun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { threat: "T1: LKPP membangun platform intelligence sendiri (government-built)", prob: "15% dalam 3 tahun", rationale: "LKPP punya data terlengkap (semua LPSE terintegrasi). Jika LKPP memutuskan untuk build intelligence layer on top of SIRUP, mereka would instantly have data advantage. Historical pattern: LKPP is operationally focused, not product/intelligence focused. Building analytics is not their mandate.", defense: "MJP's defense: private sector agility (ship features in days, not procurement cycles), Knowledge Registry interpretation layer (LKPP has raw data, not curated intelligence), and BUJK-centric design (LKPP serves panitia tender, not BUJK).", tc: "text-orange-700" },
            { threat: "T2: Large regional portal (C1 or C2) raises funding and expands nationally", prob: "35% dalam 3 tahun", rationale: "C1 has proven unit economics at regional scale. With Series A funding, they could expand crawler to all 671 LPSE and launch nationally. Their advantage: existing brand and distribution in their region.", defense: "MJP's defense: 2–3 year head start in national data (crawler + QA pipeline already proven), Knowledge Registry moat (C1 has zero), and IKN intelligence depth. Key: ensure MJP raises Series A before C1 — capital race.", tc: "text-red-700" },
            { threat: "T3: International SaaS player enters Indonesia (government procurement intelligence)", prob: "20% dalam 3 tahun", rationale: "International players (e.g., GovSpend, Procore analytics) have infrastructure and capital. Indonesia construction market is large enough to attract attention.", defense: "Language moat: regulatory intelligence in Indonesian, for Indonesian BUJK contexts, requires Indonesian domain experts. Sari cannot be replicated by international hiring. Local compliance requirements (UU PDP, LPJK) require local expertise. International player would need 2–3 years to build local knowledge layer.", tc: "text-blue-700" },
            { threat: "T4: Asosiasi (GAPENSI, GAPEKSINDO) membangun platform sendiri untuk anggota", prob: "25% dalam 3 tahun", rationale: "Asosiasi have member trust, member data, and existing communication channels. A WhatsApp-based tender alert service delivered by GAPENSI to their 40.000 members would be zero CAC for them.", defense: "Asosiasi platforms historically have poor UX, inconsistent updates, and no technical team. MJP's defense: partnership offer (license Knowledge Registry to asosiasi instead of competing), so they become distribution partners rather than competitors. Already in discussion with GAPENSI for pilot license.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.threat} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.threat}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.prob}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Defense: {r.defense}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Future threat model adalah Hendra's annual exercise — written for himself, not for investor decks. The rule: be honest about probability, not defensive. If a threat has {'>'} 30% probability: it deserves active mitigation, not passive hope. T2 (funded regional competitor) at 35% is the highest-probability threat. Hendra's pre-emptive mitigation: accelerate Series A timing, use capital to increase product velocity and BUJK coverage gap closure before C1 could replicate. T4 (asosiasi competitor) at 25% is being converted from threat to opportunity via the GAPENSI licensing pilot — if successful, it transforms the threat into distribution channel. Hendra: 'Saya tidak takut kompetitor. Tapi saya hormat pada mereka. Threat modeling bukan tentang paranoia — ini tentang menggunakan competitive anxiety sebagai productive planning fuel, bukan sebagai anxiety yang lumpuhkan.'</p>
      </div>

      {/* R104: Competitive Advantage Erosion Monitoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> COMPETITIVE ADVANTAGE EROSION MONITORING — Bagaimana Hendra Mengukur Apakah MJP Masih Unggul: 5 Advantage Indicators yang Dipantau Setiap Kuartal, Red Lines yang Akan Trigger Strategic Pivot
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { indicator: "AI-1: Win rate vs C1 (when both are in consideration for same prospect)", current: "63% win rate when head-to-head with C1", threshold: "RED LINE: if win rate drops below 45% for 2 consecutive quarters → fundamental value proposition gap emerging. GREEN: 60%+. YELLOW: 46–59%.", monitor: "Reza tracks every competitive sales situation: asked prospect 'are you also considering other tools?' If yes: follows up after decision for win/loss reason.", tc: "text-primary" },
            { indicator: "AI-2: Knowledge Registry comprehensiveness vs market expectation", current: "44% of estimated regulatory universe covered (1.247 of ~2.800)", threshold: "RED LINE: if klien NPS drops specifically citing 'knowledge gaps' as primary concern → coverage quality insufficient. Currently: knowledge gap cited by 8% of Pro churn. RED if > 20%. GREEN: < 10%.", monitor: "Monthly NLQ low-confidence rate (proxy for knowledge gaps). Quarterly NPS open text analysis.", tc: "text-blue-700" },
            { indicator: "AI-3: Data freshness vs LPSE publication lag", current: "2.8 hours average for Tier-1 LPSE (vs 24+ hours for manual monitoring)", threshold: "RED LINE: if MJP average freshness exceeds 6 hours for Tier-1 LPSE consistently → losing freshness advantage. Currently: no competitor tracks this metric (MJP alone monitors its own freshness performance).", monitor: "Hendra Jr.'s monthly freshness audit. If Tier-1 freshness {'>'} 5 hours for 3+ consecutive months: infrastructure investment required immediately.", tc: "text-emerald-700" },
            { indicator: "AI-4: Enterprise retention vs industry benchmark", current: "0.7% monthly churn (< 8.4% annual) vs industry benchmark 15–20% annual for comparable B2B SaaS", threshold: "RED LINE: if Enterprise monthly churn exceeds 1.5% for 2 consecutive quarters → value prop deteriorating. Currently 2x better than benchmark. Maintaining this requires continuous product depth investment for Enterprise use cases.", monitor: "Reza's quarterly EBR data. Any Enterprise non-renewal: full exit interview, root cause documented.", tc: "text-orange-700" },
            { indicator: "AI-5: Trust Score usage as due diligence replacement", current: "63% of Enterprise klien use Trust Score monthly as part of actual business decision (JO screening, subcontractor evaluation)", threshold: "RED LINE: if monthly active Trust Score users drop below 45% → feature becoming decorative rather than workflow-integrated. Green: 60%+. Usage drop often precedes churn.", monitor: "Hendra Jr.'s monthly feature usage analytics. Trust Score is the deepest workflow integration MJP has — its decline would signal commoditization risk.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.indicator} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.indicator}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.current}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Threshold: {r.threshold}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Monitor: {r.monitor}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitive advantage erosion monitoring adalah Hendra's quarterly early warning system — the equivalent of a health checkup for MJP's market position. Current status (Q2 2026): all 5 indicators green. No red flags. The discipline of monitoring these indicators quarterly prevents the common startup failure mode: competitive position eroding slowly while management is focused on growth metrics (ARR, new klien) without tracking defensive indicators. The 5 indicators were chosen specifically because they represent MJP's most defensible advantages — if these erode, no amount of marketing or sales can compensate. Hendra: 'ARR tumbuh tidak berarti kami masih menang secara kompetitif. Bisa saja kami tumbuh karena market tumbuh, bukan karena kami lebih baik. 5 indicator ini mengukur apakah kami masih menang — bukan hanya berpartisipasi.'</p>
      </div>

      {/* R105: Price War Scenario Planning */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> PRICE WAR SCENARIO PLANNING — Apa yang Hendra Akan Lakukan Jika Kompetitor Baru Masuk dengan Harga 50% Lebih Murah: 3 Skenario, Kapan Bertempur dan Kapan Mundur, serta Mengapa Harga Bukan Moat yang Bisa Dipertahankan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { scenario: "PW-S1: Kompetitor baru masuk dengan fitur mirip, harga 50% lebih murah", probability: "35% dalam 2 tahun", trigger: "Funded competitor (T2) enters market with aggressive pricing (Rp 299k/month for Pro equivalent)", hendra_response: "DO NOT match price. Instead: (1) accelerate Trust Score V5 and JO matching features that no competitor can replicate quickly, (2) create Enterprise tier pricing clarity ('MJP Enterprise at Rp 2.8jt is the intelligence layer for your business — if price is your concern, you haven't yet felt the cost of a bad JO partner decision'), (3) communicate stability: 5 years of data vs new entrant's 0.", expected_outcome: "Churn increase: Pro tier 2–5% one-time uptick as price-sensitive klien evaluate. Enterprise: minimal (0–1 churn expected). New acquisitions slow 20–30% during market confusion period. Recovery: 4–6 months once quality differential becomes apparent.", tc: "text-primary" },
            { scenario: "PW-S2: C1 (existing major competitor) cuts price 40% to pressure MJP", probability: "18% dalam 2 tahun", trigger: "C1 is funded and pivots to aggressive pricing to expand market share at the expense of profitability", hendra_response: "Monitor C1's product quality for signs of cost-cutting (data freshness decline, support degradation). If quality declines: C1's price cut is self-defeating — klien who try C1 will return. If quality is maintained: C1 is running a price war they cannot sustain without deeper pockets. MJP's response: maintain price, invest in differentiation, document quality gap publicly.", expected_outcome: "If C1 can sustain low price AND high quality: MJP faces real competition. Series A capital becomes critical to accelerate ahead. If C1 cannot sustain both: wait it out. Historical evidence: price-led competition in B2B intelligence typically fails because customers eventually realize price savings don't compensate for inferior data quality.", tc: "text-orange-700" },
            { scenario: "PW-S3: Asosiasi (GAPENSI/LPJK) launches free tool subsidized by dues", probability: "20% dalam 3 tahun", trigger: "Industry association launches a free procurement monitoring tool for members, directly competing with MJP's core features", hendra_response: "This is the one scenario where price competition cannot be won. If a free association tool launches: pivot strategy immediately. (1) Position MJP as 'advanced intelligence layer' beyond association tool's basic monitoring, (2) offer integration between MJP and association tools ('MJP Pro: takes what your association gives you and makes it 10x more actionable'), (3) explore partnership instead of competition — offer MJP data to fuel association tool in exchange for member access.", expected_outcome: "Scenario PW-S3 is why MJP is pursuing GAPENSI licensing pilot proactively — converting the threat to partnership before it materializes. Currently 25% probability; drops to 5% if GAPENSI licensing relationship established.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.scenario}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.probability}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Trigger: {r.trigger}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Hendra's response: {r.hendra_response}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Expected outcome: {r.expected_outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Price war scenario planning adalah Hendra's discipline of thinking through his response to competitive pricing pressure BEFORE it happens — so that in the moment, he's executing a prepared strategy rather than reacting emotionally. The consistent theme across all 3 scenarios: Hendra will not initiate a price war, will not match a competitor's price cut, and will not sacrifice margin to fight price competition. His reasoning: 'If we win a client because we're cheaper, we'll lose them the moment someone is cheaper than us. If we win because our intelligence is better, we keep them as long as our intelligence stays better. Retensi berbasis value adalah satu-satunya retention yang sustainable.' The one exception: if MJP's price is actively preventing trial (qualified prospects saying 'we'd like to try but the price is a barrier'), then price needs examination. Currently: Hendra Jr.'s data shows 94% of churned Pro klien cited reasons other than price. Price is not the current barrier.</p>
      </div>

      {/* R106: Competitor Product Reverse Engineering Log */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> COMPETITOR PRODUCT REVERSE ENGINEERING — Hendra Jr. Mendaftar dan Menggunakan Produk Kompetitor Setiap 6 Bulan: Apa yang C1 Lakukan Lebih Baik dari MJP, Apa yang MJP Lakukan Lebih Baik, dan Kapan Kita Harus Takut
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { area: "RE-1: C1 UI/UX vs MJP UI/UX", c1_better: "C1's onboarding flow is significantly smoother: 3-step setup vs MJP's current 6-step. C1's mobile web experience is better-optimized. C1's search interface for tenders has better auto-complete. These are observable, real differences.", mjp_better: "MJP's depth of information per tender (HPS estimation, competitor context, KBLI analysis) is substantially deeper than C1. C1 shows tender listings; MJP shows tender intelligence. UI polish vs intelligence depth.", action: "Hendra Jr. has C1's onboarding flow documented as a UX reference. MJP's onboarding improvement is in Q3 2026 roadmap. Not copying — understanding where the bar is.", tc: "text-primary" },
            { area: "RE-2: C1 data coverage vs MJP data coverage", c1_better: "C1 appears to have broader LPSE coverage in eastern Indonesia (Sulawesi, Maluku, Papua) — possibly due to different infrastructure investment priorities. Their detractor NPS comments mention better coverage in these regions.", mjp_better: "MJP's Tier-1 LPSE freshness is measurably faster (2.8h vs estimated 8–12h for C1 based on testing). MJP's Trust Score has no C1 equivalent — they have basic BUJK profiles but no scoring system.", action: "Eastern Indonesia coverage gap is real. DR-1 (BNSP API) won't fix it. Need Tier-3 LPSE infrastructure investment specifically for eastern Indonesia — planned Q4 2026.", tc: "text-blue-700" },
            { area: "RE-3: C1 pricing and packaging vs MJP", c1_better: "C1 offers a 'trial' tier (14-day full access, no credit card). MJP currently has no trial. C1's team plan pricing is clearer — MJP's multi-user pricing requires a conversation with Reza.", mjp_better: "MJP's Enterprise tier value is higher-differentiated than C1's. At comparable price points: MJP offers Trust Score, NLQ, PDF briefing — features C1 doesn't have. Pro-tier comparison: roughly equivalent at similar price.", action: "Self-serve trial (14-day, limited features): under evaluation. Concern: trial without guidance → users don't discover deep features → convert at lower rate than Reza-guided demos. Decision pending.", tc: "text-emerald-700" },
            { area: "RE-4: The feature C1 has that Hendra Jr. is most worried about", c1_better: "C1 recently launched 'Tender Calendar' — a visual calendar view of tender deadlines including aanwijzing, clarification, and submission dates, synced to Google Calendar. MJP doesn't have this. It's P-UNR-3 from the backlog (RICE 190). C1 shipped it first.", mjp_better: "MJP's version when built: will integrate with Trust Score and competitor context per tender in the calendar view — deeper integration than C1's calendar. But C1 has it now; MJP doesn't.", action: "P-UNR-3 accelerated to Q3 2026 as a result of C1 shipping it. Hendra: 'Kami tidak panic ketika kompetitor ship fitur yang ada di backlog kami. Tapi kami accelerate timeline-nya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.area} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.area}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">C1 better: {r.c1_better}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">MJP better: {r.mjp_better}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Action: {r.action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitor reverse engineering adalah Hendra Jr.'s most uncomfortable but most valuable habit. Most founders avoid using competitor products because it's psychologically difficult to admit the competitor does something better. Hendra Jr.'s rule: 'Jika kompetitor melakukan sesuatu lebih baik dari kami dan kami tidak tahu, itu lebih berbahaya dari jika kami tahu.' The RE process: every 6 months, Hendra Jr. registers for C1 with a real email, goes through onboarding, uses it daily for 2 weeks, and produces a comparison document. Findings are shared with the team in a monthly review. The 4 RE findings above are the honest assessment from the most recent cycle (Q1 2026). Where C1 is better: acknowledge and address. Where MJP is better: understand why and protect. The RE-4 finding (Tender Calendar) led to the fastest backlog item acceleration MJP has ever done. Hendra: 'Reverse engineering kompetitor bukan tentang copying. Ini tentang maintaining a calibrated view of where kami dalam kompetisi ini. Tanpa itu, kami bisa confident secara palsu tentang keunggulan yang sudah tidak ada lagi.'</p>
      </div>

      {/* R107: The 5 BUJK Types Who Churn and Why */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-primary" /> CHURN ARCHEOLOGY — 5 Profil BUJK yang Paling Sering Churn, Apa yang Mereka Katakan vs Apa yang Data Ungkapkan, dan Bagaimana MJP Menggunakan Insight Ini untuk Memvalidasi yang Berpotensi Churn Lebih Awal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { profile: "CHURN-1: The Trialist — sign up, use once, never return", prevalence: "23% of all churn by count (but only 4% of churned ARR — these are Starter tier)", pattern: "Signed up after hearing from friend. Opened app 1–3 times. Never configured alert preferences. Never searched Trust Score. Never used NLQ. Subscription auto-renewed once, then cancelled. Exit survey: 'Tidak sesuai ekspektasi.'", root_cause: "Onboarding failure: klien never reached the 'aha moment.' MJP's aha moment: seeing a tender alert that's actually relevant to their KBLI, OR getting a Trust Score hit on a contractor they just met. Neither happened because onboarding didn't guide them there.", fix: "P-UNR-2 equivalent for onboarding: guided setup that extracts KBLI, region, and one contractor name to search. Goal: ensure every new klien hits aha moment within first session.", tc: "text-muted-foreground" },
            { profile: "CHURN-2: The Downsizer — Pro tier to Starter after price increase", prevalence: "18% of all churn (12% of churned ARR)", pattern: "Active Pro klien. Price increase notice received. Downgraded to Starter, then churned 3 months later (Starter features insufficient). Exit survey: 'Harga terlalu mahal.' BUT: usage data shows they used 2–3 Pro features regularly before downgrade.", root_cause: "Price sensitivity combined with insufficient value demonstration for Pro-tier features. These klien used Pro but didn't feel the value distinctly. The price increase made them re-evaluate — and without a strong value anchor, they chose to downgrade.", fix: "Proactive value demonstration before price increases: Reza reaches out to all Pro klien 60 days before a price change with a personalized 'your MJP usage in numbers' summary.", tc: "text-orange-700" },
            { profile: "CHURN-3: The Seasonal — active during tender season, inactive off-season", prevalence: "21% of all churn (17% of churned ARR — mostly Pro and Starter)", pattern: "High activity Q1–Q2 (peak tender season). Minimal activity Q3 (fasting month + school holiday project slowdown). Churns Q3. Returns as new signup Q4. MJP has identified 43 klien who have churned and re-subscribed at least once.", root_cause: "Value not continuous — when klien doesn't actively need tender intelligence, subscription feels like dead weight. MJP's value in off-season: regulatory monitoring, SKK planning, competitor intelligence. But these are less emotionally salient than 'I just found a tender.'", fix: "Off-season value push: 3-email series during low-activity periods highlighting non-tender features. SKK expiry alerts during July–August are the highest-impact off-season touchpoint.", tc: "text-blue-700" },
            { profile: "CHURN-4: The Disappointed — had a 'bad data' experience and lost trust", prevalence: "9% of all churn (21% of churned ARR — concentrated in Enterprise and Pro Atas)", pattern: "Previously highly engaged. One incident: Trust Score showed a BUJK as safe, but klien had a bad experience with that BUJK post-partnership. OR: NLQ gave incorrect regulatory guidance, klien relied on it. Exit survey: 'Data tidak akurat / tidak bisa dipercaya.'", root_cause: "A single trust violation can undo months of positive experience. The DATA Bill of Rights violations (DBoR) — when they occur with high-stakes klien — produce this profile.", fix: "Post-incident retention protocol: when Hendra learns of a Trust Score or NLQ failure that affected a klien's real decision, he calls personally within 48 hours. Post-incident engagement: 71% of CHURN-4 cases that received personal outreach were retained.", tc: "text-red-700" },
            { profile: "CHURN-5: The Geographic Orphan — klien outside Java whose coverage was insufficient", prevalence: "29% of all churn by count (46% of churned ARR from non-Java segments)", pattern: "Active in first month (general features work). Starts searching for local tenders and BUJK: data sparse or absent. NLQ questions about local regulations: low confidence. Trust Score lookups for local contractors: Tier C or D profiles. Gradual disengagement over 2–3 months. Exit survey: 'Data di daerah saya sangat kurang.'", root_cause: "This is the coverage gap (contractors page analysis, Tier A: 16% nationally, likely {'<'} 5% in eastern Indonesia). Not a product failure — a data infrastructure limitation.", fix: "Short-term: transparent 'Regional Coverage Map' showing klien their region's data depth BEFORE they subscribe. Long-term: Tier-3 LPSE investment Q4 2026.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.profile} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.profile}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.prevalence}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pattern: {r.pattern}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Root cause: {r.root_cause}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Fix: {r.fix}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Churn archeology adalah the practice of analyzing churned klien not as a loss statistic but as a diagnostic tool. The 5 profiles reveal 5 different failure modes — onboarding, pricing, seasonality, trust, and geography. Each requires a different fix. The critical insight: Churn-5 (Geographic Orphan, 29% by count, 46% of churned ARR) is the largest churn driver by ARR impact, and it's also the hardest to fix quickly — it requires data infrastructure investment, not product iteration. But Churn-1 (Trialist, 23% by count, 4% of ARR) is the easiest to fix — better onboarding would prevent most of it. Hendra's prioritization: fix Churn-1 first (highest count, easiest fix), invest in Churn-5 infrastructure over 18 months (largest ARR impact, requires sustained effort). CHURN-4 (Disappointed) is the most dangerous per individual: a high-value Enterprise klien who churns after a trust violation often doesn't just leave — they tell others. Post-incident protocol for CHURN-4 prevention is Hendra's personal responsibility. Hendra: 'Setiap churned klien adalah laporan audit yang jujur tentang di mana kami gagal. Yang paling susah dibaca adalah yang paling penting untuk dipahami.'</p>
      </div>

      {/* R108: The Moat That Cannot Be Copied */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> THE MOAT THAT CANNOT BE COPIED — 4 Dimensi Keunggulan Kompetitif MJP yang Butuh Bertahun-tahun untuk Dibangun dan Tidak Bisa Ditiru Hanya dengan Modal atau Teknologi Baru
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { moat: "MOAT-1: Data flywheel — setiap klien baru membuat produk lebih baik untuk semua klien", mechanism: "MJP's intelligence improves with use: more klien → more behavioral signals (which tenders they pursue, which Trust Scores they use, which NLQ questions they ask) → better personalization, better HPS calibration, better Trust Score weighting. At 847 klien: the flywheel has 5 years of signal data. A new entrant starting today: starts with zero behavioral data. To match MJP's signal depth at current growth rate: 5+ years at minimum.", replication_barrier: "This is not replicable with capital: no amount of funding can buy 5 years of usage signals. The only way to close the gap is to get the users first — which requires first winning against MJP's current product quality, which is already ahead because of the flywheel.", tc: "text-primary" },
            { moat: "MOAT-2: Sari's 8-year regulatory network — relationships that took years to build", mechanism: "Sari's working group participation (LKPP, BNSP, PUPR), her 67 formal industry contacts, her credibility as the author of 847+ Knowledge Registry assets — these relationships give MJP early access to regulatory changes 2–4 months before formal publication. A new entrant: can hire a regulatory expert, but cannot inherit Sari's relationships. Sari's insight quality is a function of who trusts her enough to share pre-publication context.", replication_barrier: "Relationship depth is purely time-denominated. Capital can hire a regulatory expert; it cannot buy 8 years of progressive trust-building with Indonesian government procurement officials.", tc: "text-blue-700" },
            { moat: "MOAT-3: Budi's 67-narasumber network — construction ground truth no database provides", mechanism: "Budi's field research network of 67 active narasumber across 12 provinces represents construction market ground truth that is accessible nowhere else. LPSE data shows what contracts were awarded; Budi's network reveals why they were awarded, how the relationships work on the ground, and what the emerging problems are before they become visible in data. This is the signal layer beneath the data layer.", replication_barrier: "Field research networks are, like regulatory networks, purely time-denominated. A well-funded competitor can hire 10 field researchers today; they cannot inherit 67 relationships built over 4 years of genuine engagement. And most of those relationships were built one visit at a time.", tc: "text-emerald-700" },
            { moat: "MOAT-4: 671 LPSE portal architecture — years of hardening against authentication changes", mechanism: "Hendra Jr.'s crawler infrastructure covers 671 LPSE portals — each with its own authentication mechanism, update schedule, and quirks. Over 5 years: the infrastructure has been tested and hardened against 340+ authentication changes across these portals. The current system fails gracefully, recovers automatically, and alerts before data gaps affect klien. A new entrant building this infrastructure today: faces 5 years of identical hardening — except they have none of MJP's institutional knowledge about which portals break in which ways.", replication_barrier: "Operational knowledge of 671 government portals is unteachable without living it. Hendra Jr. can document the patterns, but each new portal failure type requires new adaptive logic. The 5-year head start in LPSE-specific institutional knowledge is a durable advantage even against well-funded competition.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.moat} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.moat}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Mechanism: {r.mechanism}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Replication barrier: {r.replication_barrier}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The moat analysis adalah the document Hendra prepares for the most sophisticated investor question: 'What prevents a well-funded startup or an existing company (LPSE itself, LKPP, a large BUJK's corporate venture) from building what you've built?' The honest answer: all 4 moats are time-based, not technology-based. A well-funded competitor can build the technology. They cannot buy the time needed to build the data flywheel, the regulatory network, the field research relationships, or the LPSE institutional knowledge. The most dangerous competitive threat is not a startup — it's a government agency (LKPP or PUPR) deciding to provide the same intelligence as a public service. This would eliminate most of MJP's regulatory intelligence moat overnight. Hendra's response to this threat: the Mitra Pengadaan LKPP application is partly strategic — if LKPP becomes a partner rather than a competitor, the government-displacement risk is converted into a government-validation advantage. The second most dangerous threat: a large BUJK conglomerate (e.g., Wika, Pembangunan Perumahan) deciding to build this for themselves and then license to smaller BUJK. This would convert a potential large competitor into a large distribution partner — or a direct competitive threat with deep pockets and existing BUJK relationships. Hendra: 'Parit terbaik kami bukan teknologi — ini waktu. Dan waktu yang diinvestasikan dalam membangun kepercayaan, baik dengan regulator maupun dengan narasumber, tidak bisa dibeli. Itu yang membuat kami aman dari peniru yang funded.'</p>
      </div>

      {/* R109: Competitive Threats MJP Monitors Weekly */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> COMPETITIVE THREAT RADAR — 5 Jenis Ancaman Kompetitif yang Hendra Jr. Pantau Setiap Minggu: Bukan Hanya Kompetitor Langsung, Tapi Juga Ancaman Struktural yang Bisa Mengubah Pasar Secara Fundamental
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { threat: "THREAT-1: C1 (KonstruksiPro) — kompetitor langsung paling aktif", monitoring_method: "Hendra Jr.'s bi-weekly RE (reverse engineering) review. Reza's conversation intelligence: every prospect call where C1 is mentioned — Reza documents the specific feature the prospect cited. Monthly win/loss analysis: of deals lost to C1 vs won over C1.", current_status: "C1 is gaining ground in UI/UX (onboarding quality) but losing ground in data depth (Trust Score equivalent quality). Net competitive position: MJP holds advantage in Enterprise and is approximately equal in Pro. Hendra Jr.'s RE priority list: Tender Calendar (C1 ahead — backlog acceleration confirmed).", tc: "text-primary" },
            { threat: "THREAT-2: LKPP self-service intelligence — government becoming its own analyst", monitoring_method: "Sari's working group intelligence: tracks LKPP's internal data portal roadmap discussions. Hendra's government stakeholder conversations. LKPP public announcements about data accessibility initiatives.", current_status: "LKPP's 'eProcurement analytics' initiative exists but remains administrator-focused (procurement committees, not BUJK). BUJK-facing intelligence from LKPP: minimal quality, no SKK integration, no Trust Score equivalent. Risk level: LOW for 2 years, MEDIUM for 3–5 years (if LKPP decides to serve BUJK directly). Mitigation: Mitra Pengadaan partnership converts this threat into a collaboration.", tc: "text-blue-700" },
            { threat: "THREAT-3: Large BUJK conglomerate building internal tools and licensing them", monitoring_method: "Industry news monitoring. Reza's conversations with BUJK association leadership. Hendra's GAPENSI/INKINDO network. Any procurement of data analytics vendors by large BUJK reported in industry press.", current_status: "Wika Gedung and Hutama Karya have internal analytics teams — confirmed via public LinkedIn. But internal tools typically serve only the building company's procurement teams, not licensed externally. No evidence of licensing intent. Risk level: LOW currently, but the scenario that would be hardest to defend against.", tc: "text-emerald-700" },
            { threat: "THREAT-4: International construction tech platform expanding to Indonesia", monitoring_method: "Global construction tech news (Procore, Autodesk Construction, Oracle Construction expansion news). APAC market entry announcements. Indonesian tech media coverage of foreign platform launches.", current_status: "Procore has Indonesia presence (enterprise construction management) but is focused on project management, not procurement intelligence — different category. No global platform has Indonesia-specific procurement intelligence (LPSE, BNSP, local KBLI). Entry barrier: Indonesia LPSE system is unique globally — no global platform can enter without building from scratch what MJP has spent 5 years building. Risk level: LOW to MEDIUM over 5 years.", tc: "text-orange-700" },
            { threat: "THREAT-5: Bank atau asuransi membangun procurement intelligence untuk portofolio klien mereka", monitoring_method: "Financial services industry news. Bank Mandiri, BRI, BNI construction sector analytics developments. Insurance sector construction risk analytics trends.", current_status: "This is the 'PE-2 goes in-house' scenario: a bank that currently uses MJP's Trust Score as an input to its construction credit risk model decides to build the equivalent internally. Risk would materialize if any of MJP's financial services pilots (PE-2 context) becomes commercially significant enough that the bank's build-vs-buy calculus shifts. Current risk: LOW — building MJP's data depth in-house would cost significantly more than licensing from MJP.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.threat} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.threat}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Monitoring: {r.monitoring_method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Current status: {r.current_status}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitive threat radar adalah Hendra's weekly discipline — 30 minutes every Monday reviewing any developments in the 5 threat categories above. The discipline matters because competitive threats rarely announce themselves: C1's onboarding improvement was visible 3 months before its impact appeared in win/loss data. LKPP's analytics initiative was visible 18 months before it became relevant to MJP's sales conversations. The weekly review ensures MJP is responding to signals, not reacting to outcomes. The 5 threat types span 3 different time horizons: THREAT-1 (C1) is weekly-relevant, THREAT-2 and 3 are quarterly-relevant, THREAT-4 and 5 are annual-relevant. Different monitoring cadences for different time horizons: Hendra tracks THREAT-1 weekly, THREAT-2 and 3 monthly, THREAT-4 and 5 quarterly. The competitive intelligence is shared with the full team monthly (as part of Tuesday sync). Reza and Hendra Jr. both contribute: Reza from sales conversations, Hendra Jr. from product usage. Sari contributes working group intelligence. The integrated view is MJP's competitive intelligence picture — no single person has all the information, but together: the team has a 360° view of the competitive landscape. Hendra: 'Ancaman kompetitif terbesar bukanlah yang paling terlihat — itu yang paling lambat datang. C1 mudah untuk dipantau. LKPP yang memutuskan untuk melayani BUJK langsung: itu akan datang perlahan, lalu sekaligus. Pemantauan mingguan adalah cara kami tidak terkejut oleh yang perlahan itu.'</p>
      </div>

      {/* R110: How C1 Reverse Engineering Works */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ScanSearch className="h-3.5 w-3.5 text-primary" /> C1 REVERSE ENGINEERING — Bagaimana Hendra Jr. Membedah KonstruksiPro Setiap Bulan: Proses RE yang Terstruktur, Apa yang Dicari, dan 3 Temuan yang Secara Langsung Mengubah MJP's Roadmap
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "Phase 1: Interface audit — what C1 changed in the last 30 days", method: "Hendra Jr. maintains an active C1 test account (paid Pro tier subscription). Monthly: systematic walkthrough of every C1 page comparing current state to last month's screenshots. Hendra Jr. uses a structured checklist: navigation changes, new features (any item present this month that wasn't present last month), removed features (anything missing this month), UI/UX improvements (layout, interaction patterns, label clarity). Time invested: 3–4 hours per month.", what_looks_for: "Primary focus: features that address the same use cases MJP addresses. If C1 ships a new feature in MJP's product category: Hendra Jr. asks '(1) is this on our backlog? (2) if not, why not? (3) if yes, does C1's approach inform our implementation?' Secondary focus: onboarding improvements — C1 has historically had better onboarding quality than MJP.", tc: "text-primary" },
            { phase: "Phase 2: Data quality comparison — what C1's LPSE data looks like vs MJP's", method: "For 20 standardized test tenders (same tenders each month, from different provinces and KBLI categories): Hendra Jr. compares C1's data for these tenders against MJP's. Dimensions: publication timeliness (when did each platform show the tender?), field completeness (how many data fields populated?), HPS data accuracy (if C1 shows HPS: how does it compare to actual HPS from official LPSE document?), Trust Score equivalent accuracy (does C1's contractor score match Hendra Jr.'s trust score expectation based on BNSP + LPSE data?). Monthly finding documented in Competitive Intelligence Log.", what_looks_for: "Any systematic gap where C1 has better data quality than MJP (flag for investigation: is this a crawling gap, a normalization gap, or a source gap?) OR any systematic gap where MJP has better data quality than C1 (flag for marketing: this is a differentiator to emphasize in Reza's sales conversations).", tc: "text-blue-700" },
            { phase: "Phase 3: Sales conversation intelligence — what prospects say about C1 vs MJP", method: "Reza documents every prospect conversation where C1 is mentioned using a structured template: what specific feature or capability did the prospect cite? Was the prospect currently using C1 (comparison context) or had they evaluated C1 and chosen not to use it (rejection context)? What was the outcome of the deal (MJP win, MJP loss, no decision)?", what_looks_for: "Pattern analysis: if 3+ prospects in the same tier mention the same C1 feature: it's a signal, not noise. Hendra Jr. receives the pattern analysis monthly, cross-references with his interface audit (is the feature C1 prospects mention aligned with what he sees in C1's UI?), and produces a 'competitive vulnerability assessment' for that quarter.", tc: "text-emerald-700" },
            { phase: "3 findings that directly changed MJP's roadmap", finding_1: "RE Finding 2023-Q3: C1 had built a 'Tender Calendar' view (upcoming aanwijzing dates for saved tenders). MJP had this on the backlog but low priority. After RE finding: moved to high priority. Built within 6 weeks. Post-launch feedback: Enterprise klien cited Tender Calendar as top-3 most-used feature.", finding_2: "RE Finding 2024-Q1: C1's onboarding checklist (step-by-step guide for new users) had significantly reduced their early-churn rate (estimated from NPS improvement visible in App Store reviews). MJP had no structured onboarding. Result: Hendra built MJP's first onboarding checklist (5-step guided setup). Estimated impact: Starter 30-day retention improved from 47% to 63%.", finding_3: "RE Finding 2024-Q4: C1 had launched 'BUJK Health Score' — their Trust Score equivalent. Initial quality: poor (based on data comparison audit: C1's score inconsistently matched BNSP records). Decision: do not accelerate Trust Score marketing specifically to contrast with C1's poor-quality equivalent. Instead: publish a Trust Score methodology document explaining MJP's BNSP verification approach. Let quality difference speak for itself.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.method || r.finding_1 || ''}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.what_looks_for || (r.finding_2 ? `Finding 2: ${r.finding_2}` : '') || ''}</p>
              {r.finding_3 && <p className={`text-[7px] font-mono mt-0.5 ${r.tc}`}>Finding 3: {r.finding_3}</p>}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">C1 reverse engineering adalah one of Hendra Jr.'s most operationally valuable monthly activities — because it converts competitor observation into actionable product decisions. The 3-phase structure (interface audit + data quality comparison + sales intelligence) provides three different views of the competitive landscape that together are more complete than any single view alone. The interface audit catches C1 feature changes; the data comparison catches C1 quality changes; the sales intelligence catches what prospects actually care about in the C1 vs MJP decision. The 3 roadmap-changing findings are the clearest evidence that RE produces value: Tender Calendar (built after RE finding, became top-3 feature), Onboarding Checklist (built after RE finding, improved 30-day retention by 16 percentage points), Trust Score positioning (shaped by RE finding about C1's poor-quality equivalent). Hendra Jr.'s principle: RE is observation, not imitation. 'Saya melihat apa yang C1 bangun bukan untuk menyalin mereka — tapi untuk memahami di mana pasar sedang bergerak, di mana C1 membuat keputusan yang bagus yang kami belum buat, dan di mana C1 membuat keputusan yang buruk yang perlu kami hindari.' The methodology documentation is shared with Hendra annually: not for daily reference but to ensure that if Hendra Jr. left MJP, the RE practice could be continued by a successor. Hendra Jr.: 'Saya tidak pernah takut melihat apa yang C1 bangun. Saya takut pada hari saya berhenti melihat — karena itu berarti saya tidak lagi menganggap mereka serius.'</p>
      </div>

      {/* R111: Win/Loss Debrief System */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WIN/LOSS DEBRIEF SYSTEM — Bagaimana MJP Mengubah Setiap Deal yang Kalah Menjadi Perbaikan Produk atau Penjualan: Metodologi Reza untuk Belajar dari Keputusan Prospek
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "WL-1: Wins — Apa yang memutuskan prospek untuk pilih MJP vs C1?", pattern: "Reza's Win debriefs (conducted for every deal above Rp 12jt ARR): structured 15-minute call 2 weeks after onboarding. Question framework: (1) What was the specific moment you decided MJP was the right choice? (2) What was the most important information you checked that you couldn't get from C1? (3) What would have made you cancel the trial before subscribing? Win debrief frequency: 60% of wins result in a debrief (the other 40% were too small or prospek was time-constrained). Sample size Q1 2025 – Q2 2026: 41 Win debriefs.", insight: "Win pattern: 71% of wins trace to a specific 'proof moment' during trial — a NLQ query that returned accurate results the prospek had independently verified, a Trust Score that matched their own knowledge of a specific BUJK, or a tender alert that appeared before the prospek's manual check. The proof moment is not planned — Reza cannot create it artificially. MJP's best closing tool: giving prospects enough trial time to find their own proof moment. Reza's trial guidance: 'Coba Trust Score untuk mitra BUJK yang sudah Anda kenal — seseorang yang Anda sudah tahu rekam jejaknya. Kalau hasilnya sesuai dengan pengetahuan Anda, Anda sudah menemukan jawaban apakah platform ini bisa dipercaya.'", tc: "text-emerald-700" },
            { category: "WL-2: Losses to C1 — Mengapa prospek pilih C1 meski MJP memenangkan product comparison?", pattern: "Loss to C1 debriefs: harder to conduct — most prospek who chose C1 don't want to explain why. Reza's approach: send a 3-question email 30 days after the decision, positioning it as 'product research, not a sales call.' Response rate: 31%. Of those who respond: 62% cite price, 28% cite perceived brand safety ('C1 is bigger, less risk'), 10% cite feature they needed specifically.", insight: "The brand safety objection: Reza's hardest to overcome. 'C1 adalah platform yang lebih besar' — prospek perceive C1 as lower-risk because of scale. Reza's counter-argument (for prospects who respond): 'C1 is a larger platform but not a more accurate one — here are 3 BUJK trust scores from C1 vs MJP where the data diverges, with the LPSE source that resolves which is correct.' The data comparison counter: converted 3 of the last 7 brand-safety losses into re-engagement calls. Hendra's take: 'Kehilangan deal karena harga: kita bisa adjust. Kehilangan deal karena brand safety: kita perlu lebih banyak enterprise references.'", tc: "text-red-700" },
            { category: "WL-3: Losses to Inaction — Prospek yang tidak pilih siapapun", pattern: "Inaction losses: prospects who trial MJP, don't convert, and continue with no subscription. Reza's inaction debrief: 2-question email at day 30 post-trial. Response rate: 19%. Most common reason: 'Belum siap — akan coba lagi nanti.' Reza's classification: inaction losses are not closed — they're deferred. He maintains a 'reactivation list' of 73 inaction leads with scheduled re-contact dates.", insight: "Inaction pattern analysis: 67% of inaction losses come from BUJK in the 2–5 miliar ARV range — mid-size BUJK who have enough complexity to benefit from MJP but are still managing procurement with a combination of spreadsheets and WhatsApp groups. This segment: highest inaction rate AND highest conversion potential when re-engaged 6 months later (when they've grown into the pain more). Reza's reactivation message: not a new demo — a specific tender that matches their profile that they would have seen 4 weeks earlier if they were MJP subscribers.", tc: "text-orange-700" },
            { category: "WL-4: Product Roadmap Signals from Loss Patterns", pattern: "Every loss debrief produces a product signal: a feature, data quality issue, or UX gap that influenced the decision. Reza maintains a Loss Signal backlog that feeds directly into Hendra's product decision review. Product changes traceable to loss signals (past 18 months): Onboarding Checklist redesign (14 loss signals mentioned confused first-session), Pengadaan Langsung coverage roadmap addition (11 loss signals mentioned below-threshold procurement), Regional LPSE portal prioritization (8 loss signals mentioned specific provinces with low coverage).", insight: "Reza's role in product: Reza is the closest person to the market — he hears what prospects decide and why. Product decisions that ignore Reza's signal backlog: miss the gap between what features MJP has built and what the market actually needs to make a purchase decision. Hendra's rule: 'Reza's loss signal backlog adalah product roadmap input yang paling tidak terfalsifikasi yang kita punya. Setiap item: seseorang yang berinteraksi dengan platform dan memilih untuk tidak membayar karena alasan spesifik yang mereka komunikasikan.'", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Pattern: {r.pattern}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Insight: {r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Win/Loss debrief system adalah Reza's most important self-improvement tool — and MJP's most underutilized product research channel. The 41 Win debriefs and estimated 60 Loss debriefs conducted in the past 18 months: a corpus of first-hand qualitative data about why BUJK make the subscription decisions they make. The data quality: higher than any survey MJP could commission, because it comes from real decision-makers reflecting on real decisions they just made. The most actionable finding from the aggregate analysis: MJP's most powerful sales tool is time — specifically, giving prospects enough time in trial to encounter a genuine proof moment. Shortening the trial (to reduce sales cycle) reduces proof moment probability and reduces conversion. Reza's trial optimization insight: 14-day trials with daily check-in calls: 22% conversion. 21-day trials with a single guided proof-moment session at day 7: 38% conversion. The proof-moment session (guided NLQ query for a tender the prospect is actively pursuing): the single highest-ROI sales activity Reza performs. Reza: 'Saya tidak menjual — saya membantu prospek menemukan bukti sendiri. Kalau mereka menemukan buktinya, saya tidak perlu menjual. Kalau mereka tidak menemukan buktinya dalam 21 hari: produk belum cukup baik untuk mereka, atau mereka belum cukup siap.'</p>
      </div>

      {/* R112: MJP Market Share Estimation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> ESTIMASI MARKET SHARE MJP — Bagaimana Hendra Menghitung Posisi MJP vs C1 dan Kompetitor Lain: Metodologi, Ketidakpastian, dan Apa yang Angka Itu Sebenarnya Ukur
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { segment: "SHARE-1: Universe sizing — berapa total BUJK yang berpotensi jadi subscriber MJP", methodology: "Hendra's TAM calculation: BNSP's registry shows 37.400 BUJK with active SKK certification (as of Q1 2026). Subset with annual tender activity above Rp 500jt: approximately 22.000 (estimated from LPSE award frequency analysis). Subset with digital tool adoption likelihood (proxy: has registered LPSE portal account AND has completed at least 3 digital tenders): approximately 12.400 BUJK. This 12.400 is MJP's serviceable addressable market (SAM) — the universe Hendra uses for market share calculation.", uncertainty: "Key uncertainty: the 12.400 SAM estimate is derived from proxy indicators, not direct survey. Hendra's confidence interval: 10.000–15.000 BUJK. The lower bound is based on conservative digital adoption assumptions; the upper bound assumes all BUJK with LPSE accounts are digitally ready. For investor presentations: Hendra uses 12.000 as the round-number SAM.", tc: "text-primary" },
            { segment: "SHARE-2: MJP's current share — 847 of 12.400 = 6.8%", methodology: "MJP's market share: 847 active subscribers / 12.400 SAM = 6.8%. Revenue market share (not subscriber share): if C1 has approximately 1.100 subscribers (Hendra's RE estimate) at blended average revenue Rp 1.2jt/month (C1's pricing) = approximately Rp 1.32B ARR. MJP's Rp 2.1B ARR vs C1's Rp 1.32B ARR = MJP has approximately 61% revenue share of the digitized BUJK intelligence market. Hendra's framing: 'Kita adalah pemimpin revenue di pasar ini meskipun bukan pemimpin subscriber. MJP klien membayar lebih karena mereka mendapat lebih.'", uncertainty: "C1 subscriber count is estimated (not publicly disclosed). Hendra Jr.'s RE methodology for estimating: LinkedIn employee count trends, LPSE portal coverage announcements, pricing page analysis, and 3 ex-C1 prospect debriefs who mentioned their klien base size. Hendra's confidence interval on C1 subscriber count: 900–1.400 BUJK. MJP's revenue leadership: holds across the entire range of this uncertainty.", tc: "text-emerald-700" },
            { segment: "SHARE-3: Competitive share of BUJK who evaluated both platforms", methodology: "The most directly observable competitive data: BUJK who explicitly compared MJP and C1 before deciding. Reza tracks these 'competitive deals' — prospects who mentioned C1 by name during their trial. Past 18 months: 87 competitive deals (prospects who evaluated both). MJP win rate in competitive deals: 68% (59 wins, 28 losses). C1's win rate in competitive deals where MJP also competed: 32%. This is the most reliable competitive share data — it's based on actual decisions in documented competitive situations, not estimates.", uncertainty: "Selection bias: BUJK who evaluate both platforms are self-selected — they're typically more sophisticated and have higher evaluation standards. MJP's 68% competitive win rate may be higher than MJP's win rate against C1 in deals where the prospect didn't explicitly compare (because less-sophisticated BUJK might default to whichever they heard of first, which could favor either platform depending on referral network).", tc: "text-blue-700" },
            { segment: "SHARE-4: Growth trajectory — MJP vs C1 vs market expansion", methodology: "Annual growth rates (Hendra's estimates): MJP subscriber growth: +38% YoY (from 613 to 847 in past 12 months). C1 subscriber growth: estimated +15% YoY based on Hendra Jr.'s headcount analysis. Total SAM digital adoption growth: +22% YoY (more BUJK adopting digital tools — market expansion, not just share shift). At current growth trajectories: MJP reaches 1.500 subscribers by Q4 2027 (20% market share). This assumes C1 continues at +15% and MJP continues at +35% (slightly below current rate as market matures).", uncertainty: "The market growth estimate (+22% YoY SAM expansion) is the highest-uncertainty figure. It's based on LPSE portal registration growth statistics and Budi's field research perception of digital adoption rates among his narasumber network. If market adoption accelerates (e.g. due to Q2 2027 policy changes): MJP's growth rate could accelerate further. If market adoption plateaus: both MJP and C1 are competing for a fixed pool. The Q2 2027 policy change thesis is the key variable for the bull case.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.segment} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.segment}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Methodology: {r.methodology}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Uncertainty: {r.uncertainty}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Market share estimation adalah Hendra's most epistemically honest investor conversation — because he leads with the methodology and uncertainty before the conclusions. The 6.8% subscriber share and 61% revenue share estimates are not precise measurements — they're structured estimates built on verifiable inputs with documented assumptions. Hendra's transparency about estimation methodology: rare in investor conversations, where founders typically present market share numbers without uncertainty bounds. But in MJP's case, the transparency strengthens rather than weakens the investor conversation: it demonstrates that Hendra understands his market deeply enough to reason about what can and cannot be known with precision. The most defensible number: the 68% competitive win rate in documented competitive deals. This requires no estimation — it's direct observation of 87 decisions. The least defensible number: the C1 ARR estimate (Rp 1.32B). Hendra presents the revenue share as 'approximately 61%' and explicitly notes the uncertainty range. The most important insight from the market share analysis: MJP is the revenue leader in a market it does not dominate by subscriber count. This reflects MJP's deliberate choice to serve BUJK who generate more value per client (larger, more sophisticated, higher willingness to pay) rather than maximizing total subscriber count. Hendra: 'Saya bisa melipatgandakan jumlah subscriber besok dengan menurunkan harga 60% dan targeting BUJK yang lebih kecil. Tapi itu bukan bisnis yang saya ingin bangun — saya ingin membangun bisnis yang melayani klien yang paling mendapat manfaat dari layanan kami, dengan harga yang memungkinkan kami terus berinvestasi untuk memberikan lebih banyak manfaat kepada mereka.'</p>
      </div>

      {/* R113: C1 Feature Velocity Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> C1 FEATURE VELOCITY ANALYSIS — Bagaimana Hendra Jr. Memantau Kecepatan Pengembangan Produk C1 untuk Memastikan MJP Tetap Unggul: Metodologi Pelacakan, 18 Bulan Data, dan Implikasi Strategis dari Apa yang C1 Pilih Tidak Bangun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "VELOCITY-1: Metodologi pelacakan feature C1 — sinyal apa yang MJP monitor", methodology: "Hendra Jr.'s C1 feature velocity tracking: a quarterly structured analysis using 4 signal sources. (1) C1's changelog/release notes (published on their website — not always complete, but the public record). (2) C1's job posting pattern: new engineering hires signal investment areas. A new 'Data Engineer' posting signals a data infrastructure investment. A 'NLP Engineer' posting signals an NLQ-direction investment. (3) Reza's prospect debrief notes: when prospects mention new C1 capabilities they've seen in demo or trial. (4) Industry event presentations: C1 occasionally presents at LPSE forum events or LKPP consultation meetings — Sari monitors these for product direction signals.", findings: "Past 18 months of C1 feature velocity tracking: C1 released 8 significant features (vs MJP's 11). C1's feature focus: primarily in data coverage (more LPSE portals, more frequent crawls) and UI polish. Notable C1 gap: no NLQ equivalent. No SKK services. No Trust Score equivalent. C1's investment appears concentrated on breadth (coverage) while MJP has invested in depth (intelligence). Hendra's interpretation: 'C1 is optimizing to serve more BUJK at a lower level of intelligence. MJP is optimizing to serve fewer BUJK at a much higher level of intelligence. These are genuinely different bets on what the market values.'", tc: "text-primary" },
            { dimension: "VELOCITY-2: C1's hiring signals — apa yang mereka investasikan berikutnya", methodology: "LinkedIn hiring pattern analysis (Hendra Jr. monitors C1's LinkedIn page and job postings quarterly). Past 18 months: C1 added 3 engineers (vs MJP's 0 new hires — MJP has 1 engineer and plans to hire post-Series A). C1's most recent hires: 1 full-stack developer (suggesting UI investment), 1 data analyst (suggesting data intelligence investment), 1 customer success role (suggesting retention problems — a customer success hire is often a signal of churn pressure). The customer success hire: the most strategically significant signal. MJP has never needed a dedicated customer success hire because Reza handles it personally. C1 apparently needs a dedicated function — suggesting either higher churn, more complex customer relationships, or rapid scaling that Reza-equivalent personal attention cannot cover.", findings: "Hendra's interpretation of C1 hiring: C1 is growing headcount faster than MJP (3 hires in 18 months vs MJP's 0). But the customer success hire: suggests growth is coming with retention pain. Faster growth with higher churn is a less valuable trajectory than slower growth with lower churn. If C1's ARR growth is outpacing MJP's but their net revenue retention (after churn) is lower: MJP's more capital-efficient growth model may be the superior long-term business even at lower absolute ARR growth.", tc: "text-blue-700" },
            { dimension: "VELOCITY-3: The NLQ gap — C1's most significant strategic non-decision", methodology: "NLQ is the feature category where MJP's competitive lead is greatest and, based on all tracking signals, C1 has made a strategic choice to not pursue. Evidence for strategic non-decision: (1) No job posting for NLP or ML engineers in 18 months. (2) No mention of natural language query in C1's public materials. (3) 5 of Reza's 87 competitive deal prospects directly mentioned NLQ as the reason they chose MJP over C1. (4) No former C1 users have ever mentioned a C1 NLQ feature in Reza's debrief notes.", findings: "Why C1 may have chosen to not build NLQ: (a) Technical complexity — NLQ requires LLM integration, Knowledge Registry-quality grounding data, and accuracy validation that are non-trivial to build. (b) Economic risk — NLQ adds per-query API costs that C1 may not have modeled into their pricing. (c) Strategic bet — C1 may believe that data breadth (more tenders, more portals) is more valuable than intelligence depth (better answers to complex questions). Hendra's assessment: 'Kalau C1 memulai NLQ hari ini: mereka butuh 18–24 bulan untuk mencapai 82% satisfaction threshold kami. Kami akan memiliki 18–24 bulan waktu tambahan untuk mencapai versi 2 NLQ. Keunggulan kami di NLQ: bukan keunggulan sementara — ini keunggulan yang tumbuh setiap bulan mereka menunda.'", tc: "text-emerald-700" },
            { dimension: "VELOCITY-4: Feature mimicry risk — C1 yang mulai meniru MJP dan seberapa cepat", methodology: "Reza's 28 loss debriefs over 18 months: 0 cases where a prospect chose C1 because C1 had a feature MJP lacks. All 28 losses were due to: price (12 cases), geographic preference (7 cases), existing C1 relationship difficult to break (6 cases), and feature awareness gap (3 cases — prospect didn't know MJP had a feature C1 lacked). The 0 cases where C1 feature superiority drove a loss: Hendra's most important competitive intelligence finding. It means C1 is not currently building features that MJP subscribers or prospects value more than MJP's equivalent.", findings: "Mimicry risk assessment: LOW in the 12-month horizon. Medium in the 24-month horizon. Specific mimicry risk areas: (1) Trust Score — C1 could build a BUJK qualification scoring system using the same public BNSP and LPSE data. Hendra Jr.'s estimate: 6–9 months to build a Trust Score equivalent. MJP's moat: 4 years of proprietary trust score history on 12.000+ BUJK that C1 would start with zero. (2) Knowledge Registry content — C1 could hire regulatory experts. MJP's moat: Sari's 1.247 assets and 4 years of LKPP working group relationships that C1 cannot replicate by hiring. Hendra Jr.: 'Kompetitor bisa meniru fitur kami. Mereka tidak bisa meniru data kami, hubungan kami, dan empat tahun keputusan yang membentuk cara kami membangun fitur-fitur itu.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Methodology: {r.methodology}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Findings: {r.findings}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">C1 feature velocity analysis adalah Hendra Jr.'s quarterly discipline that keeps MJP's competitive awareness grounded in evidence rather than assumption. The most important finding from 18 months of analysis: C1 and MJP are pursuing fundamentally different product strategies (breadth vs depth), and neither has yet tried to replicate the other's primary differentiation. This co-existence of different strategies: is either a sign that both strategies are viable (in which case the market is large enough for both) or that one strategy will prove superior and eventually dominate (in which case MJP needs to be certain it's on the right side of that judgment). Hendra's conviction: the enterprise BUJK segment (12.000+ SAM, average ARR above Rp 1.5jt/month) rewards depth over breadth — because the value of time savings and competitive intelligence in a high-stakes procurement market is large relative to a subscription cost. The Pengadaan Langsung segment (2.3 million transactions/year but Rp 200jt value each) may reward breadth over depth — but MJP has deliberately chosen not to compete there yet. The 18 months of velocity tracking: has not produced a single signal that C1 is moving toward MJP's strategy. The NLQ gap continues to widen. The customer success hire: signals C1 is dealing with consequences of rapid breadth scaling. And MJP's 0 competitive losses due to feature superiority: confirms that MJP's depth strategy is working in the market it has chosen. Hendra Jr.: 'Analisis kompetitor yang baik bukan tentang khawatir tentang apa yang mereka lakukan. Ini tentang memahami pilihan strategis mereka cukup baik untuk memprediksi apa yang mereka tidak akan pernah lakukan — dan itulah tempat yang kami investasikan paling dalam.'</p>
      </div>

      {/* R114: Competitive Intelligence Blind Spots */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> COMPETITIVE INTELLIGENCE BLIND SPOTS — Apa yang MJP Secara Sengaja TIDAK Pantau dari Kompetitor: 4 Kategori Data Kompetitor yang Diabaikan, Alasan di Balik Setiap Keputusan, dan Apa yang Dikatakan Keputusan Ini tentang Strategi MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { blind_spot: "BLIND-SPOT-1: Harga kompetitor — MJP tidak memantau pricing perubahan C1, C2, atau C3", reason: "Hendra's explicit decision: 'We do not track competitor pricing because we do not compete on price.' MJP's pricing (Basic Rp 400rb/month, Pro Rp 950rb, Enterprise Rp 2.55jt) has not been benchmarked against competitor pricing since 2022. The rationale: MJP loses accounts for 3 reasons — budget (subscriber cannot afford), product fit (wrong use case), and churn (subscriber stops finding value). MJP has never documented a loss reason of 'competitor is cheaper than us' in 4 years of lost account tracking. The strategic inference: MJP's value proposition is not price-competitive — it is depth-competitive. BUJK who chose C1 or C2 over MJP: chose based on product fit or breadth preference, not on price.", competitive_implication: "The decision not to monitor competitor pricing: prevents MJP from making reactive pricing decisions. Reactive pricing (reducing price because a competitor reduced theirs) is one of the most destructive competitive behaviors in B2B SaaS — it erodes margin without necessarily improving competitive position (because the decision to choose a B2B tool is rarely driven by price alone). MJP's pricing philosophy: set prices based on value delivered to BUJK, not based on competitor pricing. As long as BUJK who use MJP's Trust Score, NLQ, and morning briefing find the product worth its price: MJP does not need to react to C1's pricing changes.", tc: "text-primary" },
            { blind_spot: "BLIND-SPOT-2: Social media dan PR kompetitor — tidak ada monitoring Twitter/LinkedIn/press releases", reason: "Hendra Jr.'s decision: 'What a company says publicly about itself is their marketing, not their product strategy.' MJP does not monitor C1's LinkedIn posts, press releases, or industry conference presentations. The rationale: these communications are optimized for perception management (attracting investors, recruiting, appealing to non-technical buyers) — not for revealing strategic product decisions. Hendra Jr.'s counter-evidence: C1's press release about their 'AI-powered matching' capability (Q2 2025) was extensively covered by Indonesian startup media. MJP subscribed to their platform and found the 'AI matching' was a basic keyword filter with an 'AI' label — no language model involved. The press release: did not reflect product reality.", competitive_implication: "The decision not to monitor competitor PR: keeps MJP focused on product-level intelligence (what are they actually building?) rather than marketing-level intelligence (what are they claiming to build?). The practical test Hendra Jr. uses for any competitive intelligence source: 'Does this source tell me what the engineer actually built, or what the marketing team wants buyers to believe they built?' If the latter: not worth monitoring systematically. MJP's competitive intelligence sources that pass this test: actual product subscriptions (direct observation), LPSE API behavior changes (technical signals), and BUJK feedback in Budi's narasumber interviews (user experience signals).", tc: "text-blue-700" },
            { blind_spot: "BLIND-SPOT-3: Funding dan investor news — MJP tidak bereaksi terhadap berita pendanaan kompetitor", reason: "When C1 raised Rp 45B in Series A (Q4 2024): Hendra read the announcement, noted the amount, and returned to his work. No emergency team meeting, no accelerated hiring plan, no defensive pricing decision. Hendra's stated reason: 'Funding is a financial event, not a product event. C1's Series A tells me they have Rp 45B more to spend — it does not tell me they will spend it more effectively than MJP will spend its Series A.' The historical pattern: of the 4 funding announcements by Indonesian construction-tech/procurement-tech companies in the past 3 years, 3 produced no observable product improvement relevant to MJP's core BUJK customers within 12 months of the funding announcement.", competitive_implication: "The decision not to react to competitor funding: tests MJP's strategic discipline. The most common competitive trap: a well-funded competitor announces a large raise, the smaller competitor panics, makes suboptimal hiring or pricing decisions under urgency, and loses more ground than the funding announcement alone would have caused. MJP has avoided this trap in 3 cycles (2022, 2023, 2024). The principle: funding is necessary but not sufficient for competitive threat. What matters is whether the funded competitor uses the capital to build something that directly challenges MJP's core differentiation (NLQ depth, Trust Score accuracy, narasumber-quality regulatory intelligence). As of Q2 2026: no funded competitor has done this.", tc: "text-emerald-700" },
            { blind_spot: "BLIND-SPOT-4: Fitur minor — MJP tidak melacak setiap UI change atau minor feature kompetitor", reason: "Hendra Jr.'s 'signal/noise' discipline for competitive feature tracking: only features that represent a strategic directional choice are worth tracking. UI changes, minor performance improvements, and cosmetic feature additions: not worth tracking because they don't reveal strategic intent. What Hendra Jr. DOES track: new product categories (new tab/section in the competitor's product), new data source integrations (new procurement agency added), new user types targeted (new persona in their marketing). What he doesn't track: button label changes, new filter options, redesigned dashboards. The standard: 'Does this change represent a new strategic bet, or is it product refinement within their existing strategy?'", competitive_implication: "The signal/noise discipline: saves Hendra Jr. approximately 3 hours/week of low-value competitive monitoring. More importantly, it prevents the team from chasing competitive feature parity (building every feature a competitor has) — a strategy that produces a mediocre copy of the competitor's product rather than a differentiated alternative. MJP's product discipline: build features that BUJK need (from narasumber interviews + pain points) rather than features that competitors have (from competitive monitoring). The 2 features MJP has explicitly decided NOT to build because competitors have them: a public BUJK profile page (C1's feature) and an industry news feed (C2's feature). Neither serves MJP's strategic focus on enterprise procurement intelligence.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.blind_spot} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.blind_spot}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Reason: {r.reason}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Competitive implication: {r.competitive_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitive intelligence blind spots adalah the other side of MJP's competitive strategy — the discipline of what NOT to watch is as important as the discipline of what to watch. The 4 blind spots (pricing, PR, funding reactions, minor features) share a common characteristic: they are all signals about competitor inputs (money raised, features announced, marketing messages) rather than competitor outputs (product quality, customer retention, NPS). MJP's competitive monitoring philosophy: focus exclusively on output signals, because outputs reveal whether a competitor's inputs are being converted into genuine customer value. Input signals (funding, PR, minor features) are easy to observe and easy to over-interpret. Output signals (direct product subscriptions, BUJK feedback, technical behavior changes) are harder to observe but more reliably predictive of competitive threat. The 4 years of MJP's blind-spot discipline: have produced one confirmed case where the discipline mattered. When C1 raised Rp 45B (Q4 2024): the Indonesian B2B SaaS community expected MJP to react. Hendra didn't. 18 months later: C1 has not shipped a single feature that directly challenges MJP's NLQ or Trust Score depth. The funding was used primarily for C1's geographical expansion (entering new markets) and headcount growth — neither of which directly threatens MJP's position with Enterprise BUJK in MJP's current served markets. Hendra's retrospective: 'Kalau saya bereaksi terhadap berita pendanaan C1 pada Q4 2024 — mempercepat hiring, mengubah pricing, memulai feature race — saya akan menghabiskan energi untuk melawan persepsi tentang ancaman, bukan ancaman nyata. Kedisiplinan untuk tidak bereaksi: lebih sulit dari bereaksi, dan jauh lebih berharga.'</p>
      </div>

      {/* R115: Competitor Feature Deprecation Signals */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> COMPETITOR FEATURE DEPRECATION SIGNALS — Bagaimana MJP Mendeteksi Ketika Kompetitor Secara Diam-Diam Menghentikan Sebuah Fitur: 4 Sinyal Deprecation, Apa yang Ditunjukkan Sinyal Ini tentang Strategi Kompetitor, dan Mengapa Deprecation Lebih Informatif dari Launch
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "DEPRECATION-SIGNAL-1: Fitur hilang dari onboarding flow atau tutorial video", observation: "Hendra Jr.'s quarterly competitor product review includes a specific check: watch any updated competitor tutorial or onboarding video and note what features are no longer mentioned. This is often the first signal that a feature is being quietly deprecated — marketing content gets updated before the feature is removed from the UI (to prevent user backlash from noticing the removal). C1 case (Q3 2024): C1's 'BUJK Social Network' feature (a public profile page where BUJK can post updates) disappeared from their onboarding video. Hendra Jr. checked the product: feature still live. 3 months later: feature removed with no announcement. The tutorial absence: predicted the deprecation 3 months in advance.", strategic_implication: "What a feature deprecation tells MJP: the feature did not deliver enough value to justify its maintenance cost. C1's BUJK Social Network deprecation: confirmed Hendra's 2023 hypothesis that BUJK don't want to share business information publicly. The deprecation: externally validated MJP's decision not to build a similar feature (REFUTED-A from hypothesis-driven development). Feature deprecations from competitors: are free validation of MJP's strategic choices NOT to build certain things.", tc: "text-primary" },
            { signal: "DEPRECATION-SIGNAL-2: Support documentation removed or marked 'legacy'", observation: "Hendra Jr. tracks public support documentation for all 3 primary competitors. When a competitor marks a help article as 'legacy' or removes it from their support site: it indicates either an upcoming UI change (the feature will be redesigned) or a deprecation (the feature will be removed). The support documentation signal: more reliable than tutorial absence because support docs are typically updated closer to actual feature removal. C2 case (Q1 2025): C2's 'Automated Tender Matching' algorithm documentation was marked 'legacy' in their support center. The feature was removed from C2's UI 6 weeks later. Hendra Jr. used the 6-week window to identify any C2 subscribers who relied on that feature and flag them for Reza as potential conversion targets.", strategic_implication: "The support documentation signal: Hendra Jr.'s most reliable deprecation indicator. The 'legacy' marking: typically precedes actual removal by 4–8 weeks (enough time for subscribers to adjust). For MJP: C2 subscriber churn from feature deprecations is a consistent acquisition opportunity. Reza's conversion rate from C2-churned subscribers (when the churn is caused by a feature removal): 44% — significantly higher than cold outreach (12%) because these subscribers are actively looking for an alternative at the moment of first contact.", tc: "text-blue-700" },
            { signal: "DEPRECATION-SIGNAL-3: Feature mentioned in investor update but absent from product changelog", observation: "Hendra monitors competitor investor updates (when publicly visible through LinkedIn posts or media coverage) for feature mentions that don't subsequently appear in product changelogs. This gap: either the feature was announced prematurely (not yet shipped) or the feature shipped but was quietly deprecated before the next public mention. C3 case (ongoing, 2025–2026): C3 announced an 'AI-powered regulatory compliance checker' in their Q3 2025 investor update. By Q1 2026: no product changelog entry for this feature, no user reports of it being available, no tutorial video. Hendra Jr.'s assessment: either the feature is still in development (delayed by 6+ months) or was abandoned after internal testing revealed insufficient accuracy.", strategic_implication: "The investor update vs product changelog gap: reveals the most valuable strategic signal — when a competitor has publicly committed to a feature direction but cannot execute. C3's regulatory compliance checker gap: in the same product category as MJP's Knowledge Registry NLQ. If C3 is struggling to execute on regulatory AI (despite announcing it): MJP's 4-year head start in Knowledge Registry curation is an even stronger moat than the competitive analysis suggests. Hendra's investment thesis for NLQ continuation: partly informed by observing C3 struggle with this exact problem.", tc: "text-emerald-700" },
            { signal: "DEPRECATION-SIGNAL-4: User community complaints that stop appearing — feature dropped without response", observation: "Hendra Jr. monitors public forums and Indonesian startup communities (Kaskus tech forums, Komunitas Product Indonesia Slack, Reddit r/startup_indonesia) for user complaints about competitor products. A pattern that indicates feature deprecation: a burst of complaints about a feature, followed by no competitor response, followed by silence (users stop complaining because they've accepted the feature is gone). C1 case (Q4 2023): multiple user posts about C1's 'Tender Document Auto-Summary' feature returning blank summaries. C1 never publicly responded. 8 weeks later: the feature was removed without announcement. The complaint-then-silence pattern: predicted the deprecation 8 weeks in advance.", strategic_implication: "The community complaint pattern: valuable for two reasons. First, it identifies features that don't work reliably (C1's tender auto-summary had accuracy issues — Hendra Jr. used this to validate that document summarization is technically difficult at the scale and domain-specificity required). Second, it creates a conversion window: BUJK who were using the now-deprecated feature are actively experiencing a product gap. Reza's protocol: when a competitor feature is deprecated after the community complaint pattern: contact any known C1 subscribers within 3 weeks of the removal. Hendra Jr.: 'Fitur yang diam-diam dihapus kompetitor: itu adalah bukti bahwa mereka mencoba sesuatu yang tidak berhasil. Untuk MJP: ini adalah validasi atau peluang konversi — dan kadang-kadang keduanya sekaligus.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Observation method: {r.observation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Strategic implication: {r.strategic_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitor feature deprecation signals adalah Hendra Jr.'s most underrated competitive intelligence practice — because most competitive monitoring focuses on launches (what new things are competitors building?) and ignores deprecations (what failed things are competitors abandoning?). The asymmetry: a feature launch is often announced loudly and may not reflect genuine product success (features are launched for many reasons including marketing and investor optics). A feature deprecation is almost never announced and almost always reflects genuine product failure (companies only remove features when the maintenance cost exceeds the user value — which means the feature did not work as intended). Competitor deprecations provide 3 types of intelligence for MJP: (1) Negative validation — competitor tried this, it failed, MJP's decision not to build it was correct. (2) Technical difficulty signal — competitor could not make this work at production quality, which reveals genuine technical constraints MJP should not underestimate. (3) Conversion opportunity — users who depended on the deprecated feature are now actively looking for an alternative. The 4 signals above (tutorial absence, support documentation, investor update gap, community complaint-then-silence) collectively predict deprecations 4–12 weeks in advance — giving Reza a proactive window to contact affected users before the competition for those users becomes crowded. At 2–3 competitor deprecations per year: Hendra Jr. estimates 15–25 potential high-conversion leads generated annually from deprecation intelligence alone. At Reza's 44% conversion rate from competitor-churned subscribers: 7–11 new subscribers per year from this single intelligence source.</p>
      </div>

      {/* R116: Competitor Exit Scenarios */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> COMPETITOR EXIT SCENARIOS — Apa yang Terjadi Jika Kompetitor Mendapat Pendanaan atau Pivot: 4 Skenario Exit, Respons MJP untuk Setiap Skenario, dan Mengapa Konsolidasi Industri Bisa Jadi Peluang Terbesar MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { scenario: "EXIT-SCENARIO-1: Kompetitor LPSE aggregator mendapat seed funding Rp 5–15 miliar", trigger: "The most likely near-term competitive event: one of the 4 LPSE aggregators in MJP's market (regional portals or national aggregators like Tender Indonesia) receives seed-stage funding from a Jakarta-based VC. This scenario: Hendra rates as 60% likely within 18 months given the increased VC attention to government-tech and procurement-tech sectors. Seed funding at Rp 5–15B: gives the competitor resources to improve their product (better UI, more portal coverage, faster updates) but is insufficient to build MJP's intelligence layer (Trust Score, Knowledge Registry, NLQ) from scratch.", mjp_response: "MJP's response to EXIT-SCENARIO-1: no change in product strategy. The intelligence depth moat: cannot be closed with seed-stage capital. Building Budi's 67 narasumber relationships: 4 years of consistent effort, not replicable with funding. The Knowledge Registry's 127 assets: 4 years of Sari's expertise, not replicable with capital allocation. The Trust Score's 5-year award database: available to any competitor with LPSE portal access — but the analytical layer built on top of it requires years of iteration. Hendra's internal preparation: use the competitor's funding announcement as a trigger for an MJP press release emphasizing intelligence depth metrics (narasumber count, Knowledge Registry breadth, NLQ query volume) that demonstrate moat durability. The competitive positioning: not 'we are faster' (aggregators can match this) but 'we are deeper' (aggregators cannot match this with seed capital).", tc: "text-primary" },
            { scenario: "EXIT-SCENARIO-2: Kompetitor melakukan pivot dari aggregator ke intelligence platform", trigger: "A more dangerous scenario: an existing LPSE aggregator (already with portal coverage) decides to pivot toward intelligence features — building editorial briefings, NLQ, or consultant partnerships. This scenario: Hendra rates at 35% probability within 3 years. The pivoting aggregator's advantage: existing LPSE coverage (which took years to build) that gives them a data foundation comparable to MJP's. Their disadvantage: starting from zero in the intelligence layer (no narasumber network, no Knowledge Registry, no Trust Score methodology). A pivot to intelligence is strategically correct for aggregators — but executing it is harder than announcing it.", mjp_response: "MJP's response to EXIT-SCENARIO-2: accelerate the Series A timeline. A pivoting competitor entering the intelligence market is exactly the signal VCs need to see market validation — because it confirms that intelligence is where the value is, not raw aggregation. Hendra's planned response: use the competitor's pivot announcement in MJP's own fundraising narrative ('our largest LPSE aggregator competitor just announced they are pivoting to intelligence features — this validates our 4-year head start'). The competitor's pivot creates a fundraising tailwind for MJP even as it represents a competitive threat. The 2-year head start in narasumber depth and Knowledge Registry: can be extended if Series A capital is deployed rapidly in Budi's research capacity (3 researchers vs 1) and Sari's content production (Knowledge Analyst hire).", tc: "text-blue-700" },
            { scenario: "EXIT-SCENARIO-3: Acquisition — kompetitor diakuisisi oleh perusahaan konstruksi besar atau konglomerat", trigger: "An LPSE aggregator or intelligence platform competitor is acquired by a large Indonesian construction conglomerate (Waskita, Adhi Karya, Brantas Abipraya) or a diversified conglomerate with construction interests (Sinarmas, Salim Group). This scenario: Hendra rates at 25% probability within 5 years as the government procurement market's digital transformation attracts corporate strategic interest. The acquiring conglomerate's goal: exclusive or preferred access to the intelligence platform's data and analytics for their own procurement optimization.", mjp_response: "MJP's response to EXIT-SCENARIO-3: position as the independent alternative. A competitor acquired by a construction conglomerate faces an immediate conflict of interest: BUJK subscribers who compete with the conglomerate's construction arm will leave — because they won't trust an intelligence platform owned by their competitor to provide unbiased information about tender awards and competitor analysis. MJP's independence: becomes a marketing differentiator ('PT Maheswara Jaya Persada — independently owned, no construction industry conflicts of interest'). The acquisition scenario: likely to produce a significant BUJK subscriber migration opportunity. At 44% Reza's conversion rate from competitor-churned: an acquired competitor with 200+ subscribers potentially delivers 88+ net new MJP subscribers. The BUJK trust concern about conflict-of-interest: is the single most powerful competitor acquisition counter-narrative MJP has available.", tc: "text-emerald-700" },
            { scenario: "EXIT-SCENARIO-4: MJP menjadi target akuisisi dari platform konstruksi global atau konglomerat Indonesia", trigger: "The scenario Hendra thinks about most privately: MJP itself receives an acquisition offer — from a global construction-tech platform (Procore, PlanGrid, Trimble) entering Indonesia, from a regional government-tech company (GovTech Singapore's investment arm, Grab's enterprise division), or from an Indonesian conglomerate seeking a government procurement intelligence layer. The scenario: possible but not imminent at current scale. A realistic Series A to acquisition timeline: Series A (2026) → Rp 5B ARR milestone (2029–2030) → strategic acquisition conversations. Hendra's current view: premature acquisition (before Rp 5B ARR) would undervalue MJP and deprive the BUJK market of an independent intelligence platform for years during acquirer integration.", mjp_response: "Hendra's pre-commitment on acquisition: he will not accept an acquisition offer below Rp 200B (approximately 4× Rp 5B ARR at a 40× multiple — consistent with comparable B2B SaaS Indonesia transactions). This pre-commitment: not a formal commitment to investors but Hendra's personal line. The reason: below Rp 200B, MJP's mission (formalize Indonesian BUJK market information asymmetry) is incompletely executed. The BUJK market needs an independent platform to reach that mission — and an acquisition before that point likely means the acquirer runs MJP as a data asset rather than as an active intelligence platform. The most important future acquisition due diligence question that Hendra anticipates: whether MJP's Trust Score, Knowledge Registry, and narasumber network constitute defensible proprietary assets or data that could be reconstructed by the acquirer. Hendra's answer: the assets are defensible, because the narasumber relationships are personal to Budi (not transferable to a corporate data team) and the Knowledge Registry's regulatory insight layer cannot be replicated by a non-specialist acquisition team.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.scenario}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Trigger and probability: {r.trigger}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP response: {r.mjp_response}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitor exit scenarios adalah Hendra's most strategically mature competitive thinking — because understanding what competitors will do next requires understanding their economic incentives, not just their current product. The 4 exit scenarios cover the full competitive event space: new competitor funding (more resources, harder to compete with), competitor pivot (validation + threat), competitor acquisition (conflict-of-interest opportunity for MJP), and MJP acquisition (long-term outcome planning). The pattern across scenarios: every competitive event has both a threat component and an opportunity component. New competitor funding: threat (better product) + opportunity (market validation for VCs). Competitor pivot: threat (entering MJP's space) + opportunity (fundraising narrative). Competitor acquisition: threat (conglomerate resources) + opportunity (subscriber migration from conflict-of-interest concern). These scenarios: deliberately not included in the Data Room because investors find scenario planning more credible when it comes up in conversation rather than as a pre-packaged document. Hendra's preparation: he has thought through each scenario in detail so that when an investor asks 'what if X happens?' — the response is specific and confident rather than generic and reassuring. The acquisition scenario (EXIT-SCENARIO-4): Hendra's most important long-term scenario because it determines MJP's outcome structure for the entire team. Hendra's Rp 200B floor: not just about valuation — it's about ensuring that MJP's mission is substantially complete before any transition of control. The BUJK market's information asymmetry problem: not solved by an undercapitalized startup, but also not solved by a corporate data asset. It is solved by a scaled, independent intelligence platform. MJP's trajectory: designed to reach that scale before any conversation about acquisition is appropriate.</p>
      </div>

      {/* R117: Trust Score as Emerging Industry Standard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> TRUST SCORE SEBAGAI STANDAR INDUSTRI — Strategi MJP Menjadikan Trust Score Patokan de Facto Pasar BUJK: 3 Tahap Standardisasi, Hambatan yang Perlu Diatasi, dan Kenapa Standardisasi Lebih Berharga dari Kenaikan ARR
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stage: "STANDARDIZATION-STAGE-1: Adopsi informal oleh BUJK dalam due diligence JO (saat ini)", current_state: "MJP's Trust Score is already being used informally as a JO partner screening standard by MJP's subscriber base. Enterprise subscribers routinely ask potential JO partners 'what's your Trust Score?' before formal JO negotiations — behavior MJP didn't design or encourage. This informal adoption: the earliest stage of industry standardization. At approximately 60 Enterprise subscribers using Trust Score in JO conversations: Trust Score is entering the vocabulary of jenjang-8/9 BUJK as a reference metric.", standardization_mechanism: "The BUJK-to-BUJK Trust Score reference: the most organic standardization mechanism available. When a non-subscriber BUJK is asked for their Trust Score by a subscriber BUJK: (1) the non-subscriber either subscribes to MJP to see their score, or (2) the non-subscriber becomes aware that their peers are using a scoring system they don't yet participate in. The awareness effect: drives both direct subscription (Reza's highest-intent inbound leads come from non-subscribers who were asked about their Trust Score by a peer) and indirect subscription pressure (BUJK who are not yet asked but hear about it from industry contacts). Hendra's goal for Stage 1: increase the density of Enterprise subscriber 'Trust Score conversations' until it becomes a market norm — specifically targeting GAPENSI DPD events as venues where this norm is reinforced publicly.", tc: "text-primary" },
            { stage: "STANDARDIZATION-STAGE-2: Adopsi institusional — asosiasi BUJK menggunakan Trust Score dalam program keanggotaan", current_state: "The next standardization stage: BUJK associations (GAPENSI, GAPEKSINDO, ABKMI) formally reference Trust Score in their membership programs. Specific targets: (1) GAPENSI national recommends Trust Score as a 'recommended due diligence tool' for JO partner selection in their member guidance documents. (2) GAPEKSINDO uses Trust Score to identify 'high-performing members' for their annual member recognition program. (3) Regional DPD associations use Trust Score as an input for regional 'BUJK excellence' rankings at annual events. These are not paid integration arrangements — they are endorsement relationships that GAPENSI and GAPEKSINDO derive value from (their members get a free Trust Score reference tool) without any financial arrangement.", standardization_mechanism: "Hendra's current progress toward Stage 2: 2 of 3 GAPENSI DPD contacts (Jawa Timur, Jawa Tengah) have verbally expressed openness to recommending Trust Score in their DPD member newsletters. Not yet formalized because: (1) MJP needs to resolve the Eastern Indonesia coverage gap before formally seeking GAPENSI national endorsement (endorsing a score that systematically underscores Eastern Indonesia BUJK would create association credibility problems for GAPENSI). The Eastern Indonesia coverage expansion (EXPANSION-PHASE-1, Q3 2026): is therefore a prerequisite for Stage 2 standardization, not just a technical improvement. Stage 2 target timeline: Q4 2026 (after EXPANSION-PHASE-1 completes and the Regional Coverage Adjustment notes are retired from Eastern Indonesia BUJK profiles).", tc: "text-blue-700" },
            { stage: "STANDARDIZATION-STAGE-3: Regulasi referensi — LKPP atau kementerian teknis menyebut Trust Score dalam konteks resmi", current_state: "The most ambitious standardization stage: government procurement policy that formally references Trust Score as a recommended pre-qualification due diligence tool. This does not mean LKPP mandates Trust Score use — government procurement regulations cannot mandate use of a private company's product. It means: (1) LKPP's procurement officer training materials reference Trust Score as one of several available BUJK due diligence tools. (2) A Kementerian PUPR technical guidance document for PPK (Pejabat Pembuat Komitmen) mentions Trust Score among recommended data sources for BUJK track record verification. These informal references: would give Trust Score a government-adjacent legitimacy that no competitor could claim without years of institutional relationship building.", standardization_mechanism: "The path to Stage 3: runs through Sari's LKPP working group relationship (the LKPP Knowledge Registry licensing conversation from R116) and the Board of Advisors industry expert seat (the construction sector expert board member with government procurement connections). If MJP licenses Knowledge Registry content to LKPP for training materials (the Rp 50jt arrangement from the licensing panel): the LKPP relationship becomes commercial as well as relational — creating a context in which MJP can formally request that Trust Score be mentioned in procurement officer training materials. Stage 3 timeline: 2028–2030 (realistic only after Series A capital has funded the institutional relationship investments). The commercial value of Stage 3: not direct revenue (regulatory reference doesn't pay MJP anything) but brand equity. A Trust Score referenced in LKPP training materials: becomes the equivalent of an ISO standard in the BUJK market — the reference point every BUJK and procurement officer knows, whether or not they are MJP subscribers. Hendra: 'Standar industri tidak bisa dibeli — hanya bisa dibangun melalui kualitas, konsistensi, dan kepercayaan selama bertahun-tahun. Trust Score sudah memiliki 5 tahun. Yang dibutuhkan adalah 5 tahun lagi dengan investasi yang tepat.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stage} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.stage}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Current state: {r.current_state}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Standardization mechanism: {r.standardization_mechanism}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score as emerging industry standard adalah MJP's longest-horizon competitive strategy — because standards take longer to build than products but are far more durable once established. The 3-stage standardization path (informal peer adoption → institutional association endorsement → government regulatory reference) spans a 7–10 year timeline from Trust Score's 2021 launch to realistic Stage 3 reference. The most important insight about standard-building: standards require quality first, reach second. Trust Score cannot become an industry standard if its accuracy is disputed — the dispute resolution process (from R115) and the Eastern Indonesia coverage expansion (from R116) are prerequisites for standardization, not parallel tracks. A standard built on disputed methodology: is not a standard, it's a contested metric. MJP's path to standard: quality improvement (Trust Score methodology rigor) → coverage expansion (Eastern Indonesia PHASE-1 and PHASE-2) → dispute resolution institutionalization (Trust Score Advisory Panel) → informal peer adoption (already underway) → association endorsement (Stage 2, Q4 2026) → government reference (Stage 3, 2028–2030). The commercial value of Trust Score becoming an industry standard: not captured directly through Trust Score features but through subscriber acquisition (BUJK who want to know and manage their Trust Score must be MJP subscribers) and pricing power (a standard metric is a defensible moat that sustains Enterprise pricing even as the BUJK market becomes more competitive). The single most important contributor to Trust Score standardization: MJP's 5 years of consistent, rigorous data collection that makes Trust Score's historical depth impossible for new entrants to replicate even with significant capital.</p>
      </div>

      {/* R118: Competitor Intelligence as Product Feedback */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Telescope className="h-3.5 w-3.5 text-primary" /> COMPETITOR INTELLIGENCE AS PRODUCT FEEDBACK — Apa yang Gerakan Pesaing Mengungkapkan tentang Kebutuhan Pasar yang Belum Terpenuhi: 3 Kategori Sinyal Kompetitor, Bagaimana Hendra Menggunakannya untuk Roadmap, dan Mengapa Gerakan Pesaing Lebih Jujur daripada Riset Pengguna
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal_type: "COMPETITOR-SIGNAL-1: Fitur baru yang diluncurkan pesaing — mengidentifikasi kebutuhan yang belum dijawab MJP", how_hendra_reads_it: "When a competitor launches a new feature: it is evidence that they believe a market need exists and is large enough to warrant engineering investment. If the feature addresses something MJP has not yet built: Hendra treats it as independent market validation for a backlog item. Example: if ProcurePilot (hypothetical jenjang-9 focused competitor) launches a 'bid calendar management' tool: Hendra reads this as external confirmation that PP-013 (excessive bid preparation effort) is sufficiently widespread to justify a dedicated feature. Hendra does not immediately copy the feature — he investigates whether the feature represents a genuine insight (ProcurePilot saw a real need) or a misaligned bet (they built what they thought users wanted, not what users actually need).", product_implication: "Product implication: competitor feature launches are the fastest and cheapest way to discover which of MJP's backlog items have external market validation. The process: (1) Catalog the competitor feature (what it does, what pain it addresses). (2) Map it to MJP's pain point database (which PP-code does it address?). (3) Check if the PP is already in MJP's roadmap (if yes: competitor launch accelerates priority). (4) If not in roadmap: assess whether the PP should be added (competitor data suggests market demand MJP hasn't prioritized). This process: keeps MJP's product roadmap connected to actual market signals rather than just internal conviction. Hendra: 'Pesaing yang membangun fitur yang salah adalah biaya mereka. Pesaing yang membangun fitur yang benar adalah penelitian gratis untuk saya.'", tc: "text-primary" },
            { signal_type: "COMPETITOR-SIGNAL-2: Fitur yang pesaing HENTIKAN — mengidentifikasi kebutuhan yang ternyata tidak nyata", how_hendra_reads_it: "When a competitor discontinues a feature or pivots away from a product area: it is evidence that the need was either smaller than expected, harder to serve profitably, or served well enough by an existing product that a new entrant couldn't differentiate. Feature discontinuation signals: rarer but more valuable than feature launches because they represent the market's verdict after a real investment, not just a hypothesis. If a competitor discontinues a feature that MJP was considering building: Hendra investigates whether the competitor's failure was execution-specific (they built it badly) or market-specific (the need isn't there).", product_implication: "Product implication: MJP's most important near-term feature deprioritization was influenced by competitor discontinuation data. A BUJK business directory competitor (2022) built a 'project collaboration platform' (shared project documentation between BUJK and government agencies) and discontinued it after 18 months. Hendra's interpretation: government agency collaboration features require change management at the agency level (procurement officers who don't want new tools). The feature: removed from MJP's long-term roadmap after the competitor discontinuation — saving an estimated 4–6 months of engineering investment on a feature that market evidence suggested wouldn't be adopted. Hendra's caution: competitor discontinuation doesn't mean the need doesn't exist — it means the specific implementation failed. He keeps discontinued features on a 'deprioritized but monitored' list rather than permanently eliminating them.", tc: "text-blue-700" },
            { signal_type: "COMPETITOR-SIGNAL-3: Segmen pelanggan yang pesaing pilih — mengidentifikasi celah posisioning yang bisa MJP isi", how_hendra_reads_it: "When a competitor's pricing, features, and messaging signal a specific customer segment focus: it reveals both where competition is concentrating and where gaps exist. Current competitive landscape analysis: the 4 LPSE aggregators (ProcurePilot, TenderTracker, BidWatch, ProcureAlert) are all priced at Rp 150.000–250.000/month — they are competing for price-sensitive BUJK who want basic tender alerts. None has a premium tier above Rp 500.000/month. The pricing gap (Rp 500.000–Rp 5.000.000+): entirely uncontested by competitors, occupied only by MJP's Pro and Enterprise tiers.", product_implication: "Product implication: MJP's segmentation strategy (Basic tier at Rp 179.000 competing with aggregators, Pro tier at Rp 450.000 above aggregator ceiling, Enterprise at Rp 2.55jt in an entirely uncontested range): is validated by the continued absence of any competitor in the Pro and Enterprise tier range. If a competitor entered the Pro tier: it would signal that the market is validating Rp 450.000/month BUJK SaaS pricing and Hendra would need to defend MJP's Pro differentiation more aggressively. The current gap: suggests that existing competitors either don't see the premium tier opportunity or believe they can't differentiate enough at Pro pricing to justify the investment. MJP's competitive positioning advice to Hendra from the Series A board advisor candidate (R117): 'Do not compete with aggregators at Basic tier pricing — that race ends in a price war you don't want to win. Instead: make the gap between Basic and Pro more visible. BUJK who see the Pro value should feel the Basic tier is inadequate, not almost-good-enough.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.signal_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">How Hendra reads it: {r.how_hendra_reads_it}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Product implication: {r.product_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitor intelligence as product feedback adalah Hendra's most cost-efficient market research practice — because competitors are running experiments on the same market with their own capital, and their product decisions (what they build, what they discontinue, who they target) are data points about market reality that MJP gets for free by observing carefully. The 3 signal types (new features, discontinued features, segment focus) collectively provide: a map of what the market has tried, what the market has rejected, and where the market remains unserved. Hendra's competitive intelligence monitoring: deliberate but lightweight. Monthly (30-minute competitor review): check competitor websites and app stores for new features, pricing changes, and messaging shifts. Quarterly (2-hour deep dive): structured analysis of competitive landscape changes and implications for MJP's roadmap. The lightweight monitoring: appropriate at MJP's current competitive density (4 aggregator competitors, no direct premium intelligence competitor). Post-Series A: if a well-capitalized competitor enters the premium tier, competitive monitoring would need to increase frequency and depth. The most important insight from 5 years of competitive monitoring: competitor behavior in the BUJK intelligence market has validated MJP's thesis more consistently than it has threatened it. The aggregators remaining at low price points: validates that the premium intelligence tier requires capabilities they haven't invested in (narasumber research, Knowledge Registry, Trust Score). The absence of a competitor who matches MJP's full product stack: validates Hendra's decision to build the full stack rather than one component. Competitive intelligence is not just defensive — it is one of the strongest forms of product market fit confirmation available.</p>
      </div>

      {/* R119: Trust Score Gap as Sales Trigger */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> TRUST SCORE GAP SEBAGAI SALES TRIGGER — 3 Momen Percakapan Dimana Reza Menggunakan Data Kompetitor untuk Mengkonversi Prospek Enterprise: Competitive Anxiety Conversion, Trust Differential Framing, dan Kompetitor Intelligence sebagai Proof-of-Value Demo
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { trigger: "TRIGGER-1: Competitive Anxiety Conversion — prospek yang sudah kalah tender dari kompetitor yang sama 2 kali berturut-turut", reza_script: "The opening question Reza asks in the first Enterprise discovery call: 'Apakah ada 1–2 kontraktor yang sering muncul di tender yang Anda ikuti dan sering menang?' Almost universally: yes. The follow-up: 'Sudahkah Anda pernah menganalisis pola kemenangan mereka — kapan mereka menang, proyek apa yang mereka targetkan, berapa range HPS yang paling sering mereka menangkan?' Almost universally: no (or 'hanya sekilas dari portal LPSE'). Reza then opens MJP's Halaman Kompetitor for the specific competitor the prospect named: shows the competitor's Trust Score, their recent project win timeline, their geographic concentration, their HPS win range.", conversion_mechanism: "The conversion: the prospect sees their competitor's data — organized, analyzed, and searchable — in a way they have never seen it before. The 'aha moment': not 'this data exists' (experienced BUJK know that LPSE has this data somewhere) but 'someone has already done the analysis and is giving it to me every morning.' Reza's closing line in this scenario: 'Bayangkan jika setiap senin pagi Anda tahu kontraktor mana yang sedang aktif di kategori Anda, dan berapa range HPS mereka targetkan minggu ini. Itulah yang briefing harian kami berikan.' The anxiety trigger: Reza uses competitor intelligence to make the prospect feel the cost of NOT having intelligence, not just the value of having it.", tc: "text-primary" },
            { trigger: "TRIGGER-2: Trust Differential Framing — prospek yang aktif di tender tapi belum menang dalam 6+ bulan", reza_script: "For prospects who have been bidding but losing consistently: Reza runs a live Trust Score comparison in the discovery call. He pulls the prospect's likely BUJK profile (based on the prospect's disclosed project history) and compares their approximate Trust Score components against the 3 competitors who won the tenders the prospect bid on. The framing: 'Skor kepercayaan Anda di 3 komponen ini (project completion, SKK coverage, financial capacity) secara rata-rata 15–20 poin di bawah pemenang tender di kategori ini. Bukan karena Anda tidak kompeten — tapi karena pemenang telah secara sistematis membangun profil yang lebih kuat di 3 area spesifik ini.'", conversion_mechanism: "The conversion: Reza positions MJP not as an 'intelligence tool' (abstract) but as a 'Trust Score improvement roadmap provider' (specific). The Enterprise subscription gives the prospect quarterly Trust Score assessments, SKK Express to close SKK coverage gaps, and regulatory intelligence to ensure compliance completeness. Reza's close in this scenario: 'Dalam 3 kuartal dengan MJP Enterprise, klien kami yang paling konsisten meningkat rata-rata 18 poin Trust Score. Itu setara dengan bergerak dari kuartil kedua ke kuartil pertama di kategori Anda. Di sana: tingkat kemenangan tender Anda lebih dari 2x tingkat saat ini.' The specific 18-point improvement claim: validated by Reza's tracking of 12 Enterprise clients who completed 3+ quarter improvement programs.", tc: "text-blue-700" },
            { trigger: "TRIGGER-3: Proof-of-Value Demo — prospek skeptis yang belum percaya data MJP lebih baik dari LPSE langsung", reza_script: "The skeptical prospect: 'Saya sudah menggunakan LPSE langsung. Mengapa harus bayar untuk data yang sudah gratis?' Reza's response: 'Boleh saya tunjukkan satu hal? Cari nama perusahaan Anda di LPSE.' The prospect does. LPSE shows: raw tender participation records, some project awards. Reza then opens MJP's Halaman Kompetitor: same company, but showing Trust Score breakdown with labeled components, 3-year project win trajectory chart, geographic heat map, HPS win range histogram, SKK coverage by jenjang level, and the 2 'warning signals' MJP has flagged (e.g., a gap in recent SKK renewals, a regional concentration risk). The prospect sees 10× more structured analysis from MJP's view than from LPSE's raw data.", conversion_mechanism: "The conversion mechanism: demonstrating that MJP is not a 'data access tool' (LPSE is free for that) but an 'analysis infrastructure' — the labor of extracting, cleaning, structuring, and analyzing 5 years of LPSE data across 671 portals has already been done and is delivered to subscribers every morning. Reza's framing: 'LPSE memberi Anda bahan mentah. MJP memberi Anda analisisnya. Anda sudah punya akses ke data yang sama seperti kami — bedanya adalah Anda harus menganalisisnya sendiri, atau membayar seseorang untuk melakukannya untuk Anda. Kami sudah melakukannya dan harganya Rp 1.75jt per bulan.' The Proof-of-Value Demo: Reza's highest-conversion sales scenario (used in 34 of the last 50 Enterprise conversions from initially skeptical prospects).", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.trigger} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.trigger}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Reza's script: {r.reza_script}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Conversion mechanism: {r.conversion_mechanism}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Trust Score gap as sales trigger adalah Reza's most refined sales methodology — because it converts MJP's competitive intelligence data from a passive product feature into an active sales tool. The 3 trigger scenarios (competitive anxiety, trust differential, proof-of-value demo): cover the 3 most common Enterprise prospect psychological states. TRIGGER-1 (competitive anxiety) is most common among BUJK who have been losing to specific competitors for years and feel a growing sense of urgency. TRIGGER-2 (trust differential) is most effective for analytically-minded BUJK who respond to data-driven explanations for their underperformance. TRIGGER-3 (proof-of-value demo) is most effective for skeptics who need to see MJP's product quality before they're willing to trust Reza's description of it. Reza's rule: match the trigger to the prospect's emotional state and knowledge level in the first 5 minutes of the discovery call. The skill in executing these triggers: not in the script (which Reza can recite without thinking) but in reading the prospect's response to the opening question accurately enough to choose the right trigger. Reza's close rate with TRIGGER-1: 67%. TRIGGER-2: 71%. TRIGGER-3: 58% (lower because skeptical prospects have higher baseline resistance, but the conversion is more durable — TRIGGER-3 Enterprise subscribers have a 97% Year-1 renewal rate vs 92% for TRIGGER-1/2, because they saw the product's quality before committing). Reza's advice to the Series A CS hire: 'Pelajari tiga trigger ini lebih awal. Setelah Anda mahir membaca mana yang harus digunakan, Anda tidak perlu script sama sekali — percakapannya akan mengalir sendiri.'</p>
      </div>

      {/* R120: Competitor Exit Signals */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-primary" /> COMPETITOR EXIT SIGNALS — Bagaimana Mendeteksi Kompetitor yang Diam-Diam Meninggalkan Segmen Pasar: 4 Sinyal Exit, Cara MJP Mendeteksinya Sebelum Kompetitor Mengumumkannya, dan Mengapa Sinyal Exit Lebih Berharga dari Sinyal Entry
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "EXIT-SIGNAL-1: Penurunan frekuensi partisipasi tender — kompetitor berhenti mengikuti tender di kategori tertentu", detection_method: "Detection: Hendra Jr.'s crawler tracks bidder participation frequency per tender category per month. A BUJK that participated in 4–6 tenders/month in a category for 2+ years, then drops to 1–2/month for 2 consecutive months, has triggered an 'activity reduction flag' in Trust Score's underlying data. The flag: not surfaced as a Trust Score decrease (participation frequency is one of several inputs) but available as a raw signal in the 'competitive activity' section of Halaman Kompetitor.", subscriber_value: "Subscriber value: a MJP subscriber competing in the same category as the exiting BUJK: sees the activity reduction flag 4–8 weeks before the market generally notices the competitor is less active. The subscriber with this early signal: can bid more aggressively in tenders where the strong competitor was previously the likely winner — reallocating bid effort from 'likely loss' to 'improved probability' scenarios. Reza's Enterprise quarterly review: specifically includes a 'competitor activity map' showing which key competitors in the subscriber's category are trending up, stable, or declining — making the exit signal actionable in the subscriber's specific competitive context.", tc: "text-primary" },
            { signal: "EXIT-SIGNAL-2: SKK renewal deferral — karyawan kunci tidak memperbarui sertifikasi yang kadaluarsa", detection_method: "Detection: Hendra Jr.'s weekly BNSP database check tracks certificate renewals for key personnel at all profiled BUJK. A BUJK whose jenjang-8/9 personnel consistently renewed SKK certificates on schedule for 3+ years, but whose renewal activity has stopped or slowed in the last 6 months, has triggered a 'qualification erosion flag.' The flag: connected to Trust Score's SKK component (which will eventually decrease as certificates expire) but detectable as a leading indicator before Trust Score is affected.", subscriber_value: "Subscriber value: SKK renewal deferral is often the first operational signal of a BUJK beginning to wind down specific categories. A BUJK that stops renewing the SKK certifications needed for large infrastructure work (jenjang-8/9 in civil engineering) while maintaining renewals for smaller-scale work (jenjang-7 across categories): is signaling a strategic retreat from large-project competition. MJP subscribers who detect this signal early: can actively target the large-project tenders where the competitor is implicitly withdrawing before the competitor's Trust Score reflects the withdrawal and other subscribers notice.", tc: "text-blue-700" },
            { signal: "EXIT-SIGNAL-3: Penurunan HPS target range — kompetitor bergeser ke proyek yang lebih kecil", detection_method: "Detection: Trust Score's analysis of a BUJK's award records over rolling 12-month windows. A BUJK that consistently won projects at Rp 2–8M HPS for 3 years, then shifts to consistently winning at Rp 500jt–2M HPS over the last 6 months, has triggered an 'HPS range contraction flag.' The shift: often indicates financial capacity reduction (smaller bonding capacity) or strategic repositioning (choosing to compete where competition is less intense rather than where the original BUJK excelled).", subscriber_value: "Subscriber value: HPS range contraction is the clearest signal that a formerly high-tier competitor is no longer competing in the same market segment. For Enterprise subscribers who compete in the Rp 2–8M HPS range: a key competitor contracting to Rp 500jt–2M represents a reduction in competitive intensity at the top of the market. Reza's competitive intelligence conversation: 'Perusahaan X yang selama ini memenangkan tender besar di kategori Anda telah bergeser ke proyek yang lebih kecil — mereka tidak lagi ancaman langsung untuk 3 proyek besar di pipeline Anda di Q4. Pertimbangkan untuk bid lebih agresif di proyek-proyek ini.'", tc: "text-emerald-700" },
            { signal: "EXIT-SIGNAL-4: Tidak ada proyek baru yang diselesaikan selama 12+ bulan — tanda hibernasi atau likuidasi diam-diam", detection_method: "Detection: Trust Score's project completion tracking. A BUJK with a strong completion record that has had no new project completions filed in LPSE or disclosed in tender qualification documents for 12+ months: has triggered a 'completion hiatus flag.' The 12-month threshold: chosen because most active BUJK complete at least 1 project annually (even during slow market periods). A 12-month gap: statistically unusual for an active competitor and warrants investigation (the BUJK may be in financial distress, may be managing a large multi-year project, or may have begun a deliberate exit from the market).", subscriber_value: "Subscriber value: 12-month completion hiatus is MJP's strongest exit signal — a BUJK that has not completed a new project in over a year is either in serious difficulty or has effectively left active competition. For subscribers who previously treated this BUJK as a tier-1 competitive threat: the completion hiatus signals a fundamental shift in competitive landscape. Trust Score's 12-month age-weighting decay: will eventually reduce the BUJK's Trust Score significantly as their project completion data ages out — but the completion hiatus flag surfaces the signal 3–6 months before the Trust Score impact becomes visible, giving MJP subscribers a material early-warning advantage.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Detection method: {r.detection_method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Subscriber value: {r.subscriber_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitor exit signals adalah the most commercially underappreciated category in MJP's competitive intelligence portfolio — because most subscribers focus on entry signals (new competitors appearing in their market) while exit signals (established competitors withdrawing) represent equally significant competitive opportunities. The 4 exit signals (activity reduction, SKK renewal deferral, HPS range contraction, completion hiatus): operate on different timescales. Activity reduction is detectable within 2 months. SKK renewal deferral: within 3–6 months (certificate expiry timeline). HPS range contraction: within 6 months of the shift beginning. Completion hiatus: requires 12 months of monitoring. Together: they form a multi-horizon exit detection system that gives MJP subscribers advance warning at 2, 3, 6, and 12 month intervals before the exit is observable to the general market. The commercial value of exit signals: typically higher per-signal than entry signals, because an established competitor's exit from a segment represents a predictable capacity gap in the market — tenders the exiting BUJK would have won but no longer pursues. The subscribers best positioned to capture these opportunities: those who were monitoring the exiting competitor closely enough to detect the signal early. MJP's Halaman Kompetitor: the platform through which these signals flow from Hendra Jr.'s data infrastructure to Reza's subscriber advisory conversations to individual BUJK strategic decisions. The exit signal intelligence pipeline: the most direct path from MJP's data infrastructure to measurable subscriber win rate improvement — because each exit signal converted into a successful bid represents a directly attributable ROI from the MJP subscription.</p>
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
