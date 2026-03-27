import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Play, Pause, RotateCcw, Music, Maximize2, Minimize2 } from "lucide-react";

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
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tapped, setTapped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // IntersectionObserver: auto-play when ≥50% visible, pause otherwise
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            video.play().catch(() => {});
            setPlaying(true);
            onVisible?.();
          } else {
            video.pause();
            setPlaying(false);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

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

  // Track fullscreen state
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
    // Double-tap to fullscreen
    const now = Date.now();
    if (now - lastTap.current < 300) {
      toggleFullscreen(e);
      return;
    }
    lastTap.current = now;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().catch(() => {});
      setPlaying(true);
    }
    setTapped(true);
    setTimeout(() => setTapped(false), 600);
  };

  const replay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
    setPlaying(true);
  };

  return (
    <div ref={containerRef} className={`relative overflow-hidden bg-black ${className}`} data-testid="video-player">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        loop={loop}
        muted={muted}
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        data-testid="video-element"
      />

      {/* Tap to play/pause overlay */}
      <div className="absolute inset-0" onClick={togglePlay}>
        {/* Play/Pause icon flash */}
        {tapped && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center animate-ping">
              {playing ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white" />}
            </div>
          </div>
        )}
      </div>

      {showControls && (
        <>
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
            data-testid="button-fullscreen"
            title="Fullscreen (double-tap to toggle)"
          >
            {isFullscreen
              ? <Minimize2 className="w-4 h-4 text-white" />
              : <Maximize2 className="w-4 h-4 text-white" />
            }
          </button>

          {/* Mute/Unmute button */}
          <button
            onClick={toggleMute}
            className="absolute bottom-14 right-2.5 w-8 h-8 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
            data-testid="button-mute-toggle"
          >
            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>

          {/* Replay button (only shows when near end) */}
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
              className="h-full bg-white/70 transition-all duration-300"
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
