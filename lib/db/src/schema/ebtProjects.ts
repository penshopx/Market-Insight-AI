import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ebtProjectsTable = pgTable("ebt_projects", {
  id: serial("id").primaryKey(),
  judul: text("judul").notNull(),
  teknologi: text("teknologi").notNull(), // PLTS, PLTB, PLTA, PLTM, PLTBG, PLTBm, PLTMH, HYBRID
  kapasitasMw: real("kapasitas_mw"),
  status: text("status").notNull().default("PLANNING"), // PLANNING, CONSTRUCTION, OPERATIONAL, CANCELLED
  provinsi: text("provinsi"),
  lokasi: text("lokasi"),
  tahunTarget: text("tahun_target"),
  pemrakarsa: text("pemrakarsa"), // developer/owner
  jenisPemrakarsa: text("jenis_pemrakarsa"), // IPP, PLN, PEMERINTAH, SWASTA
  sumber: text("sumber"),
  sourceUrl: text("source_url"),
  dataSourceSite: text("data_source_site"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEbtProjectSchema = createInsertSchema(ebtProjectsTable).omit({ id: true, createdAt: true });
export type InsertEbtProject = z.infer<typeof insertEbtProjectSchema>;
export type EbtProject = typeof ebtProjectsTable.$inferSelect;
