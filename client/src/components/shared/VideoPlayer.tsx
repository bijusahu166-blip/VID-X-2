import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX, Play, Pause, RotateCcw, Music, Maximize2, Minimize2, WifiOff, Loader2 } from "lucide-react";
import { useVideoSettings } from "@/contexts/VideoSettingsContext";

interface VideoPlayerProps {
  src: string;
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
  src,
  poster,
  loop = true,
  className = "",
  songTitle,
  songArtist,
  songColor,
  showControls = true,
  onVisible,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTap = useRef(0);
  const playRequestRef = useRef(0);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tapped, setTapped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(false); // data-saver: user tapped to load

  const { dataSaver, quality } = useVideoSettings();

  const preloadAttr = dataSaver || quality === "low"
    ? "none"
    : quality === "high" ? "auto" : "metadata";

  // Smart play: wait for canplay if not enough data buffered
  const playWhenReady = useCallback((video: HTMLVideoElement) => {
    const reqId = ++playRequestRef.current;

    const doPlay = () => {
      if (playRequestRef.current !== reqId) return;
      video.play()
        .then(() => { setPlaying(true); setBuffering(false); })
        .catch(() => { setPlaying(false); setBuffering(false); });
    };

    if (video.readyState >= 3) {
      doPlay();
    } else {
      setBuffering(true);
      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        doPlay();
      };
      video.addEventListener("canplay", onCanPlay);
      if (video.preload === "none" || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        video.load();
      }
    }
  }, []);

  // IntersectionObserver: auto-play when ≥50% visible, pause otherwise
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (dataSaver || quality === "low") {
      ++playRequestRef.current;
      video.pause();
      setPlaying(false);
      setBuffering(false);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            playWhenReady(video);
            onVisible?.();
          } else {
            ++playRequestRef.current;
            video.pause();
            setPlaying(false);
            setBuffering(false);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => {
      observer.disconnect();
      ++playRequestRef.current;
    };
  }, [src, dataSaver, quality, playWhenReady, onVisible]);

  // Buffering/waiting events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => { setPlaying(true); setBuffering(false); };
    const onSeeking = () => setBuffering(true);
    const onSeeked  = () => setBuffering(false);
    video.addEventListener("waiting",  onWaiting);
    video.addEventListener("playing",  onPlaying);
    video.addEventListener("seeking",  onSeeking);
    video.addEventListener("seeked",   onSeeked);
    return () => {
      video.removeEventListener("waiting",  onWaiting);
      video.removeEventListener("playing",  onPlaying);
      video.removeEventListener("seeking",  onSeeking);
      video.removeEventListener("seeked",   onSeeked);
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

  // Reset on src change
  useEffect(() => {
    setLoaded(false);
    setPlaying(false);
    setBuffering(false);
    setProgress(0);
    ++playRequestRef.current;
  }, [src]);

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
    video.muted = !muted;
    setMuted(!muted);
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
      ++playRequestRef.current;
      video.pause();
      setPlaying(false);
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
        src={src}
        poster={poster}
        loop={loop}
        muted={muted}
        playsInline
        preload={preloadAttr}
        className="w-full h-full object-cover"
        onPlay={() => { setPlaying(true); setBuffering(false); }}
        onPause={() => setPlaying(false)}
        data-testid="video-element"
      />

      {/* Buffering spinner — shown while waiting for data */}
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
          {/* Quality badge */}
          {qualityLabel && (
            <div className="absolute top-2.5 left-2.5 z-20 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur border border-white/10">
              <span className="text-[10px] font-bold text-white/80 tracking-wider">{qualityLabel}</span>
            </div>
          )}

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
            data-testid="button-fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>

          {/* Mute/Unmute */}
          <button
            onClick={toggleMute}
            className="absolute bottom-14 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
            data-testid="button-mute-toggle"
          >
            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>

          {/* Replay button */}
          {progress > 0.95 && !loop && (
            <button
              onClick={replay}
              className="absolute bottom-14 left-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
              data-testid="button-replay"
            >
              <RotateCcw className="w-4 h-4 text-white" />
            </button>
          )}

          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-20">
            <div
              className="h-full bg-white/70 transition-all duration-200"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Song info pill */}
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
