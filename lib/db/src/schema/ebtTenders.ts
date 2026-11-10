import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ebtTendersTable = pgTable("ebt_tenders", {
  id: serial("id").primaryKey(),
  judul: text("judul").notNull(),
  klien: text("klien").notNull().default("PLN"),
  teknologi: text("teknologi"), // PLTS, PLTB, PLTA, PLTM, PLTBG, HYBRID, STORAGE, TRANSMISI
  nilaiEstimasi: real("nilai_estimasi"), // dalam juta rupiah
  provinsi: text("provinsi"),
  deadline: text("deadline"),
  status: text("status").notNull().default("OPEN"), // OPEN, CLOSED, AWARDED, CANCELLED
  sumber: text("sumber"),
  sourceUrl: text("source_url"),
  dataSourceSite: text("data_source_site"),
  catatan: text("catatan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEbtTenderSchema = createInsertSchema(ebtTendersTable).omit({ id: true, createdAt: true });
export type InsertEbtTender = z.infer<typeof insertEbtTenderSchema>;
export type EbtTender = typeof ebtTendersTable.$inferSelect;
