import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, tenderOpportunitiesTable } from "@workspace/db";
import {
  ListTenderOpportunitiesQueryParams,
  CreateTenderOpportunityBody,
  CreateTenderOpportunityResponse,
  GetTenderOpportunityParams,
  GetTenderOpportunityResponse,
  UpdateTenderOpportunityParams,
  UpdateTenderOpportunityBody,
  UpdateTenderOpportunityResponse,
  ListTenderOpportunitiesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tender-opportunities", async (req, res): Promise<void> => {
  const query = ListTenderOpportunitiesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db.select().from(tenderOpportunitiesTable).orderBy(desc(tenderOpportunitiesTable.createdAt));

  let items = rows;
  if (query.data.status) {
    items = items.filter((r) => r.status === query.data.status);
  }
  if (query.data.province) {
    const p = query.data.province.toLowerCase();
    items = items.filter((r) => r.province.toLowerCase().includes(p));
  }

  res.json(ListTenderOpportunitiesResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/tender-opportunities", async (req, res): Promise<void> => {
  const parsed = CreateTenderOpportunityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.insert(tenderOpportunitiesTable).values(parsed.data).returning();
  res.status(201).json(CreateTenderOpportunityResponse.parse(item));
});

router.get("/tender-opportunities/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTenderOpportunityParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db.select().from(tenderOpportunitiesTable).where(eq(tenderOpportunitiesTable.id, params.data.id));
  if (!item) {
    res.status(404).json({ error: "Tender opportunity not found" });
    return;
  }

  res.json(GetTenderOpportunityResponse.parse(item));
});

router.patch("/tender-opportunities/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTenderOpportunityParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTenderOpportunityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.update(tenderOpportunitiesTable)
    .set(parsed.data)
    .where(eq(tenderOpportunitiesTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Tender opportunity not found" });
    return;
  }

  res.json(UpdateTenderOpportunityResponse.parse(item));
});

router.delete("/tender-opportunities/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(tenderOpportunitiesTable).where(eq(tenderOpportunitiesTable.id, id)).returning({ id: tenderOpportunitiesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Tender opportunity not found" });
    return;
  }
  res.status(204).send();
});

export default router;
