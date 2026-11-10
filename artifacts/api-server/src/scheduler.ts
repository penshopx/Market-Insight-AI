/**
 * Daily scheduler — runs collectDailyData() every day at 07:00 WIB (UTC+7 = 00:00 UTC).
 * Uses a self-rescheduling setTimeout so it drifts at most a few seconds across restarts.
 */

import { logger } from "./lib/logger";
import { db, schedulerRunsTable, pool } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { claimNotificationLease, MAX_NOTIFICATION_ATTEMPTS, type NotificationLease } from "./lib/notificationLease";
import { collectDailyData, type DailyCollectionReport } from "./lib/collectDailyData";
import { sendCollectionNotification, sendBriefingDeliveryAlert, sendInterruptionAlert, type NotificationResult } from "./lib/notify";
import { deliverDailyBriefing } from "./lib/deliverBriefing";
import { runPbgAlerts } from "./lib/pbgAlerts";
import { CORE_DATA_SOURCES } from "./lib/researchScope";
import { getHighPrioritySourceIds, getStandardCrawlSourceIds, msUntilNextHighPriorityRun } from "./lib/mkrSchedule";

// ─── state ────────────────────────────────────────────────────────────────────

export interface SchedulerStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  lastRunResult: DailyCollectionReport | null;
  nextRunAt: string | null;
  totalRunsToday: number;
  lastNotificationResult: NotificationResult | null;
}

const state: SchedulerStatus = {
  isRunning: false,
  lastRunAt: null,
  lastRunResult: null,
  nextRunAt: null,
  totalRunsToday: 0,
  lastNotificationResult: null,
};

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
let highPriorityTimer: ReturnType<typeof setTimeout> | null = null;

// ─── run-level watchdog ───────────────────────────────────────────────────────

/** Maximum allowed duration for a single crawl run before the lock is force-released. */
const MAX_RUN_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/** Returns a promise that rejects with a sentinel error after `ms`, plus a cancel fn. */
function createRunTimeout(ms: number): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("SCHEDULER_RUN_TIMEOUT")), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

/** Mark any currently-RUNNING DB rows as INTERRUPTED and fire alerts. */
async function markRunningAsInterrupted(): Promise<void> {
  try {
    const rows = await db
      .update(schedulerRunsTable)
      .set({ status: "INTERRUPTED", finishedAt: new Date() })
      .where(eq(schedulerRunsTable.status, "RUNNING"))
      .returning({ id: schedulerRunsTable.id, startedAt: schedulerRunsTable.startedAt });
    for (const row of rows) {
      sendInterruptionAlert(row.id, row.startedAt.toISOString()).catch(() => {});
    }
  } catch (dbErr) {
    logger.error({ dbErr }, "Scheduler: failed to mark timed-out run as INTERRUPTED");
  }
}

/**
 * Tracks whether a briefing retry has already been scheduled for today's WIB date.
 * Reset each time we schedule a new full daily run so it's only 1 retry per day.
 */
let briefingRetryScheduledForDate: string | null = null;

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Returns ms until the next 07:00 WIB (UTC+7 = 00:00 UTC). */
function msUntilNextRun(): number {
  const now = new Date();

  // 07:00 WIB = 00:00 UTC
  // Check if today's 00:00 UTC is still in the future (i.e. current WIB time < 07:00)
  const todayMidnightUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );

  if (todayMidnightUTC.getTime() > now.getTime()) {
    // Today's 07:00 WIB hasn't fired yet — schedule it for today
    return todayMidnightUTC.getTime() - now.getTime();
  }

  // Today's 07:00 WIB already passed — schedule for tomorrow
  const tomorrowMidnightUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return tomorrowMidnightUTC.getTime() - now.getTime();
}

