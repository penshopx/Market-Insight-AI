import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const researchItemsTable = pgTable("research_items", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  dataSourceSite: text("data_source_site"),
  status: text("status").notNull().default("PENDING"),
  priority: text("priority"),
  tags: text("tags"),
  collectedAt: text("collected_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("research_items_dedup_idx").on(table.dataSourceSite, table.title, table.collectedAt),
]);

export const insertResearchItemSchema = createInsertSchema(researchItemsTable).omit({ id: true, createdAt: true });
export type InsertResearchItem = z.infer<typeof insertResearchItemSchema>;
export type ResearchItem = typeof researchItemsTable.$inferSelect;
