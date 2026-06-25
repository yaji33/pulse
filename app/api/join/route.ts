import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { isValidSessionId, signToken } from "@/lib/auth";
import { isValidMood } from "@/lib/moods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { id, lat, lng }. Applies a 1–3 km privacy offset
// (raw coords are never stored) and returns a session token for later requests.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, lat, lng, mood } = (body ?? {}) as Record<string, unknown>;

  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!isValidLatLng(lat, lng)) {
    return Response.json({ error: "invalid coordinates" }, { status: 400 });
  }

  // Off-allowlist moods are silently dropped, never rejected.
  const safeMood = isValidMood(mood) ? mood : null;
  const offset = applyPrivacyOffset(lat as number, lng as number);

  await prisma.presence.upsert({
    where: { id },
    create: {
      id,
      lat: offset.lat,
      lng: offset.lng,
      mood: safeMood,
      busy: false,
      lastSeen: new Date(),
    },
    update: {
      lat: offset.lat,
      lng: offset.lng,
      mood: safeMood,
      lastSeen: new Date(),
    },
  });

  return Response.json({
    ok: true,
    lat: offset.lat,
    lng: offset.lng,
    token: signToken(id),
  });
}
