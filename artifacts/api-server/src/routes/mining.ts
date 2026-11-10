import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, miningProjectsTable } from "@workspace/db";
import {
  ListMiningProjectsQueryParams,
  CreateMiningProjectBody,
  CreateMiningProjectResponse,
  GetMiningProjectParams,
  GetMiningProjectResponse,
  UpdateMiningProjectParams,
  UpdateMiningProjectBody,
  UpdateMiningProjectResponse,
  ListMiningProjectsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/mining-projects", async (req, res): Promise<void> => {
  const query = ListMiningProjectsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const rows = await db.select().from(miningProjectsTable).orderBy(desc(miningProjectsTable.createdAt));

  let items = rows;
  if (query.data.komoditas) {
    items = items.filter((r) => r.komoditas === query.data.komoditas);
  }
  if (query.data.statusIup) {
    items = items.filter((r) => r.statusIup === query.data.statusIup);
  }
  if (query.data.provinsi) {
    const p = query.data.provinsi.toLowerCase();
    items = items.filter((r) => r.provinsi?.toLowerCase().includes(p));
  }

  res.json(ListMiningProjectsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/mining-projects", async (req, res): Promise<void> => {
  const parsed = CreateMiningProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.insert(miningProjectsTable).values(parsed.data).returning();
  res.status(201).json(CreateMiningProjectResponse.parse({ ...item, createdAt: item!.createdAt.toISOString() }));
});

router.get("/mining-projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetMiningProjectParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [item] = await db.select().from(miningProjectsTable).where(eq(miningProjectsTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "Mining project not found" }); return; }

  res.json(GetMiningProjectResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

router.patch("/mining-projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateMiningProjectParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateMiningProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.update(miningProjectsTable).set(parsed.data).where(eq(miningProjectsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "Mining project not found" }); return; }

  res.json(UpdateMiningProjectResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

export default router;
