import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Heart, MessageCircle, Share2, Play, VolumeX, Volume2, Radio, Maximize2, Minimize2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVideoSettings } from "@/contexts/VideoSettingsContext";
import { toCloudinaryVideoUrl } from "@/lib/utils";
import { precacheVideo } from "@/lib/videoPrecache";

interface ReelPost {
  id: number;
  userId: string;
  imageUrl: string;
  caption: string | null;
  type: string | null;
  videoUrl: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; username?: string; profileImageUrl?: string };
  likesCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
}

function ReelCard({ reel, isActive, isNext, nextVideoUrl }: {
  reel: ReelPost;
  isActive: boolean;
  isNext: boolean;
  nextVideoUrl?: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTap = useRef(0);
  const playRequestRef = useRef(0); // tracks the latest play request to avoid race conditions
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [liked, setLiked] = useState(reel.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(reel.likesCount ?? 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const queryClient = useQueryClient();
  const { dataSaver, quality } = useVideoSettings();

  // Smart play: wait for canplay if not enough data buffered yet
  const playWhenReady = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const reqId = ++playRequestRef.current;

    const doPlay = () => {
      if (playRequestRef.current !== reqId) return; // stale request
      video.play()
        .then(() => { setIsPlaying(true); setIsBuffering(false); })
        .catch(() => { setIsPlaying(false); setIsBuffering(false); });
    };

    if (video.readyState >= 3) {
      // HAVE_FUTURE_DATA or better — can play immediately without lag
      doPlay();
    } else {
      setIsBuffering(true);
      const onCanPlay = () => {
        video.removeEventListener("canplay", onCanPlay);
        doPlay();
      };
      video.addEventListener("canplay", onCanPlay);
      // Kick off loading if preload="none" was set
      if (video.preload === "none" || video.networkState === 0) {
        video.load();
      }
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && !dataSaver) {
      playWhenReady();
      // As soon as this reel starts playing, silently pre-cache the next one
      // so the user sees zero buffering when they swipe up.
      if (nextVideoUrl) precacheVideo(nextVideoUrl);

      // Record a real view — once per browser session per post
      const viewKey = `viewed_post_${reel.id}`;
      if (!sessionStorage.getItem(viewKey)) {
        sessionStorage.setItem(viewKey, "1");
        fetch(`/api/posts/${reel.id}/view`, { method: "POST", credentials: "include" }).catch(() => {});
      }
    } else {
      ++playRequestRef.current; // cancel any pending play
      video.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    }

    return () => {
      ++playRequestRef.current; // cancel on unmount
    };
  }, [isActive, dataSaver, playWhenReady, nextVideoUrl, reel.id]);

  // Buffering events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onWaiting = () => { if (isActive) setIsBuffering(true); };
    const onPlaying = () => setIsBuffering(false);
    const onSeeking = () => { if (isActive) setIsBuffering(true); };
    const onSeeked  = () => setIsBuffering(false);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);
    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [isActive]);

  // Shimmer: listen for first renderable frame then hide the shimmer overlay
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onCanPlay = () => setFirstFrame(true);
    video.addEventListener("canplay", onCanPlay);
    if (video.readyState >= 3) setFirstFrame(true);
    return () => video.removeEventListener("canplay", onCanPlay);
  }, [reel.videoUrl]);

  // Reset first-frame flag each time this reel becomes active
  useEffect(() => {
    if (isActive) setFirstFrame(false);
  }, [isActive]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const card = cardRef.current;
    if (!card) return;
    if (!document.fullscreenElement) {
      card.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const togglePlay = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      toggleFullscreen();
      return;
    }
    lastTap.current = now;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      playWhenReady();
    } else {
      ++playRequestRef.current;
      video.pause();
      setIsPlaying(false);
    }
  };

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${reel.id}/like`, { method: "POST", credentials: "include" });
      return res.json();
    },
    onMutate: () => {
      setLiked(l => !l);
      setLikeCount(c => liked ? c - 1 : c + 1);
    },
    onSuccess: (data) => {
      setLiked(data.added);
      setLikeCount(data.likesCount);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const hasVideo = Boolean(reel.videoUrl);
  // Apply Cloudinary f_auto,q_auto to every reel video URL
  const videoSrc = reel.videoUrl ? toCloudinaryVideoUrl(reel.videoUrl) : null;

  // Preload strategy:
  //  active → "auto" (high quality) or "metadata" (adaptive)
  //  next   → "metadata" so the browser fetches headers + first frames
  //           ready to play the instant the user swipes up
  //  others → "none" — don't waste bandwidth on off-screen reels
  const preloadAttr = isActive
    ? (quality === "high" ? "auto" : "metadata")
    : isNext
    ? "metadata"
    : "none";

  return (
    <div ref={cardRef} className="snap-start h-full w-full relative bg-black flex items-center justify-center overflow-hidden">
      {hasVideo ? (
        <video
          ref={videoRef}
          src={videoSrc!}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          preload={preloadAttr}
          onClick={togglePlay}
          data-testid={`video-reel-${reel.id}`}
        />
      ) : (
        <img
          src={reel.imageUrl}
          alt="reel"
          className="absolute inset-0 w-full h-full object-cover"
          onClick={togglePlay}
        />
      )}

      {/* Loading shimmer — shown while the first HLS segment is being fetched */}
      {hasVideo && isActive && !firstFrame && (
        <div className="video-shimmer" aria-hidden="true">
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-white/8 border border-white/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white/30 fill-current ml-0.5">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Buffering spinner — shows while video is loading/buffering */}
      {isBuffering && hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          </div>
        </div>
      )}

      {/* Play icon when paused (and not buffering) */}
      {!isPlaying && !isBuffering && hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Data Saver overlay */}
      {dataSaver && hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-10" onClick={togglePlay}>
          <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-3">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
          <p className="text-xs text-emerald-300 font-semibold">Data Saver — Tap to play</p>
        </div>
      )}

      {/* LIVE badge */}
      {reel.type === "live" && (
        <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-black px-2 py-1 rounded-full">
          <Radio className="w-3 h-3 animate-pulse" />
          LIVE
        </div>
      )}

      {/* Fullscreen — top-right corner */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center z-20 border border-white/10"
        data-testid={`button-fullscreen-${reel.id}`}
        title="Fullscreen (or double-tap)"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
      </button>

      {/* Sound control — vertically centered right side for easy thumb reach */}
      <button
        onClick={() => setIsMuted(m => !m)}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/60 backdrop-blur flex items-center justify-center z-20 border border-white/15 shadow-lg"
        data-testid={`button-mute-${reel.id}`}
      >
        {isMuted
          ? <VolumeX className="w-5 h-5 text-white" />
          : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {/* Right action bar — bottom offset uses --bottom-nav-h so it never overlaps the nav */}
      <div className="absolute right-4 flex flex-col gap-5 items-center" style={{ bottom: 'var(--bottom-nav-h)' }}>
        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
            {reel.user?.profileImageUrl ? (
              <img src={reel.user.profileImageUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                {reel.user?.firstName?.[0] ?? "?"}
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border border-black">
            <span className="text-white text-[8px] font-black">+</span>
          </div>
        </div>

        {/* Like */}
        <button
          onClick={() => likeMutation.mutate()}
          className="flex flex-col items-center gap-1"
          data-testid={`button-like-${reel.id}`}
        >
          <Heart className={`w-7 h-7 transition-colors ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          <span className="text-xs text-white font-medium">{likeCount > 999 ? `${(likeCount/1000).toFixed(1)}k` : likeCount}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1" data-testid={`button-comment-${reel.id}`}>
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-xs text-white font-medium">{reel.commentsCount ?? 0}</span>
        </button>

        {/* Share */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={() => { navigator.share?.({ title: reel.caption ?? "Check this reel!", url: window.location.href }).catch(() => {}); }}
          data-testid={`button-share-${reel.id}`}
        >
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-xs text-white font-medium">Share</span>
        </button>
      </div>

      {/* Bottom info — same bottom offset as action bar */}
      <div className="absolute left-4 max-w-[65%]" style={{ bottom: 'var(--bottom-nav-h)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-white text-sm">@{reel.user?.username ?? reel.user?.firstName ?? "user"}</span>
        </div>
        {reel.caption && (
          <p className="text-white text-sm line-clamp-3 leading-relaxed">{reel.caption}</p>
        )}
        {!hasVideo && (
          <p className="text-yellow-400 text-xs mt-1 font-semibold">📹 No video file uploaded yet</p>
        )}
      </div>
    </div>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allPosts, isLoading } = useQuery<ReelPost[]>({
    queryKey: ["/api/posts"],
  });

  const reels = (allPosts ?? []).filter(p => p.type === "reel" || p.type === "video" || p.type === "live");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      setActiveIndex(index);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <Header />
      <div
        ref={containerRef}
        className="flex-1 relative snap-y snap-mandatory overflow-y-scroll no-scrollbar"
        style={{ scrollSnapType: "y mandatory", paddingTop: "var(--header-total)" }}
      >
        {isLoading && (
          <div className="snap-start h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}

        {!isLoading && reels.length === 0 && (
          <div className="snap-start h-full flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center">
              <Play className="w-10 h-10 text-zinc-600" />
            </div>
            <div className="text-center px-8">
              <p className="text-white font-bold text-lg mb-2">No Reels Yet</p>
              <p className="text-zinc-500 text-sm">Upload a reel or video using the + button to see it here.</p>
            </div>
          </div>
        )}

        {reels.map((reel, i) => (
          <ReelCard
            key={reel.id}
            reel={reel}
            isActive={i === activeIndex}
            isNext={i === activeIndex + 1}
            nextVideoUrl={reels[i + 1]?.videoUrl ?? null}
          />
        ))}
      </div>
      <div className="relative z-50">
        <BottomNav />
      </div>
    </div>
  );
}
