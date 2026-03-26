import { X, Heart, MessageCircle, Share2, Play, ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { playLike, playUnlike } from "@/lib/sounds";
import { useLocation } from "wouter";

interface PostViewerModalProps {
  post: any;
  onClose: () => void;
  allPosts?: any[];
}

export function PostViewerModal({ post: initialPost, onClose, allPosts }: PostViewerModalProps) {
  const [currentPost, setCurrentPost] = useState(initialPost);
  const [, navigate] = useLocation();
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
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center" data-testid="button-close-post-viewer">
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

        {/* Media area */}
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

          {/* Swipe hint dots */}
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
          <div className="flex items-center gap-4">
            <button
              className={`flex items-center gap-1.5 transition-transform active:scale-90 ${liked ? "text-red-500" : "text-zinc-400"}`}
              onClick={() => likeMutation.mutate()}
              data-testid={`button-like-${currentPost.id}`}
            >
              <Heart className={`w-5 h-5 ${liked ? "fill-red-500" : ""}`} />
              <span className="text-xs font-bold">{likeCount}</span>
            </button>

            <button className="flex items-center gap-1.5 text-zinc-400">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-bold">{comments?.length ?? currentPost.commentsCount ?? 0}</span>
            </button>

            <button className="flex items-center gap-1.5 text-zinc-400 ml-auto">
              <Bookmark className="w-5 h-5" />
            </button>

            <button className="flex items-center gap-1.5 text-zinc-400">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          {currentPost.caption ? (
            <p className="text-white text-sm leading-snug">
              <span className="font-bold mr-1">{author?.firstName}</span>
              {currentPost.caption}
            </p>
          ) : null}

          {/* Comments preview */}
          {comments && comments.length > 0 && (
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {comments.slice(0, 3).map((c: any) => (
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
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
