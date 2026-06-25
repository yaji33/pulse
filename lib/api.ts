// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType, Whisper } from "@/lib/types";

// Carries the HTTP status so callers can tell an expired session (401) apart
// from transient failures (429, network, 5xx).
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Session token from /api/join, attached automatically to later requests.
let sessionToken: string | null = null;

function authHeaders(): Record<string, string> {
  return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}

export async function join(
  id: string,
  lat: number,
  lng: number,
  mood: string | null,
): Promise<{ lat: number; lng: number }> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, lat, lng, mood }),
  });
  if (!res.ok) throw new ApiError(res.status, `join failed: ${res.status}`);
  const data = (await res.json()) as {
    ok: boolean;
    lat: number;
    lng: number;
    token: string;
  };
  sessionToken = data.token;
  return { lat: data.lat, lng: data.lng };
}

export async function poll(id: string): Promise<PollResponse> {
  const res = await fetch(`/api/poll?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new ApiError(res.status, `poll failed: ${res.status}`);
  return res.json();
}

export async function sendSignal(
  fromId: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<void> {
  const res = await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ fromId, toId, type, payload }),
  });
  if (!res.ok) throw new ApiError(res.status, `signal failed: ${res.status}`);
}

export async function sendWhisper(
  id: string,
  lat: number,
  lng: number,
  text: string,
): Promise<Whisper> {
  const res = await fetch("/api/whisper", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ id, lat, lng, text }),
  });
  if (!res.ok) throw new ApiError(res.status, `whisper failed: ${res.status}`);
  const data = (await res.json()) as { ok: boolean; whisper: Whisper };
  return data.whisper;
}

// Fire-and-forget leave that survives the tab closing. sendBeacon can't set
// headers, so the token goes in the body.
export function leave(id: string): void {
  const body = JSON.stringify({ id, token: sessionToken });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
