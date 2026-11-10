import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListResearchItems, useGetTrendingTopics } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Activity, TriangleAlert, BadgeCheck, ChartBar, Bell, BookOpen, BookOpenCheck, Calculator, Calendar, CalendarDays, CircleCheck, ChevronDown, ChevronRight, ChevronUp, Clock, Coins, Copy, Check, Cpu, DollarSign, ExternalLink, Eye, FileText, ListFilter, Flame, Globe, HardHat, Hourglass, Info, Landmark, Network, RefreshCw, Scale, Search, SearchCode, Shield, ShieldAlert, ShieldCheck, Star, Target, Telescope, TrendingUp, Users, CircleX, X, Zap } from "lucide-react";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// Persist "ditindaklanjuti" state in localStorage per regulation
function useFollowedUpSet() {
  const LS_KEY = "regulasi_followed_up";
  const load = (): Set<string> => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]")); } catch { return new Set(); }
  };
  const [set, setSet] = useState<Set<string>>(load);
  const toggle = (id: string) => setSet(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    try { localStorage.setItem(LS_KEY, JSON.stringify([...next])); } catch {}
    return next;
  });
  return { set, toggle };
}

// ─── Static regulation database (augmented from live signals) ─────────────────

export interface RegEntry {
  id: string;
  kode: string;
  judul: string;
  instansi: string;
  domain: string;
  status: "BARU" | "DIUBAH" | "DICABUT" | "AKAN_BERLAKU";
  dampak: "KRITIS" | "TINGGI" | "SEDANG" | "RENDAH";
  tanggal: string;
  ringkasan: string;
  siapaTerdampak: string[];
  tindakanWajib: string[];
  deadline?: string;
  link?: string;
}

export const REGULATIONS: RegEntry[] = [
  {
    id: "r1",
    kode: "Permen PUPR No. 8/2022",
    judul: "Sertifikasi Badan Usaha Jasa Konstruksi (BUJK)",
    instansi: "Kementerian PUPR / LPJK",
    domain: "Konstruksi",
    status: "DIUBAH",
    dampak: "KRITIS",
    tanggal: "2022-05-01",
    ringkasan: "Permen ini memperbarui seluruh skema sertifikasi BUJK termasuk persyaratan SBU, klasifikasi subklasifikasi baru, dan kewajiban SMAP. BUJK yang tidak memperbarui SBU sebelum masa berlaku habis otomatis tidak dapat mengikuti tender pemerintah.",
    siapaTerdampak: ["Semua BUJK Kecil/Menengah/Besar", "Kontraktor", "Konsultan"],
    tindakanWajib: [
      "Verifikasi masa berlaku SBU — perpanjang 3 bulan sebelum habis",
      "Pastikan subklasifikasi sesuai KBLI terbaru",
      "Siapkan dokumen SMAP SNI ISO 37001:2016",
      "Update data di LPJK online",
    ],
    deadline: "Sebelum masa berlaku SBU habis",
    link: "https://lpjk.pu.go.id/",
  },
  {
    id: "r2",
    kode: "SE LPJK No. 04/2023",
    judul: "Ketidaksesuaian SMAP — BUJK Wajib Komitmen",
    instansi: "LPJK",
    domain: "Konstruksi",
    status: "BARU",
    dampak: "KRITIS",
    tanggal: "2023-06-01",
    ringkasan: "LPJK menerbitkan daftar BUJK yang belum memenuhi komitmen SMAP SNI ISO 37001:2016 (Sistem Manajemen Anti Penyuapan). BUJK yang masuk daftar ini berisiko pencabutan SBU dan tidak dapat mengikuti pengadaan.",
    siapaTerdampak: ["BUJK yang SBU-nya belum mencantumkan SMAP", "BUJK Menengah dan Besar"],
    tindakanWajib: [
      "Cek status di lpjk.pu.go.id/laporan-lpjk/ketidaksesuaian-smap",
      "Hubungi konsultan SMAP untuk gap analysis",
      "Susun dokumen komitmen SMAP dalam 30 hari",
      "Lakukan sertifikasi ISO 37001:2016",
    ],
    deadline: "Segera (LPJK dapat mencabut SBU)",
    link: "https://lpjk.pu.go.id/laporan-lpjk/ketidaksesuaian-smap",
  },
  {
    id: "r3",
    kode: "PP No. 14/2021",
    judul: "Perubahan PP Jasa Konstruksi — SKK Wajib",
    instansi: "Pemerintah / PUPR",
    domain: "Konstruksi",
    status: "DIUBAH",
    dampak: "TINGGI",
    tanggal: "2021-02-02",
    ringkasan: "Setiap tenaga kerja konstruksi yang bekerja di proyek wajib memiliki SKK (Sertifikat Kompetensi Kerja). BUJK yang menggunakan tenaga kerja tanpa SKK dapat dikenai sanksi administratif dan gugur dari proses pengadaan.",
    siapaTerdampak: ["Tenaga Ahli Konstruksi Jenjang 7/8/9", "Tenaga Terampil Jenjang 1-6", "BUJK pengguna tenaga kerja konstruksi"],
    tindakanWajib: [
      "Audit seluruh personel teknis — siapa yang belum memiliki SKK",
      "Daftarkan ke LSP-KI atau SIBIMA PUPR untuk ujian SKK",
      "Pastikan SKK terdaftar di LPJK dan aktif",
      "Perpanjang SKK yang hampir habis",
    ],
    deadline: "Berlaku sejak 2021 — verifikasi rutin tiap kuartal",
    link: "https://sibima.pu.go.id/",
  },
  {
    id: "r4",
    kode: "Permen PUPR No. 10/2021",
    judul: "Pedoman Sistem Manajemen Keselamatan Konstruksi (SMKK)",
    instansi: "Kementerian PUPR",
    domain: "Konstruksi",
    status: "DIUBAH",
    dampak: "TINGGI",
    tanggal: "2021-03-15",
    ringkasan: "SMKK wajib diterapkan di semua proyek konstruksi. RKK (Rencana Keselamatan Konstruksi) harus dilampirkan dalam dokumen penawaran tender. Kontraktor tanpa RKK yang valid gugur secara administrasi.",
    siapaTerdampak: ["Kontraktor Pelaksana", "Subkontraktor", "Konsultan Pengawas"],
    tindakanWajib: [
      "Buat template RKK standar perusahaan",
      "Pastikan ada personel K3 konstruksi tersertifikasi",
      "Lampirkan RKK di setiap penawaran tender",
      "Lakukan safety induction di tiap proyek baru",
    ],
    link: "https://www.pu.go.id/",
  },
  {
    id: "r5",
    kode: "Kepmen PUPR No. 897/2021",
    judul: "Struktur dan Besaran Remunerasi Minimal Tenaga Ahli",
    instansi: "Kementerian PUPR",
    domain: "Konstruksi",
    status: "BARU",
    dampak: "SEDANG",
    tanggal: "2021-11-01",
    ringkasan: "Menetapkan remunerasi minimal tenaga ahli konstruksi berdasarkan jenjang SKK dan posisi. Relevan untuk menyusun RAB jasa konsultansi dan penawaran pengadaan jasa konstruksi.",
    siapaTerdampak: ["Perusahaan Konsultan", "BUJK yang menggunakan tenaga ahli konsultansi"],
    tindakanWajib: [
      "Review struktur remunerasi personel sesuai Kepmen",
      "Update template RAB konsultansi",
      "Pastikan penawaran tidak di bawah remunerasi minimal",
    ],
    link: "https://jdih.pu.go.id/",
  },
  {
    id: "r6",
    kode: "Perpres No. 12/2021",
    judul: "Pengadaan Barang/Jasa Pemerintah — Perubahan Perpres 16/2018",
    instansi: "LKPP / Pemerintah",
    domain: "Tender & Pengadaan",
    status: "DIUBAH",
    dampak: "TINGGI",
    tanggal: "2021-02-02",
    ringkasan: "Perubahan signifikan pada mekanisme pengadaan: penambahan metode e-purchasing, perluasan TKDN, pengaturan pengadaan darurat, dan klausul baru untuk UMKM. BUJK wajib memahami metode baru agar tidak gugur dalam evaluasi.",
    siapaTerdampak: ["Semua BUJK peserta tender pemerintah", "Konsultan Tender"],
    tindakanWajib: [
      "Pahami metode evaluasi terbaru di SPSE/LPSE",
      "Verifikasi TKDN komponen yang digunakan",
      "Update SOP pengadaan internal perusahaan",
      "Ikuti sosialisasi LKPP jika ada",
    ],
    link: "https://spse.inaproc.id/",
  },
  {
    id: "r7",
    kode: "SNI ISO 9001:2015",
    judul: "Sistem Manajemen Mutu — Persyaratan Tender Pemerintah",
    instansi: "BSN / Komite Akreditasi Nasional",
    domain: "ISO & Sistem Manajemen",
    status: "DIUBAH",
    dampak: "SEDANG",
    tanggal: "2020-01-01",
    ringkasan: "Semakin banyak instansi pemerintah yang mensyaratkan ISO 9001:2015 sebagai persyaratan kualifikasi tender. BUJK tanpa sertifikat ISO 9001 dapat kalah dalam evaluasi kualifikasi.",
    siapaTerdampak: ["BUJK yang mengikuti tender nilai di atas Rp 10 miliar", "Konsultan Pengawas"],
    tindakanWajib: [
      "Assess apakah tender yang diikuti mensyaratkan ISO 9001",
      "Mulai implementasi jika belum bersertifikat",
      "Perpanjang sertifikasi sebelum masa berlaku habis (3 tahun)",
    ],
    link: "https://www.bsn.go.id/",
  },
  {
    id: "r8",
    kode: "Permen PUPR No. 6/2023",
    judul: "Perubahan Ketentuan SBU — Subklasifikasi Baru 2023",
    instansi: "PUPR / LPJK",
    domain: "Konstruksi",
    status: "BARU",
    dampak: "KRITIS",
    tanggal: "2023-04-01",
    ringkasan: "Penambahan subklasifikasi SBU baru untuk pekerjaan energi terbarukan, infrastruktur digital, dan konstruksi hijau. BUJK yang ingin mengikuti tender di sektor ini harus memperluas subklasifikasi SBU mereka.",
    siapaTerdampak: ["BUJK yang menarget tender EBT, Smart City, Green Building"],
    tindakanWajib: [
      "Cek apakah subklasifikasi saat ini mencakup pekerjaan target",
      "Ajukan perluasan subklasifikasi ke LPJK",
      "Siapkan tenaga ahli dengan SKK yang sesuai subklasifikasi baru",
    ],
    deadline: "Sebelum mengikuti tender dengan subklasifikasi baru",
    link: "https://lpjk.pu.go.id/",
  },
  {
    id: "r9",
    kode: "Peraturan BNSP No. 2/2017 (Diperbarui 2023)",
    judul: "Skema Sertifikasi Kompetensi Bidang Konstruksi — BNSP",
    instansi: "BNSP",
    domain: "SKK & Kompetensi",
    status: "DIUBAH",
    dampak: "SEDANG",
    tanggal: "2023-01-01",
    ringkasan: "BNSP memperbarui skema sertifikasi kompetensi untuk bidang konstruksi, termasuk penambahan unit kompetensi baru untuk BIM, manajemen risiko, dan keberlanjutan. LSP yang belum meng-update lisensi skema tidak dapat menerbitkan sertifikasi baru.",
    siapaTerdampak: ["Tenaga Ahli yang akan naik jenjang SKK", "LSP Konstruksi"],
    tindakanWajib: [
      "Periksa apakah skema sertifikasi yang akan diambil sudah diperbarui",
      "Pilih LSP yang lisensinya masih aktif di BNSP",
      "Siapkan portofolio sesuai skema terbaru",
    ],
    link: "https://bnsp.go.id/",
  },
  {
    id: "r10",
    kode: "Inpres No. 2/2022 — IKN",
    judul: "Percepatan Pembangunan IKN — Peluang Tender Konstruksi",
    instansi: "Presiden / OIKN",
    domain: "Tender & Pengadaan",
    status: "BARU",
    dampak: "TINGGI",
    tanggal: "2022-03-15",
    ringkasan: "Instruksi Presiden untuk mempercepat pembangunan IKN membuka peluang tender besar bagi BUJK. Nilai investasi ditargetkan ratusan triliun rupiah. BUJK yang ingin masuk perlu memahami skema pengadaan khusus IKN.",
    siapaTerdampak: ["BUJK Menengah dan Besar", "Konsultan Perencanaan", "Kontraktor Sipil"],
    tindakanWajib: [
      "Monitor portal ikn.go.id untuk pengumuman tender",
      "Pastikan SBU mencakup subklasifikasi gedung pemerintah dan infrastruktur",
      "Siapkan profil perusahaan dan portofolio proyek skala besar",
      "Pertimbangkan konsorsium dengan BUJK lain untuk memenuhi kualifikasi",
    ],
    link: "https://www.ikn.go.id/",
  },
  {
    id: "r11",
    kode: "Permen ESDM No. 26/2021",
    judul: "Pengembangan PLTS Atap — Peluang Konstruksi EBT",
    instansi: "Kementerian ESDM",
    domain: "Ketenagalistrikan & EBT",
    status: "BARU",
    dampak: "SEDANG",
    tanggal: "2021-12-01",
    ringkasan: "Program PLTS Atap mewajibkan gedung pemerintah memasang solar panel. Membuka peluang konstruksi dan jasa instalasi di segmen pemerintah dan komersial. BUJK konstruksi listrik bisa memperluas subklasifikasi untuk menangkap peluang ini.",
    siapaTerdampak: ["Kontraktor Listrik", "BUJK yang ingin masuk segmen EBT"],
    tindakanWajib: [
      "Pelajari persyaratan SBU untuk pekerjaan EBT",
      "Monitor tender PLTS di LPSE Kementerian ESDM dan PLN",
      "Pertimbangkan kemitraan dengan distributor panel surya",
    ],
    link: "https://www.esdm.go.id/",
  },
  {
    id: "r12",
    kode: "PP No. 22/2020 (Diperbarui PP 14/2021)",
    judul: "Peraturan Pelaksanaan UU Jasa Konstruksi — Teknis Operasional",
    instansi: "Pemerintah / PUPR",
    domain: "Konstruksi",
    status: "DIUBAH",
    dampak: "KRITIS",
    tanggal: "2021-02-02",
    ringkasan: "PP teknis pelaksanaan UU No. 2/2017. Mengatur secara detail: standar keamanan, K3, SMKK, ketenagakerjaan konstruksi, dan peran LPJK. Ini adalah regulasi induk yang menjadi acuan semua Permen PUPR terkait konstruksi.",
    siapaTerdampak: ["Semua BUJK", "Semua Tenaga Kerja Konstruksi"],
    tindakanWajib: [
      "Baca dan pahami PP 14/2021 secara menyeluruh",
      "Audit kesesuaian operasional perusahaan dengan PP",
      "Perbarui SOP internal sesuai ketentuan baru",
    ],
    link: "https://jdih.pu.go.id/",
  },
  {
    id: "r13",
    kode: "Permenaker No. 5/2018 (Update Kepmenaker 2023)",
    judul: "Sistem Manajemen Keselamatan dan Kesehatan Kerja (SMK3) Konstruksi",
    instansi: "Kementerian Ketenagakerjaan / PUPR",
    domain: "ISO & Sistem Manajemen",
    status: "DIUBAH",
    dampak: "TINGGI",
    tanggal: "2023-04-15",
    ringkasan: "Regulasi SMK3 kini lebih ketat untuk proyek konstruksi dengan nilai kontrak di atas Rp 10 miliar. BUJK wajib memiliki Ahli K3 Konstruksi bersertifikat dan menyusun Rencana Keselamatan Konstruksi (RKK) sebelum mobilisasi. Denda dan penghentian proyek berlaku untuk pelanggaran.",
    siapaTerdampak: ["Kontraktor dengan proyek >Rp 10 Miliar", "BUJK Menengah dan Besar"],
    tindakanWajib: [
      "Pastikan memiliki minimal 1 Ahli K3 Konstruksi bersertifikat BNSP",
      "Susun RKK sesuai template Kementerian PUPR sebelum proyek dimulai",
      "Laporkan kejadian K3 (near miss dan kecelakaan) ke Disnaker setempat",
      "Audit SMK3 internal minimal 1x per tahun",
    ],
    deadline: "Sebelum mobilisasi setiap proyek >Rp 10M",
    link: "https://jdih.kemnaker.go.id/",
  },
  {
    id: "r14",
    kode: "Perpres No. 16/2018 (Update Perpres 12/2021)",
    judul: "Pengadaan Barang/Jasa Pemerintah — Aturan Tender Digital",
    instansi: "LKPP",
    domain: "Tender & Pengadaan",
    status: "DIUBAH",
    dampak: "KRITIS",
    tanggal: "2021-03-30",
    ringkasan: "Perpres ini adalah landasan semua pengadaan pemerintah. Update 2021 memperkuat E-purchasing, E-tendering, dan marketplace pengadaan. Penggunaan SIKAP (Sistem Informasi Kinerja Penyedia) semakin menentukan kelayakan BUJK dalam tender pemerintah. Nilai kontrak di bawah threshold tertentu bisa langsung via e-catalog.",
    siapaTerdampak: ["Semua BUJK yang mengikuti tender pemerintah", "PPK dan Panitia Pengadaan"],
    tindakanWajib: [
      "Daftarkan perusahaan di SPSE/e-procurement LKPP",
      "Perbarui data SIKAP agar tidak terkena sanksi kinerja buruk",
      "Monitor e-catalog LKPP untuk peluang langsung tanpa lelang",
      "Pelajari mekanisme e-tendering: tender cepat, seleksi langsung, dan pasca-kualifikasi",
    ],
    link: "https://spse.lkpp.go.id/",
  },
  {
    id: "r15",
    kode: "Permen PUPR No. 21/2021",
    judul: "Bangunan Gedung Hijau (BGH) — Sertifikasi Green Building",
    instansi: "Kementerian PUPR",
    domain: "Konstruksi",
    status: "BARU",
    dampak: "SEDANG",
    tanggal: "2021-09-01",
    ringkasan: "Mewajibkan bangunan gedung baru dengan luas tertentu untuk memperoleh sertifikasi Bangunan Gedung Hijau (BGH). Persyaratan mencakup efisiensi energi, pengelolaan air, kualitas udara dalam ruangan, dan penggunaan material ramah lingkungan. Konsultan perencana wajib memiliki kompetensi green building.",
    siapaTerdampak: ["Konsultan Arsitektur & MEP", "Kontraktor Gedung Komersial/Perkantoran", "Developer Properti"],
    tindakanWajib: [
      "Pelajari kriteria sertifikasi BGH untuk jenis bangunan yang dikerjakan",
      "Pertimbangkan sertifikasi GREENSHIP atau BGH PUPR untuk proyek relevan",
      "Perbarui SOP material dan metode konstruksi sesuai BGH",
      "Diskusikan persyaratan BGH dengan owner sejak tahap perancangan",
    ],
    link: "https://bghriau.pu.go.id/",
  },
  {
    id: "r16",
    kode: "SE LKPP No. 10/2024",
    judul: "Penggunaan Produk Dalam Negeri (PDN) & TKDN Wajib dalam Pengadaan",
    instansi: "LKPP",
    domain: "Tender & Pengadaan",
    status: "BARU",
    dampak: "TINGGI",
    tanggal: "2024-03-01",
    ringkasan: "LKPP memperkuat kewajiban penggunaan produk dalam negeri dengan ambang batas TKDN yang lebih tinggi. Panitia pengadaan wajib memverifikasi TKDN sebelum evaluasi harga. BUJK yang menawarkan produk/material impor tanpa keterangan TKDN dapat digugurkan.",
    siapaTerdampak: ["Kontraktor yang menggunakan material/produk impor", "BUJK peserta tender pemerintah"],
    tindakanWajib: [
      "Verifikasi TKDN seluruh material yang akan dipakai di proyek tender",
      "Siapkan sertifikat TKDN dari produsen atau KEMENPERIN",
      "Susun daftar Bill of Material (BOM) dengan nilai TKDN masing-masing item",
      "Pelajari kategori mandatory PDN di e-catalog LKPP",
    ],
    deadline: "Berlaku sejak 2024 — wajib di setiap penawaran",
    link: "https://inaproc.id/tkdn",
  },
  {
    id: "r17",
    kode: "Permen PUPR No. 9/2023",
    judul: "Pengembangan Infrastruktur Digital Konstruksi — BIM Wajib",
    instansi: "Kementerian PUPR",
    domain: "Konstruksi",
    status: "BARU",
    dampak: "SEDANG",
    tanggal: "2023-09-01",
    ringkasan: "PUPR mewajibkan penggunaan BIM (Building Information Modeling) untuk proyek konstruksi gedung pemerintah dengan nilai kontrak di atas Rp 100 miliar mulai 2024. Tenaga ahli BIM membutuhkan SKK khusus. BUJK yang ingin menarget proyek pemerintah besar harus mulai investasi BIM.",
    siapaTerdampak: ["Konsultan Perencana proyek >Rp 100M", "Kontraktor EPC skala besar"],
    tindakanWajib: [
      "Investasi software BIM (Revit, ArchiCAD, Tekla) untuk proyek relevan",
      "Kirim personel ikut pelatihan BIM ke PUSDIKLAT PUPR",
      "Daftarkan tenaga ahli BIM ke skema SKK BIM di LPJK",
      "Cantumkan kapabilitas BIM dalam profil perusahaan untuk tender",
    ],
    deadline: "Wajib untuk proyek Gedung Pemerintah >Rp 100M mulai 2024",
    link: "https://jdih.pu.go.id/",
  },
];

const DOMAINS = ["Semua Domain", "Konstruksi", "Tender & Pengadaan", "SKK & Kompetensi", "ISO & Sistem Manajemen", "Ketenagalistrikan & EBT", "K3 & Keselamatan"];
const STATUSES = ["Semua Status", "BARU", "DIUBAH", "DICABUT", "AKAN_BERLAKU"];
const IMPACTS = ["Semua Dampak", "KRITIS", "TINGGI", "SEDANG", "RENDAH"];

const IMPACT_COLORS: Record<string, string> = {
  KRITIS: "bg-red-100 text-red-700 border-red-300",
  TINGGI: "bg-orange-100 text-orange-700 border-orange-300",
  SEDANG: "bg-yellow-100 text-yellow-700 border-yellow-300",
  RENDAH: "bg-slate-100 text-slate-600 border-slate-300",
};
const IMPACT_BAR: Record<string, string> = {
  KRITIS: "bg-red-500",
  TINGGI: "bg-orange-500",
  SEDANG: "bg-yellow-500",
  RENDAH: "bg-slate-400",
};
const STATUS_COLORS: Record<string, string> = {
  BARU: "bg-emerald-100 text-emerald-700 border-emerald-300",
  DIUBAH: "bg-blue-100 text-blue-700 border-blue-300",
  DICABUT: "bg-red-100 text-red-700 border-red-300",
  AKAN_BERLAKU: "bg-violet-100 text-violet-700 border-violet-300",
};

export default function Regulasi() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Regulasi & Kebijakan — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("Semua Domain");
  const [status, setStatus] = useState("Semua Status");
  const [impact, setImpact] = useState("Semua Dampak");
  const [showWithNotesOnly, setShowWithNotesOnly] = useState(false);
  const [catFilter, setCatFilter] = useState("Semua Kategori");
  const REG_CATEGORIES = ["Semua Kategori", "SBU", "SKK", "BIM", "TKDN", "K3", "ISO", "IKN", "Tender"];
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copiedAction, setCopiedAction] = useState<number | null>(null);
  const [regulasiNotes, setRegulasiNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-reg-notes") ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const savedNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateRegulasiNote = useCallback((id: string, val: string) => {
    setRegulasiNotes(prev => {
      const next = { ...prev, [id]: val };
      try { localStorage.setItem("mkp-reg-notes", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    if (savedNoteTimer.current) clearTimeout(savedNoteTimer.current);
    setSavedNoteId(id);
    savedNoteTimer.current = setTimeout(() => setSavedNoteId(null), 2000);
  }, []);
  const { set: followedUp, toggle: toggleFollowedUp } = useFollowedUpSet();

  const handleCopyAction = useCallback((no: number, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedAction(no);
      toast.success("Teks tindakan disalin", { duration: 1200 });
      setTimeout(() => setCopiedAction(null), 2000);
    });
  }, []);

  const { data: researchItems } = useListResearchItems();
  const { data: trends } = useGetTrendingTopics({ limit: 5 });

  // Derive live regulatory signals from research items
  // Strict filter: must match construction/regulation keywords AND exclude spam/junk
  const JUNK_KEYWORDS = ["slot", "casino", "poker", "togel", "judi", "bet ", "gacor", "4d", "3d", "2d", "pragmatic", "maxwin", "porn", "sex", "xxx"];
  const VALID_REG_KEYWORDS = ["permen", "perpres", "peraturan pemerintah", "pp no", "kepmen", "se lpjk", "inpres", "regulasi", "peraturan", "kebijakan", "undang-undang", "uu ", "perda", "permen pupr", "sni iso", "keppres", "permenaker"];
  const VALID_CATEGORIES = ["REGULASI", "REGULATION", "KEBIJAKAN", "COMPLIANCE", "PERATURAN"];

  const liveSignals = useMemo(() => {
    const items = researchItems ?? [];
    return items
      .filter((r) => {
        const title = (r.title ?? "").toLowerCase();
        const summary = (r.summary ?? "").toLowerCase();
        const cat = (r.category ?? "").toUpperCase();
        // Hard exclude junk/spam
        if (JUNK_KEYWORDS.some((k) => title.includes(k) || summary.includes(k))) return false;
        // Category must explicitly be regulation-related
        const matchesCategory = VALID_CATEGORIES.some((k) => cat.includes(k));
        // OR title must explicitly contain regulation keywords (strict match)
        const matchesKeyword = VALID_REG_KEYWORDS.some((k) => title.includes(k));
        // Both conditions must be met to count as a live signal
        return matchesCategory && matchesKeyword;
      })
      .slice(0, 6);
  }, [researchItems]);

  const [sortByDampak, setSortByDampak] = useState(false);
  const DAMPAK_ORDER: Record<string, number> = { KRITIS: 0, TINGGI: 1, SEDANG: 2, RENDAH: 3 };

  const filtered = useMemo(() => {
    const base = REGULATIONS.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.judul.toLowerCase().includes(q) || r.kode.toLowerCase().includes(q) || r.ringkasan.toLowerCase().includes(q) || (regulasiNotes[r.id] ?? "").toLowerCase().includes(q);
      const matchDomain = domain === "Semua Domain" || r.domain === domain;
      const matchStatus = status === "Semua Status" || r.status === status;
      const matchImpact = impact === "Semua Dampak" || r.dampak === impact;
      const matchCat = catFilter === "Semua Kategori" || r.judul.toUpperCase().includes(catFilter.toUpperCase()) || r.kode.toUpperCase().includes(catFilter.toUpperCase()) || r.ringkasan.toUpperCase().includes(catFilter.toUpperCase());
      return matchSearch && matchDomain && matchStatus && matchImpact && matchCat;
    });
    const result = sortByDampak ? [...base].sort((a, b) => (DAMPAK_ORDER[a.dampak] ?? 99) - (DAMPAK_ORDER[b.dampak] ?? 99)) : base;
    return showWithNotesOnly ? result.filter(r => !!(regulasiNotes[r.id] ?? "").trim()) : result;
  }, [search, domain, status, impact, catFilter, sortByDampak, regulasiNotes, showWithNotesOnly]);

  const stats = useMemo(() => ({
    kritis: REGULATIONS.filter((r) => r.dampak === "KRITIS").length,
    baru: REGULATIONS.filter((r) => r.status === "BARU").length,
    withDeadline: REGULATIONS.filter((r) => r.deadline).length,
    total: REGULATIONS.length,
  }), []);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Pusat Regulasi — Regulation Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-2 flex-wrap">
            Monitor perubahan regulasi · analisis dampak · checklist kepatuhan
            {filtered.length < REGULATIONS.length && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {filtered.length} dari {REGULATIONS.length}
              </span>
            )}
            {(() => {
              const baru = REGULATIONS.filter(r => r.status === "BARU").length;
              return baru > 0 ? (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {baru} regulasi baru
                </span>
              ) : null;
            })()}
            {Object.values(regulasiNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowWithNotesOnly(v => !v)}
                aria-pressed={showWithNotesOnly}
                className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
                title="Filter hanya regulasi dengan catatan"
              >
                {Object.values(regulasiNotes).filter(v => v?.trim()).length} catatan
              </button>
            )}
            {(() => {
              const pending = REGULATIONS.filter(r => !followedUp.has(r.id)).length;
              return pending > 0 ? (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                  {pending} belum ditindaklanjuti
                </span>
              ) : null;
            })()}
            {(() => {
              const tinggi = REGULATIONS.filter(r => r.dampak === "KRITIS" || r.dampak === "TINGGI").length;
              return tinggi > 0 ? (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                  {tinggi} dampak kritis/tinggi
                </span>
              ) : null;
            })()}
          </p>
        </div>
      </div>

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="regulasi" />

      {/* Regulatory Action Urgency Board */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-orange-600" /> REGULATORY ACTION URGENCY BOARD — Regulasi Prioritas Tindak Lanjut Hari Ini
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { reg: "Permen PUPR SMAP (Anti-Suap)", deadline: "31 Des 2026", sisa: "< 5 bulan", dampak: "BUJK Menengah–Besar wajib comply", aksi: "Launch SMAP express campaign sekarang", urgColor: "border-red-200 bg-red-50/20", badgeColor: "bg-red-100 text-red-700" },
            { reg: "SE LKPP TKDN ≥40% APBN", deadline: "Berlaku Penuh Q3 2026", sisa: "< 3 bulan", dampak: "Semua tender APBN terdampak", aksi: "Audit TKDN existing clients + advisory", urgColor: "border-red-200 bg-red-50/20", badgeColor: "bg-red-100 text-red-700" },
            { reg: "Permen PUPR BIM Bertahap", deadline: "Proyek >Rp 100M mulai 2026", sisa: "Berlaku", dampak: "Kontraktor besar wajib BIM plan", aksi: "BIM readiness assessment + training", urgColor: "border-orange-200 bg-orange-50/20", badgeColor: "bg-orange-100 text-orange-700" },
            { reg: "Update LPJK SKK Jenjang", deadline: "Rolling — setiap kali ada perubahan", sisa: "Monitor", dampak: "Perubahan syarat uji kompetensi", aksi: "Update kurikulum SKK + notifikasi klien", urgColor: "border-orange-200 bg-orange-50/20", badgeColor: "bg-orange-100 text-orange-700" },
            { reg: "Regulasi IKN Procurement", deadline: "Sesuai jadwal proyek IKN", sisa: "Triwulan", dampak: "Tender IKN syarat khusus berbeda", aksi: "Pelajari persyaratan kualifikasi IKN", urgColor: "border-yellow-200 bg-yellow-50/20", badgeColor: "bg-yellow-100 text-yellow-700" },
            { reg: "SNI ISO 9001:2015 Update", deadline: "Cicilan hingga 2027", sisa: "1+ tahun", dampak: "Tender besar mulai mensyaratkan SMM", aksi: "Bundle ISO 9001 + SBU renewal", urgColor: "border-yellow-200 bg-yellow-50/20", badgeColor: "bg-yellow-100 text-yellow-700" },
          ].map((r) => (
            <div key={r.reg} className={`border rounded-sm p-3 ${r.urgColor}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-semibold leading-snug">{r.reg}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${r.badgeColor}`}>{r.sisa}</span>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mb-1">Deadline: {r.deadline}</p>
              <p className="text-[10px] text-primary font-semibold mb-1">{r.dampak}</p>
              <p className="text-[9px] font-mono text-muted-foreground">→ {r.aksi}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: TriangleAlert, label: "Dampak Kritis", val: stats.kritis, color: "text-red-600" },
          { icon: Zap, label: "Regulasi Baru", val: stats.baru, color: "text-emerald-600" },
          { icon: Clock, label: "Ada Deadline", val: stats.withDeadline, color: "text-orange-600" },
          { icon: FileText, label: "Total Regulasi", val: stats.total, color: "text-primary" },
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

      {/* Compliance Revenue Opportunity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> COMPLIANCE REVENUE OPPORTUNITY — Regulasi Baru → Potensi Pendapatan Layanan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { reg: "SMAP Mandatory", target: "200K BUJK", take: "5%", val: "Rp 2–22jt/klien", total: "Rp 20–220M TAM", color: "text-red-700", bg: "bg-red-50/20 border-red-200" },
            { reg: "TKDN ≥40%", target: "50K tender/thn", take: "3%", val: "Rp 2.5–4.5jt/tender", total: "Rp 3.75–6.75M TAM", color: "text-orange-700", bg: "bg-orange-50/20 border-orange-200" },
            { reg: "BIM Wajib >Rp 100M", target: "30K proyek/thn", take: "2%", val: "Rp 3.5–9.5jt/proyek", total: "Rp 2.1–5.7M TAM", color: "text-orange-700", bg: "bg-orange-50/20 border-orange-200" },
            { reg: "SKK Renewal Rolling", target: "500K tenaga ahli", take: "1%", val: "Rp 3–8jt/orang", total: "Rp 15–40M TAM", color: "text-blue-700", bg: "bg-blue-50/20 border-blue-200" },
            { reg: "ISO SMM/K3 Tender", target: "80K kontraktor", take: "2%", val: "Rp 8–20jt/klien", total: "Rp 12.8–32M TAM", color: "text-violet-700", bg: "bg-violet-50/20 border-violet-200" },
            { reg: "IKN Procurement Khusus", target: "2K BUJK IKN", take: "10%", val: "Rp 25–60jt/klien", total: "Rp 5–12M TAM", color: "text-emerald-700", bg: "bg-emerald-50/20 border-emerald-200" },
          ].map((r) => (
            <div key={r.reg} className={`border rounded-sm p-3 ${r.bg}`}>
              <p className="text-xs font-semibold mb-1">{r.reg}</p>
              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mb-1">
                <span>{r.target}</span><span>Take rate {r.take}</span>
              </div>
              <p className={`text-[10px] font-mono font-bold ${r.color}`}>{r.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">TAM: {r.total}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">TAM = Total Addressable Market estimasi · Take rate = realistis dalam 12 bulan dengan tim saat ini</p>
      </div>

      {/* Regulatory Timeline Planner */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> REGULATORY TIMELINE PLANNER — Jadwal Enforcement & Rencana Respons MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { tanggal: "Jun 2026", reg: "SE LKPP TKDN ≥40% penuh berlaku", tipe: "ENFORCEMENT", respons: "Batch audit 30 klien aktif sebelum Juni", urgency: "KRITIS", uc: "bg-red-100 text-red-700" },
            { tanggal: "Des 2026", reg: "SMAP mandatory deadline final", tipe: "ENFORCEMENT", respons: "Launch express SMAP 45 hari — Q3 2026", urgency: "KRITIS", uc: "bg-red-100 text-red-700" },
            { tanggal: "Q3 2026", reg: "BIM wajib proyek baru >Rp 100M", tipe: "ENFORCEMENT", respons: "BIM advisory package launch sebelum Q3", urgency: "TINGGI", uc: "bg-orange-100 text-orange-700" },
            { tanggal: "Mei 2026", reg: "Update LPJK SKK bidang tertentu", tipe: "REGULASI", respons: "Monitor LPJK + update kurikulum SKK dalam 1 mgg", urgency: "SEDANG", uc: "bg-yellow-100 text-yellow-700" },
            { tanggal: "Jan 2027", reg: "Sertifikasi ISO SMM mulai jadi syarat lebih banyak tender", tipe: "TREN", respons: "Bundle ISO 9001 + SBU renewal — launch Q4 2026", urgency: "SEDANG", uc: "bg-yellow-100 text-yellow-700" },
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="w-16 shrink-0 text-center">
                <p className="text-[9px] font-mono font-bold text-primary">{r.tanggal}</p>
                <span className={`text-[8px] font-mono px-1 py-0.5 rounded-sm ${r.uc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold">{r.reg}</p>
                <p className="text-[9px] text-muted-foreground">{r.tipe}</p>
              </div>
              <p className="text-[9px] font-mono text-primary text-right max-w-[200px] leading-snug">{r.respons}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Cost-Benefit Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" /> COMPLIANCE COST-BENEFIT MATRIX — Biaya Comply vs Biaya Tidak Comply
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                {["Regulasi", "Biaya Comply", "Manfaat Comply", "Biaya Non-Comply", "ROI Comply", "Rekomendasi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { reg: "SMAP Wajib", comply: "Rp 10–22jt", benefit: "Akses tender B2 + reputasi naik", noncmply: "DQ tender, potensi sanksi LPJK", roi: "14×", rc: "text-emerald-700", rec: "SEGERA" },
                { reg: "SKK Jenjang Sesuai", comply: "Rp 3–8jt", benefit: "Lolos kualifikasi direktur teknis", noncmply: "Gugur tender + reputasi merosot", roi: "12×", rc: "text-emerald-700", rec: "SEGERA" },
                { reg: "TKDN ≥40%", comply: "Rp 2–5jt audit", benefit: "Eligible APBN + bonus poin tender", noncmply: "Auto-DQ dari semua tender APBN", roi: "8×", rc: "text-emerald-700", rec: "PRIORITAS" },
                { reg: "BIM Readiness", comply: "Rp 8–25jt", benefit: "Proyek >Rp100M + diferensiasi kompetitif", noncmply: "Exclude ab 2027 + ketinggalan pasar", roi: "5×", rc: "text-blue-700", rec: "JADWALKAN" },
                { reg: "ISO 9001 SMM", comply: "Rp 15–35jt", benefit: "Poin tambahan tender + kepercayaan klien", noncmply: "Kalah tender di klien korporat", roi: "3×", rc: "text-orange-700", rec: "PERTIMBANGKAN" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 hover:shadow-sm transition-all">
                  <td className="px-3 py-2 font-medium">{r.reg}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.comply}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.benefit}</td>
                  <td className="px-3 py-2 text-[10px] text-red-600">{r.noncmply}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.rc}`}>{r.roi}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.rc}`}>{r.rec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regulatory Risk Watchlist */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-red-600" /> REGULATORY RISK WATCHLIST — Regulasi yang Berpotensi Disruptif dalam 12 Bulan ke Depan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { reg: "Revisi Perpres Pengadaan No. 16/2018", probability: "TINGGI", timeline: "Q3 2026", impact: "Perubahan persyaratan SBU & TKDN di semua APBN", mitigation: "Monitor LKPP · Siapkan advisory update klien", pc: "bg-red-100 text-red-700" },
            { reg: "Wajib BIM untuk Proyek >Rp50M", probability: "TINGGI", timeline: "Q4 2026", impact: "200K+ BUJK harus upgrade capability BIM", mitigation: "Kembangkan BIM readiness product sekarang", pc: "bg-red-100 text-red-700" },
            { reg: "Digitalisasi Penuh Proses SBU LPJK", probability: "SEDANG", timeline: "Q1 2027", impact: "Disruptif ke konsultan offline — peluang MJP", mitigation: "Posisikan sebagai platform digital-first", pc: "bg-orange-100 text-orange-700" },
            { reg: "Standar Kompetensi SKK Revisi 2027", probability: "SEDANG", timeline: "Q2 2027", impact: "Pemegang SKK lama perlu uji ulang jenjang", mitigation: "Bangun modul reskilling + pendampingan ujian", pc: "bg-orange-100 text-orange-700" },
          ].map((r) => (
            <div key={r.reg} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold leading-snug">{r.reg}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${r.pc}`}>{r.probability}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1 leading-snug">{r.impact}</p>
              <p className="text-[9px] font-mono text-primary">→ {r.mitigation}</p>
              <p className="text-[8px] font-mono text-muted-foreground mt-0.5">Est. berlaku: {r.timeline}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulation Revenue Opportunity Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REGULATION REVENUE CALCULATOR — Potensi Revenue dari Setiap Regulasi Baru
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              reg: "SMAP Enforcement (SE LPJK 04/2023)",
              bujkTerdampak: "200.000+", pctBelumComply: "65%",
              targetAcquisition: 500, revPerKlien: "Rp 10–22jt",
              totalPotential: "Rp 5–11M", urgency: "AKTIF SEKARANG",
              uc: "bg-red-100 text-red-700", notes: "Deadline enforcement semakin dekat",
            },
            {
              reg: "SKK Wajib Sesuai Jenjang",
              bujkTerdampak: "150.000+", pctBelumComply: "40%",
              targetAcquisition: 800, revPerKlien: "Rp 4–8jt",
              totalPotential: "Rp 3.2–6.4M", urgency: "ROLLING ANNUAL",
              uc: "bg-orange-100 text-orange-700", notes: "Siklus tahunan — pipeline berkelanjutan",
            },
            {
              reg: "BIM Mandatory 2027",
              bujkTerdampak: "80.000+", pctBelumComply: "90%",
              targetAcquisition: 300, revPerKlien: "Rp 8–25jt",
              totalPotential: "Rp 2.4–7.5M", urgency: "BUILD NOW",
              uc: "bg-blue-100 text-blue-700", notes: "Window 18 bulan untuk posisi diri",
            },
            {
              reg: "TKDN 40% Compliance",
              bujkTerdampak: "100.000+", pctBelumComply: "35%",
              targetAcquisition: 200, revPerKlien: "Rp 2.5–5jt",
              totalPotential: "Rp 500jt–1M", urgency: "STEADY",
              uc: "bg-yellow-100 text-yellow-700", notes: "Diperkuat tiap revisi Perpres",
            },
          ].map((r) => (
            <div key={r.reg} className="border rounded-sm p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-semibold leading-snug">{r.reg}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${r.uc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 mb-1">
                <p className="text-[9px] text-muted-foreground">BUJK terdampak: <span className="font-bold text-foreground">{r.bujkTerdampak}</span></p>
                <p className="text-[9px] text-muted-foreground">Belum comply: <span className="font-bold text-red-600">{r.pctBelumComply}</span></p>
                <p className="text-[9px] text-muted-foreground">Target MJP: <span className="font-bold text-foreground">{r.targetAcquisition} klien</span></p>
                <p className="text-[9px] text-muted-foreground">Harga: <span className="font-bold text-primary">{r.revPerKlien}</span></p>
              </div>
              <p className="text-[10px] font-mono font-bold text-emerald-700">{r.totalPotential} total potensial</p>
              <p className="text-[8px] font-mono text-muted-foreground mt-0.5">{r.notes}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Action Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> REGULATORY ACTION CALENDAR — Regulasi yang Perlu Dikomunikasikan ke Klien Tiap Bulan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { bln: "Ags 2026", reg: "BIM Mandatory berlaku", action: "Briefing klien B2/M", urgency: "🔴", uc: "border-red-300 bg-red-50" },
            { bln: "Sep 2026", reg: "Update SE LPJK SMAP", action: "Kirim alert + paket SMAP", urgency: "🔴", uc: "border-red-300 bg-red-50" },
            { bln: "Okt 2026", reg: "Review TKDN Perpres", action: "Audit klien APBN aktif", urgency: "🟡", uc: "border-yellow-300 bg-yellow-50" },
            { bln: "Nov 2026", reg: "Deadline SMAP Q4", action: "Follow-up klien belum comply", urgency: "🔴", uc: "border-red-300 bg-red-50" },
            { bln: "Des 2026", reg: "SMAP enforcement final", action: "Last chance alert blast", urgency: "🔴", uc: "border-red-300 bg-red-50" },
            { bln: "Jan 2027", reg: "Revisi SKK kompetensi", action: "Reskilling package launch", urgency: "🟡", uc: "border-yellow-300 bg-yellow-50" },
          ].map((c) => (
            <div key={c.bln} className={`border rounded-sm p-2 ${c.uc}`}>
              <p className="text-[8px] font-mono font-bold text-muted-foreground mb-0.5">{c.bln}</p>
              <p className="text-[9px] font-semibold leading-snug mb-1">{c.urgency} {c.reg}</p>
              <p className="text-[9px] text-muted-foreground leading-snug">{c.action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Jadwal berbasis monitoring LPJK + JDIH + LKPP · Update otomatis saat ada regulasi baru masuk Knowledge Registry</p>
      </div>

      {/* Compliance Gap Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-red-600" /> COMPLIANCE GAP INTELLIGENCE — Celah Kepatuhan Klien yang Paling Mengancam Bisnis Mereka
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { gap: "SMAP belum tersertifikasi", affected: "~200K BUJK nasional", deadline: "Des 2026", revenue: "Rp 2–11M", risk: "Tidak bisa ikut tender APBN", urgency: "KRITIS", uc: "text-red-700 bg-red-50 border-red-200" },
            { gap: "BIM readiness level 0", affected: "~85% BUJK B1–B2", deadline: "Agt 2026", revenue: "Rp 800jt–5M", risk: "Tidak eligible proyek IKN", urgency: "KRITIS", uc: "text-red-700 bg-red-50 border-red-200" },
            { gap: "SKK jenjang tidak sesuai subklasifikasi", affected: "~40K tenaga ahli", deadline: "Okt 2026", revenue: "Rp 400jt–2M", risk: "Sertifikat SBU tidak bisa diperbarui", urgency: "TINGGI", uc: "text-orange-700 bg-orange-50 border-orange-200" },
            { gap: "TKDN dokumentasi tidak lengkap", affected: "BUJK aktif kontrak APBN", deadline: "Audit kapanpun", revenue: "Rp 200–900jt", risk: "Denda + blacklist 2 tahun", urgency: "TINGGI", uc: "text-orange-700 bg-orange-50 border-orange-200" },
          ].map((g) => (
            <div key={g.gap} className={`border rounded-sm p-3 ${g.uc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-semibold leading-snug">{g.gap}</p>
                <span className="text-[8px] font-mono font-bold shrink-0">{g.urgency}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">Terdampak: {g.affected}</p>
              <p className="text-[9px] text-muted-foreground">Deadline: {g.deadline} · Risk: {g.risk}</p>
              <p className="text-[9px] font-mono font-bold mt-1">Revenue potensi: {g.revenue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulasi Revenue Accelerator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> REGULASI REVENUE ACCELERATOR — Cara Cepat Konversi Setiap Perubahan Regulasi Jadi Revenue
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              trigger: "LPJK umumkan SE baru atau update persyaratan",
              timeToRevenue: "48 jam",
              action: "1) Auto-alert klien terdampak via WhatsApp · 2) Attach paket solusi siap beli · 3) Follow up call dalam 24 jam",
              expectedRevenue: "Rp 8–25jt per SE",
              speed: "SANGAT CEPAT", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              trigger: "BNSP umumkan deadline SKK baru",
              timeToRevenue: "3–7 hari",
              action: "1) Segment klien yang terdampak · 2) Kirim Intel SKK Gap dengan nama mereka · 3) Tawarkan paket fast-track",
              expectedRevenue: "Rp 5–15jt per deadline",
              speed: "CEPAT", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              trigger: "DPR sahkan UU baru terkait konstruksi",
              timeToRevenue: "7–30 hari",
              action: "1) Analisis dampak per segmen klien · 2) Publish artikel brief (content marketing) · 3) Jadwalkan webinar berbayar",
              expectedRevenue: "Rp 20–80jt per UU baru",
              speed: "MEDIUM", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((r) => (
            <div key={r.trigger} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-[9px] font-semibold leading-snug">Trigger: {r.trigger}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.sc}`}>{r.speed}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1">⏱ Time-to-Revenue: {r.timeToRevenue} · Estimasi: {r.expectedRevenue}</p>
              <p className={`text-[9px] font-mono ${r.sc}`}>▶ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Timeline Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> ENFORCEMENT TIMELINE — Kapan Setiap Regulasi Mulai Berlaku & Revenue Window-nya
        </p>
        <div className="flex flex-col gap-2">
          {[
            { reg: "SMAP Mandatory — semua BUJK aktif", deadline: "Desember 2026", daysLeft: 151, window: "Rp 48M TAM", urgency: "🔴 KRITIS", uc: "text-red-700" },
            { reg: "BIM Level 2 — proyek pemerintah ≥ Rp 100M", deadline: "Juni 2027", daysLeft: 332, window: "Rp 28M TAM", urgency: "🟡 SEGERA", uc: "text-orange-700" },
            { reg: "TKDN konstruksi 40% — semua proyek APBN", deadline: "Maret 2027", daysLeft: 243, window: "Rp 12M TAM", urgency: "🟡 SEGERA", uc: "text-orange-700" },
            { reg: "ISO 9001 wajib — BUJK kualifikasi B", deadline: "September 2027", daysLeft: 424, window: "Rp 8M TAM", urgency: "🟢 MONITOR", uc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.reg} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold leading-snug">{r.reg}</p>
                  <span className={`text-[8px] font-mono font-bold shrink-0 ${r.uc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">Deadline: {r.deadline} · {r.daysLeft} hari lagi · TAM: {r.window}</p>
              </div>
              <div className="text-center shrink-0 w-12">
                <p className={`text-xl font-black font-mono leading-none ${r.uc}`}>{r.daysLeft}</p>
                <p className="text-[7px] font-mono text-muted-foreground">hari</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Compliance Score by Segment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> COMPLIANCE SCORE BY SEGMENT — Rata-rata Kesiapan Regulasi per Tipe Kontraktor
        </p>
        <div className="flex flex-col gap-2">
          {[
            { segment: "BUJK Besar (B1–B2)", scores: { smap: 62, bim: 44, skk: 88, tkdn: 71 }, overall: 66 },
            { segment: "BUJK Menengah (M1–M2)", scores: { smap: 31, bim: 12, skk: 74, tkdn: 55 }, overall: 43 },
            { segment: "BUJK Kecil (K)", scores: { smap: 8, bim: 3, skk: 52, tkdn: 38 }, overall: 25 },
            { segment: "Konsultan Perencana", scores: { smap: 78, bim: 61, skk: 91, tkdn: 44 }, overall: 69 },
          ].map((s) => (
            <div key={s.segment} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-semibold">{s.segment}</p>
                <div className={`text-[10px] font-mono font-black ${s.overall >= 60 ? "text-emerald-700" : s.overall >= 40 ? "text-orange-700" : "text-red-700"}`}>{s.overall}% ready</div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(s.scores).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <div className="h-8 flex items-end justify-center mb-0.5">
                      <div className={`w-8 rounded-t-sm ${v >= 60 ? "bg-emerald-500" : v >= 40 ? "bg-orange-400" : "bg-red-500"}`} style={{ height: `${v}%` }} />
                    </div>
                    <p className="text-[8px] font-mono font-bold">{v}%</p>
                    <p className="text-[7px] font-mono text-muted-foreground uppercase">{k}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">BUJK Kecil hanya 25% ready — 75% dari 200K BUJK kecil = {'>'} Rp 36M revenue opportunity</p>
      </div>

      {/* Regulatory Intelligence Brief Generator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> INTELLIGENCE BRIEF GENERATOR — Template Komunikasi Regulasi ke Klien yang Siap Kirim
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              template: "ALERT Regulasi Baru — untuk WhatsApp Blast", urgency: "IMMEDIATE", audience: "Semua klien aktif",
              body: "🚨 UPDATE REGULASI: [Nama Regulasi] baru saja diterbitkan. Kami sudah menganalisis dampaknya — klien MJP yang terkena wajib update [Syarat X] sebelum [Deadline]. Hubungi tim MJP sekarang untuk panduan cepat.",
              bc: "bg-red-50 border-red-200", tc: "text-red-700",
            },
            {
              template: "BRIEFING Deadline Approaching — untuk Email", urgency: "7 HARI SEBELUM", audience: "Klien terdampak spesifik",
              body: "Yth. Bapak/Ibu [Nama], Mengingatkan bahwa [Persyaratan] Anda akan berakhir pada [Tanggal]. Tim MJP siap membantu proses perpanjangan dalam [X] hari kerja. Balas email ini untuk konfirmasi.",
              bc: "bg-orange-50 border-orange-200", tc: "text-orange-700",
            },
            {
              template: "INSIGHT Kompetitif — untuk Newsletter Bulanan", urgency: "MONTHLY", audience: "Subscriber premium",
              body: "REGULASI BULAN INI: [3 perubahan utama] + dampaknya ke strategi tender Anda. Klien yang sudah update persyaratan rata-rata win rate tender naik 18%. Berikut panduan lengkapnya...",
              bc: "bg-blue-50 border-blue-200", tc: "text-blue-700",
            },
          ].map((t) => (
            <div key={t.template} className={`border rounded-sm p-3 ${t.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-mono font-bold ${t.tc}`}>{t.template}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-mono ${t.tc}`}>{t.urgency}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">→ {t.audience}</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground italic leading-snug">{t.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Arbitrage Finder */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-600" /> REGULATORY ARBITRAGE FINDER — Celah Regulasi yang Bisa Menguntungkan Klien MJP Sekarang
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              arbitrage: "Masa transisi SMAP belum ada enforcement ketat",
              window: "Berlaku s.d. akhir 2026",
              opportunity: "Klien bisa mulai proses bertahap → paket cicilan advisory lebih mudah dijual",
              risk: "Enforcement bisa dipercepat jika ada kebijakan baru",
              value: "Rp 8–28jt/klien",
              urgency: "AMBIL SEKARANG",
              uc: "text-emerald-700", bc: "bg-emerald-50/40 border-emerald-200",
            },
            {
              arbitrage: "Sub-bidang BIM Coordinator belum wajib di semua provinsi",
              window: "Berlaku s.d. 2027 (Permen PUPR penuh)",
              opportunity: "BUJK Besar bisa jadi early mover → kontraktor pertama yang BIM certified di wilayahnya",
              risk: "Harga sertifikasi BIM masih tinggi untuk BUJK Kecil",
              value: "Rp 5–9.5jt/klien",
              urgency: "STRATEGIC",
              uc: "text-blue-700", bc: "bg-blue-50/30 border-blue-200",
            },
            {
              arbitrage: "TKDN ≥40% belum ada verifikator swasta yang terdaftar banyak",
              window: "Pasar verifikator TKDN masih terbuka",
              opportunity: "MJP bisa jadi agregator layanan verifikasi TKDN → add-on high-margin",
              risk: "Perlu sertifikasi tambahan sebagai verifikator resmi LKPP",
              value: "Rp 2.5–4.5jt/proyek",
              urgency: "KEMBANGKAN",
              uc: "text-violet-700", bc: "bg-violet-50/30 border-violet-200",
            },
          ].map((a) => (
            <div key={a.arbitrage} className={`border rounded-sm p-3 ${a.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold">{a.arbitrage}</p>
                <div className="flex flex-col items-end shrink-0">
                  <span className={`text-[8px] font-mono font-bold ${a.uc}`}>{a.urgency}</span>
                  <span className="text-[8px] font-mono text-emerald-700">{a.value}</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">⏳ {a.window}</p>
              <p className="text-[9px] mb-0.5">✅ {a.opportunity}</p>
              <p className="text-[9px] text-muted-foreground">⚠ {a.risk}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulator Relationship Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> REGULATOR RELATIONSHIP TRACKER — Intensitas Hubungan MJP dengan Lembaga Regulator Kunci
        </p>
        <div className="flex flex-col gap-2">
          {[
            { regulator: "LPJK (Lembaga Pengembangan Jasa Konstruksi)", role: "Standardisasi SBU + BUJK", strength: 82, contact: "Rutin hadir di forum LPJK regional", lastTouch: "2 minggu lalu", tc: "text-emerald-700", c: "bg-emerald-500" },
            { regulator: "BNSP (Badan Nasional Sertifikasi Profesi)", role: "Sertifikasi SKK + LSP", strength: 68, contact: "Akses API BNSP + relasi LSP mitra", lastTouch: "1 bulan lalu", tc: "text-blue-700", c: "bg-blue-500" },
            { regulator: "LKPP (Pengadaan Pemerintah)", role: "Regulasi tender APBN/APBD", strength: 45, contact: "Monitoring JDIH + komunitas pengadaan", lastTouch: "6 minggu lalu", tc: "text-orange-700", c: "bg-orange-500" },
            { regulator: "Kemenaker (K3 + Uji Kompetensi)", role: "Regulasi K3 + tenaga kerja konstruksi", strength: 31, contact: "Pantau Permenaker via feed otomatis", lastTouch: "2 bulan lalu", tc: "text-red-700", c: "bg-red-400" },
          ].map((r) => (
            <div key={r.regulator} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold">{r.regulator}</p>
                  <span className="text-[8px] font-mono text-muted-foreground">{r.lastTouch}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{r.role} · {r.contact}</p>
              </div>
              <div className="text-right shrink-0 w-16">
                <p className={`text-[11px] font-black font-mono ${r.tc}`}>{r.strength}</p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                  <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.strength}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Strength 0–100 · Prioritaskan perkuat relasi LKPP + Kemenaker untuk akses informasi lebih cepat</p>
      </div>

      {/* Regulation Change Velocity Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-600" /> CHANGE VELOCITY MONITOR — Seberapa Cepat Regulasi Berubah per Domain & Dampaknya ke Beban Kerja Tim
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                {["Domain Regulasi", "Perubahan/Thn", "Kecepatan", "Avg Gap Klien Tau", "Beban Tim MJP", "Prioritas Monitor"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { domain: "Sertifikasi SKK/SBU (LPJK + BNSP)", changes: 8, speed: "CEPAT", gap: "14–30 hari", burden: "TINGGI", priority: "DAILY", pc: "text-red-700" },
                { domain: "Pengadaan Tender (LKPP + LPSE)", changes: 12, speed: "SANGAT CEPAT", gap: "3–7 hari", burden: "SANGAT TINGGI", priority: "REAL-TIME", pc: "text-red-700" },
                { domain: "Standar K3 Konstruksi (Kemenaker)", changes: 3, speed: "LAMBAT", gap: "60–90 hari", burden: "SEDANG", priority: "WEEKLY", pc: "text-blue-700" },
                { domain: "BIM & Teknologi (PUPR)", changes: 2, speed: "LAMBAT", gap: "30–45 hari", burden: "RENDAH", priority: "MONTHLY", pc: "text-muted-foreground" },
                { domain: "ESG & Lingkungan (KLHK + PUPR)", changes: 5, speed: "SEDANG", gap: "14–21 hari", burden: "SEDANG", priority: "WEEKLY", pc: "text-orange-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 hover:shadow-sm transition-all">
                  <td className="px-3 py-2 text-[9px] font-medium">{r.domain}</td>
                  <td className="px-3 py-2 font-mono text-center">{r.changes}×</td>
                  <td className={`px-3 py-2 text-[9px] font-mono ${r.speed === "SANGAT CEPAT" || r.speed === "CEPAT" ? "text-red-700" : r.speed === "SEDANG" ? "text-orange-700" : "text-muted-foreground"}`}>{r.speed}</td>
                  <td className="px-3 py-2 text-[9px] text-muted-foreground">{r.gap}</td>
                  <td className="px-3 py-2 text-[9px] text-muted-foreground">{r.burden}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${r.pc}`}>{r.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regulatory Impact Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> REGULATORY IMPACT RADAR — Dampak Perubahan Regulasi ke Pasar Layanan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[
            { reg: "Wajib SMAP (SE LPJK 04/2023)", market: "200.000+ BUJK", impact: "Pipeline perpanjangan SBU + paket SMAP", revenue: "Rp 2–22jt/klien", urgency: "KRITIS", urgColor: "bg-red-100 text-red-700" },
            { reg: "TKDN ≥40% (SE LKPP 10/2024)", market: "Semua tender APBN", impact: "Layanan verifikasi TKDN + susun BOM", revenue: "Rp 2.5–4.5jt/proyek", urgency: "KRITIS", urgColor: "bg-red-100 text-red-700" },
            { reg: "BIM Wajib (Permen PUPR 9/2023)", market: "Proyek >Rp 100M", impact: "Advisory BIM + pelatihan tim proyek", revenue: "Rp 3.5–9.5jt/klien", urgency: "TINGGI", urgColor: "bg-orange-100 text-orange-700" },
            { reg: "SKK SKKNI 2023 (Update Skema)", market: "100K+ tenaga ahli", impact: "Re-sertifikasi + uji kompetensi ulang", revenue: "Rp 2.7–8.5jt/orang", urgency: "TINGGI", urgColor: "bg-orange-100 text-orange-700" },
            { reg: "K3 Permenaker 5/2021", market: "Semua proyek konstruksi", impact: "Dokumen RKK + audit K3 tahunan", revenue: "Rp 1.5–5jt/proyek", urgency: "SEDANG", urgColor: "bg-yellow-100 text-yellow-700" },
            { reg: "ISO 9001/45001 untuk Tender Besar", market: "BUJK Menengah-Besar", impact: "Pendampingan sertifikasi ISO", revenue: "Rp 12–25jt/klien", urgency: "SEDANG", urgColor: "bg-yellow-100 text-yellow-700" },
          ].map((r) => (
            <div key={r.reg} className="border rounded-sm p-2.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[10px] font-semibold leading-tight">{r.reg}</p>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm shrink-0 font-bold ${r.urgColor}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1">📊 {r.market}</p>
              <p className="text-[10px] text-foreground/80 mb-1">{r.impact}</p>
              <p className="text-[9px] font-mono font-bold text-emerald-600">💰 {r.revenue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Action Timeline */}
      <div className="border rounded-sm p-4 bg-orange-50/20 border-orange-200/50">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-orange-700 mb-3 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" /> COMPLIANCE ACTION TIMELINE — Tindakan Wajib Berdasarkan Urgensi
        </p>
        <div className="flex flex-col gap-2">
          {[
            { deadline: "Segera (< 30 hari)", color: "border-red-400 bg-red-50/40", dot: "bg-red-500", items: [
              { reg: "SE LPJK 04/2023", action: "Komitmen SMAP — daftarkan atau risiko pencabutan SBU", dampak: "KRITIS" },
              { reg: "Permen PUPR 8/2022", action: "Verifikasi masa berlaku SBU — perpanjang 3 bulan sebelum habis", dampak: "KRITIS" },
            ]},
            { deadline: "Segera (30–90 hari)", color: "border-orange-300 bg-orange-50/30", dot: "bg-orange-400", items: [
              { reg: "SE LKPP 10/2024", action: "Susun BOM dengan nilai TKDN ≥40% untuk tender APBN", dampak: "KRITIS" },
              { reg: "Permen PUPR 9/2023", action: "Mulai pelatihan BIM untuk proyek >Rp 100M", dampak: "SEDANG" },
            ]},
            { deadline: "Perencanaan (90–180 hari)", color: "border-yellow-300 bg-yellow-50/20", dot: "bg-yellow-500", items: [
              { reg: "Permenaker No. 5/2021", action: "Audit kepatuhan K3 dan penilaian risiko tempat kerja", dampak: "TINGGI" },
              { reg: "ISO 9001:2015", action: "Siapkan dokumen sistem manajemen mutu untuk tender besar", dampak: "SEDANG" },
            ]},
          ].map((phase) => (
            <div key={phase.deadline} className={`border rounded-sm p-3 ${phase.color}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`w-2 h-2 rounded-full ${phase.dot}`} />
                <span className="text-[10px] font-mono font-bold">{phase.deadline}</span>
              </div>
              <div className="flex flex-col gap-1.5 pl-3.5">
                {phase.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[9px] font-mono bg-white/70 border px-1 py-0.5 rounded-sm shrink-0 mt-0.5">{item.reg}</span>
                    <span className="text-xs leading-snug flex-1">{item.action}</span>
                    <span className={`text-[9px] font-mono px-1 py-0.5 rounded-sm shrink-0 ${item.dampak === "KRITIS" ? "bg-red-100 text-red-700" : item.dampak === "TINGGI" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>{item.dampak}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick-Win Compliance Checklist */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> QUICK-WIN COMPLIANCE CHECKLIST — 10 Langkah Tercepat yang Bisa Dilakukan Hari Ini
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {[
            { no: 1, action: "Cek masa berlaku SBU di portal LPJK — pastikan ≥3 bulan dari sekarang", waktu: "5 menit", dampak: "KRITIS" },
            { no: 2, action: "Download formulir komitmen SMAP dari website LPJK dan tandatangani direksi", waktu: "15 menit", dampak: "KRITIS" },
            { no: 3, action: "Input nilai TKDN semua material utama di TKDN Checker KEMENPERIN", waktu: "30 menit", dampak: "TINGGI" },
            { no: 4, action: "Buat daftar tenaga ahli yang SKK-nya habis dalam 60 hari ke depan", waktu: "10 menit", dampak: "TINGGI" },
            { no: 5, action: "Simpan tautan LPSE PUPR ke bookmark dan set reminder cek tender tiap Senin 08:00", waktu: "2 menit", dampak: "TINGGI" },
            { no: 6, action: "Unduh Permen PUPR No. 9/2023 (BIM) dan identifikasi proyek yang terdampak", waktu: "20 menit", dampak: "SEDANG" },
            { no: 7, action: "Kirim WA blast ke kontraktor rekanan tentang persyaratan SMAP terbaru", waktu: "10 menit", dampak: "SEDANG" },
            { no: 8, action: "Update dokumen company profile dengan subklasifikasi SBU sesuai KBLI 2020", waktu: "45 menit", dampak: "SEDANG" },
            { no: 9, action: "Jadwalkan internal meeting K3 bulanan sesuai Permenaker 5/2021", waktu: "5 menit", dampak: "SEDANG" },
            { no: 10, action: "Review kontrak aktif — pastikan klausul penalti TKDN tidak terlewat", waktu: "60 menit", dampak: "TINGGI" },
          ].map((item) => (
            <div key={item.no} className="flex items-start gap-2 border rounded-sm px-3 py-2 bg-card hover:bg-muted/40 transition-colors group">
              <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0 w-4 mt-0.5">{item.no}.</span>
              <span className="text-xs flex-1 leading-snug">{item.action}</span>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  onClick={() => handleCopyAction(item.no, item.action)}
                  className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground"
                  title="Salin teks" aria-label="Salin teks tindakan"
                >
                  {copiedAction === item.no ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                </button>
                <span className="text-[9px] font-mono text-muted-foreground">{item.waktu}</span>
                <span className={`text-[9px] font-mono px-1 py-0.5 rounded-sm ${item.dampak === "KRITIS" ? "bg-red-100 text-red-700" : item.dampak === "TINGGI" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>{item.dampak}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live signals from scheduler */}
      {liveSignals.length > 0 && (
        <div className="border rounded-sm p-4 bg-emerald-50/30 border-emerald-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <p className="text-xs font-mono font-semibold text-emerald-700 uppercase tracking-wider">Sinyal Regulasi Terkini dari Scheduler</p>
          </div>
          <div className="flex flex-col gap-2">
            {liveSignals.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 text-xs">
                <Globe className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">{item.title}</span>
                  {item.sourceUrl && (
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-primary hover:underline transition-colors inline-flex items-center gap-0.5">
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {item.summary && <p className="text-muted-foreground mt-0.5 line-clamp-1" title={item.summary}>{item.summary}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regulatory Revenue Signal */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> REGULATORY REVENUE SIGNAL — Dampak Regulasi terhadap Pipeline Layanan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                {["Regulasi", "Berlaku Efektif", "Segmen Terdampak", "Layanan Terpicu", "Est. Pipeline", "Urgensi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { reg: "SMAP ISO 37001 Wajib", berlaku: "Jan 2025", seg: "Semua BUJK", layanan: "Paket SMAP Express", pipeline: "Rp 50–300jt", urgensi: "KRITIS", urgColor: "bg-red-100 text-red-700" },
                { reg: "TKDN ≥40% APBN", berlaku: "Jan 2026", seg: "Kontraktor Tender APBN", layanan: "Advisory TKDN + Pendampingan", pipeline: "Rp 30–150jt", urgensi: "KRITIS", urgColor: "bg-red-100 text-red-700" },
                { reg: "BIM Wajib PUPR", berlaku: "2025 (Bertahap)", seg: "BUJK Menengah-Besar", layanan: "Konsultasi BIM Readiness", pipeline: "Rp 25–120jt", urgensi: "TINGGI", urgColor: "bg-orange-100 text-orange-700" },
                { reg: "Perpanjangan SBU LPJK", berlaku: "Siklus 3 Thn", seg: "Semua BUJK", layanan: "Paket Perpanjangan SBU", pipeline: "Rp 80–500jt", urgensi: "TINGGI", urgColor: "bg-orange-100 text-orange-700" },
                { reg: "SKK BNSP Wajib", berlaku: "Ongoing", seg: "Tenaga Ahli Konstruksi", layanan: "Pendampingan SKK Jenjang 7/8/9", pipeline: "Rp 40–200jt", urgensi: "TINGGI", urgColor: "bg-orange-100 text-orange-700" },
                { reg: "K3 Permenaker 5/2021", berlaku: "2021 (Enforced)", seg: "Kontraktor Aktif", layanan: "Audit K3 + Sertifikasi", pipeline: "Rp 15–60jt", urgensi: "SEDANG", urgColor: "bg-yellow-100 text-yellow-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 hover:shadow-sm transition-all">
                  <td className="px-3 py-2 font-medium">{r.reg}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{r.berlaku}</td>
                  <td className="px-3 py-2 text-[10px]">{r.seg}</td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.layanan}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.pipeline}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${r.urgColor}`}>{r.urgensi}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Pipeline = estimasi revenue bulanan yang dapat dibangkitkan dari setiap regulasi berjalan · Update setiap ada peraturan baru</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); e.currentTarget.blur(); } }}
            placeholder="Cari regulasi, kode, catatan… ( / )"
            className="pl-8 h-8 text-xs pr-7"
          />
          {!search && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger className="h-8 w-40 text-xs font-mono bg-background" aria-label="Filter domain regulasi">
            <SelectValue placeholder="Semua Domain" />
          </SelectTrigger>
          <SelectContent>
            {DOMAINS.map((d) => {
              const cnt = d === "Semua Domain" ? REGULATIONS.length : REGULATIONS.filter(r => r.domain === d).length;
              return <SelectItem key={d} value={d} className="text-xs font-mono">{d}{cnt > 0 ? ` (${cnt})` : ""}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-36 text-xs font-mono bg-background" aria-label="Filter status regulasi">
            <SelectValue placeholder="Semua Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs font-mono">{{ "Semua Status":"Semua Status", BARU:"Baru", DIUBAH:"Diubah", DICABUT:"Dicabut", AKAN_BERLAKU:"Akan Berlaku" }[s] ?? s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={impact} onValueChange={setImpact}>
          <SelectTrigger className="h-8 w-32 text-xs font-mono bg-background" aria-label="Filter dampak regulasi">
            <SelectValue placeholder="Semua Dampak" />
          </SelectTrigger>
          <SelectContent>
            {IMPACTS.map((i) => <SelectItem key={i} value={i} className="text-xs font-mono">{{ "Semua Dampak":"Semua Dampak", KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" }[i] ?? i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-8 w-36 text-xs font-mono bg-background" aria-label="Filter kategori regulasi">
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            {REG_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs font-mono">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          onClick={() => setSortByDampak(v => !v)}
          className={cn("h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", sortByDampak ? "bg-red-500 text-white border-red-500" : "border-border text-muted-foreground hover:bg-muted")}
          title="Urut berdasarkan dampak — Kritis dulu"
        >
          {sortByDampak ? "↓ Kritis" : "↑ Dampak"}
        </button>
        {Object.values(regulasiNotes).filter(v => v?.trim()).length > 0 && (
          <button
            onClick={() => setShowWithNotesOnly(v => !v)}
            className={cn("h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
            title="Filter hanya regulasi dengan catatan"
          >
            📝 Ada Catatan
          </button>
        )}
        {(domain !== "Semua Domain" || status !== "Semua Status" || impact !== "Semua Dampak" || catFilter !== "Semua Kategori" || search || sortByDampak || showWithNotesOnly) && (
          <button
            onClick={() => { setDomain("Semua Domain"); setStatus("Semua Status"); setImpact("Semua Dampak"); setCatFilter("Semua Kategori"); setSearch(""); setSortByDampak(false); setShowWithNotesOnly(false); }}
            className="h-8 px-2.5 text-[10px] font-mono font-bold rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
            title="Reset semua filter"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        )}
        <span className="text-xs text-muted-foreground font-mono" aria-live="polite" aria-atomic="true">{filtered.length < REGULATIONS.length ? `${filtered.length} dari ${REGULATIONS.length}` : filtered.length} regulasi</span>
      </div>

      {/* Regulatory Compliance Gap Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> COMPLIANCE GAP RADAR — Area Ketidakpatuhan Tertinggi di Pasar 2026
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { area: "SMAP / Anti-Suap ISO 37001", basis: "Permen PUPR No. 14/2024", gap: "82% BUJK belum tersertifikasi", urgency: "KRITIS", rev: "Rp 8–25jt/klien", urgBg: "bg-red-50/30 border-red-200" },
            { area: "TKDN Konstruksi ≥40%", basis: "SE LKPP No. 10/2024", gap: "60% kontraktor TKDN di bawah threshold", urgency: "KRITIS", rev: "Rp 5–18jt/proyek", urgBg: "bg-red-50/30 border-red-200" },
            { area: "BIM Wajib Proyek >Rp100M", basis: "Permen PUPR No. 9/2023", gap: "75% kontraktor belum adopsi BIM", urgency: "TINGGI", rev: "Rp 10–50jt/proyek", urgBg: "bg-orange-50/30 border-orange-200" },
            { area: "K3 Konstruksi Permenaker", basis: "Permenaker No. 5/2021", gap: "55% proyek kecil-menengah tidak comply", urgency: "TINGGI", rev: "Rp 3–9jt/proyek", urgBg: "bg-orange-50/30 border-orange-200" },
            { area: "Registrasi LPJK Online", basis: "Permen PUPR No. 8/2022", gap: "40% SBU belum update LPJK digital", urgency: "SEDANG", rev: "Rp 1.5–4jt/BUJK", urgBg: "bg-yellow-50/30 border-yellow-200" },
            { area: "SMM ISO 9001:2015", basis: "Standar SNI ISO 9001", gap: "70% BUJK kecil belum tersertifikasi", urgency: "SEDANG", rev: "Rp 3–8jt/klien", urgBg: "bg-yellow-50/30 border-yellow-200" },
          ].map((r) => (
            <div key={r.area} className={`border rounded-sm p-3 ${r.urgBg}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-semibold leading-snug">{r.area}</p>
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 ${r.urgency === "KRITIS" ? "bg-red-100 text-red-700" : r.urgency === "TINGGI" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground mb-1">{r.basis}</p>
              <p className="text-[10px] text-primary font-semibold">{r.gap}</p>
              <p className="text-[10px] font-mono font-bold text-emerald-700 mt-1">{r.rev}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Gap % = estimasi pasar berdasarkan analisis LPJK, LKPP, dan VOC klien · Revenue = nilai layanan konsultasi per klien</p>
      </div>

      {/* Regulation Compliance Conversion Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> COMPLIANCE CONVERSION FUNNEL — Dari Klien yang Tidak Patuh ke Klien yang Taat dan Bayar Layanan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { stage: "AWARE — Tau ada regulasi baru", count: 4200, pct: 100, c: "bg-slate-400", note: "Dari briefing MJP + notifikasi WA" },
            { stage: "UNDERSTAND — Paham dampaknya ke bisnis mereka", count: 2940, pct: 70, c: "bg-blue-400", note: "Drop 30% yang tidak baca/tidak relevan" },
            { stage: "CONCERNED — Tau mereka belum compliant", count: 1764, pct: 42, c: "bg-orange-400", note: "Gap analysis MJP mengidentifikasi masalah" },
            { stage: "ENGAGE — Hubungi MJP untuk solusi", count: 882, pct: 21, c: "bg-violet-500", note: "WA / telepon / form platform" },
            { stage: "CONVERT — Beli layanan compliance MJP", count: 441, pct: 10.5, c: "bg-emerald-600", note: "Rp 8–25jt per transaksi" },
          ].map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              <div className={`rounded-sm h-6 transition-all ${s.c}`} style={{ width: `${s.pct}%`, minWidth: "2rem" }} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-semibold">{s.stage}</p>
                  <span className="text-[8px] font-mono text-muted-foreground">({s.count.toLocaleString()} BUJK · {s.pct}%)</span>
                </div>
                <p className="text-[9px] font-mono text-muted-foreground">{s.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulation Implementation Readiness */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> IMPLEMENTATION READINESS — Seberapa Siap Rata-rata BUJK Mengimplementasikan Regulasi Kunci
        </p>
        <div className="flex flex-col gap-2">
          {[
            { reg: "PP No.14/2021 — Kewajiban SKK + SBU", ready: 38, awareness: 91, action: "Fokus konversi AWARE→READY via layanan express", c: "bg-red-500", ac: "bg-orange-300", tc: "text-red-700" },
            { reg: "SE LPJK 2/2021 — SMAP Wajib", ready: 22, awareness: 64, action: "Tingkatkan awareness dulu (kampanye WA) lalu dorong ke layanan", c: "bg-red-600", ac: "bg-yellow-300", tc: "text-red-700" },
            { reg: "Permen PUPR 9/2023 — Wajib BIM", ready: 14, awareness: 48, action: "Edukasi + advisory BIM readiness = revenue baru", c: "bg-red-700", ac: "bg-yellow-200", tc: "text-red-800" },
            { reg: "UU No.11/2020 — Cipta Kerja OSS", ready: 67, awareness: 94, action: "Layanan maintenance & renewal OSS RBA", c: "bg-emerald-500", ac: "bg-emerald-300", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.reg} className="border-b last:border-0 pb-2 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold">{r.reg}</p>
                <div className="flex gap-3 shrink-0">
                  <span className="text-[8px] font-mono text-muted-foreground">Aware: {r.awareness}%</span>
                  <span className={`text-[8px] font-mono font-bold ${r.tc}`}>Ready: {r.ready}%</span>
                </div>
              </div>
              <div className="flex gap-1 h-2 mb-1">
                <div className={`h-full ${r.ac} rounded-l-full`} style={{ width: `${r.awareness}%` }} />
              </div>
              <div className="flex gap-1 h-2 mb-1">
                <div className={`h-full ${r.c} rounded-l-full`} style={{ width: `${r.ready}%` }} />
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Risk Exposure Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-600" /> REGULATORY RISK EXPOSURE INDEX — Regulasi yang Jika Tidak Dipatuhi Paling Berdampak ke Klien MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              reg: "PP 14/2021 — Wajib SKK untuk semua proyek", riskScore: 9.7,
              exposure: "94% klien belum 100% compliant", sanction: "Kontrak dibatalkan + denda hingga Rp 500jt",
              priority: "KRITIS", pc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              reg: "SE LPJK 2/2021 — SMAP wajib tender BUMN", riskScore: 8.9,
              exposure: "78% klien BUMN target belum punya SMAP", sanction: "Gugur administrasi otomatis",
              priority: "KRITIS", pc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              reg: "Permen PUPR 9/2021 — Perubahan kualifikasi SBU", riskScore: 7.4,
              exposure: "61% SBU aktif perlu upgrade klasifikasi", sanction: "Tidak bisa ajukan tender ≥M",
              priority: "TINGGI", pc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
            {
              reg: "UU Cipta Kerja — OSS-RBA baru", riskScore: 6.2,
              exposure: "39% klien masih pakai NIB lama", sanction: "Izin tidak berlaku untuk proyek baru",
              priority: "SEDANG", pc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
          ].map((r) => (
            <div key={r.reg} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold leading-snug">{r.reg}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[8px] font-mono font-bold ${r.pc}`}>{r.priority}</span>
                  <span className={`text-[10px] font-black font-mono ${r.pc}`}>{r.riskScore}</span>
                </div>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground">Exposure: {r.exposure}</p>
              <p className={`text-[9px] font-mono mt-0.5 ${r.pc}`}>Sanksi: {r.sanction}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulation Revenue Opportunity Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> REGULATION REVENUE MATRIX — Setiap Regulasi Baru = Peluang Revenue Baru Jika MJP Jadi Yang Pertama Menawarkan Solusi
        </p>
        <div className="flex flex-col gap-2">
          {[
            { reg: "Wajib BIM untuk proyek ≥Rp 100M (2027)", market: "4.200 BUJK terdampak", potential: "Rp 126M/tahun", readiness: 14, window: "18 bulan", tc: "text-emerald-700" },
            { reg: "SKK Jenjang baru untuk Net Zero Construction", market: "1.800 insinyur target", potential: "Rp 54M/tahun", readiness: 6, window: "24 bulan", tc: "text-emerald-700" },
            { reg: "Mandatory SMAP untuk semua tender >Rp 50M", market: "2.900 BUJK aktif tender", potential: "Rp 203M/tahun", readiness: 78, window: "6 bulan", tc: "text-blue-700" },
            { reg: "Digital Procurement (e-katalog wajib) 2026", market: "8.000+ BUJK nasional", potential: "Rp 48M/tahun", readiness: 31, window: "12 bulan", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.reg} className="flex items-start gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <p className="text-[9px] font-semibold leading-snug">{r.reg}</p>
                  <span className={`text-[9px] font-mono font-black shrink-0 ${r.tc}`}>{r.potential}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-[8px] font-mono text-muted-foreground">{r.market}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">Window: {r.window}</span>
                  <span className={`text-[8px] font-mono ${r.tc}`}>Readiness: {r.readiness}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Calendar Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> REGULATORY CALENDAR INTELLIGENCE — Tenggat Waktu Regulasi yang Paling Kritis dalam 6 Bulan ke Depan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { deadline: "1 September 2026", reg: "Deadline update data SKK online ke sistem LPJK v3.0", impact: "SKK lama tidak valid di portal tender LPSE", urgency: "KRITIS", uc: "text-red-700", bc: "bg-red-50 border-red-200", daysLeft: 30 },
            { deadline: "1 Oktober 2026", reg: "Masa berlaku SMAP wajib tender BUMN mulai diverifikasi", impact: "1.200+ BUJK tanpa SMAP otomatis gugur", urgency: "KRITIS", uc: "text-red-700", bc: "bg-red-50 border-red-200", daysLeft: 60 },
            { deadline: "1 November 2026", reg: "Perubahan kualifikasi SBU sub-bidang baru (Permen PUPR)", impact: "SBU lama perlu re-klasifikasi di 8 sub-bidang", urgency: "TINGGI", uc: "text-orange-700", bc: "bg-orange-50 border-orange-200", daysLeft: 91 },
            { deadline: "1 Januari 2027", reg: "Wajib BIM untuk proyek pemerintah ≥Rp 100M", impact: "4.200 BUJK gedung wajib punya BIM capability", urgency: "TINGGI", uc: "text-orange-700", bc: "bg-orange-50 border-orange-200", daysLeft: 152 },
            { deadline: "31 Maret 2027", reg: "Peralihan OSS-RBA penuh — IUJK lama tidak berlaku", impact: "Semua BUJK harus re-registrasi OSS baru", urgency: "SEDANG", uc: "text-blue-700", bc: "bg-blue-50 border-blue-200", daysLeft: 241 },
          ].map((r) => (
            <div key={r.deadline} className={`border rounded-sm p-3 ${r.bc} flex gap-3`}>
              <div className="text-center shrink-0 w-14">
                <p className={`text-[14px] font-black font-mono ${r.uc} leading-none`}>{r.daysLeft}</p>
                <p className={`text-[8px] font-mono ${r.uc}`}>hari lagi</p>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold">{r.deadline}</p>
                  <span className={`text-[8px] font-mono font-bold ${r.uc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
                </div>
                <p className="text-[9px] font-medium">{r.reg}</p>
                <p className={`text-[9px] font-mono ${r.uc}`}>Dampak: {r.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Compliance Cost Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> REGULATORY COMPLIANCE COST CALCULATOR — Estimasi Biaya Kepatuhan per Klien Berdasarkan Profil BUJK
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              scenario: "BUJK Kecil — baru masuk sektor konstruksi (start from scratch)",
              items: [
                { item: "SKK 2 tenaga ahli (J7)", cost: "Rp 6.4jt" },
                { item: "SBU Konstruksi Umum", cost: "Rp 8.2jt" },
                { item: "IUJK + OSS RBA", cost: "Rp 1.2jt" },
              ],
              total: "Rp 15.8jt", timeline: "45–60 hari", mjpRole: "Full service — paket starter", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              scenario: "BUJK Menengah — masuk segmen tender BUMN (upgrade profile)",
              items: [
                { item: "SMAP sertifikasi + pelatihan", cost: "Rp 14.5jt" },
                { item: "SKK upgrade J9 (2 orang)", cost: "Rp 9.8jt" },
                { item: "BIM readiness assessment", cost: "Rp 4.2jt" },
              ],
              total: "Rp 28.5jt", timeline: "30–45 hari", mjpRole: "Advisory + pendampingan", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-2`}>{r.scenario}</p>
              <div className="flex flex-col gap-0.5 mb-2">
                {r.items.map((it) => (
                  <div key={it.item} className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">{it.item}</span>
                    <span className={`text-[9px] font-mono ${r.tc}`}>{it.cost}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t pt-1.5">
                <div className="flex gap-3">
                  <span className={`text-[10px] font-black font-mono ${r.tc}`}>Total: {r.total}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{r.timeline}</span>
                </div>
                <span className={`text-[8px] font-mono ${r.tc}`}>MJP: {r.mjpRole}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Arbitrage Opportunities */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> REGULATORY ARBITRAGE OPPORTUNITIES — Celah Regulasi yang Bisa Menjadi Keunggulan Bisnis MJP Sebelum Kompetitor Sadar
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              opp: "Masa transisi SKK online LPJK v3.0 (berlaku 1 Sep 2026)",
              detail: "Selama 3 bulan pertama, sistem baru sering error dan antrean panjang. MJP yang sudah familiar bisa bypass via jalur prioritas partnership.",
              action: "Launch 'SKK Express Guaranteed' — jaminan terbit dalam 14 hari atau refund. Ambil premium 30%.",
              potential: "Rp 12jt/klien × 50 klien = Rp 600jt window 3 bulan",
              urgency: "OPEN NOW", uc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              opp: "SMAP mandatory tender BUMN belum ada konsultan lokal yang siap scale",
              detail: "Kebijakan berlaku 1 Okt 2026 tapi mayoritas konsultan SMAP hanya bisa handle 5–8 klien/bulan. MJP sudah punya sistem onboarding 20+ klien/bulan.",
              action: "Aggressive outreach BUJK BUMN aktif sekarang — capture market sebelum compet scale up.",
              potential: "312 klien teridentifikasi × Rp 18jt avg = Rp 5.6M pipeline",
              urgency: "OPEN NOW", uc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              opp: "BIM mandatory 2027 tapi awareness masih sangat rendah (<8%)",
              detail: "90% BUJK belum tahu BIM wajib 2027. Window edukasi = window akuisisi — yang pertama mendidik, dia yang pertama dipercaya.",
              action: "Free BIM Readiness Webinar bulan ini → capture 1000+ email → nurturing → close advisory 2026.",
              potential: "189 klien qualified × Rp 42jt = Rp 7.9M medium-term TAM",
              urgency: "STRATEGIC", uc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
          ].map((r) => (
            <div key={r.opp} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1">{r.opp}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ml-2 ${r.uc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-1">{r.detail}</p>
              <p className={`text-[9px] font-medium mb-0.5`}>→ {r.action}</p>
              <p className={`text-[9px] font-mono font-bold ${r.uc}`}>💰 {r.potential}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Intelligence Digest */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> REGULATORY INTELLIGENCE DIGEST — 5 Perubahan Regulasi yang Paling Mengubah Lanskap Bisnis Konstruksi Indonesia
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              title: "Permen PUPR No. 6/2021 — Pengetatan SKK Elektronik",
              impact: "Semua SKK wajib digital per sistem LPJK v2.0 — manual tidak lagi diterima tender BUMN",
              mjpResponse: "MJP jadi early adopter SKK digital — 6 bulan sebelum kompetitor sadar ada layanan ini",
              businessValue: "Rp 284jt revenue dari SKK digital sejak berlaku",
              year: "2021", c: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              title: "Perpres No. 22/2020 — SMAP Wajib Tender Pemerintah ≥Rp 50M",
              impact: "7.200 BUJK harus punya SMAP dalam 18 bulan atau gugur dari tender pemerintah skala menengah-besar",
              mjpResponse: "Launch SMAP Advisory dengan workshop + pendampingan — 124 klien dilayani dalam setahun pertama",
              businessValue: "Rp 198jt revenue dari SMAP services",
              year: "2020", c: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              title: "Permen PUPR No. 6/2024 — Wajib BIM Proyek Pemerintah ≥Rp 100M",
              impact: "4.200 BUJK gedung harus punya BIM capability dalam 3 tahun — konsultan BIM kekurangan supply",
              mjpResponse: "Roadmap BIM Advisory belum launch — perlu segera develop atau partnership dengan BIM expert",
              businessValue: "Rp 7.9M TAM tersedia — BELUM DIMONETISASI",
              year: "2024", c: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((r) => (
            <div key={r.title} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[9px] font-bold flex-1`}>{r.title}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ml-2 ${r.c}`}>{r.year}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">📋 Dampak: {r.impact}</p>
              <p className="text-[9px] mb-0.5">🏢 MJP Response: {r.mjpResponse}</p>
              <p className={`text-[9px] font-mono font-bold ${r.c}`}>💰 {r.businessValue}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Impact Simulation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> REGULATORY IMPACT SIMULATION — Jika Regulasi X Diberlakukan Hari Ini, Berapa Klien MJP yang Terpengaruh?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              scenario: "Simulasi: SKK Wajib per Proyek (bukan per tenaga ahli) — jika berlaku",
              clientsImpacted: 487, revenueOpportunity: "Rp 1.2M", urgency: "HIGH", timeline: "Reguasi draft disiapkan 2027",
              mjpAction: "Pre-sell SKK bundled services sebelum regulasi resmi → first mover advantage",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
            {
              scenario: "Simulasi: BIM Wajib Proyek Swasta ≥Rp 25M — jika diperluas dari proyek pemerintah",
              clientsImpacted: 2847, revenueOpportunity: "Rp 14.2M", urgency: "CRITICAL", timeline: "Kemungkinan 2028",
              mjpAction: "Urgent: bangun BIM Advisory sebelum 2028 atau kehilangan window masuk ke market ini",
              tc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              scenario: "Simulasi: SMAP Mandatory BUJK Swasta Semua Skala — jika diperluas",
              clientsImpacted: 12400, revenueOpportunity: "Rp 19.8M", urgency: "HIGH", timeline: "Kemungkinan 2026–2027",
              mjpAction: "Scale SMAP team sekarang — demand bisa naik 10× dalam 6 bulan setelah regulasi berlaku",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1 leading-snug">{r.scenario}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono mb-1">
                <span className="text-muted-foreground">Klien terpengaruh: <span className={`font-bold ${r.tc}`}>{r.clientsImpacted.toLocaleString("id")}</span></span>
                <span className="text-muted-foreground">Opportunity: <span className={`font-bold ${r.tc}`}>{r.revenueOpportunity}</span></span>
                <span className="text-muted-foreground">{r.timeline}</span>
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ {r.mjpAction}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Risk Portfolio */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> REGULATORY RISK PORTFOLIO — Risiko Regulasi yang Perlu Dipantau MJP dan Klien Konstruksi Indonesia
        </p>
        <div className="flex flex-col gap-2">
          {[
            { risk: "Perubahan format LPJK SKK tanpa transisi yang cukup (≤30 hari)", likelihood: 72, impact: 94, exposure: "KRITIS", desc: "Semua 487 klien SKK aktif akan terpengaruh jika terjadi — perlu monitoring ketat dan pre-adaptation plan", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { risk: "Penundaan lebih lanjut implementasi BIM Wajib 2024", likelihood: 61, impact: 48, exposure: "SEDANG", desc: "Mengurangi urgensi klien untuk invest BIM — memperlambat revenue produk baru MJP di segmen ini", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { risk: "Perubahan ambang batas tender wajib SKK (dari Rp 10M menjadi Rp 5M)", likelihood: 34, impact: 87, exposure: "TINGGI", desc: "Jika terjadi: 2.400+ kontraktor mikro baru butuh SKK → TAM MJP naik drastis", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { risk: "Perpres SMAP berlaku untuk semua BUJK swasta (bukan hanya pemerintah)", likelihood: 58, impact: 96, exposure: "KRITIS", desc: "Jika berlaku: 12.000+ BUJK butuh SMAP dalam 18 bulan. Scale-up tim sekarang untuk siap capture", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.risk} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-2 mb-1">
                <p className="text-[9px] font-bold flex-1 leading-snug">{r.risk}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.exposure}</span>
              </div>
              <div className="flex gap-4 text-[8px] font-mono mb-1">
                <span className="text-muted-foreground">Likelihood: <span className={`font-bold ${r.tc}`}>{r.likelihood}%</span></span>
                <span className="text-muted-foreground">Impact: <span className={`font-bold ${r.tc}`}>{r.impact}/100</span></span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Monitoring Automation Status */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> REGULATORY MONITORING AUTOMATION — Status Otomasi Pemantauan Regulasi per Sumber Resmi
        </p>
        <div className="flex flex-col gap-2">
          {[
            { source: "JDIH PUPR (jdih.pu.go.id)", freq: "Setiap 12 jam", lastCheck: "4 jam lalu", autoAlert: true, coverage: 94, sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "LPJK SKK Rule Updates (lpjk.net)", freq: "Setiap 24 jam", lastCheck: "8 jam lalu", autoAlert: true, coverage: 88, sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "Perpres & PP (peraturan.go.id)", freq: "Setiap 6 jam", lastCheck: "2 jam lalu", autoAlert: true, coverage: 79, sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "BSNK Standar Konstruksi (sni.bsn.go.id)", freq: "Setiap 48 jam", lastCheck: "31 jam lalu", autoAlert: false, coverage: 61, sc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { source: "BAPPENAS Proyek Infrastruktur", freq: "Manual (mingguan)", lastCheck: "5 hari lalu", autoAlert: false, coverage: 42, sc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-3 ${r.bc} flex items-center gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold">{r.source}</p>
                  {!r.autoAlert && <span className="text-[7px] font-mono font-bold text-orange-700 bg-orange-100 px-1 rounded">No auto alert</span>}
                </div>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                  <span>Freq: {r.freq}</span>
                  <span>Last: {r.lastCheck}</span>
                  <span className={`font-bold ${r.sc}`}>Coverage: {r.coverage}%</span>
                </div>
              </div>
              <div className="text-center w-8 shrink-0">
                <div className="h-8 bg-muted rounded-sm overflow-hidden flex items-end">
                  <div className={`w-full ${r.coverage >= 80 ? "bg-emerald-400" : r.coverage >= 60 ? "bg-orange-400" : "bg-red-400"} rounded-sm`} style={{ height: `${r.coverage}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">BSNK & BAPPENAS masih manual → otomasi crawler untuk 2 sumber ini = menutup 21% gap coverage pemantauan regulasi MJP</p>
      </div>

      {/* Regulatory Compliance Radar for Top Clients */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> CLIENT COMPLIANCE RADAR — Status Kepatuhan Regulasi 5 Klien Terbesar MJP yang Perlu Dipantau Proaktif
        </p>
        <div className="flex flex-col gap-2">
          {[
            { client: "PT Bangun Nusantara Group", skk: "✓ 12/12 J9 valid", smap: "✓ Valid hingga Mar 2027", iso: "✓ ISO 9001 aktif", bim: "Dalam progress", overall: 94, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { client: "CV Karya Mandiri Bersatu", skk: "⚠ 3/8 J8 expire Sep 2026", smap: "✓ Valid", iso: "Belum ada", bim: "Tidak diperlukan", overall: 72, tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { client: "PT Konstruksi Andalan Prima", skk: "✓ 6/6 J7-J9 valid", smap: "⚠ Update SMAP diperlukan Jun 2026 (terlambat!)", iso: "Dalam proses", bim: "Tidak diperlukan", overall: 68, tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { client: "Asosiasi BUJK Kalimantan (member)", skk: "✗ 14 member belum punya J9 wajib", smap: "Mixed (47% belum)", iso: "N/A (asosiasi)", bim: "N/A", overall: 41, tc: "text-red-700", bc: "bg-red-50 border-red-200" },
          ].map((r) => (
            <div key={r.client} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold">{r.client}</p>
                <div className="text-center shrink-0 ml-2">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.overall}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>/100 score</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[8px] font-mono">
                <div><span className="text-muted-foreground">SKK: </span><span className={r.skk.startsWith("✓") ? "text-emerald-700" : "text-orange-700"}>{r.skk}</span></div>
                <div><span className="text-muted-foreground">SMAP: </span><span className={r.smap.startsWith("✓") ? "text-emerald-700" : "text-orange-700"}>{r.smap}</span></div>
                <div><span className="text-muted-foreground">ISO: </span><span className="text-muted-foreground">{r.iso}</span></div>
                <div><span className="text-muted-foreground">BIM: </span><span className="text-muted-foreground">{r.bim}</span></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Klien compliance radar ini dikirim ke AM masing-masing setiap Senin — proaktif contact sebelum klien menyadari masalah sendiri</p>
      </div>

      {/* Regulatory Trend Forecast 6 Months */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> REGULATORY FORECAST — Prediksi AI: 6 Regulasi yang Kemungkinan Besar Berubah dalam 6 Bulan ke Depan
        </p>
        <div className="flex flex-col gap-2">
          {[
            { regulation: "Kewajiban BIM untuk proyek pemerintah ≥Rp 50M", probability: 91, timeline: "Q4 2026", source: "Draft Permen PUPR sudah di public comment — komentar penutup 15 Agt", impact: "MASSIVE untuk klien MJP yang belum BIM-ready — 312 kontraktor perlu upgrade", ic: "text-red-700", ib: "bg-red-50 border-red-200" },
            { regulation: "SMAP wajib untuk sub-kontraktor swasta", probability: 78, timeline: "Q1 2027", source: "Roadmap LPJK 2025–2030 sudah menyebut ini sebagai target", impact: "HIGH — 1.400+ sub-kontraktor di database MJP belum punya SMAP", ic: "text-orange-700", ib: "bg-orange-50 border-orange-200" },
            { regulation: "Perpanjangan SKK via online-only (tidak bisa offline)", probability: 84, timeline: "Jan 2027", source: "Digitalisasi LPJK phase 3 — sistem baru sudah dalam uji coba", impact: "MEDIUM — berdampak pada klien di wilayah akses internet terbatas", ic: "text-orange-700", ib: "bg-orange-50 border-orange-200" },
            { regulation: "Sertifikasi keselamatan K3 menjadi persyaratan tender nasional", probability: 67, timeline: "H1 2027", source: "Usulan DPR + tekanan accident rate konstruksi yang naik 18%", impact: "HIGH — nilai layanan K3 MJP bisa jadi produk premium baru", ic: "text-blue-700", ib: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.regulation} className={`border rounded-sm p-3 ${r.ib}`}>
              <div className="flex items-start gap-3 mb-1">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.ic} mb-0.5`}>{r.regulation}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">Sumber: {r.source}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[14px] font-black font-mono leading-none ${r.ic}`}>{r.probability}%</p>
                  <p className={`text-[7px] font-mono ${r.ic}`}>{r.timeline}</p>
                </div>
              </div>
              <p className={`text-[9px] font-mono ${r.ic}`}>→ Impact: {r.impact}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Advisory Revenue Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REGULATORY ADVISORY REVENUE MODEL — Bagaimana Layanan Regulasi MJP Menghasilkan Revenue + Peluang Premium Baru
        </p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { service: "Intel Briefing Regulasi (bundled)", price: "Rp 350k/bln (dalam paket)", clients: 247, monthly: "Rp 86.5jt", margin: "89%", tc: "text-primary", bc: "bg-primary/5 border-primary/20" },
              { service: "SMAP Advisory (project-based)", price: "Rp 3.2jt per project", clients: 28, monthly: "Rp 89.6jt", margin: "76%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { service: "Regulatory Alert Add-on", price: "Rp 150k/bln", clients: 84, monthly: "Rp 12.6jt", margin: "94%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            ].map((r) => (
              <div key={r.service} className={`border rounded-sm p-3 ${r.bc} text-center`}>
                <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.service}</p>
                <p className="text-[8px] font-mono text-muted-foreground mb-1">{r.price}</p>
                <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.monthly}</p>
                <p className="text-[7px] font-mono text-muted-foreground">/bln · {r.clients} klien · {r.margin} margin</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-3 bg-muted/30">
            <p className="text-[9px] font-bold mb-1">💡 3 Peluang Premium Baru — Regulatory Advisory Tier Lebih Tinggi:</p>
            {[
              { idea: "Regulatory Compliance Audit (tahunan)", price: "Rp 8.5jt/audit", why: "Corporate BUJK butuh audit formal untuk BUMN tender — belum ada yang offer ini", potential: "Rp 47jt/thn dari 5–7 corporate klien saja" },
              { idea: "Regulatory Change Impact Assessment (per regulasi baru)", price: "Rp 2.5jt/assessment", why: "Saat regulasi baru keluar, semua BUJK butuh tahu: apa yang berubah untuk bisnis mereka?", potential: "4–6 regulasi penting/thn × Rp 2.5jt × 40 klien = Rp 600jt" },
              { idea: "BIM Regulatory Readiness Program (pre-wajib)", price: "Rp 5.5jt/klien", why: "BIM jadi wajib Q4 2026 — MJP bisa jadi satu-satunya guide yang tersertifikasi", potential: "312 klien yang belum BIM-ready × Rp 5.5jt = Rp 1.7M total addressable" },
            ].map((r) => (
              <div key={r.idea} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b last:border-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[9px] font-bold flex-1">{r.idea}</p>
                  <span className="text-[9px] font-mono font-bold text-emerald-700 shrink-0">{r.price}</span>
                </div>
                <p className="text-[8px] text-muted-foreground mb-0.5">{r.why}</p>
                <p className="text-[8px] font-mono text-blue-700">💰 Potential: {r.potential}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Regulatory Risk Prioritization Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> REGULATORY RISK MATRIX — Prioritas Risiko Regulasi untuk Klien MJP Berdasarkan Probabilitas dan Dampak Bisnis
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-bold mb-2 text-red-700">🔴 HIGH PROBABILITY + HIGH IMPACT (action sekarang)</p>
            <div className="flex flex-col gap-1.5">
              {[
                { reg: "BIM wajib proyek pemerintah ≥Rp 50M", probability: 91, impact: 94, clients: 312 },
                { reg: "SKK perpanjangan hanya via sistem online baru", probability: 84, impact: 87, clients: 487 },
                { reg: "SMAP wajib sub-kontraktor swasta", probability: 78, impact: 82, clients: 247 },
              ].map((r) => (
                <div key={r.reg} className="border rounded-sm p-2 border-red-200 bg-red-50/50">
                  <p className="text-[9px] font-bold leading-snug">{r.reg}</p>
                  <div className="flex gap-3 text-[8px] font-mono mt-0.5">
                    <span className="text-red-700">P: {r.probability}%</span>
                    <span className="text-red-700">Impact: {r.impact}%</span>
                    <span className="text-muted-foreground">{r.clients} klien terdampak</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold mb-2 text-orange-700">🟠 HIGH IMPACT + LOW/MED PROBABILITY (monitor)</p>
            <div className="flex flex-col gap-1.5">
              {[
                { reg: "K3 mandatory untuk semua proyek nasional", probability: 67, impact: 91, clients: 488 },
                { reg: "LPJK revamp sistem sertifikasi (format baru)", probability: 52, impact: 96, clients: 487 },
                { reg: "Pembatasan TKA dalam proyek strategis nasional", probability: 41, impact: 74, clients: 28 },
              ].map((r) => (
                <div key={r.reg} className="border rounded-sm p-2 border-orange-200 bg-orange-50/50">
                  <p className="text-[9px] font-bold leading-snug">{r.reg}</p>
                  <div className="flex gap-3 text-[8px] font-mono mt-0.5">
                    <span className="text-orange-700">P: {r.probability}%</span>
                    <span className="text-orange-700">Impact: {r.impact}%</span>
                    <span className="text-muted-foreground">{r.clients} klien terdampak</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Regulation Revenue Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE ATTRIBUTION — Regulasi Mana yang Paling Banyak Menghasilkan Revenue untuk MJP (via Advisory & Compliance Service)?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { reg: "SKK (Sertifikat Kompetensi Kerja) — LPJK", rev: "Rp 312jt", pct: 41, clients: 487, trend: "+14%", tc: "text-emerald-700", c: "bg-emerald-500" },
            { reg: "SIUJK (Surat Izin Usaha Jasa Konstruksi)", rev: "Rp 147jt", pct: 19, clients: 284, trend: "+7%", tc: "text-emerald-700", c: "bg-emerald-400" },
            { reg: "SBU (Sertifikat Badan Usaha)", rev: "Rp 98jt", pct: 13, clients: 167, trend: "+22%", tc: "text-blue-700", c: "bg-blue-400" },
            { reg: "SMAP (Keselamatan Konstruksi K3)", rev: "Rp 74jt", pct: 10, clients: 128, trend: "+31%", tc: "text-blue-700", c: "bg-blue-300" },
            { reg: "BIM (Building Information Modeling)", rev: "Rp 58jt", pct: 8, clients: 62, trend: "+84%", tc: "text-violet-700", c: "bg-violet-400" },
            { reg: "K3 Lingkungan & AMDAL", rev: "Rp 38jt", pct: 5, clients: 47, trend: "+12%", tc: "text-orange-700", c: "bg-orange-400" },
            { reg: "Lainnya (KD, Kontrak Pemerintah, dll)", rev: "Rp 29jt", pct: 4, clients: 84, trend: "+3%", tc: "text-slate-600", c: "bg-slate-400" },
          ].map((r) => (
            <div key={r.reg} className="flex items-center gap-2">
              <p className="text-[9px] flex-1 truncate" title={r.reg}>{r.reg}</p>
              <div className="w-28 h-2 bg-muted rounded-full overflow-hidden shrink-0">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct * 2.4}%` }} />
              </div>
              <p className={`text-[9px] font-mono font-bold w-16 text-right shrink-0 ${r.tc}`}>{r.rev}</p>
              <p className={`text-[8px] font-mono w-9 text-right shrink-0 font-bold ${r.tc}`}>{r.trend}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BIM tumbuh paling cepat (+84%) walau revenue masih kecil — early mover advantage sebelum BIM wajib berlaku Q1 2027</p>
      </div>

      {/* Regulatory Early Warning Feed */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-orange-500" /> REGULATORY EARLY WARNING — Regulasi yang Masih dalam Proses Legislasi tapi Sudah Bisa Diprediksi Dampaknya ke Klien MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { regulation: "RPP Sistem Manajemen Anti Penyuapan (SMAP) Wajib untuk Semua BUJK", stage: "DPR — Komisi V, Sidang ke-3", eta: "Berlaku Q1 2027", probability: 91, affectedClients: 488, impact: "SANGAT TINGGI", action: "Mulai SMAP advisory sekarang sebagai produk pre-regulation — klien yang siap awal punya competitive advantage", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { regulation: "Permen PUPR: BIM wajib untuk proyek pemerintah ≥Rp 50M", stage: "Final review Ditjen Bina Konstruksi", eta: "Berlaku Q3 2027", probability: 87, affectedClients: 312, impact: "TINGGI", action: "BIM Readiness program MJP harus dilaunched Q1 2027 — ini window 6 bulan sebelum wajib", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { regulation: "Revisi PP 22/2020: Kualifikasi BUJK lebih ketat untuk proyek BUMN", stage: "Harmonisasi Kemenkumham", eta: "Berlaku Q2 2027", probability: 74, affectedClients: 247, impact: "TINGGI", action: "Upgrade consulting service — banyak BUJK kecil akan butuh bantuan untuk comply sebelum deadline", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { regulation: "UU Green Building: Konstruksi baru wajib ESG scoring", stage: "Inisiatif DPR — tahap awal", eta: "Berlaku 2028+", probability: 52, affectedClients: 488, impact: "SANGAT TINGGI", action: "Pantau terus — jika lolos, ini akan menjadi compliance market terbesar untuk MJP. Mulai riset 2025.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.regulation} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.regulation}</p>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] font-black font-mono ${r.tc} leading-none`}>{r.probability}%</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>probability</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>Stage: {r.stage}</span>
                <span>ETA: {r.eta}</span>
                <span>{r.affectedClients} klien terdampak</span>
                <span className={`font-bold ${r.tc}`}>{r.impact}</span>
              </div>
              <p className={`text-[9px] font-mono ${r.tc}`}>→ {r.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulation Client Impact Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-primary" /> REGULATION IMPACT CALCULATOR — Berapa Biaya yang Harus Dikeluarkan Klien jika Mereka Tidak Comply Tepat Waktu?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { regulation: "SKK expire — tidak diperpanjang tepat waktu", directCost: "Rp 2.4–8.7jt", indirectCost: "Tender yang tidak bisa diikuti selama masa expire", opportunityCost: "Rata-rata 3.2 tender/bln × Rp 4.7jt nilai rata-rata = Rp 15jt/bln opportunity cost", totalRisk: "Rp 17.4–23.7jt", mjpSolution: "SKK Express (14 jam, Rp 1.2jt) — ROI > 1.000%", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { regulation: "SMAP tidak punya — BUJK kena audit K3 BUMN", directCost: "Denda Rp 5–25jt", indirectCost: "Proyek dihentikan sementara = overrun biaya mobilisasi", opportunityCost: "Reputasi BUJK tercoret di sistem BUMN — dampak 2–3 tahun ke depan", totalRisk: "Rp 30–80jt total exposure", mjpSolution: "SMAP Advisory (Rp 2.8jt) + K3 Implementation Guide (Rp 800rb)", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { regulation: "BIM tidak comply saat wajib Q1 2027", directCost: "Tidak bisa bid tender pemerintah ≥Rp 50M", indirectCost: "Kehilangan semua tender PUPR + BUMN konstruksi", opportunityCost: "Estimasi kehilangan 60–70% pipeline tender klien besar dalam 12 bulan", totalRisk: "Rp 120–480jt tergantung skala klien", mjpSolution: "BIM Readiness (beta Q4 2026, harga TBD ~Rp 8.5jt/klien)", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.regulation} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.regulation}</p>
                <div className="text-right shrink-0 ml-2">
                  <p className={`text-[11px] font-black font-mono ${r.tc} leading-none`}>{r.totalRisk}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>total risk</p>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 mb-0.5">
                <p className="text-[8px] text-muted-foreground">Biaya langsung: {r.directCost}</p>
                <p className="text-[8px] text-muted-foreground">Tidak langsung: {r.indirectCost}</p>
                <p className="text-[8px] text-muted-foreground">Opportunity: {r.opportunityCost}</p>
              </div>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>✓ MJP Solution: {r.mjpSolution}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Compliance Checklist Generator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> COMPLIANCE READINESS SCORECARD — Skor Kesiapan Regulasi MJP untuk Setiap Segmen Klien Utama
        </p>
        <div className="flex flex-col gap-2">
          {[
            { segment: "BUJK Kecil (omset <Rp 2M/thn)", score: 71, strengths: ["SKK J7 coverage 94%", "SIUJK awareness tinggi", "Panduan LPSE tersedia"], gaps: ["SMAP belum diadopsi (23%)", "BIM sama sekali belum ada awareness", "K3 sering dianggap optional"], priority: "SMAP awareness campaign + K3 basic pack", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { segment: "BUJK Menengah (omset Rp 2–20M/thn)", score: 84, strengths: ["SKK J8 penetrasi 78%", "SIUJK + SBU sudah ada", "Sebagian sudah punya SMAP"], gaps: ["BIM readiness 0% (belum ada yang mulai)", "PPP compliance knowledge nol", "ESG reporting belum pernah dibahas"], priority: "BIM Readiness launch Q4 + ESG intro webinar", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { segment: "BUJK Besar (omset > Rp 20M/thn)", score: 91, strengths: ["SKK J9 ada", "SBU komplit", "SMAP + K3 sudah tersertifikasi"], gaps: ["International standards (FIDIC, ISO) masih gaps", "ESG reporting untuk investor asing belum ada", "Digital construction compliance (BIM-J9) baru mulai"], priority: "Premium advisory: FIDIC + ESG + BIM-J9 bundle", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.segment} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-1.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.segment}</p>
                <div className="text-right shrink-0">
                  <p className={`text-[14px] font-black font-mono ${r.tc} leading-none`}>{r.score}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>compliance</p>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${r.score >= 85 ? "bg-emerald-500" : r.score >= 75 ? "bg-blue-400" : "bg-orange-400"}`} style={{ width: `${r.score}%` }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-1">
                <div>
                  <p className="text-[8px] font-bold text-emerald-700 mb-0.5">Kekuatan:</p>
                  {r.strengths.map(s => <p key={s} className="text-[8px] text-muted-foreground">✓ {s}</p>)}
                </div>
                <div>
                  <p className="text-[8px] font-bold text-red-600 mb-0.5">Gap:</p>
                  {r.gaps.map(g => <p key={g} className="text-[8px] text-muted-foreground">✗ {g}</p>)}
                </div>
              </div>
              <p className={`text-[8px] font-mono font-bold ${r.tc}`}>Priority: {r.priority}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulation Intelligence Digest — Next 90 Days */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-amber-500" /> REGULATORY INTELLIGENCE DIGEST — Apa yang Akan Terjadi di Ekosistem Regulasi 90 Hari ke Depan yang Harus Tim MJP Antisipasi?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { date: "15 Sep 2026", event: "Masa perpanjangan SKK gelombang 3 dibuka LPJK", confidence: 97, impactedClients: 312, action: "Siapkan blast WA ke 312 klien 30 hari sebelumnya (15 Agt) + pre-fill form renewal di platform", revenue: "+Rp 374jt renewal revenue in window", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { date: "1 Nov 2026", event: "SMAP menjadi wajib untuk perpanjangan SKK J8/J9", confidence: 94, impactedClients: 247, action: "Bundle SKK renewal + SMAP advisory sudah perlu siap 1 Sep — butuh 60 hari prep tim Sari", revenue: "+Rp 247jt jika semua klien beli bundle", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { date: "Des 2026", event: "Evaluasi kinerja tahunan LPJK — kemungkinan ada simplifikasi sistem SIK", confidence: 61, impactedClients: 487, action: "Monitor statement LPJK + siapkan update panduan jika sistem berubah. Jangan komunikasikan ke klien sampai official.", revenue: "Neutral jika MJP responsif dalam 24 jam dari announcement", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { date: "Q1 2027", event: "BIM menjadi persyaratan tender pemerintah ≥Rp 50M (berdasarkan draft Permen PUPR)", confidence: 78, impactedClients: 183, action: "BIM Readiness beta harus live sebelum Jan 2027 — countdown: 5 bulan. Mulai content dev sekarang.", revenue: "+Rp 183klien × Rp 8.5jt = Rp 1.55M pipeline", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.event} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3 mb-0.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold ${r.tc}`}>{r.event}</p>
                    <span className={`text-[7px] font-mono ${r.tc}`}>{r.date}</span>
                    <span className="text-[7px] font-mono text-muted-foreground">conf: {r.confidence}%</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">{r.impactedClients} klien terdampak</p>
                  <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>Action: {r.action}</p>
                  <p className={`text-[8px] font-mono ${r.tc}`}>Revenue: {r.revenue}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulation Monitoring Sources */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> REGULATION MONITORING SOURCES — Dari Mana MJP Mendapatkan Informasi Regulasi Paling Cepat dan Paling Akurat?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { source: "JDIH PUPR (jdih.pu.go.id)", type: "Official", coverage: "Permen, SE, dan pedoman teknis PUPR — source of truth untuk semua regulasi konstruksi", updateFreq: "Tidak reguler — monitor daily", reliability: 99, latency: "<24 jam dari penetapan", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "Website LPJK (lpjk.net)", type: "Official", coverage: "Peraturan SKK, jenjang, dan sertifikasi — tapi sering tidak diupdate tepat waktu", updateFreq: "Irregular, terkadang lambat", reliability: 84, latency: "1–7 hari (sering terlambat)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { source: "Grup WhatsApp Asosiasi (GAPENSI, LPJKN)", type: "Informal", coverage: "Breaking news: 'baru saja di-announce di rapat, SKK jenjang baru mulai Okt' — real-time rumor mill", updateFreq: "Setiap hari ada posting baru", reliability: 61, latency: "Kadang lebih cepat dari official", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { source: "Konsultan Hukum Konstruksi (retainer)", type: "Expert Network", coverage: "Interpretasi regulasi yang ambiguous — 'apakah ini berlaku untuk BUJK skala kecil?'", updateFreq: "On-demand, 2–3× seminggu", reliability: 97, latency: "24–48 jam dari pertanyaan", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { source: "Klien MJP sebagai early warning system", type: "Crowdsource", coverage: "Klien yang habis dari rapat BUMN/LPJK sering share: 'tadi ada pengumuman di rapat...'", updateFreq: "Tidak terprediksi", reliability: 71, latency: "Real-time dari lapangan", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.source} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold ${r.tc}`}>{r.source}</p>
                    <span className={`text-[7px] font-mono ${r.tc}`}>{r.type}</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground mb-0.5">{r.coverage}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground">
                    <span>Update: {r.updateFreq}</span>
                    <span>Latency: {r.latency}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[13px] font-black font-mono ${r.tc} leading-none`}>{r.reliability}%</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>reliability</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Risk Heat Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-red-500" /> REGULATORY RISK HEAT MAP — Kombinasi Regulasi × Segmen Klien yang Paling Berisiko dan Membutuhkan Perhatian Segera
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[8px] font-mono mb-2">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <th className="text-left p-1 text-muted-foreground">Regulasi</th>
                <th className="p-1 text-center text-muted-foreground">J7</th>
                <th className="p-1 text-center text-muted-foreground">J8</th>
                <th className="p-1 text-center text-muted-foreground">J9</th>
                <th className="text-left p-1 text-muted-foreground">Action MJP</th>
              </tr>
            </thead>
            <tbody>
              {[
                { reg: "SKK Jenjang Naik Turun (Permen PUPR baru)", j7: "🔴 HIGH", j8: "🔴 HIGH", j9: "🟡 MED", action: "Update 247 records + alert semua klien afektif" },
                { reg: "BPJS TK Kontraktor (wajib per Jan 2027)", j7: "🟡 MED", j8: "🔴 HIGH", j9: "🔴 HIGH", action: "Buat compliance guide + reminder 90 hari sebelum" },
                { reg: "BIM Requirement Proyek BUMN (>50M)", j7: "⚪ LOW", j8: "🟡 MED", j9: "🔴 HIGH", action: "BIM Readiness assessment + partner LSP BIM" },
                { reg: "Green Building Sertifikasi (GBCI)", j7: "⚪ LOW", j8: "⚪ LOW", j9: "🟡 MED", action: "Monitor perkembangan, tidak urgent untuk sekarang" },
                { reg: "PKPT Klasifikasi Ulang (LPJK 2026)", j7: "🔴 HIGH", j8: "🔴 HIGH", j9: "🟡 MED", action: "PRIORITY: 87 klien MJP perlu re-klasifikasi sebelum Sep" },
                { reg: "Pajak WHT Konstruksi (DJP circular baru)", j7: "🟡 MED", j8: "🔴 HIGH", j9: "🟡 MED", action: "Tax alert + referral KAP mitra untuk konsultasi" },
              ].map((r) => (
                <tr key={r.reg} className="border-b hover:bg-muted/40 transition-colors">
                  <td className="p-1 text-[8px]">{r.reg}</td>
                  <td className="p-1 text-center">{r.j7}</td>
                  <td className="p-1 text-center">{r.j8}</td>
                  <td className="p-1 text-center">{r.j9}</td>
                  <td className="p-1 text-[8px] text-muted-foreground">{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">PKPT + SKK = double impact untuk klien J7/J8. 87 klien butuh dual action sebelum Sep 2026 — inisiasi campaign khusus ASAP.</p>
      </div>

      {/* Regulatory Communication Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-blue-500" /> COMMUNICATION STRATEGY — Bagaimana MJP Mengkomunikasikan Regulasi Baru ke Klien agar Tidak Overwhelm tapi Tidak Terlewat?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { level: "CRITICAL — Regulasi berlaku dalam <30 hari, penalti jika tidak comply", format: "Immediate WhatsApp: subject line 'PENTING: [Nama Regulasi] berlaku [tanggal] — Ini yang perlu Anda lakukan'", channel: "WhatsApp direct + email follow-up + AM phone call untuk klien at-risk", examples: "SKK expire deadline, PKPT renewal, BPJS ketenagakerjaan wajib", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { level: "HIGH — Regulasi baru yang mengubah cara kerja operasional dalam 30–90 hari", format: "Intel Briefing section khusus 'Regulasi Update' dengan ringkasan 3 bullet + link ke knowledge article lengkap", channel: "Intel Briefing + dedicated email weekly digest", examples: "BIM requirement announcement, klasifikasi BUJK revisi, Permen baru PUPR", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { level: "MEDIUM — Regulasi yang relevan tapi tidak mendesak (berlaku > 90 hari)", format: "Knowledge Registry update + link di monthly newsletter. Tidak di-push proaktif via WhatsApp.", channel: "Platform only — klien yang mau tahu bisa search di Knowledge Registry", examples: "Peraturan teknis bangunan hijau, update SNI konstruksi, pedoman K3", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { level: "LOW — Regulasi yang mungkin relevan di masa depan (> 6 bulan horizon)", format: "Watchlist saja. Tidak dikomunikasikan kecuali ada klien yang spesifik request.", channel: "Internal tracking. Sari maintain watchlist, review monthly.", examples: "Draft rancangan Permen yang belum final, pembahasan di DPR terkait konstruksi", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.level} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.level}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Format: {r.format}</p>
              <p className={`text-[8px] font-mono ${r.tc} mb-0.5`}>Channel: {r.channel}</p>
              <p className="text-[8px] text-muted-foreground">Contoh: {r.examples}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Compliance Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-primary" /> COMPLIANCE COST CALCULATOR — Berapa Biaya yang Dihemat Klien dengan Bantuan MJP untuk Compliance vs Jika Mereka Lakukan Sendiri?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              scenario: "SKK J8 Renewal — Self-serve vs via MJP Express",
              selfCost: ["Waktu riset syarat: 8 jam × Rp 150rb/jam = Rp 1.2jt", "Biaya salah dokumen/retry: rata-rata 2× = Rp 800rb extra", "Waktu menunggu antrian LSP: 14 hari (idle cost)", "Total biaya self-serve: ~Rp 2.4jt + 22 hari"],
              mjpCost: ["SKK Express fee: Rp 1.8jt (all-in)", "Waktu klien: <2 jam (isi form + submit)", "Waktu menunggu: 5 hari (LSP mitra prioritas)"],
              savings: "Rp 600rb biaya langsung + 17 hari waktu yang bisa dipakai untuk bid tender",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              scenario: "Regulasi Change Monitoring — Internal vs via MJP",
              selfCost: ["1 orang dedicated monitor 3 sumber regulasi: 2 jam/hari × 20 hari = 40 jam/bln", "Rate staf: Rp 75rb/jam. Biaya bulanan: Rp 3jt", "Miss rate dengan monitoring manual: ~23% (datanya baru tahu 7–14 hari terlambat)"],
              mjpCost: ["MJP subscription: Rp 1.2jt/bln (Growth tier)", "Coverage: 15+ sumber regulasi", "Alert latency: <24 jam dari perubahan"],
              savings: "Rp 1.8jt/bln + coverage 5× lebih banyak + miss rate 0.7% vs 23%",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.scenario}</p>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <div>
                  <p className="text-[8px] font-bold text-red-700 mb-0.5">Tanpa MJP:</p>
                  {r.selfCost.map((c, i) => <p key={i} className="text-[8px] text-muted-foreground">• {c}</p>)}
                </div>
                <div>
                  <p className="text-[8px] font-bold text-emerald-700 mb-0.5">Dengan MJP:</p>
                  {r.mjpCost.map((c, i) => <p key={i} className="text-[8px] text-muted-foreground">• {c}</p>)}
                </div>
              </div>
              <p className={`text-[9px] font-bold font-mono ${r.tc}`}>💰 Savings: {r.savings}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">ROI calculator ini digunakan AM dalam sales pitch. Visual proof bahwa MJP bukan cost — ini adalah cost reduction tool.</p>
      </div>

      {/* Regulation Backlog & Editorial Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> REGULATORY EDITORIAL PLAN — Artikel dan Panduan Regulasi yang Akan Dibuat Tim Sari dalam 30 Hari ke Depan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { title: "Panduan Lengkap PKPT Klasifikasi Ulang 2026 — Step by Step untuk BUJK J7 dan J8", priority: "P0 — CRITICAL", deadline: "5 Agt 2026", owner: "Sari", format: "Long-form guide + checklist PDF downloadable", demand: "398 searches/bln, 87 klien afektif", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { title: "BIM Requirement untuk Proyek BUMN: Apa yang Perlu Anda Ketahui Sekarang", priority: "P1 — HIGH", deadline: "10 Agt 2026", owner: "Sari + BIM consultant external", format: "Explainer article + FAQ", demand: "387 searches/bln, tren +127%", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { title: "Subkontraktor MEP Terpercaya: Cara Screening dan Database Rekomendasi MJP", priority: "P1 — HIGH", deadline: "12 Agt 2026", owner: "Budi + Reza", format: "Database article + trust score guide", demand: "289 searches/bln", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { title: "Update Terbaru SIJK (Sistem Informasi Jasa Konstruksi): Cara Pakai yang Baru", priority: "P1 — HIGH", deadline: "Sebelum Okt berlaku", owner: "Sari", format: "Tutorial step-by-step dengan screenshot", demand: "Akan meledak saat Okt berlaku — prepare now", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { title: "Cara Hitung WHT Konstruksi 2026: DJP Circular Terbaru + Kalkulator Otomatis", priority: "P2 — MEDIUM", deadline: "20 Agt 2026", owner: "Sari + KAP mitra", format: "Guide + embedded calculator tool", demand: "247 searches/bln", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { title: "Tender Retaining Wall Sulawesi 2026: Intelligence Report untuk BUJK yang Mau Ekspansi", priority: "P2 — MEDIUM", deadline: "25 Agt 2026", owner: "Budi (lapangan Sulawesi)", format: "Market intelligence report", demand: "234 searches/bln, tren +156%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.title} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.title}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.priority}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono text-muted-foreground">
                <span>Deadline: {r.deadline}</span>
                <span>Owner: {r.owner}</span>
                <span>Format: {r.format}</span>
                <span className={r.tc}>Demand: {r.demand}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">6 artikel × avg 4 jam production = 24 jam produksi dalam 30 hari. Dengan Sari full-bandwidth di entity resolution fix (Sprint 23), realistik Dewi + Budi harus ambil 3 artikel.</p>
      </div>

      {/* Regulatory Alert Escalation Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> ESCALATION MATRIX — Saat Ada Perubahan Regulasi Besar, Siapa yang Harus Dikabari Dalam Berapa Jam dan Melalui Apa?
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <th className="text-left p-1 text-muted-foreground">Level</th>
                <th className="p-1 text-left text-muted-foreground">Contoh Trigger</th>
                <th className="p-1 text-center text-muted-foreground">SLA Deteksi</th>
                <th className="p-1 text-center text-muted-foreground">SLA Alert ke Klien</th>
                <th className="p-1 text-left text-muted-foreground">Internal Escalation</th>
                <th className="p-1 text-left text-muted-foreground">Channel ke Klien</th>
              </tr>
            </thead>
            <tbody>
              {[
                { level: "L1 CRITICAL", trigger: "Permen PUPR baru berlaku dalam 30 hari — ubah syarat tender", det: "4 jam", alert: "24 jam", internal: "Sari → Hendra → All AM dalam 2 jam", client: "WhatsApp blast + email + briefing special edition", tc: "text-red-700" },
                { level: "L2 HIGH", trigger: "PKPT update yang ubah klasifikasi BUJK", det: "12 jam", alert: "48 jam", internal: "Sari → Hendra dalam 4 jam", client: "WhatsApp ke klien terdampak + email regular", tc: "text-orange-700" },
                { level: "L3 MEDIUM", trigger: "Persyaratan dokumen tender berubah minor", det: "24 jam", alert: "5 hari", internal: "Sari update knowledge asset, notify Tim Research", client: "Masuk Intel Briefing harian + knowledge update", tc: "text-blue-700" },
                { level: "L4 LOW", trigger: "Clarification circular, FAQ update resmi", det: "48 jam", alert: "14 hari", internal: "Sari log di knowledge registry", client: "Knowledge Registry update saja, no push alert", tc: "text-slate-600" },
              ].map((r) => (
                <tr key={r.level} className="border-b hover:bg-muted/40 transition-colors">
                  <td className={`p-1 font-bold ${r.tc}`}>{r.level}</td>
                  <td className="p-1 text-muted-foreground">{r.trigger}</td>
                  <td className={`p-1 text-center ${r.tc}`}>{r.det}</td>
                  <td className={`p-1 text-center ${r.tc}`}>{r.alert}</td>
                  <td className="p-1 text-muted-foreground">{r.internal}</td>
                  <td className="p-1 text-muted-foreground">{r.client}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Matrix ini adalah living document — dikalibrasi ulang setelah setiap L1 event untuk improve SLA. Last calibration: Maret 2026 post-PKPT announcement.</p>
      </div>

      {/* Regulatory Intelligence vs Competitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> REGULATORY COVERAGE ADVANTAGE — Mengapa Klien Tidak Bisa Dapat Intel Regulasi Setara dengan Hanya Membaca LPJK atau Google?
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <th className="text-left p-1 text-muted-foreground">Dimensi</th>
                <th className="p-1 text-center text-muted-foreground">LPJK/Kemenpu langsung</th>
                <th className="p-1 text-center text-muted-foreground">Google/Media Umum</th>
                <th className="p-1 text-center text-muted-foreground">Konsultan Hukum</th>
                <th className="p-1 text-center text-emerald-700">MJP Platform</th>
              </tr>
            </thead>
            <tbody>
              {[
                { dim: "Alert saat ada perubahan", lpjk: "Tidak ada", google: "Tidak sistematis", konsultan: "Jika di-retainer", mjp: "<24 jam, push" },
                { dim: "Interpretasi praktis untuk BUJK", lpjk: "Bahasa hukum, tidak practical", google: "Sering tidak akurat", konsultan: "Akurat tapi mahal", mjp: "Bahasa praktis + contoh kasus" },
                { dim: "Coverage wilayah (regional nuance)", lpjk: "Nasional only", google: "Nasional only", konsultan: "Tergantung spesialisasi", mjp: "Nasional + regional nuance (Sari's expertise)" },
                { dim: "Update frequency", lpjk: "Saat ada perubahan (tidak alert)", google: "Beberapa hari terlambat", konsultan: "Jika Anda tanya", mjp: "Real-time monitoring, 24/7" },
                { dim: "Linkage ke tender aktif", lpjk: "Tidak ada", google: "Tidak ada", konsultan: "Tidak ada", mjp: "Direct link ke tender yang terpengaruh" },
                { dim: "Biaya akses", lpjk: "Gratis (tapi butuh effort besar)", google: "Gratis (tapi inaccurate)", konsultan: "Rp 5–25jt/bln retainer", mjp: "Bundled di subscription" },
              ].map((r) => (
                <tr key={r.dim} className="border-b hover:bg-muted/40 transition-colors">
                  <td className="p-1 font-bold">{r.dim}</td>
                  <td className="p-1 text-center text-muted-foreground">{r.lpjk}</td>
                  <td className="p-1 text-center text-muted-foreground">{r.google}</td>
                  <td className="p-1 text-center text-muted-foreground">{r.konsultan}</td>
                  <td className="p-1 text-center text-emerald-700 font-bold">{r.mjp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tabel ini digunakan AM saat prospect bilang 'saya bisa cari sendiri di Google'. Jawaban: bisa, tapi butuh 40 jam/bln ekuivalen, akurasinya tidak terjamin, dan tidak ada push alert kapan perlu action.</p>
      </div>

      {/* Regulation Impact Assessment Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> IMPACT ASSESSMENT — Bagaimana MJP Menilai Seberapa Besar Dampak Sebuah Regulasi Baru terhadap Klien Sebelum Memutuskan Cara Komunikasinya?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Setiap regulasi baru diassess dengan 5 dimensi — total score menentukan alert level:</p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-1.5 mb-2">
            {[
              { dim: "Breadth", desc: "Berapa % klien MJP terdampak?", score1: "<10% = 1pt", score5: ">80% = 5pt", tc: "text-blue-700" },
              { dim: "Urgency", desc: "Seberapa cepat harus direspons?", score1: "> 6 bln = 1pt", score5: "<30 hr = 5pt", tc: "text-blue-700" },
              { dim: "Severity", desc: "Apa konsekuensi non-compliance?", score1: "Admin fine = 1pt", score5: "Disqualifikasi = 5pt", tc: "text-orange-700" },
              { dim: "Complexity", desc: "Seberapa sulit untuk comply?", score1: "1 dokumen = 1pt", score5: "Major restructuring = 5pt", tc: "text-orange-700" },
              { dim: "Novelty", desc: "Seberapa berbeda dari existing rules?", score1: "Minor revision = 1pt", score5: "Completely new = 5pt", tc: "text-red-700" },
            ].map((r) => (
              <div key={r.dim} className="border rounded-sm p-2 bg-muted/20">
                <p className={`text-[8px] font-bold ${r.tc}`}>{r.dim}</p>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.score1}</p>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.score5}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {[
              { range: "20–25 pts", level: "L1 CRITICAL", action: "WhatsApp blast dalam <24 jam + dedicated briefing", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
              { range: "14–19 pts", level: "L2 HIGH", action: "Push notification dalam 48 jam + knowledge asset", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { range: "8–13 pts", level: "L3 MEDIUM", action: "Masuk Intel Briefing minggu ini + knowledge update", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { range: "5–7 pts", level: "L4 LOW", action: "Knowledge Registry update, no active push", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            ].map((r) => (
              <div key={r.range} className={`flex items-center gap-2 border rounded-sm p-2 ${r.bc}`}>
                <span className={`text-[8px] font-mono font-bold w-14 shrink-0 ${r.tc}`}>{r.range}</span>
                <span className={`text-[8px] font-bold w-20 shrink-0 ${r.tc}`}>{r.level}</span>
                <span className={`text-[8px] ${r.tc}`}>{r.action}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Framework ini standardize penilaian — sebelumnya terlalu subjektif. Now: dua researcher berbeda akan score sama regulasi dalam {"±"}2 poin. Consistency builds trust.</p>
      </div>

      {/* Regulatory Horizon Scan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> REGULATORY HORIZON — Regulasi yang Sedang dalam Proses dan Diperkirakan Efektif dalam 6–18 Bulan ke Depan. Klien Perlu Bersiap Sekarang.
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              reg: "BIM Mandatory untuk Tender BUMN > Rp 50M",
              expectedEffect: "Q1 2027 (Jan)",
              confidence: "VERY HIGH (Kemenpu sudah announce roadmap resmi)",
              impact: "Semua J8/J9 yang mau ikut tender BUMN besar wajib punya BIM capability. ~60% klien MJP BELUM punya BIM capability.",
              prepAction: "MJP sudah develop BIM Readiness Assessment. Klien yang start sekarang: 6 bulan lead time cukup. Yang tunggu Q4 2026: mepet.",
              urgency: "URGENT", tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              reg: "Revisi Perlem LPJK tentang Validasi SKK Online",
              expectedEffect: "Q2 2027 (estimate)",
              confidence: "HIGH (draft sudah di public consultation phase)",
              impact: "Proses verifikasi SKK berubah — BUJK tidak perlu lagi kirim fisik. TAPI: sistem online belum proven, potensi bug dan delay.",
              prepAction: "Monitor closely. MJP akan alert ketika sistem baru live. Klien yang SKK-nya hampir expire: proses sekarang via sistem lama yang sudah terbukti.",
              urgency: "MEDIUM", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              reg: "Carbon Footprint Reporting untuk Proyek Konstruksi > Rp 100M",
              expectedEffect: "2028 (panjang tapi harus mulai sekarang)",
              confidence: "MEDIUM (Perpres draft, belum disahkan)",
              impact: "BUJK J9 akan wajib report carbon footprint per proyek. Butuh data collection system yang tidak ada sekarang.",
              prepAction: "Early movers yang build carbon tracking sekarang akan differentiated. MJP exploring partnership dengan carbon consultant untuk advisory service.",
              urgency: "MONITOR", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.reg} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.reg}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={`font-bold ${r.tc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
                  <span className="text-muted-foreground">{r.expectedEffect}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Confidence: {r.confidence}</p>
              <p className="text-[8px] mb-0.5">{r.impact}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Prep now: {r.prepAction}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Horizon scanning adalah MJP's highest-value service menurut 78% Enterprise klien. Knowing what's coming 12+ months early = material competitive advantage. Especially true for BIM mandate.</p>
      </div>

      {/* Regulatory Compliance ROI */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> COMPLIANCE ROI — Berapa Nilai Nyata yang Diterima Klien dari Menghindari Compliance Failures yang MJP Deteksi Lebih Awal?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              scenario: "Tidak tahu tentang PKPT subklasifikasi change — daftar tender dengan subklas lama",
              consequence: "Gugur administrasi. Kehilangan seluruh waktu persiapan + biaya dokumen.",
              avgCost: "Rp 8.4jt per kejadian (biaya persiapan + opportunity cost tim selama 2 minggu)",
              mjpPrevention: "MJP mengirim L1 alert 4 bulan sebelum efektif. 94% klien update sebelum deadline.",
              prevented2026: "184 klien x 1 potential gugur = Rp 1.5M kerugian dicegah 2026",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              scenario: "SKK expire saat evaluasi tender — tidak sadar sudah kadaluarsa",
              consequence: "Gugur teknis. Apalagi jika tender bernilai besar — kehilangan kontrak yang sudah dikerjakan selama berbulan-bulan.",
              avgCost: "Opportunity cost 1 tender yang hilang: avg Rp 5.8M (J8 sweet spot)",
              mjpPrevention: "MJP monitor expiry dates semua SKK klien. Alert 90 hari, 30 hari, 7 hari sebelum expire.",
              prevented2026: "67 SKK close-to-expire cases handled 2026 YTD. Est. Rp 389jt opportunity cost saved.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              scenario: "Tidak tahu perubahan persyaratan SKKNI untuk kategori khusus",
              consequence: "Tenaga ahli yang disubmit tidak lagi qualify untuk tender kategori tertentu.",
              avgCost: "Emergency SKK Express (rush): +Rp 1.5jt premium vs normal. Plus delay risk.",
              mjpPrevention: "Knowledge Registry update dalam 24 jam dari LPJK announcement.",
              prevented2026: "23 SKKNI change alerts 2026. Est. 40% klien yang relevant take preemptive action.",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.scenario} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.scenario}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Consequence: {r.consequence}</p>
              <p className="text-[8px] mb-0.5"><span className="font-bold">Avg cost:</span> {r.avgCost}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.prevented2026}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total estimated compliance failures prevented 2026: value {'>'} Rp 2.3M. MJP subscription cost untuk 487 klien seluruh tahun: ~Rp 8.2M. Compliance prevention alone delivers 28% of subscription value.</p>
      </div>

      {/* Regulatory Source Credibility Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> SOURCE CREDIBILITY — Tidak Semua Sumber Regulatory Sama: Hierarki Otoritas yang Menentukan Mana yang MJP Prioritaskan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { tier: "TIER 1 — DEFINITIF", sources: ["UU (Undang-Undang) yang disahkan DPR", "PP (Peraturan Pemerintah) ditandatangani Presiden", "Perpres (Peraturan Presiden)"], authority: "Mengikat semua pihak. Override semua sumber di bawah. Tidak ada interpretasi alternatif.", mjpAction: "L1 alert dalam <24 jam. Sari review personally. Hendra approve sebelum publish.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { tier: "TIER 2 — SANGAT KUAT", sources: ["Permen (Peraturan Menteri) PUPR, LPJK", "Perlem (Peraturan Lembaga) LPJK", "Edaran Menteri yang bersifat memaksa"], authority: "Mengikat di bawah PP. Berlaku untuk sektor konstruksi langsung. Sering lebih operasional.", mjpAction: "L1 atau L2 alert tergantung urgency. Dewi draft, Sari review.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { tier: "TIER 3 — KUAT (SEKTORAL)", sources: ["Pergub / Perbub (daerah) yang affect tender daerah", "SE (Surat Edaran) yang bersifat mandatory", "Juknis (Petunjuk Teknis) yang legally binding"], authority: "Berlaku di level tertentu. Regional regulations override national untuk tender daerah.", mjpAction: "L2 atau L3 alert. Dewi handle dengan spot-check dari Sari.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { tier: "TIER 4 — PANDUAN (NON-BINDING)", sources: ["FAQ resmi dari lembaga", "Guidance documents", "Best practice dari LPJK/Kemenpu"], authority: "Tidak mengikat secara hukum tapi mencerminkan intent dan interpretation dari pembuat regulasi.", mjpAction: "L3 atau L4. Masuk Knowledge Registry sebagai guidance, clearly labeled 'non-binding'.", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.tier} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <div className="grid grid-cols-2 gap-1 mb-0.5">
                <div><p className="text-[8px] font-bold">Sources:</p>{r.sources.map((s, i) => <p key={i} className="text-[8px] text-muted-foreground">• {s}</p>)}</div>
                <div><p className="text-[8px] font-bold">MJP Action:</p><p className="text-[8px] text-muted-foreground">{r.mjpAction}</p></div>
              </div>
              <p className={`text-[8px] font-mono ${r.tc}`}>{r.authority}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Credibility hierarchy adalah Sari's editorial backbone. Ketika ada konflik antara sumber: Tier 1 always wins. Tier 4 yang kontradiksi Tier 1 = misleading — tidak dipublish tanpa disclaimer eksplisit.</p>
      </div>

      {/* Regulatory Monitoring Cadence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> MONITORING CADENCE — Berapa Sering Sari & Dewi Memeriksa Setiap Sumber Regulasi dan Bagaimana Jadwal Ini Diprioritaskan?
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[8px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <th className="text-left p-1 text-muted-foreground">Sumber</th>
                <th className="p-1 text-center text-muted-foreground">Frekuensi</th>
                <th className="p-1 text-center text-muted-foreground">Siapa</th>
                <th className="p-1 text-center text-muted-foreground">Estimasi Waktu</th>
                <th className="p-1 text-center text-muted-foreground">Method</th>
              </tr>
            </thead>
            <tbody>
              {[
                { source: "JDIH Kemenpu (peraturan PUPR)", freq: "Daily", who: "Crawler", time: "0 menit (automated)", method: "RSS + scraper", tc: "text-emerald-700" },
                { source: "LPJK — Perlem & SK", freq: "3× seminggu", who: "Dewi", time: "15 menit", method: "Manual check LPJK website", tc: "text-blue-700" },
                { source: "Kementerian Keuangan (anggaran terkait PJB)", freq: "Mingguan", who: "Dewi + Crawler", time: "10 menit review", method: "Crawler + kurator", tc: "text-blue-700" },
                { source: "LKPP (Perpres pengadaan)", freq: "Mingguan", who: "Sari", time: "20 menit", method: "Manual + LKPP newsletter", tc: "text-blue-700" },
                { source: "BPK (audit findings yang affect policy)", freq: "Bulanan", who: "Sari", time: "30 menit", method: "BPK e-library scan", tc: "text-orange-700" },
                { source: "DPR komisi terkait (draft RUU)", freq: "Bulanan", who: "Sari", time: "45 menit", method: "DPR website + media konstruksi", tc: "text-orange-700" },
                { source: "Sumber industri (Konstruksi Indonesia, GAPENSI)", freq: "Mingguan", who: "Sari / AM network", time: "20 menit", method: "RSS feed + AM field notes", tc: "text-blue-700" },
              ].map((r) => (
                <tr key={r.source} className="border-b hover:bg-muted/40 transition-colors">
                  <td className="p-1 font-bold">{r.source}</td>
                  <td className={`p-1 text-center ${r.tc}`}>{r.freq}</td>
                  <td className="p-1 text-center">{r.who}</td>
                  <td className="p-1 text-center">{r.time}</td>
                  <td className="p-1 text-center text-muted-foreground">{r.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total weekly monitoring effort: ~2.5 jam Dewi + 1.5 jam Sari + automated crawler. Terasa seperti banyak tapi ini adalah inti dari MJP value proposition. Jika monitoring turun = product quality turun.</p>
      </div>

      {/* Upcoming Regulation High Watch List */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-orange-500" /> HIGH WATCH LIST — 5 Perubahan Regulasi Terbesar yang MJP Pantau Ketat pada H2 2026 dan Proyeksi Dampaknya ke Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { regulation: "Perpres No. XX/2026 — Kewajiban BIM untuk Proyek Pemerintah > Rp 100M", status: "SIGNED, EFFECTIVE JAN 2027", urgency: "CRITICAL", clientImpact: "87% klien J9 dan 34% klien J8 akan terdampak langsung. Butuh: BIM software, BIM manager certified, SOP baru.", mjpAction: "BIM Knowledge Vertical in progress: 47 assets planned, 12 published. Sari partner dengan BIM trainer for co-authored content.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { regulation: "Revisi Perpres 12/2021 — Pengadaan Barang/Jasa Pemerintah (LKPP amendment)", status: "CONSULTATION PHASE — est. Q3 2026 final", urgency: "HIGH", clientImpact: "Potensial perubahan threshold nilai pengadaan. Jika threshold naik: lebih banyak proyek bisa pakai non-tender (langsung). Menguntungkan untuk J8 klien MJP.", mjpAction: "Dewi monitor LKPP website daily. Draft analysis ready for L1 alert day of publication.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { regulation: "SE LPJK Nomor XX — Standar Minimum Tenaga Ahli per KBLI update", status: "ANTICIPATED Q4 2026", urgency: "HIGH", clientImpact: "Beberapa KBLI akan punya standar minimum SKK yang lebih strict. Klien yang tidak comply = tidak bisa bid kategori tersebut.", mjpAction: "SKK Express surge plan ready. Pre-brief 156 klien yang potentially affected saat SE terbit.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { regulation: "PP Keselamatan Konstruksi (SMMK) — Perluasan kewajiban ke proyek swasta", status: "RUMORED — unconfirmed", urgency: "MEDIUM (monitoring)", clientImpact: "Jika berlaku untuk swasta: biaya compliance naik signifikan untuk J8 yang banyak kerja swasta.", mjpAction: "Watch only. Tidak publish sampai ada konfirmasi resmi. Alert Sari jika ada media konstruksi menyebut ini.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.regulation} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.regulation}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={`font-bold ${r.tc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
                </div>
              </div>
              <p className={`text-[7px] font-mono mb-0.5 ${r.tc}`}>{{ BARU:"Baru", DIUBAH:"Diubah", DICABUT:"Dicabut", AKAN_BERLAKU:"Akan Berlaku" }[r.status] ?? r.status}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Impact: {r.clientImpact}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>MJP Action: {r.mjpAction}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BIM mandate adalah highest-priority regulatory shift MJP has ever tracked. Entire product vertical being built around it. This is also a growth catalyst: BIM-focused klien akan butuh Enterprise tier.</p>
      </div>

      {/* BIM Mandate Readiness Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> BIM READINESS — Berapa Persen Klien MJP yang Siap Menghadapi Kewajiban BIM Januari 2027 dan Apa yang Perlu Dilakukan 5 Bulan ke Depan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { stat: "14%", label: "Klien sudah BIM-ready", tc: "text-emerald-700" },
              { stat: "61%", label: "Tidak tahu BIM diperlukan", tc: "text-red-700" },
              { stat: "25%", label: "Aware tapi belum prepare", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-xl font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[8px] font-mono font-bold mb-1">MJP Action Plan H2 2026 — BIM Readiness Program:</p>
          {[
            { action: "Agustus 2026: BIM Awareness Campaign", detail: "Email + WA blast ke 87% klien yang belum ready. Subject: 'Proyek > Rp 100M Anda akan gugur otomatis per Januari 2027 tanpa ini.' Include simple self-assessment checklist.", owner: "Reza + Sari", deadline: "Aug 15" },
            { action: "September: BIM Readiness Webinar", detail: "Gratis untuk semua klien. 3 speaker: Sari (regulatory), BIM Consultant partner, klien yang already implemented. 200+ expected.", owner: "Sari", deadline: "Sep 3" },
            { action: "Oktober: BIM Knowledge Vertical Launch", detail: "47 knowledge assets khusus BIM di Knowledge Registry. Include: certified assessor directory, software comparison, implementation cost estimator.", owner: "Sari + Dewi", deadline: "Oct 1" },
            { action: "November: BIM Advisory Service Launch (Enterprise Add-on)", detail: "Rp 3.5jt/proyek BIM advisory consultation. MJP partners dengan BIM specialist. Split fee 60/40 MJP/specialist.", owner: "Hendra", deadline: "Nov 1" },
          ].map((r) => (
            <div key={r.action} className="border rounded-sm p-2 bg-orange-50 border-orange-200">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[9px] font-bold text-orange-700 flex-1">{r.action}</p>
                <span className="text-[7px] font-mono text-orange-700 shrink-0">{r.deadline} | {r.owner}</span>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BIM mandate = MJP's biggest single commercial opportunity in 5 years. 86% of relevant klien unprepared = massive addressable need. If MJP successfully upskills 50% of at-risk klien: est. +Rp 140jt additional ARR from advisory upsell.</p>
      </div>

      {/* Regulatory Risk Heat Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> REGULATORY RISK MATRIX — Matriks Risiko Regulasi 2026–2027: Probabilitas Perubahan × Dampak ke Klien = Prioritas Monitoring MJP
        </p>
        <div className="flex flex-col gap-1 mb-3">
          <div className="grid grid-cols-4 gap-1 text-[7px] font-mono text-center mb-1">
            <div />
            <div className="font-bold text-green-600">Low Impact</div>
            <div className="font-bold text-orange-600">Medium Impact</div>
            <div className="font-bold text-red-600">High Impact</div>
          </div>
          {[
            {
              prob: "HIGH PROB",
              tc: "text-red-700",
              cells: [
                { topic: "Minor SKKNI subcategory updates", color: "bg-yellow-100 border-yellow-400" },
                { topic: "LKPP threshold adjustments", color: "bg-orange-100 border-orange-400" },
                { topic: "BIM mandate (Perpres XX/2026)", color: "bg-red-100 border-red-400" },
              ]
            },
            {
              prob: "MEDIUM PROB",
              tc: "text-orange-700",
              cells: [
                { topic: "e-katalog expansion categories", color: "bg-green-100 border-green-400" },
                { topic: "SKK continuing education requirements", color: "bg-yellow-100 border-yellow-400" },
                { topic: "SMMK expansion to private sector", color: "bg-orange-100 border-orange-400" },
              ]
            },
            {
              prob: "LOW PROB",
              tc: "text-blue-700",
              cells: [
                { topic: "New e-procurement platform", color: "bg-green-100 border-green-400" },
                { topic: "Major procurement law rewrite", color: "bg-green-100 border-green-400" },
                { topic: "Foreign contractor liberalization", color: "bg-yellow-100 border-yellow-400" },
              ]
            },
          ].map((row) => (
            <div key={row.prob} className="grid grid-cols-4 gap-1">
              <div className={`text-[7px] font-mono font-bold flex items-center justify-center border rounded p-1 ${row.tc}`}>{row.prob}</div>
              {row.cells.map((cell, i) => (
                <div key={i} className={`border rounded p-1.5 text-[7px] ${cell.color}`}>{cell.topic}</div>
              ))}
            </div>
          ))}
          <div className="flex gap-3 mt-1 text-[7px]">
            {[{ c: "bg-red-100 border-red-400", l: "CRITICAL — Sari owns, daily watch" }, { c: "bg-orange-100 border-orange-400", l: "HIGH — Weekly watch" }, { c: "bg-yellow-100 border-yellow-400", l: "MEDIUM — Monthly check" }, { c: "bg-green-100 border-green-400", l: "LOW — Quarterly scan" }].map(({ c, l }) => <div key={l} className="flex items-center gap-1"><div className={`w-3 h-3 border rounded ${c}`} /><span>{l}</span></div>)}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Matrix reviewed quarterly. Positions shift as signals emerge. BIM started as MEDIUM PROB 2 years ago — now SIGNED. Early detection (when still MEDIUM PROB) gave MJP 18 months to build the vertical. That's the competitive advantage.</p>
      </div>

      {/* Regulatory Compliance Cost Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-emerald-600" /> COMPLIANCE COST CALC — Berapa Total Biaya Compliance Regulasi yang Dikeluarkan BUJK Kelas J8 per Tahun dan Berapa yang Bisa Dihindari dengan MJP?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Baseline: J8 BUJK aktif, 12–18 tender/tahun, 2 kategori KBLI utama, 4 tenaga ahli SKK.</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Compliance cost item</th>
                  <th className="p-1 text-center">Without MJP</th>
                  <th className="p-1 text-center">With MJP</th>
                  <th className="p-1 text-center text-emerald-700">Savings</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Gugur administrasi (avg 2.1×/tahun @ Rp 8.4jt each)", "Rp 17.6jt", "Rp 2.1jt (0.25× avg)", "Rp 15.5jt"],
                  ["SKK perpanjangan terlambat (penalty + rush fee)", "Rp 7.2jt", "Rp 1.1jt (advance notice)", "Rp 6.1jt"],
                  ["Admin time: monitoring regulasi manual (2.5 jam/minggu)", "Rp 5.8jt (staf time)", "Rp 0 (included in subscription)", "Rp 5.8jt"],
                  ["Konsultan legal ad-hoc untuk interpret regulasi baru", "Rp 8.4jt", "Rp 0 (MJP coverage)", "Rp 8.4jt"],
                  ["Lelang yang diikuti tapi tidak mungkin menang (bad intel)", "Rp 6.3jt", "Rp 1.9jt (better intel)", "Rp 4.4jt"],
                  ["Total compliance-related costs", "Rp 45.3jt/tahun", "Rp 5.1jt/tahun", "Rp 40.2jt/tahun"],
                ].map(([item, wo, w, sv], i) => (
                  <tr key={i} className={`border-b ${i === 5 ? "font-bold bg-emerald-50" : "hover:bg-muted/40 transition-colors"}`}>
                    <td className="p-1">{item}</td>
                    <td className="p-1 text-center text-red-700">{wo}</td>
                    <td className="p-1 text-center">{w}</td>
                    <td className="p-1 text-center text-emerald-700">{sv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">MJP Growth subscription cost (annual): Rp 18jt. Net savings: Rp 40.2jt - Rp 18jt = Rp 22.2jt/tahun = 2.24× ROI on subscription cost alone.</p>
            <p className="text-[8px] text-muted-foreground">This calculation excludes tender win rate improvement value (which adds another 3–5× on top). Total ROI including win rate improvement: 15–22× subscription cost.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Compliance cost calculator adalah Reza's most effective sales tool. When prospect says 'Rp 1.5jt/bln itu mahal' — Reza shows this table. 'Biaya Anda tanpa MJP: Rp 3.8jt/bln dalam compliance costs. Net cost MJP: minus Rp 2.3jt/bln.' Conversation closes itself.</p>
      </div>

      {/* Regulatory Interpretation SOP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> INTERPRETATION SOP — Panduan Sari dalam Menginterpretasikan Regulasi Baru: Dari Membaca Teks Hukum ke Rekomendasi Konkret untuk BUJK
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { step: "Step 1: Identify the primary operative clause", detail: "Baca regulasi dari belakang ke depan: pasal terakhir sering berisi 'ketentuan peralihan' dan 'ketentuan penutup' yang menentukan KAPAN dan SIAPA terdampak. Tentukan: pasal utama yang mengharuskan tindakan.", tc: "text-blue-700" },
            { step: "Step 2: Map affected BUJK segments", detail: "Regulasi ini berlaku untuk: BUJK kelas apa (J7/J8/J9)? KBLI apa? Nilai kontrak berapa? Jika tidak ada batasan: semua BUJK terdampak. Sari membuat tabel dampak per segmen.", tc: "text-blue-700" },
            { step: "Step 3: Identify the action deadline", detail: "Kapan klien harus comply? Tanggal efektif vs tanggal diundangkan. Masa transisi (jika ada). Hitung hari kerja ke deadline. Jika < 60 hari = L1 alert. Jika 60–180 hari = L2. Jika > 180 hari = L3.", tc: "text-orange-700" },
            { step: "Step 4: Identify the compliance action", detail: "Apa yang konkret harus dilakukan klien? Contoh: 'update SBU dalam 30 hari', 'rekrut 1 tenaga ahli baru jenjang 8 untuk KBLI 41011', 'daftarkan ke sistem baru X'. Sari tulis dalam kalimat imperatif.", tc: "text-orange-700" },
            { step: "Step 5: Cross-check with previous regulation", detail: "Apakah ini mengubah / mencabut / melengkapi aturan sebelumnya? Sari maintains 'regulatory version tree' di Notion — setiap aturan linked ke aturan yang dicabut/diubah. Prevents conflicting advice.", tc: "text-emerald-700" },
            { step: "Step 6: Write the alert / asset", detail: "Gunakan template L1/L2/L3 yang sudah ada. Mulai dengan: impact summary (1 kalimat). Lanjut: siapa terdampak, deadline, action required, source link. End dengan: Sari's personal recommendation.", tc: "text-emerald-700" },
          ].map((r, i) => (
            <div key={r.step} className="flex gap-2 items-start border-b pb-1.5">
              <span className={`text-[8px] font-black w-4 shrink-0 ${r.tc}`}>{i + 1}.</span>
              <div className="flex-1">
                <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
                <p className="text-[8px] text-muted-foreground">{r.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">SOP ini dibuat setelah 1 kali error: Sari salah interpret 'berlaku sejak diundangkan' sebagai immediate vs '30 hari setelah diundangkan'. Klien yang acted immediately spent money unnecessarily. SOP step 3 added specifically to prevent this. All SOPs are incident-driven — each error produces a better process.</p>
      </div>

      {/* Regulatory Monitoring Network */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> MONITORING NETWORK — Jaringan 14 Sumber Regulasi yang Sari Monitor Secara Rutin: Frekuensi, Kanal, dan Siapa yang Jadi Early Informer?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Sumber</th>
                  <th className="p-1 text-center">Frekuensi Cek</th>
                  <th className="p-1 text-center">Metode</th>
                  <th className="p-1 text-center">Skor Urgency</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LKPP (Peraturan Pengadaan)", "Harian", "Google Alert + email subscr.", "★★★★★"],
                  ["LPJK Jasa Konstruksi", "2× seminggu", "Automated crawler + Dewi manual", "★★★★★"],
                  ["Kementerian PUPR (Permen)", "Mingguan", "JDIH PUPR + Google Alert", "★★★★☆"],
                  ["Kementerian ATR/BPN", "Bulanan", "JDIH ATR/BPN", "★★★☆☆"],
                  ["Kementerian Keuangan (APBN, PMK)", "Bulanan + ad-hoc", "Kemenkeu website + DJPB circular", "★★★★☆"],
                  ["Sekretariat Negara (Perpres, PP)", "Bulanan", "JDIH Setneg + Peraturan.go.id", "★★★★★"],
                  ["DPR / RUU tracking", "Bulanan", "DPR website + media konstruksi", "★★★☆☆"],
                  ["Asosiasi (GAPENSI, GAPEKSINDO)", "Mingguan", "WA Group Sari + direct contact", "★★★★☆"],
                  ["LSP Konstruksi newsletters", "Bulanan", "Direct email + Dewi's LSP contacts", "★★★☆☆"],
                  ["Media Konstruksi (Bali Post, Kompas Properti)", "Harian", "Google Alert + Budi monitoring", "★★☆☆☆"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Human intelligence network — Sari's key early informers:</p>
            <p className="text-[8px]">3 trusted contacts in LPJK who alert Sari before official announcement (avg +5 days early). 1 contact in Kemenkeu who flags PMK construction-related drafts in comment period. 2 GAPENSI board members. 1 DPR Komisi V staff (infrastructure committee). This network is Sari's 5-year investment — irreplaceable.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Sari monitors 14+ sources across 5 categories. Total monitoring time: 4.5 jam/minggu. Early warning advantage: avg 8 days faster than competitor platforms in issuing alerts (manually verified by Reza comparing with competitor publications).</p>
      </div>

      {/* Regulatory Impact by BUJK Class */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HardHat className="h-3.5 w-3.5 text-primary" /> IMPACT BY CLASS — Dampak Regulasi Berbeda untuk Setiap Kelas BUJK: Mengapa Satu Peraturan Bisa Berdampak Sangat Berbeda untuk J7, J8, dan J9?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Satu peraturan, tiga respons berbeda. Contoh: Perpres BIM 2026:</p>
          {[
            { kelas: "J9 BUJK (Besar)", impact: "WAJIB comply mulai 1 Jan 2027 untuk proyek > Rp 50M. 86% dari J9 MJP belum punya BIM competency. Immediate action required.", urgency: "L1 CRITICAL", action: "Training + software budget + possibly hire BIM coordinator. SKK BIM belum ada — SKKNI sedang disusun.", timeline: "6 bulan sebelum mandate", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { kelas: "J8 BUJK (Menengah Besar)", impact: "Tidak wajib langsung — tapi proyek nilai > Rp 50M semakin kompetitif karena J9 dengan BIM preference. Indirect market pressure.", urgency: "L2 HIGH", action: "Strategic decision: invest in BIM early (differentiation) or wait for J8-specific mandate (risk). Sari's recommendation: invest early.", timeline: "12 bulan untuk keputusan strategis", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { kelas: "J7 BUJK (Menengah)", impact: "Tidak terdampak langsung. Tapi: klien pemerintah mulai menanyakan BIM readiness even for J7. Reputational risk jika tidak tahu apa itu BIM.", urgency: "L3 MONITOR", action: "Basic literacy: baca MJP BIM overview assets (3 jam). Tidak perlu software/hire. Cukup untuk pertanyaan klien.", timeline: "12–18 bulan awareness only", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.kelas} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.kelas}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{({ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" } as Record<string,string>)[r.urgency] ?? r.urgency}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.impact}</p>
              <p className="text-[8px] mb-0.5">Action: {r.action}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Timeline: {r.timeline}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Class-specific impact analysis adalah MJP's biggest value-add over generic regulatory alerts. Government publications say 'all BUJK'. MJP says 'J8 klien di Jawa: here's specifically what this means for you and what to do by when.' Precision = actionability = trust.</p>
      </div>

      {/* Legal Change Velocity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> CHANGE VELOCITY — Seberapa Cepat Regulasi Konstruksi Indonesia Berubah: Tren 5 Tahun dan Apa yang Menyebabkan Lonjakan Perubahan di 2025–2026?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Tahun</th>
                  <th className="p-1 text-center">Reg Changes</th>
                  <th className="p-1 text-center">L1 Alerts</th>
                  <th className="p-1 text-center">Major Overhauls</th>
                  <th className="p-1 text-center">Primary Driver</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["2021", "47", "22", "1", "Omnibus Law construction provisions"],
                  ["2022", "38", "18", "0", "Post-Omnibus implementation"],
                  ["2023", "52", "28", "2", "KBLI reclassification + SBU reform"],
                  ["2024", "61", "34", "3", "Perpres PBJ revision + LPJK restructuring"],
                  ["2025", "89", "52", "5", "IKN regulation + BIM mandate + Jokowi legacy finalization"],
                  ["2026 YTD", "43", "31", "2", "Prabowo-era infrastructure push + BIM enforcement"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/40 transition-colors ${i >= 4 ? "font-bold" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className={`p-1 text-center ${parseInt(row[1]) >= 60 ? "text-orange-700" : "text-muted-foreground"}`}>{row[1]}</td>
                    <td className={`p-1 text-center ${parseInt(row[2]) >= 50 ? "text-primary" : "text-muted-foreground"}`}>{row[2]}</td>
                    <td className={`p-1 text-center ${parseInt(row[3]) >= 4 ? "text-red-700" : "text-muted-foreground"}`}>{row[3]}</td>
                    <td className="p-1 text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700">Why 2025 was the highest-change year in 5 years:</p>
            <p className="text-[8px]">3 simultaneous drivers: (1) IKN construction = new category of regulations (infrastructure of national significance), (2) BIM mandate signed → cascading implementation regulations, (3) Jokowi administration finalizing legacy infrastructure legislation before transition. 2025 was a regulatory 'year-end sprint' in policy terms. MJP team added 130 work-hours of monitoring capacity in H2 2025 to handle volume.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">High regulatory velocity = high MJP value. Every change = potential klien disruption = reason they need MJP. The most dangerous period for BUJK (2025) was MJP's highest subscription growth period. Correlation: more changes → more klien anxiety → more MJP signups. Sari: 'Regulatory chaos is our tailwind.'</p>
      </div>

      {/* Regulatory Stakeholder Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> STAKEHOLDER MAP — Peta Pemangku Kepentingan Regulasi Konstruksi Indonesia: Siapa Membuat Aturan, Siapa Menegakkan, Siapa Memberi Pengecualian?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              role: "PEMBUAT REGULASI",
              entities: [
                { name: "Kementerian PUPR", scope: "Peraturan Menteri PUPR — standar teknis, SBU, SKKNI, procurement rules untuk sektor konstruksi", contact: "Pusat Data dan Teknologi Informasi (PDTI)" },
                { name: "LKPP", scope: "Perpres PBJ (pengadaan barang/jasa pemerintah). Governs all government procurement tender rules.", contact: "Direktorat Pengembangan Strategi dan Kebijakan" },
                { name: "DPR Komisi V + VI", scope: "UU Jasa Konstruksi, revisi legislasi. Long cycle (3–5 tahun). Sari monitors via draft leaks and DPR open sessions.", contact: "Biro Humas DPR" },
              ],
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              role: "PELAKSANA / SERTIFIKASI",
              entities: [
                { name: "LPJK (Lembaga Pengembangan Jasa Konstruksi)", scope: "Administers SBU issuance, SKK assessment. Dewi's primary relationship hub.", contact: "Dewi has direct contact with 3 regional LPJK officers" },
                { name: "BNSP (Badan Nasional Sertifikasi Profesi)", scope: "Governs SKKNI standards and assessor licensing. Upstream of LPJK for new professional categories.", contact: "Working group observer (Dewi attends 2×/year)" },
                { name: "BPKP / BPK", scope: "Audit body — their findings often trigger procurement regulation revisions. Audit findings = future L1 alert signals.", contact: "Public reports only (no direct contact)" },
              ],
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              role: "ASOSIASI (SOFT INFLUENCE)",
              entities: [
                { name: "GAPENSI (Gabungan Pelaksana Konstruksi Nasional)", scope: "Largest BUJK association. GAPENSI lobbies PUPR/LKPP on behalf of members. Regulation changes often previewed in GAPENSI events.", contact: "Target for MJP partnership (Reza's Q4 2026 target)" },
                { name: "ASPEKINDO + INKINDO", scope: "Smaller associations — specialist/consultant BUJK. L3 signal sources for niche regulation changes.", contact: "Newsletter monitoring only" },
              ],
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
          ].map((r) => (
            <div key={r.role} className={`border rounded-sm p-2.5 ${r.bc} mb-1`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.role}</p>
              {r.entities.map((e) => (
                <div key={e.name} className="border-b py-1">
                  <p className="text-[8px] font-bold">{e.name}</p>
                  <p className="text-[7px] text-muted-foreground mb-0.5">{e.scope}</p>
                  <p className="text-[7px] font-mono">MJP contact: {e.contact}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Stakeholder map ensures MJP sources regulatory intelligence from decision-makers, not just publications. Dewi's LPJK relationship = off-record guidance 6–12 months before official publication. GAPENSI partnership (target Q4 2026) would add 8.000+ BUJK email addresses as potential MJP leads — the single largest potential klien acquisition event in MJP history.</p>
      </div>

      {/* Regulatory Enforcement Gradient */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> ENFORCEMENT GRADIENT — Tidak Semua Regulasi Ditegakkan Sama: Panduan MJP untuk Membedakan Regulasi Wajib vs Hiasan dan Implikasinya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Enforcement varies dramatically across the regulatory landscape. Sari's 3-tier enforcement model:</p>
          {[
            {
              tier: "Tier A — Hard Enforcement (wajib, akan didiskualifikasi)",
              description: "Rules enforced by panitia lelang as disqualification criteria. Checked during document evaluation. Zero tolerance. Examples: SBU not valid, SKK expired, blacklisted, financial threshold not met.",
              examples: ["SKK tenaga ahli tidak sesuai (22% disqualification reason)", "SBU expired or wrong sub-classification", "Vendor registered on daftar hitam LKPP/LPJK"],
              action: "IMMEDIATE COMPLIANCE REQUIRED. No negotiation or interpretation.",
              tc: "text-red-700", bc: "bg-red-50 border-red-200"
            },
            {
              tier: "Tier B — Soft Enforcement (berlaku tapi jarang diperiksa mendalam)",
              description: "Technically required but enforcement depends on panitia diligence and buyer type. Large national projects: stricter. Small kabupaten projects: often overlooked. Examples: BIM compliance (currently transitional), some environmental documentation.",
              examples: ["BIM readiness (wajib > Rp 50M, 2027 — enforcement ramping)", "Detailed waste management plan", "Some ISO certification requirements"],
              action: "COMPLY WHERE PRACTICAL. Flag to klien but not emergency. Monitor enforcement trend.",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
            {
              tier: "Tier C — Aspirational Regulation (ada di atas kertas, tidak aktif ditegakkan)",
              description: "Regulations that exist legally but have zero enforcement mechanism or budget. Often legacy rules from era before digital procurement. Following them is virtuous but not required for tender eligibility.",
              examples: ["Some CSR documentation requirements for small-scale tenders", "Certain environmental impact studies for non-AMDAL threshold projects", "Some training log certifications"],
              action: "MONITOR ONLY. Worth documenting if BUJK asks. Don't create compliance burden for non-issue.",
              tc: "text-muted-foreground", bc: "bg-muted/10 border-muted"
            },
          ].map((r) => (
            <div key={r.tier} className={`border rounded-sm p-3 ${r.bc} mb-1`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.tier}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className="text-[7px] mb-0.5">Examples: {r.examples.join(" · ")}</p>
              <p className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Enforcement gradient is one of Sari's most valuable but least publicized intelligence outputs. BUJK who treat every regulation as Tier A waste enormous compliance resources. BUJK who treat every regulation as Tier C get disqualified. MJP's label on every regulatory alert includes enforcement tier. This is the practical wisdom no government publication provides.</p>
      </div>

      {/* Regulatory Gap Analysis 2026 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <SearchCode className="h-3.5 w-3.5 text-primary" /> GAP ANALYSIS — Analisis Kesenjangan Regulasi 2026: 8 Area di Mana Peraturan Belum Jelas, Masih Kontradiktif, atau Implementasinya Belum Terdefinisi
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { area: "BIM Mandate Threshold Interpretation", tension: "Permen PUPR No.22/2018 says BIM wajib > Rp 100M non-sederhana. 'Non-sederhana' undefined. Panitia interpretasi berbeda-beda.", impact: "High", sariRec: "Dewi's network guidance: err on BIM for any project > Rp 100M. Cost of BIM compliance < cost of disqualification.", status: "🔴 Active gap" },
            { area: "UU PDP Scope for BUJK", tension: "UU PDP 2022: applies to 'personal data processors'. BUJK who store karyawan data = processors. But enforcement guidance for small contractors not published.", impact: "Medium", sariRec: "Low-risk: document existing data handling, appoint a contact person. Not yet actively enforced for BUJK < 100 karyawan.", status: "🟡 Monitoring" },
            { area: "K3 Officer Requirement vs. SKK Availability", tension: "Ahli K3 required for projects > tertentu threshold. But certified Ahli K3 supply is insufficient. Gap between legal requirement and market availability.", impact: "High", sariRec: "Dewi tracking BNSP's K3 certification expansion. Current workaround: consortium with K3-certified BUJK if not internally available.", status: "🔴 Active gap" },
            { area: "BUMN Procurement Integration with LKPP", tension: "BUMN supposed to integrate procurement with LKPP SIRUP by 2025. Implementation uneven. 34 of 62 major BUMN still on legacy portals.", impact: "Medium", sariRec: "Monitor quarterly. When BUMN migrates to SIRUP: their tenders appear in MJP's standard crawl automatically.", status: "🟡 Transitioning" },
            { area: "Sub-contractor SKK Requirement Clarity", tension: "Main contractor responsible for sub-contractor SKK compliance. But circular responsibility: main contractor not always able to verify sub-contractor SKK in real-time.", impact: "Medium", sariRec: "Verify sub-contractors via LPJK portal before contract signature. Request SKK certificate copy. MJP's BUJK Trust Score includes sub-contractor screening data.", status: "🟡 Practical workaround available" },
            { area: "Digitally Signed Documents Acceptance", tension: "E-signature acceptable for most documents post-2021. But some panitia still require wet signatures. No uniform enforcement.", impact: "Low", sariRec: "Always prepare both digital and physical signature versions for high-value tenders until practice standardizes.", status: "🟡 Transitioning" },
            { area: "SBU Reciprocity Across Provinces", tension: "SBU registered in DKI Jakarta: valid nationally. But some provincial LPSE systems still show 'unrecognized' for out-of-province SBU. System bug vs. policy gap unclear.", impact: "High", sariRec: "Dewi: include LPJK SBU print-out (not just digital cert) in tender document. Physical evidence overrides system query failures.", status: "🔴 Active gap" },
            { area: "AI-Generated Document Authenticity", tension: "Regulation silent on AI-assisted documents (method statements, safety plans). Not explicitly banned. But authenticity questions emerging from some panitia.", impact: "Low now, trending Medium", sariRec: "AI-assisted = assisted, not generated. Human review and sign-off required. Sari tracks this gap — may become Tier A by 2027.", status: "🟡 Emerging" },
          ].map((r) => (
            <div key={r.area} className="flex gap-2 border-b py-1.5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[8px] font-bold">{r.area}</p>
                  <span className={`text-[7px] font-mono ${r.status.includes("🔴") ? "text-red-700" : "text-orange-700"}`}>{r.status}</span>
                </div>
                <p className="text-[7px] text-muted-foreground mb-0.5">{r.tension}</p>
                <p className="text-[7px] text-primary font-mono">Rec: {r.sariRec}</p>
              </div>
              <span className={`text-[7px] font-mono shrink-0 w-14 text-right ${r.impact === "High" ? "text-red-700 font-bold" : "text-orange-700"}`}>Impact: {r.impact}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory gaps are updated quarterly. 3 gaps resolved since last audit (removed from list). New gaps: AI-generated documents (emerging). Sari's principle: a gap is NOT necessarily a risk — it may be an opportunity. BUJK who navigate BIM ambiguity correctly while competitors over-comply waste compliance resources. Sari's gap analysis saves an avg Enterprise klien Rp 35jt/year in unnecessary compliance spending.</p>
      </div>

      {/* Regulatory Intelligence Lead Time */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> LEAD TIME — Berapa Jauh MJP Bisa Memberikan Peringatan Dini Sebelum Perubahan Regulasi Berlaku: Analisis 8 Regulasi Terbaru dan Waktu Deteksi MJP vs. Pasar Umum
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Regulasi</th>
                  <th className="p-1 text-center">Effective Date</th>
                  <th className="p-1 text-center">MJP First Alert</th>
                  <th className="p-1 text-center">Lead Time</th>
                  <th className="p-1 text-center">Market Awareness</th>
                  <th className="p-1 text-left">MJP Advantage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["BIM Mandate (Permen PUPR 22/2018 enforcement)", "Jan 2027", "Mar 2026", "10 bulan", "~1 bulan sebelum efektif", "9 bulan early warning"],
                  ["SKK Digital Verification System (LPJK)", "Apr 2025", "Dec 2024", "4 bulan", "~2 minggu sebelum efektif", "3.5 bulan early warning"],
                  ["UU PDP BUJK compliance deadline", "Oct 2024", "May 2024", "5 bulan", "~3 bulan sebelum efektif", "2 bulan early warning"],
                  ["LKPP e-katalog expansion (KBLI extension)", "Feb 2025", "Oct 2024", "4 bulan", "~1 bulan sebelum efektif", "3 bulan early warning"],
                  ["Jenjang SBU 3-level simplification", "Aug 2024", "Apr 2024", "4 bulan", "~2 minggu sebelum efektif", "3.5 bulan early warning"],
                  ["BPJS Ketenagakerjaan mandatory for sub-contractor", "Jun 2024", "Jan 2024", "5 bulan", "~1 bulan sebelum efektif", "4 bulan early warning"],
                  ["HPS transparency requirement (show breakdown)", "Sep 2025", "May 2025", "4 bulan", "~2 minggu sebelum efektif", "3.5 bulan early warning"],
                  ["IKN procurement special rules (KPBPB)", "Nov 2024", "Aug 2024", "3 bulan", "~3 minggu sebelum efektif", "2.5 bulan early warning"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-blue-700">{row[2]}</td>
                    <td className="p-1 text-center font-bold text-emerald-700">{row[3]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                    <td className="p-1 font-bold text-primary">{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Lead time average: 4.2 bulan ahead of market</p>
            <p className="text-[8px]">Market awareness typically picks up {'<'} 1 month before effective date (often from disqualification notices, not proactive reading). MJP klien get 4+ months to prepare. For SKK and SBU processes that take 3–4 months themselves: MJP's lead time is the difference between compliant and disqualified.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Lead time data tracked by Sari in Notion (regulatory alert history log). She notes: date of first MJP alert, date of effective implementation, and observed market awareness date (from Budi's field notes + Reza's klien feedback). The 4.2-month lead time is MJP's key regulatory intelligence KPI. Target for 2027: 5-month average, enabled by Dewi's expanded LPJK network access.</p>
      </div>

      {/* Sari's Regulatory Prediction Track Record */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> SARI'S PREDICTIONS — Rekam Jejak Prediksi Regulasi Sari: 10 Prediksi yang Pernah Dibuat dan Seberapa Tepat Akurasinya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Prediksi</th>
                  <th className="p-1 text-center">Dibuat</th>
                  <th className="p-1 text-center">Outcome</th>
                  <th className="p-1 text-center">Accuracy</th>
                  <th className="p-1 text-left text-muted-foreground">Learning</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["BIM akan jadi mandatory untuk proyek PUPR > Rp 100M sebelum 2027", "Q3 2023", "Confirmed (enforcement wave starting 2027)", "✅ Correct", "Dewi's LPJK source gave early signal."],
                  ["LPJK akan digitalisasi verifikasi SBU sebelum 2025", "Q2 2023", "Launched Dec 2024", "✅ Correct (timing off by 6mo)", "Predicted earlier than actual. Adjusted for gov delay factor."],
                  ["UU PDP compliance enforcement for BUJK dalam 2 tahun dari terbit", "Q4 2022", "Still gentle enforcement (Q2 2026)", "🟡 Partially correct", "Predicted sooner. Gov capacity to enforce is slower than law text."],
                  ["Threshold proyek non-APBN untuk wajib LPSE akan turun ke Rp 50M", "Q1 2024", "Not confirmed as of Q2 2026", "❌ Incorrect (so far)", "Overread a policy signal. Still possible but Sari now marks this as 'speculative'."],
                  ["BUMN procurement akan terintegrasi LKPP SIRUP dalam 18 bulan", "Q3 2024", "34/62 BUMNs integrated by Q2 2026", "🟡 Partially correct (55%)", "Underestimated BUMN resistance to change."],
                  ["Jenjang SBU J9 akan dipecah menjadi sub-klasifikasi berbeda", "Q4 2023", "Not confirmed as of Q2 2026", "❌ Incorrect (so far)", "Signal came from 1 LPJK contact — single source, low weight."],
                  ["Pengadaan langsung threshold akan naik dari Rp 200jt", "Q1 2025", "Naik ke Rp 400jt (Perpres 2025)", "✅ Correct", "Budget pressure + simplification agenda = predictable direction."],
                  ["BNSP akan publish SKKNI BIM tersendiri sebelum Q4 2026", "Q3 2024", "Draft published Q1 2026, finalizing", "✅ Correct (on track)", "Dewi's direct BNSP BIM committee contact provided early signal."],
                  ["Asesor K3 supply shortage akan menjadi critical bottleneck", "Q2 2024", "Shortages reported in field (Q4 2025)", "✅ Correct", "Budi's field observations first flagged this 18 months before media coverage."],
                  ["e-katalog akan expand ke jasa konsultan konstruksi", "Q1 2026", "Under consideration (Q2 2026 per LKPP)", "🟡 Too early to score", "Monitoring actively."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/40 transition-colors ${row[3].includes("❌") ? "bg-red-50" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-muted-foreground">{row[2]}</td>
                    <td className={`p-1 text-center font-bold ${row[3].includes("✅") ? "text-emerald-700" : row[3].includes("❌") ? "text-red-700" : "text-orange-700"}`}>{row[3]}</td>
                    <td className="p-1 text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10">
            <p className="text-[9px] font-bold">Score summary: 5 correct, 2 partial, 2 incorrect, 1 pending</p>
            <p className="text-[7px] text-muted-foreground">Directional accuracy: 71% (correct + partial). Pure accuracy (fully correct): 50%. Sari's self-assessment: 'My predictions about direction are usually right. My predictions about timing are often wrong — government moves slower than logic suggests.' Now all predictions include timing bands: 'within 18 months', not specific quarter.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Prediction log maintained in Notion by Sari — publicly traceable for team trust. Incorrect predictions are not removed (no retroactive editing). Hendra: 'A prediction log is valuable precisely because it's honest about failures. Any analyst who claims 90%+ accuracy over a multiyear period is either cherry-picking or working with low-difficulty predictions.' Sari's 71% directional accuracy over 3+ years is genuinely strong in a volatile regulatory environment.</p>
      </div>

      {/* PUPR Budget Cycle & Regulatory Alignment */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Landmark className="h-3.5 w-3.5 text-primary" /> PUPR BUDGET CYCLE — Siklus Anggaran Kementerian PUPR dan Hubungannya dengan Perubahan Regulasi: Mengapa 73% Regulasi Konstruksi Baru Terbit dalam 60 Hari Setelah APBN Disetujui
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Sari's discovery: regulatory changes cluster around budget cycles. Understanding this enables proactive monitoring, not reactive scrambling:</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Bulan</th>
                  <th className="p-1 text-center">Budget Event</th>
                  <th className="p-1 text-center">Regulatory Risk</th>
                  <th className="p-1 text-left">MJP Response</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Agustus", "RAPBN submitted to DPR", "New regulation drafts circulated internally", "Dewi's LPJK contacts probed for leaks. Sari alerts set to HIGH."],
                  ["Oktober–Nov", "DPR budget deliberation", "Possible late changes to procurement thresholds", "Monitor BAPPENAS + LKPP signals. Alert klien about potential threshold changes."],
                  ["Des – Awal Jan", "APBN signed into law", "Regulatory implementation decrees (Permen, Perpres)", "Peak Sari regulatory scanning. Highest new asset production of the year."],
                  ["Jan–Feb", "DIPA issued, tender season opens", "Procurement rules locked for year", "No major new regulation expected. Focus on tender intelligence."],
                  ["Mar–Jun", "Mid-year execution review", "Minor clarification circulars (Surat Edaran)", "Dewi tracks SE releases. Low risk, moderate monitoring."],
                  ["Jul–Agt", "APBN-P (revision) preparation", "Supplementary procurement rules possible", "Moderate alert. Sari increases BAPPENAS monitoring frequency."],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-orange-700">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200">
            <p className="text-[9px] font-bold text-amber-700">Critical window: December–January (regulatory harvest season)</p>
            <p className="text-[8px]">In 2025: 14 new Permen/Perpres/SE affecting BUJK published between Dec 15 and Jan 31. Sari processed all 14 within 10 days. 11 became knowledge assets. 3 were L1 alerts pushed to klien within 48 hours of publication. Hendra: 'December is Sari's Olympic year-end sprint. Every other team member reduces output in holiday season — Sari increases.' She takes her rest in February.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Budget cycle awareness is one of Sari's core competencies that no tool can replicate without domain knowledge. Knowing WHEN to monitor more intensely is as important as knowing WHAT to monitor. A generic regulatory monitoring tool treats all months equally — MJP's human intelligence layer understands the cycle and allocates Sari's attention accordingly.</p>
      </div>

      {/* Regulatory Network Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> REGULATORY NETWORK — Jaringan Sumber Regulasi MJP: Siapa yang Memberi Tahu Kami Apa, Seberapa Cepat, dan Bagaimana Kami Memverifikasi — Peta Lengkap 14 Sumber yang Membentuk Early Warning System Regulasi MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-1">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Sumber</th>
                  <th className="p-1 text-center">Owner</th>
                  <th className="p-1 text-center">Lead time</th>
                  <th className="p-1 text-center">Reliability</th>
                  <th className="p-1 text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPJK official portal (crawled)", "Hendra Jr.", "0 hari (same-day)", "99%", "Automated"],
                  ["LKPP official portal (crawled)", "Hendra Jr.", "0 hari (same-day)", "99%", "Automated"],
                  ["PUPR website (crawled)", "Hendra Jr.", "0 hari (same-day)", "97%", "Automated"],
                  ["BNSP official newsletter", "Dewi", "1–3 hari", "98%", "Email subscription"],
                  ["Dewi's LPJK committee contact", "Dewi", "7–14 hari (pre-publication)", "85%", "Human — unverified draft"],
                  ["Dewi's BNSP BIM committee (observer)", "Dewi", "14–30 hari (pre-publication)", "80%", "Human — unverified draft"],
                  ["Sari's academic regulatory network (2 dosen)", "Sari", "21–45 hari (policy discussion stage)", "70%", "Human — speculative"],
                  ["Twitter/X: 3 construction journalists", "Sari (daily scan)", "1–5 hari post-publication", "82%", "Social — verify before using"],
                  ["WhatsApp grup BUJK (Budi member 4)", "Budi", "1–7 hari post-publication", "65%", "Informal — often rumors mix with facts"],
                  ["GAPENSI newsletter", "Reza", "7–14 hari post-publication", "90%", "Official — but slow"],
                  ["Jasa Konstruksi magazine (monthly)", "Sari", "14–30 hari post-publication", "95%", "High quality, slow"],
                  ["Klien feedback (unusual requirements)", "Reza", "Variable", "60%", "Reactive — klien may misinterpret"],
                  ["Sari's Google Scholar alerts", "Sari", "Variable (academic)", "90%", "Academic — for policy analysis, not quick ops"],
                  ["Budi's field observation (panitia requirements)", "Budi", "Real-time but unstructured", "75%", "Primary source — interpret carefully"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-primary">{row[2]}</td>
                    <td className={`p-1 text-center font-bold ${parseInt(row[3]) >= 90 ? "text-emerald-700" : parseInt(row[3]) >= 75 ? "text-orange-700" : "text-red-700"}`}>{row[3]}</td>
                    <td className="p-1 text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200">
            <p className="text-[9px] font-bold text-amber-700">Verification protocol: human sources require 2-source confirmation before publishing</p>
            <p className="text-[8px]">Any regulatory update from human sources (Dewi's contacts, Budi's WA groups, Sari's academic network) cannot be published as fact without corroboration from at least 1 official/automated source. Single human source = 'monitoring' tag. Two independent sources (1 official) = publishable. This protocol was formalized after the Q3 2022 incident where a WA group rumor about a threshold change was almost published as fact.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">14-source network gives MJP a multi-layer early warning architecture. The value is not any single source — it's the combination: automated sources for speed, human sources for pre-publication intelligence. The human sources (Dewi's committee access, Sari's academic network) are the sources that give MJP its 4.2-month lead time advantage. Any competitor can build the automated layer. The human network took 4 years.</p>
      </div>

      {/* Regulatory Alert ROI for Klien */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BadgeCheck className="h-3.5 w-3.5 text-primary" /> ALERT ROI — ROI Terukur dari Regulatory Alert MJP: 6 Kasus Nyata di Mana Alert MJP Menghindarkan Klien dari Kerugian — Nilai Total yang Diselamatkan dan Apa yang Bisa Terjadi Tanpa Alert
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Documented ROI cases from 2025 klien feedback (all verified, all anonymized):</p>
          {[
            { case: "Case R1 — Klien J8, Semarang: Threshold pengadaan langsung naik ke Rp 400jt", alert: "L2 alert 18 hari sebelum effective date", outcome: "Klien renegotiated 2 sub-contracts from competitive tender to pengadaan langsung. Saved: ~Rp 14jt in bid prep cost, 3 weeks faster.", wouldHave: "Without alert: would have completed competitive tender process unnecessarily.", tc: "text-primary" },
            { case: "Case R2 — Klien J9, Jakarta: LPJK SBU verification process changed", alert: "L1 alert 31 hari before effective date", outcome: "Klien submitted SBU renewal under old process before deadline, avoiding reprocessing under stricter new process. Saved: estimated Rp 8–12jt in additional documentation cost.", wouldHave: "Without alert: SBU renewal would have been rejected under new process, requiring restart.", tc: "text-blue-700" },
            { case: "Case R3 — Klien J7, Solo: K3 personnel requirement added to BUJK class J7", alert: "L2 alert 45 hari ahead (Dewi's BNSP contact)", outcome: "Klien began K3 certification process immediately. Had K3 tenaga ahli certified 11 days before requirement became mandatory. Avoided disqualification from 3 active tender bids.", wouldHave: "Without alert: all 3 tenders would have been disqualified. Estimated combined value: Rp 480jt.", tc: "text-emerald-700" },
            { case: "Case R4 — Klien J8, Bandung: New anti-corruption disclosure requirements for sub-contractors", alert: "L3 alert 22 hari sebelum enforcement", outcome: "Klien requested disclosure documents from all 4 sub-contractors with time to spare. 1 sub-contractor could not provide clean disclosure — replaced before tender submission.", wouldHave: "Without alert: consortium submission would have been disqualified due to sub-contractor non-compliance.", tc: "text-orange-700" },
            { case: "Case R5 — Klien J9, Surabaya: PSN fast-track procurement rules extended to 3 new categories", alert: "L2 alert 28 hari ahead (Sari's academic network source)", outcome: "Klien identified a PSN water infrastructure project that now qualified under fast-track rules — shorter timeline but higher win probability due to reduced competition. Won the tender.", wouldHave: "Without alert: klien would not have monitored this category. Estimated contract value won: Rp 1.8T.", tc: "text-red-700" },
            { case: "Case R6 — 11 klien simultaneously: BNSP SKK renewal fee structure change", alert: "L1 alert 14 hari ahead", outcome: "All 11 klien with pending renewals submitted under old fee structure. Saved avg Rp 2.3jt per klien in fee difference. Total saved: Rp 25.3jt across 11 klien.", wouldHave: "Without alert: fees paid at new (higher) rate. 11 klien × Rp 2.3jt = Rp 25.3jt in unnecessary additional cost.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.case} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.case}</p>
              <p className="text-[7px] mb-0.5">Alert: {r.alert}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Outcome: {r.outcome}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.wouldHave}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">6 cases documented in 2025. Conservative total value protected: Rp 1.87T+ (Case R5 dominates). Excluding R5 (outlier): Rp 68jt+ in documented prevented losses across 17 klien interactions. Reza uses Case R3 and R6 most frequently in sales calls (relatable scale for J7 targets). Case R5 is reserved for J9 Enterprise conversations. Sari tracks the case registry and updates annually — target 10+ documented cases per year as klien base grows.</p>
      </div>

      {/* Regulatory Pipeline 2026–2027 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Hourglass className="h-3.5 w-3.5 text-primary" /> UPCOMING REGULATIONS — Pipeline Regulasi yang Sedang dalam Proses 2026–2027: 8 Peraturan yang Belum Diterbitkan Tapi Sudah Diketahui MJP dari Sumber Primer — dan Kapan Sari Memperkirakan Tanggal Efektifnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Pre-publication intelligence from Dewi's network + Sari's academic contacts (all marked DRAFT — subject to change):</p>
          {[
            { reg: "RPM-01 — Revisi Peraturan LPJK tentang ambang batas jenjang SBU (draft in circulation)", source: "Dewi's LPJK working group contact (confirmed 2 independent sources)", expected: "Q4 2026 – Q1 2027", impact: "J7 SBU threshold may increase from Rp 1M → Rp 2.5M nilai pagu. Klien impact: 340+ J7 klien may face SBU upgrade pressure.", confidence: "HIGH", tc: "text-red-700" },
            { reg: "RPM-02 — SE BNSP tentang prosedur asesmen jarak jauh (online SKK assessment)", source: "Dewi's BNSP committee contact", expected: "Q3 2026", impact: "Online assessment legalization would open SKK Express to outer island BUJK (currently limited to Jawa + Bali access). MJP opportunity: expand SKK Express nationally.", confidence: "MEDIUM-HIGH", tc: "text-primary" },
            { reg: "RPM-03 — Perpres revisi IKN procurement fast-track (scope expansion)", source: "Sari's academic network (PUPR researcher contact)", expected: "Q4 2026", impact: "Expanded fast-track to 6 new infrastructure categories. 120+ MJP klien in those KBLI categories would receive immediate L2 briefing update.", confidence: "MEDIUM", tc: "text-blue-700" },
            { reg: "RPM-04 — Peraturan BIM mandatory untuk PUPR projects > Rp 100M", source: "Sari's academic network + PUPR technical committee source", expected: "Q1 2027 (effective Q1 2028)", impact: "HIGHEST IMPACT: 1.400+ BUJK must adopt BIM workflow within 18 months. MJP knowledge gap in BIM (94 assets). Forces BIM domain expert hire.", confidence: "HIGH", tc: "text-orange-700" },
            { reg: "RPM-05 — Revisi K3 personnel requirement untuk BUJK di atas J8", source: "Dewi's K3 asesor network contact", expected: "Q3 2026", impact: "J8–J9 BUJK must certify a dedicated K3 petugas (separate from existing K3 tenaga ahli). 180+ J8–J9 MJP klien affected.", confidence: "MEDIUM-HIGH", tc: "text-emerald-700" },
            { reg: "RPM-06 — SE Pengadaan tentang persyaratan ESG untuk BUMN tender > Rp 50M", source: "Budi's field intelligence (3 BUJK mentioned receiving tender docs with ESG clauses)", expected: "2027 (following BUMN Ministerial Decree)", impact: "ESG reporting requirement would create new knowledge vertical. MJP currently has < 20 ESG-related assets. Sari tracking.", confidence: "LOW-MEDIUM", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.reg} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.reg}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc} font-bold`}>{r.confidence}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Source: {r.source} | Expected: {r.expected}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">6 regulations in pre-publication pipeline. Confidence levels reflect source reliability (HIGH = 2+ independent sources; MEDIUM = 1 source + contextual corroboration; LOW = field signals only). RPM-01 and RPM-04 are the highest-priority alerts because they affect thousands of klien and require advance preparation. Sari maintains pre-publication pipeline in her Notion workspace — Hendra reviews monthly. Klien will receive Early Warning alerts as soon as each regulation is published, with Sari's interpretation annotation included.</p>
      </div>

      {/* Regulatory Intelligence Monetization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-primary" /> REGULATORY MONETIZATION — Monetisasi Intelijen Regulasi di Luar Subscription: 3 Revenue Stream Tambahan yang Bisa Dikembangkan dari Keunggulan Regulasi MJP — dan Mengapa Hendra Belum Mengejarnya Sebelum Series A
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              stream: "RS1 — Regulatory compliance audit service (B2B, per engagement)",
              desc: "BUJK J9 hiring MJP for a comprehensive regulatory audit: 'Is our entire portfolio compliant with current regulations?' Sari + Dewi conduct structured audit over 2–3 weeks, producing a compliance gap report with priority fix recommendations.",
              revenue: "Estimated pricing: Rp 15–35jt per engagement. Target: 8–12 engagements/year (post-Series A). Revenue target: Rp 120–420jt/year.",
              why_wait: "Requires Sari's time that is currently 100% allocated to knowledge production. A compliance audit displaces 3 weeks of knowledge assets — the wrong tradeoff pre-Series A when the asset corpus needs to grow. Post-Series A with Sari's junior analyst: capacity unlocked.",
              tc: "text-primary"
            },
            {
              stream: "RS2 — Custom regulatory watch service for specific BUJK portfolio",
              desc: "Enterprise-plus tier: dedicated Sari monitoring for a klien's specific project portfolio. 'Watch KBLI 43211 + 42101 + all Jatim province regulations + any mention of PUPR sub-directorate [X].' Personalized regulatory intelligence far beyond the platform's standard alerts.",
              revenue: "Pricing: Rp 8–15jt/month above Enterprise. Target: 10–15 klien by 2028. Revenue: Rp 80–225jt/month incremental.",
              why_wait: "Same bottleneck: Sari capacity. Also: this tier needs a proven Enterprise tier track record (klien need to trust MJP's standard tier before upgrading to custom). 18+ months of Enterprise tenure needed first.",
              tc: "text-blue-700"
            },
            {
              stream: "RS3 — Regulatory briefing white-label for BUJK associations",
              desc: "GAPENSI / Apersi pay for MJP's regulatory intelligence to be delivered to their member base as 'GAPENSI Intelligence Briefing — powered by MJP.' Association takes credit for the intelligence, MJP powers it behind the scenes.",
              revenue: "Licensing fee: Rp 50–150jt/year per association. Target: 3–4 associations by 2027. Revenue: Rp 150–600jt/year. Secondary effect: massive distribution of MJP's content to non-subscribers = top-of-funnel lead generation.",
              why_wait: "Institutional sales cycle is 6–18 months. GAPENSI board structure requires formal procurement process. Not a pre-Series A effort — requires dedicated BD hire (H8 in the org plan). The content has to be Series A-quality to represent GAPENSI's brand.",
              tc: "text-orange-700"
            },
          ].map((r) => (
            <div key={r.stream} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.stream}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] text-emerald-700 font-mono mb-0.5`}>{r.revenue}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why not yet: {r.why_wait}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">3 regulatory monetization streams represent Rp 350jt–1.2T/year in potential incremental revenue by 2028. None is being pursued pre-Series A for the same reason: they all require either Sari's capacity (which is consumed by corpus growth) or a BD hire (which requires Series A capital). Hendra's constraint: 'I have the ideas. I'm choosing not to execute them yet. Timing discipline is as important as idea quality. A great idea at the wrong time is still a distraction.'</p>
      </div>

      {/* Regulation Interpretation Quality */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpenCheck className="h-3.5 w-3.5 text-primary" /> INTERPRETATION QUALITY — Kualitas Interpretasi Regulasi MJP: Mengapa Sari Menulis Anotasi Sendiri Alih-alih Menyalin Ringkasan Pemerintah — Proses 6-Langkah untuk Setiap Alert dan Kasus-Kasus di Mana Interpretasi MJP Berbeda dari Pemahaman Umum
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Sari's 6-step interpretation process for each regulatory alert:</p>
          {[
            { step: "Step 1 — Read primary source in full (not the press release)", time: "30–90 min", note: "Government press releases summarize regulations inaccurately 34% of the time (Sari's audit over 2 years). The Peraturan Menteri itself is the only authoritative source. Sari reads the full document, not the summary." },
            { step: "Step 2 — Identify all BUJK-impacting clauses (highlight and annotate)", time: "20–45 min", note: "Not all clauses in a regulation affect BUJK. Sari marks only the clauses relevant to procurement, SBU qualification, jenjang requirements, and K3 obligations. Irrelevant clauses (e.g. government agency internal procedures) are excluded from the alert." },
            { step: "Step 3 — Check for transitional provisions (when does it take effect?)", time: "15 min", note: "Transitional provisions are the #1 thing klien need to know and the #1 thing government press releases get wrong. A regulation 'effective from [date]' often has a 6–12 month transitional period for BUJK registration compliance. Sari always identifies the real compliance deadline." },
            { step: "Step 4 — Cross-reference with existing regulations (does this amend or replace anything?)", time: "20–40 min", note: "New regulations often amend multiple previous ones without listing all impacted prior regulations explicitly. Sari cross-references against MJP's regulation index to identify all assets that need updating due to this new regulation." },
            { step: "Step 5 — Draft the plain-language annotation (3–4 paragraphs)", time: "30–45 min", note: "The annotation answers: What changed? Who is affected (by KBLI, jenjang, company size)? What must affected BUJK do? By when? Sari writes for a BUJK director, not a lawyer. Maximum 4 paragraphs, no legal jargon." },
            { step: "Step 6 — Hendra review + publish", time: "15 min", note: "Hendra reads every alert annotation before publication. Not because Sari makes errors — she rarely does — but because Hendra needs to stay fluent in regulatory context to do his CEO/product job. The review is Hendra's learning as much as a quality gate." },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.step}</p>
                <span className="text-[7px] font-mono text-blue-700 shrink-0">{r.time}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.note}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200 mt-1">
            <p className="text-[8px] font-bold text-amber-800 mb-0.5">Interpretation divergence examples (MJP vs. common misunderstanding):</p>
            <p className="text-[7px] text-muted-foreground">• Permen PUPR 08/2023: common understanding — 'BUJK J8 need to update SBU within 12 months.' Sari's interpretation: 'J8 BUJK whose SBU renewal date falls within the 12 months after the effective date need to update by their renewal date — not all J8 BUJK simultaneously.' Impact: 89 klien saved from incorrect compliance panic. • SE LPJK 01/2024: common understanding — 'new form applies immediately.' Sari's reading: 'New form applies from [date+90 days] per transitional clause in paragraph 7.c.' 3 week buffer additional that most BUJK didn't know they had.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total time per alert annotation: 2–4 hours. At 8 alerts/month, Sari spends 16–32 hours/month on regulatory interpretation alone. This is one-third of a full-time job entirely dedicated to reading and interpreting government documents. No competitor invests this human time per alert. The shortcuts are obvious: copy the press release (free), use an LLM to summarize the regulation (fast). Sari does neither. The MJP difference is the human expert reading the source — and that's exactly what klien are paying for.</p>
      </div>

      {/* Regulatory Landscape 2026–2028 Forecast */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Telescope className="h-3.5 w-3.5 text-primary" /> REGULATORY FORECAST — Prakiraan Lanskap Regulasi 2026–2028: 3 Gelombang Regulasi Besar yang Akan Mengubah Cara BUJK Beroperasi — Dampak Bisnis untuk MJP dan Peluang yang Dibukanya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              wave: "Wave 1 — BIM Mandate Wave (2026–2027)",
              regs: ["Perpres BIM (draft, expected ratification Q4 2026): mandates BIM-based design documentation for APBN projects {'>'} Rp 100M", "PUPR SE on BIM implementation phases (3 phases over 24 months)", "BNSP new certification: 'BIM Specialist' — new SKK sub-category expected Q1 2027"],
              impact: "Every BUJK bidding on APBN {'>'} Rp 100M will need BIM capability or a BIM sub-contractor. MJP impact: (1) Massive regulatory alert volume for 3 regulations + sub-regulations. (2) Sari's BIM knowledge asset backlog: 40+ assets needed. (3) Dewi expansion: BIM Specialist SKK certification becomes a new Express service category.",
              opp: "New product: 'BIM Readiness Assessment' — Dewi conducts assessment of a klien's BIM compliance gap. Estimated: Rp 3.5–5jt/assessment. 200+ J9 klien are potential buyers in Year 1.",
              tc: "text-primary"
            },
            {
              wave: "Wave 2 — UU PDP (Personal Data Protection) Enforcement Wave (2026)",
              regs: ["UU PDP (Law 27/2022) enforcement begins October 2024, with full penalty mechanism active 2026", "KOMINFO implementing regulations on data handling for platforms serving the public", "Construction sector data governance: BUJK data (LPJK registry) must comply with UU PDP Article 16 principles"],
              impact: "MJP impact: (1) Sari adds UU PDP compliance guide for BUJK to the knowledge registry — how BUJK should handle sub-contractor and worker personal data. (2) Hendra Jr. ensures MJP's data handling (klien data, BUJK registry queries) is UU PDP compliant. (3) Trust Score methodology review: does MJP's aggregation of BUJK public data comply with UU PDP's data minimization principle?",
              opp: "MJP's existing 'BUJK Data Sovereignty Framework' (built for R88 panel) positions MJP ahead of this wave. Klien who see MJP addressing UU PDP proactively: higher trust in MJP's data governance vs. competitors who have not addressed it.",
              tc: "text-orange-700"
            },
            {
              wave: "Wave 3 — Green Construction Mandate Wave (2027–2028)",
              regs: ["SE PUPR on green building standards for government projects (draft, expected 2027)", "New KBLI sub-categories for 'Green Construction' (KBLI revision expected 2027)", "Carbon credit framework for large construction projects (Bappenas roadmap)"],
              impact: "Green construction mandates will create entirely new SBU categories and SKK sub-specializations. BUJK who cannot demonstrate green construction capability will be excluded from an increasing percentage of APBN tenders by 2028. MJP impact: Sari's green construction knowledge asset category will be the fastest-growing in the registry by 2028.",
              opp: "MJP's competitive advantage: we'll have 2 years of green construction regulatory tracking before most BUJK realize it's mandatory. The 'early warning' value proposition is at its highest for emerging regulatory waves. Hendra's 2027 planning item: hire a green construction subject matter advisor (part-time contract) to supplement Sari's expertise.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.wave} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.wave}</p>
              <div className="mb-0.5">{r.regs.map((reg, i) => <p key={i} className="text-[7px] text-muted-foreground">• {reg}</p>)}</div>
              <p className="text-[7px] text-muted-foreground mb-0.5">MJP Impact: {r.impact}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Opportunity: {r.opp}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">3 regulatory waves represent Sari's busiest anticipated period: 2026–2028 will require production of {'>'} 200 new knowledge assets across BIM, UU PDP, and Green Construction categories. This is the primary justification for the H2–H3 Sari apprentice hire in the Series A plan. Without the apprentices, Sari faces an impossible production demand: maintain the existing 892 active assets while producing 200+ new assets in fast-moving new categories while managing the 134 REVIEW-queue assets. With 2 apprentices: workload is distributed. Hendra: 'The regulatory wave timing and the Series A timing are not a coincidence. This is precisely when we need to scale the team.'</p>
      </div>

      {/* R96: Regulatory Penalty Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> REGULATORY PENALTY INTELLIGENCE — Database Denda dan Sanksi Regulasi Konstruksi: Berapa Biaya Riil Ketidakpatuhan, Siapa yang Paling Sering Kena, dan Bagaimana MJP Menggunakannya sebagai Argumen ROI
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                  <th className="text-left p-1 text-muted-foreground">Kategori Pelanggaran</th>
                  <th className="p-1 text-center">Sanksi Minimum</th>
                  <th className="p-1 text-center">Sanksi Maksimum</th>
                  <th className="p-1 text-center">Frekuensi (per tahun)</th>
                  <th className="p-1 text-center">MJP prevention?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["SKK Kadaluarsa — proyek aktif", "Rp 50jt", "Rp 500jt + blacklist", "~1.200 kasus/th", "YES — SKK reminder"],
                  ["K3 Violation (kecelakaan kerja)", "Rp 100jt", "Rp 1M + pidana", "~340 kasus/th", "PARTIAL — regulasi alert"],
                  ["SBU Tidak Sesuai Nilai Kontrak", "Disqualifikasi tender", "Blacklist 2 tahun", "~280 kasus/th", "YES — SBU intelligence"],
                  ["Lingkungan (AMDAL/UKL-UPL)", "Rp 50jt", "Rp 3M + pidana", "~120 kasus/th", "PARTIAL — regulasi alert"],
                  ["Keterlambatan Pelaporan (subkon)", "Rp 10jt/bulan", "Rp 200jt", "~2.100 kasus/th", "NO — belum ada fitur"],
                  ["Perizinan Tidak Sesuai KBLI", "Tender dibatalkan", "Blacklist 1 tahun", "~190 kasus/th", "YES — BUJK intelligence"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-orange-700 font-bold">{row[1]}</td>
                    <td className="p-1 text-center text-red-700 font-bold">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center text-[7px] font-bold ${row[4].startsWith("YES") ? "text-emerald-700" : row[4].startsWith("PARTIAL") ? "text-orange-700" : "text-red-700"}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "ROI argument dari penalty prevention", detail: "MJP Starter tier Rp 399k/bulan = Rp 4.8jt/tahun. Satu sanksi SKK kadaluarsa minimum = Rp 50jt. MJP memiliki ROI payback dari prevented penalty: 10× minimum dari satu insiden SKK yang dicegah. Reza menggunakan argumen ini dalam setiap demo untuk BUJK yang ragu tentang harga.", tc: "text-primary" },
            { insight: "Kategori yang belum dicoverage: keterlambatan pelaporan subkon", detail: "2.100 kasus/tahun adalah kategori terbesar, tapi MJP belum punya fitur untuk mencegahnya karena reporting deadlines tidak dipublish di sumber publik manapun. Sari sedang meneliti apakah ini bisa di-extract dari kontrak template yang diupload ke LPSE.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Penalty database dikompilasi Sari dari 3 sumber: (1) Laporan Pengawasan Konstruksi Kementerian PUPR 2022–2024. (2) Putusan BPSK dan PTUN yang dipublikasikan. (3) Klien MJP yang mau berbagi pengalaman sanksi (anonymized). Data ini bukan comprehensive — hanya kasus yang dipublikasikan secara resmi. Estimasi Sari: kasus aktual 3–5x lebih tinggi dari yang dilaporkan karena banyak penyelesaian dilakukan out-of-court melalui negosiasi dengan Dinas PU setempat. Tapi bahkan data yang terdokumentasi cukup untuk membangun ROI argument yang meyakinkan. Hendra: 'Klien tidak membeli MJP karena mereka ingin fitur bagus. Mereka membeli karena mereka takut kena sanksi. Fear is a stronger motivator than aspiration in procurement.'</p>
      </div>

      {/* R97: Regulatory Compliance Maturity Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> REGULATORY COMPLIANCE MATURITY MODEL — 5 Level Kematangan Kepatuhan BUJK: Dari Reaktif hingga Prediktif, Dimana Mayoritas Klien MJP Berada, dan Bagaimana MJP Membantu Klien Naik Level
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { level: "Level 1 — Reactive (kena sanksi baru sadar)", pct: "~31% klien saat onboard", desc: "BUJK yang mendaftar MJP setelah kena teguran atau denda. Mereka bergabung dari 'pain' bukan 'aspiration'. Conversion paling mudah tapi churn paling tinggi jika 12 bulan tidak kena masalah lagi (ilusi bahwa masalah sudah selesai).", tc: "text-red-700" },
            { level: "Level 2 — Compliance Aware (tahu ada regulasi, tapi tidak aktif pantau)", pct: "~44% klien saat onboard", desc: "Mayoritas klien baru. Mereka tahu SKK harus diperbarui dan ada regulasi K3, tapi monitoring-nya ad-hoc (tanya kolega, sesekali cek JDIH). MJP menggantikan proses ad-hoc ini dengan systematic coverage.", tc: "text-orange-700" },
            { level: "Level 3 — Compliance Systematic (monitor aktif, tapi manual)", pct: "~18% klien saat onboard", desc: "BUJK yang sudah punya proses monitoring internal tapi manual (tim estimasi yang cek LPSE tiap hari, admin yang set reminder SKK di kalender). Mereka subscribe MJP untuk efficiency, bukan sebagai primary intelligence source.", tc: "text-yellow-700" },
            { level: "Level 4 — Compliance Proactive (anticipate changes, not just react)", pct: "~6% klien saat onboard", desc: "BUJK besar (J8–J9, revenue >Rp 50M/proyek) yang sudah punya dedicated compliance/estimasi team. MJP serves them as analytical layer on top of their own process. They want API access, bulk exports, custom reports.", tc: "text-blue-700" },
            { level: "Level 5 — Compliance Predictive (menggunakan intelligence untuk strategic planning)", pct: "<1% klien saat ini", desc: "Hanya 2–3 klien MJP di level ini. Mereka menggunakan MJP's regulatory forecast untuk 12–18 bulan business planning (contoh: plan SKK upgrade sebelum regulasi wajib berlaku, bukan sesudah). Ini adalah Enterprise tier ideal state.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.level} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.level}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.pct}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Maturity model ini bukan framework yang dibuat Hendra secara formal — ini berkembang dari Reza's observation bahwa "klien itu berbeda-beda cara mereka takut pada regulasi." Sari kemudian memformalisasikannya setelah melihat pola yang sama dalam konten request dari klien: Level 1 request penalty stories, Level 3 request raw regulation text, Level 5 request 12-month regulatory forecast. Implikasi untuk Sari's content production: setiap knowledge asset harus useful untuk Level 1 (simple summary + consequence) dan Level 4–5 (detailed interpretation + forward implication). Serving all 5 levels dengan satu asset adalah Sari's editorial challenge — dan alasan mengapa asset production time average 4.2 jam per asset bukan 30 menit.</p>
      </div>

      {/* R98: Regulatory Grey Zone Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-primary" /> REGULATORY GREY ZONE INTELLIGENCE — 5 Area Regulasi Konstruksi yang Paling Ambigu: Dimana Interpretasi MJP Berbeda dari Praktek Umum, Mengapa, dan Bagaimana Sari Menangani Ketidakpastian Hukum
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { zone: "GZ-1: Batas nilai kontrak untuk SBU qualification", ambiguity: "PP No. 14/2021 menyebut 'nilai kontrak sesuai kemampuan' tapi tidak define formula eksplisit. Interpretasi praktisi berbeda: sebagian hitung berdasarkan nilai total, sebagian berdasarkan nilai net setelah subkon.", mjp_stance: "MJP follows LKPP guidance letter (Surat Edaran 2022) yang lebih conservative: hitung total contract value sebelum subkon. Lebih safe untuk klien meskipun restrictive.", tc: "text-orange-700" },
            { zone: "GZ-2: Masa berlaku SKK untuk proyek yang dimulai sebelum expiry", ambiguity: "Jika SKK expired di tengah proyek: apakah BUJK default contract atau hanya dilarang tender baru? Regulasi tidak eksplisit. Praktek di lapangan: sangat bergantung pada interpretasi PPK (Pejabat Pembuat Komitmen).", mjp_stance: "MJP alert klien 90 hari sebelum expiry dengan explicit warning: 'renew sebelum proyek baru dimulai, bukan hanya sebelum expiry.' Conservative stance yang protects klien dari interpretasi PPK yang strict.", tc: "text-red-700" },
            { zone: "GZ-3: Status subkontraktor dalam dokumen kualifikasi", ambiguity: "Berapa persen pekerjaan boleh di-subkon? Peraturan sebut 'paling banyak 50%' tapi enforcement inconsistent. Beberapa panitia minta deklarasi eksplisit, sebagian tidak.", mjp_stance: "Sari annotates tender-specific: if tender document explicitly requires subcon declaration, MJP flags it. General guidance: always prepare subcon declaration even if not explicitly required — risk management.", tc: "text-orange-700" },
            { zone: "GZ-4: Persyaratan K3 untuk proyek di bawah ambang nilai tertentu", ambiguity: "K3 Konstruksi (SMK3) wajib untuk proyek >Rp 10M berdasarkan PP No. 50/2012. Tapi 'nilai proyek' vs 'nilai pekerjaan konstruksi' — jika proyek punya komponen non-konstruksi, hitungan berbeda.", mjp_stance: "MJP defaults ke inclusive interpretation: if any construction element value >Rp 10M, SMK3 applies. Klien yang apply conservative stance lebih aman dari teguran Disnaker.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.zone} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.zone}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Ambiguity: {r.ambiguity}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP stance: {r.mjp_stance}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Grey zone documentation adalah Sari's most controversial work. Beberapa klien Pro dan Enterprise menggunakan grey zones untuk keuntungan mereka — mereka prefer interpretasi yang lebih lenient. MJP's policy: always publish the conservative interpretation + note that practice varies. 'Kami tidak memberikan legal advice — kami memberikan risk-informed guidance.' Klien yang ingin interpretasi yang lebih agresif: harus konsultasi dengan pengacara konstruksi sendiri. Sari menjaga diri untuk tidak 'berpihak' pada interpretasi yang bisa merugikan klien jika panitia yang strict meninjau. Hendra memvalidasi ini: 'Kita bukan pengacara. Kita adalah intelligence platform. Bedanya: pengacara harus defend interpretasinya di pengadilan. Kita tidak. Itu justru alasan kita harus lebih hati-hati.'</p>
      </div>

      {/* R99: Regulatory Change Impact Scoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> REGULATORY CHANGE IMPACT SCORING — Sistem Internal Sari untuk Menilai Seberapa Besar Dampak Sebuah Regulasi Baru: 5 Dimensi Scoring, 4 Priority Tiers, dan Contoh Regulasi dari Setiap Tier
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[7px] text-muted-foreground mb-1">Ketika regulasi baru terbit, Sari assign score 1–5 untuk 5 dimensi. Total score (5–25) menentukan production priority dan timeline-to-publish.</p>
          {[
            { dim: "D1: Breadth — berapa banyak BUJK terdampak?", scoring: "1 = <100 BUJK, 3 = 1.000–10.000 BUJK, 5 = > 50.000 BUJK (praktis seluruh industri)", example: "PP No. 14/2021 revisi kualifikasi BUJK: score 5 — semua BUJK di Indonesia terdampak.", tc: "text-primary" },
            { dim: "D2: Urgency — berapa lama sebelum compliance deadline?", scoring: "1 = > 18 bulan, 3 = 6–12 bulan, 5 = < 3 bulan atau efektif segera", example: "SE LKPP tentang e-katalog mandatory: score 5 karena effective date 30 hari after publish.", tc: "text-red-700" },
            { dim: "D3: Complexity — seberapa sulit dipahami tanpa guidance?", scoring: "1 = straightforward amendment, 3 = requires interpretation of cross-references, 5 = highly technical requiring expert reading", example: "SNI terbaru untuk pondasi dalam: score 5 — diperlukan background teknik sipil untuk memahami.", tc: "text-orange-700" },
            { dim: "D4: Penalty severity — konsekuensi non-compliance?", scoring: "1 = administrative warning, 3 = tender disqualification, 5 = criminal liability or SBU revocation", example: "UU Jasa Konstruksi ketentuan K3 fatal: score 5 — pidana penjara bagi penanggung jawab.", tc: "text-red-700" },
            { dim: "D5: Klien awareness gap — seberapa banyak klien yang tidak tahu?", scoring: "1 = sudah banyak coverage di media industri, 3 = partially known, 5 = completely under-reported", example: "Banyak Permen teknis PUPR yang tidak pernah di-cover media — default score 4.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.dim} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dim}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Scoring: {r.scoring}</p>
              <p className={`text-[7px] font-mono italic ${r.tc}`}>Example: {r.example}</p>
            </div>
          ))}
          <div className="grid grid-cols-4 gap-1 mt-1">
            {[["CRITICAL (20–25)", "Publish within 24h, alert all klien", "text-red-700"], ["HIGH (15–19)", "Publish within 72h, alert Pro+Enterprise", "text-orange-700"], ["MEDIUM (10–14)", "Publish within 7 days, standard distribution", "text-blue-700"], ["LOW (5–9)", "Batch into weekly digest, no alert", "text-muted-foreground"]].map(([tier, action, tc]) => (
              <div key={tier} className="border rounded-sm p-1.5">
                <p className={`text-[7px] font-bold ${tc} mb-0.5`}>{tier}</p>
                <p className="text-[6px] text-muted-foreground">{action}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Impact scoring dirancang setelah incident Q3 2023: regulasi penting (Permen PUPR perubahan SBU grade) terbit dan Sari tidak publish karena menganggap itu 'minor amendment'. Tapi 3 klien Pro kena impact langsung — mereka melalui proses kualifikasi tender berdasarkan grade lama dan ditolak. Semua 3 complain ke Reza. Post-incident review: perubahan SBU grade itu akan mendapat score 22/25 dengan scoring system sekarang — CRITICAL. Lesson: tanpa explicit scoring system, Sari's intuition about 'importance' was calibrated wrong for specific klien impact. The scoring system externalizes and makes consistent what was previously a subjective call. Sari: 'Scoring system tidak membuat saya lebih pintar tentang regulasi. Ia membuat saya lebih consistent tentang prioritas.'</p>
      </div>

      {/* R100: Most-Accessed Regulations Hall of Fame */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> MOST-ACCESSED REGULATIONS — HALL OF FAME — 8 Regulasi yang Paling Sering Diakses oleh Klien MJP Sepanjang Masa: Apa yang Membuat Masing-Masing Tidak Tergantikan, dan Apa yang Mereka Ungkapkan tentang Kebutuhan Terdalam BUJK Indonesia
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { rank: "#1", reg: "PP No. 14 Tahun 2021 — Perubahan atas PP No. 22/2020 tentang JASA KONSTRUKSI", accesses: "12.847 total accesses", insight: "Mengganti persyaratan kualifikasi BUJK secara fundamental. Nomor satu sepanjang masa karena: (a) dampak ke semua BUJK, (b) interpretasi yang ambigu di banyak pasal, (c) masih sering dipertanyakan 3 tahun setelah diterbitkan. Sari telah update asset ini 11 kali.", tc: "text-primary" },
            { rank: "#2", reg: "Peraturan Menteri PUPR No. 6/2021 — Standar Kegiatan Usaha BUJK", accesses: "9.134 accesses", insight: "KBLI codes, klasifikasi sub-bidang, persyaratan tenaga ahli per sub-bidang. Referenced every time a BUJK wants to expand scope of work. High access because expansion decision is a major strategic BUJK decision.", tc: "text-blue-700" },
            { rank: "#3", reg: "Permen PUPR No. 8/2022 — Tata Cara Pelaksanaan Penilaian Kinerja", accesses: "7.221 accesses", insight: "Penilaian kinerja BUJK yang mempengaruhi future tender qualification. BUJK yang kena penilaian buruk: akses tender berkurang. High anxiety asset — klien access when they fear bad performance assessment.", tc: "text-orange-700" },
            { rank: "#4", reg: "PP No. 50/2012 — SMK3 (Sistem Manajemen K3)", accesses: "6.892 accesses", insight: "K3 requirements yang berlaku untuk semua proyek di atas threshold. High access: K3 is compliance risk with criminal liability. Klien access before every major project to verify requirements.", tc: "text-red-700" },
            { rank: "#5", reg: "SE Kepala LKPP No. 18/2023 — Pengadaan Barang/Jasa melalui e-Katalog", accesses: "5.634 accesses", insight: "e-Katalog expansion: banyak BUJK tiba-tiba discovered their services could be listed. New revenue opportunity + new compliance requirement. High access: klien wanting to capture e-Katalog opportunity.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.rank} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[10px] font-bold shrink-0 ${r.tc}`}>{r.rank}</span>
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.reg}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.accesses}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hall of Fame data adalah lebih dari vanity metrics — ini adalah map of BUJK anxiety. Regulasi yang paling banyak diakses adalah regulasi yang paling menimbulkan ketidakpastian. PP No. 14/2021 di posisi #1 bukan karena yang paling penting secara legal — ini karena interpretasinya paling ambigu dan konsekuensinya paling langsung dirasakan. Sari menggunakan ranking ini untuk production planning: 'Regulasi yang di Hall of Fame mendapat priority update setiap ada amendment, even minor.' Hendra Jr. menggunakan ranking untuk NLQ training: 5 regulasi ini mendapat highest density of training examples karena ini adalah regulasi yang paling sering di-query oleh NLQ. Hendra: 'Data akses ini adalah evidence bahwa regulasi Indonesia terlalu kompleks untuk BUJK navigasi sendiri. Itu adalah core reason MJP exists.'</p>
      </div>

      {/* R101: Regulatory Intelligence Annual Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" /> REGULATORY INTELLIGENCE ANNUAL CALENDAR — Pola Terbitnya Regulasi Konstruksi Indonesia Sepanjang Tahun: Kapan Pemerintah Paling Aktif Menerbitkan Aturan Baru, dan Bagaimana MJP Mempersiapkan Sari untuk Peak Periods
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { period: "Januari–Februari: APBN implementation wave", activity: "HIGH volume. Setelah APBN disahkan, Kementerian menerbitkan Permen/SE teknis tentang pelaksanaan anggaran konstruksi. Ini adalah 'implementation cascade' — each ministry releases their own technical guidelines based on approved budget.", sari_action: "Sari takes 1 week 'regulatory sprint' di awal Februari: scan semua kementerian terkait (PUPR, Kemen BUMN, LKPP) untuk implementation guidelines. Target: semua peraturan critical sudah masuk Knowledge Registry sebelum tender season mulai Maret.", tc: "text-orange-700" },
            { period: "April–Mei: Pre-tender compliance push", activity: "MEDIUM regulatory volume tapi HIGH klien query volume. BUJK yang akan bid pada tender Mei–Juni mencari clarification tentang persyaratan compliance.", sari_action: "Focus on FAQ production: identifikasi top 20 regulatory questions dari NLQ query log Q1, produce dedicated knowledge assets untuk setiap FAQ. Target: 0 unanswered regulatory queries untuk top-20 question types.", tc: "text-primary" },
            { period: "Juli–Agustus: Mid-year review regulations", activity: "MEDIUM. Pemerintah biasanya publish setengah-tahun review dan adjustment guidelines — terutama untuk PP yang butuh clarification setelah 6 months implementation.", sari_action: "Monitor JDIH daily. Any new regulation rated CRITICAL (score 20+): publish within 24 hours. Non-critical: batch weekly digest.", tc: "text-blue-700" },
            { period: "Oktober–November: End-of-year regulatory rush", activity: "VERY HIGH. Regulasi yang sudah diproses sepanjang tahun diselesaikan sebelum akhir tahun anggaran. Peak volume: November typically has 3x normal monthly regulatory output.", sari_action: "Sari goes into 'full monitoring mode': daily scan, no new asset production for 2 weeks, focus 100% on tracking and triaging incoming regulations. MJP klien receive 'year-end regulatory digest' special report.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.period} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.period}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Activity: {r.activity}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Sari action: {r.sari_action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory calendar adalah salah satu operational tools paling valuable yang Sari has built — combining 3 years of institutional knowledge about government regulatory behavior patterns into actionable monthly planning. Before the calendar: Sari was reactive (regulations came, she responded). After the calendar: Sari is proactive (she anticipates peak periods and adjusts capacity in advance). Practical implication for MJP's capacity planning: Sari requests that no major Knowledge Registry structural changes or audits are scheduled in October–November — her entire capacity is needed for regulatory monitoring. Hendra Jr. schedules Knowledge Registry system upgrades in March or August instead. Sari: 'Pemerintah Indonesia tidak random menerbitkan regulasi — ada pola yang sangat predictable karena mengikuti siklus anggaran. Begitu kamu tahu polanya, kamu bisa prepare. Tanpa tahu polanya, kamu selalu kewalahan.'</p>
      </div>

      {/* R102: Regulatory Conflict Resolution Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Scale className="h-3.5 w-3.5 text-primary" /> REGULATORY CONFLICT RESOLUTION INTELLIGENCE — 4 Kasus Dimana Regulasi Saling Bertentangan dan Bagaimana BUJK Harus Navigasi: Sari's Conflict Map dan Saran Praktis yang Tidak Ditulis di Regulasi Mana Pun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { conflict: "C1: PP No. 14/2021 vs Permen PUPR No. 14/2020 — persyaratan K3", tension: "PP 14/2021 mensyaratkan 1 Ahli K3 Muda (minimum) per proyek konstruksi senilai > Rp 250jt. Permen PUPR 14/2020 mensyaratkan 1 Ahli K3 Madya untuk proyek dengan risiko tinggi berdasarkan karakteristik teknis.", sari_guidance: "If tender classified as 'risiko tinggi' (panitia's judgment, not always stated): assume Ahli K3 Madya required. Safe bet: bid with Ahli K3 Madya always for projects > Rp 1M to avoid disqualification on ambiguous risk classification. Over-compliance is cheaper than sanggah.", tc: "text-orange-700" },
            { conflict: "C2: KBLI dual-classification for MEP contractors", tension: "BUJK yang mengerjakan mekanikal+elektrikal+plumbing: KBLI 43211 (instalasi listrik) vs 43221 (instalasi plumbing). Beberapa tender MEP mencantumkan salah satu KBLI, padahal secara teknis pekerjaan mencakup keduanya.", sari_guidance: "Check yang dicantumkan dalam dokumen tender: if only one KBLI listed, bid only if you hold that KBLI primary. If tender says 'salah satu dari', you can bid with either. If conflict: email panitia via official channel for clarification before bid submission — document the response as evidence.", tc: "text-blue-700" },
            { conflict: "C3: SKK jenjang requirements vs actual availability in market", tension: "Permen PUPR No. 6/2021 mensyaratkan jabatan kerja tertentu (Ahli Utama Teknik Bangunan Gedung, J9) untuk proyek rumit. Namun jumlah J9 aktif yang tersedia sangat terbatas. Tender yang technically mensyaratkan J9 tapi market tidak bisa supply.", sari_guidance: "BUJK yang tidak punya J9 in-house: joint operation (JO) dengan BUJK lain yang memiliki J9. Alternatively: personal services agreement dengan J9 freelancer (legal under LPJK rules if properly documented). Platform MJP: Trust Score filter bisa identify J9-holding BUJK untuk JO inquiry.", tc: "text-red-700" },
            { conflict: "C4: IKN-specific vs national standard conflicts (emerging as of 2026)", tension: "KPBU dan OIKN (Otorita IKN) mulai menerbitkan technical standards yang berpotensi konflik dengan Permen PUPR nasional — terutama untuk green building requirements dan smart infrastructure specifications.", sari_guidance: "For IKN tenders: always prioritize OIKN/KPBU issued procurement documents over generic Permen PUPR standards. If conflict identified: email OIKN technical helpdesk. MJP tracks IKN regulatory divergences as a separate intelligence category — currently 7 active divergence points tracked.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.conflict} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.conflict}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Tension: {r.tension}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Sari's guidance: {r.sari_guidance}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory conflict map adalah salah satu most valuable dan most difficult content Sari produces — it requires deep familiarity with multiple intersecting regulations plus judgment about which takes precedence. Sari does not publish her conflict analysis as definitive legal advice (MJP explicitly disclaims legal advice in ToS). But she provides practical guidance based on observed panitia tender behavior and BUJK outcomes. This is the kind of intelligence that a konstruksi lawyer charges Rp 5–10jt to provide per situation — Sari has systematized the most common conflicts into platform knowledge. Hendra: 'Conflict map adalah intellectual product yang paling expensive untuk produce dan paling valuable untuk klien. Ini adalah the frontier between data platform dan advisory platform — dan ini adalah direction MJP is intentionally moving.'</p>
      </div>

      {/* R103: Regulatory Amendment Tracking System */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> REGULATORY AMENDMENT TRACKING — Sistem MJP untuk Melacak Setiap Perubahan Regulasi Konstruksi Indonesia: Dari Deteksi hingga Notifikasi Klien, Berapa Lama Prosesnya, dan Mengapa 24-Jam SLA adalah Competitive Promise
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "Phase 1: Detection", method: "Automated JDIH crawler (jdih.setneg.go.id + 34 ministerial JDIH portals) checks for new publications every 6 hours. Keyword matching: 'mencabut', 'mengubah', 'diubah dengan', 'amandemen'. New match: alert to Sari's dashboard within 30 minutes of detection.", sla: "Detection SLA: < 6 hours from official publication", tc: "text-primary" },
            { phase: "Phase 2: Triage", method: "Sari reviews new regulation within 2 hours of detection. Triage decision: CRITICAL (affects core BUJK operations: SKK, kualifikasi, K3, payment terms), STANDARD (affects specific industry segments or tender types), INFORMATIONAL (minor technical updates, numbering changes). CRITICAL: immediate action. STANDARD: 24-hour action. INFORMATIONAL: weekly batch.", sla: "Triage SLA: < 2 hours. Decision logged in Regulatory Tracker with reasoning.", tc: "text-blue-700" },
            { phase: "Phase 3: Asset update", method: "CRITICAL: Sari halts all other work, updates or creates relevant Knowledge Registry assets. If new regulation is complex: Sari creates preliminary 'What changed' summary first (1–2 hours), full asset update within 24 hours. STANDARD: full update within 24 hours on regular schedule. INFORMATIONAL: included in weekly Knowledge Registry update batch.", sla: "CRITICAL preliminary: < 4 hours. CRITICAL full: < 24 hours. STANDARD: < 24 hours.", tc: "text-orange-700" },
            { phase: "Phase 4: Klien notification", method: "CRITICAL regulation: Hendra Jr. triggers push notification to affected-profile klien (matched by KBLI + region). Enterprise: immediate push + email. Pro: immediate push. Starter: email in next daily digest. Notification includes: what changed, when it takes effect, which Knowledge Registry assets were updated, and recommended action.", sla: "CRITICAL notification: < 6 hours from detection to klien notification.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.sla}</p>
            </div>
          ))}
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">Track record: 47 CRITICAL regulations tracked in 2025–2026</p>
            <p className="text-[7px] text-muted-foreground">47 CRITICAL events in 18 months: avg 2.6 per month. Average detection-to-klien-notification time: 4.2 hours. Fastest: 1.8 hours (SE PUPR on K3 PPE requirements — Sari recognized immediately, had template updated, pushed within 2 hours). Slowest: 9.1 hours (new PP on BUJK certification that required 3-way cross-reference with existing regulations). All 47 CRITICAL regulations met {'<'} 24 hour SLA. MJP's 24-hour SLA promise: competitive because no competitor tracks regulatory changes proactively — BUJK without MJP typically learns about changes from colleagues or when panitia rejects their bid.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Amendment tracking system adalah Sari's primary operational system — not just content production, but real-time monitoring and response. The 24-hour SLA promise is MJP's most public competitive commitment. It appears on the website, in Reza's sales pitches, and in Enterprise contracts. Breaking this SLA would be a trust breach. Sari's operational safeguard: when she's on leave, Hendra co-monitors JDIH crawler alerts and can perform Phase 1–2 (detection + triage) with STANDARD response. CRITICAL events during Sari's leave: Sari is called back. This has happened twice — Sari accepted it as part of the job's responsibility. Hendra: 'Sari tidak meminta raise untuk system ini. Tapi system ini adalah reason beberapa Enterprise klien memilih MJP di atas semua alternatives — mereka tahu bahwa dalam 6 jam dari regulasi penting terbit, mereka akan tahu.'</p>
      </div>

      {/* R104: Regulatory Intelligence for Surat Penawaran Optimization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> REGULATORY INTELLIGENCE FOR BID OPTIMIZATION — Bagaimana Pemahaman Regulasi yang Dalam Meningkatkan Kualitas Penawaran BUJK: 5 Cara Regulasi MJP Digunakan Aktif dalam Proses Penyusunan Surat Penawaran
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { use: "RU-1: Compliance checklist dari Knowledge Registry sebelum submit penawaran", desc: "Enterprise klien use case: before submitting bid, klien's procurement team runs through MJP's regulation-based compliance checklist for that specific KBLI + project value combination. Checklist is generated from Knowledge Registry: which documents must be attached, which SKK required, K3 obligations, insurance requirements. Without MJP: teams do this from memory, frequently missing items.", impact: "4 Enterprise klien report using regulatory compliance checklist for every bid > Rp 5M. Reported document rejection rate (panitia returning bid for incomplete document): dropped from avg 12% to 2% after systematic checklist adoption.", tc: "text-primary" },
            { use: "RU-2: Kalkulasi K3 cost dari regulasi untuk harga penawaran yang accurate", desc: "PP No. 14/2021 mandates specific K3 spending minimums. Many BUJK include K3 costs in their bid but underestimate the regulatory minimum. Underestimate: either panitia rejection (compliance check) or margin loss (BUJK must spend more than budgeted post-award). MJP's K3 cost calculator (based on Knowledge Registry's regulation interpretation): gives BUJK accurate K3 cost floor for their project specification.", impact: "Pro and Enterprise klien who use K3 cost calculator: bid margin accuracy improves. 23% of klien who used it in 2025 discovered they were previously under-budgeting K3 by 15–35% of actual required spend.", tc: "text-orange-700" },
            { use: "RU-3: Waktu pelaksanaan regulatoris dalam jadwal penawaran", desc: "Many tenders require regulatory permits as part of project execution (IMB, AMDAL for certain project types). BUJK often submit unrealistic timelines because they underestimate permit acquisition time. MJP's regulatory timeline intelligence: average AMDAL processing time per province, IMB processing time per kota. Using this: BUJK submit realistic schedules, reducing post-award conflict with panitia.", impact: "2 Enterprise klien who used regulatory timeline data: won tender disputes (klien was behind schedule but could demonstrate schedule was based on regulatory reality, not negligence). Dispute resolution value: estimated Rp 1.2M in contract penalties avoided.", tc: "text-blue-700" },
            { use: "RU-4: Identifikasi regulatory exemptions yang menguntungkan BUJK lokal", desc: "Beberapa peraturan preferensi pengadaan memberikan keuntungan kepada BUJK yang domisili di daerah yang sama dengan lokasi proyek. BUJK lokal yang tidak aware: kehilangan price preference advantage. MJP's regulation: identifies applicable local preference regulations by project location and summarizes the pricing advantage.", impact: "3 Pro klien discovered through MJP that they qualify for local preference pricing in their home province — allowing them to bid 7–10% higher than non-local competitors while remaining competitive. Combined bid advantage: Rp 4.2M in contracts they would otherwise have been priced out of.", tc: "text-emerald-700" },
            { use: "RU-5: Identifikasi clauses yang boleh dinegosiasi di syarat tender", desc: "Sari's deepest regulatory intelligence: tidak semua syarat dalam dokumen tender adalah wajib. Beberapa adalah template defaults yang bisa diminta klarifikasi atau adjustment melalui proses aanwijzing. BUJK yang tidak tahu ini: accept all terms as fixed, sometimes at significant disadvantage. MJP identifies which contract clauses have regulatory flexibility.", impact: "1 Enterprise klien (General Counsel background) used this intelligence to negotiate payment terms in aanwijzing from 90-day to 60-day post-milestone completion — improving cash flow position by an estimated Rp 3.5M on a Rp 47M project.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.use} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.use}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Impact measured: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory intelligence for bid optimization adalah MJP's clearest demonstration of value in concrete financial terms — these are not 'we saved you time' outcomes, these are 'we helped you win contracts, avoid penalties, and capture pricing advantages' outcomes. Reza uses this type of evidence in Enterprise sales: 'Klien X avoided Rp 1.2M in contract penalties. Klien Y captured Rp 4.2M in contracts they would have been priced out of. Your MJP subscription costs Rp 2.8jt/month. The math is clear.' Hendra: 'Platform intelligence yang tidak dapat diukur dalam outcome nyata adalah platform yang tidak assez deeply integrated into klien workflow. Kalau kita bisa show: client A used MJP regulatory intelligence and won contract B because of it — itu adalah retention argument yang tidak bisa dibantah.'</p>
      </div>

      {/* R105: The Regulatory Blind Spot Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> REGULATORY BLIND SPOT MAP — Regulasi yang MJP Belum Berhasil Menutupi: 5 Kategori yang Sari Identifikasi sebagai Gap Terbesar, Alasannya, dan Roadmap untuk Menutupnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { gap: "BS-1: Regulasi teknis bahan konstruksi (SNI spesifik material)", coverage: "12% covered", detail: "SNI (Standar Nasional Indonesia) untuk bahan konstruksi: 2.300+ active standards. MJP covers only 280 (12%). Gap: BUJK that works with specialized materials (glass facade, high-performance concrete, aluminum composite) frequently face specification disputes because SNI requirements aren't referenced in bid documents. Sari's challenge: SNI updates are managed by BSN (Badan Standardisasi Nasional) with no consolidated change feed.", roadmap: "Q3 2026: BSN monitoring crawler. Target: 50% SNI coverage for top-50 most-referenced construction material categories by Q4 2026.", tc: "text-red-700" },
            { gap: "BS-2: Regulasi ketenagakerjaan untuk pekerja konstruksi lapangan", coverage: "31% covered", detail: "Labor regulations for construction field workers: BPJS Ketenagakerjaan, K3 training requirements, overtime rules for project work, PHK provisions for project-based employment. Gap: BUJK frequently get disputes from workers citing regulations MJP doesn't fully cover. Labor disputes are slow, expensive, and PR-damaging for BUJK.", roadmap: "Hendra and Sari's view: labor regulation is adjacent to MJP's core (procurement intelligence) but increasingly relevant for Enterprise klien who manage large field teams. Pilot: add 'Ketenagakerjaan Konstruksi' category to Knowledge Registry in Q4 2026.", tc: "text-orange-700" },
            { gap: "BS-3: KPBU (Kerjasama Pemerintah dan Badan Usaha) procurement regulations", coverage: "18% covered", detail: "KPBU is the regulatory framework for PPP (Public-Private Partnership) infrastructure projects. As IKN and other mega-projects increasingly use KPBU mechanisms, BUJK need KPBU-specific procurement intelligence. MJP's gap: KPBU regulations are more complex than standard LPSE procurement and involve different legal frameworks.", roadmap: "Q1 2027 (post-Series A): dedicated KPBU intelligence category. Requires Sari upskilling or specialist contributor. This is the category that aligns best with 'IKN Intelligence' premium tier.", tc: "text-blue-700" },
            { gap: "BS-4: Regulasi lingkungan hidup (AMDAL + UKL-UPL) untuk proyek konstruksi", coverage: "22% covered", detail: "AMDAL and UKL-UPL (environmental impact assessment) requirements vary by project type, size, and location. BUJK bid on projects without understanding the environmental compliance timeline — causing post-award delays when AMDAL process is longer than scheduled. Gap: Sari has deep regulatory knowledge but environmental law is a separate specialization.", roadmap: "Partnership approach: identify environmental law specialist willing to contribute to Knowledge Registry as Expert Contributor (pilot with 1 specialist, Q2 2026).", tc: "text-emerald-700" },
            { gap: "BS-5: Kebijakan pengadaan BUMN (PLN, Pertamina, WIKA internal rules)", coverage: "3% covered (effectively none)", detail: "BUMN internal procurement policies are quasi-regulatory for BUJK that want to be suppliers. Pertamina, PLN, Waskita, WIKA each have their own vendor qualification requirements, payment terms, HSE standards. Gap: none of these are publicly accessible via LPSE — they're distributed through vendor registration portals that each BUMN manages independently.", roadmap: "Dependent on DR-4 (BUMN procurement portal data source) from Data Roadmap 2027. Cannot be resolved before data infrastructure.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.gap} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.gap}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.coverage}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Roadmap: {r.roadmap}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory blind spot map adalah Sari's annual honesty exercise — a structured assessment of what MJP claims to cover but doesn't, or covers inadequately. Most platforms avoid this type of public self-assessment because it appears to undermine confidence. Sari's view is opposite: 'Jika klien tahu kami jujur tentang apa yang tidak kami cover, mereka lebih percaya dengan apa yang kami claim kami cover.' The blind spot map is shared with Enterprise klien during EBRs — not as a list of failures but as a roadmap of what's coming. Enterprise klien who know about BS-1 (SNI gap) don't churn because of it: they wait for it. They feel included in MJP's product journey. Sari: 'Coverage yang 100% bukan target. Coverage yang jujur tentang apa yang ada dan apa yang belum ada — itu yang membangun trust.'</p>
      </div>

      {/* R106: The 3 Regulations That Changed Construction in Indonesia */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpenCheck className="h-3.5 w-3.5 text-primary" /> 3 REGULASI PALING BERPENGARUH — Perspektif Sari tentang Tiga Regulasi yang Paling Mengubah Lanskap Konstruksi Indonesia dalam 5 Tahun Terakhir: Dampaknya, Bagaimana BUJK Bereaksi, dan Apa yang MJP Lakukan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { reg: "REG-1: UU Cipta Kerja No. 11/2020 — the most complex regulatory event in MJP's history", impact: "Omnibus law that amended 79 existing laws, hundreds of implementing regulations changed simultaneously. For construction: BUJK registration simplified (OSS-RBA), SKK requirements modified, K3 obligations updated, procurement procedures affected. Sari's assessment: 'Ini adalah regulatory event yang tidak bisa ditangani oleh satu orang. Saya terpaksa prioritize dan accept that some sub-regulations would be covered late.'", mjp_response: "Emergency protocol: Hendra temporarily joined Sari's production team for 3 weeks. 47 CRITICAL assets produced in 6 weeks. Briefing to Enterprise klien: 4-part series over 3 months. Clients who had MJP during this period: navigated the transition with specific guidance. Clients who didn't: generally confused for 6+ months.", tc: "text-red-700" },
            { reg: "REG-2: Perpres No. 12/2021 (amendment to Perpres No. 16/2018) — procurement modernization", impact: "Major procurement regulation update: new procurement method categories, e-katalog expansion, threshold changes for direct appointment, new rules for construction contract types. For MJP: required updating ~340 existing assets that referenced the pre-2021 procurement framework. 6-week asset update marathon.", mjp_response: "First time MJP used a 'mass update protocol': Sari identified all affected assets, prioritized by access frequency, and updated in order. Lessons: asset interdependency mapping (knowing which assets reference which regulations) is critical for mass updates. Hendra Jr. built the first version of asset interdependency map in response to this event.", tc: "text-orange-700" },
            { reg: "REG-3: PP No. 14/2021 (revision of PP No. 22/2020) — K3 construction requirements tightened", impact: "Significant expansion of K3 requirements: minimum K3 budget now explicitly calculated as percentage of project value (varied by project risk category), K3 officer qualifications upgraded, K3 plan now required as part of bid document for projects {'>'} Rp 5M. For BUJK: K3 compliance cost increased, bid complexity increased.", mjp_response: "K3 regulation update was one of the clearest examples of MJP's value: 78% of BUJK klien were unaware of the new K3 budget calculation formula 3 months after PP 14/2021 took effect. MJP's proactive briefing to all Enterprise klien within 1 week of effective date: directly actionable — klien who received briefing adjusted their bid pricing before first tender submission under new rules.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.reg} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.reg}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Impact: {r.impact}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP response: {r.mjp_response}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">3 regulations analysis adalah Sari's retrospective review of the events that most tested MJP's regulatory intelligence capacity. Each event revealed a different dimension of the challenge: REG-1 (UU Cipta Kerja) tested coverage capacity — too much change, too fast, for one person. REG-2 (Perpres 12/2021) tested asset maintenance infrastructure — mass updates require systems, not just effort. REG-3 (PP 14/2021) tested communication speed — being first to brief clients was valuable, being accurate was essential. The three events together shaped MJP's current regulatory intelligence infrastructure: emergency protocol for REG-1-type events, asset interdependency mapping for REG-2-type events, proactive briefing SLA for REG-3-type events. Sari: 'Setiap regulasi besar yang pernah membuat saya panik — saya bersyukur sekarang. Karena setiap kepanikan menghasilkan sistem yang membuat kepanikan berikutnya lebih kecil.'</p>
      </div>

      {/* R107: Regulation Prediction — What Sari Expects Next */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Telescope className="h-3.5 w-3.5 text-primary" /> REGULATORY FORECAST 2026–2028 — Prediksi Sari tentang Regulasi yang Akan Datang Berdasarkan Sinyal yang Dia Pantau: 5 Perubahan Regulasi yang Kemungkinan Besar Terjadi dan Apa Implikasinya untuk BUJK
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { prediction: "RF-1: Revisi PP No. 22/2020 lebih lanjut — kualifikasi BUJK diperbarui", probability: "HIGH — 72%", timeline: "Q3–Q4 2026 (based on LKPP working group schedule)", signal: "LKPP working group (SUB-3) discussions include kualifikasi threshold reviews. Current kualifikasi categories (Kecil/Menengah/Besar) are being discussed as 'overly binary' — the market has BUJK that operate at the boundary in ways that create compliance ambiguity. Proposed revision: more granular sub-tiers or a 'track record override' mechanism.", implication_for_bujk: "BUJK near kualifikasi boundaries: will need to re-assess their standing under new criteria. MJP's Trust Score will need model updates to reflect new kualifikasi framework. Sari will need 20–30 new Knowledge Registry assets explaining the new categories.", tc: "text-primary" },
            { prediction: "RF-2: Perpres baru tentang pengadaan digital — e-procurement mandated beyond LPSE", probability: "MEDIUM — 54%", timeline: "2027 (based on PERPRES No. 12/2021 trajectory)", signal: "LKPP's digital roadmap shows e-catalog expansion and potential mandate for digital-only tender submission for contracts {'>'} Rp 200M. Digital signature requirement (PP No. 28/2022) is the precursor. If digital mandate expands: BUJK without e-signature capability will be excluded from large tenders.", implication_for_bujk: "BUJK that haven't gotten e-signature certification will face hard deadline. MJP's e-signature partnership (PE-3 from sinyal-pasar) becomes critical channel: klien need expedited e-signature capability.", tc: "text-blue-700" },
            { prediction: "RF-3: UU PDP enforcement begins — penalties for non-compliant construction data users", probability: "MEDIUM — 61%", timeline: "H1 2027 (enforcement phase after 2-year grace period)", signal: "UU No. 27/2022 (Personal Data Protection) took effect. 2-year enforcement grace period expires H1 2027. Construction sector: BUJK that collect worker data, BUJK that share subcontractor HR data, platforms like MJP that handle BUJK identity data — all become subject to enforcement.", implication_for_bujk: "Enterprise BUJK: need to review data handling practices. MJP: annual security audit planned post-Series A specifically for this timeline. Sari is preparing a comprehensive UU PDP compliance guide for construction sector as a Knowledge Registry expansion.", tc: "text-emerald-700" },
            { prediction: "RF-4: K3 requirements upgrade — construction site monitoring technology mandated", probability: "LOW-MEDIUM — 38%", timeline: "2028 (based on Ministry of Manpower K3 digitalization roadmap)", signal: "Kementerian Ketenagakerjaan has published guidelines for 'K3 digital monitoring' in construction — IoT sensors for hazardous conditions, digital reporting requirements. Not yet mandated. A pilot program is running in IKN projects. If pilot succeeds: likely to become mandatory for projects {'>'} Rp 50M by 2028.", implication_for_bujk: "BUJK will need to budget for K3 monitoring technology in project bids. New K3 cost calculation methodology will be required. Sari: 'This is the regulation I'm least certain about but most interested in — because it would create a new compliance category that MJP doesn't have Knowledge Registry content for yet.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.prediction} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.prediction}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.probability} · {r.timeline}</span>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Signal: {r.signal}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication for BUJK: {r.implication_for_bujk}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory forecast adalah the output of Sari's most speculative work — using signal patterns to predict regulatory changes before they happen. The methodology: identify regulatory intent signals (working group discussions, RAPBN budget allocations, government press releases about reform areas) and extrapolate timing based on historical regulatory cycle patterns. Sari's track record on predictions: of 8 regulatory forecasts made in 2023, 5 materialized within the predicted window, 2 are still pending, 1 was incorrect (PUPR e-monitoring mandate that was delayed by budget constraints). 62.5% accuracy rate on 12-month regulatory forecasts — not perfect, but meaningfully ahead of random. When a regulatory forecast materializes: Enterprise klien who received advance briefing from MJP are prepared 2–4 weeks ahead of competitors who wait for official announcements. This preparation time is the compliance advantage that justifies Enterprise tier pricing. Sari: 'Prediksi regulasi adalah cara saya memberi nilai kepada klien sebelum perubahan terjadi. Mengkonfirmasi regulasi setelah terbit adalah layanan dasar. Memprediksinya sebelum terbit — itu adalah intelligence.'</p>
      </div>

      {/* R108: Sari's Working Group Participation — Intelligence from the Inside */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> WORKING GROUP INTELLIGENCE — Bagaimana Partisipasi Sari di Kelompok Kerja LKPP, BNSP, dan PUPR Memberi MJP Visibilitas 3–6 Bulan Lebih Awal dari Publikasi Regulasi: Protokol Etika dan Batas yang Tidak Boleh Dilanggar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { group: "WG-1: LKPP Kelompok Kerja Pengadaan Digital", participation_basis: "Sari was invited in 2023 after MJP submitted a research-backed position paper on LPSE user experience gaps. LKPP recognized MJP's data depth and invited Sari as a 'practitioner perspective' voice — representing SME procurement users, not LPSE administrators.", intelligence_value: "Perpres digital procurement revision timeline: Sari knew 4 months before public announcement that the digital procurement mandate was being drafted for contracts {'>'} Rp 200M. MJP briefed Enterprise klien 3 months before official announcement — clients prepared digital signature applications before the queue formed. Additionally: Sari's input (SUB-3) influenced 2 provisions of the draft regulation that affect BUJK compliance reporting.", ethics_boundary: "Sari participates in advisory capacity only — she does not vote on regulatory content. She does not share draft regulation text with klien before public consultation period — she only shares 'direction intelligence' (the fact that a regulation is being drafted, not its specific content). MJP's lawyer reviewed this boundary in 2024 and confirmed it as legally compliant.", tc: "text-primary" },
            { group: "WG-2: BNSP Komite Teknis SKK Konstruksi", participation_basis: "Sari joined in 2024 following BNSP's invitation after MJP published a widely-cited analysis of SKK expiry crisis (the basis of the coming SKK crisis panel). BNSP recognized MJP's SKK data depth and wanted practitioner input on the IKN-focused SKK fast-track proposal.", intelligence_value: "IKN SKK fast-track timeline and scope: Sari knew 5 months before announcement that BNSP was considering temporary cross-provincial assessment recognition. MJP prepared its 'IKN SKK Readiness' briefing (sent to Enterprise klien Q4 2025) using this timeline intelligence — advising klien to start SKK positioning NOW before the fast-track window opened. Of 11 BUJK who started positioning programs, 6 specifically cited MJP's advance timeline intelligence as the catalyst.", ethics_boundary: "Same as WG-1: direction intelligence only, no draft document sharing. Additionally: Sari recuses herself from any BNSP committee vote on matters that would commercially benefit MJP (e.g., any vote about making BNSP data more accessible — Sari delegates her vote to the committee chair for such matters).", tc: "text-blue-700" },
            { group: "WG-3: PUPR Informal Technical Advisory (non-committee)", participation_basis: "Not a formal working group: Sari has informal relationship with 3 PUPR technical staff who consult her for construction market ground truth data (BUJK compliance patterns, market readiness for new regulations). These relationships started through formal LKPP working group interactions.", intelligence_value: "K3 digitalization timeline: Sari received informal signal about PUPR's K3 digital monitoring pilot 6 months before any public announcement. This informed RF-4 in the regulatory forecast panel — MJP's 38% probability estimate for mandatory K3 monitoring is based partly on this informal intelligence. Additionally: PUPR staff have informally confirmed the PP 14/2021 implementation patterns that Sari documented in the '3 Regulations' panel.", ethics_boundary: "MJP does not publish information from informal PUPR sources without independent verification through public sources. Sari uses informal signals as 'directional intelligence' to guide monitoring priorities — not as publishable intelligence. All Knowledge Registry assets are based on verifiable public sources only. The informal PUPR relationship shapes what Sari looks for, not what she publishes.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.group} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.group}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Basis: {r.participation_basis}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Value: {r.intelligence_value}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Ethics boundary: {r.ethics_boundary}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Working group intelligence adalah the most sensitive aspect of MJP's regulatory intelligence advantage — and the one that requires the most careful ethical management. The value is real: Sari's working group participation gives MJP 3–6 months of advance intelligence on regulatory direction. But the legitimacy of this advantage depends entirely on MJP respecting the ethics boundaries that allow these relationships to continue. If MJP ever publishes pre-official regulatory content, shares draft regulation text with klien before the public consultation period, or uses working group access for commercial advantage in a way that violates committee confidentiality: the working group invitations will be revoked. And with them: MJP's most valuable regulatory intelligence moat. Hendra's rule: 'Sari duduk di kelompok kerja ini karena regulator menganggap kehadiran MJP memberikan nilai untuk proses regulasi — bukan hanya untuk bisnis MJP. Hari kita mulai menggunakan akses ini untuk keuntungan komersial yang melanggar kepercayaan itu: hari kita kehilangan akses itu selamanya. Reputasi regulator MJP lebih berharga dari intelijen regulasi manapun.' Sari's working group participation is not just an intelligence asset — it's a relationship asset with the Indonesian government that positions MJP as a legitimate partner in improving construction market infrastructure. The intelligence value is a byproduct of that partnership, not its purpose.</p>
      </div>

      {/* R109: The Regulation That Nearly Broke a Klien Relationship */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> THE CRISIS REGULATION — Cerita Lengkap tentang Perpres 12/2021 yang Hampir Menghancurkan Kepercayaan Klien MJP: 7 Hari yang Menguji Sistem, Tim, dan Komitmen MJP kepada Kualitas Knowledge
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { day: "Day 0 (Senin 22 Feb 2021): Perpres No. 12/2021 diundangkan pukul 23:47", what_happened: "The regulation was published at 11:47pm on a Monday — an unusual time that suggests last-minute signing. Perpres 12/2021 amended Perpres 16/2018 (the primary government procurement regulation) with 47 article changes, including fundamental changes to vendor qualification thresholds, procurement method eligibility criteria, and LPSE reporting requirements. Total impact: 340+ LPSE-related practices affected.", mjp_context: "Sari was alerted at 7:03am Tuesday by her JDIH monitoring system. She opened the document: 67 pages. First read: 2 hours. Initial assessment: 'This changes everything about how kualifikasi thresholds are calculated. Every existing Knowledge Registry asset that references Perpres 16/2018's qualification criteria needs to be updated.'", tc: "text-primary" },
            { day: "Day 1–2 (Selasa-Rabu): Sari bekerja 18 jam per hari, Emergency Protocol aktif", what_happened: "Emergency Protocol (REG-1 equivalent, not yet formalized): Sari suspended all scheduled content production. Full focus: identify every affected Knowledge Registry asset, prioritize by severity and klien usage frequency, begin updates. By Day 2 evening: 89 assets identified as requiring update. Of 89: 23 CRITICAL (affect qualification determination), 41 IMPORTANT (affect process guidance), 25 MONITORING (indirect impact).", mjp_context: "Hendra paused non-essential communications and monitored. Hendra Jr. built an emergency tracking spreadsheet (still used as template for all major regulatory events). Sari's update rate: 8–10 assets per day (vs normal 4–5). But 89 assets in 2 days was mathematically impossible — Sari had to prioritize strictly.", tc: "text-blue-700" },
            { day: "Day 3 (Kamis): First klien impact — Enterprise klien submits incorrect bid", what_happened: "Thursday morning: Enterprise klien (KON-089, active 18 months) submitted a tender bid using kualifikasi threshold criteria from an outdated Knowledge Registry asset. The bid used Perpres 16/2018 thresholds, not the new Perpres 12/2021 thresholds. Disqualification risk: high. KON-089 called Hendra directly (not support channel) — clearly distressed.", mjp_context: "This was the most difficult call of Hendra's year. KON-089 had relied on MJP's Knowledge Registry for qualification verification. The asset was outdated because MJP hadn't yet completed the emergency updates. Hendra: acknowledged MJP's responsibility immediately, no hedging. Committed to: (1) investigate whether the bid could be corrected before aanwijzing (evaluation), (2) provide KON-089 with corrected qualification analysis within 4 hours.", tc: "text-red-700" },
            { day: "Day 3–4: Resolution and accountability", what_happened: "4 hours after KON-089 call: Sari completed emergency update of the specific asset KON-089 had relied on. Hendra called KON-089 with corrected analysis and good news: the tender's aanwijzing was scheduled 48 hours later — time to submit a bid revision (most LPSE portals allow revisions before aanwijzing). KON-089 submitted corrected bid. Outcome: KON-089 was not disqualified. Contract won 3 weeks later.", mjp_context: "Hendra's post-incident actions: (1) Hendra personally audited which other Enterprise and Pro klien had accessed the specific asset KON-089 relied on in the previous 7 days. Found: 6 other klien. Proactive outreach to all 6 within 24 hours — 4 had not yet used the information for active bids. 2 had used it: both notified, both able to revise. (2) Refunded 1 month subscription to KON-089. (3) Initiated formal Emergency Protocol design (the ad hoc response became the documented process).", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.day} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.day}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.what_happened}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP context: {r.mjp_context}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The Perpres 12/2021 crisis adalah the defining event in MJP's Knowledge Registry history — because it's when the theory ('accurate knowledge is essential for BUJK decisions') became painfully real. KON-089's reliance on an outdated MJP asset for a real tender submission: exactly the scenario that makes Sari's commitment to current assets non-negotiable. The resolution: KON-089 was retained, was not disqualified, and is still an Enterprise klien today (5 years later). In a post-incident NPS survey: KON-089 gave MJP a 9/10 rating — citing 'how MJP handled the problem' as the primary reason for continued trust. The handling: immediate acknowledgment, no hedging, proactive outreach to other potentially affected klien, financial compensation, and systemic process improvement. The 6 proactive outreaches to other klien who had accessed the same asset: none of those klien had been told there was a problem. They experienced MJP proactively informing them of a potential issue and offering help. Unanimously: positive reaction to the transparency. The incident produced 3 lasting process changes: (1) Emergency Protocol documentation, (2) asset usage tracking (ability to identify which klien accessed which assets in the past 7 days), (3) proactive klien outreach protocol for high-severity asset errors. Sari: 'Perpres 12/2021 adalah seminggu yang ingin saya lupakan. Tapi tanpanya, kami tidak akan punya Emergency Protocol yang kami punya hari ini. Dan tanpa Protocol itu, kejadian berikutnya yang serupa akan lebih buruk, bukan lebih baik.'</p>
      </div>

      {/* R110: MJP's Relationship with LKPP */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Landmark className="h-3.5 w-3.5 text-primary" /> MJP-LKPP RELATIONSHIP — Sejarah, Status, dan Strategi Hubungan MJP dengan LKPP: Dari 'Portal yang Kami Crawl' ke 'Mitra Pengadaan' — Perjalanan 5 Tahun yang Membutuhkan Lebih dari Sekadar Produk Bagus
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { period: "2021: MJP sebagai pengguna anonim sistem LPSE", relationship: "Year 1: MJP crawled LPSE portals as any internet user would — without LKPP's knowledge or acknowledgment. No relationship existed. Hendra's stance: 'LPSE is a public system; crawling public data is legal. But I want a formal relationship eventually — informal access creates uncertainty.' In 2021: Hendra sent one introductory email to LKPP's public affairs department. No response. MJP was too small to merit engagement.", significance: "Zero — but this is where all government relationships start: one-sided, unacknowledged, and based on public data access only. Hendra's decision in this phase: do nothing adversarial to attract negative attention; build the product so that when LKPP does engage, MJP has something worth showing.", tc: "text-muted-foreground" },
            { period: "2022: First LKPP acknowledgment — Sari's working group invitation", relationship: "Sari was invited to a LKPP-convened working group on procurement transparency (not directly related to MJP's work — Sari was invited as an individual expert, not as MJP). In the working group: Sari mentioned MJP's work. LKPP's technical representative asked to see the platform. Demonstration arranged. LKPP response: 'This is interesting — you're doing things with our public data that we can't do internally.' No formal partnership. But: the door opened.", significance: "This was the first time LKPP acknowledged MJP's existence in a formal context. Hendra's lesson: the path into government relationships is expertise-first, not product-first. LKPP invited Sari because of her regulatory expertise — MJP's product was secondary. The product became relevant because Sari's expertise was established first.", tc: "text-blue-700" },
            { period: "2023: Trust Score methodology review by LKPP technical team", relationship: "Hendra requested a formal technical review meeting with LKPP's procurement data team. Agenda: share Trust Score methodology, invite critique, explore alignment with LKPP's own BUJK quality assessment thinking. LKPP technical team feedback: (1) Trust Score's BNSP verification integration impressed them — LKPP doesn't have real-time BNSP integration in their own systems. (2) Concern: Trust Score is based on LPSE data that LKPP generates — if LKPP formally endorses Trust Score, it creates questions about LKPP's liability for Trust Score accuracy. (3) Request: could MJP share aggregate Trust Score distribution data periodically for LKPP's market health monitoring?", significance: "The 2023 meeting produced 2 lasting outcomes: (1) LKPP's BUJK quality research team now uses MJP's aggregate Trust Score data (shared quarterly, anonymized) for their own policy analysis. (2) LKPP's technical team became informal advisors on MJP's verification methodology — providing guidance on BNSP API interpretation and LPSE data quality issues. This informal advisory relationship: more valuable than any formal endorsement for product quality.", tc: "text-emerald-700" },
            { period: "2024–2026: Mitra Pengadaan application — formal partnership pursuit", relationship: "LKPP has a 'Mitra Pengadaan' designation program: organizations that meet specific standards can receive formal recognition as procurement intelligence or advisory partners. Requirements: (1) demonstrated service quality (verified klien references), (2) data accuracy standards compliance, (3) no competitive conflict with LKPP's own systems, (4) willingness to share aggregate insights for policy purposes. Hendra submitted formal application Q4 2024. Status as of Q2 2026: application approved in principle, implementation agreement under negotiation (specific terms for data sharing, use of 'Mitra Pengadaan' brand, and exclusivity scope).", significance: "'Mitra Pengadaan' designation: converts MJP from 'company that crawls government data' to 'recognized government procurement intelligence partner.' For Enterprise clients: signals and increases trust. For investors: demonstrates that MJP's competitive moat includes government endorsement that competitors cannot easily replicate. Hendra: 'Hubungan dengan LKPP adalah yang paling sabar yang pernah saya bangun. 5 tahun dari crawling anonim ke aplikasi Mitra Pengadaan yang disetujui. Setiap langkah membutuhkan lebih banyak bukti bahwa MJP layak dipercaya.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.period} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.period}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.relationship}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Significance: {r.significance}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP-LKPP relationship história adalah MJP's most strategically important long-term investment — because it's the relationship that determines whether MJP remains a company that depends on LKPP's public data access or becomes a company that LKPP actively partners with. The 5-year progression (anonymous user → working group expert → technical review → Mitra Pengadaan applicant) follows a logic that Hendra documents as 'credibility-before-commercialization': each step required MJP to demonstrate value to LKPP before asking for anything in return. The 2022 invitation (Sari's working group) was the consequence of Sari's expertise, not MJP's sales effort. The 2023 technical review was possible because Hendra could show a methodology worth reviewing, not just a product pitch. The 2024 Mitra Pengadaan application: earned through 3 years of demonstrated reliability and voluntary data sharing. The strategy implication: government relationships in Indonesia cannot be purchased or rushed. They can only be earned through consistent demonstration of alignment with public interest. MJP's alignment argument to LKPP: 'We make LPSE data more accessible and useful for BUJK, which directly supports LKPP's procurement competition and transparency goals. Our interests are aligned.' This argument is credible because MJP's product genuinely produces this outcome — and because Sari's working group contributions provide third-party validation of MJP's commitment to the public interest framing. Hendra: 'Setiap keputusan yang kami buat tentang produk dan etika: saya selalu bertanya, apakah LKPP akan senang melihat ini jika mereka adalah mitra kami? Pertanyaan itu adalah cara terbaik yang saya punya untuk menjaga kami tetap jujur.'</p>
      </div>

      {/* R111: Emergency Protocol Runbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> EMERGENCY PROTOCOL RUNBOOK — Checklist 12-Langkah yang Lahir dari Perpres 12/2021: Panduan Operasional MJP Saat Perubahan Regulasi Berdampak Skala-Besar dalam Waktu Kurang dari 72 Jam
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "FASE 0 (jam 0–2): ASSESSMENT — Seberapa besar dampaknya?", steps: "Step 1: Sari membaca regulasi baru secara menyeluruh (estimasi 1–2 jam tergantung panjang dokumen). Step 2: Sari membuat preliminary scope assessment — jumlah pasal yang berubah, estimasi jumlah aset yang terpengaruh. Step 3: Sari mengirimkan emergency assessment ke Hendra: 'MINOR (kurang dari 15 aset) / MODERATE (15–50 aset) / MAJOR (lebih dari 50 aset)' dengan perkiraan waktu penyelesaian.", decision_gate: "Setelah Step 3: Hendra membuat keputusan Level Response. MINOR: Sari menangani sendiri tanpa protocol khusus. MODERATE: Emergency Protocol aktif, Hendra Jr. dilibatkan untuk asset usage tracking. MAJOR: Full Emergency Protocol, semua non-essential communications di-pause, Hendra secara pribadi memantau daily progress.", tc: "text-primary" },
            { phase: "FASE 1 (jam 2–24): TRIAGE — Mana yang paling urgent?", steps: "Step 4: Sari membangun impact priority list dari hasil interdependency map query. Step 5: Sari mengklasifikasikan semua affected assets ke 3 tiers: CRITICAL (langsung mempengaruhi kualifikasi atau evaluasi aktif), IMPORTANT (berdampak pada strategi yang sedang berjalan), MONITORING (dampak indirect atau masa depan). Step 6: Hendra Jr. menjalankan asset usage query — siapa saja klien yang mengakses CRITICAL assets dalam 7 hari terakhir?", decision_gate: "Output Step 6 menentukan Fase 2 priority: klien yang mengakses CRITICAL assets harus dicontact sebelum Sari selesai update seluruh list. Hendra personally reviews klien list dan memutuskan mana yang memerlukan proactive outreach (vs menunggu sampai update selesai).", tc: "text-blue-700" },
            { phase: "FASE 2 (jam 24–72): REMEDIATION — Update dan komunikasi proaktif", steps: "Step 7: Sari mulai update CRITICAL assets secara berurutan — satu per satu, dengan full quality process. Step 8: Hendra menghubungi klien yang mengakses CRITICAL assets dengan pesan: 'Kami mendeteksi bahwa Anda mengakses [aset X] dalam 7 hari terakhir. Kami baru saja menemukan bahwa [regulasi Y] mempengaruhi konten aset ini. Apakah ada keputusan aktif yang menggunakan informasi tersebut?' Step 9: Hendra Jr. memasang temporary warning tag pada semua CRITICAL assets yang belum diupdate — memberitahu klien bahwa aset sedang dalam review.", decision_gate: "Step 8 call outcome: jika klien memiliki keputusan aktif yang menggunakan informasi yang outdated → Sari escalates ke CRITICAL PRIORITY untuk aset tersebut (di-update dalam 4 jam, bukan antri). Jika klien tidak ada keputusan aktif: tetap di normal queue.", tc: "text-red-700" },
            { phase: "FASE 3 (jam 72+): COMPLETION dan POST-MORTEM", steps: "Step 10: Sari menyelesaikan semua IMPORTANT dan MONITORING assets sesuai timeline. Step 11: Hendra Jr. melepas semua temporary warning tags setelah assets selesai diupdate dan di-QA. Step 12: Post-mortem meeting dalam 48 jam setelah completion — mengidentifikasi apa yang bisa dipercepat atau diperbaiki untuk next cascade.", decision_gate: "Post-mortem output: update ke Emergency Protocol runbook itu sendiri. Protokol bukan dokumen statis — direvisi setelah setiap MAJOR event. Versi saat ini: v4.2 (direvisi setelah 3 MAJOR events dan 7 MODERATE events sejak dokumen pertama kali dibuat).", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Steps: {r.steps}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Decision gate: {r.decision_gate}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Emergency Protocol Runbook adalah bukti bahwa MJP mengubah krisis menjadi sistem. Perpres 12/2021 adalah the founding event — the crisis that made the need for a protocol undeniable. But the protocol's value is not in the 1 major event it was originally designed for; it's in the 10 MODERATE events since then that were handled smoothly because the framework existed. The protocol's most underappreciated element: Step 8 (proactive client outreach). Most platforms wait for clients to discover errors. MJP's protocol mandates proactive outreach before errors are discovered by clients. The reputational benefit of Step 8: KON-089's 9/10 NPS rating after the Perpres 12/2021 incident (a rating given AFTER a significant service error) is the clearest evidence that how a problem is handled matters more than whether a problem occurred. Clients do not expect perfection — they expect accountability when imperfection happens. Step 8 is MJP's accountability mechanism made systematic. The runbook is shared with every new hire at MJP — not because they will necessarily execute it, but because understanding how MJP handles crises tells you more about MJP's values than any culture document. Sari: 'Emergency protocol adalah cara saya menunjukkan kepada diri sendiri bahwa saya sudah belajar dari kesalahan paling mahal yang pernah kami buat. Setiap kali saya menggunakannya: saya ingat kenapa setiap langkahnya ada.'</p>
      </div>

      {/* R112: Regulatory Forecast Methodology */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> METODOLOGI PREDIKSI REGULASI — Bagaimana Sari Memprediksi Perubahan Regulasi 3–6 Bulan Sebelum Terbit: 5 Signal Kategori yang Digunakan, Track Record 62.5%, dan Etika Membedakan Prediksi dari Spekulasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal_type: "PRED-1: Anggaran negara (APBN/APBD) sebagai regulatory intent proxy", method: "Budget allocations in the APBN (National Budget) and APBD (Regional Budgets) reveal regulatory intent before formal announcements. A significant new budget line for a PUPR program or LKPP capability: almost always precedes a formal regulation creating that program. Example: APBN 2023 included Rp 45B allocation for 'digitization of construction project monitoring' — 6 months before the formal regulation creating mandatory digital monitoring was announced. Sari monitors APBN/APBD line items through DJPBN (Direktorat Jenderal Perbendaharaan Negara) transparency portal.", predictive_value: "Lead time: 4–8 months between budget allocation and regulation publication. Accuracy: highest of all signal types — budget allocations require formal approval processes that create documentation trails. Limitation: only captures large regulatory changes with budget implications. Regulatory streamlining changes (removing requirements) don't have budget signals — they often appear with very short notice.", tc: "text-primary" },
            { signal_type: "PRED-2: Working group publication dan konsultasi publik dokumen", method: "Regulatory working groups in Indonesia publish consultation documents, discussion papers, and meeting minutes through JDIH and government agency websites — often 3–6 months before regulations are formalized. These documents: contain draft regulation language, proposed threshold changes, and implementation timelines. Sari's working group access (indirect, through her participation in consultation forums): gives her early visibility into which changes are being seriously considered vs which are aspirational.", predictive_value: "Lead time: 3–6 months for most regulations. The critical skill: distinguishing 'consultation document language that will make it into the final regulation' from 'aspirational language that gets dropped during stakeholder consultation.' Sari's working group relationships: help her calibrate this distinction. Signals to watch for in working group documents: when the implementing agency begins discussing 'implementation timeline' (vs 'whether to implement'): the regulation is likely to happen. When stakeholder opposition in consultation documents is documented but not addressed: expect the opposition to delay or modify implementation.", tc: "text-blue-700" },
            { signal_type: "PRED-3: LKPP dan BNSP press releases dan kepala badan statements", method: "Statements by LKPP's Chairman (Kepala LKPP) and BNSP's Chairman in press conferences, DPR committee testimony, and official speeches are leading indicators of regulatory direction. Example: LKPP's Chairman statements about 'improving BUJK qualification transparency' in Q2 2022 preceded the announcement of the Sistem Informasi Kinerja Penyedia (SIKAP) enhancement requirement in Q4 2022. Key events to monitor: (1) DPR Komisi V hearings (construction and infrastructure committee), (2) Musrenbang (national development planning meeting) proceedings, (3) Press conferences after State Procurement Committee (LKPP) leadership meetings.", predictive_value: "Lead time: 3–5 months for signals from senior officials, 1–2 months for signals from working-level staff. Accuracy challenge: officials sometimes announce regulatory intentions that don't materialize within their stated timeline (political, budget, or inter-agency coordination delays). Sari's calibration rule: weight an official's prediction by their direct authority over the regulation. LKPP Chairman on procurement regulation: high weight. Ministry of Finance official on construction regulation: lower weight (indirect authority).", tc: "text-emerald-700" },
            { signal_type: "PRED-4: Analogous regulation patterns — Indonesia mengikuti pola internasional dengan lag", method: "Indonesia's procurement and construction regulation frequently mirrors international best practice with a 2–5 year implementation lag. Sari monitors: (1) World Bank Indonesia procurement assessment reports (published annually), (2) OECD procurement transparency recommendations to Indonesia, (3) Regulatory changes in comparable Southeast Asian markets (Vietnam, Thailand, Philippines) that Indonesia tends to follow. When a neighboring country implements a procurement technology mandate and Indonesia hasn't: probability of an Indonesian equivalent regulation is elevated within 3 years.", predictive_value: "Lead time: 12–36 months (longer than other signal types). Accuracy: lower (many international recommendations are discussed in Indonesia and never implemented). Most useful as a 'horizon scan' rather than a near-term prediction. Example application: digital contract management mandates were implemented in Vietnam in 2022 — Sari has included this in her regulatory horizon scan as a '30% probability within 3 years' for Indonesia. If/when Indonesian government begins consulting on it: other signal types will confirm and accelerate the prediction.", tc: "text-orange-700" },
            { signal_type: "PRED-5: Industry stakeholder backlash sebagai timeline predictor", method: "One of Sari's most counterintuitive signal types: the intensity of industry stakeholder backlash against a proposed regulation predicts the regulation's implementation timeline more accurately than government's stated timeline. Strong unified opposition from GAPENSI or GAPEKSINDO: predicts either delay (6–18 months) or modification (scope reduction) — almost never complete abandonment. Divided opposition (some associations oppose, others support): predicts the regulation proceeds close to schedule, possibly with minor modifications to accommodate the majority. No opposition: predicts aggressive implementation timeline, possibly shorter than announced.", predictive_value: "Sari's track record: 7 of the last 8 regulations where she predicted 'delayed implementation due to stakeholder opposition' were delayed by at least 3 months. The 1 exception: a regulation where government proceeded despite strong opposition because of a political mandate tied to a campaign commitment. Sari's lesson from the exception: 'Kalau regulasi terhubung dengan janji politik eksplisit, oposisi stakeholder hampir tidak pernah menunda implementasinya. Ketika tidak ada tekanan politik eksplisit: oposisi stakeholder hampir selalu menghasilkan penundaan.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.signal_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Method: {r.method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Predictive value: {r.predictive_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Metodologi prediksi regulasi adalah the most intellectually demanding aspect of Sari's work — because it requires distinguishing 'this will happen within this timeframe' from 'this is currently being discussed and may happen.' The methodology's value: Enterprise klien who receive advance warning of a regulation 3–6 months early can prepare their compliance infrastructure, adjust their qualification strategy, and brief their field teams before the regulation takes effect. Competitors who wait for official announcements: have 0–30 days to prepare. Sari's 62.5% 12-month accuracy rate (5 of 8 predictions materialized within the predicted window): better than random but not high enough to present as certainty. Sari's ethical framework for predictions: she never presents a regulatory prediction as confirmed information — every prediction is explicitly labeled as 'Sari's regulatory forecast, not official announcement.' The label matters: a klien who acts on a 'confirmed regulation' that doesn't materialize will blame MJP. A klien who acts on a 'regulatory forecast with 70% probability within 12 months' understands they're making a probability-weighted preparation decision, not responding to a certainty. This ethical discipline: protects both MJP's reputation and the klien's decision quality. Sari: 'Prediksi yang akurat disampaikan sebagai prediksi adalah layanan. Prediksi yang akurat disampaikan sebagai kepastian adalah penipuan — bahkan kalau prediksinya akhirnya terbukti benar.'</p>
      </div>

      {/* R113: Non-Pengadaan Regulations Affecting BUJK */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> REGULASI NON-PENGADAAN YANG BERDAMPAK BUJK — 4 Kategori Regulasi di Luar Perpres 16/2018 yang Sering Diabaikan BUJK Tapi Berdampak Langsung pada Kualifikasi: BPJS, Pajak, Tenaga Kerja, dan Lingkungan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "NON-PENG-1: Regulasi BPJS Ketenagakerjaan dan Kesehatan — prasyarat kualifikasi yang sering disalahpahami", impact_on_bujk: "BUJK qualification for government tenders (above Rp 50jt) requires valid BPJS Ketenagakerjaan and BPJS Kesehatan compliance for all registered employees. The BPJS requirement: not in Perpres 16/2018 directly — it's enforced through the evaluation criteria in individual tender documents, derived from UU No. 24/2011 and implementing regulations. Common BUJK misunderstanding: 'kami sudah daftar BPJS' without maintaining active status (active payment of monthly contributions). A BUJK that registers but has 2+ months of non-payment: BPJS status shows 'non-aktif' in the BPJS Ketenagakerjaan verification portal — which procurement evaluators now check digitally.", mjp_coverage: "Knowledge Registry assets covering BPJS compliance: 47 assets (MKR-BPJS-001 through 047). Coverage: BPJS enrollment procedures, monthly contribution calculation for different employee categories (tetap/kontrak/harian), verification portal navigation for both BUJK self-check and panitia evaluation, and compliance restoration process for BUJK with non-aktif status. Sari's most-referenced single asset: MKR-BPJS-003 ('How to restore aktif BPJS status within 5 business days before a tender submission deadline') — queried 340 times in the past 12 months. The urgency of this query: BUJK typically discover their BPJS is non-aktif when they're preparing tender documents, not proactively.", tc: "text-primary" },
            { category: "NON-PENG-2: Regulasi Pajak untuk BUJK — SPT, NPWP, dan kewajiban PKP yang mempengaruhi eligibilitas tender", impact_on_bujk: "Government tenders require BUJK to present: (1) NPWP (tax identification number) — a basic requirement, essentially universal among formal BUJK. (2) SKT (Surat Keterangan Terdaftar) from Kantor Pajak — confirmation of active tax registration. (3) For tenders above Rp 1M: evidence of no outstanding tax obligations (confirmed via DJP Online portal or bukti SKF dari KPP). (4) For BUJK classified as PKP (Pengusaha Kena Pajak): valid Nomor Seri Faktur Pajak (NSFP) — required for issuing tax invoices to government clients. BUJK commonly confuse SKT (registration certificate) with SKF (tax clearance certificate) — they are different documents with different purposes and validity periods.", mjp_coverage: "Knowledge Registry tax compliance assets: 38 assets. The most complex area: when a BUJK crosses the PKP threshold (annual turnover exceeding Rp 4.8B) mid-year during an active government contract — they become obligated to issue tax invoices retroactively for contracts already in progress. This transition requirement: poorly understood by BUJK owners who focus on construction, not tax administration. Sari maintains a specific asset (MKR-PAJAK-017) covering this scenario — queried 89 times in the past 12 months, disproportionately by BUJK in the Rp 3–6B annual turnover range who are near or crossing the PKP threshold.", tc: "text-blue-700" },
            { category: "NON-PENG-3: UU Cipta Kerja dan peraturan pelaksanaannya — dampak pada struktur legal BUJK dan kualifikasi", impact_on_bujk: "UU No. 11/2020 (Cipta Kerja) and its implementing regulations significantly changed: (1) OSS-RBA (Online Single Submission — Risk Based Approach) for BUJK business licensing — replacing multiple separate licenses with a single risk-based permission. (2) Construction service licensing terminology — 'SIUJK' (Surat Izin Usaha Jasa Konstruksi) was replaced by 'SBU' (Sertifikasi Badan Usaha) as the primary qualification evidence. BUJK that still present old SIUJK documents in tenders: may be disqualified because evaluators expect SBU terminology. The transition period created 3 years of document confusion (2020–2023).", mjp_coverage: "UU Cipta Kerja compliance assets: 62 assets (the largest single regulatory cluster in MJP's Knowledge Registry). The most-queried Cipta Kerja asset: MKR-CKJK-008 ('SBU vs SIUJK: what documents are valid for tender qualification in 2024–2026') — queried 2.100 times in its first 18 months of publication. Sari's assessment of this asset's impact: 'Ribuan BUJK di seluruh Indonesia masih salah tentang dokumen apa yang perlu mereka presentasikan. Setiap query ke aset ini mewakili satu BUJK yang berpotensi menghindari diskualifikasi.'", tc: "text-emerald-700" },
            { category: "NON-PENG-4: AMDAL dan peraturan lingkungan — threshold proyek yang sering tidak diketahui BUJK konstruksi", impact_on_bujk: "Construction projects above certain value and scope thresholds require AMDAL (Analisis Mengenai Dampak Lingkungan) or UKL-UPL (Upaya Pengelolaan Lingkungan) documentation. The threshold: varies by project type (road construction: different from building construction), project scale (area disturbed, budget), and location (certain environmental zones trigger lower thresholds). For BUJK as contractors: the primary obligation is to verify during tender evaluation whether the procuring agency has completed the required AMDAL/UKL-UPL — because accepting a contract for a project without required environmental clearance creates legal liability for the contractor when environmental authorities inspect.", mjp_coverage: "Environmental regulation assets: 29 assets (MKR-LINGK-001 through 029). The most practically useful: MKR-LINGK-011 ('AMDAL threshold chart for common construction project types — when does your project need what environmental clearance?') — formatted as a decision tree for BUJK to quickly determine their project's environmental documentation status before submitting a tender. Sari's future asset priority: a companion asset covering the new peraturan KLHK (Kementerian Lingkungan Hidup dan Kehutanan) on environmental compliance verification in the OSS-RBA system — currently under development, expected Q3 2026. Sari: 'Banyak BUJK yang berpikir regulasi lingkungan adalah urusan pemerintah yang mengadakan, bukan urusan mereka sebagai kontraktor. Sampai mereka mendapatkan surat peringatan dari KLHK karena proyek yang mereka bangun tidak memiliki izin lingkungan yang benar. Pada saat itu: seharusnya pengetahuan itu sudah ada sebelumnya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Impact on BUJK: {r.impact_on_bujk}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP Knowledge Registry coverage: {r.mjp_coverage}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Non-pengadaan regulations affecting BUJK adalah one of Knowledge Registry's most important differentiators — because competitors (including C1) focus almost exclusively on Perpres 16/2018 and its LPSE implementation regulations. MJP covers the full regulatory ecosystem that affects BUJK's ability to win and execute government contracts — including the 4 categories above that operate entirely outside the procurement framework but directly impact whether a BUJK can qualify for tenders. The 4 categories cover approximately 176 Knowledge Registry assets (14% of the total 1.247). Their query frequency: disproportionately high relative to asset count — 176 assets generating 28% of all NLQ query interactions. The reason: BUJK turn to MJP's Knowledge Registry for non-procurement compliance questions precisely because there is no other platform that covers them in the context of procurement compliance. This creates a 'knowledge moat' around non-procurement regulation: Sari has built expertise and content infrastructure that would take any new entrant 2–3 years to replicate. The commercial implication: BUJK who discover MJP's non-procurement coverage through their first BPJS or Cipta Kerja query: typically upgrade their subscription tier within 60 days (they realize the breadth of coverage justifies the upgrade). Reza's conversion data: 34% of Free-to-Pro tier upgrades in the past 12 months were triggered by a non-procurement regulation query. This is MJP's least-marketed but most conversion-effective coverage category. Sari: 'Saya membangun Knowledge Registry untuk seluruh kompleksitas yang dihadapi BUJK — bukan hanya bagian yang mudah untuk dicakup. Bagian yang sulit untuk dicakup: itu adalah tempat di mana klien kami paling membutuhkan seseorang yang benar-benar memahami.'</p>
      </div>

      {/* R114: Regulatory Change Communication Protocol */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> REGULATORY CHANGE COMMUNICATION PROTOCOL — Bagaimana MJP Memberitahu 847 Subscriber Saat Regulasi Berubah: 4 Level Urgensi, Template Notifikasi, Waktu Rata-Rata Respons, dan Kasus Nyata di Mana Kecepatan Notifikasi Menyelamatkan Klien MJP dari Disqualifikasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { level: "URGENCY-LEVEL-1: KRITIS — regulasi berlaku segera dengan compliance window kurang dari 30 hari", protocol: "Trigger: a regulation with an immediate or very short effective date (less than 30 days) that affects BUJK qualification, bidding eligibility, or mandatory document compliance. Response time target: Sari publishes notification within 4 hours. Communication channels: (1) Emergency morning briefing supplement sent outside regular 06:00 schedule, (2) Real-time push notification to all Pro and Enterprise subscribers, (3) WhatsApp broadcast to LEVEL-1 regulatory alert opt-in group (112 members). Template: 'REGULASI KRITIS — [regulation name] berlaku [date]. BUJK yang terpengaruh: [criteria]. Tindakan yang diperlukan: [action]. Tenggat waktu: [deadline]. Panduan lengkap: [link].'", case_study: "Real case Q3 2024: LKPP issued a circular requiring BUJK to update e-Katalog registration with a new certification format within 21 days. Sari identified it at 09:30. By 11:45: emergency notification sent to all 847 subscribers. By 14:00: 43 Pro and Enterprise subscribers had clicked through. Reza followed up with 12 who had upcoming e-Katalog bids. 11 of 12 successfully updated. 1 missed the deadline. That 1 BUJK was disqualified from a Rp 1.8B tender. The 11 saves: MJP's clearest case study for Regulatory Intelligence value.", tc: "text-red-700" },
            { level: "URGENCY-LEVEL-2: PENTING — regulasi berlaku dalam 30–90 hari", protocol: "Response time target: notification within 24 hours. Channels: morning briefing same-day or next-day, weekly Knowledge Registry digest, Knowledge Registry asset updated with 'NEW: effective [date]' banner. Template: 'REGULASI PENTING — [name] berlaku [date, N hari dari sekarang]. BUJK yang perlu mempersiapkan: [criteria]. Langkah persiapan: [steps]. Panduan: [link].' The 30–90 day window: long enough for systematic preparation but requires early notification to avoid last-minute scrambling.", case_study: "Q1 2025: BNSP updated SKK renewal documentation requirements affecting approximately 35% of MJP's subscriber base. Sari notified within 19 hours of publication. Reza coordinated with Budi to identify which SKK Express active clients were within the renewal window. 28 clients contacted proactively. 8 new SKK Express engagements resulted from clients who would not have identified the requirement change themselves in time. Incremental SKK Express revenue from LEVEL-2 notification speed: Rp 68jt.", tc: "text-primary" },
            { level: "URGENCY-LEVEL-3 & 4: PEMBERITAHUAN dan MONITORING — window 90+ hari dan draft regulasi belum final", protocol: "LEVEL-3 (90+ day window): response within 3 business days. Channels: weekly Knowledge Registry digest only. No emergency notifications. Template: 'REGULASI BARU — [name] berlaku [date]. Ringkasan: [3 sentences]. Panduan lengkap: [link].' LEVEL-4 (draft/proposed regulations not yet effective): published within 5 business days as monitoring note. Knowledge Registry asset marked 'DRAFT — not yet effective'. Template: 'REGULASI DALAM PROSES — [name] sedang dalam [consultation/drafting/review]. Perkiraan berlaku: [date or TBD]. Potensi dampak: [summary]. Status terkini: [last update].'", case_study: "LEVEL-4 example: LKPP's ongoing review of e-Procurement vendor certification requirements (signaled in an LKPP working group presentation Sari attended Q2 2025). Sari published a LEVEL-4 monitoring note in June 2025. Two follow-up updates in Q3 and Q4 2025. In Q1 2026 the regulation was finalized and upgraded to LEVEL-2. BUJK who had read Sari's LEVEL-4 note 9 months earlier: had already identified potential compliance requirements and begun preparing — a 9-month preparation advantage. Sari: 'Regulasi LEVEL-4 adalah yang paling berharga bagi Strategic Analyst. Bukan karena mereka perlu bertindak sekarang — tetapi karena mengetahui lebih awal: itu adalah keunggulan kompetitif yang tidak ternilai.'", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.level} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.level}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Protocol: {r.protocol}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Case study: {r.case_study}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory change communication protocol adalah Sari's most operationally consequential system — because in the BUJK market, a missed regulatory notification has a direct business cost. The 4-level urgency system converts regulatory monitoring from a single-speed process into a matched-speed process (notification speed matched to compliance window). The LEVEL-1 case study (e-Katalog circular, 2024) is MJP's clearest evidence: 11 of 12 at-risk subscribers successfully complied because Sari's 2-hour notification gave them time to act. Without the protocol: BUJK discover regulatory changes independently (LKPP website, industry associations, procurement consultants) — a process that typically takes 7–21 days. MJP's average notification time: 4 hours for LEVEL-1, 19 hours for LEVEL-2 — consistently 7–14 days faster than baseline. This speed differential is the primary reason Enterprise subscribers cite MJP's Knowledge Registry as the most important factor in their renewal decision. Post-Series A: a junior Knowledge Analyst will handle LEVEL-3 and LEVEL-4 monitoring, freeing Sari for LEVEL-1 and LEVEL-2 rapid response work. Sari: 'Waktu adalah komponen nilai yang paling sering diabaikan dalam produk informasi. Konten yang sama persis tetapi disampaikan 7 hari lebih awal: kadang-kadang berarti perbedaan antara klien yang lolos kualifikasi dan klien yang didiskualifikasi.'</p>
      </div>

      {/* R115: Legislative Pipeline Monitoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> LEGISLATIVE PIPELINE MONITORING — Bagaimana Sari Melacak Regulasi yang Belum Diterbitkan: 4 Sumber Pra-Publikasi, Akurasi Prediksi Historis, dan Mengapa 6–12 Bulan Advance Notice Mengubah Cara BUJK Berencana
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { source: "PIPELINE-SOURCE-1: Program Penyusunan Peraturan (Prolegnas/Progsus) — agenda legislasi resmi DPR", monitoring_method: "Indonesia's DPR (parliament) publishes an annual legislative agenda (Prolegnas — Program Legislasi Nasional) listing all planned laws for the year, and a Progsus (Program Penyusunan Peraturan) for government regulations. Sari reviews both documents at the start of each year. For construction and procurement-relevant regulations: Sari creates LEVEL-4 monitoring notes (see Communication Protocol panel) within 2 weeks of the Prolegnas/Progsus publication. The Prolegnas monitoring: provides the earliest possible signal of planned regulatory change — typically 12–18 months before a regulation is published. The accuracy: not all Prolegnas regulations are enacted in the planned year (approximately 60% slip to the following year). But even a slipped regulation: the Prolegnas entry is valid advance intelligence that the regulatory direction is committed.", prediction_accuracy: "Sari's Prolegnas prediction record (2022–2025): of 14 Prolegnas-listed regulations that were relevant to BUJK and eventually enacted: 11 were correctly identified by Sari's advance monitoring (79% hit rate). 3 were enacted under a different regulatory instrument than Prolegnas had listed (e.g., a planned UU became a Perpres). The 3 misses: all involved regulatory restructuring during drafting. The 79% hit rate: sufficient to provide advance planning value even accepting 21% false positives (LEVEL-4 assets that are created but the regulation is eventually cancelled or restructured).", tc: "text-primary" },
            { source: "PIPELINE-SOURCE-2: LKPP Working Group Minutes dan Consultation Documents", monitoring_method: "Sari's access to LKPP working group meetings (through her institutional relationship network) provides her with access to consultation documents that precede formal regulatory publication by 3–9 months. These consultation documents: LKPP circulates draft regulations to stakeholder working groups for comment before finalization. Sari receives copies of these drafts as a working group participant. The draft access: allows Sari to begin building Knowledge Registry asset drafts for incoming regulations before the regulations are officially published.", prediction_accuracy: "The LKPP consultation document source: Sari's highest-accuracy pipeline source (94% of consultation documents become the regulation they describe, with minor amendments). The 3–9 month advance window: longer than any other source. The constraint: access limited to regulations that go through LKPP consultation (primarily Perpres 16 amendments, LKPP technical guidelines, and e-procurement system changes). Regulations that don't go through LKPP consultation (sector-specific regulations from BNSP, PUPR, KLHK): not covered by this source.", tc: "text-blue-700" },
            { source: "PIPELINE-SOURCE-3: BNSP Sidang Pleno Agenda dan Komite Teknis Rapat Proceedings", monitoring_method: "For SKK and certification-related regulatory changes: Sari monitors BNSP's Plenary Session agendas (published on BNSP's website before each session) and Technical Committee meeting proceedings (publicly available as meeting summaries on BNSP's portal). The Plenary Session agenda: lists all certification standard revisions scheduled for approval, typically 3–6 months before a new standard is officially gazetted. Reza reviews this source with Sari because SKK Express operations are directly affected by any BNSP standard change.", prediction_accuracy: "BNSP advance notice accuracy: 88% of Plenary Session agenda items become approved standards within 6 months of the agenda publication. The 12% that don't: are tabled for additional technical review (they are eventually approved, typically 3–9 months later than the original agenda timeline). For SKK Express: Reza uses Sari's BNSP monitoring to prepare clients whose SKK renewals fall within the upcoming standard change window. Proactive preparation for incoming standard changes: reduces Reza's case processing time by 35% for cases that bridge the old and new standard (versus reactive processing when the standard change is discovered only after it takes effect).", tc: "text-emerald-700" },
            { source: "PIPELINE-SOURCE-4: Kementerian PUPR Rencana Strategis (Renstra) dan Rencana Kerja (Renja)", monitoring_method: "The Ministry of Public Works and Housing (PUPR) publishes multi-year Strategic Plans (Renstra, 5-year horizon) and Annual Work Plans (Renja, 1-year horizon) that include planned regulatory publications. For construction sector regulations: the PUPR Renja is the most reliable advance indicator of upcoming construction-specific regulations. Sari reviews the PUPR Renja each October (published before the new fiscal year) and creates LEVEL-4 monitoring notes for any planned regulation relevant to BUJK qualification or procurement procedures.", prediction_accuracy: "PUPR Renja accuracy: 71% of planned regulatory actions are completed in the indicated fiscal year (lower than Prolegnas, because PUPR's regulatory program is more resource-constrained than DPR's legislative agenda). Sari's use of the Renja: primarily to identify the broad direction of regulatory priorities, not to predict specific publication dates. The most valuable PUPR Renja signal: recurring items that appear in multiple years without completion — these indicate a regulation that is consistently prioritized but consistently delayed, suggesting structural implementation difficulty that will eventually produce a rushed publication. Sari's 'delayed-but-inevitable' tracking list: currently 3 PUPR regulations that have appeared in 3+ consecutive Renja documents without publication. Sari: 'Regulasi yang tertunda bukan regulasi yang dibatalkan. Ini adalah regulasi yang akan datang dalam kondisi yang paling tidak menguntungkan — terburu-buru, seringkali dengan konsultasi yang lebih sedikit. Itu adalah saat ketika nilai intelijen regulasi kami tertinggi: ketika perubahan datang cepat dan tidak ada orang lain yang siap.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.source} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.source}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Monitoring method: {r.monitoring_method}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Prediction accuracy: {r.prediction_accuracy}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Legislative pipeline monitoring adalah Sari's most forward-looking intelligence practice — and the one that most directly supports MJP's regulatory forecast methodology (PRED-2 and PRED-3 signal types from R112). The 4 sources collectively give Sari a 3–18 month advance view of the regulatory landscape, compared to the 0-day view that BUJK without MJP access experience (they discover regulations when they are published). The commercial value of advance notice: not uniform across BUJK. For smaller BUJK with limited operational flexibility: 6 months of advance notice about an incoming qualification requirement change may be insufficient for compliance (they need the full time to prepare documents, train staff, and update processes). For larger Enterprise BUJK: 6 months is ample time. For Strategic Analyst archetype BUJK (who use advance regulatory intelligence for business planning): even 12 months can be 'tight' when a regulation affects their multi-year project pipeline. This is why MJP's LEVEL-4 monitoring notes (created from pipeline sources) are the most-valued content type for Enterprise subscribers despite being the most provisional (not yet final regulations). The advance notice value outweighs the accuracy uncertainty for planning-oriented BUJK. Sari's pipeline monitoring investment: approximately 12 days/year (Prolegnas review, LKPP working group participation, BNSP Plenary agenda monitoring, PUPR Renja analysis). Return: 6–18 month advance warning on regulations that affect MJP's most valuable subscriber segment. At Rp 2.55jt/month Enterprise ARPU: retaining 5 Enterprise subscribers who cite regulatory advance intelligence as their renewal reason = Rp 153jt/year in retained ARR from Sari's 12-day annual pipeline monitoring investment.</p>
      </div>

      {/* R116: Regulatory Complexity Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> REGULATORY COMPLEXITY INDEX — Skor Kompleksitas untuk Setiap Domain Regulasi: 5 Dimensi Kompleksitas, Mengapa Beberapa Regulasi Sulit Dipahami Secara Struktural, dan Bagaimana Sari Memilih Kedalaman Penjelasan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { domain: "COMPLEXITY-DOMAIN-1: Pengadaan (PP 16/2018 + turunan) — skor kompleksitas 4.2 / 5.0", dimensions: "Procurement regulation: MJP's highest-complexity regulatory domain. The 5 complexity dimensions and their scores for this domain — (1) Cross-reference density: 4.8/5 (PP 16/2018 references 23 other regulations directly, and its implementing Perpres 12/2021 references an additional 31 — making the complete regulatory picture require synthesis of 54+ documents). (2) Interpretation variance: 4.5/5 (different regional LPSE implementations create legitimate variation in how the same regulation is applied — 3 different interpretations of the 'pengadaan langsung' threshold have been documented across LPSE regions). (3) Change velocity: 3.8/5 (PP 16/2018 has been amended 4 times since original publication). (4) Technical density: 4.0/5 (procurement regulation requires understanding of both administrative procedure and technical qualification standards). (5) Practitioner consensus: 4.0/5 (procurement lawyers and BUJK practitioners frequently disagree on edge case interpretation).", sari_depth_decision: "Sari's depth decision for procurement regulation: maximum depth (all LEVEL-1 through LEVEL-4 assets, with Expert Contributor verification for all assets above LEVEL-2). The cross-reference density complexity: specifically why Sari created MJP's 'Regulation Family Tree' — a Knowledge Registry asset that maps all 54+ procurement regulations into a single hierarchical diagram. The Family Tree: MJP's most-accessed Knowledge Registry asset (accessed 847+ times in 2025). Its value: converts a 54-document cross-reference network into a single navigable map that tells BUJK 'start here, then here, then here' for any procurement question.", tc: "text-primary" },
            { domain: "COMPLEXITY-DOMAIN-2: Sertifikasi SKK/IUJK (Permen PUPR 14/2020 + BNSP) — skor kompleksitas 3.8 / 5.0", dimensions: "SKK and IUJK certification regulation: high complexity from jenjang-level granularity (different rules for jenjang 7, 8, and 9) and the cross-agency coordination between BNSP (certification standards), PUPR (construction-specific requirements), and LPSE (qualification verification). The 5 dimensions — (1) Cross-reference density: 3.5/5 (BNSP SKK standards cross-reference PUPR qualification requirements and LPSE verification procedures — approximately 12 documents for complete picture). (2) Interpretation variance: 3.2/5 (LSP interpretation of evidence portfolios varies but within tighter bounds than procurement interpretation variance). (3) Change velocity: 4.5/5 (BNSP updates certification standards more frequently than procurement regulations — an average of 2.3 significant changes per year). (4) Technical density: 4.0/5 (certification regulation requires understanding both legal qualification requirements and technical competency standards). (5) Practitioner consensus: 3.8/5 (Reza's SKK Express experience shows consistent practitioner disagreement on evidence portfolio requirements for borderline cases).", sari_depth_decision: "Sari's depth decision: maximum depth, with Reza as co-author/reviewer for LEVEL-3 and LEVEL-4 assets (because Reza's SKK Express experience provides ground-truth practitioner interpretation that textual regulatory analysis misses). The change velocity complexity: specifically why the Knowledge Registry's LEVEL-1 assets for SKK regulations have the highest update frequency of any domain (updated 4–6 times per year vs the 1–2 annual updates for lower-velocity domains).", tc: "text-blue-700" },
            { domain: "COMPLEXITY-DOMAIN-3: Tender qualification thresholds (LKPP peraturan) — skor kompleksitas 3.1 / 5.0", dimensions: "Qualification threshold regulation: moderate complexity driven by threshold value changes (which happen when APBN infrastructure spending targets shift) and by the interaction between national thresholds and regional ULP (unit procurement services) discretion. The 5 dimensions — (1) Cross-reference density: 2.8/5 (qualification threshold rules reference procurement procedures but are relatively self-contained in LKPP's technical guidelines). (2) Interpretation variance: 3.5/5 (regional discretion in threshold application creates the highest source of BUJK confusion in this domain). (3) Change velocity: 3.2/5 (threshold values change with each APBN allocation cycle, approximately every 2 years for significant changes). (4) Technical density: 2.5/5 (lower than procurement and certification — threshold rules are primarily numerical with limited procedural complexity). (5) Practitioner consensus: 3.0/5 (national guidelines are clear, regional implementation is where disagreement occurs).", sari_depth_decision: "Sari's depth decision: medium depth (LEVEL-1 and LEVEL-2 assets, with LEVEL-3 for specific high-confusion threshold topics like regional discretion interpretation). The moderate complexity: means that MJP's NLQ handles threshold questions with high accuracy in Mode-1 retrieval (the factual query mode) — threshold values are cleanly structured data that vector search retrieves reliably. The Knowledge Registry investment in this domain: lower than procurement and certification, proportional to the complexity that requires synthesis beyond what structured data retrieval provides.", tc: "text-emerald-700" },
            { domain: "COMPLEXITY-DOMAIN-4: Lingkungan dan K3 (UU 32/2009 + Permen LHK) — skor kompleksitas 2.4 / 5.0", dimensions: "Environmental and K3 regulation: moderate-low complexity for MJP's current subscriber base (BUJK are affected by environmental regulations at the project level, but most procurement compliance questions about environmental clearance are handled by the project owner, not the BUJK). The 5 dimensions — (1) Cross-reference density: 2.8/5 (environmental regulations reference sectoral regulations extensively, but BUJK-relevant environmental requirements are a subset of the total). (2) Interpretation variance: 2.0/5 (environmental compliance requirements are relatively standardized for construction procurement contexts). (3) Change velocity: 2.5/5 (environmental regulation changes: significant but less frequent than procurement and certification). (4) Technical density: 2.2/5 (technical for environmental specialists, but BUJK-specific requirements are a procedural subset). (5) Practitioner consensus: 2.5/5 (higher consensus than procurement for BUJK-relevant questions).", sari_depth_decision: "Sari's depth decision: low depth currently (LEVEL-1 and selected LEVEL-2 assets), identified as BS-4 (Knowledge Registry blind spot 4) in Sari's gap analysis. The post-Series A Knowledge Analyst hire: specifically tasked with building out environmental and K3 Knowledge Registry coverage to LEVEL-3 depth with Expert Contributor verification from Sari's environmental law specialist contact. The low current depth: reflects that environmental regulation is below MJP's content investment threshold at current subscriber volume — but becomes commercially necessary as MJP scales to larger BUJK (jenjang-9 Enterprise subscribers who manage AMDAL-required projects).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.domain} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.domain}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Complexity dimensions: {r.dimensions}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Sari's depth decision: {r.sari_depth_decision}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory complexity index adalah Sari's most analytical editorial tool — because it converts the intuitive judgment of 'this domain is harder' into a structured 5-dimension score that drives objective content investment decisions. The 5 complexity dimensions (cross-reference density, interpretation variance, change velocity, technical density, practitioner consensus): each contributes to the total editorial work required to produce a reliable Knowledge Registry asset. A high-complexity domain requires: more time to research (more cross-references to trace), more Expert Contributor verification (higher interpretation variance and lower practitioner consensus), more frequent updates (higher change velocity), and more editorial explanation of technical nuance (higher technical density). The complexity score: directly maps to Sari's content investment allocation. Procurement (4.2/5): receives approximately 40% of Sari's total editorial time. SKK/IUJK (3.8/5): approximately 30%. Qualification thresholds (3.1/5): approximately 15%. Environmental/K3 (2.4/5): approximately 8% (below investment threshold, hence the identified gap). The complexity scoring methodology: also Sari's defense against scope creep. When stakeholders suggest adding new regulatory domains (contract law, intellectual property for construction designs, labor regulations for site workers): Sari applies the complexity score to determine whether MJP has the editorial capacity to cover the domain at the quality level subscribers expect. MJP does not publish low-quality content because the regulatory domain is complex — it either invests in Expert Contributor verification or explicitly scopes out the domain until it can. The post-Series A Knowledge Analyst hire: increases total editorial capacity by approximately 35%, allowing 2 low-investment domains (environmental/K3 and one additional domain) to be elevated to full-depth coverage.</p>
      </div>

      {/* R117: Regulatory Enforcement Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> REGULATORY ENFORCEMENT INTELLIGENCE — Melacak Bukan Hanya Aturan tapi Pola Penegakannya: 3 Sumber Enforcement Data, Kasus BUJK yang Terkena Dampak Penegakan, dan Mengapa Regulasi Tanpa Enforcement Context Memberikan Separuh dari Gambar
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { source: "ENFORCEMENT-SOURCE-1: LPSE blacklist data — BUJK yang diblokir dari portal pengadaan", data_available: "LPSE portals maintain blacklists of BUJK who have been sanctioned for procurement violations (contract abandonment, fraudulent qualification claims, collusion in tender processes). The blacklist data: published on LKPP's SIPP (Sistem Informasi Penyedia Pelaksana Pengadaan) platform, updated continuously. MJP's crawler: already collects blacklist data as part of the standard LPSE crawl. The data is integrated into Trust Score (BUJK with blacklist entries receive a Trust Score penalty). But the blacklist data's value extends beyond Trust Score: it is also enforcement intelligence — which types of violations are being prosecuted, which agencies are most active in enforcement, and which procurement regions show higher violation rates.", sari_analysis: "Sari's enforcement pattern analysis from SIPP data: 3 dominant violation categories. (1) Contract abandonment (abandoning a project mid-completion): 45% of all blacklist entries. Highest in infrastructure categories (roads, bridges) during commodity price spike periods (2022 material price increases caused a spike in contract abandonment as BUJK realized bid prices were below actual construction costs). (2) Fraudulent qualification claims: 31% of entries — most commonly falsified SKK certificates or overstated project completion evidence. The BNSP digitalization of SKK verification (2024): reduced new fraudulent SKK entries significantly, but historical fraudulent entries remain on LPSE records. (3) Collusion (bid-rigging between competing BUJK): 24% of entries — detected through KPPU (competition authority) investigations that then notify LKPP. Collusion enforcement: concentrated in high-value tender categories and in regions with lower bidder competition.", tc: "text-primary" },
            { source: "ENFORCEMENT-SOURCE-2: KPPU (Komisi Pengawas Persaingan Usaha) decision data — kasus kartel tender yang dipublikasikan", data_available: "Indonesia's competition authority (KPPU) publishes all tender competition cases on their website, including: case description, BUJK involved, tender agency, violation type (collusion, bid-rigging, market allocation), and sanction amount. The KPPU dataset: not integrated into MJP's crawler (it's a separate legal case database, not an LPSE portal). Sari monitors it manually, approximately quarterly. The KPPU data: the highest-quality enforcement intelligence source because it represents formally adjudicated cases with detailed factual records.", sari_analysis: "Sari's KPPU pattern analysis (2021–2025): 18 tender competition cases involving BUJK in categories relevant to MJP's subscribers. Key patterns: (1) Collusion clusters by procurement category: 7 of 18 cases were in road construction (KBLI 4211/4212), consistent with that category's high-value, contractor-concentrated competitive structure. (2) Geographic enforcement clustering: 11 of 18 cases originated from procurement in Java (not Eastern Indonesia) — reflecting both higher tender density in Java AND more active KPPU regional offices in Java. (3) Size threshold: 16 of 18 cases involved tenders above Rp 10B — below this threshold, KPPU investigation resources are rarely allocated. Sari's use of KPPU data: primarily to update the 'Enforcement Risk' context annotations in MJP's Trust Score for BUJK with KPPU case history, and to update the Knowledge Registry's 'Procurement Ethics and Compliance' asset with current enforcement trends.", tc: "text-blue-700" },
            { source: "ENFORCEMENT-SOURCE-3: BPKP dan BPK audit laporan — yang ditemukan dalam proyek yang sudah selesai", data_available: "Indonesia's government audit bodies (BPKP — Development Finance Audit Agency, and BPK — Supreme Audit Board) publish summary audit reports that identify procurement irregularities in completed government projects. These reports: the most comprehensive post-completion enforcement record — they identify not just BUJK who were blacklisted during procurement but also BUJK whose completed projects had quality deficiencies, cost overruns attributed to contractor failure, or compliance violations discovered during project audits. The BPKP/BPK data: technically public but requires significant manual extraction (audit reports are published as lengthy PDF documents, not structured data).", sari_analysis: "Sari's BPKP/BPK monitoring: limited to annual summary reports (quarterly monitoring is too time-intensive given the PDF extraction requirement). The data's primary use: identifying BUJK who completed projects with significant audit findings — a Trust Score input that is not available from LPSE award data alone. A BUJK can have a high win rate (many awards) but poor project completion quality (multiple BPKP audit findings). The Trust Score's current version: does not fully incorporate BPKP/BPK audit data (it is in Hendra Jr.'s roadmap for EXPANSION-PHASE-1 of Trust Score v3 — adding post-completion quality data alongside pre-completion track record data). The enforcement intelligence value of BPKP/BPK data: also informs Sari's Knowledge Registry 'Contractor Quality Standards' asset, providing real-world examples of what quality deficiency findings look like in audit language. Sari: 'Regulasi yang ditulis secara ideal dan regulasi yang ditegakkan secara nyata: berbeda. Sumber enforcement kami adalah yang menjembatani kesenjangan itu — dan BUJK yang memahami perbedaan itu memiliki keuntungan kompetitif yang nyata dalam mematuhi apa yang sebenarnya diaudit, bukan hanya apa yang secara teknis diwajibkan.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.source} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.source}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Data available and integration: {r.data_available}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Sari's analysis: {r.sari_analysis}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory enforcement intelligence adalah Sari's most practically oriented analytical capability — because regulations without enforcement context give BUJK only half the picture they need for risk-aware decision-making. The rule says 'X is required' — but enforcement data tells you how strictly 'X' is actually monitored, at what scale violations are investigated, in which categories enforcement is most active, and what the realistic sanction consequences are. BUJK who understand enforcement patterns: make better compliance investment decisions (allocating compliance effort proportional to enforcement probability) and better risk assessments when bidding on tenders in categories with active enforcement attention. The 3 enforcement sources (LPSE blacklist, KPPU decisions, BPKP/BPK audits): cover the full enforcement lifecycle. LPSE blacklist: real-time, broad coverage, captures procurement-stage violations. KPPU decisions: adjudicated quality, covers competition violations, limited to formally prosecuted cases. BPKP/BPK reports: post-completion, most comprehensive, highest extraction cost. MJP's enforcement intelligence product: currently delivered primarily through Trust Score (blacklist data integrated) and Knowledge Registry context annotations (KPPU and BPKP pattern analysis embedded in relevant assets). The post-Series A upgrade: building a dedicated 'Enforcement Risk' section in the Knowledge Registry that surfaces active enforcement patterns by category and region — giving BUJK a direct way to assess compliance risk for their specific procurement contexts. This section: addresses a gap in MJP's current product that Budi's narasumber research identified in 2024 (5 Enterprise subscribers independently mentioned that they wanted to understand 'what's actually getting caught and penalized' in their category, not just 'what the rules say'). A new Knowledge Registry section delivering enforcement pattern data: directly serves this expressed need.</p>
      </div>

      {/* R118: BUJK Annual Compliance Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" /> BUJK ANNUAL COMPLIANCE CALENDAR — Kewajiban Kepatuhan BUJK Bulan per Bulan Sepanjang Tahun: 4 Kuartal Compliance, Puncak Beban Administratif, dan Bagaimana MJP Mengantisipasi Kebutuhan Subscriber di Setiap Fase
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { quarter: "Q1 (Jan–Mar): Siklus pembaruan IUJK dan perencanaan strategi tender awal tahun", compliance_obligations: "January: IUJK renewal deadline for BUJK whose IUJK validity expires in the new calendar year (issued in 2-year cycles — January renewals are the largest single-month IUJK renewal batch). February: Early-year tender monitoring begins — APBN-funded projects typically publish their first tender batch in February–March as government agencies begin executing approved budgets. March: BNSP SKK renewal waves for personnel whose certification cycles expire in Q1. The Q1 compliance load: highest for administrative staff (IUJK renewal documentation is extensive — certificate gathering, portfolio compilation, agency submission tracking).", how_mjp_anticipates: "MJP's Q1 product behavior: January 1 — Sari's Knowledge Registry 'IUJK Renewal Guide' is reviewed and updated for any BUJK changes from the previous year. Hendra Jr.'s LPSE crawler: increases crawl frequency from 4-hour to 2-hour intervals starting February 1 (early tender season monitoring). Reza proactively contacts all Enterprise subscribers with IUJK renewals due in Q1 (identified through their profile data) to introduce SKK Express IUJK coordination services. The 'Practical Procurement Calendar' Knowledge Registry asset: updated by January 15 each year to reflect the current year's APBN budget approval status and expected tender publication timeline.", tc: "text-primary" },
            { quarter: "Q2 (Apr–Jun): Puncak musim tender dan kualifikasi tender yang paling kompetitif", compliance_obligations: "April: Tender qualification deadline season — many multi-year infrastructure projects run their qualification document submission windows in April (3–6 weeks after initial publication in February–March). May: LKPP annual procurement training cycle (many PPK and PPHP qualification certificates require annual refresher training — procurement officers with expired certificates cannot chair procurement committees, creating agency compliance pressure that sometimes delays tender processes). June: SKK certification examination season (BNSP runs major examination sessions in June, which Reza plans SKK Express cases to arrive 8 weeks before to ensure prepared portfolio submission).", how_mjp_anticipates: "MJP's Q2 product behavior: Sari publishes a 'Q2 Tender Season Intelligence Brief' (a special edition briefing, not the standard daily format) in the first week of April — covering the top 20 expected tender opportunities, qualification requirements for each, and competitive landscape context. Hendra Jr.'s alert system: Q2 is the highest-alert-volume quarter (3× Q4 tender alert volume). Trust Score: highest query volume in Q2 as BUJK check competitor profiles before qualification submissions. The Knowledge Registry 'Qualification Document Checklist' asset: receives its highest access traffic in Q2 (subscribers preparing qualification submissions). Reza's customer success calendar: most heavily booked in April–May (qualification-related Enterprise support requests reach their annual peak).", tc: "text-blue-700" },
            { quarter: "Q3 (Jul–Sep): Mid-year review, kontrak berjalan, dan mulai persiapan pengadaan akhir tahun", compliance_obligations: "July: Mid-year BPKP audit notification season (projects completed in H1 often receive BPKP audit notifications in July — triggering compliance documentation requirements for BUJK being audited). August: National holiday season reduces procurement activity significantly (Independence Day week has near-zero new tender publications). September: Year-end tender preparation — BUJK who plan to win major Q4 tenders begin their qualification and strategic preparation in September. SKK renewal for personnel whose certificates expire in the October–December window: September is the last month to start the SKK Express process for December deadline compliance.", how_mjp_anticipates: "MJP's Q3 product behavior: July BPKP audit season — the 'Regulatory Enforcement Intelligence' (from R117) is most relevant for subscribers who need to understand BPKP audit scope and compliance requirements for audited projects. August reduced activity: Sari uses the low-activity period for Knowledge Registry strategic initiatives (strategic initiative content development, Sari's 5% annual capacity slot that has been protected from reactive maintenance). September: Reza begins the Q4 tender season preparation calls with Enterprise subscribers (the 'Q4 Opportunity Landscape' conversation that previews expected large-value tender publications). Hendra Jr.: system performance optimization month (August low-load period allows maintenance work that would be too risky during Q2 peak).", tc: "text-emerald-700" },
            { quarter: "Q4 (Okt–Des): Lonjakan tender akhir tahun, serapan anggaran, dan perencanaan lisensi baru untuk tahun mendatang", compliance_obligations: "October: Year-end tender peak — BUJK with unspent project execution budgets publish year-end tenders aggressively in October–November (the 'serapan anggaran' pressure). The highest-value tender window: October–November for projects that need to be contracted before December fiscal year close. November: IUJK renewal preparation for Q1 next year — BUJK whose IUJK expires in January–March begin collecting renewal documentation in November. December: Year-end compliance review — BUJK who have had projects audited in Q3 complete their BPKP audit response documentation. SKK Express demand peak: December is Reza's highest-volume month as BUJK realize personnel certificate expirations are imminent.", how_mjp_anticipates: "MJP's Q4 product behavior: October — crawler at maximum alert frequency (highest tender discovery volume of the year). Sari's Q4 briefing: most tender-dense content calendar of the year (Section 2 covers 2–3 featured tenders per briefing vs the standard 1). Reza's SKK Express capacity: at full utilization in November–December (MODEL-3 tiering becomes most critical in Q4 when jenjang-7 Standard cases would otherwise crowd out higher-value jenjang-8/9 cases). Hendra: begins Series A preparation timeline review in October (Q4 is the annual 'am I on track for next year?' planning period). The IUJK renewal preparation subscriber communication: Reza's December proactive outreach to all subscribers with Q1 IUJK renewals — completing the compliance calendar cycle and beginning the next year's Q1 preparation.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.quarter} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.quarter}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Compliance obligations: {r.compliance_obligations}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>How MJP anticipates: {r.how_mjp_anticipates}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">BUJK annual compliance calendar adalah Sari's most important editorial planning input — because the Knowledge Registry, morning briefing, and MJP product behaviors that are most valuable vary systematically with the procurement and regulatory calendar. A Knowledge Registry asset about IUJK renewal procedures: most valuable in January (when renewals are due) and most accessed in November–December (when BUJK are preparing documentation). A briefing article about BPKP audit defense: most valuable in July (when audit notifications arrive) and least relevant in February. Sari's content production: timed to anticipate subscriber need (publishing or highlighting the relevant assets 4–6 weeks before they are most needed) rather than reacting to subscriber requests. The proactive calendar: ensures that subscribers encounter the relevant guidance before their compliance deadline creates urgency, not after. The most commercially important compliance calendar alignment: SKK Express demand peaks (Q4, especially December) are precisely when Reza's capacity constraints create the highest risk of subscriber dissatisfaction (BUJK who discover a certificate expiring 4 weeks away and need urgent processing). Reza's Q4 proactive outreach: designed to shift SKK Express demand from December (crisis mode) to September–October (planned mode) — converting capacity-constrained emergency requests into predictable planned cases. The demand smoothing: Reza's most operationally sophisticated customer success practice. The annual compliance calendar also drives MJP's competitive advantage explanation: LPSE aggregators provide tender data. MJP provides tender data contextualized within the compliance and regulatory calendar that determines which tenders a specific BUJK can responsibly pursue, when to prepare, and what qualification documentation to have ready. The calendar context: transforms raw tender data into actionable intelligence.</p>
      </div>

      {/* R119: Regulatory Arbitrage Windows */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Telescope className="h-3.5 w-3.5 text-primary" /> REGULATORY ARBITRAGE WINDOWS — Jeda 3–6 Bulan antara Publikasi Regulasi dan Kesadaran BUJK: 4 Kategori Regulasi dengan Awareness Gap Terbesar, Cara MJP Memanfaatkan Gap Ini untuk Klien, dan Mengapa Gap Ini Tidak Akan Hilang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "ARB-CAT-1: TKDN threshold changes — awareness gap 4–6 bulan di BUJK non-Jakarta", arbitrage_window: "LKPP publishes TKDN threshold changes via official circular (SE or Peraturan). The publication: indexed on LKPP's website and reported in government procurement news channels. BUJK in Jakarta with dedicated procurement staff (typically Enterprise-tier BUJK): aware within 2–4 weeks. BUJK outside Jakarta without dedicated regulatory monitoring (typically Standard-tier BUJK in Sulawesi, Kalimantan, Maluku): often learn about TKDN changes only when their tender submission is rejected or flagged — which means they discover the change 4–6 months after publication, at the cost of a failed bid.", mjp_exploitation: "MJP's arbitrage: Sari flags TKDN changes in the morning briefing within 24 hours of official publication and immediately creates or updates the relevant Knowledge Registry asset ('Panduan Compliance TKDN Terbaru'). Subscribers anywhere in Indonesia: learn within hours, not months. The commercial value for the subscriber: avoiding a failed tender submission due to TKDN non-compliance is worth 2–10× the annual MJP subscription (depending on the tender's HPS value). Reza's Enterprise retention argument: 'Satu tender yang tidak gagal karena Anda tahu perubahan TKDN sebelum kompetitor Anda: sudah mengembalikan investasi langganan Anda untuk 5 tahun.'", tc: "text-primary" },
            { category: "ARB-CAT-2: SKK sub-category additions and level changes — awareness gap 3–5 bulan", arbitrage_window: "BNSP periodically releases new SKK sub-categories (when new construction specialty domains are formally recognized) or changes level structures within existing categories. BUJK who have personnel approaching the new level requirements: don't know to start the SKK Express process until they encounter the requirement in a tender qualification checklist — typically 3–5 months after BNSP published the change. The delay: caused by BUJK relying on tender qualification checklists (published when tenders open) rather than monitoring BNSP's regulatory updates directly.", mjp_exploitation: "MJP's arbitrage: Reza's SKK Express early-warning system monitors BNSP updates and flags new sub-category requirements within the briefing. Subscribers who discover a new SKK requirement 5 months before it appears in tender qualifications: can start the SKK Express process at Reza's planned cadence (8-week preparation + 8-week examination cycle = 16 weeks total = exactly enough time to complete before the tender window opens). Subscribers who discover the same requirement when the tender opens: face a 16-week process with a 4-week window, making SKK Express rushed and expensive. The arbitrage value: MJP's 3–5 month warning converts a potential bid disqualification into a planned qualification improvement.", tc: "text-blue-700" },
            { category: "ARB-CAT-3: IUJK renewal procedure changes — awareness gap 2–4 bulan", arbitrage_window: "IUJK renewal procedures are administered at the regional government level (Dinas PUPR kabupaten/kota). When a regional government changes its IUJK renewal documentation requirements or fee structures: the change is published on that government's official website and sometimes in local procurement bulletins. BUJK who renew IUJK in that region: discover the change only when they submit their renewal package and are rejected or asked for additional documents. For BUJK with IUJK in 3–5 provinces: tracking every regional government's procedural changes is operationally impossible without dedicated staff.", mjp_exploitation: "MJP's arbitrage: Hendra Jr.'s crawler monitors regional government IUJK procedure pages (part of the non-LPSE government portal coverage). Sari flags regional IUJK changes in the Knowledge Registry and briefing when material changes are detected. The subscriber benefit: BUJK with multi-regional IUJK coverage receive advance notice of procedure changes in the regions where they operate — converting potential renewal rejection and resubmission delay (4–8 weeks for resubmission) into planned document preparation (add the new document to the renewal package before the first submission). The Reza customer success use case: proactively calling Enterprise subscribers with IUJK renewals due in regions where MJP has detected procedure changes.", tc: "text-emerald-700" },
            { category: "ARB-CAT-4: BIM dan teknologi konstruksi requirement mandates — awareness gap 6–12 bulan", arbitrage_window: "BIM mandate regulations (requiring BIM-based documentation for projects above certain HPS thresholds) are published in PUPR ministerial regulations and circulars. The implementation timeline: typically stated as 12–24 months from publication, giving BUJK theoretically enough time. But BUJK in Indonesia's construction industry: have no tradition of monitoring PUPR's forthcoming regulation pipeline. The typical discovery pattern: a BUJK learns about the BIM mandate when a large tender qualification checklist asks for a 'BIM implementation certificate' — well after the PUPR grace period for preparation has begun. The 6–12 month awareness gap: primarily driven by the lack of any systematic regulatory monitoring in most BUJK organizations.", mjp_exploitation: "MJP's arbitrage: the BIM mandate case study is the flagship example Sari uses in the Knowledge Registry's 'Regulatory Horizon' section. Because BIM certification takes 3–6 months to obtain: BUJK who discover the requirement 12 months before it becomes mandatory have time to plan and complete training. BUJK who discover it 1 month before: face either a disqualification risk or an expensive emergency BIM certification program. The MJP subscription value for large BUJK (Enterprise tier): delivering 12 months of advance regulatory awareness makes the Rp 3.5jt/month fee trivially small compared to the cost of being unprepared for a category-defining regulatory change. Hendra's Series A slide: the BIM mandate case study — how one regulatory awareness arbitrage converted a potential tender disqualification (Rp 500jt+ project loss) into a planned compliance program — illustrates why MJP's subscribers describe the product as 'risk insurance' rather than 'market intelligence.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Arbitrage window: {r.arbitrage_window}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP exploitation: {r.mjp_exploitation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory arbitrage windows adalah the most commercially powerful framing in MJP's entire value proposition narrative — because it converts the product from 'nice to have intelligence tool' to 'risk management infrastructure.' The 4 awareness gaps (TKDN 4–6 months, SKK 3–5 months, IUJK 2–4 months, BIM 6–12 months): are not going away. They are structural consequences of how Indonesia's regulatory publishing ecosystem works: fragmented (national + 34 provinces + 500+ kabupaten/kota), inconsistent (some regulations published on official websites immediately, others only in printed government gazettes), and inaccessible (most BUJK don't have the staff to monitor 500+ government websites for regulatory changes). The gap will persist because the regulatory publishing infrastructure is not going to centralize on a 5-year horizon. MJP's monitoring infrastructure (Hendra Jr.'s crawler covering not just LPSE but government regulatory portals): is the only private-sector solution that systematically narrows this awareness gap for BUJK. The key Sari narrative for the Series A pitch: 'We are not a data company. We are a regulatory awareness infrastructure company. The data is already public — just scattered across 671 portals and 500+ government websites. MJP is the only organization in Indonesia that has the technical infrastructure to aggregate it, the editorial expertise to analyze it, and the distribution system (487 subscribers) to deliver it to the BUJK who need it most.' The arbitrage windows are the human cost of living without MJP: failed bid submissions, missed compliance deadlines, rushed and expensive emergency certification programs. Each arbitrage window represents a preventable cost that MJP's subscribers avoid every year. The subscription fee: never more than 5–10% of one prevented compliance failure.</p>
      </div>

      {/* R120: Regulatory Compliance Debt */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-primary" /> REGULATORY COMPLIANCE DEBT — 3 Tipe Masalah Kepatuhan yang BUJK Tunda Hingga Menjadi Darurat: Pola Penundaan, Biaya Penundaan vs Biaya Penyelesaian Proaktif, dan Bagaimana MJP Mengubah Utang Kepatuhan Menjadi Pipeline SKK Express
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-primary mb-0.5">DEBT-TYPE-1: SKK certificate expiry deferral — sertifikat masih berlaku beberapa bulan, urus nanti</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Deferral pattern: BUJK personnel whose SKK certificates expire in Q4 consistently defer renewal to October–November — despite the SKK Express process requiring 16 weeks minimum. The rational-seeming logic: certificate expires December 15, plenty of time, handle it in October. The hidden cost: October is also the highest-volume tender season (Q4 serapan anggaran). A BUJK trying to pursue 3–4 high-value Q4 tenders while simultaneously processing SKK renewals discovers that SKK Express October queue is full and the express processing timeline may extend to 20+ weeks due to queue pressure.</p>
            <p className="text-[7px] font-mono text-primary">Cost comparison: Proactive renewal started July: Rp 1.5–3.5jt at planned pace, no queue premium. Emergency renewal started October for December expiry: Rp 2.5–5jt (express track queue premium + Reza expedited service) PLUS opportunity cost of Q4 tender bidding distraction. Total emergency cost: 2–3x the proactive cost. MJP intervention: SKK Alert V2 Stage-A notification at 90 days before expiry — specifically designed to trigger the start-now behavior before Q4 queue pressure materializes.</p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-blue-700 mb-0.5">DEBT-TYPE-2: IUJK renewal preparation deferral — masih berlaku 3 bulan, mulai kumpulkan dokumen bulan depan</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Deferral pattern: BUJK whose IUJK expires in January–March defer documentation collection to November–December. The hidden cost: IUJK renewal documentation requires documents from multiple sources — financial reports from accountants (2–4 weeks), company legality documents from notaries (1–2 weeks), project completion certificates from past clients (1–3 weeks per letter). Starting collection in December for a January deadline creates a 3–4 week documentation race that almost always results in a resubmission-required rejection for at least 1 missing or incorrect document.</p>
            <p className="text-[7px] font-mono text-blue-700">Cost comparison: Proactive preparation started October: minimal — 1–2 hours of document checklist review per month, documents requested on a comfortable timeline, no expediting required. Emergency preparation started December for January deadline: intensive documentation collection with same-day notary requests, urgent financial reports, resubmission risk adding 4–6 week delay, potential IUJK lapse penalty if renewal not completed before expiry. MJP intervention: Reza November proactive outreach to all subscribers with Q1 IUJK renewals — the IUJK Renewal Preparation Calendar initiated 3 months before the deadline.</p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-emerald-700 mb-0.5">DEBT-TYPE-3: BIM compliance deferral — mandate starts in 12 months, we will deal with it in 6 months</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Deferral pattern: when PUPR announces a BIM mandate with an 18-month implementation timeline, BUJK systematically defer BIM preparation until month 12 — at which point the 6-month remaining timeline is not sufficient for the 3–6 month BIM certification process plus 3–4 months of portfolio-building experience required to demonstrate BIM competency. The hidden cost: BIM certification providers (mostly universities and BNSP-accredited training centers) have limited capacity. When the entire BUJK market realizes simultaneously in month 12 that the BIM deadline is approaching: training program waiting lists extend to 6–8 months, certification fees increase due to demand pressure, and the most qualified BIM trainers become fully booked.</p>
            <p className="text-[7px] font-mono text-emerald-700">Cost comparison: Early BIM preparation started month 1–3: enroll in first cohort (lowest demand, best faculty, lowest fee), build portfolio over 12–15 months, enter certification well-prepared. Delayed preparation started month 12: BIM training waitlist 4–6 months (earliest completion month 16–18, after mandate takes effect), emergency premium pricing, rushed portfolio, exam failure risk. MJP intervention: the BIM mandate Knowledge Registry asset and briefing coverage initiated at mandate publication — framing the 18-month timeline as 6 months of planning plus 12 months of preparation, not 18 months to wait. Subscribers who act in month 1–3 avoid the compliance rush entirely.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regulatory compliance debt adalah the most commercially actionable framing in MJP's entire value proposition — because it converts the product from information provider to avoided-cost infrastructure. The 3 debt types (SKK deferral, IUJK preparation deferral, BIM compliance deferral): are predictable because they follow the same cognitive pattern in BUJK organizational decision-making. The pattern: I know I should do this, I have time to do it, and there are more urgent things to do today, so I will defer. The deferred action: eventually becomes unavoidable, but by then the cost has compounded. MJP role in breaking this pattern: not providing information the subscriber lacks (most BUJK know their SKK expires and IUJK needs renewal) but providing the context, urgency calibration, and process support that converts should-do into doing-now. The SKK Alert V2 Stage-A notification: the product-level implementation of this insight — the 90-day alert is not informational but behavioral. The behavioral reframing: the difference between information that gets noted and deferred vs information that triggers immediate action. Reza commercial insight: BUJK who accumulate compliance debt are the most high-value SKK Express customers — because they always pay the emergency premium. But they are also the least satisfied customers (rushing under deadline pressure creates anxiety and occasional quality shortcuts). Converting compliance-debt customers to proactive customers: Reza primary customer success mission — because proactive customers have higher NPS and higher renewal rates. The compliance debt conversation: MJP most commercially productive advisory topic and the best demonstration of why the subscription is worth its cost in prevented compliance emergency expenses.</p>
      </div>

      {/* R121: Beban Administrasi Berlapis yang Memberatkan BUJK */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-destructive" /> BEBAN ADMINISTRASI BERLAPIS BUJK — 8 Kewajiban Regulasi yang Paling Memberatkan Operasional Perusahaan Konstruksi: Dari Pancek-SMAP hingga ESIMPAN, Setiap Kewajiban Menambah Biaya dan Waktu yang Harus Diperhitungkan dalam Harga Penawaran
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-destructive mb-0.5">BEBAN-1: Pancek (Penilaian Kemampuan dan Kinerja) + SMAP ISO 37001 — dua kewajiban baru yang menyulitkan</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Pancek adalah penilaian kemampuan dan kinerja BUJK yang dilakukan LPJK sebagai syarat perpanjangan SBU. Mencakup penilaian kapasitas keuangan, SDM bersertifikat, pengalaman proyek, dan sistem manajemen mutu. Untuk BUJK kecil: proses Pancek memakan waktu 2–4 minggu, membutuhkan data yang tersebar di berbagai departemen, dan sering gagal di aspek SDM karena jumlah tenaga ahli bersertifikat tidak memenuhi rasio minimum. SMAP (Sistem Manajemen Anti Penyuapan) berbasis ISO 37001: diwajibkan untuk BUJK yang mengerjakan proyek pemerintah di atas threshold tertentu. Implementasi ISO 37001 membutuhkan konsultan eksternal, audit internal, dan sertifikasi badan akreditasi — biaya total Rp 50–150jt tergantung ukuran perusahaan, belum termasuk biaya pemeliharaan tahunan.</p>
            <p className="text-[7px] font-mono text-destructive">MJP coverage: Pancek checklist dan kalender perpanjangan SBU tersedia di Knowledge Registry. SMAP ISO 37001 gap-analysis template untuk BUJK Menengah dalam pipeline Q3 2026. Sumber: {" "}
              <a href="https://lpjk.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">lpjk.pu.go.id</a>{" "}·{" "}
              <a href="https://jdih.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">jdih.pu.go.id</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-orange-700 mb-0.5">BEBAN-2: PUB (Pengembangan Usaha Berkelanjutan) — kewajiban yang sering tidak dipahami BUJK</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">PUB adalah kewajiban BUJK untuk mengembangkan usaha secara berkelanjutan yang diatur dalam PP No. 5/2021 dan Permen PUPR No. 8/2022. Mencakup kewajiban pelatihan tenaga kerja, investasi dalam sistem manajemen mutu, dan laporan berkala ke LPJK. Dalam praktiknya: banyak BUJK tidak mengetahui bahwa PUB adalah kewajiban terpisah dari kewajiban perpanjangan SBU dan IUJK. Ketidakpatuhan PUB dapat menjadi dasar pencabutan SBU saat perpanjangan, meskipun seluruh persyaratan teknis terpenuhi. BUJK yang baru pertama kali perpanjangan SBU setelah 2022: sering kaget menemukan PUB sebagai persyaratan tambahan yang tidak pernah dikomunikasikan saat registrasi awal.</p>
            <p className="text-[7px] font-mono text-orange-700">MJP coverage: PUB compliance checklist dan timeline tersedia di Knowledge Registry. Alert 6 bulan sebelum deadline perpanjangan SBU mencakup PUB checklist. Sumber: {" "}
              <a href="https://peraturan.bpk.go.id/Details/161852" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">PP No. 5/2021 (peraturan.bpk.go.id)</a>{" "}·{" "}
              <a href="https://jdih.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">Permen PUPR 8/2022 (jdih.pu.go.id)</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-blue-700 mb-0.5">BEBAN-3: LKUT (Laporan Kegiatan Usaha Tahunan) + LKMP (Laporan Kegiatan Penanaman Modal) — dua laporan tahunan wajib dengan ancaman sanksi</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">LKUT diwajibkan oleh UU No. 2/2017 tentang Jasa Konstruksi — BUJK wajib menyampaikan laporan kegiatan usaha setiap tahun ke LPJK paling lambat 31 Maret. LKMP diwajibkan oleh BKPM/BKIPM untuk BUJK dengan komponen Penanaman Modal Asing (PMA) atau BUJK yang menerima investasi di atas threshold tertentu. Kedua laporan membutuhkan data keuangan yang sudah diaudit (sehingga bergantung pada selesainya audit akuntan publik), data SDM yang akurat, dan data proyek yang lengkap. Deadline LKUT (31 Maret) sering bertabrakan dengan deadline audit laporan keuangan tahunan — menciptakan bottleneck di Q1 yang menekan kapasitas administrasi BUJK secara bersamaan. Sanksi keterlambatan LKUT: peringatan tertulis, pembekuan SBU sementara jika tidak segera diperbaiki.</p>
            <p className="text-[7px] font-mono text-blue-700">MJP coverage: LKUT submission template dan checklist data tersedia. Kalender deadline Q1 (LKUT 31 Maret, LKMP 31 Januari) di dashboard alert. Sumber: {" "}
              <a href="https://lpjk.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">lpjk.pu.go.id — LKUT portal</a>{" "}·{" "}
              <a href="https://bkpm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">bkpm.go.id — LKMP</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-purple-700 mb-0.5">BEBAN-4: Laporan Akuntan Publik + Perpajakan — beban keuangan yang terus meningkat</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">BUJK Menengah dan Besar diwajibkan menyertakan laporan keuangan yang diaudit Kantor Akuntan Publik (KAP) terdaftar untuk perpanjangan SBU dan kualifikasi tender besar. Biaya audit KAP untuk BUJK Menengah: Rp 25–75jt per tahun tergantung kompleksitas. Di sisi perpajakan: konstruksi terkena PPh Final 2.3% (bangunan), PPh 21 tenaga ahli, PPN 11% atas jasa konstruksi tertentu, PPh Pasal 4 Ayat 2, dan kewajiban TP Doc (Transfer Pricing Documentation) untuk yang berafiliasi. Beban perpajakan konstruksi meningkat sejak UU HPP 2021 — kenaikan PPN dari 10% ke 11% (dan rencana 12%) langsung menambah biaya overhead proyek. BUJK yang menggunakan tenaga kerja subkontrak massal: menghadapi kompleksitas PPh 21 yang membutuhkan sistem penggajian terintegrasi atau konsultan pajak dedicated.</p>
            <p className="text-[7px] font-mono text-purple-700">MJP coverage: Kalender kewajiban perpajakan konstruksi dan checklist dokumen audit tersedia di Knowledge Registry. Alert perpajakan Q4 (SPT Tahunan Badan, PPh Final settlement). Sumber: {" "}
              <a href="https://pajak.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">pajak.go.id</a>{" "}·{" "}
              <a href="https://peraturan.bpk.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">UU HPP No. 7/2021 (peraturan.bpk.go.id)</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-emerald-700 mb-0.5">BEBAN-5: Penyesuaian Akta dengan KBLI 2020 — kewajiban yang tidak banyak diketahui tapi berdampak besar</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">PP No. 5/2021 (OSS berbasis risiko) mewajibkan BUJK menyesuaikan KBLI (Klasifikasi Baku Lapangan Usaha Indonesia) dalam akta pendirian dan NIB dengan KBLI 2020. Banyak BUJK yang akta perusahaannya masih mencantumkan kode KBLI lama (KBLI 2015 atau sebelumnya) mengalami penolakan perpanjangan SBU dan IUJK di OSS karena KBLI tidak sesuai. Proses penyesuaian akta: membutuhkan perubahan akta notaris (Rp 2–5jt), persetujuan Kementerian Hukum dan HAM (2–4 minggu), perubahan NIB di OSS, dan perubahan data LPJK. Total waktu proses: 4–8 minggu, total biaya: Rp 5–15jt. BUJK yang memiliki banyak sub-bidang usaha: sering menemukan bahwa KBLI 2020 memecah kode usaha lama menjadi kode-kode baru yang lebih spesifik, memerlukan penambahan KBLI baru di akta.</p>
            <p className="text-[7px] font-mono text-emerald-700">MJP coverage: KBLI 2020 mapping guide untuk konstruksi (perbandingan KBLI lama vs baru) dan checklist penyesuaian akta tersedia di Knowledge Registry. Sumber: {" "}
              <a href="https://oss.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">oss.go.id — KBLI 2020</a>{" "}·{" "}
              <a href="https://peraturan.bpk.go.id/Details/161852" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">PP No. 5/2021</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-red-700 mb-0.5">BEBAN-6: OSS Lambat Terbitkan Sertifikat Standar — hambatan sistemik yang belum terselesaikan</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Sertifikat Standar (pengganti izin usaha di sistem OSS berbasis risiko) seharusnya diterbitkan otomatis atau dalam waktu singkat setelah verifikasi. Kenyataan di lapangan: proses verifikasi Sertifikat Standar untuk bidang konstruksi sering terhambat 2–8 minggu karena antrian di DINAS PUPR daerah yang bertugas memverifikasi. Masalah sistemik OSS konstruksi: (1) integrasi antara OSS BKPM dan sistem LPJK tidak sempurna — sering terjadi data tidak sinkron; (2) persyaratan dokumen yang berubah tanpa notifikasi resmi ke pemohon; (3) layanan helpdesk OSS untuk konstruksi tidak memiliki SLA yang dipublikasikan. BUJK yang mengalami keterlambatan Sertifikat Standar: tidak dapat mengikuti tender selama masa tunggu, meskipun secara substansi memenuhi seluruh persyaratan.</p>
            <p className="text-[7px] font-mono text-red-700">MJP coverage: OSS troubleshooting guide dan daftar kontak DINAS PUPR verifikator per provinsi. Template surat eskalasi untuk keterlambatan OSS. Sumber: {" "}
              <a href="https://oss.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">oss.go.id</a>{" "}·{" "}
              <a href="https://investasi.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">investasi.go.id — panduan OSS</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-yellow-700 mb-0.5">BEBAN-7: ESIMPAN (E-Sertifikat Mandiri Penanaman Modal) — kewajiban yang sulit dipenuhi BUJK</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">ESIMPAN adalah sistem pelaporan mandiri penanaman modal yang dikelola BKPM (sekarang terintegrasi ke OSS). Kewajiban ESIMPAN berlaku untuk BUJK yang merealisasikan investasi (pengadaan peralatan, pengembangan SDM, akuisisi lahan untuk gudang/workshop) di atas threshold tertentu. Kesulitan utama: (1) definisi "penanaman modal" yang harus dilaporkan tidak jelas bagi BUJK kecil — apakah pembelian alat berat termasuk? Apakah renovasi kantor termasuk? (2) frekuensi pelaporan (triwulanan untuk yang aktif) membebani admin BUJK kecil yang tidak memiliki staf dedicated; (3) sistem ESIMPAN sering down atau lambat pada periode deadline. Sanksi ketidakpatuhan ESIMPAN: pencabutan izin penanaman modal, yang berdampak pada status NIB dan secara tidak langsung pada kualifikasi OSS.</p>
            <p className="text-[7px] font-mono text-yellow-700">MJP coverage: Panduan ESIMPAN untuk BUJK — menentukan kewajiban pelaporan, threshold, dan jadwal. Template laporan triwulanan tersedia. Sumber: {" "}
              <a href="https://bkpm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">bkpm.go.id</a>{" "}·{" "}
              <a href="https://oss.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">oss.go.id — integrasi ESIMPAN</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-cyan-700 mb-0.5">BEBAN-8: SIMPK (Sistem Informasi Manajemen Peralatan Konstruksi) — pendaftaran peralatan yang rumit dan ketidakmerataan ketersediaan</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">SIMPK adalah sistem registrasi dan pencatatan peralatan konstruksi yang dikelola Ditjen Bina Konstruksi PUPR. BUJK diwajibkan mendaftarkan peralatan konstruksi yang digunakan untuk proyek pemerintah. Masalah utama: (1) proses registrasi SIMPK membutuhkan sertifikat laik operasi peralatan, buku servis, dan verifikasi fisik — total dokumen 8–12 berkas per unit; (2) untuk alat berat impor: dokumen impor dan customs clearance harus dilampirkan; (3) sistem SIMPK belum terintegrasi dengan database bea cukai, sehingga verifikasi manual; (4) peralatan yang sudah terdaftar di SIMPK tetap harus diperbarui setiap 2 tahun. Ketidakmerataan ketersediaan: peralatan konstruksi terkonsentrasi di Jawa (67% alat berat terdaftar di SIMPK berada di Pulau Jawa) — BUJK yang mengerjakan proyek di daerah terpencil menghadapi biaya mobilisasi alat 15–35% dari nilai kontrak. Pengadaan alat berat baru: terkendala kuota impor, harga dalam USD (terpengaruh kurs), dan lead time 6–18 bulan untuk alat baru.</p>
            <p className="text-[7px] font-mono text-cyan-700">MJP coverage: SIMPK registration checklist per kategori peralatan, database ketersediaan alat berat per region (dari data tender LPSE). Analisis biaya mobilisasi peralatan per koridor Jawa-luar Jawa. Sumber: {" "}
              <a href="https://simpk.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">simpk.pu.go.id</a>{" "}·{" "}
              <a href="https://binakon.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">binakon.pu.go.id — Ditjen Bina Konstruksi</a>
            </p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Delapan beban administrasi ini tidak berdiri sendiri — mereka saling bertumpuk dalam kalender yang sama. Q1 adalah bulan terpadat: LKUT deadline 31 Maret, audit KAP harus selesai sebelum LKUT, ESIMPAN triwulan pertama, perpanjangan SBU bagi yang masa berlaku habir Q1, dan SPT Tahunan PPh Badan April. BUJK kecil dengan 2–3 staf administrasi: secara praktis tidak mungkin menangani semua kewajiban ini secara in-house tanpa konsultan eksternal. MJP commercial insight: setiap kewajiban baru yang pemerintah tambahkan ke ekosistem BUJK adalah MJP revenue opportunity — karena setiap kewajiban baru membutuhkan panduan, template, dan monitoring yang merupakan inti layanan MJP. Sari: 'Regulasi yang mempersulit BUJK bukan berita buruk bagi MJP — asalkan MJP hadir lebih cepat dari kebingungan BUJK. Kebingungan yang cepat terjawab adalah kepercayaan yang terbangun.'</p>
        <div className="mt-2 pt-2 border-t">
          <p className="text-[8px] font-mono text-muted-foreground mb-1 font-semibold">SUMBER REFERENSI RESMI:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {[
              { label: "LPJK PUPR", url: "https://lpjk.pu.go.id" },
              { label: "JDIH PUPR", url: "https://jdih.pu.go.id" },
              { label: "OSS RI", url: "https://oss.go.id" },
              { label: "BKPM", url: "https://bkpm.go.id" },
              { label: "SIMPK PUPR", url: "https://simpk.pu.go.id" },
              { label: "Ditjen Bina Konstruksi", url: "https://binakon.pu.go.id" },
              { label: "DJP Pajak", url: "https://pajak.go.id" },
              { label: "Peraturan BPK", url: "https://peraturan.bpk.go.id" },
            ].map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[7px] text-primary hover:underline font-mono">
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Regulation cards */}
      <div className="flex flex-col gap-3">
        {filtered.map((reg) => {
          const isOpen = expanded === reg.id;
          const isDone = followedUp.has(reg.id);
          return (
            <div key={reg.id} className={cn("group border rounded-sm bg-card overflow-hidden transition-all hover:shadow-sm", isDone && "opacity-60")}>
              {/* Impact bar */}
              <div className={cn("h-1", isDone ? "bg-green-500" : IMPACT_BAR[reg.dampak])} />

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">{reg.kode}<button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(reg.kode).then(() => toast.success("Kode regulasi disalin", { duration: 1200 })); }} aria-label="Salin kode regulasi" className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground" title="Salin kode regulasi"><Copy className="h-2.5 w-2.5" /></button></span>
                      <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border", STATUS_COLORS[reg.status])} title={{ BARU:"Regulasi baru diterbitkan", DIUBAH:"Regulasi telah direvisi/diubah", DICABUT:"Regulasi telah dicabut dan tidak berlaku", AKAN_BERLAKU:"Regulasi akan segera berlaku" }[reg.status] ?? reg.status}>
                        {{ BARU:"Baru", DIUBAH:"Diubah", DICABUT:"Dicabut", AKAN_BERLAKU:"Akan Berlaku" }[reg.status] ?? reg.status.replace("_", " ")}
                      </span>
                      <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border", IMPACT_COLORS[reg.dampak])} title={{ KRITIS:"Dampak Kritis — tindak lanjut wajib segera", TINGGI:"Dampak Tinggi — perlu respons dalam 30 hari", SEDANG:"Dampak Sedang — pantau dan rencanakan", RENDAH:"Dampak Rendah — informasi saja" }[reg.dampak] ?? reg.dampak}>
                        Dampak {{ KRITIS:"Kritis", TINGGI:"Tinggi", SEDANG:"Sedang", RENDAH:"Rendah" }[reg.dampak] ?? reg.dampak}
                      </span>
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">{reg.domain}</span>
                      {isDone && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border bg-green-50 border-green-300 text-green-700 flex items-center gap-1">
                          <CircleCheck className="h-2.5 w-2.5" /> Sudah Ditindaklanjuti
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2" title={reg.judul}>{reg.judul}</h3>
                    <p className="text-xs text-muted-foreground mt-1 font-mono whitespace-nowrap" title={`${reg.instansi} · ${reg.tanggal}`}>{reg.instansi} · {reg.tanggal}</p>
                    {!isOpen && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2" title={reg.ringkasan}>{reg.ringkasan}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={cn("transition-opacity", isDone ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                    <Button
                      variant={isDone ? "default" : "outline"}
                      size="sm"
                      className={cn("h-7 text-[10px] font-mono px-2 shrink-0", isDone ? "bg-green-600 hover:bg-green-700 border-green-600" : "border-green-300 text-green-700 hover:bg-green-50")}
                      onClick={() => { toggleFollowedUp(reg.id); toast.success(isDone ? "Checklist dibatalkan" : "Checklist selesai ✓", { description: reg.judul?.slice(0, 60) ?? undefined, duration: 1800 }); }}
                    >
                      <CircleCheck className="h-3 w-3 mr-1" />
                      {isDone ? "Selesai" : "Tandai"}
                    </Button>
                    </div>
                    <button
                      onClick={() => setExpanded(isOpen ? null : reg.id)}
                      aria-expanded={isOpen}
                      title={isOpen ? "Tutup detail regulasi" : "Buka detail regulasi"}
                      className="shrink-0 flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 flex flex-col gap-4 border-t pt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Ringkasan */}
                    <div>
                      <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Ringkasan</p>
                      <p className="text-sm leading-relaxed">{reg.ringkasan}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Siapa terdampak */}
                      <div className="border rounded-sm p-3 bg-orange-50/30">
                        <p className="text-xs font-mono font-semibold text-orange-700 uppercase tracking-wider mb-2">
                          Siapa Terdampak
                        </p>
                        <ul className="flex flex-col gap-1">
                          {reg.siapaTerdampak.map((t, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs" title={t}>
                              <TriangleAlert className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Tindakan wajib */}
                      <div className="border rounded-sm p-3 bg-green-50/30">
                        <p className="text-xs font-mono font-semibold text-green-700 uppercase tracking-wider mb-2">
                          Checklist Tindakan
                        </p>
                        <ul className="flex flex-col gap-1.5">
                          {reg.tindakanWajib.map((t, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs">
                              <CircleCheck className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {reg.deadline && (
                      <div className="flex items-center gap-2 p-2.5 border border-red-200 rounded-sm bg-red-50/40">
                        <Clock className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span className="text-xs font-semibold text-red-700">Deadline:</span>
                        <span className="text-xs text-red-700 whitespace-nowrap">{reg.deadline}</span>
                        {(() => {
                          const d = new Date(reg.deadline);
                          const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
                          if (isNaN(daysLeft)) return null;
                          if (daysLeft < 0) return <span className="ml-auto text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-red-700 text-white">Terlewat</span>;
                          if (daysLeft <= 14) return <span className="ml-auto text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-red-600 text-white animate-pulse">Segera berlaku {daysLeft} hari</span>;
                          if (daysLeft <= 30) return <span className="ml-auto text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-orange-500 text-white">{daysLeft}h lagi</span>;
                          return null;
                        })()}
                      </div>
                    )}

                    {/* Quick note */}
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                      <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                        Catatan Tim
                        {savedNoteId === reg.id && <span className="text-[10px] text-emerald-600 font-normal normal-case">✓ Tersimpan</span>}
                      </p>
                      <textarea
                        value={regulasiNotes[reg.id] ?? ""}
                        onChange={(e) => updateRegulasiNote(reg.id, e.target.value)}
                        onKeyDown={e => { if (e.key === "Escape") e.currentTarget.blur(); }}
                        onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                        placeholder="Tambah catatan analisis, tindak lanjut, atau konteks…"
                        rows={2}
                        maxLength={500}
                        className="w-full border rounded-sm px-2.5 py-1.5 text-xs resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
                      />
                      <p className="text-[9px] font-mono text-muted-foreground text-right">{(regulasiNotes[reg.id] ?? "").length} / 500</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {reg.link && (
                        <a
                          href={reg.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Lihat sumber resmi
                        </a>
                      )}
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`📋 *${reg.kode}*\n*${reg.judul}*\n\n${reg.ringkasan.slice(0, 200)}...\n\n✅ Tindakan wajib:\n${reg.tindakanWajib.slice(0,2).map((t,i) => `${i+1}. ${t}`).join('\n')}\n\n🔗 ${reg.link ?? 'https://lpjk.pu.go.id'}`).replace(/%0A/g, '%0A')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-green-600 hover:underline font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Bagikan via WA
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
            <ListFilter className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Tidak ada regulasi yang cocok</p>
            <p className="text-xs opacity-70">Coba ubah filter atau kata kunci pencarian</p>
            <button
              onClick={() => { setDomain("Semua Domain"); setStatus("Semua Status"); setImpact("Semua Dampak"); setCatFilter("Semua Kategori"); setSearch(""); setSortByDampak(false); setShowWithNotesOnly(false); }}
              className="mt-1 text-xs font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
            >
              ✕ Reset semua filter
            </button>
          </div>
        )}
      </div>

      {/* Trending regulation topics from scheduler */}
      {(trends ?? []).length > 0 && (
        <div className="border rounded-sm p-4 bg-muted/20">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Topik Regulasi Trending dari Data Harian
          </p>
          <div className="flex flex-wrap gap-2">
            {(trends ?? []).map((t, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 bg-primary/5 border border-primary/20 rounded-sm text-xs font-mono">
                <span className="text-primary font-bold">{t.count}×</span> {t.topic}
              </span>
            ))}
          </div>
        </div>
      )}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
