import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, outputProductsTable } from "@workspace/db";
import {
  ListOutputProductsQueryParams,
  CreateOutputProductBody,
  CreateOutputProductResponse,
  GetOutputProductParams,
  GetOutputProductResponse,
  UpdateOutputProductParams,
  UpdateOutputProductBody,
  UpdateOutputProductResponse,
  DeleteOutputProductParams,
  ListOutputProductsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/output-products", async (req, res): Promise<void> => {
  const query = ListOutputProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select().from(outputProductsTable).orderBy(desc(outputProductsTable.createdAt));
  let items = rows;
  if (query.data.type) {
    items = items.filter((r) => r.type === query.data.type);
  }
  if (query.data.status) {
    items = items.filter((r) => r.status === query.data.status);
  }
  if (query.data.targetSegment) {
    items = items.filter((r) => r.targetSegment === query.data.targetSegment);
  }
  res.json(ListOutputProductsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/output-products", async (req, res): Promise<void> => {
  const parsed = CreateOutputProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(outputProductsTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "DRAFT",
  }).returning();
  res.status(201).json(CreateOutputProductResponse.parse(item));
});

router.get("/output-products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetOutputProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [item] = await db.select().from(outputProductsTable).where(eq(outputProductsTable.id, params.data.id));
  if (!item) {
    res.status(404).json({ error: "Output product not found" });
    return;
  }
  res.json(GetOutputProductResponse.parse(item));
});

router.patch("/output-products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateOutputProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateOutputProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.update(outputProductsTable)
    .set(parsed.data)
    .where(eq(outputProductsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Output product not found" });
    return;
  }
  res.json(UpdateOutputProductResponse.parse({ ...item, createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt }));
});

router.delete("/output-products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteOutputProductParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(outputProductsTable).where(eq(outputProductsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
