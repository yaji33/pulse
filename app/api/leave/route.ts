import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidSessionId, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — body { id, token }. Removes the presence row and pending
// signals. Called via sendBeacon (can't set headers), so the token rides in the
// body, which may arrive as text — parse defensively.
export async function POST(request: NextRequest) {
  let id: string | undefined;
  let token: string | undefined;
  try {
    const text = await request.text();
    const parsed = text ? JSON.parse(text) : {};
    id = parsed?.id as string | undefined;
    token = parsed?.token as string | undefined;
  } catch {
    id = undefined;
  }

  if (!isValidSessionId(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!verifyToken(id, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Independent cleanup deletes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  // Free any peer still linked to this session, then remove presence + signals.
  const self = await prisma.presence.findUnique({
    where: { id },
    select: { connectedTo: true },
  });
  if (self?.connectedTo) {
    await prisma.presence.updateMany({
      where: { id: self.connectedTo },
      data: { busy: false, connectedTo: null },
    });
  }
  await prisma.presence.updateMany({
    where: { connectedTo: id },
    data: { busy: false, connectedTo: null },
  });

  await prisma.signal.deleteMany({
    where: { OR: [{ toId: id }, { fromId: id }] },
  });
  await prisma.presence.deleteMany({ where: { id } });

  return Response.json({ ok: true });
}
