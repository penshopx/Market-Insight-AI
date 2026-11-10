import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const painPointsTable = pgTable("pain_points", {
  id: serial("id").primaryKey(),
  // CPKB structured fields
  problemId: text("problem_id"),         // e.g. "TDR-001", "SKK-002"
  domain: text("domain"),                // TENDER | SBU | SKK | OSS | ISO | SMK3 | LEGAL | DOKUMEN | ESTIMASI | PROYEK | KEUANGAN | SDM | KNOWLEDGE | REGULASI | MARKETING | DIGITALISASI
  subdomain: text("subdomain"),          // e.g. "Administrasi", "Teknis", "Keuangan"
  painScore: real("pain_score"),         // 1–10 numeric
  affectedRoles: text("affected_roles"), // comma-separated: "Direktur, Admin Tender"
  rootCause: text("root_cause"),
  businessImpact: text("business_impact"),
  sdmGap: text("sdm_gap"),
  manualSolution: text("manual_solution"),
  digitalSolution: text("digital_solution"),
  aiSolution: text("ai_solution"),
  linkedAiAgent: text("linked_ai_agent"), // e.g. "TenderClaw"
  serviceOpportunity: text("service_opportunity"), // e.g. "Jasa Review Tender"
  crossReferences: text("cross_references"), // comma-separated problem IDs
  // Original fields (keep for backward compat)
  segment: text("segment").notNull().default("KONTRAKTOR"),
  description: text("description").notNull(),
  frequency: text("frequency").default("SERING"), // HARIAN | MINGGUAN | BULANAN | SANGAT_SERING | SERING
  priority: text("priority").notNull().default("MEDIUM"),
  category: text("category"),
  productIdea: text("product_idea"),
  status: text("status").notNull().default("OPEN"),
  evidencePhotoUrl: text("evidence_photo_url"),  // object-storage path or data URL
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPainPointSchema = createInsertSchema(painPointsTable).omit({ id: true, createdAt: true });
export type InsertPainPoint = z.infer<typeof insertPainPointSchema>;
export type PainPoint = typeof painPointsTable.$inferSelect;
