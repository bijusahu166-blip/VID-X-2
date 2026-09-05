import { Header } from "@/components/layout/Header";
import {
  Heart, MessageCircle, Share2, Download, Play, VolumeX, Volume2,
  Radio, Loader2, Bookmark, Send, Flag, CheckCheck, X as CloseIcon, User, RefreshCw
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  user?: { id: string; username?: string | null; profileImageUrl?: string | null; isFollowing?: boolean };
  likesCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
  hasSaved?: boolean;
}

// How many cards ahead/behind the active one actually mount their <video>
// element + hooks. Everything outside this window renders as a lightweight
// same-height spacer instead, so scroll-snap math stays correct without
// paying the cost of many simultaneous video elements + comment/report state.
const RENDER_WINDOW_BEHIND = 1;
const RENDER_WINDOW_AHEAD = 5;
// How many upcoming reels get their video warmed into the browser cache
// ahead of time, so swiping to them is instant instead of showing a spinner.
// Kept equal to RENDER_WINDOW_AHEAD so we never precache a reel that isn't
// actually mounted yet (that would just waste bandwidth).
const PRECACHE_AHEAD = 5;

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
  const [hasError, setHasError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportView, setReportView] = useState<"menu" | "success">("menu");
  const [showShareSheet, setShowShareSheet] = useState(false);

  const [liked, setLiked] = useState(reel.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(reel.likesCount ?? 0);
  const [saved, setSaved] = useState(reel.hasSaved ?? false);
  const [following, setFollowing] = useState(reel.user?.isFollowing ?? false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;
    if (showComments) {
      setCommentsLoading(true);
      fetch(`/api/posts/${reel.id}/comments`, { credentials: "include" })
        .then(r => {
          if (!r.ok) throw new Error("Failed to load comments");
          return r.json();
        })
        .then(data => {
          if (isMounted) setComments(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (isMounted) toast({ title: "Couldn't load comments", variant: "destructive" });
        })
        .finally(() => {
          if (isMounted) setCommentsLoading(false);
        });
    }
    return () => { isMounted = false; };
  }, [showComments, reel.id]);

  // Reset per-reel playback state whenever the underlying reel changes
  // (relevant when a spacer swaps back into a real ReelCard).
  useEffect(() => {
    setHasError(false);
    setIsBuffering(true);
  }, [reel.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = isMuted;
      if (!video.src && reel.videoUrl) {
        setHasError(false);
        video.src = toCloudinaryVideoUrl(reel.videoUrl);
        video.load();
      }

      video.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay-with-sound was blocked by the browser. Fall back to a
          // LOCAL mute on just this <video> element so playback still
          // starts — but never touch the app-wide `isMuted` state here.
          // Calling onToggleSound() used to flip the user's global sound
          // preference every time this happened, which is why sound had
          // to be re-enabled on almost every new reel.
          video.muted = true;
          video.play().then(() => setIsPlaying(true)).catch(() => null);
        });
    } else {
      video.pause();
      setIsPlaying(false);
      video.removeAttribute('src');
      video.load();
    }
  }, [isActive, isMuted, reel.videoUrl]);

  const retryVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video || !reel.videoUrl) return;
    setHasError(false);
    setIsBuffering(true);
    video.src = toCloudinaryVideoUrl(reel.videoUrl);
    video.load();
    video.play().then(() => setIsPlaying(true)).catch(() => null);
  }, [reel.videoUrl]);

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

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${reel.userId}/follow`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Follow failed");
      return res.json();
    },
    onMutate: () => {
      const wasFollowing = following;
      setFollowing(!wasFollowing);
      return { wasFollowing };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) setFollowing(ctx.wasFollowing);
      toast({ title: "Couldn't update follow", variant: "destructive" });
    },
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
          onPlaying={() => { setIsBuffering(false); setHasError(false); }}
          onError={() => { setIsBuffering(false); setHasError(true); }}
          onClick={() => {
            if (!videoRef.current || hasError) return;
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
          }}
        />
      ) : (
        <img src={reel.imageUrl} className="w-full h-full object-cover" alt="Reel media" />
      )}

      {!isPlaying && reel.videoUrl && !isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none z-10">
          <div className="p-4 rounded-full bg-black/50 text-white animate-ping">
            <Play className="w-8 h-8 fill-white" />
          </div>
        </div>
      )}

      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
          <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 z-10 text-white text-sm px-8 text-center">
          <p>Couldn't load this video.</p>
          <button
            onClick={retryVideo}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/15 border border-white/25 text-xs font-semibold active:scale-95 transition-transform"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      )}

      <div className="absolute right-4 bottom-24 flex flex-col gap-5 items-center z-20">
        <button
          onClick={() => !likeMutation.isPending && likeMutation.mutate()}
          disabled={likeMutation.isPending}
          className="flex flex-col items-center group active:scale-95 transition-transform disabled:opacity-70"
        >
          <Heart className={`w-7 h-7 transition-all ${liked ? "fill-red-500 text-red-500 scale-110" : "text-white drop-shadow-lg"}`} />
          <span className="text-xs font-semibold text-white mt-1 drop-shadow-md">{likeCount}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center active:scale-95 transition-transform">
          <MessageCircle className="w-7 h-7 text-white drop-shadow-lg" />
          <span className="text-xs font-semibold text-white mt-1 drop-shadow-md">{reel.commentsCount || 0}</span>
        </button>

        <button
          onClick={() => !saveMutation.isPending && saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex flex-col items-center active:scale-95 transition-transform disabled:opacity-70"
        >
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
        <div className="flex items-center gap-2 w-fit">
          <div
            onClick={() => reel.userId && navigate(`/profile/${reel.userId}`)}
            className="flex items-center gap-2 cursor-pointer"
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
        </div>

        {user?.id !== reel.userId && (
          <button
            onClick={() => followMutation.mutate()}
            disabled={followMutation.isPending}
            className={`w-fit px-4 py-1.5 rounded-md text-xs font-bold text-white active:scale-95 transition-all disabled:opacity-60 ${
              following ? "bg-zinc-700/80 border border-white/20" : "bg-red-500"
            }`}
          >
            {followMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : following ? "Following" : "Follow"}
          </button>
        )}

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
            {commentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
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

// Extracts hashtags (e.g. #travel) and normalized words from a caption/title
function extractTags(caption: string | null | undefined): string[] {
  if (!caption) return [];
  const hashtags = (caption.match(/#[\w]+/g) || []).map(t => t.slice(1).toLowerCase());
  const words = caption
    .toLowerCase()
    .replace(/#[\w]+/g, "")
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ""))
    .filter(w => w.length > 3);
  return Array.from(new Set([...hashtags, ...words]));
}

// Fisher-Yates shuffle for genuine randomness
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const { data: allPosts, isLoading } = usePosts();

  const userGoal = localStorage.getItem("user_goal") || "";

  // ── Feed scoring — this used to run on EVERY render, including every
  // scroll-driven activeIndex update. With lots of reels that recomputation
  // (filter + shuffle + sort of the whole list) was the main source of lag,
  // and re-shuffling mid-scroll made the list visually reorder under the
  // user's thumb. Memoized so it only recomputes when the underlying posts
  // actually change, not on every scroll frame.
  const visibleReels = useMemo(() => {
    const reels = (Array.isArray(allPosts) ? allPosts : []).filter((p: any) => p.type === "reel");
    const allowedSubjects = getGoalSubjects(userGoal);

    const filteredReels = reels.filter((r: any) => {
      if (allowedSubjects.length === 0) return true;
      const text = `${r.caption ?? ""}`.toLowerCase();
      return allowedSubjects.some(subject => text.includes(subject));
    });
    const baseReels = filteredReels.length > 0 ? filteredReels : reels;

    const interestTags = new Set<string>(allowedSubjects.map(s => s.toLowerCase()));
    reels.forEach((r: any) => {
      if (r.hasLiked || r.hasSaved) {
        extractTags(r.caption).forEach(t => interestTags.add(t));
      }
    });

    // When the content library is small, engagement score alone would push
    // the same handful of "popular" reels to the top for every single user
    // (since matchCount/engagementScore are the same for everyone, and the
    // old Math.random()*8 was too small to meaningfully outweigh them).
    // That's why every user was seeing the same order. Give randomness a
    // much bigger say when there isn't much content to rank yet, so each
    // user/session actually gets a different feed order. As content grows,
    // randomness weight shrinks back down and engagement/relevance take over.
    const lowContentThreshold = 20;
    const randomWeight = baseReels.length <= lowContentThreshold ? 40 : 8;

    const scoredReels = baseReels.map((r: any) => {
      const tags = extractTags(r.caption);
      const matchCount = tags.filter(t => interestTags.has(t)).length;
      const engagementScore = (r.likesCount ?? 0) * 0.5 + (r.commentsCount ?? 0) * 0.5;
      const score = matchCount * 10 + engagementScore + Math.random() * randomWeight;
      return { reel: r, score };
    });

    const displayReels = shuffle(scoredReels)
      .sort((a, b) => b.score - a.score)
      .map(s => s.reel);

    // No hard cap here anymore — the full scored pool is kept. Looping back
    // through it (instead of stopping) is handled below via modulo indexing
    // into virtual slots, so we don't want to throw away reels the loop
    // will need to cycle through.
    return displayReels;
    // Re-score when the post list or the user's goal changes — NOT on every
    // scroll/activeIndex update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPosts, userGoal]);

  // ── Infinite virtual list ─────────────────────────────────────────────
  // `loadedCount` is how many scroll "slots" currently exist. It's NOT the
  // number of distinct reels — once the user scrolls past the actual reel
  // pool, slots start looping back through `visibleReels` via modulo, so
  // the feed never hits a dead end even with a small content library.
  const INITIAL_LOAD = 15;
  const LOAD_CHUNK = 10;
  const [loadedCount, setLoadedCount] = useState(INITIAL_LOAD);

  // Reset the virtual slot count whenever the underlying reel pool changes
  // (new posts fetched, or goal/filter changed) so we don't carry over a
  // huge loadedCount built for a different pool.
  useEffect(() => {
    setLoadedCount(Math.min(INITIAL_LOAD, Math.max(visibleReels.length, RENDER_WINDOW_AHEAD + 1)));
  }, [visibleReels]);

  // Grow the virtual list as the user approaches the current end, so more
  // slots (and therefore more loops through the pool) are always ready
  // just ahead of the scroll position.
  useEffect(() => {
    if (visibleReels.length === 0) return;
    if (activeIndex >= loadedCount - RENDER_WINDOW_AHEAD - 2) {
      setLoadedCount(c => c + LOAD_CHUNK);
    }
  }, [activeIndex, loadedCount, visibleReels.length]);

  // Maps a virtual scroll slot to an actual reel, cycling through the pool
  // once the user has scrolled past the last distinct reel.
  const getReelAt = useCallback(
    (slot: number) => (visibleReels.length > 0 ? visibleReels[slot % visibleReels.length] : undefined),
    [visibleReels]
  );

  useEffect(() => {
    for (let offset = 1; offset <= PRECACHE_AHEAD; offset++) {
      const upcoming = getReelAt(activeIndex + offset);
      if (upcoming?.videoUrl) precacheVideo(toCloudinaryVideoUrl(upcoming.videoUrl));
    }
  }, [activeIndex, getReelAt]);

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
          // Render `loadedCount` virtual slots, NOT visibleReels.length — once
          // the user scrolls past the last distinct reel, getReelAt() wraps
          // back around (modulo) so the feed loops instead of dead-ending.
          Array.from({ length: loadedCount }, (_, i) => {
            const reel = getReelAt(i);
            if (!reel) return null;

            const withinRenderWindow =
              i >= activeIndex - RENDER_WINDOW_BEHIND && i <= activeIndex + RENDER_WINDOW_AHEAD;

            // Slot key includes the virtual index (not just reel.id) because
            // the same reel can now appear at multiple slots once we loop.
            const slotKey = `${reel.id}-${i}`;

            // Outside the render window: a same-height spacer instead of a
            // full ReelCard, so scroll-snap math (scrollTop / clientHeight)
            // stays correct without mounting a <video> + all its hooks for
            // reels the user isn't near yet.
            if (!withinRenderWindow) {
              return <div key={slotKey} className="snap-start h-[100dvh] w-full bg-black" />;
            }

            return (
              <ReelCard
                key={slotKey}
                reel={reel}
                isActive={i === activeIndex}
                isMuted={isMuted}
                onToggleSound={() => setIsMuted(prev => !prev)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}