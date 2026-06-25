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
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  return (
    <div className="entry-gate relative box-border min-h-screen w-full overflow-x-hidden bg-[#080808] text-[#f0f0f0]">
      <div className="globe-stage">
        <GlobeCanvas />
      </div>

      <div className="relative z-[1] flex min-h-screen w-full flex-col md:max-w-[60%] md:justify-center lg:max-w-[52vw]">
        <span className="entry-wordmark relative z-10 block px-6 pb-0 pt-5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#3a3a3a] md:absolute md:left-20 md:top-8 md:px-0 md:pt-0">
          Pulse
        </span>

        <div className="relative z-[1] flex flex-col px-6 text-left md:px-8 md:pl-32">
          <h1
            className="entry-headline fade-up relative z-[1] mt-10 text-[#f0f0f0] md:mt-0"
            style={{ animationDelay: "200ms" }}
          >
            Every stranger
            <br />
            is a signal.
          </h1>

          <p
            className="fade-up relative z-[1] mt-4 max-w-[320px] text-[15px] font-normal leading-[1.6] text-[#5a5a5a] md:mt-6 md:max-w-none"
            style={{ animationDelay: "380ms" }}
          >
            Drop onto the map. Connect with anyone online, anywhere.
          </p>

          <div
            className="fade-up relative z-[1] mt-7 md:mt-9"
            style={{ animationDelay: "480ms" }}
          >
            <span className="mb-3 block font-mono text-[10px] uppercase tracking-[0.08em] text-[#3a3a3a]">
              How are you right now?{" "}
              <span className="text-[#3a3a3a]">optional</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => {
                const selected = mood === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(selected ? null : m.value)}
                    className={`cursor-pointer whitespace-nowrap rounded-[1px] border bg-transparent px-[14px] py-2 text-[13px] font-normal transition-[border-color,color] duration-[180ms] ease-in-out ${
                      selected
                        ? "border-[#f0f0f0]/50 text-[#f0f0f0]"
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
            className="fade-up relative z-[1] mt-7 md:mt-10"
            style={{ animationDelay: "600ms" }}
          >
            <button
              onClick={enter}
              disabled={status === "locating"}
              className="entry-cta block h-[52px] w-full rounded-[1px] border border-[#f0f0f0]/40 bg-transparent text-[13px] font-medium uppercase tracking-[0.06em] text-[#f0f0f0] transition-colors duration-[180ms] ease-in-out hover:bg-[#f0f0f0] hover:text-[#080808] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#f0f0f0] md:inline-block md:h-auto md:w-auto md:px-8 md:py-[13px] md:tracking-[0.05em]"
            >
              {status === "locating" ? "Locating…" : "Enter Pulse"}
            </button>
          </div>

          {status === "error" && (
            <p className="mt-6 flex items-center gap-2 font-mono text-[11px] tracking-[0.04em] text-[#5a5a5a]">
              <span className="inline-block h-[6px] w-[6px] rounded-full bg-[#ff3b3b]" />
              {error}
            </p>
          )}

          <div
            className="entry-meta fade-up relative z-[1] mb-16 mt-8 space-y-0 font-mono text-[11px] leading-[1.8] tracking-[0.06em] text-[#2a2a2a] md:mb-0 md:mt-12"
            style={{ animationDelay: "720ms" }}
          >
            <p>No sign-up. · No history. · Closes when you leave.</p>
            <p>Your dot appears 1–3 km from your real location.</p>
          </div>
        </div>
      </div>

      <span className="entry-footer fixed bottom-4 left-6 z-10 font-mono text-[10px] uppercase tracking-[0.08em] text-[#2a2a2a] max-[359px]:hidden md:absolute md:bottom-8 md:left-20">
        Pulse · Anonymous Presence Network
      </span>
    </div>
  );
}
