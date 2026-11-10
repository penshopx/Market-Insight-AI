import React from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import {
  Radar,
  Target,
  Database,
  Activity,
  ChevronRight,
  BarChart2,
  Globe2,
  Users,
  Bell,
  FileText,
  Zap,
  Search,
  AlertTriangle,
  TrendingUp,
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Building2,
  Briefcase,
  Cpu,
  Wifi,
  Lock,
  ChevronDown,
  Compass,
  Award,
  Milestone,
  Droplets,
  Flame,
  Anchor,
  Mountain,
  Leaf,
  Building,
  Star,
  Sparkles,
  Shield,
  Play,
} from "lucide-react";

/* ─── animation helpers ───────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (d = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: "easeOut", delay: d },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (d = 0) => ({
    opacity: 1,
    transition: { duration: 0.5, delay: d },
  }),
};

function FadeSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      custom={delay}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── data ────────────────────────────────────────────── */
const TERMINAL_ROWS = [
  { id: "TDR-4412", kota: "Surabaya", sektor: "JALAN TOL", status: "TENDER BUKA", color: "text-amber-400" },
  { id: "PBG-7821", kota: "Bekasi", sektor: "GEDUNG KOMERSIL", status: "BARU DITERBITKAN", color: "text-blue-400" },
  { id: "TDR-4389", kota: "Medan", sektor: "IRIGASI & AIR", status: "TENDER BUKA", color: "text-amber-400" },
  { id: "KNT-1102", kota: "Makassar", sektor: "KONTRAKTOR MK-8", status: "AKTIF", color: "text-emerald-400" },
  { id: "TDR-4401", kota: "Semarang", sektor: "EBT / SOLAR", status: "EVALUASI", color: "text-purple-400" },
];

const SOURCES = [
  "LPSE 600+ Instansi",
  "KBLI Konstruksi",
  "SKK Migas / KKKS",
  "IUJK / SBU / SKA",
  "KLHK AMDAL Net",
  "PLN e-Procurement",
  "ESDM MODI",
  "IDX Carbon",
  "RUPTL PLN",
  "Kemen PUPR",
  "BPJT Jalan Tol",
  "Kemenhub DJPT",
  "DJKA Perkeretaapian",
  "INKINDO",
  "Gapensi / APJII",
];

const PAIN_POINTS = [
  {
    icon: <Clock className="w-7 h-7 text-amber-400" />,
    title: "Riset Manual Menyita Waktu",
    desc: "Tim BD menghabiskan jam kerja produktif membuka LPSE satu per satu, menyalin data ke spreadsheet, lalu data itu sudah kedaluwarsa sebelum ditindaklanjuti.",
    tag: "Inefisiensi Operasional",
  },
  {
    icon: <XCircle className="w-7 h-7 text-red-400" />,
    title: "Tender Terlewat Tanpa Disadari",
    desc: "Tanpa pemantauan otomatis, peluang tender bernilai tinggi sering terlewat karena batas waktu pendaftaran berlalu sebelum tim sempat mengetahuinya.",
    tag: "Revenue Hilang",
  },
  {
    icon: <AlertTriangle className="w-7 h-7 text-orange-400" />,
    title: "Profil Kontraktor Tidak Terstruktur",
    desc: "Data kontraktor tersebar di berbagai registri pemerintah tanpa format seragam. Membaca kapasitas, riwayat proyek, dan risiko mitra butuh waktu berhari-hari.",
    tag: "Risiko Tersembunyi",
  },
];

const STEPS = [
  {
    num: "01",
    icon: <Database className="w-6 h-6 text-primary" />,
    title: "Agregasi Otomatis",
    desc: "Platform mengumpulkan data secara kontinu dari ratusan sumber — LPSE, KBLI, registri pemerintah, dan portal industri — tanpa campur tangan manual.",
  },
  {
    num: "02",
    icon: <Cpu className="w-6 h-6 text-chart-2" />,
    title: "Analisis & Pengayaan",
    desc: "Setiap item diproses: diskor relevansinya, dikaitkan ke profil kontraktor atau proyek yang sudah ada, dan diklasifikasikan ke sektor yang tepat.",
  },
  {
    num: "03",
    icon: <Bell className="w-6 h-6 text-amber-400" />,
    title: "Kirim ke Tim Anda",
    desc: "Notifikasi langsung ke WhatsApp atau channel pilihan Anda. Tim BD mendapat sinyal siap pakai, bukan data mentah yang butuh interpretasi.",
  },
];

const FEATURES = [
  {
    icon: <Target className="w-6 h-6 text-primary" />,
    title: "Pemantauan Tender Real-Time",
    desc: "Pantau ribuan tender dari LPSE dan portal pengadaan nasional dalam satu antarmuka.",
    accent: "border-primary/40",
    bullets: [
      "600+ instansi LPSE dipantau setiap jam",
      "Filter nilai, sektor, kota, dan instansi",
      "Alert deadline pendaftaran H-3 otomatis",
    ],
  },
  {
    icon: <Users className="w-6 h-6 text-chart-2" />,
    title: "Database Kontraktor Terstruktur",
    desc: "Profil kontraktor aktif lengkap dengan KBLI, SKK/SKA, dan riwayat proyek.",
    accent: "border-chart-2/40",
    bullets: [
      "14.000+ profil kontraktor terindeks",
      "Kapasitas keuangan & riwayat proyek aktual",
      "Hubungi via WhatsApp langsung dari platform",
    ],
  },
  {
    icon: <MapPin className="w-6 h-6 text-amber-400" />,
    title: "Intelijen Pasar Wilayah",
    desc: "Pahami konsentrasi proyek dan potensi pasar per kota dan provinsi.",
    accent: "border-amber-400/40",
    bullets: [
      "Peta panas proyek aktif per kecamatan",
      "Tren capex wilayah 24 bulan ke belakang",
      "Deteksi white-space tanpa kompetitor",
    ],
  },
  {
    icon: <FileText className="w-6 h-6 text-purple-400" />,
    title: "Workroom & Analisis Tim",
    desc: "Ruang kerja kolaboratif untuk mengolah riset lapangan menjadi pipeline prospek konkret.",
    accent: "border-purple-400/40",
    bullets: [
      "Catatan pain point terstruktur per domain",
      "Surat Penawaran terpra-isi dari data prospek",
      "Riwayat edit + kolaborasi multi-analis",
    ],
  },
  {
    icon: <BarChart2 className="w-6 h-6 text-chart-3" />,
    title: "Intel Kompetitor Langsung",
    desc: "Pantau perubahan harga, kemenangan tender, dan kapasitas kompetitor secara kontinu.",
    accent: "border-chart-3/40",
    bullets: [
      "Notifikasi saat kompetitor menang tender target",
      "Deteksi perubahan harga pasar otomatis",
      "Profil kapasitas + kemenangan historis",
    ],
  },
  {
    icon: <Layers className="w-6 h-6 text-chart-5" />,
    title: "Modul Cluster Industri",
    desc: "Coverage khusus EBT, Pertambangan, dan Lingkungan — capex tertinggi saat ini.",
    accent: "border-chart-5/40",
    bullets: [
      "RUPTL, SKK Migas, KLHK AMDAL terintegrasi",
      "Tender sektor khusus yang jarang muncul di LPSE",
      "Pipeline kredit karbon dan proyek hijau",
    ],
  },
];

