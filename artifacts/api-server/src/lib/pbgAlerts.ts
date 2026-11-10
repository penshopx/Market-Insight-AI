/**
 * PBG (Persetujuan Bangunan Gedung) Alert System
 *
 * Dispatch lifecycle for each (subscription_id, research_item_id) pair:
 *
 *   1. CLAIM  — INSERT row with status='CLAIMED' via ON CONFLICT DO NOTHING RETURNING.
 *               Only the caller whose INSERT returns a row proceeds. This is atomic at
 *               the DB layer (unique index), so two concurrent invocations cannot both
 *               claim the same pair.
 *
 *   2. SEND   — Call Meta WhatsApp Cloud API to deliver the alert message.
 *
 *   3a. SUCCESS → UPDATE row to status='DELIVERED', delivered_at=NOW().
 *                 Row stays permanently to prevent future re-delivery.
 *
 *   3b. FAILURE → DELETE the CLAIMED row immediately so the next run can retry.
 *                 The item is NOT lost; it will be re-matched on the next scan.
 *
 *   3c. CRASH (between CLAIM and SEND/UPDATE) → Row remains as CLAIMED.
 *             Recovery at the start of each run deletes CLAIMED rows older than
 *             PBG_CLAIM_LEASE_MINUTES, making them available for retry on the
 *             same invocation or the next scheduled run.
 *
 * Concurrency safety (two levels):
 *   Level 1 — In-process: `pbgAlertsRunning` mutex prevents overlapping invocations
 *             within the same server process (scheduler + manual trigger).
 *   Level 2 — Multi-process: Atomic unique-index INSERT provides exclusivity even
 *             across concurrent server instances (e.g. rolling restart).
 */

import { db, pbgSubscriptionsTable, researchItemsTable, pbgAlertSentTable } from "@workspace/db";
import { eq, gte, lt, and, inArray } from "drizzle-orm";
import { logger } from "./logger";

// ─── Configuration ────────────────────────────────────────────────────────────

/** A CLAIMED row older than this is assumed orphaned (crash) and will be deleted for retry. */
const PBG_CLAIM_LEASE_MINUTES = 30;

// ─── Supported cities ─────────────────────────────────────────────────────────

export const PBG_CITIES = [
  "Jakarta",
  "Surabaya",
  "Bandung",
  "Medan",
  "Semarang",
  "Makassar",
  "Bekasi",
  "Depok",
  "Tangerang",
  "Bogor",
  "Palembang",
  "Batam",
  "Pekanbaru",
  "Denpasar",
  "Balikpapan",
  "Yogyakarta",
  "Malang",
  "Samarinda",
  "Banjarmasin",
  "Pontianak",
] as const;

export type PbgCity = (typeof PBG_CITIES)[number];

// ─── In-process concurrency guard ────────────────────────────────────────────

let pbgAlertsRunning = false;

// ─── PBG keyword filter ────────────────────────────────────────────────────────

const PBG_KEYWORDS = [
  "PBG",
  "Persetujuan Bangunan Gedung",
  "OSS",
  "SIMBG",
  "izin bangunan",
  "IMB",
  "izin mendirikan bangunan",
  "persetujuan bangunan",
];

function isPbgRelated(title: string, summary: string | null): boolean {
  const combined = `${title} ${summary ?? ""}`.toLowerCase();
  return PBG_KEYWORDS.some((kw) => combined.includes(kw.toLowerCase()));
}

// ─── City detection ───────────────────────────────────────────────────────────

function detectCities(text: string, watchedCities: string[]): string[] {
  const lower = text.toLowerCase();
  return watchedCities.filter((city) => lower.includes(city.toLowerCase()));
}

// ─── WhatsApp text sender ─────────────────────────────────────────────────────

const WA_BASE_URL = "https://graph.facebook.com/v19.0";

interface WaSendResult {
  recipient: string;
  success: boolean;
  error?: string;
}

