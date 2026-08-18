import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import {
  Heart, MessageCircle, Share2, Download, Play, VolumeX, Volume2,
  Radio, Loader2, Bookmark, Send, Flag, CheckCheck, X as CloseIcon, User
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { toCloudinaryVideoUrl } from "@/lib/utils";
import { getGoalSubjects } from "@/lib/goal-subjects";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLocation } from "wouter";
import { precacheVideo } from "@/lib/videoPrecache";
import { usePosts } from "@/hooks/use-posts";
import { ShareToSheet } from "@/components/post/ShareToSheet";

interface ReelPost {
  id: number;
  userId: string;
  imageUrl: string;
  caption: string | null;
  type: string | null;
  videoUrl: string | null;
  user?: { id: string; username?: string; profileImageUrl?: string };
  likesCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
  hasSaved?: boolean;
}

function ReelCard({
  reel,
  isActive,
  isMuted,
  onToggleSound
}: {
  reel: ReelPost;
  isActive: boolean;
  isMuted: boolean;
  onToggleSound: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [,navigate] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportView, setReportView] = useState<"menu" | "success">("menu");
  const [showShareSheet, setShowShareSheet] = useState(false);

  const [liked, setLiked] = useState(reel.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(reel.likesCount ?? 0);
  const [saved, setSaved] = useState(reel.hasSaved ?? false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;
    if (showComments) {
      fetch(`/api/posts/${reel.id}/comments`, { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (isMounted) setComments(data);
        })
        .catch(err => console.error("Failed to fetch comments", err));
    }
    return () => { isMounted = false; };
  }, [showComments, reel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = isMuted;
      if (!video.src && reel.videoUrl) {
        video.src = toCloudinaryVideoUrl(reel.videoUrl);
        video.load();
      }

      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          if (isMuted) return;
          video.muted = true;
          onToggleSound();
          video.play().catch(() => null);
        });
    } else {
      video.pause();
      setIsPlaying(false);
      video.removeAttribute('src');
      video.load();
    }
  }, [isActive, isMuted, onToggleSound, reel.videoUrl]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${reel.id}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Like failed");
      return res.json();
    },
    onMutate: () => {
      const wasLiked = liked;
      setLiked(!wasLiked);
      setLikeCount((c) => (wasLiked ? c - 1 : c + 1));
      return { wasLiked };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) {
        setLiked(ctx.wasLiked);
        setLikeCount((c) => (ctx.wasLiked ? c + 1 : c - 1));
      }
      toast({ title: "Couldn't like post", variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${reel.id}/save`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: (data) => {
      setSaved(data.saved);
      toast({ title: data.saved ? "Saved to Profile" : "Removed from Profile" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved"] });
    },
    onError: () => toast({ title: "Couldn't save post", variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await fetch(`/api/posts/${reel.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason })
      });
      return res.json();
    },
    onSuccess: () => {
      setReportView("success");
      setTimeout(() => {
        setShowReportMenu(false);
        setReportView("menu");
      }, 2000);
    },
    onError: () => {
      toast({ title: "Failed to submit report", variant: "destructive" });
      setShowReportMenu(false);
    }
  });

  const handleDownload = async () => {
    const sourceUrl = reel.videoUrl ? toCloudinaryVideoUrl(reel.videoUrl) : reel.imageUrl;
    if (!sourceUrl) {
      toast({ title: "Unable to download media", variant: "destructive" });
      return;
    }
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Failed to fetch media");
      const blob = await response.blob();
      const extension = reel.videoUrl ? "mp4" : sourceUrl.split(".").pop()?.split(/\?|#/)[0] || "jpg";
      const fileName = `vidx-reel-${reel.id}.${extension}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Download started" });
    } catch (err: any) {
      toast({ title: "Download failed", description: err?.message || "Could not download media", variant: "destructive" });
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/posts/${reel.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [...prev, newComment]);
        setCommentText("");
        reel.commentsCount = (reel.commentsCount || 0) + 1;
      } else {
        toast({ title: "Failed to post comment", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error posting comment", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="snap-start h-[100dvh] w-full relative bg-black flex items-center justify-center overflow-hidden select-none">
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          poster={reel.imageUrl}
          className="w-full h-full object-cover"
          loop
          playsInline
          muted={isMuted}
          preload="metadata"
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onClick={() => {
            if (!videoRef.current) return;
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
          }}
        />
      ) : (
        <img src={reel.imageUrl} className="w-full h-full object-cover" alt="Reel media" />
      )}

      {!isPlaying && reel.videoUrl && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none z-10">
          <div className="p-4 rounded-full bg-black/50 text-white animate-ping">
            <Play className="w-8 h-8 fill-white" />
          </div>
        </div>
      )}

      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
          <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
        </div>
      )}

      <div className="absolute right-4 bottom-24 flex flex-col gap-5 items-center z-20">
        <button onClick={() => likeMutation.mutate()} className="flex flex-col items-center group active:scale-95 transition-transform">
          <Heart className={`w-7 h-7 transition-all ${liked ? "fill-red-500 text-red-500 scale-110" : "text-white drop-shadow-lg"}`} />
          <span className="text-xs font-semibold text-white mt-1 drop-shadow-md">{likeCount}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center active:scale-95 transition-transform">
          <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
          <span className="text-xs font-semibold text-white mt-1 drop-shadow-md">{reel.commentsCount || 0}</span>
        </button>

        <button onClick={() => saveMutation.mutate()} className="flex flex-col items-center active:scale-95 transition-transform">
          <Bookmark className={`w-7 h-7 transition-all ${saved ? "fill-cyan-400 text-cyan-400" : "text-white drop-shadow-lg"}`} />
          <span className="text-xs font-semibold text-white mt-1 drop-shadow-md">{saved ? "Saved" : "Save"}</span>
        </button>

        <button onClick={() => setShowShareSheet(true)} className="flex flex-col items-center active:scale-95 transition-transform">
          <Share2 className="w-7 h-7 text-white drop-shadow-lg" />
          <span className="text-xs font-semibold text-white mt-1 drop-shadow-md">Share</span>
        </button>

        <button onClick={handleDownload} className="flex flex-col items-center active:scale-95 transition-transform">
          <Download className="w-7 h-7 text-white drop-shadow-lg" />
          <span className="text-xs font-semibold text-white mt-1 drop-shadow-md">Save App</span>
        </button>

        <button onClick={onToggleSound} className="w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center active:scale-95 transition-transform">
          {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
        </button>

        {user?.id !== reel.userId && (
          <button onClick={() => setShowReportMenu(true)} className="flex flex-col items-center">
            <Flag className="w-6 h-6 text-zinc-400 drop-shadow-lg" />
          </button>
        )}
      </div>

      <div className="absolute left-4 bottom-24 right-16 z-20 flex flex-col gap-2 pointer-events-auto">
        <div
          onClick={() => reel.userId && navigate(`/profile/${reel.userId}`)}
          className="flex items-center gap-2 cursor-pointer w-fit"
        >
          {reel.user?.profileImageUrl ? (
            <img
              src={reel.user.profileImageUrl}
              alt=""
              className="w-9 h-9 rounded-full border border-white/30 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-white/20">
              <User className="w-4 h-4 text-zinc-400" />
            </div>
          )}
          <span className="font-bold text-white text-base drop-shadow-md hover:underline">
            @{reel.user?.username || "user"}
          </span>
        </div>
        <p className="text-sm text-white/90 line-clamp-3 drop-shadow-md pl-0.5 leading-relaxed">
          {reel.caption}
        </p>
      </div>

      <Sheet open={showComments} onOpenChange={setShowComments}>
        <SheetContent side="bottom" className="h-[70vh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl flex flex-col">
          <SheetHeader>
            <SheetTitle className="text-white">Comments ({comments.length})</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto space-y-3 py-2 px-1">
            {comments.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-8">No comments yet. Be the first!</p>
            ) : (
              comments.map((c: any) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                    <img
                      src={c.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">
                      @{c.user?.username || c.user?.firstName || "user"}
                    </span>
                    <p className="text-sm text-zinc-300">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 items-center pt-2 border-t border-zinc-800">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }}
              placeholder="Add a comment…"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-2 text-sm text-white outline-none"
            />
            <button
              onClick={submitComment}
              disabled={isSubmittingComment}
              className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center disabled:opacity-50"
            >
              {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showReportMenu} onOpenChange={setShowReportMenu}>
        <SheetContent side="bottom" className="bg-zinc-950 border-t border-zinc-800 rounded-t-3xl">
          {reportView === "menu" ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-white">Report this post</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 py-2">
                {["Spam", "Nudity or sexual content", "Hate speech", "Violence", "False information", "Something else"].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => reportMutation.mutate(reason)}
                    disabled={reportMutation.isPending}
                    className="text-left px-3 py-3 rounded-lg text-sm text-white hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCheck className="w-10 h-10 text-cyan-500" />
              <p className="text-white text-sm">Report submitted, thanks!</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <ShareToSheet open={showShareSheet} onOpenChange={setShowShareSheet} postId={reel.id} />
    </div>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const { data: allPosts, isLoading } = usePosts();
  const reels = (Array.isArray(allPosts) ? allPosts : [])
    .filter(p => p.type === "reel")
    .sort((a, b) => {
      const scoreA = (a.likesCount ?? 0) * 2 + (a.commentsCount ?? 0) * 3;
      const scoreB = (b.likesCount ?? 0) * 2 + (b.commentsCount ?? 0) * 3;
      return scoreB - scoreA;
    });
  const userGoal = localStorage.getItem("user_goal") || "";
  const allowedSubjects = getGoalSubjects(userGoal);
  const filteredReels = reels.filter((r) => {
    if (allowedSubjects.length === 0) return true;
    const text = `${r.caption ?? ""}`.toLowerCase();
    return allowedSubjects.some(subject => text.includes(subject));
  });
  const displayReels = filteredReels.length > 0 ? filteredReels : reels;
  const visibleReels = displayReels.slice(0, 15);

  useEffect(() => {
    const nextReel = visibleReels[activeIndex + 1];
    if (nextReel?.videoUrl) precacheVideo(toCloudinaryVideoUrl(nextReel.videoUrl));
    const nextNextReel = visibleReels[activeIndex + 2];
    if (nextNextReel?.videoUrl) precacheVideo(toCloudinaryVideoUrl(nextNextReel.videoUrl));
  }, [activeIndex, visibleReels]);

  const handleScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      window.cancelAnimationFrame(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = window.requestAnimationFrame(() => {
      if (containerRef.current) {
        const container = containerRef.current;
        const index = Math.round(container.scrollTop / container.clientHeight);
        setActiveIndex(index);
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) window.cancelAnimationFrame(scrollTimeoutRef.current);
    };
  }, []);

  return (
    <div className="h-[100dvh] bg-black overflow-hidden flex flex-col">
      <Header />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 snap-y snap-mandatory overflow-y-scroll no-scrollbar scroll-smooth target-device-fix"
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500 w-10 h-10" /></div>
        ) : (
          visibleReels.map((reel, i) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              isActive={i === activeIndex}
              isMuted={isMuted}
              onToggleSound={() => setIsMuted(prev => !prev)}
            />
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}