import { X, Heart, MessageCircle, Share2, Play, ChevronLeft, ChevronRight, Bookmark, Send, Loader2, MessageSquare } from "lucide-react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { playLike, playUnlike } from "@/lib/sounds";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";

interface PostViewerModalProps {
  post: any;
  onClose: () => void;
  allPosts?: any[];
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

function CommentsSheet({ postId, open, onClose }: { postId: number; open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const { data: comments, isLoading } = useQuery<any[]>({
    queryKey: ["/api/posts", postId, "comments"],
    queryFn: () => fetch(`/api/posts/${postId}/comments`, { credentials: "include" }).then(r => r.json()),
    enabled: open,
    refetchInterval: open ? 4000 : false,
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
    <div
      className="fixed inset-0 z-[200] flex items-end"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto rounded-t-3xl bg-zinc-950 border-t border-zinc-800 flex flex-col" style={{ maxHeight: "78vh" }}>
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
          <span className="text-sm font-black text-white">
            Comments {comments ? `(${comments.length})` : ""}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
            data-testid="button-close-comments"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
            </div>
          ) : !comments?.length ? (
            <div className="text-center py-10">
              <MessageSquare className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No comments yet. Be the first!</p>
            </div>
          ) : (
            comments.map((c: any) => (
              <div key={c.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                  <img
                    src={c.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`}
                    className="w-full h-full object-cover"
                    alt=""
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
              src={(user as any)?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
              className="w-full h-full object-cover"
              alt=""
            />
          </div>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && text.trim()) addComment.mutate(text.trim()); }}
            placeholder="Add a comment…"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-1.5 text-[12px] text-white placeholder:text-zinc-600 outline-none focus:border-zinc-500"
            data-testid="input-comment-modal"
          />
          <button
            onClick={() => text.trim() && addComment.mutate(text.trim())}
            disabled={!text.trim() || addComment.isPending}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 disabled:opacity-40 transition-all"
            data-testid="button-send-comment-modal"
          >
            {addComment.isPending
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export function PostViewerModal({ post: initialPost, onClose, allPosts }: PostViewerModalProps) {
  const [currentPost, setCurrentPost] = useState(initialPost);
  const [, navigate] = useLocation();
  const [showComments, setShowComments] = useState(false);

  const idx = allPosts?.findIndex(p => p.id === currentPost.id) ?? -1;
  const hasPrev = idx > 0;
  const hasNext = allPosts && idx < allPosts.length - 1;
  const prev = () => allPosts && idx > 0 && setCurrentPost(allPosts[idx - 1]);
  const next = () => allPosts && idx < allPosts.length - 1 && setCurrentPost(allPosts[idx + 1]);

  const { data: comments } = useQuery<any[]>({
    queryKey: ["/api/posts", currentPost.id, "comments"],
    queryFn: () => fetch(`/api/posts/${currentPost.id}/comments`, { credentials: "include" }).then(r => r.json()),
  });

  const [liked, setLiked] = useState(!!currentPost.hasLiked);
  const [likeCount, setLikeCount] = useState(currentPost.likesCount ?? 0);
  const [saved, setSaved] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);

  const likeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/posts/${currentPost.id}/like`, {}),
    onSuccess: (data: any) => {
      const added = data?.added ?? !liked;
      setLiked(added);
      setLikeCount((n: number) => added ? n + 1 : Math.max(0, n - 1));
      if (added) playLike(); else playUnlike();
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/posts/${currentPost.id}/save`, {}),
    onSuccess: (data: any) => {
      setSaved(!!data?.saved);
    },
  });

  const handleShare = async () => {
    await sharePost(currentPost);
    setShareFlash(true);
    setTimeout(() => setShareFlash(false), 1500);
  };

  const isVideo = currentPost.type === "video" || currentPost.type === "reel";
  const author = currentPost.user;
  const authorName = author ? `${author.firstName} ${author.lastName}` : "Unknown";
  const authorHandle = `@${(author as any)?.username || author?.firstName?.toLowerCase() || "user"}`;
  const authorAvatar = author?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.firstName}`;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 pt-safe-top bg-black/80 backdrop-blur border-b border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center"
            data-testid="button-close-post-viewer"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <button
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => { onClose(); navigate(`/profile/${currentPost.userId}`); }}
          >
            <img src={authorAvatar} alt={authorName} className="w-8 h-8 rounded-full object-cover border border-white/10" />
            <div className="min-w-0">
              <p className="text-white text-sm font-bold leading-none truncate">{authorName}</p>
              <p className="text-zinc-500 text-[11px] mt-0.5 truncate">{authorHandle}</p>
            </div>
          </button>
          {allPosts && allPosts.length > 1 && (
            <div className="flex gap-1 shrink-0">
              <button onClick={prev} disabled={!hasPrev} className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center disabled:opacity-30">
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
              <button onClick={next} disabled={!hasNext} className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center disabled:opacity-30">
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Media */}
        <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
          {isVideo && (currentPost as any).videoUrl ? (
            <video
              src={(currentPost as any).videoUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
              data-testid={`post-viewer-video-${currentPost.id}`}
            />
          ) : currentPost.imageUrl && !currentPost.imageUrl.startsWith("blob:") ? (
            <img
              src={currentPost.imageUrl}
              alt={currentPost.caption || ""}
              className="w-full h-full object-contain"
              data-testid={`post-viewer-img-${currentPost.id}`}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, hsl(${(currentPost.id * 47) % 360}, 40%, 14%), hsl(${(currentPost.id * 47 + 120) % 360}, 50%, 20%))` }}
            >
              {isVideo && <Play className="w-16 h-16 text-white/30" />}
            </div>
          )}

          {allPosts && allPosts.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
              {allPosts.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white" : "bg-white/30"}`} />
              ))}
            </div>
          )}
        </div>

        {/* Actions + Caption */}
        <div className="bg-zinc-950 border-t border-white/5 px-4 py-3 space-y-3 shrink-0">
          <div className="flex items-center gap-5">
            {/* Like */}
            <button
              className={`flex items-center gap-1.5 transition-transform active:scale-90 ${liked ? "text-red-500" : "text-zinc-400"}`}
              onClick={() => likeMutation.mutate()}
              data-testid={`button-like-${currentPost.id}`}
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-red-500" : ""}`} />
              <span className="text-xs font-bold">{likeCount}</span>
            </button>

            {/* Comment */}
            <button
              className="flex items-center gap-1.5 text-zinc-400 active:scale-90 transition-transform"
              onClick={() => setShowComments(true)}
              data-testid={`button-comment-viewer-${currentPost.id}`}
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-bold">{comments?.length ?? currentPost.commentsCount ?? 0}</span>
            </button>

            {/* Share */}
            <button
              className={`flex items-center gap-1.5 active:scale-90 transition-all ${shareFlash ? "text-violet-400" : "text-zinc-400"}`}
              onClick={handleShare}
              data-testid={`button-share-viewer-${currentPost.id}`}
            >
              <Share2 className="w-5 h-5" />
            </button>

            {/* Bookmark / Save */}
            <button
              className={`flex items-center gap-1.5 active:scale-90 transition-all ml-auto ${saved ? "text-yellow-400" : "text-zinc-400"}`}
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid={`button-save-viewer-${currentPost.id}`}
            >
              <Bookmark className={`w-5 h-5 ${saved ? "fill-yellow-400" : ""}`} />
            </button>
          </div>

          {saved && (
            <p className="text-[11px] text-yellow-400/80">Saved to your bookmarks</p>
          )}

          {currentPost.caption ? (
            <p className="text-white text-sm leading-snug">
              <span className="font-bold mr-1">{author?.firstName}</span>
              {currentPost.caption}
            </p>
          ) : null}

          {/* Comments preview – tap to open full sheet */}
          {comments && comments.length > 0 && (
            <button
              className="w-full text-left space-y-1.5 max-h-24 overflow-hidden"
              onClick={() => setShowComments(true)}
            >
              {comments.slice(0, 2).map((c: any) => (
                <div key={c.id} className="flex gap-2 items-start">
                  <img
                    src={c.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.userId}`}
                    className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5"
                    alt=""
                  />
                  <p className="text-[11px] text-zinc-300 leading-tight">
                    <span className="font-bold text-white mr-1">{c.user?.firstName ?? "User"}</span>
                    {c.content}
                  </p>
                </div>
              ))}
              {comments.length > 2 && (
                <p className="text-[11px] text-zinc-500 pl-7">View all {comments.length} comments…</p>
              )}
            </button>
          )}
        </div>
      </motion.div>

      {/* Full comments sheet */}
      <CommentsSheet
        postId={currentPost.id}
        open={showComments}
        onClose={() => setShowComments(false)}
      />
    </AnimatePresence>
  );
}
