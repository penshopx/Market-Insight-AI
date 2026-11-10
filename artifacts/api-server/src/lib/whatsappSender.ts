/**
 * WhatsApp delivery for the daily briefing PDF using Meta WhatsApp Cloud API.
 *
 * Required env vars:
 *   WHATSAPP_TOKEN           - Meta permanent token or temporary test token
 *   WHATSAPP_PHONE_NUMBER_ID - Phone number ID from Meta dashboard
 *
 * Flow:
 *   1. Upload each PDF as a media object → get media_id
 *   2. Send both document messages with their media_id to each recipient
 */

import { logger } from "./logger";

export interface WhatsAppDeliveryResult {
  recipient: string;
  success: boolean;
  error?: string;
}

const BASE_URL = "https://graph.facebook.com/v19.0";

async function uploadMedia(pdfBuffer: Buffer, filename: string): Promise<string> {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;

  // FormData with binary PDF upload
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(pdfBuffer)], { type: "application/pdf" });
  formData.append("file", blob, filename);
  formData.append("type", "application/pdf");
  formData.append("messaging_product", "whatsapp");

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Media upload failed (${res.status}): ${body}`);
  }

  const json = await res.json() as { id: string };
  return json.id;
}

async function sendDocument(
  to: string,
  mediaId: string,
  caption: string,
  filename: string,
): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN!;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;

  const res = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "document",
      document: {
        id: mediaId,
        caption,
        filename,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Message send failed (${res.status}): ${body}`);
  }
}

export async function sendBriefingWhatsApp(
  recipients: string[],
  pdfBuffer: Buffer,
  dateLabel: string,
  /** Optional Laporan Intelijen PDF sent as a second document. */
  inteligensiBuffer?: Buffer,
): Promise<WhatsAppDeliveryResult[]> {
  const results: WhatsAppDeliveryResult[] = [];

  if (!isWhatsAppConfigured()) {
    return recipients.map((r) => ({
      recipient: r,
      success: false,
      error: "WhatsApp tidak dikonfigurasi. Set WHATSAPP_TOKEN dan WHATSAPP_PHONE_NUMBER_ID.",
    }));
  }

  const dateSlug = dateLabel.replace(/\s/g, "-");
  const filename = `Briefing-Harian-${dateSlug}.pdf`;
  const inteligensiFilename = `Laporan-Intelijen-${dateSlug}.pdf`;
  const caption = `📊 *Briefing Harian Intel Konstruksi*\n${dateLabel}\n\nLaporan briefing operasional otomatis.`;
  const inteligensiCaption = `🧭 *Laporan Intelijen*\n${dateLabel}\n\nSinyal regulasi, pasar, dan peluang dari sistem riset konstruksi.`;

  // Upload each document once, then reuse the media IDs for all recipients.
  let mediaId: string;
  let inteligensiMediaId: string | undefined;
  try {
    mediaId = await uploadMedia(pdfBuffer, filename);
    logger.info({ mediaId }, "WhatsApp media uploaded");
    if (inteligensiBuffer) {
      inteligensiMediaId = await uploadMedia(inteligensiBuffer, inteligensiFilename);
      logger.info({ mediaId: inteligensiMediaId }, "WhatsApp Laporan Intelijen media uploaded");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "WhatsApp briefing media upload failed");
    return recipients.map((r) => ({ recipient: r, success: false, error: message }));
  }

  for (const recipient of recipients) {
    // Normalize: strip non-digits and ensure international format
    const to = recipient.replace(/\D/g, "");

    try {
      await sendDocument(to, mediaId, caption, filename);
      if (inteligensiMediaId) {
        await sendDocument(to, inteligensiMediaId, inteligensiCaption, inteligensiFilename);
      }
      logger.info({ recipient: to }, "WhatsApp briefing sent successfully");
      results.push({ recipient, success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, recipient: to }, "Failed to send WhatsApp briefing");
      results.push({ recipient, success: false, error: message });
    }
  }

  return results;
}

/** Check if WhatsApp Cloud API is configured. */
export function isWhatsAppConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}
