"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { distanceKm, formatDistanceKm } from "@/lib/geo";
import { WHISPER_MAX_LEN, WHISPER_TTL_MS } from "@/lib/presence";
import type { Whisper } from "@/lib/types";

function whisperOpacity(createdAt: string, now: number): number {
  const age = now - new Date(createdAt).getTime();
  return Math.max(0.2, 1 - age / WHISPER_TTL_MS);
}

export default function WhisperFeed({
  whispers,
  me,
  onSend,
}: {
  whispers: Whisper[];
  me: { lat: number; lng: number } | null;
  onSend: (text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const endRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(
    () =>
      [...whispers].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [whispers],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sorted.length]);

  // Refresh fade opacity as whispers age.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await onSend(text);
      setDraft("");
    } catch {
      // Keep draft for retry.
    } finally {
      setBusy(false);
    }
  }

  const hasDraft = draft.trim().length > 0;

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-[320px] max-w-full flex-col border-l border-[#1f1f1f] bg-[#0d0d0d]">
      <header className="flex h-16 shrink-0 items-center border-b border-[#1f1f1f] px-5">
        <div>
          <p className="font-mono text-[11px] tracking-[0.1em] text-[#f0f0f0]">
            WHISPERS
          </p>
          <p className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-[#5a5a5a]">
            anonymous · fades in 6h
          </p>
        </div>
      </header>

      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-5 py-6">
        {sorted.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-[14px] text-[#2a2a2a]">The map is quiet.</p>
            <p className="mt-2 font-mono text-[10px] tracking-[0.06em] text-[#1f1f1f]">
              Leave the first whisper below.
            </p>
          </div>
        ) : (
          sorted.map((w) => {
            const km = me ? distanceKm(me.lat, me.lng, w.lat, w.lng) : null;
            return (
              <div
                key={w.id}
                className="mb-4 transition-opacity duration-500"
                style={{ opacity: whisperOpacity(w.createdAt, now) }}
              >
                {km !== null && (
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#3a3a3a]">
                    {formatDistanceKm(km)}
                  </p>
                )}
                <p className="border-l-2 border-[#ff3b3b]/30 pl-3 text-[14px] text-[#f0f0f0]">
                  {w.text}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex h-[60px] shrink-0 items-center gap-3 border-t border-[#1f1f1f] px-4"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={WHISPER_MAX_LEN}
          placeholder="Leave a whisper…"
          className="flex-1 border-none bg-transparent text-[14px] text-[#f0f0f0] caret-[#ff3b3b] outline-none placeholder:text-[#2a2a2a]"
        />
        <button
          type="submit"
          disabled={!hasDraft || busy}
          className={`border bg-transparent px-4 py-[7px] text-[11px] font-medium uppercase tracking-[0.06em] transition-colors ${
            hasDraft
              ? "border-[#f0f0f0]/50 text-[#f0f0f0]"
              : "border-[#1f1f1f] text-[#5a5a5a]"
          } disabled:opacity-40`}
        >
          Send
        </button>
      </form>
    </div>
  );
}
