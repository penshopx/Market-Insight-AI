/**
 * Email delivery for the daily briefing PDF.
 * Uses nodemailer with SMTP credentials from environment variables.
 *
 * Required env vars:
 *   SMTP_HOST     - e.g. smtp.gmail.com
 *   SMTP_PORT     - e.g. 587
 *   SMTP_USER     - SMTP username / email
 *   SMTP_PASS     - SMTP password / app-password
 *   SMTP_FROM     - "From" address (defaults to SMTP_USER)
 */

import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface EmailDeliveryResult {
  recipient: string;
  success: boolean;
  error?: string;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP tidak dikonfigurasi. Set SMTP_HOST, SMTP_USER, dan SMTP_PASS di pengaturan environment.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendBriefingEmail(
  recipients: string[],
  pdfBuffer: Buffer,
  dateLabel: string,
  /** #80 — optional Laporan Intelijen PDF attached alongside the main briefing */
  inteligensiBuffer?: Buffer,
): Promise<EmailDeliveryResult[]> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  const results: EmailDeliveryResult[] = [];

  let transporter: ReturnType<typeof nodemailer.createTransport>;
  try {
    transporter = createTransporter();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Email transporter creation failed");
    return recipients.map((r) => ({ recipient: r, success: false, error: message }));
  }

  for (const recipient of recipients) {
    try {
      await transporter.sendMail({
        from: `"Intel Konstruksi" <${from}>`,
        to: recipient,
        subject: `📊 Briefing Harian Intel Konstruksi — ${dateLabel}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <div style="background: #0f172a; color: #fbbf24; padding: 20px; border-radius: 4px 4px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">BRIEFING HARIAN</h1>
              <p style="margin: 4px 0 0; color: #94a3b8; font-size: 13px;">Platform Riset Marketing Konstruksi</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 0 0 4px 4px;">
              <p style="color: #475569;">Terlampir laporan briefing harian untuk <strong>${dateLabel}</strong>.</p>
              <p style="color: #475569;">Briefing berisi ringkasan statistik, topik trending, peringatan sertifikasi, dan pain points critical.</p>
              ${inteligensiBuffer
                ? '<p style="color: #475569;">Laporan Intelijen turut disertakan sebagai attachment kedua, berisi sinyal regulasi, pasar, dan peluang strategis.</p>'
                : ""}
              <hr style="border: 1px solid #e2e8f0; margin: 16px 0;">
              <p style="color: #94a3b8; font-size: 12px;">Email otomatis dari sistem Intel Konstruksi. Jangan balas email ini.</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `Briefing-Harian-${dateLabel.replace(/\s/g, "-")}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
          // #80 — Laporan Intelijen as second attachment (omitted if generation failed)
          ...(inteligensiBuffer
            ? [{
                filename: `Laporan-Intelijen-${dateLabel.replace(/\s/g, "-")}.pdf`,
                content: inteligensiBuffer,
                contentType: "application/pdf",
              }]
            : []),
        ],
      });

      logger.info({ recipient }, "Briefing email sent successfully");
      results.push({ recipient, success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, recipient }, "Failed to send briefing email");
      results.push({ recipient, success: false, error: message });
    }
  }

  return results;
}

/** Check if SMTP is configured. */
export function isSmtpConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}
