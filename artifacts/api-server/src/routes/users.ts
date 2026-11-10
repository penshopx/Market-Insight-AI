/**
 * User routes — Task #132
 *
 * POST /api/webhooks/clerk   — Clerk webhook (user.created / user.updated / user.deleted)
 *                              Verifies svix signature, upserts user record in DB.
 * GET  /api/me               — Returns current user profile from DB (requires Clerk session).
 *                              Bypasses platform password gate (handled per-route).
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { Webhook } from "svix";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// ─── Clerk webhook ────────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/clerk
 *
 * Handles user.created, user.updated, user.deleted events from Clerk.
 * Express must provide the RAW body buffer here — registered in app.ts with
 * express.raw() before json() so the svix signature can be verified.
 */
router.post(
  "/webhooks/clerk",
  async (req: Request, res: Response): Promise<void> => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      logger.warn("CLERK_WEBHOOK_SECRET not set — webhook rejected");
      res.status(400).json({ error: "Webhook secret not configured" });
      return;
    }

    // Verify svix signature
    const svixId        = req.headers["svix-id"] as string | undefined;
    const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
    const svixSignature = req.headers["svix-signature"] as string | undefined;

    if (!svixId || !svixTimestamp || !svixSignature) {
      res.status(400).json({ error: "Missing svix headers" });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      const wh = new Webhook(secret);
      // req.body is a raw Buffer when this route is registered with express.raw()
      const body = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : JSON.stringify(req.body);
      payload = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as Record<string, unknown>;
    } catch (err) {
      logger.warn({ err }, "Clerk webhook: signature verification failed");
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    const eventType = payload["type"] as string;
    const data = payload["data"] as Record<string, unknown> | undefined;

    if (!data) {
      res.status(400).json({ error: "Missing data" });
      return;
    }

    try {
      if (eventType === "user.created" || eventType === "user.updated") {
        const clerkId    = data["id"] as string;
        const emails     = (data["email_addresses"] as Array<{ email_address: string; id: string }>) ?? [];
        const primaryId  = data["primary_email_address_id"] as string | undefined;
        const primaryEmail = emails.find((e) => e.id === primaryId)?.email_address
          ?? emails[0]?.email_address
          ?? "";
        const firstName   = (data["first_name"] as string | null) ?? null;
        const lastName    = (data["last_name"] as string | null) ?? null;
        const imageUrl    = (data["image_url"] as string | null) ?? null;
        const lastSignIn  = data["last_sign_in_at"] as number | null;

        await db
          .insert(usersTable)
          .values({
            clerkId,
            email:       primaryEmail,
            firstName,
            lastName,
            imageUrl,
            status:      "PENDING",
            lastSignInAt: lastSignIn ? new Date(lastSignIn) : null,
          })
          .onConflictDoUpdate({
            target: usersTable.clerkId,
            set: {
              email:        primaryEmail,
              firstName,
              lastName,
              imageUrl,
              lastSignInAt: lastSignIn ? new Date(lastSignIn) : null,
              updatedAt:    new Date(),
            },
          });

        logger.info({ clerkId, event: eventType }, "Clerk webhook: user upserted");
      } else if (eventType === "user.deleted") {
        const clerkId = data["id"] as string;
        await db.delete(usersTable).where(eq(usersTable.clerkId, clerkId));
        logger.info({ clerkId }, "Clerk webhook: user deleted");
      } else {
        logger.info({ eventType }, "Clerk webhook: unhandled event type — ignoring");
      }
    } catch (dbErr) {
      logger.error({ dbErr, eventType }, "Clerk webhook: DB operation failed");
      res.status(500).json({ error: "Internal error" });
      return;
    }

    res.json({ received: true });
  },
);

// ─── Current user profile ──────────────────────────────────────────────────────

/**
 * GET /api/me
 * Returns the authenticated user's record from the DB.
 * Bypasses the platform password gate (users need this to see their own status).
 */
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.clerkId, userId))
      .limit(1);

    if (!user) {
      // User authenticated via Clerk but not yet in our DB — auto-create a pending record.
      // This handles the case where the webhook fires after the user first calls /api/me.
      const [created] = await db
        .insert(usersTable)
        .values({ clerkId: userId, email: "", status: "PENDING" })
        .onConflictDoUpdate({
          target: usersTable.clerkId,
          set: { updatedAt: new Date() },
        })
        .returning();
      res.json(created);
      return;
    }

    res.json(user);
  } catch (err) {
    logger.error({ err }, "GET /api/me failed");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
