import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, competitorSignalsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/competitor-signals", async (req, res): Promise<void> => {
  const { limit, dataSourceSite } = req.query as Record<string, string | undefined>;

  let rows = await db
    .select()
    .from(competitorSignalsTable)
    .orderBy(desc(competitorSignalsTable.createdAt));

  if (dataSourceSite) {
    rows = rows.filter((r) => r.dataSourceSite === dataSourceSite);
  }

  const maxRows = limit ? Math.min(Number(limit), 100) : 50;
  rows = rows.slice(0, maxRows);

  res.json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
  );
});

export default router;
