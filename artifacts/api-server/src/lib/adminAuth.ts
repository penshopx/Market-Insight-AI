/**
 * Simple admin API key middleware for internal management endpoints.
 *
 * Set NOTIFICATION_ADMIN_TOKEN in environment variables to a secure random string.
 * All requests to protected routes must include:
 *   Authorization: Bearer <NOTIFICATION_ADMIN_TOKEN>
 *
 * If the env var is not set, the middleware rejects all requests with 503
 * and logs a startup warning.
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger } from "./logger";
import { isAuthEnabled, isValidSession } from "./authSessions";

let warnedMissingToken = false;

export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.NOTIFICATION_ADMIN_TOKEN;

  if (!token) {
    if (!warnedMissingToken) {
      logger.warn(
        "NOTIFICATION_ADMIN_TOKEN is not set. Notification settings endpoints are disabled. " +
        "Set this env var to a secure random string to enable them.",
      );
      warnedMissingToken = true;
    }
    res.status(503).json({
      error: "Notification settings not available: NOTIFICATION_ADMIN_TOKEN env var is not configured.",
    });
    return;
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header. Expected: Bearer <NOTIFICATION_ADMIN_TOKEN>" });
    return;
  }

  const provided = authHeader.slice("Bearer ".length).trim();
  if (provided !== token) {
    res.status(403).json({ error: "Invalid admin token." });
    return;
  }

  next();
}

/**
 * Scheduler actions may be authorized by the platform's signed session cookie
 * or by the notification admin bearer token. If platform auth is disabled, the
 * bearer token remains mandatory.
 */
export function requireSchedulerOperator(req: Request, res: Response, next: NextFunction): void {
  const platformSession = req.cookies?.platform_session as string | undefined;
  if (isAuthEnabled() && isValidSession(platformSession)) {
    next();
    return;
  }
  requireAdminToken(req, res, next);
}
