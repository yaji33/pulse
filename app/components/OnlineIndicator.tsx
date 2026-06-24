"use client";

export default function OnlineIndicator({ count }: { count: number }) {
  return (
    <div
      className="fixed bottom-7 left-5 z-10 flex items-center gap-2 border border-[#1f1f1f] bg-[#111111]/85 px-3.5 py-[7px] font-mono text-[11px] tracking-[0.08em] text-[#5a5a5a] backdrop-blur-md"
    >
      <span className="online-dot" />
      <span>{count} ONLINE</span>
    </div>
  );
}
