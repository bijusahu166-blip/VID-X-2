import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, RotateCcw,
  Sparkles, X, ChevronUp, Signal, Users, SkipForward
} from "lucide-react";
import { AR_EFFECTS, EFFECT_CATEGORIES } from "@/lib/arEffects";
import type { AREffect } from "@/lib/arEffects";
import { useAuth } from "@/hooks/use-auth";
import { useAgoraRTCCall } from "@/lib/useAgoraRTCCall";
import filterIconSrc from "@assets/image_1774511462472.png";
import heroIconSrc from "@assets/image_1774512160722.png";

interface RandomCallScreenProps {
  onClose: () => void;
}

type Phase = "connecting-ws" | "waiting" | "matching" | "active" | "ended";

export function RandomCallScreen({ onClose }: RandomCallScreenProps) {
  const { user } = useAuth();
  const userId = (user as any)?.id ?? "";

  const wsRef = useRef<WebSocket | null>(null);
  const partnerIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("connecting-ws");
  const [queueSize, setQueueSize] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [selectedEffect, setSelectedEffect] = useState<AREffect>(AR_EFFECTS[0]);
  const [showEffects, setShowEffects] = useState(false);
  const [activeEffectTab, setActiveEffectTab] = useState("All");
  const [agoraChannel, setAgoraChannel] = useState<string>("");

  const localVideoId = "random-call-local";
  const remoteVideoId = "random-call-remote";

  // Agora RTC P2P call — activates when agoraChannel is set and phase is active/matching
  const { joined, hasRemote, setMuted: agoraSetMuted, setCameraOn: agoraSetCamera } = useAgoraRTCCall({
    channelName: agoraChannel,
    localVideoContainerId: localVideoId,
    remoteVideoContainerId: remoteVideoId,
    enabled: !!agoraChannel && (phase === "matching" || phase === "active"),
    facingMode: isFrontCamera ? "user" : "environment",
  });

  const visibleEffects = AR_EFFECTS.filter(e =>
    (EFFECT_CATEGORIES.find(c => c.label === activeEffectTab)?.ids ?? AR_EFFECTS.map(x => x.id)).includes(e.id)
  );

  // When Agora joins successfully, move to active phase
  useEffect(() => {
    if (joined && phase === "matching" && isMountedRef.current) {
      setPhase("active");
    }
  }, [joined, phase]);

  // When remote video arrives, we're truly active
  useEffect(() => {
    if (hasRemote && isMountedRef.current) {
      setPhase("active");
    }
  }, [hasRemote]);

  // Call duration timer
  useEffect(() => {
    if (phase !== "active") return;
    setCallDuration(0);
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Connect WebSocket for matchmaking
  useEffect(() => {
    isMountedRef.current = true;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "register", userId: `random_${userId}_${Date.now()}` }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "random-call-join" }));
        if (isMountedRef.current) setPhase("waiting");
      }, 200);
    };

    ws.onmessage = (e) => {
      if (!isMountedRef.current) return;
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === "random-call-waiting") {
          setQueueSize(msg.queueSize ?? 1);
          setPhase("waiting");
        }

        if (msg.type === "random-call-matched") {
          partnerIdRef.current = msg.partnerId;
          // Set the Agora channel — this triggers useAgoraRTCCall to join
          setAgoraChannel(msg.agoraChannel || `random_${[userId, msg.partnerId].sort().join("_")}`);
          setPhase("matching");
        }

        if (msg.type === "random-call-end") {
          setPhase("ended");
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      if (isMountedRef.current) setPhase("waiting");
    };

    return () => {
      isMountedRef.current = false;
      ws.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    agoraSetMuted(next);
  };

  const toggleCamera = () => {
    const next = !isCameraOn;
    setIsCameraOn(next);
    agoraSetCamera(next);
  };

  const flipCamera = () => {
    const next = !isFrontCamera;
    setIsFrontCamera(next);
    agoraSetCamera(true, next ? "user" : "environment");
  };

  const handleSkip = () => {
    if (partnerIdRef.current) send({ type: "random-call-end", to: partnerIdRef.current });
    partnerIdRef.current = null;
    setAgoraChannel("");
    setPhase("connecting-ws");
    setCallDuration(0);
    setTimeout(() => {
      send({ type: "random-call-join" });
      if (isMountedRef.current) setPhase("waiting");
    }, 600);
  };

  const handleClose = () => {
    if (partnerIdRef.current) send({ type: "random-call-end", to: partnerIdRef.current });
    send({ type: "random-call-leave" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">

      {/* ── REMOTE VIDEO (full screen, Agora injects video here) ── */}
      <div className="absolute inset-0">
        {(phase === "active" || phase === "matching") ? (
          <div
            id={remoteVideoId}
            className="absolute inset-0 w-full h-full bg-black"
            style={{ objectFit: "cover" }}
          />
        ) : phase === "ended" ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4"
            style={{ background: "linear-gradient(135deg, #0d0d1a, #1a0828)" }}>
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
              <PhoneOff className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-white text-xl font-bold">Call Ended</p>
            <p className="text-zinc-400 text-sm">Duration: {formatDuration(callDuration)}</p>
            <div className="flex gap-3 mt-2">
              <button onClick={handleSkip}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors">
                <SkipForward className="w-4 h-4" /> Find Next
              </button>
              <button onClick={handleClose}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-colors">
                <X className="w-4 h-4" /> Exit
              </button>
            </div>
          </div>
        ) : (
          /* Waiting / Matching */
          <div className="w-full h-full flex flex-col items-center justify-center gap-6"
            style={{ background: "linear-gradient(135deg, #0d0d1a, #1a0828, #0d0d1a)" }}>
            <div className="relative flex items-center justify-center">
              <div className="w-28 h-28 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", boxShadow: "0 0 60px rgba(168,85,247,0.5)" }}>
                <Users className="w-12 h-12 text-white" />
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="absolute rounded-full border-2 border-purple-500/25"
                  style={{
                    width: 28 * 4 * (1 + i * 0.4),
                    height: 28 * 4 * (1 + i * 0.4),
                    animation: `ping 2s ease-out ${i * 0.6}s infinite`,
                  }} />
              ))}
            </div>
            <div className="text-center space-y-2">
              <p className="text-white text-2xl font-bold">
                Searching...
              </p>
              <p className="text-purple-300 text-sm">
                Waiting for someone to connect
              </p>
              {phase === "waiting" && queueSize > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs">{queueSize} people searching</span>
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-purple-400"
                  style={{ animation: `bounce 0.8s ease-in-out ${i * 0.2}s infinite alternate` }} />
              ))}
            </div>
            <button onClick={handleClose}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white/60 hover:text-white text-sm transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        )}

        {/* Gradient overlay */}
        {(phase === "active" || phase === "matching") && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
        )}
      </div>

      {/* ── LOCAL VIDEO (PiP corner, Agora injects video here) ── */}
      {(phase === "active" || phase === "waiting" || phase === "matching") && (
        <div className="absolute top-16 right-3 z-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl w-28 h-44"
          style={{ boxShadow: "0 0 20px rgba(0,0,0,0.7)" }}>
          {isCameraOn ? (
            <div
              id={localVideoId}
              className="w-full h-full bg-zinc-900"
              style={{
                transform: isFrontCamera ? "scaleX(-1)" : "none",
                filter: selectedEffect.filter !== "none" ? selectedEffect.filter : undefined,
              }}
            />
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-zinc-500" />
            </div>
          )}
          {selectedEffect.overlay && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: selectedEffect.overlay }} />
          )}
          <div className="absolute bottom-1 left-1">
            <span className="text-white/60 text-[9px] font-bold bg-black/50 px-1.5 py-0.5 rounded-full">You</span>
          </div>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="relative z-30 flex items-center justify-between px-4 pt-12 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
            <Signal className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-green-400 font-bold">Random</span>
          </div>
          {phase === "active" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-white font-mono">{formatDuration(callDuration)}</span>
            </div>
          )}
        </div>
        <button onClick={handleClose}
          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* ── BOTTOM CONTROLS (only when active) ── */}
      {phase === "active" && (
        <>
          {/* AR Effects panel */}
          <div className={`absolute bottom-36 left-0 right-0 z-40 transition-all duration-300 ${
            showEffects ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
          }`}>
            <div className="mx-3 rounded-2xl overflow-hidden"
              style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-white">AR Effects</span>
                </div>
                <button onClick={() => setShowEffects(false)} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 pb-1 overflow-x-auto">
                <div className="flex gap-1.5 w-max">
                  {EFFECT_CATEGORIES.map(cat => (
                    <button key={cat.label} onClick={() => setActiveEffectTab(cat.label)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
                        activeEffectTab === cat.label ? "bg-purple-500 text-white" : "bg-white/10 text-white/60"
                      }`}>
                      <span>{cat.emoji}</span><span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 pb-3 pt-1 overflow-x-auto">
                <div className="flex gap-3 w-max">
                  {visibleEffects.map(effect => (
                    <button key={effect.id} onClick={() => { setSelectedEffect(effect); setShowEffects(false); }}
                      className={`flex flex-col items-center gap-1.5 transition-all ${selectedEffect.id === effect.id ? "scale-110" : "opacity-80"}`}>
                      <div className={`w-14 h-14 rounded-xl overflow-hidden relative border-2 ${
                        selectedEffect.id === effect.id ? "border-purple-400" : "border-white/10"
                      }`} style={{ background: "rgba(255,255,255,0.06)" }}>
                        <img src={effect.heroIcon ? heroIconSrc : filterIconSrc} alt={effect.name}
                          className="w-full h-full object-cover"
                          style={{ filter: effect.filter !== "none" ? effect.filter : undefined }} />
                        <div className="absolute bottom-0 right-0 w-5 h-5 rounded-tl-lg flex items-center justify-center text-[10px] bg-black/70">{effect.emoji}</div>
                      </div>
                      <span className="text-[9px] text-white/70 font-semibold text-center leading-tight max-w-[56px]">{effect.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 z-30">
            <div className="flex justify-center mb-3">
              <button onClick={() => setShowEffects(s => !s)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                  showEffects ? "bg-purple-500/30 border-purple-400/60 text-purple-300" : "bg-black/50 backdrop-blur-sm border-white/15 text-white/70"
                }`}>
                <Sparkles className="w-4 h-4" />
                <span className="text-[12px] font-bold">{selectedEffect.id !== "none" ? `${selectedEffect.emoji} ${selectedEffect.name}` : "AR Effects"}</span>
                <ChevronUp className={`w-3.5 h-3.5 transition-transform ${showEffects ? "rotate-180" : ""}`} />
              </button>
            </div>

            <div className="px-6 pb-10 pt-4"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)" }}>
              <div className="flex items-center justify-around max-w-sm mx-auto">

                <button onClick={toggleMute} className="flex flex-col items-center gap-1.5">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isMuted ? "bg-red-500/20 border-2 border-red-500/60" : "bg-white/10 border-2 border-white/20"
                  }`}>
                    {isMuted ? <MicOff className="w-6 h-6 text-red-400" /> : <Mic className="w-6 h-6 text-white" />}
                  </div>
                  <span className="text-[10px] text-white/60 font-semibold">{isMuted ? "Unmute" : "Mute"}</span>
                </button>

                <button onClick={handleSkip} className="flex flex-col items-center gap-1.5">
                  <div className="w-12 h-12 rounded-full bg-purple-600/30 border border-purple-400/50 flex items-center justify-center hover:bg-purple-600/50 transition-all">
                    <SkipForward className="w-5 h-5 text-purple-300" />
                  </div>
                  <span className="text-[10px] text-white/60 font-semibold">Next</span>
                </button>

                <button onClick={handleClose} className="flex flex-col items-center gap-1.5" data-testid="button-end-random-call">
                  <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:bg-red-600 active:scale-95 transition-all">
                    <PhoneOff className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-[10px] text-white/60 font-semibold">End</span>
                </button>

                <button onClick={flipCamera} className="flex flex-col items-center gap-1.5">
                  <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center hover:bg-white/20 transition-all">
                    <RotateCcw className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] text-white/60 font-semibold">Flip</span>
                </button>

                <button onClick={toggleCamera} className="flex flex-col items-center gap-1.5">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    !isCameraOn ? "bg-red-500/20 border-2 border-red-500/60" : "bg-white/10 border-2 border-white/20"
                  }`}>
                    {!isCameraOn ? <VideoOff className="w-6 h-6 text-red-400" /> : <Video className="w-6 h-6 text-white" />}
                  </div>
                  <span className="text-[10px] text-white/60 font-semibold">{!isCameraOn ? "Camera Off" : "Camera"}</span>
                </button>

              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

