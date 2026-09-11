import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Trash2, X, Volume2, VolumeX, Heart, Send, MessageCircle, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiUrl} from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type Story = {
  id: number | string;
  userId?: string | number;
  mediaUrl?: string | null;
  type?: string | null;
  caption?: string | null;
  createdAt?: string | Date | null;
  expiresAt?: string | Date | null;
  user?: {
    id?: string | number;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    profileImageUrl?: string | null;
  };
};

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Story[]>(stories ?? []);
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, Math.max(0, (stories?.length ?? 1) - 1))));
  const [muted, setMuted] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setItems(stories ?? []);
    setIndex(Math.max(0, Math.min(initialIndex, Math.max(0, (stories?.length ?? 1) - 1))));
  }, [stories, initialIndex]);

  const story = items[index];
  const isOwnStory = !!story && String(story.userId ?? story.user?.id) === String(user?.id);

  const authorName = useMemo(() => {
    if (!story?.user) return "User";
    return story.user.firstName || story.user.username || "User";
  }, [story]);

  // Reset the comment/reply UI whenever the visible story changes.
  useEffect(() => {
    setCommentText("");
    setShowComments(false);
    setIsInputFocused(false);
  }, [story?.id]);

  // Auto-advance is paused while the person is typing a reply or reading
  // replies — otherwise the story would jump away mid-comment.
  useEffect(() => {
    if (!story) {
      onClose();
      return;
    }
    if (isInputFocused || showComments) return;

    const timer = window.setTimeout(() => {
      if (index < items.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [story?.id, index, items.length, onClose, story, isInputFocused, showComments]);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (index < items.length - 1) setIndex((i) => i + 1);
    else onClose();
  };

  const deleteStory = async () => {
    if (!story || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/stories/${story.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to delete story");

      const nextItems = items.filter((item) => String(item.id) !== String(story.id));
      setItems(nextItems);

      toast({ title: "Story deleted", description: "Your story was removed." });

      if (nextItems.length === 0) {
        onClose();
      } else if (index >= nextItems.length) {
        setIndex(nextItems.length - 1);
      }
    } catch (err: any) {
      toast({
        title: "Could not delete story",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // ── Real likes — backed by /api/stories/:id/like(s), same as posts ──
  const likesQueryKey = ["/api/stories", story?.id, "likes"];
  const { data: likesData } = useQuery<any[]>({
    queryKey: likesQueryKey,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/stories/${story!.id}/likes`), { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!story,
  });
  const likes = likesData ?? [];
  const isLiked = !!user?.id && likes.some((u: any) => String(u.id) === String(user.id));
  const likesCount = likes.length;

  const toggleLikeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl(`/api/stories/${story!.id}/like`), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update like");
      return res.json();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: likesQueryKey });
      const previous = queryClient.getQueryData<any[]>(likesQueryKey) ?? [];
      const alreadyLiked = !!user?.id && previous.some((u: any) => String(u.id) === String(user.id));
      const next = alreadyLiked
        ? previous.filter((u: any) => String(u.id) !== String(user?.id))
        : [...previous, { id: user?.id, first_name: (user as any)?.firstName, profile_image_url: (user as any)?.profileImageUrl }];
      queryClient.setQueryData(likesQueryKey, next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(likesQueryKey, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: likesQueryKey });
    },
  });

  // ── Real replies/comments — backed by /api/stories/:id/comment(s) ──
  const commentsQueryKey = ["/api/stories", story?.id, "comments"];
  const { data: commentsData, isLoading: commentsLoading } = useQuery<any[]>({
    queryKey: commentsQueryKey,
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/stories/${story!.id}/comments`), { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!story && showComments,
  });
  const comments = commentsData ?? [];

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(apiUrl(`/api/stories/${story!.id}/comment`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      toast({ title: "Sent!" });
    },
    onError: () => {
      toast({ title: "Could not send", variant: "destructive" });
    },
  });

  const handleSendComment = () => {
    const text = commentText.trim();
    if (!text || addCommentMutation.isPending) return;
    addCommentMutation.mutate(text);
  };

  if (!story) return null;

  const isVideo = story.type === "video" || /\.(mp4|webm|mov|mkv|3gp)(\?|$)/i.test(story.mediaUrl || "");
  const media = story.mediaUrl || "";

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-black flex items-center justify-center overflow-hidden"
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const dx = endX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > 50) dx > 0 ? goPrev() : goNext();
      }}
    >
      {/* Blurred backdrop is decorative only — fills any leftover space on wide screens */}
      {media && (
        <>
          {isVideo ? (
            <video src={media} className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30" muted playsInline />
          ) : (
            <img src={media} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30" />
          )}
          <div className="absolute inset-0 bg-black/35" />
        </>
      )}

      <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex gap-1">
          {items.map((item, i) => (
            <div key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className={`h-full rounded-full bg-white transition-all duration-200 ${i < index ? "w-full" : i === index ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/50 bg-zinc-800 shrink-0">
            {story.user?.profileImageUrl ? (
              <img src={story.user.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold">{authorName[0]?.toUpperCase() || "U"}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-bold truncate">{authorName}</p>
            <p className="text-white/60 text-[10px]">{story.createdAt ? new Date(story.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</p>
          </div>

          {isOwnStory && (
            <button
              type="button"
              onClick={deleteStory}
              disabled={deleting}
              className="w-10 h-10 rounded-full bg-red-500/90 flex items-center justify-center text-white disabled:opacity-50"
              aria-label="Delete story"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          {isVideo && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="w-10 h-10 rounded-full bg-black/55 border border-white/10 flex items-center justify-center text-white"
              aria-label={muted ? "Unmute story" : "Mute story"}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-full bg-black/55 border border-white/10 flex items-center justify-center text-white" aria-label="Close story">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button type="button" onClick={goPrev} disabled={index === 0} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/35 text-white flex items-center justify-center disabled:opacity-20" aria-label="Previous story">
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* ── Instagram-style stage: fills the full screen height at a 9:16 frame, media crops to fill it ── */}
      <div className="relative z-10 h-full flex items-center justify-center">
        <div className="relative h-full max-w-full overflow-hidden" style={{ aspectRatio: "9 / 16" }}>
          {media ? (
            isVideo ? (
              <video
                key={story.id}
                src={media}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                loop={false}
                muted={muted}
              />
            ) : (
              <img
                key={story.id}
                src={media}
                alt="Story"
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center px-8 text-center text-white text-xl font-bold bg-zinc-900">
              {story.caption || "✨"}
            </div>
          )}
        </div>
      </div>

      {story.caption && media && (
        <div className="absolute bottom-28 left-0 right-0 z-20 px-8 text-center pointer-events-none">
          <p className="inline-block max-w-[90%] rounded-xl bg-black/45 px-4 py-2 text-sm text-white">{story.caption}</p>
        </div>
      )}

      <button type="button" onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/35 text-white flex items-center justify-center" aria-label="Next story">
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* ── Like + reply bar, pinned to the bottom like Instagram ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 px-4 pt-8"
        style={{
          paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
        }}
      >
        <div className="flex items-center gap-4 mb-2">
          <button
            type="button"
            onClick={() => !isOwnStory && toggleLikeMutation.mutate()}
            disabled={isOwnStory || toggleLikeMutation.isPending}
            className="flex items-center gap-1.5 text-white/90 text-[12px] font-semibold disabled:opacity-90"
            aria-label={isLiked ? "Unlike story" : "Like story"}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "text-red-500 fill-red-500" : "text-white"}`} />
            {likesCount > 0 ? likesCount : "Like"}
          </button>
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className="flex items-center gap-1.5 text-white/90 text-[12px] font-semibold"
          >
            <MessageCircle className="w-4 h-4" />
            Replies
          </button>
        </div>

        {!isOwnStory && (
          <div className="flex items-center gap-2 pb-1">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }}
              placeholder="Send a message..."
              className="flex-1 bg-white/10 border border-white/25 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/60 outline-none backdrop-blur-sm"
            />
            {commentText.trim() && (
              <button
                type="button"
                onClick={handleSendComment}
                disabled={addCommentMutation.isPending}
                className="w-11 h-11 rounded-full bg-pink-500 flex items-center justify-center shrink-0 disabled:opacity-60"
                aria-label="Send reply"
              >
                {addCommentMutation.isPending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Replies sheet ── */}
      {showComments && (
        <div className="fixed inset-0 z-[10010] flex items-end" onClick={() => setShowComments(false)}>
          <div className="absolute inset-0 bg-black/70" />
          <div
            className="relative w-full max-w-md mx-auto rounded-t-3xl bg-zinc-950 border-t border-zinc-800 flex flex-col"
            style={{ maxHeight: "60vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-zinc-700" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 border-b border-zinc-800">
              <span className="text-sm font-black text-white">
                Replies {comments.length ? `(${comments.length})` : ""}
              </span>
              <button onClick={() => setShowComments(false)} className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-600">No replies yet. Be the first!</p>
                </div>
              ) : (
                comments.map((c: any) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                      <img
                        src={c.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.user_id}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] font-bold text-white">{c.first_name || "User"}</span>
                        <span className="text-[9px] text-zinc-600">
                          {c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <p className="text-[12px] text-zinc-300 mt-0.5 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!isOwnStory && (
              <div className="px-4 py-3 border-t border-zinc-800 flex gap-2 items-center">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }}
                  placeholder="Add a reply…"
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-3 py-1.5 text-[12px] text-white placeholder:text-zinc-600 outline-none focus:border-zinc-500"
                />
                <button
                  onClick={handleSendComment}
                  disabled={!commentText.trim() || addCommentMutation.isPending}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-pink-500 disabled:opacity-40 transition-all"
                >
                  {addCommentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export default StoryViewer;