import { useState, useMemo, useEffect, useRef } from "react";
import { useGetExpiringCertifications, getGetExpiringCertificationsQueryKey, useListContractors, getListContractorsQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck, Award, HardHat, CheckCircle2, AlertCircle, ChevronUp, Search,
  TrendingUp, FileText, Clock, TriangleAlert, ExternalLink, Building2,
  ClipboardCheck, BookOpen, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Static data ──────────────────────────────────────────────────────────────

interface IsoStandard {
  code: string;
  nama: string;
  kategori: "ISO" | "SNI" | "OHSAS";
  deskripsi: string;
  relevansiBUJK: string;
  persyaratanUntuk: string[];
  manfaat: string[];
  biayaEstimasi: string;
  waktuSertifikasi: string;
  warna: string;
}

const ISO_STANDARDS: IsoStandard[] = [
  {
    code: "ISO 9001:2015",
    nama: "Sistem Manajemen Mutu",
    kategori: "ISO",
    deskripsi: "Standar internasional untuk sistem manajemen mutu. Mensyaratkan organisasi memenuhi persyaratan pelanggan dan regulasi.",
    relevansiBUJK: "Wajib untuk kontraktor yang mengikuti tender pemerintah kelas menengah ke atas. Hampir 100% RFQ K/L mensyaratkan ISO 9001.",
    persyaratanUntuk: ["Tender PUPR > Rp 10 M", "Tender BUMN > Rp 5 M", "Kualifikasi BUJK Menengah-Besar", "Proyek infrastruktur strategis"],
    manfaat: ["Akses tender kelas menengah-besar", "Proses operasional terstandar", "Pengurangan pemborosan & rework", "Kepercayaan klien & owner proyek"],
    biayaEstimasi: "Rp 15–35 juta (sertifikasi + konsultan)",
    waktuSertifikasi: "3–6 bulan",
    warna: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    code: "ISO 45001:2018",
    nama: "Sistem Manajemen K3",
    kategori: "ISO",
    deskripsi: "Standar internasional untuk sistem manajemen Keselamatan dan Kesehatan Kerja (K3). Menggantikan OHSAS 18001.",
    relevansiBUJK: "Disyaratkan di proyek konstruksi skala besar, proyek EPC, dan seluruh proyek migas & energi. Semakin banyak BUJK yang mewajibkan subkontraktor.",
    persyaratanUntuk: ["Proyek EPC > Rp 50 M", "Sektor migas & energi", "Proyek BUMN skala besar", "Kontraktor internasional"],
    manfaat: ["Akses proyek EPC & migas", "Pengurangan insiden & fatality", "Perlindungan hukum perusahaan", "Nilai jual diferensial vs kompetitor"],
    biayaEstimasi: "Rp 20–50 juta (sertifikasi + training)",
    waktuSertifikasi: "4–8 bulan",
    warna: "text-orange-600 bg-orange-50 border-orange-200",
  },
  {
    code: "ISO 14001:2015",
    nama: "Sistem Manajemen Lingkungan",
    kategori: "ISO",
    deskripsi: "Standar untuk pengelolaan dampak lingkungan secara sistematis. Semakin relevan seiring regulasi AMDAL yang ketat.",
    relevansiBUJK: "Dipersyaratkan untuk proyek di kawasan lindung, proyek pertambangan, dan seluruh proyek yang memerlukan AMDAL.",
    persyaratanUntuk: ["Proyek di kawasan AMDAL", "Proyek pertambangan", "Proyek IKN & kawasan strategis", "Klien korporasi dengan ESG policy"],
    manfaat: ["Kepatuhan regulasi lingkungan", "Akses proyek ESG-sensitive", "Pengurangan denda & sanksi", "Reputasi perusahaan hijau"],
    biayaEstimasi: "Rp 18–40 juta",
    waktuSertifikasi: "4–7 bulan",
    warna: "text-green-600 bg-green-50 border-green-200",
  },
  {
    code: "SMK3",
    nama: "Sistem Manajemen K3 (SMK3-PP 50/2012)",
    kategori: "SNI",
    deskripsi: "Program K3 nasional berbasis PP No. 50 Tahun 2012. Wajib bagi perusahaan dengan >100 karyawan atau risiko tinggi.",
    relevansiBUJK: "WAJIB oleh hukum (PP 50/2012) bagi BUJK dengan tenaga kerja >100 orang atau proyek berisiko tinggi. Audit rutin oleh Kemenaker.",
    persyaratanUntuk: ["Semua BUJK > 100 karyawan", "Proyek konstruksi berisiko tinggi", "Wajib hukum PP 50/2012"],
    manfaat: ["Kepatuhan hukum (menghindari sanksi)", "Pencegahan kecelakaan kerja", "Audit Kemenaker siap", "Perlindungan hak tenaga kerja"],
    biayaEstimasi: "Rp 10–25 juta/tahun (audit + sistem)",
    waktuSertifikasi: "2–4 bulan (emas/bendera)",
    warna: "text-yellow-600 bg-yellow-50 border-yellow-200",
  },
  {
    code: "OHSAS 18001",
    nama: "Occupational Health & Safety (Legacy)",
    kategori: "OHSAS",
    deskripsi: "Standar K3 internasional versi lama (digantikan ISO 45001 sejak Sept 2021). Beberapa klien lama masih mensyaratkan.",
    relevansiBUJK: "Sudah deprecated. Kontraktor yang masih memiliki OHSAS 18001 perlu transisi ke ISO 45001 segera.",
    persyaratanUntuk: ["Klien yang belum update spesifikasi (legacy)", "Transisi ke ISO 45001 diperlukan"],
    manfaat: ["Transisi bertahap ke ISO 45001", "Kesinambungan sertifikasi"],
    biayaEstimasi: "Rp 8–15 juta (upgrade path ke ISO 45001)",
    waktuSertifikasi: "2–3 bulan (upgrade)",
    warna: "text-slate-500 bg-slate-50 border-slate-200",
  },
];

// ─── K3 Programmes ────────────────────────────────────────────────────────────

interface K3Programme {
  nama: string;
  penyelenggara: string;
  level: "Dasar" | "Madya" | "Utama" | "Spesialis";
  deskripsi: string;
  durasi: string;
  biaya: string;
  target: string;
}

const K3_PROGRAMMES: K3Programme[] = [
  { nama: "AK3 Umum", penyelenggara: "Kemenaker / Disnaker", level: "Dasar", deskripsi: "Ahli K3 Umum — wajib ada 1 orang di setiap proyek > 100 orang", durasi: "10–14 hari", biaya: "Rp 6–12 juta", target: "Supervisor, Safety Officer, Site Manager" },
  { nama: "AK3 Konstruksi", penyelenggara: "Kemenaker / PJK3", level: "Madya", deskripsi: "Spesialisasi K3 di sektor konstruksi. Dipersyaratkan di proyek PUPR & BUMN.", durasi: "3–5 hari + ujian", biaya: "Rp 4–8 juta", target: "HSE Officer, Project Manager konstruksi" },
  { nama: "AK3 Listrik", penyelenggara: "Kemenaker", level: "Spesialis", deskripsi: "Ahli K3 spesialisasi kelistrikan. Wajib di proyek dengan instalasi listrik skala besar.", durasi: "5–7 hari", biaya: "Rp 8–15 juta", target: "Teknisi listrik, supervisor M/E" },
  { nama: "P2K3 Pembinaan", penyelenggara: "Kemenaker", level: "Dasar", deskripsi: "Pembinaan Panitia Pembina K3. Wajib terbentuk di perusahaan > 100 karyawan.", durasi: "3 hari", biaya: "Rp 2–5 juta/peserta", target: "Anggota panitia K3, HR Manager" },
  { nama: "First Aider / P3K", penyelenggara: "Kemenaker / PMI", level: "Dasar", deskripsi: "Pelatihan pertolongan pertama pada kecelakaan kerja. Disyaratkan 1 orang per 150 karyawan.", durasi: "2–3 hari", biaya: "Rp 1–3 juta", target: "Semua level — terutama site team" },
  { nama: "CSMS (Contractor Safety Management)", penyelenggara: "BP / Pertamina / PLN", level: "Madya", deskripsi: "Program K3 khusus subkontraktor oil & gas. Gate pass untuk masuk ke proyek migas.", durasi: "1–2 hari pre-qualification", biaya: "Rp 3–6 juta/perusahaan", target: "Kontraktor yang masuk proyek migas & energi" },
];

// ─── SKK Competency Map ───────────────────────────────────────────────────────

interface SKKCluster {
  bidang: string;
  jenjang: string;
  jabatan: string[];
  relevansi: string;
  tren: "MENINGKAT" | "STABIL" | "MENURUN";
}

const SKK_CLUSTERS: SKKCluster[] = [
  { bidang: "Arsitektur", jenjang: "7-9", jabatan: ["Manajer Proyek Konstruksi", "Manajer Lapangan Pekerjaan Gedung", "Pelaksana Lapangan Pekerjaan Gedung"], relevansi: "Wajib untuk tender gedung komersial & pemerintah", tren: "MENINGKAT" },
  { bidang: "Sipil", jenjang: "7-9", jabatan: ["Manajer Proyek Infrastruktur Jalan", "Manajer Pelaksana Pekerjaan Jembatan", "Pengawas Pekerjaan Jalan"], relevansi: "Core untuk tender PUPR & infrastruktur", tren: "MENINGKAT" },
  { bidang: "Mekanikal", jenjang: "6-9", jabatan: ["Manajer Teknik Mekanikal", "Pengawas Instalasi HVAC", "Teknisi Pemipaan Industri"], relevansi: "Wajib di proyek M/E, EPC, dan industri", tren: "STABIL" },
  { bidang: "Elektrikal", jenjang: "6-9", jabatan: ["Manajer Instalasi Listrik", "Supervisor Instalasi Panel", "Teknisi Instrumentasi"], relevansi: "Kritikal untuk EPC & proyek energi", tren: "MENINGKAT" },
  { bidang: "Manajemen Proyek", jenjang: "8-9", jabatan: ["Project Manager Konstruksi", "Quantity Surveyor", "Cost Controller Konstruksi"], relevansi: "Diferensiator untuk kontraktor premium", tren: "MENINGKAT" },
  { bidang: "K3", jenjang: "6-8", jabatan: ["Ahli K3 Konstruksi", "Safety Officer Lapangan", "Environmental Health Officer"], relevansi: "Wajib di hampir semua proyek besar", tren: "MENINGKAT" },
];

// ─── Compliance Radar — Prospects ─────────────────────────────────────────────

interface CompliancePotential {
  id: string;
  namaPerusahaan: string;
  jenis: "BUJK" | "Kontraktor Spesialis";
  kota: string;
  celah: string[];
  skorPotensi: number;
  estNilaiProject: string;
}

const COMPLIANCE_PROSPECTS: CompliancePotential[] = [
  { id: "cp-1", namaPerusahaan: "PT Karya Bangun Nusantara", jenis: "BUJK", kota: "Surabaya", celah: ["Belum ISO 9001", "SMK3 belum sertifikasi"], skorPotensi: 87, estNilaiProject: "Rp 25–40 juta" },
  { id: "cp-2", namaPerusahaan: "CV Konstruksi Maju Jaya", jenis: "BUJK", kota: "Bandung", celah: ["ISO 9001 expired", "Belum AK3 Konstruksi"], skorPotensi: 82, estNilaiProject: "Rp 18–30 juta" },
  { id: "cp-3", namaPerusahaan: "PT Graha Teknik Persada", jenis: "Kontraktor Spesialis", kota: "Semarang", celah: ["Belum ISO 45001", "OHSAS 18001 perlu upgrade"], skorPotensi: 79, estNilaiProject: "Rp 30–50 juta" },
  { id: "cp-4", namaPerusahaan: "UD Cipta Karya Unggul", jenis: "BUJK", kota: "Medan", celah: ["Belum semua SKK tersertifikasi", "P2K3 belum terbentuk formal"], skorPotensi: 75, estNilaiProject: "Rp 15–25 juta" },
  { id: "cp-5", namaPerusahaan: "PT Putera Mandiri Konstruksi", jenis: "BUJK", kota: "Jakarta", celah: ["ISO 14001 belum ada", "AK3 Listrik kurang"], skorPotensi: 73, estNilaiProject: "Rp 35–60 juta" },
  { id: "cp-6", namaPerusahaan: "PT Sejahtera Infrastruktur", jenis: "BUJK", kota: "Makassar", celah: ["Belum ISO 9001 & 45001", "SMK3 dasar saja"], skorPotensi: 70, estNilaiProject: "Rp 20–35 juta" },
  { id: "cp-7", namaPerusahaan: "CV Teknik Prima Utama", jenis: "Kontraktor Spesialis", kota: "Yogyakarta", celah: ["CSMS belum punya", "SKK Manajemen Proyek gap"], skorPotensi: 66, estNilaiProject: "Rp 12–20 juta" },
  { id: "cp-8", namaPerusahaan: "PT Bina Sarana Konstruksi", jenis: "BUJK", kota: "Palembang", celah: ["Seluruh ISO cluster belum ada", "AK3 Umum 1 orang saja"], skorPotensi: 91, estNilaiProject: "Rp 40–70 juta" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: K3Programme["level"] }) {
  const map = {
    Dasar: "bg-slate-100 text-slate-700 border-slate-200",
    Madya: "bg-blue-100 text-blue-700 border-blue-200",
    Utama: "bg-purple-100 text-purple-700 border-purple-200",
    Spesialis: "bg-orange-100 text-orange-700 border-orange-200",
  };
  const desc: Record<string,string> = { Dasar:"Level Dasar — kompetensi awal, cocok untuk tenaga ahli muda", Madya:"Level Madya — kompetensi menengah, pengalaman 3–5 tahun", Utama:"Level Utama — kompetensi tertinggi, pakar di bidangnya", Spesialis:"Level Spesialis — keahlian khusus pada area tertentu" };
  return <span className={`inline-flex px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold border ${map[level]}`} title={desc[level] ?? level}>{level.toUpperCase()}</span>;
}

function TrenBadge({ tren }: { tren: SKKCluster["tren"] }) {
  if (tren === "MENINGKAT") return <span className="text-[9px] font-mono text-emerald-600 flex items-center gap-0.5" title="Tren meningkat — jumlah tenaga ahli bersertifikat bertambah"><TrendingUp className="h-2.5 w-2.5" /> Meningkat</span>;
  if (tren === "MENURUN") return <span className="text-[9px] font-mono text-red-500 flex items-center gap-0.5" title="Tren menurun — jumlah tenaga ahli bersertifikat berkurang"><TriangleAlert className="h-2.5 w-2.5" /> Menurun</span>;
  return <span className="text-[9px] font-mono text-muted-foreground" title="Tren stabil — jumlah tenaga ahli bersertifikat tidak banyak berubah">Stabil</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModulIsoK3() {
  const [tab, setTab] = useState("iso");
  const [search, setSearch] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      const _t = (e.target as HTMLElement);
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && _t.tagName !== "INPUT" && _t.tagName !== "TEXTAREA" && _t.tagName !== "SELECT" && !_t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !e.altKey && _t.tagName !== "INPUT" && _t.tagName !== "TEXTAREA" && _t.tagName !== "SELECT" && !_t.isContentEditable) { setTab("prospek"); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  const [prospekSearch, setProspekSearch] = useState("");
  const [showProspekWithNotesOnly, setShowProspekWithNotesOnly] = useState(false);
  const [prospekNotes, setProspekNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-iso-k3-prospek-notes") ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const updateProspekNote = (id: string, val: string) => setProspekNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-iso-k3-prospek-notes", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // Live data — enriches static prospect list with contractors from DB that have expiring certifications
  const { data: expiringCerts, isLoading: loadingCerts } = useGetExpiringCertifications(
    { query: { queryKey: getGetExpiringCertificationsQueryKey() } }
  );
  const { data: liveContractors, isLoading: loadingContractors } = useListContractors(
    undefined,
    { query: { queryKey: getListContractorsQueryKey() } }
  );
  const loadingLiveData = loadingCerts || loadingContractors;

  // Synthesise live prospects from contractors with expiring certs
  const liveProspects: CompliancePotential[] = useMemo(() => {
    if (!expiringCerts?.length) return [];
    const seen = new Set<string>();
    return expiringCerts
      .filter((c) => { const key = c.holderName; if (seen.has(key)) return false; seen.add(key); return true; })
      .slice(0, 5)
      .map((c, i) => ({
        id: `live-cp-${i}`,
        namaPerusahaan: c.holderName,
        jenis: "BUJK" as const,
        kota: (liveContractors ?? []).find((co) => co.name === c.holderName)?.province ?? "—",
        celah: [`${c.type} berakhir ${c.daysLeft} hari — perlu pembaruan & pendampingan`],
        skorPotensi: Math.min(99, 100 - c.daysLeft),
        estNilaiProject: "Live — perlu asesmen",
      }));
  }, [expiringCerts, liveContractors]);

  const allProspects = useMemo(() => {
    const liveNames = new Set(liveProspects.map(p => p.namaPerusahaan));
    const dedupedStatic = COMPLIANCE_PROSPECTS.filter(p => !liveNames.has(p.namaPerusahaan));
    return [...liveProspects, ...dedupedStatic];
  }, [liveProspects]);

  const filteredK3 = useMemo(() => {
    const q = search.toLowerCase();
    return K3_PROGRAMMES.filter((p) => !q || p.nama.toLowerCase().includes(q) || p.target.toLowerCase().includes(q));
  }, [search]);

  const filteredProspects = useMemo(() => {
    const q = prospekSearch.toLowerCase();
    return allProspects
      .filter((p) => !q || p.namaPerusahaan.toLowerCase().includes(q) || p.kota.toLowerCase().includes(q) || (prospekNotes[p.id] ?? "").toLowerCase().includes(q))
      .filter((p) => !showProspekWithNotesOnly || !!(prospekNotes[p.id] ?? "").trim())
      .sort((a, b) => b.skorPotensi - a.skorPotensi);
  }, [allProspects, prospekSearch, prospekNotes, showProspekWithNotesOnly]);

  const totalCelah = allProspects.reduce((s, p) => s + p.celah.length, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Modul ISO, K3 & Sertifikasi
        </h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Standar mutu · keselamatan kerja · kompetensi personil — radar peluang & compliance gap
        </p>
        <p className="text-[10px] text-teal-600 font-mono mt-1 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Modul ini memenuhi janji landing page: Intel Konstruksi — ISO 9001, SMK3, SKK &amp; OHSAS
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Award, label: "Standar ISO/SNI Dipantau", val: ISO_STANDARDS.length, color: "text-blue-600" },
          { icon: HardHat, label: "Program K3 Tersedia", val: K3_PROGRAMMES.length, color: "text-orange-600" },
          { icon: ClipboardCheck, label: "Cluster SKK Dipantau", val: SKK_CLUSTERS.length, color: "text-purple-600" },
          { icon: AlertCircle, label: "Celah Compliance Teridentifikasi", val: totalCelah, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="border rounded-sm p-3 bg-card flex items-center gap-3 hover:shadow-sm transition-shadow">
            <s.icon className={cn("h-5 w-5 shrink-0", s.color)} />
            <div>
              <p className="text-xl font-bold font-mono leading-none">{s.val}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="iso" className="text-xs font-mono px-3 h-7">ISO &amp; SNI ({ISO_STANDARDS.length})</TabsTrigger>
          <TabsTrigger value="k3" className="text-xs font-mono px-3 h-7">Program K3 ({K3_PROGRAMMES.length})</TabsTrigger>
          <TabsTrigger value="skk" className="text-xs font-mono px-3 h-7">SKK &amp; Kompetensi ({SKK_CLUSTERS.length})</TabsTrigger>
          <TabsTrigger value="prospek" className="text-xs font-mono px-3 h-7">Radar Prospek ({filteredProspects.length})</TabsTrigger>
        </TabsList>

        {/* ── ISO & SNI Tab ────────────────────────────────────────────── */}
        <TabsContent value="iso" className="mt-4">
          <div className="grid gap-4">
            {ISO_STANDARDS.map((std) => (
              <div key={std.code} className="border rounded-sm p-4 bg-card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className={cn("px-2.5 py-1 rounded-sm text-xs font-mono font-bold border", std.warna)}>
                      {std.code}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold" title={`${std.nama} — ${std.deskripsi}`}>{std.nama}</h3>
                      <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm",
                        std.kategori === "ISO" ? "bg-blue-100 text-blue-700" :
                        std.kategori === "SNI" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"
                      )}>{std.kategori}</span>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground font-mono shrink-0">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{std.waktuSertifikasi}</span>
                    <span className="flex items-center gap-1" title={`Estimasi biaya sertifikasi: ${std.biayaEstimasi}`}><FileText className="h-3 w-3" />{std.biayaEstimasi}</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{std.deskripsi}</p>

                <div className="mt-3 p-2.5 rounded-sm bg-muted/50 border border-border">
                  <p className="text-[10px] font-mono font-semibold text-primary mb-1">Relevansi BUJK</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{std.relevansiBUJK}</p>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Disyaratkan Untuk
                    </p>
                    <ul className="space-y-1">
                      {std.persyaratanUntuk.map((r) => (
                        <li key={r} className="text-xs text-muted-foreground flex items-start gap-1.5" title={r}>
                          <span className="text-primary mt-0.5">›</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-blue-500" /> Manfaat Utama
                    </p>
                    <ul className="space-y-1">
                      {std.manfaat.map((m) => (
                        <li key={m} className="text-xs text-muted-foreground flex items-start gap-1.5" title={m}>
                          <span className="text-blue-400 mt-0.5">›</span>{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Service Opportunity */}
          <div className="mt-4 border rounded-sm p-4 bg-teal-50/50 border-teal-200">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-teal-700 mb-2 flex items-center gap-1">
              <Wrench className="h-3 w-3" /> PELUANG LAYANAN PT MAHESWARA
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Mayoritas BUJK kelas menengah belum memiliki ISO 9001 + ISO 45001 sekaligus. Gap ini adalah peluang bundling: <strong>Paket Compliance Lengkap</strong> — konsultasi ISO 9001 + SMK3 + pelatihan AK3 dalam satu engagement. Estimasi nilai: <strong>Rp 40–80 juta per klien</strong>, dengan potensi recurring audit tahunan.
            </p>
          </div>
        </TabsContent>

        {/* ── K3 Programmes Tab ─────────────────────────────────────────── */}
        <TabsContent value="k3" className="mt-4">
          <div className="mb-3 relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchRef}
              className="pl-8 h-8 text-xs font-mono"
              placeholder="Cari program K3… · Esc reset"
              title="Tekan / untuk fokus ke pencarian"
              onFocus={(e) => e.target.select()}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
            />
            {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
          </div>
          {search && (
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={() => setSearch("")}
                className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
                title="Reset pencarian"
              >✕ Reset</button>
              <p className="text-[10px] font-mono text-muted-foreground ml-auto">{filteredK3.length} dari {K3_PROGRAMMES.length} program</p>
            </div>
          )}

          <div className="grid gap-3">
            {filteredK3.map((prog) => (
              <div key={prog.nama} className="border rounded-sm p-4 bg-card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <HardHat className="h-4 w-4 text-orange-500 shrink-0" />
                      <h3 className="text-sm font-semibold">{prog.nama}</h3>
                      <LevelBadge level={prog.level} />
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">{prog.penyelenggara}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground font-mono shrink-0">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{prog.durasi}</span>
                    <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{prog.biaya}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{prog.deskripsi}</p>
                <p className="text-[10px] font-mono text-primary mt-2 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Target: {prog.target}
                </p>
              </div>
            ))}
          </div>

          {filteredK3.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground font-mono flex flex-col items-center gap-2">
              <span>Tidak ada program K3 yang cocok dengan pencarian</span>
              <button onClick={() => setSearch("")} className="text-xs font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset pencarian</button>
            </div>
          )}

          <div className="mt-4 p-3 border rounded-sm bg-orange-50/50 border-orange-200">
            <p className="text-[10px] font-mono font-bold text-orange-700 mb-1">Catatan Regulasi</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              PP No. 50 Tahun 2012 mewajibkan penerapan SMK3 bagi perusahaan dengan ≥100 tenaga kerja <em>atau</em> yang memiliki tingkat risiko tinggi. Kegagalan mematuhi dapat mengakibatkan sanksi administratif, penghentian operasional, dan tanggung jawab pidana.
            </p>
          </div>
        </TabsContent>

        {/* ── SKK & Kompetensi Tab ──────────────────────────────────────── */}
        <TabsContent value="skk" className="mt-4">
          <div className="flex items-center gap-2 mb-4 p-3 bg-purple-50/50 border border-purple-200 rounded-sm">
            <BookOpen className="h-4 w-4 text-purple-600 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              SKK (Sertifikat Kompetensi Kerja) menggantikan SKA/SKT lama. Dikeluarkan oleh LPJK melalui LSP terlisensi. Wajib dipenuhi sesuai jenis & nilai kontrak dalam SBU/SBUJK.
            </p>
          </div>

          <div className="grid gap-4">
            {SKK_CLUSTERS.map((cl) => (
              <div key={cl.bidang} className="border rounded-sm p-4 bg-card">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-purple-500" />
                    <h3 className="text-sm font-semibold">Bidang {cl.bidang}</h3>
                    <span className="text-[9px] font-mono bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-sm">Jenjang {cl.jenjang}</span>
                  </div>
                  <TrenBadge tren={cl.tren} />
                </div>

                <p className="text-[10px] font-mono text-primary mb-2">{cl.relevansi}</p>

                <div className="flex flex-wrap gap-1.5">
                  {cl.jabatan.map((j) => (
                    <span key={j} className="text-[10px] font-mono px-2 py-0.5 bg-muted rounded-sm border border-border text-muted-foreground">
                      {j}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 border rounded-sm bg-purple-50/50 border-purple-200">
            <p className="text-[10px] font-mono font-bold text-purple-700 mb-1">Database SKK Pemegang — lihat halaman Pemegang SKK</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Data lengkap pemegang SKK tersedia di halaman <strong>Pemegang SKK</strong> (menu sidebar). Database ini dapat digunakan untuk identifikasi kontraktor yang sudah memenuhi persyaratan kompetensi dan yang masih memiliki gap SKK.
            </p>
          </div>
        </TabsContent>

        {/* ── Radar Prospek Tab ─────────────────────────────────────────── */}
        <TabsContent value="prospek" className="mt-4">
          <div className="mb-3 flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-xs font-mono"
                placeholder="Cari nama perusahaan atau kota… · Esc reset"
                title="Tekan / untuk fokus ke pencarian"
                onFocus={(e) => e.target.select()}
                value={prospekSearch}
                onChange={(e) => setProspekSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") { setProspekSearch(""); e.currentTarget.blur(); } }}
              />
            </div>
            {Object.values(prospekNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowProspekWithNotesOnly(v => !v)}
                className={cn("h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors shrink-0", showProspekWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya prospek dengan catatan"
              >📝 Ada Catatan</button>
            )}
            {(prospekSearch || showProspekWithNotesOnly) && (
              <button
                onClick={() => { setProspekSearch(""); setShowProspekWithNotesOnly(false); }}
                className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
                title="Reset pencarian"
              >✕ Reset</button>
            )}
          </div>

          <p className="text-[10px] font-mono text-muted-foreground mb-3 flex items-center gap-2">
            {filteredProspects.length < allProspects.length
              ? <><span className="text-primary font-bold">{filteredProspects.length}</span> dari {allProspects.length} prospek</>
              : <>{filteredProspects.length} prospek teridentifikasi</>
            }
            · diurutkan berdasarkan skor potensi tertinggi
            {Object.values(prospekNotes).some(v => v?.trim()) && (
              <button
                onClick={() => setShowProspekWithNotesOnly(v => !v)}
                className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors", showProspekWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya prospek dengan catatan"
              >
                {Object.values(prospekNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
          </p>

          {filteredProspects.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Search className="h-8 w-8 opacity-30" />
              <p className="text-xs font-mono">Tidak ada prospek sesuai filter</p>
              {(prospekSearch || showProspekWithNotesOnly) && (
                <button onClick={() => { setProspekSearch(""); setShowProspekWithNotesOnly(false); }} className="text-[10px] font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset filter</button>
              )}
            </div>
          )}
          {loadingLiveData && (
            <div className="space-y-2 mb-3">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-sm bg-muted animate-pulse" />)}
            </div>
          )}
          <div className="grid gap-3">
            {filteredProspects.map((p) => {
              const scoreColor = p.skorPotensi >= 85 ? "text-emerald-600 bg-emerald-50" : p.skorPotensi >= 70 ? "text-blue-600 bg-blue-50" : "text-slate-600 bg-slate-50";
              return (
                <div key={p.id} className="group border rounded-sm p-4 bg-card hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-semibold truncate" title={p.namaPerusahaan}>{p.namaPerusahaan}</span>
                        <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm border border-border shrink-0">{p.jenis}</span>
                        <span className="text-[9px] font-mono text-muted-foreground shrink-0">{p.kota}</span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.celah.map((c) => (
                          <span key={c} className="text-[9px] font-mono px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-sm flex items-center gap-1">
                            <TriangleAlert className="h-2.5 w-2.5" />{c}
                          </span>
                        ))}
                      </div>

                      <p className="text-[10px] font-mono text-emerald-600 mt-2 flex items-center gap-1">
                        <FileText className="h-2.5 w-2.5" />
                        Est. nilai proyek: <strong>{p.estNilaiProject}</strong>
                      </p>
                    </div>

                    <div className={cn("flex flex-col items-center rounded-sm px-3 py-2 shrink-0", scoreColor)}>
                      <span className="text-lg font-bold font-mono leading-none">{p.skorPotensi}</span>
                      <span className="text-[8px] font-mono mt-0.5">Skor</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Halo, kami dari PT Maheswara Jaya Persada ingin menawarkan layanan Konsultasi ISO & K3 untuk ${p.namaPerusahaan}. Kami mengidentifikasi ada kebutuhan pada: ${p.celah.join(", ")}. Boleh kami presentasikan proposal kami?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-mono bg-emerald-600 text-white hover:bg-emerald-700 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                      title={`Hubungi ${p.namaPerusahaan} via WhatsApp`}
                      aria-label={`Hubungi ${p.namaPerusahaan} via WhatsApp`}
                    >
                      <ExternalLink className="h-3 w-3" /> Hubungi via WA
                    </a>
                    <a
                      href={`/surat-penawaran?perihal=Konsultasi ISO & K3&domain=ISO-K3`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-mono border border-primary text-primary hover:bg-primary/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    >
                      <FileText className="h-3 w-3" /> Surat Penawaran
                    </a>
                  </div>
                  {/* Per-prospect note */}
                  <div className="relative mt-2">
                    <textarea
                      value={prospekNotes[p.id] ?? ""}
                      onChange={(e) => updateProspekNote(p.id, e.target.value)}
                      onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                      onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                      placeholder="Catatan tim untuk prospek ini…"
                      rows={1}
                      maxLength={500}
                      className="w-full border rounded-sm px-2 py-1 pb-4 text-[10px] resize-none bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-background transition-colors"
                    />
                    <span className="absolute left-1 bottom-0.5 text-[8px] font-mono text-muted-foreground/50">{(prospekNotes[p.id] ?? "").length}/500</span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProspects.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-xs text-muted-foreground font-mono">
              <Search className="h-6 w-6 opacity-30" />
              <span>Tidak ada prospek yang cocok dengan pencarian</span>
              {(prospekSearch || showProspekWithNotesOnly) && (
                <button onClick={() => { setProspekSearch(""); setShowProspekWithNotesOnly(false); }} className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none text-[10px] font-mono">✕ Reset filter</button>
              )}
            </div>
          )}

          <div className="mt-4 p-3 border rounded-sm bg-card">
            <p className="text-[10px] font-mono text-muted-foreground">
              <strong className="text-foreground">Metodologi skor potensi:</strong> Kombinasi jumlah celah compliance ({">"}1 celah = skor tinggi), jenis perusahaan (BUJK = prioritas), dan estimasi nilai proyek. Data merupakan estimasi internal tim riset marketing — perlu verifikasi lapangan sebelum pendekatan.
            </p>
          </div>
        </TabsContent>
      </Tabs>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
