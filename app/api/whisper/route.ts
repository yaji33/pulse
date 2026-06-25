import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { getBearerToken, isValidSessionId, verifyToken } from "@/lib/auth";
import { WHISPER_MAX_LEN } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal profanity guard. Real moderation would use a dedicated service; this
// just blocks the obvious cases so a public map stays presentable.
const BLOCKED = ["fuck", "shit", "bitch", "cunt", "nigger", "faggot"];

function sanitize(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "") // strip control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, WHISPER_MAX_LEN);
}

// POST /api/whisper — body { id, lat, lng, text }. Leaves an anonymous,
// ephemeral message on the map. The whisper is never linked to the session
// after creation.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, lat, lng, text } = (body ?? {}) as Record<string, unknown>;

  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!verifyToken(id, getBearerToken(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }
  if (typeof text !== "string") {
    return Response.json({ error: "invalid text" }, { status: 400 });
  }

  const clean = sanitize(text);
  if (!clean) {
    return Response.json({ error: "empty text" }, { status: 400 });
  }
  const lower = clean.toLowerCase();
  if (BLOCKED.some((w) => new RegExp(`\\b${w}`, "i").test(lower))) {
    return Response.json({ error: "blocked" }, { status: 400 });
  }

  // Fresh offset per whisper: scatters multiple whispers from one user around
  // their dot instead of stacking them on a single point, and keeps each
  // whisper from pinning the user's exact position.
  const spot = applyPrivacyOffset(lat as number, lng as number);

  const whisper = await prisma.whisper.create({
    data: { lat: spot.lat, lng: spot.lng, text: clean },
  });

  return Response.json({
    ok: true,
    whisper: {
      id: whisper.id,
      lat: whisper.lat,
      lng: whisper.lng,
      text: whisper.text,
      createdAt: whisper.createdAt.toISOString(),
    },
  });
}
