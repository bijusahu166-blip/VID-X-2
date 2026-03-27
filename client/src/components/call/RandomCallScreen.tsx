import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, RotateCcw,
  Sparkles, X, ChevronUp, Signal, Maximize2
} from "lucide-react";
import { AR_EFFECTS, EFFECT_CATEGORIES } from "@/lib/arEffects";
import type { AREffect } from "@/lib/arEffects";
import filterIconSrc from "@assets/image_1774511462472.png";
import heroIconSrc from "@assets/image_1774512160722.png";

interface RandomCallScreenProps {
  onClose: () => void;
}

export function RandomCallScreen({ onClose }: RandomCallScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [selectedEffect, setSelectedEffect] = useState<AREffect>(AR_EFFECTS[0]);
  const [showEffects, setShowEffects] = useState(false);
  const [activeEffectTab, setActiveEffectTab] = useState("All");
  const [isPiPExpanded, setIsPiPExpanded] = useState(false);
  const [searching, setSearching] = useState(true);
  const [duration, setDuration] = useState(0);

  const visibleEffects = AR_EFFECTS.filter(e =>
    (EFFECT_CATEGORIES.find(c => c.label === activeEffectTab)?.ids ?? AR_EFFECTS.map(x => x.id)).includes(e.id)
  );

  const startCamera = async (facingMode: "user" | "environment" = "user") => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraError(false);
    } catch {
      setCameraError(true);
    }
  };

  useEffect(() => {
    startCamera("user");
    const searchTimer = setTimeout(() => setSearching(false), 3000);
    return () => {
      clearTimeout(searchTimer);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (searching) return;
    const interval = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(interval);
  }, [searching]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  };

  const toggleCamera = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOn(c => !c);
  };

  const flipCamera = async () => {
    const newFacing = isFrontCamera ? "environment" : "user";
    setIsFrontCamera(!isFrontCamera);
    await startCamera(newFacing);
  };

  const activeEffect = selectedEffect;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col overflow-hidden">

      {/* Main background: animated searching / connected gradient */}
      <div className="absolute inset-0">
        {searching ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6"
            style={{ background: "linear-gradient(135deg, #0d0d1a, #1a0828, #0d0d1a)" }}>
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)", boxShadow: "0 0 60px rgba(168,85,247,0.5)" }}>
                <Video className="w-10 h-10 text-white" />
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="absolute inset-0 rounded-full border-2 border-purple-500/30"
                  style={{ animation: `ping 1.5s ease-out ${i * 0.4}s infinite`, transform: `scale(${1 + i * 0.35})` }} />
              ))}
            </div>
            <div className="text-center space-y-1">
              <p className="text-white text-2xl font-bold">Random Call</p>
              <p className="text-purple-300 text-sm">Finding someone...</p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-1 rounded-full bg-purple-400"
                  style={{ height: 8 + (i % 3) * 8, animation: `bounce 1s ease-in-out ${i * 0.15}s infinite alternate` }} />
              ))}
            </div>
          </div>
        ) : (
          /* Connected — show local camera as main feed (face-to-face preview) */
          <div className="w-full h-full relative overflow-hidden bg-black">
            {isCameraOn && !cameraError ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    transform: isFrontCamera ? "scaleX(-1)" : "none",
                    filter: activeEffect.filter,
                  }}
                />
                {activeEffect.overlay && (
                  <div className="absolute inset-0 pointer-events-none" style={{ background: activeEffect.overlay }} />
                )}
                <div className="absolute bottom-36 left-4 z-10">
                  <span className="text-white/60 text-xs font-semibold bg-black/40 px-2 py-0.5 rounded-full">You</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3"
                style={{ background: "linear-gradient(135deg, #0d0d1a, #1a0828, #0d0d1a)" }}>
                <VideoOff className="w-12 h-12 text-zinc-600" />
                <span className="text-zinc-400 text-sm">{cameraError ? "Camera unavailable" : "Camera off"}</span>
                {cameraError && (
                  <button onClick={() => startCamera("user")}
                    className="text-xs bg-purple-600/60 hover:bg-purple-600 text-white px-4 py-2 rounded-full transition-colors">
                    Allow Camera Access
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PiP — small self-view (only shown when not searching and camera is main) */}
      {!searching && (
        <div
          className={`absolute transition-all duration-300 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-pointer z-20 ${
            isPiPExpanded ? "top-16 right-3 w-44 h-72" : "top-16 right-3 w-28 h-44"
          }`}
          onClick={() => setIsPiPExpanded(p => !p)}
          style={{ background: "linear-gradient(135deg,#1a0d2e,#0d1a2e)", boxShadow: "0 0 20px rgba(0,0,0,0.6)" }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <span className="text-white font-black text-lg">?</span>
            </div>
            <span className="text-white text-[10px] font-bold">Random</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-[9px]">Live</span>
            </div>
          </div>
          <div className="absolute bottom-1 right-1">
            <Maximize2 className="w-3 h-3 text-white/40" />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="relative z-30 flex items-center justify-between px-4 pt-12 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
            <Signal className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-green-400 font-bold">HD</span>
          </div>
          {!searching && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-white font-mono">{formatDuration(duration)}</span>
            </div>
          )}
        </div>
        <button onClick={onClose}
          className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

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
                    activeEffectTab === cat.label ? "bg-purple-500 text-white" : "bg-white/10 text-white/60 hover:text-white"
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
                  className={`flex flex-col items-center gap-1.5 transition-all ${selectedEffect.id === effect.id ? "scale-110" : "scale-100 opacity-80"}`}>
                  <div className={`w-14 h-14 rounded-xl overflow-hidden relative border-2 ${
                    selectedEffect.id === effect.id ? "border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]" : "border-white/10"
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

      {/* Bottom controls */}
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
          <div className="flex items-center justify-around max-w-xs mx-auto">
            <button onClick={toggleMute} className="flex flex-col items-center gap-1.5">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted ? "bg-red-500/20 border-2 border-red-500/60" : "bg-white/10 border-2 border-white/20"
              }`}>
                {isMuted ? <MicOff className="w-6 h-6 text-red-400" /> : <Mic className="w-6 h-6 text-white" />}
              </div>
              <span className="text-[10px] text-white/60 font-semibold">{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            <button onClick={flipCamera} className="flex flex-col items-center gap-1.5">
              <div className="w-12 h-12 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] text-white/60 font-semibold">Flip</span>
            </button>

            <button onClick={onClose} className="flex flex-col items-center gap-1.5" data-testid="button-end-random-call">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:bg-red-600 active:scale-95 transition-all">
                <PhoneOff className="w-7 h-7 text-white" />
              </div>
              <span className="text-[10px] text-white/60 font-semibold">End</span>
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

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes bounce { from { transform: scaleY(0.5); } to { transform: scaleY(1.5); } }
      `}</style>
    </div>
  );
}
