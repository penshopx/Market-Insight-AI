import { pgTable, serial, timestamp, text, boolean } from "drizzle-orm/pg-core";

export const notificationSettingsTable = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(), // 'email' | 'whatsapp'
  recipient: text("recipient").notNull(), // email address or phone number (intl format, e.g. 6281234567890)
  label: text("label").notNull().default(""),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationSetting = typeof notificationSettingsTable.$inferSelect;
export type InsertNotificationSetting = typeof notificationSettingsTable.$inferInsert;
