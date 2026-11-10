/**
 * Tests for exportDashboardPDF and previewDashboardPDF.
 *
 * Verifies that both functions:
 *  1. Do not throw when given a large dataset (20 trends, 15 pain points, 12 expiring certs).
 *  2. Produce a PDF with more than one page, proving that page-break logic fires.
 *
 * Implementation note: jsPDF v4 attaches save/addPage/output as OWN instance
 * properties (not prototype methods), so vi.spyOn(jsPDF.prototype, …) does not
 * work. Instead we subclass jsPDF and patch those own properties in the
 * constructor after super() sets them.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import type { DashboardExportData } from "./export-pdf";

// ── jsPDF mock ───────────────────────────────────────────────────────────────
// Collected state for the last constructed doc; reset per-test via the factory.
let _lastAddPageCount = 0;
let _lastSave: ReturnType<typeof vi.fn>;
let _lastGetNumberOfPages: () => number;
let _lastTextValues: string[] = [];
let _lastFootnoteLayout: { tableFinalY: number; footnoteY: number } | null = null;

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>();
  const OriginalJsPDF = mod.default;

  class PatchedJsPDF extends (OriginalJsPDF as any) {
    constructor(...args: ConstructorParameters<typeof OriginalJsPDF>) {
      super(...args);
      // Reset per-instance counters (tests run serially in a single file).
      _lastAddPageCount = 0;
      _lastTextValues = [];
      _lastFootnoteLayout = null;

      // Wrap addPage (own property) to count calls, then delegate to original.
      const origAddPage = (this as any).addPage.bind(this);
      (this as any).addPage = vi.fn((...a: unknown[]) => {
        _lastAddPageCount++;
        return origAddPage(...a);
      });

      // Replace save (own property) with a no-op so no file download fires.
      _lastSave = vi.fn();
      (this as any).save = _lastSave;

      // Capture getNumberOfPages so tests can read final page count.
      const internalRef = (this as any).internal;
      _lastGetNumberOfPages = () => internalRef.getNumberOfPages();

      // Capture text drawn by the PDF so user-visible notices can be asserted.
      const origText = (this as any).text.bind(this);
      (this as any).text = vi.fn((text: unknown, ...a: unknown[]) => {
        if (typeof text === "string") {
          _lastTextValues.push(text);
          if (text === TRUNCATION_FOOTNOTE) {
            _lastFootnoteLayout = {
              tableFinalY: (this as any).lastAutoTable?.finalY,
              footnoteY: a[1] as number,
            };
          }
        }
        return origText(text, ...a);
      });
    }
  }

  return { default: PatchedJsPDF };
});

// ── Browser API stubs ────────────────────────────────────────────────────────
// jsdom does not implement URL.createObjectURL / URL.revokeObjectURL.
beforeAll(() => {
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(() => "blob:mock-url"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    writable: true,
    configurable: true,
    value: vi.fn(),
  });
  // window.open returns null → triggers the popup-blocked fallback in previewDashboardPDF.
  vi.stubGlobal("open", vi.fn(() => null));
  vi.useFakeTimers();
});

// ── Test data ────────────────────────────────────────────────────────────────

function buildLargeData(): DashboardExportData {
  const trends = Array.from({ length: 20 }, (_, i) => ({
    topic: `Topik Trending ${i + 1} — konstruksi gedung bertingkat dan infrastruktur jalan tol serta kawasan industri`,
    category: i % 2 === 0 ? "TENDER" : "REGULASI",
    count: 100 - i * 3,
    trend: (["UP", "DOWN", "FLAT"] as const)[i % 3],
  }));

  const expiring = Array.from({ length: 12 }, (_, i) => ({
    type: i % 2 === 0 ? "SKK" : "SBU",
    holderName: `PT Kontraktor Jaya Makmur Sejahtera ${i + 1} — Jl. Sudirman No. ${i + 10}, Jakarta Pusat`,
    expiryDate: new Date(Date.now() + (i + 1) * 7 * 24 * 3600 * 1000).toISOString(),
    daysLeft: (i + 1) * 7,
  }));

  const criticalPainPoints = Array.from({ length: 15 }, (_, i) => ({
    problemId: `PP-${String(i + 1).padStart(3, "0")}`,
    domain: i % 3 === 0 ? "TENDER" : i % 3 === 1 ? "SDM" : "REGULASI",
    description:
      `Deskripsi masalah kritis nomor ${i + 1}: hambatan utama tim dalam proses pengadaan ` +
      `dan manajemen sertifikasi tenaga ahli di lapangan yang berdampak pada efisiensi ` +
      `operasional secara keseluruhan dan menghambat pertumbuhan bisnis perusahaan.`,
    painScore: 8 + (i % 3),
    affectedRoles: "Manajer Proyek, Tim Legal, Estimator, Direktur Operasional",
    serviceOpportunity:
      `Peluang jasa ${i + 1}: konsultasi regulasi konstruksi dan pendampingan pengajuan ` +
      `dokumen tender, audit SKK, serta pelatihan intensif tim internal perusahaan.`,
  }));

  return {
    summary: {
      totalResearchItems: 1250,
      openTenders: 87,
      totalContractors: 340,
      totalSkkHolders: 512,
      expiringCertifications: expiring.length,
      todayCollected: 43,
      lastUpdated: new Date().toISOString(),
    },
    trends,
    expiring,
    criticalPainPoints,
  };
}

const TRUNCATION_FOOTNOTE =
  "* Beberapa deskripsi dipotong untuk tampilan. Lihat platform untuk detail lengkap.";

function buildShortData(): DashboardExportData {
  return {
    trends: [{ topic: "Topik singkat", category: "TENDER", count: 3, trend: "UP" }],
    expiring: [{
      type: "SKK",
      holderName: "PT Singkat",
      expiryDate: new Date().toISOString(),
      daysLeft: 7,
    }],
    criticalPainPoints: [{
      problemId: "PP-001",
      domain: "TENDER",
      description: "Masalah singkat",
      painScore: 8,
      serviceOpportunity: "Peluang singkat",
    }],
  };
}

function buildCriticalOnlyData(): DashboardExportData {
  return {
    criticalPainPoints: Array.from({ length: 30 }, (_, i) => ({
      problemId: `PP-${String(i + 1).padStart(3, "0")}`,
      domain: "TENDER",
      description: `Masalah kritis ${i + 1}: ${"D".repeat(220)}`,
      painScore: 9,
      serviceOpportunity: `Peluang jasa ${i + 1}: ${"P".repeat(220)}`,
    })),
  };
}

// ── Tests: exportDashboardPDF ─────────────────────────────────────────────────

describe("exportDashboardPDF", () => {
  it("does not throw with a large dataset (20 trends, 12 expiring, 15 pain points)", async () => {
    const { exportDashboardPDF } = await import("./export-pdf");
    expect(() => exportDashboardPDF(buildLargeData())).not.toThrow();
  });

  it("calls save exactly once per invocation", async () => {
    const { exportDashboardPDF } = await import("./export-pdf");
    exportDashboardPDF(buildLargeData());
    expect(_lastSave).toHaveBeenCalledOnce();
  });

  it("produces more than one page with large data (page-break logic is active)", async () => {
    const { exportDashboardPDF } = await import("./export-pdf");
    exportDashboardPDF(buildLargeData());
    // addPage is called at least once → total pages > 1.
    expect(_lastAddPageCount).toBeGreaterThan(0);
  });

  it("final page count is greater than 1 according to jsPDF internal state", async () => {
    const { exportDashboardPDF } = await import("./export-pdf");
    exportDashboardPDF(buildLargeData());
    expect(_lastGetNumberOfPages()).toBeGreaterThan(1);
  });

  it("does not throw with minimal / empty data", async () => {
    const { exportDashboardPDF } = await import("./export-pdf");
    expect(() => exportDashboardPDF({})).not.toThrow();
  });

  it("adds a truncation footnote only when a cell was shortened", async () => {
    const { exportDashboardPDF } = await import("./export-pdf");
    exportDashboardPDF(buildShortData());
    expect(_lastTextValues).not.toContain(TRUNCATION_FOOTNOTE);

    exportDashboardPDF(buildCriticalOnlyData());
    expect(_lastTextValues).toContain(TRUNCATION_FOOTNOTE);
    expect(_lastAddPageCount).toBeGreaterThan(0);
    expect(_lastFootnoteLayout).not.toBeNull();
    expect(_lastFootnoteLayout!.tableFinalY).toBeLessThan(_lastFootnoteLayout!.footnoteY - 2);
  });
});

// ── Tests: previewDashboardPDF ────────────────────────────────────────────────

describe("previewDashboardPDF", () => {
  it("does not throw with a large dataset (20 trends, 12 expiring, 15 pain points)", async () => {
    const { previewDashboardPDF } = await import("./export-pdf");
    expect(() => previewDashboardPDF(buildLargeData())).not.toThrow();
  });

  it("produces more than one page with large data (page-break logic is active)", async () => {
    const { previewDashboardPDF } = await import("./export-pdf");
    previewDashboardPDF(buildLargeData());
    expect(_lastAddPageCount).toBeGreaterThan(0);
  });

  it("final page count is greater than 1 according to jsPDF internal state", async () => {
    const { previewDashboardPDF } = await import("./export-pdf");
    previewDashboardPDF(buildLargeData());
    expect(_lastGetNumberOfPages()).toBeGreaterThan(1);
  });

  it("calls URL.createObjectURL to build the preview blob URL", async () => {
    const { previewDashboardPDF } = await import("./export-pdf");
    vi.mocked(URL.createObjectURL).mockClear();
    previewDashboardPDF(buildLargeData());
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });

  it("falls back to doc.save when window.open is blocked (returns null)", async () => {
    // window.open is already stubbed to return null → previewDashboardPDF falls back to save.
    const { previewDashboardPDF } = await import("./export-pdf");
    previewDashboardPDF(buildLargeData());
    expect(_lastSave).toHaveBeenCalledOnce();
  });

  it("does not throw with minimal / empty data", async () => {
    const { previewDashboardPDF } = await import("./export-pdf");
    expect(() => previewDashboardPDF({})).not.toThrow();
  });

  it("adds a truncation footnote only when a cell was shortened", async () => {
    const { previewDashboardPDF } = await import("./export-pdf");
    previewDashboardPDF(buildShortData());
    expect(_lastTextValues).not.toContain(TRUNCATION_FOOTNOTE);

    previewDashboardPDF(buildCriticalOnlyData());
    expect(_lastTextValues).toContain(TRUNCATION_FOOTNOTE);
    expect(_lastAddPageCount).toBeGreaterThan(0);
    expect(_lastFootnoteLayout).not.toBeNull();
    expect(_lastFootnoteLayout!.tableFinalY).toBeLessThan(_lastFootnoteLayout!.footnoteY - 2);
  });
});

describe("MKR public sharing", () => {
  it("generates a PDF blob without forcing a local download", async () => {
    const { exportMKRPDF } = await import("./export-pdf");
    const blob = exportMKRPDF({ download: false });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(_lastSave).not.toHaveBeenCalled();
  });

  it("keeps shared download paths on the API origin regardless of web base path", async () => {
    const { resolveMKRShareDownloadUrl } = await import("./export-pdf");
    expect(
      resolveMKRShareDownloadUrl(
        "/api/mkr-shares/signed-token",
        "https://example.com/nested/web-base/",
      ),
    ).toBe("https://example.com/api/mkr-shares/signed-token");
  });

  it("puts the public PDF URL in both WhatsApp and email messages", async () => {
    const {
      getMKREmailShareUrl,
      getMKRWhatsAppShareUrl,
    } = await import("./export-pdf");
    const downloadUrl = "https://example.com/api/mkr-shares/signed-token";
    const whatsapp = new URL(getMKRWhatsAppShareUrl(downloadUrl));
    const email = getMKREmailShareUrl(downloadUrl);

    expect(whatsapp.hostname).toBe("wa.me");
    expect(whatsapp.searchParams.get("text")).toContain(downloadUrl);
    expect(decodeURIComponent(email)).toContain(downloadUrl);
  });
});