/** Runs the collection job and schedules the next run. */
async function runJob(): Promise<void> {
  if (state.isRunning) {
    logger.warn("Scheduler: job already running, skipping this tick");
    scheduleNext();
    return;
  }

  // Reset the per-day briefing retry guard at the START of each new daily run so
  // today's run gets exactly one retry slot.  This must happen here rather than in
  // scheduleNext() so that the guard is still in effect between when the retry is
  // queued and when the next day's runJob() fires.
  briefingRetryScheduledForDate = null;

  state.isRunning = true;
  state.lastRunAt = new Date().toISOString();
  state.totalRunsToday += 1;
  state.nextRunAt = null;

  const { promise: runJobTimeout, cancel: cancelRunJobTimeout } = createRunTimeout(MAX_RUN_DURATION_MS);
  try {
    // Daily job runs ONLY standard-priority sources (MINGGUAN/BULANAN/low-BV HARIAN).
    // High-priority sources (businessValue >= 9) are handled by the 6-hour sub-daily
    // scheduler, including the 07:00 WIB boundary — so we exclude them here to avoid
    // crawling each tier-1 source twice at the same time.
    const standardIds = getStandardCrawlSourceIds(CORE_DATA_SOURCES, new Date());
    logger.info({ standardSourceCount: standardIds.length }, "Scheduler: daily job running standard-priority sources");
    const report = await Promise.race([
      collectDailyData(standardIds.length > 0 ? standardIds : undefined),
      runJobTimeout,
    ]);
    cancelRunJobTimeout();
    state.lastRunResult = report;

    // Step 1: Collection webhook notification (independent — its failure must NOT
    // prevent the briefing from being sent)
    // Lease is declared outside the try so the catch can release it on unexpected throws.
    let schedulerLease: NotificationLease | null = null;
    try {
      // Acquire a dispatch lease via the centralized CAS helper.
      // This sets notification_lease_at so that startup-recovery (which uses the same
      // helper) never reclaims a fresh in-flight claim as stale, even if finished_at is old.
      if (report.runId != null) {
        schedulerLease = await claimNotificationLease(report.runId);
        if (!schedulerLease) {
          logger.warn(
            { runId: report.runId },
            "Scheduler: failed to claim notification lease (already SENDING/SENT or cap reached) — skipping dispatch",
          );
        }
      }

      // Only dispatch when we hold the lease (or there is no runId to track).
      if (report.runId == null || schedulerLease) {
        const notifResult = await sendCollectionNotification(report, report.runId ?? undefined);
        state.lastNotificationResult = notifResult;

        if (report.runId != null && schedulerLease) {
          const schedStatus = notifResult.success
            ? "SENT"
            : schedulerLease.retryCount >= MAX_NOTIFICATION_ATTEMPTS
            ? "FAILED_PERMANENT"
            : "FAILED";
          try {
            await db.update(schedulerRunsTable)
              .set({
                notificationResult: {
                  channel: notifResult.channel,
                  success: notifResult.success,
                  sentAt: notifResult.sentAt,
                  errorMessage: notifResult.errorMessage ?? null,
                  httpStatus: notifResult.httpStatus ?? null,
                },
                notificationStatus: schedStatus,
                ...(notifResult.success ? { notificationSentAt: new Date() } : {}),
              })
              // Scope to the exact lease token (text → timestamptz preserves microseconds).
              .where(and(
                eq(schedulerRunsTable.id, report.runId),
                sql`notification_lease_at = ${schedulerLease.leaseToken}::timestamptz`,
              ));
          } catch (dbErr) {
            logger.error({ dbErr }, "Scheduler: failed to patch notification result into run row");
          }
          // Lease fully resolved — clear so the catch block skips cleanup.
          schedulerLease = null;
        }
      }
    } catch (notifErr) {
      logger.error({ err: notifErr }, "Scheduler: collection notification threw unexpectedly");
      // Best-effort: release any lease we hold so recovery can retry sooner than the stale window.
      if (schedulerLease && report.runId != null) {
        try {
          await db.update(schedulerRunsTable)
            .set({ notificationStatus: "FAILED" })
            .where(and(
              eq(schedulerRunsTable.id, report.runId),
              sql`notification_lease_at = ${schedulerLease.leaseToken}::timestamptz`,
            ));
        } catch {
          // Ignore secondary errors during cleanup
        }
      }
    }

    // Step 2: Daily briefing PDF delivery — always attempted after successful
    // data collection, regardless of notification outcome above.
    // deliverDailyBriefing() has its own idempotency guard; restart-duplicates
    // are rejected by the briefing_deliveries unique constraint.
    try {
      const deliveryReport = await deliverDailyBriefing();
      scheduleBriefingRetryIfNeeded(deliveryReport.status, false);
    } catch (deliveryErr) {
      logger.error({ err: deliveryErr }, "Scheduler: briefing delivery threw unexpectedly");
    }

    // Step 3: PBG (Persetujuan Bangunan Gedung) city alerts — send WA alerts to
    // subscribers when new PBG-related data is detected for their watched cities.
    // Independent of the briefing delivery; failure must NOT affect either previous step.
    try {
      const pbgReport = await runPbgAlerts();
      if (pbgReport.pbgItemsFound > 0) {
        logger.info(
          { pbgItemsFound: pbgReport.pbgItemsFound, alertsSent: pbgReport.alertsSent, alertsFailed: pbgReport.alertsFailed },
          "Scheduler: PBG alerts dispatched",
        );
      } else {
        logger.info("Scheduler: no new PBG signals detected for today");
      }
    } catch (pbgErr) {
      logger.error({ err: pbgErr }, "Scheduler: PBG alert check threw unexpectedly");
    }
  } catch (err) {
    cancelRunJobTimeout();
    if (err instanceof Error && err.message === "SCHEDULER_RUN_TIMEOUT") {
      logger.error({ maxMinutes: MAX_RUN_DURATION_MS / 60000 }, "Scheduler: run exceeded max duration — releasing lock");
      await markRunningAsInterrupted();
    } else {
      logger.error({ err }, "Scheduler: collectDailyData threw unexpectedly");
    }
  } finally {
    state.isRunning = false;
    scheduleNext();
  }
}

