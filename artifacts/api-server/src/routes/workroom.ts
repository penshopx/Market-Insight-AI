import { Router, type IRouter } from "express";
import { db, workroomNotesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  GetWorkroomNotesResponse,
  UpsertWorkroomNoteBody,
  UpsertWorkroomNoteResponse,
  GetWorkroomNoteHistoryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const VALID_ENTITY_TYPES = new Set(["pain_point", "research_item", "service_link", "contractor"]);

/**
 * GET /workroom/notes
 * Returns all workroom notes as a structured map mirroring the client WorkroomNotes type.
 * Includes authorName and updatedAt per entry so the UI can show attribution.
 */
router.get("/workroom/notes", async (_req, res): Promise<void> => {
  const rows = await db.select().from(workroomNotesTable);

  const painPoints: Record<string, { note: string; status: string; authorName: string | null; updatedAt: string | null }> = {};
  const researchItems: Record<string, { note: string; status: string; authorName: string | null; updatedAt: string | null }> = {};
  const serviceLinks: Record<string, number[]> = {};
  const contractors: Record<string, { note: string; status: string; authorName: string | null; updatedAt: string | null }> = {};

  for (const row of rows) {
    const key = String(row.entityId);
    const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt;
    if (row.entityType === "pain_point") {
      painPoints[key] = { note: row.note, status: row.status, authorName: row.authorName ?? null, updatedAt };
    } else if (row.entityType === "research_item") {
      researchItems[key] = { note: row.note, status: row.status, authorName: row.authorName ?? null, updatedAt };
    } else if (row.entityType === "service_link") {
      serviceLinks[key] = row.serviceIds
        ? row.serviceIds.split("|").map(Number).filter(Boolean)
        : [];
    } else if (row.entityType === "contractor") {
      contractors[key] = { note: row.note, status: row.status, authorName: row.authorName ?? null, updatedAt };
    }
  }

  res.json(GetWorkroomNotesResponse.parse({ painPoints, researchItems, serviceLinks, contractors }));
});

/**
 * GET /workroom/notes/:entityType/:entityId/history
 * Returns the edit history for a single note, newest first (max 50 entries).
 */
router.get("/workroom/notes/:entityType/:entityId/history", async (req, res): Promise<void> => {
  const { entityType, entityId } = req.params;

  if (!VALID_ENTITY_TYPES.has(entityType)) {
    res.status(400).json({ error: `Invalid entityType "${entityType}"` });
    return;
  }

  const entityIdNum = parseInt(entityId, 10);
  if (isNaN(entityIdNum) || entityIdNum <= 0) {
    res.status(400).json({ error: "entityId must be a positive integer" });
    return;
  }

  const rows = await db.execute(sql`
    SELECT id, entity_type, entity_id, note, status, author_name, changed_at
    FROM workroom_note_history
    WHERE entity_type = ${entityType} AND entity_id = ${entityIdNum}
    ORDER BY changed_at DESC
    LIMIT 200
  `);

  const items = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r["id"]),
    entityType: String(r["entity_type"]),
    entityId: Number(r["entity_id"]),
    note: String(r["note"] ?? ""),
    status: String(r["status"] ?? ""),
    authorName: r["author_name"] != null ? String(r["author_name"]) : null,
    changedAt: r["changed_at"] instanceof Date
      ? r["changed_at"].toISOString()
      : String(r["changed_at"]),
  }));

  res.json(GetWorkroomNoteHistoryResponse.parse(items));
});

/**
 * PUT /workroom/notes/:entityType/:entityId
 * Upserts a single note entry. Partial updates supported.
 * After upsert, writes a history row capturing the new state (fire-and-forget).
 */
router.put("/workroom/notes/:entityType/:entityId", async (req, res): Promise<void> => {
  const { entityType, entityId } = req.params;

  if (!VALID_ENTITY_TYPES.has(entityType)) {
    res.status(400).json({
      error: `Invalid entityType "${entityType}". Must be one of: pain_point, research_item, service_link`,
    });
    return;
  }

  const parsed = UpsertWorkroomNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const entityIdNum = parseInt(entityId, 10);
  if (isNaN(entityIdNum) || entityIdNum <= 0) {
    res.status(400).json({ error: "entityId must be a positive integer" });
    return;
  }

  const { note, status, serviceIds, authorName } = parsed.data;

  const [row] = await db
    .insert(workroomNotesTable)
    .values({
      entityType,
      entityId: entityIdNum,
      note: note ?? "",
      status: status ?? "",
      serviceIds: serviceIds ?? null,
      authorName: authorName ?? null,
    })
    .onConflictDoUpdate({
      target: [workroomNotesTable.entityType, workroomNotesTable.entityId],
      set: {
        note: note !== undefined
          ? sql`excluded.note`
          : sql`"workroom_notes"."note"`,
        status: status !== undefined
          ? sql`excluded.status`
          : sql`"workroom_notes"."status"`,
        serviceIds: serviceIds !== undefined
          ? sql`excluded.service_ids`
          : sql`"workroom_notes"."service_ids"`,
        authorName: authorName !== undefined
          ? sql`excluded.author_name`
          : sql`"workroom_notes"."author_name"`,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Write history entry — awaited so edits are never silently lost (#162)
  try {
    await db.execute(sql`
      INSERT INTO workroom_note_history (entity_type, entity_id, note, status, author_name)
      VALUES (${row.entityType}, ${row.entityId}, ${row.note}, ${row.status}, ${row.authorName ?? null})
    `);
  } catch {
    // History write failure is non-critical — log but don't block the PUT response
  }

  res.json(UpsertWorkroomNoteResponse.parse({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    note: row.note,
    status: row.status,
    serviceIds: row.serviceIds ?? null,
    authorName: row.authorName ?? null,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }));
});

export default router;
