/**
 * Integration tests for resendPendingNotifications().
 *
 * These tests use a real DB connection so they verify the actual SQL queries
 * and column names — not just the application logic in isolation.
 *
 * Isolation: each test deletes its own row immediately after assertions so
 * subsequent test calls to resendPendingNotifications() never see stale rows
 * from a previous test.  The after() hook is a safety net for any rows that
 * escape cleanup due to a failing assertion.
 *
 * Run: pnpm --filter @workspace/api-server test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
import {
  resendPendingNotifications,
  MAX_NOTIFICATION_ATTEMPTS,
} from "./resendPendingNotifications.js";
import { claimNotificationLease, LEASE_STALE_MINUTES } from "./notificationLease.js";
import type { NotificationResult } from "./notify.js";
import type { DailyCollectionReport } from "./collectDailyData.js";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** IDs inserted during this test run — used as a safety-net in after(). */
const insertedIds: number[] = [];

/**
 * Insert a minimal scheduler_run row and return its generated id.
 */
async function insertRun(opts: {
  notificationStatus: string | null;
  notificationSentAt: Date | null;
  notificationRetryCount?: number;
}): Promise<number> {
  const now = new Date();
  const finishedAt = new Date(now.getTime() + 1000);
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO scheduler_runs
       (status, started_at, finished_at, total_items_saved, results,
        notification_status, notification_sent_at, notification_retry_count)
     VALUES ('COMPLETED', $1, $2, '0', '[]', $3, $4, $5)
     RETURNING id`,
    [
      now,
      finishedAt,
      opts.notificationStatus,
      opts.notificationSentAt,
      opts.notificationRetryCount ?? 0,
    ],
  );
  const id = rows[0]!.id;
  insertedIds.push(id);
  return id;
}

/** Delete a single test row — called at the end of each test for isolation. */
async function deleteRun(id: number): Promise<void> {
  await pool.query(`DELETE FROM scheduler_runs WHERE id = $1`, [id]);
}

/** Read back a single row's notification columns. */
async function readRow(id: number): Promise<{
  notification_status: string | null;
  notification_sent_at: Date | null;
  notification_retry_count: number;
}> {
  const { rows } = await pool.query<{
    notification_status: string | null;
    notification_sent_at: Date | null;
    notification_retry_count: number;
  }>(
    `SELECT notification_status, notification_sent_at, notification_retry_count
     FROM scheduler_runs WHERE id = $1`,
    [id],
  );
  assert.ok(rows[0], `Row ${id} not found`);
  return rows[0]!;
}

/** A notifier stub that always reports success. */
function makeSuccessNotifier(): {
  notifier: (r: DailyCollectionReport, runId?: number) => Promise<NotificationResult>;
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    notifier: async (_report, runId) => {
      if (runId != null) calls.push(runId);
      return {
        channel: "webhook",
        success: true,
        sentAt: new Date().toISOString(),
      };
    },
  };
}

/** A notifier stub that always reports failure. */
function makeFailureNotifier(): {
  notifier: (r: DailyCollectionReport, runId?: number) => Promise<NotificationResult>;
  calls: number[];
} {
  const calls: number[] = [];
  return {
    calls,
    notifier: async (_report, runId) => {
      if (runId != null) calls.push(runId);
      return {
        channel: "webhook",
        success: false,
        sentAt: new Date().toISOString(),
        errorMessage: "stub failure",
        httpStatus: 500,
      };
    },
  };
}

// ─── schema bootstrap ─────────────────────────────────────────────────────────

before(async () => {
  // Ensure the columns added by ensureSchemas() exist before the tests run.
  // These are idempotent ALTER TABLE … ADD COLUMN IF NOT EXISTS statements so
  // they are safe to run against an already-migrated database.
  await pool.query(`
    ALTER TABLE scheduler_runs
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED';
    ALTER TABLE scheduler_runs
      ALTER COLUMN finished_at DROP NOT NULL;
    ALTER TABLE scheduler_runs
      ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
    ALTER TABLE scheduler_runs
      ADD COLUMN IF NOT EXISTS notification_status TEXT;
    ALTER TABLE scheduler_runs
      ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE scheduler_runs
      ADD COLUMN IF NOT EXISTS notification_retry_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE scheduler_runs
      ADD COLUMN IF NOT EXISTS notification_lease_at TIMESTAMPTZ;
  `);
});

// ─── safety-net cleanup ───────────────────────────────────────────────────────

after(async () => {
  if (insertedIds.length > 0) {
    await pool.query(
      `DELETE FROM scheduler_runs WHERE id = ANY($1::int[])`,
      [insertedIds],
    );
  }
  await pool.end();
});

// ─── tests ───────────────────────────────────────────────────────────────────

describe("resendPendingNotifications", () => {
  // ── 1: pending (NULL status) row gets notified and stamped ────────────────
  it("sends notification and stamps notification_sent_at for a NULL-status run", async () => {
    const id = await insertRun({ notificationStatus: null, notificationSentAt: null });
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      const row = await readRow(id);
      assert.equal(row.notification_status, "SENT", "status should be SENT");
      assert.ok(
        row.notification_sent_at instanceof Date,
        "notification_sent_at should be a Date",
      );
      assert.ok(calls.includes(id), "notifier should have been called with the run id");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 2: pending (PENDING status) row gets notified and stamped ────────────
  it("sends notification for a PENDING-status run", async () => {
    const id = await insertRun({ notificationStatus: "PENDING", notificationSentAt: null });
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      const row = await readRow(id);
      assert.equal(row.notification_status, "SENT");
      assert.ok(row.notification_sent_at instanceof Date);
      assert.ok(calls.includes(id));
    } finally {
      await deleteRun(id);
    }
  });

  // ── 3: already-SENT run is never re-processed ─────────────────────────────
  it("does NOT re-process a run that already has notification_sent_at set (SENT status)", async () => {
    const alreadySentAt = new Date();
    const id = await insertRun({
      notificationStatus: "SENT",
      notificationSentAt: alreadySentAt,
    });
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      assert.ok(!calls.includes(id), "notifier must NOT be called for an already-SENT run");
      const row = await readRow(id);
      assert.equal(row.notification_status, "SENT");
      assert.ok(row.notification_sent_at instanceof Date);
    } finally {
      await deleteRun(id);
    }
  });

  // ── 4: FAILED run is retried on next startup ──────────────────────────────
  it("retries a FAILED run and stamps notification_sent_at on success", async () => {
    const id = await insertRun({
      notificationStatus: "FAILED",
      notificationSentAt: null,
      notificationRetryCount: 1,
    });
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      const row = await readRow(id);
      assert.equal(row.notification_status, "SENT");
      assert.ok(row.notification_sent_at instanceof Date);
      assert.ok(calls.includes(id));
    } finally {
      await deleteRun(id);
    }
  });

  // ── 5: failed delivery leaves status=FAILED and increments retry count ────
  it("leaves status=FAILED and increments notification_retry_count when delivery fails", async () => {
    const id = await insertRun({
      notificationStatus: null,
      notificationSentAt: null,
      notificationRetryCount: 0,
    });
    try {
      const { notifier } = makeFailureNotifier();
      await resendPendingNotifications(notifier);

      const row = await readRow(id);
      assert.equal(row.notification_status, "FAILED");
      assert.equal(row.notification_sent_at, null, "notification_sent_at must remain null on failure");
      assert.equal(row.notification_retry_count, 1, "retry count should be incremented to 1");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 6: FAILED run at MAX_NOTIFICATION_ATTEMPTS is permanently abandoned ───
  it("marks a FAILED run FAILED_PERMANENT when notification_retry_count equals MAX_NOTIFICATION_ATTEMPTS", async () => {
    const id = await insertRun({
      notificationStatus: "FAILED",
      notificationSentAt: null,
      notificationRetryCount: MAX_NOTIFICATION_ATTEMPTS,
    });
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      const row = await readRow(id);
      assert.equal(row.notification_status, "FAILED_PERMANENT");
      assert.ok(!calls.includes(id), "notifier must NOT be called when attempts exhausted");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 7: NULL-status run at MAX_NOTIFICATION_ATTEMPTS is permanently abandoned
  // (NULL-safe exhaustion check — `NOT IN` is false for NULL in SQL)
  it("marks a NULL-status run FAILED_PERMANENT when notification_retry_count equals MAX_NOTIFICATION_ATTEMPTS", async () => {
    const id = await insertRun({
      notificationStatus: null,
      notificationSentAt: null,
      notificationRetryCount: MAX_NOTIFICATION_ATTEMPTS,
    });
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      const row = await readRow(id);
      assert.equal(
        row.notification_status,
        "FAILED_PERMANENT",
        "NULL-status exhausted run must become FAILED_PERMANENT",
      );
      assert.ok(!calls.includes(id), "notifier must NOT be called for an exhausted run");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 8: throwing notifier releases the lease to FAILED promptly ───────────
  it("releases lease to FAILED when the notifier throws an unexpected error", async () => {
    const id = await insertRun({ notificationStatus: null, notificationSentAt: null, notificationRetryCount: 0 });
    try {
      const throwingNotifier = async () => {
        throw new Error("simulated network failure");
      };
      // resendPendingNotifications catches per-run errors and continues — it must not rethrow.
      await resendPendingNotifications(throwingNotifier as never);

      const row = await readRow(id);
      // The per-notifier-throw block releases the lease to FAILED promptly —
      // no need to wait for the 10-min stale window.
      assert.equal(row.notification_retry_count, 1, "retry count must be incremented at claim time even on throw");
      assert.equal(row.notification_status, "FAILED", "status must be released to FAILED on throw so recovery can retry promptly");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 9: stale SENDING lease is reclaimed by recovery ──────────────────────
  it("reclaims a SENDING row whose notification_lease_at is older than the stale window", async () => {
    const id = await insertRun({ notificationStatus: null, notificationSentAt: null, notificationRetryCount: 0 });
    // Manually set the row to SENDING with an old lease_at to simulate a crashed process.
    await pool.query(
      `UPDATE scheduler_runs
       SET notification_status   = 'SENDING',
           notification_lease_at = NOW() - ($1 || ' minutes')::INTERVAL - INTERVAL '1 minute',
           notification_retry_count = 1
       WHERE id = $2`,
      [LEASE_STALE_MINUTES, id],
    );
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      const row = await readRow(id);
      assert.ok(calls.includes(id), "notifier must be called for a stale SENDING run");
      assert.equal(row.notification_status, "SENT");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 10: fresh SENDING lease is NOT reclaimed by a concurrent caller ────────
  it("skips a SENDING row whose notification_lease_at is fresh (another live request holds it)", async () => {
    const id = await insertRun({ notificationStatus: null, notificationSentAt: null, notificationRetryCount: 0 });
    // Claim the lease directly — simulates a live manual-retry or scheduler holding it.
    const lease = await claimNotificationLease(id);
    assert.ok(lease, "first claim must succeed");
    try {
      const { notifier, calls } = makeSuccessNotifier();
      await resendPendingNotifications(notifier);

      // Recovery must not call the notifier for this run.
      assert.ok(!calls.includes(id), "notifier must NOT be called while a fresh lease is held");
      // Row remains SENDING.
      const row = await readRow(id);
      assert.equal(row.notification_status, "SENDING");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 11: concurrent claimNotificationLease — only the first caller wins ─────
  it("returns null for a second concurrent claim on the same run", async () => {
    const id = await insertRun({ notificationStatus: null, notificationSentAt: null, notificationRetryCount: 0 });
    try {
      const first = await claimNotificationLease(id);
      assert.ok(first, "first claim must succeed");

      const second = await claimNotificationLease(id);
      assert.equal(second, null, "second concurrent claim must be rejected while first lease is fresh");
    } finally {
      await deleteRun(id);
    }
  });

  // ── 12: token-scoped terminal update is a no-op with a wrong/stale token ───
  it("does not update notification_status when the lease token does not match", async () => {
    const id = await insertRun({ notificationStatus: null, notificationSentAt: null, notificationRetryCount: 0 });
    const lease = await claimNotificationLease(id);
    assert.ok(lease, "claim must succeed");
    try {
      // Attempt a terminal write with a deliberately wrong timestamp token.
      const { rowCount } = await pool.query(
        `UPDATE scheduler_runs
         SET notification_status = 'SENT'
         WHERE id = $1
           AND notification_lease_at = '1970-01-01T00:00:00.000000+00'::timestamptz`,
        [id],
      );
      assert.equal(rowCount, 0, "wrong-token terminal update must affect 0 rows");
      // Status should still be SENDING — the original lease is intact.
      const row = await readRow(id);
      assert.equal(row.notification_status, "SENDING");
    } finally {
      await deleteRun(id);
    }
  });
});
