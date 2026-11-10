/**
 * Centralized notification dispatch lease for scheduler_runs.
 *
 * Every code path that sends a collection notification — the live scheduler
 * (runJob / triggerNow), startup recovery, and the manual retry endpoint — must
 * claim a lease through claimNotificationLease() before dispatching and scope its
 * terminal update to the returned lease token.  This guarantees:
 *
 *  • At-most-one dispatch per attempt: two concurrent callers for the same run
 *    race on a single atomic UPDATE; only the first gets the lease.
 *  • Recovery does not reclaim live leases: the stale-lease window uses
 *    notification_lease_at (set here) rather than finished_at (the crawler
 *    completion time, which is always old for historical runs).
 *  • Terminal updates are idempotent: scoped to `notification_lease_at = :token::timestamptz`
 *    so a late writer cannot overwrite a SENT already persisted by recovery.
 *  • Consistent attempt counting: notification_retry_count is incremented at claim
 *    time by every caller, giving a single monotonic counter for cap enforcement.
 *
 * Precision note: PostgreSQL timestamps have microsecond precision; JavaScript Date
 * has only millisecond precision.  To avoid a mismatch when the lease token is used in
 * a WHERE clause, claimNotificationLease returns the timestamp as a PostgreSQL text
 * string (via ::text in the RETURNING clause) and callers pass it back with
 * `::timestamptz` so PostgreSQL does an exact match in its own representation.
 */

import { pool } from "@workspace/db";

/**
 * Maximum notification delivery attempts per run across ALL callers.
 * After this many claims (initial + recovery + manual), the run is permanently blocked.
 */
export const MAX_NOTIFICATION_ATTEMPTS = 3;

/** Stale-lease window: a SENDING row older than this is assumed crashed and reclaimable. */
export const LEASE_STALE_MINUTES = 10;

export interface NotificationLease {
  /**
   * The exact PostgreSQL text representation of notification_lease_at (e.g.
   * "2026-08-03 15:00:55.123456+00").  Pass back to WHERE as `::timestamptz` to
   * preserve microsecond precision and avoid JS Date truncation.
   */
  leaseToken: string;
  /** Post-increment attempt count for this claim (1-based). Used to decide FAILED vs FAILED_PERMANENT. */
  retryCount: number;
}

/**
 * Atomic CAS claim for a single notification dispatch.
 *
 * Atomically:
 *   - Sets  notification_status      = 'SENDING'
 *   - Sets  notification_lease_at    = NOW()          ← lease timestamp
 *   - Incs  notification_retry_count = count + 1
 *
 * Eligible rows:
 *   - status IN (NULL, 'PENDING', 'FAILED')           ← not yet attempted / previously failed
 *   - OR status = 'SENDING' with a stale lease_at     ← previous process likely crashed
 *   - AND retry_count < MAX_NOTIFICATION_ATTEMPTS     ← cap not exhausted
 *
 * Returns the lease (leaseToken string + post-increment retryCount) or null when:
 *   - Another live request already holds a fresh SENDING lease
 *   - The run is already SENT or FAILED_PERMANENT
 *   - The attempt cap has been reached
 *   - The run ID does not exist
 */
export async function claimNotificationLease(runId: number): Promise<NotificationLease | null> {
  const { rows } = await pool.query<{
    lease_token: string;
    notification_retry_count: number;
  }>(
    `UPDATE scheduler_runs
     SET notification_status      = 'SENDING',
         notification_lease_at    = NOW(),
         notification_retry_count = notification_retry_count + 1
     WHERE id = $1
       AND notification_retry_count < $2
       AND (
         notification_status IS NULL
         OR notification_status IN ('PENDING', 'FAILED')
         OR (
           notification_status = 'SENDING'
           AND (
             notification_lease_at IS NULL
             OR notification_lease_at < NOW() - ($3 || ' minutes')::INTERVAL
           )
         )
       )
     RETURNING notification_lease_at::text AS lease_token, notification_retry_count`,
    [runId, MAX_NOTIFICATION_ATTEMPTS, LEASE_STALE_MINUTES],
  );
  const row = rows[0];
  if (!row) return null;
  return { leaseToken: row.lease_token, retryCount: row.notification_retry_count };
}
