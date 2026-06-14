import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Heart, Share2, 
         Maximize2, Minimize2, MessageCircle, Trash2, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { playLike } from "@/lib/sounds";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface Story {
  id: number;
  userId: string;
  user?: any;
  imageUrl?: string | null;
  mediaUrl?: string | null;
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
  const [showComments, setShowComments] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef(Date.now());
  const accumulated = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const story = stories[idx];
  const hasPrev = idx > 0;
  const hasNext = idx < stories.length - 1;
  const isVideoStory = !!(story as any)?.videoUrl || !!(story as any)?.mediaUrl?.includes("video");
  const isMyStory = story?.userId === user?.id;

  const author = story?.user;
  const authorName = author ? `${author.firstName || author.first_name} ${author.lastName || author.last_name}` : "User";
  const authorAvatar = author?.profileImageUrl || author?.profile_image_url || 
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.firstName || "user"}`;
  const timeAgo = story ? getTimeAgo(story.createdAt) : "";

  // Queries
  const { data: likers } = useQuery<any[]>({
    queryKey: ["/api/stories", story?.id, "likes"],
    queryFn: () => fetch(`/api/stories/${story.id}/likes`, { credentials: "include" }).then(r => r.json()),
    enabled: showLikers && !!story?.id,
  });

  const { data: storyComments } = useQuery<any[]>({
    queryKey: ["/api/stories", story?.id, "comments"],
    queryFn: () => fetch(`/api/stories/${story.id}/comments`, { credentials: "include" }).then(r => r.json()),
    enabled: showComments && !!story?.id,
    refetchInterval: showComments ? 3000 : false,
  });

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: () => fetch(`/api/stories/${story.id}/like`, { 
      method: "POST", credentials: "include" 
    }).then(r => r.json()),
    onSuccess: (data) => {
      setLiked(data.liked);
      if (data.liked) playLike();
      qc.invalidateQueries({ queryKey: ["/api/stories", story?.id, "likes"] });
    },
  });

  // Comment mutation
  const commentMutation = useMutation({
    mutationFn: (content: string) => fetch(`/api/stories/${story.id}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content }),
    }).then(r => r.json()),
    onSuccess: () => {
      setCommentText("");
      qc.invalidateQueries({ queryKey: ["/api/stories", story?.id, "comments"] });
    },
  });

  // Delete mutation
 const deleteMutation = useMutation({
  mutationFn: () => fetch(`/api/stories/${story.id}`, { 
    method: "DELETE", 
    credentials: "include" 
  }).then(r => r.json()),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["/api/stories"] });
    qc.refetchQueries({ queryKey: ["/api/stories"] });
    qc.invalidateQueries({ queryKey: ["/api/posts"] });
    onClose();
  },
  onError: (err) => {
    console.error("Delete failed:", err);
  }
});

  function getTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

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

  useEffect(() => {
    if (isVideoStory || showComments || showLikers) return;
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [idx, paused, goNext, isVideoStory, showComments, showLikers]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const handleTap = (e: React.MouseEvent) => {
    if (showComments || showLikers) return;
    const x = e.clientX;
    const w = window.innerWidth;
    if (x < w * 0.35) goPrev();
    else if (x > w * 0.65) goNext();
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    likeMutation.mutate();
  };

  const touchStart = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
    if (!showComments) setPaused(true);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!showComments) setPaused(false);
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 50 && !showComments) {
      if (dx < 0) goNext(); else goPrev();
    }
  };

  const mediaUrl = (story as any)?.mediaUrl || story?.imageUrl;
  const videoUrl = (story as any)?.videoUrl;

  if (!story) return null;

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
              <div className="h-full bg-white rounded-full"
                style={{ width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2">
          <button className="flex items-center gap-2 flex-1 min-w-0"
            onClick={e => { e.stopPropagation(); onClose(); navigate(`/profile/${story.userId}`); }}>
            <img src={authorAvatar} alt={authorName} className="w-9 h-9 rounded-full object-cover border-2 border-white/70 shrink-0" />
            <div className="min-w-0">
              <p className="text-white text-sm font-bold leading-tight truncate">{authorName}</p>
              <p className="text-white/70 text-[10px]">{timeAgo}</p>
            </div>
          </button>

          {/* Delete button - sirf apni story pe */}
          {isMyStory && (
            <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(); }}
              className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center shrink-0"
              data-testid="button-delete-story">
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          )}
              
          <button onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center shrink-0">
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>
          <button onClick={e => { e.stopPropagation(); onClose(); }}
            className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center shrink-0"
            data-testid="button-close-story">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Media */}
        <div className="absolute inset-0" onClick={handleTap}
          onPointerDown={() => { if (!showComments) { setPaused(true); } }}
          onPointerUp={() => { if (!showComments) { setPaused(false); } }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          <AnimatePresence mode="wait">
            <motion.div key={idx} className="absolute inset-0"
              initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.15 }}>
              {videoUrl ? (
                <video ref={videoRef} src={videoUrl} className="w-full h-full object-cover"
                  autoPlay playsInline loop={false} controls={false}
                  onTimeUpdate={() => {
                    const vid = videoRef.current;
                    if (!vid || !vid.duration) return;
                    setProgress(Math.min((vid.currentTime / vid.duration) * 100, 100));
                  }}
                  onEnded={goNext} />
              ) : mediaUrl && !mediaUrl.startsWith("blob:") ? (
                <img src={mediaUrl} alt={story.caption || "Story"} className="w-full h-full object-cover" draggable={false} />
              ) : (
                <div className="w-full h-full flex items-center justify-center"
                  style={{ background: `linear-gradient(160deg, hsl(${(story.id * 53) % 360}, 60%, 18%), hsl(${(story.id * 53 + 140) % 360}, 50%, 10%))` }}>
                  <p className="text-white/60 text-lg text-center px-8">{story.caption || "✨"}</p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="absolute bottom-28 left-0 right-0 z-20 px-5">
            <p className="text-white text-sm drop-shadow-lg">{story.caption}</p>
          </div>
        )}

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-10">
          {showComments && (
            <div className="mb-3 flex gap-2" onClick={e => e.stopPropagation()}>
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) commentMutation.mutate(commentText.trim()); }}
                placeholder="Add a comment…"
                className="flex-1 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none" />
              <button onClick={() => commentText.trim() && commentMutation.mutate(commentText.trim())}
                className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button onClick={handleLike}
              className={`flex items-center gap-1.5 transition-transform active:scale-90 ${liked ? "text-red-400" : "text-white/80"}`}>
              <Heart className={`w-7 h-7 ${liked ? "fill-red-400" : ""}`} />
            </button>

            {isMyStory && (
              <button onClick={e => { e.stopPropagation(); setShowLikers(v => !v); setShowComments(false); }}
                className="text-white/60 text-xs">
                {likers?.length ?? 0} likes
              </button>
            )}

            <button onClick={e => { e.stopPropagation(); setShowComments(v => !v); setShowLikers(false); }}
              className="flex items-center gap-1.5 text-white/80">
              <MessageCircle className="w-6 h-6" />
              <span className="text-xs">{storyComments?.length ?? 0}</span>
            </button>

            <button className="text-white/80">
              <Share2 className="w-6 h-6" />
            </button>

            <div className="flex-1" />
            <span className="text-white/50 text-xs">{idx + 1} / {stories.length}</span>
          </div>

          {showComments && storyComments && storyComments.length > 0 && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto" onClick={e => e.stopPropagation()}>
              {storyComments.map((c: any) => (
                <div key={c.id} className="flex gap-2 items-start">
                  <img src={c.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}`}
                    className="w-6 h-6 rounded-full object-cover" alt="" />
                  <div>
                    <span className="text-xs font-bold text-white">{c.first_name} </span>
                    <span className="text-xs text-white/70">{c.content}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showLikers && isMyStory && likers && (
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <p className="text-xs font-bold text-white/60 mb-2">❤️ Liked by</p>
              {likers.length === 0 ? (
                <p className="text-xs text-white/40">No likes yet</p>
              ) : likers.map((u: any) => (
                <div key={u.id} className="flex gap-2 items-center">
                  <img src={u.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`}
                    className="w-6 h-6 rounded-full object-cover" alt="" />
                  <span className="text-xs text-white">{u.first_name} {u.last_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}