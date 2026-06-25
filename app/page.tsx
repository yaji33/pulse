"use client";

import { useEffect, useRef, useState } from "react";
import EntryGate from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel, { type ChatMessage } from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import OnlineIndicator from "./components/OnlineIndicator";
import WhisperFeed from "./components/WhisperFeed";
import { ApiError, join, leave, poll, sendSignal, sendWhisper } from "@/lib/api";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_MS, MIN_WHISPER_INTERVAL_MS } from "@/lib/presence";
import { type PeerDot, type SignalMsg, type Whisper } from "@/lib/types";

type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string; peerMood: string | null }
  | { kind: "incoming"; peerId: string; peerMood: string | null }
  | { kind: "connecting"; peerId: string; peerMood: string | null }
  | { kind: "connected"; peerId: string; peerMood: string | null };

type VideoState = "none" | "requesting" | "incoming" | "active";

const REQUEST_TIMEOUT_MS = 30_000;
const WHISPER_PANEL_W = 320;
const CHAT_PANEL_W = 360;

export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [whispers, setWhispers] = useState<Whisper[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [myMood, setMyMood] = useState<string | null>(null);

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWhisperAt = useRef(0);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 3500);
  }

  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [
      ...prev,
      { id: msgId.current++, mine, text, at: Date.now() },
    ]);
  }

  function moodOf(peerId: string): string | null {
    return peers.find((p) => p.id === peerId)?.mood ?? null;
  }

  function teardown(message?: string) {
    if (requestTimer.current) clearTimeout(requestTimer.current);
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setConn({ kind: "idle" });
    if (message) showNotice(message);
  }

  function startPeer(peerId: string, initiator: boolean, peerMood: string | null) {
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        void sendSignal(sessionId, peerId, type, payload);
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        if (state === "failed") {
          teardown("Connection failed (network).");
        }
      },
      onChannelOpen: () => {
        setConn({ kind: "connected", peerId, peerMood });
      },
    });
    peerRef.current = ps;
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((stream) => {
              setLocalStream(stream);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Camera unavailable.");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          showNotice("Video declined.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  function requestConnection(peerId: string) {
    if (connRef.current.kind !== "idle") return;
    setConn({ kind: "requesting", peerId, peerMood: moodOf(peerId) });
    void sendSignal(sessionId, peerId, "request");
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(sessionId, peerId, "end");
        teardown("No answer.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      void sendSignal(sessionId, connRef.current.peerId, "end");
    }
    teardown();
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    const { peerId, peerMood } = connRef.current;
    startPeer(peerId, false, peerMood);
    void sendSignal(sessionId, peerId, "accept");
    setConn({ kind: "connecting", peerId, peerMood });
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    void sendSignal(sessionId, connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      void sendSignal(sessionId, c.peerId, "end");
    }
    teardown();
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        ps.sendControl("video-decline");
        setVideo("none");
        showNotice("Camera unavailable.");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function endVideo() {
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        if (connRef.current.kind === "idle") {
          setConn({
            kind: "incoming",
            peerId: sig.fromId,
            peerMood: moodOf(sig.fromId),
          });
        } else {
          void sendSignal(sessionId, sig.fromId, "decline");
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true, c.peerMood);
          setConn({ kind: "connecting", peerId: sig.fromId, peerMood: c.peerMood });
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Request declined.");
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          );
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") setConn({ kind: "idle" });
          else teardown("Stranger disconnected.");
        }
        break;
      }
    }
  }

  const processSignalRef = useRef(processSignal);
  useEffect(() => {
    processSignalRef.current = processSignal;
  });

  useEffect(() => {
    if (phase !== "live" || !sessionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(sessionId);
        if (!active) return;
        setPeers(data.peers);
        setWhispers(data.whispers);
        for (const s of data.signals) processSignalRef.current(s);
      } catch (err) {
        if (!active) return;
        // 401 means the session token expired or is invalid — the session is
        // over. Anything else (429 throttle, network, 5xx) is transient: retry.
        if (err instanceof ApiError && err.status === 401) {
          active = false;
          teardown();
          setSessionEnded(true);
          return;
        }
      }
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, sessionId]);

  useEffect(() => {
    if (!sessionId || phase !== "live") return;
    const onLeave = () => leave(sessionId);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [sessionId, phase]);

  useEffect(() => {
    if (!sessionEnded) return;
    const t = setTimeout(() => {
      setSessionEnded(false);
      setPeers([]);
      setWhispers([]);
      setMyLocation(null);
      setMyMood(null);
      setPhase("gate");
    }, 2800);
    return () => clearTimeout(t);
  }, [sessionEnded]);

  async function handleReady(lat: number, lng: number, mood: string | null) {
    const offset = await join(sessionId, lat, lng, mood);
    setMyLocation(offset);
    setMyMood(mood);
    setPhase("live");
  }

  async function handleWhisper(text: string) {
    if (!myLocation) return;
    if (Date.now() - lastWhisperAt.current < MIN_WHISPER_INTERVAL_MS) {
      showNotice("You can whisper again in a moment.");
      throw new Error("cooldown");
    }
    const w = await sendWhisper(sessionId, myLocation.lat, myLocation.lng, text);
    lastWhisperAt.current = Date.now();
    setWhispers((prev) =>
      prev.some((x) => x.id === w.id) ? prev : [w, ...prev],
    );
  }

  if (sessionEnded) {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-[#080808] px-6 text-center modal-in">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ff3b3b]">
          Signal lost
        </span>
        <h1
          className="text-[#f0f0f0]"
          style={{ fontFamily: "var(--font-syne)", fontWeight: 700, fontSize: "clamp(28px, 4vw, 44px)" }}
        >
          Your session ended
        </h1>
        <p className="font-mono text-[11px] tracking-[0.06em] text-[#5a5a5a]">
          Returning you to the start…
        </p>
      </main>
    );
  }

  if (phase === "gate") {
    return <EntryGate onReady={handleReady} />;
  }

  const inChat = conn.kind === "connecting" || conn.kind === "connected";
  const myPeerId =
    conn.kind === "connecting" || conn.kind === "connected"
      ? conn.peerId
      : null;
  const sidePanel = inChat ? CHAT_PANEL_W : WHISPER_PANEL_W;

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#080808]">
      <div
        className="absolute inset-y-0 left-0 transition-[right] duration-200"
        style={{ right: sidePanel }}
      >
        <WorldMap
          peers={peers}
          me={myLocation}
          meMood={myMood}
          myPeerId={myPeerId}
          onPeerClick={requestConnection}
          canConnect={conn.kind === "idle"}
        />
      </div>

      <OnlineIndicator count={peers.length} />

      {!inChat && (
        <WhisperFeed
          whispers={whispers}
          me={myLocation}
          onSend={handleWhisper}
        />
      )}

      {notice && (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 border border-[#1f1f1f] bg-[#111111]/85 px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-[#5a5a5a] backdrop-blur-md">
          {notice}
        </div>
      )}

      {conn.kind === "requesting" && (
        <div className="absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-4 border border-[#1f1f1f] bg-[#111111]/85 px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-[#5a5a5a] backdrop-blur-md">
          <span className="blink-cursor">REQUESTING CONNECTION</span>
          <button
            onClick={cancelRequest}
            className="border border-[#2a2a2a] px-3 py-1 text-[10px] uppercase tracking-[0.06em] text-[#5a5a5a] transition-colors hover:border-[#f0f0f0] hover:text-[#f0f0f0]"
          >
            Cancel
          </button>
        </div>
      )}

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          title="A stranger wants to connect"
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {inChat && (
        <ChatPanel
          messages={messages}
          connected={conn.kind === "connected"}
          videoBusy={video !== "none"}
          peerMood={
            conn.kind === "connecting" || conn.kind === "connected"
              ? conn.peerMood
              : null
          }
          onSend={(text) => {
            peerRef.current?.sendChat(text);
            addMessage(true, text);
          }}
          onStartVideo={startVideoRequest}
          onEnd={endConnection}
        />
      )}

      {video === "requesting" && (
        <div className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 border border-[#1f1f1f] bg-[#111111]/85 px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-[#5a5a5a] backdrop-blur-md">
          WAITING FOR STRANGER TO ACCEPT VIDEO
        </div>
      )}

      {video === "incoming" && (
        <ConnectionPrompt
          title="Start video call?"
          subtitle="The stranger wants to turn on video."
          acceptLabel="Accept"
          declineLabel="Decline"
          onAccept={acceptVideo}
          onDecline={declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={localStream}
          remoteStream={remoteStream}
          onEnd={endVideo}
        />
      )}
    </main>
  );
}
