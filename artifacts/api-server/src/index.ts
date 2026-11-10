import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./scheduler";
import { startOrphanCleanupSchedule } from "./lib/cleanupOrphanUploads";
import { pool, db, schedulerRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendInterruptionAlert } from "./lib/notify";
import { resendPendingNotifications } from "./lib/resendPendingNotifications";
import { startNotificationLeaseWatchdog } from "./lib/notificationLeaseWatchdog";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureSchemas(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id          SERIAL PRIMARY KEY,
        channel     TEXT    NOT NULL,
        recipient   TEXT    NOT NULL,
        label       TEXT    NOT NULL DEFAULT '',
        enabled     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS briefing_deliveries (
        id              SERIAL PRIMARY KEY,
        delivery_date   TEXT    NOT NULL UNIQUE,
        status          TEXT    NOT NULL DEFAULT 'PENDING',
        pdf_generated   BOOLEAN NOT NULL DEFAULT FALSE,
        success_count   INTEGER NOT NULL DEFAULT 0,
        fail_count      INTEGER NOT NULL DEFAULT 0,
        error           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS source_crawl_history (
        source_id       TEXT PRIMARY KEY,
        last_crawled_at TIMESTAMPTZ NOT NULL,
        items_saved     INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL
      );
    `);
    logger.info("Schema ensured: notification_settings, briefing_deliveries, source_crawl_history");

    // Backfill the durable source cursor once from existing scheduler logs.
    // The source history remains authoritative afterwards, and this guarded
    // upsert never lets an older retained run overwrite a newer cursor.
    await pool.query(`
      INSERT INTO source_crawl_history (source_id, last_crawled_at, items_saved, status)
      SELECT DISTINCT ON (r->>'sourceId')
        r->>'sourceId',
        sr.finished_at,
        COALESCE((r->>'itemsSaved')::INTEGER, 0),
        r->>'status'
      FROM scheduler_runs sr,
           jsonb_array_elements(sr.results) AS r
      WHERE sr.finished_at IS NOT NULL
        AND (r->>'status' = 'SUCCESS' OR r->>'status' = 'PARTIAL')
      ORDER BY r->>'sourceId', sr.finished_at DESC
      ON CONFLICT (source_id) DO UPDATE
        SET last_crawled_at = EXCLUDED.last_crawled_at,
            items_saved = EXCLUDED.items_saved,
            status = EXCLUDED.status
        WHERE EXCLUDED.last_crawled_at > source_crawl_history.last_crawled_at;
    `);
    logger.info("Schema migration: source_crawl_history backfilled from scheduler_runs");

    // Add status column to scheduler_runs (idempotent)
    await pool.query(`
      ALTER TABLE scheduler_runs
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED';
    `);
    // Allow finished_at to be NULL (rows inserted with status=RUNNING have no finishedAt yet)
    await pool.query(`
      ALTER TABLE scheduler_runs
        ALTER COLUMN finished_at DROP NOT NULL;
    `);
    // Add notification_sent_at column — only backfill legacy rows on first addition.
    // We check existence first so we can distinguish "just added" from "already present".
    const colCheck = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_name = 'scheduler_runs'
        AND column_name = 'notification_sent_at'
    `);
    const columnAlreadyExisted = parseInt(colCheck.rows[0]?.count ?? "0", 10) > 0;

    await pool.query(`
      ALTER TABLE scheduler_runs
        ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;
    `);

    if (!columnAlreadyExisted) {
      // First-time migration: stamp all pre-existing COMPLETED rows as "legacy, already handled"
      // so resendPendingNotifications() never replays them on the first boot.
      const { rowCount } = await pool.query(`
        UPDATE scheduler_runs
        SET notification_sent_at = COALESCE(finished_at, created_at)
        WHERE status = 'COMPLETED'
          AND finished_at IS NOT NULL
      `);
      logger.info(
        { backfilledRows: rowCount ?? 0 },
        "Schema migration: backfilled notification_sent_at for pre-existing completed runs",
      );
    }

    // Add notification_status column for the PENDING→SENDING→SENT/FAILED state machine.
    const statusColCheck = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_name = 'scheduler_runs'
        AND column_name = 'notification_status'
    `);
    const statusColAlreadyExisted = parseInt(statusColCheck.rows[0]?.count ?? "0", 10) > 0;

    await pool.query(`
      ALTER TABLE scheduler_runs
        ADD COLUMN IF NOT EXISTS notification_status TEXT;
    `);

    if (!statusColAlreadyExisted) {
      // Backfill pre-existing rows: if notification_sent_at is already set → SENT; else leave NULL.
      const { rowCount } = await pool.query(`
        UPDATE scheduler_runs
        SET notification_status = 'SENT'
        WHERE notification_sent_at IS NOT NULL
      `);
      logger.info(
        { backfilledRows: rowCount ?? 0 },
        "Schema migration: backfilled notification_status=SENT for runs with notification_sent_at",
      );
    }

    // Add notification_attempts counter — tracks how many times we've tried to
    // deliver the webhook for this run. Capped at MAX_NOTIFICATION_ATTEMPTS so a
    // permanently failing endpoint doesn't retry forever on every server restart.
    await pool.query(`
      ALTER TABLE scheduler_runs
        ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 0;
    `);

    logger.info("Schema ensured: scheduler_runs columns — status, finished_at, notification_sent_at, notification_status, notification_attempts");

    // Add notification_retry_count column — tracks how many startup-recovery attempts have
    // failed for each run. Recovery stops retrying once this reaches 3.
    await pool.query(`
      ALTER TABLE scheduler_runs
        ADD COLUMN IF NOT EXISTS notification_retry_count INTEGER NOT NULL DEFAULT 0;
    `);
    logger.info("Schema ensured: scheduler_runs.notification_retry_count");

    // Add notification_lease_at column — records the moment a SENDING lease was claimed.
    // Used by startup recovery to determine whether a SENDING row is genuinely stale
    // (server crashed mid-dispatch) vs. freshly claimed by a live manual retry.
    // Using finished_at (the crawler completion time) for this was incorrect for historical
    // runs retried manually, because their finished_at is always hours/days old.
    await pool.query(`
      ALTER TABLE scheduler_runs
        ADD COLUMN IF NOT EXISTS notification_lease_at TIMESTAMPTZ;
    `);
    logger.info("Schema ensured: scheduler_runs.notification_lease_at");

    // Ensure workroom_notes unique constraint on (entity_type, entity_id).
    // Step 1: deduplicate any legacy rows (from former select-then-insert path) — keep
    //         the most recently updated row per (entity_type, entity_id) pair.
    await pool.query(`
      DELETE FROM workroom_notes
      WHERE id NOT IN (
        SELECT DISTINCT ON (entity_type, entity_id) id
        FROM workroom_notes
        ORDER BY entity_type, entity_id, updated_at DESC, id DESC
      );
    `);

    // Step 2: add unique constraint only if it is not already present.
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'workroom_notes'
            AND constraint_name = 'workroom_notes_entity_type_entity_id_unique'
        ) THEN
          ALTER TABLE workroom_notes
            ADD CONSTRAINT workroom_notes_entity_type_entity_id_unique
            UNIQUE(entity_type, entity_id);
        END IF;
      END $$;
    `);

    logger.info("Schema ensured: workroom_notes unique constraint on (entity_type, entity_id)");

    // Ensure workroom_notes.author_name column exists (added for attribution feature)
    await pool.query(`
      ALTER TABLE workroom_notes
        ADD COLUMN IF NOT EXISTS author_name TEXT;
    `);
    logger.info("Schema ensured: workroom_notes.author_name");

    // Ensure competitor_signals table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitor_signals (
        id              SERIAL PRIMARY KEY,
        category        TEXT    NOT NULL DEFAULT 'COMPETITOR_PRICING',
        title           TEXT    NOT NULL,
        summary         TEXT,
        source          TEXT    NOT NULL,
        source_url      TEXT,
        data_source_site TEXT,
        collected_at    TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS competitor_signals_dedup_idx
        ON competitor_signals (data_source_site, title, collected_at);
    `);
    logger.info("Schema ensured: competitor_signals");

    // Ensure briefing_delivery_log table exists (per-recipient delivery audit trail)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS briefing_delivery_log (
        id              SERIAL PRIMARY KEY,
        delivery_date   TEXT        NOT NULL,
        channel         TEXT        NOT NULL,
        recipient       TEXT        NOT NULL,
        status          TEXT        NOT NULL,
        error_message   TEXT,
        sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("Schema ensured: briefing_delivery_log");

    // Ensure pbg_subscriptions table exists (PBG city alert subscribers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pbg_subscriptions (
        id          SERIAL  PRIMARY KEY,
        whatsapp    TEXT    NOT NULL,
        label       TEXT    NOT NULL DEFAULT '',
        cities      TEXT    NOT NULL DEFAULT '',
        enabled     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    logger.info("Schema ensured: pbg_subscriptions");

    // Ensure pbg_alert_sent table exists (dispatch-lease + dedup log)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pbg_alert_sent (
        id                SERIAL  PRIMARY KEY,
        subscription_id   INTEGER NOT NULL,
        research_item_id  INTEGER NOT NULL,
        status            TEXT    NOT NULL DEFAULT 'DELIVERED',
        claimed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        delivered_at      TIMESTAMPTZ
      );
      -- Unique index ensures only one CLAIMED/DELIVERED row per (subscription, item) pair.
      -- This index is what makes the pre-claim INSERT ON CONFLICT DO NOTHING atomic.
      CREATE UNIQUE INDEX IF NOT EXISTS pbg_alert_sent_dedup_idx
        ON pbg_alert_sent (subscription_id, research_item_id);
    `);
    // Migrate tables created by an earlier server version that lacked the lease columns.
    await pool.query(`
      ALTER TABLE pbg_alert_sent ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DELIVERED';
      ALTER TABLE pbg_alert_sent ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE pbg_alert_sent ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
    `);
    // Drop old sent_at column if it exists (replaced by claimed_at / delivered_at).
    await pool.query(`
      ALTER TABLE pbg_alert_sent DROP COLUMN IF EXISTS sent_at;
    `);
    logger.info("Schema ensured: pbg_alert_sent (with lease columns)");

    // Ensure workroom_note_history table exists (edit history per note)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workroom_note_history (
        id          SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id   INTEGER NOT NULL,
        note        TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT '',
        author_name TEXT,
        changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS workroom_note_history_entity_idx
        ON workroom_note_history (entity_type, entity_id, changed_at DESC);
    `);
    logger.info("Schema ensured: workroom_note_history");

    // ── Ensure research_items dedup index exists (required for seed ON CONFLICT) ─
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS research_items_dedup_idx
        ON research_items (data_source_site, title, collected_at);
    `);
    logger.info("Schema ensured: research_items_dedup_idx (data_source_site, title, collected_at)");

    // ── Seed IjinTender competitor reference prices ──────────────────────────
    // These rows power the Referensi Pasar table in Surat Penawaran.
    // Stored as COMPETITOR_PRICING research_items so the team can update them
    // from the Data Riset UI without touching code.
    // Uses ON CONFLICT DO NOTHING so this is fully idempotent on every restart.
    const COLLECTED_AT = "2026-08-03T00:00:00.000Z";
    await pool.query(`
      INSERT INTO research_items
        (category, title, summary, source, source_url, data_source_site, status, tags, collected_at)
      VALUES
        ('COMPETITOR_PRICING', 'Pengurusan SBU Kecil',              '{"minPrice":3000000,"maxPrice":6000000,"notes":"Termasuk pendampingan LPJK","subCategory":"SBU"}',                         'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SBU',                       $1),
        ('COMPETITOR_PRICING', 'Pengurusan SBU Menengah',           '{"minPrice":7000000,"maxPrice":15000000,"notes":"Proses 7–14 hari kerja","subCategory":"SBU"}',                             'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SBU',                       $1),
        ('COMPETITOR_PRICING', 'Pengurusan SBU Besar',              '{"minPrice":20000000,"maxPrice":40000000,"notes":"Termasuk audit kelayakan","subCategory":"SBU"}',                          'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SBU',                       $1),
        ('COMPETITOR_PRICING', 'Jasa SKK Level 6 (SKA Muda)',       '{"minPrice":2500000,"maxPrice":5000000,"notes":"Via LSP terakreditasi","subCategory":"SKK"}',                               'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SKK',                       $1),
        ('COMPETITOR_PRICING', 'Jasa SKK Level 7 (SKA Madya)',      '{"minPrice":3500000,"maxPrice":7000000,"notes":"Uji kompetensi 3–5 hari","subCategory":"SKK"}',                             'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SKK',                       $1),
        ('COMPETITOR_PRICING', 'Jasa SKK Level 9 (SKA Utama)',      '{"minPrice":5000000,"maxPrice":10000000,"notes":"Senioritas & pengalaman wajib","subCategory":"SKK"}',                      'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SKK',                       $1),
        ('COMPETITOR_PRICING', 'Dokumen SMAP ISO 37001',            '{"minPrice":2000000,"maxPrice":4000000,"notes":"Template dokumen + SOP","subCategory":"SMAP"}',                             'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SMAP',                      $1),
        ('COMPETITOR_PRICING', 'Sertifikasi ISO 37001 (Non KAN)',   '{"minPrice":12000000,"maxPrice":18000000,"notes":"Bervariasi per lembaga","subCategory":"SMAP"}',                           'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'SMAP',                      $1),
        ('COMPETITOR_PRICING', 'Sewa Alat SBU Kecil',               '{"minPrice":4000000,"maxPrice":6500000,"notes":"Per 3 tahun","subCategory":"Sewa Alat"}',                                  'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'Sewa Alat',                  $1),
        ('COMPETITOR_PRICING', 'Sewa Alat SBU Menengah/Spesialis',  '{"minPrice":6500000,"maxPrice":9000000,"notes":"Per 3 tahun","subCategory":"Sewa Alat"}',                                  'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'Sewa Alat',                  $1),
        ('COMPETITOR_PRICING', 'Dokumen ISO 9001:2015',             '{"minPrice":3000000,"maxPrice":6000000,"notes":"Template + SOP mutu","subCategory":"ISO & Sistem Manajemen"}',              'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'ISO & Sistem Manajemen',    $1),
        ('COMPETITOR_PRICING', 'Sertifikat ISO 9001 (Non KAN)',     '{"minPrice":15000000,"maxPrice":25000000,"notes":"Surveilans 1x/tahun","subCategory":"ISO & Sistem Manajemen"}',            'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'ISO & Sistem Manajemen',    $1),
        ('COMPETITOR_PRICING', 'Dokumen ISO 45001 / SMK3',          '{"minPrice":3500000,"maxPrice":7000000,"notes":"Termasuk RKK per proyek","subCategory":"ISO & Sistem Manajemen"}',          'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'ISO & Sistem Manajemen',    $1),
        ('COMPETITOR_PRICING', 'Konsultasi SBU/SKK (1 sesi)',       '{"minPrice":500000,"maxPrice":1000000,"notes":"Zoom/tatap muka 90 menit","subCategory":"Konsultasi & Pelatihan"}',          'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'Konsultasi & Pelatihan',    $1),
        ('COMPETITOR_PRICING', 'Pelatihan In-House SKK (1 hari)',   '{"minPrice":4000000,"maxPrice":7000000,"notes":"Maks 15 peserta","subCategory":"Konsultasi & Pelatihan"}',                  'ijintender.co.id', 'https://ijintender.co.id', 'ijintender.co.id', 'ACTIVE', 'Konsultasi & Pelatihan',    $1)
      ON CONFLICT (data_source_site, title, collected_at) DO NOTHING;
    `, [COLLECTED_AT]);
    logger.info("Seed ensured: IjinTender COMPETITOR_PRICING reference prices (15 rows, idempotent)");
  } catch (err) {
    logger.error({ err }, "Failed to ensure schema tables");
    throw err;
  }
}

