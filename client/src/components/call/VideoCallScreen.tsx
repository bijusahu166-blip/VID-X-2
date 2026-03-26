import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  RotateCcw, Volume2, VolumeX, Sparkles, X,
  Maximize2, ChevronUp, Zap, Signal
} from "lucide-react";

interface AR_Effect {
  id: string;
  name: string;
  emoji: string;
  filter: string;
  overlay?: string;
  animation?: string;
  category?: string;
}

const AR_EFFECTS: AR_Effect[] = [
  // ── BASE ──
  { id: "none",         name: "No Filter",    emoji: "🎥", filter: "none" },

  // ── 🔥 PREMIUM AR ──
  { id: "neon_glow",    name: "Neon Glow",    emoji: "⚡", filter: "saturate(3) brightness(1.1) hue-rotate(90deg) contrast(1.2)",         overlay: "radial-gradient(ellipse at center, rgba(0,255,128,0.1) 0%, transparent 70%)" },
  { id: "cyber_face",   name: "Cyber Face",   emoji: "🔵", filter: "hue-rotate(200deg) saturate(2.8) contrast(1.5) brightness(0.9)",       overlay: "linear-gradient(135deg, rgba(0,200,255,0.12) 0%, rgba(80,0,255,0.1) 100%)" },
  { id: "holo_vision",  name: "Holo Vision",  emoji: "🌐", filter: "hue-rotate(120deg) saturate(2.2) brightness(1.15) contrast(1.2)",      overlay: "linear-gradient(45deg, rgba(255,0,255,0.08) 0%, rgba(0,255,255,0.08) 50%, rgba(255,255,0,0.06) 100%)" },
  { id: "quantum_blur", name: "Quantum Blur", emoji: "🌀", filter: "blur(1.2px) brightness(1.2) saturate(1.8) hue-rotate(240deg)",         overlay: "radial-gradient(ellipse at center, rgba(120,0,255,0.15) 0%, transparent 70%)" },
  { id: "pixel_storm",  name: "Pixel Storm",  emoji: "🟣", filter: "contrast(2.2) saturate(3) hue-rotate(30deg) brightness(0.85)",         overlay: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,0,200,0.05) 3px, rgba(255,0,200,0.05) 6px)", animation: "glitch" },
  { id: "galaxy_aura",  name: "Galaxy Aura",  emoji: "🌌", filter: "brightness(0.8) contrast(1.4) saturate(2) hue-rotate(210deg)",         overlay: "radial-gradient(ellipse at center, rgba(60,0,120,0.3) 0%, rgba(0,0,40,0.4) 100%)" },
  { id: "infinity_light",name: "Infinity Light",emoji: "💫",filter: "brightness(1.5) contrast(0.9) saturate(1.5) hue-rotate(300deg)",      overlay: "radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, transparent 60%)" },
  { id: "prism_shift",  name: "Prism Shift",  emoji: "🌈", filter: "hue-rotate(60deg) saturate(2.5) contrast(1.3) brightness(1.05)",       overlay: "linear-gradient(135deg, rgba(255,0,0,0.06), rgba(0,255,0,0.06), rgba(0,0,255,0.06))" },
  { id: "aura_flame",   name: "Aura Flame",   emoji: "🔥", filter: "hue-rotate(350deg) saturate(2.5) contrast(1.3) brightness(1.05)",      overlay: "linear-gradient(to top, rgba(255,80,0,0.2) 0%, rgba(255,200,0,0.08) 60%, transparent 100%)" },
  { id: "dream_wave",   name: "Dream Wave",   emoji: "🌊", filter: "blur(0.6px) hue-rotate(180deg) saturate(2) brightness(1.1)",           overlay: "linear-gradient(to bottom, rgba(0,180,255,0.15) 0%, rgba(100,0,255,0.1) 100%)" },

  // ── 😎 FACE BEAUTY ──
  { id: "velvet_skin",  name: "Velvet Skin",  emoji: "🧴", filter: "blur(0.3px) brightness(1.1) saturate(1.3) hue-rotate(10deg)",          overlay: "radial-gradient(ellipse at center, rgba(255,200,180,0.12) 0%, transparent 70%)" },
  { id: "glowup_pro",   name: "GlowUp Pro",   emoji: "✨", filter: "brightness(1.25) saturate(1.6) contrast(0.95) hue-rotate(15deg)",       overlay: "radial-gradient(ellipse at top, rgba(255,230,180,0.2) 0%, transparent 60%)" },
  { id: "crystal_face", name: "Crystal Face", emoji: "💎", filter: "brightness(1.3) saturate(0.7) contrast(1.1) hue-rotate(190deg)",        overlay: "radial-gradient(ellipse at center, rgba(180,240,255,0.2) 0%, transparent 70%)" },
  { id: "soft_charm",   name: "Soft Charm",   emoji: "🌸", filter: "blur(0.4px) brightness(1.15) saturate(1.4) hue-rotate(330deg)",        overlay: "radial-gradient(ellipse at center, rgba(255,180,220,0.15) 0%, transparent 70%)" },
  { id: "insta_shine",  name: "Insta Shine",  emoji: "📸", filter: "brightness(1.35) contrast(0.9) saturate(1.5) hue-rotate(20deg)",       overlay: "radial-gradient(ellipse at top, rgba(255,255,220,0.2) 0%, transparent 50%)" },
  { id: "royal_look",   name: "Royal Look",   emoji: "👑", filter: "hue-rotate(260deg) saturate(1.8) brightness(1.1) contrast(1.15)",       overlay: "radial-gradient(ellipse at top, rgba(180,130,255,0.18) 0%, transparent 60%)" },
  { id: "smooth_magic", name: "Smooth Magic", emoji: "🪄", filter: "blur(0.35px) brightness(1.12) saturate(1.3) contrast(0.95)",            overlay: "radial-gradient(ellipse at center, rgba(255,220,200,0.12) 0%, transparent 70%)" },
  { id: "perfect_tone", name: "Perfect Tone", emoji: "🌟", filter: "brightness(1.1) saturate(1.4) contrast(1.05) hue-rotate(5deg)",         overlay: "radial-gradient(ellipse at top, rgba(255,230,190,0.14) 0%, transparent 60%)" },
  { id: "diamond_skin", name: "Diamond Skin", emoji: "💍", filter: "brightness(1.25) saturate(0.8) contrast(1.2) hue-rotate(200deg)",       overlay: "radial-gradient(ellipse at center, rgba(200,240,255,0.18) 0%, transparent 70%)" },
  { id: "angel_glow",   name: "Angel Glow",   emoji: "😇", filter: "brightness(1.4) contrast(0.85) saturate(0.9) blur(0.2px)",             overlay: "radial-gradient(ellipse at top, rgba(255,255,255,0.3) 0%, transparent 50%)" },

  // ── 🌈 FUN & CUTE ──
  { id: "bunny_ears",   name: "Bunny Ears",   emoji: "🐰", filter: "brightness(1.1) saturate(1.2) hue-rotate(340deg) contrast(1.05)",       overlay: "radial-gradient(ellipse at center, rgba(255,200,220,0.15) 0%, transparent 70%)" },
  { id: "puppy_love",   name: "Puppy Love",   emoji: "🐶", filter: "sepia(0.3) saturate(1.6) brightness(1.05) hue-rotate(20deg)",            overlay: "radial-gradient(ellipse at bottom, rgba(180,120,60,0.15) 0%, transparent 70%)" },
  { id: "cartoon_pop",  name: "Cartoon Pop",  emoji: "🎨", filter: "saturate(3.5) contrast(1.8) brightness(1.1)",                            overlay: "radial-gradient(ellipse at center, rgba(255,200,0,0.08) 0%, transparent 70%)" },
  { id: "emoji_blast",  name: "Emoji Blast",  emoji: "🎉", filter: "saturate(2.8) brightness(1.2) contrast(1.3) hue-rotate(45deg)",          overlay: "linear-gradient(135deg, rgba(255,0,128,0.1), rgba(0,255,128,0.08), rgba(128,0,255,0.08))" },
  { id: "candy_face",   name: "Candy Face",   emoji: "🍬", filter: "hue-rotate(300deg) saturate(2.5) brightness(1.2) contrast(1.1)",         overlay: "radial-gradient(ellipse at center, rgba(255,100,200,0.18) 0%, transparent 70%)" },
  { id: "baby_doll",    name: "Baby Doll",    emoji: "🍼", filter: "blur(0.3px) brightness(1.2) saturate(1.2) hue-rotate(340deg)",           overlay: "radial-gradient(ellipse at center, rgba(255,220,240,0.2) 0%, transparent 60%)" },
  { id: "funny_mirror", name: "Funny Mirror", emoji: "🪞", filter: "contrast(2) saturate(2.5) hue-rotate(90deg) brightness(1.15)",           overlay: "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,255,200,0.05) 4px, rgba(0,255,200,0.05) 8px)" },
  { id: "big_eyes",     name: "Big Eyes FX",  emoji: "👀", filter: "brightness(1.15) contrast(1.2) saturate(1.5) hue-rotate(5deg)",          overlay: "radial-gradient(ellipse at center, rgba(255,255,255,0.1) 0%, transparent 80%)" },
  { id: "smile_boost",  name: "Smile Boost",  emoji: "😁", filter: "brightness(1.25) saturate(1.7) hue-rotate(25deg) contrast(1.05)",        overlay: "radial-gradient(ellipse at center, rgba(255,220,100,0.18) 0%, transparent 70%)" },
  { id: "choco_mood",   name: "Choco Mood",   emoji: "🍫", filter: "sepia(0.7) contrast(1.2) brightness(0.9) saturate(1.1)",                 overlay: "radial-gradient(ellipse at bottom, rgba(80,40,10,0.25) 0%, transparent 70%)" },

  // ── 🚀 SCI-FI / FUTURE ──
  { id: "robo_mask",    name: "Robo Mask",    emoji: "🤖", filter: "grayscale(0.6) contrast(1.6) brightness(0.9) hue-rotate(180deg)",       overlay: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,200,0.06) 2px, rgba(0,255,200,0.06) 4px)" },
  { id: "ai_face",      name: "AI Face",      emoji: "🧠", filter: "hue-rotate(170deg) saturate(2.5) contrast(1.5) brightness(0.85)",       overlay: "linear-gradient(to bottom, rgba(0,255,180,0.15) 0%, rgba(0,100,255,0.1) 100%)" },
  { id: "laser_eyes",   name: "Laser Eyes",   emoji: "🔴", filter: "hue-rotate(0deg) saturate(3) contrast(2) brightness(0.8)",              overlay: "radial-gradient(ellipse at center, rgba(255,0,0,0.2) 0%, transparent 70%)" },
  { id: "space_helmet", name: "Space Helmet", emoji: "🪐", filter: "brightness(0.75) contrast(1.5) saturate(1.8) hue-rotate(210deg)",       overlay: "radial-gradient(ellipse at top, rgba(0,0,60,0.5) 0%, transparent 60%)" },
  { id: "digital_avatar",name:"Digital Avatar",emoji:"🖥️",filter: "hue-rotate(120deg) saturate(3) contrast(1.8) brightness(0.85)",          overlay: "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,255,80,0.04) 3px, rgba(0,255,80,0.04) 6px)" },
  { id: "matrix_mode",  name: "Matrix Mode",  emoji: "💻", filter: "grayscale(1) brightness(1.2) contrast(1.6) sepia(0.2)",                 overlay: "linear-gradient(to bottom, rgba(0,255,0,0.12) 0%, rgba(0,100,0,0.1) 100%)", animation: "glitch" },
  { id: "iron_face",    name: "Iron Face",    emoji: "🦾", filter: "grayscale(0.8) contrast(1.8) brightness(0.9) hue-rotate(200deg)",       overlay: "linear-gradient(135deg, rgba(100,150,200,0.15) 0%, rgba(50,80,120,0.1) 100%)" },
  { id: "cyberpunk_fx", name: "Cyberpunk FX", emoji: "⚙️", filter: "hue-rotate(250deg) saturate(3) contrast(1.6) brightness(0.88)",         overlay: "linear-gradient(135deg, rgba(200,0,255,0.14) 0%, rgba(0,200,255,0.1) 100%)", animation: "glitch" },
  { id: "neon_mask",    name: "Neon Mask",    emoji: "🎭", filter: "hue-rotate(310deg) saturate(3.5) contrast(1.4) brightness(1.0)",         overlay: "radial-gradient(ellipse at center, rgba(255,0,200,0.15) 0%, transparent 70%)" },
  { id: "tech_vision",  name: "Tech Vision",  emoji: "🔬", filter: "hue-rotate(190deg) saturate(2) contrast(1.4) brightness(1.05)",          overlay: "repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,200,255,0.05) 4px, rgba(0,200,255,0.05) 8px)" },

  // ── 🌿 NATURE / AESTHETIC ──
  { id: "sunset_glow",  name: "Sunset Glow",  emoji: "🌅", filter: "hue-rotate(340deg) saturate(2.2) brightness(1.1) contrast(1.15)",        overlay: "linear-gradient(to top, rgba(255,80,0,0.2) 0%, rgba(255,160,0,0.1) 50%, transparent 100%)" },
  { id: "golden_hour",  name: "Golden Hour",  emoji: "☀️", filter: "sepia(0.35) saturate(2.5) brightness(1.12) hue-rotate(15deg)",            overlay: "radial-gradient(ellipse at top, rgba(255,200,0,0.18) 0%, transparent 60%)" },
  { id: "rain_mood",    name: "Rain Mood",    emoji: "🌧️", filter: "hue-rotate(210deg) saturate(0.7) brightness(0.9) contrast(1.1)",          overlay: "repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(150,200,255,0.04) 6px, rgba(150,200,255,0.04) 7px)" },
  { id: "snow_magic",   name: "Snow Magic",   emoji: "❄️", filter: "brightness(1.3) saturate(0.5) contrast(1.05) hue-rotate(195deg)",         overlay: "radial-gradient(ellipse at top, rgba(220,240,255,0.3) 0%, transparent 60%)" },
  { id: "forest_dream", name: "Forest Dream", emoji: "🌲", filter: "hue-rotate(100deg) saturate(2) brightness(0.92) contrast(1.15)",           overlay: "radial-gradient(ellipse at center, rgba(0,120,30,0.15) 0%, transparent 70%)" },
  { id: "ocean_breeze", name: "Ocean Breeze", emoji: "🌊", filter: "hue-rotate(185deg) saturate(1.8) brightness(1.05) contrast(1.1)",          overlay: "linear-gradient(to bottom, rgba(0,180,220,0.15) 0%, rgba(0,80,180,0.12) 100%)" },
  { id: "flower_crown", name: "Flower Crown", emoji: "🌺", filter: "hue-rotate(330deg) saturate(2.2) brightness(1.1) contrast(1.05)",          overlay: "radial-gradient(ellipse at top, rgba(255,120,180,0.2) 0%, transparent 60%)" },
  { id: "sky_light",    name: "Sky Light",    emoji: "🌤️", filter: "hue-rotate(190deg) saturate(1.5) brightness(1.2) contrast(0.95)",          overlay: "linear-gradient(to bottom, rgba(130,200,255,0.2) 0%, transparent 50%)" },
  { id: "moon_shine",   name: "Moon Shine",   emoji: "🌙", filter: "grayscale(0.4) brightness(1.15) contrast(1.1) hue-rotate(210deg)",         overlay: "radial-gradient(ellipse at top, rgba(200,220,255,0.2) 0%, transparent 60%)" },
  { id: "vintage_vibe", name: "Vintage Vibe", emoji: "🎞️", filter: "sepia(0.65) contrast(1.2) brightness(0.92) saturate(0.85)",               overlay: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)" },

  // ── 💎 BONUS SUPER UNIQUE ──
  { id: "aurax",        name: "AuraX",        emoji: "🔮", filter: "hue-rotate(270deg) saturate(3) brightness(1.05) contrast(1.3)",            overlay: "radial-gradient(ellipse at center, rgba(160,0,255,0.2) 0%, transparent 70%)" },
  { id: "vibeshift",    name: "VibeShift",    emoji: "🎵", filter: "hue-rotate(135deg) saturate(2.8) contrast(1.2) brightness(1.08)",           overlay: "linear-gradient(45deg, rgba(255,0,128,0.1) 0%, rgba(0,200,255,0.1) 100%)" },
  { id: "glownova",     name: "GlowNova",     emoji: "💥", filter: "brightness(1.5) saturate(2.5) contrast(1.1) hue-rotate(30deg)",             overlay: "radial-gradient(ellipse at center, rgba(255,200,0,0.25) 0%, transparent 60%)" },
  { id: "facefusion",   name: "FaceFusion",   emoji: "🔀", filter: "hue-rotate(60deg) saturate(3) contrast(1.4) brightness(1.0)",              overlay: "linear-gradient(180deg, rgba(0,255,200,0.1) 0%, rgba(255,0,200,0.1) 100%)" },
  { id: "dreamify",     name: "Dreamify",     emoji: "💭", filter: "blur(0.7px) brightness(1.2) saturate(1.6) hue-rotate(320deg)",             overlay: "radial-gradient(ellipse at center, rgba(200,150,255,0.2) 0%, transparent 70%)" },
  { id: "luxlens",      name: "LuxLens",      emoji: "🏆", filter: "sepia(0.2) brightness(1.2) saturate(2) contrast(1.15) hue-rotate(20deg)",  overlay: "radial-gradient(ellipse at top, rgba(255,215,0,0.2) 0%, transparent 60%)" },
  { id: "pixelaura",    name: "PixelAura",    emoji: "🎮", filter: "contrast(2.5) saturate(3.5) brightness(0.95)",                             overlay: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.05) 2px, rgba(0,255,255,0.05) 4px)", animation: "glitch" },
  { id: "snapmagic",    name: "SnapMagic",    emoji: "📷", filter: "brightness(1.3) contrast(1.15) saturate(1.8) hue-rotate(10deg)",            overlay: "radial-gradient(ellipse at top, rgba(255,255,200,0.2) 0%, transparent 50%)" },
  { id: "neolook",      name: "NeoLook",      emoji: "🆕", filter: "hue-rotate(155deg) saturate(2.5) contrast(1.35) brightness(1.05)",          overlay: "linear-gradient(135deg, rgba(0,255,180,0.12) 0%, rgba(0,100,255,0.1) 100%)" },
  { id: "hyperface",    name: "HyperFace",    emoji: "🌀", filter: "saturate(4) contrast(2) brightness(1.05) hue-rotate(75deg)",               overlay: "radial-gradient(ellipse at center, rgba(255,0,255,0.15) 0%, transparent 70%)" },
];

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
  const [selectedEffect, setSelectedEffect] = useState<AR_Effect>(AR_EFFECTS[0]);
  const [showEffects, setShowEffects] = useState(false);
  const [callState, setCallState] = useState<"connecting" | "ringing" | "active">("connecting");
  const [callDuration, setCallDuration] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isPiPExpanded, setIsPiPExpanded] = useState(false);
  const [activeEffectTab, setActiveEffectTab] = useState("All");
  const caller = MOCK_CALLERS[0];

  const EFFECT_CATEGORIES = [
    { label: "All",     emoji: "🎥", ids: AR_EFFECTS.map(e => e.id) },
    { label: "Premium", emoji: "🔥", ids: ["none","neon_glow","cyber_face","holo_vision","quantum_blur","pixel_storm","galaxy_aura","infinity_light","prism_shift","aura_flame","dream_wave"] },
    { label: "Beauty",  emoji: "😎", ids: ["velvet_skin","glowup_pro","crystal_face","soft_charm","insta_shine","royal_look","smooth_magic","perfect_tone","diamond_skin","angel_glow"] },
    { label: "Fun",     emoji: "🌈", ids: ["bunny_ears","puppy_love","cartoon_pop","emoji_blast","candy_face","baby_doll","funny_mirror","big_eyes","smile_boost","choco_mood"] },
    { label: "Sci-Fi",  emoji: "🚀", ids: ["robo_mask","ai_face","laser_eyes","space_helmet","digital_avatar","matrix_mode","iron_face","cyberpunk_fx","neon_mask","tech_vision"] },
    { label: "Nature",  emoji: "🌿", ids: ["sunset_glow","golden_hour","rain_mood","snow_magic","forest_dream","ocean_breeze","flower_crown","sky_light","moon_shine","vintage_vibe"] },
    { label: "Bonus",   emoji: "💎", ids: ["aurax","vibeshift","glownova","facefusion","dreamify","luxlens","pixelaura","snapmagic","neolook","hyperface"] },
  ];

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
    onClose();
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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
            <Signal className="w-3 h-3 text-green-400" />
            <span className="text-[10px] text-green-400 font-bold">4K HD</span>
          </div>
          {callState === "active" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] text-white font-mono">{formatDuration(callDuration)}</span>
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
                    className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl border-2 transition-all ${
                      selectedEffect.id === effect.id
                        ? "border-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.6)]"
                        : "border-white/10"
                    }`}
                    style={{
                      background: selectedEffect.id === effect.id
                        ? "rgba(168,85,247,0.2)"
                        : "rgba(255,255,255,0.06)",
                    }}
                  >
                    {effect.emoji}
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
