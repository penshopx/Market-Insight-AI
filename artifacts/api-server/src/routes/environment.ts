import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, environmentProjectsTable } from "@workspace/db";
import {
  ListEnvironmentProjectsQueryParams,
  CreateEnvironmentProjectBody,
  CreateEnvironmentProjectResponse,
  GetEnvironmentProjectParams,
  GetEnvironmentProjectResponse,
  UpdateEnvironmentProjectParams,
  UpdateEnvironmentProjectBody,
  UpdateEnvironmentProjectResponse,
  ListEnvironmentProjectsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/environment-projects", async (req, res): Promise<void> => {
  const query = ListEnvironmentProjectsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const rows = await db.select().from(environmentProjectsTable).orderBy(desc(environmentProjectsTable.createdAt));

  let items = rows;
  if (query.data.jenis) {
    items = items.filter((r) => r.jenis === query.data.jenis);
  }
  if (query.data.sektor) {
    items = items.filter((r) => r.sektor === query.data.sektor);
  }
  if (query.data.provinsi) {
    const p = query.data.provinsi.toLowerCase();
    items = items.filter((r) => r.provinsi?.toLowerCase().includes(p));
  }

  res.json(ListEnvironmentProjectsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/environment-projects", async (req, res): Promise<void> => {
  const parsed = CreateEnvironmentProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.insert(environmentProjectsTable).values(parsed.data).returning();
  res.status(201).json(CreateEnvironmentProjectResponse.parse({ ...item, createdAt: item!.createdAt.toISOString() }));
});

router.get("/environment-projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetEnvironmentProjectParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [item] = await db.select().from(environmentProjectsTable).where(eq(environmentProjectsTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "Environment project not found" }); return; }

  res.json(GetEnvironmentProjectResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

router.patch("/environment-projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateEnvironmentProjectParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateEnvironmentProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.update(environmentProjectsTable).set(parsed.data).where(eq(environmentProjectsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "Environment project not found" }); return; }

  res.json(UpdateEnvironmentProjectResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

export default router;
