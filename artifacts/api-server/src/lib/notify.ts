/**
 * Notification helper — sends a post-collection summary to a webhook URL,
 * and a fallback delivery-failure alert when briefing delivery fails/is partial.
 *
 * Configure via environment variables:
 *   NOTIFICATION_WEBHOOK_URL   Slack (or any) incoming-webhook URL to POST the summary to.
 *   DASHBOARD_URL              Public URL of the web dashboard (used in the message link).
 *                              Falls back to a sensible default when absent.
 */

import { logger } from "./logger";
import type { DailyCollectionReport } from "./collectDailyData";

const STATUS_EMOJI: Record<string, string> = {
  SUCCESS: "✅",
  PARTIAL: "⚠️",
  BLOCKED: "🚫",
  ERROR: "❌",
};

function buildSlackPayload(report: DailyCollectionReport, dashboardUrl: string, runId?: number): object {
  const succeeded = report.results.filter((r) => r.status === "SUCCESS").length;
  const failed = report.results.filter(
    (r) => r.status === "ERROR" || r.status === "BLOCKED",
  ).length;
  const partial = report.results.filter((r) => r.status === "PARTIAL").length;

  const overallOk = failed === 0;
  const headerEmoji = overallOk ? "✅" : "⚠️";
  const headerText = overallOk
    ? `${headerEmoji} Pengumpulan data pagi *berhasil*`
    : `${headerEmoji} Pengumpulan data pagi *selesai dengan masalah*`;

  const sourceLines = report.results
    .map(
      (r) =>
        `${STATUS_EMOJI[r.status] ?? "❓"} *${r.sourceName}* — ${r.itemsSaved} item tersimpan` +
        (r.errorMessage ? ` _(${r.errorMessage})_` : ""),
    )
    .join("\n");

  return {
    text: headerText,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${headerEmoji} Laporan Pengumpulan Data Pagi`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Total item tersimpan:*\n${report.totalItemsSaved}` },
          { type: "mrkdwn", text: `*Total item dilewati:*\n${report.totalItemsSkipped}` },
          { type: "mrkdwn", text: `*Sumber berhasil:*\n${succeeded}` },
          { type: "mrkdwn", text: `*Sumber gagal / diblokir:*\n${failed + partial}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Detail per sumber:*\n${sourceLines}` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Buka Dashboard →", emoji: true },
            url: dashboardUrl,
            style: overallOk ? "primary" : "danger",
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Dimulai: ${report.startedAt}  |  Selesai: ${report.finishedAt}`,
          },
        ],
      },
      // Idempotency footer: embeds the scheduler run ID so recipients can detect
      // duplicate deliveries caused by crash-recovery retries.
      ...(runId != null
        ? [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `_Run ID: ${runId}_`,
                },
              ],
            },
          ]
        : []),
    ],
  };
}

export interface NotificationResult {
  channel: "webhook" | "none";
  success: boolean;
  sentAt: string;
  errorMessage?: string;
  httpStatus?: number;
}

export interface BriefingAlertResult {
  channel: "webhook" | "none";
  success: boolean;
  sentAt: string;
  errorMessage?: string;
}

export interface BriefingDeliveryFailureInfo {
  deliveryDate: string;
  status: "FAILED" | "PARTIAL";
  successCount: number;
  failCount: number;
  /** Errors grouped by channel — e.g. "email: SMTP error..." */
  errors: string[];
  isRetry?: boolean;
}

function buildBriefingAlertPayload(info: BriefingDeliveryFailureInfo, dashboardUrl: string): object {
  const headerEmoji = info.status === "FAILED" ? "🚨" : "⚠️";
  const headerText =
    info.status === "FAILED"
      ? `${headerEmoji} Briefing harian *GAGAL terkirim* — ${info.deliveryDate}`
      : `${headerEmoji} Briefing harian terkirim *sebagian* — ${info.deliveryDate}`;

  const retryNote = info.isRetry ? "\n_ℹ️ Ini adalah percobaan ulang otomatis kedua._" : "";

  const errorLines =
    info.errors.length > 0
      ? info.errors.map((e) => `• ${e}`).join("\n")
      : "Detail error tidak tersedia";

  return {
    text: headerText,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${headerEmoji} Kegagalan Pengiriman Briefing`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Tanggal:*\n${info.deliveryDate}` },
          { type: "mrkdwn", text: `*Status:*\n${info.status}` },
          { type: "mrkdwn", text: `*Berhasil:*\n${info.successCount}` },
          { type: "mrkdwn", text: `*Gagal:*\n${info.failCount}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Detail error:*\n${errorLines}${retryNote}` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Cek Riwayat Pengiriman →", emoji: true },
            url: `${dashboardUrl}#briefing-history`,
            style: "danger",
          },
        ],
      },
    ],
  };
}

