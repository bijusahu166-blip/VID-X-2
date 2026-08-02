import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, Play, Pause, RotateCcw, Music, Maximize2, Minimize2, WifiOff, Loader2 } from "lucide-react";
import { useVideoSettings } from "@/contexts/VideoSettingsContext";
import Hls from "hls.js";
import { toCloudinaryVideoUrl } from "@/lib/utils";
import { precacheVideo } from "@/lib/videoPrecache";

// ── Global single-video coordinator ─────────────────────────────────────────
// Only ONE video across the entire page is allowed to play at a time.
// Any VideoPlayer that wants to play first calls claimPlayback().
// claimPlayback() pauses the currently-playing video and returns a token;
// the caller keeps playing only while that token is still "active".
let activeVideoEl: HTMLVideoElement | null = null;
let activeToken = 0;

function claimPlayback(video: HTMLVideoElement): number {
  if (activeVideoEl && activeVideoEl !== video) {
    try { activeVideoEl.pause(); } catch {}
  }
  activeVideoEl = video;
  activeToken = Date.now() + Math.random(); // unique token per claim
  return activeToken;
}

function isTokenActive(token: number): boolean {
  return token === activeToken;
}

function releaseIfActive(video: HTMLVideoElement) {
  if (activeVideoEl === video) {
    activeVideoEl = null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Global mute preference (persists across ALL videos, all pages) ─────────
let globalMuted = true;
try {
  const saved = localStorage.getItem("videoMuted");
  if (saved !== null) globalMuted = saved === "true";
} catch {}

function setGlobalMuted(value: boolean) {
  globalMuted = value;
  try { localStorage.setItem("videoMuted", String(value)); } catch {}
}
// ─────────────────────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  src: string;
  /** URL of the NEXT video to silently pre-cache while this one plays */
  precacheSrc?: string | null;
  poster?: string;
  loop?: boolean;
  className?: string;
  songTitle?: string;
  songArtist?: string;
  songColor?: string;
  showControls?: boolean;
  onVisible?: () => void;
}

export function VideoPlayer({
  src: rawSrc,
  precacheSrc,
  poster,
  loop = true,
  className = "",
  songTitle,
  songArtist,
  songColor,
  showControls = true,
  onVisible,
}: VideoPlayerProps) {
  // Apply Cloudinary f_auto + q_auto to every Cloudinary URL automatically.
  // Non-Cloudinary URLs (local /uploads, external) pass through untouched.
  const src = toCloudinaryVideoUrl(rawSrc);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastTap = useRef(0);
  const playRequestRef = useRef(0);
  const [muted, setMuted] = useState(globalMuted);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tapped, setTapped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // firstFrame: false until the browser can render the first video frame.
  // The shimmer overlay is shown while this is false so there's no black flash.
  const [firstFrame, setFirstFrame] = useState(false);

  const { dataSaver, quality } = useVideoSettings();

  // ── HLS.js setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Tear down any existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = src.includes(".m3u8");
    if (!isHls) {
      video.src = src;
      video.load();
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1, // auto
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data.fatal) {
          console.warn("[hls.js] fatal error", data.type, data.details);
          hls.destroy();
          hlsRef.current = null;
          video.src = src;
          video.load();
        }
      });
      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.load();
    } else {
      video.src = src;
      video.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);
  // ────────────────────────────────────────────────────────────────────────────

  // preload="none" unless actively playing — prevents background bandwidth drain
  const preloadAttr = "none";

  // Smart play: claim global slot → wait for canplay → play
  const playWhenReady = useCallback((video: HTMLVideoElement) => {
    const token = claimPlayback(video);
    const reqId = ++playRequestRef.current;

    const doPlay = () => {
      if (playRequestRef.current !== reqId) return;
      if (!isTokenActive(token)) return;
      video.play()
        .then(() => { setPlaying(true); setBuffering(false); })
        .catch(() => { setPlaying(false); setBuffering(false); });
    };

    if (video.readyState >= 3) {
      doPlay();
    } else {
      setBuffering(true);
      if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        doPlay();
      };
      video.addEventListener("canplay", onCanPlay);
    }
  }, []);

  // Hard-stop helper — pauses, resets, and releases the global slot.
  // Used whenever a video scrolls out of view or unmounts, so audio/video
  // can NEVER keep playing in the background.
  const hardStop = useCallback((video: HTMLVideoElement) => {
    ++playRequestRef.current;
    try { video.pause(); } catch {}
    releaseIfActive(video);
    if (hlsRef.current) hlsRef.current.stopLoad();
    setPlaying(false);
    setBuffering(false);
  }, []);

  // IntersectionObserver: auto-play when ≥50% visible, hard-stop otherwise
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (dataSaver || quality === "low") {
      hardStop(video);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (hlsRef.current) hlsRef.current.startLoad(-1);
          playWhenReady(video);
          onVisible?.();
          if (precacheSrc) precacheVideo(precacheSrc);
        } else {
          hardStop(video);
        }
      },
      { threshold: [0, 0.5] }
    );

    observer.observe(video);

    // Also stop playback the moment the tab is hidden / backgrounded
    const onVisibilityChange = () => {
      if (document.hidden) hardStop(video);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Component is unmounting (route change, list item removed, etc.)
      // Guarantee playback stops — this is what prevents "video keeps
      // playing in the background" after navigating away.
      hardStop(video);
    };
  }, [src, dataSaver, quality, playWhenReady, hardStop, onVisible, precacheSrc]);

  // Buffering/waiting events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setPlaying(true); setBuffering(false); };
    const onSeeking = () => setBuffering(true);
    const onSeeked  = () => setBuffering(false);
    const onPause   = () => setPlaying(false);
    video.addEventListener("waiting",  onWaiting);
    video.addEventListener("playing",  onPlaying);
    video.addEventListener("seeking",  onSeeking);
    video.addEventListener("seeked",   onSeeked);
    video.addEventListener("pause",    onPause);
    return () => {
      video.removeEventListener("waiting",  onWaiting);
      video.removeEventListener("playing",  onPlaying);
      video.removeEventListener("seeking",  onSeeking);
      video.removeEventListener("seeked",   onSeeked);
      video.removeEventListener("pause",    onPause);
    };
  }, []);

  // Track progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      if (video.duration) setProgress(video.currentTime / video.duration);
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, []);

  // Fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Shimmer: disappears as soon as the browser can paint the first video frame
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onCanPlay = () => setFirstFrame(true);
    video.addEventListener("canplay", onCanPlay);
    if (video.readyState >= 3) setFirstFrame(true);
    return () => video.removeEventListener("canplay", onCanPlay);
  }, [src]);

  // Reset on src change
  useEffect(() => {
    setLoaded(false);
    setPlaying(false);
    setBuffering(false);
    setProgress(0);
    setFirstFrame(false);
    ++playRequestRef.current;
  }, [src]);

  // Keep the <video> element's muted flag in sync with the latest global
  // preference (covers the case where another VideoPlayer changed it after
  // this one already mounted).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !muted;
    video.muted = newMuted;
    setMuted(newMuted);
    setGlobalMuted(newMuted);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    // Data-saver: first tap loads the video
    if ((dataSaver || quality === "low") && !loaded) {
      setLoaded(true);
      onVisible?.();
      playWhenReady(video);
      return;
    }

    // Double-tap → fullscreen
    const now = Date.now();
    if (now - lastTap.current < 300) {
      toggleFullscreen(e);
      return;
    }
    lastTap.current = now;

    if (playing && !buffering) {
      hardStop(video);
    } else if (!playing) {
      playWhenReady(video);
    }
    setTapped(true);
    setTimeout(() => setTapped(false), 600);
  };

  const replay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    playWhenReady(video);
  };

  const qualityLabel =
    dataSaver ? "DS" : quality === "high" ? "HD" : quality === "medium" ? "SD" : quality === "low" ? "LQ" : null;

  const showDataSaverOverlay = (dataSaver || quality === "low") && !loaded;

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-black ${className}`} data-testid="video-player">
      <video
        ref={videoRef}
        poster={poster}
        loop={loop}
        muted={muted}
        playsInline
        preload={preloadAttr}
        className="w-full h-full object-cover"
        data-testid="video-element"
      />

      {/* Loading shimmer — visible until the first video frame is ready. */}
      {!firstFrame && !showDataSaverOverlay && (
        <div className="video-shimmer" aria-hidden="true">
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-white/8 border border-white/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/30 fill-current ml-0.5">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && !showDataSaverOverlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Data Saver tap-to-load overlay */}
      {showDataSaverOverlay && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer z-10"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-3">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
            <WifiOff className="w-3 h-3 text-emerald-400" />
            <span className="text-[11px] text-emerald-300 font-semibold">
              {dataSaver ? "Data Saver — Tap to load" : "Low quality — Tap to load"}
            </span>
          </div>
        </div>
      )}

      {/* Tap-to-play/pause overlay */}
      <div className="absolute inset-0" onClick={togglePlay}>
        {tapped && !showDataSaverOverlay && !buffering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center animate-ping">
              {playing ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white" />}
            </div>
          </div>
        )}
      </div>

      {showControls && (
        <>
          {qualityLabel && (
            <div className="absolute top-2.5 left-2.5 z-20 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur border border-white/10">
              <span className="text-[10px] font-bold text-white/80 tracking-wider">{qualityLabel}</span>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
            data-testid="button-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>

          <button
            onClick={toggleMute}
            className="absolute bottom-14 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
            data-testid="button-mute-toggle"
          >
            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>

          {progress > 0.95 && !loop && (
            <button
              onClick={replay}
              className="absolute bottom-14 left-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
              data-testid="button-replay"
            >
              <RotateCcw className="w-4 h-4 text-white" />
            </button>
          )}

          <div
            className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 z-20 cursor-pointer group/progress"
            onClick={(e) => {
              e.stopPropagation();
              const video = videoRef.current;
              if (!video || !video.duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              video.currentTime = percent * video.duration;
            }}
          >
            <div className="absolute inset-x-0 -top-2 -bottom-2" />
            <div
              className="h-full relative transition-all duration-150"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, #ec4899, #a855f7, #f97316)",
                boxShadow: "0 0 8px rgba(236,72,153,0.6)",
              }}
            >
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
                style={{
                  background: "#fff",
                  boxShadow: "0 0 6px 2px rgba(236,72,153,0.8)",
                }}
              />
            </div>
          </div>

          {songTitle && (
            <div className="absolute bottom-4 left-2.5 right-12 z-20 pointer-events-none">
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: songColor ? `${songColor}33` : "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(8px)",
                  border: `1px solid ${songColor ? songColor + "44" : "rgba(255,255,255,0.12)"}`,
                }}
              >
                <Music className="w-2.5 h-2.5 text-white/80 shrink-0 animate-spin" style={{ animationDuration: "3s" }} />
                <span className="text-[10px] text-white font-semibold truncate max-w-[120px]">{songTitle}</span>
                {songArtist && <span className="text-[9px] text-white/60 truncate max-w-[80px]">· {songArtist}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}