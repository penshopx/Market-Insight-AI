import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, marketingStrategiesTable } from "@workspace/db";
import {
  ListMarketingStrategiesQueryParams,
  CreateMarketingStrategyBody,
  CreateMarketingStrategyResponse,
  UpdateMarketingStrategyParams,
  UpdateMarketingStrategyBody,
  UpdateMarketingStrategyResponse,
  ListMarketingStrategiesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/marketing-strategies", async (req, res): Promise<void> => {
  const query = ListMarketingStrategiesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select().from(marketingStrategiesTable).orderBy(desc(marketingStrategiesTable.createdAt));
  let items = rows;
  if (query.data.status) {
    items = items.filter((r) => r.status === query.data.status);
  }
  if (query.data.strategyType) {
    items = items.filter((r) => r.strategyType === query.data.strategyType);
  }
  res.json(ListMarketingStrategiesResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/marketing-strategies", async (req, res): Promise<void> => {
  const parsed = CreateMarketingStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(marketingStrategiesTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "PLANNED",
  }).returning();
  res.status(201).json(CreateMarketingStrategyResponse.parse(item));
});

router.patch("/marketing-strategies/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateMarketingStrategyParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMarketingStrategyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.update(marketingStrategiesTable)
    .set(parsed.data)
    .where(eq(marketingStrategiesTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "Marketing strategy not found" });
    return;
  }
  res.json(UpdateMarketingStrategyResponse.parse(item));
});

export default router;
