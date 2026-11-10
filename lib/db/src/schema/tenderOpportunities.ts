import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tenderOpportunitiesTable = pgTable("tender_opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  client: text("client").notNull(),
  province: text("province").notNull(),
  city: text("city"),
  estimatedValue: real("estimated_value"),
  deadline: text("deadline"),
  status: text("status").notNull().default("OPEN"),
  source: text("source"),
  sourceUrl: text("source_url"),
  dataSourceSite: text("data_source_site"),
  requirements: text("requirements"),
  sbuRequired: text("sbu_required"),
  lpseCode: text("lpse_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTenderOpportunitySchema = createInsertSchema(tenderOpportunitiesTable).omit({ id: true, createdAt: true });
export type InsertTenderOpportunity = z.infer<typeof insertTenderOpportunitySchema>;
export type TenderOpportunity = typeof tenderOpportunitiesTable.$inferSelect;
