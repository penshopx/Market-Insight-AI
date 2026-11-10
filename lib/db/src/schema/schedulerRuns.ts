import { pgTable, serial, integer, timestamp, jsonb, text } from "drizzle-orm/pg-core";

export interface CollectionSourceResult {
  sourceId: string;
  sourceName: string;
  status: "SUCCESS" | "PARTIAL" | "BLOCKED" | "ERROR";
  itemsSaved: number;
  itemsSkipped: number;
  errorMessage?: string | null;
}

export interface StoredNotificationResult {
  channel: string;
  success: boolean;
  sentAt: string;
  errorMessage?: string | null;
  httpStatus?: number | null;
}

export type SchedulerRunStatus = "RUNNING" | "COMPLETED" | "INTERRUPTED";

export const schedulerRunsTable = pgTable("scheduler_runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("COMPLETED"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  /** Null while the run is still in progress (status = "RUNNING"). */
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  totalItemsSaved: text("total_items_saved").notNull().default("0"),
  results: jsonb("results").$type<CollectionSourceResult[]>().notNull().default([]),
  notificationResult: jsonb("notification_result").$type<StoredNotificationResult | null>().default(null),
  /**
   * State machine for the outbound webhook notification:
   *   NULL     — not yet attempted (pre-feature runs are backfilled to SENT on first migration)
   *   PENDING  — run is COMPLETED, notification dispatch not started yet
   *   SENDING  — webhook call in flight; acts as a lease (prevents concurrent re-dispatch)
   *   SENT     — notification successfully delivered
   *   FAILED   — last attempt failed; eligible for retry on next server start
   *
   * On restart, recovery retries rows in NULL/PENDING/FAILED state, plus rows
   * that have been stuck in SENDING beyond the lease timeout (10 min).
   */
  notificationStatus: text("notification_status"),
  /**
   * Set to NOW() each time this run's notification_status transitions to 'SENDING'.
   * Used by startup recovery to distinguish a fresh in-flight claim (< 10 min) from a
   * stale one (server crashed before the lease was released). Never used as the
   * "notification sent" time — that is recorded in notificationSentAt.
   */
  notificationLeaseAt: timestamp("notification_lease_at", { withTimezone: true }),
  /** Set only when notificationStatus = 'SENT'. Null otherwise.
   *  Used as the confirmed-delivery timestamp for display in the history panel. */
  notificationSentAt: timestamp("notification_sent_at", { withTimezone: true }),
  /**
   * Counts how many startup-recovery notification dispatch attempts have failed
   * for this run. Startup recovery stops retrying once this reaches 3, preventing
   * the server from hammering a permanently-broken webhook endpoint.
   */
  notificationRetryCount: integer("notification_retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SchedulerRun = typeof schedulerRunsTable.$inferSelect;
export type InsertSchedulerRun = typeof schedulerRunsTable.$inferInsert;
