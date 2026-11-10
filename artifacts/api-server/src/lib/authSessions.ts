import crypto from "crypto";

/**
 * Simple in-memory session store.
 * Sessions are lost on server restart — acceptable for an internal tool.
 * If PLATFORM_PASSWORD is not set, auth is disabled and all requests pass through.
 */

const sessions = new Set<string>();

/** Generate a new session token and register it. */
export function createSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(token);
  return token;
}

/** Check whether a token is valid. Returns true if auth is disabled. */
export function isValidSession(token: string | undefined): boolean {
  if (!process.env.PLATFORM_PASSWORD) return true; // auth disabled
  if (!token) return false;
  return sessions.has(token);
}

/** Remove a session token (logout). */
export function deleteSession(token: string): void {
  sessions.delete(token);
}

/** Whether platform password protection is active. */
export function isAuthEnabled(): boolean {
  return Boolean(process.env.PLATFORM_PASSWORD);
}
