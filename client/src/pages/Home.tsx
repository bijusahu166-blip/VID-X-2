import { FollowSuggestions } from "@/components/shared/FollowSuggestions";
import { usePosts } from "@/hooks/use-posts";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { BannerAd } from "@/components/ads/BannerAd";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { VideoPlayer } from "@/components/shared/VideoPlayer";
import {
  Play, ThumbsUp, Share2, MoreVertical,
  MessageSquare, ChevronRight, Flame, Music,
  Globe, Gamepad2, Utensils, Plane, Cpu, Plus,
  CheckCircle2, Zap, Film, X, Send, Loader2, Image,
  Trash2, Flag, AlertTriangle, ShieldAlert, EyeOff, Ban, CheckCheck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LiveStreamViewer } from "@/components/live/LiveStreamViewer";
import { PostViewerModal } from "@/components/post/PostViewerModal";
import { StoryViewer } from "@/components/story/StoryViewer";
import { playLike, playUnlike } from "@/lib/sounds";
import { getGoalSubjects } from "@/lib/goal-subjects";
import { useHideBottomNavWhenOpen } from "@/contexts/BottomNavVisibilityContext";

const CATEGORIES = [
  { label: "All", icon: null },
  { label: "Trending", icon: Flame },
  { label: "Reels", icon: Play },
  { label: "Music", icon: Music },
  { label: "Gaming", icon: Gamepad2 },
  { label: "Food", icon: Utensils },
  { label: "Travel", icon: Plane },
  { label: "Tech", icon: Cpu },
  { label: "World", icon: Globe },
];
function FollowButtonSmall({ userId, currentUserId }: { userId: string; currentUserId?: string }) {
  const isOwn = String(userId) === String(currentUserId);

  const { data: followStatus } = useQuery<{ following: boolean }>({
    queryKey: ["/api/users", userId, "follow-status"],
    queryFn: () => fetch(`/api/users/${userId}/follow-status`, { credentials: "include" }).then(r => r.json()),
    enabled: !isOwn && !!currentUserId,
  });

  const [loading, setLoading] = useState(false);
  const isFollowing = followStatus?.following ?? false;

  if (isOwn || !currentUserId) return null;

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      await fetch(`/api/users/${userId}/follow`, { method, credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "follow-status"] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFollow}
      disabled={loading}
      className={`text-[9px] font-bold px-2 py-0.5 rounded-full transition-colors disabled:opacity-50 shrink-0 ${
        isFollowing
          ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
          : "bg-red-500 text-white"
      }`}
    >
      {loading ? "…" : isFollowing ? "Following ✓" : "Follow"}
    </button>
  );
}
const REELS = [
  { id: 1, user: "Alex_Gamer", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", thumb: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=200&h=350&fit=crop", live: false },
  { id: 2, user: "TravelQueen", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Travel", thumb: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=200&h=350&fit=crop", live: true },
  { id: 3, user: "ChefMike", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike", thumb: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=350&fit=crop", live: false },
  { id: 4, user: "MusicVibes", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Music", thumb: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=350&fit=crop", live: false },
  { id: 5, user: "TechNerd99", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tech", thumb: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&h=350&fit=crop", live: true },
  { id: 6, user: "NatureLens", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nature", thumb: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&h=350&fit=crop", live: false },
];

