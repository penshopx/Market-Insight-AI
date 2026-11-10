import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const miningProjectsTable = pgTable("mining_projects", {
  id: serial("id").primaryKey(),
  nomorIup: text("nomor_iup"),
  pemegang: text("pemegang").notNull(), // company name
  komoditas: text("komoditas").notNull(), // NIKEL, BATUBARA, BAUKSIT, TEMBAGA, EMAS, TIMAH
  statusIup: text("status_iup").notNull().default("AKTIF"), // AKTIF, CNC, DICABUT, HABIS
  jenisIup: text("jenis_iup"), // EKSPLORASI, OPERASI_PRODUKSI
  provinsi: text("provinsi"),
  kabupaten: text("kabupaten"),
  luasHa: real("luas_ha"),
  tahunTerbit: text("tahun_terbit"),
  tahunBerakhir: text("tahun_berakhir"),
  statusRkab: text("status_rkab"), // DISETUJUI, PROSES, BELUM_AJUKAN
  sumber: text("sumber"),
  sourceUrl: text("source_url"),
  dataSourceSite: text("data_source_site"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMiningProjectSchema = createInsertSchema(miningProjectsTable).omit({ id: true, createdAt: true });
export type InsertMiningProject = z.infer<typeof insertMiningProjectSchema>;
export type MiningProject = typeof miningProjectsTable.$inferSelect;
