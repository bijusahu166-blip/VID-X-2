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
      method: "DELETE", credentials: "include" 
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/stories"] });
      onClose();
    },
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