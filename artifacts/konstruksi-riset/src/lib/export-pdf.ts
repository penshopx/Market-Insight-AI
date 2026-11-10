import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { createMkrShare } from "@workspace/api-client-react";
import {
  KNOWLEDGE_REGISTRY, COVERAGE_TAXONOMY, AI_AGENTS_REGISTRY,
  getByIntegrationLevel,
  INTEGRATION_LEVEL_LABELS,
} from "@/lib/knowledgeRegistry";

/**
 * Truncates a string so the result is at most `maxLength` characters long
 * (including the ellipsis "…" when the string is cut).
 * Safe to call on null/undefined (returns "-").
 *
 * Examples (maxLength = 5):
 *   "Hi"       → "Hi"        (≤ 5, no cut)
 *   "Hello"    → "Hello"     (exactly 5, no cut)
 *   "Hello!"   → "Hell…"     (6 chars → slice to 4 + "…" = 5)
 */
interface TruncationResult {
  text: string;
  truncated: boolean;
}

function truncateTextWithFlag(
  text: string | null | undefined,
  maxLength: number,
): TruncationResult {
  if (!text) return { text: "-", truncated: false };
  if (text.length <= maxLength) return { text, truncated: false };
  // Reserve one character for the ellipsis so total length === maxLength.
  return { text: text.slice(0, maxLength - 1) + "…", truncated: true };
}

export function truncateText(text: string | null | undefined, maxLength: number): string {
  return truncateTextWithFlag(text, maxLength).text;
}

export interface DashboardExportData {
  summary?: {
    totalResearchItems?: number;
    openTenders?: number;
    totalContractors?: number;
    totalSkkHolders?: number;
    expiringCertifications?: number;
    todayCollected?: number;
    lastUpdated?: string;
  };
  trends?: Array<{
    topic: string;
    category: string;
    count: number;
    trend?: string;
  }>;
  expiring?: Array<{
    type: string;
    holderName: string;
    expiryDate: string;
    daysLeft: number;
  }>;
  criticalPainPoints?: Array<{
    problemId?: string | null;
    domain?: string | null;
    description?: string | null;
    painScore?: number | null;
    affectedRoles?: string | null;
    serviceOpportunity?: string | null;
  }>;
}

type DashboardPdfOptions = {
  mode: "export" | "preview";
};

