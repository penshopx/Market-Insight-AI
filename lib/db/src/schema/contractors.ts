import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractorsTable = pgTable("contractors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // KONTRAKTOR | KONSULTAN
  sbuLevel: text("sbu_level").notNull(), // MENENGAH | SPESIALIS | BESAR | ASING
  sbuCode: text("sbu_code"),
  sbuExpiry: text("sbu_expiry"),
  bidangUsaha: text("bidang_usaha"),
  subBidang: text("sub_bidang"),
  klasifikasi: text("klasifikasi"),
  npwp: text("npwp"),
  registrationNumber: text("registration_number"),
  address: text("address"),
  province: text("province"),
  city: text("city"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  dataSource: text("data_source"),
  dataSourceUrl: text("data_source_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContractorSchema = createInsertSchema(contractorsTable).omit({ id: true, createdAt: true });
export type InsertContractor = z.infer<typeof insertContractorSchema>;
export type Contractor = typeof contractorsTable.$inferSelect;
