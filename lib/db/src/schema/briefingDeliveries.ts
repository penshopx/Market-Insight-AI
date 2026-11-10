import { pgTable, serial, timestamp, text, boolean, integer } from "drizzle-orm/pg-core";

/**
 * Tracks daily briefing delivery attempts.
 * delivery_date (YYYY-MM-DD in WIB) is UNIQUE — this is the idempotency key.
 * Inserting a row claims the delivery slot; a unique-constraint failure means
 * the briefing was already sent/claimed for that day.
 */
export const briefingDeliveriesTable = pgTable("briefing_deliveries", {
  id: serial("id").primaryKey(),
  deliveryDate: text("delivery_date").notNull().unique(), // YYYY-MM-DD in WIB (UTC+7)
  status: text("status").notNull().default("PENDING"), // PENDING | SUCCESS | PARTIAL | FAILED
  pdfGenerated: boolean("pdf_generated").notNull().default(false),
  successCount: integer("success_count").notNull().default(0),
  failCount: integer("fail_count").notNull().default(0),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BriefingDelivery = typeof briefingDeliveriesTable.$inferSelect;
export type InsertBriefingDelivery = typeof briefingDeliveriesTable.$inferInsert;
