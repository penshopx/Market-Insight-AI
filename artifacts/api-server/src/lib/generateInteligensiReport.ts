/**
 * #80 — Laporan Intelijen: a second PDF attachment included in the 07:00 daily briefing.
 * Focuses on competitive intelligence, regulatory signals, and market opportunity highlights
 * — complementing the operational briefing with strategic depth.
 */

import PDFDocument from "pdfkit";
import { format } from "date-fns";
import type { BriefingData } from "./generateBriefingPDF";

/** Returns a Buffer containing the Laporan Intelijen PDF. */
export async function generateInteligensiReport(data: BriefingData, dateLabel: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const genTime = format(new Date(), "dd/MM/yyyy HH:mm");

    // ── Cover header ─────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill("#0f172a");

    doc.fillColor("#fbbf24").font("Helvetica-Bold").fontSize(18).text("LAPORAN INTELIJEN", 40, 18);
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(9)
      .text("PLATFORM RISET MARKETING KONSTRUKSI", 40, 43)
      .text(`${dateLabel.toUpperCase()} · DIGENERATE: ${genTime}`, 40, 56);

    // Red "CONFIDENTIAL" stamp
    doc.fillColor("#ef4444").font("Helvetica-Bold").fontSize(8)
      .text("CONFIDENTIAL — INTERNAL USE ONLY", 40, 56, { align: "right", width: doc.page.width - 80 });

    let y = 100;

    // ── Section 1: Regulatory Intelligence ───────────────────────────────────
    doc.rect(40, y, doc.page.width - 80, 20).fill("#1e293b");
    doc.fillColor("#fbbf24").font("Helvetica-Bold").fontSize(9)
      .text("01  REGULATORY INTELLIGENCE", 46, y + 6);
    y += 26;

    const regTrends = data.trends.filter((t) =>
      ["REGULATORY", "COMPLIANCE", "CERTIFICATION"].includes(t.category),
    );

    if (regTrends.length > 0) {
      for (const t of regTrends.slice(0, 4)) {
        const severity = t.count >= 4 ? "KRITIS" : t.count >= 2 ? "TINGGI" : "SEDANG";
        const sColor = severity === "KRITIS" ? "#dc2626" : severity === "TINGGI" ? "#ea580c" : "#ca8a04";

        doc.rect(40, y, 4, 28).fill(sColor);
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5)
          .text(t.topic.substring(0, 90), 50, y + 2, { width: doc.page.width - 120 });
        doc.fillColor(sColor).font("Helvetica-Bold").fontSize(7)
          .text(`${severity} · ${t.count} sinyal · ${t.category.replace("_", " ")}`, 50, y + 14, { width: doc.page.width - 120 });
        doc.fillColor("#64748b").font("Helvetica").fontSize(7)
          .text(`Rekomendasi: Evaluasi dampak ke klien aktif dan update pitch deck sesuai perubahan regulasi.`, 50, y + 23, { width: doc.page.width - 120 });
        y += 36;
      }
    } else {
      doc.fillColor("#64748b").font("Helvetica").fontSize(8)
        .text("Tidak ada sinyal regulasi baru terdeteksi dalam 24 jam terakhir.", 40, y);
      y += 20;
    }

    y += 8;

    // ── Section 2: Market Opportunity Signals ─────────────────────────────────
    doc.rect(40, y, doc.page.width - 80, 20).fill("#1e293b");
    doc.fillColor("#fbbf24").font("Helvetica-Bold").fontSize(9)
      .text("02  PELUANG PASAR — SINYAL AKTIF", 46, y + 6);
    y += 26;

    const marketTrends = data.trends.filter((t) =>
      !["REGULATORY", "COMPLIANCE", "CERTIFICATION"].includes(t.category),
    ).slice(0, 5);

    if (marketTrends.length > 0) {
      // Header row
      const cols = [200, 100, 70, 90];
      const headers = ["TOPIK PASAR", "KATEGORI", "FREKUENSI", "TREN"];
      let x = 40;
      for (let i = 0; i < headers.length; i++) {
        doc.rect(x, y, cols[i]!, 14).fill("#334155");
        doc.fillColor("#94a3b8").font("Helvetica-Bold").fontSize(7)
          .text(headers[i]!, x + 3, y + 4, { width: cols[i]! - 6 });
        x += cols[i]!;
      }
      y += 14;

      for (const t of marketTrends) {
        const bg = marketTrends.indexOf(t) % 2 === 0 ? "#f8fafc" : "#ffffff";
        x = 40;
        const row = [
          t.topic.substring(0, 55),
          t.category.replace("_", " ").substring(0, 20),
          `${t.count}× mention`,
          t.trend === "UP" ? "↑ NAIK" : t.trend === "DOWN" ? "↓ TURUN" : "→ STABIL",
        ];
        for (let i = 0; i < row.length; i++) {
          doc.rect(x, y, cols[i]!, 16).fill(bg);
          doc.rect(x, y, cols[i]!, 16).stroke("#e2e8f0");
          doc.fillColor("#0f172a").font("Helvetica").fontSize(7.5)
            .text(row[i]!, x + 3, y + 5, { width: cols[i]! - 6 });
          x += cols[i]!;
        }
        y += 16;
      }
    } else {
      doc.fillColor("#64748b").font("Helvetica").fontSize(8)
        .text("Tidak ada sinyal pasar baru terdeteksi.", 40, y);
      y += 16;
    }

    y += 12;

    // ── Section 3: Critical Pain Points (Strategic Opportunities) ────────────
    if (y > 680) { doc.addPage(); y = 40; }

    doc.rect(40, y, doc.page.width - 80, 20).fill("#1e293b");
    doc.fillColor("#fbbf24").font("Helvetica-Bold").fontSize(9)
      .text("03  PAIN POINT STRATEGIS — PELUANG KONVERSI", 46, y + 6);
    y += 26;

    const painPoints = data.criticalPainPoints.slice(0, 4);
    if (painPoints.length > 0) {
      for (const pp of painPoints) {
        const score = pp.painScore ?? 0;
        const barW = Math.round(((doc.page.width - 120) * score) / 10);

        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8)
          .text(`Score: ${score}/10`, 40, y);
        doc.rect(40, y + 12, barW, 6).fill(score >= 9 ? "#dc2626" : "#ea580c");
        doc.rect(40, y + 12, doc.page.width - 120, 6).stroke("#e2e8f0");
        y += 22;

        if (pp.description) {
          doc.fillColor("#334155").font("Helvetica").fontSize(8)
            .text(pp.description.substring(0, 150), 40, y, { width: doc.page.width - 80 });
          y += doc.heightOfString(pp.description.substring(0, 150), { width: doc.page.width - 80 }) + 4;
        }
        if (pp.serviceOpportunity) {
          doc.fillColor("#2563eb").font("Helvetica-Bold").fontSize(7.5)
            .text(`→ Peluang: ${pp.serviceOpportunity}`, 40, y, { width: doc.page.width - 80 });
          y += 14;
        }
        y += 6;
      }
    } else {
      doc.fillColor("#64748b").font("Helvetica").fontSize(8)
        .text("Tidak ada pain point kritis terdeteksi saat ini.", 40, y);
      y += 16;
    }

    y += 10;

    // ── Footer ────────────────────────────────────────────────────────────────
    if (y > 750) { doc.addPage(); y = 40; }
    doc.rect(40, y, doc.page.width - 80, 1).fill("#e2e8f0");
    y += 8;
    doc.fillColor("#94a3b8").font("Helvetica").fontSize(7)
      .text(
        `Laporan Intelijen otomatis dari Platform Riset Marketing Konstruksi · ${dateLabel} · Sumber: DB internal + sinyal crawling`,
        40, y, { width: doc.page.width - 80, align: "center" as const },
      );

    doc.end();
  });
}
