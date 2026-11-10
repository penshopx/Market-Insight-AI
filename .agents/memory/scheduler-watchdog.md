---
name: Scheduler watchdog + interruption alerts
description: How the scheduler prevents hanging forever, and how the team is alerted when a run is interrupted.
---

## Rule
Every scheduler run is guarded by a 30-minute `Promise.race` watchdog. If a run exceeds the limit, the lock is released, the DB row is marked INTERRUPTED, and an alert is fired. The same alert fires on server restart (via `interruptStaleRuns`).

**Why:** A hung HTTP fetch inside a source could theoretically block the event loop long enough that the per-source 15-second abort doesn't fire (e.g. on response-body streaming). Without a run-level cap, `state.isRunning` stays `true` forever and subsequent scheduled runs are silently skipped.

**How to apply:**
- `MAX_RUN_DURATION_MS = 30 * 60 * 1000` constant in `scheduler.ts`
- `createRunTimeout()` returns `{ promise, cancel }` — used in both `runJob()` and `triggerNow()`
- `markRunningAsInterrupted()` — shared helper that updates DB rows + fires `sendInterruptionAlert()`
- `sendInterruptionAlert(runId, startedAt)` in `lib/notify.ts` — posts to `NOTIFICATION_WEBHOOK_URL` with a danger-styled Slack block; no-ops silently if webhook not configured
- `interruptStaleRuns()` in `index.ts` now calls `sendInterruptionAlert` for each stale row it flips
- Dashboard: `recentInterruptions` useMemo (24h window) drives an orange banner above the history table with run IDs + times
