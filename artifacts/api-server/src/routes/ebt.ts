import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, ebtProjectsTable, ebtTendersTable } from "@workspace/db";
import {
  ListEbtProjectsQueryParams,
  CreateEbtProjectBody,
  CreateEbtProjectResponse,
  GetEbtProjectParams,
  GetEbtProjectResponse,
  UpdateEbtProjectParams,
  UpdateEbtProjectBody,
  UpdateEbtProjectResponse,
  ListEbtProjectsResponse,
  ListEbtTendersQueryParams,
  CreateEbtTenderBody,
  CreateEbtTenderResponse,
  GetEbtTenderParams,
  GetEbtTenderResponse,
  UpdateEbtTenderParams,
  UpdateEbtTenderBody,
  UpdateEbtTenderResponse,
  ListEbtTendersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── EBT Projects (RUPTL / IPP) ───────────────────────────────────────────────

router.get("/ebt-projects", async (req, res): Promise<void> => {
  const query = ListEbtProjectsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const rows = await db.select().from(ebtProjectsTable).orderBy(desc(ebtProjectsTable.createdAt));

  let items = rows;
  if (query.data.teknologi) {
    items = items.filter((r) => r.teknologi === query.data.teknologi);
  }
  if (query.data.status) {
    items = items.filter((r) => r.status === query.data.status);
  }
  if (query.data.provinsi) {
    const p = query.data.provinsi.toLowerCase();
    items = items.filter((r) => r.provinsi?.toLowerCase().includes(p));
  }

  res.json(ListEbtProjectsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/ebt-projects", async (req, res): Promise<void> => {
  const parsed = CreateEbtProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.insert(ebtProjectsTable).values(parsed.data).returning();
  res.status(201).json(CreateEbtProjectResponse.parse({ ...item, createdAt: item!.createdAt.toISOString() }));
});

router.get("/ebt-projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetEbtProjectParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [item] = await db.select().from(ebtProjectsTable).where(eq(ebtProjectsTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "EBT project not found" }); return; }

  res.json(GetEbtProjectResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

router.patch("/ebt-projects/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateEbtProjectParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateEbtProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.update(ebtProjectsTable).set(parsed.data).where(eq(ebtProjectsTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "EBT project not found" }); return; }

  res.json(UpdateEbtProjectResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

// ── EBT Tenders (PLN pengadaan) ───────────────────────────────────────────────

router.get("/ebt-tenders", async (req, res): Promise<void> => {
  const query = ListEbtTendersQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const rows = await db.select().from(ebtTendersTable).orderBy(desc(ebtTendersTable.createdAt));

  let items = rows;
  if (query.data.teknologi) {
    items = items.filter((r) => r.teknologi === query.data.teknologi);
  }
  if (query.data.status) {
    items = items.filter((r) => r.status === query.data.status);
  }
  if (query.data.provinsi) {
    const p = query.data.provinsi.toLowerCase();
    items = items.filter((r) => r.provinsi?.toLowerCase().includes(p));
  }

  res.json(ListEbtTendersResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/ebt-tenders", async (req, res): Promise<void> => {
  const parsed = CreateEbtTenderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.insert(ebtTendersTable).values(parsed.data).returning();
  res.status(201).json(CreateEbtTenderResponse.parse({ ...item, createdAt: item!.createdAt.toISOString() }));
});

router.get("/ebt-tenders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetEbtTenderParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [item] = await db.select().from(ebtTendersTable).where(eq(ebtTendersTable.id, params.data.id));
  if (!item) { res.status(404).json({ error: "EBT tender not found" }); return; }

  res.json(GetEbtTenderResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

router.patch("/ebt-tenders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateEbtTenderParams.safeParse({ id: parseInt(raw!, 10) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateEbtTenderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.update(ebtTendersTable).set(parsed.data).where(eq(ebtTendersTable.id, params.data.id)).returning();
  if (!item) { res.status(404).json({ error: "EBT tender not found" }); return; }

  res.json(UpdateEbtTenderResponse.parse({ ...item, createdAt: item.createdAt.toISOString() }));
});

export default router;
