/**
 * Orchestrates the end-to-end daily briefing delivery:
 *   1. Claim today's delivery slot (retryable idempotency guard)
 *   2. Fetch dashboard data from the DB using WIB-anchored date boundaries
 *   3. Generate a PDF
 *   4. Deliver to all enabled email + WhatsApp recipients
 *   5. Update delivery status record
 *
 * Idempotency semantics (WIB date as key):
 *   - PENDING  → active lease (another process is running) — skip
 *   - SUCCESS  → already delivered today — skip
 *   - FAILED   → previous attempt failed — allow retry via atomic re-claim
 *
 * This means a transient failure (SMTP down, PDF error) allows a retry on the
 * next trigger/restart, while a successful send is protected from duplicates.
 *
 * When bypassIdempotency=true (manual test-sends), the guard is skipped so
 * tests never consume the production slot and vice-versa.
 */

import {
  db,
  researchItemsTable,
  contractorsTable,
  skkHoldersTable,
  tenderOpportunitiesTable,
  painPointsTable,
  notificationSettingsTable,
  briefingDeliveriesTable,
  briefingDeliveryLogTable,
} from "@workspace/db";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { format } from "date-fns";
import { logger } from "./logger";
import { generateBriefingPDF, type BriefingData } from "./generateBriefingPDF";
import { generateInteligensiReport } from "./generateInteligensiReport";
import { sendBriefingEmail } from "./emailSender";
import { sendBriefingWhatsApp } from "./whatsappSender";
import { sendBriefingDeliveryAlert } from "./notify";

export interface DeliveryReport {
  pdfGenerated: boolean;
  /** Whether the optional Laporan Intelijen PDF was generated successfully. */
  intelligencePdfGenerated?: boolean;
  emailResults: Array<{ recipient: string; success: boolean; error?: string }>;
  whatsappResults: Array<{ recipient: string; success: boolean; error?: string }>;
  /** Overall delivery outcome: SUCCESS | PARTIAL | FAILED | SKIPPED */
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  skipped?: boolean;
  error?: string;
}

export interface DeliveryOptions {
  /**
   * When true, skips the idempotency guard so delivery is always attempted.
   * Use ONLY for manual test-sends; never pass this on the scheduled path.
   */
  bypassIdempotency?: boolean;
}

// ── WIB date helpers ───────────────────────────────────────────────────────────

/** Returns today's date string in WIB (UTC+7) as YYYY-MM-DD. */
function todayWIBString(): string {
  return format(new Date(Date.now() + 7 * 60 * 60 * 1000), "yyyy-MM-dd");
}

/**
 * Returns the start of today (00:00) in WIB as a UTC Date.
 * e.g. if WIB date is 2026-08-02, this returns 2026-08-01T17:00:00Z
 */
function wibDayStart(wibDateStr: string): Date {
  // Parse date parts, treat them as WIB local midnight
  const [y, m, d] = wibDateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
}

/**
 * Returns the end of today (23:59:59.999) in WIB as a UTC Date.
 */
function wibDayEnd(wibDateStr: string): Date {
  const [y, m, d] = wibDateStr.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 7 * 60 * 60 * 1000);
}

// ── Idempotency claim ──────────────────────────────────────────────────────────

/**
 * Attempts to claim the delivery slot for today.
 * Returns true if the claim was successful (caller should proceed with delivery).
 * Returns false if delivery should be skipped (already running or already succeeded).
 */
