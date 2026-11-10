/**
 * resendPendingNotifications — startup-recovery logic for collection notifications.
 *
 * On server restart, find any COMPLETED scheduler_runs whose webhook was never
 * successfully dispatched and attempt re-delivery. Runs that have already
 * reached MAX_NOTIFICATION_ATTEMPTS are permanently abandoned.
 *
 * The notifier parameter is injectable so tests can pass a stub without
 * needing ESM module mocking.
 */

import { pool } from "@workspace/db";
import { logger } from "./logger";
import type { DailyCollectionReport } from "./collectDailyData";
import { sendCollectionNotification } from "./notify";
import type { NotificationResult } from "./notify";
import { claimNotificationLease, MAX_NOTIFICATION_ATTEMPTS, LEASE_STALE_MINUTES } from "./notificationLease";

// Re-export so existing imports from this module are not broken.
export { MAX_NOTIFICATION_ATTEMPTS };

export type NotificationSender = (
  report: DailyCollectionReport,
  runId?: number,
) => Promise<NotificationResult>;

/**
 * On startup, find any COMPLETED runs whose notification was never dispatched
 * and send the notification now.  This recovers from server crashes that happened
 * between collection finishing and the webhook call.
 *
 * Runs that have already failed MAX_NOTIFICATION_ATTEMPTS times are skipped and
 * marked FAILED_PERMANENT so they are never retried again.
 *
 * Uses raw SQL so it works even if the ORM type cache is stale after a cold boot.
 *
 * @param notifier  Async function that delivers the notification.  Defaults to
 *                  the real sendCollectionNotification.  Pass a stub in tests.
 */
