// ─── Auth helpers ─────────────────────────────────────────────────────────────
// Cookie parsing / serialisation helpers that work with plain Request /
// Response objects (no framework cookie library required).

import crypto from "node:crypto";

// ── Token generation ──────────────────────────────────────────────────────────

/** 6-digit numeric OTP, e.g. "048291" */
export function generateOtp(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

/** 32-byte hex session token */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

const COOKIE_NAME = "session";

/** Read the session token from the incoming request's Cookie header. */
export function getSessionToken(request: Request): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

/** Build a Set-Cookie value that sets the session token. */
export function makeSessionCookie(
  token: string,
  maxAgeSecs = 60 * 60 * 24 * 30,
): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSecs}`;
}

/** Build a Set-Cookie value that immediately expires (clears) the session. */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
