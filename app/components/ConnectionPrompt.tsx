"use client";

export default function ConnectionPrompt({
  title,
  subtitle,
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-6">
      <div className="modal-in w-[380px] max-w-full border border-[#1f1f1f] bg-[#111111] px-12 py-10 text-center">
        <svg
          width="32"
          height="20"
          viewBox="0 0 32 20"
          fill="none"
          className="mx-auto"
          aria-hidden="true"
        >
          <path
            className="arc-draw"
            d="M6 16 A 12 12 0 0 1 26 16"
            stroke="#ff3b3b"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
          <path
            className="arc-draw"
            d="M1 16 A 18 18 0 0 1 31 16"
            stroke="#ff3b3b"
            strokeOpacity="0.3"
            strokeWidth="1.5"
          />
        </svg>

        <h2
          className="mt-4 text-[18px] text-[#f0f0f0]"
          style={{ fontFamily: "var(--font-syne)", fontWeight: 600 }}
        >
          {title}
        </h2>

        <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-[#5a5a5a]">
          {subtitle ?? "Anonymous · Peer-to-peer · No recording"}
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={onDecline}
            className="border border-[#2a2a2a] bg-transparent px-7 py-[11px] text-[13px] font-medium uppercase tracking-[0.04em] text-[#5a5a5a] transition-colors duration-[180ms] hover:border-[#f0f0f0] hover:text-[#f0f0f0]"
          >
            {declineLabel}
          </button>
          <button
            onClick={onAccept}
            className="border border-[#f0f0f0]/50 bg-transparent px-7 py-[11px] text-[13px] font-medium uppercase tracking-[0.04em] text-[#f0f0f0] transition-colors duration-[180ms] hover:bg-[#f0f0f0] hover:text-[#080808]"
          >
            {acceptLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
