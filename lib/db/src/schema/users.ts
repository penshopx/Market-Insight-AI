import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * Platform users — created/updated via Clerk webhook (user.created, user.updated).
 * clerkId is the Clerk user_* id and the unique business key.
 */
export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  /**
   * Review status assigned by admin.
   * PENDING  → default on sign-up (access locked)
   * APPROVED → full platform access granted
   * REJECTED → access denied
   */
  status: text("status").notNull().default("PENDING"),
  /** Company / organisation name (self-reported) */
  company: text("company"),
  /** Free-form notes from admin review */
  adminNote: text("admin_note"),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectUserSchema = createSelectSchema(usersTable);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
