import { Router, type IRouter } from "express";
import { and, desc, inArray, sql } from "drizzle-orm";
import {
  db, researchItemsTable, contractorsTable, skkHoldersTable,
  tenderOpportunitiesTable, painPointsTable, outputProductsTable, aiRecommendationsTable
} from "@workspace/db";
import { CORE_DATA_SOURCES, VISIBLE_RESEARCH_CATEGORIES } from "../lib/researchScope";
import {
  GetDashboardSummaryResponse,
  GetTrendingTopicsQueryParams,
  GetTrendingTopicsResponse,
  GetExpiringCertificationsResponse,
  GetActivityFeedQueryParams,
  GetActivityFeedResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const coreResearchWhere = inArray(researchItemsTable.category, [...VISIBLE_RESEARCH_CATEGORIES]);

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [
    researchCount,
    pendingCount,
    contractorCount,
    skkCount,
    tenderOpenCount,
    criticalPainCount,
    todayResearch,
    outputProductCount,
    aiRecCount,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(researchItemsTable).where(coreResearchWhere),
    db.select({ count: sql<number>`count(*)::int` }).from(researchItemsTable).where(and(coreResearchWhere, sql`${researchItemsTable.status} = 'PENDING'`)),
    db.select({ count: sql<number>`count(*)::int` }).from(contractorsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(skkHoldersTable),
    db.select({ count: sql<number>`count(*)::int` }).from(tenderOpportunitiesTable).where(sql`${tenderOpportunitiesTable.status} IN ('OPEN', 'CLOSING_SOON')`),
    db.select({ count: sql<number>`count(*)::int` }).from(painPointsTable).where(sql`${painPointsTable.priority} = 'CRITICAL'`),
    db.select({ count: sql<number>`count(*)::int` }).from(researchItemsTable).where(and(coreResearchWhere, sql`${researchItemsTable.createdAt} >= current_date`)),
    db.select({ count: sql<number>`count(*)::int` }).from(outputProductsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(aiRecommendationsTable),
  ]);

  const today = new Date().toISOString().split("T")[0];
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [expiringContractors, expiringSKK, trendingRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(contractorsTable)
      .where(sql`${contractorsTable.sbuExpiry} IS NOT NULL AND ${contractorsTable.sbuExpiry} <= ${in90Days} AND ${contractorsTable.sbuExpiry} >= ${today}`),
    db.select({ count: sql<number>`count(*)::int` }).from(skkHoldersTable)
      .where(sql`${skkHoldersTable.skkExpiry} IS NOT NULL AND ${skkHoldersTable.skkExpiry} <= ${in90Days} AND ${skkHoldersTable.skkExpiry} >= ${today}`),
    db.select({ category: researchItemsTable.category, count: sql<number>`count(*)::int` })
      .from(researchItemsTable).where(coreResearchWhere).groupBy(researchItemsTable.category).orderBy(sql`count(*) desc`).limit(1),
  ]);

  res.json(GetDashboardSummaryResponse.parse({
    sourcesCount: CORE_DATA_SOURCES.length,
    totalResearchItems: researchCount[0]?.count ?? 0,
    pendingReview: pendingCount[0]?.count ?? 0,
    expiringCertifications: (expiringContractors[0]?.count ?? 0) + (expiringSKK[0]?.count ?? 0),
    openTenders: tenderOpenCount[0]?.count ?? 0,
    totalContractors: contractorCount[0]?.count ?? 0,
    totalSkkHolders: skkCount[0]?.count ?? 0,
    criticalPainPoints: criticalPainCount[0]?.count ?? 0,
    todayCollected: todayResearch[0]?.count ?? 0,
    outputProducts: outputProductCount[0]?.count ?? 0,
    aiRecommendations: aiRecCount[0]?.count ?? 0,
    trendingCategory: trendingRows[0]?.category ?? null,
    lastUpdated: new Date().toISOString(),
  }));
});

router.get("/dashboard/trending-topics", async (req, res): Promise<void> => {
  const query = GetTrendingTopicsQueryParams.safeParse(req.query);
  const limit = Number(query.data?.limit ?? 10);

  const rows = await db.select({
    topic: researchItemsTable.title,
    count: sql<number>`count(*)::int`,
    category: researchItemsTable.category,
  })
    .from(researchItemsTable)
    .where(coreResearchWhere)
    .groupBy(researchItemsTable.title, researchItemsTable.category)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  const topics = rows.map((r) => ({
    topic: r.topic,
    count: r.count,
    category: r.category,
    trend: r.count > 3 ? "UP" : r.count > 1 ? "STABLE" : "DOWN",
    sources: null,
  }));

  res.json(GetTrendingTopicsResponse.parse(topics));
});