async function claimDeliverySlot(deliveryDate: string): Promise<boolean> {
  // Step 1: Try to insert a fresh PENDING row
  const inserted = await db
    .insert(briefingDeliveriesTable)
    .values({ deliveryDate, status: "PENDING" })
    .onConflictDoNothing()
    .returning({ id: briefingDeliveriesTable.id });

  if (inserted.length > 0) {
    // Successfully inserted — we have the lease
    return true;
  }

  // Step 2: Row already exists — read its current status
  const [existing] = await db
    .select({ status: briefingDeliveriesTable.status })
    .from(briefingDeliveriesTable)
    .where(eq(briefingDeliveriesTable.deliveryDate, deliveryDate));

  if (!existing || existing.status === "SUCCESS" || existing.status === "PENDING") {
    // Already succeeded, or another process currently holds the lease — skip
    logger.info(
      { deliveryDate, status: existing?.status ?? "NOT_FOUND" },
      "Briefing delivery slot not available — skipping",
    );
    return false;
  }

  // Step 3: Previous attempt FAILED or PARTIAL — attempt atomic re-claim.
  // PARTIAL means some recipients were missed; a retry is warranted.
  // Only one concurrent caller will win this UPDATE.
  const reclaimed = await db
    .update(briefingDeliveriesTable)
    .set({ status: "PENDING", updatedAt: new Date() })
    .where(
      and(
        eq(briefingDeliveriesTable.deliveryDate, deliveryDate),
        sql`${briefingDeliveriesTable.status} IN ('FAILED', 'PARTIAL')`,
      ),
    )
    .returning({ id: briefingDeliveriesTable.id });

  if (reclaimed.length === 0) {
    logger.info({ deliveryDate }, "Briefing slot reclaimed by another process — skipping");
    return false;
  }

  logger.info({ deliveryDate }, "Retrying previously-failed briefing delivery");
  return true;
}

// ── Data fetch ─────────────────────────────────────────────────────────────────

