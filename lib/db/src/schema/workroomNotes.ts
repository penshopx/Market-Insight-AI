import { pgTable, serial, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Stores Workroom analysis notes shared across team members.
 * Each row is one atomic note attached to either a pain_point or research_item.
 * service_links are stored as a pipe-delimited list of serviceIds.
 * The unique constraint on (entity_type, entity_id) enables ON CONFLICT DO UPDATE upserts.
 */
export const workroomNotesTable = pgTable("workroom_notes", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // "pain_point" | "research_item" | "service_link"
  entityId: integer("entity_id").notNull(),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default(""),
  serviceIds: text("service_ids"), // pipe-delimited ints, for entity_type="service_link"
  authorName: text("author_name"), // display name of the last editor
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("workroom_notes_entity_type_entity_id_unique").on(t.entityType, t.entityId),
]);

export const insertWorkroomNoteSchema = createInsertSchema(workroomNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkroomNote = z.infer<typeof insertWorkroomNoteSchema>;
export type WorkroomNote = typeof workroomNotesTable.$inferSelect;
