import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketingStrategiesTable = pgTable("marketing_strategies", {
  id: serial("id").primaryKey(),
  linkedProductId: integer("linked_product_id"),
  linkedPainPointId: integer("linked_pain_point_id"),
  strategyTitle: text("strategy_title").notNull(),
  strategyType: text("strategy_type").notNull(),
  targetAudience: text("target_audience").notNull(),
  channels: text("channels").notNull(),
  keyMessages: text("key_messages"),
  callToAction: text("call_to_action"),
  timeline: text("timeline"),
  budget: text("budget"),
  kpi: text("kpi"),
  fastMovingTactic: text("fast_moving_tactic"),
  status: text("status").notNull().default("PLANNED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketingStrategySchema = createInsertSchema(marketingStrategiesTable).omit({ id: true, createdAt: true });
export type InsertMarketingStrategy = z.infer<typeof insertMarketingStrategySchema>;
export type MarketingStrategy = typeof marketingStrategiesTable.$inferSelect;
