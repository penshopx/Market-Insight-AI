import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiRecommendationsTable = pgTable("ai_recommendations", {
  id: serial("id").primaryKey(),
  linkedPainPointId: integer("linked_pain_point_id"),
  aiProductName: text("ai_product_name").notNull(),
  description: text("description").notNull(),
  problemSolved: text("problem_solved").notNull(),
  targetUsers: text("target_users").notNull(),
  techStack: text("tech_stack"),
  feasibility: text("feasibility").notNull().default("MEDIUM"),
  priority: text("priority").notNull().default("MEDIUM"),
  estimatedImpact: text("estimated_impact"),
  revenueModel: text("revenue_model"),
  status: text("status").notNull().default("CONCEPT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendationsTable).omit({ id: true, createdAt: true });
export type InsertAiRecommendation = z.infer<typeof insertAiRecommendationSchema>;
export type AiRecommendation = typeof aiRecommendationsTable.$inferSelect;
