import { Router, type IRouter } from "express";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db, notificationSettingsTable, briefingDeliveryLogTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { isSmtpConfigured } from "../lib/emailSender";
import { isWhatsAppConfigured } from "../lib/whatsappSender";
import { deliverDailyBriefing, fetchBriefingData } from "../lib/deliverBriefing";
import { generateBriefingPDF } from "../lib/generateBriefingPDF";
import { requireAdminToken } from "../lib/adminAuth";
import { format } from "date-fns";

const router: IRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateBody = z.object({
  channel: z.enum(["email", "whatsapp"]),
  recipient: z.string().min(1),
  label: z.string().optional().default(""),
  enabled: z.boolean().optional().default(true),
});

const UpdateBody = z.object({
  label: z.string().optional(),
  enabled: z.boolean().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /notification-settings — list all recipients */
router.get("/notification-settings", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(notificationSettingsTable)
      .orderBy(desc(notificationSettingsTable.createdAt));

    res.json(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** GET /notification-settings/config-status — check which channels are configured */
router.get("/notification-settings/config-status", requireAdminToken, (_req, res): void => {
  res.json({
    email: isSmtpConfigured(),
    whatsapp: isWhatsAppConfigured(),
  });
});

/** POST /notification-settings — add a new recipient */
router.post("/notification-settings", requireAdminToken, async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [row] = await db
      .insert(notificationSettingsTable)
      .values(parsed.data)
      .returning();

    res.status(201).json({ ...row, createdAt: row!.createdAt.toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** PATCH /notification-settings/:id — update label or enabled status */
router.patch("/notification-settings/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<{ label: string; enabled: boolean }> = {};
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  try {
    const [row] = await db
      .update(notificationSettingsTable)
      .set(updates)
      .where(eq(notificationSettingsTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Setting not found" });
      return;
    }

    res.json({ ...row, createdAt: row.createdAt.toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** DELETE /notification-settings/:id */
router.delete("/notification-settings/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await db
      .delete(notificationSettingsTable)
      .where(eq(notificationSettingsTable.id, id))
      .returning({ id: notificationSettingsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Setting not found" });
      return;
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /notification-settings/delivery-log — per-recipient delivery log entries.
 * #109 — supports optional query params: from (date), to (date), channel (email|whatsapp), limit (default 100)
 */
router.get("/notification-settings/delivery-log", requireAdminToken, async (req, res): Promise<void> => {
  try {
    const { from: fromParam, to: toParam, channel: channelParam, limit: limitParam } = req.query;
    const limit = Math.min(500, parseInt(String(limitParam ?? "100"), 10) || 100);

    const conditions: ReturnType<typeof eq>[] = [];
    if (channelParam && (channelParam === "email" || channelParam === "whatsapp")) {
      conditions.push(eq(briefingDeliveryLogTable.channel, channelParam));
    }
    if (fromParam && typeof fromParam === "string") {
      const fromDate = new Date(fromParam);
      if (!isNaN(fromDate.getTime())) conditions.push(gte(briefingDeliveryLogTable.sentAt, fromDate));
    }
    if (toParam && typeof toParam === "string") {
      const toDate = new Date(toParam + "T23:59:59.999Z");
      if (!isNaN(toDate.getTime())) conditions.push(lte(briefingDeliveryLogTable.sentAt, toDate));
    }

    const rows = await db
      .select()
      .from(briefingDeliveryLogTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(briefingDeliveryLogTable.sentAt))
      .limit(limit);

    res.json(
      rows.map((r) => ({
        ...r,
        sentAt: r.sentAt.toISOString(),
      })),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** GET /briefing/preview — generate and return today's briefing PDF as binary */
router.get("/briefing/preview", requireAdminToken, async (_req, res): Promise<void> => {
  logger.info("Briefing PDF preview requested");
  try {
    const wibDateStr = format(new Date(Date.now() + 7 * 60 * 60 * 1000), "yyyy-MM-dd");
    const data = await fetchBriefingData(wibDateStr);
    const pdfBuffer = await generateBriefingPDF(data);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="briefing-${wibDateStr}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.byteLength);
    res.end(pdfBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Briefing PDF preview failed");
    res.status(500).json({ error: message });
  }
});

/** POST /notification-settings/test-send — trigger an immediate briefing delivery */
router.post("/notification-settings/test-send", requireAdminToken, async (_req, res): Promise<void> => {
  logger.info("Manual test briefing delivery triggered");

  try {
    // bypassIdempotency: true so a test-send never consumes today's scheduled
    // delivery slot (and vice-versa — the 07:00 run is unaffected by tests)
    const report = await deliverDailyBriefing({ bypassIdempotency: true });
    res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Test briefing delivery failed");
    res.status(500).json({ error: message });
  }
});

export default router;
