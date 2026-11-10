import { Router, type IRouter } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, researchItemsTable } from "@workspace/db";
import {
  ListResearchItemsQueryParams,
  CreateResearchItemBody,
  CreateResearchItemResponse,
  GetResearchItemParams,
  GetResearchItemResponse,
  UpdateResearchItemParams,
  UpdateResearchItemBody,
  UpdateResearchItemResponse,
  DeleteResearchItemParams,
  ListResearchItemsResponse,
  ListResearchItemsByCategoryResponse,
} from "@workspace/api-zod";
import { CORE_RESEARCH_DOMAINS, VISIBLE_RESEARCH_CATEGORIES, isCoreResearchCategory } from "../lib/researchScope";

const router: IRouter = Router();

router.get("/research-items", async (req, res): Promise<void> => {
  const query = ListResearchItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let dbQuery = db.select().from(researchItemsTable).orderBy(desc(researchItemsTable.createdAt));

  const rows = await dbQuery;

  let items = rows.filter((r) => isCoreResearchCategory(r.category));
  if (query.data.category) {
    items = items.filter((r) => r.category === query.data.category);
  }
  if (query.data.status) {
    items = items.filter((r) => r.status === query.data.status);
  }
  if (query.data.dataSourceSite) {
    items = items.filter((r) => r.dataSourceSite === query.data.dataSourceSite);
  }
  if (query.data.limit) {
    items = items.slice(0, Number(query.data.limit));
  }

  res.json(ListResearchItemsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/research-items", async (req, res): Promise<void> => {
  const parsed = CreateResearchItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!CORE_RESEARCH_DOMAINS.includes(parsed.data.category as (typeof CORE_RESEARCH_DOMAINS)[number])) {
    res.status(400).json({
      error: "Kategori riset harus Legalitas & Perijinan, SBU, SKK, Tender, atau Proyek.",
    });
    return;
  }

  // COMPETITOR_PRICING rows are reference data managed by the team — default to ACTIVE.
  // All other research items start as PENDING for human review.
  const defaultStatus = parsed.data.category === "COMPETITOR_PRICING" ? "ACTIVE" : "PENDING";
  const [item] = await db.insert(researchItemsTable).values({
    ...parsed.data,
    status: defaultStatus,
  }).returning();

  res.status(201).json(CreateResearchItemResponse.parse(item));
});

router.get("/research-items/by-category", async (_req, res): Promise<void> => {
  const rows = await db.select({
    category: researchItemsTable.category,
    count: sql<number>`count(*)::int`,
    latestAt: sql<string>`max(${researchItemsTable.createdAt})`,
    pendingCount: sql<number>`count(*) filter (where ${researchItemsTable.status} = 'PENDING')::int`,
    reviewedCount: sql<number>`count(*) filter (where ${researchItemsTable.status} = 'REVIEWED')::int`,
  })
    .from(researchItemsTable)
    .where(inArray(researchItemsTable.category, [...VISIBLE_RESEARCH_CATEGORIES]))
    .groupBy(researchItemsTable.category)
    .orderBy(sql`count(*) desc`);

  res.json(ListResearchItemsByCategoryResponse.parse(rows));
});

router.get("/research-items/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetResearchItemParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db.select().from(researchItemsTable).where(eq(researchItemsTable.id, params.data.id));
  if (!item) {
    res.status(404).json({ error: "Research item not found" });
    return;
  }

  res.json(GetResearchItemResponse.parse(item));
});

router.patch("/research-items/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateResearchItemParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateResearchItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.update(researchItemsTable)
    .set(parsed.data)
    .where(eq(researchItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Research item not found" });
    return;
  }

  res.json(UpdateResearchItemResponse.parse(item));
});

router.delete("/research-items/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteResearchItemParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db.delete(researchItemsTable)
    .where(eq(researchItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Research item not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
