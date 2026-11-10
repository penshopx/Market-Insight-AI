import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const environmentProjectsTable = pgTable("environment_projects", {
  id: serial("id").primaryKey(),
  judul: text("judul").notNull(),
  jenis: text("jenis").notNull(), // AMDAL, UKL_UPL, SPPL, CARBON_PROJECT, GREEN_BOND, PROPER
  pemrakarsa: text("pemrakarsa"),
  sektor: text("sektor"), // TAMBANG, EBT, INDUSTRI, INFRASTRUKTUR, PERTANIAN, dll
  statusAmdal: text("status_amdal"), // PENGAJUAN, PROSES, DISETUJUI, DITOLAK
  peringkatProper: text("peringkat_proper"), // EMAS, HIJAU, BIRU, MERAH, HITAM
  provinsi: text("provinsi"),
  nilaiKarbon: real("nilai_karbon"), // dalam ton CO2e
  nilaiProyek: real("nilai_proyek"), // dalam juta rupiah
  tahun: text("tahun"),
  sumber: text("sumber"),
  sourceUrl: text("source_url"),
  dataSourceSite: text("data_source_site"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnvironmentProjectSchema = createInsertSchema(environmentProjectsTable).omit({ id: true, createdAt: true });
export type InsertEnvironmentProject = z.infer<typeof insertEnvironmentProjectSchema>;
export type EnvironmentProject = typeof environmentProjectsTable.$inferSelect;