const MODULE_GROUPS = [
  {
    group: "Cluster Pekerjaan",
    desc: "Data tentang proses, pelaku, dan kualifikasi dalam rantai nilai konstruksi & keteknikan",
    cols: "grid-cols-2 sm:grid-cols-4",
    items: [
      { label: "Tender & PBJ", sub: "LPSE nasional + portal swasta", icon: <Building2 className="w-5 h-5" />, color: "text-primary" },
      { label: "PBG / IMB", sub: "Izin Mendirikan Bangunan aktif", icon: <FileText className="w-5 h-5" />, color: "text-amber-400" },
      { label: "Profil Kontraktor", sub: "KBLI, IUJK, SBU aktif", icon: <Users className="w-5 h-5" />, color: "text-chart-2" },
      { label: "Profil Konsultan", sub: "Perencana, pengawas & MK", icon: <Compass className="w-5 h-5" />, color: "text-blue-300" },
      { label: "ISO, K3 & Sertifikasi", sub: "ISO 9001, SMK3, SKK, OHSAS", icon: <CheckCircle2 className="w-5 h-5" />, color: "text-teal-400" },
      { label: "Tenaga Ahli Bersertifikat", sub: "SKK, SKA per bidang keahlian", icon: <Award className="w-5 h-5" />, color: "text-yellow-300" },
      { label: "Analisis Risiko", sub: "Skor kontraktor + riwayat proyek", icon: <AlertTriangle className="w-5 h-5" />, color: "text-orange-400" },
      { label: "Notifikasi Tim", sub: "WhatsApp + channel instan", icon: <Bell className="w-5 h-5" />, color: "text-chart-5" },
    ],
  },
  {
    group: "Sektor Usaha Keteknikan",
    desc: "Sub-sektor rekayasa & konstruksi yang masing-masing punya ekosistem tender, pelaku, dan regulasi sendiri",
    cols: "grid-cols-2 sm:grid-cols-4",
    items: [
      { label: "Infrastruktur & Jalan", sub: "Tol, jembatan, jalan nasional", icon: <Milestone className="w-5 h-5" />, color: "text-primary" },
      { label: "Gedung & Properti", sub: "Komersil, hunian, kawasan industri", icon: <Building className="w-5 h-5" />, color: "text-chart-2" },
      { label: "Air, Sanitasi & Irigasi", sub: "SPAM, bendungan, drainase kota", icon: <Droplets className="w-5 h-5" />, color: "text-blue-400" },
      { label: "Kelistrikan & EBT", sub: "PLN, RUPTL, solar, angin, panas bumi", icon: <Zap className="w-5 h-5" />, color: "text-yellow-400" },
      { label: "Migas & Fasilitas Proses", sub: "SKK Migas, KKKS, kilang, LNG", icon: <Flame className="w-5 h-5" />, color: "text-red-400" },
      { label: "Kelautan & Kepelabuhanan", sub: "Dermaga, reklamasi, galangan kapal", icon: <Anchor className="w-5 h-5" />, color: "text-cyan-400" },
      { label: "Pertambangan & Mineral", sub: "IUP, smelter, tambang terbuka", icon: <Mountain className="w-5 h-5" />, color: "text-purple-400" },
      { label: "Lingkungan & Karbon", sub: "AMDAL, PROPER, kredit karbon", icon: <Leaf className="w-5 h-5" />, color: "text-emerald-400" },
    ],
  },
];

const PERSONAS = [
  {
    role: "Tim BD & Sales",
    icon: <TrendingUp className="w-8 h-8 text-primary" />,
    accent: "from-primary/10 to-primary/5 border-primary/30",
    tagColor: "text-primary bg-primary/10 border-primary/30",
    points: [
      "Prospek siap kontak langsung dari hasil riset otomatis",
      "Alert tender sebelum batas pendaftaran",
      "Surat Penawaran terpra-isi dari data prospek",
      "Intel kompetitor sebelum masuk negosiasi",
    ],
    scenario: "Senin pagi, 07:05. Sebelum rapat, Anda sudah tahu ada 3 tender baru di wilayah target dan 1 kompetitor baru masuk pasar Sulawesi. Tim Anda bisa langsung bergerak — bukan investigasi dulu 2 jam.",
  },
  {
    role: "Direktur Komersial",
    icon: <BarChart2 className="w-8 h-8 text-amber-400" />,
    accent: "from-amber-500/10 to-amber-500/5 border-amber-500/30",
    tagColor: "text-amber-400 bg-amber-400/10 border-amber-400/30",
    points: [
      "Business Health Score harian dari 8 dimensi strategis",
      "Visibilitas pipeline seluruh wilayah dalam satu layar",
      "Deteksi pasar baru berbasis data proyek aktual",
      "Laporan intelijen pasar mingguan otomatis",
    ],
    scenario: "Skor bisnis Anda hari ini: 82/100. Market Coverage masih 64 — platform sudah identifikasi 2 wilayah ekspansi berikutnya berdasarkan data capex 24 bulan terakhir. Keputusan berbasis fakta, bukan feeling.",
  },
  {
    role: "Tim Riset & Analis",
    icon: <Search className="w-8 h-8 text-chart-2" />,
    accent: "from-chart-2/10 to-chart-2/5 border-chart-2/30",
    tagColor: "text-chart-2 bg-chart-2/10 border-chart-2/30",
    points: [
      "Workroom kolaboratif untuk catatan dan analisis proyek",
      "Pencatatan pain point lapangan terstruktur per domain",
      "Riwayat edit + kolaborasi real-time antar analis",
      "AI rekomendasi solusi dari pattern pain point",
    ],
    scenario: "Analis lapangan di Medan input pain point baru dari wawancara. Di Jakarta, analis senior langsung lihat di workroom, tambahkan catatan, dan hasilkan rekomendasi produk dalam 10 menit — tanpa rapat.",
  },
];

