import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const competitorSignalsTable = pgTable("competitor_signals", {
  id: serial("id").primaryKey(),
  category: text("category").notNull().default("COMPETITOR_PRICING"),
  title: text("title").notNull(),
  summary: text("summary"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  dataSourceSite: text("data_source_site"),
  collectedAt: text("collected_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("competitor_signals_dedup_idx").on(table.dataSourceSite, table.title, table.collectedAt),
]);

export const insertCompetitorSignalSchema = createInsertSchema(competitorSignalsTable).omit({ id: true, createdAt: true });
export type InsertCompetitorSignal = z.infer<typeof insertCompetitorSignalSchema>;
export type CompetitorSignal = typeof competitorSignalsTable.$inferSelect;
