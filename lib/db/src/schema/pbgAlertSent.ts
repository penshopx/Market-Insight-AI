import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";

/**
 * Deduplication + dispatch-lease log for PBG city alerts.
 *
 * Lifecycle of a row:
 *   CLAIMED  — pre-claim inserted before the WA send call; acts as a dispatch lease.
 *              If the process crashes here, recovery logic deletes rows older than
 *              PBG_CLAIM_LEASE_MINUTES so the next run can retry.
 *   DELIVERED — WA send succeeded; row is updated to DELIVERED. Future runs skip
 *              this (subscription_id, research_item_id) pair permanently.
 *
 * A unique index on (subscription_id, research_item_id) ensures only one caller
 * can hold the claim at a time (concurrent INSERT ON CONFLICT DO NOTHING RETURNING).
 * Failed sends delete the CLAIMED row immediately so they retry on the next run.
 */
export const pbgAlertSentTable = pgTable("pbg_alert_sent", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull(),
  researchItemId: integer("research_item_id").notNull(),
  /** CLAIMED | DELIVERED */
  status: text("status").notNull().default("DELIVERED"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
});

export type PbgAlertSent = typeof pbgAlertSentTable.$inferSelect;
export type InsertPbgAlertSent = typeof pbgAlertSentTable.$inferInsert;
