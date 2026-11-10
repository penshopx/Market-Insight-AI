import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const outputProductsTable = pgTable("output_products", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // INFOGRAPHIC | VIDEO | MODUL | PODCAST | EBOOK
  title: text("title").notNull(),
  description: text("description"),
  targetSegment: text("target_segment").notNull().default("SEMUA"),
  linkedPainPointIds: text("linked_pain_point_ids"),
  keyMessages: text("key_messages"),
  format: text("format"),
  platform: text("platform"),
  status: text("status").notNull().default("DRAFT"),
  publishedAt: text("published_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOutputProductSchema = createInsertSchema(outputProductsTable).omit({ id: true, createdAt: true });
export type InsertOutputProduct = z.infer<typeof insertOutputProductSchema>;
export type OutputProduct = typeof outputProductsTable.$inferSelect;