router.get("/dashboard/expiring-certifications", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const in90Days = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [contractors, skkHolders] = await Promise.all([
    db.select().from(contractorsTable)
      .where(sql`${contractorsTable.sbuExpiry} IS NOT NULL AND ${contractorsTable.sbuExpiry} <= ${in90Days} AND ${contractorsTable.sbuExpiry} >= ${today}`)
      .orderBy(contractorsTable.sbuExpiry),
    db.select().from(skkHoldersTable)
      .where(sql`${skkHoldersTable.skkExpiry} IS NOT NULL AND ${skkHoldersTable.skkExpiry} <= ${in90Days} AND ${skkHoldersTable.skkExpiry} >= ${today}`)
      .orderBy(skkHoldersTable.skkExpiry),
  ]);

  const todayTime = new Date(today).getTime();
  const certs = [
    ...contractors.map((c) => ({
      type: "SBU",
      holderName: c.name,
      certNumber: c.sbuCode,
      expiryDate: c.sbuExpiry!,
      daysLeft: Math.ceil((new Date(c.sbuExpiry!).getTime() - todayTime) / (1000 * 60 * 60 * 24)),
      level: c.sbuLevel,
      contactPhone: c.phone,
      contactEmail: c.email,
    })),
    ...skkHolders.map((s) => ({
      type: "SKK",
      holderName: s.name,
      certNumber: s.skkNumber,
      expiryDate: s.skkExpiry!,
      daysLeft: Math.ceil((new Date(s.skkExpiry!).getTime() - todayTime) / (1000 * 60 * 60 * 24)),
      level: `Jenjang ${s.jenjang}`,
      contactPhone: s.phone,
      contactEmail: s.email,
    })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);

  res.json(GetExpiringCertificationsResponse.parse(certs));
});

router.get("/dashboard/activity-feed", async (req, res): Promise<void> => {
  const query = GetActivityFeedQueryParams.safeParse(req.query);
  const limit = Number(query.data?.limit ?? 20);

  const [research, contractors, skkHolders, tenders, painPoints] = await Promise.all([
    db.select().from(researchItemsTable).where(coreResearchWhere).orderBy(desc(researchItemsTable.createdAt)).limit(limit),
    db.select().from(contractorsTable).orderBy(desc(contractorsTable.createdAt)).limit(5),
    db.select().from(skkHoldersTable).orderBy(desc(skkHoldersTable.createdAt)).limit(5),
    db.select().from(tenderOpportunitiesTable).orderBy(desc(tenderOpportunitiesTable.createdAt)).limit(5),
    db.select().from(painPointsTable).orderBy(desc(painPointsTable.createdAt)).limit(5),
  ]);

  const feed = [
    ...research.map((r, i) => ({ id: i + 1, type: "research_item", description: `Data riset: ${r.title}`, category: r.category, createdAt: r.createdAt.toISOString() })),
    ...contractors.map((c, i) => ({ id: research.length + i + 1, type: "contractor", description: `Kontraktor: ${c.name}`, category: c.sbuLevel, createdAt: c.createdAt.toISOString() })),
    ...skkHolders.map((s, i) => ({ id: research.length + contractors.length + i + 1, type: "skk_holder", description: `SKK Jenjang ${s.jenjang}: ${s.name}`, category: s.specialization, createdAt: s.createdAt.toISOString() })),
    ...tenders.map((t, i) => ({ id: research.length + contractors.length + skkHolders.length + i + 1, type: "tender", description: `Tender: ${t.title}`, category: t.status, createdAt: t.createdAt.toISOString() })),
    ...painPoints.map((p, i) => ({ id: research.length + contractors.length + skkHolders.length + tenders.length + i + 1, type: "pain_point", description: `Pain point: ${p.description.slice(0, 80)}`, category: p.segment, createdAt: p.createdAt.toISOString() })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  res.json(GetActivityFeedResponse.parse(feed));
});

export default router;
