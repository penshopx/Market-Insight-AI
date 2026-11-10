import * as XLSX from "xlsx";
import { format } from "date-fns";

export interface ContractorRow {
  id: number;
  name: string;
  type: string;
  sbuLevel: string;
  sbuCode?: string | null;
  sbuExpiry?: string | null;
  bidangUsaha?: string | null;
  subBidang?: string | null;
  klasifikasi?: string | null;
  npwp?: string | null;
  registrationNumber?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  dataSource?: string | null;
  notes?: string | null;
  createdAt?: string;
  catatan?: string | null;
}

export interface SkkHolderRow {
  id: number;
  name: string;
  jenjang: string | number;
  specialization: string;
  jabatanKerja?: string | null;
  skkNumber?: string | null;
  skkExpiry?: string | null;
  certificationBody?: string | null;
  education?: string | null;
  province?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  currentEmployer?: string | null;
  available?: boolean | null;
  dataSource?: string | null;
  createdAt?: string;
}

function autoFitColumns(ws: XLSX.WorkSheet, data: Record<string, unknown>[]) {
  const headers = Object.keys(data[0] ?? {});
  ws["!cols"] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...data.map((row) => String(row[h] ?? "").length)
    );
    return { wch: Math.min(maxLen + 2, 60) };
  });
}

