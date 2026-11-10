import { pgTable, serial, timestamp, text, boolean } from "drizzle-orm/pg-core";

/**
 * Stores WhatsApp subscribers who want PBG (Persetujuan Bangunan Gedung) alerts
 * for specific cities. When the daily scheduler detects new PBG-related data
 * for a watched city, it sends a WhatsApp alert to each enabled subscriber.
 */
export const pbgSubscriptionsTable = pgTable("pbg_subscriptions", {
  id: serial("id").primaryKey(),
  /** WhatsApp number in international format, e.g. 6281234567890 */
  whatsapp: text("whatsapp").notNull(),
  /** Human-readable label for this subscriber */
  label: text("label").notNull().default(""),
  /**
   * Comma-separated list of watched cities, e.g. "Jakarta,Surabaya,Bandung".
   * Stored as text for simplicity; split on comma when reading.
   */
  cities: text("cities").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PbgSubscription = typeof pbgSubscriptionsTable.$inferSelect;
export type InsertPbgSubscription = typeof pbgSubscriptionsTable.$inferInsert;
