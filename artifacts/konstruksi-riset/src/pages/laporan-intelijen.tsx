import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  useGetTrendingTopics,
  useListPainPoints,
  useGetSchedulerRuns,
  useListResearchItems,
  useListCompetitorSignals,
  type ResearchItem,
  type CompetitorSignal,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity, BookOpen, Brain, Building2, ChartBar, ChevronDown,
  ChevronRight, ChevronUp, CircleCheck, Clock, Copy, Database, DollarSign, Download,
  Eye, FileText, Flame, Globe, HardHat, Layers, Lightbulb, ListFilter,
  Loader2, MapPin, MessageSquare, RefreshCw, Scale, Search, Shield, ShieldAlert,
  Sparkles, Star, SlidersHorizontal, Target, TrendingUp, TriangleAlert,
  Users, Zap, FileSpreadsheet, BookmarkPlus, Pencil, Trash2,
} from "lucide-react";
import { exportIntelligenceBriefPDF, type IntelligenceBriefData } from "@/lib/export-pdf";
import { exportIntelligenceBriefExcel, type IntelligenceBriefExcelData } from "@/lib/export-excel";

// ─── Static data for the brief ───────────────────────────────────────────────

interface RegEntry {
  id: string; kode: string; judul: string; instansi: string; domain: string;
  status: "BARU" | "DIUBAH" | "DICABUT" | "AKAN_BERLAKU";
  dampak: "KRITIS" | "TINGGI" | "SEDANG" | "RENDAH";
  tanggal: string; ringkasan: string; deadline?: string;
}

const ALL_REGULASI: RegEntry[] = [
  { id: "r1", kode: "Permen PUPR No. 8/2022", judul: "Sertifikasi BUJK — SBU & SMAP", instansi: "Kementerian PUPR / LPJK", domain: "Konstruksi", status: "DIUBAH", dampak: "KRITIS", tanggal: "2022-05-01", ringkasan: "Memperbarui seluruh skema sertifikasi BUJK termasuk persyaratan SBU, klasifikasi subklasifikasi baru, dan kewajiban SMAP. BUJK yang tidak memperbarui SBU otomatis tidak dapat mengikuti tender pemerintah.", deadline: "Sebelum masa berlaku SBU habis" },
  { id: "r2", kode: "SE LPJK No. 04/2023", judul: "Ketidaksesuaian SMAP — BUJK Wajib Komitmen", instansi: "LPJK", domain: "Konstruksi", status: "BARU", dampak: "KRITIS", tanggal: "2023-06-01", ringkasan: "LPJK menerbitkan daftar BUJK yang belum memenuhi komitmen SMAP SNI ISO 37001:2016. BUJK yang masuk daftar ini berisiko pencabutan SBU dan tidak dapat mengikuti pengadaan.", deadline: "Segera (LPJK dapat mencabut SBU)" },
  { id: "r3", kode: "PP No. 14/2021", judul: "SKK Wajib — Tenaga Kerja Konstruksi", instansi: "Pemerintah / PUPR", domain: "Konstruksi", status: "DIUBAH", dampak: "TINGGI", tanggal: "2021-02-02", ringkasan: "Setiap tenaga kerja konstruksi wajib memiliki SKK. BUJK yang menggunakan tenaga kerja tanpa SKK dapat dikenai sanksi administratif dan gugur dari proses pengadaan.", deadline: "Berlaku sejak 2021 — verifikasi rutin tiap kuartal" },
  { id: "r4", kode: "Permen PUPR No. 10/2021", judul: "SMKK — RKK Wajib di Setiap Tender", instansi: "Kementerian PUPR", domain: "Konstruksi", status: "DIUBAH", dampak: "TINGGI", tanggal: "2021-03-15", ringkasan: "SMKK wajib diterapkan di semua proyek. RKK harus dilampirkan dalam dokumen penawaran tender. Kontraktor tanpa RKK yang valid gugur secara administrasi." },
  { id: "r5", kode: "SE LKPP No. 10/2024", judul: "Penggunaan PDN & TKDN Wajib dalam Pengadaan", instansi: "LKPP", domain: "Tender & Pengadaan", status: "BARU", dampak: "TINGGI", tanggal: "2024-03-01", ringkasan: "LKPP memperkuat kewajiban TKDN dengan ambang batas lebih tinggi. BUJK yang menawarkan produk/material impor tanpa keterangan TKDN dapat digugurkan.", deadline: "Berlaku sejak 2024 — wajib di setiap penawaran" },
  { id: "r6", kode: "Permen PUPR No. 6/2023", judul: "Subklasifikasi SBU Baru 2023", instansi: "PUPR / LPJK", domain: "Konstruksi", status: "BARU", dampak: "KRITIS", tanggal: "2023-04-01", ringkasan: "Penambahan subklasifikasi SBU baru untuk energi terbarukan, infrastruktur digital, dan konstruksi hijau. BUJK yang ingin mengikuti tender di sektor ini harus memperluas subklasifikasi SBU.", deadline: "Sebelum mengikuti tender dengan subklasifikasi baru" },
  { id: "r7", kode: "Perpres No. 12/2021", judul: "Pengadaan Barang/Jasa — E-Tendering & TKDN", instansi: "LKPP / Pemerintah", domain: "Tender & Pengadaan", status: "DIUBAH", dampak: "TINGGI", tanggal: "2021-02-02", ringkasan: "Perubahan mekanisme pengadaan: penambahan e-purchasing, perluasan TKDN, pengaturan pengadaan darurat, klausul baru untuk UMKM. BUJK wajib memahami metode baru agar tidak gugur evaluasi." },
  { id: "r8", kode: "Permen PUPR No. 21/2021", judul: "Bangunan Gedung Hijau (BGH) — Sertifikasi", instansi: "Kementerian PUPR", domain: "Konstruksi", status: "BARU", dampak: "SEDANG", tanggal: "2021-09-01", ringkasan: "Mewajibkan bangunan gedung baru dengan luas tertentu untuk memperoleh sertifikasi BGH. Konsultan perencana wajib memiliki kompetensi green building." },
  { id: "r9", kode: "Permen PUPR No. 9/2023", judul: "BIM Wajib untuk Proyek >Rp 100M", instansi: "Kementerian PUPR", domain: "Konstruksi", status: "BARU", dampak: "SEDANG", tanggal: "2023-09-01", ringkasan: "PUPR mewajibkan BIM untuk proyek konstruksi gedung pemerintah >Rp 100 miliar mulai 2024. BUJK yang ingin menarget proyek pemerintah besar harus mulai investasi BIM.", deadline: "Wajib untuk proyek Gedung Pemerintah >Rp 100M mulai 2024" },
  { id: "r10", kode: "Inpres No. 2/2022 — IKN", judul: "Percepatan Pembangunan IKN", instansi: "Presiden / OIKN", domain: "Tender & Pengadaan", status: "BARU", dampak: "TINGGI", tanggal: "2022-03-15", ringkasan: "Instruksi Presiden membuka peluang tender besar bagi BUJK. Nilai investasi ditargetkan ratusan triliun rupiah. BUJK perlu memahami skema pengadaan khusus IKN." },
  { id: "r11", kode: "Permenaker No. 5/2018 (Update 2023)", judul: "SMK3 Konstruksi — Proyek >Rp 10M", instansi: "Kemnaker / PUPR", domain: "ISO & Sistem Manajemen", status: "DIUBAH", dampak: "TINGGI", tanggal: "2023-04-15", ringkasan: "SMK3 lebih ketat untuk proyek konstruksi >Rp 10 miliar. BUJK wajib Ahli K3 bersertifikat dan RKK sebelum mobilisasi. Denda dan penghentian proyek berlaku untuk pelanggaran.", deadline: "Sebelum mobilisasi setiap proyek >Rp 10M" },
  { id: "r12", kode: "SNI ISO 9001:2015", judul: "Sistem Manajemen Mutu — Persyaratan Tender", instansi: "BSN / KAN", domain: "ISO & Sistem Manajemen", status: "DIUBAH", dampak: "SEDANG", tanggal: "2020-01-01", ringkasan: "Semakin banyak instansi pemerintah mensyaratkan ISO 9001:2015 sebagai persyaratan kualifikasi tender. BUJK tanpa sertifikat dapat kalah dalam evaluasi kualifikasi." },
];

interface CompEntry {
  id: string; nama: string; ukuran: string; hargaRange: string;
  rating: number; ancamanUtama: string; peluangUtama: string;
  segment: string[];
  /** Domains this competitor primarily operates in — used for domain filtering */
  domains: string[];
}