export function exportContractorsExcel(contractors: ContractorRow[]) {
  const today = format(new Date(), "yyyy-MM-dd");

  const rows = contractors.map((c) => ({
    "Nama Perusahaan": c.name,
    "Tipe": c.type === "KONTRAKTOR" ? "Kontraktor" : c.type === "KONSULTAN" ? "Konsultan" : c.type,
    "Kualifikasi SBU": c.sbuLevel,
    "Kode SBU": c.sbuCode ?? "",
    "Masa Berlaku SBU": c.sbuExpiry ? format(new Date(c.sbuExpiry), "dd/MM/yyyy") : "",
    "Bidang Usaha": c.bidangUsaha ?? "",
    "Sub Bidang": c.subBidang ?? "",
    "Klasifikasi": c.klasifikasi ?? "",
    "NPWP": c.npwp ?? "",
    "No. Registrasi LPJK": c.registrationNumber ?? "",
    "Provinsi": c.province ?? "",
    "Kota": c.city ?? "",
    "Alamat": c.address ?? "",
    "Telepon": c.phone ?? "",
    "Email": c.email ?? "",
    "Website": c.website ?? "",
    "Sumber Data": c.dataSource ?? "",
    "Catatan": c.notes ?? "",
    "Catatan Tim": c.catatan ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);

  // Style header row bold (xlsx-js-style not available; use basic approach)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Kontraktor & Konsultan");

  // Summary sheet
  const summaryWs = XLSX.utils.aoa_to_sheet([
    ["EKSPOR DATABASE KONTRAKTOR & KONSULTAN"],
    ["Tanggal Ekspor", today],
    ["Total Data", contractors.length],
    ["Kontraktor", contractors.filter((c) => c.type === "KONTRAKTOR").length],
    ["Konsultan", contractors.filter((c) => c.type === "KONSULTAN").length],
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  XLSX.writeFile(wb, `Database-Kontraktor-${today}.xlsx`);
}

export function exportSkkExcel(skkHolders: SkkHolderRow[]) {
  const today = format(new Date(), "yyyy-MM-dd");

  const rows = skkHolders.map((h) => ({
    "Nama": h.name,
    "Jenjang SKK": h.jenjang === 7 ? "7 — Ahli Muda" : h.jenjang === 8 ? "8 — Ahli Madya" : h.jenjang === 9 ? "9 — Ahli Utama" : `J-${h.jenjang}`,
    "Bidang Keahlian": h.specialization,
    "Jabatan Kerja": h.jabatanKerja ?? "",
    "No. SKK": h.skkNumber ?? "",
    "Masa Berlaku SKK": h.skkExpiry ? format(new Date(h.skkExpiry), "dd/MM/yyyy") : "",
    "Badan Sertifikasi": h.certificationBody ?? "",
    "Pendidikan": h.education ?? "",
    "Provinsi": h.province ?? "",
    "Kota": h.city ?? "",
    "Telepon/WA": h.phone ?? "",
    "Email": h.email ?? "",
    "Perusahaan Saat Ini": h.currentEmployer ?? "",
    "Status Availability": h.available === true ? "TERSEDIA" : h.available === false ? "TIDAK TERSEDIA" : "-",
    "Sumber Data": h.dataSource ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pemegang SKK");

  // Summary sheet
  const summaryWs = XLSX.utils.aoa_to_sheet([
    ["EKSPOR DATABASE PEMEGANG SKK"],
    ["Tanggal Ekspor", today],
    ["Total Data", skkHolders.length],
    ["Tersedia", skkHolders.filter((h) => h.available).length],
    ["Tidak Tersedia", skkHolders.filter((h) => !h.available).length],
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  XLSX.writeFile(wb, `Database-Pemegang-SKK-${today}.xlsx`);
}

export interface ResearchRow {
  id: number;
  title: string;
  source: string;
  category: string;
  createdAt: string;
  summary?: string | null;
  priority?: string | null;
  status?: string | null;
  catatan?: string | null;
}

export function exportResearchExcel(items: ResearchRow[]) {
  const today = format(new Date(), "yyyy-MM-dd");

  const rows = items.map((item) => ({
    "Judul Temuan": item.title,
    "Sumber": item.source,
    "Kategori": item.category.replace(/_/g, " "),
    "Tanggal": item.createdAt ? format(new Date(item.createdAt), "dd/MM/yyyy HH:mm") : "",
    "Ringkasan": item.summary ?? "",
    "Prioritas": item.priority ?? "",
    "Status": item.status ?? "",
    "Catatan Tim": item.catatan ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data Riset");

  const summaryWs = XLSX.utils.aoa_to_sheet([
    ["EKSPOR DATA RISET"],
    ["Tanggal Ekspor", today],
    ["Total Data", items.length],
    ["Pending", items.filter((i) => i.status === "PENDING").length],
    ["Reviewed", items.filter((i) => i.status === "REVIEWED").length],
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  XLSX.writeFile(wb, `Data-Riset-${today}.xlsx`);
}

export interface TenderRow {
  id: number;
  title: string;
  client: string;
  estimatedValue?: number | null;
  deadline?: string | null;
  status: string;
  province?: string | null;
  city?: string | null;
  sbuRequired?: string | null;
  lpseCode?: string | null;
  source?: string | null;
  catatan?: string | null;
}

function formatHPS(val: number | null | undefined): string {
  if (!val) return "";
  if (val >= 1_000_000_000_000) return `Rp ${(val / 1_000_000_000_000).toFixed(1).replace(/\.0$/, "")} Triliun`;
  if (val >= 1_000_000_000)     return `Rp ${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, "")} Miliar`;
  if (val >= 1_000_000)         return `Rp ${(val / 1_000_000).toFixed(0)} Juta`;
  if (val >= 1_000)             return `Rp ${(val / 1_000).toFixed(0)} Ribu`;
  return `Rp ${val.toLocaleString("id-ID")}`;
}

export function exportTendersExcel(tenders: TenderRow[]) {
  const today = format(new Date(), "yyyy-MM-dd");

  const rows = tenders.map((t) => ({
    "Nama Tender / Paket": t.title,
    "Instansi / Klien": t.client,
    "Nilai HPS (Rp)": t.estimatedValue ?? "",
    "Nilai HPS (Terbaca)": formatHPS(t.estimatedValue),
    "Deadline": t.deadline ? format(new Date(t.deadline), "dd/MM/yyyy") : "",
    "Status": ({ OPEN:"Terbuka", ACTIVE:"Aktif", WON:"Menang", LOST:"Kalah", EVALUATION:"Evaluasi", AWARDED:"Awarded", CANCELLED:"Batal" } as Record<string,string>)[t.status] ?? t.status,
    "Provinsi": t.province ?? "",
    "Kota": t.city ?? "",
    "Syarat SBU": t.sbuRequired ?? "",
    "Kode LPSE": t.lpseCode ?? "",
    "Sumber": t.source ?? "",
    "Catatan Tim": t.catatan ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Peluang Tender");

  const summaryWs = XLSX.utils.aoa_to_sheet([
    ["EKSPOR DATA PELUANG TENDER"],
    ["Tanggal Ekspor", today],
    ["Total Data", tenders.length],
    ["Open", tenders.filter((t) => t.status === "OPEN").length],
    ["Evaluasi", tenders.filter((t) => t.status === "EVALUATION").length],
    ["Awarded", tenders.filter((t) => t.status === "AWARDED").length],
    ["Cancelled", tenders.filter((t) => t.status === "CANCELLED").length],
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  XLSX.writeFile(wb, `Peluang-Tender-${today}.xlsx`);
}

// ─── Intelligence Brief Excel ─────────────────────────────────────────────────

export interface IntelligenceBriefExcelData {
  periode: string;
  domain: string;
  categories: string[];
  generatedAt: string;
  regulasi: Array<{
    kode: string;
    judul: string;
    instansi: string;
    dampak: string;
    status: string;
    ringkasan: string;
    deadline?: string;
  }>;
  kompetitor: Array<{
    nama: string;
    ukuran: string;
    hargaRange: string;
    rating: number;
    ancamanUtama: string;
    peluangUtama: string;
  }>;
  vocSignals: Array<{
    kategori: string;
    segment: string;
    frekuensi: number;
    terjemahan: string;
    peluangLayanan: string;
    sumber: string;
  }>;
  heatmap: Array<{
    domain: string;
    demand: number;
    growth: string;
    topPain: string;
  }>;
  buyingTriggers: Array<{
    trigger: string;
    urgency: string;
    channel: string;
  }>;
}

export function exportIntelligenceBriefExcel(brief: IntelligenceBriefExcelData) {
  const today = format(new Date(), "yyyy-MM-dd");
  const wb = XLSX.utils.book_new();

  // ── Sheet: Ringkasan ──────────────────────────────────────────────────────────
  const summaryWs = XLSX.utils.aoa_to_sheet([
    ["LAPORAN INTELIJEN — PT MAHESWARA JAYA PERSADA"],
    [],
    ["Periode", brief.periode],
    ["Domain", brief.domain],
    ["Kategori", brief.categories.join(", ")],
    ["Tanggal Generate", brief.generatedAt],
    [],
    ["STATISTIK RINGKAS"],
    ["Total Regulasi", brief.regulasi.length],
    ["Regulasi KRITIS", brief.regulasi.filter(r => r.dampak === "KRITIS").length],
    ["Regulasi Baru", brief.regulasi.filter(r => r.status === "BARU").length],
    ["Total Kompetitor", brief.kompetitor.length],
    ["Total Sinyal VOC", brief.vocSignals.length],
    ["Sinyal Frekuensi Tinggi (≥8)", brief.vocSignals.filter(v => v.frekuensi >= 8).length],
    ["Domain Demand Teratas", brief.heatmap.slice(0, 3).map(h => `${h.domain} (${h.demand}%)`).join(", ")],
    ["Buying Triggers KRITIS", brief.buyingTriggers.filter(t => t.urgency === "KRITIS").length],
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  // ── Sheet: Regulasi ───────────────────────────────────────────────────────────
  if (brief.regulasi.length > 0) {
    const regRows = brief.regulasi.map(r => ({
      "Kode Regulasi": r.kode,
      "Judul": r.judul,
      "Instansi": r.instansi,
      "Dampak": r.dampak,
      "Status": r.status,
      "Deadline": r.deadline ?? "",
      "Ringkasan": r.ringkasan,
    }));
    const regWs = XLSX.utils.json_to_sheet(regRows);
    autoFitColumns(regWs, regRows);
    XLSX.utils.book_append_sheet(wb, regWs, "Regulasi");
  }

  // ── Sheet: Kompetitor ─────────────────────────────────────────────────────────
  if (brief.kompetitor.length > 0) {
    const kompRows = brief.kompetitor.map(k => ({
      "Nama Kompetitor": k.nama,
      "Ukuran": k.ukuran,
      "Range Harga": k.hargaRange,
      "Rating (1-5)": k.rating,
      "Ancaman Utama": k.ancamanUtama,
      "Peluang dari Mereka": k.peluangUtama,
    }));
    const kompWs = XLSX.utils.json_to_sheet(kompRows);
    autoFitColumns(kompWs, kompRows);
    XLSX.utils.book_append_sheet(wb, kompWs, "Kompetitor");
  }

  // ── Sheet: Sinyal VOC ─────────────────────────────────────────────────────────
  if (brief.vocSignals.length > 0) {
    const vocRows = brief.vocSignals.map(v => ({
      "Tipe": v.kategori,
      "Segmen": v.segment,
      "Frekuensi (1-10)": v.frekuensi,
      "Masalah / Keinginan": v.terjemahan,
      "Peluang Layanan": v.peluangLayanan,
      "Sumber": v.sumber,
    }));
    const vocWs = XLSX.utils.json_to_sheet(vocRows);
    autoFitColumns(vocWs, vocRows);
    XLSX.utils.book_append_sheet(wb, vocWs, "Sinyal VOC");
  }

  // ── Sheet: Heatmap Permintaan ─────────────────────────────────────────────────
  if (brief.heatmap.length > 0) {
    const heatRows = brief.heatmap.map(h => ({
      "Domain Layanan": h.domain,
      "Demand Index (%)": h.demand,
      "Growth": h.growth,
      "Pain Utama": h.topPain,
    }));
    const heatWs = XLSX.utils.json_to_sheet(heatRows);
    autoFitColumns(heatWs, heatRows);
    XLSX.utils.book_append_sheet(wb, heatWs, "Heatmap Demand");
  }

  // ── Sheet: Buying Triggers ────────────────────────────────────────────────────
  if (brief.buyingTriggers.length > 0) {
    const trigRows = brief.buyingTriggers.map(t => ({
      "Trigger / Pemicu": t.trigger,
      "Urgensi": t.urgency,
      "Channel Aksi": t.channel,
    }));
    const trigWs = XLSX.utils.json_to_sheet(trigRows);
    autoFitColumns(trigWs, trigRows);
    XLSX.utils.book_append_sheet(wb, trigWs, "Buying Triggers");
  }

  XLSX.writeFile(wb, `Laporan-Intelijen-${today}.xlsx`);
}

export interface PainPointRow {
  id: number;
  problemId?: string | null;
  domain?: string | null;
  subdomain?: string | null;
  description?: string | null;
  painScore?: number | null;
  priority?: string | null;
  affectedRoles?: string | null;
  rootCause?: string | null;
  serviceOpportunity?: string | null;
  aiSolution?: string | null;
  status?: string | null;
  createdAt?: string;
  catatan?: string | null;
}

export function exportPainPointsExcel(items: PainPointRow[]) {
  const today = format(new Date(), "yyyy-MM-dd");

  const rows = items.map((p) => ({
    "ID Masalah": p.problemId ?? `PP-${p.id}`,
    "Domain": p.domain ?? "",
    "Sub-Domain": p.subdomain ?? "",
    "Deskripsi Masalah": p.description ?? "",
    "Pain Score": p.painScore ?? "",
    "Prioritas": p.priority ?? "",
    "Pihak Terdampak": p.affectedRoles ?? "",
    "Akar Masalah": p.rootCause ?? "",
    "Peluang Layanan": p.serviceOpportunity ?? "",
    "Solusi AI": p.aiSolution ?? "",
    "Status": ({ OPEN:"Terbuka", IN_PROGRESS:"Sedang Ditangani", RESOLVED:"Selesai" } as Record<string,string>)[p.status ?? ""] ?? (p.status ?? ""),
    "Tanggal Input": p.createdAt ? format(new Date(p.createdAt), "dd/MM/yyyy") : "",
    "Catatan Tim": p.catatan ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  autoFitColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Masalah Industri");

  const summaryWs = XLSX.utils.aoa_to_sheet([
    ["EKSPOR CONSTRUCTION PROBLEM KNOWLEDGE BASE (CPKB)"],
    ["Tanggal Ekspor", today],
    ["Total Masalah", items.length],
    ["CRITICAL", items.filter((p) => p.priority === "CRITICAL").length],
    ["HIGH", items.filter((p) => p.priority === "HIGH").length],
    ["Dengan Peluang Layanan", items.filter((p) => p.serviceOpportunity).length],
    ["Rata-rata Pain Score", items.length > 0 ? (items.reduce((s, p) => s + (p.painScore ?? 0), 0) / items.length).toFixed(1) : 0],
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

  XLSX.writeFile(wb, `CPKB-PainPoints-${today}.xlsx`);
}
