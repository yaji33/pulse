"use client";

import { useState } from "react";
import GlobeCanvas from "./GlobeCanvas";
import { MOODS } from "@/lib/moods";

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number, mood: string | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [mood, setMood] = useState<string | null>(null);

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude, mood),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is required to place you on the map."
            : "Couldn't get your location. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="relative isolate min-h-full w-full overflow-hidden bg-[#080808] text-[#f0f0f0]">
      <div className="globe-stage">
        <GlobeCanvas />
      </div>

      <span className="absolute left-8 top-8 z-20 font-mono text-[12px] uppercase tracking-[0.18em] text-[#3a3a3a] md:left-20">
        Pulse
      </span>

      <span className="absolute bottom-8 left-8 z-20 font-mono text-[11px] uppercase tracking-[0.18em] text-[#3a3a3a] md:left-20">
        Pulse · Anonymous Presence Network
      </span>

      <div className="relative z-10 flex min-h-screen flex-col justify-center px-8 text-center md:max-w-[52vw] md:pl-32 md:text-left">
        <h1
          className="fade-up text-[#f0f0f0]"
          style={{
            fontFamily: "var(--font-syne)",
            fontWeight: 700,
            fontSize: "clamp(34px, 4.7vw, 72px)",
            lineHeight: 1.05,
            letterSpacing: "0.01em",
            animationDelay: "200ms",
          }}
        >
          Every stranger
          <br />
          is a signal.
        </h1>

        <p
          className="fade-up mt-6 text-[15px] leading-relaxed text-[#5a5a5a]"
          style={{ animationDelay: "380ms" }}
        >
          Drop onto the map. Connect with anyone online, anywhere.
        </p>

        <div className="fade-up mt-9" style={{ animationDelay: "480ms" }}>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#5a5a5a]">
            How are you right now?{" "}
            <span className="text-[#3a3a3a]">optional</span>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
            {MOODS.map((m) => {
              const selected = mood === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(selected ? null : m.value)}
                  className={`rounded-[1px] border px-3 py-[6px] text-[12px] tracking-[0.02em] transition-colors duration-[160ms] ${
                    selected
                      ? "border-[#f0f0f0]/60 text-[#f0f0f0]"
                      : "border-[#2a2a2a] text-[#5a5a5a] hover:border-[#5a5a5a] hover:text-[#f0f0f0]"
                  }`}
                >
                  {m.value}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="fade-up mt-10 flex justify-center md:justify-start"
          style={{ animationDelay: "600ms" }}
        >
          <button
            onClick={enter}
            disabled={status === "locating"}
            className="rounded-[1px] border border-[#f0f0f0]/40 bg-transparent px-8 py-[13px] text-[13px] font-medium uppercase tracking-[0.05em] text-[#f0f0f0] transition-colors duration-[180ms] ease-in-out hover:bg-[#f0f0f0] hover:text-[#080808] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#f0f0f0]"
          >
            {status === "locating" ? "Locating…" : "Enter Pulse"}
          </button>
        </div>

        {status === "error" && (
          <p className="mt-6 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.04em] text-[#5a5a5a] md:justify-start">
            <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#ff3b3b]" />
            {error}
          </p>
        )}

        <div
          className="fade-up mt-12 space-y-2 font-mono text-[11px] tracking-[0.04em] text-[#3a3a3a]"
          style={{ animationDelay: "720ms" }}
        >
          <p>No sign-up. · No history. · Closes when you leave.</p>
          <p>Your dot appears 1–3 km from your real location.</p>
        </div>
      </div>
    </div>
  );
}
