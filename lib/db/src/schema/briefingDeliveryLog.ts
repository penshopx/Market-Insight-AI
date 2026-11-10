import { pgTable, serial, timestamp, text } from "drizzle-orm/pg-core";

/**
 * Per-recipient audit log for every briefing delivery attempt.
 * One row per recipient per delivery run.
 * This complements briefing_deliveries (the daily idempotency/summary row)
 * with fine-grained per-channel-per-recipient outcomes.
 */
export const briefingDeliveryLogTable = pgTable("briefing_delivery_log", {
  id: serial("id").primaryKey(),
  deliveryDate: text("delivery_date").notNull(), // YYYY-MM-DD in WIB — ties to briefing_deliveries.delivery_date
  channel: text("channel").notNull(), // "email" | "whatsapp"
  recipient: text("recipient").notNull(),
  status: text("status").notNull(), // "SUCCESS" | "FAILED"
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BriefingDeliveryLog = typeof briefingDeliveryLogTable.$inferSelect;
export type InsertBriefingDeliveryLog = typeof briefingDeliveryLogTable.$inferInsert;
