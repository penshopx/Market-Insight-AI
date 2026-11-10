import {
  db,
  researchItemsTable,
  schedulerRunsTable,
  competitorSignalsTable,
  sourceCrawlHistoryTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { DATA_SOURCES } from "./dataSources";
import { getTodaysCrawlBatch } from "./mkrSchedule";
import { CORE_DATA_SOURCES } from "./researchScope";

export interface CollectionResult {
  sourceId: string;
  sourceName: string;
  status: "SUCCESS" | "PARTIAL" | "BLOCKED" | "ERROR";
  itemsSaved: number;
  itemsSkipped: number;
  errorMessage?: string;
}

export interface DailyCollectionReport {
  startedAt: string;
  finishedAt: string;
  totalItemsSaved: number;
  totalItemsSkipped: number;
  results: CollectionResult[];
}

const CONSTRUCTION_KEYWORDS = [
  "konstruksi", "kontraktor", "konsultan", "tender", "SBU", "SKK", "LPJK",
  "pengadaan", "lelang", "sertifikat", "jasa", "bangunan", "proyek",
  "infrastruktur", "renovasi", "sipil", "gedung", "jalan", "pekerjaan",
];

async function fetchSource(source: typeof DATA_SOURCES[number]): Promise<CollectionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const collectedAt = new Date().toISOString().split("T")[0]!;

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: "BLOCKED",
        itemsSaved: 0,
        itemsSkipped: 0,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    // Strip non-content elements
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract sentences that contain construction keywords
    const sentences = cleaned
      .split(/[.!?\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30 && s.length < 500)
      .filter((s) => CONSTRUCTION_KEYWORDS.some((kw) => s.toLowerCase().includes(kw.toLowerCase())));

    const seen = new Set<string>();
    let itemsSaved = 0;
    let itemsSkipped = 0;

    for (const sentence of sentences.slice(0, 20)) {
      const key = sentence.substring(0, 60).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const inserted = await db
        .insert(researchItemsTable)
        .values({
          category: source.category,
          title: sentence.substring(0, 200),
          summary: sentence,
          source: source.name,
          sourceUrl: source.url,
          dataSourceSite: new URL(source.url).hostname,
          status: "PENDING",
          priority: "MEDIUM",
          collectedAt,
        })
        .onConflictDoNothing()
        .returning({ id: researchItemsTable.id });

      if (inserted.length > 0) {
        itemsSaved++;
      } else {
        itemsSkipped++;
      }

      if (itemsSaved >= 10) break;
    }

    // ── IjinTender-specific: also extract price signals into competitor_signals ──
    if (source.id === "ijintender") {
      const PRICE_KEYWORDS = [
        "harga", "biaya", "tarif", "rp ", "rupiah", "ribu", "juta",
        "sbu", "skk", "iujk", "nib", "sertifikat",
        "pengurusan", "pendampingan", "paket",
      ];

      const priceSignals = cleaned
        .split(/[.!?\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20 && s.length < 400)
        .filter((s) => PRICE_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)));

      const seen2 = new Set<string>();
      for (const sentence of priceSignals.slice(0, 15)) {
        const key = sentence.substring(0, 60).toLowerCase();
        if (seen2.has(key)) continue;
        seen2.add(key);

        await db
          .insert(competitorSignalsTable)
          .values({
            category: "COMPETITOR_PRICING",
            title: sentence.substring(0, 200),
            summary: sentence,
            source: source.name,
            sourceUrl: source.url,
            dataSourceSite: new URL(source.url).hostname,
            collectedAt,
          })
          .onConflictDoNothing();
      }
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      status: itemsSaved > 0 ? "SUCCESS" : "PARTIAL",
      itemsSaved,
      itemsSkipped,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes("abort") || message.includes("timeout");
    return {
      sourceId: source.id,
      sourceName: source.name,
      status: "ERROR",
      itemsSaved: 0,
      itemsSkipped: 0,
      errorMessage: isTimeout
        ? "Timeout: situs tidak merespons dalam 15 detik"
        : `Error: ${message}`,
    };
  }
}

export interface CollectAndNotifyReport extends DailyCollectionReport {
  /** Set after notification is dispatched so the scheduler can persist it. */
  notificationResult?: import("./notify").NotificationResult | null;
  /** DB row id of the persisted scheduler run (set after DB insert). */
  runId?: number;
}