export async function resendPendingNotifications(
  notifier: NotificationSender = sendCollectionNotification,
): Promise<void> {
  try {
    // First pass: mark any exhausted rows as FAILED_PERMANENT so they are clearly
    // labelled and will never be retried again.  These rows were excluded from the
    // SELECT below by the `notification_retry_count < MAX` predicate, which means
    // without this step they would sit as FAILED (or NULL) indefinitely.
    //
    // NOTE: `NOT IN ('SENT', 'FAILED_PERMANENT')` evaluates to NULL (not TRUE) when
    // notification_status IS NULL, so we must explicitly allow NULL via IS NULL.
    const { rowCount: permanentCount } = await pool.query(
      `UPDATE scheduler_runs
       SET notification_status = 'FAILED_PERMANENT'
       WHERE status = 'COMPLETED'
         AND notification_retry_count >= ${MAX_NOTIFICATION_ATTEMPTS}
         AND (
           notification_status IS NULL
           OR notification_status NOT IN ('SENT', 'FAILED_PERMANENT')
         )`,
    );
    if ((permanentCount ?? 0) > 0) {
      logger.warn(
        { count: permanentCount },
        "Startup: marked exhausted notification runs as FAILED_PERMANENT",
      );
    }

    // Lease timeout: if a row has been SENDING for more than 10 minutes, assume the
    // previous process crashed after the pre-dispatch claim but before confirmation.
    //
    // We use notification_lease_at (set whenever we transition to SENDING) rather than
    // finished_at (the crawler completion time). Historical runs retried manually always have
    // an old finished_at, so the old condition would immediately reclaim their live lease.
    const { rows } = await pool.query<{
      id: number;
      started_at: Date;
      finished_at: Date;
      total_items_saved: string;
      notification_retry_count: number;
      results: Array<{
        itemsSaved: number;
        itemsSkipped: number;
        sourceId: string;
        sourceName: string;
        status: string;
        errorMessage?: string | null;
      }>;
    }>(`
      SELECT id, started_at, finished_at, total_items_saved, notification_retry_count, results
      FROM scheduler_runs
      WHERE status = 'COMPLETED'
        AND finished_at IS NOT NULL
        AND notification_retry_count < ${MAX_NOTIFICATION_ATTEMPTS}
        AND (
          notification_status IS NULL
          OR notification_status IN ('PENDING', 'FAILED')
          OR (
            notification_status = 'SENDING'
            AND (
              notification_lease_at IS NULL
              OR notification_lease_at < NOW() - INTERVAL '10 minutes'
            )
          )
        )
      ORDER BY started_at ASC
    `);

    if (rows.length === 0) {
      logger.info("Startup: no pending notifications to resend");
      return;
    }

    logger.warn(
      { count: rows.length, runIds: rows.map((r) => r.id) },
      "Startup: resending notifications for completed runs that were never notified",
    );

    for (const row of rows) {
      try {
        // Fast-path: skip rows already at the cap (SELECT predicate already excludes them,
        // but guard here in case of a race with the first-pass FAILED_PERMANENT promotion).
        if ((row.notification_retry_count ?? 0) >= MAX_NOTIFICATION_ATTEMPTS) {
          logger.warn(
            { runId: row.id, retryCount: row.notification_retry_count, maxAttempts: MAX_NOTIFICATION_ATTEMPTS },
            "Startup: notification permanently abandoned — max attempts reached, webhook may be dead",
          );
          continue;
        }

        // Atomic CAS claim via shared helper.  Returns the lease token or null if another
        // live request already holds the lease / the cap was reached between SELECT and here.
        const lease = await claimNotificationLease(row.id);
        if (!lease) {
          logger.info(
            { runId: row.id },
            "Startup: skipped run — lease already held by concurrent request or cap reached",
          );
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
          notifResult = await notifier(report, row.id);
        } catch (notifierErr) {
          // Notifier threw — release the lease we hold so the run is retryable
          // sooner than the 10-minute stale window.
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
            "Startup: notifier threw — lease released",
          );
          throw notifierErr;
        }

        // Serialize the notification result for storage.
        const resultJson = JSON.stringify({
          channel: notifResult.channel,
          success: notifResult.success,
          sentAt: notifResult.sentAt,
          errorMessage: notifResult.errorMessage ?? null,
          httpStatus: notifResult.httpStatus ?? null,
        });

        // Terminal update scoped to the lease token: only our claim can write the final status.
        // A concurrent manual-retry that reclaimed a stale lease after the 10-min window would
        // have a different notification_lease_at, so its terminal update will not collide.
        if (notifResult.success) {
          await pool.query(
            `UPDATE scheduler_runs
             SET notification_status  = 'SENT',
                 notification_sent_at = NOW(),
                 notification_result  = $1
             WHERE id = $2
               AND notification_lease_at = $3::timestamptz`,
            [resultJson, row.id, lease.leaseToken],
          );
        } else {
          // Promote to FAILED_PERMANENT if this attempt exhausted the cap.
          const terminalStatus = lease.retryCount >= MAX_NOTIFICATION_ATTEMPTS ? "FAILED_PERMANENT" : "FAILED";
          await pool.query(
            `UPDATE scheduler_runs
             SET notification_status = $1,
                 notification_result = $2
             WHERE id = $3
               AND notification_lease_at = $4::timestamptz`,
            [terminalStatus, resultJson, row.id, lease.leaseToken],
          );
          logger.warn(
            {
              runId: row.id,
              retryCount: lease.retryCount,
              maxRetries: MAX_NOTIFICATION_ATTEMPTS,
              willRetry: terminalStatus === "FAILED",
              terminalStatus,
            },
            "Startup: notification dispatch failed — counter incremented",
          );
        }

        logger.info(
          { runId: row.id, success: notifResult.success, retryCount: lease.retryCount },
          "Startup: resent notification for run",
        );
      } catch (runErr) {
        logger.error(
          { err: runErr, runId: row.id },
          "Startup: failed to resend notification for run",
        );
      }
    }
  } catch (err) {
    logger.error(
      { err },
      "Startup: resendPendingNotifications failed — continuing anyway",
    );
  }
}