const ALL_KOMPETITOR: CompEntry[] = [
  { id: "c1", nama: "IjinTender.co.id", ukuran: "MENENGAH", hargaRange: "Rp 3.000.000 – Rp 25.000.000", rating: 3, ancamanUtama: "Harga pengurusan SBU/SKK lebih rendah, jaringan luas, reputasi terbentuk", peluangUtama: "Klien yang butuh lebih dari dokumen — upsell advisory, monitoring expiry, analisis tender", segment: ["BUJK Kecil", "BUJK Menengah"], domains: ["Konstruksi", "SKK & Kompetensi"] },
  { id: "c2", nama: "Konsultan SBU via Marketplace", ukuran: "KECIL", hargaRange: "Rp 1.500.000 – Rp 8.000.000", rating: 2, ancamanUtama: "Harga paling murah, mudah ditemukan via Tokopedia/Shopee, segmen price-sensitive", peluangUtama: "Klien kecewa kualitas layanan murah yang butuh upgrade ke advisory berkelanjutan", segment: ["BUJK Kecil"], domains: ["Konstruksi", "SKK & Kompetensi"] },
  { id: "c3", nama: "GAPENSI / Asosiasi Konstruksi", ukuran: "BESAR", hargaRange: "Keanggotaan Rp 2.000.000 – Rp 10.000.000/thn", rating: 3, ancamanUtama: "Jalur SBU lebih mudah via rekomendasi asosiasi, networking dan akses tender eksklusif", peluangUtama: "Anggota yang butuh lebih dari keanggotaan — data riset intelijen + digital platform", segment: ["BUJK Menengah", "BUJK Besar"], domains: ["Konstruksi", "SKK & Kompetensi", "Tender & Pengadaan"] },
  { id: "c4", nama: "Konsultan ISO / Sistem Manajemen Lokal", ukuran: "KECIL", hargaRange: "Rp 15.000.000 – Rp 80.000.000", rating: 3, ancamanUtama: "Spesialisasi mendalam ISO/SMAP, sudah established, jaringan ke CB tertentu", peluangUtama: "Bundling ISO + SBU + tender intelligence. Klien ISO yang kemudian butuh pendampingan tender", segment: ["BUJK Menengah"], domains: ["ISO & Sistem Manajemen"] },
  { id: "c5", nama: "Platform Tender Digital (IndoTender)", ukuran: "MENENGAH", hargaRange: "Rp 500.000 – Rp 3.000.000/bulan", rating: 2, ancamanUtama: "Database tender sangat besar, alert otomatis, habit pengguna setia, harga murah", peluangUtama: "Bundling intelijen tender: filter + analisis kualifikasi + strategi + SBU check", segment: ["Semua BUJK"], domains: ["Tender & Pengadaan"] },
  { id: "c6", nama: "Konsultan Independen LinkedIn/Freelance", ukuran: "KECIL", hargaRange: "Rp 1.000.000 – Rp 10.000.000/project", rating: 2, ancamanUtama: "Biaya lebih murah, hubungan personal, referral dari mulut ke mulut", peluangUtama: "Klien kecewa layanan ad-hoc butuh sistem andal. Freelancer potensial sebagai mitra/reseller", segment: ["BUJK Kecil"], domains: ["Konstruksi", "SKK & Kompetensi", "Tender & Pengadaan"] },
  { id: "c7", nama: "BimaTek / Lembaga Pelatihan SKK", ukuran: "MENENGAH", hargaRange: "Rp 2.000.000 – Rp 12.000.000/peserta", rating: 3, ancamanUtama: "Akreditasi LSP resmi LPJK, pengalaman panjang pelatihan, jaringan perusahaan besar", peluangUtama: "Tenaga ahli baru SKK butuh panduan tender. Kemitraan: BimaTek sertifikasi, kita monitoring", segment: ["Tenaga Ahli", "BUJK"], domains: ["SKK & Kompetensi", "Konstruksi"] },
  { id: "c8", nama: "Platform SaaS Manajemen Proyek (Buildcom)", ukuran: "MENENGAH", hargaRange: "Rp 500.000 – Rp 5.000.000/bulan", rating: 2, ancamanUtama: "UI modern, fitur manajemen proyek komprehensif, integrasi keuangan. Jika masuk compliance = kompetitor serius", peluangUtama: "Bundling: mereka ops, kita compliance + intelijen. BUJK digital-ready lebih mudah adopsi platform baru", segment: ["BUJK Menengah-Besar"], domains: ["Konstruksi", "Tender & Pengadaan"] },
];

interface VOCEntry {
  id: string;
  kategori: "PAIN" | "FEAR" | "DESIRE" | "OBJECTION" | "TRIGGER";
  sumber: string; terjemahan: string; segment: string;
  frekuensi: number; peluangLayanan: string;
  /** Domains this signal relates to — used for domain filtering */
  domains: string[];
}

const ALL_VOC: VOCEntry[] = [
  { id: "v1", kategori: "PAIN", sumber: "Forum Kontraktor / Kaskus", terjemahan: "Kontraktor kehilangan peluang tender karena tidak mengetahui SBU akan habis masa berlakunya", segment: "Kontraktor Kecil-Menengah", frekuensi: 9, peluangLayanan: "Layanan monitor & alert SBU expiry + perpanjangan express", domains: ["Konstruksi"] },
  { id: "v2", kategori: "FEAR", sumber: "Instagram Konstruksi / DM", terjemahan: "BUJK takut dicabut SBU karena tidak comply SMAP tetapi tidak tahu cara implementasi", segment: "BUJK Menengah", frekuensi: 8, peluangLayanan: "Paket SMAP Express: gap analysis + implementasi + sertifikasi", domains: ["Konstruksi", "ISO & Sistem Manajemen"] },
  { id: "v3", kategori: "PAIN", sumber: "LinkedIn Group Konstruksi", terjemahan: "BUJK kehilangan waktu dan biaya karena proses persiapan tender yang tidak efisien", segment: "Kontraktor Menengah", frekuensi: 8, peluangLayanan: "Layanan pendampingan tender end-to-end: admin + teknis + harga", domains: ["Tender & Pengadaan"] },
  { id: "v4", kategori: "DESIRE", sumber: "Diskusi WA Group GAPENSI", terjemahan: "BUJK ingin analisis peluang menang sebelum memutuskan mengikuti tender", segment: "Semua BUJK", frekuensi: 9, peluangLayanan: "Layanan analisis eligibilitas & peluang menang tender berbasis data", domains: ["Tender & Pengadaan"] },
  { id: "v5", kategori: "TRIGGER", sumber: "Email / WhatsApp marketing", terjemahan: "Event tender masuk menjadi trigger kebutuhan SKK yang mendesak", segment: "Kontraktor Kecil", frekuensi: 8, peluangLayanan: "Layanan SKK express 7–14 hari + pendampingan tender simultan", domains: ["SKK & Kompetensi", "Tender & Pengadaan"] },
  { id: "v6", kategori: "FEAR", sumber: "Forum diskusi online", terjemahan: "BUJK takut kehilangan peluang IKN karena tidak memahami persyaratan kualifikasi", segment: "BUJK Menengah", frekuensi: 7, peluangLayanan: "Brief kualifikasi IKN + roadmap peningkatan SBU untuk proyek nasional", domains: ["Tender & Pengadaan"] },
  { id: "v7", kategori: "PAIN", sumber: "Konsultasi langsung klien", terjemahan: "BUJK kehilangan tender berulang kali tanpa memahami penyebab kegagalan", segment: "Kontraktor Aktif Tender", frekuensi: 8, peluangLayanan: "Audit dokumen tender + post-mortem analysis + strategi perbaikan", domains: ["Tender & Pengadaan"] },
  { id: "v8", kategori: "TRIGGER", sumber: "Notifikasi LPJK", terjemahan: "BUJK menerima surat peringatan LPJK sebagai trigger kebutuhan mendesak", segment: "BUJK daftar SMAP LPJK", frekuensi: 9, peluangLayanan: "Layanan SMAP emergency response: 48 jam respons + pendampingan", domains: ["Konstruksi", "ISO & Sistem Manajemen"] },
  { id: "v9", kategori: "PAIN", sumber: "Workshop GAPENSI regional", terjemahan: "BUJK di luar Jawa kesulitan mendapat layanan konsultan SBU/SKK berkualitas di daerahnya", segment: "Kontraktor regional luar Jawa", frekuensi: 8, peluangLayanan: "Layanan remote consulting + e-learning SKK regional dengan modul lokal", domains: ["Konstruksi", "SKK & Kompetensi"] },
  { id: "v10", kategori: "DESIRE", sumber: "Webinar online PUPR konstruksi", terjemahan: "BUJK menginginkan satu platform terpadu untuk monitoring semua kewajiban konstruksi", segment: "Direktur/PJBU aktif tender", frekuensi: 9, peluangLayanan: "Platform compliance dashboard terpadu: SBU, SKK, tender, regulasi", domains: ["Konstruksi", "Tender & Pengadaan"] },
  { id: "v11", kategori: "FEAR", sumber: "Grup Telegram Kontraktor", terjemahan: "BUJK ragu platform digital karena kekhawatiran keamanan data sensitif", segment: "BUJK konservatif semua ukuran", frekuensi: 7, peluangLayanan: "Komunikasi keamanan data: enkripsi E2E, akses terbatas, audit trail + ISO 27001", domains: ["Konstruksi", "Tender & Pengadaan"] },
  { id: "v12", kategori: "PAIN", sumber: "Forum HIPPI / KADIN", terjemahan: "BUJK kewalahan dengan kompleksitas dan durasi implementasi SMAP ISO 37001", segment: "BUJK Menengah-Besar wajib SMAP", frekuensi: 9, peluangLayanan: "Paket SMAP Fast-Track: template dokumen + konsultan on-site + target 90 hari", domains: ["ISO & Sistem Manajemen"] },
  { id: "v13", kategori: "TRIGGER", sumber: "Berita Detik Finance / Kontan", terjemahan: "Kebijakan pemerintah baru menciptakan peluang tender masif di wilayah strategis", segment: "Kontraktor Menengah-Besar regional", frekuensi: 8, peluangLayanan: "Monitoring kebijakan + early alert tender BUMN strategis per wilayah", domains: ["Tender & Pengadaan"] },
  { id: "v14", kategori: "FEAR", sumber: "Group Telegram GAPENSI Jatim", terjemahan: "BUJK takut gugur evaluasi tender karena tidak bisa membuktikan nilai TKDN material", segment: "Kontraktor Menengah", frekuensi: 7, peluangLayanan: "Layanan verifikasi TKDN + penyusunan BOM dengan dokumen pendukung KEMENPERIN", domains: ["Tender & Pengadaan"] },
];