function scheduleNext(): void {
  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
  }
  const ms = msUntilNextRun();
  const nextAt = new Date(Date.now() + ms).toISOString();
  state.nextRunAt = nextAt;
  schedulerTimer = setTimeout(runJob, ms);
  logger.info({ nextRunAt: nextAt, msUntilRun: ms }, "Scheduler: next run scheduled");
}

/**
 * Schedule a one-shot 5-minute retry of briefing delivery when the first attempt
 * was PARTIAL or FAILED.  At most 1 retry per WIB date is ever scheduled —
 * `briefingRetryScheduledForDate` guards against double-scheduling from
 * concurrent paths (e.g. runJob + triggerNow arriving close together).
 *
 * @param status   The `status` field from the DeliveryReport returned by deliverDailyBriefing.
 * @param isManual Whether the delivery attempt was triggered manually (triggerNow).
 *                 Manual triggers also earn a retry so operators don't have to wait.
 */
function scheduleBriefingRetryIfNeeded(
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED" | undefined,
  isManual: boolean,
): void {
  if (status !== "PARTIAL" && status !== "FAILED") return;

  // Derive today's WIB date string (YYYY-MM-DD) as the deduplication key
  const todayWIB = new Date(Date.now() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  if (briefingRetryScheduledForDate === todayWIB) {
    logger.info(
      { status, todayWIB, isManual },
      "Scheduler: briefing retry already scheduled for today — skipping duplicate",
    );
    return;
  }

  briefingRetryScheduledForDate = todayWIB;
  const retryDelayMs = 5 * 60 * 1000; // 5 minutes

  logger.warn(
    { status, retryAt: new Date(Date.now() + retryDelayMs).toISOString(), isManual },
    "Scheduler: briefing delivery incomplete — scheduling 1× retry in 5 minutes",
  );

  setTimeout(async () => {
    logger.info("Scheduler: executing briefing delivery retry");
    try {
      const retryReport = await deliverDailyBriefing();
      logger.info(
        { status: retryReport.status },
        "Scheduler: briefing delivery retry finished",
      );
      if (retryReport.status === "FAILED" || retryReport.status === "PARTIAL") {
        const allFailed = [...retryReport.emailResults, ...retryReport.whatsappResults]
          .filter((r) => !r.success && r.error)
          .map((r) => `${r.recipient}: ${r.error ?? "unknown error"}`);
        void sendBriefingDeliveryAlert({
          deliveryDate: todayWIB,
          status: retryReport.status as "FAILED" | "PARTIAL",
          successCount: [...retryReport.emailResults, ...retryReport.whatsappResults].filter((r) => r.success).length,
          failCount: allFailed.length,
          errors: allFailed,
          isRetry: true,
        }).catch((alertErr) =>
          logger.error({ err: alertErr }, "Scheduler: failed to send briefing retry failure alert"),
        );
      }
    } catch (retryErr) {
      logger.error({ err: retryErr }, "Scheduler: briefing delivery retry threw unexpectedly");
    }
  }, retryDelayMs);
}

// ─── Sub-daily high-priority crawler (every 6 hours) ─────────────────────────

/**
 * Runs only high-priority sources (businessValue >= 9, frequency HARIAN/REALTIME).
 * This is a lightweight collection — no briefing delivery, no webhook notification.
 */
async function runHighPriorityJob(): Promise<void> {
  if (state.isRunning) {
    logger.info("Scheduler: daily job running, skipping high-priority tick");
    scheduleNextHighPriority();
    return;
  }

  const sourceIds = getHighPrioritySourceIds(CORE_DATA_SOURCES);
  if (sourceIds.length === 0) {
    scheduleNextHighPriority();
    return;
  }

  logger.info({ sourceCount: sourceIds.length }, "Scheduler: running high-priority sub-daily crawl");
  state.isRunning = true;
  state.lastRunAt = new Date().toISOString();
  state.totalRunsToday += 1;

  const { promise: hpTimeout, cancel: cancelHpTimeout } = createRunTimeout(MAX_RUN_DURATION_MS);
  try {
    const report = await Promise.race([collectDailyData(sourceIds), hpTimeout]);
    state.lastRunResult = report;
    logger.info(
      { itemsSaved: report.totalItemsSaved, sources: sourceIds.length },
      "Scheduler: high-priority crawl complete",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "SCHEDULER_RUN_TIMEOUT") {
      logger.error({ sourceIds }, "Scheduler: high-priority crawl timed out — releasing lock");
      await markRunningAsInterrupted().catch(() => {});
    } else {
      logger.error({ err }, "Scheduler: high-priority crawl threw unexpectedly");
    }
  } finally {
    cancelHpTimeout();
    state.isRunning = false;
    scheduleNextHighPriority();
  }
}

function scheduleNextHighPriority(): void {
  if (highPriorityTimer !== null) {
    clearTimeout(highPriorityTimer);
  }
  const ms = msUntilNextHighPriorityRun();
  const nextAt = new Date(Date.now() + ms).toISOString();
  highPriorityTimer = setTimeout(runHighPriorityJob, ms);
  logger.info({ nextHighPriorityRunAt: nextAt, msUntilRun: ms }, "Scheduler: next high-priority run scheduled");
}

// ─── public API ───────────────────────────────────────────────────────────────

/** Start the scheduler (call once from index.ts). */
export function startScheduler(): void {
  // isRunning is in-memory and always false at process start — no lock carries
  // over from a previous server instance.  Any DB rows that were stuck in
  // RUNNING have already been flipped to INTERRUPTED by interruptStaleRuns()
  // before this function is called, so the timer starts from a clean slate.
  logger.info(
    { isRunning: state.isRunning, totalRunsToday: state.totalRunsToday },
    "Scheduler: initialising — in-memory state is clean, no lock carry-over from previous process",
  );
  scheduleNext();
  // Sub-daily: crawl high-priority sources every 6 hours
  scheduleNextHighPriority();
}

/** Trigger an immediate run (used by the manual-trigger API endpoint).
 *  Pass an optional array of sourceIds to run only specific sources. */
export async function triggerNow(sourceIds?: string[]): Promise<DailyCollectionReport> {
  if (state.isRunning) {
    throw new Error("Scheduler job is already running. Please wait for it to finish.");
  }
  // Run the job but don't let it reschedule via runJob(); we want the scheduled
  // timer to keep its existing countdown.
  state.isRunning = true;
  state.lastRunAt = new Date().toISOString();
  state.totalRunsToday += 1;

  const { promise: triggerTimeout, cancel: cancelTriggerTimeout } = createRunTimeout(MAX_RUN_DURATION_MS);
  try {
    const report = await Promise.race([collectDailyData(sourceIds), triggerTimeout]);
    state.lastRunResult = report;

    // Collection notification (independent step — failure must not suppress briefing)
    // Lease declared outside so the catch can release it on unexpected throws.
    let triggerLease: NotificationLease | null = null;
    try {
      if (report.runId != null) {
        triggerLease = await claimNotificationLease(report.runId);
        if (!triggerLease) {
          logger.warn(
            { runId: report.runId },
            "Scheduler (triggerNow): failed to claim notification lease — skipping dispatch",
          );
        }
      }

      if (report.runId == null || triggerLease) {
        const notifResult = await sendCollectionNotification(report, report.runId ?? undefined);
        state.lastNotificationResult = notifResult;

        if (report.runId != null && triggerLease) {
          const triggerStatus = notifResult.success
            ? "SENT"
            : triggerLease.retryCount >= MAX_NOTIFICATION_ATTEMPTS
            ? "FAILED_PERMANENT"
            : "FAILED";
          try {
            await db.update(schedulerRunsTable)
              .set({
                notificationResult: {
                  channel: notifResult.channel,
                  success: notifResult.success,
                  sentAt: notifResult.sentAt,
                  errorMessage: notifResult.errorMessage ?? null,
                  httpStatus: notifResult.httpStatus ?? null,
                },
                notificationStatus: triggerStatus,
                ...(notifResult.success ? { notificationSentAt: new Date() } : {}),
              })
              .where(and(
                eq(schedulerRunsTable.id, report.runId),
                sql`notification_lease_at = ${triggerLease.leaseToken}::timestamptz`,
              ));
          } catch {}
          // Lease fully resolved — clear so the catch block skips cleanup.
          triggerLease = null;
        }
      }
    } catch (notifErr) {
      logger.error({ err: notifErr }, "Scheduler: collection notification threw unexpectedly (triggerNow)");
      // Best-effort: release any lease we hold so recovery can retry sooner than the stale window.
      if (triggerLease && report.runId != null) {
        try {
          await db.update(schedulerRunsTable)
            .set({ notificationStatus: "FAILED" })
            .where(and(
              eq(schedulerRunsTable.id, report.runId),
              sql`notification_lease_at = ${triggerLease.leaseToken}::timestamptz`,
            ));
        } catch {
          // Ignore secondary errors during cleanup
        }
      }
    }

    // Briefing PDF delivery (independent step, always attempted)
    try {
      const deliveryReport = await deliverDailyBriefing();
      scheduleBriefingRetryIfNeeded(deliveryReport.status, true);
    } catch (deliveryErr) {
      logger.error({ err: deliveryErr }, "Scheduler: briefing delivery threw unexpectedly (triggerNow)");
    }

    // PBG city alerts (independent step — always attempted)
    try {
      const pbgReport = await runPbgAlerts();
      logger.info(
        { pbgItemsFound: pbgReport.pbgItemsFound, alertsSent: pbgReport.alertsSent },
        "Scheduler (triggerNow): PBG alert check complete",
      );
    } catch (pbgErr) {
      logger.error({ err: pbgErr }, "Scheduler: PBG alert check threw unexpectedly (triggerNow)");
    }

    cancelTriggerTimeout();
    return report;
  } catch (err) {
    cancelTriggerTimeout();
    if (err instanceof Error && err.message === "SCHEDULER_RUN_TIMEOUT") {
      logger.error({ maxMinutes: MAX_RUN_DURATION_MS / 60000 }, "Scheduler: triggerNow exceeded max duration — releasing lock");
      await markRunningAsInterrupted();
      throw new Error("Run melebihi batas waktu maksimum 30 menit dan dihentikan otomatis.");
    }
    throw err;
  } finally {
    state.isRunning = false;
  }
}

/** Return a read-only snapshot of scheduler state. */
export function getSchedulerStatus(): SchedulerStatus {
  return { ...state };
}
