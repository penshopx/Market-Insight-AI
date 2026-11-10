import { Router, type IRouter } from "express";
import { triggerNow, getSchedulerStatus } from "../scheduler";
import {
  db,
  schedulerRunsTable,
  briefingDeliveriesTable,
  sourceCrawlHistoryTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { CORE_DATA_SOURCES } from "../lib/researchScope";
import { getNeverCrawledSourceIds, getScheduleMatrix, getTodaysCrawlBatch } from "../lib/mkrSchedule";
import { sendCollectionNotification } from "../lib/notify";
import { requireSchedulerOperator } from "../lib/adminAuth";
import { claimNotificationLease, MAX_NOTIFICATION_ATTEMPTS, type NotificationLease } from "../lib/notificationLease";

const router: IRouter = Router();

/**
 * GET /scheduler/status
 * Returns current scheduler state: last run, next run, whether a job is running.
 */
router.get("/scheduler/status", (_req, res): void => {
  res.json(getSchedulerStatus());
});

/**
 * POST /scheduler/trigger
 * Immediately runs the daily data collection job (manual override for testing / catch-up).
 * Requires admin token because it triggers external email/WhatsApp delivery and can consume
 * the daily idempotency slot.
 */
router.post("/scheduler/trigger", requireSchedulerOperator, async (_req, res): Promise<void> => {
  try {
    const report = await triggerNow();
    res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(409).json({ error: message });
  }
});

/**
 * GET /scheduler/runs
 * Returns the last 30 scheduler run logs from the database.
 */
router.get("/scheduler/runs", async (_req, res): Promise<void> => {
  try {
    const runs = await db
      .select()
      .from(schedulerRunsTable)
      .orderBy(desc(schedulerRunsTable.startedAt))
      .limit(30);

    const response = runs.map((run) => ({
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      status: run.status,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      totalItemsSaved: Number(run.totalItemsSaved),
      totalItemsSkipped: run.results.reduce((sum, r) => sum + (r.itemsSkipped ?? 0), 0),
      results: run.results,
      notificationResult: run.notificationResult ?? null,
      notificationRetryCount: run.notificationRetryCount ?? 0,
    }));

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * Builds the crawl schedule matrix with lastCrawledAt per source from the DB.
 */
async function buildScheduleResponse(strictHistory = false) {
  const today = new Date();

  let lastCrawledBySource: Record<string, string> = {};
  try {
    const rows = await db
      .select({
        sourceId: sourceCrawlHistoryTable.sourceId,
        lastCrawledAt: sourceCrawlHistoryTable.lastCrawledAt,
      })
      .from(sourceCrawlHistoryTable);
    for (const row of rows) {
      if (row.sourceId && row.lastCrawledAt) {
        lastCrawledBySource[row.sourceId] = row.lastCrawledAt.toISOString();
      }
    }
  } catch (err) {
    if (strictHistory) throw err;
    // Read-only schedule views may still render frequency metadata if crawl
    // history is temporarily unavailable.
  }

  const { sources: todayBatch } = getTodaysCrawlBatch(CORE_DATA_SOURCES, today);
  const matrix = getScheduleMatrix(CORE_DATA_SOURCES, today, lastCrawledBySource);

  return {
    date: today.toISOString().split("T")[0],
    todayBatchCount: todayBatch.length,
    totalSources: CORE_DATA_SOURCES.length,
    matrix,
  };
}

/**
 * GET /scheduler/mkr-schedule
 * Returns the MKR-aware crawl schedule matrix — which sources are due today,
 * this week, and this month, with lastCrawledAt and nextScheduledAt per source.
 */
router.get("/scheduler/mkr-schedule", async (_req, res): Promise<void> => {
  const payload = await buildScheduleResponse();
  res.json(payload);
});

/**
 * GET /mkr/crawl-schedule
 * Alias for /scheduler/mkr-schedule — returns the same MKR crawl schedule.
 * Named per the task spec for external/API consumer compatibility.
 */
router.get("/mkr/crawl-schedule", async (_req, res): Promise<void> => {
  const payload = await buildScheduleResponse();
  res.json(payload);
});

/**
 * GET /scheduler/briefing/deliveries
 * Returns the last 30 briefing delivery records from the database.
 */
router.get("/scheduler/briefing/deliveries", async (req, res): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? "30"), 10) || 30, 100);
    const rows = await db
      .select()
      .from(briefingDeliveriesTable)
      .orderBy(desc(briefingDeliveriesTable.createdAt))
      .limit(limit);

    const response = rows.map((row) => ({
      id: row.id,
      deliveryDate: row.deliveryDate,
      status: row.status,
      pdfGenerated: row.pdfGenerated,
      successCount: row.successCount,
      failCount: row.failCount,
      error: row.error ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    res.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /scheduler/briefing/send
 * Manually triggers a briefing notification delivery using the last run report.
 * Returns a structured result so UI can show success/failure explicitly.
 */
router.post("/scheduler/briefing/send", async (_req, res): Promise<void> => {
  try {
    const status = getSchedulerStatus();
    const report = await triggerNow();

    if (!report) {
      res.json({
        channel: "none",
        success: false,
        sentAt: new Date().toISOString(),
        errorMessage: "Belum ada data run — jalankan scheduler terlebih dahulu sebelum mengirim briefing.",
      });
      return;
    }

    const result = await sendCollectionNotification(report);
    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      channel: "none",
      success: false,
      sentAt: new Date().toISOString(),
      errorMessage: `Server error: ${message}`,
    });
  }
});

/**
 * POST /scheduler/trigger-source
 * Immediately runs the daily data collection for a single source ID.
 */
router.post("/scheduler/trigger-source", async (req, res): Promise<void> => {
  try {
    const sourceId = typeof req.query.sourceId === "string" ? req.query.sourceId : undefined;
    if (!sourceId) {
      res.status(400).json({ error: "sourceId required" });
      return;
    }
    const source = CORE_DATA_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      res.status(404).json({ error: `Source '${sourceId}' not found` });
      return;
    }
    const report = await triggerNow([sourceId]);
    res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(409).json({ error: message });
  }
});

/**
 * POST /scheduler/trigger-empty
 * Resolves crawl history from the database and immediately runs only sources
 * that have never had a successful or partial crawl.
 */
router.post("/scheduler/trigger-empty", requireSchedulerOperator, async (_req, res): Promise<void> => {
  try {
    // Fail closed: never interpret a history-query failure as "every source is
    // empty", because that would turn a database outage into an all-source crawl.
    const schedule = await buildScheduleResponse(true);
    const emptySourceIds = getNeverCrawledSourceIds(schedule.matrix);

    // Do not pass an empty array to triggerNow: [] means "normal scheduled
    // batch" in collectDailyData, which would crawl the wrong sources.
    if (emptySourceIds.length === 0) {
      const now = new Date().toISOString();
      res.json({
        startedAt: now,
        finishedAt: now,
        totalItemsSaved: 0,
        totalItemsSkipped: 0,
        results: [],
      });
      return;
    }

    const report = await triggerNow(emptySourceIds);
    res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already running")) {
      res.status(409).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
});

/**
 * POST /scheduler/runs/:id/notify
 * Re-sends the collection notification for a specific scheduler run.
 *
 * Authorization: Protected by the platform session gate in app.ts (requires a valid
 * platform_session cookie set after PLATFORM_PASSWORD login).
 *
 * Concurrency / lease protocol:
 *   All three dispatch paths (scheduler runJob, triggerNow, manual retry) go through
 *   claimNotificationLease(), which atomically:
 *     - Sets  notification_status      = 'SENDING'
 *     - Sets  notification_lease_at    = NOW()  ← the lease token
 *     - Incs  notification_retry_count
 *   Terminal updates (SENT / FAILED / FAILED_PERMANENT) and error cleanup are all
 *   scoped to `WHERE notification_lease_at = :leaseAt` so only the holder of this
 *   specific claim can write the final status.  A startup recovery that reclaims a
 *   stale SENDING row gets a different lease token, so its terminal write never
 *   collides with this request's write.
 */
router.post("/scheduler/runs/:id/notify", async (req, res): Promise<void> => {
  const runId = parseInt(req.params.id, 10);
  if (isNaN(runId)) {
    res.status(400).json({ error: "ID run tidak valid" });
    return;
  }

  // Declared outside the try so the catch block can scope its cleanup to this lease.
  let lease: NotificationLease | null = null;

  try {
    // ── 1. Load the run ───────────────────────────────────────────────────────
    const rows = await db
      .select()
      .from(schedulerRunsTable)
      .where(eq(schedulerRunsTable.id, runId))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: `Run #${runId} tidak ditemukan` });
      return;
    }

    const run = rows[0];

    // ── 2. Fast-path eligibility check (informative 409 before attempting the CAS) ──
    const currentStatus = run.notificationStatus ?? null;
    const TERMINAL_MESSAGES: Record<string, string> = {
      SENT:             `Run #${runId} sudah berhasil dikirim sebelumnya. Tidak perlu dikirim ulang.`,
      SENDING:          `Run #${runId} sedang dalam proses pengiriman. Coba lagi dalam beberapa detik.`,
      FAILED_PERMANENT: `Run #${runId} telah mencapai batas percobaan (${MAX_NOTIFICATION_ATTEMPTS}×). Perbaiki konfigurasi webhook terlebih dahulu.`,
    };
    if (currentStatus !== null && currentStatus in TERMINAL_MESSAGES) {
      res.status(409).json({ error: TERMINAL_MESSAGES[currentStatus], notificationStatus: currentStatus });
      return;
    }
    // Also guard against rows still labeled FAILED but whose counter already hit the cap.
    if ((run.notificationRetryCount ?? 0) >= MAX_NOTIFICATION_ATTEMPTS) {
      res.status(409).json({
        error: `Run #${runId} telah mencapai batas maksimum percobaan (${MAX_NOTIFICATION_ATTEMPTS}×). Perbaiki konfigurasi webhook terlebih dahulu.`,
        notificationStatus: "FAILED_PERMANENT",
      });
      return;
    }

    // ── 3. Atomic CAS lease claim (centralized helper, shared by all dispatch paths) ──
    // Returns null if another live request holds a fresh lease, status is terminal,
    // or the cap was reached between step 2 and now.
    lease = await claimNotificationLease(runId);
    if (!lease) {
      res.status(409).json({
        error: `Run #${runId} tidak dapat dikirim ulang saat ini. Mungkin sedang diproses oleh permintaan lain atau batas percobaan telah tercapai.`,
      });
      return;
    }

    // ── 4. Build report and dispatch ─────────────────────────────────────────
    const report = {
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : new Date().toISOString(),
      totalItemsSaved: Number(run.totalItemsSaved),
      totalItemsSkipped: run.results.reduce((sum, r) => sum + (r.itemsSkipped ?? 0), 0),
      results: run.results.map((r) => ({ ...r, errorMessage: r.errorMessage ?? undefined })),
    };

    const result = await sendCollectionNotification(report, runId);

    // ── 5. Persist result scoped to this lease token ──────────────────────────
    // Promote to FAILED_PERMANENT when the attempt cap is reached.
    const newStatus = result.success
      ? "SENT"
      : lease.retryCount >= MAX_NOTIFICATION_ATTEMPTS
      ? "FAILED_PERMANENT"
      : "FAILED";

    // Scope to the exact lease token (text→timestamptz preserves microsecond precision).
    // Prevents this update from overwriting a terminal status written by recovery
    // (which holds a different lease token).
    await db
      .update(schedulerRunsTable)
      .set({
        notificationResult: result,
        notificationStatus: newStatus,
        ...(result.success ? { notificationSentAt: new Date(result.sentAt) } : {}),
      })
      .where(
        and(
          eq(schedulerRunsTable.id, runId),
          sql`notification_lease_at = ${lease.leaseToken}::timestamptz`,
        ),
      );

    res.json(result);
  } catch (err: unknown) {
    // Best-effort cleanup: release this request's lease to FAILED so the run is retryable again.
    // Scoped to the exact lease token — if lease is null (error before step 3), no cleanup runs.
    if (lease) {
      try {
        await db
          .update(schedulerRunsTable)
          .set({ notificationStatus: "FAILED" })
          .where(
            and(
              eq(schedulerRunsTable.id, runId),
              sql`notification_lease_at = ${lease.leaseToken}::timestamptz`,
            ),
          );
      } catch {
        // Ignore secondary errors during cleanup
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
