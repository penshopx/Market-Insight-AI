/**
 * Server-side PDF generation for the daily briefing report.
 * Uses pdfkit (Node.js native) to produce a Buffer.
 */

import PDFDocument from "pdfkit";
import { format } from "date-fns";

export interface BriefingData {
  summary: {
    totalResearchItems: number;
    openTenders: number;
    totalContractors: number;
    totalSkkHolders: number;
    expiringCertifications: number;
    todayCollected: number;
  };
  trends: Array<{
    topic: string;
    category: string;
    count: number;
    trend?: string;
  }>;
  expiring: Array<{
    type: string;
    holderName: string;
    expiryDate: string;
    daysLeft: number;
  }>;
  criticalPainPoints: Array<{
    problemId?: string | null;
    domain?: string | null;
    description?: string | null;
    painScore?: number | null;
    serviceOpportunity?: string | null;
  }>;
}

/** Returns a Buffer containing the PDF bytes. */
export async function generateBriefingPDF(data: BriefingData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const today = new Date();
    const dateLabel = format(today, "dd MMMM yyyy").toUpperCase();
    const genTime = format(today, "dd/MM/yyyy HH:mm");

    // ── Header ─────────────────────────────────────────────────────────────────
    doc
      .rect(0, 0, doc.page.width, 70)
      .fill("#0f172a");

    doc
      .fillColor("#fbbf24")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("BRIEFING HARIAN", 40, 18);

    doc
      .fillColor("#94a3b8")
      .font("Helvetica")
      .fontSize(9)
      .text("PLATFORM RISET MARKETING KONSTRUKSI", 40, 37)
      .text(dateLabel, 40, 50);

    doc
      .fillColor("#94a3b8")
      .fontSize(8)
      .text(`DIGENERATE: ${genTime}`, 40, 50, { align: "right", width: doc.page.width - 80 });

    let y = 90;

    // ── Summary Stats ──────────────────────────────────────────────────────────
    doc
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("RINGKASAN STATISTIK HARIAN", 40, y);

    y += 16;

    const statsData = [
      ["Total Item Riset", String(data.summary.totalResearchItems), "Tender Terbuka", String(data.summary.openTenders)],
      ["Kontraktor (BD)", String(data.summary.totalContractors), "Pemegang SKK", String(data.summary.totalSkkHolders)],
      ["Masuk Hari Ini", String(data.summary.todayCollected), "Sertifikasi Expired", String(data.summary.expiringCertifications)],
    ];

    const colW = [140, 80, 140, 80];
    const rowH = 20;

    for (const row of statsData) {
      let x = 40;
      for (let ci = 0; ci < 4; ci++) {
        const isLabel = ci % 2 === 0;
        doc.rect(x, y, colW[ci]!, rowH).fill(isLabel ? "#f8fafc" : "#ffffff");
        doc
          .fillColor(isLabel ? "#475569" : "#0f172a")
          .font(isLabel ? "Helvetica-Bold" : "Helvetica-Bold")
          .fontSize(8)
          .text(row[ci]!, x + 4, y + 6, { width: colW[ci]! - 8 });
        // border
        doc.rect(x, y, colW[ci]!, rowH).stroke("#e2e8f0");
        x += colW[ci]!;
      }
      y += rowH;
    }

    y += 14;

    // ── Trending Topics ────────────────────────────────────────────────────────
    if (data.trends.length > 0) {
      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("TOPIK TRENDING", 40, y);

      y += 14;

      // Header row
      const tHeaders = ["#", "TOPIK", "KATEGORI", "MENTIONS", "TREN"];
      const tColW = [25, 200, 120, 65, 65];
      let x = 40;
      for (let i = 0; i < tHeaders.length; i++) {
        doc.rect(x, y, tColW[i]!, 16).fill("#0f172a");
        doc
          .fillColor("#fbbf24")
          .font("Helvetica-Bold")
          .fontSize(7)
          .text(tHeaders[i]!, x + 3, y + 5, { width: tColW[i]! - 6 });
        x += tColW[i]!;
      }
      y += 16;

      for (let ti = 0; ti < Math.min(data.trends.length, 10); ti++) {
        const t = data.trends[ti]!;
        const bg = ti % 2 === 0 ? "#f8fafc" : "#ffffff";
        const tRow = [
          String(ti + 1),
          t.topic.substring(0, 60),
          t.category.replace("_", " "),
          String(t.count),
          t.trend === "UP" ? "↑ NAIK" : t.trend === "DOWN" ? "↓ TURUN" : "→",
        ];
        x = 40;
        for (let i = 0; i < tRow.length; i++) {
          doc.rect(x, y, tColW[i]!, 15).fill(bg).stroke("#e2e8f0");
          doc
            .fillColor("#0f172a")
            .font("Helvetica")
            .fontSize(7.5)
            .text(tRow[i]!, x + 3, y + 4, { width: tColW[i]! - 6 });
          x += tColW[i]!;
        }
        y += 15;
      }

      y += 12;
    }

    // ── Expiring Certifications ────────────────────────────────────────────────
    if (data.expiring.length > 0) {
      // new page if needed
      if (y > 680) { doc.addPage(); y = 40; }

      doc
        .fillColor("#b91c1c")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("PERINGATAN SERTIFIKASI KADALUARSA (< 90 HARI)", 40, y);

      y += 14;

      const eHeaders = ["JENIS", "PEMEGANG", "TGL KADALUARSA", "SISA HARI"];
      const eColW = [60, 200, 120, 95];
      let x = 40;
      for (let i = 0; i < eHeaders.length; i++) {
        doc.rect(x, y, eColW[i]!, 16).fill("#b91c1c");
        doc
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(7)
          .text(eHeaders[i]!, x + 3, y + 5, { width: eColW[i]! - 6 });
        x += eColW[i]!;
      }
      y += 16;

      for (let ei = 0; ei < Math.min(data.expiring.length, 15); ei++) {
        const c = data.expiring[ei]!;
        const bg = ei % 2 === 0 ? "#fef2f2" : "#ffffff";
        const eRow = [
          c.type,
          c.holderName.substring(0, 40),
          c.expiryDate,
          String(c.daysLeft),
        ];
        x = 40;
        for (let i = 0; i < eRow.length; i++) {
          doc.rect(x, y, eColW[i]!, 15).fill(bg).stroke("#fecaca");
          const isUrgent = i === 3 && c.daysLeft < 30;
          doc
            .fillColor(isUrgent ? "#b91c1c" : "#0f172a")
            .font(isUrgent ? "Helvetica-Bold" : "Helvetica")
            .fontSize(7.5)
            .text(eRow[i]!, x + 3, y + 4, { width: eColW[i]! - 6 });
          x += eColW[i]!;
        }
        y += 15;
      }

      y += 12;
    }

    // ── Critical Pain Points ───────────────────────────────────────────────────
    if (data.criticalPainPoints.length > 0) {
      if (y > 620) { doc.addPage(); y = 40; }

      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("PAIN POINTS CRITICAL", 40, y);

      y += 14;

      const pHeaders = ["ID", "DOMAIN", "DESKRIPSI MASALAH", "SCORE", "PELUANG JASA"];
      const pColW = [60, 80, 180, 45, 110];
      let x = 40;
      for (let i = 0; i < pHeaders.length; i++) {
        doc.rect(x, y, pColW[i]!, 16).fill("#7c3aed");
        doc
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(7)
          .text(pHeaders[i]!, x + 3, y + 5, { width: pColW[i]! - 6 });
        x += pColW[i]!;
      }
      y += 16;

      for (let pi = 0; pi < Math.min(data.criticalPainPoints.length, 10); pi++) {
        const pp = data.criticalPainPoints[pi]!;
        const bg = pi % 2 === 0 ? "#faf5ff" : "#ffffff";
        const pRow = [
          pp.problemId ?? "-",
          pp.domain ?? "-",
          (pp.description ?? "-").substring(0, 80),
          String(pp.painScore ?? "-"),
          (pp.serviceOpportunity ?? "-").substring(0, 50),
        ];
        x = 40;
        const rowLines = Math.max(1, Math.ceil((pp.description ?? "").length / 40));
        const rh = Math.max(15, rowLines * 10);
        for (let i = 0; i < pRow.length; i++) {
          doc.rect(x, y, pColW[i]!, rh).fill(bg).stroke("#e9d5ff");
          doc
            .fillColor(i === 0 ? "#7c3aed" : "#0f172a")
            .font(i === 0 ? "Helvetica-Bold" : "Helvetica")
            .fontSize(7)
            .text(pRow[i]!, x + 3, y + 4, { width: pColW[i]! - 6, lineBreak: true });
          x += pColW[i]!;
        }
        y += rh;
      }
    }

    // ── Footer ─────────────────────────────────────────────────────────────────
    const pageCount = (doc as unknown as { bufferedPageRange: () => { count: number } }).bufferedPageRange?.()?.count ?? 1;
    for (let i = 0; i <= pageCount; i++) {
      try {
        doc.switchToPage(i);
        const pageH = doc.page.height;
        doc
          .moveTo(40, pageH - 30)
          .lineTo(doc.page.width - 40, pageH - 30)
          .stroke("#e2e8f0");
        doc
          .fillColor("#94a3b8")
          .font("Helvetica")
          .fontSize(7)
          .text("KONFIDENSIAL — HANYA UNTUK KEPERLUAN INTERNAL TIM MARKETING", 40, pageH - 22);
      } catch {
        // page may not exist
      }
    }

    doc.end();
  });
}
