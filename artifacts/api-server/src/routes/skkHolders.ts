import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, skkHoldersTable } from "@workspace/db";
import {
  ListSkkHoldersQueryParams,
  CreateSkkHolderBody,
  CreateSkkHolderResponse,
  UpdateSkkHolderParams,
  UpdateSkkHolderBody,
  UpdateSkkHolderResponse,
  ListSkkHoldersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/skk-holders", async (req, res): Promise<void> => {
  const query = ListSkkHoldersQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db.select().from(skkHoldersTable).orderBy(desc(skkHoldersTable.createdAt));

  let items = rows;
  if (query.data.jenjang) {
    items = items.filter((r) => r.jenjang === String(query.data.jenjang));
  }
  if (query.data.jabatanKerja) {
    const j = query.data.jabatanKerja.toLowerCase();
    items = items.filter((r) => (r.jabatanKerja?.toLowerCase() ?? r.specialization.toLowerCase()).includes(j));
  }
  if (query.data.specialization) {
    const s = query.data.specialization.toLowerCase();
    items = items.filter((r) => r.specialization.toLowerCase().includes(s));
  }
  if (query.data.available !== undefined) {
    const avail = query.data.available === "true";
    items = items.filter((r) => r.available === avail);
  }

  res.json(ListSkkHoldersResponse.parse(items.map(r => ({
    ...r,
    jenjang: parseInt(String(r.jenjang), 10),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }))));
});

router.post("/skk-holders", async (req, res): Promise<void> => {
  const parsed = CreateSkkHolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const insertData = { ...parsed.data, jenjang: String(parsed.data.jenjang) };
  const [item] = await db.insert(skkHoldersTable).values(insertData).returning();
  res.status(201).json(CreateSkkHolderResponse.parse(item));
});

router.patch("/skk-holders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateSkkHolderParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSkkHolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.jenjang !== undefined) {
    updateData.jenjang = String(parsed.data.jenjang);
  }
  const [item] = await db.update(skkHoldersTable)
    .set(updateData)
    .where(eq(skkHoldersTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "SKK holder not found" });
    return;
  }
  res.json(UpdateSkkHolderResponse.parse(item));
});

router.delete("/skk-holders/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(skkHoldersTable).where(eq(skkHoldersTable.id, id)).returning({ id: skkHoldersTable.id });
  if (!deleted) {
    res.status(404).json({ error: "SKK holder not found" });
    return;
  }
  res.status(204).send();
});

export default router;
