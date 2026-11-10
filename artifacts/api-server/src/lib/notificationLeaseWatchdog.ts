/**
 * notificationLeaseWatchdog — periodic background sweeper for stale SENDING leases.
 *
 * Problem: a notification dispatch can crash mid-flight (network timeout, process OOM,
 * uncaught throw) without triggering a full server restart.  In that case:
 *   - The row stays in SENDING with an old notification_lease_at.
 *   - resendPendingNotifications() (startup-only) has already run and won't run again.
 *   - The lease IS reclaimable by claimNotificationLease(), but only if a manual retry
 *     or a new server restart happens — which could be hours or days away.
 *
 * Solution: run a lightweight SQL scan every WATCHDOG_INTERVAL_MS.  When a row is
 * found stuck in SENDING beyond the stale window (LEASE_STALE_MINUTES), re-dispatch
 * via the same claimNotificationLease → sendCollectionNotification path used by startup
 * recovery.  The atomic CAS in claimNotificationLease ensures at-most-one delivery even
 * if concurrent dispatchers (the watchdog + a manual retry) race on the same row.
 */

import { pool } from "@workspace/db";
import { logger } from "./logger";
import { claimNotificationLease, MAX_NOTIFICATION_ATTEMPTS, LEASE_STALE_MINUTES } from "./notificationLease";
import { sendCollectionNotification } from "./notify";
import type { DailyCollectionReport } from "./collectDailyData";

/** How often the watchdog wakes up and checks for stale leases. */
export const WATCHDOG_INTERVAL_MS = LEASE_STALE_MINUTES * 60 * 1000; // same as stale window

type StaleRow = {
  id: number;
  started_at: Date;
  finished_at: Date;
  total_items_saved: string;
  notification_retry_count: number;
  results: DailyCollectionReport["results"];
};

async function rescueStaleSendingLeases(): Promise<void> {
  const { rows } = await pool.query<StaleRow>(`
    SELECT id, started_at, finished_at, total_items_saved, notification_retry_count, results
    FROM scheduler_runs
    WHERE status = 'COMPLETED'
      AND finished_at IS NOT NULL
      AND notification_status = 'SENDING'
      AND notification_lease_at IS NOT NULL
      AND notification_lease_at < NOW() - ($1 || ' minutes')::INTERVAL
      AND notification_retry_count < $2
    ORDER BY started_at ASC
    LIMIT 10
  `, [LEASE_STALE_MINUTES, MAX_NOTIFICATION_ATTEMPTS]);

  if (rows.length === 0) return;

  logger.warn(
    { count: rows.length, runIds: rows.map((r) => r.id) },
    "Notification watchdog: found stale SENDING leases — rescuing",
  );

  for (const row of rows) {
    try {
      // Atomic CAS claim — reclaims the stale lease; returns null if someone else already did.
      const lease = await claimNotificationLease(row.id);
      if (!lease) {
        logger.info({ runId: row.id }, "Notification watchdog: lease already reclaimed concurrently, skipping");
        continue;
      }

      const results = (row.results ?? []) as DailyCollectionReport["results"];
      const report: DailyCollectionReport = {
        startedAt: row.started_at.toISOString(),
        finishedAt: row.finished_at.toISOString(),
        totalItemsSaved: parseInt(row.total_items_saved, 10) || 0,
        totalItemsSkipped: results.reduce((s, r) => s + (r.itemsSkipped ?? 0), 0),
        results,
      };

      let notifResult;
      try {
        notifResult = await sendCollectionNotification(report, row.id);
      } catch (notifierErr) {
        // Release the lease early so the next watchdog tick can retry sooner.
        const releaseStatus = lease.retryCount >= MAX_NOTIFICATION_ATTEMPTS ? "FAILED_PERMANENT" : "FAILED";
        await pool.query(
          `UPDATE scheduler_runs
           SET notification_status = $1
           WHERE id = $2
             AND notification_lease_at = $3::timestamptz`,
          [releaseStatus, row.id, lease.leaseToken],
        );
        logger.warn(
          { runId: row.id, retryCount: lease.retryCount, releaseStatus },
          "Notification watchdog: notifier threw — lease released",
        );
        continue;
      }

      const newStatus = notifResult.success
        ? "SENT"
        : lease.retryCount >= MAX_NOTIFICATION_ATTEMPTS
        ? "FAILED_PERMANENT"
        : "FAILED";

      const resultJson = JSON.stringify({
        channel: notifResult.channel,
        success: notifResult.success,
        sentAt: notifResult.sentAt,
        errorMessage: notifResult.errorMessage ?? null,
        httpStatus: notifResult.httpStatus ?? null,
      });

      if (notifResult.success) {
        await pool.query(
          `UPDATE scheduler_runs
           SET notification_status  = $1,
               notification_sent_at = NOW(),
               notification_result  = $2
           WHERE id = $3
             AND notification_lease_at = $4::timestamptz`,
          [newStatus, resultJson, row.id, lease.leaseToken],
        );
      } else {
        await pool.query(
          `UPDATE scheduler_runs
           SET notification_status = $1,
               notification_result = $2
           WHERE id = $3
             AND notification_lease_at = $4::timestamptz`,
          [newStatus, resultJson, row.id, lease.leaseToken],
        );
      }

      logger.info(
        { runId: row.id, success: notifResult.success, retryCount: lease.retryCount, newStatus },
        "Notification watchdog: stale SENDING lease rescued",
      );
    } catch (err) {
      logger.error({ err, runId: row.id }, "Notification watchdog: failed to rescue run");
    }
  }
}

let watchdogTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background watchdog.  Call once from index.ts after the server starts.
 * Safe to call multiple times (no-op if already running).
 */
export function startNotificationLeaseWatchdog(): void {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(() => {
    rescueStaleSendingLeases().catch((err) => {
      logger.error({ err }, "Notification watchdog: unexpected error during sweep");
    });
  }, WATCHDOG_INTERVAL_MS);
  // Unref so the timer doesn't prevent the process from exiting cleanly.
  watchdogTimer.unref();
  logger.info(
    { intervalMinutes: LEASE_STALE_MINUTES },
    "Notification lease watchdog started",
  );
}

/** Stop the watchdog (primarily for tests). */
export function stopNotificationLeaseWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
