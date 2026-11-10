import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, painPointsTable } from "@workspace/db";
import {
  ListPainPointsQueryParams,
  CreatePainPointBody,
  CreatePainPointResponse,
  UpdatePainPointParams,
  UpdatePainPointBody,
  UpdatePainPointResponse,
  ListPainPointsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pain-points", async (req, res): Promise<void> => {
  const query = ListPainPointsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db.select().from(painPointsTable).orderBy(desc(painPointsTable.createdAt));

  let items = rows;
  if (query.data.segment) {
    items = items.filter((r) => r.segment === query.data.segment);
  }
  if (query.data.priority) {
    items = items.filter((r) => r.priority === query.data.priority);
  }
  // CPKB filters
  const q = query.data as Record<string, unknown>;
  if (q["domain"]) {
    items = items.filter((r) => r.domain === q["domain"]);
  }
  if (q["linkedAiAgent"]) {
    items = items.filter((r) => r.linkedAiAgent === q["linkedAiAgent"]);
  }
  if (q["minPainScore"]) {
    const min = parseFloat(String(q["minPainScore"]));
    items = items.filter((r) => r.painScore != null && r.painScore >= min);
  }

  res.json(ListPainPointsResponse.parse(items.map(r => ({ ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt }))));
});

router.post("/pain-points", async (req, res): Promise<void> => {
  const parsed = CreatePainPointBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const [item] = await db.insert(painPointsTable).values({
    problemId: (data["problemId"] as string) ?? null,
    domain: (data["domain"] as string) ?? null,
    subdomain: (data["subdomain"] as string) ?? null,
    painScore: data["painScore"] != null ? Number(data["painScore"]) : null,
    affectedRoles: (data["affectedRoles"] as string) ?? null,
    rootCause: (data["rootCause"] as string) ?? null,
    businessImpact: (data["businessImpact"] as string) ?? null,
    sdmGap: (data["sdmGap"] as string) ?? null,
    manualSolution: (data["manualSolution"] as string) ?? null,
    digitalSolution: (data["digitalSolution"] as string) ?? null,
    aiSolution: (data["aiSolution"] as string) ?? null,
    linkedAiAgent: (data["linkedAiAgent"] as string) ?? null,
    serviceOpportunity: (data["serviceOpportunity"] as string) ?? null,
    crossReferences: (data["crossReferences"] as string) ?? null,
    segment: (data["segment"] as string) ?? "KONTRAKTOR",
    description: data["description"] as string,
    frequency: (data["frequency"] as string) ?? "SERING",
    priority: (data["priority"] as string) ?? "MEDIUM",
    category: (data["category"] as string) ?? null,
    productIdea: (data["productIdea"] as string) ?? null,
    status: (data["status"] as string) ?? "OPEN",
    evidencePhotoUrl: (data["evidencePhotoUrl"] as string) ?? null,
  }).returning();

  res.status(201).json(CreatePainPointResponse.parse(item));
});

router.patch("/pain-points/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePainPointParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePainPointBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data as Record<string, unknown>;
  const updateFields: Record<string, unknown> = {};
  const cpkbFields = [
    "problemId","domain","subdomain","painScore","affectedRoles",
    "rootCause","businessImpact","sdmGap","manualSolution","digitalSolution",
    "aiSolution","linkedAiAgent","serviceOpportunity","crossReferences",
    "segment","description","frequency","priority","category","productIdea","status",
    "evidencePhotoUrl",
  ];
  for (const f of cpkbFields) {
    if (data[f] !== undefined) updateFields[f] = data[f];
  }

  const [item] = await db.update(painPointsTable)
    .set(updateFields)
    .where(eq(painPointsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Pain point not found" });
    return;
  }

  res.json(UpdatePainPointResponse.parse(item));
});

router.delete("/pain-points/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db.delete(painPointsTable).where(eq(painPointsTable.id, id)).returning({ id: painPointsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Pain point not found" });
    return;
  }
  res.status(204).send();
});

export default router;
