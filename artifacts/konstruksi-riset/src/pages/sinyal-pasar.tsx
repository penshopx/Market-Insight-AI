import { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPainPoints, getListPainPointsQueryKey,
  useGetTrendingTopics, getGetTrendingTopicsQueryKey,
  useListResearchItems, getListResearchItemsQueryKey,
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Activity, Bell, BellOff, BookOpen, Brain, Calendar, CalendarCheck, ChartBar, ChartColumnBig, ChevronDown, ChevronRight, ChevronUp, CircleCheck, Clock, Coffee, Copy, Cpu, Database, DollarSign, Eye, FileText, Flame, FlaskConical, GitBranch, Globe, GraduationCap, Handshake, Heart, History, LayoutGrid, ListFilter, Map, MapPin, MessageCircle, MessageSquare, Mic, Network, Plus, Radar, RefreshCw, Rocket, School, Search, Send, Shield, ShieldAlert, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, Star, Target, Telescope, TrendingUp, TriangleAlert, Trophy, Users, Volume2, Wifi, X, Zap } from "lucide-react";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";

// ─── VOC Categories (Voice of Customer signals) ───────────────────────────────

interface VOCSignal {
  id: string;
  kategori: "PAIN" | "FEAR" | "DESIRE" | "OBJECTION" | "TRIGGER";
  sumber: string;
  kutipan: string;
  terjemahan: string;
  segment: string;
  frekuensi: number; // 1-10
  peluangLayanan: string;
}

const VOC_SIGNALS: VOCSignal[] = [
  {
    id: "v1", kategori: "PAIN", sumber: "Forum Kontraktor / Kaskus",
    kutipan: "\"SBU kita tiba-tiba habis pas mau ikut tender, padahal udah nyiapin dokumen dari bulan lalu\"",
    terjemahan: "Kontraktor kehilangan peluang tender karena tidak mengetahui SBU akan habis masa berlakunya",
    segment: "Kontraktor Kecil-Menengah", frekuensi: 9,
    peluangLayanan: "Layanan monitor & alert SBU expiry + perpanjangan express",
  },
  {
    id: "v2", kategori: "FEAR", sumber: "Instagram Konstruksi / DM",
    kutipan: "\"Takut kena blacklist LPJK kalau SMAP belum beres, tapi nggak tau harus mulai dari mana\"",
    terjemahan: "BUJK takut dicabut SBU karena tidak comply SMAP tetapi tidak tahu cara implementasi",
    segment: "BUJK Menengah", frekuensi: 8,
    peluangLayanan: "Paket SMAP Express: gap analysis + implementasi + sertifikasi",
  },
  {
    id: "v3", kategori: "PAIN", sumber: "LinkedIn Group Konstruksi",
    kutipan: "\"Tim kita buang waktu 2 minggu ngurusin administrasi tender, ujung-ujungnya gugur teknis\"",
    terjemahan: "BUJK kehilangan waktu dan biaya karena proses persiapan tender yang tidak efisien",
    segment: "Kontraktor Menengah", frekuensi: 8,
    peluangLayanan: "Layanan pendampingan tender end-to-end: admin + teknis + harga",
  },
  {
    id: "v4", kategori: "DESIRE", sumber: "Diskusi WhatsApp Group GAPENSI",
    kutipan: "\"Pengen tahu tender apa yang kira-kira bisa kita menangkan, jangan asal daftar\"",
    terjemahan: "BUJK ingin analisis peluang menang sebelum memutuskan mengikuti tender",
    segment: "Semua BUJK", frekuensi: 9,
    peluangLayanan: "Layanan analisis eligibilitas & peluang menang tender berbasis data",
  },
  {
    id: "v5", kategori: "PAIN", sumber: "Review Google Maps Konsultan",
    kutipan: "\"Bayar mahal tapi konsultan SBU-nya nggak transparan biayanya, minta tambahan terus\"",
    terjemahan: "Klien tidak puas dengan konsultan SBU yang tidak transparan biaya dan prosesnya",
    segment: "BUJK Kecil", frekuensi: 7,
    peluangLayanan: "Layanan SBU dengan pricing transparan dan progress tracking digital",
  },
  {
    id: "v6", kategori: "OBJECTION", sumber: "Sales conversation internal",
    kutipan: "\"Kita punya orang sendiri yang ngurusin SBU, nggak perlu konsultan luar\"",
    terjemahan: "BUJK menolak layanan konsultan karena merasa punya kapasitas internal",
    segment: "BUJK Menengah-Besar", frekuensi: 6,
    peluangLayanan: "Reframe ke: bukan gantikan orang Anda, tapi beri mereka tools + intelijen",
  },
  {
    id: "v7", kategori: "FEAR", sumber: "Forum diskusi konstruksi online",
    kutipan: "\"IKN ini peluang besar tapi kita nggak tau syarat SBU-nya gimana buat proyek skala itu\"",
    terjemahan: "BUJK takut kehilangan peluang IKN karena tidak memahami persyaratan kualifikasi",
    segment: "BUJK Menengah", frekuensi: 7,
    peluangLayanan: "Brief kualifikasi IKN + roadmap peningkatan SBU untuk proyek nasional",
  },
  {
    id: "v8", kategori: "TRIGGER", sumber: "Email / WhatsApp marketing inbound",
    kutipan: "\"Baru dapat LPSE notification ada tender Rp 5M, tapi kita belum punya SKK-nya\"",
    terjemahan: "Event tender masuk menjadi trigger kebutuhan SKK yang mendesak",
    segment: "Kontraktor Kecil", frekuensi: 8,
    peluangLayanan: "Layanan SKK express 7-14 hari + pendampingan tender simultan",
  },
  {
    id: "v9", kategori: "DESIRE", sumber: "TikTok komentar konten konstruksi",
    kutipan: "\"Pengen tau kompetitor kita pasang harga berapa di tender itu, susah banget carinya\"",
    terjemahan: "BUJK ingin mengetahui strategi harga kompetitor dalam tender yang sama",
    segment: "Kontraktor Aktif Tender", frekuensi: 6,
    peluangLayanan: "Layanan competitive pricing analysis dan bid strategy consultation",
  },
  {
    id: "v10", kategori: "PAIN", sumber: "Konsultasi langsung klien",
    kutipan: "\"Kita kalah lagi tender kemarin, padahal dokumen udah lengkap — nggak tau salahnya di mana\"",
    terjemahan: "BUJK kehilangan tender berulang kali tanpa memahami penyebab kegagalan",
    segment: "Kontraktor Aktif Tender", frekuensi: 8,
    peluangLayanan: "Audit dokumen tender + post-mortem analysis + strategi perbaikan",
  },
  {
    id: "v11", kategori: "TRIGGER", sumber: "Notifikasi LPJK",
    kutipan: "\"Dapat surat dari LPJK soal ketidaksesuaian SMAP, panik nggak tau harus ngapain\"",
    terjemahan: "BUJK menerima surat peringatan LPJK sebagai trigger kebutuhan mendesak",
    segment: "BUJK yang ada di daftar SMAP LPJK", frekuensi: 9,
    peluangLayanan: "Layanan SMAP emergency response: 48 jam respons + pendampingan",
  },
  {
    id: "v12", kategori: "DESIRE", sumber: "LinkedIn kontraktor profesional",
    kutipan: "\"Mau develop SDM konstruksi kita tapi nggak tau learning path yang paling efisien\"",
    terjemahan: "BUJK ingin mengembangkan kompetensi SDM tapi tidak tahu jalur yang tepat",
    segment: "BUJK Menengah dengan HR aktif", frekuensi: 5,
    peluangLayanan: "Layanan competency mapping + learning path SKK yang dipersonalisasi",
  },
  {
    id: "v13", kategori: "PAIN", sumber: "Forum HIPPI / KADIN",
    kutipan: "\"Proses SMAP itu berbulan-bulan dan dokumennya ratusan halaman — ada nggak yang bisa bantu beres lebih cepat?\"",
    terjemahan: "BUJK kewalahan dengan kompleksitas dan durasi implementasi SMAP ISO 37001",
    segment: "BUJK Menengah-Besar wajib SMAP", frekuensi: 9,
    peluangLayanan: "Paket SMAP Fast-Track: template dokumen + konsultan on-site + target 90 hari",
  },
  {
    id: "v14", kategori: "TRIGGER", sumber: "Berita Detik Finance / Kontan",
    kutipan: "\"Setelah Perpres IKN terbaru, banyak tender Rp 10M+ tiba-tiba muncul di daerah yang biasanya sepi\"",
    terjemahan: "Kebijakan pemerintah baru menciptakan peluang tender masif di wilayah strategis",
    segment: "Kontraktor Menengah-Besar regional", frekuensi: 8,
    peluangLayanan: "Layanan monitoring kebijakan + early alert tender BUMN strategis per wilayah",
  },
  {
    id: "v15", kategori: "OBJECTION", sumber: "Follow-up sales call",
    kutipan: "\"Kami sudah pakai konsultan lama kami, dia udah kenal sistem kami — nggak mau ganti\"",
    terjemahan: "Loyalitas pada konsultan lama menjadi hambatan switching meskipun hasilnya tidak optimal",
    segment: "BUJK Menengah dengan konsultan tetap", frekuensi: 6,
    peluangLayanan: "Tawarkan sebagai layanan komplementer, bukan pengganti: platform + konsultan lama = lebih kuat",
  },
  {
    id: "v16", kategori: "FEAR", sumber: "Grup Telegram Kontraktor Nasional",
    kutipan: "\"Takut data perusahaan kita — dokumen SBU, laporan keuangan — bocor kalau pakai platform digital\"",
    terjemahan: "BUJK ragu menggunakan platform digital karena kekhawatiran keamanan data sensitif",
    segment: "BUJK konservatif semua ukuran", frekuensi: 7,
    peluangLayanan: "Komunikasi keamanan data: enkripsi end-to-end, akses terbatas, audit trail + sertifikasi ISO 27001",
  },
  {
    id: "v17", kategori: "PAIN", sumber: "Workshop GAPENSI & AKKI regional",
    kutipan: "\"Kontraktor lokal daerah kita nggak punya akses konsultan SBU yang beneran ngerti — semuanya di Jakarta\"",
    terjemahan: "BUJK di luar Jawa kesulitan mendapat layanan konsultan SBU/SKK berkualitas di daerahnya",
    segment: "Kontraktor regional luar Jawa", frekuensi: 8,
    peluangLayanan: "Layanan remote consulting + e-learning SKK regional dengan modul lokal",
  },
  {
    id: "v18", kategori: "DESIRE", sumber: "Webinar online PUPR konstruksi",
    kutipan: "\"Seandainya ada dashboard yang ngasih tahu satu platform semua deadline SBU, SKK, dan tender — hidup saya lebih tenang\"",
    terjemahan: "BUJK menginginkan satu platform terpadu untuk monitoring semua kewajiban konstruksi",
    segment: "Direktur/PJBU aktif tender", frekuensi: 9,
    peluangLayanan: "Intel-Konstruksi sebagai central compliance dashboard: SBU, SKK, tender, regulasi dalam 1 platform",
  },
  {
    id: "v19", kategori: "OBJECTION", sumber: "Demo sales platform digital",
    kutipan: "\"Kita bisnis konstruksi, bukan IT — buat apa pakai software segala? Excel saja sudah cukup\"",
    terjemahan: "BUJK tradisional menolak adopsi platform digital karena kebiasaan kerja manual",
    segment: "BUJK generasi pertama / founder-run", frekuensi: 7,
    peluangLayanan: "Reframe: bukan software rumit — tapi asisten di WhatsApp yang otomatis reminder deadline SBU/SKK",
  },
  {
    id: "v20", kategori: "TRIGGER", sumber: "Berita konstruksi / media PUPR",
    kutipan: "\"Setelah regulasi SMAP 2023, tim kita panik karena belum ada yang tahu harus mulai dari mana dan berapa biayanya\"",
    terjemahan: "Terbitnya regulasi baru membuat BUJK panik dan mencari bantuan implementasi segera",
    segment: "BUJK Menengah wajib SMAP", frekuensi: 9,
    peluangLayanan: "Webinar regulasi baru + paket implementasi express + template dokumen siap pakai",
  },
  {
    id: "v21", kategori: "PAIN", sumber: "Forum Kontraktor Daerah / Telegram",
    kutipan: "\"Sudah punya BIM tapi nggak bisa klaim di tender karena SKK Digital Konstruksi belum ada\"",
    terjemahan: "BUJK yang sudah investasi BIM tidak bisa memanfaatkannya karena belum memiliki SKK Digital Konstruksi yang diakui LPJK",
    segment: "Konsultan & Kontraktor Menengah", frekuensi: 6,
    peluangLayanan: "Pendampingan SKK BIM + sertifikasi kompetensi digital konstruksi + gap analysis",
  },
  {
    id: "v22", kategori: "FEAR", sumber: "Group Telegram GAPENSI Jawa Timur",
    kutipan: "\"Material kita TKDN-nya belum terverifikasi, takut dokumen penawaran digugurkan panitia\"",
    terjemahan: "BUJK takut gugur dalam evaluasi tender karena tidak bisa membuktikan nilai TKDN material yang digunakan",
    segment: "Kontraktor Menengah", frekuensi: 7,
    peluangLayanan: "Layanan verifikasi TKDN + penyusunan BOM dengan dokumen pendukung KEMENPERIN",
  },
  {
    id: "v23", kategori: "DESIRE", sumber: "Wawancara prospek klien Surabaya",
    kutipan: "\"Mau tahu kondisi keuangan proyek real-time, bukan nunggu laporan akhir bulan yang sudah basi\"",
    terjemahan: "Direktur proyek menginginkan dashboard cashflow dan monitoring pembayaran secara real-time",
    segment: "BUJK Menengah-Besar multi-proyek", frekuensi: 7,
    peluangLayanan: "Jasa Monitoring Keuangan Proyek + alert keterlambatan pembayaran + cashflow forecast",
  },
];

// ─── Market demand heatmap data ────────────────────────────────────────────────

const DEMAND_HEATMAP = [
  { domain: "SBU & Perizinan", demand: 95, growth: "+12%", topPain: "Expiry tidak terdeteksi" },
  { domain: "SMAP / ISO 37001", demand: 88, growth: "+35%", topPain: "Tidak tahu cara comply" },
  { domain: "Tender & Pengadaan", demand: 82, growth: "+8%", topPain: "Gugur di administrasi" },
  { domain: "SKK Konstruksi", demand: 78, growth: "+22%", topPain: "SKK tidak tersedia saat dibutuhkan" },
  { domain: "Strategi Bid Tender", demand: 72, growth: "+18%", topPain: "Tidak punya data kompetitor" },
  { domain: "Pendampingan IKN", demand: 68, growth: "+85%", topPain: "Tidak memahami syarat kualifikasi IKN" },
  { domain: "ISO 9001 / 14001", demand: 60, growth: "+5%", topPain: "Biaya implementasi mahal" },
  { domain: "SMK3 / K3 Konstruksi", demand: 55, growth: "+10%", topPain: "SOP K3 tidak memenuhi standar" },
  { domain: "Keuangan Konstruksi", demand: 74, growth: "+27%", topPain: "Cash flow negatif akibat keterlambatan bayar" },
  { domain: "Digital Transformation", demand: 51, growth: "+42%", topPain: "Tidak tahu tools digital yang tepat untuk BUJK" },
  { domain: "Compliance & Audit", demand: 66, growth: "+31%", topPain: "Tidak siap menghadapi audit BPK/BPKP" },
  { domain: "Pendampingan BUJK Regional", demand: 45, growth: "+58%", topPain: "Tidak ada konsultan berkualitas di daerah" },
  { domain: "BIM & Digitalisasi Proyek", demand: 39, growth: "+73%", topPain: "Tidak ada SDM BIM + biaya software mahal" },
  { domain: "TKDN & Produk Dalam Negeri", demand: 44, growth: "+40%", topPain: "Tidak tahu cara verifikasi TKDN dengan benar" },
];

// ─── Buying triggers ────────────────────────────────────────────────────────────

const BUYING_TRIGGERS = [
  { trigger: "SBU hampir expired", urgency: "KRITIS", frekuensi: 9, channel: "Direct outreach + WhatsApp" },
  { trigger: "Masuk daftar SMAP non-comply LPJK", urgency: "KRITIS", frekuensi: 8, channel: "Email + telepon" },
  { trigger: "Gagal tender karena SKK kurang", urgency: "TINGGI", frekuensi: 8, channel: "Follow-up post-failure" },
  { trigger: "Ada peluang tender besar masuk (IKN, BUMN)", urgency: "TINGGI", frekuensi: 7, channel: "LPSE alert + konten edukatif" },
  { trigger: "Dapat surat peringatan dari LPJK/kementerian", urgency: "KRITIS", frekuensi: 9, channel: "Emergency response offer" },
  { trigger: "Perusahaan baru berdiri (butuh SBU pertama)", urgency: "SEDANG", frekuensi: 6, channel: "SEO + marketplace + referral" },
  { trigger: "Kalah tender 2-3 kali berturut", urgency: "TINGGI", frekuensi: 7, channel: "Audit offer + testimonial" },
  { trigger: "Naik grade ke BUJK Menengah/Besar", urgency: "SEDANG", frekuensi: 5, channel: "Upgrade journey content" },
  { trigger: "Perpres/Permen konstruksi baru terbit", urgency: "TINGGI", frekuensi: 7, channel: "Email regulasi alert + webinar" },
  { trigger: "Audit BPK / BPKP atas proyek pemerintah", urgency: "KRITIS", frekuensi: 6, channel: "Emergency consultation offer" },
  { trigger: "Tagihan subkontraktor macet / sengketa kontrak", urgency: "TINGGI", frekuensi: 6, channel: "Legal advisory + cash flow tool offer" },
  { trigger: "Tender IKN batch baru diumumkan pemerintah", urgency: "TINGGI", frekuensi: 8, channel: "IKN readiness briefing + eligibility check" },
  { trigger: "Perusahaan baru masuk daftar wajib SMAP LPJK", urgency: "KRITIS", frekuensi: 8, channel: "Direct call + emergency SMAP offer" },
  { trigger: "SBU diperpanjang tapi SKK pendukung tidak updated", urgency: "TINGGI", frekuensi: 7, channel: "Cross-sell SKK update setelah handle SBU" },
  { trigger: "Kontraktor lokal menang tender BUMN pertama kali", urgency: "TINGGI", frekuensi: 6, channel: "Upgrade layanan: SMAP + ISO + advisory" },
  { trigger: "Material proyek belum diverifikasi TKDN oleh panitia", urgency: "KRITIS", frekuensi: 8, channel: "TKDN verifikasi express + konsultasi darurat" },
  { trigger: "Proyek skala >Rp 100M diwajibkan pakai BIM oleh PUPR", urgency: "TINGGI", frekuensi: 7, channel: "Workshop BIM + pendampingan implementasi" },
  { trigger: "Direktur baru / pergantian manajemen BUJK", urgency: "SEDANG", frekuensi: 5, channel: "Fresh audit offer + re-engagement" },
  { trigger: "Proyek berhenti karena cashflow macet — owner terlambat bayar", urgency: "KRITIS", frekuensi: 7, channel: "Emergency financing consultation + escrow advisory" },
  { trigger: "Perusahaan dapat proyek tapi SDM tidak cukup bersertifikat", urgency: "TINGGI", frekuensi: 7, channel: "SKK fast-track + outsourcing tenaga ahli" },
  { trigger: "BIM diwajibkan tapi tim belum punya kompetensi", urgency: "SEDANG", frekuensi: 5, channel: "Training BIM + SKK digital konstruksi" },
];

const VOC_ICON: Record<string, React.ElementType> = {
  PAIN: TriangleAlert, FEAR: ShieldAlert, DESIRE: Heart,
  OBJECTION: MessageSquare, TRIGGER: Zap,
};
const VOC_COLOR: Record<string, string> = {
  PAIN: "border-red-200 bg-red-50/30",
  FEAR: "border-orange-200 bg-orange-50/30",
  DESIRE: "border-green-200 bg-green-50/30",
  OBJECTION: "border-blue-200 bg-blue-50/30",
  TRIGGER: "border-yellow-200 bg-yellow-50/30",
};
const VOC_BADGE: Record<string, string> = {
  PAIN: "bg-red-100 text-red-700 border-red-300",
  FEAR: "bg-orange-100 text-orange-700 border-orange-300",
  DESIRE: "bg-green-100 text-green-700 border-green-300",
  OBJECTION: "bg-blue-100 text-blue-700 border-blue-300",
  TRIGGER: "bg-yellow-100 text-yellow-700 border-yellow-300",
};
const URGENCY_BADGE: Record<string, string> = {
  Kritis: "bg-red-100 text-red-700", Tinggi: "bg-orange-100 text-orange-700",
  Sedang: "bg-yellow-100 text-yellow-700",
};

// ─── Radar Akreditasi data (BAN-PT & BAN S/M — dikurasi manual, per 3 Agustus 2026) ─

interface InstitusiAkreditasi {
  id: string;
  nama: string;
  jenis: "PT" | "SMA" | "SMK";
  kota: string;
  provinsi: string;
  akreditasiSaat: string; // nilai akreditasi sekarang, misal "A", "B", "Baik Sekali"
  tanggalBerakhir: string; // ISO date
  sisaHari: number;
  badanAkreditasi: "BAN-PT" | "BAN S/M";
  catatan: string;
}

// Baseline: 3 Agustus 2026. Semua expiry dalam 6 bulan (≤ 3 Feb 2027).
const AKREDITASI_DATA: InstitusiAkreditasi[] = [
  {
    id: "a1", nama: "Universitas Pembangunan Nasional 'Veteran' Jakarta",
    jenis: "PT", kota: "Jakarta Selatan", provinsi: "DKI Jakarta",
    akreditasiSaat: "B", tanggalBerakhir: "2026-09-14", sisaHari: 42,
    badanAkreditasi: "BAN-PT",
    catatan: "Program Teknik Sipil & Arsitektur perlu perbaikan lab dan ruang praktik sebelum asesmen.",
  },
  {
    id: "a2", nama: "SMK Negeri 5 Surabaya",
    jenis: "SMK", kota: "Surabaya", provinsi: "Jawa Timur",
    akreditasiSaat: "B", tanggalBerakhir: "2026-09-30", sisaHari: 58,
    badanAkreditasi: "BAN S/M",
    catatan: "Jurusan Teknik Konstruksi & Properti — bengkel kerja bata dan plesteran belum memenuhi standar sarana.",
  },
  {
    id: "a3", nama: "SMA Negeri 3 Bandung",
    jenis: "SMA", kota: "Bandung", provinsi: "Jawa Barat",
    akreditasiSaat: "A", tanggalBerakhir: "2026-10-15", sisaHari: 73,
    badanAkreditasi: "BAN S/M",
    catatan: "Mempertahankan Akreditasi A — perlu renovasi gedung laboratorium dan ruang perpustakaan.",
  },
  {
    id: "a4", nama: "Politeknik Negeri Bandung",
    jenis: "PT", kota: "Bandung", provinsi: "Jawa Barat",
    akreditasiSaat: "A", tanggalBerakhir: "2026-10-31", sisaHari: 89,
    badanAkreditasi: "BAN-PT",
    catatan: "Program D4 Teknik Konstruksi Gedung — standar ruang studio dan alat ukur perlu diperbarui.",
  },
  {
    id: "a5", nama: "SMK Bina Karya Jakarta",
    jenis: "SMK", kota: "Jakarta Timur", provinsi: "DKI Jakarta",
    akreditasiSaat: "C", tanggalBerakhir: "2026-11-10", sisaHari: 99,
    badanAkreditasi: "BAN S/M",
    catatan: "Target naik ke B — perlu pembangunan ruang praktik baru untuk program Konstruksi & Utilitas Gedung.",
  },
  {
    id: "a6", nama: "Institut Teknologi Kalimantan",
    jenis: "PT", kota: "Balikpapan", provinsi: "Kalimantan Timur",
    akreditasiSaat: "B", tanggalBerakhir: "2026-11-20", sisaHari: 109,
    badanAkreditasi: "BAN-PT",
    catatan: "Dekat IKN — Prodi Teknik Sipil dan Perencanaan Wilayah akan diasesmen; target A untuk mendukung proyek IKN.",
  },
  {
    id: "a7", nama: "STMIK Amikom Yogyakarta",
    jenis: "PT", kota: "Yogyakarta", provinsi: "D.I. Yogyakarta",
    akreditasiSaat: "B", tanggalBerakhir: "2026-12-05", sisaHari: 124,
    badanAkreditasi: "BAN-PT",
    catatan: "Penambahan gedung rektorat dan ruang kelas ber-AC diperlukan sebelum jadwal visitasi asesor.",
  },
  {
    id: "a8", nama: "Universitas Muhammadiyah Surabaya",
    jenis: "PT", kota: "Surabaya", provinsi: "Jawa Timur",
    akreditasiSaat: "B", tanggalBerakhir: "2026-12-28", sisaHari: 147,
    badanAkreditasi: "BAN-PT",
    catatan: "Prodi Teknik Sipil dan Teknik Mesin — perlu penambahan kapasitas laboratorium material bangunan.",
  },
  {
    id: "a9", nama: "SMA Muhammadiyah 1 Yogyakarta",
    jenis: "SMA", kota: "Yogyakarta", provinsi: "D.I. Yogyakarta",
    akreditasiSaat: "A", tanggalBerakhir: "2027-01-08", sisaHari: 158,
    badanAkreditasi: "BAN S/M",
    catatan: "Mempertahankan Akreditasi Unggul — renovasi toilet, kelas, dan pagar perimeter masuk rencana asesmen.",
  },
  {
    id: "a10", nama: "SMK Negeri 2 Makassar",
    jenis: "SMK", kota: "Makassar", provinsi: "Sulawesi Selatan",
    akreditasiSaat: "B", tanggalBerakhir: "2027-01-25", sisaHari: 175,
    badanAkreditasi: "BAN S/M",
    catatan: "Program Desain Pemodelan dan Informasi Bangunan — perlu ruang komputer BIM dan renovasi workshop.",
  },
];

// ─── Radar Akreditasi Tab Component ──────────────────────────────────────────

const JENIS_BADGE: Record<string, string> = {
  PT:  "bg-blue-100 text-blue-700 border-blue-300",
  SMA: "bg-violet-100 text-violet-700 border-violet-300",
  SMK: "bg-orange-100 text-orange-700 border-orange-300",
};
const JENIS_ICON: Record<string, React.ElementType> = {
  PT: GraduationCap, SMA: School, SMK: School,
};

function buildWaUrl(inst: InstitusiAkreditasi) {
  const pesan =
    `Halo, perkenalkan kami dari PT Maheswara Jaya Persada (MJP).\n\n` +
    `Kami melihat ${inst.nama} (${inst.kota}) dijadwalkan mengikuti akreditasi ulang ${inst.badanAkreditasi} ` +
    `pada sekitar ${new Date(inst.tanggalBerakhir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.\n\n` +
    `MJP memiliki layanan konstruksi & renovasi yang dapat membantu memenuhi standar sarana-prasarana sebelum asesor tiba — ` +
    `termasuk renovasi ruang kelas, laboratorium, toilet, dan infrastruktur pendukung.\n\n` +
    `Apakah bisa kami jadwalkan diskusi singkat 15–20 menit?\n\n` +
    `Terima kasih 🙏`;
  return `https://wa.me/?text=${encodeURIComponent(pesan)}`;
}

const AKREDITASI_CONTACTED_KEY = "mkp-akreditasi-contacted";

function AkreditasiTab() {
  const [filterJenis, setFilterJenis] = useState<string>("SEMUA");
  // Task #137: track contacted status (id → ISO date string)
  const [kontakAkr, setKontakAkr] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(AKREDITASI_CONTACTED_KEY) ?? "{}"); } catch { return {}; }
  });
  useEffect(() => { document.title = "Sinyal Pasar — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    try { localStorage.setItem(AKREDITASI_CONTACTED_KEY, JSON.stringify(kontakAkr)); } catch { /* ignore */ }
  }, [kontakAkr]);
  const toggleKontakAkr = useCallback((id: string) => {
    setKontakAkr((prev) => {
      if (prev[id]) { const next = { ...prev }; delete next[id]; return next; }
      return { ...prev, [id]: new Date().toISOString() };
    });
  }, []);

  const sorted = [...AKREDITASI_DATA].sort((a, b) => a.sisaHari - b.sisaHari);
  const filtered = filterJenis === "SEMUA" ? sorted : sorted.filter((i) => i.jenis === filterJenis);

  const mendesak = sorted.filter((i) => i.sisaHari <= 60).length;
  const segera   = sorted.filter((i) => i.sisaHari > 60 && i.sisaHari <= 90).length;
  const bulan3   = sorted.filter((i) => i.sisaHari > 90 && i.sisaHari <= 120).length;
  const bulan6   = sorted.filter((i) => i.sisaHari > 120).length;

  function urgencyBadge(sisa: number) {
    if (sisa <= 60)  return { label: "MENDESAK",   cls: "bg-red-100 text-red-700 border-red-300" };
    if (sisa <= 90)  return { label: "SEGERA",     cls: "bg-orange-100 text-orange-700 border-orange-300" };
    if (sisa <= 120) return { label: "3 BULAN",    cls: "bg-yellow-100 text-yellow-700 border-yellow-300" };
    return               { label: "6 BULAN",    cls: "bg-slate-100 text-slate-600 border-slate-300" };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header info */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 text-primary" /> RADAR AKREDITASI — Pipeline Prospek Segmen Pendidikan (BAN-PT & BAN S/M)
          {(() => {
            const uncontacted = AKREDITASI_DATA.filter(i => !kontakAkr[i.id]).length;
            return uncontacted > 0 ? (
              <span className="ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
                {uncontacted} belum dihubungi
              </span>
            ) : (
              <span className="ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                Semua dihubungi ✓
              </span>
            );
          })()}
        </p>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Institusi yang masa akreditasinya berakhir dalam <span className="font-semibold text-foreground">6 bulan ke depan</span> adalah
          prospek terpanas di segmen pendidikan — mereka wajib memenuhi standar sarana sebelum asesor BAN datang. Pendekatan
          3–4 bulan sebelum deadline memberi MJP keunggulan kompetitif signifikan.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "≤ 60 hari (Mendesak)", val: mendesak, c: "text-red-600",    bg: "bg-red-50 border-red-200" },
            { label: "≤ 90 hari (Segera)",   val: segera,   c: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
            { label: "≤ 120 hari",           val: bulan3,   c: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
            { label: "≤ 180 hari",           val: bulan6,   c: "text-slate-600",  bg: "bg-slate-50 border-slate-200" },
          ].map((s) => (
            <div key={s.label} className={`border rounded-sm p-3 ${s.bg} text-center`}>
              <p className={`text-2xl font-black font-mono leading-none ${s.c}`}>{s.val}</p>
              <p className="text-[9px] font-mono mt-0.5 text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter by type */}
      <div className="flex flex-wrap gap-2 items-center">
        {["SEMUA", "PT", "SMA", "SMK"].map((f) => (
          <button
            key={f}
            onClick={() => setFilterJenis(f)}
            aria-pressed={filterJenis === f}
            className={cn(
              "px-3 py-1.5 text-xs rounded-sm border font-mono transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
              filterJenis === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f === "SEMUA" ? "Semua Jenis" : f}
          </button>
        ))}
        <span className="text-xs text-muted-foreground font-mono ml-1">{filtered.length < sorted.length ? `${filtered.length} dari ${sorted.length}` : filtered.length} institusi</span>
      </div>

      {/* Table */}
      <div className="border rounded-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="border-b bg-background sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                {["#", "Nama Institusi", "Jenis", "Kota", "Akreditasi Saat Ini", "Berakhir", "Sisa Hari", "Catatan Peluang", "Aksi"].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inst, i) => {
                const ub = urgencyBadge(inst.sisaHari);
                const Icon = JENIS_ICON[inst.jenis];
                const tgl = new Date(inst.tanggalBerakhir).toLocaleDateString("id-ID", {
                  day: "numeric", month: "short", year: "numeric",
                });
                return (
                  <tr key={inst.id} className="group border-b last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2.5 text-muted-foreground font-mono">{i + 1}</td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <p className="font-semibold text-[11px] leading-snug truncate" title={inst.nama}>{inst.nama}</p>
                      <p className="text-[9px] text-muted-foreground font-mono mt-0.5 truncate" title={`${inst.badanAkreditasi} · ${inst.provinsi}`}>{inst.badanAkreditasi} · {inst.provinsi}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border flex items-center gap-1 w-fit", JENIS_BADGE[inst.jenis])}>
                        <Icon className="h-2.5 w-2.5" />{inst.jenis}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px]">{inst.kota}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-muted rounded-sm">{inst.akreditasiSaat}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] whitespace-nowrap">{tgl}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm border", ub.cls)}>
                        {inst.sisaHari}h · {ub.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[220px]">
                      <p className="text-[9px] text-muted-foreground leading-snug">{inst.catatan}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className={cn("flex flex-col gap-1.5 min-w-[130px] transition-opacity", kontakAkr[inst.id] ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                        <a
                          href={buildWaUrl(inst)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-semibold bg-emerald-600 text-white rounded-sm hover:bg-emerald-700 transition-colors whitespace-nowrap w-fit"
                        >
                          <MessageCircle className="h-3 w-3" />
                          Hubungi via WA
                        </a>
                        <button
                          onClick={() => toggleKontakAkr(inst.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-semibold rounded-sm border transition-colors whitespace-nowrap w-fit",
                            kontakAkr[inst.id]
                              ? "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          <CircleCheck className="h-3 w-3" />
                          <span className="whitespace-nowrap">{kontakAkr[inst.id]
                            ? new Date(kontakAkr[inst.id]).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
                            : "Tandai Dihubungi"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* How to use */}
      <div className="border rounded-sm p-4 bg-amber-50/30 border-amber-200">
        <p className="text-[10px] font-mono font-semibold text-amber-700 uppercase mb-2 flex items-center gap-1.5">
          <Radar className="h-3.5 w-3.5" /> CARA MENGGUNAKAN RADAR AKREDITASI
        </p>
        <ol className="flex flex-col gap-1.5">
          {[
            "Prioritaskan institusi dengan sisa ≤ 60 hari — hubungi hari ini sebelum kompetitor masuk.",
            "Gunakan tombol 'Hubungi via WA' — pesan sudah disiapkan dengan konteks akreditasi dan penawaran layanan MJP.",
            "Tawarkan survei kondisi sarana gratis sebagai pintu masuk — institusi yang akan diases sangat membutuhkan baseline data.",
            "Sumber fase 2: BAN-PT (banpt.or.id) dan BAN S/M (bansm.kemdikbud.go.id) menyediakan jadwal akreditasi publik — jadwalkan crawl otomatis setiap bulan.",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-[10px] text-amber-800">
              <span className="font-mono font-bold shrink-0">{i + 1}.</span>
              <span>{tip}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Data source note */}
      <p className="text-[9px] font-mono text-muted-foreground text-center">
        Data dikurasi manual dari informasi publik BAN-PT & BAN S/M · Baseline: 3 Agustus 2026 ·
        Fase 2: jadwalkan crawler otomatis untuk update bulanan
      </p>
    </div>
  );
}

type Tab = "voc" | "heatmap" | "trigger" | "live" | "akreditasi";

export default function SinyalPasar() {
  const queryClient = useQueryClient();
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [tab, setTab] = useState<Tab>("voc");
  const [vocFilter, setVocFilter] = useState<string>("SEMUA");
  const [vocSearch, setVocSearch] = useState<string>("");
  const deferredVocSearch = useDeferredValue(vocSearch);
  const vocSearchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      const _t = (e.target as HTMLElement); if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && _t.tagName !== "INPUT" && _t.tagName !== "TEXTAREA" && _t.tagName !== "SELECT" && !_t.isContentEditable) { e.preventDefault(); vocSearchRef.current?.focus(); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  const [vocSortFreq, setVocSortFreq] = useState(false);
  const [vocSortScore, setVocSortScore] = useState(false);
  const [vocSortNotes, setVocSortNotes] = useState(false);
  const [vocPinned, setVocPinned] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("mkp-voc-pinned") ?? "[]") as string[]); } catch { return new Set(); }
  });
  const toggleVocPin = (id: string) => setVocPinned(prev => {
    const next = new Set(prev);
    const wasPin = next.has(id);
    if (wasPin) next.delete(id); else next.add(id);
    try { localStorage.setItem("mkp-voc-pinned", JSON.stringify([...next])); } catch { /* ignore */ }
    toast.success(wasPin ? "Pin VOC dilepas" : "Sinyal VOC dipin", { duration: 1500 });
    return next;
  });
  const [showVocPinnedOnly, setShowVocPinnedOnly] = useState(false);
  const [showVocWithNotesOnly, setShowVocWithNotesOnly] = useState(false);
  const [confirmClearNotes, setConfirmClearNotes] = useState(false);
  const [heatmapNotes, setHeatmapNotes] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-heatmap-notes") ?? "{}") as Record<number, string>; } catch { return {}; }
  });
  const [savedHeatmapNoteIdx, setSavedHeatmapNoteIdx] = useState<number | null>(null);
  const updateHeatmapNote = (idx: number, val: string) => setHeatmapNotes(prev => {
    const next = { ...prev, [idx]: val };
    try { localStorage.setItem("mkp-heatmap-notes", JSON.stringify(next)); } catch { /* ignore */ }
    setSavedHeatmapNoteIdx(idx);
    setTimeout(() => setSavedHeatmapNoteIdx(s => s === idx ? null : s), 2000);
    return next;
  });
  const [vocNotes, setVocNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("mkp-voc-notes") ?? "{}") as Record<string, string>; } catch { return {}; }
  });
  const [savedVocNoteId, setSavedVocNoteId] = useState<string | null>(null);
  const savedVocNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateVocNote = (id: string, val: string) => setVocNotes(prev => {
    const next = { ...prev, [id]: val };
    try { localStorage.setItem("mkp-voc-notes", JSON.stringify(next)); } catch { /* ignore */ }
    if (savedVocNoteTimer.current) clearTimeout(savedVocNoteTimer.current);
    setSavedVocNoteId(id);
    savedVocNoteTimer.current = setTimeout(() => setSavedVocNoteId(null), 2000);
    return next;
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: painPoints } = useListPainPoints();
  const { data: trends } = useGetTrendingTopics({ limit: 12 }, { query: { queryKey: getGetTrendingTopicsQueryKey({ limit: 12 }) } });
  const { data: researchItems } = useListResearchItems();
  const { data: summary } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  const filteredVOC = useMemo(() => {
    let base = VOC_SIGNALS.filter((v) => {
      if (vocFilter !== "SEMUA" && v.kategori !== vocFilter) return false;
      if (deferredVocSearch) {
        const q = deferredVocSearch.toLowerCase();
        return (
          v.kutipan.toLowerCase().includes(q) ||
          v.terjemahan.toLowerCase().includes(q) ||
          v.peluangLayanan.toLowerCase().includes(q) ||
          v.segment.toLowerCase().includes(q) ||
          v.sumber.toLowerCase().includes(q) ||
          (vocNotes[v.id] ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
    if (showVocPinnedOnly) base = base.filter(v => vocPinned.has(v.id));
    if (showVocWithNotesOnly) base = base.filter(v => !!(vocNotes[v.id] ?? "").trim());
    if (vocSortNotes) return [...base].sort((a, b) => ((vocNotes[b.id] ?? "").trim() ? 1 : 0) - ((vocNotes[a.id] ?? "").trim() ? 1 : 0));
    if (vocSortFreq) return [...base].sort((a, b) => b.frekuensi - a.frekuensi);
    if (vocSortScore) return [...base].sort((a, b) => b.frekuensi - a.frekuensi || a.kutipan.localeCompare(b.kutipan));
    return base;
  }, [vocFilter, deferredVocSearch, vocSortFreq, vocSortScore, vocSortNotes, showVocPinnedOnly, vocPinned, vocNotes, showVocWithNotesOnly]);

  // Derive market signals from live data — strict junk filter
  const JUNK_MARKET_KW = ["slot", "casino", "togel", "judi", "gacor", "porn", "sex", "4d", "3d", "maxwin", "bet "];
  const VALID_MARKET_KW = ["tender", "sbu", "skk", "konstruksi", "kontraktor", "bujk", "lpjk", "lpse", "pengadaan", "pasar jasa", "industri konstruksi", "proyek infrastruktur", "ikn", "sertifikasi", "regulasi pupr"];

  const liveSignals = useMemo(() => {
    const items = researchItems ?? [];
    return items
      .filter((r) => {
        const title = (r.title ?? "").toLowerCase();
        const summary = (r.summary ?? "").toLowerCase();
        const cat = (r.category ?? "").toUpperCase();
        if (JUNK_MARKET_KW.some((k) => title.includes(k) || summary.includes(k))) return false;
        const hasValidCat = ["OPPORTUNITY", "TREND", "MARKET", "SOSMED", "TENDER", "REGULASI"].some((k) => cat.includes(k));
        const hasValidKw = VALID_MARKET_KW.some((k) => title.includes(k) || summary.includes(k));
        return hasValidCat || hasValidKw;
      })
      .slice(0, 8);
  }, [researchItems]);

  // Top pain points as market demand signals
  const topPains = useMemo(() => (painPoints ?? []).filter((p) => (p.painScore ?? 0) >= 8).slice(0, 8), [painPoints]);

  const vocStats = {
    pain: VOC_SIGNALS.filter((v) => v.kategori === "PAIN").length,
    fear: VOC_SIGNALS.filter((v) => v.kategori === "FEAR").length,
    desire: VOC_SIGNALS.filter((v) => v.kategori === "DESIRE").length,
    trigger: VOC_SIGNALS.filter((v) => v.kategori === "TRIGGER").length,
    avgFrek: (VOC_SIGNALS.reduce((s, v) => s + v.frekuensi, 0) / VOC_SIGNALS.length).toFixed(1),
  };

  const vocNewCount = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return (painPoints ?? []).filter(p => p.createdAt && new Date(p.createdAt).getTime() > cutoff).length;
  }, [painPoints]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "voc", label: vocNewCount > 0 ? `Voice of Customer (${vocNewCount} baru)` : "Voice of Customer", icon: Mic },
    { id: "heatmap", label: `Heatmap Permintaan (${DEMAND_HEATMAP.length})`, icon: ChartBar },
    { id: "trigger", label: `Buying Triggers (${BUYING_TRIGGERS.length})`, icon: Zap },
    { id: "live", label: liveSignals.length > 0 ? `Sinyal Live (${liveSignals.length + (trends ?? []).length})` : "Sinyal Live", icon: Activity },
    { id: "akreditasi", label: "Radar Akreditasi", icon: GraduationCap },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Sinyal Pasar — Market & Customer Intelligence
        </h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-2">
          Voice of Customer · demand heatmap · buying triggers · peluang dari celah pasar
          {vocPinned.size > 0 && (
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300">
              {vocPinned.size} sinyal dipin
            </span>
          )}
          {(Object.values(vocNotes).filter(v => v?.trim()).length + Object.values(heatmapNotes).filter(v => v?.trim()).length) > 0 && (
            <button
              onClick={() => setShowVocWithNotesOnly(v => !v)}
              aria-pressed={showVocWithNotesOnly}
              className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showVocWithNotesOnly ? "bg-blue-500 text-white border-blue-500" : "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200")}
              title="Filter sinyal VOC dengan catatan"
            >
              {Object.values(vocNotes).filter(v => v?.trim()).length + Object.values(heatmapNotes).filter(v => v?.trim()).length} catatan
            </button>
          )}
        </p>
      </div>

      {/* Top-3 VOC Segments quick summary */}
      {(() => {
        const segmentMap: Record<string, number> = {};
        VOC_SIGNALS.forEach(v => {
          v.segment.split(/[,/]/).map(s => s.trim()).filter(Boolean).forEach(s => {
            segmentMap[s] = (segmentMap[s] ?? 0) + v.frekuensi;
          });
        });
        const top3 = Object.entries(segmentMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        if (top3.length === 0) return null;
        const medals = ["🥇", "🥈", "🥉"];
        const colors = ["bg-red-50 border-red-200 text-red-700", "bg-orange-50 border-orange-200 text-orange-700", "bg-amber-50 border-amber-200 text-amber-700"];
        return (
          <div className="flex gap-2 flex-wrap">
            {top3.map(([seg, score], i) => (
              <div key={seg} className={`flex items-center gap-2 border rounded-sm px-3 py-1.5 text-[10px] font-mono font-semibold ${colors[i]}`}>
                <span>{medals[i]}</span>
                <span>{seg}</span>
                <span className="opacity-60">⚡{score}</span>
              </div>
            ))}
            <span className="text-[9px] font-mono text-muted-foreground self-center ml-1">— Segmen VOC teratas berdasarkan frekuensi sinyal</span>
          </div>
        );
      })()}

      {/* Knowledge Sources Bar */}
      <KnowledgeSourcesBar pageKey="sinyal-pasar" />

      {/* Market Intelligence Quick-Read */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> MARKET INTELLIGENCE QUICK-READ — Kondisi Pasar Konstruksi Indonesia
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { signal: "APBN Infrastruktur 2026", value: "Rp 400T+", trend: "↑", desc: "Alokasi APBN tertinggi sepanjang sejarah · peluang tender masif", color: "border-l-4 border-l-blue-500" },
            { signal: "BUJK Aktif Terdaftar", value: "220.000+", trend: "→", desc: "Total BUJK terdaftar LPJK; hanya 40% aktif tender setiap tahun", color: "border-l-4 border-l-violet-500" },
            { signal: "Wajib SMAP Deadline", value: "2026 aktif", trend: "↑", desc: "Sanksi LPJK sudah berjalan — ribuan BUJK masih non-compliant", color: "border-l-4 border-l-red-500" },
            { signal: "Target TKDN Konstruksi", value: "≥40%", trend: "↑", desc: "SE LKPP 10/2024 wajibkan TKDN untuk proyek APBN — pasar baru", color: "border-l-4 border-l-orange-500" },
          ].map((s) => (
            <div key={s.signal} className={`${s.color} pl-3 py-2 border border-l-[3px] border-t-0 border-r-0 border-b-0 rounded-r-sm bg-muted/20`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-black font-mono leading-none">{s.value}</span>
                <span className="text-[10px] font-mono">{s.trend}</span>
              </div>
              <p className="text-[9px] font-mono font-semibold text-muted-foreground uppercase mb-0.5">{s.signal}</p>
              <p className="text-[9px] text-muted-foreground leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Signal Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> REVENUE SIGNAL VELOCITY — Kecepatan Sinyal Pasar Menjadi Revenue Konkret
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Sinyal", "Deteksi → Aksi", "Aksi → Proposal", "Proposal → Deal", "Total Lead Time", "Bottleneck Utama"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { sinyal: "SBU/SKK Expiry Alert", d2a: "< 1 jam", a2p: "4–8 jam", p2d: "3–7 hari", total: "4–8 hari", bottleneck: "Kecepatan tim follow-up WA", btColor: "text-orange-600" },
                { sinyal: "Regulasi Baru Terbit", d2a: "2–6 jam", a2p: "24–48 jam", p2d: "7–14 hari", total: "8–16 hari", bottleneck: "Produksi briefing & konten cepat", btColor: "text-orange-600" },
                { sinyal: "Tender Baru LPSE", d2a: "< 30 menit", a2p: "1–4 jam", p2d: "3–7 hari", total: "4–8 hari", bottleneck: "Analisis eligibilitas otomatis", btColor: "text-blue-600" },
                { sinyal: "Kompetitor Naikkan Harga", d2a: "24 jam", a2p: "24 jam", p2d: "5–10 hari", total: "6–11 hari", bottleneck: "Respons pricing & kampanye cepat", btColor: "text-red-600" },
                { sinyal: "Mass SMAP Deadline", d2a: "Otomatis scheduler", a2p: "24 jam", p2d: "7–21 hari", total: "8–22 hari", bottleneck: "Kapasitas tim sertifikasi", btColor: "text-red-600" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.sinyal}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-emerald-700">{r.d2a}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-blue-700">{r.a2p}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.p2d}</td>
                  <td className="px-3 py-2 font-mono font-bold text-[10px]">{r.total}</td>
                  <td className={`px-3 py-2 text-[10px] ${r.btColor}`}>{r.bottleneck}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Lead Time = estimasi dari analisis alur kerja tim intel MJP · Kurangi bottleneck untuk meningkatkan win rate 15–25%</p>
      </div>

      {/* Customer Segmentation Demand Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> SEGMENTASI DEMAND — Intensitas Kebutuhan per Segmen Klien
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[540px]">
            <thead>
              <tr className="border-b bg-muted/20 text-[9px] font-mono text-muted-foreground uppercase">
                <th className="text-left px-3 py-2">Segmen</th>
                <th className="text-center px-3 py-2">SBU/SMAP</th>
                <th className="text-center px-3 py-2">SKK</th>
                <th className="text-center px-3 py-2">Tender Intel</th>
                <th className="text-center px-3 py-2">TKDN</th>
                <th className="text-center px-3 py-2">BIM/Digital</th>
                <th className="text-center px-3 py-2">TAM Est.</th>
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "BUJK Kecil (Grade K1–K3)", sbu: 10, skk: 8, tender: 7, tkdn: 5, bim: 3, tam: "80K akun" },
                { seg: "BUJK Menengah (M1–M2)", sbu: 9, skk: 9, tender: 9, tkdn: 8, bim: 6, tam: "40K akun" },
                { seg: "BUJK Besar (B1–B2)", sbu: 7, skk: 8, tender: 7, tkdn: 9, bim: 9, tam: "15K akun" },
                { seg: "Konsultan Perencana", sbu: 8, skk: 9, tender: 8, tkdn: 6, bim: 8, tam: "25K akun" },
                { seg: "Tenaga Ahli Freelance", sbu: 5, skk: 10, tender: 4, tkdn: 3, bim: 5, tam: "120K orang" },
              ].map((row) => {
                const scores = [row.sbu, row.skk, row.tender, row.tkdn, row.bim];
                const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10;
                const color = (n: number) => n >= 9 ? "text-red-600 font-bold" : n >= 7 ? "text-orange-600 font-semibold" : n >= 5 ? "text-yellow-600" : "text-muted-foreground";
                return (
                  <tr key={row.seg} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-2 font-medium">{row.seg}</td>
                    {scores.map((s, i) => (
                      <td key={i} className={`px-3 py-2 text-center font-mono ${color(s)}`}>{s}/10</td>
                    ))}
                    <td className="px-3 py-2 text-center text-[10px] font-mono font-semibold text-emerald-600">{row.tam}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Nilai = intensitas kebutuhan 1–10 berdasarkan analisis VOC + pain points CPKB</p>
      </div>

      {/* Signal-to-Action Converter */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> SIGNAL-TO-ACTION CONVERTER — Sinyal Pasar Aktif → Tindakan Penjualan Hari Ini
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { sinyal: "SBU Kecil Expiry Wave", freq: "Setiap 3 tahun, puncak Q1 & Q3", hotness: 10, tindakan: "WA blast ke 50 kontak BUJK kecil yang SBU-nya expired ≤90 hari", cta: "Cari Prospek SBU", ctaColor: "bg-red-500 text-white", href: "/contractors" },
            { sinyal: "Tender APBN Q2 Puncak", freq: "Apr–Jun, tahunan", hotness: 9, tindakan: "Hubungi klien yang belum punya TKDN ≥40% sebelum deadline tender", cta: "Lihat Tender Aktif", ctaColor: "bg-orange-500 text-white", href: "/tenders" },
            { sinyal: "SMAP Enforcement Deadline", freq: "Des 2026 hard deadline", hotness: 9, tindakan: "Launch campaign SMAP express — paket 45 hari garansi sertifikasi", cta: "Buat Surat SMAP", ctaColor: "bg-orange-500 text-white", href: "/surat-penawaran?perihal=Penawaran+Layanan+SMAP+ISO+37001&services=smap-doc,sertif-bujkn" },
            { sinyal: "Regulasi PUPR BIM Baru", freq: "Berlaku per proyek >Rp 100M", hotness: 7, tindakan: "Jadwalkan webinar BIM readiness untuk 20 klien Menengah–Besar", cta: "Buka Workroom", ctaColor: "bg-blue-500 text-white", href: "/workroom" },
            { sinyal: "Kompetitor Naikkan Harga", freq: "Sporadis, monitor tiap minggu", hotness: 8, tindakan: "Update pricing page + kirim komparasi harga ke pipeline aktif", cta: "Radar Kompetitor", ctaColor: "bg-violet-500 text-white", href: "/kompetitor" },
            { sinyal: "SKK Jenjang 8 Mass Renewal", freq: "Rolling — monitor BNSP DB", hotness: 8, tindakan: "Identifikasi 30 tenaga ahli yang SKK-nya berakhir <6 bulan, follow-up", cta: "Cari Prospek SKK", ctaColor: "bg-emerald-600 text-white", href: "/skk" },
          ].map((r) => {
            const dotColor = r.hotness >= 9 ? "bg-red-500" : r.hotness >= 7 ? "bg-orange-500" : "bg-yellow-400";
            return (
              <div key={r.sinyal} className="border rounded-sm p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold leading-snug">{r.sinyal}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
                    <span className="text-[9px] font-mono font-bold">{r.hotness}/10</span>
                  </div>
                </div>
                <p className="text-[9px] font-mono text-muted-foreground">{r.freq}</p>
                <p className="text-[10px] leading-snug">{r.tindakan}</p>
                <a
                  href={r.href}
                  className={`text-[9px] font-mono font-bold text-center py-1 rounded-sm hover:opacity-90 transition-opacity ${r.ctaColor}`}
                >
                  {r.cta} →
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Competitive Signal Radar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-primary" /> COMPETITIVE SIGNAL RADAR — Pergeseran Posisi Kompetitor vs Peluang Anda
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Dimensi Kompetitif", "Kompetitor Umum", "Posisi Anda Saat Ini", "Celah Peluang", "Aksi Rekomendasi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { dim: "Kecepatan Pengurusan SBU", komp: "4–8 minggu", posisi: "Target 7 hari kerja", celah: "Express service", aksi: "SLA 7-hari sebagai USP utama", aksiColor: "text-emerald-700" },
                { dim: "Transparansi Biaya", komp: "Tidak transparan", posisi: "Harga tetap di awal", celah: "Trust & Pricing", aksi: "Publish rate card + progress tracker", aksiColor: "text-emerald-700" },
                { dim: "Monitoring Expiry", komp: "Manual / tidak ada", posisi: "Otomatis via platform", celah: "Digital advantage", aksi: "Upsell alert service ke klien aktif", aksiColor: "text-blue-700" },
                { dim: "TKDN Verification", komp: "Jarang ditawarkan", posisi: "Tersedia via KEMENPERIN", celah: "Diferensiasi", aksi: "Bundle TKDN + SBU dalam 1 paket", aksiColor: "text-emerald-700" },
                { dim: "Intelijen Tender", komp: "Tidak ada / manual", posisi: "Platform data real-time", celah: "Market intel", aksi: "Demo platform ke BUJK top-5 prospek", aksiColor: "text-primary" },
                { dim: "Pendampingan BIM", komp: "Konsultan mahal", posisi: "Mulai ditawarkan", celah: "Pertumbuhan 40%", aksi: "Rekrut BIM specialist, publish studi kasus", aksiColor: "text-orange-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.dim}</td>
                  <td className="px-3 py-2 text-red-600 font-mono text-[10px]">{r.komp}</td>
                  <td className="px-3 py-2 text-emerald-700 font-mono text-[10px] font-semibold">{r.posisi}</td>
                  <td className="px-3 py-2"><span className="text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-sm">{r.celah}</span></td>
                  <td className={`px-3 py-2 text-[10px] font-semibold ${r.aksiColor}`}>{r.aksi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Berdasarkan analisis VOC, pain points lapangan, dan riset kompetitor aktif · Update bulanan via tim riset</p>
      </div>

      {/* Market Opportunity Sizing */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartColumnBig className="h-3.5 w-3.5 text-primary" /> MARKET OPPORTUNITY SIZING — TAM × SAM × SOM per Sinyal Pasar
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Segmen Pasar", "TAM", "SAM (Jangkauan MJP)", "SOM 12 Bln", "Revenue/Unit", "Signal Driver"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "Sertifikasi SBU/SMAP", tam: "200K BUJK", sam: "50K BUJK aktif", som: "2.500 klien", rev: "Rp 4–22jt", signal: "SBU expiry + SMAP mandatory", somColor: "text-emerald-700" },
                { seg: "SKK Tenaga Ahli", tam: "500K ahli", sam: "80K perlu upgrade", som: "4.000 orang", rev: "Rp 3–10jt", signal: "SKK renewal rolling", somColor: "text-emerald-700" },
                { seg: "Tender Intelligence", tam: "100K tender/thn", sam: "30K tender terjangkau", som: "300 klien sub", rev: "Rp 3jt/bln", signal: "Peak Q2–Q3 APBN", somColor: "text-blue-700" },
                { seg: "Advisory TKDN", tam: "50K proyek APBN", sam: "15K proyek eligible", som: "300 proyek", rev: "Rp 2.5–4.5jt", signal: "SE LKPP enforcement", somColor: "text-blue-700" },
                { seg: "BIM Readiness", tam: "30K proyek >Rp 100M", sam: "10K belum BIM", som: "100 klien", rev: "Rp 3.5–9.5jt", signal: "Permen PUPR bertahap", somColor: "text-orange-700" },
              ].map((r, i) => (
                <tr key={i} className="group border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.seg}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.tam}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.sam}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[10px] ${r.somColor}`}>{r.som}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    <span className="inline-flex items-center gap-1 group/rev">{r.rev}<button onClick={() => void navigator.clipboard.writeText(r.rev).then(() => toast.success("Revenue disalin", { duration: 1200 }))} aria-label="Salin estimasi revenue" title="Salin" className="opacity-0 group-hover/rev:opacity-100 transition-all text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"><Copy className="h-2.5 w-2.5" /></button></span>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.signal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">TAM = Total Addressable Market · SAM = Serviceable · SOM = Realistic 12-month capture dengan tim & kapasitas saat ini</p>
      </div>

      {/* Demand Wave Forecast */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> DEMAND WAVE FORECAST — Prediksi Gelombang Permintaan Layanan 6 Bulan
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { bln: "Mar '26", sbu: 65, skk: 55, smap: 40, total: 160 },
            { bln: "Apr '26", sbu: 90, skk: 70, smap: 55, total: 215 },
            { bln: "Mei '26", sbu: 95, skk: 85, smap: 70, total: 250 },
            { bln: "Jun '26", sbu: 100, skk: 90, smap: 80, total: 270 },
            { bln: "Jul '26", sbu: 80, skk: 95, smap: 90, total: 265 },
            { bln: "Ags '26", sbu: 70, skk: 80, smap: 95, total: 245 },
          ].map((b) => {
            const maxTotal = 270;
            return (
              <div key={b.bln} className="border rounded-sm p-2 text-center">
                <p className="text-[9px] font-mono text-muted-foreground mb-1.5">{b.bln}</p>
                <div className="h-14 flex items-end gap-0.5 justify-center">
                  {[
                    { h: b.sbu, color: "bg-blue-500", label: "SBU" },
                    { h: b.skk, color: "bg-violet-500", label: "SKK" },
                    { h: b.smap, color: "bg-orange-500", label: "SMAP" },
                  ].map((seg) => (
                    <div key={seg.label} className={`flex-1 ${seg.color} rounded-t-sm`} style={{ height: `${seg.h}%` }} title={seg.label} />
                  ))}
                </div>
                <p className="text-[9px] font-mono font-bold text-primary mt-1">{b.total}</p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-2">
          {[{ c: "bg-blue-500", l: "SBU/SMAP" }, { c: "bg-violet-500", l: "SKK" }, { c: "bg-orange-500", l: "SMAP" }].map(l => (
            <div key={l.l} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-sm ${l.c}`} />
              <span className="text-[9px] font-mono text-muted-foreground">{l.l}</span>
            </div>
          ))}
          <span className="text-[9px] font-mono text-muted-foreground ml-auto">Total = estimasi permintaan per bulan dari analisis sinyal aktif</span>
        </div>
      </div>

      {/* Signal Conversion Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ListFilter className="h-3.5 w-3.5 text-primary" /> SIGNAL CONVERSION FUNNEL — Dari Sinyal Pasar ke Kontrak Layanan Terjual
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { stage: "01 RAW SIGNAL", count: vocStats.pain + vocStats.desire + BUYING_TRIGGERS.length + 15, desc: "Semua sinyal mentah terkumpul", color: "bg-slate-400", pct: 100 },
            { stage: "02 QUALIFIED", count: vocStats.pain + vocStats.desire + 8, desc: "Sinyal relevan & terverifikasi", color: "bg-blue-500", pct: 72 },
            { stage: "03 ENRICHED", count: vocStats.pain + 12, desc: "Ditambah konteks & analisis", color: "bg-violet-500", pct: 55 },
            { stage: "04 PROSPECT", count: vocStats.pain + 5, desc: "Dicocokkan ke calon klien", color: "bg-orange-500", pct: 38 },
            { stage: "05 OUTREACH", count: Math.max(2, vocStats.pain - 2), desc: "Kontak dilakukan ke klien", color: "bg-yellow-500", pct: 25 },
            { stage: "06 CLOSED", count: Math.max(1, Math.round((vocStats.pain + 5) * 0.12)), desc: "Layanan terjual", color: "bg-emerald-500", pct: 12 },
          ].map((s, i, arr) => (
            <div key={s.stage} className="flex items-center gap-2 flex-none">
              <div className="border rounded-sm p-2 text-center" style={{ minWidth: 120 }}>
                <div className={`text-[8px] font-mono font-bold text-white px-1.5 py-0.5 rounded-sm inline-block mb-1 ${s.color}`}>{s.stage}</div>
                <p className="text-2xl font-black font-mono text-primary leading-none">{s.count}</p>
                <p className="text-[8px] text-muted-foreground mt-0.5 leading-snug">{s.desc}</p>
                <div className="h-1 bg-muted rounded-full overflow-hidden mt-1.5">
                  <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                </div>
                <p className="text-[8px] font-mono text-muted-foreground mt-0.5">{s.pct}%</p>
              </div>
              {i < arr.length - 1 && <span className="text-muted-foreground font-bold text-lg">›</span>}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Funnel konversi sinyal → revenue · Target: naikkan Closed Rate ke ≥18% dengan automasi outreach & follow-up</p>
      </div>

      {/* Buying Trigger Urgency Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-red-600" /> BUYING TRIGGER URGENCY — Sinyal Pembelian Paling Mendesak Hari Ini
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BUYING_TRIGGERS.slice(0, 6).map((trigger, i) => {
            const urgency = i < 2 ? "Kritis" : i < 4 ? "Tinggi" : "Sedang";
            const uc = i < 2 ? "bg-red-100 text-red-700" : i < 4 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700";
            const action = i < 2 ? "Hubungi dalam 24 jam" : i < 4 ? "Kirim proposal minggu ini" : "Nurture dalam 2 minggu";
            return (
              <div key={i} className="flex items-start gap-2 border rounded-sm p-2 hover:shadow-sm transition-shadow">
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 mt-0.5 ${uc}`}>{urgency}</span>
                <div className="flex-1">
                  <p className="text-[10px] font-medium leading-snug">{trigger.trigger}</p>
                  <p className="text-[9px] font-mono text-primary mt-0.5">→ {action}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Trigger diurutkan berdasarkan urgency + probability close · Update harian dari analisis sinyal VOC + LPSE</p>
      </div>

      {/* Signal Source Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> SIGNAL SOURCE ATTRIBUTION — Berapa Sinyal dari Mana & Kualitasnya
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { src: "VOC Lapangan", count: Math.round((vocStats.pain + vocStats.fear) * 0.4), quality: 95, c: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "LPSE Crawl", count: Math.round(vocStats.desire * 1.8), quality: 92, c: "bg-blue-500", tc: "text-blue-700" },
            { src: "LPJK Feed", count: Math.round(vocStats.fear * 1.2), quality: 98, c: "bg-emerald-500", tc: "text-emerald-700" },
            { src: "WhatsApp / WA", count: Math.round((vocStats.pain + vocStats.fear) * 0.2), quality: 70, c: "bg-yellow-500", tc: "text-yellow-700" },
            { src: "IjinTender", count: Math.round(vocStats.desire * 0.6), quality: 85, c: "bg-blue-400", tc: "text-blue-700" },
            { src: "Manual Input", count: vocStats.trigger, quality: 88, c: "bg-violet-500", tc: "text-violet-700" },
          ].map((s) => (
            <div key={s.src} className="border rounded-sm p-2 text-center">
              <p className="text-xl font-black font-mono text-primary leading-none">{s.count}</p>
              <div className="h-1 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${s.c} rounded-full`} style={{ width: `${s.quality}%` }} />
              </div>
              <p className="text-[9px] font-mono font-bold leading-tight">{s.src}</p>
              <p className={`text-[8px] font-mono ${s.tc}`}>Q:{s.quality}%</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Quality = akurasi + verifikasi + freshness composite · Prioritaskan sinyal dari sumber Q≥90% untuk keputusan strategis</p>
      </div>

      {/* Market Opportunity Ranking */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-600" /> MARKET OPPORTUNITY RANKING — Top 5 Peluang Pasar dengan ROI Tertinggi Saat Ini
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { rank: 1, oppty: "SMAP enforcement wave Des 2026 — 200K BUJK belum comply", potential: "Rp 2–11M", signal: "REGULASI", sc: "text-blue-700", prob: 90, c: "bg-emerald-500" },
            { rank: 2, oppty: "IKN Phase 2 APBN tender buka Q3 2026", potential: "Rp 1.5–8M", signal: "TENDER", sc: "text-orange-700", prob: 82, c: "bg-blue-500" },
            { rank: 3, oppty: "BIM wajib Agt 2026 — gap 35K specialist nasional", potential: "Rp 800jt–5M", signal: "GAP", sc: "text-red-700", prob: 75, c: "bg-blue-400" },
            { rank: 4, oppty: "SKK renewal cycle Q2 2026 — 62 orang jatuh tempo", potential: "Rp 248–496jt", signal: "RENEWAL", sc: "text-violet-700", prob: 95, c: "bg-violet-500" },
            { rank: 5, oppty: "APBN digitalisasi pengadaan — peluang e-Katalog", potential: "Rp 300jt–2M", signal: "DIGITAL", sc: "text-emerald-700", prob: 60, c: "bg-yellow-500" },
          ].map((o) => (
            <div key={o.rank} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <span className="text-xl font-black font-mono text-muted-foreground/40 w-6 shrink-0">{o.rank}</span>
              <div className="flex-1">
                <p className="text-[10px] font-medium leading-snug">{o.oppty}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[8px] font-mono font-bold ${o.sc}`}>[{o.signal}]</span>
                  <div className="w-20 h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${o.c} rounded-full`} style={{ width: `${o.prob}%` }} />
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground">{o.prob}% prob</span>
                </div>
              </div>
              <p className="text-[10px] font-mono font-bold text-emerald-700 shrink-0">{o.potential}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Convergence Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> SIGNAL CONVERGENCE MATRIX — Sinyal yang Konfirmasi Satu Sama Lain = Peluang Terkuat
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              theme: "SMAP Enforcement Des 2026",
              signals: ["Regulasi: LPJK SE terbaru", "Pain Point: 34 BUJK belum SMAP", "Tender: 12 paket APBN mensyaratkan SMAP", "Market: 3 kompetitor aktif tawarkan SMAP"],
              convergence: 4, strength: "SANGAT KUAT", sc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              theme: "BIM Wajib Agt 2026",
              signals: ["Regulasi: Permen PUPR No 22/2018", "Gap: 35K specialist belum bersertifikat", "Tender: IKN mensyaratkan BIM level 2", "Market: Hanya 8 training provider aktif"],
              convergence: 4, strength: "SANGAT KUAT", sc: "text-red-700", bc: "bg-red-50 border-red-200",
            },
            {
              theme: "SKK Renewal Wave Q3 2026",
              signals: ["Data: 62 SKK expired dalam 90 hari", "Regulasi: BNSP percepat proses ke 30 hari", "Revenue: Rp 248–496jt pipeline teridentifikasi"],
              convergence: 3, strength: "KUAT", sc: "text-orange-700", bc: "bg-orange-50 border-orange-200",
            },
          ].map((m) => (
            <div key={m.theme} className={`border rounded-sm p-3 ${m.bc}`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[9px] font-semibold">{m.theme}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-mono font-bold ${m.sc}`}>{m.convergence} sinyal konvergen</span>
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm border ${m.sc} ${m.bc}`}>{m.strength}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {m.signals.map((s, i) => (
                  <span key={i} className="text-[8px] font-mono bg-white/60 border rounded-sm px-1.5 py-0.5 text-muted-foreground">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Semakin banyak sinyal berbeda mengkonfirmasi tema yang sama → semakin tinggi keyakinan untuk eksekusi strategi</p>
      </div>

      {/* Customer Voice Heat Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-primary" /> CUSTOMER VOICE HEAT TRACKER — Topik yang Paling Banyak Dibicarakan Klien Bulan Ini
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[
            { topic: "SMAP 2026", count: 342, heat: 100, c: "bg-red-500 text-white" },
            { topic: "BIM Wajib", count: 218, heat: 64, c: "bg-red-400 text-white" },
            { topic: "Tender APBN IKN", count: 184, heat: 54, c: "bg-orange-500 text-white" },
            { topic: "SKK Renewal", count: 156, heat: 46, c: "bg-orange-400 text-white" },
            { topic: "Harga Kompetitor", count: 134, heat: 39, c: "bg-yellow-500 text-white" },
            { topic: "TKDN Compliance", count: 98, heat: 29, c: "bg-yellow-400" },
            { topic: "BIM Advisory", count: 87, heat: 25, c: "bg-blue-400 text-white" },
            { topic: "SKK K3 Langka", count: 72, heat: 21, c: "bg-blue-300" },
            { topic: "Express SBU", count: 65, heat: 19, c: "bg-slate-400 text-white" },
            { topic: "IKN Eligibility", count: 54, heat: 16, c: "bg-slate-300" },
            { topic: "Subklasifikasi Baru", count: 48, heat: 14, c: "bg-muted border" },
            { topic: "Referral Insentif", count: 41, heat: 12, c: "bg-muted border" },
          ].map((t) => {
            const size = t.heat >= 70 ? "text-[11px] px-3 py-1.5" : t.heat >= 40 ? "text-[10px] px-2.5 py-1" : "text-[9px] px-2 py-0.5";
            return (
              <div key={t.topic} className={`rounded-sm font-mono font-bold ${size} ${t.c} flex items-center gap-1`}>
                {t.topic}
                <span className="opacity-70 text-[8px]">{t.count}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Ukuran = volume percakapan relatif · Warna = urgensi · Data dari WhatsApp + call log + form + laporan tim</p>
      </div>

      {/* Market Pulse Indicator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> MARKET PULSE — Indikator Kesehatan Pasar Konstruksi Indonesia Saat Ini
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { indicator: "APBN Penyerapan", val: "68%", trend: "↑", status: "Normal", tc: "text-blue-700" },
            { indicator: "Tender Aktif LPSE", val: "4.218", trend: "↑↑", status: "Tinggi", tc: "text-emerald-700" },
            { indicator: "SKK Expiry 90 Hari", val: "62K", trend: "↑↑↑", status: "Kritis", tc: "text-red-700" },
            { indicator: "PMI Konstruksi", val: "52.4", trend: "↑", status: "Ekspansi", tc: "text-emerald-700" },
          ].map((m) => (
            <div key={m.indicator} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-lg font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono font-bold mt-0.5">{m.indicator}</p>
              <p className={`text-[8px] font-mono font-bold ${m.tc}`}>{m.trend} {m.status}</p>
            </div>
          ))}
        </div>
        <div className="border rounded-sm p-2 bg-amber-50/30 border-amber-200">
          <p className="text-[9px] font-mono text-amber-700 font-bold">📡 MARKET INTELLIGENCE BRIEF — 2 Agustus 2026</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">Pasar dalam mode EKSPANSI: PMI di atas 50, tender APBN meningkat. Namun SKK expiry wave akan menekan supply tenaga ahli Q4 2026. Window peluang SKK express terbuka lebar. Kompetitor belum bergerak agresif di segmen SMAP express.</p>
        </div>
      </div>

      {/* Buying Signal Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-600" /> BUYING SIGNAL INTELLIGENCE — Pola Kata & Perilaku yang Mendahului Keputusan Beli
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[9px] font-mono font-semibold text-muted-foreground mb-2 uppercase">🔥 Hot Signals — Pembelian dalam 48 Jam</p>
            {[
              { signal: '"SMAP saya sudah mepet deadline"', convRate: "91%", action: "Hubungi dalam 2 jam" },
              { signal: '"Tender besok, SBU belum update"', convRate: "88%", action: "Tawarkan fast-track emergency" },
              { signal: '"Ditolak LPJK gara-gara SKK"', convRate: "84%", action: "Kirim paket remedial SKK" },
            ].map((s) => (
              <div key={s.signal} className="flex items-start gap-2 mb-1.5 last:mb-0">
                <div className="flex-1">
                  <p className="text-[9px] font-medium italic leading-snug">{s.signal}</p>
                  <p className="text-[9px] font-mono text-orange-700">→ {s.action}</p>
                </div>
                <span className="text-[9px] font-mono font-black text-emerald-700 shrink-0">{s.convRate}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[9px] font-mono font-semibold text-muted-foreground mb-2 uppercase">⚡ Warm Signals — Pipeline 7–14 Hari</p>
            {[
              { signal: '"Mau ikut tender IKN tahun ini"', convRate: "62%", action: "Kirim Intel Tender IKN bundle" },
              { signal: '"SKK timnya mau upgrade jenjang"', convRate: "58%", action: "Tawarkan SKK group discount" },
              { signal: '"BIM sudah jadi syarat wajib proyek"', convRate: "51%", action: "Jadwalkan konsultasi BIM advisory" },
            ].map((s) => (
              <div key={s.signal} className="flex items-start gap-2 mb-1.5 last:mb-0">
                <div className="flex-1">
                  <p className="text-[9px] font-medium italic leading-snug">{s.signal}</p>
                  <p className="text-[9px] font-mono text-blue-700">→ {s.action}</p>
                </div>
                <span className="text-[9px] font-mono font-black text-blue-700 shrink-0">{s.convRate}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Seasonal Market Demand Forecast */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-primary" /> SEASONAL DEMAND FORECAST — Prediksi Permintaan Layanan per Bulan Berdasarkan Pola Historis
        </p>
        <div className="grid grid-cols-12 gap-0.5">
          {[
            { m: "Jan", rel: 55 }, { m: "Feb", rel: 48 }, { m: "Mar", rel: 62 },
            { m: "Apr", rel: 71 }, { m: "Mei", rel: 84 }, { m: "Jun", rel: 92 },
            { m: "Jul", rel: 88 }, { m: "Agu", rel: 96 }, { m: "Sep", rel: 100 },
            { m: "Okt", rel: 88 }, { m: "Nov", rel: 72 }, { m: "Des", rel: 61 },
          ].map((m, i) => {
            const isCurrent = i === 7; // Agustus
            const c = m.rel >= 90 ? "bg-red-500" : m.rel >= 75 ? "bg-orange-400" : m.rel >= 60 ? "bg-blue-400" : "bg-muted";
            return (
              <div key={m.m} className={`flex flex-col items-center ${isCurrent ? "ring-2 ring-primary ring-offset-1 rounded-sm" : ""}`}>
                <p className="text-[8px] font-mono font-bold text-primary mb-0.5">{m.rel}%</p>
                <div className="w-full flex items-end justify-center" style={{ height: 40 }}>
                  <div className={`w-full rounded-t-sm ${c}`} style={{ height: `${m.rel * 0.4}px` }} />
                </div>
                <p className={`text-[8px] font-mono mt-0.5 ${isCurrent ? "font-bold text-primary" : "text-muted-foreground"}`}>{m.m}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Agustus–September = puncak musim tender + deadline perpanjangan sertifikasi · Siapkan kapasitas 2× di periode ini</p>
      </div>

      {/* Emerging Trend Early Warning System */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-600" /> EARLY WARNING SYSTEM — Sinyal Pasar yang Baru Muncul dan Perlu Diantisipasi Sekarang
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              signal: "Lonjakan pencarian 'SBU Gred K expired 2026'", strength: 94, days: 3,
              implication: "Gelombang renewal SBU K akan memuncak Agustus–Oktober 2026",
              action: "Aktifkan campaign WhatsApp blast ke database BUJK Kecil",
              svc: "text-red-700", sc: "bg-red-100 border-red-300",
            },
            {
              signal: "Tren diskusi 'proyek hijau / ESG konstruksi'", strength: 71, days: 12,
              implication: "Klien mulai tanya tentang sertifikasi GBC + TKDN produk hijau",
              action: "Riset regulasi PUPR untuk proyek hijau — siapkan advisory baru",
              svc: "text-orange-700", sc: "bg-orange-50 border-orange-200",
            },
            {
              signal: "Kenaikan harga material besi 18% (Juli 2026)", strength: 58, days: 8,
              implication: "Kontraktor aktif cari tender dengan klausul price escalation",
              action: "Tambahkan filter 'price escalation' di modul Intel Tender",
              svc: "text-blue-700", sc: "bg-blue-50 border-blue-200",
            },
          ].map((w) => (
            <div key={w.signal} className={`border rounded-sm p-3 ${w.sc}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold">{w.signal}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono font-black ${w.svc}`}>{w.strength}%</span>
                  <span className="text-[8px] font-mono text-muted-foreground">+{w.days}h</span>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground mb-0.5">{w.implication}</p>
              <p className={`text-[9px] font-mono ${w.svc}`}>→ {w.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Willingness to Pay Indicator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> WILLINGNESS TO PAY INDICATOR — Berapa BUJK Mau Bayar untuk Solusi Masalah Terbesar Mereka
        </p>
        <div className="flex flex-col gap-2">
          {[
            { problem: "SBU/SKK expired → tidak bisa ikut tender", wtp: "Rp 4–12jt", urgency: 96, segment: "Semua BUJK", signal: "Banyak tanya harga di WA tanpa minta diskon", c: "bg-red-500" },
            { problem: "Surat Penawaran kalah dari kompetitor", wtp: "Rp 1.5–5jt", urgency: 78, segment: "BUJK aktif tender", signal: "Minta contoh proposal + referensi sukses", c: "bg-orange-500" },
            { problem: "Tidak paham cara baca & terapkan regulasi baru", wtp: "Rp 2–8jt", urgency: 72, segment: "BUJK Menengah-Besar", signal: "Minta konsultasi setelah baca briefing gratis", c: "bg-blue-500" },
            { problem: "Tenaga ahli tidak punya SKK yang diminta proyek", wtp: "Rp 3–9jt", urgency: 88, segment: "BUJK yang punya proyek aktif", signal: "Tanya express SKK di luar jam kerja", c: "bg-violet-500" },
          ].map((r) => (
            <div key={r.problem} className="flex items-center gap-3 border-b last:border-0 pb-2 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-semibold leading-snug">{r.problem}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[9px] font-mono text-muted-foreground" title={`Segmen: ${r.segment}`}>Segmen: {r.segment}</span>
                </div>
                <p className="text-[9px] font-mono text-muted-foreground italic mt-0.5">Signal: {r.signal}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-mono font-black text-emerald-700" title={`Rentang WTP: ${r.wtp}`}>{r.wtp}</p>
                <div className="flex items-center gap-1 mt-0.5 justify-end" title={`Urgency: ${r.urgency}% — ${r.urgency >= 80 ? "sangat mendesak" : r.urgency >= 60 ? "mendesak" : "sedang"}`}>
                  <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.urgency}%` }} />
                  </div>
                  <span className="text-[8px] font-mono">{r.urgency}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">WTP = kisaran harga yang klien tidak keberatan bayar tanpa negosiasi panjang · % = urgensi beli</p>
      </div>

      {/* Market Signal Clustering */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> SIGNAL CLUSTERING — Sinyal yang Terkumpul Dikelompokkan ke Tema Strategis Otomatis
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { theme: "🔴 Krisis Sertifikasi & Lisensi", signals: 48, trend: "+24% MoM", examples: ["SBU expired tidak diketahui", "SKK sub-bidang tidak matching", "LSP tutup mendadak"], c: "bg-red-50 border-red-200", tc: "text-red-700" },
            { theme: "🟠 Tekanan Compliance Regulasi", signals: 34, trend: "+18% MoM", examples: ["SMAP belum punya", "TKDN tidak terpenuhi", "Wajib BIM tapi tidak siap"], c: "bg-orange-50 border-orange-200", tc: "text-orange-700" },
            { theme: "🟡 Peluang Tender Belum Dimanfaatkan", signals: 29, trend: "+8% MoM", examples: ["Tender APBD daerah sepi peserta", "Paket kecil <Rp 500jt kosong", "Proyek hijau tidak ada yang daftar"], c: "bg-yellow-50 border-yellow-200", tc: "text-yellow-700" },
            { theme: "🟢 Tren Pertumbuhan Positif", signals: 21, trend: "+31% MoM", examples: ["Permintaan BIM Coordinator meledak", "BUJK K naik grade ke M", "Referral dari alumni SKK Express"], c: "bg-emerald-50 border-emerald-200", tc: "text-emerald-700" },
          ].map((cl) => (
            <div key={cl.theme} className={`border rounded-sm p-3 ${cl.c}`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-bold">{cl.theme}</p>
                <div className="text-right shrink-0">
                  <p className={`text-[10px] font-mono font-black ${cl.tc}`}>{cl.signals}</p>
                  <p className={`text-[8px] font-mono ${cl.tc}`}>{cl.trend}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-0.5">
                {cl.examples.map((ex, i) => <li key={i} className="text-[9px] flex items-start gap-1"><span className={`shrink-0 ${cl.tc}`}>·</span>{ex}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Stats + Market Sentiment Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stats 2x2 */}
        <div className="md:col-span-2 grid grid-cols-2 gap-3">
          {[
            { icon: TriangleAlert, label: "Sinyal PAIN", val: vocStats.pain, color: "text-red-600" },
            { icon: Heart, label: "Sinyal DESIRE", val: vocStats.desire, color: "text-green-600" },
            { icon: Zap, label: "Buying Triggers", val: BUYING_TRIGGERS.length, color: "text-yellow-600" },
            { icon: Flame, label: "Avg. Urgensi VOC", val: `${vocStats.avgFrek}/10`, color: "text-primary" },
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
        {/* Market Sentiment Score */}
        <div className="border rounded-sm p-4 bg-card flex flex-col justify-between">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3">MARKET SENTIMENT SCORE</p>
          <div className="flex flex-col gap-2">
            {[
              { label: "Demand SBU/SKK", score: 95, trend: "↑12%", color: "bg-red-500" },
              { label: "Demand Tender Intel", score: 82, trend: "↑8%", color: "bg-orange-500" },
              { label: "Demand BIM/Digital", score: 74, trend: "↑40%", color: "bg-blue-500" },
              { label: "Demand TKDN Verify", score: 70, trend: "↑28%", color: "bg-yellow-500" },
              { label: "Demand SMAP Express", score: 88, trend: "↑35%", color: "bg-emerald-500" },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="text-[9px] font-mono w-28 truncate" title={row.label}>{row.label}</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${row.color} rounded-full`} style={{ width: `${row.score}%` }} />
                </div>
                <span className="text-[9px] font-mono font-bold w-8 text-right text-emerald-600">{row.trend}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground font-mono mt-2">YoY growth dari analisis pasar</p>
        </div>
      </div>

      {/* Market Signal Prioritization Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> MARKET SIGNAL PRIORITIZATION MATRIX — Sinyal Pasar vs Potensi Revenue
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Sinyal Pasar", "Sumber Intel", "Frekuensi", "Impact Score", "Revenue Trigger", "Aksi Rekomendasi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { sinyal: "Lonjakan Tender APBN Q1/Q3", sumber: "LPSE + Berita PUPR", freq: "Harian", impact: "10/10", rev: "Rp 50–200jt/kuartal", aksi: "Aktifkan kampanye Tender Concierge", aksiColor: "text-red-700" },
                { sinyal: "Regulasi Baru PUPR/LKPP", sumber: "JDIH + Alert Regulasi", freq: "Mingguan", impact: "9/10", rev: "Rp 20–80jt/regulasi", aksi: "Buat briefing darurat + WA blast", aksiColor: "text-red-700" },
                { sinyal: "Mass SBU Expiry (Puncak Mei/Nov)", sumber: "Database LPJK + Scraping", freq: "Bulanan", impact: "9/10", rev: "Rp 30–150jt/gelombang", aksi: "Email + WA sequence 90-60-30 hari", aksiColor: "text-orange-700" },
                { sinyal: "IKN Tender Wave", sumber: "KPBU + Otorita IKN", freq: "Triwulan", impact: "8/10", rev: "Rp 100–500jt/proyek", aksi: "Posisikan sebagai advisor kualifikasi IKN", aksiColor: "text-orange-700" },
                { sinyal: "Kompetitor Turunkan Harga", sumber: "IjinTender Monitor", freq: "Real-time", impact: "7/10", rev: "Defensif — cegah churn", aksi: "Perbarui pricing + klarifikasi nilai", aksiColor: "text-blue-700" },
                { sinyal: "Tren K3 / Kecelakaan Konstruksi", sumber: "Media nasional + BPJS", freq: "Mingguan", impact: "6/10", rev: "Rp 5–15jt/advisory", aksi: "Content marketing K3 + advisory paket", aksiColor: "text-blue-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 font-medium">{r.sinyal}</td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.sumber}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.freq}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${parseInt(r.impact) >= 9 ? "bg-red-100 text-red-700" : parseInt(r.impact) >= 7 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>{r.impact}</span>
                  </td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.rev}</td>
                  <td className={`px-3 py-2 text-[10px] font-semibold ${r.aksiColor}`}>{r.aksi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Impact Score = frekuensi × nilai deal × urgensi · Diperbarui setiap sprint review tim intel</p>
      </div>

      {/* Market Signal Confidence Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> SIGNAL CONFIDENCE SCORECARD — Seberapa Bisa Dipercaya Setiap Sinyal Pasar yang Terkumpul
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Sinyal", "Sumber", "Sample Size", "Triangulated?", "Confidence", "Action"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { signal: "SKK K3 demand +48% MoM", source: "LPJK API + 3 tim lapangan", n: "n=340", tri: "✅ YA", conf: 94, action: "EKSEKUSI", cc: "text-emerald-700" },
                { signal: "BIM Coordinator langka di Kaltim", source: "2 tim lapangan saja", n: "n=41", tri: "⚠️ PARTIAL", conf: 67, action: "VERIFIKASI", cc: "text-orange-700" },
                { signal: "Tender Sulawesi kosong peserta", source: "LPSE crawler", n: "n=18 tender", tri: "✅ YA", conf: 88, action: "EKSEKUSI", cc: "text-emerald-700" },
                { signal: "Startup baru potong harga SKK 40%", source: "1 laporan klien", n: "n=1", tri: "❌ TIDAK", conf: 23, action: "INVESTIGASI", cc: "text-red-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                  <td className="px-3 py-2 text-[9px] font-medium">{r.signal}</td>
                  <td className="px-3 py-2 text-[9px] text-muted-foreground">{r.source}</td>
                  <td className="px-3 py-2 text-[9px] font-mono">{r.n}</td>
                  <td className="px-3 py-2 text-[9px]">{r.tri}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${r.cc}`}>{r.conf}%</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${r.cc}`}>{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buyer Journey Funnel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-primary" />
          BUYER JOURNEY FUNNEL — Konversi per Tahap (Est. Bulanan)
        </p>
        <div className="flex items-end gap-0 h-28">
          {[
            { stage: "AWARE", desc: "Temukan konten/iklan", val: 12000, color: "bg-slate-400", textColor: "text-slate-600" },
            { stage: "INTEREST", desc: "Kunjungi website/WA", val: 3600, color: "bg-blue-400", textColor: "text-blue-600" },
            { stage: "CONSIDER", desc: "Tanya detail layanan", val: 840, color: "bg-yellow-400", textColor: "text-yellow-600" },
            { stage: "INTENT", desc: "Minta penawaran", val: 210, color: "bg-orange-400", textColor: "text-orange-600" },
            { stage: "PURCHASE", desc: "Bayar & onboarding", val: 52, color: "bg-emerald-500", textColor: "text-emerald-600" },
            { stage: "LOYALITY", desc: "Repeat / referral", val: 18, color: "bg-primary", textColor: "text-primary" },
          ].map((f, i, arr) => {
            const maxVal = arr[0].val;
            const pct = Math.round((f.val / maxVal) * 100);
            const convRate = i > 0 ? Math.round((f.val / arr[i-1].val) * 100) : 100;
            return (
              <div key={f.stage} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] font-mono font-bold text-center leading-tight" style={{ color: "hsl(var(--muted-foreground))" }}>
                  {f.val.toLocaleString()}
                </div>
                <div className={`w-full ${f.color} rounded-t-sm transition-all`} style={{ height: `${pct}%` }} />
                <div className="text-[9px] font-mono font-bold text-center">{f.stage}</div>
                <div className="text-[8px] text-muted-foreground text-center leading-tight hidden sm:block">{f.desc}</div>
                {i > 0 && (
                  <div className={`text-[8px] font-mono font-bold ${convRate < 15 ? "text-red-500" : convRate < 30 ? "text-orange-500" : "text-emerald-600"}`}>
                    CR: {convRate}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">CR = Conversion Rate per tahap · Estimasi dari analisis VOC + analitik kampanye</p>
      </div>

      {/* Demand Velocity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> DEMAND VELOCITY TRACKER — Seberapa Cepat Permintaan Tiap Layanan Tumbuh vs Bulan Lalu
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { service: "SKK Express Jenjang 9", velocity: "+31%/bln", mom: "+8pp", trend: "🚀 AKSELERASI", abs: 248, tc: "text-emerald-700" },
            { service: "SMAP Advisory End-to-End", velocity: "+22%/bln", mom: "+4pp", trend: "📈 TUMBUH", abs: 89, tc: "text-emerald-700" },
            { service: "Briefing Intel Harian", velocity: "+14%/bln", mom: "+1pp", trend: "📈 STABIL", abs: 412, tc: "text-blue-700" },
            { service: "BIM Advisory & Training", velocity: "+47%/bln", mom: "+18pp", trend: "🚀 AKSELERASI", abs: 34, tc: "text-emerald-700" },
            { service: "SBU Perpanjangan", velocity: "+3%/bln", mom: "-2pp", trend: "⚡ MELAMBAT", abs: 178, tc: "text-orange-700" },
            { service: "Surat Penawaran Premium", velocity: "-4%/bln", mom: "-5pp", trend: "🔻 MENURUN", abs: 67, tc: "text-red-700" },
          ].map((r) => (
            <div key={r.service} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <div className="flex-1">
                <p className="text-[9px] font-medium">{r.service}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{r.abs} request bulan ini</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[9px] font-mono font-bold ${r.tc}`}>{r.velocity}</p>
                <p className="text-[8px] font-mono">{r.trend}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Pulse Real-Time Alerts */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> MARKET PULSE ALERTS — Perubahan Signifikan di Pasar Konstruksi yang Terjadi 48 Jam Terakhir
        </p>
        <div className="flex flex-col gap-2">
          {[
            { alert: "Pengumuman APBN-P 2026 tambah alokasi infrastruktur +Rp 48T — estimasi 340 paket tender baru terbuka Q4", type: "PELUANG", severity: "Kritis", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { alert: "LPJK update sistem verifikasi SKK — proses manual kini 3× lebih lambat efektif 1 Sept 2026", type: "RISIKO", severity: "Tinggi", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { alert: "Kompetitor A turunkan harga SKK Express 18% — kemungkinan strategi land-and-expand", type: "ANCAMAN", severity: "Sedang", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { alert: "3 BUJK besar Surabaya minta konsultasi BIM onboarding — demand muncul spontan tanpa campaign", type: "SINYAL", severity: "MENARIK", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((a) => (
            <div key={a.alert} className={`border rounded-sm p-3 ${a.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[8px] font-mono font-bold ${a.tc}`}>{a.type}</span>
                <span className={`text-[8px] font-mono ${a.tc}`}>· {a.severity}</span>
              </div>
              <p className="text-[9px] leading-snug">{a.alert}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top CPKB pain points as market demand */}
      {topPains.length > 0 && (
        <div className="border rounded-sm p-4 bg-muted/20">
          <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-primary" />
            Masalah Terpanas dari CPKB (Pain Score ≥ 8)
          </p>
          <div className="flex flex-col gap-2">
            {topPains.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className={cn(
                  "font-mono font-bold text-sm shrink-0 w-8 text-right",
                  (p.painScore ?? 0) >= 10 ? "text-red-600" : (p.painScore ?? 0) >= 9 ? "text-orange-600" : "text-yellow-600"
                )}>{p.painScore}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
                    <div
                      className={cn("h-full rounded-full", (p.painScore ?? 0) >= 10 ? "bg-red-500" : (p.painScore ?? 0) >= 9 ? "bg-orange-500" : "bg-yellow-500")}
                      style={{ width: `${((p.painScore ?? 0) / 10) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs leading-snug truncate" title={p.description ?? undefined}>{p.description}</p>
                </div>
                {p.serviceOpportunity && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm shrink-0 hidden sm:block max-w-[150px] truncate" title={p.serviceOpportunity}>
                    {p.serviceOpportunity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + VOC search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap flex-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                tab === t.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
        {tab === "voc" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={vocSearchRef}
              type="text"
              placeholder="Cari sinyal VOC… ( / )"
              title="Tekan / untuk fokus ke pencarian"
              value={vocSearch}
              onChange={(e) => setVocSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setVocSearch(""); e.currentTarget.blur(); } }}
              className="h-9 pl-8 pr-7 text-xs font-mono rounded-sm border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary w-48"
            />
            {!vocSearch && <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">/</kbd>}
            {vocSearch && (
              <button onClick={() => setVocSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Hapus pencarian">
                <ListFilter className="h-3.5 w-3.5 hidden" /><X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── VOC Tab ── */}
      {tab === "voc" && (
        <div className="flex flex-col gap-4">
          {/* ListFilter */}
          <div className="flex flex-wrap gap-2">
            {[["SEMUA","Semua","Tampilkan semua sinyal VOC"], ["PAIN","Pain","Pain — keluhan & masalah aktif yang dialami calon klien"], ["FEAR","Fear","Fear — kekhawatiran & risiko yang menghambat keputusan"], ["DESIRE","Desire","Desire — harapan & keinginan calon klien"], ["OBJECTION","Objection","Objection — keberatan terhadap penawaran"], ["TRIGGER","Trigger","Trigger — pemicu yang mendorong calon klien mencari solusi"]].map(([f, label, tip]) => (
              <button
                key={f}
                onClick={() => setVocFilter(f)}
                aria-pressed={vocFilter === f}
                title={tip}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-sm border font-mono transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                  vocFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
            <span className="text-xs text-muted-foreground self-center font-mono" aria-live="polite" aria-atomic="true">
              {filteredVOC.length < VOC_SIGNALS.length ? `${filteredVOC.length} dari ${VOC_SIGNALS.length}` : `${filteredVOC.length}`} sinyal
            </span>
            {Object.values(vocNotes).filter(v => v?.trim()).length > 0 && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 self-center">
                {Object.values(vocNotes).filter(v => v?.trim()).length} catatan
              </span>
            )}
            {(vocFilter !== "SEMUA" || vocSearch || showVocPinnedOnly || vocSortFreq || vocSortScore || vocSortNotes || showVocWithNotesOnly) && (
              <button
                onClick={() => { setVocFilter("SEMUA"); setVocSearch(""); setShowVocPinnedOnly(false); setVocSortFreq(false); setVocSortScore(false); setVocSortNotes(false); setShowVocWithNotesOnly(false); }}
                className="text-[10px] font-mono font-bold px-2 py-1 rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1 self-center focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
                title="Reset semua filter VOC"
              >
                ✕ Reset
              </button>
            )}
            {vocPinned.size > 0 && (
              <button
                onClick={() => setShowVocPinnedOnly(v => !v)}
                aria-pressed={showVocPinnedOnly}
                className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border transition-colors self-center", showVocPinnedOnly ? "bg-amber-500 text-white border-amber-500" : "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200")}
              >
                <Star className={cn("h-2.5 w-2.5 inline mr-0.5", showVocPinnedOnly && "fill-white")} />{vocPinned.size} dipin
              </button>
            )}
            <button
              onClick={() => { setVocSortFreq(v => !v); if (!vocSortFreq) setVocSortScore(false); }}
              aria-pressed={vocSortFreq}
              className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", vocSortFreq ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted")}
              title="Urutkan berdasarkan frekuensi"
            >
              {vocSortFreq ? "↓ Frekuensi" : "↑ Frekuensi"}
            </button>
            <button
              onClick={() => { setVocSortScore(v => !v); if (!vocSortScore) setVocSortFreq(false); }}
              aria-pressed={vocSortScore}
              className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", vocSortScore ? "bg-orange-500 text-white border-orange-500" : "border-border text-muted-foreground hover:bg-muted")}
              title="Urutkan berdasarkan pain score"
            >
              {vocSortScore ? "↓ Pain Score" : "↑ Pain Score"}
            </button>
            {Object.values(vocNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setVocSortNotes(v => !v)}
                aria-pressed={vocSortNotes}
                className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", vocSortNotes ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100")}
                title="Sinyal dengan catatan dulu"
              >
                {vocSortNotes ? "📝 Catatan ↑" : "📝 Catatan ↓"}
              </button>
            )}
            {Object.values(vocNotes).filter(v => v?.trim()).length > 0 && (
              <button
                onClick={() => setShowVocWithNotesOnly(v => !v)}
                aria-pressed={showVocWithNotesOnly}
                className={cn("text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none", showVocWithNotesOnly ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100")}
                title="Filter hanya sinyal dengan catatan"
              >
                {showVocWithNotesOnly ? "✓ Ada Catatan" : "Ada Catatan"}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {filteredVOC.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2 border rounded-sm bg-muted/20">
                <Mic className="h-6 w-6 opacity-30" />
                <p className="text-sm font-medium">Tidak ada sinyal VOC yang cocok</p>
                <p className="text-xs opacity-60">Coba longgarkan filter atau reset filter</p>
                {(vocFilter !== "SEMUA" || vocSearch) && (
                  <button onClick={() => { setVocFilter("SEMUA"); setVocSearch(""); }} className="text-xs font-mono text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none">✕ Reset filter</button>
                )}
              </div>
            )}
            {filteredVOC.map((voc) => {
              const Icon = VOC_ICON[voc.kategori] ?? Mic;
              const isOpen = expanded === voc.id;
              return (
                <div key={voc.id} className={cn("border rounded-sm p-4 group hover:brightness-95 hover:shadow-sm transition-all cursor-pointer", VOC_COLOR[voc.kategori])}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border flex items-center gap-1", VOC_BADGE[voc.kategori])}>
                          <Icon className="h-2.5 w-2.5" />{voc.kategori}
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm" title={`Segmen: ${voc.segment}`}>{voc.segment}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={voc.sumber}>{voc.sumber}</span>
                        <div className="flex items-center gap-1 ml-auto" title={`Tingkat urgensi: ${voc.frekuensi}/10 — ${voc.frekuensi >= 8 ? "sangat mendesak" : voc.frekuensi >= 5 ? "cukup mendesak" : "perlu dipantau"}`}>
                          <span className="text-[10px] text-muted-foreground font-mono">Urgensi</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                              <div key={i} className={cn("h-2 w-1.5 rounded-[1px]", i <= voc.frekuensi ? "bg-primary" : "bg-muted")} />
                            ))}
                          </div>
                          <span className="text-[10px] font-mono font-bold text-primary">{voc.frekuensi}/10</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5 group/q">
                        <p className="text-sm italic font-medium leading-snug flex-1">{voc.kutipan}</p>
                        <button onClick={() => void navigator.clipboard.writeText(voc.kutipan).then(() => toast.success("Kutipan disalin", { duration: 1200 }))} className="opacity-0 group-hover/q:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground mt-0.5 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label="Salin kutipan VOC" title="Salin kutipan"><Copy className="h-3 w-3" /></button>
                      </div>
                      {!isOpen && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2" title={voc.terjemahan}>{voc.terjemahan}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleVocPin(voc.id)}
                        aria-label={vocPinned.has(voc.id) ? "Hapus pin sinyal VOC ini" : "Pin sinyal VOC ini"}
                        className={cn("h-6 w-6 flex items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1", vocPinned.has(voc.id) ? "bg-amber-100 border-amber-400 text-amber-600" : "border-border/50 text-muted-foreground/50 hover:border-amber-400 hover:text-amber-500")}
                        title={vocPinned.has(voc.id) ? "Hapus pin" : "Pin sinyal ini"}
                      >
                        <Star className={cn("h-3 w-3", vocPinned.has(voc.id) && "fill-amber-400")} />
                      </button>
                      <button onClick={() => setExpanded(isOpen ? null : voc.id)} className="shrink-0 text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none" aria-label={isOpen ? "Tutup detail sinyal" : "Buka detail sinyal"} aria-expanded={isOpen}>
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  {(vocNotes[voc.id] ?? "").trim() && !isOpen && (
                    <p className="mt-1.5 text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-100 rounded-sm px-2 py-1 line-clamp-1" title={vocNotes[voc.id]}>
                      📝 {vocNotes[voc.id]}
                    </p>
                  )}
                  {isOpen && (
                    <div className="mt-3 border-t pt-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div>
                        <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase mb-1">Interpretasi</p>
                        <p className="text-xs">{voc.terjemahan}</p>
                      </div>
                      <div className="flex items-start gap-2 p-2.5 border border-primary/20 rounded-sm bg-primary/5">
                        <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-mono font-semibold text-primary uppercase">Peluang Layanan</p>
                          <p className="text-xs mt-0.5">{voc.peluangLayanan}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `📢 *Sinyal VOC — ${voc.kategori}*\n\n` +
                            `${voc.kutipan}\n\n` +
                            `📍 Sumber: ${voc.sumber}\n` +
                            `🎯 Segmen: ${voc.segment}\n` +
                            `📊 Urgensi: ${voc.frekuensi}/10\n\n` +
                            `💡 *Peluang Layanan:*\n${voc.peluangLayanan}\n\n` +
                            `PT Maheswara Jaya Persada — Platform Riset Marketing Konstruksi`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline font-medium"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Bagikan via WA
                        </a>
                        <a
                          href={`/surat-penawaran?perihal=${encodeURIComponent(`Penawaran Layanan — ${voc.kategori}`)}`}
                          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Buat Surat Penawaran
                        </a>
                        <a
                          href={`/pain-points?prefill=${encodeURIComponent(JSON.stringify({ domain: voc.segment, description: voc.kutipan, context: voc.peluangLayanan }))}`}
                          className="flex items-center gap-1.5 text-xs text-violet-600 hover:underline font-medium"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Tambah Pain Point
                        </a>
                        <a
                          href="/workroom?tab=perumusan"
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary hover:underline font-medium"
                        >
                          → Workroom
                        </a>
                      </div>
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-2">
                          Catatan Tim
                          {savedVocNoteId === voc.id && <span className="text-[10px] text-emerald-600 font-normal normal-case">✓ Tersimpan</span>}
                        </p>
                        <textarea
                          value={vocNotes[voc.id] ?? ""}
                          onChange={(e) => updateVocNote(voc.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                          onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                          placeholder="Tambahkan catatan analisis…"
                          rows={2}
                          maxLength={500}
                          className="w-full text-xs border rounded-sm px-2.5 py-2 bg-background font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <p className="text-[9px] font-mono text-muted-foreground text-right">{(vocNotes[voc.id] ?? "").length} / 500</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Heatmap Tab ── */}
      {tab === "heatmap" && (
        <div className="flex flex-col gap-3">
          {Object.values(heatmapNotes).some(v => v?.trim()) && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-mono text-blue-700 font-bold">
                {Object.values(heatmapNotes).filter(v => v?.trim()).length} catatan heatmap
              </span>
              {confirmClearNotes ? (
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setHeatmapNotes({}); try { localStorage.removeItem("mkp-heatmap-notes"); } catch { /* ignore */ } setConfirmClearNotes(false); }}
                    onBlur={() => setConfirmClearNotes(false)}
                    autoFocus
                    className="text-[10px] font-mono text-white bg-red-600 hover:bg-red-700 rounded-sm px-2 py-0.5 transition-colors"
                  >✓ Yakin hapus?</button>
                  <button onClick={() => setConfirmClearNotes(false)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Batal</button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmClearNotes(true)}
                  className="text-[10px] font-mono text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-sm px-2 py-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
                  title="Hapus semua catatan heatmap"
                >✕ Hapus semua catatan</button>
              )}
            </div>
          )}
          {DEMAND_HEATMAP.map((h, i) => (
            <div key={i} className="border rounded-sm p-4 bg-card flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm">{h.domain}</span>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs font-mono font-semibold px-1.5 py-0.5 rounded-sm",
                    h.growth.startsWith("+8") || parseFloat(h.growth) >= 20 ? "bg-emerald-100 text-emerald-700" :
                    parseFloat(h.growth) >= 10 ? "bg-yellow-100 text-yellow-700" : "bg-muted text-muted-foreground"
                  )}>
                    {h.growth}
                  </span>
                  <span className="font-bold font-mono text-primary text-sm">{h.demand}</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    h.demand >= 90 ? "bg-red-500" : h.demand >= 75 ? "bg-orange-500" : h.demand >= 60 ? "bg-yellow-500" : "bg-primary/40"
                  )}
                  style={{ width: `${h.demand}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TriangleAlert className="h-3 w-3 text-orange-500" />
                Top pain: {h.topPain}
              </p>
              <textarea
                value={heatmapNotes[i] ?? ""}
                onChange={(e) => updateHeatmapNote(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
                onInput={e => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                placeholder="Catatan tim untuk domain ini…"
                rows={1}
                maxLength={500}
                className="w-full border rounded-sm px-2 py-1 text-[10px] bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:bg-background transition-colors"
              />
              <p className="text-[9px] font-mono text-muted-foreground text-right flex items-center justify-end gap-2">
                {savedHeatmapNoteIdx === i && <span className="text-emerald-600">✓ Tersimpan</span>}
                {(heatmapNotes[i] ?? "").length} / 500
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Buying Triggers Tab ── */}
      {tab === "trigger" && (
        <div className="flex flex-col gap-3">
          {BUYING_TRIGGERS.map((t, i) => (
            <div key={i} className="border rounded-sm p-4 bg-card flex items-start gap-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-mono font-bold text-xs shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm", URGENCY_BADGE[t.urgency])}>
                    {t.urgency}
                  </span>
                  <div className="flex items-center gap-1">
                    {[...Array(t.frekuensi)].map((_, j) => (
                      <div key={j} className="h-1.5 w-1.5 rounded-full bg-primary" />
                    ))}
                    {[...Array(10 - t.frekuensi)].map((_, j) => (
                      <div key={j} className="h-1.5 w-1.5 rounded-full bg-muted" />
                    ))}
                  </div>
                </div>
                <p className="font-semibold text-sm">{t.trigger}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-muted-foreground/70">Channel terbaik:</span>{" "}
                  <span className="text-foreground">{t.channel}</span>
                </p>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `⚡ *Buying Trigger Terdeteksi*\n\n` +
                    `*${t.trigger}*\n` +
                    `Urgensi: ${t.urgency}\n` +
                    `Channel terbaik: ${t.channel}\n\n` +
                    `PT Maheswara Jaya Persada — Platform Riset Marketing Konstruksi`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 hover:underline"
                >
                  <MessageCircle className="h-3 w-3" /> Hubungi WA
                </a>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${t.trigger} — ${t.channel}`).then(() => toast.success("Disalin ke clipboard", { duration: 1500 })).catch(() => {}); }}
                  className="mt-2 ml-3 inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                  title="Salin trigger ke clipboard"
                >
                  <Copy className="h-3 w-3" /> Salin
                </button>
              </div>
            </div>
          ))}
          {/* Conversion Copy Recommendations per Trigger */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              REKOMENDASI COPY KONVERSI PER TRIGGER
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { trigger: "SBU Habis / Expired", hook: "\"SBU Anda habis? Urus dalam 7 hari kerja — tanpa antri, tanpa ribet\"", cta: "Konsultasi Gratis Sekarang", channel: "WA Blast", urgency: "KRITIS" },
                { trigger: "Mau Ikut Tender APBN", hook: "\"Sebelum daftar tender, pastikan SBU + SKK + TKDN Anda lolos kualifikasi awal\"", cta: "Audit Kesiapan Tender Gratis", channel: "LinkedIn", urgency: "TINGGI" },
                { trigger: "Regulasi Baru Terbit", hook: "\"Permen baru ini berlaku mulai [DATE] — apakah BUJK Anda sudah siap? Cek sekarang\"", cta: "Download Ringkasan Regulasi", channel: "Email + WA", urgency: "TINGGI" },
                { trigger: "Proyek Besar Diumumkan", hook: "\"[NAMA_PROYEK] butuh kontraktor. SBU + SKK yang tepat = tiket masuk\"", cta: "Lihat Kualifikasi Yang Dibutuhkan", channel: "LPSE Alert", urgency: "SEDANG" },
              ].map((r) => (
                <div key={r.trigger} className="border rounded-sm p-3 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-[9px] font-mono px-1.5 py-0.5 rounded-sm font-bold",
                      r.urgency === "KRITIS" ? "bg-red-100 text-red-700" :
                      r.urgency === "TINGGI" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                    )}>{r.urgency}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{r.trigger}</span>
                  </div>
                  <p className="text-xs italic mb-2 text-foreground/80 leading-snug">{r.hook}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-primary font-bold">→ {r.cta}</span>
                    <span className="text-[9px] font-mono bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">{r.channel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-dashed rounded-sm p-4 text-center text-xs text-muted-foreground font-mono">
            💡 Gunakan daftar trigger ini untuk membangun alur follow-up & content marketing yang tepat sasaran
          </div>
        </div>
      )}

      {/* ── Live Signals Tab ── */}
      {tab === "live" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-mono text-muted-foreground">Sinyal real-time dari {(trends ?? []).length} topik trending + {liveSignals.length} sinyal riset</p>
            <button
              onClick={() => queryClient.invalidateQueries()}
              className="flex items-center gap-1.5 text-[10px] font-mono text-primary border border-primary/30 px-2 py-1 rounded-sm hover:bg-primary/5 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Refresh Sinyal
            </button>
          </div>
          {/* Trending topics */}
          {(trends ?? []).length > 0 && (
            <div className="border rounded-sm p-4">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Topik Trending Hari Ini (dari 64 sumber data)
              </p>
              <div className="flex flex-col gap-2">
                {(trends ?? []).map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs text-primary w-6 text-right">{t.count}×</span>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-0.5">
                        <div className="h-full bg-primary/50 rounded-full" style={{ width: `${Math.min(100, (t.count / 5) * 100)}%` }} />
                      </div>
                      <p className="text-xs truncate" title={t.topic}>{t.topic}</p>
                    </div>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground hidden sm:block">{t.category}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live research signals */}
          {liveSignals.length > 0 && (
            <div className="border rounded-sm p-4">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                Sinyal Pasar dari Riset Harian
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm border border-border ml-1 font-normal">{liveSignals.length}</span>
              </p>
              <div className="flex flex-col gap-2.5">
                {liveSignals.map((item) => (
                  <div key={item.id} className="flex items-start gap-2.5 border-b last:border-0 pb-2 last:pb-0">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug">{item.title}</p>
                      {item.summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1" title={item.summary}>{item.summary}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.createdAt && (Date.now() - new Date(item.createdAt).getTime()) < 7 * 86400000 && (
                        <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200">Baru</span>
                      )}
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">{item.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary stats */}
          {summary && (
            <div className="border rounded-sm p-4 bg-muted/20">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3">Snapshot Pasar Hari Ini</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Data Terkumpul", val: summary?.totalResearchItems },
                  { label: "Tender Terbuka", val: summary?.openTenders },
                  { label: "SBU/SKK Expiry", val: summary?.expiringCertifications },
                  { label: "Pain Point Kritis", val: summary?.criticalPainPoints },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-bold font-mono text-primary">{s.val}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Domain distribution from live pain points */}
          {(painPoints ?? []).length > 0 && (
            <div className="border rounded-sm p-4">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <ChartBar className="h-3.5 w-3.5 text-violet-600" />
                Distribusi Masalah per Domain (dari CPKB Live)
              </p>
              <div className="flex flex-col gap-1.5">
                {(() => {
                  const byDomain: Record<string, { count: number; avgScore: number }> = {};
                  for (const p of (painPoints ?? [])) {
                    const d = p.domain ?? "Lainnya";
                    if (!byDomain[d]) byDomain[d] = { count: 0, avgScore: 0 };
                    byDomain[d].count++;
                    byDomain[d].avgScore += p.painScore ?? 0;
                  }
                  const sorted = Object.entries(byDomain)
                    .map(([domain, { count, avgScore }]) => ({ domain, count, avgScore: avgScore / count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8);
                  const maxCount = sorted[0]?.count ?? 1;
                  return sorted.map(({ domain, count, avgScore }) => (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono w-20 shrink-0 text-muted-foreground truncate" title={domain}>{domain}</span>
                      <div className="flex-1 min-w-0">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-violet-500/60 rounded-full transition-all"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{count}</span>
                      <span className={cn(
                        "text-[10px] font-mono font-bold w-10 text-right",
                        avgScore >= 9 ? "text-red-600" : avgScore >= 7 ? "text-orange-600" : "text-muted-foreground"
                      )}>⚡{avgScore.toFixed(1)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {/* VOC Sentiment Matrix */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Heart className="h-3.5 w-3.5 text-rose-500" />
              VOC SENTIMENT MATRIX — Pola Suara Pasar per Segmen
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
                  <tr className="border-b bg-muted/20 text-[9px] font-mono text-muted-foreground uppercase">
                    <th className="text-left px-3 py-2 w-28">Segmen</th>
                    <th className="text-center px-3 py-2">Pain</th>
                    <th className="text-center px-3 py-2">Fear</th>
                    <th className="text-center px-3 py-2">Desire</th>
                    <th className="text-center px-3 py-2">Objection</th>
                    <th className="text-center px-3 py-2">Trigger</th>
                    <th className="text-left px-3 py-2">Peluang Terbaik</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { seg: "BUJK Kecil", pain: 9, fear: 7, desire: 8, obj: 6, trigger: 9, oppt: "SBU Expiry Alert + Perpanjangan Express" },
                    { seg: "BUJK Menengah", pain: 7, fear: 9, desire: 8, obj: 7, trigger: 8, oppt: "SMAP ISO 37001 + TKDN Verifikasi" },
                    { seg: "BUJK Besar", pain: 5, fear: 8, desire: 9, obj: 8, trigger: 7, oppt: "BIM Advisory + Competitive Intelligence" },
                    { seg: "Tenaga Ahli", pain: 8, fear: 6, desire: 9, obj: 5, trigger: 8, oppt: "Sertifikasi SKK Jenjang 7/8/9 cepat" },
                    { seg: "Peserta Tender", pain: 9, fear: 8, desire: 9, obj: 6, trigger: 10, oppt: "Pendampingan Tender + Analisis Peluang Menang" },
                  ].map((r) => {
                    const scoreBar = (v: number, label?: string) => (
                      <div className="flex items-center gap-1.5 justify-center" title={label ? `${label}: ${v}/10 (${v * 10}%)` : `Score: ${v}/10`}>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", v >= 9 ? "bg-red-500" : v >= 7 ? "bg-orange-400" : "bg-blue-400")} style={{ width: `${v * 10}%` }} />
                        </div>
                        <span className={cn("text-[10px] font-mono font-bold w-4", v >= 9 ? "text-red-600" : v >= 7 ? "text-orange-500" : "text-muted-foreground")}>{v}</span>
                      </div>
                    );
                    return (
                      <tr key={r.seg} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-3 py-2">
                          <span className="text-[9px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded-sm">{r.seg}</span>
                        </td>
                        <td className="px-3 py-2">{scoreBar(r.pain, "Pain")}</td>
                        <td className="px-3 py-2">{scoreBar(r.fear, "Fear")}</td>
                        <td className="px-3 py-2">{scoreBar(r.desire, "Desire")}</td>
                        <td className="px-3 py-2">{scoreBar(r.obj, "Objection")}</td>
                        <td className="px-3 py-2">{scoreBar(r.trigger, "Trigger")}</td>
                        <td className="px-3 py-2 text-muted-foreground text-[10px] max-w-[180px]">{r.oppt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">
              Skala 1–10 · Pain = intensitas masalah · Fear = risiko · Desire = motivasi beli · Objection = hambatan · Trigger = urgensi pembelian
            </p>
          </div>

          {/* Sinyal Pasar Geo Heat Map */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-primary" /> SINYAL PASAR GEO HEAT MAP — Intensitas Sinyal dari Setiap Wilayah Indonesia per Kategori Jasa MJP
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b sticky top-0 bg-background z-10">
                    <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Wilayah</th>
                    {["SKK", "SMAP", "BIM", "Tender", "Regulasi", "Total"].map(h => (
                      <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { region: "Jabodetabek", scores: [9, 8, 7, 8, 6, 9], total: "HIGH" },
                    { region: "Jawa Barat", scores: [8, 7, 5, 8, 6, 8], total: "HIGH" },
                    { region: "Jawa Tengah", scores: [7, 6, 4, 7, 5, 7], total: "MED" },
                    { region: "Jawa Timur", scores: [8, 7, 5, 7, 5, 7], total: "HIGH" },
                    { region: "Sulawesi Sel.", scores: [6, 4, 3, 5, 4, 6], total: "MED" },
                    { region: "Kalimantan Timur", scores: [7, 5, 6, 6, 4, 7], total: "MED" },
                    { region: "Papua/Barat", scores: [5, 3, 7, 4, 3, 5], total: "LOW" },
                  ].map((r) => (
                    <tr key={r.region} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="px-2 py-1 text-[9px] font-medium">{r.region}</td>
                      {r.scores.map((s, i) => (
                        <td key={i} className={`px-2 py-1 text-[9px] font-mono font-bold text-center ${s >= 8 ? "text-red-600 bg-red-50" : s >= 6 ? "text-orange-600 bg-orange-50" : "text-muted-foreground"}`}>{s}</td>
                      ))}
                      <td className={`px-2 py-1 text-[8px] font-mono font-black text-center ${r.total === "HIGH" ? "text-red-700" : r.total === "MED" ? "text-orange-600" : "text-muted-foreground"}`}>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">SKK demand tertinggi di Jabodetabek (9/10) + Kalimantan Timur (7/10) → alokasi sumber daya produksi lebih ke sini</p>
          </div>

          {/* Signal Velocity & Momentum Tracker */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> SIGNAL VELOCITY & MOMENTUM — Sinyal yang Paling Cepat Naik vs Turun dalam 30 Hari Terakhir
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] font-bold text-emerald-700 mb-2">🚀 Naik Cepat (Bullish Signals)</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { signal: "SKK J9 K3 demand", change: "+47%", detail: "Tender infrastruktur Q4 surge" },
                    { signal: "SMAP BUMN requirement", change: "+31%", detail: "Kebijakan baru per 1 Okt 2026" },
                    { signal: "BIM mandatory queries", change: "+89%", detail: "Efek edukasi webinar viral" },
                    { signal: "Info tender Papua", change: "+62%", detail: "Alokasi APBN meningkat 2× lipat" },
                  ].map((r) => (
                    <div key={r.signal} className="flex items-center gap-2">
                      <p className="text-[9px] flex-1">{r.signal}</p>
                      <span className="text-[9px] font-mono font-bold text-emerald-700 shrink-0">{r.change}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold text-red-700 mb-2">📉 Turun (Bearish / Saturated)</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { signal: "SBU Jasa Konsultansi Umum", change: "-18%", detail: "Saturasi pasar Jabodetabek" },
                    { signal: "SKK Jenjang 7 (dasar)", change: "-12%", detail: "Shift ke J8–J9 setelah kebijakan" },
                    { signal: "Info harga material manual", change: "-24%", detail: "Tergantikan AI price estimator" },
                    { signal: "Pelatihan SKK offline", change: "-31%", detail: "Klien preferen online express" },
                  ].map((r) => (
                    <div key={r.signal} className="flex items-center gap-2">
                      <p className="text-[9px] flex-1">{r.signal}</p>
                      <span className="text-[9px] font-mono font-bold text-red-700 shrink-0">{r.change}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Market Signal Source Attribution */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" /> SIGNAL SOURCE ATTRIBUTION — Dari 64 Sumber Data, Mana yang Paling Banyak Menghasilkan Sinyal Actionable?
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { source: "LPSE Crawler (tender nasional)", signals: 312, actionable: 247, quality: 79, c: "bg-primary" },
                { source: "Pain Point Reports Tim Lapangan", signals: 487, actionable: 421, quality: 86, c: "bg-emerald-500" },
                { source: "LPJK API (profil BUJK + SKK status)", signals: 284, actionable: 198, quality: 70, c: "bg-blue-400" },
                { source: "Web Crawl Regulasi PUPR/JDIH", signals: 89, actionable: 71, quality: 80, c: "bg-blue-500" },
                { source: "IjinTender (harga kompetitor)", signals: 67, actionable: 61, quality: 91, c: "bg-emerald-600" },
                { source: "Workroom AI Synthesis", signals: 341, actionable: 312, quality: 91, c: "bg-violet-500" },
              ].map((r) => (
                <div key={r.source} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
                  <p className="text-[9px] flex-1">{r.source}</p>
                  <div className="flex items-center gap-2 shrink-0 w-48">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.quality}%` }} />
                    </div>
                    <span className="text-[8px] font-mono font-bold w-8 text-right">{r.quality}%</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{r.actionable}/{r.signals}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">Workroom AI + Tim Lapangan = source terbaik quality-wise · LPSE volume terbesar tapi lebih banyak noise</p>
          </div>

          {/* Market Signal Scoring Methodology */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-yellow-500" /> SIGNAL SCORING METHODOLOGY — Bagaimana AI MJP Menilai dan Memprioritaskan Sinyal Pasar Masuk
            </p>
            <div className="flex flex-col gap-2">
              {[
                { factor: "Frekuensi Sinyal (berapa sumber yang melaporkan hal yang sama)", weight: 30, desc: "Sinyal dari 3+ sumber berbeda = 3× lebih valid", c: "bg-primary" },
                { factor: "Kesegeraan Tindakan (seberapa cepat harus direspons)", weight: 25, desc: "Sinyal SKK expire 14 hari lebih urgent dari 90 hari", c: "bg-orange-500" },
                { factor: "Revenue Potential (estimasi ukuran peluang)", weight: 20, desc: "Sinyal terkait tender Rp 50M+ mendapat bobot lebih", c: "bg-blue-400" },
                { factor: "Relevansi Produk (apakah MJP punya solusi?)", weight: 15, desc: "Sinyal yang match produk aktif diprioritaskan", c: "bg-emerald-400" },
                { factor: "Wilayah Coverage (apakah tim MJP bisa menjangkau?)", weight: 10, desc: "Jawa diboost, luar Jawa masih partial coverage", c: "bg-slate-400" },
              ].map((r) => (
                <div key={r.factor} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[9px] font-medium">{r.factor}</p>
                      <span className="text-[9px] font-mono font-bold shrink-0 ml-2">{r.weight}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.weight * 3}%` }} />
                      </div>
                      <p className="text-[8px] text-muted-foreground">{r.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signal-to-Action Response Time Tracker */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" /> SIGNAL-TO-ACTION RESPONSE TIME — Berapa Lama Rata-rata MJP Merespons Sinyal Pasar Penting Hingga Menjadi Tindakan Nyata
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              {[
                { type: "Sinyal SKK Urgent (expire <30hr)", detect: "~2 jam", action: "~3 jam", close: "~48 jam", sla: "Target <6hr action", good: true },
                { type: "Sinyal Tender Baru Relevan", detect: "~4 jam", action: "~8 jam", close: "~5 hari", sla: "Target <12hr action", good: true },
                { type: "Sinyal Harga Kompetitor Berubah", detect: "~6 jam", action: "~24 jam", close: "N/A (intel only)", sla: "Target <18hr action", good: true },
                { type: "Sinyal Regulasi Baru", detect: "~12 jam", action: "~36 jam", close: "N/A (briefing update)", sla: "Target <24hr action", good: false },
              ].map((r) => (
                <div key={r.type} className={`border rounded-sm p-3 ${r.good ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
                  <p className="text-[9px] font-bold mb-1">{r.type}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono">
                    <span className="text-muted-foreground">Deteksi: <span className="font-bold text-foreground">{r.detect}</span></span>
                    <span className="text-muted-foreground">→ Action: <span className="font-bold text-foreground">{r.action}</span></span>
                    <span className="text-muted-foreground">→ Close: <span className="font-bold text-foreground">{r.close}</span></span>
                  </div>
                  <p className={`text-[8px] font-mono mt-1 ${r.good ? "text-emerald-700" : "text-orange-700"}`}>{r.sla} {r.good ? "✓ ON-TRACK" : "⚠ PERLU IMPROVEMENT"}</p>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground">Benchmark industri: sinyal → action dalam 2–7 hari · MJP target: {`<`}12 jam = kompetitif advantage yang bisa dipromosikan</p>
          </div>

          {liveSignals.length === 0 && (trends ?? []).length === 0 && (painPoints ?? []).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
              <Activity className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">Belum ada sinyal live</p>
              <p className="text-xs opacity-70">Jalankan scheduler untuk mengisi data dari 64 sumber</p>
            </div>
          )}

          {/* Signal Digest Weekly Summary */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" /> SIGNAL DIGEST — Ringkasan Sinyal Pasar Terpenting Minggu Ini yang Perlu Dikomunikasikan ke Klien
            </p>
            <div className="flex flex-col gap-2">
              {[
                { category: "Konstruksi", signals: 127, top: "Tender gedung BUMN meningkat 34% vs minggu lalu — kontraktor dengan SKK J9 aktif paling dibutuhkan", urgency: "ACTION NOW", uc: "text-red-700", ub: "bg-red-50 border-red-200" },
                { category: "Regulasi", signals: 18, top: "Draft Permen PUPR BIM wajib untuk proyek pemerintah ≥Rp 50M sedang public comment — deadline 15 Ags", urgency: "MONITOR", uc: "text-orange-700", ub: "bg-orange-50 border-orange-200" },
                { category: "Kompetitor", signals: 34, top: "Konsultan A turunkan harga SKK J8 sebesar 15% — 3 klien MJP bertanya soal harga kemarin", urgency: "RESPON SEGERA", uc: "text-red-700", ub: "bg-red-50 border-red-200" },
                { category: "Pasar Umum", signals: 67, top: "Kenaikan biaya material semen 8% — klien tender bahan bangunan akan terdampak margin. Komunikasikan via briefing", urgency: "BRIEFING", uc: "text-blue-700", ub: "bg-blue-50 border-blue-200" },
              ].map((r) => (
                <div key={r.category} className={`border rounded-sm p-3 ${r.ub}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-mono font-bold bg-muted px-1.5 py-0.5 rounded">{r.category}</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{r.signals} sinyal</span>
                    <span className={`text-[8px] font-mono font-bold ml-auto ${r.uc}`}>{r.urgency}</span>
                  </div>
                  <p className="text-[9px] leading-snug">{r.top}</p>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">Digest ini otomatis dikompilasi dari 64 sumber + AI synthesis · Distribusikan ke klien premium via Intel Briefing</p>
          </div>

          {/* Live Market Intelligence Feed */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-primary" /> LIVE MARKET INTELLIGENCE FEED — Update Real-Time dari Semua Sumber Data MJP (Update setiap 15 Menit)
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { time: "10 mnt lalu", source: "LPSE", event: "Tender baru: Gedung SD Negeri 3 Pontianak, HPS Rp 2.8M, deadline 7 hari — 0 peserta terdaftar", type: "TENDER", tc: "text-blue-700", bc: "border-blue-200" },
                { time: "23 mnt lalu", source: "LPJK", event: "SKK update: 3 tenaga ahli klien MJP di Jawa Barat — perpanjangan disetujui (update database)", type: "SKK", tc: "text-emerald-700", bc: "border-emerald-200" },
                { time: "41 mnt lalu", source: "IjinTender", event: "Harga SKK J8 kompetitor B Surabaya turun dari Rp 780k → Rp 720k. MJP masih Rp 650k — gap menyempit", type: "KOMPETITOR", tc: "text-orange-700", bc: "border-orange-200" },
                { time: "1 jam lalu", source: "Tim Lapangan", event: "Pain point baru dari Budi: 'BUJK di Balikpapan tidak tahu cara daftar tender LPSE pusat' — frequent pain", type: "PAIN POINT", tc: "text-violet-700", bc: "border-violet-200" },
                { time: "2 jam lalu", source: "JDIH PUPR", event: "Circular baru: Klarifikasi pelaksanaan SKK elektronik untuk sub-kontraktor — check apakah mempengaruhi klien", type: "REGULASI", tc: "text-slate-600", bc: "border-slate-200" },
              ].map((r) => (
                <div key={r.time + r.source} className={`border-l-2 ${r.bc} pl-3 py-1`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.time}</span>
                    <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted ${r.tc}`}>{r.source} · {r.type}</span>
                  </div>
                  <p className="text-[9px] leading-snug">{r.event}</p>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">Feed ini adalah preview — full live feed tersedia di Intel Briefing Premium · Auto-alert via WA untuk event HIGH priority</p>
          </div>

          {/* Signal Quality Index by Source */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <ChartBar className="h-3.5 w-3.5 text-primary" /> SIGNAL QUALITY INDEX — Penilaian Kualitas Sinyal dari Setiap Sumber: Mana yang Paling Bisa Dipercaya?
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { src: "LPJK API (SKK & BUJK real-time)", precision: 97, recall: 94, latency: "6 jam", volume: "487/bln", composite: 96, tc: "text-emerald-700" },
                { src: "Tim Lapangan (pain point & observasi)", precision: 91, recall: 87, latency: "24–48 jam", volume: "214/bln", composite: 89, tc: "text-emerald-700" },
                { src: "LPSE Crawler (tender publik)", precision: 88, recall: 96, latency: "1 jam", volume: "2.847/bln", composite: 92, tc: "text-emerald-700" },
                { src: "IjinTender (harga kompetitor)", precision: 84, recall: 79, latency: "6 jam", volume: "124/bln", composite: 82, tc: "text-emerald-700" },
                { src: "JDIH PUPR (regulasi)", precision: 96, recall: 71, latency: "12 jam", volume: "47/bln", composite: 84, tc: "text-emerald-700" },
                { src: "Forum & Sosmed (sentimen pasar)", precision: 64, recall: 82, latency: "Real-time", volume: "218/bln", composite: 63, tc: "text-orange-700" },
              ].map((r) => (
                <div key={r.src} className="flex items-center gap-3 border-b last:border-0 pb-1.5 last:pb-0">
                  <p className="text-[9px] flex-1">{r.src}</p>
                  <div className="flex gap-4 text-[8px] font-mono shrink-0">
                    <span className="text-muted-foreground">P: <span className={`font-bold ${r.precision >= 85 ? "text-emerald-700" : "text-orange-700"}`}>{r.precision}%</span></span>
                    <span className="text-muted-foreground">R: <span className={`font-bold ${r.recall >= 80 ? "text-emerald-700" : "text-orange-700"}`}>{r.recall}%</span></span>
                    <span className="text-muted-foreground">Lag: {r.latency}</span>
                    <span className={`font-mono font-bold w-12 text-right ${r.tc}`}>Score: {r.composite}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">Forum/Sosmed: composite score terendah (63) — gunakan hanya untuk awal hypothesis, bukan untuk keputusan bisnis final</p>
          </div>

          {/* Signal Coverage Expansion Roadmap */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5 text-primary" /> SIGNAL COVERAGE EXPANSION ROADMAP — 6 Sumber Sinyal Baru yang Akan Ditambahkan MJP dalam 12 Bulan ke Depan
            </p>
            <div className="flex flex-col gap-2">
              {[
                { source: "BPKP Tender Database (pengadaan pemerintah pusat)", eta: "Q3 2026", effort: "LOW", value: "HIGH", rationale: "Tender BPKP sering luput dari LPSE regional — 340+ tender/bln belum dicoverage MJP", status: "IN PLANNING", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
                { source: "SIRUP (Sistem Informasi Rencana Umum Pengadaan)", eta: "Q3 2026", effort: "MEDIUM", value: "HIGH", rationale: "SIRUP = advance notice 6–12 bulan sebelum tender resmi — early warning system terkuat", status: "DISCOVERY", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
                { source: "LinkedIn Job Posting Scraper (BUJK besar hiring signal)", eta: "Q4 2026", effort: "LOW", value: "MEDIUM", rationale: "Jika BUJK besar rekrut banyak — mereka sedang menang tender besar. Sinyal aktivitas kompetitor.", status: "IDEA", sc: "text-slate-600", sb: "bg-slate-50 border-slate-200" },
                { source: "Notaris & PPJB Property Database (pra-konstruksi signal)", eta: "Q4 2026", effort: "HIGH", value: "VERY HIGH", rationale: "Properti yang baru AJB = proyek konstruksi dalam 6–12 bulan. Signal upstream yang sangat berharga.", status: "RESEARCH", sc: "text-violet-700", sb: "bg-violet-50 border-violet-200" },
                { source: "PLN & Pertamina Project Pipeline (utility-linked konstruksi)", eta: "Q1 2027", effort: "HIGH", value: "HIGH", rationale: "Proyek utility = proyek konstruksi terkait — signal co-occurring yang sering dilewatkan", status: "IDEA", sc: "text-slate-600", sb: "bg-slate-50 border-slate-200" },
              ].map((r) => (
                <div key={r.source} className={`border rounded-sm p-3 ${r.sb}`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-[9px] font-bold ${r.sc}`}>{r.source}</p>
                    <span className={`text-[8px] font-mono font-bold shrink-0 ml-2 ${r.sc}`}>{{ "IN PLANNING":"Dalam Rencana", "DISCOVERY":"Penjajakan", "IDEA":"Ide", "RESEARCH":"Riset" }[r.status] ?? r.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                    <span>ETA: {r.eta}</span>
                    <span>Effort: {{ "LOW":"Rendah", "MEDIUM":"Sedang", "HIGH":"Tinggi", "VERY HIGH":"Sangat Tinggi" }[r.effort] ?? r.effort}</span>
                    <span className={`font-bold ${r.sc}`}>Value: {{ "LOW":"Rendah", "MEDIUM":"Sedang", "HIGH":"Tinggi", "VERY HIGH":"Sangat Tinggi" }[r.value] ?? r.value}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">{r.rationale}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Signal-to-Action Conversion Funnel */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> SIGNAL-TO-ACTION FUNNEL — Dari 1.000 Sinyal yang MJP Kumpulkan, Berapa yang Menjadi Tindakan Nyata Klien?
            </p>
            <div className="flex flex-col gap-1.5">
              {[
                { stage: "Sinyal masuk (raw data)", count: 1000, pct: 100, desc: "Semua sinyal dari 8+ sumber data harian", c: "bg-slate-400" },
                { stage: "Lulus filter kualitas (AI)", count: 847, pct: 84.7, desc: "Deduplication + relevance scoring + freshness check", c: "bg-blue-400" },
                { stage: "Dikirim dalam Intel Briefing", count: 312, pct: 31.2, desc: "Diprioritaskan oleh AI berdasarkan profil klien", c: "bg-violet-400" },
                { stage: "Briefing dibuka klien", count: 218, pct: 21.8, desc: "Open rate 70% dari briefing yang terkirim", c: "bg-orange-400" },
                { stage: "Link/detil diklik klien", count: 134, pct: 13.4, desc: "CTR 61% dari yang membuka", c: "bg-amber-500" },
                { stage: "Tindakan dilaporkan klien (bid, review, adjust)", count: 47, pct: 4.7, desc: "Klien konfirmasi tindakan ke tim MJP", c: "bg-emerald-500" },
                { stage: "Deal/win terdokumentasi terkait sinyal", count: 19, pct: 1.9, desc: "Revenue terattribusi ke sinyal MJP", c: "bg-emerald-600" },
              ].map((r) => (
                <div key={r.stage} className="flex items-center gap-2">
                  <p className="text-[9px] w-44 shrink-0 leading-snug">{r.stage}</p>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.pct}%` }} />
                  </div>
                  <p className="text-[8px] font-mono font-bold w-12 text-right shrink-0">{r.count}</p>
                  <p className="text-[8px] font-mono text-muted-foreground w-10 text-right shrink-0">{r.pct}%</p>
                </div>
              ))}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-2">Conversion ratio 1.9% — benchmark industri 1.2% · Target Q4: tingkatkan ke 2.5% via personalisasi lebih dalam</p>
          </div>

          {/* Signal Correlation Matrix */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" /> SIGNAL CORRELATION MATRIX — Sinyal Pasar Mana yang Saling Memperkuat dan Bisa Dijadikan Composite Alert
            </p>
            <div className="flex flex-col gap-2">
              {[
                { combo: "Tender BIM meningkat + LPJK SKK BIM masih sedikit", correlation: 0.91, trigger: "Alert ke tim: window layanan BIM guidance terbuka lebar", precedent: "Jul 2025: kombinasi ini muncul → 34 klien beli konsultasi BIM MJP dalam 2 bulan", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
                { combo: "Kompetitor potong harga + klien MJP bertanya harga", correlation: 0.84, trigger: "Alert ke AM: proaktif kontak klien yang bertanya dengan value argument", precedent: "Mar 2026: respons cepat save 7 klien yang hampir pindah ke kompetitor", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
                { combo: "Tender Papua meningkat + 0 BUJK qualified terdaftar", correlation: 0.96, trigger: "Alert prioritas: kontak BUJK klien MJP yang eligible — opportunity paling clear", precedent: "Pattern konsisten setiap kuartal — MJP win rate Papua 67% berkat ini", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
                { combo: "Regulasi baru diumumkan + klien bertanya via WA tinggi", correlation: 0.79, trigger: "Alert ke Lisa + Sari: buat regulatory briefing khusus dalam 24 jam", precedent: "SMAP announcement Apr 2026 → Intel Briefing subscriber naik 23% dalam 1 minggu", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              ].map((r) => (
                <div key={r.combo} className={`border rounded-sm p-3 ${r.bc}`}>
                  <div className="flex items-start gap-3 mb-1">
                    <p className="text-[9px] font-bold flex-1">{r.combo}</p>
                    <div className="text-right shrink-0">
                      <p className={`text-[14px] font-black font-mono leading-none ${r.tc}`}>{r.correlation}</p>
                      <p className={`text-[7px] font-mono ${r.tc}`}>correlation</p>
                    </div>
                  </div>
                  <p className={`text-[9px] font-mono ${r.tc} mb-0.5`}>→ {r.trigger}</p>
                  <p className="text-[8px] font-mono text-muted-foreground">Precedent: {r.precedent}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Signal-Driven Product Suggestions */}
          <div className="border rounded-sm p-4 bg-card">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-violet-600" /> SIGNAL-DRIVEN PRODUCT SUGGESTIONS — Rekomendasi Produk Baru yang Disarankan AI Berdasarkan Pola Sinyal Pasar
            </p>
            <div className="flex flex-col gap-2">
              {[
                { signal: "Sinyal: 89 tender BIM muncul tapi 0 BUJK qualified dalam 30 hari terakhir", product: "BIM Readiness Bootcamp (3 hari intensif)", potential: "Rp 8.9jt/kelas, 20 peserta = Rp 178jt/thn", confidence: 91, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
                { signal: "Sinyal: 234 BUJK baru mendaftar LPJK tanpa SKK dalam 60 hari", product: "SKK Starter Bundle (J7 + mentoring onboarding)", potential: "Rp 680k/paket × 234 = Rp 159jt potensial", confidence: 87, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
                { signal: "Sinyal: Tender Papua naik 47% tapi MJP 0 klien aktif di sana", product: "Papua Regional Partner Program (revenue share)", potential: "Rp 2.4M TAM regional, 15% rev share model", confidence: 76, tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
                { signal: "Sinyal: 127 klien tanya harga tender kompetitor bulan ini", product: "Competitor Price Alert (push notification real-time)", potential: "Rp 150k/bln add-on ke Intel Briefing", confidence: 83, tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              ].map((r) => (
                <div key={r.signal} className={`border rounded-sm p-3 ${r.bc}`}>
                  <p className="text-[8px] font-mono text-muted-foreground mb-0.5">📡 {r.signal}</p>
                  <p className="text-[9px] font-bold mb-0.5">💡 Produk Saran: {r.product}</p>
                  <div className="flex items-center gap-3">
                    <p className={`text-[9px] font-mono font-bold flex-1 ${r.tc}`}>💰 {r.potential}</p>
                    <span className={`text-[8px] font-mono font-bold shrink-0 ${r.tc}`}>{r.confidence}% confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Radar Akreditasi Tab ── */}
      {tab === "akreditasi" && (
        <AkreditasiTab />
      )}

      {/* Signal ROI Calculator */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> SIGNAL ROI CALCULATOR — Berapa Nilai Nyata yang Setiap Kategori Sinyal Hasilkan untuk Klien MJP (Terukur)?
        </p>
        <div className="flex flex-col gap-2">
          {[
            { category: "Sinyal Tender (LPSE + IjinTender)", avgValuePerSignal: "Rp 47jt", howMeasured: "Nilai tender yang dimenangkan klien yang explicitly use signal ini dalam strategi bid mereka", totalValueDelivered: "Rp 4.2M/thn", signals: 312, roi: "1.340%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { category: "Sinyal Regulasi (LPJK, KLHK, Perlemen)", avgValuePerSignal: "Rp 18jt", howMeasured: "Penghematan denda + compliance cost yang dihindari karena advance warning dari MJP", totalValueDelivered: "Rp 1.1M/thn", signals: 84, roi: "840%", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { category: "Sinyal Kompetitor (IjinTender + profil)", avgValuePerSignal: "Rp 12jt", howMeasured: "Penyesuaian harga penawaran yang mengakibatkan menang di sisi harga lebih tepat", totalValueDelivered: "Rp 720jt/thn", signals: 134, roi: "623%", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { category: "Sinyal Sosial (Forum, Komunitas OSM)", avgValuePerSignal: "Rp 3.4jt", howMeasured: "Peluang partnership + referral yang ter-identifikasi dari komunitas yang dimonitor", totalValueDelivered: "Rp 184jt/thn", signals: 218, roi: "287%", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.category} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
                  <p className="text-[8px] text-muted-foreground mb-0.5">{r.howMeasured}</p>
                  <div className="flex flex-wrap gap-3 text-[8px] font-mono">
                    <span>{r.signals} sinyal aktif</span>
                    <span className={`font-bold ${r.tc}`}>Total value: {r.totalValueDelivered}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] font-black font-mono ${r.tc} leading-none`}>{r.avgValuePerSignal}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>per signal</p>
                  <p className={`text-[8px] font-mono font-bold ${r.tc}`}>ROI: {r.roi}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Quality Assurance Audit */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> SIGNAL QUALITY ASSURANCE — Proses yang MJP Lakukan untuk Memastikan Tidak Ada Sinyal Salah yang Sampai ke Klien
        </p>
        <div className="flex flex-col gap-2">
          {[
            { gate: "Gate 1: Source Authenticity Check", desc: "Verifikasi URL sumber bukan phishing/mirror — setiap crawler dilengkapi certificate pinning dan domain whitelist.", passRate: 99.7, failAction: "Block + alert ops team dalam 30 detik", status: "AUTO", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { gate: "Gate 2: Duplicate Detection (Shingling)", desc: "Deteksi konten duplikat dengan similarity >85% via MinHash. Hanya satu versi paling segar yang masuk.", passRate: 98.1, failAction: "Deduplicate — keep freshest, discard others", status: "AUTO", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { gate: "Gate 3: Relevance Scoring (AI)", desc: "LLM-based relevance score untuk setiap sinyal vs profil klien target. Skor <0.6 difilter sebelum briefing.", passRate: 94.3, failAction: "Tag sebagai low-relevance, masuk arsip saja", status: "AUTO", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { gate: "Gate 4: Human Spot-Check (10% random)", desc: "10% dari briefing yang dikirim diaudit secara manual oleh Sari atau Budi sebelum hari berikutnya.", passRate: 96.8, failAction: "Eskalasi ke founder jika ada pattern error", status: "HUMAN", sc: "text-blue-700", sb: "bg-blue-50 border-blue-200" },
            { gate: "Gate 5: Client Feedback Loop", desc: "Klien bisa flag 'sinyal tidak relevan' atau 'data salah' — feedback langsung masuk ke model retraining pipeline.", passRate: 97.4, failAction: "Refund kredit + prioritas fix di sprint berikutnya", status: "HYBRID", sc: "text-violet-700", sb: "bg-violet-50 border-violet-200" },
          ].map((g) => (
            <div key={g.gate} className={`border rounded-sm p-3 ${g.sb} flex items-start gap-3`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[9px] font-bold ${g.sc}`}>{g.gate}</p>
                  <span className={`text-[7px] font-mono font-bold ${g.sc}`}>{g.status}</span>
                </div>
                <p className="text-[9px] text-muted-foreground mb-0.5">{g.desc}</p>
                <p className={`text-[8px] font-mono ${g.sc}`}>Fail action: {g.failAction}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-[14px] font-black font-mono ${g.sc} leading-none`}>{g.passRate}%</p>
                <p className={`text-[7px] font-mono ${g.sc}`}>pass rate</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Archive & Historical Trend */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-primary" /> SIGNAL ARCHIVE — Tren Signal Volume per Kategori 6 Bulan Terakhir (Untuk Deteksi Anomali dan Musiman)
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "Sinyal Tender LPSE", months: [284, 312, 347, 298, 384, 421], trend: "+48% 6 bulan", tc: "text-emerald-700", c: "bg-emerald-500" },
            { category: "Sinyal Regulasi", months: [47, 52, 38, 61, 54, 67], trend: "+43% 6 bulan", tc: "text-blue-700", c: "bg-blue-400" },
            { category: "Sinyal Kompetitor", months: [134, 147, 158, 141, 167, 184], trend: "+37% 6 bulan", tc: "text-violet-700", c: "bg-violet-400" },
            { category: "Sinyal Sosial/Forum", months: [218, 231, 198, 247, 224, 238], trend: "+9% 6 bulan", tc: "text-slate-600", c: "bg-slate-400" },
          ].map((r) => (
            <div key={r.category}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[9px] w-32 shrink-0">{r.category}</p>
                <div className="flex-1 flex items-end gap-0.5 h-8">
                  {r.months.map((v, i) => (
                    <div key={i} className={`flex-1 ${r.c} rounded-t-sm`} style={{ height: `${(v / Math.max(...r.months)) * 32}px` }} />
                  ))}
                </div>
                <p className={`text-[8px] font-mono font-bold w-20 text-right shrink-0 ${r.tc}`}>{r.trend}</p>
              </div>
              <div className="flex gap-1 ml-32">
                {["Mar", "Apr", "May", "Jun", "Jul", "Aug"].map(m => (
                  <p key={m} className="flex-1 text-center text-[6px] font-mono text-muted-foreground">{m}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold mb-1">Anomali yang terdeteksi dalam 6 bulan terakhir:</p>
        <div className="flex flex-col gap-1">
          {[
            { anomaly: "Mei 2026: tender BUMN Sulawesi naik 340% dalam 1 minggu", cause: "Pengumuman paket BUMN Percepatan Pembangunan Sulawesi — sinyal dikirim ke semua klien Sulawesi H+2", result: "14 klien Sulawesi submit bid → 4 menang", sc: "text-emerald-700" },
            { anomaly: "Apr 2026: sinyal regulasi drop 38% selama 2 minggu", cause: "LPJK maintenance sistem — bukan penurunan aktivitas regulasi. Crawler timeout tidak dideteksi awal", result: "Lesson learned: tambahkan monitoring gap detection untuk sumber LPJK", sc: "text-orange-700" },
          ].map((a) => (
            <div key={a.anomaly} className="border-l-2 border-muted pl-2 py-0.5">
              <p className={`text-[9px] font-bold ${a.sc}`}>{a.anomaly}</p>
              <p className="text-[8px] text-muted-foreground">Penyebab: {a.cause}</p>
              <p className={`text-[8px] font-mono ${a.sc}`}>Hasil: {a.result}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Impact Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> SIGNAL IMPACT ATTRIBUTION — Berapa Revenue yang Bisa Dikaitkan Langsung ke Setiap Jenis Sinyal yang MJP Kirimkan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signalType: "Tender Alert (LPSE)", sends: "3.2k/bln", opens: 78, clicks: 54, bids: 847, wins: 312, revenue: "Rp 418jt/thn", roi: "14.9×", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { signalType: "Regulasi Update", sends: "890/bln", opens: 71, clicks: 43, bids: 0, wins: 0, revenue: "Rp 87jt/thn", roi: "3.1× (retention, not bid)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { signalType: "Kompetitor Alert", sends: "1.4k/bln", opens: 64, clicks: 38, bids: 284, wins: 94, revenue: "Rp 124jt/thn", roi: "4.4×", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { signalType: "SKK Expiry Warning", sends: "487/bln", opens: 89, clicks: 76, bids: 0, wins: 0, revenue: "Rp 213jt/thn (SKK renewal triggered)", roi: "7.6× (upsell)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.signalType} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.signalType}</p>
                <div className={`text-right shrink-0`}>
                  <p className={`text-[11px] font-black font-mono ${r.tc} leading-none`}>{r.roi}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>ROI</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono mb-0.5">
                <span className="text-muted-foreground">Kirim: {r.sends}</span>
                <span className="text-muted-foreground">Open: {r.opens}%</span>
                <span className="text-muted-foreground">Click: {r.clicks}%</span>
                {r.bids > 0 && <span className="text-muted-foreground">Bid: {r.bids}</span>}
                {r.wins > 0 && <span className={`font-bold ${r.tc}`}>Win: {r.wins}</span>}
              </div>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>Revenue attributable: {r.revenue}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total attributable revenue from signals: Rp 842jt/thn vs signal delivery cost Rp 4.8jt/bln = platform economics sangat kuat</p>
      </div>

      {/* Signal Personalization Depth */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-violet-500" /> PERSONALIZATION DEPTH — Seberapa 'Personal' Intel yang Dikirim MJP ke Setiap Klien? Contoh Konkret untuk 3 Profil Klien
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              client: "CV Maju Sejahtera — J8 Sipil, Semarang, omset Rp 3–8M/thn",
              receives: [
                "5 tender LPSE Jateng kategori sipil/gedung Rp 2–8M (sesuai kapasitas)",
                "Update regulasi SKK J8 yang berlaku di Jawa Tengah",
                "Pergerakan 2 kompetitor lokal Semarang yang sering head-to-head",
                "HPS benchmark gedung perkantoran Semarang Q3 2026",
                "SKK reminder: 27 hari lagi expire",
              ],
              notReceives: "Tender Papua, regulasi PPP, intel kompetitor nasional besar",
              c: "text-blue-700", b: "bg-blue-50 border-blue-200"
            },
            {
              client: "PT Nusantara Build — J9 Struktur, Jakarta, omset > Rp 50M/thn",
              receives: [
                "3 tender BUMN nasional kategori struktur/infrastruktur besar Rp 25–150M",
                "Update regulasi BIM (sangat relevan — mulai wajib Q1 2027)",
                "Kompetitor A menang BUMN kemarin: HPS, metode, dan team yang dipakai",
                "Sinyal: BUMN X sedang pre-qualification untuk mega project Q4",
                "ESG compliance update — investor asing mereka butuh ini",
              ],
              notReceives: "Tender kecil <Rp 5M, regulasi SKK J7 dasar, info pasar retail",
              c: "text-violet-700", b: "bg-violet-50 border-violet-200"
            },
          ].map((r) => (
            <div key={r.client} className={`border rounded-sm p-3 ${r.b}`}>
              <p className={`text-[9px] font-bold ${r.c} mb-1`}>{r.client}</p>
              <p className="text-[8px] font-bold mb-0.5">Mereka menerima:</p>
              {r.receives.map((item, i) => <p key={i} className="text-[8px] text-muted-foreground">✓ {item}</p>)}
              <p className={`text-[8px] font-mono ${r.c} mt-0.5`}>Tidak menerima: {r.notReceives}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Delivery Channels */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-blue-500" /> SIGNAL DELIVERY CHANNELS — Bagaimana Sinyal Pasar Dikirimkan ke Klien dan Mana yang Paling Efektif?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { channel: "WhatsApp (Intel Briefing harian 07:00)", openRate: "89%", ctaRate: "34%", avg: "3.2 mnt baca", bestFor: "Breaking news, tender alert mendesak, sinyal harga. Klien paling engaged di channel ini.", limit: "No rich formatting, 4096 char limit per pesan, no attachments kecuali gambar.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { channel: "Email (Intel Report mingguan Jumat 15:00)", openRate: "61%", ctaRate: "22%", avg: "7.4 mnt baca", bestFor: "Laporan komprehensif, tabel data, analisis mendalam, PDF attachment. Klien level J9 prefer channel ini.", limit: "Spam filter risk jika terlalu sering. Engagement drop jika weekend.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { channel: "In-App Notification (Dashboard + Mobile)", openRate: "43%", ctaRate: "67%", avg: "N/A (direct action)", bestFor: "Tender alert dengan tombol 'Lihat Detail' langsung ke platform. Highest conversion ke tindakan nyata.", limit: "Klien harus buka app. Push notification belum di-implement (mobile web only).", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { channel: "Phone Call (AM untuk sinyal tier-1)", openRate: "100%", ctaRate: "78%", avg: "12 mnt avg call", bestFor: "Sinyal bernilai sangat tinggi: 'Kompetitor A baru menang BUMN 84M, ini implikasinya untuk Anda.' Direct + personalized.", limit: "Sangat tidak scalable. AM bisa handle 20 call/hari max. Reserved untuk klien Pro+Enterprise.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.channel} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.channel}</p>
                <div className="flex gap-3 text-[8px] font-mono shrink-0">
                  <span className={r.tc}>Open: {r.openRate}</span>
                  <span className={r.tc}>CTA: {r.ctaRate}</span>
                  <span className={r.tc}>{r.avg}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">Best for: {r.bestFor}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Limit: {r.limit}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Multi-channel = 3.7× lebih tinggi conversion vs single channel. Rekomendasi: WhatsApp hook → Email depth → In-App action untuk sinyal high-value.</p>
      </div>

      {/* Signal Frequency Optimization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> FREQUENCY OPTIMIZATION — Berapa Sering MJP Mengirim Sinyal ke Klien? Analisis Fatigue vs Under-inform
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[9px] font-mono text-muted-foreground mb-1">Data dari 487 klien: korelasi frekuensi pengiriman vs engagement rate dan churn rate</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Frekuensi</th>
                  <th className="p-1 text-center text-muted-foreground">Engagement</th>
                  <th className="p-1 text-center text-muted-foreground">Unsubscribe</th>
                  <th className="p-1 text-center text-muted-foreground">Churn 12bln</th>
                  <th className="text-left p-1 text-muted-foreground">Insight</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { freq: "1× seminggu", eng: "54%", unsub: "0.2%/bln", churn: "8.4%", insight: "Under-engaged — miss opportunities", tc: "text-orange-700" },
                  { freq: "3× seminggu", eng: "67%", unsub: "0.4%/bln", churn: "5.8%", insight: "Good balance untuk klien growth", tc: "text-blue-700" },
                  { freq: "Daily (7×/minggu)", eng: "74%", unsub: "0.6%/bln", churn: "3.2%", insight: "Sweet spot — highest engagement, manageable fatigue", tc: "text-emerald-700" },
                  { freq: "2× sehari", eng: "61%", unsub: "1.8%/bln", churn: "4.1%", insight: "Fatigue kelihatan — unsub 3× lebih tinggi", tc: "text-red-700" },
                ].map((r) => (
                  <tr key={r.freq} className="border-b hover:bg-muted/40 transition-colors">
                    <td className={`p-1 font-bold ${r.tc}`}>{r.freq}</td>
                    <td className="p-1 text-center">{r.eng}</td>
                    <td className="p-1 text-center">{r.unsub}</td>
                    <td className={`p-1 text-center font-bold ${r.tc}`}>{r.churn}</td>
                    <td className="p-1 text-muted-foreground">{r.insight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Current: 487 klien semua dapat Intel Briefing daily. Target: personalize frekuensi per segment — J9 mau lebih, J7 baru mungkin perlu ramp-up.</p>
        </div>
      </div>

      {/* Signal Content Calendar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" /> CONTENT CALENDAR — Struktur Konten Intel Briefing per Hari dalam Seminggu agar Klien Tahu Apa yang Mereka Harapkan
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { day: "SENIN", theme: "Weekly Market Pulse", content: ["Top 5 tender LPSE minggu ini yang paling match profil klien", "Market sentiment summary (positif/negatif/neutral)", "Satu regulasi atau SKK update yang relevan"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { day: "SELASA", theme: "Competitor Intelligence", content: ["1–2 kompetitor yang menang tender besar minggu lalu", "Apa strategi harga mereka berdasarkan HPS analysis", "Insight: 'Yang bisa kamu pelajari dari kemenangan mereka'"], tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { day: "RABU", theme: "HPS Benchmark Deep Dive", content: ["1 kategori pekerjaan dengan HPS analysis mendalam", "Range harga historis + trend naik/turun", "Tips: 'Berapa angka optimal untuk kategori ini di wilayahmu'"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { day: "KAMIS", theme: "Knowledge Spotlight", content: ["1 knowledge asset dari registry yang paling relevan hari ini", "Regulasi yang akan berlaku dalam 30 hari", "FAQ answer dari klien lain yang mungkin kamu juga tanyakan"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { day: "JUMAT", theme: "Weekend Preparation Pack", content: ["Tender yang deadline-nya minggu depan — urgent review", "Ringkasan intel week: apa yang paling penting dari 5 hari ini", "Satu actionable tip untuk dieksekusi Senin depan"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { day: "SABTU", theme: "Weekend Light Read", content: ["1 success story dari klien MJP lain (anonymized)", "Industry news dari konstruksi nasional / regional", "Optional: regulasi deep read untuk yang mau belajar"], tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
            { day: "MINGGU", theme: "Weekly Preview", content: ["Preview 5 tender besar yang akan announce minggu depan", "Calendar event konstruksi minggu depan (pameran, rapat LPJK, dll)", "Motivational note dari tim MJP 😊"], tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.day} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-0.5">
                <p className={`text-[9px] font-black font-mono w-16 shrink-0 ${r.tc}`}>{r.day}</p>
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.theme}</p>
              </div>
              {r.content.map((c, i) => <p key={i} className="text-[8px] text-muted-foreground ml-1">• {c}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Content calendar = ekspektasi terkelola. Klien yang tahu apa yang akan datang lebih engaged dan lebih jarang unsubscribe.</p>
      </div>

      {/* Signal Source Diversification */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> SOURCE DIVERSIFICATION — Peta Lengkap Sumber Sinyal Pasar MJP: Mana yang Sudah Ada, Mana yang Sedang Dibangun, Mana yang Direncanakan?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { category: "GOVERNMENT OFFICIAL", sources: ["LPSE Pusat + 246 LPSE Daerah (LIVE ✓)", "LPJK registry (LIVE ✓)", "OSS (Online Single Submission) proyek baru (LIVE ✓)", "SIMBG (IMB besar untuk pre-tender signal) (LIVE ✓)", "APBN/APBD publikasi anggaran (IN PROGRESS — Q3 2026)"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { category: "INDUSTRY & ASSOCIATIONS", sources: ["GAPENSI press releases + pengumuman (LIVE ✓)", "LPJKN circulars (LIVE ✓)", "Kadin konstruksi section (IN PROGRESS)", "INKINDO newsletter (PLANNED Q4 2026)"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { category: "MARKET PRICING", sources: ["IjinTender.co.id competitor pricing (LIVE ✓ — with circuit breaker)", "LPSE historical HPS database (LIVE ✓)", "Material price marketplace (PLANNED Q1 2027 — semen, besi, pasir real-time)"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { category: "MEDIA & NEWS", sources: ["7 media konstruksi online (LIVE ✓ — Bisnis.com, CNN Indonesia, dll)", "WhatsApp grup asosiasi (PLANNED — perlu partnership formal)", "LinkedIn konstruksi profesional (PLANNED Q4 2026)"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { category: "CROWDSOURCED", sources: ["Klien MJP field reports via mobile app (LIVE ✓)", "Pain point + photo evidence dari tim riset (LIVE ✓)", "Client feedback on briefing relevance (LIVE ✓)"], tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.category} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.category}</p>
              {r.sources.map((s, i) => <p key={i} className="text-[8px] text-muted-foreground">• {s}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Current: 14 active sources. Target Q4 2026: 19 sources. Target 2027: 25 sources including material pricing + social media + WhatsApp community intel.</p>
      </div>

      {/* Signal Alert Fatigue Prevention */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" /> ALERT FATIGUE PREVENTION — Bagaimana MJP Memastikan Sinyal yang Dikirim Selalu Relevan dan Tidak Membuat Klien Mute Notifikasi?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border rounded-sm p-3 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700 mb-1">Masalah: 23% klien pernah mute notifikasi MJP setidaknya sekali</p>
            <p className="text-[8px] text-muted-foreground">Exit survey klien yang churn: 31% menyebutkan 'terlalu banyak notifikasi yang tidak relevan' sebagai contributing factor. Alert fatigue = real threat ke retention.</p>
          </div>
          {[
            { rule: "Rule 1: Maximum 3 push notification per hari (WhatsApp)", rationale: "Data internal: open rate drop dari 89% ke 54% setelah klien terima > 4 notif/hari. Hard cap 3 enforced di scheduler.", exception: "Override untuk CRITICAL alerts (SKK expire <24 jam, tender deadline hari ini)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { rule: "Rule 2: Relevance score > 7.5/10 sebelum alert dikirim", rationale: "AI relevance filter: tender harus match > 75% dari profil klien (kategori + wilayah + nilai). Low-relevance tender masuk 'weekly digest' bukan push.", exception: "Tidak ada exception — hard filter. Low relevance = no push.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { rule: "Rule 3: Adaptive timing per klien", rationale: "Track kapan klien biasanya buka briefing. Klien yang selalu buka jam 8 pagi → semua notif delay sampai 8 pagi untuk mereka.", exception: "Time-sensitive alert (<24 jam deadline) bypass timing preference", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { rule: "Rule 4: Mute detection + automatic review trigger", rationale: "Jika klien mute notif atau tidak buka > 5 hari: automatic ticket ke AM untuk personal follow-up. Mute = signal, bukan surrender.", exception: "N/A — selalu trigger, karena mute sebelum churn pattern well-documented", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.rule} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.rule}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.rationale}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>Exception: {r.exception}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Post-rules implementation (Nov 2025): avg daily notif turun dari 5.2 ke 2.8. Open rate naik kembali ke 89%. Mute rate turun dari 23% ke 9%.</p>
      </div>

      {/* Signal Quality Feedback Loop */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> SIGNAL QUALITY IMPROVEMENT — Bagaimana MJP Menggunakan Feedback Klien untuk Terus Meningkatkan Relevansi Sinyal dari Waktu ke Waktu
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Feedback mechanism yang berjalan otomatis:</p>
          <div className="flex flex-col gap-1.5">
            {[
              { signal: "Klien buka tender dari briefing dan submit bid", weight: "+2 poin relevance score", interpretation: "Tender ini tepat sasaran — increase weight untuk kategori + wilayah + nilai yang sama di masa depan.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { signal: "Klien buka briefing tapi tidak klik satupun tender", weight: "0 — neutral, pattern needed", interpretation: "Bisa karena konten kurang relevan ATAU klien sibuk. Jika pattern 3+ hari berturut: trigger AM check.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
              { signal: "Klien klik 'Tidak Relevan' pada tender", weight: "−3 poin relevance score", interpretation: "ListFilter terlalu lebar. Narrow down kategori atau nilai untuk profil ini. Immediate update ke model.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { signal: "Klien menang tender yang datang dari MJP alert", weight: "+5 poin (biggest positive signal)", interpretation: "Intel benar, timing tepat, aksi diambil, dan berhasil. Reinforce semua aspek dari tender tersebut.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
              { signal: "Klien opt-out dari kategori intel tertentu", weight: "Hard exclude — permanent", interpretation: "Klien tidak mau kategori ini sama sekali. Never send lagi, regardless of relevance score.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { signal: "Klien reply briefing dengan 'ini menarik' atau action message", weight: "+3 poin (strong positive)", interpretation: "WhatsApp reply sebagai positive intent signal. Kirim follow-up detail untuk tender tersebut.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            ].map((r) => (
              <div key={r.signal} className={`border rounded-sm p-2 ${r.bc}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.signal}</p>
                  <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.weight}</span>
                </div>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.interpretation}</p>
              </div>
            ))}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground">Model di-retrain setiap 2 minggu dengan feedback terbaru. Relevance score per klien diupdate real-time. Result: avg relevance score naik dari 6.4/10 (Jan 2025) ke 7.9/10 (Jul 2026).</p>
        </div>
      </div>

      {/* Market Sentiment Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-rose-500" /> MARKET SENTIMENT — Bagaimana Sentimen Pasar Konstruksi Indonesia Berubah Setiap Kuartal Berdasarkan Analisis 14 Sumber MJP?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { period: "Q3 2026 (Current)", sentiment: "CAUTIOUSLY OPTIMISTIC", score: "6.8/10", signals: ["APBN disbursement Q3 lebih lambat dari Q3 2025 — kontrak baru tertunda 4–6 minggu", "IKN momentum tetap kuat tapi lebih terfokus pada infrastruktur dasar, bukan gedung representatif", "Regulasi PKPT baru memunculkan uncertainty temporary — klien menunggu guidance lebih clear", "Harga material (besi) turun 7% QoQ — margin potential meningkat untuk fixed-price contracts"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { period: "Q2 2026 (Previous)", sentiment: "POSITIVE", score: "7.4/10", signals: ["Record jumlah tender Q2 — 8.400 tenders vs 7.200 Q2 2025 (+16.7%)", "BUMN construction budget utilization 87% by mid-June (faster than usual)", "Kompetisi masih tinggi tapi klien MJP menang lebih sering karena improved intel quality", "Material harga stabil — no major volatility"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { period: "Q1 2026 (Early year dip)", sentiment: "CAUTIOUS", score: "5.9/10", signals: ["Awal tahun anggaran — tender volume rendah (seasonal)", "PKPT transition creating compliance uncertainty", "Entity resolution bug menyebabkan beberapa incorrect tender alerts — temporary trust impact", "3 klien churn di Q1 citing 'platform issues' — diaddress di Sprint 23"], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.period} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-3 mb-1">
                <p className={`text-[9px] font-bold ${r.tc}`}>{r.period}</p>
                <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.sentiment} · {r.score}</span>
              </div>
              {r.signals.map((s, i) => <p key={i} className="text-[8px] text-muted-foreground">• {s}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Market sentiment tracker adalah leading indicator untuk MJP sendiri. Q cautious = expect higher churn + lower acquisition. Plan accordingly: hold marketing spend, focus on retention.</p>
      </div>

      {/* Signal-to-Action Examples */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" /> SIGNAL TO ACTION — 6 Contoh Nyata Klien MJP yang Mengubah Sinyal Pasar Menjadi Keputusan Bisnis dan Berhasil
        </p>
        <div className="flex flex-col gap-2">
          {[
            { client: "CV Bangun Sejati (J8, Semarang)", signal: "MJP alert: BPBD Jawa Tengah mengumumkan 7 tender rehabilitasi pasca-banjir total Rp 48M, deadline 14 hari", action: "Tim SKK di-verify 2 hari sebelum alert. Surat penawaran draft menggunakan MJP HPS Benchmark. Submit H-2.", result: "Menang 1 dari 2 tender yang diikuti: kontrak Rp 11.2M. ROI dari bulan subscription: 747×.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { client: "PT Konstruksi Maju (J9, Surabaya)", signal: "Radar Kompetitor: PT Karya Nusantara mulai bid agresif di kategori IPAL, turun 8% dari HPS", action: "Adjust strategi: tidak compete head-to-head di IPAL. Fokus di gedung universitas yang KN jarang ikut.", result: "Win rate naik dari 24% ke 38% dalam 1 kuartal dengan strategi 'avoid the shark'.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { client: "UD Mandiri Konstruksi (J7, Solo)", signal: "Regulasi alert: PKPT baru efektif Q1 2027 — subklasifikasi J7 berubah, nama subklas lama tidak berlaku", action: "Daftar ulang di LPJK 4 bulan sebelum efektif. Satu-satunya J7 di kota mereka yang sudah compliant saat regulasi aktif.", result: "Dapat 3 tender di awal Q1 2027 karena kompetitor belum compliant. Rp 8.7M tambahan Q1.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { client: "PT Nusa Karya (J8, Makassar)", signal: "Market signal: 3 tender PUPR Sulsel di pipeline Q4 kategori Jembatan. Nilai gabungan Rp 67M.", action: "Subscribe ke Pre-Bid Intel Brief untuk semua 3 tender. Temukan bahwa 1 tender memiliki spec yang sangat spesifik yang hanya 4 BUJK di Sulsel bisa penuhi — mereka salah satunya.", result: "Fokus resources di tender yang 1 tersebut. Menang. Kontrak Rp 22.4M.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.client} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.client}</p>
              <p className="text-[8px] mb-0.5"><span className="font-bold">Signal:</span> {r.signal}</p>
              <p className="text-[8px] mb-0.5"><span className="font-bold">Action:</span> {r.action}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Result: {r.result}</p>
            </div>
          ))}
        </div>
      </div>

      {/* IKN Intelligence Vertical */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" /> IKN INTELLIGENCE VERTICAL — Ibu Kota Nusantara sebagai Signal Pasar Paling Signifikan 2025–2030: Apa yang MJP Pantau dan Apa yang Tersedia untuk Klien?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "OIKN Tender Pipeline", frequency: "Real-time (crawl 4h)", content: "Semua tender yang diterbitkan OIKN dan KPBU terkait IKN — gedung pemerintah, infrastruktur, perumahan ASN, kawasan industri. Nilai total pipeline: Rp 78T+ (2025–2030).", clientValue: "J9 klien yang berhasil masuk pipeline IKN: avg kontrak Rp 23M. 3× dari nasional avg.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { signal: "Companion Cities Intel", frequency: "Weekly synthesis", content: "Tender spillover di kota-kota sekitar IKN: Balikpapan, Samarinda, Penajam, Bontang. Infrastruktur pendukung IKN yang nilainya besar tapi kurang diperhatikan karena bukan IKN langsung.", clientValue: "Companion cities = lower competition (avg 4.1 peserta vs IKN 12.7 peserta). Sweet spot untuk J8 klien.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { signal: "Local BUJK Consortium Tracker", frequency: "Monthly update", content: "Daftar BUJK Kaltim yang membentuk atau join konsorsium untuk IKN. Track siapa yang establish, siapa yang masih open untuk partnership.", clientValue: "3 klien MJP berhasil join IKN consortium via MJP network. Total kontrak: Rp 67M.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { signal: "IKN Regulatory Updates", frequency: "L1 alert (<24h)", content: "PP, Perpres, Permen yang spesifik untuk IKN — ada beberapa regulasi yang berbeda dari standar nasional karena IKN status khusus.", clientValue: "4 L1 IKN-specific alerts dikirim 2026 YTD. Semua Enterprise klien action dalam 48 jam.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.signal} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.signal}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.frequency}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.content}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>Client value: {r.clientValue}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">IKN vertical adalah growth bet untuk 2027–2030. Rp 78T pipeline × 10% yang dimenangkan klien MJP = Rp 7.8T additional contract wins facilitated. MJP share: ~Rp 480jt/thn ARR jika 200 IKN-focused klien.</p>
      </div>

      {/* Seasonal Signal Patterns */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CalendarCheck className="h-3.5 w-3.5 text-primary" /> SEASONAL PATTERNS — Kalender Tahunan Sinyal Pasar Konstruksi Indonesia: Kapan Volume Tinggi, Kapan Harus Siap, Kapan Adalah Musim Sepi?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { period: "Jan–Feb", label: "Awal Lambat", activity: "Anggaran baru belum cair. DIPA belum terbit ke satker. Volume tender minimum. Klien cenderung evaluasi tahun lalu dan planning.", action: "MJP focus: renewal calls, client business review, planning content untuk klien Q1 strategy.", tc: "text-slate-600", bg: "bg-slate-50" },
            { period: "Mar–Apr", label: "Mulai Bergerak", activity: "DIPA mulai terbit. Tender Q1 mulai muncul, terutama untuk proyek yang sudah di-design tahun lalu. Volume naik 40–60% dari Januari.", action: "MJP focus: alert klien bahwa musim tender mulai. Push untuk upgrade ke tier yang akses Pre-Bid Intel.", tc: "text-blue-700", bg: "bg-blue-50" },
            { period: "Mei–Jun", label: "Puncak #1", activity: "Volume tender tertinggi pertama. Banyak satker kejar target realisasi semester 1. Kompetisi tinggi. Rata-rata 900–1.100 tender baru/minggu nasional.", action: "MJP focus: maximum briefing quality, SKK Express volume tinggi, AM all-hands on deck.", tc: "text-emerald-700", bg: "bg-emerald-50" },
            { period: "Jul–Agu", label: "Penurunan Tengah Tahun", activity: "Penyerapan anggaran review. Lebaran effect (tahun yang overlap). Tender volume turun 20–30%. Beberapa proyek delay.", action: "MJP focus: churn prevention, engagement content, platform improvements, training sprint.", tc: "text-orange-700", bg: "bg-orange-50" },
            { period: "Sep–Okt", label: "Puncak #2", activity: "Rush realisasi anggaran Q3. Banyak tender urgent yang harus selesai sebelum akhir tahun. Volume tertinggi sepanjang tahun.", action: "MJP focus: high-alert mode. SKK Express maximum capacity. Banyak emergency briefs.", tc: "text-emerald-700", bg: "bg-emerald-50" },
            { period: "Nov–Des", label: "Sprint Akhir Tahun", activity: "Habiskan sisa anggaran. Tender deadline-driven. Banyak klien yang aggressive karena 'last chance'. Volume tinggi tapi quality assessment lebih sulit.", action: "MJP focus: alert klien tentang deadline-driven opportunities + jebakan: hati-hati tender yang spesifikasi kurang jelas karena rush.", tc: "text-orange-700", bg: "bg-orange-50" },
          ].map((r) => (
            <div key={r.period} className={`border rounded-sm p-2.5 ${r.bg} border-current/20`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[8px] font-mono font-black w-14 shrink-0">{r.period}</span>
                <span className={`text-[8px] font-bold ${r.tc}`}>{r.label}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.activity}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>{r.action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Seasonality adalah predictable — MJP plans headcount, content production, and capacity months in advance. Surprise = poor planning. Calendar tempel di office Sari dan Reza.</p>
      </div>

      {/* Signal Triage Decision Tree */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> SIGNAL TRIAGE TREE — Decision Framework yang Digunakan Sari untuk Memutuskan dalam {'<'}10 Menit Apakah Sinyal Baru Butuh Immediate Action atau Bisa Tunggu
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <p className="text-[8px] font-mono text-muted-foreground mb-1">Flow: Signal masuk → 5 pertanyaan → keputusan. Digunakan untuk semua sinyal baru yang masuk ke queue.</p>
          {[
            { q: "Q1: Apakah ini melibatkan regulasi atau SKK yang efektif dalam <30 hari?", yes: "→ L1 IMMEDIATE (alert dalam 4 jam)", no: "→ Lanjut ke Q2", qn: 1 },
            { q: "Q2: Apakah ini mempengaruhi > 20% klien aktif secara langsung?", yes: "→ L1 atau L2 (tergantung urgency). Briefing hari ini.", no: "→ Lanjut ke Q3", qn: 2 },
            { q: "Q3: Apakah ada tender > Rp 5M yang deadline-nya dalam 7 hari yang relevan dengan sinyal ini?", yes: "→ L2 URGENT. Tag ke client yang relevant. Alert hari ini.", no: "→ Lanjut ke Q4", qn: 3 },
            { q: "Q4: Apakah sinyal ini merupakan konfirmasi atau perubahan dari sinyal yang sudah ada?", yes: "Konfirmasi: update existing asset, rescore if confidence changes. Perubahan: L2 atau L3 alert.", no: "→ Lanjut ke Q5", qn: 4 },
            { q: "Q5: Apakah sinyal ini strategis tapi tidak urgent (> 90 hari dampaknya)?", yes: "→ L3 atau L4. Queue ke weekly briefing. Masuk Knowledge Registry sebagai horizon intel.", no: "→ Archive. Low relevance. Log alasan untuk quality review.", qn: 5 },
          ].map((r) => (
            <div key={r.qn} className="border rounded-sm p-2.5 bg-muted/10">
              <p className="text-[9px] font-bold mb-0.5">{r.q}</p>
              <div className="grid grid-cols-2 gap-1">
                <p className="text-[8px] text-emerald-700 font-mono">YA: {r.yes}</p>
                <p className="text-[8px] text-slate-600 font-mono">TIDAK: {r.no}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Triage framework digunakan oleh Sari dan Dewi setiap kali ada sinyal baru. 10 menit decision time. Target: zero false negatives (miss urgent alert) over false positives (alert noise). Err on L2 when uncertain.</p>
      </div>

      {/* Signal-to-Revenue Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> SIGNAL-TO-REVENUE — Bagaimana Setiap Jenis Sinyal Pasar yang MJP Monitor Berkontribusi Langsung ke Revenue Klien?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "Tender announcement signals (LPSE, regional)", revenueLink: "Direct: klien yang action dalam 48 jam dari tender alert = 31% higher win rate. Each win = avg Rp 5.8M contract.", tracking: "Attribution via klien self-report + tender outcome tracking. 284 klien wins attributed to MJP signals 2026 YTD.", annualRevAttrib: "Rp 1.65M client revenue facilitated", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { signal: "Regulatory change signals (SKK, compliance)", revenueLink: "Indirect: prevents compliance failures that would disqualify from tender. Avg cost of one gugur administrasi: Rp 8.4jt. Each L1 regulatory alert prevents est. 94% of related failures.", tracking: "184 klien maintained compliance pre-deadline 2026. 23 L1 alerts issued.", annualRevAttrib: "Rp 1.5M+ prevented losses (compliance failures avoided)", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { signal: "Competitor behavior signals (bid patterns)", revenueLink: "Enables pricing strategy: klien yang pakai competitor bid pattern data = 3.2× higher margin on won contracts vs those who don't.", tracking: "Competitor Radar page: 287 klien aktif bulanan. Measured via QBR: klien attest to using competitor data for pricing.", annualRevAttrib: "Rp 290jt+ additional margin preserved across client portfolio", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { signal: "Market opportunity signals (emerging categories, regions)", revenueLink: "Growth revenue for adventurous J8 clients: IKN vertical, KTI expansion. High-risk high-reward intelligence layer.", tracking: "3 klien entered new markets based on MJP opportunity signals 2026. Total new contracts won: Rp 112M.", annualRevAttrib: "Rp 112M new market revenue facilitated", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.signal} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.signal}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.revenueLink}</p>
              <p className="text-[8px] mb-0.5">{r.tracking}</p>
              <p className={`text-[9px] font-mono font-bold ${r.tc}`}>2026 contribution: {r.annualRevAttrib}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total client revenue facilitated 2026 YTD (attributable): {'>'} Rp 3.5M. MJP total subscription revenue dari 487 klien: Rp 714jt. Leverage ratio: Rp 4.9 klien revenue per Rp 1 MJP revenue. This is the investor story.</p>
      </div>

      {/* Cross-Signal Intelligence Synthesis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" /> CROSS-SIGNAL SYNTHESIS — Kapan Beberapa Sinyal Berbeda Digabungkan untuk Menghasilkan Intelligence yang Tidak Muncul dari Satu Sinyal Saja?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              title: "CONVERGENCE SIGNAL: Tender surge + Regulatory change + Competitor retreat = OPPORTUNITY WINDOW",
              scenario: "Kasus nyata Q2 2026: LPSE Kalsel menunjukkan 34% lebih banyak tender gedung pemerintah minggu ini (tender signal). Bersamaan: 2 kompetitor utama di Kalsel sedang dalam audit SKK yang delay aktivitas mereka (competitor signal). Plus: PKPT baru berlaku yang banyak kontraktor lokal belum compliance (regulatory signal).",
              synthesis: "MJP AI mendeteksi ketiga sinyal secara bersamaan → generate OPPORTUNITY WINDOW alert: window 30 hari di mana kompetisi di Kalsel <60% normal. 7 Enterprise klien yang di-alert: 3 menang tender, total Rp 41M.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
            {
              title: "WARNING SIGNAL: Tender drought + Market signal + Pain point spike = SECTOR STRESS",
              scenario: "Agustus 2026: Tender infrastruktur di Sulawesi turun 41% vs bulan lalu (tender signal). Bersamaan: 18 pain points baru tentang pembayaran termin yang delay dari kontraktor Sulawesi (pain signal). Plus: berita APBD Sulsel direvisi turun (market signal).",
              synthesis: "Three signals pointing same direction = SECTOR STRESS warning. Sari publish L2 alert: 'Sulawesi infrastructure sector showing stress indicators. Recommend: reduce bid aggressiveness, prioritize projects with clear DIPA allocation.'",
              tc: "text-orange-700", bc: "bg-orange-50 border-orange-200"
            },
          ].map((r) => (
            <div key={r.title} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.title}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.scenario}</p>
              <p className={`text-[9px] font-mono ${r.tc}`}>{r.synthesis}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Cross-signal synthesis adalah highest-value intelligence product MJP produces. Ini tidak bisa diganti dengan generic AI yang tidak punya multi-source data. Membutuhkan: tender DB + competitor DB + pain point DB + regulatory DB — all integrated.</p>
      </div>

      {/* Signal Coverage by Region */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> SIGNAL COVERAGE MAP — Seberapa Lengkap Coverage Sinyal Pasar MJP per Wilayah Indonesia dan Apa yang Masih Menjadi Blind Spot?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { region: "Jawa + Bali", coverage: 94, sources: "LPSE Provinsi + 212 Kabupaten/Kota, semua BUMN HQ, asosiasi konstruksi nasional, media konstruksi Jawa", blindspot: "Proyek swasta besar yang tidak lewat LPSE — est. 15% pasar.", tc: "text-emerald-700" },
            { region: "Sumatra", coverage: 71, sources: "LPSE Provinsi (8 provinsi), BUMN regional, media Sumatra", blindspot: "Kabupaten-level Sumatra Tengah sangat lemah. Aceh + Kepri under-monitored.", tc: "text-blue-700" },
            { region: "Kalimantan", coverage: 68, sources: "LPSE Provinsi + Kaltim (IKN focus), BUMN IKN projects", blindspot: "Kalimantan Tengah, Kalsel non-LPSE projects. Private investments di palm oil/mining sector.", tc: "text-orange-700" },
            { region: "Sulawesi", coverage: 52, sources: "LPSE Sulsel, Sulut. Partial: Sulteng, Sulbar, Sultra, Gorontalo", blindspot: "Major blind spots di Sulawesi Tengah (Palu reconstruction) dan Sulawesi Tenggara (tambang). High-value market underserved.", tc: "text-orange-700" },
            { region: "Papua + Maluku", coverage: 31, sources: "LPSE Papua + Papua Barat saja. Maluku partial.", blindspot: "Extremely undercovered. All non-LPSE Papua projects invisible. Significant donor-funded work not tracked.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.region} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[9px] font-bold flex-1">{r.region}</p>
                <span className={`text-[8px] font-mono font-bold ${r.coverage >= 80 ? "text-emerald-700" : r.coverage >= 60 ? "text-blue-700" : r.coverage >= 45 ? "text-orange-700" : "text-red-700"}`}>{r.coverage}% coverage</span>
              </div>
              <div className="flex gap-1 mb-0.5">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.coverage >= 80 ? "bg-emerald-500" : r.coverage >= 60 ? "bg-blue-500" : r.coverage >= 45 ? "bg-orange-500" : "bg-red-500"}`} style={{ width: `${r.coverage}%` }} />
                </div>
              </div>
              <p className="text-[7px] text-muted-foreground">Sources: {r.sources}</p>
              <p className={`text-[7px] font-mono ${r.coverage >= 60 ? "text-blue-700" : "text-orange-700"}`}>Blind spot: {r.blindspot}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Coverage target by Q4 2027: Jawa 97%, Sumatra 82%, Kalimantan 79%, Sulawesi 68%, Papua 45%. Each percentage point = more accurate intelligence for more clients. KTI researcher hire unlocks Sulawesi + Kalimantan in one move.</p>
      </div>

      {/* Emerging Signal Categories 2027 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> EMERGING SIGNALS 2027 — 5 Kategori Sinyal Baru yang Belum Ada di MJP Hari Ini tapi Akan Menjadi Penting dalam 12–18 Bulan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "ESG/Green Building Compliance Signals", why: "Peraturan bangunan hijau semakin ketat. Donor-funded projects (ADB, World Bank) mensyaratkan ESG reporting dari 2027. J9 klien yang mengincar proyek donor butuh early warning.", prepTime: "6 bulan build: Dewi monitor GBCI, USGBC Indonesia, ADB procurement standards.", wtp: "Enterprise add-on: Rp 350rb/bln. 47 Enterprise klien interested.", tc: "text-emerald-700" },
            { signal: "Supply Chain Disruption Intelligence", why: "Semen, baja, bata — disruptions affect all BUJK simultaneously. Klien yang tahu duluan bisa lock in material harga lama. 2022 cement shortage caught everyone flat-footed.", prepTime: "Partner dengan commodity intelligence providers. Automated price volatility alerts.", wtp: "All tiers add-on. 214 klien in price-sensitive categories. WTP: Rp 200rb/bln avg.", tc: "text-emerald-700" },
            { signal: "Donor Project Intelligence (ADB, AIIB, World Bank)", why: "Donor-funded infrastructure = bigger budgets, less competition, better payment. J9 klien under-exploiting this. MJP tidak monitor ADB procurement portal hari ini.", prepTime: "1 crawler + 3 knowledge assets about donor procurement process. Dewi 2-week setup.", wtp: "Enterprise exclusive. 51 Enterprise klien: 34 expressed interest.", tc: "text-blue-700" },
            { signal: "Local Government Budget Execution Rate Signals", why: "Tingkat serapan APBD per kabupaten/kota predicts tender volume with 3-month lead time. High serapan in June = tender surge in September. Now done manually by Sari 2x/year.", prepTime: "Data: DJPK Kemenkeu quarterly reports (public). Automation via BPS data API. 4-week build.", wtp: "Embedded in existing briefing — no additional charge. Retention feature.", tc: "text-blue-700" },
            { signal: "Political Risk Calendar (Pilkada + Pilpres impact)", why: "Tahun pilkada = construction projects slow in H1, surge in H2 (incumbent spending). Pattern predictable but rarely quantified. MJP could publish annual political calendar vs construction budget.", prepTime: "Annual report product + knowledge asset. Sari 1-week analysis + 1-day Hendra Jr. design.", wtp: "Open access (marketing). Drive Enterprise conversion via detail version.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-l-2 border-muted pl-3 py-1.5">
              <p className="text-[9px] font-bold mb-0.5">{r.signal}</p>
              <p className="text-[8px] text-muted-foreground mb-0.5">Why: {r.why}</p>
              <p className="text-[8px] mb-0.5">Prep: {r.prepTime}</p>
              <p className={`text-[8px] font-mono ${r.tc}`}>WTP: {r.wtp}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Emerging signals = future product roadmap. ESG and supply chain are highest priority (validated WTP + clear build path). Adding new signal categories expands TAM without adding users — every existing klien gets more value.</p>
      </div>

      {/* Signal Alert Delivery Performance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5 text-primary" /> ALERT DELIVERY — Performa Sistem Pengiriman Alert MJP: Kanal Mana yang Paling Efektif dan Berapa Open Rate Setiap Channel?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Kanal</th>
                  <th className="p-1 text-center">Open Rate</th>
                  <th className="p-1 text-center">Action Rate</th>
                  <th className="p-1 text-center">Avg Response Time</th>
                  <th className="p-1 text-center">Failure Rate</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["WhatsApp (via Fonnte API)", "91%", "34%", "8 menit", "0.4%"],
                  ["Email (SMTP)", "67%", "18%", "94 menit", "1.2%"],
                  ["In-app notification", "78%", "27%", "22 menit (if app open)", "0.1%"],
                  ["Daily Briefing (email digest)", "71%", "22%", "3.1 jam avg", "1.8%"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center font-bold text-emerald-700">{row[1]}</td>
                    <td className="p-1 text-center">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
              <p className="text-[9px] font-bold text-emerald-700">WhatsApp is primary channel</p>
              <p className="text-[8px]">91% open rate vs 67% email. For L1 critical alerts: WA first, email backup. For daily briefing: email primary (richer format), WA summary with link. This split optimizes urgency vs comprehension.</p>
            </div>
            <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
              <p className="text-[9px] font-bold text-blue-700">Mobile push (roadmap)</p>
              <p className="text-[8px]">Mobile app (riset-mobile) push notification in Sprint 24+. Target: 10-minute response time for L1 alerts. Better than WA because MJP controls the full notification experience and can show preview data inline.</p>
            </div>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Alert delivery infrastructure: Fonnte (WA) + Nodemailer (email) + in-app socket. 99.3% total delivery uptime 2026 YTD. Single failure mode: Fonnte API rate limit during mass L1 alert blasts ({'>'} 300 recipients simultaneously). Fix: queue with 200/minute throttle.</p>
      </div>

      {/* Macro Signal Tracking */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> MACRO SIGNALS — 6 Indikator Makroekonomi yang Sari Monitor Setiap Kuartal karena Secara Langsung Memengaruhi Volume Tender Konstruksi Indonesia
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { indicator: "APBN Realisasi Anggaran Infrastruktur", source: "Kemenkeu quarterly report", lag: "1 bulan setelah quarter end", howReads: "Realisasi > 80% by Q3 = Q4 tender surge certain. Realisasi < 60% by Q3 = Q4 scramble, many projects extended or cancelled. MJP sends early signal 6 weeks before Q4.", tc: "text-emerald-700" },
            { indicator: "IHPB Konstruksi (Harga Perdagangan Besar)", source: "BPS monthly", lag: "3 minggu setelah bulan tutup", howReads: "IHPB naik > 3% MoM = material cost pressure. Signal to klien: HPS yang sudah disetujui 3 bulan lalu mungkin tidak cukup. Also: tender HPS calculations need adjustment.", tc: "text-emerald-700" },
            { indicator: "BI Rate (suku bunga acuan)", source: "Bank Indonesia (monthly MPC)", lag: "Immediate", howReads: "Rate naik = credit tightening = some BUJK cut capex. Rate turun = expansion mode. Also affects buyer (pemda) capacity for multi-year projects.", tc: "text-blue-700" },
            { indicator: "Kurs IDR/USD", source: "BI real-time, monitored weekly", lag: "None", howReads: "IDR melemah > 5% dalam 3 bulan = imported construction materials (steel, machinery) cost surge. Alert: klien who bid on material-intensive projects may face margin compression.", tc: "text-blue-700" },
            { indicator: "Election Cycle (Pilkada kalender)", source: "KPU schedule", lag: "Predictable 5-year cycle", howReads: "6 months before Pilkada = incumbent spending surge (infrastructure projects for visibility). 3 months after = transition paralysis, budget freeze. Pattern: +34% tender volume in 2 quarters before Pilkada.", tc: "text-orange-700" },
            { indicator: "IKK — Indeks Keyakinan Konsumen Konstruksi", source: "Gapensi quarterly (if available) + BPS confidence proxies", lag: "1 kuartal", howReads: "Leading indicator of industry confidence. Low IKK = BUJK hold back bids. High = aggressive bidding season. MJP uses as win probability adjustment factor.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.indicator} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[8px] font-bold flex-1">{r.indicator}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">{r.source} · {r.lag}</span>
              </div>
              <p className={`text-[7px] ${r.tc}`}>{r.howReads}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Macro signals are contextual overlays for all other MJP intelligence. A tender worth Rp 8M has different strategic value depending on IHPB trend, BI rate, and political calendar. Sari produces 'Macro Context Memo' quarterly — 1 page, 6 indicators, implications for klien. Highest-read content in platform.</p>
      </div>

      {/* Signal Accuracy Audit */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> SIGNAL ACCURACY AUDIT — Audit Akurasi Sinyal MJP 2026: Berapa % Alert yang Terbukti Benar dan Bagaimana Kesalahan Dipelajari?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "94.7%", label: "L1 Alert accuracy (verified)", tc: "text-emerald-700" },
              { stat: "88.3%", label: "L2 Alert accuracy (verified)", tc: "text-emerald-700" },
              { stat: "7.8%", label: "HPS model MAE (mean absolute error)", tc: "text-blue-700" },
              { stat: "43%", label: "Win probability top-quartile precision", tc: "text-blue-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mb-1">
            <p className="text-[9px] font-bold text-blue-700">Verification methodology:</p>
            <p className="text-[8px]">L1/L2 accuracy: 6-month post-alert audit. Sari checks: did the regulatory change actually happen as predicted? Did the tender actually open as announced? Sample: 30% of all alerts each quarter. 94.7% accuracy = 5.3% false positives or timing errors.</p>
          </div>
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700">5 Notable Signal Errors YTD 2026 (post-mortem):</p>
            {[
              "Feb 2026: L2 alert on Perpres revision that was ultimately not signed (premature based on draft leak). Fix: only alert after official Setneg publication.",
              "Apr 2026: HPS estimate for IKN tender off by 21% (unusual project scope made historical model invalid). Fix: flag IKN tenders as 'model uncertain' until 10 samples accumulated.",
              "Jun 2026: LPJK blacklist addition — 3-day delay in our alert vs government publication. Fix: direct LPJK RSS feed integration replacing manual check.",
            ].map((e, i) => (
              <p key={i} className="text-[7px] text-orange-800">• {e}</p>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Accuracy audit adalah tanggung jawab Sari (quarterly). Published internally. Used in: (1) model retraining decisions, (2) Sari's SOP refinement, (3) Reza's objection handling ('What's your error rate?' → 'Here's the audit.'). Transparency about errors = more trust, not less.</p>
      </div>

      {/* Signal-to-Action Case Studies */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" /> SIGNAL-TO-ACTION — 4 Kasus Nyata Klien yang Menang Berkat Sinyal MJP: Dari Alert Hingga Kontrak Ditandatangani, dengan Angka Konkret
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              kasus: "CV Bangun Makmur Jaya — Jawa Tengah, J8",
              signal: "L1 alert: perubahan persyaratan SKK untuk tender rehabilitasi gedung sekolah (Kepdirjen PUPR baru). MJP alert 9 hari sebelum tender dibuka.",
              action: "Direktur CV BMJ menghubungi MJP Express. Dalam 4 hari SKK updated. Ikut tender.",
              outcome: "Menang tender Rp 2.8M. 5 peserta lain didiskualifikasi karena SKK tidak memenuhi syarat baru. CV BMJ satu-satunya yang comply.",
              roi: "ROI from alert: 5.600× (Rp 2.8M kontrak / Rp 499K biaya MJP saat itu)",
              tc: "text-emerald-700"
            },
            {
              kasus: "PT Karya Nusantara Abadi — Surabaya, J9",
              signal: "Market signal: 3 kompetitor utama PT KNA sedang mengerjakan proyek besar bersamaan. Kapasitas mereka penuh. Low competition window terdeteksi untuk tender infrastruktur Jatim.",
              action: "Reza menghubungi PT KNA langsung. 'Jendela 6 minggu terbuka.' PT KNA menyiapkan dokumen untuk 4 tender sekaligus dalam window tersebut.",
              outcome: "Menang 2 dari 4 tender, total Rp 18.4M kontrak. Normal win rate PT KNA: 1 dari 5. Window win rate: 2 dari 4.",
              roi: "Incremental win from timing intelligence: ~Rp 9.2M",
              tc: "text-emerald-700"
            },
            {
              kasus: "CV Mitra Teknik Andalan — Bandung, J7",
              signal: "HPS watch alert: tender jalan provinsi Jabar HPS terdeteksi 19% di atas model estimate. MJP sends 'HPS watch' note: bidding high risk.",
              action: "CV MTA yang sebelumnya akan bid at-HPS mengubah strategi ke 8% below HPS berdasarkan MJP estimate.",
              outcome: "Menang dengan selisih tipis vs runner-up. Runner-up bid at-HPS (tepat seperti peringatan MJP). HPS inflation terbukti.",
              roi: "Selisih keputusan bid: Rp 340jt. That margin = 68 months of MJP subscription.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.kasus} className="border rounded-sm p-2.5 bg-muted/5 mb-1">
              <p className="text-[9px] font-bold mb-0.5">{r.kasus}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5"><strong>Signal:</strong> {r.signal}</p>
              <p className="text-[7px] mb-0.5"><strong>Action:</strong> {r.action}</p>
              <p className="text-[7px] mb-0.5"><strong>Outcome:</strong> {r.outcome}</p>
              <p className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.roi}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Case studies dibuat oleh Reza dari outcome feedback (optional survey setelah tender result). Reza's rule: setiap bulan harus ada 1 new case study. Used in: sales presentations, WA channel stories, investor deck. Case studies are MJP's most powerful marketing asset — klien trust klien stories more than MJP's own claims.</p>
      </div>

      {/* Geopolitical Signal Monitoring */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" /> GEOPOLITICAL LENS — Sinyal Geopolitik yang Berdampak ke Konstruksi Indonesia: Dari Perang Dagang Hingga Hubungan RI-RRT — Apa yang Sari Monitor di Luar Regulasi Domestik?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              signal: "RRT supply chain dependency (baja, semen, kuintas)",
              relevance: "70% baja konstruksi Indonesia masih bergantung rantai pasok RRT. Setiap eskalasi tarif/embargo = spike harga material. Juga: BUMN konstruksi RRT (CREC, CCCC) masih aktif di IKN sebagai kontraktor utama.",
              mjp_action: "Sari monitors: Kemendag tariff announcements + BI material price index + BUMN procurement announcements. HPS model includes material shock buffer when RRT tension index elevated.",
              tc: "text-orange-700"
            },
            {
              signal: "Jepang + Korea ODA infrastructure pipeline",
              relevance: "JICA + KOICA funding 12+ infrastructure projects 2026–2030. These create procurement opportunities with special tender frameworks (international competitive bidding). Different rules from LPSE.",
              mjp_action: "Dewi monitors JICA/KOICA publication portal. Separate alert category 'ODA Projects' for J9 Enterprise klien with capacity for international collaborative tenders.",
              tc: "text-blue-700"
            },
            {
              signal: "US Fed rate + BI Rate impact on infrastructure budget",
              relevance: "High BI rate → government tightens infrastructure budget (fiscal space pressure). In 2023: BI Rate hike → 11% reduction in kabupaten infrastructure tender value. MJP klien had fewer tenders to bid on.",
              mjp_action: "Macro signal in monthly briefing. Sari produces 'Budget Outlook' note when BI rate moves. Helps klien set expectations: 'Q3 2026 tender volume likely flat to down 8% based on BI rate trajectory.'",
              tc: "text-blue-700"
            },
            {
              signal: "Prabowo IKN continuation + new capital cities (Nusantara + 3 ibu kota provinsi baru)",
              relevance: "Prabowo confirmed IKN continuation. 3 new provincial capital constructions added. Massive procurement volume BUT different rules: KPPIP framework, special committee oversight, non-LPSE procurement possible.",
              mjp_action: "Dedicated IKN alert stream. Separate HPS model (IKN projects have atypical cost structures). Enterprise klien with IKN exposure get tailored briefing section.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.signal} className="border-b py-2">
              <p className="text-[8px] font-bold mb-0.5">{r.signal}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.relevance}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP: {r.mjp_action}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Geopolitical intelligence is Sari's Friday reading (1 hour). Sources: Kompas, Reuters Indonesia, Antara, selected Substack newsletters on Indonesia macro. Rule: only surface geopolitical signals when they have a concrete, near-term implication for BUJK behavior. 'Interesting geopolitics' that don't change what BUJK should do this quarter = noise.</p>
      </div>

      {/* Signal Distribution Channel Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5 text-primary" /> DISTRIBUTION — Strategi Distribusi Sinyal MJP: Mengapa WhatsApp Bukan Opsi Melainkan Saluran Utama, dan Bagaimana Arsitektur Multi-Channel Bekerja
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "84%", label: "WA alert open rate", tc: "text-emerald-700" },
              { stat: "31%", label: "Email alert open rate", tc: "text-muted-foreground" },
              { stat: "67%", label: "Platform push notification (mobile)", tc: "text-blue-700" },
              { stat: "12 menit", label: "Avg WA read time after delivery", tc: "text-emerald-700" },
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
                  <th className="text-left p-1 text-muted-foreground">Channel</th>
                  <th className="p-1 text-center">Signal Types</th>
                  <th className="p-1 text-center">Tier</th>
                  <th className="p-1 text-left">Content format</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["WhatsApp (primary)", "L1 + L2 alerts, Daily Briefing, SKK notification", "All tiers", "Short text, bullet format, direct link. <300 chars for alerts."],
                  ["Email (secondary)", "Weekly digest, Monthly report, Platform updates", "Pro + Enterprise", "HTML formatted, 3–5 paragraphs, charts included."],
                  ["Platform (web/mobile)", "All signal types, full context, charts", "All tiers", "Full article with sources, filtering, export."],
                  ["API (Enterprise)", "All signal types in JSON", "Enterprise only", "Raw signal objects for klien's own system integration."],
                  ["Reza (personal)", "L1 CRITICAL alerts to Enterprise", "Enterprise only", "Personal WA from Reza's number. Not automated."],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Why WhatsApp first:</p>
            <p className="text-[8px]">Indonesian construction industry = WhatsApp-native. BUJK directors use WhatsApp for everything: contracts, payments, team coordination. Email is for formal documents. MJP reaching klien in WhatsApp = reaching them where they already are, not asking them to change behavior. 84% open rate vs 31% email: the channel choice alone is a 2.7× engagement multiplier.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">WhatsApp dependency risk: Meta's API terms can change. MJP contingency: email list maintained for all klien (mandatory at signup). In a forced migration from WA: 31% open rate still better than nothing. Hendra Jr. also investigating Telegram as backup channel (some construction communities already active there). Current WA cost: Rp 3.1jt/bln = {'<'}0.5% of MRR. Cheap insurance.</p>
      </div>

      {/* Signal Taxonomy Full Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> TAXONOMY — Taksonomi Lengkap 5 Kategori Sinyal dan 23 Sub-Tipe: Dari Sinyal Regulasi ke Sinyal Perilaku Pasar — Bagaimana Sari Mengklasifikasikan Setiap Informasi yang Masuk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              cat: "Category 1 — Regulatory Signals (RegSig)", color: "text-red-700",
              types: [
                { type: "RS-01: Regulatory Publication", desc: "New Permen, Kepmen, Perpres, SNI published. Source: JDIH, PUPR, BNSP." },
                { type: "RS-02: Regulatory Announcement (pre-publication)", desc: "Official government statement about upcoming regulation. Source: press conference, LPJK announcement." },
                { type: "RS-03: Regulatory Enforcement Action", desc: "LPJK/LKPP enforcement: blacklisting, license suspension, audit result. Immediate impact on specific BUJKs." },
                { type: "RS-04: Regulatory Transition Notice", desc: "Grace period announcement, transition date confirmation, phased rollout detail." },
              ]
            },
            {
              cat: "Category 2 — Procurement Signals (ProcSig)", color: "text-blue-700",
              types: [
                { type: "PS-01: Tender Announcement (L1)", desc: "New tender matching klien watchlist. <48h before close. Urgent." },
                { type: "PS-02: Tender Announcement (L2)", desc: "New tender, 2–14 days to deadline. Moderate urgency." },
                { type: "PS-03: Tender Announcement (L3)", desc: "New tender, > 14 days to deadline. Monitor only." },
                { type: "PS-04: Tender Amendment", desc: "HPS change, deadline extension, scope change, addendum. Affects active bids." },
                { type: "PS-05: Tender Result", desc: "Winner announced, contract signed, project awarded. Competitor tracking." },
              ]
            },
            {
              cat: "Category 3 — Competitor Signals (CompSig)", color: "text-orange-700",
              types: [
                { type: "CS-01: Competitor SBU/SKK Change", desc: "Competitor upgraded, downgraded, expired. Changes market positioning." },
                { type: "CS-02: Competitor Win Pattern", desc: "Same BUJK winning same buyer repeatedly. Possible preferred vendor or system." },
                { type: "CS-03: Competitor Exit Signal", desc: "BUJK blacklisted, dissolved, major financial distress. Market vacancy signal." },
                { type: "CS-04: New Entrant Signal", desc: "New BUJK registered in klien's competitive space. Threat mapping." },
              ]
            },
            {
              cat: "Category 4 — Market Signals (MktSig)", color: "text-emerald-700",
              types: [
                { type: "MS-01: Budget Announcement", desc: "APBN/APBD infrastructure allocation announced. Forward-looking tender volume signal." },
                { type: "MS-02: Price Movement", desc: "Winning bid prices trending up/down. HPS model recalibration trigger." },
                { type: "MS-03: Volume Shift", desc: "Tender volume by sector/region changing. Portfolio mix signal." },
                { type: "MS-04: BUMN Procurement Cycle", desc: "BUMN announcing infrastructure budget. SOE-focused BUJK signal." },
                { type: "MS-05: IKN / PSN Update", desc: "National Strategic Project update. Large-contract opportunity signal." },
              ]
            },
            {
              cat: "Category 5 — Operational Signals (OpSig)", color: "text-purple-700",
              types: [
                { type: "OS-01: LPSE System Status", desc: "LPSE outage, migration, UI change. Affects tender submission workflow." },
                { type: "OS-02: asesor Pool Change", desc: "Asesor certification changes, new asesor supply, fee movement." },
                { type: "OS-03: Platform Data Gap", desc: "MJP detects coverage gap (kabupaten not crawled). Internal signal." },
                { type: "OS-04: Data Quality Alert", desc: "Crawler returns anomalous data. Internal triage signal." },
              ]
            },
          ].map((c) => (
            <div key={c.cat} className="border-b pb-2 mb-1">
              <p className={`text-[8px] font-bold ${c.color} mb-0.5`}>{c.cat}</p>
              <div className="flex flex-col gap-0.5 pl-2">
                {c.types.map((t) => (
                  <div key={t.type} className="flex gap-2">
                    <p className="text-[7px] font-mono w-36 shrink-0">{t.type}</p>
                    <p className="text-[7px] text-muted-foreground">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Full taxonomy (5 categories, 23 sub-types) developed by Sari over 2 years. Taxonomy is the backbone of alert classification, knowledge asset tagging, and the AI briefing pipeline. Every piece of intelligence that enters MJP gets classified. No 'general' or 'misc' bin. Taxonomy enables: precision filtering for klien watchlists, trend analysis by signal type, AI model training labels, and quality metrics per category.</p>
      </div>

      {/* Signal Volume Forecasting */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> VOLUME FORECAST — Proyeksi Volume Sinyal 2026–2028: Mengapa MJP Perlu Bersiap untuk 3× Volume Saat Ini dan Apa yang Akan Pecah Pertama Kali Jika Tidak Siap
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Metric</th>
                  <th className="p-1 text-center">2025 Actual</th>
                  <th className="p-1 text-center">2026 Est.</th>
                  <th className="p-1 text-center">2027 Proj.</th>
                  <th className="p-1 text-center">2028 Proj.</th>
                  <th className="p-1 text-left">Driver</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPSE tender volume/month", "680", "820 (+21%)", "1.100 (+34%)", "1.400 (+27%)", "IKN + PSN ramp, BUMN integration, new kabupaten"],
                  ["Regulatory changes/year", "47", "58 (+23%)", "70 (+21%)", "65 (plateau)", "BIM mandate, UU PDP follow-on, post-election agenda"],
                  ["Sari alert annotations/month", "~40", "~55", "~80", "~100", "More L1-worthy tenders as volume + scope expand"],
                  ["Klien watchlist queries/month", "331K", "550K (+66%)", "1.1M (+100%)", "2.4M (+118%)", "Klien growth + more filters per klien"],
                  ["WA message deliveries/month", "~14.000", "~22.000", "~40.000", "~85.000", "Klien growth + more alert types"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-blue-700 font-bold">{row[2]}</td>
                    <td className="p-1 text-center text-orange-700 font-bold">{row[3]}</td>
                    <td className="p-1 text-center text-red-700 font-bold">{row[4]}</td>
                    <td className="p-1 text-muted-foreground">{row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200 mb-1">
            <p className="text-[9px] font-bold text-orange-700">What breaks first at 3× volume (2028):</p>
            {[
              "Sari annotation capacity: at 100 annotations/month (2028 proj.), Sari is at limit. Mitigation: AI pre-annotation with Sari doing override only (already prototyped by Hendra Jr.).",
              "WA Business API rate limits: at 85.000 messages/month, MJP approaches Meta's tier limits. Hendra Jr. monitoring — tier upgrade required at ~50.000/month.",
              "Klien watchlist query latency: at 2.4M queries/month, current PostgreSQL filter engine may lag. Mitigation: Redis caching layer (planned H2 2027 by Hendra Jr.).",
              "NOT at risk: core data freshness — crawler architecture is stateless horizontal — scales linearly with servers.",
            ].map((l, i) => <p key={i} className="text-[7px] mb-0.5">• {l}</p>)}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Volume forecast done by Sari (market sizing) + Hendra Jr. (infrastructure capacity). Reviewed quarterly. Purpose: ahead-of-time infrastructure planning prevents reactive scaling (which is always more expensive and riskier). Hendra's rule: 'Plan for 5× current, build for 3×, deploy for 1.5×.' MJP currently between 1× and 1.5× build phase.</p>
      </div>

      {/* Signal Monetization Tiers */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> SIGNAL TIERS — Arsitektur Tier Akses Sinyal MJP: Sinyal Apa yang Gratis, Apa yang Pro, Apa yang Enterprise, dan Mengapa Desain Tier Ini Penting untuk Konversi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              tier: "GRATIS (Basic) — Rp 0/bln",
              signals: ["Daily Briefing: 3 paragraf ringkasan (bukan full detail)", "Tender Alert L3 hanya: > 14 hari sebelum deadline", "Knowledge assets: preview 150 kata, paywall setelahnya", "BUJK Trust Score: kategori saja (Biru/Hijau/Kuning/Oranye/Merah), bukan score angka"],
              strategy: "Free tier harus cukup berguna untuk menarik dan mempertahankan akun — tapi cukup terbatas agar ada alasan upgrade. 'Useful but incomplete' adalah desain yang disengaja.",
              tc: "text-muted-foreground", bc: "bg-muted/5 border-muted"
            },
            {
              tier: "PRO — Rp 1.5jt/bln",
              signals: ["Daily Briefing: full article dengan sources", "Tender Alert L1 + L2 + L3: semua level, watchlist unlimited", "Knowledge assets: full access 3.200+", "HPS Estimate: full model output dengan confidence interval", "Competitor Radar: BUJK Trust Score angka + win rate data", "SKK Expiry Reminder: full cascade D-90/D-30/D-7"],
              strategy: "Pro is 'professional toolkit' tier — everything an operations manager needs. Designed for BUJK who submit 10–30 tenders/year.",
              tc: "text-primary", bc: "bg-blue-50 border-blue-200"
            },
            {
              tier: "ENTERPRISE — Rp 7.5jt–14jt/bln (custom)",
              signals: ["All Pro features", "API access: full signal feed in JSON for integration", "Multi-user: up to 10 team members per account", "Consortium matching: algorithm-powered partner search", "Pre-Bid Brief generator", "Dedicated support: Reza personal contact + Sari escalation"],
              strategy: "Enterprise = infrastructure for large BUJK operations. Not feature-priced — value-priced based on contract volume managed.",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.tier} className={`border rounded-sm p-2.5 ${r.bc} mb-1`}>
              <p className={`text-[9px] font-black ${r.tc} mb-0.5`}>{r.tier}</p>
              <div className="mb-0.5">{r.signals.map((s, i) => <p key={i} className="text-[7px]">• {s}</p>)}</div>
              <p className={`text-[7px] font-mono italic ${r.tc}`}>{r.strategy}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-amber-50 border-amber-200 mt-1">
            <p className="text-[9px] font-bold text-amber-700">Conversion trigger design:</p>
            <p className="text-[8px]">When a Basic user hits a Pro-gated feature: they see the paywall + a specific example of what they just missed. Not generic 'upgrade to Pro'. Example: 'This tender has 4 eligible competitors in your area — see their Trust Scores and win rates.' The missed intel is the call to action. Hendra: 'The paywall must show the value behind it, not just a price tag.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tier architecture designed to have: (1) free-to-paid conversion at 60-day mark (when klien has seen enough value), (2) Pro-to-Enterprise conversion triggered by team size or API need. Current free-to-Pro conversion: 31%. Target: 38% (address Day 14 aha moment gap). Pro-to-Enterprise: 6.3% of Pro base. Target: 9% (requires consortium matching feature promotion).</p>
      </div>

      {/* Signal Reliability Engineering */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> SIGNAL RELIABILITY — Rekayasa Keandalan Sinyal MJP: Bagaimana Sebuah Data dari 312 Sumber Bisa Diyakini Akurat Sebelum Sampai ke Klien — 6 Layer Verifikasi yang Tidak Terlihat oleh Pengguna
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "L1 — Schema validation (automated)", desc: "Every parsed record checked against strict JSON schema. Missing required fields (tender ID, deadline, nilai pagu) = record rejected, not silently passed. Hendra Jr.'s rule: 'Partial data is worse than no data — a tender with missing deadline looks complete.'", coverage: "100% automated", tc: "text-emerald-700" },
            { layer: "L2 — Cross-source deduplication (automated)", desc: "Same tender often appears in multiple LPSE instances (LPSE Nasional + LPSE Daerah). Deduplication engine uses tender ID + paket name fuzzy match. False positive deduplication rate: <0.3%.", coverage: "100% automated", tc: "text-emerald-700" },
            { layer: "L3 — Anomaly detection (automated + flagged)", desc: "Statistical outliers flagged: HPS nilai 10× above/below KBLI median, deadline < 3 days from publication (unusual), zero bidder tenders repeated 3+ times (procurement irregularity signal). Flagged for Sari review.", coverage: "Automated flag → Sari manual review", tc: "text-blue-700" },
            { layer: "L4 — BUJK status cross-check (automated, 2× daily)", desc: "Every BUJK trust score cross-referenced against LPJK aktif/nonaktif, blacklist registry, and SBU validity. Status changes propagate within 4 hours of source update.", coverage: "Automated, 2× daily refresh", tc: "text-blue-700" },
            { layer: "L5 — Sari's domain spot-check (manual, 10%)", desc: "Sari personally verifies ~10% of flagged signals weekly. Especially: new regulatory developments, unusual tender structures, any signal that will be featured in briefing. Human judgment layer that automated systems cannot replace.", coverage: "~10% manual (Sari)", tc: "text-orange-700" },
            { layer: "L6 — Klien feedback loop (reactive)", desc: "Klien who report incorrect data get Sari's direct response within 4 hours. Root cause logged. Each report becomes a test case added to the automated validation suite. 'Every bug report is a gift.' — Hendra Jr.", coverage: "Reactive, klien-driven", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.layer} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.layer}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.coverage}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The 6-layer reliability stack was designed incrementally — L1–L2 existed from day one, L3–L4 added after the Q3 2022 incident (wrong deadline led to a klien missing a tender). L5 (Sari's spot-check) was formalized Q1 2023. L6 is perpetual. Hendra: 'We don't advertise our QA process — we just cite our 99.7% accuracy. But internally, the process is this detailed. The number doesn't come from confidence; it comes from work.'</p>
      </div>

      {/* Market Signal Benchmarking: MJP vs. BUJK Awareness */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Radar className="h-3.5 w-3.5 text-primary" /> AWARENESS GAP — Benchmark Kesenjangan Informasi: Rata-rata BUJK Tahu Berapa Persen dari Sinyal yang Relevan untuk Mereka? MJP Mengukur Gap Ini Setiap Tahun — Inilah Hasilnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Annual BUJK awareness audit (Sari + Budi, n=47 interviews, Q1 2026):</p>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Signal category</th>
                  <th className="p-1 text-center">Avg BUJK awareness (non-MJP)</th>
                  <th className="p-1 text-center">MJP klien awareness</th>
                  <th className="p-1 text-center">Awareness gap</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender opportunities in their KBLI/geography", "31%", "94%", "+63pp"],
                  ["HPS benchmarks before bid submission", "12%", "87%", "+75pp"],
                  ["Competitor BUJK blacklist status", "8%", "79%", "+71pp"],
                  ["Regulatory changes relevant to their work", "22%", "91%", "+69pp"],
                  ["SKK/SBU expiry < 90 days away", "41%", "98%", "+57pp"],
                  ["Competitor win rate in their area", "5%", "68%", "+63pp"],
                  ["Consortium partner availability", "9%", "62%", "+53pp"],
                  ["IKN/PSN sub-contract opportunities", "4%", "71%", "+67pp"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-red-700 font-bold">{row[1]}</td>
                    <td className="p-1 text-center text-emerald-700 font-bold">{row[2]}</td>
                    <td className="p-1 text-center text-primary font-bold">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">What the awareness gap means:</p>
            <p className="text-[8px]">The gap is MJP's value proposition made quantitative. A BUJK without MJP operates with 4–41% awareness across critical intelligence categories. A BUJK with MJP operates with 62–98% awareness. This +53pp to +75pp lift across 8 categories is the actual product value — not features, not design. Information equity. Reza's pitch line that resonates most with J8/J9 directors: 'Your competitors who use MJP know things about your market that you don't. That gap has a price.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Awareness audit conducted annually (Q1). Methodology: structured interview (Budi in-person for Jateng sample, Reza phone for national sample). Questions are behavior-based, not recall-based: 'In the last tender you submitted, did you know any competitor's blacklist status?' (not 'Do you think you're informed about competitors?'). Behavioral questions give more accurate answers — people overestimate their awareness when asked directly.</p>
      </div>

      {/* Signal Personalization Engine */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> PERSONALIZATION ENGINE — Mesin Personalisasi Sinyal MJP: Bagaimana Platform Mengirim Sinyal yang Berbeda ke BUJK Sipil Jateng J7 vs. BUJK MEP Jakarta J9 — 4 Layer Personalisasi dan Limitasinya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "Layer 1 — KBLI Filtering (Setup by klien)", desc: "Klien selects their KBLI codes during onboarding. All tender alerts filtered to matching KBLI only. 312 LPSE × all tenders → only tenders matching klien's KBLI codes reach them. 99.6% noise reduction from raw feed.", limit: "Klien must configure correctly. Mis-configured watchlist = missed tenders. Day-1 Reza call ensures correct setup.", tc: "text-primary" },
            { layer: "Layer 2 — Geography Filtering (Setup by klien)", desc: "Klien selects provinces/kabupaten of interest. Combined with KBLI: most klien receive 5–30 relevant alerts/week instead of 200–500 raw tenders. Enterprise klien often add adjacent geographies for consortium awareness.", limit: "Klien may be too restrictive (misses adjacent opportunities) or too broad (noise). Reza's onboarding tip: set geography 1 ring wider than current projects.", tc: "text-blue-700" },
            { layer: "Layer 3 — Historical Behavior Signal (Automated)", desc: "Hendra Jr.'s behavioral personalization: if klien consistently opens L1 alerts but rarely opens L3: L3 alert frequency reduced, L1 urgency increased. If klien consistently reads 'MEP regulatory' assets: more MEP assets surfaced in daily briefing introduction paragraph.", limit: "Requires 30+ days of behavior data. New klien get default weighting for first month.", tc: "text-orange-700" },
            { layer: "Layer 4 — Jenjang-Based Content Calibration (Automated)", desc: "J7 klien: briefing emphasis on J7-eligible tenders (< Rp 25M nilai pagu), basic SKK reminders, regional market signals. J9 klien: briefing emphasis on consortium opportunities, BUMN tenders, complex regulatory updates. Same underlying data, different presentation priority.", limit: "Jenjang data from klien's self-reported SBU level. Occasional mismatch if klien reports old jenjang.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.layer} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.layer}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Limitation: {r.limit}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200 mt-1">
            <p className="text-[9px] font-bold text-blue-700">Personalization v2 (NLQ era, Q1 2027):</p>
            <p className="text-[8px]">After NLQ launch: Layer 5 = implicit intent from NLQ query history. A klien who consistently asks about 'irigasi Jatim' signals intent that isn't captured in their original KBLI setup. NLQ queries will feed back into personalization signals, making Layer 3 more responsive to emerging interests, not just historical behavior.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Personalization engine is Hendra Jr.'s ongoing project. Current personalization reduces klien-reported 'irrelevant alerts' from 34% (2023 baseline) to 11% (Q2 2026). Target: {'<'} 5% irrelevant signal rate by Q4 2026 (NLQ query calibration). The irrelevance rate directly correlates with churn risk — klien who report high irrelevance have 2.3× higher 90-day churn probability than klien who report low irrelevance. Personalization is a retention investment, not just a UX improvement.</p>
      </div>

      {/* Signal Delivery Infrastructure */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Wifi className="h-3.5 w-3.5 text-primary" /> DELIVERY INFRA — Infrastruktur Pengiriman Sinyal MJP: Bagaimana Alert Berjalan dari Database ke WA Klien dalam {'<'}8 Menit — Stack Teknis, SLA per Tier, dan Apa yang Terjadi Saat Sistem Lambat
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Pipeline stage</th>
                  <th className="p-1 text-center">Typical latency</th>
                  <th className="p-1 text-center">SLA target</th>
                  <th className="p-1 text-left">Failure mode</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LPSE crawler fetch (312 sources)", "2–6 min (concurrent)", "< 8 min", "Source timeout: exponential backoff x3, then skip + mark for next cycle"],
                  ["Parser + normalization", "30–90 sec per batch", "< 2 min", "Parse failure: raw record saved, manual review queue"],
                  ["KBLI + geography matching against klien profiles", "< 10 sec (PostgreSQL index)", "< 30 sec", "Index slowdown at > 200k records: partitioned by region"],
                  ["Alert classification (L1/L2/L3)", "< 5 sec (rule engine)", "< 15 sec", "Classification error: defaults to L3 (lowest urgency) — fail safe"],
                  ["Notification dispatch (WA + email)", "10–90 sec per recipient", "< 5 min", "WA API timeout: fallback to email immediately; retry WA after 15 min"],
                  ["Delivery confirmation logging", "Async, < 30 sec", "Best effort", "Unconfirmed deliveries: flagged for daily audit"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-primary">{row[1]}</td>
                    <td className="p-1 text-center text-emerald-700 font-bold">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-1">
            {[
              { stat: "<8 min", label: "L1 alert end-to-end SLA", tc: "text-primary" },
              { stat: "99.3%", label: "SLA compliance rate Q2 2026", tc: "text-emerald-700" },
              { stat: "4 breaches", label: "SLA breaches in Q2 2026 (all WA outages)", tc: "text-orange-700" },
              { stat: "14 min", label: "Worst case (WA + email fallback)", tc: "text-muted-foreground" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-sm font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200">
            <p className="text-[9px] font-bold text-orange-700">SLA breach protocol:</p>
            <p className="text-[8px]">When an L1 alert exceeds 8-minute SLA: (1) Hendra Jr. auto-notified via monitoring dashboard, (2) Hendra Jr. investigates root cause within 30 minutes, (3) if caused by WA API outage: no post-mortem (external dependency), (4) if caused by internal issue: root cause analysis + TD register entry. In 2025: 11 SLA breaches. 7 caused by WA API. 4 caused by internal issues (all resolved via hotfix within 2 hours).</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Delivery infrastructure is Hendra Jr.'s highest-reliability system. Alerting is the product's core promise — if alerts don't arrive, MJP has no value proposition. The 99.3% SLA compliance rate means 2.5 hours of L1 alert delay per month across the entire platform. Hendra's reliability target for 2026: 99.7% ({'<'} 60 minutes delay/month). The gap between 99.3% and 99.7% is achievable through WA failover improvements and redundant LPSE source polling.</p>
      </div>

      {/* Signal Fatigue Prevention */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BellOff className="h-3.5 w-3.5 text-primary" /> SIGNAL FATIGUE PREVENTION — Pencegahan Signal Fatigue: Bagaimana MJP Memastikan Klien Tidak Mulai Mengabaikan Alert yang Dikirim — 5 Mekanisme Anti-Fatigue dan Data yang Membuktikan Efektivitasnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Signal fatigue risk: klien who receive too many alerts start ignoring them — eventually unsubscribing or churning. MJP's anti-fatigue mechanisms:</p>
          {[
            { mech: "M1 — Maximum 3 L1 alerts per day per klien", data: "Pre-cap (2023): avg klien received 7.3 alerts/day. Open rate: 34%. Post-cap: avg 2.1 alerts/day. Open rate: 61%. Less volume = more attention per alert.", logic: "L1 alert cap forces algorithm to rank and surface only highest-urgency items. The rest are downgraded to Daily Briefing inclusion.", tc: "text-primary" },
            { mech: "M2 — Alert pause mode (klien can set 'vacation mode')", data: "412 klien have used vacation mode at least once. 98% reactivated within 21 days. Klien who used vacation mode: 11% lower churn vs. klien who didn't use it (they manage their own engagement, not depleting tolerance).", logic: "Forcing alerts on a klien who is unavailable → ignored alerts → trained inattention. Vacation mode prevents this.", tc: "text-blue-700" },
            { mech: "M3 — Alert decay: reduce frequency for KBLI categories the klien consistently ignores", data: "After 14 consecutive un-opened alerts for a KBLI sub-category: frequency reduced to daily digest inclusion only. Klien can re-activate full alerts for that category anytime.", logic: "Behavioral signal that the category isn't relevant → reduce noise. Better than manual KBLI reconfiguration which most klien never bother to do.", tc: "text-orange-700" },
            { mech: "M4 — 'Digest mode' for Pro klien who prefer batch over real-time", data: "87 klien on Digest mode (receive 1 email at 08:00 instead of real-time WA alerts). Digest mode klien: 8% higher open rate (they read deliberately, not reactively) but 23% lower same-day action rate.", logic: "Some klien (particularly older directors) prefer processing information in a daily block vs. interrupt-driven notifications.", tc: "text-emerald-700" },
            { mech: "M5 — Monthly 'alert effectiveness report' for Enterprise klien", data: "Enterprise klien receive a monthly 1-pager: 'This month you received X alerts. You opened Y. Z resulted in a tender submission or action.' Drives klien-led reconfiguration before fatigue sets in.", logic: "Metacognition: klien who see their own engagement pattern are 31% more likely to reconfigure their KBLI settings proactively. Self-directed improvement is better than MJP-pushed changes.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.mech} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.mech}</p>
              </div>
              <p className="text-[7px] text-muted-foreground mb-0.5">Data: {r.data}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.logic}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal fatigue is Hendra Jr.'s most important UX research area. Measurement: monthly 'alert open rate decay curve' — if a klien's open rate drops {'>'} 20% in 30 days without a 'vacation mode' flag, Hendra Jr. triggers a Reza WA check-in. Early intervention catches reconfiguration needs before they become churn risk. Q2 2026 fatigue metric: 4.3% of klien showing open rate decay curve, down from 9.1% in Q4 2024. Each percentage point improvement in this metric corresponds to ~Rp 8.4jt/month in prevented churn (based on historical churn correlation).</p>
      </div>

      {/* Regional Alert Coverage Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> REGIONAL COVERAGE — Peta Cakupan Regional Alert MJP: Dari 34 Provinsi Indonesia — Mana yang Tercover Penuh, Mana yang Masih Lemah, dan Apa Strateginya untuk Memperluas ke Papua dan Kalimantan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Region</th>
                  <th className="p-1 text-center">LPSE sources</th>
                  <th className="p-1 text-center">L1 SLA compliance</th>
                  <th className="p-1 text-center">Klien concentration</th>
                  <th className="p-1 text-center">Coverage tier</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Jawa (all provinces)", "187 sources", "99.6%", "61% of all klien", "TIER 1 — Full"],
                  ["Sumatera (all provinces)", "54 sources", "98.1%", "18% of all klien", "TIER 2 — Strong"],
                  ["Kalimantan (all provinces)", "22 sources", "96.3%", "9% of all klien", "TIER 2 — Strong"],
                  ["Sulawesi (all provinces)", "18 sources", "94.7%", "7% of all klien", "TIER 3 — Growing"],
                  ["Bali + NTB + NTT", "12 sources", "93.2%", "3% of all klien", "TIER 3 — Growing"],
                  ["Maluku + Papua (all provinces)", "11 sources", "89.1%", "2% of all klien", "TIER 4 — Limited"],
                  ["IKN special zone (Kaltim)", "8 sources", "97.8%", "IKN-flagged 12 Enterprise klien", "TIER 1 — Priority"],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1">{row[0]}</td>
                    <td className="p-1 text-center text-blue-700">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[2]) > 98 ? "text-emerald-700" : parseFloat(row[2]) > 95 ? "text-orange-700" : "text-red-700"}`}>{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center font-bold text-[7px] ${row[4].startsWith("TIER 1") ? "text-emerald-700" : row[4].startsWith("TIER 2") ? "text-blue-700" : row[4].startsWith("TIER 3") ? "text-orange-700" : "text-red-700"}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2 bg-muted/10">
            <p className="text-[8px] font-bold mb-1">Papua + Maluku expansion roadmap (Hendra Jr., Q3 2026 – Q1 2027):</p>
            <p className="text-[7px] text-muted-foreground">Challenge: LPSE Papua provincial sources have inconsistent HTML structures (3 different LPSE versions deployed across 7 provinces). SLA compliance at 89.1% is below MJP's internal target (95% floor for active coverage promises). Plan: (1) Audit each Maluku+Papua LPSE source — identify which 4 sources are driving SLA failures. (2) Build province-specific parser variants for the 2 non-standard LPSE versions found only in Papua. (3) Add redundant polling for Papua Pegunungan (highest L1 latency). Target: 94%+ SLA compliance by Q1 2027.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Regional coverage asymmetry reflects klien concentration, not neglect. Hendra's principle: 'We invest coverage depth where our klien are.' 79% of klien are in Java + Sumatra — those regions are Tier 1 and Tier 2 with near-perfect SLA. Papua and Maluku represent 2% of current klien but 12% of IKN-adjacent opportunities. Hendra Jr.'s IKN mandate accelerates Papua coverage because Otorita IKN project packages frequently involve Papua-based contractors and logistics. Coverage expansion is demand-led: as klien presence in a region grows, coverage investment follows. MJP does not cold-open new regions without a klien base to serve.</p>
      </div>

      {/* Alert Personalization Engine v2 Spec */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" /> PERSONALIZATION V2 — Spesifikasi Personalization Engine v2: Dari Rule-Based ke ML-Driven Alert Ranking — Apa yang Berubah, Mengapa Ini Lebih Baik dari Sistem Saat Ini, dan Kapan Akan Diluncurkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="border rounded-sm p-2 bg-muted/10">
              <p className="text-[8px] font-bold text-muted-foreground mb-1">Current v1: Rule-based (active)</p>
              <p className="text-[7px] text-muted-foreground">• KBLI match: binary (alert if KBLI matches klien profile)</p>
              <p className="text-[7px] text-muted-foreground">• Province filter: binary (alert if province in klien list)</p>
              <p className="text-[7px] text-muted-foreground">• HPS threshold: binary (alert if HPS in klien range)</p>
              <p className="text-[7px] text-muted-foreground">• L1/L2 classification: rule-based (deadline &lt; 7 days = L1)</p>
              <p className="text-[7px] font-mono text-orange-700 mt-1">Limitation: treats all KBLI matches equally. A klien who opens 80% of Irigasi alerts and 12% of Jembatan alerts gets both at the same priority.</p>
            </div>
            <div className="border rounded-sm p-2 bg-primary/5 border-primary/20">
              <p className="text-[8px] font-bold text-primary mb-1">Upcoming v2: ML-driven (Q1 2027)</p>
              <p className="text-[7px] text-muted-foreground">• KBLI sub-category weighting: historical open-rate per KBLI</p>
              <p className="text-[7px] text-muted-foreground">• Time-of-day personalization: klien-specific peak engagement hour</p>
              <p className="text-[7px] text-muted-foreground">• HPS range dynamic: adjusts to klien's actual bid range (not stated range)</p>
              <p className="text-[7px] text-muted-foreground">• Urgency score: composite of deadline proximity + competition signal</p>
              <p className="text-[7px] font-mono text-primary mt-1">Result: each klien gets a ranked alert queue. Top-3 get L1 (WA). Next 5 get Briefing inclusion. Rest are suppressed.</p>
            </div>
          </div>
          {[
            { aspect: "Training data for v2 model", detail: "18 months of behavioral signal data (F1–F4 from the feedback loop) accumulated since F3 cross-reference was built in Q2 2025. Hendra Jr. has been logging all signals in preparation for v2 training. At Q1 2027 launch: 24 months of signal data = sufficient for stable model training per Hendra Jr.'s estimate.", tc: "text-primary" },
            { aspect: "Expected improvement from v2 (Hendra Jr.'s projection)", detail: "L1 alert open rate: 61% → 74% (klien open more alerts because ranking is more personally relevant). Alert-to-action rate: 23% → 31% (better relevance = more follow-through). False positive rate (irrelevant alerts opened and immediately dismissed): 39% → 22% (algorithm filters these out before delivery).", tc: "text-emerald-700" },
            { aspect: "Why not built sooner", detail: "v2 requires 18+ months of signal data to train meaningfully. The behavioral logging infrastructure was only completed in Q4 2025. Hendra Jr.'s constraint: 'You can't train a personalization model on 3 months of data — it overfits to recency. I need 18+ months to capture seasonal patterns in tender behavior.' Q1 2027 is the minimum viable training data window.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.aspect} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.aspect}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Personalization v2 is the most technically ambitious feature Hendra Jr. has scoped. It requires: (1) building a lightweight ML training pipeline in Python (new to Hendra Jr.'s stack — he's researching PyTorch Lite and AWS SageMaker serverless), (2) serving predictions at sub-100ms latency (alert ranking must not delay alert delivery), (3) A/B testing infrastructure (split test v1 vs. v2 for 60 days before full rollout). The H2 backend engineer hire (post-Series A) is specifically planned to own the ML serving infrastructure so Hendra Jr. can focus on the model training side. Hendra Jr.: 'v2 is the project I'm most excited about in MJP's history. And the one that scares me most. Both are good signs.'</p>
      </div>

      {/* R96: Alert Accuracy SLA */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> ALERT ACCURACY SLA — Service Level Agreement Internal MJP untuk Kualitas Sinyal: Target Precision, Recall, Latency per Tipe Alert, dan Seberapa Sering MJP Melanggar SLA-nya Sendiri
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Alert Type</th>
                  <th className="p-1 text-center">Precision SLA</th>
                  <th className="p-1 text-center">Actual (Q2 2026)</th>
                  <th className="p-1 text-center">Latency SLA</th>
                  <th className="p-1 text-center">SLA Met?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tender Baru LPSE", "98%", "98.7%", "< 4 jam", "YES", "text-emerald-700"],
                  ["SKK Expiry Warning", "100%", "100%", "< 24 jam", "YES", "text-emerald-700"],
                  ["Regulasi Baru/Update", "95%", "93.2%", "< 6 jam", "MISS", "text-red-700"],
                  ["Kompetitor Movement", "85%", "81.4%", "< 12 jam", "MISS", "text-red-700"],
                  ["Market Signal (IKN/APBN)", "80%", "84.1%", "< 24 jam", "YES", "text-emerald-700"],
                  ["BUJK Blacklist Update", "100%", "100%", "< 2 jam", "YES", "text-emerald-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${row[5]}`}>{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center font-bold text-[7px] ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { label: "Mengapa Regulasi alert precision miss (93.2% vs 95% SLA)", detail: "Root cause: Sari's annotation workflow has a 6-step verification process that takes 4–8 hours. Ketika JDIH (Jaringan Dokumentasi Hukum Nasional) publish 3+ regulasi dalam satu hari (terjadi 8 kali di Q2), backlog menyebabkan crawl-to-delivery delay melebihi 6 jam. Fix: auto-draft regulasi summary menggunakan AI, Sari melakukan review (bukan production dari nol) — target Q4 2026.", tc: "text-red-700" },
            { label: "Mengapa Kompetitor Movement alert precision miss (81.4% vs 85% SLA)", detail: "Harga kompetitor berubah tanpa announcement — MJP hanya mendeteksi dari bid submission patterns di LPSE. False positive rate tinggi: 18.6% alert yang dikira 'price drop' ternyata adalah one-off bid strategi, bukan systematic repricing. Fix: minimum 3-tender confirmation sebelum price movement alert issued.", tc: "text-red-700" },
            { label: "SLA yang paling kritikal: BUJK Blacklist (100%)", detail: "Zero false positive tolerance karena consequence-nya serius: klien yang mem-vetting subkon berdasarkan MJP data bisa kena dispute jika MJP salah flag. Hendra Jr. memisahkan BUJK Blacklist crawler dengan redundancy khusus: 3 sumber, semua harus confirm before alert fired.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.label} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.label}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Alert Accuracy SLA adalah dokumen internal MJP yang tidak dipublikasikan ke klien — tapi kalau klien bertanya, Reza membagikannya. Hendra membangun SLA framework setelah 2 insiden di 2024: (1) regulasi K3 yang harusnya di-alert tapi missed karena crawler down 8 jam — satu klien kena teguran karena tidak siap. (2) Kompetitor movement alert false positive — klien ubah strategi bid karena alert MJP yang ternyata tidak valid. Kedua insiden mendorong formalisme SLA yang sebelumnya hanya ada di kepala Hendra Jr. Hendra: 'Kualitas bukan hanya tentang berapa banyak tender yang kita tangkap. Ini tentang seberapa banyak noise yang kita tidak kirim.'</p>
      </div>

      {/* R97: Alert Delivery Channel Strategy */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5 text-primary" /> ALERT DELIVERY CHANNEL STRATEGY — Perbandingan Performa WhatsApp vs Email vs In-App untuk Berbagai Tipe Sinyal: Open Rate, Click Rate, Action Rate, dan Strategi Channel Mix yang MJP Gunakan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Channel</th>
                  <th className="p-1 text-center">Open Rate</th>
                  <th className="p-1 text-center">Click Rate</th>
                  <th className="p-1 text-center">Action Rate</th>
                  <th className="p-1 text-center">Best for</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["WhatsApp Business", "94%", "61%", "38%", "Urgent alerts, SKK expiry"],
                  ["Email (digest)", "34%", "22%", "11%", "Daily summary, low urgency"],
                  ["In-app notification", "71%*", "48%", "29%", "Dashboard users, power users"],
                  ["Push notification (mobile)", "67%", "44%", "27%", "Field team, Expo mobile app"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[1]) >= 70 ? "text-emerald-700" : parseFloat(row[1]) >= 40 ? "text-orange-700" : "text-red-700"}`}>{row[1]}</td>
                    <td className={`p-1 text-center ${parseFloat(row[2]) >= 50 ? "text-emerald-700" : parseFloat(row[2]) >= 30 ? "text-orange-700" : "text-muted-foreground"}`}>{row[2]}</td>
                    <td className={`p-1 text-center ${parseFloat(row[3]) >= 30 ? "text-emerald-700" : parseFloat(row[3]) >= 20 ? "text-orange-700" : "text-muted-foreground"}`}>{row[3]}</td>
                    <td className="p-1 text-[7px] text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[7px] text-muted-foreground italic mb-1">*In-app open rate = percentage of logged-in sessions where notification was viewed. Not comparable to push/email.</p>
          {[
            { insight: "WhatsApp 3.5x lebih efektif dari email untuk action rate", detail: "Ini adalah perbedaan yang mengubah produk strategy. MJP awalnya (2022–2023) hanya punya email delivery. Action rate 11% berarti 89% alert tidak menghasilkan tindakan klien. WhatsApp launch (Q1 2024) mengubah paradigma. Tapi WhatsApp delivery memiliki cost: setiap message terkirim via API = Rp 150–300/pesan. Untuk 487 klien × 3 alert/hari: Rp 219k–438k/hari. Ini adalah COGS yang harus dikelola.", tc: "text-emerald-700" },
            { insight: "Channel mix strategy per klien tier", detail: "Starter: email only (cost control). Pro: email + WhatsApp digest (1 message/hari). Enterprise: WhatsApp per-alert + email backup + in-app. Diferensiasi channel sebagai tier value lever: WhatsApp real-time alert adalah Pro/Enterprise exclusive — salah satu alasan konkret upgrade dari Starter.", tc: "text-primary" },
            { insight: "Future channel: Telegram dan LINE (roadmap Q2 2027)", detail: "Survei klien Q1 2026: 18% klien di Sulawesi dan Kalimantan prefer Telegram karena infrastruktur WhatsApp kadang unstable di region mereka. LINE: 4% klien (mostly BUJK dengan partner Jepang/Korea). Low priority tapi noted — regional channel preference adalah real user need.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Channel performance data dikumpulkan Hendra Jr. dari delivery logs sejak Q1 2024 (WhatsApp launch). Email stats sejak 2022. Metodologi: action rate = persentase recipient yang melakukan tindakan measurable (klik link, buka platform, atau Reza dapat confirmation bahwa klien acted on alert) dalam 4 jam dari delivery. Hendra Jr. membangun custom analytics pipeline karena off-the-shelf tools tidak track WhatsApp actions yang terjadi outside the platform. Data quality: email dan in-app highly reliable. WhatsApp action rate diestimasi dari downstream behavior (login spike after WA delivery) — tidak sempurna tapi consistent enough untuk decision-making.</p>
      </div>

      {/* R98: Signal Intelligence Roadmap 2027–2028 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> SIGNAL INTELLIGENCE ROADMAP 2027–2028 — 7 Jenis Sinyal Baru yang MJP Berencana Tambahkan: Dari Satellite Imagery hingga Social Listening Konstruksi dan Court Records Procurement Disputes
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "SI-1: Satellite imagery — Deteksi aktivitas konstruksi lapangan", eta: "2027 Q3", complexity: "HIGH", rationale: "Planet Labs / Maxar imagery API: identifikasi proyek yang sedang berjalan vs proyek mangkrak dari udara. Nilai untuk klien: mengetahui kapasitas aktual BUJK yang sedang claim sedang sibuk atau tidak tersedia. Hendra Jr. sudah contact Planet Labs untuk pricing — Rp 80–120jt/tahun untuk Indonesia coverage.", tc: "text-orange-700" },
            { signal: "SI-2: Social media listening — Kontraktor dan proyek discussion", eta: "2027 Q1", complexity: "MEDIUM", rationale: "Twitter/X, Facebook Group 'Kontraktor Indonesia' (420k members), Telegram channels konstruksi. Sentiment analysis: rumor tentang panitia tender, complaint tentang pembayaran, reputasi BUJK di komunitas. Hendra Jr. sedang evaluate open-source NLP untuk Bahasa Indonesia.", tc: "text-blue-700" },
            { signal: "SI-3: Court records — Procurement dispute outcomes", eta: "2027 Q2", complexity: "MEDIUM", rationale: "SIPP (Sistem Informasi Penelusuran Perkara) Mahkamah Agung: sengketa pengadaan konstruksi. BUJK yang sering bersengketa di pengadilan adalah Trust Score red flag. Sudah ada dalam roadmap sebagai 'blacklist expansion' — court records adalah formalization.", tc: "text-blue-700" },
            { signal: "SI-4: Bank Garansi intelligence — Track rekam jejak pembayaran", eta: "2028 Q1", complexity: "VERY HIGH", rationale: "Perbankan data: tidak publik, butuh partnership dengan bank BUMN (BNI, BRI, Mandiri) yang jadi penjamin bank garansi proyek. Jika partnership tercapai: credit risk scoring yang tidak bisa direplikasi oleh kompetitor manapun.", tc: "text-red-700" },
            { signal: "SI-5: Import manifest — Material sourcing intelligence", eta: "2027 Q4", complexity: "HIGH", rationale: "Bea Cukai HS code tracking untuk material konstruksi impor (besi, semen khusus, equipment). BUJK yang import material sendiri = lebih besar, lebih capable. Proxy untuk scale dan specialization.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.signal}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.eta} · {r.complexity}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.rationale}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal roadmap ini adalah Hendra's 5-year intelligence ambition captured in a single page. Hendra Jr. skeptical terhadap beberapa item (SI-4 bank garansi: 'partnership dengan BUMN bank butuh years of relationship building'), tapi Hendra sengaja mempertahankan aspirational items sebagai north star. Tidak semua akan terealisasi — tapi having the map mempengaruhi arsitektur decisions hari ini (Hendra Jr. selalu build dengan assumption bahwa data sources akan bertambah, bukan fixed). Dari 5 sinyal: SI-2 (social listening) adalah yang paling siap karena tooling sudah mature dan data adalah publik. SI-1 (satellite) adalah yang paling differentiated tapi paling mahal. SI-4 (bank garansi) adalah holy grail — jika terwujud, MJP menjadi platform credit risk yang tidak ada analognya di Indonesia untuk sektor konstruksi.</p>
      </div>

      {/* R99: Signal Noise Budget per Klien Tier */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5 text-primary" /> SIGNAL NOISE BUDGET — Berapa Banyak Alert yang Terlalu Banyak: Penelitian MJP tentang Alert Fatigue, Optimal Frequency per Tier, dan Mengapa Mengurangi Alert Volume Justru Meningkatkan Engagement Rate
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Tier</th>
                  <th className="p-1 text-center">Avg alerts/week</th>
                  <th className="p-1 text-center">Action rate</th>
                  <th className="p-1 text-center">Fatigue threshold</th>
                  <th className="p-1 text-center">Optimal budget</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Starter", "8.3", "52%", "12/week", "6–10/week", "text-emerald-700"],
                  ["Pro", "21.7", "47%", "28/week", "15–22/week", "text-blue-700"],
                  ["Enterprise", "38.4", "61%", "45/week", "30–40/week", "text-primary"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/40 transition-colors">
                    <td className={`p-1 font-bold ${row[5]}`}>{row[0]}</td>
                    <td className="p-1 text-center">{row[1]}</td>
                    <td className={`p-1 text-center font-bold ${parseFloat(row[2]) > 55 ? "text-emerald-700" : "text-orange-700"}`}>{row[2]}</td>
                    <td className="p-1 text-center text-red-700 font-mono">{row[3]}</td>
                    <td className={`p-1 text-center font-bold ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Paradox: Enterprise klien receive more alerts but have higher action rate", detail: "Counter-intuitive finding dari Hendra Jr.'s data: Enterprise klien receive 38.4 alerts/week vs Starter's 8.3, yet Enterprise action rate (61%) beats Starter (52%). Explanation: Enterprise klien curate their subscription profile more carefully. They set precise KBLI filters, value ranges, and geographic scopes. Result: every alert is highly relevant. Starter klien often use broad settings and receive alerts they don't care about — killing action rate.", tc: "text-primary" },
            { insight: "Alert fatigue cliff: action rate drops 40% above threshold", detail: "Data shows non-linear fatigue effect: action rate stays stable up to the threshold (12/28/45 per week), then drops precipitously. Klien above threshold: some begin ignoring all alerts — not just excess ones. This 'alert blindness' is most damaging. MJP's response: auto-throttle feature (in development) that detects below-threshold action rate and suggests reducing subscription scope.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Alert noise budget research dimulai setelah Reza received 3 churned-klien exit surveys dalam satu bulan yang semua mention: 'terlalu banyak notifikasi'. Hendra Jr. pulled 90 days of alert data untuk semua churned klien (n=31) vs retained klien yang punya similar profile. Finding: churned klien averaged 34% above their tier's fatigue threshold. Retained klien: 18% below. The signal was clear enough to trigger an immediate product decision: add weekly alert digest option (receive all alerts in 1 email/WhatsApp per week instead of individually). Adoption in first month: 22% of Starter klien switched to digest mode. Their churn rate in subsequent quarter: 31% lower. Hendra Jr.: 'Kita pikir lebih banyak notification berarti lebih banyak engagement. Data bilang sebaliknya.'</p>
      </div>

      {/* R100: Signal Intelligence as Business Insurance */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-primary" /> SIGNAL INTELLIGENCE AS BUSINESS INSURANCE — Reframing MJP dari 'Platform Informasi' ke 'Proteksi Bisnis': Kalkulasi Biaya Tidak Berlangganan MJP vs Biaya Berlangganan, dan 5 Kasus Kerugian yang Bisa Dicegah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[7px] text-muted-foreground mb-2">Reza's most effective close for price-sensitive Starter prospects: reframe dari 'Rp 399k/bulan untuk informasi' ke 'Rp 399k/bulan untuk mencegah kerugian yang jauh lebih besar.' Insurance framing mengubah purchase psychology dari discretionary ke essential.</p>
          {[
            { case_id: "CASE-A: Missed tender because not subscribed to right LPSE", loss: "Rp 3–15M opportunity cost (typical mid-tier tender margin)", prevention: "Tender Alert + LPSE multi-portal coverage. 1 tender caught = 7–37 months of Starter subscription paid. Probability of missing qualifying tender per month without MJP: ~23% based on klien interviews.", tc: "text-red-700" },
            { case_id: "CASE-B: Bid disqualification due to expired SKK", loss: "Rp 500k–5M preparation cost wasted (estimasi, dokumen, site visit) + 0% chance of recovery", prevention: "SKK expiry alert 90 days in advance. Renewal cost: Rp 3–8jt. Prevention ROI: 100% avoided loss. Cases documented in MJP database: 23 klien who renewed SKK after MJP alert and subsequently won tenders they would have been ineligible for.", tc: "text-red-700" },
            { case_id: "CASE-C: Sub-con to blacklisted BUJK", loss: "Potential contract violation + PPK mengambil tindakan. Rp 50M–2M dalam exposure kasus ekstrem", prevention: "BUJK Trust Score + blacklist check before awarding sub-contract. Cost of 1 blacklist lookup: included in subscription. 1 prevented bad sub-con = years of subscription covered.", tc: "text-orange-700" },
            { case_id: "CASE-D: Compliance violation due to missed regulatory change", loss: "Denda administratif Rp 5–50M + potential SKK revocation + reputational damage dengan PPK", prevention: "Regulatory alert for critical changes (impact score 15+). 3 documented cases of MJP klien receiving alert and updating compliance before scheduled audit. Estimated penalty avoided: Rp 180M total across 3 cases.", tc: "text-orange-700" },
            { case_id: "CASE-E: Overbid tender because misread competitor pricing landscape", loss: "Lost contract opportunity. Profit tidak terealisasi dari tender yang harusnya bisa dimenangkan dengan harga lebih kompetitif.", prevention: "IjinTender competitor price data + HPS estimator. Correct bid pricing = higher win probability. MJP klien win rate: 34.2% vs industry 22.7% (+11.5pp). Enterprise subscription cost 12 months: Rp 33.6jt. 1 additional won contract from better pricing: typically Rp 200M+.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.case_id} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.case_id}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Potential loss: {r.loss}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Prevention: {r.prevention}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Insurance framing adalah Reza's single most impactful pitch evolution since 2021. Original pitch: 'MJP memberikan informasi tender dan regulasi terlengkap di Indonesia.' Result: klien interested but not urgent — information has low urgency. New pitch: 'Setiap bulan tanpa MJP adalah sebuah bulan dimana kamu exposed terhadap CASE-A through CASE-E. Biaya exposure itu jauh lebih besar dari Rp 399k.' Result: urgency shifted. Close rate for price-sensitive Starter segments improved 28% after Reza started using insurance framing. Hendra: 'Reza menemukan ini sendiri dari observasi. Saya tidak ajarkan ini ke dia. Tapi begitu dia share, saya langsung codify ke dalam sales playbook. The best sales insights come from field observation, not strategy meetings.'</p>
      </div>

      {/* R101: Signal Intelligence Seasonal Patterns */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-primary" /> SIGNAL INTELLIGENCE SEASONAL PATTERNS — Bagaimana Aktivitas Tender, Regulasi, dan SKK Berfluktuasi Sepanjang Tahun: 12-Bulan Kalender Intelligence dengan Peak Periods, Dry Spells, dan Implikasi untuk Strategi MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[7px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Bulan</th>
                  <th className="p-1 text-center">Tender volume</th>
                  <th className="p-1 text-center">Regulatory activity</th>
                  <th className="p-1 text-center">SKK activity</th>
                  <th className="p-1 text-center">MJP platform usage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Jan–Feb", "LOW (budget allocation phase)", "HIGH (PP/Permen awal tahun)", "LOW", "HIGH (planning mode)", "text-orange-700"],
                  ["Mar–Apr", "RISING (tender mulai terbit)", "MEDIUM", "RISING (pre-tender prep)", "HIGH", "text-primary"],
                  ["Mei–Jun", "PEAK (tender most active)", "LOW", "HIGH (renewal deadline push)", "PEAK", "text-emerald-700"],
                  ["Jul–Agt", "HIGH (IKN construction peak)", "MEDIUM", "MEDIUM", "HIGH", "text-emerald-700"],
                  ["Sep–Oct", "MEDIUM", "HIGH (APBN revision period)", "MEDIUM", "MEDIUM", "text-blue-700"],
                  ["Nov–Des", "LOW → SPIKE (new TA announcements)", "HIGH (year-end regulatory push)", "HIGH (year-end renewal)", "MEDIUM → HIGH", "text-orange-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/40 transition-colors">
                    <td className={`p-1 font-bold ${row[5]}`}>{row[0]}</td>
                    <td className={`p-1 text-center ${row[5]}`}>{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center font-bold ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "Mei–Juni adalah 'harvest season' untuk MJP klien dan MJP itself", detail: "Platform usage peaks when tender activity peaks. This is MJP's best month for: (1) upsell campaigns — active klien are most receptive when they're actively using the platform, (2) renewal conversations — klien who are active in tender season don't want to risk their subscription lapsing, (3) referral activation — satisfied active klien are most likely to refer during peak season. Hendra: 'Reza prioritizes upsell calls in May–June every year. Not arbitrary — it's data-driven.'", tc: "text-emerald-700" },
            { insight: "Nov–Des: highest churn risk + best opportunity for annual prepay conversion", detail: "Year-end: budget review cycles, CFO review of SaaS subscriptions, 'cleaning up' vendors. Churn risk peaks. Counter-strategy: offer annual prepay incentive in October (20% discount + lock-in). Klien who accept annual prepay in October/November: near-0% churn risk for 12 months. Reza's October push: 'Sign annual now, save Rp 1jt, don't think about this again for a year.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Seasonal pattern data dikumpulkan Hendra Jr. dari 4 years of platform usage logs. Pattern sangat consistent — construction procurement Indonesia follows annual budget cycle tightly. Practical implication: Hendra Jr. schedules infrastructure upgrades dalam Jan–Feb (lowest usage = safest time for maintenance windows). Sari schedules major Knowledge Registry reviews dalam Sep–Oct (regulatory activity high but tender volume lower = lower pressure on alert delivery). Budi's field trips: March–April (right before tender season peak) dan October (post-IKN peak). Hendra: 'Kalau kita tidak tahu kapan rush hour-nya industri kita, kita tidak bisa prepare untuk itu. Seasonal intelligence adalah operational planning foundation — bukan sekedar interesting data.'</p>
      </div>

      {/* R102: Signal Intelligence Privacy Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> SIGNAL INTELLIGENCE PRIVACY FRAMEWORK — Bagaimana MJP Mengumpulkan Sinyal Pasar Tanpa Melanggar Privasi: 3 Prinsip yang Memisahkan 'Intelligence' dari 'Surveillance' — Relevansi UU PDP Indonesia Terhadap Setiap Sumber Data MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { principle: "P1: Only public or contractually consented data — zero scraping of private systems", sources_allowed: "LPSE portals (government public procurement — fully public by law), LKPP databases, BNSP registry, company registrations (OSS-RBA), published news and regulatory documents.", sources_prohibited: "Social media private accounts, internal company documents, tender results not yet officially published, court records not yet publicly available, any source requiring unauthorized access.", legal_basis: "PP No. 71/2019 (Penyelenggaraan Sistem dan Transaksi Elektronik) + UU PDP 2022: data yang bersumber dari public government systems are not considered personal data subject to consent requirements.", tc: "text-primary" },
            { principle: "P2: BUJK-level data, never individual-level PII in core product", sources_allowed: "Company registration data, SKK holder counts per company, bid submission records (company attribution), financial grading (public). These are business identity data, not personal data under UU PDP.", sources_prohibited: "Individual home addresses, personal phone numbers of company directors beyond what is in public registrations, personal social media, family information.", legal_basis: "UU PDP 2022 Pasal 2: personal data refers to data that can identify a natural person. BUJK company data (badan hukum) is not covered by the same personal data protections.", tc: "text-blue-700" },
            { principle: "P3: Signal inference from aggregates only — no individual behavioral targeting", what_is_allowed: "Aggregate signal: '347 BUJK dalam kategori Mekanikal mengakses tender IKN dalam 30 hari terakhir.' Used for: market trend reports, competitor landscape analysis, regional activity maps.", what_is_prohibited: "Individual behavioral tracking: 'BUJK X viewed tender Y 7 times this week' — this creates a user surveillance profile that is privacy-invasive even if technically legal.", rationale: "Even if individual tracking were legal: klien trust requires MJP to use platform behavioral data to improve the platform, not to create intelligence products about klien behavior.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.principle} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.principle}</p>
              {'sources_allowed' in r ? (
                <>
                  <p className="text-[7px] text-muted-foreground mb-0.5">Allowed: {r.sources_allowed}</p>
                  <p className="text-[7px] text-muted-foreground mb-0.5">Prohibited: {r.sources_prohibited}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>Legal basis: {r.legal_basis}</p>
                </>
              ) : (
                <>
                  <p className="text-[7px] text-muted-foreground mb-0.5">Allowed: {(r as any).what_is_allowed}</p>
                  <p className="text-[7px] text-muted-foreground mb-0.5">Prohibited: {(r as any).what_is_prohibited}</p>
                  <p className={`text-[7px] font-mono ${r.tc}`}>Rationale: {(r as any).rationale}</p>
                </>
              )}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Privacy framework adalah dokumen yang Hendra Jr. draft dan Hendra review with external legal counsel (Rp 12jt one-time engagement) setelah UU PDP Indonesia disahkan pada 2022. Investment: menemukan bahwa MJP's existing practices were already largely compliant — legal review confirmed P1 and P2 were sound, added P3 as new principle after counsel's recommendation. Most significant implication from legal review: Sari's Knowledge Registry assets yang berisi individual expert names in regulatory documents (e.g., 'Dr. X, author of Permen PUPR No. Y') — permissible as these are public professional credentials, not private data. Hendra Jr.: 'Privacy compliance bukan hanya risk management. Ini adalah differentiator. Klien yang trust MJP dengan data bisnis mereka — mereka perlu tahu bahwa kita juga menjaga standar tinggi dalam cara kita mengumpulkan data tentang orang lain.'</p>
      </div>

      {/* R103: Market Signal Validation Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> SIGNAL VALIDATION FRAMEWORK — Bagaimana MJP Memastikan Sinyal Pasar yang Ditampilkan adalah Real, Bukan Noise: 3-Layer Validation Process, Signal-to-Noise Ratio Aktual, dan 4 Sinyal yang Pernah Ternyata Salah
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { layer: "Layer 1: Source reliability weighting", desc: "Setiap sinyal diberi bobot berdasarkan reliability score sumbernya. Tier-A source (LPSE resmi, JDIH, BNSP): weight 1.0. Tier-B (berita industri terverifikasi, asosiasi official): weight 0.7. Tier-C (social media, forum, unverified reports): weight 0.3. Signals from < Tier-B source never shown in 'HIGH CONFIDENCE' category — downgraded to 'EARLY SIGNAL' regardless of volume.", signal_catch: "Prevents amplification of low-quality signals. 34% of raw signals filtered to lower tier before reaching klien-facing display.", tc: "text-primary" },
            { layer: "Layer 2: Corroboration requirement for HIGH CONFIDENCE signals", desc: "Signal rated HIGH CONFIDENCE only if: minimum 2 independent Tier-A sources confirm the same pattern, OR 1 Tier-A + > 3 corroborating Tier-B sources. Corroboration check is automated for quantitative signals (tender volume trends), semi-manual for qualitative signals (policy direction interpretation).", signal_catch: "Prevents false positives from single-source anomalies. 12% of initially HIGH-rated signals downgraded after corroboration check.", tc: "text-blue-700" },
            { layer: "Layer 3: Temporal consistency gate", desc: "Signal must show consistent pattern across minimum 3 consecutive time periods before HIGH CONFIDENCE elevation. Spike in single period: EARLY SIGNAL. Consistent trend across 3+ periods: CONFIRMED SIGNAL. This prevents 'one-week wonder' signals from misleading klien into operational decisions.", signal_catch: "Catches: seasonal spikes mistaken for structural trends (IKN tender volume spike in July 2024 was initially over-rated until pattern confirmed sustained).", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.layer} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.layer}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>What it catches: {r.signal_catch}</p>
            </div>
          ))}
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-orange-700 mb-1">4 signals that were wrong — and what MJP learned</p>
            {[
              { signal: "S-WRONG-1 (2022): 'Konstruksi solar panel akan boom' — EARLY SIGNAL rating, later downgraded", lesson: "3 Tier-B sources in 1 week. Looked like corroboration. But all 3 articles cited the same single government statement. True corroboration requires independent primary sources — citing the same source doesn't count. Rule updated." },
              { signal: "S-WRONG-2 (2023): 'IKN tender volume akan turun Q3 2023' — wrong direction", lesson: "MJP predicted based on rainy season historical pattern from non-IKN tenders. IKN construction schedule ignored rainy seasons (aggressive APBN timeline). Model now has IKN as separate seasonal category." },
              { signal: "S-WRONG-3 (2024): 'Kualifikasi Menengah klien akan upgrade to Besar in 6 months' — too optimistic", lesson: "Based on BNSP data showing high J8/J9 upgrade rates. Didn't account for company size requirement in kualifikasi Besar (minimum 6 permanent employees). Many BUJK qualified in SKK but not in size." },
              { signal: "S-WRONG-4 (2025): 'BUJK asing activity in IKN will decrease Q2 2025' — wrong", lesson: "Based on visa application slowdown. But BUJK Asing don't use standard visa process — they use specific contractor visa category not tracked by source. Data gap, not trend reversal." },
            ].map((w) => (
              <div key={w.signal} className="mb-1">
                <p className="text-[7px] font-bold text-orange-700">{w.signal}</p>
                <p className="text-[7px] text-muted-foreground">Learning: {w.lesson}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal validation framework adalah hasil dari 4 years of learning from being wrong. MJP's early signal display (2022–2023) had no formal validation — Sari curated signals based on judgment, and Hendra Jr. displayed them. Wrong signals appeared occasionally and damaged klien trust. Post-2023 formal validation: wrong signal rate dropped from estimated 18% to {'<'} 4%. Each 'S-WRONG' case is documented not to embarrass the team but to update the validation rules. The 4 documented cases each improved the framework in ways that prevented categories of future errors. Sari: 'Validasi sinyal yang kaku terasa lambat. Tapi satu sinyal yang salah yang membuat klien mengambil keputusan operasional yang buruk — itu lebih mahal dari semua false negatives yang pernah ada. Kami belajar ini dengan cara yang menyakitkan.'</p>
      </div>

      {/* R104: Signal Intelligence for Partnership Decisions */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Handshake className="h-3.5 w-3.5 text-primary" /> SIGNAL INTELLIGENCE FOR PARTNERSHIP — Bagaimana MJP Menggunakan Platform Sendiri untuk Membuat Keputusan Partnership: 4 Partnership Evaluations yang Dijalani dengan Signal Intelligence Framework sebagai Panduan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { eval: "PE-1: Evaluasi partnership dengan platform manajemen proyek konstruksi (rejected)", signal_basis: "Sinyal: platform tersebut growing rapidly in 2023. BUT: MJP signal data showed their growth was concentrated in Jakarta only (85% of their reported users). IKN signal: zero traction. Regulatory signal: zero presence in BUJK workflow discussions. Assessment: large in one city, shallow everywhere else.", decision: "REJECTED. Hendra: 'Jika kami partner dengan mereka, kami hanya mendapatkan akses ke audiens yang already concentrated in same geography as our strongest market. No new market access, just shared customer base.'", outcome: "Correct call — platform raised funding but growth stalled outside Jakarta. Partnership would have been net negative (brand association with declining trajectory).", tc: "text-muted-foreground" },
            { eval: "PE-2: Evaluasi partnership dengan bank BUMN untuk bank garansi konstruksi (accepted)", signal_basis: "Sinyal: BUJK tender activity signal showed 78% of tenders > Rp 5M require bank guarantee. MJP's Trust Score data showed 23% of BUJK applying for bank guarantee have incomplete documentation (common rejection reason). Gap: no tool bridges BUJK intelligence and bank guarantee process.", decision: "ACCEPTED as pilot (Q3 2026). MJP provides BUJK Trust Score data to bank's credit officer system via API. Bank provides MJP klien preferred processing for bank guarantee documentation. Pilot: 2 Enterprise klien, 3-month evaluation.", outcome: "Pilot in progress. Early signal: bank credit officers save 40 min/application from Trust Score data. BUJK klien report faster bank guarantee approval. Full partnership decision: Q4 2026.", tc: "text-emerald-700" },
            { eval: "PE-3: Evaluasi partnership dengan platform e-signature Indonesia (negotiating)", signal_basis: "Sinyal: e-signature regulatory adoption signal (PP No. 28/2022 on electronic procurement documents) shows rapid regulatory mandating of e-signature for tender submissions. BUJK pain point: getting e-signature certificate quickly. Current friction: 3–5 business days for first certificate issuance.", decision: "NEGOTIATING. Hendra wants: MJP klien get expedited (24-hour) e-signature certificate through partner. Partner wants: access to MJP's 847 klien as distribution channel.", outcome: "Decision pending. Hendra Jr.'s concern: e-signature partner's API quality is below MJP's integration standards. Signal intelligence supports the market case; technical standards must be met before partnership confirmed.", tc: "text-blue-700" },
            { eval: "PE-4: Evaluasi joining LKPP's official vendor ecosystem (ongoing)", signal_basis: "LKPP launched 'Mitra Pengadaan' program — official recognition for third-party procurement tools. Being listed = government endorsement for MJP. Signal: 34% of BUJK survey respondents cited 'government recommendation' as trust factor for procurement tools.", decision: "PURSUING. Application submitted Q1 2026. Requirements: data security audit (in progress), ToS compliance review (completed), reference from 3 existing Enterprise BUJK (secured). Decision from LKPP: expected Q3 2026.", outcome: "If approved: MJP becomes one of first procurement intelligence tools in LKPP's official ecosystem. SEG-4 (new BUJK) conversion rate likely to increase significantly with government endorsement.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.eval} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.eval}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Signal basis: {r.signal_basis}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Decision: {r.decision}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Outcome: {r.outcome}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Partnership evaluation using signal intelligence adalah meta-application of MJP's own product — using the platform's market signal data to make strategic decisions for the company itself. This is one of Hendra's most creative uses of MJP's capabilities: 'Kami membangun platform untuk BUJK membuat keputusan lebih baik berdasarkan intelligence. Mengapa kami tidak menggunakan platform kami sendiri untuk membuat keputusan strategis MJP dengan lebih baik?' The PE-1 rejection was validated when the rejected partner's growth stalled. The PE-2 bank partnership was enabled by MJP's Trust Score data being exactly what banks needed. Signal intelligence as decision framework for MJP itself is a practice that Hendra plans to formalize post-Series A: quarterly 'signal-based strategic review' where major company decisions are backed by signal data from the platform, not just gut instinct.</p>
      </div>

      {/* R105: The Signal That Predicted IKN */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <History className="h-3.5 w-3.5 text-primary" /> THE SIGNAL THAT PREDICTED IKN — Kisah Paling Penting dalam Sejarah Sinyal MJP: Bagaimana Kombinasi Sinyal Regulasi, Budget, dan Aktivitas BUJK Memberi Hendra 14 Bulan Advance Warning Sebelum IKN Diumumkan Secara Masif
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "Phase 1 (Q3 2021): Regulasi signal — PP No. 17/2021 dan UU No. 3/2022", signal: "Sari detected PP No. 17/2021 (penyelenggaraan penataan ruang) — contained specific provisions for new government center relocation that were more detailed than typical spatial planning. Combined with UU Ibu Kota Negara deliberation signals in DPR calendar: Sari flagged as 'anomalous regulatory attention to relocation provisions.'", confidence: "WEAK — 23% confidence. 'Regulasi ini mungkin hanya pembaruan rutin. Atau ini serius.'", tc: "text-muted-foreground" },
            { phase: "Phase 2 (Q4 2021): Budget signal — RAPBN 2022 anomaly", signal: "Hendra Jr.'s crawler detected unusual RAPBN 2022 budget allocation language: 'pembangunan infrastruktur di Kalimantan Timur' with a specific Rp 2.4T allocation without named project. Cross-referenced with Phase 1 regulatory signal: pattern emerging. Budget allocations without named projects are rare — they typically indicate projects awaiting formal announcement.", confidence: "MEDIUM — 51% confidence. Combined with Phase 1: 'Sesuatu sedang dipersiapkan. Besar. Kalimantan.'", tc: "text-orange-700" },
            { phase: "Phase 3 (Q1 2022): BUJK activity signal — unusual construction company registrations", signal: "MJP BUJK database: spike in new BUJK registrations with KBLI categories specific to large-scale civil infrastructure (jalan tol, jembatan besar, konstruksi pemerintah skala nasional) in East Kalimantan region. 340% increase in new BUJK registrations vs same period prior year. Contractors were preparing BEFORE public announcement.", confidence: "HIGH — 78% confidence. 'BUJK yang smart sudah tahu. Mereka sedang bersiap.'", tc: "text-blue-700" },
            { phase: "Phase 4 (Q2 2022): IKN formally announced — MJP was ready", signal: "President Jokowi officially confirmed Nusantara as IKN location (March 2022). MJP already had: (1) dedicated IKN LPSE monitoring infrastructure, (2) KBLI-specific tender alert categories for IKN project types, (3) briefing for all Enterprise klien within 6 hours of announcement with MJP's intelligence backlog. 14-month advance signal processing paid off.", confidence: "CONFIRMED — 100%. MJP's IKN preparation: 14 months ahead of market.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Signal: {r.signal}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.confidence}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The IKN signal story adalah bukti paling konkret tentang mengapa signal intelligence berbeda dari sekedar mengumpulkan data: single data points mean little; cross-source pattern recognition is where intelligence emerges. No single signal (regulation, budget, BUJK registration) was sufficient to predict IKN. The combination of three independent signals from three different data sources — converging on the same geography and timeline — is what gave Hendra conviction. This is what Sari calls 'signal convergence': when independent signals from unrelated sources point to the same conclusion, confidence rises non-linearly. Sari's internal rule: 'Satu sinyal adalah noise. Dua sinyal yang tidak terhubung adalah interesting. Tiga sinyal yang tidak terhubung yang menunjuk ke arah sama adalah intelligence.' When Hendra was able to brief Enterprise klien within 6 hours of IKN announcement — while competitors scrambled — 3 Enterprise klien cited that moment specifically as why they renewed. The briefing was not just content delivery: it was proof that MJP's signal intelligence was structurally ahead of the market. Hendra: 'IKN adalah momen di mana semua investasi dalam sistem sinyal kami terbayar dalam satu hari. Dan klien merasakannya.'</p>
      </div>

      {/* R106: Next Major Infrastructure Signal — What Sari Is Watching Now */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Telescope className="h-3.5 w-3.5 text-primary" /> NEXT INFRASTRUCTURE SIGNAL — Apa yang Sari Pantau Saat Ini: 4 Konvergensi Sinyal yang Bisa Menjadi 'IKN Berikutnya' untuk Platform MJP dalam 18–36 Bulan ke Depan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "CONVERGENCE-1: Food estate + agroindustri infrastructure Kalimantan Tengah", evidence: "Regulatory: PP No. 23/2021 (forest land use for food estate), Perpres No. 109/2022 mentions food estate infrastructure. Budget: Rp 1.4T allocated in RAPBN 2025 and 2026 for 'infrastruktur kawasan produksi pangan.' BUJK activity: new construction company registrations with KBLI pertanian+konstruksi in Kalteng up 180% YoY. Pattern: similar to early IKN signal profile but at smaller scale.", confidence: "41% — interesting but not yet a convergence. 3rd signal (BUJK mobilization to specific geography) not yet clear.", tc: "text-primary" },
            { signal: "CONVERGENCE-2: Nusantara Phase 2 — government district beyond KIPP", evidence: "IKN Phase 1 (KIPP: Kawasan Inti Pusat Pemerintahan) is the presidential palace + government ministries area. Phase 2 (2025–2029): broader city development — residential, commercial, port, airport. Budget signal: Rp 47T in RAPBN 2026 for 'pengembangan IKN non-KIPP.' BUJK activity: companies that won KIPP contracts now registering subsidiaries in Kaltim to position for Phase 2 local preference advantages.", confidence: "67% — this is likely happening. MJP already has IKN intelligence infrastructure. Competitive advantage: MJP can brief klien on Phase 2 opportunities before Phase 2 formal LPSE announcements begin.", tc: "text-emerald-700" },
            { signal: "CONVERGENCE-3: Trans-Sulawesi Highway Phase 3", evidence: "PUPR's Trans-Sulawesi Highway completion is a multi-decade project. Phase 3 (Sulawesi Tengah to Sulawesi Barat) has been in planning since 2019. Regulatory signal (Q4 2025): PUPR published revised AMDAL requirements for Trans-Sulawesi sections — typically precedes tender announcement by 12–18 months. Budget signal: Rp 8.3T multi-year allocation in APBN 2026.", confidence: "58% — similar signal pattern to early IKN. If correct: tenders beginning Q2–Q3 2027. MJP currently has weak Sulawesi LPSE coverage (NPS detractor issue). Infrastructure investment in Sulawesi Tier-2 LPSE needed before tenders open.", tc: "text-blue-700" },
            { signal: "CONVERGENCE-4: Green energy infrastructure — PLTS and PLTU transition", evidence: "Presidential Regulation on energy transition (target: 23% renewable by 2025, 34% by 2030 — currently 12.5%). BUJK construction implications: new PLTS projects require civil construction contractors with specific electrical infrastructure KBLI. Budget: Kementerian ESDM budget for renewable energy infrastructure 2026: Rp 23T. Signal: new BUJK registering with 'konstruksi energi terbarukan' KBLI in Java and Sulawesi in 2025–2026.", confidence: "47% — real market, real budget, but tender mechanism unclear (BUMN-direct vs LPSE). If PLTS projects go to LPSE: MJP's tender monitoring captures it. If BUMN-direct: invisible to current MJP infrastructure.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Evidence: {r.evidence}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Confidence: {r.confidence}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Next infrastructure signal monitoring adalah Sari's most forward-looking work — using the IKN prediction framework to identify the next major market opportunity before it becomes obvious. The IKN experience taught MJP that 14 months of advance signal processing creates an insurmountable information advantage. The goal: replicate that advantage for IKN Phase 2 (highest confidence at 67%) and Trans-Sulawesi (58%). Action items: CONVERGENCE-2 (IKN Phase 2): Hendra Jr. to build Phase 2 monitoring infrastructure by Q3 2026, briefing ready for Enterprise klien before Phase 2 LPSE opens. CONVERGENCE-3 (Trans-Sulawesi): Sulawesi LPSE infrastructure investment must happen before Trans-Sulawesi tenders open — infrastructure lag kills intelligence advantage. CONVERGENCE-1 and 4: monitoring only until 3rd signal appears. Sari: 'IKN mengajarkan saya bahwa sinyal terbaik datang 12–18 bulan sebelum pasar melihatnya. Pekerjaan saya adalah menjadi penerjemah sinyal-sinyal yang lemah sebelum mereka menjadi kuat.'</p>
      </div>

      {/* R107: The Daily Intelligence Digest — How MJP Curates the Signal Noise */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" /> DAILY INTELLIGENCE DIGEST — Bagaimana Tim MJP Mengkurasi dari 40.000+ Signal per Minggu Menjadi 3–5 Insight yang Benar-benar Penting: Proses Editorial di Balik Briefing Harian yang Klien Terima
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { step: "Step 1 (automated): Hendra Jr.'s crawler pipeline — 40.000+ events/week ingested", detail: "Every week: 671 LPSE portals × average 60 tender updates/portal = ~40.000 tender events. Plus: JDIH regulatory publications (~50/week), BNSP SKK updates (~200/week), forum monitoring (~300 posts/week). Total: ~40.600 raw events per week. All ingested, deduplicated, and stored in MJP's data layer automatically.", role: "Hendra Jr.'s responsibility: pipeline uptime and data quality. Human involvement at this stage: 0 (except for incident response).", tc: "text-primary" },
            { step: "Step 2 (algorithm): Relevance scoring — 40.000 events → ~3.200 flagged", detail: "Signal relevance algorithm: assigns score to each event based on (1) novelty (different from last 30 days of events from same source), (2) BUJK impact (how many of MJP's 847 klien are likely affected), (3) temporal urgency (event requires action within 14 days), (4) regulatory significance (CRITICAL/IMPORTANT/MONITORING tier). Events scoring above relevance threshold: ~3.200/week (8% of raw events).", role: "Hendra Jr. maintains algorithm. Sari tunes significance tier classifications. Monthly calibration meeting.", tc: "text-blue-700" },
            { step: "Step 3 (Sari): Editorial review — 3.200 flagged → 15–20 curated signals", detail: "Sari's daily review (part of her 7–9am monitoring window): triage the algorithm's top-flagged events. Questions she asks: 'Is this signal actually significant for BUJK decision-making? Does it require new Knowledge Registry content? Is it a false positive (algorithm-flagged but actually routine)? Is there context I know that makes this more or less important than the algorithm thinks?' Output: 15–20 curated signals per week with Sari's annotation.", role: "This is the irreplaceable human editorial step. The algorithm can score novelty and impact; only Sari can assess 'significance for practitioners.' 23% of algorithm-top-10 signals are downgraded by Sari (false positives). 8% of algorithm-bottom-100 signals are elevated by Sari (context knowledge the algorithm lacks).", tc: "text-emerald-700" },
            { step: "Step 4 (personalization): Per-klien relevance filtering — 15–20 signals → 3–5 per klien per day", detail: "After Sari's editorial curation: Hendra Jr.'s personalization layer filters the 15–20 weekly signals down to the 3–5 most relevant for each klien based on their KBLI profile, active tender interests, location, and past engagement with similar signals. Enterprise klien also receive full 15–20 curated signals as context. Starter klien: top 3 by KBLI relevance only.", role: "Personalization layer ensures signal overload doesn't cause alert fatigue. Average klien receives 3.4 signals per day — enough to be useful, not so many as to be overwhelming.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Role: {r.role}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Daily intelligence digest production adalah one of MJP's most complex operational processes — a 4-layer funnel that transforms 40.000 raw events into 3–5 daily insights that klien can act on. The key insight behind the architecture: more data ≠ more intelligence. Intelligence is data that has been filtered, contextualized, and made actionable. Without Sari's editorial layer (Step 3): klien would receive algorithm-curated signals that are technically relevant but practically noisy. Without Hendra Jr.'s personalization layer (Step 4): all klien would receive the same 15–20 signals regardless of their business context. The 4-layer architecture is a competitive moat: it took MJP 3 years to build and calibrate. The algorithm (Step 2) alone would produce a mediocre product. Sari's judgment (Step 3) is what transforms it from 'filtered data' to 'intelligence.' Sari's analogy: 'Algorithm saya adalah asisten yang tidak pernah lelah. Saya adalah editor yang tidak pernah mau tanda tangani sesuatu yang tidak saya percaya.' The two in combination: what klien actually receive and trust.</p>
      </div>

      {/* R108: Signal Fatigue — The Invisible Threat to Intelligence Platforms */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> SIGNAL FATIGUE — Ancaman Tersembunyi untuk Produk Intelligence: Bagaimana MJP Mengukur Alert Fatigue pada Kliennya dan 4 Mekanisme yang Digunakan untuk Mempertahankan Kualitas Perhatian Klien dari Waktu ke Waktu
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { symptom: "SF-1: Alert dismissal rate — % notifikasi yang dibuka vs diabaikan oleh klien", data: "Push notification open rate (mobile app): Year 1 average 61%, Year 3 average 44%, Year 5 average 38%. Email alert open rate: Year 1 average 55%, Year 3 average 37%, Year 5 average 29%. The declining trend is expected: as klien receive more alerts over time, they become more selective. BUT: the absolute open rate is still above industry benchmark (email alerts industry average: 21%). MJP is above benchmark but declining.", mechanism: "Hendra Jr.'s alert volume cap: each klien receives a maximum of 5 push notifications per day regardless of how many relevant tenders exist. Above 5: queued for next day or relegated to in-app inbox. This cap was introduced in Year 3 when Hendra Jr. noticed open rate decline accelerating above 7 alerts/day.", tc: "text-primary" },
            { symptom: "SF-2: Klien yang tidak pernah membuka app selama 14+ hari ('dormant klien')", data: "Dormant rate (14+ days without app open): current 19% of all active subscribers. This 19%: paying but not engaging. Of the 19%: 71% are Starter tier, 23% are Pro, 6% are Enterprise. The 6% dormant Enterprise klien are the most concerning: high ARR, low engagement, high churn risk. Hendra calls these 'sleeping giants' — they're paying for Enterprise but behaving like cancelled klien.", mechanism: "Automated dormancy alert to Reza: when any Pro or Enterprise klien crosses 14-day dormancy threshold, Reza receives a Slack alert and initiates personal outreach within 48 hours. Enterprise re-engagement rate after personal outreach: 67%. Pro re-engagement rate after email sequence: 34%. Starter dormancy: no active re-engagement (volume too high for manual outreach).", tc: "text-blue-700" },
            { symptom: "SF-3: NLQ session length shrinkage — klien mengajukan lebih sedikit pertanyaan seiring waktu", data: "NLQ average questions per session: Year 1 users average 4.2 questions/session; Year 3 same users average 2.8 questions/session. Interpretation: (a) positive: klien have internalized enough regulatory knowledge that they need to ask fewer questions, OR (b) negative: klien are getting less value from NLQ because their questions have changed but Sari's Knowledge Registry hasn't kept up. Both are happening in different segments.", mechanism: "Sari's NLQ question category tracking: new question categories emerging over time indicate evolving needs. When a new category emerges (3+ klien asking similar question types with no good answer): Sari prioritizes new Knowledge Registry assets for that category. NLQ freshness rate (% of questions getting high-confidence answers): target 82%, current 79%.", tc: "text-emerald-700" },
            { symptom: "SF-4: Signal source quality decay — beberapa sumber secara bertahap kehilangan relevansi", data: "Sari's annual signal source audit: tracks which signal sources are declining in actionability for klien. Finding from 2025 audit: 3 regulatory monitoring sources that were high-value in 2022 (specific ministerial circular channels) have declined in relevance as regulatory communication moved to different channels. These sources are generating volume but low actionability — signal noise rather than intelligence.", mechanism: "Annual source quality audit: Sari evaluates each of MJP's 47 monitored signal sources for actionability ratio (signals that produced klien action / total signals from source). Sources below 15% actionability for 2 consecutive years: deprecated from active monitoring, added to low-frequency archival mode. This keeps the signal-to-noise ratio high as the landscape shifts.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.symptom} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.symptom}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.data}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Mechanism: {r.mechanism}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal fatigue management adalah the discipline that separates intelligence platforms from alert services. Alert services send everything and let the user filter. Intelligence platforms send only what matters and take responsibility for the filtering. MJP aspires to be an intelligence platform — but the 4 metrics above show that managing fatigue is an ongoing operation, not a one-time product decision. The declining open rates (SF-1) are manageable if they stabilize above industry benchmark. The dormancy pattern (SF-2) is the most actionable for retention. The NLQ session shrinkage (SF-3) requires Sari's editorial judgment to distinguish 'klien is learning' from 'platform is falling behind.' The signal source quality decay (SF-4) requires annual maintenance to keep the intelligence funnel clean. Hendra's rule for the team: 'Jika klien harus mencari sinyal yang penting di antara sinyal yang tidak penting, kami sudah gagal. Tugas kami adalah memastikan setiap sinyal yang kami kirim worth their attention.' The alert volume cap (max 5 push/day per klien) is one of the most counterintuitive product decisions MJP has made: deliberately limiting notifications even when more notifications would be technically valid. Rationale: the quality of a klien's attention over 5 years is worth more than the quantity of their attention over 1 year. Hendra: 'Perhatian klien adalah aset yang terbatas. Kami memperlakukannya dengan hormat yang sepadan.'</p>
      </div>

      {/* R109: How MJP Builds Its Signal Source Network */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Network className="h-3.5 w-3.5 text-primary" /> SIGNAL SOURCE NETWORK BUILDING — Bagaimana MJP Menambahkan Sumber Signal Baru: Proses 4-Langkah dari Identifikasi hingga Produksi, dan Mengapa Kualitas Sumber Lebih Penting dari Kuantitas
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { step: "Step 1: Source identification — bagaimana sumber baru ditemukan", sources_of_sources: "New signal sources come from: (1) Sari's working group intelligence — regulators mention data streams MJP isn't monitoring. (2) Budi's field research — narasumber mention information sources they use that MJP doesn't track. (3) Hendra Jr.'s technical discovery — while crawling one government system, discovers links to related systems. (4) Klien feedback — Enterprise klien ask 'do you monitor X?' If the answer is no and the need is real: investigation begins.", evaluation_criteria: "Source evaluation: Relevance (does it produce signals relevant to BUJK procurement decisions?), Volume (signal-to-noise ratio — does it produce enough actionable signals to justify maintenance cost?), Reliability (is the source stable or prone to format changes?), Legality (is crawling this source legally permissible under Indonesian data laws?). All 4 must pass before source is added.", tc: "text-primary" },
            { step: "Step 2: Pilot monitoring — 30 hari monitoring manual sebelum otomatisasi", what_happens: "Before Hendra Jr. builds any automation: Sari monitors the new source manually for 30 days. Daily: Sari reads the source and judges which items are actionable vs noise. After 30 days: if actionability ratio {'>'} 20% (20%+ of items produce signals worth klien attention): source approved for automation. Below 20%: source rejected as too noisy. Of 8 sources evaluated via pilot in 2025: 5 approved, 3 rejected.", example: "JDIH (National Law Database) pilot: Sari monitored daily for 30 days. Actionability: 67% of new publications contained relevant regulatory signals. Approved for automation in Day 31 — now one of MJP's highest-quality sources (47+ Knowledge Registry assets originate from JDIH).", tc: "text-blue-700" },
            { step: "Step 3: Automation build — Hendra Jr. builds crawler after source approval", technical_scope: "Each new source requires: authentication setup (if required), format analysis (what data structure does this source use?), normalization layer (mapping to MJP's canonical signal format), freshness monitoring (how to detect that new items have been published), error handling (what to do when the source is unavailable). Average build time per source: 8–24 hours depending on complexity. BNSP verification API: 4 days (most complex). A new simple LPSE-adjacent portal: 3–4 hours.", deployment: "Source goes live in 'staging mode' for 2 weeks before full production: Hendra Jr. manually reviews every item the automation produces to verify format normalization is working correctly. After staging validation: promoted to production and begins contributing to klien alert stream.", tc: "text-emerald-700" },
            { step: "Step 4: Ongoing quality maintenance — sumber bisa didegradasi atau dihapus", degradation_process: "Annual source quality audit (Sari) reviews every active source for: (1) actionability ratio (still above 20%?), (2) signal volume (is it still producing enough signals to justify maintenance cost?), (3) technical stability (how many crawler failures in the past year?). Sources that fall below threshold: downgraded to 'archival mode' (crawled weekly, not daily) or removed entirely.", example: "2025 audit: 3 sources downgraded to archival (ministerial circular channels that had moved to different publication platforms — volume dropped 80%). 2 sources removed entirely (defunct portals). 4 new sources added. Net active sources: 47 (up from 46 in 2024).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{'sources_of_sources' in r ? (r as {sources_of_sources:string}).sources_of_sources : 'what_happens' in r ? (r as {what_happens:string}).what_happens : 'technical_scope' in r ? (r as {technical_scope:string}).technical_scope : (r as {degradation_process:string}).degradation_process}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{'evaluation_criteria' in r ? `Criteria: ${(r as {evaluation_criteria:string}).evaluation_criteria}` : 'example' in r ? `Example: ${(r as {example:string}).example}` : 'deployment' in r ? `Deployment: ${(r as {deployment:string}).deployment}` : ''}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal source network building adalah one of MJP's most disciplined operational processes — and one of the most invisible to klien. Klien see the intelligence that reaches them; they don't see the 4-step process that determines which sources contribute to that intelligence. The 30-day pilot requirement (Step 2) is the most important quality gate: it ensures that Hendra Jr. doesn't spend 24 hours building automation for a source that Sari would have rejected if she'd reviewed it first. Before the pilot requirement was instituted (in 2022): MJP added 3 sources that each took 12+ hours to build and were subsequently deprecated within 6 months because their actionability was too low. Total wasted engineering time: ~40 hours. The pilot requirement added 30 days per source evaluation but saved an estimated 8–16 hours per source in wasted automation builds. Current network: 47 active sources. Target: 55–60 by Q4 2027 (primarily Tier-2 regional LPSE portals and IKN-specific government data streams). The legal review (Step 1) is non-negotiable: MJP's legal counsel confirmed in 2024 that crawling government LPSE portals is legally permissible under Indonesian information access laws (UU No. 14/2008, KIP). But commercial platforms (industry news sites, association databases) require case-by-case review. Hendra: 'Sumber signal kami adalah fondasi dari semua yang kami bangun. Fondasi yang salah membuat semua yang ada di atasnya tidak bisa dipercaya. 47 sumber yang kami miliki sekarang: semua telah melewati proses 4-langkah ini. Tidak ada jalan pintas.'</p>
      </div>

      {/* R110: How the Daily Morning Briefing Is Curated */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Coffee className="h-3.5 w-3.5 text-primary" /> MORNING BRIEFING CURATION — Bagaimana Sari Memproduksi PDF Briefing Harian yang Dikirim pukul 07:00: Proses 5-Langkah dari Raw Signal ke Executive Summary, dan Keputusan Editoral yang Menentukan Apa yang Masuk ke Briefing
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { step: "Step 1 (05:00–05:30): Automated signal harvest — sistem mengumpulkan semua sinyal dari semalam", process: "Hendra Jr.'s scheduler runs nightly crawl cycle (02:00–04:30) across all 47 signal sources. By 05:00: system has collected the day's signals. Sari's morning briefing input: categorized signal feed, sorted by source and type. Volume: typically 40–120 raw items per weekday (spikes on Monday after weekend accumulation, peaks around regulatory publication cycles). Fully automated: Sari doesn't touch the harvest step.", editorial_decision: "None required — this is pure automation. Quality of harvest depends entirely on Hendra Jr.'s source configuration. Sari's only input: monthly feedback on source quality ('this source is producing too much noise' → Hendra Jr. investigates).", tc: "text-primary" },
            { step: "Step 2 (05:30–06:00): Sari's editorial triage — 120 items → 15–20 editorial candidates", process: "Sari's 30-minute triage: reads every raw signal item from overnight harvest. Triage decision per item: (A) INCLUDE for today's briefing, (B) QUEUE for next relevant briefing, (C) ARCHIVE (not actionable for any klien). Triage criteria: Is this new (not covered in previous 5 briefings)? Is this actionable within the next 7–14 days? Does this affect multiple KBLI categories or just one? Items where Sari cannot determine quality: flagged for cross-reference against Knowledge Registry before decision.", editorial_decision: "The hardest editorial decision: regulatory signals vs market signals. Sari's rule — if a signal requires Knowledge Registry context to be actionable, it goes into today's briefing only if she can include that context in the briefing. A signal without context is noise, not intelligence.", tc: "text-blue-700" },
            { step: "Step 3 (06:00–06:30): Personalization layer — 15–20 items assigned to klien segments", process: "Sari maps each editorial candidate to klien segments: which KBLI categories does this affect? Which provinces? Which BUJK qualification tiers? The personalization assignment: determines which klien receive which signal in their daily briefing. Enterprise klien: receive all signals plus context. Pro klien: receive signals matching their KBLI/province profile. Starter klien: receive only direct-eligibility signals. Technical implementation: Hendra Jr.'s system takes Sari's categorizations and applies them against klien profiles.", editorial_decision: "Signal that affects all BUJK equally (e.g., national procurement regulation change): included for all tiers. Signal that affects only specific KBLI categories (e.g., electrical contractor SKK threshold change): included only for klien with matching KBLI. Sari's calibration challenge: a signal that seems narrow may be broadly relevant — she always asks 'which other KBLI categories might indirectly be affected?'", tc: "text-emerald-700" },
            { step: "Step 4 (06:30–06:45): Context synthesis — editorial notes per signal", process: "For each briefing signal, Sari writes a 2–4 sentence editorial note: what is this signal, why does it matter now, what action should klien consider. The notes are the intelligence layer that converts raw signals into actionable briefing. Sari's standard: 'If a klien reads only the editorial note (skipping the source link): they should have 80% of the actionable understanding they need.' Notes written in plain Indonesian, avoiding legal jargon, using construction industry vocabulary that Budi's narasumber have confirmed as accessible.", editorial_decision: "The hardest note to write: a regulatory change that MJP doesn't yet have full clarity on. Sari's protocol: don't speculate, state what is known and what is uncertain. 'Regulasi X telah ditetapkan. Interpretasi operasional sedang dikonfirmasi dengan LKPP — update akan dikirim dalam 48 jam.' Never: 'Regulasi X berarti bahwa klien harus...' when interpretation is genuinely uncertain.", tc: "text-orange-700" },
            { step: "Step 5 (06:45–07:00): PDF generation + distribution", process: "Hendra Jr.'s system generates personalized PDFs from Sari's editorial notes: klien-specific cover page (name, tier, today's signal count relevant to their profile), executive summary (top 3 signals), detailed signal section (all signals with editorial notes + source links), KPI snapshot (current tender opportunities in their alert queue, SKK expiry countdown if within 90 days). PDF generated per klien, sent via email and WhatsApp (for Enterprise) by 07:00 sharp. Consistency: 07:00 delivery has been maintained for 247 consecutive working days (record as of Q2 2026).", editorial_decision: "Last-minute signal: if a major regulatory announcement drops at 06:50 (10 minutes before send), Sari's decision: include only if she can write an accurate editorial note in 5 minutes. If not: hold for tomorrow's briefing with note 'Breaking: [signal title] — full analysis in tomorrow's briefing.' Never: include a signal with an inaccurate or incomplete editorial note.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.step} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.step}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.process}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Editorial decision: {r.editorial_decision}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Morning briefing curation adalah Sari's most time-constrained and judgment-intensive daily work — because the 07:00 deadline is fixed, the signal volume is variable (40–120 items), and the quality bar is absolute. The 2-hour window (05:00–07:00) is designed with 15 minutes of buffer built in: the hardest mornings are when overnight signal harvest produces 100+ items (Sari's triage takes 45 minutes instead of 30) or when a complex regulatory signal requires additional cross-referencing before she can write an accurate editorial note. The buffer has been used 23 times in the past 247 days — 9.3% of days have required the buffer. Zero briefings have been delivered late. The 247-day consecutive delivery record: not publicized to klien but significant as an internal discipline indicator. Sari's standards: 'Klien yang membuka email mereka pada pukul 07:00 dan melihat briefing MJP: mereka harus bisa membaca 3 menit dan pergi ke rapat mereka dengan pemahaman yang jelas tentang apa yang perlu mereka perhatikan hari ini. Itu adalah standar saya. Bukan lebih panjang, bukan lebih pendek.' Post-Series A: Sari will have a Knowledge Research Analyst who takes over Steps 1–2 (harvest and triage), freeing Sari for Steps 3–5 (synthesis and quality). This handoff: will require 2–3 months of training before Sari trusts the analyst's triage decisions. Sari: 'Triage yang baik adalah tentang mengetahui apa yang tidak kita sertakan sama pentingnya dengan apa yang kita sertakan. Mengajarkan seseorang cara menolak sebuah sinyal: lebih sulit dari mengajarkan cara menulis tentangnya.'</p>
      </div>

      {/* R111: Signal Quality Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> SIGNAL QUALITY SCORECARD — 5-Dimensi Rubrik Evaluasi Editorial yang Sari Gunakan Setiap Pagi: Bagaimana MJP Mengukur Nilai Outputnya Sendiri Sebelum Klien Mengukurnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "SQ-1: Actionability Score (0–10) — Apakah sinyal ini memungkinkan keputusan atau tindakan spesifik?", rubric: "10: Sinyal langsung mengubah keputusan tender, mitra, atau kepatuhan yang aktif. (Contoh: LPSE portal specific mengumumkan jadwal evaluasi yang direvisi — berdampak pada klien yang memiliki tender aktif.) 7–9: Sinyal berdampak pada strategi yang sedang berlangsung tapi tidak ada keputusan immediate. 4–6: Sinyal penting untuk awareness tapi tidak memerlukan tindakan saat ini. 1–3: Sinyal informatif tapi tidak actionable untuk BUJK dalam 30 hari. 0: tidak ada keputusan yang berubah.", threshold: "Threshold untuk masuk briefing: 6 ke atas. Threshold untuk top story: 8 ke atas. Distribusi harian: 15–25% sinyal masuk pada 8–10; 30–40% pada 6–7; sisanya tidak masuk briefing. Sari: 'Setiap sinyal yang masuk briefing harus bisa saya jelaskan dalam satu kalimat mengapa seorang pemilik BUJK harus peduli hari ini, bukan minggu depan.'", tc: "text-primary" },
            { dimension: "SQ-2: Source Reliability Score (0–10) — Seberapa terpercaya sumber informasinya?", rubric: "10: JDIH resmi (jdih.setneg.go.id), LPSE portal pemerintah yang diverifikasi, LKPP official. 8–9: Media konstruksi nasional dengan rekam jejak faktual (Konstruksi Indonesia, Bisnis.com kolom infrastruktur). 6–7: Media bisnis umum dengan pelaporan konstruksi. 4–5: Social media dari praktisi yang dikenal di industri (dengan nama asli, posisi terverifikasi). 1–3: Anonymous posts, unverified social media. 0: Rumor tanpa verifiable source.", threshold: "Sinyal di bawah 6 tidak masuk briefing kecuali dikonfirmasi oleh sumber kedua. Sinyal dari sumber anonim tidak pernah masuk briefing tanpa independent verification. Sari's verification cost: 30–45 menit untuk sinyal 4–5 yang berpotensi tinggi — biaya waktu yang hanya worth it untuk Actionability Score 8 ke atas.", tc: "text-blue-700" },
            { dimension: "SQ-3: Freshness Score (0–10) — Seberapa baru informasinya relatif terhadap event yang dilaporkan?", rubric: "10: Event terjadi dalam 24 jam. 8: Event dalam 72 jam. 6: Event dalam 7 hari. 4: Event dalam 30 hari (tapi belum pernah diliput di briefing MJP). 2: Event lebih lama dari 30 hari tapi konteks baru relevan karena trigger lain. 0: Informasi yang sudah pernah diliput di briefing MJP sebelumnya tanpa update baru.", threshold: "Freshness Score minimum 6 untuk masuk briefing. Exception: Sari menerbitkan 'regulatory retrospective' untuk regulasi lama yang mendadak relevan karena new implementing regulation — Freshness Score untuk konten lama bisa 2 tapi Actionability Score harus 9–10 untuk membenarkan pengecualian.", tc: "text-emerald-700" },
            { dimension: "SQ-4: BUJK Relevance Density (1–5) — Berapa banyak tipe BUJK yang terpengaruh oleh sinyal ini?", rubric: "5: Relevan untuk semua 847 klien aktif MJP — undiscriminating regulatory change atau market-wide alert. 4: Relevan untuk 60–80% klien. 3: Relevan untuk BUJK dengan KBLI atau regional tertentu (30–60%). 2: Relevan hanya untuk sub-segmen spesifik (10–30%). 1: Sangat spesifik — relevan hanya untuk 5–10% klien.", threshold: "Relevance Density tidak langsung menentukan inclusion tapi menentukan placement dan editorial treatment. Score 5: top section, editorial note tentang universal impact. Score 2–3: buried dalam kategorized section, no editorial note. Score 1: hanya masuk jika Actionability Score 9–10 karena sangat impactful untuk segmen kecil.", tc: "text-orange-700" },
            { dimension: "SQ-5: MJP Competitive Intelligence Value (0–10) — Apakah sinyal ini memberi MJP klien keunggulan informasi vs kompetitor non-MJP?", rubric: "10: Sinyal yang hanya bisa diperoleh melalui MJP's monitoring network — tidak tersedia di Google, media umum, atau WhatsApp group industri. 7–9: Sinyal yang tersedia di publik tapi dikurasi lebih cepat atau lebih akurat oleh MJP. 4–6: Sinyal yang tersedia di publik dengan mudah tapi disintesis lebih baik oleh MJP. 1–3: Sinyal yang sudah tersebar luas di industri sebelum MJP menerbitkan.", threshold: "Competitive Intelligence Value minimum 7 untuk featured placement. Sinyal dengan score 4–6: still valuable sebagai kualitas curation tapi tidak differentiating. Sari's goal: at least 40% dari briefing setiap hari harus berisi sinyal score 8–10 — informasi yang klien genuinely tidak bisa dapatkan lebih cepat dari sumber lain.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rubrik: {r.rubric}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Threshold: {r.threshold}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal quality scorecard adalah Sari's most important anti-mediocrity mechanism — because without explicit criteria, 'editorial judgment' becomes 'whatever feels important today,' which varies with Sari's mood, news cycle salience, and cognitive fatigue. The 5-dimension rubric: makes the quality bar explicit, reproducible, and trainable (the post-Series A Knowledge Research Analyst will learn this rubric before they triage their first signal). The rubric is not mechanical — Sari doesn't formally score every signal every morning. In practice: the rubric is internalized after 247 days of application, and Sari makes triage decisions in 30–60 seconds per signal. But for signals in the gray zone (3–7 on actionability, uncertain source reliability): Sari explicitly scores them on the rubric rather than relying on intuition. The gray zone scoring: estimated 8–12 signals per morning. The rubric outcome for gray zone signals: 30% of them score high enough to include after explicit scoring, 70% are rejected. Without the rubric: Sari's retrospective analysis suggests 50% of gray zone signals would have been included based on intuition — producing a briefing with 15–20% more content but lower average quality per item. Sari: 'Rubrik ini adalah cara saya berdebat dengan diri sendiri. Ketika sinyal terasa penting tapi saya tidak bisa menjelaskan mengapa: rubrik memaksa saya untuk menjadi eksplisit. Dan eksplisit adalah cara terbaik untuk menemukan bahwa perasaan itu kadang benar dan kadang salah.'</p>
      </div>

      {/* R112: Intelligence Network Expansion Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> INTELLIGENCE NETWORK EXPANSION PLAN — Bagaimana MJP Akan Meningkatkan Cakupan Signal Post-Series A: Dari Kapasitas Sari Sendiri ke Tim Kecil dengan Output 3X, Tanpa Mengorbankan Standar Kualitas Editorial
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { phase: "EKSPANSI-1: Hire Knowledge Research Analyst (Q1 2027 post-Series A close)", role_design: "Sari's most carefully scoped hire: the Knowledge Research Analyst (KRA) is NOT a junior editor — their mandate is research and signal harvesting, not editorial judgment. Sari retains all editorial decisions. KRA responsibilities: (1) operate Sari's signal monitoring tools during harvest window (04:00–05:30), passing the raw harvest to Sari for triage. (2) Manage the asset maintenance backlog — prioritized updates for lower-tier assets that don't require Sari's expert judgment. (3) Regional source development — build direct contact with 3 additional LPSE portal administrators in Eastern Indonesia provinces.", impact: "Expected output increase: signal harvest time removed from Sari's workflow (saves 40 minutes/day). Asset production increase: KRA handles 30% of the 4–5 weekly asset target (routine updates), freeing Sari for new complex assets. Net capacity gain: Sari moves from 4–5 assets/week to 6–8 assets/week total. Cost: Rp 7.5jt/month total. KRA payback through incremental Knowledge Registry completeness improvement: estimated 3 months.", tc: "text-primary" },
            { phase: "EKSPANSI-2: Source network deepening — 671 LPSE portals ke structured relationship program", role_design: "Current source network: 671 LPSE portals accessed via automated crawling — no human relationships with portal administrators. The untapped intelligence: portal administrators know about tenders before they're published (pre-publication drafts, panitia discussions), have visibility into tender quality issues (panitia that consistently produce poorly-scoped documents), and receive revision requests before they appear in public data. This 'pre-publication intelligence' is currently invisible to MJP.", impact: "Post-Series A source relationship program: Hendra Jr. and KRA identify 15–20 LPSE portal administrators in high-value provinces for direct relationship development. Goal: not formal data-sharing agreements (potentially legally complex) but informal professional relationships. Intelligence gain: 3–5 business days advance awareness of major tender publications in covered provinces. Implementation timeline: 12 months to establish initial relationships, 24 months to yield consistent pre-publication intelligence.", tc: "text-blue-700" },
            { phase: "EKSPANSI-3: Automated synthesis layer — AI-assisted first draft for repeatable content categories", role_design: "Sari's highest time-cost content type: routine regulatory update summaries (when a known regulation is amended with minor changes). These follow a predictable structure: 'Regulation X was amended by Regulation Y. The key changes are [A], [B], [C]. Impact on BUJK qualification: [assessment].' Hendra Jr. will build an AI-assisted first-draft generator for this content type: given the new regulation text + the existing Knowledge Registry asset, generate a structured first draft that Sari reviews and edits. The generator does not replace Sari's judgment — it eliminates the blank-page problem for routine updates.", impact: "Time saved per routine regulatory update: estimated 45 minutes (from 90 minutes to 45 minutes for review/edit). Volume of routine updates per month: approximately 8–12. Monthly time saving: 6–9 hours. This freed capacity: redirects to new gap coverage (GAP-1 through GAP-5 from the coverage gap analysis). Hendra Jr.'s implementation timeline: 3 months (Q2 2027). Note: this AI assistance layer applies only to routine updates — never to novel regulatory analysis where Sari's expert judgment is the primary value.", tc: "text-emerald-700" },
            { phase: "EKSPANSI-4: Client-generated intelligence integration — BUJK feedback as signal source", role_design: "Untapped intelligence source: MJP's 847 BUJK subscribers collectively observe thousands of LPSE portals and procurement events every day. Their direct observations — a panitia that changed evaluation criteria without publishing a revision, a tender that was cancelled the day of aanwijzing, a BUJK that received an unusual notice — are often faster than MJP's crawler. Currently: no structured channel for BUJK to share intelligence back to MJP. Post-Series A: Sari will design a 'Signal From Field' feature — a lightweight input form in the platform where BUJK can report observations.", impact: "Target: 30 BUJK-submitted signals per month by Q4 2027. Each signal vetted by Sari for actionability and accuracy before entering the briefing pipeline. Expected contribution to total signal value: small in volume (30 of estimated 2.000 monthly signals), but high in quality — BUJK-reported signals are first-hand observations with specificity that automated crawling cannot match. The feature also builds network loyalty: BUJK who contribute intelligence feel invested in the platform's quality. Reza's sales framing for this feature: 'Kalau Anda menjadi kontributor: platform ini bukan hanya alat yang Anda pakai, ini platform yang sebagian informasinya Anda ciptakan.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.phase} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.phase}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Design: {r.role_design}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Intelligence network expansion plan adalah Sari's strategic answer to the question she asks herself most often: 'What would MJP's signal intelligence look like if it weren't constrained by my individual capacity?' The 4-expansion plan is designed to 3× MJP's intelligence output (from current 40–120 signals/day processed to 120–360 signals/day) over 24 months post-Series A, without reducing the editorial quality standard that makes the morning briefing valuable. The quality constraint is non-negotiable: Sari's editorial judgment is the quality moat, not the automation that supports it. Each expansion phase is designed to enhance Sari's judgment capacity, not replace it. The KRA hire (EKSPANSI-1): removes low-judgment work. The AI draft generator (EKSPANSI-3): removes the blank-page friction for routine updates. The source relationships (EKSPANSI-2) and client intelligence (EKSPANSI-4): add higher-quality raw inputs that compound the value of Sari's editorial judgment. The net effect: same Sari, same editorial standard, 3× throughput. This is the intelligence network architecture Sari will build if Series A closes on Hendra's target timeline. Sari: 'Saya ingin membangun sistem yang masih menghasilkan output dengan standar yang saya banggakan bahkan ketika saya sedang liburan — karena KRA, AI tools, dan sumber yang baik sudah menangani 40% dari pekerjaannya. Itu bukan tentang menggantikan penilaian saya. Ini tentang memastikan penilaian saya dikeluarkan pada hal yang paling penting.'</p>
      </div>

      {/* R113: Morning Briefing Downstream Effect */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibind uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> DOWNSTREAM EFFECT BRIEFING PAGI — Bagaimana 847 BUJK Menggunakan Briefing Harian dalam Operasional Mereka: 4 Pola Konsumsi, Waktu Rata-rata, dan Mengapa 'Dibaca Tapi Tidak Ditindaklanjuti' Tetap Memberikan Nilai
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { pattern: "PATTERN-1: The Immediate Action Reader — 22% dari subscriber", profile: "BUJK owners who read the briefing and take at least 1 concrete action within 4 hours of reading. Action types: (1) opening a specific LPSE portal to review a flagged tender, (2) sending a WhatsApp message to their field team about a competitor activity, (3) calling their SKK consultant about a certification flagged in the briefing, or (4) updating their tender tracking list based on the briefing's coverage. Average session time with briefing: 4.5 minutes (longer than average — they read all 3 sections). Archetype overlap: primarily Systematic Bidders and Strategic Analysts.", value_generated: "This group is the most directly measurable value recipient from the briefing. Reza's NPS analysis: Immediate Action Readers give an average NPS of 9.2 — the highest of all 4 pattern groups. Their verbatim responses: frequently mention specific briefing items ('the briefing terakhir minggu lalu tentang perubahan syarat kualifikasi PUPR membuat saya langsung memperbarui dokumen BUJK saya sebelum batas waktu'). Hendra's investment case: this 22% is the proof-of-concept group — they demonstrate the briefing's highest possible downstream value.", tc: "text-primary" },
            { pattern: "PATTERN-2: The Context Builder — 41% dari subscriber", profile: "The largest group: BUJK owners who read the briefing primarily to maintain market awareness, not to take immediate action. They're reading for context ('apa yang terjadi di pasar hari ini?') rather than for specific action triggers. Average session time: 2.8 minutes. They typically read Section 1 (tender activity) and skim Section 2 (regulatory). Section 3 (market intelligence): read 45% of the time. This group rarely opens LPSE portals same-day from briefing items — but may reference briefing context in a meeting or decision 3–5 days later.", value_generated: "The value is harder to measure but significant: Context Builders use the briefing to stay 'market literate' without spending 2–3 hours/week on manual research. Budi's field research on this group: 'Mereka menggunakan briefing seperti koran bisnis pagi — bukan karena setiap artikel mengarah ke tindakan segera, tapi karena kumulatif dari membaca setiap hari membuat mereka lebih tajam dalam percakapan bisnis dan keputusan yang mereka buat.' NPS for Context Builders: 7.8 (solid, reflecting genuine value but not the urgency of Pattern-1).", tc: "text-blue-700" },
            { pattern: "PATTERN-3: The Selective Attender — 28% dari subscriber", profile: "BUJK owners who read the briefing irregularly — opening approximately 3 of every 7 daily briefings. When they do open it: full read (3.1 minutes average). When they don't open it: they rely on the week-end summary digest instead. The pattern: they prioritize the briefing during active tender evaluation periods and deprioritize during project execution phases (when market intelligence is less immediately useful). Seasonal variation: Selective Attenders' open rates peak in January (APBN tender season) and drop in July–August (mid-year execution peak).", value_generated: "Selective Attenders represent MJP's largest churn risk group (28% of subscribers, EWS-2 alert candidates during their low-engagement phases). But they're also the group with the most predictable re-engagement pattern: they come back as market activity ramps up. Reza's intervention for Selective Attenders during low-open-rate periods: not a generic re-engagement message but a specific 'your industry is seeing unusual tender activity this week' personalized alert. This triggers a re-engagement in 34% of cases.", tc: "text-emerald-700" },
            { pattern: "PATTERN-4: The Reference Archiver — 9% dari subscriber", profile: "The smallest and most unusual group: BUJK owners (predominantly in larger BUJK or BUJK with dedicated administrative staff) who read the briefing not for personal action but to forward specific items to their team. They receive the briefing, scan it for items relevant to their team members' work, and forward those items via WhatsApp or email. Average session time: 1.8 minutes (quick scan, selective forward). This group's briefing engagement looks low by individual usage metrics but represents high organizational distribution — one briefing read generates 3–8 downstream reads by team members.", value_generated: "Pattern-4 represents the highest multiplier effect per subscriber: their briefing reading generates more total intelligence consumption than any other pattern. Reza has identified 14 Pattern-4 subscribers — he treats them as internal Champions within their BUJK. When these subscribers are happy with a specific briefing item: 3–8 colleagues also benefit. When they consider cancellation: it's 3–8 colleagues who lose access, not just 1 person. Reza's approach to Pattern-4: personalized check-ins about whether the briefing format is making it easy to forward relevant items to their team. Sari has adjusted the mobile-first briefing formatting partly in response to Pattern-4 users who forward via WhatsApp.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.pattern} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.pattern}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Profile: {r.profile}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Value generated: {r.value_generated}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Morning briefing downstream effect adalah the most important evidence that Sari's daily editorial work has genuine operational impact on 847 BUJK businesses — not just abstract information value. The 4 patterns span a spectrum from immediate action (Pattern-1) to contextual background (Pattern-2) to selective monitoring (Pattern-3) to organizational amplification (Pattern-4). All 4 patterns generate real business value — they just generate it on different time horizons and through different mechanisms. The most commercially important insight: 'not acted upon immediately' does not mean 'low value.' Pattern-2 (Context Builders, 41% of subscribers) generate most of their briefing value in decisions made 3–14 days after reading — not on the same morning. Measuring briefing value by same-day action rate (a common product analytics mistake) would dramatically understate the value delivered to Pattern-2. The downstream effect analysis: directly shaped Sari's editorial philosophy. Knowing that 41% of subscribers are context-building: Sari maintains the market narrative sections (Section 3) that a same-day-action-only optimization would eliminate. Knowing that 9% are organizational amplifiers: Sari's mobile-first formatting improvement directly serves their forwarding workflow. The briefing is not one product for one audience — it's 4 products for 4 distinct usage patterns, delivered in a single daily publication. Sari: 'Setiap pagi saya menulis untuk Pak Bram yang akan segera menelepon konsultannya, Bu Dewi yang akan mengingat ini dalam rapat Rabu, Pak Farhan yang mungkin hanya membaca 3 dari 7 briefing minggu ini, dan Bu Sinta yang akan meneruskan bagian ini ke 5 karyawannya. Mereka semua nyata. Mereka semua ada. Dan briefing yang baik: melayani keempat-empatnya.'</p>
      </div>

      {/* R114: Signal Decay Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> SIGNAL DECAY ANALYSIS — Berapa Lama Sinyal Tetap Dapat Ditindaklanjuti Sebelum Kedaluwarsa: 4 Tipe Sinyal dengan Half-Life Berbeda, Bagaimana MJP Menggunakan Decay Rate untuk Memprioritaskan Distribusi, dan Implikasi untuk Arsitektur Briefing
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal_type: "DECAY-TYPE-1: Tender announcement signals — half-life 2–4 hari", decay_mechanism: "A tender announcement signal becomes less actionable the longer the BUJK waits to act. Half-life: 2–4 days (the signal's actionability drops by 50% after 2–4 days because: early action in BUJK-aanwijzing registration increases the chance of receiving early clarification documents; early competitor intelligence gathering produces better bid strategy; late registration risks missing addenda). After Day 10 from announcement: the signal has effectively decayed (most document preparation decisions are already made). MJP's distribution architecture for DECAY-TYPE-1: included in every morning briefing (Type-3 urgency: IMPORTANT — act today or this week) and sent as a real-time alert to Waspada Tender subscribers within 2 hours of LPSE posting.", half_life_implication: "The 2–4 day half-life means that a tender alert delivered on Day 3 is already 50% less valuable than an alert delivered on Day 1. This is why MJP's crawler runs every 4 hours (not daily) for high-value tender portals. The cost of a delayed alert: not just missed tender information — it's the compounding disadvantage of BUJK competitors who acted earlier. Sari's editorial rule for DECAY-TYPE-1 signals: never hold for next day's briefing if the alert arrives after 16:00 — send as standalone push notification to avoid overnight decay.", tc: "text-primary" },
            { signal_type: "DECAY-TYPE-2: Regulatory change signals — half-life 7–30 hari", decay_mechanism: "A regulatory change (new Perpres, PUPR regulation, BNSP certification requirement update) has a much longer half-life than a tender announcement — because the BUJK response (document update, process change, compliance action) typically has a 30–90 day compliance window built into the regulation itself. However, the signal is not decay-free: BUJK who learn about a regulatory change on Day 1 have a full compliance window; BUJK who learn on Day 25 have only 5–65 days remaining. MJP's distribution for DECAY-TYPE-2: included in weekly Knowledge Registry digest AND flagged in morning briefing as Type-4 (WATCH — this week) for the first 3 business days after the regulation is published. After Day 3: regulatory signals move to Type-5 (CONTEXT) in the briefing.", half_life_implication: "The 7–30 day half-life of regulatory signals: explains why Sari maintains both a real-time regulatory alert system (for same-day distribution) AND a Knowledge Registry asset update process (for persistent access after the signal has aged). A BUJK who misses the Day-1 regulatory alert: can still find the information in the Knowledge Registry on Day 45 — but a BUJK who was alerted on Day 1 has a significant compliance preparation advantage. Sari's most important editorial principle for DECAY-TYPE-2: never summarize a regulatory change so briefly that a BUJK cannot determine whether it applies to them. Ambiguous summaries cause BUJK to defer action (waiting to confirm applicability) — which produces unnecessary decay.", tc: "text-blue-700" },
            { signal_type: "DECAY-TYPE-3: Competitor intelligence signals — half-life 14–60 hari", decay_mechanism: "Competitor signals (C1 launches a new feature, a competitor wins a major tender, a new entrant registers) have the longest half-life of operational signals — because BUJK competitive responses (updating bid strategy, adjusting positioning) are strategic decisions that take weeks to implement. The half-life variation (14–60 days) reflects signal type: a specific competitor tender win (14-day half-life, because BUJK bidding on similar tenders need to know quickly) vs a competitor's general market positioning (60-day half-life, because strategic implications unfold over months). MJP's distribution for DECAY-TYPE-3: included in Radar Kompetitor feature (persistent, always-accessible) with time-stamped last-update indicators so BUJK can judge currency themselves.", half_life_implication: "The long half-life of competitor signals: explains MJP's design choice to make Radar Kompetitor a searchable persistent database rather than a push notification stream. Unlike tender alerts (where the optimal UX is immediate push notification): competitor intelligence is most valuable when BUJK can query it at the moment of a specific strategic decision (e.g., before preparing a bid for a tender where a known competitor is likely to bid). Push notifications for competitor intelligence: would produce notification fatigue without improving action rates. Sari's principle: 'Sinyal kompetitor yang dikirim sebagai notifikasi: menjadi kebisingan. Sinyal kompetitor yang tersedia saat dibutuhkan: menjadi wawasan.'", tc: "text-emerald-700" },
            { signal_type: "DECAY-TYPE-4: Market trend signals — half-life 30–90+ hari (virtual non-decay)", decay_mechanism: "Market trend signals (construction sector growth projections, government infrastructure budget allocations, material price trends, macroeconomic indicators) have the longest half-life of all signal categories — in some cases, virtually no decay over 30–90 days. A trend signal about APBN infrastructure allocation for 2026: published in November 2025, remains fully actionable in February 2026 (3 months later, before any infrastructure procurement has actually occurred). The 'virtual non-decay' property of trend signals: makes them the most appropriate input for MJP's weekly and monthly intelligence products (weekly digest, monthly market brief) rather than daily briefing.", half_life_implication: "MJP's most important architectural insight from decay analysis: different signal types require fundamentally different distribution mechanisms. Treating all signals as equally urgent (pushing everything as same-day alerts) would produce: 73 alerts/day (Sari's estimated signal volume) at an unacceptable volume that would cause alert fatigue and reduce overall attention to all signal categories. By matching distribution mechanism to decay rate (real-time push for DECAY-TYPE-1, weekly digest for DECAY-TYPE-4): MJP maximizes the probability that each signal reaches the subscriber at a moment when it is still actionable. Sari: 'Arsitektur distribusi yang baik bukan tentang seberapa cepat kita mengirim sinyal — ini tentang seberapa sering sinyal yang kita kirim tiba pada saat yang tepat. Sinyal yang terlalu cepat menghasilkan kebisingan. Sinyal yang terlalu lambat menghasilkan informasi yang kedaluwarsa. Yang benar: tepat waktu untuk setiap tipe sinyal.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal_type} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal_type}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Decay mechanism: {r.decay_mechanism}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.half_life_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal decay analysis adalah Sari's most technically sophisticated editorial framework — because it requires mapping not just what information BUJK need but WHEN they need it and how quickly its value diminishes. The 4 signal types and their half-lives span a 45× range (2 days to 90+ days): the fastest-decaying signal (tender announcement) needs to be delivered within hours to have full value; the slowest-decaying signal (market trend) retains full value for months. This range creates MJP's distribution architecture challenge: a single distribution channel cannot serve all signal types effectively. The solution: 4 matched channel-signal pairs (real-time alert for tender, daily briefing for moderate-decay operational signals, weekly digest for slow-decay regulatory/competitive signals, persistent Knowledge Registry for near-zero-decay trend signals). The 4-channel architecture: not designed abstractly — it emerged from 4 years of observed subscriber behavior. Sari's most important empirical finding: when DECAY-TYPE-4 signals (market trends) were included in the daily briefing (before 2023), briefing open rates dropped 11% because subscribers who only needed urgent operational intelligence found the trend content to be noise. After separating market trends into weekly digest: daily briefing open rates recovered to current 71%. This is Sari's clearest evidence that the signal-channel matching is correct: when signals are mismatched to channels, subscriber engagement suffers. The deeper principle: information products fail not because the information is wrong, but because the information arrives at the wrong moment in the wrong channel for the subscriber's decision-making context. MJP's distribution architecture: designed to maximize the probability that each signal arrives in the right moment, in the right channel, for the right subscriber.</p>
      </div>

      {/* R115: Briefing Format A/B Test History */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-primary" /> BRIEFING FORMAT A/B TEST HISTORY — 3 Eksperimen Format yang Sari Jalankan dan Apa yang Ditemukan: Panjang Briefing, Struktur Visual, dan Urutan Konten — Hasil Mengejutkan dan Pelajaran tentang Kebiasaan Membaca BUJK
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { test: "A/B TEST-1: Panjang briefing — 600 kata vs 1.000 kata (Q2 2023, 6 minggu)", hypothesis: "Hypothesis: shorter briefing (600 words, approximately 2.5 minutes to read) will produce higher open rates because BUJK are time-constrained. The 1.000-word format: was the existing format. Test design: random 50/50 split of subscriber base. Group A received 600-word briefing, Group B received 1.000-word briefing for 6 weeks.", result: "Result: open rate was identical (71% Group A, 72% Group B — not statistically significant). Click-through rate (subscribers clicking to read a linked Knowledge Registry asset): Group A 8.4%, Group B 14.2% — statistically significant. Interpretation: shorter briefings do not improve opening behavior (the open decision is made before reading, based on subject line and habit). But shorter briefings reduce deep engagement because there is less content to trigger 'I want to know more.' Decision: revert to 1.000-word format. The test revealed that briefing length is not a barrier to opening — it is an ingredient for engagement. Sari: 'Memotong panjang briefing tidak membuat lebih banyak orang membuka — itu membuat lebih sedikit orang melakukan sesuatu setelah membuka.'", tc: "text-primary" },
            { test: "A/B TEST-2: Struktur visual — tabel dan highlight vs teks prosa murni (Q4 2023, 4 minggu)", hypothesis: "Hypothesis: visual formatting (tables for tender data, highlighted key numbers, section headers with emoji) will improve open rate and click-through by making the briefing easier to scan. Pure prose format: was the original format. Test design: 50/50 split for 4 weeks.", result: "Result: open rate for visual format 73%, prose format 71% (slight improvement, borderline significant). But NPS verbatim mentions for visual format: significantly more negative ('terasa seperti newsletter bukan intelijen', 'terlalu banyak tabel membuat saya kehilangan konteks'). Qualitative NPS data contradicted the quantitative open rate improvement. Sari's interpretation: BUJK open the visual briefing because it looks scannable — but find less value because the context that makes intelligence actionable lives in prose narration, not tables. Tables show data; prose explains what the data means. Decision: revert to prose-dominant format with selective tables only for structured data (bidder counts, HPS values, award results). This hybrid kept contextual prose while making data-dense sections more scannable.", tc: "text-blue-700" },
            { test: "A/B TEST-3: Urutan konten — Tender Intelligence pertama vs Market Context pertama (Q1 2024, 8 minggu)", hypothesis: "Hypothesis: leading with the most commonly used section (Tender Intelligence — Section 2 in current format) will improve engagement because subscribers immediately reach the most relevant content. Current format: opens with Market Context (Section 1), then Tender Intelligence (Section 2), then Regulatory Updates (Section 3), then Competitor Intelligence (Section 4). Proposed format: open with Tender Intelligence.", result: "Result: no significant difference in total engagement metrics. But unsubscribe rate during test period: 0.8% for reordered format vs 0.3% for original (statistically significant over 8 weeks). Exit survey from unsubscribers: 'briefing feels more transactional now, less like strategic intelligence.' Sari's interpretation: the Market Context opening — which provides the 'why this week matters' frame before presenting specific tenders — is not wasted preamble. It is the frame that makes subsequent Tender Intelligence feel like strategic signal rather than a list of tenders. Removing context first makes the tender list feel like any other LPSE aggregator. Decision: keep original order. Sari: 'Format yang terasa paling efisien secara individu: kadang-kadang yang paling merusak secara keseluruhan. Konteks yang terasa seperti preamble: sebenarnya adalah fondasi yang membuat segala sesuatu setelahnya memiliki makna.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.test} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.test}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Hypothesis and design: {r.hypothesis}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Result and decision: {r.result}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Briefing format A/B test history adalah Sari's most empirical editorial practice — she does not trust intuition alone for format decisions on a product that 847 BUJK read every business day. The 3 tests each took 4–8 weeks of preparation, execution, and analysis. The most important overall finding: BUJK briefing value is not driven by opening efficiency (shorter, faster, easier to scan) but by contextual coherence (information framed, contextualized, and sequenced to support decision-making). Every test that optimized for individual efficiency (shorter length, faster scanning, skip-the-context) degraded overall subscriber value (lower click-through, more negative NPS, higher unsubscribe rate). This finding validates Sari's editorial philosophy of 'contextual intelligence over raw data delivery' — not from intuition but from 18 months of behavioral data. Sari has decided not to test personalization (each subscriber gets a different briefing based on their interests): the 3 tests suggest that the briefing's value comes partly from its shared nature — all subscribers reading the same briefing creates a common knowledge base for peer conversations. A personalized briefing might improve individual relevance at the cost of the shared intelligence that enables BUJK peer discussions about MJP's content.</p>
      </div>

      {/* R116: Subscriber Archetype Signal Consumption */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> SUBSCRIBER ARCHETYPE SIGNAL CONSUMPTION — Bagaimana 4 Arketipe Pelanggan MJP Menggunakan Sinyal Secara Berbeda: Pola Konsumsi, Sinyal yang Paling Bernilai per Arketipe, dan Implikasi untuk Desain Produk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { archetype: "ARCHETYPE-1: Tactical Bidder — BUJK yang menggunakan MJP murni untuk identifikasi tender aktif (38% dari pelanggan)", signal_consumption: "Tactical Bidders: the largest subscriber segment. Their relationship with MJP's signals: purely transactional. They open the morning briefing, go directly to Section 2 (Tender Intelligence), scan for tenders in their KBLI and jenjang, and close the briefing within 3–4 minutes. Section 1 (Market Context): skimmed or skipped entirely. Section 3 (Regulatory Updates): opened only if they see a regulation that directly affects a tender they are about to bid on. Section 4 (Competitor Intelligence): rarely opened (they don't track competitor strategy — they react to specific bids). NLQ usage: low (approximately 1–2 queries per month, almost always 'threshold for [specific regulation]'-type factual queries). Knowledge Registry usage: moderate (they access it when a specific tender's requirement references a regulation they don't know).", value_and_design_implication: "The Tactical Bidder's most valued signal: the real-time tender alert. The morning briefing is secondary — they prefer the immediate alert over the curated analysis. Product design implication: Tactical Bidders are best served by improving alert precision (the personalization engine work) and alert delivery speed, not by deepening editorial quality. The retention risk: Tactical Bidders are MJP's highest-churn segment (they leave when they don't win tenders and attribute it to 'MJP didn't help'). Sari's editorial decision: always open Section 2 with a specific bid-strategy observation ('in this week's Section 2 tenders, notice the concentration of qualified bidders in KBLI 4111 — this segment is 40% more competitive than last quarter') that gives Tactical Bidders a reason to read the analysis, not just the tender list.", tc: "text-primary" },
            { archetype: "ARCHETYPE-2: Strategic Analyst — BUJK yang menggunakan MJP untuk perencanaan bisnis jangka menengah (29% dari pelanggan)", signal_consumption: "Strategic Analysts: MJP's highest-NPS segment. They read the entire morning briefing, typically taking 12–15 minutes. Section 1 (Market Context): their favorite section — they find the 'why this week matters' framing most valuable. Section 4 (Competitor Intelligence): their second favorite — they track competitor win rates and agency relationships as inputs to their own business development strategy. NLQ usage: high (5–8 queries per month, including multi-part procedural queries and comparative analysis questions). Knowledge Registry: deep usage (they access all 4 levels of assets for regulations affecting their 3–5-year business plan). LEVEL-4 pipeline monitoring content: uniquely valued by this archetype — they are the only segment that regularly accesses 'upcoming regulation' content.", value_and_design_implication: "The Strategic Analyst's most valued signal: the Market Context section and LEVEL-4 pipeline intelligence. Product design implication: Strategic Analysts drive Enterprise tier conversion (they are the 'I need everything' subscribers). Sari designs Section 1 primarily for this archetype — the contextual framing, 3-month trend synthesis, and editorial perspective are features that Strategic Analysts explicitly mention in NPS comments. The product development implication: features that add depth (more regulatory pipeline sources, deeper competitor analysis, longer trend horizons) have their highest ROI with this archetype. MJP's post-Series A deepening of intelligence: essentially a product bet on growing the Strategic Analyst segment through features that serve them specifically.", tc: "text-blue-700" },
            { archetype: "ARCHETYPE-3: Compliance Navigator — BUJK yang menggunakan MJP terutama untuk kepatuhan regulasi (21% dari pelanggan)", signal_consumption: "Compliance Navigators: the segment most directly served by the Knowledge Registry. Their morning briefing behavior: they focus almost exclusively on Section 3 (Regulatory Updates). Tender intelligence (Section 2) and competitor intelligence (Section 4): secondary concerns — they bid selectively and know their competitive position well. Section 1 (Market Context): valued for the regulatory implication framing but not for market trend analysis. NLQ usage: highest per-subscriber of all archetypes (8–12 queries per month, almost exclusively procedural and compliance-check queries: 'Apakah BUJK jenjang-7 bisa mengikuti tender [specific type] tanpa IUJK?', 'Apa dokumen yang dibutuhkan untuk [specific qualification level]?').", value_and_design_implication: "The Compliance Navigator's most valued signal: regulatory change alerts (same-day notification when Section 3 has urgent content). Product design implication: Compliance Navigators are best served by increasing the granularity and speed of regulatory alerts — specifically a 'regulatory watchlist' feature (subscribe to updates on specific regulations of interest) that Hendra Jr. has in the post-Series A roadmap. The NLQ quality improvement (v3 architecture) has the most direct commercial impact on Compliance Navigators because their query types (procedural, compliance-check) are precisely the query types that v3's intent classification improves most. Sari: 'Compliance Navigator adalah alasan saya tidur nyenyak: ini pelanggan yang membutuhkan saya untuk akurat, bukan hanya menarik. Dan itu membuat standar editorial yang saya tetapkan untuk diri sendiri tidak bisa dinegosiasikan.'", tc: "text-emerald-700" },
            { archetype: "ARCHETYPE-4: Relationship Builder — BUJK yang menggunakan MJP terutama untuk intelijen mitra JO dan subkontraktor (12% dari pelanggan)", signal_consumption: "Relationship Builders: MJP's smallest but highest-ARPU archetype. They are almost exclusively Enterprise subscribers (all 32 of Reza's Enterprise clients exhibit some Relationship Builder behavior). Their morning briefing focus: Section 4 (Competitor Intelligence) — specifically Trust Score references for BUJK they are considering as JO partners or evaluating as competitors. NLQ usage: moderate (4–5 queries per month), dominated by 'Tell me about [specific BUJK name]' queries that combine Trust Score, award history, and geographic profile information. Knowledge Registry: low direct usage (they access it when a specific JO partner's compliance questions arise, not for general regulatory education).", value_and_design_implication: "The Relationship Builder's most valued signal: Trust Score updates for specific BUJK (especially when a potential JO partner's score changes). Product design implication: the Trust Score monitoring feature (receive notifications when a tracked BUJK's Trust Score changes) has its highest ROI with Relationship Builder archetype — they would pay specifically for this feature. This is one of Hendra's considered post-Series A features: 'Trust Score Watchlist' (track up to 20 BUJK, receive notifications on score changes or significant new award activity). Relationship Builders are also the archetype most likely to drive the next referral — because their use case (JO partner screening) is the one they mention most often in peer conversations with other BUJK. Reza: 'Setiap klien Enterprise yang menemukan mitra JO yang baik melalui Trust Score: percakapan berikutnya dengan mitra JO itu tentang MJP — dan 60% dari waktu itu menghasilkan subscriber baru.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.archetype} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.archetype}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Signal consumption pattern: {r.signal_consumption}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Value signal and design implication: {r.value_and_design_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Subscriber archetype signal consumption adalah Sari's most commercially actionable editorial analysis — because understanding how different archetypes use signals tells her which sections of the briefing to invest in for which product outcomes. The 4 archetypes (Tactical Bidder 38%, Strategic Analyst 29%, Compliance Navigator 21%, Relationship Builder 12%) represent meaningfully different information needs from the same product. The briefing's 4-section structure: historically designed to serve all 4 archetypes in a single document. Section 1 (Market Context): serves Strategic Analysts. Section 2 (Tender Intelligence): serves Tactical Bidders. Section 3 (Regulatory Updates): serves Compliance Navigators. Section 4 (Competitor Intelligence): serves Relationship Builders. This alignment: not accidental — Sari identified the archetype structure in 2023 from NPS verbatim analysis and restructured the briefing sections to explicitly serve each archetype's primary information need. The allocation of editorial effort across sections: reflects the commercial weight of each archetype. Strategic Analysts and Compliance Navigators (50% combined) are MJP's highest-NPS and highest-retention segments — so Sections 1 and 3 receive the most editorial depth investment. Tactical Bidders (38%) are the highest-volume segment but the lowest-NPS — so Section 2 receives the most structural optimization investment (making tender data scannable and actionable) rather than editorial depth. The archetype framework: also Sari's most useful lens for evaluating potential new features. Before any new product feature is added: Sari asks 'which archetype does this serve?' If the answer is unclear: the feature is not ready for product development. If the answer is 'all archetypes' equally: the feature is likely under-specified. The best features: serve 1–2 archetypes deeply and don't harm the others.</p>
      </div>

      {/* R117: The 06:00-08:00 BUJK Intelligence Window */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" /> THE 06:00–08:00 INTELLIGENCE WINDOW — Data MJP tentang Perilaku BUJK di Pagi Hari: 3 Temuan tentang Cara Briefing Dibaca, Apa yang Terjadi Setelah Dibuka, dan Bagaimana Window 2 Jam Ini Membentuk Desain Produk
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { finding: "MORNING-FINDING-1: 73% pembukaan email briefing terjadi antara 06:00–08:15 WIB — bukan 07:00 seperti yang diasumsikan", data: "MJP's briefing open rate tracking (via email pixel and WhatsApp read receipts): reveals that 73% of all briefing opens happen between 06:00 and 08:15 WIB. Within this window: 34% open within the first 15 minutes of delivery (06:00–06:15 — while still in bed or during morning preparation). 28% open between 06:15 and 07:00 (during commute or breakfast). 11% open between 07:00 and 08:15 (at office before meetings begin). The remaining 27%: open throughout the business day (09:00–17:00), with a secondary peak at 12:00–13:00 (lunch). Sari's initial assumption: the 07:00 'prime reading window.' The data: the prime window is actually earlier (06:00–06:30) and corresponds with BUJK owners' pre-work meditation time, not their office arrival time.", design_implication: "Design implication: the briefing delivery time of 06:00 is correct. Sari initially considered moving delivery to 06:30 (to allow more briefing preparation time). The open time data: confirmed that 06:00 is optimal — 34% of opens happen in the first 15 minutes, meaning any delay reduces coverage of the highest-engagement window. The finding also explains why mobile-optimized formatting matters so much: the 06:00–06:30 window is predominantly smartphone-first (BUJK reading in bed or during morning preparation) rather than desktop-first (office arrival). Mobile-optimized formatting serves the prime window directly.", tc: "text-primary" },
            { finding: "MORNING-FINDING-2: Briefing yang dibuka di pagi hari menghasilkan 2.8× lebih banyak tindak lanjut platform daripada yang dibuka siang hari", data: "Platform action rate (NLQ queries, tender detail views, Trust Score checks) within 2 hours of briefing open: 18% for early morning opens (06:00–08:15) vs 6.4% for mid-day opens (09:00–17:00). The 2.8× difference: Sari's most important engagement finding. The interpretation: BUJK who read the briefing in the early morning are in 'planning mode' — they are thinking about their day before it begins, making this the highest-decision-making-receptivity window. BUJK who read the briefing during work hours are in 'execution mode' — they are already in the middle of tasks and less likely to pause for additional platform exploration. The morning planning mode: produces intelligence consumption behavior (reading briefing → seeking more context via NLQ → checking Trust Score on a mentioned company) that work-hour execution mode does not.", design_implication: "Design implication: features designed to trigger platform action should be introduced in the briefing's opening section (Section 1, Market Context) rather than later sections — because early-morning openers who are in planning mode: most likely to act on early-section content before transitioning to their work day. The most action-triggering editorial element in the current briefing: the 'This Week's Featured Tender' box in Section 2 (which drives 41% of tender detail page views from briefing traffic). Moving an equivalent 'This Week's Featured Knowledge Registry Asset' box to Section 1: Sari's current experiment to increase morning-mode Knowledge Registry engagement.", tc: "text-blue-700" },
            { finding: "MORNING-FINDING-3: 22% subscriber membaca briefing lebih dari sekali pada hari yang sama — second reading terjadi pukul 12:00–13:00", data: "The re-read behavior: 22% of subscribers who open the briefing in the morning open it again (email or WhatsApp) between 12:00 and 13:00 WIB. Sari's interpretation: the morning read is a quick scan (the 3–4 minute read for Section 2 that Tactical Bidders do, or the 12–15 minute read for Strategic Analysts). The lunch re-read: a deeper review — subscribers revisiting content they noted during the morning read to think through more carefully at a less time-pressured moment. The re-read behavior: concentrated among Strategic Analyst and Compliance Navigator archetypes (who read more sections and need more processing time).", design_implication: "Design implication: the briefing should be designed for both a quick scan and a deep read — two distinct use modes for the same document. Sari's current briefing structure already supports this implicitly: Section 2 (Tender Intelligence) is designed for quick scan (structured format, actionable data), while Section 1 (Market Context) and Section 3 (Regulatory Updates) are designed for deep read (prose explanation, contextual analysis). Making this dual-mode design explicit: Sari's next editorial experiment — adding a 'Quick Scan' summary box at the top of Section 1 (3 bullet points, 30 seconds to read) that gives morning scanners a faster entry to the context, while the full Section 1 prose serves the lunch re-readers who want depth. This dual-mode format: serves Tactical Bidders in morning mode and Strategic Analysts in re-read mode without compromising either archetype's experience. Sari: 'Pembaca yang kembali ke briefing untuk kedua kalinya: mereka memberi tahu saya bahwa kontennya cukup berharga untuk memikirkan dua kali. Itu adalah standar kualitas yang paling memotivasi yang bisa saya bayangkan.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.finding} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.finding}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Data: {r.data}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Design implication: {r.design_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The 06:00–08:00 intelligence window adalah Sari's most practically useful behavioral research finding — because it provides empirical grounding for editorial and product design decisions that were previously made on intuition. The 3 findings (73% opens in morning window, 2.8× higher action rate for morning opens, 22% re-read at lunch) form a coherent picture of BUJK intelligence consumption behavior: morning briefing reading is a deliberate daily ritual (not passive reception) that occurs in a high-receptivity planning state, and approximately 1 in 5 readers values the content enough to return to it during their day. The design implications: (1) delivery timing (06:00 confirmed correct), (2) mobile-first formatting (morning opens are smartphone-first), (3) front-loading the most action-triggering content (morning planning mode maximizes action from early sections), (4) dual-mode format design (morning scan + lunch deep read serve different cognitive states). These are not speculative user experience improvements — they are adjustments calibrated to observed behavioral data. Sari's editorial decisions: increasingly data-driven rather than intuition-driven, which represents a significant evolution from the 2021 briefing that was designed entirely from Sari's professional judgment about what BUJK need. The behavioral data from 4 years of subscriber tracking: now informs every major editorial decision. The most important ongoing behavioral research question: are the 06:00–08:00 patterns changing as MJP's subscriber base grows and diversifies? Specifically: do next-generation BUJK (the 25–35 age group from Budi's 2027 Research Agenda) have different morning intelligence consumption patterns than the 45–60 founding generation? If yes: the briefing format that works for 2025's subscribers may need adjustment for 2027's subscribers.</p>
      </div>

      {/* R118: WhatsApp vs Email Engagement Comparison */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-primary" /> WHATSAPP vs EMAIL — Analisis Komparatif Engagement Dua Saluran Briefing: 4 Dimensi Perbandingan, Temuan yang Bertentangan dengan Intuisi Sari, dan Mengapa MJP Mempertahankan Keduanya daripada Mengkonsolidasikan ke Satu Saluran
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { dimension: "DIMENSION-1: Open rate — WhatsApp 94% vs Email 79%", finding: "WhatsApp briefing open rate (read receipts enabled): 94% of subscribers who receive the WhatsApp briefing read it within 24 hours. Email briefing open rate: 79%. The 15-percentage-point gap: driven by the fundamental difference in notification psychology between the two channels. WhatsApp messages: delivered to a channel subscribers actively monitor for personal and business communication — a WhatsApp notification creates an immediate behavioral prompt to check (and reading the briefing while checking: natural flow from the notification). Email: delivered to a channel that many BUJK batch-process (checking once or twice per day, clearing notifications in bulk — the briefing competes with other unread messages for attention).", implication: "Implication: WhatsApp is the higher-open-rate channel, but the open rate advantage does not translate linearly to engagement quality. High open rate in WhatsApp: partly driven by the app-checking behavior (subscribers who open WhatsApp primarily to check messages also happen to read the briefing) rather than intentional briefing-reading behavior. The morning planning mode engagement (06:00–08:00 window, from R117) applies to both channels — but in WhatsApp, some opens are incidental rather than intentional. Sari monitors 'Section 2 click-through rate' (clicks on tender detail links in the WhatsApp briefing) as the engagement quality proxy — a subscriber who opens the briefing AND clicks a tender link: has shown intentional engagement, not just incidental reading.", tc: "text-primary" },
            { dimension: "DIMENSION-2: Section 2 click-through — Email 12% vs WhatsApp 7%", finding: "Despite WhatsApp's higher open rate, email generates higher Section 2 click-through rates: 12% of email openers click at least one tender link, vs 7% of WhatsApp openers. The counterintuitive result: WhatsApp has higher opens but lower click-through. Sari's explanation: WhatsApp formatting limitations (links are less visually prominent in WhatsApp text format, tender details are harder to scan in the WhatsApp message format vs the email's full HTML layout). Email's formatted layout: makes the 'Featured Tender' box more visually distinct and easier to click, driving higher Section 2 engagement despite lower total opens.", implication: "Implication: email is the higher-intent-engagement channel for subscribers who want to act on briefing intelligence (view tender details, access Knowledge Registry links). WhatsApp is the higher-reach channel for subscribers who want the briefing summary delivered passively. The channel split: not a failure of coordination — it reflects different subscriber use patterns. Subscribers who receive both email AND WhatsApp (approximately 40% of Pro and Enterprise subscribers): show the highest combined engagement (email for deep reading + WhatsApp for quick-scanning when email not yet opened). The dual-channel subscribers: Sari's most engaged segment.", tc: "text-blue-700" },
            { dimension: "DIMENSION-3: Response and feedback rate — WhatsApp 18% vs Email 3%", finding: "WhatsApp generates dramatically higher subscriber response rates: 18% of subscribers who receive the WhatsApp briefing send at least one WhatsApp reply in a given month (market observations, regulatory questions, industry news tips). Email: 3% reply rate (primarily formal feedback, rarely spontaneous). The 6× response rate advantage: WhatsApp's conversational channel nature versus email's broadcast channel nature. A subscriber reading the WhatsApp briefing: already in a conversational context (their WhatsApp chat list) — replying to Sari's briefing channel feels natural. A subscriber reading the email briefing: would need to compose a reply email, which feels more formal and effortful for a spontaneous observation.", implication: "Implication: WhatsApp is MJP's primary subscriber intelligence channel — the channel through which MJP receives organic market observations from BUJK in the field. Sari's most valuable narasumber-equivalent inputs (BUJK who spontaneously share market observations) come primarily through WhatsApp briefing replies. This WhatsApp response traffic: feeds Budi's research pipeline (Sari forwards relevant observations to Budi for follow-up), informs Sari's briefing content (subscriber observations about market trends sometimes become briefing items within 24–48 hours), and provides Reza with customer success signals (a subscriber who asks a substantive question about a regulatory topic: is a candidate for a proactive NLQ introduction). The WhatsApp briefing channel: simultaneously a content delivery channel AND an intelligence collection channel.", tc: "text-emerald-700" },
            { dimension: "DIMENSION-4: Renewal rate correlation — dual-channel subscribers renew at 96% vs single-channel at 87%", finding: "The most commercially significant engagement finding: subscribers who receive the briefing through BOTH email and WhatsApp renew at 96% (close to Enterprise renewal rates despite including Pro and Basic tier subscribers), while single-channel subscribers (email only or WhatsApp only) renew at 87%. The 9-percentage-point renewal rate gap: the clearest evidence of the dual-channel strategy's commercial value. The mechanism: dual-channel subscribers have higher overall engagement (more briefing opens, more clicks, more WhatsApp responses) — and higher engagement predicts higher perceived value predicts higher renewal.", implication: "Implication: converting single-channel subscribers to dual-channel is one of Reza's highest-ROI customer success interventions. The conversion approach: in the onboarding sequence (weeks 1–3), Reza proactively introduces the WhatsApp briefing option to all email-only subscribers (and vice versa). The conversion rate from Reza's dual-channel introduction: 34% of single-channel subscribers who are introduced to the second channel adopt it within 30 days. The retention impact: a single-channel subscriber who becomes dual-channel: statistically increases their renewal probability by 9 percentage points. At MJP's current renewal rate, each percentage point of renewal improvement = approximately Rp 21jt in retained ARR. The dual-channel conversion initiative: Reza's highest-leverage, lowest-cost retention intervention — it requires only a WhatsApp message introducing the second channel, not a pricing change or a new feature build. Sari: 'Saluran terbaik bukan WhatsApp atau email — melainkan keduanya, digunakan sesuai keunggulan alamiahnya masing-masing.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.dimension} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.dimension}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Finding: {r.finding}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Implication: {r.implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">WhatsApp vs email comparative analysis adalah Sari's most actionable distribution intelligence — because it answers the common product decision question 'should we consolidate to one channel?' with data rather than intuition. The answer: no. The 4 dimensions (open rate, click-through, response rate, renewal correlation) show that each channel has a distinct advantage: WhatsApp wins on reach (94% open rate) and intelligence collection (18% response rate), email wins on intent-engagement (12% Section 2 click-through). Neither channel dominates both dimensions simultaneously — consolidating to one channel would sacrifice either reach or engagement quality. The renewal rate finding (dual-channel 96% vs single-channel 87%): the most commercially important result, because it translates channel strategy directly into revenue retention. Maintaining both channels: not a distribution complexity cost — it is a retention investment. The most counterintuitive finding: the email channel's click-through advantage over WhatsApp despite lower open rates. This reverses the typical assumption that 'higher open = higher engagement.' In MJP's case: the formatting quality and intentional reading context of email produces deeper engagement with the same content than WhatsApp's higher-reach but more incidental delivery. Sari uses this finding to justify her continued investment in high-quality HTML email formatting (which takes additional editorial time compared to plain-text or WhatsApp-optimized formats). The email format quality: not a legacy holdover from 2021 briefing design — it is an active engagement strategy supported by current click-through data.</p>
      </div>

      {/* R119: Signal Decay — 4-Hour Half-Life */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> SIGNAL DECAY — Mengapa Intelijen Pagi MJP Memiliki Half-Life 4 Jam: 4 Tipe Sinyal, Kecepatan Depresiasi Nilai Setiap Sinyal, dan Implikasi Desain untuk Jadwal Pengiriman Briefing MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { signal: "SIGNAL-TYPE-1: Tender baru terpublikasi — half-life 4–6 jam setelah publikasi", decay_mechanism: "Tender publications in LPSE: announced to MJP subscribers in the morning briefing at 06:00–06:30. The same tender: visible to all LPSE users simultaneously (MJP has no exclusive access). The signal's value: in being the first BUJK to complete a qualification assessment and make a bid decision. BUJK who receive the tender alert at 06:00, spend 30 minutes reviewing the requirements, and email Reza with SKK Express urgent requests by 06:45: are ahead of competitors who discover the same tender at 09:00 during their routine LPSE check. The 3-hour head start: represents the signal's primary commercial value. By midday (12:00): the tender has been seen by most active BUJK in the relevant category. The signal value (competitive head start): has largely decayed.", decay_implication: "Design implication: Hendra Jr.'s morning crawler prioritizes tender publication data with a 02:00–04:00 crawl window (before briefing preparation) so that LPSE tenders published the previous evening are in the 06:00 briefing — not delayed to next day. The 4-hour SLA between 'published in LPSE' and 'delivered to subscriber' is the most operationally critical performance metric in MJP's entire data pipeline. Every hour of delay past 4 hours = less head-start value for subscribers.", tc: "text-primary" },
            { signal: "SIGNAL-TYPE-2: Harga kompetitor di tender aktif — half-life 12–24 jam setelah pengumuman pemenang", decay_mechanism: "Competitor pricing data (HPS bid amounts from award records): published in LPSE after tender completion, typically 48–72 hours after award announcement. The signal: useful for calibrating future bid strategies. Unlike tender publication data (where time-sensitivity is measured in hours): competitor pricing data's value persists longer — a competitor's bid pattern from a completed tender is still useful for strategic planning for the next 2–4 weeks. However, in high-activity market periods (Q2 and Q4 peak tender seasons), competitor pricing data from last week may be superseded by new pricing data from this week's awards.", decay_implication: "Design implication: Sari's morning briefing dedicates Section 3 ('Intelijen Kompetitor') to competitor pricing and award data — not Section 1 (breaking news), because the signal is valuable but not time-critical in the same way as tender publications. The 12–24 hour half-life: means the data is still highly useful in the afternoon briefing for subscribers who want additional market context after seeing the morning briefing. MJP's afternoon update feature (for Enterprise subscribers): specifically serves the competitor pricing segment with daily refreshes.", tc: "text-blue-700" },
            { signal: "SIGNAL-TYPE-3: Regulasi baru atau perubahan kebijakan — half-life 7–14 hari setelah publikasi", decay_mechanism: "Regulatory changes published in official government sources (LKPP, BNSP, PUPR): have the longest signal half-life of any MJP data type. A new TKDN threshold, a revised SKK requirement, or an IUJK renewal procedure change: remains relevant for weeks to months after publication (because most BUJK have 30–90 day compliance windows). The signal value doesn't decay in terms of relevance — but it does decay in terms of 'urgency premium': the first 3 days after a regulation is published, subscribers who learn about it early can begin compliance preparation ahead of competitors who won't learn for 2–3 weeks (the typical BUJK regulatory awareness lag).", decay_implication: "Design implication: regulatory signals are evergreen content in MJP's Knowledge Registry (Sari's asset about the new regulation remains accessible and valuable for 6–12 months), but have an 'urgency window' in the briefing (Section 4: 'Regulasi Baru') that lasts only the first 7 days after publication. After day 7: the regulation moves from 'urgent new development' to 'context for compliance planning' — still important, but no longer briefing-section-1 urgency. Sari's editorial judgment call: how long a specific regulation stays in the briefing's urgent section before moving to KR-only coverage.", tc: "text-emerald-700" },
            { signal: "SIGNAL-TYPE-4: Intelijen kompetitif strategis (profil Trust Score kompetitor) — half-life 90 hari setelah kalkulasi", decay_mechanism: "Trust Score updates are calculated weekly (Hendra Jr.'s update cadence), but meaningful changes in a competitor's Trust Score happen at a quarterly rhythm — corresponding to completed project filings, SKK renewal cycles, and BPKP audit publication timelines. A subscriber who checks a competitor's Trust Score on Monday: has data that is directionally accurate for the next 90 days (unless a major event occurs — a KPPU sanction, a project default, or a sudden SKK batch renewal). The 90-day half-life: is why Trust Score is positioned as strategic intelligence (quarterly planning input) rather than tactical intelligence (daily decision support).", decay_implication: "Design implication: Trust Score is NOT in the daily morning briefing (unlike tender and regulatory data). Trust Score changes are delivered via the weekly digest (Sunday evening) and the Enterprise subscriber quarterly review. This positioning: matches the signal's half-life to the delivery cadence. The most common Trust Score mis-use Reza corrects in Enterprise subscriber onboarding: using Trust Score as a daily monitoring tool ('has my competitor's score changed today?') instead of a quarterly strategic planning tool ('where is my competitor's Trust Score trajectory taking them in the next 2 quarters?'). The correct use: Trust Score weekly for significant changes (KPPU flag, SKK expiry warning), Trust Score quarterly for strategic positioning analysis.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.signal} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.signal}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Decay mechanism: {r.decay_mechanism}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Design implication: {r.decay_implication}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Signal decay adalah the most underappreciated dimension of MJP's product design — because the value of intelligence is not just in its accuracy but in its timing relative to the decision it informs. The 4 signal types (tender, competitor pricing, regulatory, Trust Score): have half-lives that span 4 hours to 90 days. MJP's product design matches delivery cadence to signal half-life: tender data at 06:00 daily (4-hour half-life = must be morning), competitor pricing in Section 3 (24-hour half-life = daily, but not breaking), regulatory in Section 4 (7-day half-life = daily, but lower urgency), Trust Score in weekly digest and quarterly review (90-day half-life = not daily). The mismatch between signal half-life and delivery cadence: the most common design error in competitive intelligence products. Products that deliver all signal types with the same urgency framing (everything is 'breaking news') train users to ignore everything — because if everything is urgent, nothing is. MJP's editorial hierarchy (which signal type gets which Section in the briefing) is the implementation of signal decay theory into product design. Sari's Section-assignment judgment: the most operationally important editorial decision she makes every morning. Getting it wrong (treating a low-decay signal as high-urgency or vice versa): trains subscribers to miscalibrate their response to intelligence, which is the most direct path to subscriber churn ('the briefing always feels like noise, not signal'). The 06:00–10:00 briefing engagement window: not just a behavioral preference but a functional consequence of the 4-hour half-life of MJP's most time-critical data — tender publications. After 10:00, the marginal value of each briefing read decreases because the actionable head-start window for same-day tender response has closed.</p>
      </div>

      {/* R120: The 06:00 Habit Formation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Coffee className="h-3.5 w-3.5 text-primary" /> THE 06:00 HABIT — Bagaimana MJP Merancang Briefing Pagi sebagai Ritual Harian, Bukan Hanya Produk: 4 Elemen Desain Ritual, Mengapa Konsistensi Waktu Pengiriman Lebih Penting dari Kelengkapan Konten, dan Apa yang Terjadi saat Ritual Terganggu
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { element: "RITUAL-ELEMENT-1: Consistent delivery time — 06:00 WIB tanpa pengecualian, 365 hari setahun", design_rationale: "The 06:00 delivery time: not chosen by algorithm or A/B test but by Hendra's ethnographic observation of BUJK morning routines. Most procurement managers and BUJK directors: arrive at work by 07:30–08:00. Their morning commute (06:00–07:30): the highest-quality 'background information processing' time available in their day — uninterrupted, before the operational demands of the workday begin. A briefing that arrives at 06:00: available during commute. A briefing that arrives at 08:30: competes with the day's first meetings. The commute window: the single best time for intelligence consumption in a procurement professional's schedule.", habit_mechanism: "Habit mechanism: behavioral science research on habit formation identifies 'consistent environmental cues' as the most powerful habit triggers. The 06:00 timestamp — appearing in the subscriber's email inbox and WhatsApp at the same time every day — becomes a reliable environmental cue. After 3–4 weeks of consistent 06:00 delivery, subscribers report that they 'automatically' check the briefing during their commute without consciously deciding to do so. The automatic behavior: the definition of a formed habit. Sari's editorial rule that reinforces the habit: the briefing must be ready for delivery by 05:45 regardless of how much content is available — a partial briefing delivered at 06:00 is more valuable than a complete briefing delivered at 08:00, because the partial briefing preserves the habit cue while the delayed complete briefing breaks it.", tc: "text-primary" },
            { element: "RITUAL-ELEMENT-2: Predictable section structure — subscriber tahu konten apa di Section berapa sebelum membuka", design_rationale: "The briefing's 5-section structure (Breaking News, Featured Tender, Competitor Intelligence, Regulatory Update, Knowledge Registry Highlight): consistent across every edition. The structure: not a template convenience but a deliberate navigation aid. A subscriber who opens the briefing and already knows that Section 2 is 'Featured Tender' and Section 4 is 'Regulatory Update': can navigate directly to the section most relevant to their immediate priorities without reading sequentially. The predictable structure: reduces the cognitive load of consuming intelligence from a daily 15-minute task to a 5-minute scan (for subscribers in routine periods) or a 15-minute deep read (for subscribers in active bid preparation).", habit_mechanism: "Habit mechanism: the predictable structure trains 'section-targeted reading behavior' — a cognitive shortcut where subscribers pattern-match to their most important section without full sequential processing. The pattern-matching: only possible because the structure is consistent. Subscribers who have used MJP for 6+ months: read the briefing differently from new subscribers. New subscribers read all 5 sections sequentially. Experienced subscribers scan Section headers first, then read only the sections where something changed. The efficiency improvement: the product getting better for subscribers who use it consistently, creating a behavioral retention mechanism (experienced subscribers read the briefing faster AND get more value per minute — the opposite of the usual retention challenge where products feel slower as usage increases).", tc: "text-blue-700" },
            { element: "RITUAL-ELEMENT-3: Tone consistency — suara editorial Sari yang konsisten menciptakan rasa terhubung dengan 'pengirim yang dipercaya'", design_rationale: "Sari's editorial voice: direct, factual, occasionally analytical, never sensationalist. The tone: calibrated for procurement professionals who distrust hype and value precision. A briefing that says 'Peringatan penting! Regulasi baru akan mengubah segalanya!' trains subscribers to discount hyperbolic signals. A briefing that says 'SE LKPP No. 3/2026 diterbitkan 28 Juli: mengubah threshold TKDN untuk 4 kategori alat berat. Dampak pada klien dengan pengadaan alat berat aktif: perlu audit TKDN sebelum submission berikutnya.' trains subscribers to trust the signal assessment because it has never been inflated.", habit_mechanism: "Habit mechanism: consistent editorial tone creates 'source trust' — the reader's automatic assignment of credibility to a consistent voice without re-evaluating the source each time. Source trust: the most powerful habit retention mechanism in news and intelligence media. Subscribers who have internalized Sari's tone as 'trustworthy and calibrated': automatically treat MJP briefing signals as reliable action triggers (if the briefing flags it as important, it is important). The source trust: built not in any single edition but across months of consistent tone. The most destructive habit-breaking event: a single edition where Sari's tone inflates a non-critical regulatory update into a 'BREAKING' headline. The credibility erosion from one trust violation: estimated to take 3–4 weeks of consistent accurate signaling to repair.", tc: "text-emerald-700" },
            { element: "RITUAL-ELEMENT-4: 'What to do next' closing — setiap briefing diakhiri dengan 1–2 tindakan konkret yang disarankan", design_rationale: "The closing action: every MJP morning briefing ends with a 'Langkah Selanjutnya' recommendation (1–2 specific actions a subscriber should consider based on the day's intelligence). The actions: not generic ('monitor the market') but specific ('jika Anda mengikuti kategori alat berat, periksa apakah nilai HPS tender yang sedang Anda persiapkan masih di bawah threshold TKDN 40%'). The specificity: requires Sari to understand the practical implications of each day's intelligence for different subscriber segments.", habit_mechanism: "Habit mechanism: the 'what to do next' closing converts the briefing from 'passive information consumption' to 'active decision support.' Subscribers who end their morning briefing read with a specific action to consider: are more likely to feel they've received value (they have something to act on, not just something to know). The action-closure: creates a psychologically satisfying completion to the briefing ritual (the briefing started with information and ended with a decision — a complete cognitive loop). Reza's observation: subscribers who mention specific 'next steps' from recent briefings in their Enterprise quarterly reviews are the most engaged and highest-renewal-rate subscribers. The 'next steps' mention: a behavioral signal that the subscriber is using MJP's intelligence to inform actual business decisions, which is the ultimate measure of product value.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.element} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.element}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Design rationale: {r.design_rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Habit mechanism: {r.habit_mechanism}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">The 06:00 habit design adalah the behavioral layer beneath MJP's intelligence product — because an intelligence product that subscribers use inconsistently is less valuable than one they use every morning as a reflex. The 4 ritual elements (consistent delivery time, predictable structure, tone consistency, action closure): are not content features but behavioral design choices that shape how the briefing is experienced over time. The compounding effect: a subscriber who has been receiving the briefing at 06:00 every morning for 12 months has built a habit so deeply embedded that the briefing's absence feels more notable than its presence. Reza's NPS driver analysis: the highest-scoring satisfaction attribute in MJP's subscriber surveys is not 'data accuracy' or 'feature breadth' but 'reliability' — subscribers value knowing the briefing will be there every morning more than any specific piece of content. The reliability satisfaction: a direct consequence of the 06:00 delivery discipline. The behavioral design implications for MJP's post-Series A product: as MJP adds features (mobile app, province intelligence, IKN tier), the 06:00 habit foundation must be preserved — new features should augment the habit, not fragment it into multiple daily touchpoints that erode the ritual's coherence. Hendra's product principle for expansion: 'Setiap fitur baru harus membuat briefing pagi lebih berharga, bukan menciptakan ritual baru yang bersaing dengan briefing. Pelanggan kami hanya memiliki satu waktu pagi — kami tidak boleh memintanya untuk membagi perhatiannya antara 3 produk MJP yang berbeda.'</p>
      </div>

      {/* R121: Pasar Swasta yang Belum Terjangkau — Peluang dan Hambatan Sistemik */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-blue-500" /> PASAR SWASTA YANG BELUM TERJANGKAU — 2 Realitas yang Membatasi Pertumbuhan BUJK: Proyek Konstruksi Swasta yang Tidak Bisa Dijangkau Banyak Perusahaan + Pemborongan BUJK Perseorangan yang Tidak Terkontrol di Proyek Swasta dan Asing
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-blue-700 mb-0.5">SWASTA-1: Proyek konstruksi swasta dan asing — pasar besar yang belum bisa dijangkau sebagian besar BUJK</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Nilai proyek konstruksi swasta di Indonesia diperkirakan 55–60% dari total pasar konstruksi nasional (Rp 490–530 triliun dari total Rp 890 triliun per tahun, sumber: BPS Konstruksi 2024). Namun sebagian besar BUJK formal hanya bisa mengakses proyek pemerintah (APBN/APBD) yang memiliki sistem tender transparan (LPSE). Pasar swasta: (1) tidak memiliki sistem pengumuman terpusat seperti LPSE — informasi proyek tersebar di developer, BUMN properti, dan investor asing; (2) persyaratan masuk ke proyek swasta besar (Ciputra, Sinar Mas Land, proyek PLTA, proyek industri) sering tidak dipublikasikan — berbasis relasi dan track record; (3) proyek konstruksi asing (EPCI, EPC) mensyaratkan sertifikasi internasional (ISO 9001, ISO 14001, OHSAS 18001) yang dimiliki kurang dari 8% BUJK Indonesia. Celah intelligence: BUJK tidak tahu proyek swasta apa yang sedang dikembangkan, siapa owner-nya, berapa nilainya, dan apa persyaratan masuknya — karena tidak ada database publik yang setara LPSE untuk pasar swasta.</p>
            <p className="text-[7px] font-mono text-blue-700">MJP coverage: Radar Kompetitor mencakup proyek swasta yang terdeteksi melalui sinyal IMB/PBG, siaran pers developer, dan data izin lingkungan (AMDAL). Pipeline proyek swasta dari data BIG (Badan Informasi Geospasial) dan data BKPM untuk proyek dengan komponen PMA. Sumber: {" "}
              <a href="https://bps.go.id/subject/6/konstruksi.html" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">BPS Statistik Konstruksi</a>{" "}·{" "}
              <a href="https://bkpm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">BKPM — Pipeline Investasi</a>{" "}·{" "}
              <a href="https://big.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">BIG — Data Spasial</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-red-700 mb-0.5">SWASTA-2: Pemborongan BUJK dan Perseorangan tidak terkontrol di proyek swasta dan asing — kompetisi tidak setara</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">UU No. 2/2017 tentang Jasa Konstruksi berlaku untuk semua proyek konstruksi di Indonesia, termasuk proyek swasta. Namun pengawasan dan penegakan hukum terhadap proyek konstruksi swasta jauh lebih lemah dibanding proyek pemerintah. Praktik yang terjadi: (1) kontraktor perseorangan (tidak berbadan usaha, tidak memiliki SBU/IUJK) bebas mengerjakan proyek swasta tanpa pengawasan — bersaing langsung dengan BUJK formal yang harus menanggung biaya SBU, SKK, IUJK, dan semua kewajiban administrasi; (2) BUJK yang tidak lulus kualifikasi LPSE (karena memang tidak memiliki sertifikasi memadai) masih bisa mengerjakan proyek swasta bernilai miliaran — tanpa konsekuensi regulasi; (3) kontraktor asing mengerjakan proyek di Indonesia melalui skema subkontrak lokal yang secara substansi menghindari persyaratan kualifikasi BUJK asing. Dampak pada BUJK patuh: harus menanggung biaya sertifikasi 3–8% dari overhead operasional, sementara pesaing informal tidak menanggung biaya tersebut dan bisa menawarkan harga lebih rendah.</p>
            <p className="text-[7px] font-mono text-red-700">MJP intelligence: Mapping BUJK informal aktif di pasar swasta berdasarkan data tender swasta yang terindeks. Analisis selisih harga antara BUJK formal dan informal untuk kategori proyek serupa. Advocacy brief untuk LPJK tentang pengawasan proyek swasta (dalam pipeline). Sumber: {" "}
              <a href="https://peraturan.bpk.go.id/Details/37728" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">UU No. 2/2017 Jasa Konstruksi</a>{" "}·{" "}
              <a href="https://binakon.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ditjen Bina Konstruksi PUPR</a>
            </p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pasar swasta yang tidak terjangkau dan tidak terkontrol adalah dua sisi dari satu problem: informasi asimetri. BUJK formal tidak tahu proyek swasta apa yang tersedia (sisi permintaan tidak transparan), sementara kontraktor informal bebas masuk pasar tanpa beban sertifikasi yang sama (sisi penawaran tidak setara). MJP's strategic bet: pasar swasta akan semakin terbuka seiring tiga tren — OSS berbasis risiko yang mempermudah verifikasi BUJK oleh owner swasta, tekanan investor asing yang mensyaratkan kontraktor bersertifikat, dan LPJK yang secara perlahan memperluas pengawasan ke proyek swasta besar. BUJK yang memiliki sertifikasi lengkap, track record terdokumentasi, dan network relasi dengan owner swasta: akan menjadi pemenang terbesar saat pasar swasta membuka. MJP's role: mempersiapkan subscriber untuk window ini — bukan dengan spekulasi, tetapi dengan intelligence tentang proyek apa yang akan terbuka, siapa owner-nya, dan persyaratan apa yang dibutuhkan untuk masuk. Hendra: 'Subscriber yang paling berhasil tahun depan adalah yang hari ini sudah tahu proyek swasta mana yang akan matang, bukan yang baru mulai mencari saat proyek sudah diumumkan.'</p>
        <div className="mt-2 pt-2 border-t">
          <p className="text-[8px] font-mono text-muted-foreground mb-1 font-semibold">SUMBER REFERENSI RESMI:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {[
              { label: "BPS — Statistik Konstruksi", url: "https://bps.go.id/subject/6/konstruksi.html" },
              { label: "BKPM — Pipeline Investasi", url: "https://bkpm.go.id" },
              { label: "UU Jasa Konstruksi No. 2/2017", url: "https://peraturan.bpk.go.id/Details/37728" },
              { label: "Ditjen Bina Konstruksi PUPR", url: "https://binakon.pu.go.id" },
              { label: "BIG — Data Spasial Infrastruktur", url: "https://big.go.id" },
            ].map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[7px] text-primary hover:underline font-mono">
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* R122a: Permintaan Jasa Konstruksi dari Masyarakat, Platform Digital, dan Developer */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5 text-primary" /> SUMBER PERMINTAAN JASA KONSTRUKSI — 3 Kanal Permintaan yang Berkembang Pesat: Masyarakat Langsung, Platform Digital Konstruksi, dan Developer Properti — Sinyal Pasar yang Belum Sepenuhnya Terpantau MJP
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-primary mb-0.5">KANAL-1: Permintaan langsung dari masyarakat — renovasi, bangun hunian, dan konstruksi non-pemerintah skala kecil-menengah</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Pasar konstruksi residensial (hunian pribadi, renovasi, dan perbaikan) di Indonesia diestimasi Rp 180–220 triliun per tahun — sebagian besar tidak tercatat secara formal karena dikerjakan oleh tukang borong informal. Segmen yang tumbuh: (1) kelas menengah urban yang membangun rumah di atas kavling (urban sprawl Jabodetabek, Bandung, Surabaya, Medan) dengan anggaran Rp 300jt–2 miliar; (2) rumah subsidi pemerintah (FLPP) yang menciptakan backlog 12,7 juta unit rumah yang butuh dibangun; (3) pasar renovasi pasca-pandemi — survei Nielsen 2024 menunjukkan 34% rumah tangga Indonesia berencana renovasi dalam 24 bulan. Peluang BUJK formal di segmen ini: margin lebih tinggi (15–25% vs 5–12% di tender pemerintah), pembayaran lebih fleksibel, dan risiko kompetisi tender rendah. Hambatan: channel akuisisi pelanggan — masyarakat tidak tahu cara mencari kontraktor formal yang terpercaya selain dari rekomendasi mulut ke mulut.</p>
            <p className="text-[7px] font-mono text-primary">MJP opportunity: channel permintaan masyarakat belum menjadi bagian dari intelligence MJP hari ini. Post-Series A: Demand Signal Monitor untuk melacak volume permintaan di platform digital konstruksi sebagai leading indicator aktivitas pasar. Sumber: {" "}
              <a href="https://bps.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bps.go.id — Statistik Perumahan</a>{" "}·{" "}
              <a href="https://pupr.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pupr.go.id — Backlog Perumahan</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-blue-700 mb-0.5">KANAL-2: 8 platform digital konstruksi — marketplace yang menghubungkan owner dengan kontraktor secara langsung</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Platform digital konstruksi Indonesia berkembang sebagai agregator permintaan masyarakat dan developer. Profil 8 platform utama yang relevan untuk BUJK:
              (1) Renovasik — platform renovasi berbasis aplikasi, matching owner dengan kontraktor terverifikasi, fokus renovasi hunian Rp 50jt–500jt, sudah aktif di Jabodetabek dan Bandung;
              (2) Arsitag — marketplace arsitek dan desainer interior, menghubungkan owner dengan arsitek lalu kontraktor, target segmen premium, proyek Rp 500jt–5 miliar;
              (3) Retro Konsultan — platform konsultasi teknis konstruksi, menyediakan jasa audit bangunan, pengawasan konstruksi, dan manajemen proyek untuk owner individual;
              (4) Novade — platform manajemen proyek konstruksi berbasis SaaS, digunakan oleh kontraktor menengah-besar untuk koordinasi lapangan dan pelaporan;
              (5) BangunRenov — marketplace untuk jasa renovasi dan perbaikan rumah, fokus proyek kecil Rp 5jt–100jt, aktif di Jawa;
              (6) RenovRuma — platform renovasi dengan model harga transparan per meter persegi, menyasar segmen menengah, matching dengan kontraktor lokal terverifikasi;
              (7) TukangBangun.id — direktori dan marketplace tukang borong dan kontraktor kecil, rating berbasis review pelanggan, model freemium untuk kontraktor;
              (8) Tanagi-Indonesia — platform tenaga ahli konstruksi, menghubungkan BUJK dengan freelance tenaga ahli bersertifikat SKK untuk keperluan proyek dan administrasi.</p>
            <p className="text-[7px] font-mono text-blue-700">MJP intelligence value: platform-platform ini adalah sumber data volume permintaan konstruksi residensial yang belum dimonitor. Job posting di TukangBangun.id dan Renovasik: leading indicator aktivitas konstruksi 4–8 minggu sebelum material dibeli. Arsitag project posting: leading indicator proyek premium yang akan butuh kontraktor dalam 3–6 bulan. Tanagi-Indonesia SKK listing: sinyal kekurangan tenaga ahli per sub-bidang yang MJP bisa tindaklanjuti.</p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-emerald-700 mb-0.5">KANAL-3: Permintaan dari developer properti — pasar konstruksi yang terstruktur tapi aksesnya berbasis relasi</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Developer properti (Ciputra, Sinar Mas Land, Summarecon, Agung Sedayu, Pakuwon, ratusan developer lokal daerah) adalah pemberi kerja konstruksi terbesar di luar pemerintah. Skala: developer besar mengontrakkan konstruksi Rp 500 miliar–3 triliun per tahun. Developer menengah-lokal: Rp 50–300 miliar per tahun. Karakteristik tender developer: (1) tidak dipublikasikan di LPSE — murni undangan selektif berbasis vendor list internal; (2) persyaratan masuk vendor list: track record proyek serupa (diverifikasi lapangan), laporan keuangan 3 tahun, dan referensi dari proyek sebelumnya; (3) developer cenderung loyal ke kontraktor yang sudah teruji — switching cost tinggi karena developer tidak mau mengambil risiko kontraktor baru di proyek multi-miliar. Pipeline permintaan developer: dapat diprediksi dari IMB/PBG yang diterbitkan, peluncuran cluster perumahan baru, dan data land acquisition di laporan keuangan developer publik. Kontraktor yang masuk vendor list 2–3 developer besar: memiliki backlog kerja 12–24 bulan yang relatif terjamin.</p>
            <p className="text-[7px] font-mono text-emerald-700">MJP opportunity: Developer Pipeline Monitor dari data PBG (Persetujuan Bangunan Gedung), siaran pers developer, dan laporan keuangan kuartalan BUMN properti. Modul vendor list preparation checklist untuk BUJK yang ingin masuk pasar developer. Sumber: {" "}
              <a href="https://simbg.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">simbg.pu.go.id — Database PBG</a>{" "}·{" "}
              <a href="https://idx.co.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">idx.co.id — Laporan Keuangan Developer</a>
            </p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Tiga kanal permintaan ini — masyarakat, platform digital, developer — mewakili 55–60% total pasar konstruksi Indonesia yang selama ini tidak terpantau oleh BUJK formal karena tidak ada sistem pengumuman terpusat. MJP's current coverage: sangat kuat di pasar pemerintah (LPSE, tender APBN/APBD) tetapi hampir tidak ada di ketiga kanal ini. Post-Series A product expansion: Demand Intelligence Module yang memonitor sinyal permintaan dari platform digital, data PBG, dan aktivitas developer — memberikan BUJK subscriber visibilitas ke seluruh pasar, bukan hanya porsi pemerintah. Hendra's market sizing recalibration: 'Selama ini kami mengatakan kami melayani pasar konstruksi Indonesia. Sebenarnya kami melayani pasar konstruksi pemerintah Indonesia — sekitar 40–45% dari total pasar. Ketiga kanal ini adalah ekspansi TAM yang paling realistis untuk 18–24 bulan ke depan.'</p>
        <div className="mt-2 pt-2 border-t">
          <p className="text-[8px] font-mono text-muted-foreground mb-1 font-semibold">PLATFORM DIGITAL KONSTRUKSI — AKSES LANGSUNG:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {[
              { label: "Renovasik", url: "https://renovasik.com" },
              { label: "Arsitag", url: "https://arsitag.com" },
              { label: "Retro Konsultan", url: "https://retrokonsultan.com" },
              { label: "Novade", url: "https://novade.net" },
              { label: "BangunRenov", url: "https://bangunrenov.com" },
              { label: "RenovRuma", url: "https://renovruma.com" },
              { label: "TukangBangun.id", url: "https://tukangbangun.id" },
              { label: "Tanagi Indonesia", url: "https://tanagi-indonesia.com" },
            ].map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[7px] text-primary hover:underline font-mono">
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* R122b: Peluang Sektor Swasta Asing — Pertambangan, Migas, Energi, Ketenagalistrikan, Lingkungan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-orange-500" /> PELUANG SEKTOR SWASTA ASING — 5 Sektor Ekstraktif dan Infrastruktur dengan Nilai Kontrak Konstruksi Terbesar di Luar APBN: Pertambangan, Migas, Energi Terbarukan, Ketenagalistrikan, dan Lingkungan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-primary mb-0.5">SEKTOR-1: Pertambangan — konstruksi infrastruktur tambang nikel, bauksit, emas, dan batubara</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Indonesia adalah produsen nikel terbesar dunia (49% produksi global) dan investasi pertambangan nikel terus meningkat pasca-larangan ekspor ore 2020. Nilai konstruksi infrastruktur pertambangan baru: smelter nikel (Rp 1–8 triliun per unit), jalan tambang, port loading facilities, power plant dedicated, dan camp karyawan. Perusahaan tambang asing aktif di Indonesia: Vale Indonesia, Amman Mineral, Freeport McMoRan, Adaro Energy, Bayan Resources, Harita Nickel. Tender konstruksi tambang: tidak di LPSE — melalui procurement portal masing-masing perusahaan atau EPC contractor yang ditunjuk. Persyaratan masuk: OHSAS 18001/ISO 45001 (K3), pengalaman proyek remote area, kapasitas mobilisasi besar. Nilai rata-rata kontrak konstruksi per paket di tambang besar: Rp 50–500 miliar. BUJK yang sudah masuk ekosistem pertambangan: mendapat recurring work karena perusahaan tambang cenderung loyal ke kontraktor yang memahami prosedur keselamatan spesifik mereka.</p>
            <p className="text-[7px] font-mono text-primary">MJP coverage: Monitor pipeline investasi tambang dari data BKPM dan laporan keuangan perusahaan tambang publik. Alert fase konstruksi vs produksi per lokasi tambang. Sumber: {" "}
              <a href="https://minerba.esdm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">minerba.esdm.go.id — Ditjen Minerba</a>{" "}·{" "}
              <a href="https://bkpm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bkpm.go.id — Realisasi Investasi</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-orange-700 mb-0.5">SEKTOR-2: Minyak dan Gas (Migas) — infrastruktur upstream, midstream, dan fasilitas pengolahan</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Investasi migas Indonesia (upstream + midstream + downstream) mencapai USD 13–15 miliar per tahun (2024–2026, sumber: SKK Migas). Komponen konstruksi: fasilitas produksi (wellpad, separator, manifold), pipeline (onshore dan offshore), storage tank, LNG processing facility, dan refinery upgrade. Kontraktor migas: umumnya menggunakan struktur EPC (Engineering, Procurement, Construction) di mana kontraktor besar internasional (Technip, McDermott, Chiyoda) menjadi prime contractor dan subkontrak pekerjaan sipil/mekanikal ke BUJK lokal. Entry point untuk BUJK lokal: subkontraktor sipil (civil works), insulasi pipa, pekerjaan coating, dan fasilitas penunjang (warehouse, road access). Nilai subkontrak: Rp 20–200 miliar per paket. Persyaratan: sertifikasi MIGAS dari ESDM, K3 migas, dan VCR (Vendor Category Registration) di SKK Migas Vendor Management System.</p>
            <p className="text-[7px] font-mono text-orange-700">MJP coverage: SKK Migas WP{"&"}B (Work Program and Budget) plan sebagai sinyal pipeline kontrak konstruksi migas 12–18 bulan ke depan. Alert publikasi bid invitation dari KKKS (Kontraktor Kontrak Kerja Sama). Sumber: {" "}
              <a href="https://www.skkmigas.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">skkmigas.go.id</a>{" "}·{" "}
              <a href="https://migas.esdm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">migas.esdm.go.id — Ditjen Migas</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-emerald-700 mb-0.5">SEKTOR-3: Energi Terbarukan — PLTS, PLTB, PLTA, dan infrastruktur transisi energi</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Target bauran energi terbarukan Indonesia 23% di 2025 (dari 13.1% aktual 2024) dan 34% di 2030 menciptakan pipeline konstruksi energi terbarukan yang besar. Nilai konstruksi yang dibutuhkan: PLTS (Pembangkit Listrik Tenaga Surya) 10 GWp yang direncanakan = Rp 150–200 triliun pembangunan infrastruktur. PLTB (angin) di Sulsel dan NTT: setiap wind farm membutuhkan konstruksi pondasi turbin, jalan akses (road EPC), substation. PLTA: masih banyak potensi di Kalimantan, Sulawesi, Papua — konstruksi bendungan dan powerhouse adalah pekerjaan sipil berskala besar. Investor energi terbarukan yang aktif: PLN, ACEN (Philippines), Masdar (UAE), GIC (Singapore), Vena Energy. Tender konstruksi: melalui IPP (Independent Power Producer) selection oleh PLN atau RUPTL pipeline. BUJK yang sudah memiliki pengalaman konstruksi pembangkit: memiliki keunggulan kompetitif signifikan.</p>
            <p className="text-[7px] font-mono text-emerald-700">MJP coverage: Monitor RUPTL PLN (Rencana Usaha Penyediaan Tenaga Listrik) untuk pipeline pembangunan pembangkit EBT. Alert BKPM realisasi investasi energi terbarukan per kuartal. Sumber: {" "}
              <a href="https://web.pln.co.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pln.co.id — RUPTL</a>{" "}·{" "}
              <a href="https://ebtke.esdm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ebtke.esdm.go.id — Ditjen EBTKE</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-blue-700 mb-0.5">SEKTOR-4: Ketenagalistrikan — transmisi, distribusi, gardu induk, dan smart grid</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">PLN investasi Rp 70–90 triliun per tahun untuk transmisi dan distribusi (T&D) — terbesar setelah pembangunan pembangkit. Komponen konstruksi: jalur transmisi SUTET/SUTT (tower baja, pondasi, ROW acquisition), gardu induk (GI), jaringan distribusi 20kV, dan smart meter installation. Selain PLN: investasi ketenagalistrikan swasta melalui IPP dan industrial estate power supply. IKN membutuhkan smart grid baru senilai Rp 15–20 triliun. Karakteristik pekerjaan transmisi: lintas provinsi, membutuhkan koordinasi perizinan ROW yang kompleks, dan pengalaman konstruksi tower baja. Nilai paket konstruksi transmisi: Rp 50–800 miliar per kontrak. BUJK yang bergerak di konstruksi T&D: biasanya memiliki kualifikasi sub-bidang spesifik (jaringan transmisi tenaga listrik) yang tidak dimiliki kontraktor gedung/jalan biasa.</p>
            <p className="text-[7px] font-mono text-blue-700">MJP coverage: Monitor pengumuman tender PLN di procurement.pln.co.id sebagai sinyal pasar ketenagalistrikan. Alert rencana pembangunan GI baru dari RUPTL. Sumber: {" "}
              <a href="https://procurement.pln.co.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">procurement.pln.co.id</a>{" "}·{" "}
              <a href="https://gatrik.esdm.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">gatrik.esdm.go.id — Ditjen Ketenagalistrikan</a>
            </p>
          </div>
          <div className="border-b py-1.5">
            <p className="text-[8px] font-bold text-cyan-700 mb-0.5">SEKTOR-5: Lingkungan — WWTP, pengelolaan sampah, remediasi lahan, dan infrastruktur sanitasi</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Regulasi lingkungan yang semakin ketat (UU PPLH, PROPER, dan standar emisi baru) mendorong investasi konstruksi lingkungan dari sektor swasta asing dan BUMN. Kategori utama: (1) WWTP (Waste Water Treatment Plant) untuk industri wajib sesuai Permen LHK — setiap pabrik baru di KEK dan kawasan industri wajib membangun WWTP; (2) Fasilitas pengolahan sampah (TPS3R, TPST, RDF Plant) — investasi swasta masuk melalui skema KPBU; (3) Remediasi lahan terkontaminasi — tambang dan industri wajib melakukan reklamasi; (4) Infrastruktur air bersih dan sanitasi — SPAM (Sistem Penyediaan Air Minum) regional melalui KPBU. Investor asing aktif: Veolia (Perancis), Suez (Perancis), Sembcorp (Singapura) untuk WWTP industrial. Nilai proyek WWTP industrial: Rp 20–500 miliar tergantung kapasitas. BUJK dengan pengalaman konstruksi lingkungan: niche yang sangat terbatas, margin 18–28%.</p>
            <p className="text-[7px] font-mono text-cyan-700">MJP coverage: Monitor data PROPER KLHK untuk identifikasi perusahaan yang wajib upgrade WWTP. Pipeline KPBU air minum dan sanitasi dari BPPW PUPR. Sumber: {" "}
              <a href="https://proper.menlhk.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">proper.menlhk.go.id — KLHK PROPER</a>{" "}·{" "}
              <a href="https://kpbu.kemenkeu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">kpbu.kemenkeu.go.id — Pipeline KPBU</a>
            </p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Lima sektor swasta asing ini mewakili pasar konstruksi bernilai Rp 300–500 triliun per tahun — setara dengan seluruh belanja konstruksi APBN — tetapi hampir tidak tersentuh oleh sebagian besar BUJK karena barrier entry yang tinggi (sertifikasi khusus, pengalaman sektor, dan jaringan relasi dengan EPC contractor internasional). MJP's sector intelligence value: bukan mempersiapkan BUJK untuk langsung menangani proyek migas atau pertambangan besar besok hari, tetapi membantu BUJK memahami ekosistem subkontraktor — di mana posisi yang realistis untuk BUJK dengan kualifikasi dan kapasitas tertentu, sertifikasi apa yang harus disiapkan sekarang untuk bisa masuk dalam 2–3 tahun ke depan, dan kontraktor EPC mana yang paling aktif mencari subkontraktor lokal. Setiap sektor memiliki pintu masuk yang berbeda: tambang melalui ISO 45001, migas melalui VCR SKK Migas, EBT melalui pengalaman konstruksi sipil pembangkit, ketenagalistrikan melalui kualifikasi T&D, lingkungan melalui pengalaman WWTP. MJP sector intelligence: peta jalan yang konkret dari posisi BUJK hari ini menuju sektor yang paling mungkin dimasuki dalam 24 bulan.</p>
        <div className="mt-2 pt-2 border-t">
          <p className="text-[8px] font-mono text-muted-foreground mb-1 font-semibold">SUMBER REFERENSI SEKTOR:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {[
              { label: "Ditjen Minerba ESDM", url: "https://minerba.esdm.go.id" },
              { label: "SKK Migas", url: "https://www.skkmigas.go.id" },
              { label: "Ditjen EBTKE", url: "https://ebtke.esdm.go.id" },
              { label: "PLN Procurement", url: "https://procurement.pln.co.id" },
              { label: "Ditjen Gatrik ESDM", url: "https://gatrik.esdm.go.id" },
              { label: "KLHK PROPER", url: "https://proper.menlhk.go.id" },
              { label: "Pipeline KPBU", url: "https://kpbu.kemenkeu.go.id" },
              { label: "BKPM Investasi", url: "https://bkpm.go.id" },
            ].map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[7px] text-primary hover:underline font-mono">
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* R123 — Pesantren, Sekolah, Kampus, Perkantoran & Kos-Kosan */}
      <div className="rounded-lg border bg-card p-3 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🏫</span>
          <h3 className="text-sm font-bold">Segmen Pendidikan, Ibadah, dan Properti Komersial Skala Menengah</h3>
          <span className="ml-auto text-[9px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">Pasar Lokal Tersembunyi</span>
        </div>
        <p className="text-[8px] text-muted-foreground mb-2">Segmen yang jarang dimonitor oleh BUJK formal namun mewakili volume proyek yang sangat besar secara agregat — ribuan proyek kecil-menengah Rp 500 juta – Rp 50 miliar yang tersebar di seluruh Indonesia. Tidak ada pengumuman LPSE, tidak ada e-procurement — semua melalui relasi, rekomendasi, dan reputasi lokal. MJP intelligence value: mengidentifikasi pemrakarsa proyek sebelum mereka mulai RFQ informal.</p>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {/* Pesantren */}
          <div className="rounded border bg-amber-50/40 p-2">
            <p className="text-[8px] font-bold text-amber-800 mb-0.5">SEGMEN-1: Pesantren — Pembangunan & Renovasi Pondok</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Indonesia memiliki <strong>±36.000 pesantren</strong> (data Kemenag 2023) dengan total santri 4,7 juta — mayoritas memiliki infrastruktur yang sudah berumur 20–40 tahun. Tipe proyek: gedung asrama baru, masjid/mushola, ruang kelas, dapur umum, renovasi kamar mandi &amp; sanitasi massal, pagar, dan jalan akses. Nilai per proyek: Rp 300 juta – Rp 15 miliar. Sumber dana: dana zakat/wakaf (BAZNAS, Dompet Dhuafa, Lazismu, Lazisnu), anggaran DAK Pendidikan Kemenag, sumbangan alumni/donatur, dan dana BOS-Pesantren. Pemrakarsa: Kyai/Mudir, Yayasan Pondok, atau Komite Pembangunan alumni. Siklus proyek: sering dimulai setelah Ramadan (penerimaan santri baru) atau menjelang tahun ajaran baru.</p>
            <p className="text-[7px] font-mono text-amber-700">Sinyal MJP: Pantau laporan BAZNAS daerah + situs pesantren besar. Referensi:{" "}
              <a href="https://pendis.kemenag.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pendis.kemenag.go.id — Data Pesantren Kemenag</a>{" "}·{" "}
              <a href="https://baznas.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">baznas.go.id — BAZNAS Pusat</a>
            </p>
          </div>

          {/* Sekolah */}
          <div className="rounded border bg-sky-50/40 p-2">
            <p className="text-[8px] font-bold text-sky-800 mb-0.5">SEGMEN-2: Sekolah Swasta — SD, SMP, SMA, SMK</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Indonesia memiliki <strong>±84.000 sekolah swasta</strong> dari SD hingga SMA/SMK. Tipe proyek: ruang kelas baru, laboratorium IPA/komputer/bahasa, perpustakaan, aula/gedung serba guna, toilet &amp; sanitasi, lapangan olahraga, dan renovasi total gedung lama. Nilai per proyek: Rp 500 juta – Rp 30 miliar. Sumber dana: dana yayasan, SPP akumulasi, BOS (untuk sekolah terakreditasi), APBD melalui hibah Dinas Pendidikan, CSR perusahaan, dan pinjaman BRI/Bank Daerah. Pemrakarsa: Yayasan Pendidikan, Komite Sekolah, atau Kepala Sekolah. Trigger proyek: akreditasi ulang (Asesor BAN S/M mengharuskan standar sarana tertentu), kenaikan peserta didik, atau bencana/kerusakan. Sekolah SMK punya proyek khusus: workshop/bengkel praktik yang membutuhkan konstruksi industrial ringan.</p>
            <p className="text-[7px] font-mono text-sky-700">Sinyal MJP: Jadwal akreditasi BAN S/M + data DAPODIK kepadatan kelas. Referensi:{" "}
              <a href="https://bansm.kemdikbud.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">bansm.kemdikbud.go.id — BAN S/M Akreditasi</a>{" "}·{" "}
              <a href="https://dapo.kemdikbud.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">dapo.kemdikbud.go.id — DAPODIK Kemdikbud</a>
            </p>
          </div>

          {/* Kampus */}
          <div className="rounded border bg-purple-50/40 p-2">
            <p className="text-[8px] font-bold text-purple-800 mb-0.5">SEGMEN-3: Perguruan Tinggi Swasta (PTS) — Kampus Baru & Ekspansi</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Indonesia memiliki <strong>±4.200 PTS</strong> — mayoritas yayasan kecil-menengah di luar Pulau Jawa yang sedang ekspansi mengikuti pertumbuhan mahasiswa pascapandemi. Tipe proyek: gedung kuliah baru (4–8 lantai), laboratorium sesuai standar akreditasi BAN-PT (Teknik, Kesehatan, Farmasi paling aktif), asrama mahasiswa, kantin &amp; food court, rektorat/gedung administrasi, dan fasilitas olahraga. Nilai per proyek: Rp 5 miliar – Rp 200 miliar. Sumber dana: dana yayasan, pinjaman bank (PTS ber-akreditasi B/A dapat KUR Pendidikan BRI), bantuan PKS dari Pemprov/Pemkab, dan sebagian dari uang pangkal mahasiswa. Trigger proyek: persiapan akreditasi BAN-PT (standar sarana sangat ketat untuk nilai A/B), penambahan program studi baru, atau pertumbuhan mahasiswa yang membutuhkan kapasitas tambahan. PTS Kesehatan &amp; Kedokteran paling aktif karena standar sarana KKI/BAN-PT sangat tinggi.</p>
            <p className="text-[7px] font-mono text-purple-700">Sinyal MJP: Jadwal reakreditasi BAN-PT + laporan PDDikti pertumbuhan mahasiswa. Referensi:{" "}
              <a href="https://www.banpt.or.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">banpt.or.id — BAN-PT Akreditasi PT</a>{" "}·{" "}
              <a href="https://pddikti.kemdikbud.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">pddikti.kemdikbud.go.id — PDDikti Data Mahasiswa</a>
            </p>
          </div>

          {/* Perkantoran & Ruko */}
          <div className="rounded border bg-emerald-50/40 p-2">
            <p className="text-[8px] font-bold text-emerald-800 mb-0.5">SEGMEN-4: Perkantoran, Ruko &amp; Rumah Kantor Komersial</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Segmen paling konsisten sepanjang tahun: pembangunan &amp; renovasi kantor perusahaan, ruko (rumah toko), showroom, klinik, apotek, minimarket, dan gudang kecil. Tipe proyek konstruksi: fit-out interior komersial, partisi, MEP (mekanikal-elektrikal-plumbing), fasad gedung, akses ramah difabel, CCTV &amp; sistem keamanan, dan area parkir. Nilai per proyek: Rp 100 juta – Rp 10 miliar. Klien potensial: developer ruko (banyak di kota tier-2/3), pemilik bisnis ritel, perusahaan asuransi yang membuka cabang baru, klinik pratama yang memenuhi standar FKTP BPJS, dan apotek jaringan. Trigger proyek: perpindahan kantor, ekspansi bisnis, perubahan regulasi (standar FKTP Kemenkes untuk klinik), atau renovasi pasca-pandemi (banyak ruko kosong yang kini diambil alih). Data PBG (Persetujuan Bangunan Gedung) pengganti IMB adalah sinyal terbaik untuk proyek ini — terbit sebelum konstruksi dimulai.</p>
            <p className="text-[7px] font-mono text-emerald-700">Sinyal MJP: Monitor data PBG OSS per kota + listing iklan B2B. Referensi:{" "}
              <a href="https://oss.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">oss.go.id — OSS / PBG Data</a>{" "}·{" "}
              <a href="https://simbg.pu.go.id" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">simbg.pu.go.id — SIMBG Kementerian PU</a>
            </p>
          </div>

          {/* Kos-kosan */}
          <div className="rounded border bg-rose-50/40 p-2 md:col-span-2">
            <p className="text-[8px] font-bold text-rose-800 mb-0.5">SEGMEN-5: Kos-Kosan, Kontrakan &amp; Hunian Sewa Skala Kecil-Menengah</p>
            <p className="text-[7px] text-muted-foreground mb-0.5">Backlog hunian sewa terbesar ada di kota-kota dengan kampus besar, kawasan industri, dan pusat perkantoran. Investor kos-kosan dan kontrakan adalah salah satu klien BUJK kecil-menengah yang paling konsisten karena siklus investasinya pendek (ROI 8–12 tahun), mudah dibiayai bank, dan selalu ada permintaan. Tipe proyek: bangun baru kos eksklusif 20–50 kamar (kos premium dengan AC, kamar mandi dalam, parkir motor), renovasi kos lama naik kelas, konversi ruko menjadi kos/kost-el, dan pembangunan kontrakan keluarga 2–4 unit di lahan pribadi. Nilai per proyek: Rp 800 juta – Rp 15 miliar. Segmen yang sedang tumbuh: <strong>kos premium untuk mahasiswa S2/pekerja muda</strong> (kamar 12–20 m² dengan fasilitas co-working, laundry, WiFi fiber) — margin konstruksi 20–30% lebih tinggi dari kos biasa karena spesifikasi interior lebih tinggi. Lokasi terpanas: Jabodetabek (sekitar kampus UI/IPB/ITB/UGM/ITS), Surabaya, Medan, Makassar, Semarang, dan kota-kota dengan KEK/kawasan industri baru. Platform listing kos (Mamikos, Kost.id, Rukita, Indekos) adalah sinyal permintaan real-time — tipe kamar dengan waiting list panjang = spesifikasi yang akan dibangun investor berikutnya.</p>
            <p className="text-[7px] font-mono text-rose-700">Sinyal MJP: Korelasi data PBG perumahan + pertumbuhan mahasiswa PDDikti + listing Mamikos per kota. Referensi:{" "}
              <a href="https://mamikos.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">mamikos.com — Permintaan Kos per Kota</a>{" "}·{" "}
              <a href="https://rukita.co" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">rukita.co — Kos Premium Managed</a>{" "}·{" "}
              <a href="https://www.rumah.com/properti/kost" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">rumah.com/kost — Listing Investasi</a>
            </p>
          </div>
        </div>

        <p className="text-[9px] font-mono text-muted-foreground mt-2">Lima segmen ini — pesantren, sekolah swasta, PTS, perkantoran/ruko, dan kos-kosan — secara agregat mewakili ratusan ribu proyek per tahun di seluruh Indonesia dengan nilai total diperkirakan Rp 150–250 triliun. Tidak satu pun dari mereka muncul di LPSE atau e-procurement manapun. Mereka semua beroperasi melalui jaringan kepercayaan lokal, rekomendasi, dan reputasi. Ini adalah pasar yang hampir tidak tersentuh oleh intelligence platform manapun — dan justru di sinilah BUJK skala menengah paling kompetitif karena tidak bersaing langsung dengan BUMN Konstruksi. MJP's strategic lens: segmen-segmen ini bukan pengganti pasar pemerintah, melainkan <strong>portfolio balancer</strong> — mengisi pipeline di kuartal sepi tender APBN, menjaga utilisasi tim, dan membangun reputasi lokal yang justru membuka pintu ke proyek pemerintah daerah berikutnya.</p>

        <div className="mt-2 pt-2 border-t">
          <p className="text-[8px] font-mono text-muted-foreground mb-1 font-semibold">SUMBER REFERENSI SEGMEN:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            {[
              { label: "Kemenag Pesantren", url: "https://pendis.kemenag.go.id" },
              { label: "BAZNAS", url: "https://baznas.go.id" },
              { label: "BAN S/M Akreditasi", url: "https://bansm.kemdikbud.go.id" },
              { label: "DAPODIK Kemdikbud", url: "https://dapo.kemdikbud.go.id" },
              { label: "BAN-PT", url: "https://www.banpt.or.id" },
              { label: "PDDikti", url: "https://pddikti.kemdikbud.go.id" },
              { label: "OSS / PBG", url: "https://oss.go.id" },
              { label: "SIMBG Kementerian PU", url: "https://simbg.pu.go.id" },
              { label: "Mamikos", url: "https://mamikos.com" },
              { label: "Rukita", url: "https://rukita.co" },
            ].map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[7px] text-primary hover:underline font-mono">
                {s.label} ↗
              </a>
            ))}
          </div>
        </div>
      </div>
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
