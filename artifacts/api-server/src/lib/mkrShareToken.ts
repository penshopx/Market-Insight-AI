import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_VERSION = 1;

interface MkrShareTokenPayload {
  v: number;
  p: string;
  e: number;
}

export class MkrShareTokenError extends Error {
  constructor(
    public readonly code: "INVALID" | "EXPIRED",
    message: string,
  ) {
    super(message);
    this.name = "MkrShareTokenError";
  }
}

export function getMkrShareSigningSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required to create MKR share links");
  }
  return secret;
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

export function createMkrShareToken(
  objectPath: string,
  expiresAt: number,
  secret = getMkrShareSigningSecret(),
): string {
  if (!objectPath.startsWith("/objects/uploads/")) {
    throw new Error("MKR share object path must be an uploaded private object");
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("MKR share expiry must be in the future");
  }

  const payload: MkrShareTokenPayload = {
    v: TOKEN_VERSION,
    p: objectPath,
    e: expiresAt,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

export function verifyMkrShareToken(
  token: string,
  now = Date.now(),
  secret = getMkrShareSigningSecret(),
): { objectPath: string; expiresAt: number } {
  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) {
    throw new MkrShareTokenError("INVALID", "Invalid MKR share token");
  }

  const expectedSignature = Buffer.from(
    signPayload(encodedPayload, secret),
    "base64url",
  );
  const actualSignature = Buffer.from(providedSignature, "base64url");
  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new MkrShareTokenError("INVALID", "Invalid MKR share token");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    throw new MkrShareTokenError("INVALID", "Invalid MKR share token");
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("v" in payload) ||
    payload.v !== TOKEN_VERSION ||
    !("p" in payload) ||
    typeof payload.p !== "string" ||
    !payload.p.startsWith("/objects/uploads/") ||
    !("e" in payload) ||
    typeof payload.e !== "number" ||
    !Number.isFinite(payload.e)
  ) {
    throw new MkrShareTokenError("INVALID", "Invalid MKR share token");
  }

  if (payload.e <= now) {
    throw new MkrShareTokenError("EXPIRED", "MKR share token has expired");
  }

  return { objectPath: payload.p, expiresAt: payload.e };
}