/**
 * Send a fallback alert to the configured webhook when briefing delivery fails or is partial.
 * Uses the same NOTIFICATION_WEBHOOK_URL as the collection notification.
 */
export async function sendBriefingDeliveryAlert(info: BriefingDeliveryFailureInfo): Promise<BriefingAlertResult> {
  const webhookUrl = process.env["NOTIFICATION_WEBHOOK_URL"];
  const sentAt = new Date().toISOString();

  if (!webhookUrl) {
    logger.info("NOTIFICATION_WEBHOOK_URL not set — skipping briefing delivery alert");
    return { channel: "none", success: false, sentAt, errorMessage: "NOTIFICATION_WEBHOOK_URL tidak dikonfigurasi" };
  }

  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "https://your-app.replit.app";
  const payload = buildBriefingAlertPayload(info, dashboardUrl);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const errorMessage = `Webhook mengembalikan HTTP ${res.status}: ${body.slice(0, 200)}`;
      logger.warn({ status: res.status }, "Briefing delivery alert webhook returned non-OK status");
      return { channel: "webhook", success: false, sentAt, errorMessage };
    }

    logger.info({ deliveryDate: info.deliveryDate, status: info.status }, "Briefing delivery alert sent");
    return { channel: "webhook", success: true, sentAt };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to send briefing delivery alert");
    return { channel: "webhook", success: false, sentAt, errorMessage: `Gagal terhubung ke webhook: ${errorMessage}` };
  }
}

/**
 * Send an alert when a scheduler run is interrupted (server restart or watchdog timeout).
 * Fire-and-forget friendly — never throws.
 */
export async function sendInterruptionAlert(runId: number, startedAt: string): Promise<void> {
  const webhookUrl = process.env["NOTIFICATION_WEBHOOK_URL"];
  if (!webhookUrl) {
    logger.info({ runId }, "NOTIFICATION_WEBHOOK_URL not set — skipping interruption alert");
    return;
  }
  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "https://your-app.replit.app";
  const payload = {
    text: `⚡ Run scheduler #${runId} terputus`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "⚡ Run Scheduler Terputus", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Run #${runId}* yang dimulai pada ${startedAt} terputus — kemungkinan server restart atau melebihi batas waktu maksimum 30 menit.\n\nCek panel riwayat di dashboard untuk detailnya.`,
        },
      },
      {
        type: "actions",
        elements: [{
          type: "button",
          text: { type: "plain_text", text: "Buka Dashboard", emoji: true },
          url: dashboardUrl,
          style: "danger",
        }],
      },
    ],
  };
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ runId, status: res.status, body: body.slice(0, 200) }, "Interruption alert webhook returned non-OK");
    } else {
      logger.info({ runId }, "Interruption alert sent successfully");
    }
  } catch (err) {
    logger.error({ err, runId }, "Failed to send interruption alert");
  }
}

/**
 * Send a post-collection notification to the configured webhook.
 * Returns a structured result instead of failing silently.
 * Logs all outcomes (success, config-missing, HTTP error, network error).
 */
export async function sendCollectionNotification(report: DailyCollectionReport, runId?: number): Promise<NotificationResult> {
  const webhookUrl = process.env["NOTIFICATION_WEBHOOK_URL"];
  const sentAt = new Date().toISOString();

  if (!webhookUrl) {
    logger.info("NOTIFICATION_WEBHOOK_URL not set — skipping notification");
    return { channel: "none", success: false, sentAt, errorMessage: "NOTIFICATION_WEBHOOK_URL tidak dikonfigurasi" };
  }

  const dashboardUrl = process.env["DASHBOARD_URL"] ?? "https://your-app.replit.app";
  const payload = buildSlackPayload(report, dashboardUrl, runId);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const errorMessage = `Webhook mengembalikan HTTP ${res.status}: ${body.slice(0, 200)}`;
      logger.warn({ status: res.status, body }, "Notification webhook returned non-OK status");
      return { channel: "webhook", success: false, sentAt, errorMessage, httpStatus: res.status };
    }

    logger.info({ totalItemsSaved: report.totalItemsSaved }, "Collection notification sent successfully");
    return { channel: "webhook", success: true, sentAt, httpStatus: res.status };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to send collection notification");
    return { channel: "webhook", success: false, sentAt, errorMessage: `Gagal terhubung ke webhook: ${errorMessage}` };
  }
}
