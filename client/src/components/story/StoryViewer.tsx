import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Heart, Share2, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { playLike } from "@/lib/sounds";

interface Story {
  id: number;
  userId: string;
  user?: any;
  imageUrl?: string | null;
  videoUrl?: string | null;
  caption?: string | null;
  createdAt: string;
  hasLiked?: boolean;
  likesCount?: number;
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

const PHOTO_DURATION = 5000;

export function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const [idx, setIdx] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const [, navigate] = useLocation();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(Date.now());
  const accumulated = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const story = stories[idx];
  const hasPrev = idx > 0;
  const hasNext = idx < stories.length - 1;
  const isVideoStory = !!(story as any)?.videoUrl;

  const author = story?.user;
  const authorName = author ? `${author.firstName} ${author.lastName}` : "User";
  const authorAvatar = author?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.firstName || "user"}`;
  const timeAgo = story ? getTimeAgo(story.createdAt) : "";

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const goNext = useCallback(() => {
    if (hasNext) {
      accumulated.current = 0;
      startTime.current = Date.now();
      setProgress(0);
      setLiked(false);
      setIdx(i => i + 1);
    } else {
      onClose();
    }
  }, [hasNext, onClose]);

  const goPrev = useCallback(() => {
    if (hasPrev) {
      accumulated.current = 0;
      startTime.current = Date.now();
      setProgress(0);
      setLiked(false);
      setIdx(i => i - 1);
    }
  }, [hasPrev]);

  // Photo story: interval-based timer
  useEffect(() => {
    if (isVideoStory) return;

    accumulated.current = 0;
    startTime.current = Date.now();
    setProgress(0);

    const tick = () => {
      if (!paused) {
        const elapsed = accumulated.current + (Date.now() - startTime.current);
        const pct = Math.min((elapsed / PHOTO_DURATION) * 100, 100);
        setProgress(pct);
        if (pct >= 100) goNext();
      }
    };

    intervalRef.current = setInterval(tick, 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [idx, paused, goNext, isVideoStory]);

  // Video story: drive progress from <video> timeupdate
  const handleVideoTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const pct = Math.min((vid.currentTime / vid.duration) * 100, 100);
    setProgress(pct);
  };

  const handleVideoEnded = () => {
    goNext();
  };

  // Auto-play / pause video when paused state changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (paused) {
      vid.pause();
    } else {
      vid.play().catch(() => {});
    }
  }, [paused]);

  // Reset video on story change
  useEffect(() => {
    setProgress(0);
    const vid = videoRef.current;
    if (vid) {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    }
  }, [idx]);

  const handlePointerDown = () => {
    setPaused(true);
    if (!isVideoStory) accumulated.current += Date.now() - startTime.current;
  };
  const handlePointerUp = () => {
    setPaused(false);
    if (!isVideoStory) startTime.current = Date.now();
  };

  const handleTap = (e: React.MouseEvent) => {
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.35) goPrev();
    else if (x > w * 0.65) goNext();
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(v => !v);
    if (!liked) playLike();
  };

  const touchStart = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
    handlePointerDown();
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    handlePointerUp();
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 50) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  if (!story) return null;

  const videoUrl = (story as any).videoUrl as string | null | undefined;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        key="story-viewer"
        className="fixed inset-0 z-[110] bg-black flex flex-col select-none"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-2">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header — author */}
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2">
          <button
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={e => { e.stopPropagation(); onClose(); navigate(`/profile/${story.userId}`); }}
          >
            <img src={authorAvatar} alt={authorName} className="w-9 h-9 rounded-full object-cover border-2 border-white/70 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm font-bold leading-tight drop-shadow truncate">{authorName}</p>
              <p className="text-white/70 text-[10px] leading-tight">{timeAgo}</p>
            </div>
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center shrink-0"
            data-testid="button-fullscreen-story"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center shrink-0"
            data-testid="button-close-story"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Story media — tap to advance, hold to pause */}
        <div
          className="absolute inset-0"
          onClick={handleTap}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              className="absolute inset-0"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.15 }}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted={false}
                  loop={false}
                  controls={false}
                  draggable={false}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                />
              ) : story.imageUrl && !story.imageUrl.startsWith("blob:") ? (
                <img
                  src={story.imageUrl}
                  alt={story.caption || "Story"}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: `linear-gradient(160deg, hsl(${(story.id * 53) % 360}, 60%, 18%), hsl(${(story.id * 53 + 140) % 360}, 50%, 10%))` }}
                >
                  <p className="text-white/60 text-lg text-center px-8 leading-relaxed font-medium">
                    {story.caption || "✨"}
                  </p>
                </div>
              )}
              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Left / Right tap zones */}
        {hasPrev && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-start pl-2 w-1/3 h-1/2 pointer-events-none opacity-0 group-hover:opacity-100">
            <ChevronLeft className="w-6 h-6 text-white/30" />
          </div>
        )}
        {hasNext && (
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-end pr-2 w-1/3 h-1/2 pointer-events-none opacity-0 group-hover:opacity-100">
            <ChevronRight className="w-6 h-6 text-white/30" />
          </div>
        )}

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-24 left-0 right-0 z-20 px-5">
            <p className="text-white text-sm leading-snug drop-shadow-lg line-clamp-3">{story.caption}</p>
          </div>
        )}

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-4 px-5 pb-10">
          <button
            onClick={handleLike}
            className={`flex flex-col items-center gap-0.5 transition-transform active:scale-90 ${liked ? "text-red-400" : "text-white/80"}`}
            data-testid="button-story-like"
          >
            <Heart className={`w-7 h-7 ${liked ? "fill-red-400" : ""}`} />
          </button>
          <button className="flex flex-col items-center gap-0.5 text-white/80">
            <Share2 className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <span className="text-white/50 text-xs">{idx + 1} / {stories.length}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
