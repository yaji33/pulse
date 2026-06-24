import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

// Join issues an HMAC token bound to the session id; every later request must
// present it. Session ids are public (peers see them in poll data), but a token
// can't be forged without the secret.

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(id: unknown): id is string {
  return typeof id === "string" && UUID_V4.test(id);
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function hmac(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

// Token format: "<expiry>.<signature>", signature over id + expiry.
export function signToken(id: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${exp}.${hmac(`${id}.${exp}`)}`;
}

export function verifyToken(id: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;

  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(hmac(`${id}.${exp}`));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7);
}
