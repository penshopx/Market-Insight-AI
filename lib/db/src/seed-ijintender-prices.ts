/**
 * Seed: IjinTender competitor reference prices as COMPETITOR_PRICING research items.
 * This replaces the hardcoded IJINTENDER_PRICES array in surat-penawaran.tsx.
 *
 * Price data stored in summary as JSON: { minPrice, maxPrice, notes, subCategory }
 * Sub-category stored in tags field for filtering.
 *
 * Run: /home/runner/workspace/scripts/node_modules/.bin/tsx lib/db/src/seed-ijintender-prices.ts
 */
import { db, researchItemsTable } from "./index";

const COLLECTED_AT = "2026-08-03T00:00:00.000Z";

const prices: {
  service: string;
  subCategory: string;
  minPrice: number;
  maxPrice: number;
  notes: string;
}[] = [
  { subCategory: "SBU", service: "Pengurusan SBU Kecil", minPrice: 3_000_000, maxPrice: 6_000_000, notes: "Termasuk pendampingan LPJK" },
  { subCategory: "SBU", service: "Pengurusan SBU Menengah", minPrice: 7_000_000, maxPrice: 15_000_000, notes: "Proses 7–14 hari kerja" },
  { subCategory: "SBU", service: "Pengurusan SBU Besar", minPrice: 20_000_000, maxPrice: 40_000_000, notes: "Termasuk audit kelayakan" },
  { subCategory: "SKK", service: "Jasa SKK Level 6 (SKA Muda)", minPrice: 2_500_000, maxPrice: 5_000_000, notes: "Via LSP terakreditasi" },
  { subCategory: "SKK", service: "Jasa SKK Level 7 (SKA Madya)", minPrice: 3_500_000, maxPrice: 7_000_000, notes: "Uji kompetensi 3–5 hari" },
  { subCategory: "SKK", service: "Jasa SKK Level 9 (SKA Utama)", minPrice: 5_000_000, maxPrice: 10_000_000, notes: "Senioritas & pengalaman wajib" },
  { subCategory: "SMAP", service: "Dokumen SMAP ISO 37001", minPrice: 2_000_000, maxPrice: 4_000_000, notes: "Template dokumen + SOP" },
  { subCategory: "SMAP", service: "Sertifikasi ISO 37001 (Non KAN)", minPrice: 12_000_000, maxPrice: 18_000_000, notes: "Bervariasi per lembaga" },
  { subCategory: "Sewa Alat", service: "Sewa Alat SBU Kecil", minPrice: 4_000_000, maxPrice: 6_500_000, notes: "Per 3 tahun" },
  { subCategory: "Sewa Alat", service: "Sewa Alat SBU Menengah/Spesialis", minPrice: 6_500_000, maxPrice: 9_000_000, notes: "Per 3 tahun" },
  { subCategory: "ISO & Sistem Manajemen", service: "Dokumen ISO 9001:2015", minPrice: 3_000_000, maxPrice: 6_000_000, notes: "Template + SOP mutu" },
  { subCategory: "ISO & Sistem Manajemen", service: "Sertifikat ISO 9001 (Non KAN)", minPrice: 15_000_000, maxPrice: 25_000_000, notes: "Surveilans 1x/tahun" },
  { subCategory: "ISO & Sistem Manajemen", service: "Dokumen ISO 45001 / SMK3", minPrice: 3_500_000, maxPrice: 7_000_000, notes: "Termasuk RKK per proyek" },
  { subCategory: "Konsultasi & Pelatihan", service: "Konsultasi SBU/SKK (1 sesi)", minPrice: 500_000, maxPrice: 1_000_000, notes: "Zoom/tatap muka 90 menit" },
  { subCategory: "Konsultasi & Pelatihan", service: "Pelatihan In-House SKK (1 hari)", minPrice: 4_000_000, maxPrice: 7_000_000, notes: "Maks 15 peserta" },
];

async function seed() {
  console.log("Seeding IjinTender competitor prices (non-destructive — uses ON CONFLICT DO NOTHING)…");

  // Uses ON CONFLICT DO NOTHING so team-managed updates in the DB are never overwritten.
  // The unique constraint is on (data_source_site, title, collected_at).
  // Existing rows with the same key are skipped; only genuinely new rows are inserted.
  const rows = prices.map((p) => ({
    category: "COMPETITOR_PRICING",
    title: p.service,
    summary: JSON.stringify({ minPrice: p.minPrice, maxPrice: p.maxPrice, notes: p.notes, subCategory: p.subCategory }),
    source: "ijintender.co.id",
    sourceUrl: "https://ijintender.co.id",
    dataSourceSite: "ijintender.co.id",
    status: "ACTIVE",
    tags: p.subCategory,
    collectedAt: COLLECTED_AT,
  }));

  const result = await db
    .insert(researchItemsTable)
    .values(rows)
    .onConflictDoNothing();
  console.log(`Inserted ${rows.length} rows (existing rows skipped via ON CONFLICT DO NOTHING).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