function buildPdf(data: DashboardExportData, options: DashboardPdfOptions): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const isPreview = options.mode === "preview";
  const today = new Date();
  const dateLabel = format(today, "EEEE, dd MMMM yyyy", { locale: idLocale }).toUpperCase();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  // Reserve bottom 16 mm for footer line + text.
  const bodyBottom = pageH - 16;
  let hasTruncatedText = false;
  const truncationNoticeBottomMargin = 24;

  function truncateForPdf(text: string | null | undefined, maxLength: number): string {
    const result = truncateTextWithFlag(text, maxLength);
    hasTruncatedText ||= result.truncated;
    return result.text;
  }

  function getTableMargin() {
    return {
      left: margin,
      right: margin,
      ...(hasTruncatedText ? { bottom: truncationNoticeBottomMargin } : {}),
    };
  }

  // Draw a lightweight continuation header on overflow pages.
  function drawContinuationHeader() {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(251, 191, 36);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(
      isPreview ? "BRIEFING HARIAN — PREVIEW (LANJUTAN)" : "BRIEFING HARIAN — LANJUTAN",
      margin,
      12,
    );
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(dateLabel, pageW - margin, 12, { align: "right" });
  }

  // Ensure at least `needed` mm remain before drawing a new section heading.
  // Adds a new page (with continuation header) when space is insufficient.
  function ensureSpace(needed: number) {
    if (y + needed > bodyBottom) {
      doc.addPage();
      drawContinuationHeader();
      y = 24;
    }
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // dark navy
  doc.rect(0, 0, pageW, 28, "F");

  doc.setTextColor(251, 191, 36); // amber primary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(isPreview ? "BRIEFING HARIAN — PREVIEW" : "BRIEFING HARIAN", margin, 11);

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    isPreview
      ? "PLATFORM RISET MARKETING KONSTRUKSI · PT MAHESWARA JAYA PERSADA"
      : "PLATFORM RISET MARKETING KONSTRUKSI",
    margin,
    17,
  );
  doc.text(dateLabel, margin, 22);

  if (isPreview) {
    doc.setTextColor(251, 191, 36);
    doc.setFontSize(7.5);
    doc.text("● PREVIEW — belum dikirim", pageW - margin, 22, { align: "right" });
  } else {
    // Page number & generation time
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.text(`DIGENERATE: ${format(today, "dd/MM/yyyy HH:mm")}`, pageW - margin, 22, { align: "right" });
  }

  let y = 34;

  // ── Summary Stats ────────────────────────────────────────────────────────────
  // Summary is always the first section; it always fits on page 1.
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("RINGKASAN STATISTIK HARIAN", margin, y);
  y += 4;

  const s = data.summary;
  const statsRows = [
    ["Total Item Riset", String(s?.totalResearchItems ?? "-"), "Tender Terbuka", String(s?.openTenders ?? "-")],
    ["Kontraktor (BD)", String(s?.totalContractors ?? "-"), "Pemegang SKK", String(s?.totalSkkHolders ?? "-")],
    ["Masuk Hari Ini", String(s?.todayCollected ?? "-"), "Sertifikasi Expired", String(s?.expiringCertifications ?? "-")],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: statsRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 42 },
      1: { textColor: [15, 23, 42], fontStyle: "bold", cellWidth: 28 },
      2: { fontStyle: "bold", fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 42 },
      3: { textColor: [15, 23, 42], fontStyle: "bold", cellWidth: 28 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Trending Topics ──────────────────────────────────────────────────────────
  if (data.trends && data.trends.length > 0) {
    // Need room for heading (≈8 mm) + table header + at least 1 row (≈10 mm).
    ensureSpace(22);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TOPIK TRENDING", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["#", "TOPIK", "KATEGORI", "MENTIONS", "TREN"]],
      body: data.trends.map((t, i) => [
        String(i + 1),
        truncateForPdf(t.topic, 80),
        isPreview ? t.category : t.category.replace("_", " "),
        String(t.count),
        isPreview
          ? t.trend ?? "—"
          : t.trend === "UP"
            ? "↑ NAIK"
            : t.trend === "DOWN"
              ? "↓ TURUN"
              : "→",
      ]),
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [251, 191, 36], fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: isPreview ? 7.5 : 8, cellPadding: 2.5 },
      columnStyles: isPreview
        ? { 0: { cellWidth: 8 }, 3: { cellWidth: 20, halign: "center" }, 4: { cellWidth: 18, halign: "center" } }
        : {
            0: { cellWidth: 8, halign: "center" },
            3: { halign: "right", fontStyle: "bold" },
            4: { halign: "center", cellWidth: 20 },
          },
      // autoTable handles inter-page row overflow automatically.
       margin: getTableMargin(),
      didDrawPage: (hookData) => {
        // Re-draw the continuation header whenever autoTable itself adds a page.
        if (hookData.pageNumber > 1) {
          drawContinuationHeader();
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Expiring Certifications ──────────────────────────────────────────────────
  if (data.expiring && data.expiring.length > 0) {
    ensureSpace(22);

    doc.setTextColor(185, 28, 28); // red
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("⚠ PERINGATAN SERTIFIKASI KADALUARSA (< 90 HARI)", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["JENIS", "PEMEGANG", "TGL KADALUARSA", "SISA HARI"]],
      body: data.expiring.map((c) => [
        c.type,
        truncateForPdf(c.holderName, 60),
        format(new Date(c.expiryDate), "dd MMM yyyy"),
        String(c.daysLeft),
      ]),
      theme: "striped",
      headStyles: { fillColor: [185, 28, 28], textColor: 255, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        3: {
          halign: "right",
          fontStyle: "bold",
        },
      },
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.column.index === 3) {
          const days = parseInt(hookData.cell.raw as string, 10);
          if (days < 30) {
            hookData.cell.styles.textColor = [185, 28, 28];
          }
        }
      },
      didDrawPage: (hookData) => {
        if (hookData.pageNumber > 1) {
          drawContinuationHeader();
        }
      },
       margin: getTableMargin(),
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Critical Pain Points ─────────────────────────────────────────────────────
  if (data.criticalPainPoints && data.criticalPainPoints.length > 0) {
    ensureSpace(22);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("PAIN POINTS CRITICAL", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      head: [["ID", "DOMAIN", "DESKRIPSI MASALAH", "SCORE", "PELUANG JASA"]],
      body: data.criticalPainPoints.map((pp) => [
        pp.problemId ?? "-",
        pp.domain ?? "-",
        truncateForPdf(pp.description, 200),
        String(pp.painScore ?? "-"),
        truncateForPdf(pp.serviceOpportunity, 200),
      ]),
      theme: "striped",
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7.5, cellPadding: 2.5, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: "bold", textColor: [124, 58, 237] },
        1: { cellWidth: 20 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 14, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 40 },
      },
      didDrawPage: (hookData) => {
        if (hookData.pageNumber > 1) {
          drawContinuationHeader();
        }
      },
      margin: getTableMargin(),
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    if (hasTruncatedText && i === pageCount) {
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(
        "* Beberapa deskripsi dipotong untuk tampilan. Lihat platform untuk detail lengkap.",
        margin,
        pageH - 16,
      );
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(
      isPreview
        ? "KONFIDENSIAL — PREVIEW SEBELUM PENGIRIMAN"
        : "KONFIDENSIAL — HANYA UNTUK KEPERLUAN INTERNAL TIM MARKETING",
      margin,
      pageH - 7,
    );
    doc.text(`${i} / ${pageCount}`, pageW - margin, pageH - 7, { align: "right" });
  }

  return doc;
}

/**
 * Saves the Briefing Harian PDF to the user's computer.
 */
export function exportDashboardPDF(data: DashboardExportData) {
  const doc = buildPdf(data, { mode: "export" });
  doc.save(`Briefing-Harian-${format(new Date(), "yyyy-MM-dd")}.pdf`);
}

/**
 * Opens the Briefing Harian PDF in a new browser tab for preview.
 * No download prompt — user can review before deciding to save.
 */
export function previewDashboardPDF(data: DashboardExportData): void {
  const doc = buildPdf(data, { mode: "preview" });
  const today = new Date();
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Fallback: download if popup blocked
    doc.save(`Preview-Briefing-${format(today, "yyyy-MM-dd")}.pdf`);
  }
  // Release object URL after 60s
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ─── MKR Executive Brief PDF ──────────────────────────────────────────────────

export function exportMKRPDF(
  options: { download?: boolean } = {},
): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");
  const dateLabel = format(today, "EEEE, dd MMMM yyyy", { locale: idLocale }).toUpperCase();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  const NAV = [15, 23, 42] as [number, number, number];         // dark navy
  const AMBER = [251, 191, 36] as [number, number, number];     // primary
  const SLATE = [148, 163, 184] as [number, number, number];    // muted
  const EMERALD = [16, 185, 129] as [number, number, number];
  const BLUE = [59, 130, 246] as [number, number, number];
  const ORANGE = [249, 115, 22] as [number, number, number];
  const RED = [239, 68, 68] as [number, number, number];
  const PURPLE = [124, 58, 237] as [number, number, number];

  // Helper: add page header strip
  function pageHeader(title: string, sub: string) {
    doc.setFillColor(...NAV);
    doc.rect(0, 0, pageW, 26, "F");
    doc.setTextColor(...AMBER);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("MASTER KNOWLEDGE REGISTRY", margin, 10);
    doc.setTextColor(...SLATE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`PT MAHESWARA JAYA PERSADA  |  ${dateLabel}`, margin, 16);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), pageW - margin, 10, { align: "right" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...SLATE);
    doc.text(sub, pageW - margin, 16, { align: "right" });
  }

  function sectionTitle(doc: jsPDF, text: string, y: number, color: [number, number, number] = NAV): number {
    doc.setTextColor(...color);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin, y);
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1.5, pageW - margin, y + 1.5);
    return y + 6;
  }

  // ── PAGE 1: Cover ─────────────────────────────────────────────────────────────
  doc.setFillColor(...NAV);
  doc.rect(0, 0, pageW, pageH, "F");

  // Logo area
  doc.setFillColor(...AMBER);
  doc.rect(margin, 30, 12, 12, "F");
  doc.setTextColor(...NAV);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("MK", margin + 2.5, 38.5);

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("MASTER KNOWLEDGE", margin, 60);
  doc.text("REGISTRY", margin, 72);

  doc.setTextColor(...AMBER);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("(MKR)", margin, 80);

  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.5);
  doc.line(margin, 85, pageW - margin, 85);

  doc.setTextColor(...SLATE);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const subtitle = "Setiap sumber adalah Knowledge Asset — bukan sekadar URL. Platform intelijen bisnis berbasis\njaringan sumber data tervalidasi dengan AI Agent untuk pengambilan keputusan real-time.";
  doc.text(subtitle, margin, 93);

  // Cover stats
  const coverStats = [
    { label: "Knowledge Assets", val: String(KNOWLEDGE_REGISTRY.length) },
    { label: "AI Agents Terdaftar", val: String(AI_AGENTS_REGISTRY.length) },
    { label: "Kelompok Taksonomi", val: "20" },
    { label: "Crawler Aktif", val: String(KNOWLEDGE_REGISTRY.filter((s) => s.crawlingStatus === "AKTIF").length) },
    { label: "Sumber dengan API", val: String(KNOWLEDGE_REGISTRY.filter((s) => s.apiAvailable !== "TIDAK").length) },
    { label: "Level 4 — Decision AI", val: String(getByIntegrationLevel(4).length) },
  ];

  let sx = margin;
  const sy = 116;
  const boxW = (pageW - margin * 2 - 10) / 3;

  coverStats.forEach((st, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const bx = margin + col * (boxW + 5);
    const by = sy + row * 22;
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(bx, by, boxW, 18, 2, 2, "F");
    doc.setTextColor(...AMBER);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(st.val, bx + boxW / 2, by + 9, { align: "center" });
    doc.setTextColor(...SLATE);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text(st.label.toUpperCase(), bx + boxW / 2, by + 14.5, { align: "center" });
  });

  // Integration levels
  doc.setTextColor(...AMBER);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DISTRIBUSI TINGKAT INTEGRASI", margin, 168);
  doc.setDrawColor(...AMBER);
  doc.line(margin, 169.5, pageW - margin, 169.5);

  const levelColors: [number, number, number][] = [
    [100, 116, 139], // slate
    [59, 130, 246],  // blue
    [16, 185, 129],  // emerald
    [251, 191, 36],  // amber
  ];
  const levelNames = ["L1 — Knowledge Base", "L2 — Monitoring", "L3 — Opportunity Intel", "L4 — Decision Intel"];
  const lw = (pageW - margin * 2 - 12) / 4;

  [1, 2, 3, 4].forEach((l, i) => {
    const cnt = getByIntegrationLevel(l as 1 | 2 | 3 | 4).length;
    const lx = margin + i * (lw + 4);
    doc.setFillColor(...levelColors[i]);
    doc.roundedRect(lx, 173, lw, 16, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(String(cnt), lx + lw / 2, 181, { align: "center" });
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text(levelNames[i], lx + lw / 2, 185, { align: "center" });
  });

  // Footer
  doc.setTextColor(...SLATE);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("KONFIDENSIAL — HANYA UNTUK KEPERLUAN INTERNAL PT MAHESWARA JAYA PERSADA", margin, pageH - 14);
  doc.text(`Digenerate: ${format(today, "dd/MM/yyyy HH:mm")}`, margin, pageH - 9);

  // ── PAGE 2: Coverage Analysis ─────────────────────────────────────────────────
  doc.addPage();
  pageHeader("Analisis Cakupan", "20 Kelompok Taksonomi MKR");

  let y = 32;
  y = sectionTitle(doc, "PETA CAKUPAN 20 KELOMPOK KNOWLEDGE ASSET", y);

  const coverageColors: Record<string, [number, number, number]> = {
    TINGGI: EMERALD,
    SEDANG: BLUE,
    RENDAH: ORANGE,
    BELUM: RED,
  };

  const covRows = COVERAGE_TAXONOMY.map((g) => {
    const registered = KNOWLEDGE_REGISTRY.filter((a) => a.group === g.group).length;
    const pct = Math.round((registered / g.targetCount) * 100);
    return [
      g.label,
      g.coverageLevel,
      `${registered} / ${g.targetCount}`,
      `${pct}%`,
      g.prioritasEkspansi === 1 ? "🔴 URGENT" : g.prioritasEkspansi === 2 ? "🟡 NORMAL" : "🟢 NANTI",
      g.missingSources.slice(0, 2).join(", ") + (g.missingSources.length > 2 ? " ..." : ""),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["KELOMPOK", "STATUS", "TERDAFTAR / TARGET", "COVERAGE", "PRIORITAS", "MISSING KEY SOURCES"]],
    body: covRows,
    theme: "striped",
    headStyles: { fillColor: NAV, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 36, fontStyle: "bold" },
      1: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: "auto", fontSize: 6.5 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 1) {
        const val = hookData.cell.raw as string;
        hookData.cell.styles.textColor = coverageColors[val] ?? NAV;
      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Progress summary
  const covCounts = { TINGGI: 0, SEDANG: 0, RENDAH: 0, BELUM: 0 };
  COVERAGE_TAXONOMY.forEach((g) => { (covCounts as any)[g.coverageLevel]++; });
  const targetTotal = COVERAGE_TAXONOMY.reduce((s, g) => s + g.targetCount, 0);

  if (y < pageH - 40) {
    y = sectionTitle(doc, "RINGKASAN PROGRESS REGISTRASI", y);
    const summaryRows = [
      ["Knowledge Assets Terdaftar", String(KNOWLEDGE_REGISTRY.length), "dari target", String(targetTotal)],
      ["Coverage keseluruhan", `${Math.round((KNOWLEDGE_REGISTRY.length / targetTotal) * 100)}%`, "dari 20 kelompok", ""],
      ["Kelompok TINGGI coverage", String(covCounts.TINGGI), "Kelompok BELUM ada", String(covCounts.BELUM)],
      ["Grup prioritas URGENT", String(COVERAGE_TAXONOMY.filter(g => g.prioritasEkspansi === 1).length), "AI Agents aktif", String(AI_AGENTS_REGISTRY.filter(a => a.maturity !== "ROADMAP").length)],
    ];
    autoTable(doc, {
      startY: y,
      body: summaryRows,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: "bold", fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 60 },
        1: { fontStyle: "bold", textColor: NAV, cellWidth: 22, halign: "right" },
        2: { fillColor: [248, 250, 252], textColor: [71, 85, 105], cellWidth: 60 },
        3: { fontStyle: "bold", textColor: NAV, cellWidth: 22, halign: "right" },
      },
      margin: { left: margin, right: margin },
    });
  }

  // ── PAGE 3: AI Agent Matrix ───────────────────────────────────────────────────
  doc.addPage();
  pageHeader("AI Agent Matrix", `${AI_AGENTS_REGISTRY.length} Agents × Knowledge Source Dependencies`);

  y = 32;
  y = sectionTitle(doc, "DAFTAR AI AGENT & DEPENDENCY KNOWLEDGE SOURCES", y);

  const maturityColors: Record<string, [number, number, number]> = {
    PRODUKSI: EMERALD,
    BETA: BLUE,
    ROADMAP: [100, 116, 139],
  };

  const agentRows = AI_AGENTS_REGISTRY.map((a) => {
    const depNames = KNOWLEDGE_REGISTRY
      .filter((s) => a.sourceDependencies.includes(s.sourceId))
      .map((s) => s.nama)
      .join(", ");
    const optNames = KNOWLEDGE_REGISTRY
      .filter((s) => a.sourceOptional.includes(s.sourceId))
      .map((s) => s.nama)
      .join(", ");
    return [
      a.nama,
      a.domain,
      a.maturity,
      String(a.businessValue) + "/10",
      depNames || "—",
      optNames || "—",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["AI AGENT", "DOMAIN", "STATUS", "BV", "SUMBER WAJIB", "SUMBER PENGAYA"]],
    body: agentRows,
    theme: "striped",
    headStyles: { fillColor: NAV, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
    styles: { fontSize: 6.5, cellPadding: 2, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold" },
      1: { cellWidth: 18 },
      2: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      4: { cellWidth: "auto", fontSize: 6 },
      5: { cellWidth: "auto", fontSize: 6 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 2) {
        hookData.cell.styles.textColor = maturityColors[hookData.cell.raw as string] ?? NAV;
      }
    },
    margin: { left: margin, right: margin },
  });

  // ── PAGE 4: Top Knowledge Assets ─────────────────────────────────────────────
  doc.addPage();
  pageHeader("Knowledge Assets Prioritas", "Ranked by Business Value");

  y = 32;
  y = sectionTitle(doc, "TOP KNOWLEDGE ASSETS — CRITICAL PATH UNTUK AI DECISION INTELLIGENCE", y);

  const topAssets = [...KNOWLEDGE_REGISTRY]
    .sort((a, b) => b.businessValue - a.businessValue)
    .slice(0, 20);

  const levelLabel: Record<number, string> = {
    1: "L1 — KB",
    2: "L2 — Monitor",
    3: "L3 — Opportunity",
    4: "L4 — Decision",
  };

  const levelFill: Record<number, [number, number, number]> = {
    1: [100, 116, 139],
    2: BLUE,
    3: EMERALD,
    4: [...AMBER] as [number, number, number],
  };

  const assetRows = topAssets.map((s, i) => [
    String(i + 1),
    s.sourceId,
    s.nama,
    levelLabel[s.integrationLevel],
    s.crawlingStatus,
    s.updateFrequency,
    String(s.businessValue) + "/10",
    s.aiAgents.slice(0, 2).join(", "),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "SOURCE ID", "NAMA", "LEVEL", "CRAWL", "UPDATE", "BV", "AI AGENTS"]],
    body: assetRows,
    theme: "striped",
    headStyles: { fillColor: NAV, textColor: AMBER, fontSize: 6.5, fontStyle: "bold" },
    styles: { fontSize: 6.5, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 6, halign: "center" },
      1: { cellWidth: 24, fontStyle: "bold", fontSize: 5.5, textColor: SLATE },
      2: { cellWidth: 34, fontStyle: "bold" },
      3: { cellWidth: 22 },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      7: { cellWidth: "auto", fontSize: 6 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 3) {
        const lvl = parseInt((hookData.cell.raw as string).charAt(1), 10) as 1|2|3|4;
        hookData.cell.styles.textColor = levelFill[lvl] ?? NAV;
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  if (y < pageH - 50) {
    y = sectionTitle(doc, "KNOWLEDGE SUPPLY CHAIN — ALUR DATA KE KEPUTUSAN", y);
    const chainRows = [
      ["1. Sumber Data Primer", "Pemerintah · Standar · Asosiasi · BUMN · Marketplace · Komunitas"],
      ["2. Data Collector & Monitoring", "56 sumber · Crawling jadwal per prioritasCrawl · Alert perubahan otomatis"],
      ["3. Knowledge Validation", "Authority scoring · Freshness check · Deduplication · Source weighting"],
      ["4. Knowledge Base MKR", "Metadata lengkap · Business lifecycle tags · AI agent mappings"],
      ["5. Business AI Suites", "Legal AI · Certification AI · Tender AI · Project AI · Training AI · Market AI"],
      ["6. Decision Intelligence", "Cross-source reasoning · Risk scoring · Opportunity detection · Action recommendation"],
      ["7. Dashboard & Output", "Prioritas hari ini · Alert · Brief PDF · Export Excel · WhatsApp report"],
    ];
    autoTable(doc, {
      startY: y,
      body: chainRows,
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold", fillColor: [248, 250, 252], textColor: NAV },
        1: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });
  }

  // ── PAGE 5: Analyst Notes — High-Priority Groups ─────────────────────────────
  doc.addPage();
  pageHeader("Catatan Analis", "Grup Prioritas URGENT — Rekomendasi Ekspansi");

  y = 32;
  y = sectionTitle(doc, "CATATAN ANALIS — GRUP PRIORITAS EKSPANSI KRITIS (URGENT)", y, RED);

  const urgentGroups = COVERAGE_TAXONOMY.filter((g) => g.prioritasEkspansi === 1);

  const analystRows = urgentGroups.map((g) => {
    const registered = KNOWLEDGE_REGISTRY.filter((a) => a.group === g.group).length;
    const coverage = Math.round((registered / g.targetCount) * 100);
    const topAsset = KNOWLEDGE_REGISTRY
      .filter((a) => a.group === g.group)
      .sort((a, b) => b.businessValue - a.businessValue)[0];
    return [
      g.label,
      g.coverageLevel,
      `${registered} / ${g.targetCount} (${coverage}%)`,
      g.note,
      g.missingSources.slice(0, 3).join("; "),
      topAsset ? `${topAsset.nama} (BV ${topAsset.businessValue}/10)` : "—",
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["GRUP", "STATUS", "COVERAGE", "CATATAN ANALIS", "SUMBER KUNCI HILANG", "ASET TERBAIK SAAT INI"]],
    body: analystRows,
    theme: "grid",
    headStyles: { fillColor: NAV, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
    styles: { fontSize: 7, cellPadding: 2.5, overflow: "linebreak" },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 14, halign: "center", fontStyle: "bold", textColor: RED },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 38, fontSize: 6.5 },
      5: { cellWidth: 30, fontSize: 6.5 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Gap revenue potential section
  y = sectionTitle(doc, "POTENSI REVENUE GAP — ESTIMASI DARI DOMAIN BELUM TERLAYANI", y, EMERALD);

  const gapRows = [
    ["IKN Nusantara Procurement", "KRITIS", "25%", "100+ tender strategis/thn belum terdeteksi", "Rp 50–200 jt/thn"],
    ["Procurement Swasta BUMN", "TINGGI", "35%", "PLN, Pertamina, Wika belum ter-crawl", "Rp 30–120 jt/thn"],
    ["Database Harga Material TKDN", "TINGGI", "40%", "Tidak ada referensi harga real-time untuk penawaran", "Rp 20–80 jt/thn"],
    ["Profil Tenaga Ahli Aktif", "SEDANG", "55%", "SKK BNSP tidak ter-update real-time", "Rp 15–60 jt/thn"],
    ["Analitik Media Sosial", "SEDANG", "60%", "VOC dari LinkedIn/Twitter terbatas manual", "Rp 10–40 jt/thn"],
  ];

  autoTable(doc, {
    startY: y,
    head: [["DOMAIN GAP", "PRIORITAS", "COVERAGE", "IMPAK BISNIS", "ESTIMASI REVENUE"]],
    body: gapRows,
    theme: "striped",
    headStyles: { fillColor: NAV, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
    styles: { fontSize: 7, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: "bold" },
      1: { cellWidth: 16, halign: "center", fontStyle: "bold" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 32, fontStyle: "bold", textColor: EMERALD },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 1) {
        const v = hookData.cell.raw as string;
        hookData.cell.styles.textColor = v === "KRITIS" ? RED : v === "TINGGI" ? ORANGE : BLUE;
      }
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Roadmap 90 hari
  if (y < pageH - 60) {
    y = sectionTitle(doc, "ROADMAP EKSPANSI 90 HARI — DARI GAP KE REVENUE", y, PURPLE);

    const roadmapRows = [
      ["0–30 Hari", "QUICK WIN",
        "Aktifkan crawling otomatis 64 sumber sesuai jadwal frekuensi MKR. Integrasikan IjinTender ke halaman Radar Kompetitor penuh. Koneksikan data tender ke modul Surat Penawaran klien.",
        "Rp 15–30 jt"],
      ["30–60 Hari", "LEVERAGE",
        "Launch white-label API intel untuk partner konsultan. Tambah 10 sumber baru: IKN, BUMN e-proc, HSPK regional. Koneksikan Knowledge Registry ke AI Recommendation engine.",
        "Rp 40–80 jt"],
      ["60–90 Hari", "SCALE",
        "Launch SaaS subscription tier untuk akses platform intel. Jalin MoU data dengan LPJK, INKINDO, dan asosiasi konstruksi. Monetisasi laporan riset industri quarterly.",
        "Rp 80–200 jt"],
    ];

    autoTable(doc, {
      startY: y,
      head: [["FASE", "LABEL", "LANGKAH KUNCI", "EST. IMPACT"]],
      body: roadmapRows,
      theme: "grid",
      headStyles: { fillColor: NAV, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7, cellPadding: 2.5, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: "bold" },
        1: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        2: { cellWidth: "auto" },
        3: { cellWidth: 24, fontStyle: "bold", textColor: EMERALD },
      },
      margin: { left: margin, right: margin },
    });
  }

  // ── Footer all pages ──────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setTextColor(...SLATE);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("KONFIDENSIAL — PT MAHESWARA JAYA PERSADA | MASTER KNOWLEDGE REGISTRY", margin, pageH - 7);
    doc.text(`${i} / ${pageCount}`, pageW - margin, pageH - 7, { align: "right" });
  }

  const blob = doc.output("blob");
  if (options.download !== false) {
    doc.save(`MKR-Executive-Brief-${dateStr}.pdf`);
  }
  return blob;
}

/**
 * Opens the MKR Executive Brief PDF in a new browser tab for preview.
 * No download prompt — user can review before deciding to save.
 */
export function previewMKRPDF(): void {
  const blob = exportMKRPDF({ download: false });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");

  if (!win) {
    // Keep the same fallback behavior as the Briefing Harian preview.
    const link = document.createElement("a");
    link.href = url;
    link.download = `MKR-Executive-Brief-Preview-${format(new Date(), "yyyy-MM-dd")}.pdf`;
    link.click();
  }

  // Keep the blob available while the browser tab loads it, then release it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Resolve the server-provided download path against the current origin.
 * API paths intentionally remain root-relative so they work regardless of
 * the web artifact's configurable Vite base path.
 */
export function resolveMKRShareDownloadUrl(
  downloadPath: string,
  origin = window.location.origin,
): string {
  const baseUrl = new URL(origin);
  const downloadUrl = new URL(downloadPath, baseUrl);
  if (
    downloadUrl.origin !== baseUrl.origin ||
    !downloadUrl.pathname.startsWith("/api/mkr-shares/")
  ) {
    throw new Error("Server mengembalikan tautan PDF MKR yang tidak valid");
  }
  return downloadUrl.toString();
}

export async function createMKRShareDownloadUrl(): Promise<{
  downloadUrl: string;
  expiresAt: string;
}> {
  const pdf = exportMKRPDF({ download: false });
  const share = await createMkrShare(pdf);
  return {
    downloadUrl: resolveMKRShareDownloadUrl(share.downloadPath),
    expiresAt: share.expiresAt,
  };
}

/**
 * Generate a WhatsApp share link for the MKR executive brief.
 * The optional URL parameter keeps the message testable and lets callers
 * reuse a single generated download URL for multiple share channels.
 */
export function getMKRWhatsAppShareUrl(downloadUrl: string): string {
  const total = KNOWLEDGE_REGISTRY.length;
  const aktif = KNOWLEDGE_REGISTRY.filter((s) => s.crawlingStatus === "AKTIF").length;
  const agents = AI_AGENTS_REGISTRY.length;
  const today = format(new Date(), "dd MMM yyyy");

  const text = [
    `📊 *Master Knowledge Registry (MKR) — PT Maheswara Jaya Persada*`,
    `📅 Per: ${today}`,
    ``,
    `🗂️ Knowledge Assets Terdaftar: *${total} sumber*`,
    `🤖 AI Agents Aktif: *${agents} agents*`,
    `⚡ Crawler Aktif: *${aktif} sumber*`,
    ``,
    `MKR adalah fondasi intelijen bisnis kami — setiap sumber adalah Knowledge Asset yang terhubung ke AI untuk pengambilan keputusan real-time. Tersedia sebagai PDF eksekutif untuk presentasi klien dan investor.`,
    ``,
    `📄 *Unduh PDF MKR:* ${downloadUrl}`,
    ``,
    `_Hubungi kami untuk mendapatkan brief lengkap._`,
  ].join("\n");

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Generate an email deep link with a ready-to-send subject and body.
 */
export function getMKREmailShareUrl(downloadUrl: string): string {
  const subject = "Master Knowledge Registry (MKR) — Executive Brief";
  const body = [
    "Yth. Bapak/Ibu,",
    "",
    "Berikut Executive Brief Master Knowledge Registry (MKR) dari PT Maheswara Jaya Persada.",
    "",
    `Unduh PDF MKR: ${downloadUrl}`,
    "",
    "Tautan tersebut akan membuka halaman MKR dan mengunduh PDF secara otomatis.",
    "",
    "Salam,",
    "PT Maheswara Jaya Persada",
  ].join("\n");

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Intelligence Brief PDF ───────────────────────────────────────────────────

export interface IntelligenceBriefData {
  periode: string;
  domain: string;
  categories: string[];
  generatedAt: string;
  regulasi: Array<{
    kode: string;
    judul: string;
    dampak: string;
    status: string;
    ringkasan: string;
    deadline?: string;
    instansi: string;
  }>;
  kompetitor: Array<{
    nama: string;
    ukuran: string;
    ancamanUtama: string;
    peluangUtama: string;
    hargaRange: string;
    rating: number;
  }>;
  vocSignals: Array<{
    kategori: string;
    segment: string;
    terjemahan: string;
    peluangLayanan: string;
    frekuensi: number;
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

export function exportIntelligenceBriefPDF(brief: IntelligenceBriefData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const today = new Date();
  const dateStr = format(today, "yyyy-MM-dd");
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const bodyBottom = pageH - 16;

  const NAVY: [number, number, number] = [15, 23, 42];
  const AMBER: [number, number, number] = [251, 191, 36];
  const SLATE: [number, number, number] = [148, 163, 184];
  const WHITE: [number, number, number] = [255, 255, 255];
  const RED: [number, number, number] = [239, 68, 68];
  const ORANGE: [number, number, number] = [249, 115, 22];
  const TEAL: [number, number, number] = [20, 184, 166];

  let y = 0;

  function drawContinuationHeader() {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(...AMBER);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("LAPORAN INTELIJEN — LANJUTAN", margin, 12);
    doc.setTextColor(...SLATE);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(brief.generatedAt, pageW - margin, 12, { align: "right" });
  }

  function ensureSpace(needed: number) {
    if (y + needed > bodyBottom) {
      doc.addPage();
      drawContinuationHeader();
      y = 24;
    }
  }

  function sectionHead(title: string, subtitle?: string) {
    ensureSpace(16);
    doc.setFillColor(...NAVY);
    doc.rect(margin, y, pageW - margin * 2, 9, "F");
    doc.setTextColor(...AMBER);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 3, y + 6);
    if (subtitle) {
      doc.setTextColor(...SLATE);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(subtitle, pageW - margin - 3, y + 6, { align: "right" });
    }
    y += 12;
  }

  // ── Cover Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setTextColor(...AMBER);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("LAPORAN INTELIJEN", margin, 14);

  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("REGULASI · KOMPETITOR · SINYAL PASAR", margin, 21);

  doc.setTextColor(...SLATE);
  doc.setFontSize(7.5);
  doc.text(`Periode: ${brief.periode}  |  Domain: ${brief.domain}  |  Kategori: ${brief.categories.join(", ")}`, margin, 27);
  doc.text(`Digenerate: ${brief.generatedAt}`, margin, 32);
  doc.text("PT MAHESWARA JAYA PERSADA — KONFIDENSIAL", pageW - margin, 32, { align: "right" });

  y = 44;

  // ── Exec Summary ──────────────────────────────────────────────────────────────
  sectionHead("RINGKASAN EKSEKUTIF");
  const summaryRows: [string, string][] = [
    ["Regulasi Dipantau", `${brief.regulasi.length} regulasi · ${brief.regulasi.filter(r => r.dampak === "KRITIS").length} KRITIS · ${brief.regulasi.filter(r => r.status === "BARU").length} baru`],
    ["Kompetitor Dianalisis", `${brief.kompetitor.length} kompetitor · ${brief.kompetitor.reduce((s, c) => s + (c.ancamanUtama ? 1 : 0), 0)} ancaman aktif`],
    ["Sinyal VOC", `${brief.vocSignals.length} sinyal · ${brief.vocSignals.filter(v => v.frekuensi >= 8).length} frekuensi tinggi`],
    ["Domain Demand Teratas", brief.heatmap.slice(0, 3).map(h => `${h.domain} (${h.demand}%)`).join(" · ")],
    ["Buying Trigger Kritis", `${brief.buyingTriggers.filter(t => t.urgency === "KRITIS").length} trigger kritis dipantau`],
  ];
  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold", fillColor: [248, 250, 252], textColor: NAVY },
      1: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Regulasi Section ─────────────────────────────────────────────────────────
  if (brief.regulasi.length > 0 && brief.categories.includes("Regulasi")) {
    sectionHead("INTELIJEN REGULASI", `${brief.regulasi.length} REGULASI`);
    const regRows = brief.regulasi.map(r => [
      r.kode,
      r.judul,
      r.dampak,
      r.status,
      r.deadline ?? "—",
      r.ringkasan.slice(0, 120) + (r.ringkasan.length > 120 ? "…" : ""),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Kode", "Judul", "Dampak", "Status", "Deadline", "Ringkasan"]],
      body: regRows,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 45 },
        2: { cellWidth: 16 },
        3: { cellWidth: 16 },
        4: { cellWidth: 22 },
        5: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.column.index === 2 && data.section === "body") {
          const v = String(data.cell.raw ?? "");
          if (v === "KRITIS") { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = "bold"; }
          else if (v === "TINGGI") { data.cell.styles.textColor = ORANGE; data.cell.styles.fontStyle = "bold"; }
        }
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Kompetitor Section ────────────────────────────────────────────────────────
  if (brief.kompetitor.length > 0 && brief.categories.includes("Kompetitor")) {
    ensureSpace(20);
    sectionHead("INTELIJEN KOMPETITOR", `${brief.kompetitor.length} KOMPETITOR`);
    const kompRows = brief.kompetitor.map(k => [
      k.nama,
      k.ukuran,
      k.hargaRange,
      `${k.rating}/5`,
      k.ancamanUtama,
      k.peluangUtama,
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Nama", "Ukuran", "Harga", "Rating", "Ancaman Utama", "Peluang dari Mereka"]],
      body: kompRows,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 16 },
        2: { cellWidth: 28 },
        3: { cellWidth: 13 },
        4: { cellWidth: "auto" },
        5: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Sinyal Pasar Section ──────────────────────────────────────────────────────
  if (brief.vocSignals.length > 0 && brief.categories.includes("Pasar")) {
    ensureSpace(20);
    sectionHead("SINYAL PASAR — VOICE OF CUSTOMER", `${brief.vocSignals.length} SINYAL`);
    const vocRows = brief.vocSignals.map(v => [
      v.kategori,
      v.segment,
      `${v.frekuensi}/10`,
      v.terjemahan,
      v.peluangLayanan,
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Tipe", "Segmen", "Frekuensi", "Masalah / Keinginan", "Peluang Layanan"]],
      body: vocRows,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 30 },
        2: { cellWidth: 16 },
        3: { cellWidth: "auto" },
        4: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Demand Heatmap Section ────────────────────────────────────────────────────
  if (brief.heatmap.length > 0 && brief.categories.includes("Pasar")) {
    ensureSpace(20);
    sectionHead("HEATMAP PERMINTAAN PASAR", `TOP ${brief.heatmap.length} DOMAIN`);
    const heatRows = brief.heatmap.map(h => [
      h.domain,
      `${h.demand}%`,
      h.growth,
      h.topPain,
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Domain Layanan", "Demand Index", "Growth", "Pain Utama"]],
      body: heatRows,
      theme: "striped",
      headStyles: { fillColor: NAVY, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 20, halign: "center", textColor: TEAL, fontStyle: "bold" },
        3: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Buying Triggers Section ───────────────────────────────────────────────────
  if (brief.buyingTriggers.length > 0 && brief.categories.includes("Pasar")) {
    ensureSpace(20);
    sectionHead("BUYING TRIGGERS — PEMICU KEBUTUHAN KLIEN", `${brief.buyingTriggers.length} TRIGGER`);
    const trigRows = brief.buyingTriggers.map(t => [
      t.trigger,
      t.urgency,
      t.channel,
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Trigger / Pemicu", "Urgensi", "Channel Aksi"]],
      body: trigRows,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: AMBER, fontSize: 7, fontStyle: "bold" },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 60 },
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === "body") {
          const v = String(data.cell.raw ?? "");
          if (v === "KRITIS") { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = "bold"; }
          else if (v === "TINGGI") { data.cell.styles.textColor = ORANGE; data.cell.styles.fontStyle = "bold"; }
        }
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Footer all pages ─────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setTextColor(...SLATE);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("KONFIDENSIAL — PT MAHESWARA JAYA PERSADA | LAPORAN INTELIJEN", margin, pageH - 7);
    doc.text(`${i} / ${pageCount}`, pageW - margin, pageH - 7, { align: "right" });
  }

  doc.save(`Laporan-Intelijen-${dateStr}.pdf`);
}
