"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
  at?: number;
}

function formatTime(at?: number): string {
  if (!at) return "";
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  onSend,
  onStartVideo,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  const hasDraft = draft.trim().length > 0;

  return (
    <div className="fixed inset-y-0 right-0 z-20 flex w-[360px] max-w-full flex-col border-l border-[#1f1f1f] bg-[#0d0d0d]">
      <header className="flex h-16 items-center justify-between border-b border-[#1f1f1f] px-5">
        <div>
          <p className="font-mono text-[11px] tracking-[0.1em] text-[#f0f0f0]">
            STRANGER
          </p>
          {connected ? (
            <p className="mt-0.5 font-mono text-[10px] tracking-[0.06em] text-[#5a5a5a]">
              CONNECTED
            </p>
          ) : (
            <p className="blink-cursor mt-0.5 font-mono text-[10px] tracking-[0.06em] text-[#5a5a5a]">
              CONNECTING...
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartVideo}
            disabled={!connected || videoBusy}
            className="border border-[#1f1f1f] bg-transparent px-4 py-[7px] text-[11px] font-medium uppercase tracking-[0.06em] text-[#5a5a5a] transition-colors hover:border-[#f0f0f0]/30 hover:text-[#f0f0f0] disabled:opacity-40 disabled:hover:border-[#1f1f1f] disabled:hover:text-[#5a5a5a]"
          >
            Video
          </button>
          <button
            onClick={onEnd}
            className="border border-[#ff3b3b]/30 bg-transparent px-4 py-[7px] text-[11px] font-medium uppercase tracking-[0.06em] text-[#ff3b3b] transition-colors duration-[180ms] hover:bg-[#ff3b3b] hover:text-[#080808]"
          >
            End
          </button>
        </div>
      </header>

      <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-5 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-[14px] text-[#2a2a2a]">Say hello.</p>
            <p className="mt-2 font-mono text-[10px] tracking-[0.06em] text-[#1f1f1f]">
              Messages are peer-to-peer and never stored.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="group mb-3">
              {m.mine ? (
                <p className="text-right text-[14px] text-[#5a5a5a]">{m.text}</p>
              ) : (
                <p className="border-l-2 border-[#1f1f1f] pl-3 text-[14px] text-[#f0f0f0]">
                  {m.text}
                </p>
              )}
              <p
                className={`mt-1 font-mono text-[9px] text-[#2a2a2a] opacity-0 transition-opacity group-hover:opacity-100 ${
                  m.mine ? "text-right" : "pl-3"
                }`}
              >
                {formatTime(m.at)}
              </p>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex h-[60px] items-center gap-3 border-t border-[#1f1f1f] px-4"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message..." : "Connecting..."}
          disabled={!connected}
          className="flex-1 border-none bg-transparent text-[14px] text-[#f0f0f0] caret-[#ff3b3b] outline-none placeholder:text-[#2a2a2a] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!connected || !hasDraft}
          className={`border bg-transparent px-4 py-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors ${
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
