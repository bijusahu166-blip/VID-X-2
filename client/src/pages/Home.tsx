import { usePosts } from "@/hooks/use-posts";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { BannerAd } from "@/components/ads/BannerAd";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Play, ThumbsUp, ThumbsDown, Share2, MoreVertical,
  MessageSquare, Eye, ChevronRight, Flame, Music,
  Globe, Gamepad2, Utensils, Plane, Cpu, Plus,
  CheckCircle2, Zap, Film, X, Send, Loader2, Image
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

  const { data: comments, isLoading } = useQuery<any[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: () => fetch(`/api/posts/${postId}/comments`, { credentials: "include" }).then(r => r.json()),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });

  const addComment = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/posts/${postId}/comment`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto rounded-t-3xl bg-zinc-950 border-t border-zinc-800 flex flex-col" style={{ maxHeight: "75vh" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
          <span className="text-sm font-black text-white">
            Comments {comments ? `(${comments.length})` : ""}
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Comment list */}
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
                      {c.user ? `${c.user.firstName} ${c.user.lastName}` : "User"}
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
        {/* Input */}
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
    </div>
  );
}

async function sharePost(post: any) {
  const url = `${window.location.origin}/post/${post.id}`;
  const title = post.caption || "Check this out on VID-X";
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

export default function Home() {
  const { data: posts, isLoading } = usePosts();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [openCommentPostId, setOpenCommentPostId] = useState<number | null>(null);

  const likeMutation = useMutation({
    mutationFn: (postId: number) => apiRequest("POST", `/api/posts/${postId}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/posts"] }),
  });

  const isVideoPost = (post: any) => post.type === "video" || post.type === "live" || post.type === "reel";
  const isPhotoPost = (post: any) => post.type === "post" || post.type === "story";

  return (
    <div className="min-h-screen bg-black pb-28">
      <Header />

      <main className="pt-14">

        {/* ── CATEGORY CHIPS ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-3 py-2.5 sticky top-14 z-40 bg-black/95 backdrop-blur border-b border-white/5">
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

        {/* ── STORIES SHELF ── */}
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
            {/* Add your story card */}
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

            {/* Real stories from ALL users */}
            {posts?.filter(p => p.type === "story").map((story) => {
              const authorName = story.user ? `${story.user.firstName}` : "User";
              const authorAvatar = story.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${story.user?.firstName}`;
              const isLive = story.type === "live";
              return (
                <div key={story.id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
                  <div className="w-[88px] h-[148px] rounded-xl overflow-hidden relative">
                    {/* Gradient ring around avatar for stories */}
                    <div className="absolute inset-0"
                      style={{ background: `linear-gradient(135deg, hsl(${(story.id * 53) % 360}, 60%, 14%), hsl(${(story.id * 53 + 140) % 360}, 50%, 18%))` }} />

                    {story.imageUrl && !story.imageUrl.startsWith("blob:") ? (
                      <img
                        src={story.imageUrl}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                        <p className="text-[9px] text-white/60 text-center leading-tight line-clamp-4">
                          {story.caption || "Story"}
                        </p>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                    {isLive && (
                      <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wide flex items-center gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                    )}

                    {/* Gradient ring avatar at bottom */}
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
            })}

            {/* Fallback: no stories yet — show placeholder cards */}
            {posts?.filter(p => p.type === "story").length === 0 && (
              REELS.map((reel) => (
                <div key={reel.id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
                  <div className="w-[88px] h-[148px] rounded-xl overflow-hidden relative">
                    <img
                      src={reel.thumb}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    {reel.live && (
                      <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wide flex items-center gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </div>
                    )}
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border-2 border-black overflow-hidden">
                      <img src={reel.avatar} className="w-full h-full object-cover" />
                    </div>
                  </div>
                  <span className="text-[9px] text-zinc-500 font-medium mt-2 max-w-[80px] truncate text-center">{reel.user}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── MAIN FEED ── */}
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
          ) : posts?.length === 0 ? (
            <div className="text-center py-20 text-zinc-600">
              <Play className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No posts yet. Be the first!</p>
            </div>
          ) : (
            posts?.map((post, index) => {
              const isVideo = isVideoPost(post);
              const isPhoto = isPhotoPost(post);
              return (
                <div key={post.id} className="mb-1 group cursor-pointer">
                  {/* Thumbnail / media */}
                  <div className={`relative w-full ${isPhoto ? "aspect-square" : "aspect-video"} bg-zinc-900 overflow-hidden`}>
                    {/* Background gradient */}
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360}, 40%, 14%), hsl(${(post.id * 47 + 120) % 360}, 50%, 20%))` }}
                    >
                      {isPhoto
                        ? <Image className="w-12 h-12 text-white/15" />
                        : <Film className="w-12 h-12 text-white/15" />}
                    </div>

                    {/* Media */}
                    {post.imageUrl && !post.imageUrl.startsWith("blob:") && (
                      <img
                        src={post.imageUrl}
                        alt=""
                        className={`absolute inset-0 w-full h-full ${isPhoto ? "object-contain" : "object-cover"} group-hover:scale-[1.02] transition-transform duration-300`}
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                      />
                    )}

                    {/* Video: duration badge + play overlay */}
                    {isVideo && (
                      <>
                        <div className="absolute bottom-2 right-2 bg-black/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                          {`${Math.floor(Math.random() * 15) + 1}:${Math.floor(Math.random() * 60).toString().padStart(2, "0")}`}
                        </div>
                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                            <Play className="w-7 h-7 text-white fill-white ml-1" />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Photo: no play button, but show full image */}
                    {isPhoto && post.imageUrl && !post.imageUrl.startsWith("blob:") && (
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Image className="w-2.5 h-2.5" /> Photo
                      </div>
                    )}

                    {/* LIVE badge */}
                    {post.type === "live" && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                      </div>
                    )}

                    {/* Reel badge */}
                    {post.type === "reel" && (
                      <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 text-pink-400 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                        <Play className="w-2 h-2 fill-current" /> REEL
                      </div>
                    )}
                  </div>

                  {/* Info row */}
                  <div className="flex gap-3 px-3 py-3">
                    <div className="shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800">
                        <img
                          src={post.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.firstName}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-1">
                        {post.caption || `${post.user?.firstName}'s ${post.type === "live" ? "Live Stream" : post.type === "reel" ? "Reel" : post.type === "story" ? "Story" : "Post"}`}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          {post.user?.firstName} {post.user?.lastName}
                          {post.user?.isCelebrity && <CheckCircle2 className="w-3 h-3 text-blue-400 fill-blue-400" />}
                        </span>
                        <span>·</span>
                        <span>{post.likesCount || 0} likes</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                      </div>

                      {/* Actions */}
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

                    <button className="shrink-0 text-zinc-600 hover:text-white transition-colors self-start mt-0.5">
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

      <BottomNav />

      {/* Comments Drawer */}
      {openCommentPostId !== null && (
        <CommentsDrawer
          postId={openCommentPostId}
          open={openCommentPostId !== null}
          onClose={() => setOpenCommentPostId(null)}
        />
      )}
    </div>
  );
}
