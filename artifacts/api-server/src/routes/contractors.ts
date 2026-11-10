import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, contractorsTable } from "@workspace/db";
import {
  ListContractorsQueryParams,
  CreateContractorBody,
  CreateContractorResponse,
  GetContractorParams,
  GetContractorResponse,
  UpdateContractorParams,
  UpdateContractorBody,
  UpdateContractorResponse,
  ListContractorsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contractors", async (req, res): Promise<void> => {
  const query = ListContractorsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db.select().from(contractorsTable).orderBy(desc(contractorsTable.createdAt));

  let items = rows;
  if (query.data.sbuLevel) {
    items = items.filter((r) => r.sbuLevel === query.data.sbuLevel);
  }
  if (query.data.bidangUsaha) {
    const b = query.data.bidangUsaha.toLowerCase();
    items = items.filter((r) => (r.bidangUsaha?.toLowerCase() ?? "").includes(b));
  }
  if (query.data.province) {
    const p = query.data.province.toLowerCase();
    items = items.filter((r) => (r.province?.toLowerCase() ?? "").includes(p));
  }
  if (query.data.search) {
    const s = query.data.search.toLowerCase();
    items = items.filter((r) =>
      r.name.toLowerCase().includes(s) ||
      (r.province?.toLowerCase() ?? "").includes(s) ||
      (r.city?.toLowerCase() ?? "").includes(s) ||
      (r.bidangUsaha?.toLowerCase() ?? "").includes(s)
    );
  }

  res.json(ListContractorsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/contractors", async (req, res): Promise<void> => {
  const parsed = CreateContractorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(contractorsTable).values(parsed.data).returning();
  res.status(201).json(CreateContractorResponse.parse(item));
});

router.get("/contractors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetContractorParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db.select().from(contractorsTable).where(eq(contractorsTable.id, params.data.id));
  if (!item) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.json(GetContractorResponse.parse(item));
});

router.patch("/contractors/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateContractorParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateContractorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.update(contractorsTable)
    .set(parsed.data)
    .where(eq(contractorsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.json(UpdateContractorResponse.parse(item));
});

router.delete("/contractors/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(contractorsTable).where(eq(contractorsTable.id, id)).returning({ id: contractorsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Contractor not found" });
    return;
  }
  res.status(204).send();
});

export default router;