const ALL_HEATMAP = [
  { domain: "SBU & Perizinan", demand: 95, growth: "+12%", topPain: "Expiry tidak terdeteksi" },
  { domain: "SMAP / ISO 37001", demand: 88, growth: "+35%", topPain: "Tidak tahu cara comply" },
  { domain: "Tender & Pengadaan", demand: 82, growth: "+8%", topPain: "Gugur di administrasi" },
  { domain: "SKK Konstruksi", demand: 78, growth: "+22%", topPain: "SKK tidak tersedia saat dibutuhkan" },
  { domain: "Keuangan Konstruksi", demand: 74, growth: "+27%", topPain: "Cash flow negatif akibat keterlambatan bayar" },
  { domain: "Strategi Bid Tender", demand: 72, growth: "+18%", topPain: "Tidak punya data kompetitor" },
  { domain: "Pendampingan IKN", demand: 68, growth: "+85%", topPain: "Tidak memahami syarat kualifikasi IKN" },
  { domain: "Compliance & Audit", demand: 66, growth: "+31%", topPain: "Tidak siap menghadapi audit BPK/BPKP" },
  { domain: "ISO 9001 / 14001", demand: 60, growth: "+5%", topPain: "Biaya implementasi mahal" },
  { domain: "SMK3 / K3 Konstruksi", demand: 55, growth: "+10%", topPain: "SOP K3 tidak memenuhi standar" },
  { domain: "Digital Transformation", demand: 51, growth: "+42%", topPain: "Tidak tahu tools digital yang tepat" },
  { domain: "TKDN & PDN", demand: 44, growth: "+40%", topPain: "Tidak tahu cara verifikasi TKDN dengan benar" },
  { domain: "Pendampingan BUJK Regional", demand: 45, growth: "+58%", topPain: "Tidak ada konsultan berkualitas di daerah" },
  { domain: "BIM & Digitalisasi Proyek", demand: 39, growth: "+73%", topPain: "Tidak ada SDM BIM + biaya software mahal" },
];

interface TriggerEntry {
  trigger: string; urgency: string; channel: string;
  /** Domains this trigger relates to — used for domain filtering */
  domains: string[];
}

const ALL_TRIGGERS: TriggerEntry[] = [
  { trigger: "SBU hampir expired", urgency: "KRITIS", channel: "Direct outreach + WhatsApp", domains: ["Konstruksi"] },
  { trigger: "Masuk daftar SMAP non-comply LPJK", urgency: "KRITIS", channel: "Email + telepon", domains: ["Konstruksi", "ISO & Sistem Manajemen"] },
  { trigger: "Dapat surat peringatan dari LPJK/kementerian", urgency: "KRITIS", channel: "Emergency response offer", domains: ["Konstruksi", "ISO & Sistem Manajemen"] },
  { trigger: "Material proyek belum diverifikasi TKDN", urgency: "KRITIS", channel: "TKDN verifikasi express + konsultasi darurat", domains: ["Tender & Pengadaan"] },
  { trigger: "Proyek berhenti karena cashflow macet", urgency: "KRITIS", channel: "Emergency financing consultation", domains: ["Konstruksi", "Tender & Pengadaan"] },
  { trigger: "Gagal tender karena SKK kurang", urgency: "TINGGI", channel: "Follow-up post-failure", domains: ["SKK & Kompetensi", "Tender & Pengadaan"] },
  { trigger: "Ada peluang tender besar masuk (IKN, BUMN)", urgency: "TINGGI", channel: "LPSE alert + konten edukatif", domains: ["Tender & Pengadaan"] },
  { trigger: "Kalah tender 2–3 kali berturut", urgency: "TINGGI", channel: "Audit offer + testimonial", domains: ["Tender & Pengadaan"] },
  { trigger: "Perpres/Permen konstruksi baru terbit", urgency: "TINGGI", channel: "Email regulasi alert + webinar", domains: ["Konstruksi", "Tender & Pengadaan"] },
  { trigger: "Tender IKN batch baru diumumkan", urgency: "TINGGI", channel: "IKN readiness briefing + eligibility check", domains: ["Tender & Pengadaan"] },
  { trigger: "SBU diperpanjang tapi SKK pendukung tidak updated", urgency: "TINGGI", channel: "Cross-sell SKK update setelah handle SBU", domains: ["Konstruksi", "SKK & Kompetensi"] },
  { trigger: "Proyek >Rp 100M wajib pakai BIM", urgency: "TINGGI", channel: "Workshop BIM + pendampingan implementasi", domains: ["Konstruksi"] },
  { trigger: "Naik grade ke BUJK Menengah/Besar", urgency: "SEDANG", channel: "Upgrade journey content", domains: ["Konstruksi"] },
  { trigger: "Perusahaan baru berdiri (butuh SBU pertama)", urgency: "SEDANG", channel: "SEO + marketplace + referral", domains: ["Konstruksi"] },
  { trigger: "Direktur baru / pergantian manajemen BUJK", urgency: "SEDANG", channel: "Fresh audit offer + re-engagement", domains: ["Konstruksi", "Tender & Pengadaan"] },
];

// ─── Config types ─────────────────────────────────────────────────────────────

const DOMAIN_OPTIONS = ["Semua Domain", "Konstruksi", "Tender & Pengadaan", "ISO & Sistem Manajemen", "SKK & Kompetensi", "Ketenagalistrikan & EBT"];
// Period options use year-based ranges that align with the static regulation database (2020–2024).
const PERIODE_OPTIONS = [
  { label: "Terbaru (2024–2026)", value: "2024", fromYear: 2024, toYear: 2026 },
  { label: "2 Tahun (2023–2026)", value: "2023", fromYear: 2023, toYear: 2026 },
  { label: "3 Tahun (2022–2026)", value: "2022", fromYear: 2022, toYear: 2026 },
  { label: "5 Tahun (2021–2026)", value: "2021", fromYear: 2021, toYear: 2026 },
  { label: "Semua waktu", value: "semua", fromYear: 0, toYear: 9999 },
];
const CATEGORY_OPTIONS = ["Regulasi", "Kompetitor", "Pasar"] as const;
const BRIEF_PRESETS_STORAGE_KEY = "mkp-laporan-brief-presets";

interface BriefPreset {
  id: string;
  name: string;
  periode: string;
  domain: string;
  categories: string[];
}

function readBriefPresets(): BriefPreset[] {
  try {
    const stored = JSON.parse(localStorage.getItem(BRIEF_PRESETS_STORAGE_KEY) ?? "null");
    if (!Array.isArray(stored)) return [];
    return stored.filter((preset): preset is BriefPreset =>
      preset &&
      typeof preset.id === "string" &&
      typeof preset.name === "string" &&
      preset.name.trim().length > 0 &&
      typeof preset.periode === "string" &&
      PERIODE_OPTIONS.some(option => option.value === preset.periode) &&
      typeof preset.domain === "string" &&
      DOMAIN_OPTIONS.includes(preset.domain) &&
      Array.isArray(preset.categories) &&
      preset.categories.length > 0 &&
      preset.categories.every((category: unknown) => typeof category === "string" && CATEGORY_OPTIONS.includes(category as typeof CATEGORY_OPTIONS[number])),
    );
  } catch {
    return [];
  }
}

const IMPACT_COLORS: Record<string, string> = {
  KRITIS: "bg-red-100 text-red-700 border-red-300",
  TINGGI: "bg-orange-100 text-orange-700 border-orange-300",
  SEDANG: "bg-yellow-100 text-yellow-700 border-yellow-300",
  RENDAH: "bg-slate-100 text-slate-600 border-slate-300",
};
const STATUS_COLORS: Record<string, string> = {
  BARU: "bg-emerald-100 text-emerald-700 border-emerald-300",
  DIUBAH: "bg-blue-100 text-blue-700 border-blue-300",
  DICABUT: "bg-red-100 text-red-700 border-red-300",
  AKAN_BERLAKU: "bg-violet-100 text-violet-700 border-violet-300",
};
const URGENCY_COLORS: Record<string, string> = {
  KRITIS: "bg-red-100 text-red-700",
  TINGGI: "bg-orange-100 text-orange-700",
  SEDANG: "bg-yellow-100 text-yellow-700",
};
const VOC_COLORS: Record<string, string> = {
  PAIN: "bg-red-100 text-red-700 border-red-300",
  FEAR: "bg-orange-100 text-orange-700 border-orange-300",
  DESIRE: "bg-green-100 text-green-700 border-green-300",
  OBJECTION: "bg-blue-100 text-blue-700 border-blue-300",
  TRIGGER: "bg-yellow-100 text-yellow-700 border-yellow-300",
};

/** Filter a regulation by its publication year against the chosen year-range period. */
function filterByPeriode(tanggal: string, periodeValue: string): boolean {
  const opt = PERIODE_OPTIONS.find(p => p.value === periodeValue);
  if (!opt) return true;
  const year = new Date(tanggal).getFullYear();
  return year >= opt.fromYear && year <= opt.toYear;
}

/** Filter any item that carries a `domains` array against the selected domain. */
function matchesDomain(itemDomains: string[], selectedDomain: string): boolean {
  if (selectedDomain === "Semua Domain") return true;
  return itemDomains.includes(selectedDomain);
}

function getPeriodeLabel(v: string) {
  return PERIODE_OPTIONS.find(p => p.value === v)?.label ?? v;
}

