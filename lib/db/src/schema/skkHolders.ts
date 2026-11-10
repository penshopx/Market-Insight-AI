import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skkHoldersTable = pgTable("skk_holders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  jenjang: text("jenjang").notNull(), // "7", "8", "9"
  specialization: text("specialization").notNull(),
  jabatanKerja: text("jabatan_kerja"),
  skkNumber: text("skk_number"),
  skkExpiry: text("skk_expiry"),
  certificationBody: text("certification_body"),
  education: text("education"),
  province: text("province"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  currentEmployer: text("current_employer"),
  available: boolean("available").notNull().default(true),
  dataSource: text("data_source"),
  dataSourceUrl: text("data_source_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkkHolderSchema = createInsertSchema(skkHoldersTable).omit({ id: true, createdAt: true });
export type InsertSkkHolder = z.infer<typeof insertSkkHolderSchema>;
export type SkkHolder = typeof skkHoldersTable.$inferSelect;
