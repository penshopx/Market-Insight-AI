import { Router, type IRouter } from "express";
import { createSession, deleteSession, isValidSession, isAuthEnabled } from "../lib/authSessions";

const router: IRouter = Router();

/**
 * POST /auth/login
 * Body: { password: string }
 * Returns 200 + { ok: true } and sets session cookie on success.
 * Returns 401 on wrong password.
 * If PLATFORM_PASSWORD is not set, always succeeds (auth disabled).
 */
router.post("/auth/login", (req, res): void => {
  const platformPassword = process.env.PLATFORM_PASSWORD;

  // Auth disabled — no password configured
  if (!platformPassword) {
    res.json({ ok: true, authEnabled: false });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || password !== platformPassword) {
    res.status(401).json({ error: "Password salah. Coba lagi." });
    return;
  }

  const token = createSession();
  res.cookie("platform_session", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ ok: true, authEnabled: true });
});

/**
 * POST /auth/logout
 * Clears the session cookie.
 */
router.post("/auth/logout", (req, res): void => {
  const token = req.cookies?.platform_session as string | undefined;
  if (token) deleteSession(token);
  res.clearCookie("platform_session");
  res.json({ ok: true });
});

/**
 * GET /auth/status
 * Returns whether auth is enabled and whether the current session is valid.
 * Used by the frontend on mount to decide whether to show the login gate.
 */
router.get("/auth/status", (req, res): void => {
  // Prevent browsers and proxies from caching the auth status.
  // A stale cached "authenticated: true" response would bypass the login gate.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  const token = req.cookies?.platform_session as string | undefined;
  const authEnabled = isAuthEnabled();
  const authenticated = isValidSession(token);
  res.json({ authEnabled, authenticated });
});

export default router;
