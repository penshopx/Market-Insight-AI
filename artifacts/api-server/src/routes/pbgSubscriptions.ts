/**
 * CRUD routes for PBG (Persetujuan Bangunan Gedung) city alert subscriptions.
 * Each subscriber provides their WhatsApp number and the cities they want to monitor.
 * The daily scheduler checks for new PBG signals and sends WA alerts automatically.
 */

import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db, pbgSubscriptionsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAdminToken } from "../lib/adminAuth";
import { runPbgAlerts, PBG_CITIES } from "../lib/pbgAlerts";

const router: IRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateBody = z.object({
  whatsapp: z.string().min(7),
  label: z.string().optional().default(""),
  cities: z.array(z.string()).min(1),
  enabled: z.boolean().optional().default(true),
});

const UpdateBody = z.object({
  label: z.string().optional(),
  cities: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /pbg-subscriptions/cities — list supported cities */
router.get("/pbg-subscriptions/cities", (_req, res): void => {
  res.json({ cities: PBG_CITIES });
});

/** GET /pbg-subscriptions — list all subscribers */
router.get("/pbg-subscriptions", requireAdminToken, async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(pbgSubscriptionsTable)
      .orderBy(desc(pbgSubscriptionsTable.createdAt));

    res.json(
      rows.map((r) => ({
        ...r,
        cities: r.cities
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** POST /pbg-subscriptions — add a new subscriber */
router.post("/pbg-subscriptions", requireAdminToken, async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { whatsapp, label, cities, enabled } = parsed.data;

  try {
    const [row] = await db
      .insert(pbgSubscriptionsTable)
      .values({
        whatsapp: whatsapp.replace(/\D/g, ""),
        label: label ?? "",
        cities: cities.join(","),
        enabled: enabled ?? true,
      })
      .returning();

    if (!row) throw new Error("Insert returned no row");

    res.status(201).json({
      ...row,
      cities: row.cities.split(",").map((c) => c.trim()).filter(Boolean),
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** PATCH /pbg-subscriptions/:id — update label, cities, or enabled */
router.patch("/pbg-subscriptions/:id", requireAdminToken, async (req, res): Promise<void> => {
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

  const updates: Partial<{ label: string; cities: string; enabled: boolean }> = {};
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.cities !== undefined) updates.cities = parsed.data.cities.join(",");
  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  try {
    const [row] = await db
      .update(pbgSubscriptionsTable)
      .set(updates)
      .where(eq(pbgSubscriptionsTable.id, id))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Subscriber tidak ditemukan" });
      return;
    }

    res.json({
      ...row,
      cities: row.cities.split(",").map((c) => c.trim()).filter(Boolean),
      createdAt: row.createdAt.toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/** DELETE /pbg-subscriptions/:id */
router.delete("/pbg-subscriptions/:id", requireAdminToken, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await db
      .delete(pbgSubscriptionsTable)
      .where(eq(pbgSubscriptionsTable.id, id))
      .returning({ id: pbgSubscriptionsTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Subscriber tidak ditemukan" });
      return;
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /pbg-subscriptions/trigger-check
 * Manually trigger PBG alert check (admin only).
 * Useful for testing and for catching up after a missed daily run.
 */
router.post("/pbg-subscriptions/trigger-check", requireAdminToken, async (_req, res): Promise<void> => {
  logger.info("Manual PBG alert check triggered");
  try {
    const report = await runPbgAlerts();
    res.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Manual PBG alert check failed");
    res.status(500).json({ error: message });
  }
});

export default router;
