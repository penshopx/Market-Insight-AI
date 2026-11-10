import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Stores the most recent successful crawl for each configured source.
 *
 * This is intentionally separate from scheduler_runs: run rows are operational
 * logs and may be pruned, while this row is the durable source-level cursor
 * used by the crawl schedule.
 */
export const sourceCrawlHistoryTable = pgTable("source_crawl_history", {
  sourceId: text("source_id").primaryKey(),
  lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }).notNull(),
  itemsSaved: integer("items_saved").notNull().default(0),
  status: text("status").notNull(),
});

export type SourceCrawlHistory = typeof sourceCrawlHistoryTable.$inferSelect;
export type InsertSourceCrawlHistory = typeof sourceCrawlHistoryTable.$inferInsert;