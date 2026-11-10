import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, aiRecommendationsTable } from "@workspace/db";
import {
  ListAiRecommendationsQueryParams,
  CreateAiRecommendationBody,
  CreateAiRecommendationResponse,
  UpdateAiRecommendationParams,
  UpdateAiRecommendationBody,
  UpdateAiRecommendationResponse,
  ListAiRecommendationsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ai-recommendations", async (req, res): Promise<void> => {
  const query = ListAiRecommendationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const rows = await db.select().from(aiRecommendationsTable).orderBy(desc(aiRecommendationsTable.createdAt));
  let items = rows;
  if (query.data.status) {
    items = items.filter((r) => r.status === query.data.status);
  }
  if (query.data.feasibility) {
    items = items.filter((r) => r.feasibility === query.data.feasibility);
  }
  res.json(ListAiRecommendationsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/ai-recommendations", async (req, res): Promise<void> => {
  const parsed = CreateAiRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.insert(aiRecommendationsTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "CONCEPT",
  }).returning();
  res.status(201).json(CreateAiRecommendationResponse.parse(item));
});

router.patch("/ai-recommendations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAiRecommendationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAiRecommendationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [item] = await db.update(aiRecommendationsTable)
    .set(parsed.data)
    .where(eq(aiRecommendationsTable.id, params.data.id))
    .returning();
  if (!item) {
    res.status(404).json({ error: "AI recommendation not found" });
    return;
  }
  res.json(UpdateAiRecommendationResponse.parse(item));
});

export default router;
