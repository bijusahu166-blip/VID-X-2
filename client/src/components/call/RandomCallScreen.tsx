import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, RotateCcw,
  Sparkles, X, ChevronUp, Signal, Users, SkipForward
} from "lucide-react";
import { AR_EFFECTS, EFFECT_CATEGORIES } from "@/lib/arEffects";
import type { AREffect } from "@/lib/arEffects";
import { useAuth } from "@/hooks/use-auth";
import filterIconSrc from "@assets/image_1774511462472.png";
import heroIconSrc from "@assets/image_1774512160722.png";

interface RandomCallScreenProps {
  onClose: () => void;
}

type Phase = "connecting-ws" | "waiting" | "matching" | "active" | "ended";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function RandomCallScreen({ onClose }: RandomCallScreenProps) {
  const { user } = useAuth();
  const userId = (user as any)?.id ?? "";

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const partnerIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("connecting-ws");
  const [queueSize, setQueueSize] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState<AREffect>(AR_EFFECTS[0]);
  const [showEffects, setShowEffects] = useState(false);
  const [activeEffectTab, setActiveEffectTab] = useState("All");

  const visibleEffects = AR_EFFECTS.filter(e =>
    (EFFECT_CATEGORIES.find(c => c.label === activeEffectTab)?.ids ?? AR_EFFECTS.map(x => x.id)).includes(e.id)
  );

  // ── Start local camera ──────────────────────────────────────────────────────
  const startLocalCamera = useCallback(async (facingMode: "user" | "environment" = "user") => {
    try {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      return null;
    }
  }, []);

  // ── Create RTCPeerConnection ────────────────────────────────────────────────
  const createPC = useCallback((partnerId: string) => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ice-candidate", to: partnerId, candidate: e.candidate }));
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        if (!remoteVideoRef.current.srcObject) remoteVideoRef.current.srcObject = new MediaStream();
        (remoteVideoRef.current.srcObject as MediaStream).addTrack(e.track);
        setHasRemoteVideo(true);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        if (isMountedRef.current) setPhase("ended");
      }
    };

    return pc;
  }, []);

  // ── Send via WebSocket ──────────────────────────────────────────────────────
  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // ── Handle as caller (create offer) ────────────────────────────────────────
  const handleCallerRole = useCallback(async (partnerId: string) => {
    partnerIdRef.current = partnerId;
    const stream = await startLocalCamera();
    const pc = createPC(partnerId);
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Small delay so callee is ready
    setTimeout(() => {
      send({ type: "random-offer", to: partnerId, sdp: offer });
    }, 300);
  }, [startLocalCamera, createPC, send]);

  // ── Handle as callee (wait for offer, auto-accept) ─────────────────────────
  const handleCalleeRole = useCallback(async (partnerId: string) => {
    partnerIdRef.current = partnerId;
    await startLocalCamera();
    // PC will be created when offer arrives
  }, [startLocalCamera]);

  // ── Handle incoming signaling messages ─────────────────────────────────────
  const handleMessage = useCallback(async (raw: string) => {
    if (!isMountedRef.current) return;
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "random-call-waiting") {
      setQueueSize(msg.queueSize ?? 1);
      setPhase("waiting");
    }

    if (msg.type === "random-call-matched") {
      setPhase("matching");
      if (msg.role === "caller") {
        await handleCallerRole(msg.partnerId);
      } else {
        await handleCalleeRole(msg.partnerId);
      }
    }

    // Callee auto-accepts the offer
    if (msg.type === "random-offer") {
      const partnerId = partnerIdRef.current || msg.from;
      partnerIdRef.current = partnerId;
      const stream = localStreamRef.current || await startLocalCamera();
      const pc = createPC(partnerId!);
      if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream!));

      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "random-answer", to: partnerId, sdp: answer });
      if (isMountedRef.current) setPhase("active");
    }

    if (msg.type === "random-answer") {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(() => {});
        if (isMountedRef.current) setPhase("active");
      }
    }

    if (msg.type === "ice-candidate") {
      if (pcRef.current && msg.candidate) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
      }
    }

    if (msg.type === "random-call-end") {
      if (isMountedRef.current) setPhase("ended");
    }
  }, [handleCallerRole, handleCalleeRole, createPC, send, startLocalCamera]);

  const msgHandlerRef = useRef(handleMessage);
  msgHandlerRef.current = handleMessage;

  // ── Call duration timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "active") return;
    setCallDuration(0);
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Connect WebSocket & start camera, then join queue ──────────────────────
  useEffect(() => {
    isMountedRef.current = true;

    // Start camera immediately (non-blocking) for instant preview
    startLocalCamera();

    // Connect to existing WS signaling server
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Register (uses own channel on the shared WS server)
      ws.send(JSON.stringify({ type: "register", userId: `random_${userId}_${Date.now()}` }));
      // Wait a tick then join queue
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "random-call-join" }));
      }, 200);
    };

    ws.onmessage = (e) => { msgHandlerRef.current(e.data); };
    ws.onerror = () => setPhase("waiting");

    return () => {
      isMountedRef.current = false;
      ws.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOn(c => !c);
  };

  const flipCamera = async () => {
    const newFacing = isFrontCamera ? "environment" : "user";
    setIsFrontCamera(!isFrontCamera);
    const newStream = await startLocalCamera(newFacing);
    // Replace track in peer connection if active
    if (newStream && pcRef.current) {
      const videoTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
      if (sender && videoTrack) sender.replaceTrack(videoTrack).catch(() => {});
    }
  };

  const handleSkip = () => {
    // End current call and search again
    if (partnerIdRef.current) send({ type: "random-call-end", to: partnerIdRef.current });
    pcRef.current?.close();
    pcRef.current = null;
    setHasRemoteVideo(false);
    setCallDuration(0);
    partnerIdRef.current = null;
    setPhase("connecting-ws");
    // Re-join queue
    setTimeout(() => {
      send({ type: "random-call-join" });
    }, 300);
  };

  const handleClose = () => {
    if (partnerIdRef.current) send({ type: "random-call-end", to: partnerIdRef.current });
    send({ type: "random-call-leave" });
    onClose();
  };

  const activeEffect = selectedEffect;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">

      {/* ── REMOTE VIDEO (full screen when active) ── */}
      <div className="absolute inset-0">
        {phase === "active" && hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : phase === "active" ? (
          /* Connected but remote camera loading */
          <div className="w-full h-full flex flex-col items-center justify-center gap-3"
            style={{ background: "linear-gradient(135deg, #0d1a2e, #1a0d2e)" }}>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <span className="text-white text-2xl font-black">?</span>
            </div>
            <span className="text-white/70 text-sm">Connecting video...</span>
          </div>
        ) : phase === "ended" ? (
          /* Call ended */
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

            {/* Animated radar */}
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
                {phase === "matching" ? "Connecting..." : "Searching..."}
              </p>
              <p className="text-purple-300 text-sm">
                {phase === "matching"
                  ? "Found a match! Setting up video..."
                  : "Waiting for someone to connect"}
              </p>
              {phase === "waiting" && queueSize > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs">{queueSize} people searching</span>
                </div>
              )}
            </div>

            {/* Animated dots */}
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
      </div>

      {/* ── LOCAL VIDEO (PiP corner, always visible) ── */}
      {(phase === "active" || phase === "waiting" || phase === "matching") && (
        <div className={`absolute top-16 right-3 z-20 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl w-28 h-44`}
          style={{ boxShadow: "0 0 20px rgba(0,0,0,0.7)" }}>
          {isCameraOn ? (
            <div className="relative w-full h-full">
              <video
                ref={localVideoRef}
                autoPlay muted playsInline
                className="w-full h-full object-cover"
                style={{
                  transform: isFrontCamera ? "scaleX(-1)" : "none",
                  filter: activeEffect.filter,
                }}
              />
              {activeEffect.overlay && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: activeEffect.overlay }} />
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-zinc-500" />
            </div>
          )}
          {/* "You" label */}
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
                <span className="text-[12px] font-bold">{activeEffect.id !== "none" ? `${activeEffect.emoji} ${activeEffect.name}` : "AR Effects"}</span>
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
                  <div className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/20 transition-all">
                    <RotateCcw className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] text-white/60 font-semibold">Flip</span>
                </button>

                <button onClick={toggleCamera} className="flex flex-col items-center gap-1.5">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${
                    !isCameraOn ? "bg-red-500/20 border-red-500/60" : "bg-white/10 border-white/15"
                  }`}>
                    {isCameraOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-red-400" />}
                  </div>
                  <span className="text-[10px] text-white/60 font-semibold">Camera</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
}