export async function fetchBriefingData(wibDateStr: string): Promise<BriefingData> {
  // Use WIB-anchored boundaries for all date comparisons
  const wibStart = wibDayStart(wibDateStr);
  const in90Days = new Date(wibStart.getTime() + 90 * 24 * 60 * 60 * 1000);
  const in90DaysStr = format(
    new Date(in90Days.getTime() + 7 * 60 * 60 * 1000),
    "yyyy-MM-dd",
  );

  const [
    researchCount,
    tenderOpenCount,
    contractorCount,
    skkCount,
    expiringContractors,
    expiringSKK,
    todayResearch,
    trendRows,
    expiringContractorDetails,
    expiringSKKDetails,
    criticalPainRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(researchItemsTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenderOpportunitiesTable)
      .where(sql`${tenderOpportunitiesTable.status} IN ('OPEN', 'CLOSING_SOON')`),
    db.select({ count: sql<number>`count(*)::int` }).from(contractorsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(skkHoldersTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contractorsTable)
      .where(
        sql`${contractorsTable.sbuExpiry} IS NOT NULL AND ${contractorsTable.sbuExpiry} <= ${in90DaysStr} AND ${contractorsTable.sbuExpiry} >= ${wibDateStr}`,
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(skkHoldersTable)
      .where(
        sql`${skkHoldersTable.skkExpiry} IS NOT NULL AND ${skkHoldersTable.skkExpiry} <= ${in90DaysStr} AND ${skkHoldersTable.skkExpiry} >= ${wibDateStr}`,
      ),
    // Count items collected within today's WIB date window
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchItemsTable)
      .where(
        and(
          gte(researchItemsTable.createdAt, wibStart),
          lte(researchItemsTable.createdAt, wibDayEnd(wibDateStr)),
        ),
      ),
    db
      .select({
        topic: researchItemsTable.title,
        count: sql<number>`count(*)::int`,
        category: researchItemsTable.category,
      })
      .from(researchItemsTable)
      .groupBy(researchItemsTable.title, researchItemsTable.category)
      .orderBy(sql`count(*) desc`)
      .limit(10),
    db
      .select()
      .from(contractorsTable)
      .where(
        sql`${contractorsTable.sbuExpiry} IS NOT NULL AND ${contractorsTable.sbuExpiry} <= ${in90DaysStr} AND ${contractorsTable.sbuExpiry} >= ${wibDateStr}`,
      )
      .orderBy(contractorsTable.sbuExpiry)
      .limit(10),
    db
      .select()
      .from(skkHoldersTable)
      .where(
        sql`${skkHoldersTable.skkExpiry} IS NOT NULL AND ${skkHoldersTable.skkExpiry} <= ${in90DaysStr} AND ${skkHoldersTable.skkExpiry} >= ${wibDateStr}`,
      )
      .orderBy(skkHoldersTable.skkExpiry)
      .limit(10),
    db
      .select()
      .from(painPointsTable)
      .where(sql`${painPointsTable.priority} = 'CRITICAL'`)
      .limit(10),
  ]);

  const todayTime = new Date(wibDateStr + "T00:00:00+07:00").getTime();

  const expiring = [
    ...expiringContractorDetails.map((c) => ({
      type: "SBU",
      holderName: c.name,
      expiryDate: c.sbuExpiry ?? "-",
      daysLeft: c.sbuExpiry
        ? Math.ceil((new Date(c.sbuExpiry + "T00:00:00+07:00").getTime() - todayTime) / (1000 * 60 * 60 * 24))
        : 0,
    })),
    ...expiringSKKDetails.map((s) => ({
      type: "SKK",
      holderName: s.name,
      expiryDate: s.skkExpiry ?? "-",
      daysLeft: s.skkExpiry
        ? Math.ceil((new Date(s.skkExpiry + "T00:00:00+07:00").getTime() - todayTime) / (1000 * 60 * 60 * 24))
        : 0,
    })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    summary: {
      totalResearchItems: researchCount[0]?.count ?? 0,
      openTenders: tenderOpenCount[0]?.count ?? 0,
      totalContractors: contractorCount[0]?.count ?? 0,
      totalSkkHolders: skkCount[0]?.count ?? 0,
      expiringCertifications:
        (expiringContractors[0]?.count ?? 0) + (expiringSKK[0]?.count ?? 0),
      todayCollected: todayResearch[0]?.count ?? 0,
    },
    trends: trendRows.map((r) => ({
      topic: r.topic,
      category: r.category,
      count: r.count,
      trend: r.count > 3 ? "UP" : r.count > 1 ? "STABLE" : "DOWN",
    })),
    expiring,
    criticalPainPoints: criticalPainRows.map((pp) => ({
      problemId: pp.problemId ?? pp.id?.toString(),
      domain: pp.domain,
      description: pp.description,
      painScore: pp.painScore,
      serviceOpportunity: pp.serviceOpportunity,
    })),
  };
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function deliverDailyBriefing(opts: DeliveryOptions = {}): Promise<DeliveryReport> {
  const deliveryDate = todayWIBString();
  logger.info(
    { deliveryDate, bypassIdempotency: opts.bypassIdempotency ?? false },
    "Daily briefing delivery started",
  );

  // ── Idempotency guard ──────────────────────────────────────────────────────
  if (!opts.bypassIdempotency) {
    const claimed = await claimDeliverySlot(deliveryDate);
    if (!claimed) {
      return {
        pdfGenerated: false,
        intelligencePdfGenerated: false,
        emailResults: [],
        whatsappResults: [],
        status: "SKIPPED",
        skipped: true,
      };
    }
  }

  // Helper: update the DB delivery record (skipped when bypassIdempotency=true)
  const updateStatus = async (fields: Partial<typeof briefingDeliveriesTable.$inferInsert>) => {
    if (opts.bypassIdempotency) return;
    await db
      .update(briefingDeliveriesTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(briefingDeliveriesTable.deliveryDate, deliveryDate));
  };

  // ── Fetch recipients ───────────────────────────────────────────────────────
  const allSettings = await db
    .select()
    .from(notificationSettingsTable)
    .where(eq(notificationSettingsTable.enabled, true));

  let emailRecipients = allSettings
    .filter((s) => s.channel === "email")
    .map((s) => s.recipient);
  let waRecipients = allSettings
    .filter((s) => s.channel === "whatsapp")
    .map((s) => s.recipient);

  // ── Exclude recipients already successfully delivered today ────────────────
  // This guards against duplicate sends when retrying a PARTIAL failure:
  // only recipients that failed on the previous attempt will be retried.
  if (emailRecipients.length + waRecipients.length > 0) {
    try {
      const alreadySent = await db
        .select({ channel: briefingDeliveryLogTable.channel, recipient: briefingDeliveryLogTable.recipient })
        .from(briefingDeliveryLogTable)
        .where(
          and(
            eq(briefingDeliveryLogTable.deliveryDate, deliveryDate),
            eq(briefingDeliveryLogTable.status, "SUCCESS"),
          ),
        );

      if (alreadySent.length > 0) {
        const sentEmails = new Set(
          alreadySent.filter((r) => r.channel === "email").map((r) => r.recipient),
        );
        const sentWA = new Set(
          alreadySent.filter((r) => r.channel === "whatsapp").map((r) => r.recipient),
        );
        const prevEmailCount = emailRecipients.length;
        const prevWACount = waRecipients.length;
        emailRecipients = emailRecipients.filter((r) => !sentEmails.has(r));
        waRecipients = waRecipients.filter((r) => !sentWA.has(r));
        logger.info(
          {
            emailSkipped: prevEmailCount - emailRecipients.length,
            waSkipped: prevWACount - waRecipients.length,
          },
          "Briefing delivery: skipping already-successful recipients from prior attempt",
        );
      }
    } catch (logQueryErr) {
      // Non-fatal — if we can't check the log, proceed with all recipients
      // (the worst outcome is a duplicate send, which is better than a missed send)
      logger.warn({ err: logQueryErr }, "Failed to query delivery log for recipient dedup — proceeding with all recipients");
    }
  }

  if (emailRecipients.length === 0 && waRecipients.length === 0) {
    // All recipients either have no enabled settings or already received successfully today.
    // Check which case we're in to avoid marking a full-success scenario as FAILED.
    const totalEnabled = allSettings.length;
    if (totalEnabled === 0) {
      logger.info("No enabled recipients — briefing delivery skipped");
      await updateStatus({ status: "FAILED", error: "No enabled recipients" });
      void sendBriefingDeliveryAlert({
        deliveryDate,
        status: "FAILED",
        successCount: 0,
        failCount: 0,
        errors: ["Tidak ada penerima yang diaktifkan di pengaturan notifikasi"],
      }).catch((alertErr) => logger.error({ err: alertErr }, "Failed to send briefing delivery alert (no recipients)"));
      return {
        pdfGenerated: false,
        intelligencePdfGenerated: false,
        emailResults: [],
        whatsappResults: [],
        status: "FAILED",
        error: "No enabled recipients",
      };
    }
    // All recipients already delivered successfully — this is a deduped no-op
    logger.info({ deliveryDate }, "All recipients already delivered today — skipping");
    return {
      pdfGenerated: false,
      intelligencePdfGenerated: false,
      emailResults: [],
      whatsappResults: [],
      status: "SKIPPED",
      skipped: true,
    };
  }

  // ── Generate PDF (WIB-anchored date label) ─────────────────────────────────
  // Use the WIB date for the label so midnight-to-07:00 runs show the correct day
  const dateLabel = format(
    new Date(Date.parse(deliveryDate + "T00:00:00+07:00")),
    "dd MMMM yyyy",
  );

  let pdfBuffer: Buffer;
  let inteligensiBuffer: Buffer | null = null;
  try {
    const data = await fetchBriefingData(deliveryDate);
    // Generate both PDFs concurrently — Laporan Intelijen failure is non-fatal (#80)
    const [briefing, inteligensi] = await Promise.allSettled([
      generateBriefingPDF(data),
      generateInteligensiReport(data, dateLabel),
    ]);
    if (briefing.status === "rejected") throw briefing.reason;
    pdfBuffer = briefing.value;
    logger.info({ sizeBytes: pdfBuffer.byteLength }, "Briefing PDF generated");
    if (inteligensi.status === "fulfilled") {
      inteligensiBuffer = inteligensi.value;
      logger.info({ sizeBytes: inteligensiBuffer.byteLength }, "Laporan Intelijen generated");
    } else {
      logger.warn({ err: inteligensi.reason }, "Laporan Intelijen generation failed — omitting attachment");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to generate briefing PDF");
    await updateStatus({ status: "FAILED", error: message });
    void sendBriefingDeliveryAlert({
      deliveryDate,
      status: "FAILED",
      successCount: 0,
      failCount: (emailRecipients.length + waRecipients.length),
      errors: [`PDF generation error: ${message}`],
    }).catch((alertErr) => logger.error({ err: alertErr }, "Failed to send briefing delivery alert (PDF failure)"));
    return {
      pdfGenerated: false,
      intelligencePdfGenerated: false,
      emailResults: [],
      whatsappResults: [],
      status: "FAILED",
      error: message,
    };
  }

  // ── Deliver ────────────────────────────────────────────────────────────────
  const [emailResults, whatsappResults] = await Promise.all([
    emailRecipients.length > 0
      ? sendBriefingEmail(emailRecipients, pdfBuffer, dateLabel, inteligensiBuffer ?? undefined)
      : Promise.resolve([]),
    waRecipients.length > 0
      ? sendBriefingWhatsApp(waRecipients, pdfBuffer, dateLabel, inteligensiBuffer ?? undefined)
      : Promise.resolve([]),
  ]);

  const allResults = [...emailResults, ...whatsappResults];
  const successCount = allResults.filter((r) => r.success).length;
  const failCount = allResults.filter((r) => !r.success).length;
  const deliveryStatus =
    failCount === 0 ? "SUCCESS" : successCount === 0 ? "FAILED" : "PARTIAL";

  // ── Write per-recipient delivery log entries ───────────────────────────────
  const logRows = [
    ...emailResults.map((r) => ({
      deliveryDate,
      channel: "email" as const,
      recipient: r.recipient,
      status: r.success ? "SUCCESS" : "FAILED",
      errorMessage: r.error ?? null,
    })),
    ...whatsappResults.map((r) => ({
      deliveryDate,
      channel: "whatsapp" as const,
      recipient: r.recipient,
      status: r.success ? "SUCCESS" : "FAILED",
      errorMessage: r.error ?? null,
    })),
  ];

  if (logRows.length > 0) {
    try {
      await db.insert(briefingDeliveryLogTable).values(logRows);
    } catch (err) {
      // Log failure is non-fatal; delivery already completed
      logger.error({ err }, "Failed to write briefing delivery log entries");
    }
  }

  await updateStatus({
    status: deliveryStatus,
    pdfGenerated: true,
    successCount,
    failCount,
  });

  logger.info(
    { deliveryDate, status: deliveryStatus, successCount, failCount },
    "Daily briefing delivery finished",
  );

  // ── Fallback alert when delivery failed or was partial ─────────────────────
  // Fire-and-forget so an alert network error cannot break the return value.
  if (deliveryStatus === "FAILED" || deliveryStatus === "PARTIAL") {
    const errors = allResults
      .filter((r) => !r.success && r.error)
      .map((r) => `${r.recipient}: ${r.error ?? "unknown error"}`);

    void sendBriefingDeliveryAlert({
      deliveryDate,
      status: deliveryStatus,
      successCount,
      failCount,
      errors,
    }).catch((alertErr) =>
      logger.error({ err: alertErr }, "Failed to send briefing delivery alert"),
    );
  }

  return {
    pdfGenerated: true,
    intelligencePdfGenerated: inteligensiBuffer !== null,
    emailResults,
    whatsappResults,
    status: deliveryStatus as "SUCCESS" | "PARTIAL" | "FAILED",
  };
}
