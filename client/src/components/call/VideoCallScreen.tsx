import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  RotateCcw, Volume2, VolumeX, Sparkles, X,
  Maximize2, ChevronUp, Signal, Monitor, CircleDot, Gauge
} from "lucide-react";
import { AR_EFFECTS, EFFECT_CATEGORIES } from "@/lib/arEffects";
import type { AREffect } from "@/lib/arEffects";
import filterIconSrc from "@assets/image_1774511462472.png";
import heroIconSrc from "@assets/image_1774512160722.png";

const MOCK_CALLERS = [
  { name: "Alice Wonder", handle: "@alice_litlink", avatar: "🧝‍♀️" },
  { name: "Bob Builder", handle: "@bob_litlink", avatar: "👨‍💻" },
];

interface VideoCallScreenProps {
  onClose: () => void;
}

export function VideoCallScreen({ onClose }: VideoCallScreenProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [selectedEffect, setSelectedEffect] = useState<AREffect>(AR_EFFECTS[0]);
  const [showEffects, setShowEffects] = useState(false);
  const [callState, setCallState] = useState<"connecting" | "ringing" | "active">("connecting");
  const [callDuration, setCallDuration] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isPiPExpanded, setIsPiPExpanded] = useState(false);
  const [activeEffectTab, setActiveEffectTab] = useState("All");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [lowDataMode, setLowDataMode] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const caller = MOCK_CALLERS[0];

  const visibleEffects = AR_EFFECTS.filter(e =>
    (EFFECT_CATEGORIES.find(c => c.label === activeEffectTab)?.ids ?? AR_EFFECTS.map(x => x.id)).includes(e.id)
  );

  // Start camera
  const startCamera = useCallback(async (facingMode: "user" | "environment" = "user") => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 3840, max: 3840 },
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCameraError(false);
    } catch {
      setCameraError(true);
    }
  }, []);

  useEffect(() => {
    startCamera("user");
    // Simulate connecting → ringing → active
    const t1 = setTimeout(() => setCallState("ringing"), 1200);
    const t2 = setTimeout(() => setCallState("active"), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [startCamera]);

  // Call timer
  useEffect(() => {
    if (callState !== "active") return;
    const interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggleMute = () => {
    setIsMuted(m => {
      const next = !m;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  };

  const toggleCamera = () => {
    setIsCameraOn(c => {
      const next = !c;
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = next; });
      return next;
    });
  };

  const flipCamera = () => {
    const next = !isFrontCamera;
    setIsFrontCamera(next);
    startCamera(next ? "user" : "environment");
  };

  const handleEndCall = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
      startCamera(isFrontCamera ? "user" : "environment");
    } else {
      try {
        const screen = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        screen.getVideoTracks()[0].onended = () => { setIsScreenSharing(false); startCamera("user"); };
        setIsScreenSharing(true);
      } catch { /* cancelled */ }
    }
  };

  const activeEffect = selectedEffect;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">

      {/* ── REMOTE VIDEO AREA (simulated) ── */}
      <div className="absolute inset-0">
        {callState === "active" ? (
          <div className="w-full h-full relative overflow-hidden">
            {/* Simulated remote background */}
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #0d0d1a 0%, #1a0d2e 30%, #0d1a2e 60%, #0a0a14 100%)",
              }}
            />
            {/* Animated depth particles */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full opacity-20"
                style={{
                  width: Math.random() * 4 + 1,
                  height: Math.random() * 4 + 1,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  background: i % 3 === 0 ? "#f472b6" : i % 3 === 1 ? "#818cf8" : "#34d399",
                  animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
            {/* Remote caller avatar */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="text-8xl animate-bounce" style={{ animationDuration: "3s" }}>
                  {caller.avatar}
                </div>
                <div className="text-white font-bold text-xl">{caller.name}</div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-sm font-medium">HD Connected</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6"
            style={{ background: "linear-gradient(135deg, #0d0d1a, #1a0828, #0d0d1a)" }}>
            <div className="relative">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center text-6xl"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #db2777)",
                  boxShadow: "0 0 60px rgba(168,85,247,0.5)",
                }}
              >
                {caller.avatar}
              </div>
              {/* Ripple rings */}
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-purple-500/30"
                  style={{
                    animation: `ping 1.5s ease-out ${i * 0.4}s infinite`,
                    transform: `scale(${1 + i * 0.35})`,
                  }}
                />
              ))}
            </div>
            <div className="text-center space-y-1">
              <p className="text-white text-2xl font-bold">{caller.name}</p>
              <p className="text-purple-300 text-sm">
                {callState === "connecting" ? "Connecting..." : "Ringing..."}
              </p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-purple-400"
                  style={{
                    height: 8 + (i % 3) * 8,
                    animation: `bounce 1s ease-in-out ${i * 0.15}s infinite alternate`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── LOCAL VIDEO (self view, PiP) ── */}
      <div
        className={`absolute transition-all duration-300 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-pointer z-20 ${
          isPiPExpanded ? "top-16 right-3 w-44 h-72" : "top-16 right-3 w-28 h-44"
        }`}
        onClick={() => setIsPiPExpanded(p => !p)}
        style={{ boxShadow: "0 0 20px rgba(0,0,0,0.6)" }}
      >
        {cameraError || !isCameraOn ? (
          <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-2">
            <VideoOff className="w-6 h-6 text-zinc-600" />
            <span className="text-[9px] text-zinc-600">{cameraError ? "No camera" : "Camera off"}</span>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{
                transform: isFrontCamera ? "scaleX(-1)" : "none",
                filter: activeEffect.filter,
              }}
            />
            {/* AR effect overlay */}
            {activeEffect.overlay && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: activeEffect.overlay }}
              />
            )}
            {/* Glitch animation overlay */}
            {activeEffect.animation === "glitch" && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0" style={{
                  background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,100,0.05) 2px, rgba(255,0,100,0.05) 4px)",
                  animation: "glitchScan 0.8s linear infinite",
                }} />
              </div>
            )}
            {/* Expand indicator */}
            <div className="absolute bottom-1 right-1">
              <Maximize2 className="w-3 h-3 text-white/60" />
            </div>
          </div>
        )}
      </div>

      {/* ── TOP BAR ── */}
      <div className="relative z-30 flex items-center justify-between px-4 pt-12 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
            <Signal className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-green-400 font-bold">{lowDataMode ? "Low Data" : "4K HD"}</span>
          </div>
          {callState === "active" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-white font-mono">{formatDuration(callDuration)}</span>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/30 backdrop-blur-sm border border-red-500/40">
              <CircleDot className="w-3 h-3 text-red-400 animate-pulse" />
              <span className="text-[10px] text-red-300 font-bold">REC</span>
            </div>
          )}
          {isScreenSharing && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/30 backdrop-blur-sm border border-blue-500/40">
              <Monitor className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-blue-300 font-bold">Screen</span>
            </div>
          )}
        </div>

        <button
          onClick={handleEndCall}
          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* ── ACTIVE EFFECT BADGE ── */}
      {activeEffect.id !== "none" && (
        <div className="relative z-30 flex justify-center mt-1">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/15">
            <span className="text-sm">{activeEffect.emoji}</span>
            <span className="text-[11px] text-white/80 font-semibold">{activeEffect.name}</span>
          </div>
        </div>
      )}

      {/* ── AR EFFECTS PANEL (slides up) ── */}
      <div
        className={`absolute bottom-36 left-0 right-0 z-40 transition-all duration-300 ${
          showEffects ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-3 rounded-2xl overflow-hidden"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-bold text-white">AR Effects</span>
              <span className="text-[10px] text-purple-400 font-semibold ml-0.5">{AR_EFFECTS.length} filters</span>
            </div>
            <button onClick={() => setShowEffects(false)} className="text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Category tabs */}
          <div className="px-3 pb-1 overflow-x-auto">
            <div className="flex gap-1.5 w-max">
              {EFFECT_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => setActiveEffectTab(cat.label)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
                    activeEffectTab === cat.label
                      ? "bg-purple-500 text-white"
                      : "bg-white/10 text-white/60 hover:text-white hover:bg-white/15"
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Filter grid */}
          <div className="px-3 pb-3 pt-1 overflow-x-auto">
            <div className="flex gap-3 w-max">
              {visibleEffects.map((effect) => (
                <button
                  key={effect.id}
                  onClick={() => { setSelectedEffect(effect); setShowEffects(false); }}
                  className={`flex flex-col items-center gap-1.5 transition-all ${
                    selectedEffect.id === effect.id ? "scale-110" : "scale-100 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-xl overflow-hidden relative border-2 transition-all ${
                      selectedEffect.id === effect.id
                        ? "border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]"
                        : "border-white/10"
                    }`}
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <img
                      src={effect.heroIcon ? heroIconSrc : filterIconSrc}
                      alt={effect.name}
                      className="w-full h-full object-cover"
                      style={{ filter: effect.filter !== "none" ? effect.filter : undefined }}
                    />
                    <div className="absolute bottom-0 right-0 w-5 h-5 rounded-tl-lg flex items-center justify-center text-[10px] bg-black/70">
                      {effect.emoji}
                    </div>
                    {selectedEffect.id === effect.id && (
                      <div className="absolute inset-0 ring-2 ring-purple-400 ring-inset rounded-xl pointer-events-none" />
                    )}
                  </div>
                  <span className="text-[9px] text-white/70 font-semibold text-center leading-tight max-w-[56px]">
                    {effect.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM CONTROLS ── */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        {/* AR effects toggle bar */}
        <div className="flex justify-center mb-3">
          <button
            onClick={() => setShowEffects(s => !s)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
              showEffects
                ? "bg-purple-500/30 border-purple-400/60 text-purple-300"
                : "bg-black/50 backdrop-blur-sm border-white/15 text-white/70 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-[12px] font-bold">
              {activeEffect.id !== "none" ? `${activeEffect.emoji} ${activeEffect.name}` : "AR Effects"}
            </span>
            <ChevronUp className={`w-3.5 h-3.5 transition-transform ${showEffects ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Main controls */}
        <div
          className="px-6 pb-10 pt-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)" }}
        >
          {/* Secondary controls row */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <button onClick={toggleScreenShare} className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isScreenSharing ? "bg-blue-500/30 border-blue-400/60" : "bg-white/10 border-white/15 hover:bg-white/20"}`}>
                <Monitor className={`w-4 h-4 ${isScreenSharing ? "text-blue-400" : "text-white"}`} />
              </div>
              <span className="text-[9px] text-white/50">{isScreenSharing ? "Stop Share" : "Share"}</span>
            </button>
            <button onClick={() => setIsRecording(r => !r)} className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${isRecording ? "bg-red-500/30 border-red-400/60" : "bg-white/10 border-white/15 hover:bg-white/20"}`}>
                <CircleDot className={`w-4 h-4 ${isRecording ? "text-red-400 animate-pulse" : "text-white"}`} />
              </div>
              <span className="text-[9px] text-white/50">{isRecording ? "Stop Rec" : "Record"}</span>
            </button>
            <button onClick={() => setLowDataMode(l => !l)} className="flex flex-col items-center gap-1">
              <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${lowDataMode ? "bg-amber-500/30 border-amber-400/60" : "bg-white/10 border-white/15 hover:bg-white/20"}`}>
                <Gauge className={`w-4 h-4 ${lowDataMode ? "text-amber-400" : "text-white"}`} />
              </div>
              <span className="text-[9px] text-white/50">{lowDataMode ? "Low Data" : "Data Saver"}</span>
            </button>
          </div>

          <div className="flex items-center justify-between max-w-xs mx-auto">
            {/* Mute */}
            <button
              onClick={toggleMute}
              className={`flex flex-col items-center gap-1.5 group`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted ? "bg-red-500/20 border-2 border-red-500/60" : "bg-white/10 border-2 border-white/20 hover:bg-white/20"
              }`}>
                {isMuted ? (
                  <MicOff className="w-6 h-6 text-red-400" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </div>
              <span className="text-[10px] text-white/60 font-semibold">{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            {/* Flip camera */}
            <button onClick={flipCamera} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center hover:bg-white/20 transition-all">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] text-white/60 font-semibold">Flip</span>
            </button>

            {/* End call */}
            <button onClick={handleEndCall} className="flex flex-col items-center gap-1.5">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:bg-red-600 transition-all active:scale-95">
                <PhoneOff className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] text-white/60 font-semibold">End</span>
            </button>

            {/* Camera on/off */}
            <button onClick={toggleCamera} className="flex flex-col items-center gap-1.5">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border ${
                !isCameraOn ? "bg-red-500/20 border-red-500/60" : "bg-white/10 border-white/15 hover:bg-white/20"
              }`}>
                {isCameraOn ? (
                  <Video className="w-5 h-5 text-white" />
                ) : (
                  <VideoOff className="w-5 h-5 text-red-400" />
                )}
              </div>
              <span className="text-[10px] text-white/60 font-semibold">Camera</span>
            </button>

            {/* Speaker */}
            <button onClick={() => setIsSpeakerOn(s => !s)} className="flex flex-col items-center gap-1.5">
              <div className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${
                !isSpeakerOn ? "bg-white/5 border-white/10" : "bg-white/10 border-white/15 hover:bg-white/20"
              }`}>
                {isSpeakerOn ? (
                  <Volume2 className="w-5 h-5 text-white" />
                ) : (
                  <VolumeX className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <span className="text-[10px] text-white/60 font-semibold">Speaker</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes glitchScan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes bounce {
          from { transform: scaleY(0.5); }
          to { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}