function CommentsDrawer({ postId, open, onClose }: { postId: number; open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: comments, isLoading } = useQuery<any[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: () => fetch(`/api/posts/${postId}/comments`, { credentials: "include" }).then(r => r.json()),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

const addComment = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/posts/${postId}/comments`, { content });
      return res.json();
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["/api/posts", postId, "comments"] });
      const previousComments = queryClient.getQueryData<any[]>(["/api/posts", postId, "comments"]);

      const optimisticComment = {
        id: `temp-${Date.now()}`,
        content,
        userId: user?.id,
        user: { firstName: user?.firstName, username: (user as any)?.username, profileImageUrl: user?.profileImageUrl },
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<any[]>(["/api/posts", postId, "comments"], (old) => [...(old ?? []), optimisticComment]);
      queryClient.setQueryData<any[]>(["/api/posts"], (old) =>
        old?.map((p) => (p.id === postId ? { ...p, commentsCount: (p.commentsCount ?? 0) + 1 } : p))
      );

      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return { previousComments };
    },
    onError: (_err, _content, ctx) => {
      if (ctx?.previousComments) {
        queryClient.setQueryData(["/api/posts", postId, "comments"], ctx.previousComments);
      }
      queryClient.setQueryData<any[]>(["/api/posts"], (old) =>
        old?.map((p) => (p.id === postId ? { ...p, commentsCount: Math.max((p.commentsCount ?? 1) - 1, 0) } : p))
      );
      toast({ title: "Comment failed to send", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
    },
  });


  if (!open) return null;

  // Rendered via a portal straight onto document.body: Home is a descendant
  // of SwipeTabs' animated motion.div (App.tsx), which carries a CSS
  // `transform` for the page-slide animation. Any transformed ancestor
  // becomes the containing block for `position: fixed` descendants — so
  // without the portal, this "fixed inset-0" sheet was fixing itself to
  // the bottom of that motion.div (i.e. the bottom of the page CONTENT)
  // instead of the actual screen viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto rounded-t-3xl bg-zinc-950 border-t border-zinc-800 flex flex-col" style={{ maxHeight: "75vh" }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
          <span className="text-sm font-black text-white">
            Comments {comments ? `(${comments.length})` : ""}
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : !comments?.length ? (
            <div className="text-center py-8">
              <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-600">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                  <img
                    src={c.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-bold text-white">
                      {c.user ? `@${(c.user as any).username || c.user.firstName?.toLowerCase()}` : "@user"}
                    </span>
                    <span className="text-[9px] text-zinc-600">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[12px] text-zinc-300 mt-0.5 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
        <div className="px-4 py-3 border-t border-zinc-800 flex gap-2 items-center">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-800 shrink-0">
            <img
              src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
              className="w-full h-full object-cover"
            />
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) addComment.mutate(text.trim()); }}
            placeholder="Add a comment…"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-1.5 text-[12px] text-white placeholder:text-zinc-600 outline-none focus:border-zinc-500"
          />
          <button
            onClick={() => text.trim() && addComment.mutate(text.trim())}
            disabled={!text.trim() || addComment.isPending}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 disabled:opacity-40 transition-all"
          >
            {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

async function sharePost(post: any) {
  const url = `${window.location.origin}/post/${post.id}`;
  const title = post.caption || "Check this out on IQ PARTNER";
  if (navigator.share) {
    try {
      await navigator.share({ title, text: title, url });
      return;
    } catch {}
  }
  try {
    await navigator.clipboard.writeText(url);
    alert("Link copied to clipboard!");
  } catch {
    alert(`Share this link: ${url}`);
  }
}

const REPORT_REASONS = [
  { icon: ShieldAlert, label: "Spam or misleading" },
  { icon: AlertTriangle, label: "Hateful or abusive" },
  { icon: EyeOff, label: "Nudity or sexual content" },
  { icon: Flag, label: "Violence or dangerous" },
  { icon: Ban, label: "Harassment or bullying" },
  { icon: AlertTriangle, label: "Other" },
];

function PostActionMenu({
  post, isOwner, onClose,
}: {
  post: any; isOwner: boolean; onClose: () => void;
}) {
  const [view, setView] = useState<"menu" | "confirm-delete" | "report-reason" | "reported" | "deleted">("menu");
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/posts/${post.id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setView("deleted");
      setTimeout(onClose, 1800);
    },
    onError: () => toast({ title: "Could not delete post", variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => apiRequest("POST", `/api/posts/${post.id}/report`, { reason }),
    onSuccess: () => setView("reported"),
    onError: () => toast({ title: "Could not submit report", variant: "destructive" }),
  });

  // Same portal fix as CommentsDrawer above — without it, this "fixed
  // inset-0" report/delete menu sticks to the bottom of Home's page content
  // (inside SwipeTabs' transformed motion.div) instead of the screen's
  // actual bottom, which is exactly the "menu shows up where the content
  // ends" bug.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[85dvh] mx-auto overflow-y-auto rounded-t-3xl bg-zinc-950 border-t border-zinc-800"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>

        {view === "menu" && (
          <div className="px-4 py-3 space-y-1">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3">Post Options</p>

            {isOwner && (
              <button
                onClick={() => setView("confirm-delete")}
                data-testid="button-delete-post"
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-400">Delete Post</p>
                  <p className="text-[11px] text-zinc-600">Remove this post permanently</p>
                </div>
              </button>
            )}

            {!isOwner && (
              <button
                onClick={() => setView("report-reason")}
                data-testid="button-report-post"
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                  <Flag className="w-4 h-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-orange-400">Report Post</p>
                  <p className="text-[11px] text-zinc-600">Flag this content for review</p>
                </div>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                <X className="w-4 h-4 text-zinc-400" />
              </div>
              <p className="text-sm font-semibold text-zinc-400">Cancel</p>
            </button>
            <div className="h-4" />
          </div>
        )}

        {view === "confirm-delete" && (
          <div className="px-5 py-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-lg font-black text-white text-center mb-1">Delete Post?</h3>
            <p className="text-sm text-zinc-500 text-center mb-6">This will permanently remove your post including all comments and likes. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setView("menu")} className="flex-1 h-12 rounded-xl border border-zinc-700 text-zinc-300 font-bold text-sm hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete</>}
              </button>
            </div>
            <div className="h-4" />
          </div>
        )}

        {view === "report-reason" && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setView("menu")} className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
              <h3 className="text-sm font-black text-white">Why are you reporting this?</h3>
            </div>
            <div className="space-y-1.5 mb-4">
              {REPORT_REASONS.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => reportMutation.mutate(label)}
                  disabled={reportMutation.isPending}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors text-left disabled:opacity-50"
                >
                  <Icon className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-sm text-white font-medium">{label}</span>
                  {reportMutation.isPending && <Loader2 className="w-3.5 h-3.5 text-zinc-600 animate-spin ml-auto" />}
                </button>
              ))}
            </div>
            <div className="h-2" />
          </div>
        )}

        {view === "reported" && (
          <div className="px-5 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto mb-4">
              <CheckCheck className="w-7 h-7 text-green-400" />
            </div>
            <h3 className="text-lg font-black text-white mb-1">Report Submitted</h3>
            <p className="text-sm text-zinc-500 mb-5">Thank you for helping keep IQ PARTNER safe. Our team will review this content.</p>
            <button onClick={onClose} className="w-full h-11 rounded-xl bg-zinc-800 text-white font-bold text-sm hover:bg-zinc-700 transition-colors">
              Done
            </button>
            <div className="h-4" />
          </div>
        )}

        {view === "deleted" && (
          <div className="px-5 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-400" />
            </div>
            <h3 className="text-lg font-black text-white mb-1">Post Deleted</h3>
            <p className="text-sm text-zinc-500">Your post has been permanently removed.</p>
            <div className="h-8" />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
function RecommendedVideoCard({ video, onSkip }: { video: any; onSkip: (videoId: string) => void }) {
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);
  const playerId = `yt-player-${video.videoId}`;

  useEffect(() => {
    setReady(false);
    setErrored(false);
  }, [video.videoId]);

  useEffect(() => {
    let player: any;
    let destroyed = false;

    const initPlayer = () => {
      if (destroyed) return;
      const el = document.getElementById(playerId);
      if (!el) return;
      try {
        player = new (window as any).YT.Player(playerId, {
          videoId: video.videoId,
          playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: () => setReady(true),
            onError: () => {
              setErrored(true);
              onSkip(video.videoId);
            },
          },
        });
      } catch {
        setErrored(true);
      }
    };

    if (!(window as any).YT || !(window as any).YT.Player) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        initPlayer();
      };
    } else {
      initPlayer();
    }

    return () => {
      destroyed = true;
      try { player?.destroy?.(); } catch {}
    };
  }, [video.videoId]);

  return (
    <div className="mb-1 rounded-3xl overflow-hidden border border-white/5 bg-zinc-950">
      <div className="relative w-full aspect-video bg-black">
        {!errored && <div id={playerId} className="absolute inset-0 w-full h-full" />}
        {(!ready || errored) && (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {errored && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-3 px-3 py-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shrink-0">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-1">{video.title}</p>
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span>{video.channelTitle}</span>
            <span>·</span>
            <span className="text-pink-400 font-bold">Recommended</span>
          </div>
        </div>
      </div>
    </div>
  );
}
export default function Home() {
  const { data: postsData, isLoading } = usePosts();
  const posts = Array.isArray(postsData)
    ? postsData.filter(p => p.type !== "story")
    : [];
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState("All");
  const [openCommentPostId, setOpenCommentPostId] = useState<number | null>(null);
  const [actionMenuPost, setActionMenuPost] = useState<any | null>(null);
  const [livePost, setLivePost] = useState<any | null>(null);
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [viewingStoryIdx, setViewingStoryIdx] = useState<number | null>(null);

  // These are all internal-state overlays — opening them never changes the
  // URL, so the bottom nav's own route-based check never sees them. This is
  // what was letting it sit on top of the comment box, the report/delete
  // menu, and the live/post/story full-screen viewers on the home feed.
  useHideBottomNavWhenOpen(
    openCommentPostId !== null ||
    !!actionMenuPost ||
    !!livePost ||
    !!viewingPost ||
    viewingStoryIdx !== null
  );

  // ✅ SIRF YE EK BLOCK RAHE
const { data: storiesData, refetch: refetchStories } = useQuery<any[]>({
    queryKey: ["/api/stories"],
    queryFn: async () => {
      const res = await fetch("/api/stories", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stories");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 10000,
    staleTime: 5000,
    retry: 2,
    retryDelay: (attempt) => 1000 * (attempt + 1),
  });
  const stories = storiesData ?? [];

  const { data: voiceRooms = [] } = useQuery<any[]>({
    queryKey: ["/api/voice-rooms"],
    queryFn: async () => {
      const res = await fetch("/api/voice-rooms", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch voice rooms");
      return res.json();
    },
    refetchInterval: 8000,
    retry: 2,
    retryDelay: (attempt) => 1000 * (attempt + 1),
  });

  const { data: allBooks = [] } = useQuery<any[]>({
    queryKey: ["/api/books"],
    queryFn: async () => {
      const res = await fetch("/api/books", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch books");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    retry: 2,
    retryDelay: (attempt) => 1000 * (attempt + 1),
  });

  const userGoal = (user as any)?.goal || localStorage.getItem("user_goal") || "";
  const allowedSubjects = getGoalSubjects(userGoal);

 const { data: recommendedVideosRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/youtube/feed", userGoal],
    queryFn: async () => {
      const res = await fetch(`/api/youtube/feed?query=${encodeURIComponent(userGoal || "trending")}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  // Videos jo already user ko dikh chuke hain unhe dobara mat dikhao
 const recommendedVideos = recommendedVideosRaw;
  const recommendedBooks = allBooks.filter((book: any) => {
    if (allowedSubjects.length === 0 || !book?.subject) return true;
    return allowedSubjects.some(s => book.subject?.toLowerCase().includes(s));
  }).slice(0, 10);

  const matchesUserGoal = (post: any) => {
    if (allowedSubjects.length === 0) return true;
    const text = `${post.caption ?? ""} ${post.type ?? ""} ${post.title ?? ""} ${post.user?.firstName ?? ""} ${post.user?.lastName ?? ""}`.toLowerCase();
    return allowedSubjects.some(subject => text.includes(subject));
  };

  const likeMutation = useMutation({
    mutationFn: async (postId: number) => {
      const res = await apiRequest("POST", `/api/posts/${postId}/like`);
      return res.json();
    },
    onMutate: async (postId: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/posts"] });
      const previous = queryClient.getQueryData<any[]>(["/api/posts"]);
      queryClient.setQueryData<any[]>(["/api/posts"], (old) =>
        old?.map((p) =>
          p.id === postId
            ? {
                ...p,
                hasLiked: !p.hasLiked,
                likesCount: p.hasLiked ? (p.likesCount ?? 1) - 1 : (p.likesCount ?? 0) + 1,
              }
            : p
        )
      );
      return { previous };
    },
    onSuccess: (data: any) => {
      if (data?.added) playLike(); else playUnlike();
    },
    onError: (_err, _postId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["/api/posts"], ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const isVideoPost = (post: any) => post.type === "video" || post.type === "live" || post.type === "reel";
  const isPhotoPost = (post: any) => post.type === "post" || post.type === "story";

  const filteredPosts = (posts ?? []).filter((post) => {
    if (activeCategory === "All") return true;
    if (activeCategory === "Trending") return (post.likesCount ?? 0) >= 0;
    if (activeCategory === "Reels") return post.type === "reel" || post.type === "video";
    if (activeCategory === "Music") return post.caption?.toLowerCase().includes("music") || post.caption?.toLowerCase().includes("song");
    if (activeCategory === "Gaming") return post.caption?.toLowerCase().includes("gaming") || post.caption?.toLowerCase().includes("game");
    if (activeCategory === "Food") return post.caption?.toLowerCase().includes("food") || post.caption?.toLowerCase().includes("eat");
    if (activeCategory === "Travel") return post.caption?.toLowerCase().includes("travel") || post.caption?.toLowerCase().includes("trip");
    if (activeCategory === "Tech") return post.caption?.toLowerCase().includes("tech") || post.caption?.toLowerCase().includes("code");
    if (activeCategory === "World") return post.type === "post";
    return true;
  });

 type FeedItem = { kind: "post"; data: any } | { kind: "recommended"; data: any };
const combinedFeed: FeedItem[] = [];
let ytIndex = 0;
filteredPosts.forEach((post, i) => {
  combinedFeed.push({ kind: "post", data: post });
  if ((i + 1) % 4 === 0 && recommendedVideos.length > 0) {
    combinedFeed.push({ kind: "recommended", data: recommendedVideos[ytIndex % recommendedVideos.length] });
    ytIndex++;
  }
});

  return (
    <div className="min-h-screen bg-black pb-28">
      <Header />

      <main className="mx-auto max-w-[720px]" style={{ paddingTop: "var(--header-total)" }}>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5 sticky z-40 bg-black/95 backdrop-blur border-b border-white/5" style={{ top: "var(--header-total)" }}>
          {CATEGORIES.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setActiveCategory(label)}
              className={`flex items-center gap-1.5 shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 ${
                activeCategory === label
                  ? "bg-white text-black"
                  : "bg-white/10 text-zinc-400 hover:bg-white/15 hover:text-white"
              }`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>

        <div className="mt-1 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎙️</span>
              <span className="text-[13px] font-black text-white tracking-wide">
                Voice Rooms
              </span>
            </div>
            <button
              onClick={() => navigate("/voice-rooms/create")}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
            >
              + Create <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {voiceRooms.length === 0 ? (
            <div className="px-3 py-4">
              <button
                onClick={() => navigate("/voice-rooms/create")}
                className="w-full py-4 rounded-xl border border-dashed border-white/15 text-zinc-500 text-[12px] hover:border-white/30 hover:text-zinc-300 transition-colors"
              >
                No active rooms — tap to start one 🎙️
              </button>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto scrollbar-hide px-3">
              {voiceRooms.map((room: any) => (
                <button
                  key={room.id}
                  onClick={() => navigate(`/voice-rooms/${room.id}`)}
                  className="flex flex-col items-start gap-1.5 shrink-0 group w-[120px]"
                >
                  <div className="w-[120px] h-[100px] rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 relative flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #2a0a3a, #150520)" }}>
                    <img
                      src={room.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.host_id}`}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-500/40"
                    />
                    <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <div className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
                    </div>
                    <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      {room.seat_count}/12
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-300 font-semibold text-left line-clamp-1 leading-tight w-full">
                    {room.title}
                  </p>
                  <p className="text-[9px] text-zinc-600 text-left truncate w-full">
                    {room.first_name} {room.last_name}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-1 pb-2 border-b border-white/5">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-pink-500 to-purple-500" />
              <span className="text-[13px] font-black text-white tracking-wide">Stories</span>
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <span className="text-[10px] text-zinc-600">Visible to everyone</span>
          </div>

          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-3">
            <div className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
              <div className="w-[88px] h-[148px] rounded-xl relative overflow-hidden"
                style={{
                  background: "linear-gradient(160deg, #1a0030 0%, #0d001a 50%, #000 100%)",
                  border: "1px solid rgba(236,72,153,0.3)",
                  boxShadow: "0 0 18px rgba(236,72,153,0.2)",
                }}>
                {user?.profileImageUrl && (
                  <img src={user.profileImageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                )}
                <div className="absolute top-4 left-1/2 -translate-x-1/2">
                  <div className="w-14 h-14 rounded-full p-[2.5px] group-hover:scale-105 transition-transform"
                    style={{ background: "conic-gradient(from 0deg, #ec4899, #a855f7, #f97316, #ec4899)" }}>
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                      <Plus className="w-5 h-5 text-pink-400" />
                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-30"
                  style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(236,72,153,0.5), transparent 65%)" }} />
                <div className="absolute bottom-0 left-0 right-0 py-2 text-center"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)" }}>
                  <span className="text-[8px] font-black text-pink-400 uppercase tracking-widest">+ Story</span>
                </div>
              </div>
              <span className="text-[10px] text-pink-400/80 font-semibold">Your story</span>
            </div>

            {(() => {
              const storyList = stories;
              if (storyList.length === 0) {
                return REELS.map((reel) => (
                  <div key={reel.id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
                    <div className="w-[88px] h-[148px] rounded-xl overflow-hidden relative">
                      <img src={reel.thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border-2 border-black overflow-hidden">
                        <img src={reel.avatar} className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <span className="text-[9px] text-zinc-500 font-medium mt-2 max-w-[80px] truncate text-center">{reel.user}</span>
                  </div>
                ));
              }
              return storyList.map((story, i) => {
                const authorName = story.user ? `${story.user.firstName}` : "User";
                const authorAvatar = story.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.user?.firstName}`;
                return (
                  <div
                    key={story.id}
                    className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
                    onClick={() => setViewingStoryIdx(i)}
                    data-testid={`story-item-${story.id}`}
                  >
                    <div className="w-[88px] h-[148px] rounded-xl overflow-hidden relative"
                      style={{ border: "2px solid transparent", background: "linear-gradient(#111,#111) padding-box, linear-gradient(135deg,#ec4899,#a855f7,#f97316) border-box" }}>
                      <div className="absolute inset-0"
                        style={{ background: `linear-gradient(135deg, hsl(${(story.id * 53) % 360}, 60%, 14%), hsl(${(story.id * 53 + 140) % 360}, 50%, 18%))` }} />
                    {story.mediaUrl && !story.mediaUrl.startsWith("blob:") ? (
                        story.type === "video" ? (
                          <video
                            src={story.mediaUrl}
                            className="absolute inset-0 w-full h-full object-contain bg-black"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={story.mediaUrl}
                            alt="Story"
                            className="absolute inset-0 w-full h-full object-contain bg-black"
                          />
                        )
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-2">
                          <p className="text-[9px] text-white/60 text-center leading-tight line-clamp-4">{story.caption || "✨"}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full p-[2px]"
                        style={{ background: "linear-gradient(135deg, #ec4899, #a855f7, #f97316)" }}>
                        <div className="w-full h-full rounded-full overflow-hidden border border-black">
                          <img src={authorAvatar} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] text-zinc-400 font-medium max-w-[80px] truncate text-center">{authorName}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <FollowSuggestions currentUserId={user?.id} onNavigate={navigate} />

        <div className="mt-1">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="mb-4">
                <Skeleton className="w-full h-52 rounded-none" />
                <div className="flex gap-3 px-3 pt-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              </div>
            ))
          ) : combinedFeed.length === 0 ? (
            <div className="text-center py-20 text-zinc-600">
              <Play className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No posts yet. Be the first!</p>
            </div>
          ) : (
            combinedFeed.map((item, index) => {
           if (item.kind === "recommended") {
    return (
      <RecommendedVideoCard
        key={`rec-${item.data.videoId}`}
        video={item.data}
        onSkip={(videoId) => console.log("skipped:", videoId)}
      />
    );
}

             const post = item.data;
             const isVideo = isVideoPost(post);
             const isPhoto = isPhotoPost(post);
             const isReel = post.type === "reel";
             const aspectClass = isReel ? "aspect-[9/16]" : isVideo ? "aspect-video" : "aspect-[3/4]";
              return (
                <div key={post.id} className="mb-1 group cursor-pointer rounded-3xl overflow-hidden border border-white/5">
                  <div className={`relative w-full ${aspectClass} bg-zinc-900 overflow-hidden rounded-3xl border border-white/5`}>
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360}, 40%, 14%), hsl(${(post.id * 47 + 120) % 360}, 50%, 20%))` }}
                    >
                      {isPhoto
                        ? <Image className="w-12 h-12 text-white/15" />
                        : <Film className="w-12 h-12 text-white/15" />}
                    </div>

                    {isVideo && (post as any).videoUrl ? (
                     <VideoPlayer
                      src={(post as any).videoUrl}
                      poster={post.imageUrl && !post.imageUrl.startsWith("blob:") ? post.imageUrl : undefined}
                     loop
                     songTitle={(post as any).songTitle}
                     songArtist={(post as any).songArtist}
                     songColor={(post as any).songColor}
                     className="absolute inset-0 w-full h-full"
                     precacheSrc={posts?.filter(p => p.type === "video" && (p as any).videoUrl)?.[
                     posts?.filter(p => p.type === "video" && (p as any).videoUrl).indexOf(post) + 1
                     ]?.videoUrl ?? null}
                    />
                    ) : post.imageUrl && !post.imageUrl.startsWith("blob:") ? (
                      <img
                        src={post.imageUrl}
                        alt=""
                        className={`absolute inset-0 w-full h-full ${isPhoto ? "object-contain" : "object-cover"} group-hover:scale-[1.02] transition-transform duration-300`}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    ) : null}

                    {isVideo && !(post as any).videoUrl && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                          <Play className="w-7 h-7 text-white fill-white ml-1" />
                        </div>
                      </div>
                    )}

                    {isPhoto && post.imageUrl && !post.imageUrl.startsWith("blob:") && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Image className="w-2.5 h-2.5" /> Photo
                      </div>
                    )}

                    {post.type === "live" && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                      </div>
                    )}

                    {post.type === "reel" && (
                      <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 text-pink-400 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                        <Play className="w-2 h-2 fill-current" /> REEL
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 px-3 py-3">
                    <button
                      className="shrink-0"
                      onClick={() => navigate(`/profile/${post.userId}`)}
                      data-testid={`avatar-user-${post.userId}`}
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800">
                        <img
                          src={post.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.firstName}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-1">
                        {post.caption || `${post.user?.firstName}'s ${post.type === "live" ? "Live Stream" : post.type === "reel" ? "Reel" : post.type === "story" ? "Story" : "Post"}`}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <button
  className="flex flex-wrap items-center gap-1 hover:text-white transition-colors text-left"
  onClick={() => navigate(`/profile/${post.userId}`)}
  data-testid={`link-user-${post.userId}`}
>
  <span>
    @{(post.user as any)?.username ||
      post.user?.firstName?.toLowerCase()}
  </span>

  {post.user?.isCelebrity && (
    <CheckCircle2 className="w-3 h-3 text-blue-400 fill-blue-400" />
  )}

  {(post.user as any)?.signatureActive &&
   (post.user as any)?.premiumSignature &&
   (
     !(post.user as any)?.signatureExpiresAt ||
     new Date(
       (post.user as any).signatureExpiresAt
     ) > new Date()
   ) && (
    <span
      title="Premium Signature"
      className="
        inline-flex
        items-center
        gap-0.5
        px-1.5
        py-0.5
        rounded-full
        bg-gradient-to-r
        from-pink-500/20
        to-violet-500/20
        border
        border-pink-400/30
        text-pink-300
        text-[8px]
        font-bold
      "
    >
      ✦ Premium
    </span>
  )}
</button>
                           <FollowButtonSmall userId={post.userId} currentUserId={user?.id} />
                        <span>·</span>
                        <span>{post.likesCount || 0} likes</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        <button
                          data-testid={`button-like-${post.id}`}
                          onClick={() => likeMutation.mutate(post.id)}
                          className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${post.hasLiked ? "text-red-400" : "text-zinc-500 hover:text-white"}`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${post.hasLiked ? "fill-current" : ""}`} />
                          {post.likesCount > 0 ? post.likesCount : "Like"}
                        </button>
                        <button
                          data-testid={`button-comment-${post.id}`}
                          onClick={() => setOpenCommentPostId(post.id)}
                          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {post.commentsCount > 0 ? post.commentsCount : "Comment"}
                        </button>
                        <button
                          data-testid={`button-share-${post.id}`}
                          onClick={() => sharePost(post)}
                          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          Share
                        </button>
                      </div>
                    </div>

                    <button
                      data-testid={`button-post-menu-${post.id}`}
                      onClick={() => setActionMenuPost(post)}
                      className="shrink-0 text-zinc-600 hover:text-white transition-colors self-start mt-0.5 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="h-px bg-white/5 mx-3" />

                  {index === 1 && (
                    <div className="mx-3 my-2">
                      <BannerAd placement="feed" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {openCommentPostId !== null && (
        <CommentsDrawer
          postId={openCommentPostId}
          open={openCommentPostId !== null}
          onClose={() => setOpenCommentPostId(null)}
        />
      )}

      {actionMenuPost && (
        <PostActionMenu
          post={actionMenuPost}
          isOwner={actionMenuPost.userId === user?.id}
          onClose={() => setActionMenuPost(null)}
        />
      )}

      {livePost && (
        <LiveStreamViewer post={livePost} onClose={() => setLivePost(null)} />
      )}

      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          onClose={() => setViewingPost(null)}
          allPosts={posts?.filter(p => p.type === viewingPost.type) ?? []}
        />
      )}

      {viewingStoryIdx !== null && (
        <StoryViewer
          stories={stories as any}
          initialIndex={viewingStoryIdx}
          onClose={() => {
            setViewingStoryIdx(null);
            refetchStories();
          }}
        />
      )}
    </div>
  );
}