/** Mark any runs that were still RUNNING when the server last died as INTERRUPTED. */
async function interruptStaleRuns(): Promise<void> {
  try {
    const interrupted = await db
      .update(schedulerRunsTable)
      .set({ status: "INTERRUPTED" })
      .where(eq(schedulerRunsTable.status, "RUNNING"))
      .returning({ id: schedulerRunsTable.id, startedAt: schedulerRunsTable.startedAt });
    if (interrupted.length > 0) {
      logger.warn(
        { interruptedRunIds: interrupted.map((r) => r.id) },
        "Marked stale RUNNING scheduler runs as INTERRUPTED after server restart",
      );
      // Fire-and-forget alerts — one per interrupted run
      for (const row of interrupted) {
        sendInterruptionAlert(row.id, row.startedAt.toISOString()).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to interrupt stale scheduler runs — continuing anyway");
  }
}

ensureSchemas()
  .then(() => interruptStaleRuns())
  .then(() => resendPendingNotifications())
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");

      // Start daily 07:00 WIB data collection scheduler.
      // Any DB rows stuck in status=RUNNING were already flipped to INTERRUPTED
      // by interruptStaleRuns() above, so the fresh process starts with no
      // in-memory lock and no orphaned RUNNING rows that could block future runs.
      startScheduler();

      // Start periodic orphan-upload cleanup (runs on startup + every hour).
      // Removes GCS objects that were uploaded but whose DB record was never created
      // (e.g. the client crashed, or the DB write failed after a successful upload).
      startOrphanCleanupSchedule();

      // Start background watchdog that rescues SENDING leases older than the stale
      // window — handles the case where a delivery crashes without a server restart.
      startNotificationLeaseWatchdog();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup migration failed, exiting");
    process.exit(1);
  });