export async function collectDailyData(
  /** Pass a list of sourceIds to run only those sources; omit (or pass undefined/[]) for normal MKR-scheduled batch. */
  onlySourceIds?: string[] | boolean,
): Promise<CollectAndNotifyReport> {
  const startedAt = new Date().toISOString();
  const today = new Date();

  // Back-compat: legacy callers pass boolean forceAll
  const forceAll = typeof onlySourceIds === "boolean" ? onlySourceIds : false;
  const specificIds = Array.isArray(onlySourceIds) && onlySourceIds.length > 0 ? onlySourceIds : undefined;

  const { sources: allBatch, skipped: skippedSources } = getTodaysCrawlBatch(CORE_DATA_SOURCES, today, forceAll);

  // If specific source IDs requested, filter to only those (even if not scheduled today)
  const todaysBatch = specificIds
    ? CORE_DATA_SOURCES.filter((s) => specificIds.includes(s.id))
    : allBatch;

  logger.info(
    { totalSources: CORE_DATA_SOURCES.length, todaysBatch: todaysBatch.length, skipped: skippedSources.length, forceAll, specificIds },
    "Daily data collection started — MKR-aware batch",
  );

  // ── Insert "RUNNING" row immediately so it survives a mid-run server restart ──
  let runId: number | undefined;
  try {
    const [inserted] = await db.insert(schedulerRunsTable).values({
      status: "RUNNING",
      startedAt: new Date(startedAt),
      // finishedAt intentionally omitted — null while running
      totalItemsSaved: "0",
      results: [],
    }).returning({ id: schedulerRunsTable.id });
    runId = inserted?.id;
    logger.info({ runId }, "Scheduler run row created with status RUNNING");
  } catch (err) {
    logger.error({ err }, "Failed to create initial scheduler run row — continuing without persistence");
  }

  const results: CollectionResult[] = [];

  // Run sequentially to avoid hammering external sites
  for (const source of todaysBatch) {
    logger.info({ sourceId: source.id, url: source.url }, "Fetching source");
    const result = await fetchSource(source);
    results.push(result);
    logger.info(
      { sourceId: source.id, status: result.status, itemsSaved: result.itemsSaved, itemsSkipped: result.itemsSkipped },
      "Source fetch complete",
    );

    // Keep the source-level crawl cursor independent from scheduler_runs,
    // whose operational rows may be pruned. Failed attempts must not replace
    // the last successful crawl timestamp used by the schedule view.
    if (result.status === "SUCCESS" || result.status === "PARTIAL") {
      try {
        await db
          .insert(sourceCrawlHistoryTable)
          .values({
            sourceId: result.sourceId,
            lastCrawledAt: new Date(),
            itemsSaved: result.itemsSaved,
            status: result.status,
          })
          .onConflictDoUpdate({
            target: sourceCrawlHistoryTable.sourceId,
            set: {
              lastCrawledAt: new Date(),
              itemsSaved: result.itemsSaved,
              status: result.status,
            },
          });
      } catch (err) {
        // A history write failure should be visible, but must not discard the
        // research items already collected or stop the remaining sources.
        logger.error(
          { err, sourceId: result.sourceId },
          "Failed to persist source crawl history",
        );
      }
    }
  }

  const finishedAt = new Date().toISOString();
  const totalItemsSaved = results.reduce((sum, r) => sum + r.itemsSaved, 0);
  const totalItemsSkipped = results.reduce((sum, r) => sum + r.itemsSkipped, 0);

  logger.info(
    { totalItemsSaved, totalItemsSkipped, sourcesProcessed: results.length, finishedAt },
    "Daily data collection finished",
  );

  const report: CollectAndNotifyReport = { startedAt, finishedAt, totalItemsSaved, totalItemsSkipped, results, runId };

  // ── Update the RUNNING row to COMPLETED with final results ──
  if (runId != null) {
    try {
      await db.update(schedulerRunsTable)
        .set({
          status: "COMPLETED",
          finishedAt: new Date(finishedAt),
          totalItemsSaved: String(totalItemsSaved),
          results: results.map((r) => ({
            sourceId: r.sourceId,
            sourceName: r.sourceName,
            status: r.status,
            itemsSaved: r.itemsSaved,
            itemsSkipped: r.itemsSkipped,
            errorMessage: r.errorMessage ?? null,
          })),
        })
        .where(eq(schedulerRunsTable.id, runId));
      logger.info({ totalItemsSaved, runId }, "Scheduler run updated to COMPLETED");
    } catch (err) {
      logger.error({ err, runId }, "Failed to update scheduler run to COMPLETED");
    }
  }

  return report;
}