async function sendWhatsAppText(to: string, message: string): Promise<WaSendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return {
      recipient: to,
      success: false,
      error: "WhatsApp tidak dikonfigurasi (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)",
    };
  }

  const normalized = to.replace(/\D/g, "");

  try {
    const res = await fetch(`${WA_BASE_URL}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalized,
        type: "text",
        text: { body: message },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { recipient: to, success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    return { recipient: to, success: true };
  } catch (err: unknown) {
    return { recipient: to, success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Alert message builder ────────────────────────────────────────────────────

interface PbgItem {
  id: number;
  title: string;
  summary: string | null;
  sourceUrl: string | null;
  detectedCities: string[];
}

function buildAlertMessage(
  label: string,
  cities: string[],
  items: PbgItem[],
  dateLabel: string,
): string {
  const greeting = label ? `Halo *${label}*,\n\n` : "";
  const lines: string[] = [
    `${greeting}🏗️ *Alert PBG Baru — ${dateLabel}*`,
    "",
    `Ditemukan *${items.length} sinyal PBG baru* di kota yang Anda pantau: *${cities.join(", ")}*`,
    "",
  ];
  items.slice(0, 5).forEach((item, i) => {
    lines.push(`*${i + 1}. ${item.title}*`);
    if (item.summary) lines.push(item.summary.slice(0, 120) + (item.summary.length > 120 ? "..." : ""));
    if (item.sourceUrl) lines.push(`🔗 ${item.sourceUrl}`);
    lines.push("");
  });
  if (items.length > 5) { lines.push(`_...dan ${items.length - 5} sinyal lainnya_`); lines.push(""); }
  lines.push("ℹ️ _PBG terbit sebelum kontraktor dipilih — segera dekati pemrakarsa untuk peluang awal._");
  lines.push("_— Sistem Riset Intel Konstruksi_");
  return lines.join("\n");
}

// ─── Lease recovery ───────────────────────────────────────────────────────────

/**
 * Delete CLAIMED rows whose lease has expired.
 * Called at the start of every run so crashed-mid-dispatch items become retryable.
 */
async function recoverStaleClaims(): Promise<void> {
  const leaseExpiry = new Date(Date.now() - PBG_CLAIM_LEASE_MINUTES * 60 * 1000);
  try {
    const deleted = await db
      .delete(pbgAlertSentTable)
      .where(
        and(
          eq(pbgAlertSentTable.status, "CLAIMED"),
          lt(pbgAlertSentTable.claimedAt, leaseExpiry),
        ),
      )
      .returning({ id: pbgAlertSentTable.id });

    if (deleted.length > 0) {
      logger.warn(
        { recoveredCount: deleted.length, leaseMinutes: PBG_CLAIM_LEASE_MINUTES },
        "PBG alerts: recovered stale CLAIMED rows — previous process likely crashed",
      );
    }
  } catch (err) {
    logger.error({ err }, "PBG alerts: stale-claim recovery failed — continuing anyway");
  }
}

// ─── Core implementation ──────────────────────────────────────────────────────

export interface PbgAlertReport {
  checkedSubscribers: number;
  pbgItemsFound: number;
  alertsSent: number;
  alertsFailed: number;
  skippedAlreadyClaimed: number;
  results: WaSendResult[];
}

async function _runPbgAlerts(): Promise<PbgAlertReport> {
  // Step 0: recover stale CLAIMED rows from crashed previous runs
  await recoverStaleClaims();

  // Step 1: fetch research items created in the last 48 hours
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  let candidates: { id: number; title: string; summary: string | null; sourceUrl: string | null }[];
  try {
    candidates = await db
      .select({
        id: researchItemsTable.id,
        title: researchItemsTable.title,
        summary: researchItemsTable.summary,
        sourceUrl: researchItemsTable.sourceUrl,
      })
      .from(researchItemsTable)
      .where(gte(researchItemsTable.createdAt, since));
  } catch (err) {
    logger.error({ err }, "PBG alerts: failed to query research items");
    return { checkedSubscribers: 0, pbgItemsFound: 0, alertsSent: 0, alertsFailed: 0, skippedAlreadyClaimed: 0, results: [] };
  }

  // Step 2: keyword filter
  const pbgCandidates = candidates.filter((item) => isPbgRelated(item.title, item.summary));
  logger.info({ candidateCount: candidates.length, pbgCandidates: pbgCandidates.length }, "PBG alerts: keyword scan complete");

  if (pbgCandidates.length === 0) {
    return { checkedSubscribers: 0, pbgItemsFound: 0, alertsSent: 0, alertsFailed: 0, skippedAlreadyClaimed: 0, results: [] };
  }

  // Step 3: load enabled subscribers
  let subscribers: { id: number; whatsapp: string; label: string; cities: string }[];
  try {
    subscribers = await db
      .select({ id: pbgSubscriptionsTable.id, whatsapp: pbgSubscriptionsTable.whatsapp, label: pbgSubscriptionsTable.label, cities: pbgSubscriptionsTable.cities })
      .from(pbgSubscriptionsTable)
      .where(eq(pbgSubscriptionsTable.enabled, true));
  } catch (err) {
    logger.error({ err }, "PBG alerts: failed to query subscribers");
    return { checkedSubscribers: 0, pbgItemsFound: pbgCandidates.length, alertsSent: 0, alertsFailed: 0, skippedAlreadyClaimed: 0, results: [] };
  }

  if (subscribers.length === 0) {
    logger.info("PBG alerts: no enabled subscribers");
    return { checkedSubscribers: 0, pbgItemsFound: pbgCandidates.length, alertsSent: 0, alertsFailed: 0, skippedAlreadyClaimed: 0, results: [] };
  }

  // Step 4: per-subscriber — pre-claim → send → mark DELIVERED or rollback claim
  const dateLabel = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const allResults: WaSendResult[] = [];
  let totalSkipped = 0;

  for (const sub of subscribers) {
    const watchedCities = sub.cities.split(",").map((c) => c.trim()).filter(Boolean);
    if (watchedCities.length === 0) continue;

    // Determine city-matching items for this subscriber
    const cityMatching: PbgItem[] = pbgCandidates
      .map((item) => {
        const dc = detectCities(`${item.title} ${item.summary ?? ""}`, watchedCities);
        return dc.length > 0 ? { ...item, detectedCities: dc } : null;
      })
      .filter((x): x is PbgItem => x !== null);

    if (cityMatching.length === 0) continue;

    // Pre-claim each matching item individually.
    // INSERT ON CONFLICT DO NOTHING RETURNING — only items whose INSERT returns a row
    // are ours to send. Conflicts mean another run already owns or delivered the item.
    const claimedItems: (PbgItem & { claimId: number })[] = [];

    for (const item of cityMatching) {
      let claimResult: { id: number }[];
      try {
        claimResult = await db
          .insert(pbgAlertSentTable)
          .values({ subscriptionId: sub.id, researchItemId: item.id, status: "CLAIMED" })
          .onConflictDoNothing()
          .returning({ id: pbgAlertSentTable.id });
      } catch (claimErr) {
        logger.error(
          { err: claimErr, subscriberId: sub.id, itemId: item.id },
          "PBG alerts: pre-claim INSERT failed — skipping item",
        );
        totalSkipped += 1;
        continue;
      }

      if (claimResult.length === 0) {
        // Conflict: DELIVERED or CLAIMED by another runner — skip
        totalSkipped += 1;
        continue;
      }

      claimedItems.push({ ...item, claimId: claimResult[0]!.id });
    }

    if (claimedItems.length === 0) continue;

    // Send one WA message per subscriber for all their claimed items
    const matchedCities = [...new Set(claimedItems.flatMap((i) => i.detectedCities))];
    const message = buildAlertMessage(sub.label, matchedCities, claimedItems, dateLabel);

    logger.info(
      { subscriberId: sub.id, recipient: sub.whatsapp, claimedCount: claimedItems.length, cities: matchedCities },
      "PBG alerts: sending alert",
    );

    const result = await sendWhatsAppText(sub.whatsapp, message);
    allResults.push(result);

    if (result.success) {
      // Mark all claimed rows as DELIVERED — permanent dedup record
      try {
        const claimIds = claimedItems.map((i) => i.claimId);
        await db
          .update(pbgAlertSentTable)
          .set({ status: "DELIVERED", deliveredAt: new Date() })
          .where(inArray(pbgAlertSentTable.id, claimIds));
        logger.info({ subscriberId: sub.id, deliveredCount: claimIds.length }, "PBG alerts: marked DELIVERED");
      } catch (updateErr) {
        // Non-fatal: rows stay as CLAIMED and will be recovered by the lease
        // expiry on the next run (30-min lease). At worst the subscriber gets
        // a duplicate alert once, which is far preferable to a missed alert.
        logger.error({ err: updateErr, subscriberId: sub.id }, "PBG alerts: failed to mark DELIVERED — lease will expire and re-deliver once");
      }
    } else {
      // Send failed — delete CLAIMED rows immediately so they retry on the next run
      logger.warn({ recipient: sub.whatsapp, error: result.error }, "PBG alerts: send failed — rolling back claims for retry");
      try {
        await db
          .delete(pbgAlertSentTable)
          .where(inArray(pbgAlertSentTable.id, claimedItems.map((i) => i.claimId)));
      } catch (rollbackErr) {
        logger.error({ err: rollbackErr, subscriberId: sub.id }, "PBG alerts: claim rollback failed — rows will retry after lease expires");
      }
    }
  }

  const sent = allResults.filter((r) => r.success).length;
  const failed = allResults.filter((r) => !r.success).length;
  logger.info({ sent, failed, skipped: totalSkipped }, "PBG alerts: complete");

  return {
    checkedSubscribers: subscribers.length,
    pbgItemsFound: pbgCandidates.length,
    alertsSent: sent,
    alertsFailed: failed,
    skippedAlreadyClaimed: totalSkipped,
    results: allResults,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Entry point called by the scheduler (runJob/triggerNow) and the manual-trigger route.
 * Safe to call concurrently — in-process mutex + DB-level unique-index claim prevent duplicates.
 */
export async function runPbgAlerts(): Promise<PbgAlertReport> {
  if (pbgAlertsRunning) {
    logger.info("PBG alerts: already running in this process — skipping concurrent invocation");
    return { checkedSubscribers: 0, pbgItemsFound: 0, alertsSent: 0, alertsFailed: 0, skippedAlreadyClaimed: 0, results: [] };
  }

  pbgAlertsRunning = true;
  try {
    return await _runPbgAlerts();
  } finally {
    pbgAlertsRunning = false;
  }
}

/** Returns true when a PBG alert run is currently in progress in this process. */
export function isPbgAlertsRunning(): boolean {
  return pbgAlertsRunning;
}