/* ─── component ───────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Radar className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl tracking-tight uppercase">
              Intel<span className="text-primary">Konstruksi</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#masalah" className="hover:text-foreground transition-colors">Konteks</a>
            <a href="#cara-kerja" className="hover:text-foreground transition-colors">Cara Kerja</a>
            <a href="#fitur" className="hover:text-foreground transition-colors">Fitur</a>
            <a href="#untuk-siapa" className="hover:text-foreground transition-colors">Untuk Siapa</a>
            <a href="#harga" className="hover:text-foreground transition-colors">Harga</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Masuk
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-sm hover:bg-primary/90 transition-colors"
            >
              Minta Akses
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 lg:pt-48 lg:pb-24 px-6">
        {/* bg accents */}
        <div className="absolute inset-0 bg-grid-white -z-10 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/8 blur-[140px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-amber-500/5 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* left */}
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.12 } } }}>
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-6 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Sistem Aktif — Indonesia Coverage
            </motion.div>

            <motion.h1 variants={fadeUp} custom={0.05} className="text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tighter leading-[1.05] mb-6">
              Tim Intel Digital<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-cyan-400">
                Untuk Bisnis Anda.
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} custom={0.1} className="text-lg text-muted-foreground mb-4 leading-relaxed max-w-xl">
              Setiap perusahaan konstruksi Indonesia layak memiliki tim intelijen digital yang memantau pasar, menganalisis tender, membaca kompetitor, dan menghasilkan sinyal aksi setiap pagi — tanpa menambah SDM.
            </motion.p>
            <motion.p variants={fadeUp} custom={0.15} className="text-base text-muted-foreground/80 mb-8 leading-relaxed max-w-xl">
              Bukan sekadar data. Bukan sekadar dashboard. <strong className="text-foreground">Intelijen yang mengubah informasi menjadi keputusan.</strong>
            </motion.p>

            <motion.div variants={fadeUp} custom={0.2} className="flex flex-wrap gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center h-12 px-6 rounded-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-[0_0_24px_rgba(59,130,246,0.35)] hover:shadow-[0_0_32px_rgba(59,130,246,0.5)]"
              >
                Aktifkan Terminal <ChevronRight className="ml-1.5 w-4 h-4" />
              </Link>
              <a
                href="#cara-kerja"
                className="inline-flex items-center justify-center h-12 px-6 rounded-sm border border-border bg-secondary/50 text-foreground font-medium hover:bg-secondary transition-all gap-2"
              >
                Cara Kerja <ChevronDown className="w-4 h-4" />
              </a>
            </motion.div>

            {/* source pills */}
            <motion.div variants={fadeUp} custom={0.25} className="mt-8 flex flex-wrap gap-2">
              {SOURCES.slice(0, 5).map((s) => (
                <span key={s} className="text-[11px] font-mono text-muted-foreground/60 border border-border/50 rounded-sm px-2 py-0.5">
                  {s}
                </span>
              ))}
              <span className="text-[11px] font-mono text-muted-foreground/40 border border-border/30 rounded-sm px-2 py-0.5">
                +{SOURCES.length - 5} sumber lagi
              </span>
            </motion.div>
          </motion.div>

          {/* right — terminal mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative"
          >
            {/* outer glow */}
            <div className="absolute -inset-px rounded-lg bg-gradient-to-br from-primary/30 via-blue-500/10 to-transparent pointer-events-none" />
            <div className="rounded-lg border border-border bg-card shadow-2xl overflow-hidden">
              {/* title bar */}
              <div className="h-9 border-b border-border bg-secondary/80 flex items-center justify-between px-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/60 tracking-widest uppercase">
                  INTEL_KONSTRUKSI — LIVE FEED
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <Wifi className="w-3 h-3" /> LIVE
                </span>
              </div>

              {/* header row */}
              <div className="px-4 pt-3 pb-1 font-mono text-[11px] text-muted-foreground/50 grid grid-cols-4 border-b border-border/30">
                <span>ID</span>
                <span>KOTA</span>
                <span>SEKTOR</span>
                <span>STATUS</span>
              </div>

              <div className="px-4 pb-3">
                {TERMINAL_ROWS.map((row, i) => (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.12 }}
                    className="grid grid-cols-4 py-2.5 border-b border-border/20 last:border-0 font-mono text-xs hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-primary">{row.id}</span>
                    <span className="text-muted-foreground">{row.kota}</span>
                    <span className="text-foreground/70">{row.sektor}</span>
                    <span className={row.color}>{row.status}</span>
                  </motion.div>
                ))}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.4 }}
                  className="mt-3 flex items-center justify-between"
                >
                  <span className="font-mono text-xs text-primary/60 flex items-center gap-1.5">
                    <span className="animate-pulse">▋</span> Memproses data baru…
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/40">
                    UPDATED: {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                  </span>
                </motion.div>
              </div>

              {/* bottom status bar */}
              <div className="border-t border-border/30 bg-secondary/30 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> SISTEM NORMAL
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/40">|</span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">CRAWL AKTIF</span>
                </div>
                <Lock className="w-3 h-3 text-muted-foreground/30" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Data Sources Banner ─────────────────────────── */}
      <div className="border-y border-border/50 bg-secondary/20 py-3 overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="flex gap-8 whitespace-nowrap"
        >
          {[...SOURCES, ...SOURCES].map((s, i) => (
            <span key={i} className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-primary/50 inline-block" />
              {s}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── Demo Video ──────────────────────────────────── */}
      <section className="py-20 px-6 bg-secondary/5">
        <div className="max-w-5xl mx-auto">
          <FadeSection className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-5 uppercase tracking-wider">
              <Play className="w-3 h-3" /> Live Demo Platform
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Lihat Cara Kerjanya
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Dari ratusan sumber data publik ke briefing intelijen siap-eksekusi — proses otomatis yang bekerja setiap malam saat tim Anda tidur.
            </p>
          </FadeSection>

          <FadeSection>
            <div className="relative max-w-4xl mx-auto">
              <div className="relative rounded-xl overflow-hidden border border-primary/20 shadow-[0_0_80px_-15px_rgba(59,130,246,0.35)] bg-background">
                {/* chrome bar */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/50 bg-card/80 backdrop-blur-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  <span className="ml-3 text-[10px] font-mono text-muted-foreground/50 tracking-wide">
                    intel-konstruksi — proses riset harian
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-emerald-400">LIVE</span>
                  </span>
                </div>
                {/* iframe — riset-video artifact */}
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    src="/riset-video/"
                    className="absolute inset-0 w-full h-full border-0"
                    title="Demo Platform Intel Konstruksi"
                    allow="autoplay"
                    loading="eager"
                  />
                </div>
              </div>
              <p className="text-center text-[11px] font-mono text-muted-foreground/40 mt-3 tracking-widest uppercase">
                Animasi proses — dari 600+ sumber data ke briefing pagi tim Anda
              </p>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Problem Section ─────────────────────────────── */}
      <section id="masalah" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-mono mb-5 uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3" /> Realitas Tim BD Konstruksi
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
              Bukan Kurang Kerja Keras.<br />
              <span className="text-muted-foreground font-normal">Kurang Intelijen yang Tepat.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Tim sales konstruksi paling produktif pun kesulitan apabila data yang mereka andalkan tersebar, lambat, dan tidak terstruktur. Ini bukan masalah SDM — ini masalah sistem.
            </p>
          </FadeSection>

          {/* market illustration */}
          <FadeSection className="mb-14">
            <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-lg max-w-4xl mx-auto">
              <img
                src={`${import.meta.env.BASE_URL}illus-market.jpg`}
                alt="Skala industri konstruksi Indonesia"
                className="w-full h-auto object-cover max-h-64 object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
              <div className="absolute bottom-4 left-6">
                <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                  Konstruksi Indonesia · Rp 2.400T+ nilai proyek aktif · 14K+ kontraktor terdaftar
                </span>
              </div>
            </div>
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-6">
            {PAIN_POINTS.map((p, i) => (
              <FadeSection key={i} delay={i * 0.1} className="relative p-6 rounded-lg border border-border bg-card/50 overflow-hidden group hover:border-border/80 transition-colors">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                <div className="mb-4">{p.icon}</div>
                <div className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">{p.tag}</div>
                <h3 className="text-lg font-bold mb-3">{p.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────── */}
      <section id="cara-kerja" className="py-24 px-6 bg-secondary/10 border-y border-border/50">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-5 uppercase tracking-wider">
              <Cpu className="w-3 h-3" /> Cara Kerja Platform
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Data Mentah Jadi Sinyal Aksi
            </h2>
            <p className="text-muted-foreground text-lg">
              Lima lapisan proses yang mengubah ratusan sumber data publik menjadi intelijen siap pakai — dikirim langsung ke tim Anda setiap pagi.
            </p>
          </FadeSection>

          {/* video embed */}
          <FadeSection className="mb-16">
            <div className="relative max-w-4xl mx-auto">
              <div className="relative rounded-xl overflow-hidden border border-primary/20 shadow-[0_0_60px_-10px_rgba(var(--primary),0.25)] bg-background">
                {/* chrome bar */}
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/50 bg-card/80 backdrop-blur-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  <span className="ml-3 text-[10px] font-mono text-muted-foreground/50 tracking-wide">
                    intel-konstruksi — proses riset harian
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-emerald-400">LIVE</span>
                  </span>
                </div>
                {/* iframe */}
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    src="/riset-video/"
                    className="absolute inset-0 w-full h-full border-0"
                    title="Proses Riset Intel Konstruksi"
                    allow="autoplay"
                    loading="lazy"
                  />
                </div>
              </div>
              <p className="text-center text-xs font-mono text-muted-foreground/40 mt-3 tracking-wide uppercase">
                Animasi proses — dari 600+ sumber data ke briefing pagi tim Anda
              </p>
            </div>
          </FadeSection>

          {/* pipeline flow */}
          <FadeSection className="mb-16">
            <div className="relative overflow-x-auto">
              <div className="flex items-stretch gap-0 min-w-[640px]">
                {[
                  { num: "01", label: "Aggregasi", sublabel: "Crawl Otomatis", color: "text-blue-400 border-blue-400/30 bg-blue-400/5", stat: "600+", statLabel: "sumber aktif" },
                  { num: "02", label: "Normalisasi", sublabel: "Schema Seragam", color: "text-violet-400 border-violet-400/30 bg-violet-400/5", stat: "48 jt", statLabel: "record bersih" },
                  { num: "03", label: "Enrichment", sublabel: "AI Konteksualisasi", color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5", stat: "94%", statLabel: "akurasi relevansi" },
                  { num: "04", label: "Scoring", sublabel: "Skor Prioritas", color: "text-amber-400 border-amber-400/30 bg-amber-400/5", stat: "14 K", statLabel: "kontraktor terprofilkan" },
                  { num: "05", label: "Delivery", sublabel: "WA · Email · API", color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5", stat: "07:00", statLabel: "briefing dikirim" },
                ].map((s, i) => (
                  <div key={i} className="flex items-stretch flex-1">
                    <div className={`flex-1 p-4 rounded-sm border ${s.color} flex flex-col justify-between gap-3`}>
                      <div>
                        <span className="text-[9px] font-mono text-muted-foreground/40">{s.num}</span>
                        <p className="text-sm font-bold mt-0.5">{s.label}</p>
                        <p className="text-[10px] font-mono text-muted-foreground/60">{s.sublabel}</p>
                      </div>
                      <div>
                        <p className="text-xl font-black font-mono">{s.stat}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60">{s.statLabel}</p>
                      </div>
                    </div>
                    {i < 4 && (
                      <div className="flex items-center px-1 shrink-0">
                        <ArrowRight className="w-4 h-4 text-border/60" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </FadeSection>

          {/* 3 pillars */}
          <div className="grid md:grid-cols-3 gap-0 relative">
            <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px bg-gradient-to-r from-primary/50 via-chart-2/50 to-amber-400/50" />
            {STEPS.map((step, i) => (
              <FadeSection key={i} delay={i * 0.15} className="relative p-8 text-center">
                <div className="relative inline-flex mb-6">
                  <div className="w-14 h-14 rounded-full border border-border bg-card flex items-center justify-center">
                    {step.icon}
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border border-border text-[9px] font-mono text-muted-foreground flex items-center justify-center">
                    {step.num}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                {i < STEPS.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-12 -right-3 w-6 h-6 text-border z-10" />
                )}
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section id="fitur" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-5 uppercase tracking-wider">
              <Layers className="w-3 h-3" /> Kapabilitas Platform
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Semua yang Dibutuhkan Tim BD
            </h2>
            <p className="text-muted-foreground text-lg">
              Dari pemantauan tender sampai profil kontraktor mendalam — dirancang untuk siklus penjualan proyek konstruksi Indonesia.
            </p>
          </FadeSection>

          {/* platform screenshot */}
          <FadeSection className="mb-10">
            <div className="relative rounded-xl overflow-hidden border border-primary/20 shadow-[0_0_60px_-15px_rgba(59,130,246,0.2)]">
              <img
                src={`${import.meta.env.BASE_URL}illus-dashboard.jpg`}
                alt="Platform dashboard Intel Konstruksi — tender monitoring, competitor intel, SKK tracking"
                className="w-full h-auto object-cover max-h-80 object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-6 py-5 flex items-end justify-between">
                <div>
                  <p className="text-xs font-mono text-primary/80 uppercase tracking-widest mb-1">Platform Preview</p>
                  <p className="text-sm font-semibold text-foreground/90">Dashboard Intel Konstruksi — tampilan tim BD aktif</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-emerald-400">LIVE</span>
                </div>
              </div>
            </div>
          </FadeSection>

          {/* feature spotlight — top row, full width highlight */}
          <FadeSection className="mb-6">
            <div className="relative p-8 rounded-lg border border-primary/30 bg-gradient-to-br from-primary/8 via-card to-card overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-primary/60 via-blue-400/40 to-transparent" />
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              <div className="grid md:grid-cols-2 gap-8 items-center relative z-10">
                <div>
                  <div className="mb-4 p-3 rounded-md bg-primary/15 inline-block">
                    <Activity className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Notifikasi Proaktif ke Tim</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Platform mengirim alert otomatis ke WhatsApp group tim Anda ketika ada tender baru, PBG diterbitkan di kota target, atau kontraktor prospek memperbarui statusnya. Tim tidak perlu membuka platform — informasi yang datang ke mereka.
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">Konfigurasi per kota, sektor, atau kategori prospek</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Tender LPSE Baru", kota: "Bandung", val: "Jalan Tol Akses Pelabuhan", time: "Baru saja" },
                    { label: "PBG Diterbitkan", kota: "Surabaya", val: "Gedung Komersil 18 Lantai", time: "14 mnt lalu" },
                    { label: "Kontraktor Aktif", kota: "Jakarta", val: "SKK Grade 8 — Kapasitas Besar", time: "1 jam lalu" },
                  ].map((n, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="flex items-start gap-3 p-3 rounded-md bg-secondary/60 border border-border/50"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0 animate-pulse" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-primary/80 uppercase">{n.label}</span>
                          <span className="text-[11px] text-muted-foreground/50 font-mono flex-shrink-0">{n.time}</span>
                        </div>
                        <div className="text-sm text-foreground/80 truncate">{n.val}</div>
                        <div className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {n.kota}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </FadeSection>

          {/* feature grid */}
          <div className="grid md:grid-cols-3 gap-4">
            {FEATURES.map((feat, i) => (
              <FadeSection key={i} delay={i * 0.08} className={`p-6 rounded-lg border bg-card/50 hover:bg-card transition-all group hover:${feat.accent} border-border flex flex-col`}>
                <div className="mb-4 p-2.5 rounded-md bg-secondary inline-block group-hover:scale-105 transition-transform">
                  {feat.icon}
                </div>
                <h3 className="text-base font-bold mb-2">{feat.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">{feat.desc}</p>
                <ul className="mt-auto space-y-2">
                  {feat.bullets.map((b, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground/70">
                      <span className="mt-0.5 w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
                      {b}
                    </li>
                  ))}
                </ul>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Briefing Pagi Preview ───────────────────────── */}
      <section className="py-24 px-6 bg-secondary/10 border-y border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* copy */}
            <FadeSection>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-mono mb-6 uppercase tracking-wider">
                <Bell className="w-3 h-3" /> Briefing Pagi Otomatis — 07:00 WIB
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Tim Anda Sudah Tahu<br />
                Sebelum Kantor Buka.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Setiap pagi pukul 07:00, platform mengirim ringkasan intelijen ke WhatsApp dan email seluruh tim — tanpa ada yang perlu membuka dashboard. 5 poin terpenting, sudah diprioritaskan, siap dieksekusi.
              </p>
              <div className="space-y-3">
                {[
                  { icon: <Bell className="w-4 h-4 text-amber-400" />, text: "Tender baru yang relevan dengan profil bisnis Anda" },
                  { icon: <TrendingUp className="w-4 h-4 text-blue-400" />, text: "Perubahan harga dan taktik kompetitor yang terdeteksi" },
                  { icon: <AlertTriangle className="w-4 h-4 text-red-400" />, text: "Prospek yang mendekati deadline tanpa follow-up" },
                  { icon: <FileText className="w-4 h-4 text-violet-400" />, text: "Update regulasi LPJK, SKK, dan perizinan baru" },
                  { icon: <BarChart2 className="w-4 h-4 text-emerald-400" />, text: "Progress terhadap target revenue bulan ini" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="shrink-0">{item.icon}</div>
                    <span className="text-sm text-muted-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
            </FadeSection>

            {/* WhatsApp-style mockup */}
            <FadeSection delay={0.15}>
              <div className="relative max-w-sm mx-auto lg:mx-0 lg:ml-auto">
                {/* phone frame */}
                <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
                  {/* status bar */}
                  <div className="bg-[#128C7E] px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Radar className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold leading-tight">Intel Konstruksi</p>
                      <p className="text-white/70 text-[10px]">Tim BD MJP · Briefing Pagi</p>
                    </div>
                    <span className="text-white/60 text-[10px] font-mono">07:02</span>
                  </div>

                  {/* chat body */}
                  <div className="bg-[#ECE5DD] dark:bg-zinc-800 p-3 space-y-2 min-h-[340px]">
                    {/* timestamp */}
                    <div className="text-center">
                      <span className="text-[10px] bg-black/20 text-white/80 rounded px-2 py-0.5 font-mono">
                        Hari ini · 07:02
                      </span>
                    </div>

                    {/* message bubble */}
                    <div className="bg-white dark:bg-zinc-700 rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                      <p className="text-[11px] font-bold text-[#128C7E] mb-2">📊 BRIEFING PAGI — 4 Agustus 2026</p>
                      <div className="space-y-2 text-[11px] leading-snug text-zinc-800 dark:text-zinc-200">
                        <div className="flex gap-2">
                          <span className="text-red-500 font-bold shrink-0">🔴 1.</span>
                          <span><strong>URGENT:</strong> 6 prospek SKK Jabar belum dihubungi. Pipeline Rp 37.8jt, deadline 3 hari.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-blue-500 font-bold shrink-0">🔵 2.</span>
                          <span><strong>PELUANG:</strong> 4 tender Papua Barat Rp 142M terdeteksi — 0 kompetitor qualified.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-amber-500 font-bold shrink-0">🟡 3.</span>
                          <span><strong>INTEL:</strong> Kompetitor A turun harga 18%. Klien CV Maju bertanya harga kemarin.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-violet-500 font-bold shrink-0">🟣 4.</span>
                          <span><strong>REGULASI:</strong> LPJK v3.0 — format SKK elektronik berubah per 15 Agustus.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-emerald-500 font-bold shrink-0">🟢 5.</span>
                          <span><strong>TARGET:</strong> Revenue 84% dari target. Butuh Rp 47jt lagi dalam 29 hari.</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-2 text-right">07:02 ✓✓</p>
                    </div>

                    {/* read status */}
                    <div className="flex justify-end">
                      <div className="bg-[#DCF8C6] dark:bg-emerald-800/60 rounded-lg rounded-br-none p-2 max-w-[70%] shadow-sm">
                        <p className="text-[11px] text-zinc-700 dark:text-zinc-200">Siap! Langsung follow-up Jabar 👍</p>
                        <p className="text-[10px] text-zinc-400 text-right mt-0.5">07:05 ✓✓</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* floating badge */}
                <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full shadow-lg">
                  LIVE · 07:02 WIB
                </div>
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ── Intelligence Modules ────────────────────────── */}
      <section className="py-20 px-6 bg-secondary/10 border-y border-border/50">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-14 max-w-xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              Enam Belas Modul Intelijen
            </h2>
            <p className="text-muted-foreground">
              Cluster pekerjaan & profesi konstruksi — dan sub-sektor keteknikan yang masing-masing punya ekosistem sendiri.
            </p>
          </FadeSection>

          <div className="space-y-10">
            {MODULE_GROUPS.map((group, gi) => (
              <div key={gi}>
                {/* group header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground/50 whitespace-nowrap">
                    {group.group}
                  </div>
                  <div className="flex-1 h-px bg-border/50" />
                  <div className="text-xs text-muted-foreground/40 hidden sm:block max-w-xs text-right">
                    {group.desc}
                  </div>
                </div>
                {/* items */}
                <div className={`grid ${group.cols} gap-3`}>
                  {group.items.map((m, i) => (
                    <FadeSection
                      key={i}
                      delay={gi * 0.1 + i * 0.05}
                      className="p-4 rounded-lg border border-border bg-card/40 hover:bg-card/80 transition-colors"
                    >
                      <div className={`mb-2 ${m.color}`}>{m.icon}</div>
                      <div className="font-semibold text-sm mb-1">{m.label}</div>
                      <div className="text-[11px] text-muted-foreground/60 font-mono">{m.sub}</div>
                    </FadeSection>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Who ─────────────────────────────────────── */}
      <section id="untuk-siapa" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-chart-2/30 bg-chart-2/10 text-chart-2 text-xs font-mono mb-5 uppercase tracking-wider">
              <Briefcase className="w-3 h-3" /> Untuk Tim Anda
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Satu Platform, Tiga Peran
            </h2>
            <p className="text-muted-foreground text-lg">
              Dirancang agar setiap pemangku kepentingan mendapat nilai langsung — bukan hanya analis data.
            </p>
          </FadeSection>

          {/* team illustration */}
          <FadeSection className="mb-12">
            <div className="relative rounded-xl overflow-hidden border border-border/40 shadow-lg max-w-3xl mx-auto">
              <img
                src={`${import.meta.env.BASE_URL}illus-team.jpg`}
                alt="Tim BD konstruksi menggunakan Intel Konstruksi di kantor"
                className="w-full h-auto object-cover max-h-56 object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-6">
                <span className="text-[10px] font-mono text-muted-foreground/70 uppercase tracking-widest">
                  Tim BD yang sudah menggunakan platform sebelum kantor buka
                </span>
              </div>
            </div>
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-6">
            {PERSONAS.map((p, i) => (
              <FadeSection key={i} delay={i * 0.12} className={`p-7 rounded-lg border bg-gradient-to-br ${p.accent} flex flex-col`}>
                <div className="mb-4">{p.icon}</div>
                <div className={`inline-flex self-start items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider mb-3 ${p.tagColor}`}>
                  {p.role}
                </div>
                <ul className="space-y-2.5 mb-5">
                  {p.points.map((pt, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-chart-2 mt-0.5 flex-shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
                {/* scenario vignette */}
                <div className="mt-auto pt-4 border-t border-border/40">
                  <p className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mb-2">Skenario Nyata</p>
                  <p className="text-xs text-muted-foreground/80 leading-relaxed italic">"{p.scenario}"</p>
                </div>
              </FadeSection>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-chart-2/30 bg-chart-2/10 text-chart-2 text-xs font-mono mb-5 uppercase tracking-wider">
              <Users className="w-3 h-3" /> Beta Pengguna Awal
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Tim yang Sudah Merasakannya
            </h2>
            <p className="text-muted-foreground">
              Perusahaan konstruksi dari Jawa hingga Kalimantan yang menjadi pengguna awal platform.
            </p>
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                quote: "Dulu tim kami 3 jam sehari buka LPSE satu per satu. Sekarang briefing sudah masuk WA sebelum kami sampai kantor. Minggu pertama langsung dapat 2 tender baru yang sebelumnya terlewat.",
                name: "Direktur BD",
                company: "Kontraktor Infrastruktur · Bandung",
                stat: "↑ 3× tender terdeteksi",
                color: "border-blue-400/20 bg-blue-400/5",
              },
              {
                quote: "Yang paling berguna adalah intel kompetitor. Kami akhirnya tahu kapan harga mereka berubah dan bisa adjust penawaran lebih cepat. Win rate tender kami naik signifikan dalam 2 bulan.",
                name: "Manajer Proyek Senior",
                company: "Kontraktor MEP · Surabaya",
                stat: "↑ 40% win rate tender",
                color: "border-emerald-400/20 bg-emerald-400/5",
              },
              {
                quote: "Fitur SKK Tracker yang paling sering kami pakai. Kami tahu 30 hari sebelum sertifikasi klien expire — cukup waktu untuk follow up sebelum kompetitor masuk. Ini game changer untuk tim akreditasi kami.",
                name: "Kepala Operasional",
                company: "Konsultan Akreditasi · Jakarta",
                stat: "↓ 0 prospek SKK terlewat",
                color: "border-amber-400/20 bg-amber-400/5",
              },
            ].map((t, i) => (
              <FadeSection key={i} delay={i * 0.1} className={`p-6 rounded-lg border ${t.color} flex flex-col gap-4`}>
                <div className="flex gap-0.5 mb-1">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.quote}"</p>
                <div className="pt-3 border-t border-border/40">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-muted-foreground/60 font-mono">{t.company}</p>
                  <p className="text-xs text-chart-2 font-mono font-bold mt-1">{t.stat}</p>
                </div>
              </FadeSection>
            ))}
          </div>

          {/* stats bar */}
          <FadeSection>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-lg border border-border bg-card/50">
              {[
                { val: "600+", label: "Sumber Data Aktif" },
                { val: "48 jt", label: "Record Terindeks" },
                { val: "14 K+", label: "Kontraktor Terprofilkan" },
                { val: "< 15 mnt", label: "Latensi Intel Baru" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-black font-mono text-foreground mb-1">{s.val}</p>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Business Health Score Teaser ────────────────── */}
      <section className="py-24 px-6 bg-secondary/10 border-y border-border/50">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-14 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono mb-5 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" /> Fitur Viral — Setiap Pagi
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Skor Kesehatan Bisnis<br />
              <span className="text-muted-foreground font-normal">Langsung ke Layar Anda.</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Setiap pagi platform mengkalkulasi kondisi bisnis Anda dari 8 dimensi strategis — dan memberi tahu apa yang harus dilakukan hari ini.
            </p>
          </FadeSection>

          <FadeSection>
            <div className="max-w-2xl mx-auto">
              <div className="relative rounded-lg border border-border bg-card shadow-2xl overflow-hidden">
                {/* header */}
                <div className="border-b border-border/50 bg-secondary/60 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-red-400" />
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">BUSINESS HEALTH INDEX — 04 Agustus 2026</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> LIVE
                  </span>
                </div>

                <div className="p-5">
                  {/* overall score */}
                  <div className="flex items-center gap-5 mb-6 pb-5 border-b border-border/40">
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 80 80" className="absolute inset-0 w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(215,28%,17%)" strokeWidth="8" />
                        <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(217.2,91.2%,59.8%)" strokeWidth="8"
                          strokeDasharray={`${0.82 * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
                          strokeLinecap="round" />
                      </svg>
                      <span className="text-2xl font-black font-mono text-primary z-10">82</span>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Overall Health Score</p>
                      <p className="text-3xl font-black font-mono text-primary leading-none mb-1">82 <span className="text-lg text-muted-foreground font-normal">/ 100</span></p>
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-sm">
                        ● SEHAT
                      </span>
                    </div>
                    <div className="ml-auto hidden sm:block text-right">
                      <p className="text-[10px] font-mono text-muted-foreground mb-1">Focus area hari ini:</p>
                      <p className="text-xs font-mono font-bold text-orange-400">Market Coverage (64)</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Tambah 2 tim lapangan</p>
                    </div>
                  </div>

                  {/* dimension grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                    {[
                      { dim: "Pasar & Tender", score: 87, delta: "+12pp", c: "bg-emerald-500" },
                      { dim: "Retensi Klien", score: 91, delta: "+4pp", c: "bg-emerald-600" },
                      { dim: "Data Intelligence", score: 83, delta: "+9pp", c: "bg-emerald-400" },
                      { dim: "Produktivitas Tim", score: 76, delta: "+3pp", c: "bg-blue-400" },
                      { dim: "Kecepatan Produk", score: 71, delta: "+7pp", c: "bg-blue-300" },
                      { dim: "Jangkauan Pasar", score: 64, delta: "+15pp", c: "bg-orange-400" },
                      { dim: "Kesehatan Keuangan", score: 89, delta: "+6pp", c: "bg-emerald-500" },
                      { dim: "Risiko Kepatuhan", score: 95, delta: "+1pp", c: "bg-emerald-600" },
                    ].map((m) => (
                      <div key={m.dim} className="border border-border/60 rounded-sm p-2.5 bg-secondary/30">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-mono text-muted-foreground leading-tight">{m.dim}</p>
                          <span className="text-[9px] font-mono font-bold text-emerald-400">{m.delta}</span>
                        </div>
                        <p className="text-xl font-black font-mono text-foreground leading-none mb-1.5">{m.score}</p>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${m.c} rounded-full transition-all`} style={{ width: `${m.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* action items */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Aksi Hari Ini</p>
                    {[
                      { color: "bg-red-400", label: "URGENT", text: "6 prospek SKK Jabar belum dihubungi — pipeline Rp 37.8jt, deadline 3 hari." },
                      { color: "bg-blue-400", label: "PELUANG", text: "4 tender Papua Barat Rp 142M — 0 kompetitor terdeteksi. Cocok untuk 2 klien aktif." },
                      { color: "bg-amber-400", label: "INTEL", text: "Kompetitor turun harga 18%. Siapkan counter-offer untuk klien CV Maju." },
                    ].map((a) => (
                      <div key={a.label} className="flex items-start gap-2.5 p-2.5 rounded-sm bg-secondary/40 border border-border/40">
                        <div className={`w-1.5 h-1.5 rounded-full ${a.color} mt-1.5 shrink-0`} />
                        <div>
                          <span className="text-[9px] font-mono font-bold text-muted-foreground mr-1.5">{a.label}</span>
                          <span className="text-[11px] text-foreground/80">{a.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────── */}
      <section id="harga" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <FadeSection className="text-center mb-16 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-5 uppercase tracking-wider">
              <Star className="w-3 h-3" /> Paket Langganan Intel
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Pilih Level Intel Anda
            </h2>
            <p className="text-muted-foreground text-lg">
              Bukan sekadar software — ini adalah Tim Intel Digital Anda. Mulai dari tim kecil hingga holding nasional.
            </p>
          </FadeSection>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter */}
            <FadeSection delay={0} className="relative p-7 rounded-lg border border-border bg-card/50 flex flex-col">
              <div className="mb-6">
                <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Intel Konstruksi</div>
                <div className="text-4xl font-black font-mono text-foreground mb-1">
                  499<span className="text-lg font-normal text-muted-foreground">rb</span>
                </div>
                <div className="text-sm text-muted-foreground font-mono">/bulan · per perusahaan</div>
              </div>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Untuk tim BD yang ingin berhenti menebak dan mulai bergerak berdasarkan sinyal pasar nyata.
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {["Briefing Pagi otomatis", "Intel Tender (LPSE nasional)", "Intel Kompetitor dasar", "Intel Proyek & PBG", "Notifikasi WhatsApp", "3 pengguna aktif"].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-chart-2 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" className="block text-center py-2.5 rounded-sm border border-border text-sm font-medium hover:bg-secondary transition-colors">
                Minta Akses
              </Link>
            </FadeSection>

            {/* Pro — highlighted */}
            <FadeSection delay={0.1} className="relative p-7 rounded-lg border border-primary/60 bg-gradient-to-b from-primary/10 via-card to-card flex flex-col shadow-[0_0_40px_rgba(59,130,246,0.15)]">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono font-bold uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> Paling Populer
                </span>
              </div>
              <div className="mb-6 mt-2">
                <div className="text-xs font-mono text-primary uppercase tracking-widest mb-2">Intel Bisnis Pro</div>
                <div className="text-4xl font-black font-mono text-foreground mb-1">
                  1.5<span className="text-lg font-normal text-muted-foreground">jt</span>
                </div>
                <div className="text-sm text-muted-foreground font-mono">/bulan · per perusahaan</div>
              </div>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Untuk perusahaan yang membutuhkan Tim Intel lengkap — dari riset lapangan hingga workroom keputusan.
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Semua fitur Starter",
                  "Business Health Score harian",
                  "Workroom Analisis Tim",
                  "Intel Regulasi (ISO, K3, SKK)",
                  "Modul Cluster Industri (EBT, Tambang, Lingkungan)",
                  "Database Kontraktor lengkap",
                  "Surat Penawaran terpra-isi",
                  "10 pengguna aktif",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up" className="block text-center py-2.5 rounded-sm bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                Mulai Sekarang
              </Link>
            </FadeSection>

            {/* Enterprise */}
            <FadeSection delay={0.2} className="relative p-7 rounded-lg border border-amber-500/30 bg-gradient-to-b from-amber-500/5 via-card to-card flex flex-col">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
              <div className="mb-6">
                <div className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">Intel Enterprise</div>
                <div className="text-4xl font-black font-mono text-foreground mb-1">
                  Kustom
                </div>
                <div className="text-sm text-muted-foreground font-mono">/bulan · sesuai skala</div>
              </div>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Untuk holding dan korporasi yang membutuhkan Tim Intel skala penuh dengan API, integrasi ERP, dan dedicated support.
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Semua fitur Pro",
                  "API akses penuh",
                  "Integrasi ERP / CRM",
                  "Dedicated Intelligence Team",
                  "Custom workflow & mission",
                  "White-label portal",
                  "Pengguna tidak terbatas",
                  "SLA 99.9% uptime",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:hello@intelkonstruksi.id" className="block text-center py-2.5 rounded-sm border border-amber-500/50 text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-colors">
                Hubungi Tim Kami
              </a>
            </FadeSection>
          </div>

          <FadeSection className="text-center mt-10">
            <p className="text-sm text-muted-foreground/60 font-mono">
              Semua paket termasuk onboarding · Pembayaran tahunan dapat diskon 20% · Uji coba 14 hari
            </p>
          </FadeSection>
        </div>
      </section>

      {/* ── Before / After ───────────────────────────────── */}
      <section className="py-24 px-6 bg-secondary/10 border-y border-border/50">
        <div className="max-w-5xl mx-auto">
          <FadeSection className="text-center mb-14 max-w-xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Hari Kerja Tim BD —<br />
              <span className="text-muted-foreground font-normal">Sebelum vs. Sesudah</span>
            </h2>
            <p className="text-muted-foreground">Bukan janji fitur. Perubahan nyata dalam pola kerja harian tim Anda.</p>
          </FadeSection>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Before */}
            <FadeSection delay={0} className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
              <div className="flex items-center gap-2 mb-5">
                <XCircle className="w-5 h-5 text-red-400" />
                <span className="text-sm font-bold text-red-400 font-mono uppercase tracking-wider">Tanpa Intel Konstruksi</span>
              </div>
              <div className="space-y-3">
                {[
                  { time: "07:30", text: "Buka 12 tab LPSE berbeda satu per satu" },
                  { time: "09:00", text: "Copy-paste data ke spreadsheet — 1.5 jam hilang" },
                  { time: "10:30", text: "Rapat BD: tidak ada data, semua intuitif" },
                  { time: "13:00", text: "Tender deadline kemarin baru ketahuan hari ini" },
                  { time: "15:00", text: "Tim riset kirim laporan via email — ada di mana?" },
                  { time: "17:00", text: "Tutup hari: prospek mana yang harus difollow-up?" },
                ].map((r) => (
                  <div key={r.time} className="flex items-start gap-3 text-sm">
                    <span className="font-mono text-[11px] text-muted-foreground/50 w-10 shrink-0 pt-0.5">{r.time}</span>
                    <div className="flex items-start gap-2 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 mt-1.5 shrink-0" />
                      <span className="text-muted-foreground/70">{r.text}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-red-500/20">
                <p className="text-xs font-mono text-red-400">~3 jam/hari terbuang · Banyak peluang terlewat · Tim frustrasi</p>
              </div>
            </FadeSection>

            {/* After */}
            <FadeSection delay={0.1} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-bold text-emerald-400 font-mono uppercase tracking-wider">Dengan Intel Konstruksi</span>
              </div>
              <div className="space-y-3">
                {[
                  { time: "07:02", text: "Briefing 5 poin sudah di WhatsApp — baca di jalan" },
                  { time: "07:45", text: "Rapat BD: semua tahu peluang & ancaman hari ini" },
                  { time: "09:00", text: "Follow-up 3 prospek prioritas dari pipeline otomatis" },
                  { time: "10:30", text: "Alert: tender baru Rp 45M di wilayah target masuk" },
                  { time: "13:00", text: "Analis input pain point baru — langsung masuk workroom" },
                  { time: "16:30", text: "Surat Penawaran untuk prospek baru terpra-isi siap kirim" },
                ].map((r) => (
                  <div key={r.time} className="flex items-start gap-3 text-sm">
                    <span className="font-mono text-[11px] text-muted-foreground/50 w-10 shrink-0 pt-0.5">{r.time}</span>
                    <div className="flex items-start gap-2 flex-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span className="text-foreground/80">{r.text}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-emerald-500/20">
                <p className="text-xs font-mono text-emerald-400">3 jam/hari dikembalikan · 0 tender terlewat · Tim bergerak cepat</p>
              </div>
            </FadeSection>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="py-24 px-6 relative overflow-hidden border-t border-border/50">
        <div className="absolute inset-0 bg-grid-white -z-10 pointer-events-none opacity-50" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 w-[700px] h-[300px] bg-primary/8 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-3xl mx-auto text-center">
          <FadeSection>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono mb-6 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
              Setiap Hari Tanpa Intel = Peluang Hilang
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight">
              Tim Anda Layak Mendapat<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">
                Senjata yang Tepat.
              </span>
            </h2>

            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
              Intel Konstruksi bukan sekadar alat pengumpul data. Ini adalah keunggulan kompetitif yang terstruktur — sebelum kompetitor Anda memilikinya lebih dulu.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center h-14 px-10 rounded-sm bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 transition-all shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:-translate-y-0.5 gap-2"
              >
                Minta Akses Terminal <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="mailto:hello@intelkonstruksi.id?subject=Demo%20Request%20-%20Intel%20Konstruksi"
                className="inline-flex items-center justify-center h-14 px-8 rounded-sm border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all gap-2"
              >
                <Globe2 className="w-4 h-4" /> Jadwalkan Demo
              </a>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground/60 font-mono">
              <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Koneksi Terenkripsi</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> Akses Ditinjau Tim Kami</span>
              <span className="flex items-center gap-1.5"><Wifi className="w-3 h-3" /> Update Harian Otomatis</span>
              <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> Uji Coba 14 Hari</span>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-border bg-card py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <Radar className="w-6 h-6 text-primary" />
                <span className="font-bold text-lg tracking-tight uppercase">
                  Intel<span className="text-primary">Konstruksi</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-xs">
                Tim Intel Digital untuk perusahaan konstruksi Indonesia — mengubah data menjadi intelijen, dan intelijen menjadi keputusan.
              </p>
            </div>
            <div>
              <div className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wider mb-3">Platform</div>
              <div className="space-y-2">
                {["Cara Kerja", "Fitur", "Untuk Siapa", "Harga", "Minta Akses"].map((l) => (
                  <div key={l}>
                    <a href="#" className="text-sm text-muted-foreground/60 hover:text-foreground transition-colors">{l}</a>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-mono text-muted-foreground/50 uppercase tracking-wider mb-3">Status Sistem</div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  Crawl Engine: AKTIF
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  API: NORMAL
                </div>
                <div className="flex items-center gap-2 text-muted-foreground/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-border inline-block" />
                  Last update: hari ini
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border/50 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-xs text-muted-foreground/40 font-mono">
              © {new Date().getFullYear()} Intel Konstruksi. Platform untuk profesional konstruksi Indonesia.
            </p>
            <p className="text-xs text-muted-foreground/30 font-mono">
              DATA DARI SUMBER PUBLIK & RESMI • INTERNAL USE ONLY
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