function formatNow() {
  const now = new Date();
  return now.toLocaleString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LaporanIntelijen() {
  const [periode, setPeriode] = useState("semua");
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => { document.title = "Laporan Intelijen — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [domain, setDomain] = useState("Semua Domain");
  const [categories, setCategories] = useState<Set<string>>(new Set(["Regulasi", "Kompetitor", "Pasar"]));
  const [generated, setGenerated] = useState(() => !!localStorage.getItem("mkp-laporan-generatedAt"));
  const [generatedAt, setGeneratedAt] = useState(() => localStorage.getItem("mkp-laporan-generatedAt") ?? "");
  const [briefPresets, setBriefPresets] = useState<BriefPreset[]>(readBriefPresets);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [regMax, setRegMax] = useState(6);
  const [compMax, setCompMax] = useState(4);
  const [vocMax, setVocMax] = useState(6);
  const [heatMax, setHeatMax] = useState(8);
  const [trigMax, setTrigMax] = useState(8);
  const [isRefreshingBrief, setIsRefreshingBrief] = useState(false);

  // ── Live data from DB — primary source, with curated static fallback ─────────
  // Keep the full core-research feed here: regulation and competitor signals are
  // classified locally because the existing endpoints intentionally expose a
  // broad, shared research contract.
  const {
    data: liveTrends,
    isLoading: isLoadingTrends,
    isError: isTrendsError,
    refetch: refetchTrends,
  } = useGetTrendingTopics({ limit: 50 });
  const {
    data: livePainPoints,
    isLoading: isLoadingPainPoints,
    isError: isPainPointsError,
    refetch: refetchPainPoints,
  } = useListPainPoints({});
  const {
    data: liveResearchItems,
    isLoading: isLoadingResearchItems,
    isError: isResearchItemsError,
    refetch: refetchResearchItems,
  } = useListResearchItems({ limit: 100 });
  const {
    data: liveCompetitorSignals,
    isLoading: isLoadingCompetitorSignals,
    isError: isCompetitorSignalsError,
    refetch: refetchCompetitorSignals,
  } = useListCompetitorSignals({ limit: 100 });

  const hasLiveData = (
    (liveTrends?.length ?? 0) > 0 ||
    (livePainPoints?.length ?? 0) > 0 ||
    (liveResearchItems?.length ?? 0) > 0 ||
    (liveCompetitorSignals?.length ?? 0) > 0
  );
  const isLoadingLiveData = isLoadingTrends || isLoadingPainPoints || isLoadingResearchItems || isLoadingCompetitorSignals;
  const liveDataHasError = isTrendsError || isPainPointsError || isResearchItemsError || isCompetitorSignalsError;
  const briefDataReady = !isLoadingLiveData && !isRefreshingBrief && !liveDataHasError;

  const REGULATION_CATEGORY_MARKERS = ["REGULASI", "REGULATION", "REGULATORY", "KEBIJAKAN", "COMPLIANCE", "PERATURAN"];
  const REGULATION_TITLE_KEYWORDS = [
    "permen", "perpres", "peraturan pemerintah", "pp no", "kepmen", "se lpjk",
    "inpres", "regulasi", "peraturan", "kebijakan", "undang-undang", "uu ",
    "perda", "permen pupr", "sni iso", "keppres", "permenaker",
  ];
  const JUNK_RESEARCH_KEYWORDS = ["slot", "casino", "poker", "togel", "judi", "bet ", "gacor", "4d", "3d", "2d", "pragmatic", "maxwin", "porn", "sex", "xxx"];

  function isLiveRegulation(item: ResearchItem): boolean {
    const title = (item.title ?? "").toLowerCase();
    const summary = (item.summary ?? "").toLowerCase();
    const category = (item.category ?? "").toUpperCase();
    if (JUNK_RESEARCH_KEYWORDS.some(keyword => title.includes(keyword) || summary.includes(keyword))) return false;
    const knownRegulationCategory = REGULATION_CATEGORY_MARKERS.some(marker => category.includes(marker));
    if (knownRegulationCategory) return true;
    const ambiguousCoreCategory = ["LEGALITAS_PERIJINAN", "SBU", "SKK"].includes(category);
    const matchesKeyword = REGULATION_TITLE_KEYWORDS.some(keyword => title.includes(keyword) || summary.includes(keyword));
    return ambiguousCoreCategory && matchesKeyword;
  }

  function mapResearchItemToRegulation(item: ResearchItem): RegEntry {
    const title = item.title.trim();
    const content = item.summary?.trim() || title;
    const normalized = `${title} ${content}`.toLowerCase();
    const category = item.category.toUpperCase();
    const domain = category.includes("TENDER") || /tender|pengadaan|tkdn|ikn/.test(normalized)
      ? "Tender & Pengadaan"
      : category.includes("SKK") || /skk|kompetensi/.test(normalized)
        ? "SKK & Kompetensi"
        : category.includes("SBU") || /sbu|smap|sertifikasi bujk|perizinan/.test(normalized)
          ? "Konstruksi"
          : /iso|smk3|k3|compliance|audit/.test(normalized)
            ? "ISO & Sistem Manajemen"
            : "Konstruksi";
    const status: RegEntry["status"] = /\b(dicabut|tidak berlaku|pencabutan)\b/.test(normalized)
      ? "DICABUT"
      : /\b(akan berlaku|segera berlaku)\b/.test(normalized)
        ? "AKAN_BERLAKU"
        : /\b(diubah|perubahan|revisi|amandemen|update)\b/.test(normalized)
          ? "DIUBAH"
          : "BARU";
    const priority = (item.priority ?? "").toUpperCase();
    const dampak: RegEntry["dampak"] = /KRITIS|CRITICAL|URGENT/.test(priority)
      ? "KRITIS"
      : /TINGGI|HIGH/.test(priority)
        ? "TINGGI"
        : /RENDAH|LOW/.test(priority)
          ? "RENDAH"
          : "SEDANG";
    return {
      id: `live-reg-${item.id}`,
      kode: title,
      judul: title,
      instansi: item.source || "Sumber riset live",
      domain,
      status,
      dampak,
      tanggal: item.collectedAt || item.createdAt,
      ringkasan: content,
      deadline: undefined,
    };
  }

  const liveRegulasi = useMemo(() => {
    return (liveResearchItems ?? [])
      .filter(isLiveRegulation)
      .map(mapResearchItemToRegulation);
  }, [liveResearchItems]);

  function getSignalDomains(signal: CompetitorSignal): string[] {
    const text = `${signal.title} ${signal.summary ?? ""} ${signal.category}`.toLowerCase();
    const domains: string[] = [];
    if (/sbu|smap|bujk|perizinan|sertifikat/.test(text)) domains.push("Konstruksi");
    if (/skk|kompetensi|tenaga ahli/.test(text)) domains.push("SKK & Kompetensi");
    if (/tender|pengadaan|lpse|tkdn|ikn/.test(text)) domains.push("Tender & Pengadaan");
    if (/iso|smk3|k3|compliance/.test(text)) domains.push("ISO & Sistem Manajemen");
    return domains.length > 0 ? domains : ["Konstruksi"];
  }

  const liveKompetitor = useMemo(() => {
    const grouped = new Map<string, CompetitorSignal[]>();
    for (const signal of liveCompetitorSignals ?? []) {
      const sourceName = signal.dataSourceSite || signal.source || "Sinyal kompetitor live";
      const sourceLabel = sourceName.replace(/^www\./, "");
      grouped.set(sourceLabel, [...(grouped.get(sourceLabel) ?? []), signal]);
    }
    return Array.from(grouped.entries()).map(([sourceLabel, signals]): CompEntry => {
      const priceMentions = signals.flatMap(signal => {
        const text = `${signal.title} ${signal.summary ?? ""}`;
        return text.match(/Rp\s?[\d.,]+(?:\s?(?:ribu|juta|miliar|jt|rb))?/gi) ?? [];
      });
      const uniquePrices = Array.from(new Set(priceMentions)).slice(0, 3);
      const latest = signals[0];
      const summaries = signals
        .map(signal => signal.summary?.trim() || signal.title.trim())
        .filter(Boolean)
        .slice(0, 3);
      return {
        id: `live-comp-${latest.id}`,
        nama: sourceLabel,
        ukuran: "MENENGAH",
        hargaRange: uniquePrices.length > 0
          ? uniquePrices.join(" – ")
          : `${signals.length} sinyal layanan/harga live`,
        rating: signals.some(signal => signal.category.toUpperCase().includes("PRICING")) ? 3 : 2,
        ancamanUtama: summaries.join(" · "),
        peluangUtama: `Pantau ${signals.length} sinyal terbaru${latest.collectedAt ? ` · ${new Date(latest.collectedAt).toLocaleDateString("id-ID")}` : ""}`,
        segment: ["Data live"],
        domains: Array.from(new Set(signals.flatMap(getSignalDomains))),
      };
    });
  }, [liveCompetitorSignals]);

  function normalizeBriefDomain(rawDomain: string | null | undefined): string {
    const normalized = (rawDomain ?? "").trim().toUpperCase();
    const mapping: Record<string, string> = {
      TENDER: "Tender & Pengadaan",
      SBU: "Konstruksi",
      OSS: "Konstruksi",
      LEGAL: "Konstruksi",
      LEGALITAS_PERIJINAN: "Konstruksi",
      REGULASI: "Konstruksi",
      SKK: "SKK & Kompetensi",
      "SDM/TENAGA AHLI": "SKK & Kompetensi",
      ISO: "ISO & Sistem Manajemen",
      SMK3: "ISO & Sistem Manajemen",
      PROYEK: "Konstruksi",
      "DIGITAL/BIM": "Konstruksi",
      DIGITALISASI: "Konstruksi",
      DOKUMEN: "Konstruksi",
      ESTIMASI: "Tender & Pengadaan",
      KEUANGAN: "Konstruksi",
      SDM: "SKK & Kompetensi",
      KNOWLEDGE: "Konstruksi",
      MARKETING: "Konstruksi",
    };
    return mapping[normalized] ?? "Konstruksi";
  }

  // Map live pain points → VOC-style signals. Static VOC is retained only as a
  // fallback when the database has no pain-point rows for the selected domain.
  const liveVOC = useMemo((): VOCEntry[] => {
    if (!livePainPoints?.length) return [];
    // Group by domain + category to synthesise frequency signals
    const grouped = new Map<string, { count: number; description: string; domain: string; category: string; opportunity: string }>();
    for (const pp of livePainPoints) {
      const normalizedDomain = normalizeBriefDomain(pp.domain);
      const key = `${normalizedDomain}::${pp.category ?? "PAIN"}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count++;
      } else {
        grouped.set(key, {
          count: 1,
          description: pp.description,
          domain: normalizedDomain,
          category: pp.category ?? "PAIN",
          opportunity: pp.serviceOpportunity ?? "",
        });
      }
    }
    let liveIdx = 0;
    return Array.from(grouped.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((g) => ({
        id: `live-v${liveIdx++}`,
        kategori: (["PAIN", "FEAR", "DESIRE", "OBJECTION", "TRIGGER"].includes(g.category)
          ? g.category
          : "PAIN") as VOCEntry["kategori"],
        sumber: "Database Riset Internal (Live)",
        terjemahan: g.description.length > 100 ? g.description.substring(0, 100) + "…" : g.description,
        segment: g.domain,
        frekuensi: Math.min(9, g.count),
        peluangLayanan: g.opportunity || "—",
        domains: [g.domain],
      }));
  }, [livePainPoints]);

  const liveTriggers = useMemo((): TriggerEntry[] => {
    if (!livePainPoints?.length) return [];
    const urgencyOrder: Record<string, number> = { KRITIS: 0, TINGGI: 1, SEDANG: 2 };
    const seen = new Set<string>();
    return livePainPoints
      .map((painPoint): TriggerEntry => {
        const priority = (painPoint.priority ?? "").toUpperCase();
        const urgency = /CRITICAL|KRITIS|URGENT/.test(priority)
          ? "KRITIS"
          : /HIGH|TINGGI/.test(priority)
            ? "TINGGI"
            : "SEDANG";
        return {
          trigger: painPoint.description,
          urgency,
          channel: painPoint.serviceOpportunity?.trim() || painPoint.productIdea?.trim() || "Tindak lanjut melalui tim advisory",
          domains: [normalizeBriefDomain(painPoint.domain)],
        };
      })
      .filter(trigger => {
        const key = `${trigger.domains[0]}::${trigger.trigger.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3))
      .slice(0, 20);
  }, [livePainPoints]);

  // Map live trends → heatmap signals to augment static heatmap
  const liveHeatmap = useMemo(() => {
    if (!liveTrends?.length) return [];
    return liveTrends
      .filter((t) => t.count > 0)
      .slice(0, 8)
      .map((t) => ({
        domain: t.topic,
        demand: Math.min(99, Math.round(Math.log2(t.count + 1) * 20)),
        growth: t.trend === "UP" ? "+↑" : t.trend === "DOWN" ? "-↓" : "→",
        topPain: `${t.count} sinyal aktif · ${t.category}`,
        isLive: true,
      }));
  }, [liveTrends]);

  function toggleCategory(cat: string) {
    setCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  function persistBriefPresets(next: BriefPreset[]) {
    setBriefPresets(next);
    try {
      localStorage.setItem(BRIEF_PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      toast.error("Preset tidak dapat disimpan di perangkat ini");
    }
  }

  function createPresetId() {
    return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `brief-preset-${Date.now()}`;
  }

  function handleSavePreset() {
    if (categories.size === 0) {
      toast.error("Pilih minimal 1 kategori sebelum menyimpan preset");
      return;
    }
    const defaultName = `${domain === "Semua Domain" ? "Semua domain" : domain} · ${getPeriodeLabel(periode)}`;
    const name = window.prompt("Nama preset brief", defaultName)?.trim();
    if (!name) return;
    if (briefPresets.some(preset => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      toast.error("Nama preset sudah digunakan");
      return;
    }

    const preset: BriefPreset = {
      id: createPresetId(),
      name,
      periode,
      domain,
      categories: Array.from(categories),
    };
    persistBriefPresets([...briefPresets, preset]);
    setActivePresetId(preset.id);
    toast.success(`Preset "${name}" berhasil disimpan`);
  }

  function handleApplyPreset(preset: BriefPreset) {
    setPeriode(preset.periode);
    setDomain(preset.domain);
    setCategories(new Set(preset.categories));
    setActivePresetId(preset.id);
    toast.success(`Preset "${preset.name}" diterapkan`);
  }

  function handleRenamePreset(preset: BriefPreset) {
    const name = window.prompt("Nama baru untuk preset", preset.name)?.trim();
    if (!name || name === preset.name) return;
    if (briefPresets.some(item => item.id !== preset.id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      toast.error("Nama preset sudah digunakan");
      return;
    }
    persistBriefPresets(briefPresets.map(item => item.id === preset.id ? { ...item, name } : item));
    toast.success(`Preset diubah menjadi "${name}"`);
  }

  function handleDeletePreset(preset: BriefPreset) {
    if (!window.confirm(`Hapus preset "${preset.name}"?`)) return;
    persistBriefPresets(briefPresets.filter(item => item.id !== preset.id));
    if (activePresetId === preset.id) setActivePresetId(null);
    toast.success(`Preset "${preset.name}" dihapus`);
  }

  // Domain → heatmap keyword mapping (heatmap uses market labels, not regulatory domain names)
  const DOMAIN_HEATMAP_KEYWORDS: Record<string, string[]> = {
    "Konstruksi": ["sbu", "smap", "skk", "smk3", "k3", "bim"],
    "Tender & Pengadaan": ["tender", "bid", "tkdn", "ikn", "pengadaan"],
    "ISO & Sistem Manajemen": ["iso", "smap", "smk3", "compliance", "audit"],
    "SKK & Kompetensi": ["skk", "bim", "digital"],
    "Ketenagalistrikan & EBT": ["digital", "bim"],
  };

  // Compute brief data from config
  const briefRegulasi = useMemo(() => {
    const impactOrder: Record<string, number> = { KRITIS: 0, TINGGI: 1, SEDANG: 2, RENDAH: 3 };
    const filterRegulasi = (entries: RegEntry[]) => entries.filter(r => {
      const matchDomain = domain === "Semua Domain" || r.domain === domain;
      const matchPeriode = filterByPeriode(r.tanggal, periode);
      return matchDomain && matchPeriode;
    });
    const liveFiltered = filterRegulasi(liveRegulasi);
    const source = liveFiltered.length > 0 ? liveFiltered : filterRegulasi(ALL_REGULASI);
    return source.sort((a, b) => (impactOrder[a.dampak] ?? 4) - (impactOrder[b.dampak] ?? 4));
  }, [domain, periode, liveRegulasi]);

  const briefKompetitor = useMemo(() => {
    const liveFiltered = liveKompetitor.filter(c => matchesDomain(c.domains, domain));
    return liveFiltered.length > 0
      ? liveFiltered
      : ALL_KOMPETITOR.filter(c => matchesDomain(c.domains, domain));
  }, [domain, liveKompetitor]);

  const briefVOC = useMemo(() => {
    const staticFiltered = ALL_VOC
      .filter(v => matchesDomain(v.domains, domain))
      .sort((a, b) => b.frekuensi - a.frekuensi);
    const liveDomainFiltered = domain === "Semua Domain"
      ? liveVOC
      : liveVOC.filter(v => matchesDomain(v.domains, domain));
    return liveDomainFiltered.length > 0 ? liveDomainFiltered : staticFiltered;
  }, [domain, liveVOC]);

  const briefHeatmap = useMemo(() => {
    if (liveHeatmap.length > 0) {
      const liveFiltered = domain === "Semua Domain"
        ? liveHeatmap
        : liveHeatmap.filter(h => {
          const keywords = DOMAIN_HEATMAP_KEYWORDS[domain] ?? [];
          return keywords.some(keyword => h.domain.toLowerCase().includes(keyword));
        });
      if (liveFiltered.length > 0) return liveFiltered;
    }
    const sorted = [...ALL_HEATMAP].sort((a, b) => b.demand - a.demand);
    if (domain === "Semua Domain") return sorted;
    const keywords = DOMAIN_HEATMAP_KEYWORDS[domain] ?? [];
    if (keywords.length === 0) return sorted;
    return sorted.filter(h =>
      keywords.some(kw => h.domain.toLowerCase().includes(kw))
    );
  }, [domain, liveHeatmap]);

  const briefTriggers = useMemo(() => {
    const urgencyOrder: Record<string, number> = { KRITIS: 0, TINGGI: 1, SEDANG: 2 };
    const liveFiltered = liveTriggers.filter(trigger => matchesDomain(trigger.domains, domain));
    const source = liveFiltered.length > 0
      ? liveFiltered
      : ALL_TRIGGERS.filter(trigger => matchesDomain(trigger.domains, domain));
    return source
      .sort((a, b) => (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3));
  }, [domain, liveTriggers]);

  const usingLiveRegulasi = briefRegulasi.some(item => item.id.startsWith("live-reg-"));
  const usingLiveKompetitor = briefKompetitor.some(item => item.id.startsWith("live-comp-"));
  const usingLiveVOC = briefVOC.some(item => item.id.startsWith("live-v"));
  const usingLiveHeatmap = briefHeatmap.some(item => "isLive" in item && item.isLive === true);
  const usingLiveTriggers = liveTriggers.some(liveTrigger =>
    briefTriggers.some(briefTrigger =>
      briefTrigger.trigger === liveTrigger.trigger && briefTrigger.domains[0] === liveTrigger.domains[0]
    )
  );
  const isBriefFullyLive = categories.size > 0
    && (!categories.has("Regulasi") || usingLiveRegulasi)
    && (!categories.has("Kompetitor") || usingLiveKompetitor)
    && (!categories.has("Pasar") || (usingLiveVOC && usingLiveHeatmap && usingLiveTriggers));
  const hasSelectedFallback = categories.size > 0 && !isBriefFullyLive;
  const briefProvenance = isBriefFullyLive
    ? "Sumber: LIVE DATABASE"
    : hasLiveData
      ? "Sumber: CAMPURAN LIVE DATABASE + FALLBACK KURASI"
      : "Sumber: FALLBACK KURASI (DATABASE BELUM BERISI DATA RELEVAN)";

  async function handleGenerate() {
    if (isLoadingLiveData || isRefreshingBrief) {
      toast.error("Tunggu hingga data live selesai dimuat");
      return;
    }
    setIsRefreshingBrief(true);
    try {
      const results = await Promise.all([
        refetchTrends(),
        refetchPainPoints(),
        refetchResearchItems(),
        refetchCompetitorSignals(),
      ]);
      if (results.some(result => result.isError)) {
        toast.error("Data live belum dapat diperbarui. Brief tidak digenerate agar tidak memakai data lama.");
        return;
      }
      const ts = formatNow();
      setGenerated(true);
      setGeneratedAt(ts);
      localStorage.setItem("mkp-laporan-generatedAt", ts);
      setRegMax(6);
      setCompMax(4);
      setVocMax(6);
      setHeatMax(8);
      setTrigMax(8);
      toast.success("Brief berhasil digenerate", {
        description: isBriefFullyLive
          ? "Semua kategori terpilih memakai data live."
          : "Sebagian kategori memakai fallback kurasi; lihat label sumber di tiap bagian.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui data live");
    } finally {
      setIsRefreshingBrief(false);
    }
  }

  function buildBriefData(): IntelligenceBriefData & IntelligenceBriefExcelData {
    if (!briefDataReady) {
      throw new Error("Data live belum siap. Tunggu hingga sinkronisasi database selesai.");
    }
    return {
      periode: getPeriodeLabel(periode),
      domain,
      categories: Array.from(categories),
      generatedAt: `${generatedAt} · ${briefProvenance}`,
      regulasi: categories.has("Regulasi") ? briefRegulasi.map(r => ({
        kode: r.kode, judul: r.judul, instansi: r.instansi,
        dampak: r.dampak, status: r.status, ringkasan: r.ringkasan, deadline: r.deadline,
      })) : [],
      kompetitor: categories.has("Kompetitor") ? briefKompetitor.map(c => ({
        nama: c.nama, ukuran: c.ukuran, hargaRange: c.hargaRange,
        rating: c.rating, ancamanUtama: c.ancamanUtama, peluangUtama: c.peluangUtama,
      })) : [],
      vocSignals: categories.has("Pasar") ? briefVOC.map(v => ({
        kategori: v.kategori, segment: v.segment, frekuensi: v.frekuensi,
        terjemahan: v.terjemahan, peluangLayanan: v.peluangLayanan, sumber: v.sumber,
      })) : [],
      heatmap: categories.has("Pasar") ? briefHeatmap : [],
      buyingTriggers: categories.has("Pasar") ? briefTriggers : [],
    };
  }

  function handleExportPDF() {
    setPdfExporting(true);
    setTimeout(() => {
      try { exportIntelligenceBriefPDF(buildBriefData()); }
      catch (err) { toast.error(err instanceof Error ? err.message : "Gagal export PDF — coba lagi"); }
      finally { setPdfExporting(false); }
    }, 0);
  }

  function handleExportExcel() {
    try {
      const data = buildBriefData();
      exportIntelligenceBriefExcel(data);
      setExportedExcel(true);
      setTimeout(() => setExportedExcel(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal export Excel — coba lagi");
    }
  }

  function handleShareWhatsApp() {
    if (!briefDataReady) {
      toast.error("Data live belum siap. Tunggu sinkronisasi sebelum membagikan brief.");
      return;
    }
    const txt = `📊 *BRIEFING INTELIJEN KONSTRUKSI*\n\nLaporan intel telah digenerate pada ${generatedAt}.\n${briefProvenance}.\nCek platform Intel-Konstruksi untuk detail lengkap.\n\n_PT Maheswara Jaya Persada — Platform Riset Marketing Konstruksi_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  }

  const statsRegKritis = briefRegulasi.filter(r => r.dampak === "KRITIS").length;
  const statsVocHigh = briefVOC.filter(v => v.frekuensi >= 8).length;
  const statsTriggersKritis = briefTriggers.filter(t => t.urgency === "KRITIS").length;
  const statsHeatTop = briefHeatmap[0]?.domain ?? "—";

  const { data: schedulerRuns } = useGetSchedulerRuns();
  const [runsDesc, setRunsDesc] = useState(true);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [exportedExcel, setExportedExcel] = useState(false);
  const sentCount = (schedulerRuns ?? []).filter(r =>
    r.notificationResult && (r.notificationResult as { sent?: number }).sent != null
  ).length;
  const tertundaCount = (schedulerRuns ?? []).filter(r =>
    !r.notificationResult || (r.notificationResult as { sent?: number }).sent == null
  ).length;
  const sortedRuns = useMemo(() => {
    const runs = [...(schedulerRuns ?? [])].sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return runsDesc ? runs : runs.reverse();
  }, [schedulerRuns, runsDesc]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-mono font-bold text-base uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Laporan Intelijen — Intelligence Brief
            {isBriefFullyLive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
                </span>
                LIVE
              </span>
            )}
            {!isLoadingLiveData && !liveDataHasError && hasSelectedFallback && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
                <Database className="h-3 w-3" />
                {hasLiveData ? "CAMPURAN" : "FALLBACK"}
              </span>
            )}
            {isLoadingLiveData && !hasLiveData && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                <Loader2 className="h-3 w-3 animate-spin" />
                MEMUAT DB
              </span>
            )}
            {liveDataHasError && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider">
                <TriangleAlert className="h-3 w-3" />
                DB TIDAK TERSEDIA
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            Gabungkan Regulasi · Kompetitor · Sinyal Pasar menjadi 1 brief yang bisa diexport
            {isBriefFullyLive
              ? " · Semua kategori memakai data DB live"
              : hasSelectedFallback
                ? " · Sebagian kategori memakai fallback kurasi"
                : ""}
            {sentCount > 0 && (
              <span className="ml-2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {sentCount} briefing terkirim
              </span>
            )}
            {tertundaCount > 0 && (
              <span className="ml-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                {tertundaCount} tertunda
              </span>
            )}
            {(schedulerRuns ?? []).length > 1 && (
              <button
                onClick={() => setRunsDesc(v => !v)}
                aria-pressed={runsDesc}
                className="ml-2 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
                title="Urutan riwayat run"
                aria-label={runsDesc ? "Tampilkan riwayat terlama dulu" : "Tampilkan riwayat terbaru dulu"}
              >
                {runsDesc ? "↓ Terbaru" : "↑ Terlama"}
              </button>
            )}
          </p>
        </div>
        {generated && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={!briefDataReady} title="Ekspor laporan intelijen ke Excel" className="gap-1.5 text-xs font-mono h-8">
              {exportedExcel ? <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
              {exportedExcel ? "✓ Tersimpan" : "Export Excel"}
            </Button>
            <Button size="sm" onClick={handleExportPDF} disabled={pdfExporting || !briefDataReady} title="Ekspor laporan intelijen ke PDF" className="gap-1.5 text-xs font-mono h-8">
              <FileText className="h-3.5 w-3.5" />
              {pdfExporting ? "Mengekspor…" : "Export PDF"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!briefDataReady}
              className="gap-1.5 text-xs font-mono h-8 border-green-400 text-green-700 hover:bg-green-50"
              onClick={handleShareWhatsApp}
            >
              <MessageSquare className="h-3.5 w-3.5 text-green-600" />
              Bagikan WA
            </Button>
          </div>
        )}
      </div>

      {/* Scheduler Run History */}
      {schedulerRuns === undefined && (
        <div className="border rounded-sm p-6 bg-card flex items-center justify-center gap-2 text-muted-foreground text-xs font-mono">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat crawl…
        </div>
      )}
      {schedulerRuns !== undefined && (schedulerRuns ?? []).length === 0 && (
        <div className="border rounded-sm p-6 bg-card flex flex-col items-center justify-center gap-2 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-mono text-muted-foreground font-semibold">Belum ada riwayat crawl</p>
          <p className="text-xs text-muted-foreground/70 max-w-xs">Scheduler belum pernah dijalankan. Klik "Jalankan Sekarang" di atas untuk memulai crawl pertama.</p>
        </div>
      )}
      {(schedulerRuns ?? []).length > 0 && (
        <div className="border rounded-sm p-4 bg-card">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" /> RIWAYAT CRAWL SCHEDULER — {(schedulerRuns ?? []).length} run
          </p>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {sortedRuns.slice(0, 10).map((run) => {
              const notif = run.notificationResult as { sent?: number; error?: string } | null;
              const isOk = notif && notif.sent != null;
              return (
                <div key={run.id} className="flex items-center gap-3 text-xs border rounded-sm px-3 py-2 bg-muted/30">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${run.status === "COMPLETED" ? "bg-emerald-500" : run.status === "RUNNING" ? "bg-blue-500 animate-pulse" : "bg-red-400"}`} />
                  <span className="font-mono text-[10px] text-muted-foreground w-36 shrink-0 whitespace-nowrap">{new Date(run.startedAt).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm shrink-0 ${run.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : run.status === "RUNNING" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`} title={({ COMPLETED:"Selesai — crawl berhasil tanpa error", RUNNING:"Berjalan — crawl sedang aktif", FAILED:"Gagal — crawl error, data mungkin tidak terperbarui", INTERRUPTED:"Terputus — crawl dihentikan paksa" } as Record<string,string>)[run.status ?? ""] ?? run.status}>{{ COMPLETED:"Selesai", RUNNING:"Berjalan", FAILED:"Gagal", INTERRUPTED:"Terputus" }[run.status ?? ""] ?? run.status}</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                    {isOk ? <span className="text-emerald-600" title={`${notif?.sent} penerima ternotifikasi pada run ini`}>{notif?.sent} terkirim</span> : notif?.error ? <span className="text-red-500" title={notif?.error ?? "Error tidak diketahui"}>Gagal</span> : <span className="text-orange-500">Tertunda</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Config Panel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> KONFIGURASI BRIEF
        </p>
        <div className="mb-4 border-b pb-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookmarkPlus className="h-3.5 w-3.5 text-primary" /> PRESET TERSIMPAN
            </p>
            {briefPresets.length > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {briefPresets.length} preset
              </span>
            )}
          </div>
          {briefPresets.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="list" aria-label="Preset konfigurasi brief">
              {briefPresets.map(preset => (
                <div
                  key={preset.id}
                  role="listitem"
                  className={cn(
                    "flex items-center gap-1 rounded-sm border bg-muted/30 pl-2 transition-colors",
                    activePresetId === preset.id ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <button
                    onClick={() => handleApplyPreset(preset)}
                    className="py-1.5 text-left text-xs font-mono text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    title={`Gunakan preset ${preset.name}`}
                  >
                    <span className="font-semibold">{preset.name}</span>
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      {preset.domain === "Semua Domain" ? "Semua domain" : preset.domain} · {getPeriodeLabel(preset.periode)}
                    </span>
                  </button>
                  <button
                    onClick={() => handleRenamePreset(preset)}
                    className="rounded-sm p-1.5 text-muted-foreground hover:bg-background hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                    aria-label={`Rename preset ${preset.name}`}
                    title="Rename preset"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset)}
                    className="mr-1 rounded-sm p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
                    aria-label={`Hapus preset ${preset.name}`}
                    title="Hapus preset"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-mono text-muted-foreground">
              Belum ada preset. Simpan konfigurasi yang sering dipakai agar bisa digunakan kembali.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Periode */}
          <div>
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Periode Data
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PERIODE_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriode(p.value)}
                  aria-pressed={periode === p.value}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                    periode === p.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Domain */}
          <div>
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Domain / Sektor
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDomain(d)}
                  aria-pressed={domain === d}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                    domain === d
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {d === "Semua Domain" ? "Semua" : d.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Kategori Intelijen
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  aria-pressed={categories.has(cat)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono rounded-sm border transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none",
                    categories.has(cat)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {categories.has(cat) && <CircleCheck className="h-3 w-3" />}
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview counts */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
          {(periode !== "semua" || domain !== "Semua Domain" || categories.size !== 3) && (
            <button
              onClick={() => { setPeriode("semua"); setDomain("Semua Domain"); setCategories(new Set(["Regulasi", "Kompetitor", "Pasar"])); }}
              className="text-[10px] font-mono font-bold px-2 py-1 rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 outline-none"
              title="Reset semua filter konfigurasi"
            >
              ✕ Reset filter
            </button>
          )}
          <div className="text-[10px] font-mono text-muted-foreground">
            Akan di-compile:
          </div>
          {categories.has("Regulasi") && (
            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-sm border border-blue-200">
              {briefRegulasi.length} regulasi
            </span>
          )}
          {categories.has("Kompetitor") && (
            <span className="text-[10px] font-mono bg-orange-50 text-orange-700 px-2 py-0.5 rounded-sm border border-orange-200">
              {briefKompetitor.length} kompetitor
            </span>
          )}
          {categories.has("Pasar") && (
            <span className="text-[10px] font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded-sm border border-green-200">
              {briefVOC.length} sinyal VOC + {briefHeatmap.length} domain heatmap + {briefTriggers.length} buying trigger
            </span>
          )}
          {categories.size === 0 && (
            <span className="text-[10px] font-mono text-destructive">Pilih minimal 1 kategori</span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSavePreset}
            disabled={categories.size === 0}
            className="gap-2 font-mono text-xs"
            title="Simpan konfigurasi periode, domain, dan kategori saat ini sebagai preset"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Simpan sebagai Preset
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={categories.size === 0 || isLoadingLiveData || isRefreshingBrief}
            className="gap-2 font-mono text-xs"
          >
            {isRefreshingBrief
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Sparkles className="h-3.5 w-3.5" />}
            {isRefreshingBrief ? "Sinkronisasi DB…" : generated ? "Regenerate Brief" : "Generate Brief"}
          </Button>
          {generated && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Tergenerate: {generatedAt}
            </span>
          )}
        </div>
      </div>

      {/* Generated Brief */}
      {generated && (
        <>
          {/* Executive Summary Strip */}
          <div className="border rounded-sm p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" /> RINGKASAN EKSEKUTIF BRIEF
              <span className="ml-auto text-slate-400 normal-case font-normal">{generatedAt}</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Regulasi Kritis", val: statsRegKritis, icon: Shield, color: "text-red-400" },
                { label: "VOC Frekuensi Tinggi", val: statsVocHigh, icon: Zap, color: "text-amber-400" },
                { label: "Buying Trigger Kritis", val: statsTriggersKritis, icon: TriangleAlert, color: "text-red-400" },
                { label: "Domain Demand #1", val: statsHeatTop, icon: TrendingUp, color: "text-emerald-400" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2">
                  <s.icon className={cn("h-4 w-4 shrink-0", s.color)} />
                  <div>
                    <p className={cn("text-lg font-bold font-mono leading-none", s.color)}>{s.val}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-700 pt-3 items-center">
              <a href="/surat-penawaran" className="text-[9px] font-mono font-bold text-primary border border-primary/40 bg-primary/10 px-2 py-0.5 rounded-sm hover:bg-primary/20 transition-colors whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1">
                📄 Buat Surat Penawaran →
              </a>
              <span className="text-slate-600">·</span>
              <span className="text-[9px] font-mono text-slate-400">Periode: {getPeriodeLabel(periode)}</span>
              <span className="text-slate-600">·</span>
              <span className="text-[9px] font-mono text-slate-400">Domain: {domain}</span>
              <span className="text-slate-600">·</span>
              <span className="text-[9px] font-mono text-slate-400">Kategori: {Array.from(categories).join(", ")}</span>
            </div>
          </div>

          {/* Regulasi Section */}
          {categories.has("Regulasi") && (
            <div className="border rounded-sm bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-blue-600" />
                  INTELIJEN REGULASI
                  <span className="ml-2 text-[9px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-sm">
                    {briefRegulasi.length} regulasi
                  </span>
                  <span className={cn(
                    "text-[8px] font-mono px-1.5 py-0.5 rounded-sm border",
                    usingLiveRegulasi
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-50 text-slate-500 border-slate-200",
                  )}>
                    {usingLiveRegulasi ? "LIVE DB" : "FALLBACK"}
                  </span>
                </p>
              </div>
              {briefRegulasi.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground font-mono">
                  Tidak ada regulasi yang diterbitkan dalam periode ini.<br />
                  <span className="text-[10px]">Database regulasi mencakup 2020–2024. Coba pilih "Semua waktu" untuk melihat semua data.</span>
                  <button
                    onClick={() => { setPeriode("semua"); setDomain("Semua Domain"); setCategories(new Set(["Regulasi", "Kompetitor", "Pasar"])); }}
                    className="block mx-auto mt-2 text-primary hover:underline text-[10px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                  >✕ Reset filter</button>
                </div>
              )}
              <div className="divide-y">
                {briefRegulasi.slice(0, regMax).map(r => (
                  <div key={r.id} className="px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-[9px] font-mono text-muted-foreground" title={`Kode regulasi: ${r.kode}`}>{r.kode}</span>
                          <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0", IMPACT_COLORS[r.dampak])} title={{ KRITIS:"Dampak Kritis — perubahan wajib segera", TINGGI:"Dampak Tinggi — perlu tindak lanjut", SEDANG:"Dampak Sedang — pantau perkembangan", RENDAH:"Dampak Rendah" }[r.dampak] ?? r.dampak}>
                            {r.dampak}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0", STATUS_COLORS[r.status])} title={{ BARU:"Regulasi baru diterbitkan", DIUBAH:"Regulasi telah diubah/direvisi", DICABUT:"Regulasi dicabut/tidak berlaku", AKAN_BERLAKU:"Regulasi akan berlaku dalam waktu dekat" }[r.status] ?? r.status}>
                            {r.status}
                          </Badge>
                          {r.deadline && (
                            <span className="text-[8px] font-mono text-orange-600 flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" /> {r.deadline}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold mb-1" title={r.judul}>{r.judul}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed" title={r.ringkasan}>{r.ringkasan}</p>
                        <p className="text-[9px] font-mono text-muted-foreground/60 mt-1" title={r.instansi}>{r.instansi}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {briefRegulasi.length > regMax && (
                <div className="px-4 py-2 border-t bg-muted/20">
                  <button
                    onClick={() => setRegMax(n => n + 6)}
                    className="text-xs font-mono text-primary hover:underline flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                    aria-expanded={false} aria-label={`Tampilkan ${Math.min(6, briefRegulasi.length - regMax)} regulasi lagi`}
                  >
                    <ChevronDown className="h-3 w-3" />
                    Tampilkan {Math.min(6, briefRegulasi.length - regMax)} regulasi lagi ({briefRegulasi.length - regMax} tersisa)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Kompetitor Section */}
          {categories.has("Kompetitor") && (
            <div className="border rounded-sm bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-orange-600" />
                  INTELIJEN KOMPETITOR
                  <span className="ml-2 text-[9px] font-mono bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-sm">
                    {briefKompetitor.length} kompetitor
                  </span>
                  <span className={cn(
                    "text-[8px] font-mono px-1.5 py-0.5 rounded-sm border",
                    usingLiveKompetitor
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-50 text-slate-500 border-slate-200",
                  )}>
                    {usingLiveKompetitor ? "LIVE DB" : "FALLBACK"}
                  </span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b text-[9px] font-mono text-muted-foreground uppercase sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
                      <th className="text-left px-4 py-2">Kompetitor</th>
                      <th className="text-left px-3 py-2">Ukuran</th>
                      <th className="text-left px-3 py-2">Range Harga</th>
                      <th className="text-left px-3 py-2" title="Ancaman Utama — area di mana kompetitor ini paling kuat dan berpotensi menggeser posisi MJP">Ancaman Utama</th>
                      <th className="text-left px-3 py-2" title="Peluang dari Mereka — kelemahan kompetitor yang bisa dieksploitasi MJP">Peluang dari Mereka</th>
                      <th className="text-center px-3 py-2">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {briefKompetitor.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">Tidak ada data kompetitor untuk domain ini</td></tr>
                    )}
                    {briefKompetitor.slice(0, compMax).map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-2.5 font-semibold max-w-[140px]"><span className="truncate block" title={c.nama}>{c.nama}</span></td>
                        <td className="px-3 py-2.5">
                          <span className={cn("text-[8px] font-mono px-1.5 py-0.5 rounded-sm border",
                            c.ukuran === "BESAR" ? "bg-blue-100 text-blue-700 border-blue-200" :
                            c.ukuran === "MENENGAH" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                          )}>{c.ukuran}</span>
                        </td>
                        <td className="px-3 py-2.5 text-[10px] font-mono text-muted-foreground whitespace-nowrap group/hr" title={c.hargaRange}>{c.hargaRange}<button onClick={e => { e.stopPropagation(); void navigator.clipboard.writeText(c.hargaRange).then(() => toast.success("Harga disalin", { duration: 1200 })); }} aria-label="Salin range harga" title="Salin range harga" className="ml-1 opacity-0 group-hover/hr:opacity-100 transition-all text-muted-foreground hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"><Copy className="h-2.5 w-2.5" /></button></td>
                        <td className="px-3 py-2.5 text-[10px] text-red-700 max-w-[160px] truncate" title={c.ancamanUtama}>{c.ancamanUtama}</td>
                        <td className="px-3 py-2.5 text-[10px] text-emerald-700 max-w-[160px] truncate" title={c.peluangUtama}>{c.peluangUtama}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="font-mono font-bold text-xs">{c.rating}/5</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {briefKompetitor.length > compMax && (
                <div className="px-4 py-2 border-t bg-muted/20">
                  <button
                    onClick={() => setCompMax(n => n + 4)}
                    className="text-xs font-mono text-primary hover:underline flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                  >
                    <ChevronDown className="h-3 w-3" />
                    Tampilkan {Math.min(4, briefKompetitor.length - compMax)} kompetitor lagi
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sinyal Pasar Section */}
          {categories.has("Pasar") && (
            <>
              {/* VOC Signals */}
              <div className="border rounded-sm bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                    SINYAL PASAR — VOICE OF CUSTOMER
                    <span className="ml-2 text-[9px] font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded-sm">
                      {briefVOC.length} sinyal
                    </span>
                    <span className={cn(
                      "text-[8px] font-mono px-1.5 py-0.5 rounded-sm border",
                      usingLiveVOC
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-50 text-slate-500 border-slate-200",
                    )}>
                      {usingLiveVOC ? "LIVE DB" : "FALLBACK"}
                    </span>
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                  {briefVOC.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-30" />
                      <p className="text-xs font-mono">Belum ada sinyal VOC tercatat</p>
                    </div>
                  )}
                  {briefVOC.slice(0, vocMax).map(v => (
                    <div key={v.id} className={cn("group border rounded-sm p-3 transition-all hover:brightness-95 hover:shadow-sm",
                      v.kategori === "PAIN" ? "border-red-200 bg-red-50/30" :
                      v.kategori === "FEAR" ? "border-orange-200 bg-orange-50/30" :
                      v.kategori === "DESIRE" ? "border-green-200 bg-green-50/30" :
                      v.kategori === "TRIGGER" ? "border-yellow-200 bg-yellow-50/30" :
                      "border-blue-200 bg-blue-50/30"
                    )}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0", VOC_COLORS[v.kategori])}>
                          {v.kategori}
                        </Badge>
                        <span className="text-[9px] font-mono text-muted-foreground" title={v.segment}>{v.segment}</span>
                        <span className="ml-auto text-[9px] font-mono font-bold text-primary">{v.frekuensi}/10</span>
                      </div>
                      <div className="flex items-start gap-1">
                        <p className="text-[10px] font-semibold mb-1 leading-snug flex-1" title={v.terjemahan}>{v.terjemahan}</p>
                        <button onClick={() => void navigator.clipboard.writeText(`${v.terjemahan}\n→ ${v.peluangLayanan}`).then(() => toast.success("VOC disalin", { duration: 1200 }))} className="opacity-0 group-hover:opacity-100 transition-all shrink-0 text-muted-foreground hover:text-foreground" aria-label="Salin kutipan VOC" title="Salin VOC"><Copy className="h-2.5 w-2.5" /></button>
                      </div>
                      <p className="text-[9px] text-muted-foreground font-mono truncate" title={v.peluangLayanan}>→ {v.peluangLayanan}</p>
                    </div>
                  ))}
                </div>
                {briefVOC.length > vocMax && (
                  <div className="px-4 py-2 border-t bg-muted/20">
                    <button
                      onClick={() => setVocMax(n => n + 6)}
                      className="text-xs font-mono text-primary hover:underline flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none rounded-sm"
                    >
                      <ChevronDown className="h-3 w-3" />
                      Tampilkan {Math.min(6, briefVOC.length - vocMax)} sinyal lagi ({briefVOC.length - vocMax} tersisa)
                    </button>
                  </div>
                )}
              </div>

              {/* Heatmap Permintaan */}
              <div className="border rounded-sm bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ChartBar className="h-3.5 w-3.5 text-primary" />
                    HEATMAP PERMINTAAN PASAR
                    <span className="ml-2 text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">
                      TOP {Math.min(heatMax, briefHeatmap.length)} DOMAIN
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  {briefHeatmap.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <Search className="h-8 w-8 opacity-30" />
                      <p className="text-xs font-mono">Belum ada data heatmap domain</p>
                    </div>
                  )}
                  {briefHeatmap.slice(0, heatMax).map(h => (
                    <div key={h.domain} className="flex items-center gap-3 rounded-sm px-1 hover:bg-muted/40 hover:shadow-sm transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium truncate" title={h.domain}>{h.domain}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] font-mono font-bold text-emerald-600">{h.growth?.startsWith("+") || h.growth?.startsWith("N") ? "↑ " : h.growth?.startsWith("-") ? "↓ " : ""}{h.growth}</span>
                            <span className="text-xs font-mono font-bold w-10 text-right">{h.demand}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full",
                                h.demand >= 80 ? "bg-red-500" :
                                h.demand >= 65 ? "bg-orange-500" :
                                h.demand >= 50 ? "bg-yellow-500" : "bg-blue-400"
                              )}
                              style={{ width: `${h.demand}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground w-48 text-right truncate" title={h.topPain}>{h.topPain}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {briefHeatmap.length > heatMax && (
                  <div className="px-4 py-2 border-t bg-muted/20">
                    <button
                      onClick={() => setHeatMax(n => n + 4)}
                      className="text-xs font-mono text-primary hover:underline flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                    >
                      <ChevronDown className="h-3 w-3" />
                      Tampilkan {Math.min(4, briefHeatmap.length - heatMax)} domain lagi
                    </button>
                  </div>
                )}
              </div>

              {/* Buying Triggers */}
              <div className="border rounded-sm bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-yellow-600" />
                    BUYING TRIGGERS — PEMICU KEBUTUHAN KLIEN
                    <span className="ml-2 text-[9px] font-mono bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-sm">
                      {Math.min(trigMax, briefTriggers.length)} ditampilkan
                    </span>
                    <span className={cn(
                      "text-[8px] font-mono px-1.5 py-0.5 rounded-sm border",
                      usingLiveTriggers
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-50 text-slate-500 border-slate-200",
                    )}>
                      {usingLiveTriggers ? "LIVE DB" : "FALLBACK"}
                    </span>
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr className="border-b bg-muted/30 text-[9px] font-mono text-muted-foreground uppercase sticky top-0 z-10 bg-background">
                        <th className="text-left px-4 py-2">Trigger / Pemicu</th>
                        <th className="text-center px-3 py-2">Urgensi</th>
                        <th className="text-left px-3 py-2">Channel Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {briefTriggers.length === 0 && (
                        <tr><td colSpan={3} className="px-4 py-8 text-center text-xs font-mono text-muted-foreground">Belum ada buying trigger tercatat</td></tr>
                      )}
                      {briefTriggers.slice(0, trigMax).map((t, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2 font-medium" title={t.trigger}>{t.trigger}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={cn("text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm", URGENCY_COLORS[t.urgency])}>
                              {t.urgency}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[10px] text-muted-foreground" title={t.channel}>{t.channel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {briefTriggers.length > trigMax && (
                  <div className="px-4 py-2 border-t bg-muted/20">
                    <button
                      onClick={() => setTrigMax(n => n + 6)}
                      className="text-xs font-mono text-primary hover:underline flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm outline-none"
                    >
                      <ChevronDown className="h-3 w-3" />
                      Tampilkan {Math.min(6, briefTriggers.length - trigMax)} trigger lagi
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Export footer strip */}
          <div className="border rounded-sm p-4 bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold mb-0.5">
                {briefDataReady
                  ? "Brief siap diexport"
                  : liveDataHasError
                    ? "Brief menunggu koneksi database"
                    : "Brief sedang memperbarui data live"}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {briefDataReady
                  ? <>PDF: dokumen A4 multi-halaman · Excel: {1 + (categories.has("Regulasi") ? 1 : 0) + (categories.has("Kompetitor") ? 1 : 0) + (categories.has("Pasar") ? 3 : 0)} sheet dengan data lengkap</>
                  : "Export dan berbagi dinonaktifkan sampai sumber live selesai diverifikasi."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={!briefDataReady} title="Ekspor laporan intelijen ke Excel" className="gap-1.5 text-xs font-mono">
                {exportedExcel ? <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />}
                {exportedExcel ? "✓ Tersimpan" : "Download Excel"}
              </Button>
              <Button size="sm" onClick={handleExportPDF} disabled={pdfExporting || !briefDataReady} title="Ekspor laporan intelijen ke PDF" className="gap-1.5 text-xs font-mono">
                <FileText className="h-3.5 w-3.5" />
                {pdfExporting ? "Mengekspor…" : "Download PDF"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Empty state when not yet generated */}
      {!generated && (
        <div className="border rounded-sm p-12 bg-card flex flex-col items-center justify-center gap-3 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">Konfigurasi dan generate brief</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Pilih periode, domain, dan kategori di atas — lalu klik <strong>Generate Brief</strong> untuk menggabungkan semua intelijen menjadi satu laporan.
          </p>
        </div>
      )}
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}
