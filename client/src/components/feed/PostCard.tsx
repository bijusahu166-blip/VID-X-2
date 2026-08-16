import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Send, Bookmark, CheckCircle2, MoreVertical, Flag, UserX, X, ChevronDown, Link2, Share2, MessageSquare } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { useLikePost, useAddComment } from "@/hooks/use-posts";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const REPORT_REASONS = [
  "Spam or misleading",
  "Inappropriate content",
  "Hate speech or symbols",
  "Violence or dangerous acts",
  "Nudity or sexual content",
  "Harassment or bullying",
  "False information",
];

interface PostCardProps {
  post: any;
}

export function PostCard({ post }: PostCardProps) {
  const [comment, setComment] = useState("");
  const likeMutation = useLikePost();
  const commentMutation = useAddComment();
  const [showHeart, setShowHeart] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [reported, setReported] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Optimistic like state — instantly responsive without waiting for server
  const [liked, setLiked] = useState<boolean>(!!post.hasLiked);
  const [likeCount, setLikeCount] = useState<number>(post.likesCount || 0);

  // Sync if parent data changes (e.g. after refetch)
  useEffect(() => { setLiked(!!post.hasLiked); }, [post.hasLiked]);
  useEffect(() => { setLikeCount(post.likesCount || 0); }, [post.likesCount]);

  // Comment section state
  const [showComments, setShowComments] = useState(false);
  const { data: commentsList, isLoading: commentsLoading } = useQuery<any[]>({
    queryKey: ["/api/posts", post.id, "comments"],
    queryFn: () => fetch(`/api/posts/${post.id}/comments`, { credentials: "include" }).then(r => r.json()),
    enabled: showComments,
  });

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLike = () => {
    // Optimistic update — flip immediately
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : Math.max(0, c - 1));
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);

    likeMutation.mutate(post.id, {
      onError: () => {
        // Roll back on failure
        setLiked(!newLiked);
        setLikeCount(c => newLiked ? Math.max(0, c - 1) : c + 1);
        toast({ title: "Could not like post", variant: "destructive" });
      },
      onSuccess: (data: any) => {
        // Sync exact count from server
        if (typeof data?.likesCount === "number") setLikeCount(data.likesCount);
        if (typeof data?.added === "boolean") setLiked(data.added);
      },
    });
  };

  const historyMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/history", {
        action: "view_post",
        targetId: post.id.toString(),
        metadata: `Viewed post by ${post.user?.firstName || "User"}`,
      });
    },
  });

  useEffect(() => { historyMutation.mutate(); }, []);

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    const text = comment;
    setComment("");
    setShowComments(true);
    commentMutation.mutate({ postId: post.id, content: text }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/posts", post.id, "comments"] });
      },
    });
  };

  // ── Report post ─────────────────────────────────────────────────────────────
  const reportMutation = useMutation({
    mutationFn: (reason: string) =>
      apiRequest("POST", `/api/posts/${post.id}/report`, { reason }),
    onSuccess: () => {
      setReported(true);
      setShowReportSheet(false);
      toast({ description: "Report submitted. We'll review this content." });
    },
  });

  // ── Block user ──────────────────────────────────────────────────────────────
  const blockMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/users/${post.user?.id}/block`, {}),
    onSuccess: () => {
      setShowMenu(false);
      toast({ description: `@${post.user?.username || post.user?.firstName} has been blocked.` });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  // ── Share post ───────────────────────────────────────────────────────────────
  const postUrl = `${window.location.origin}/post/${post.id}`;

  const handleNativeShare = async () => {
    const shareData = {
      title: `${post.user?.firstName}'s post on LITLink`,
      text: post.caption || "Check out this post on LITLink!",
      url: postUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShowShareSheet(false);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({ description: "Link copied to clipboard!" });
    } catch {
      toast({ description: "Could not copy link", variant: "destructive" });
    }
  };

  if (reported) {
    return (
      <Card className="border border-border/40 rounded-none sm:rounded-3xl mb-4 overflow-hidden bg-card">
        <div className="p-6 text-center space-y-2">
          <Flag className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold">Report submitted</p>
          <p className="text-xs text-muted-foreground">Thank you for helping keep this community safe.</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-border/40 shadow-none sm:border sm:shadow-sm rounded-none sm:rounded-3xl mb-4 overflow-hidden bg-card">
        <CardHeader className="flex flex-row items-center space-x-4 p-4">
          <Avatar className="w-10 h-10 ring-2 ring-transparent hover:ring-primary transition-all cursor-pointer">
            <AvatarImage src={post.user?.profileImageUrl || undefined} />
            <AvatarFallback>{post.user?.firstName?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-sm font-semibold hover:underline cursor-pointer truncate">
                {post.user?.firstName || "Anonymous"} {post.user?.lastName}
              </p>
              {post.user?.isCelebrity && (
                <CheckCircle2 className="w-3.5 h-3.5 fill-blue-500 text-white flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>

          {/* ── 3-dot menu ── */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(m => !m)}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
              data-testid="button-post-menu"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-8 z-50 min-w-[170px] rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden"
                >
                  <button
                    onClick={() => { setShowMenu(false); setShowShareSheet(true); }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors"
                    data-testid="button-share-post-menu"
                  >
                    <Share2 className="w-4 h-4" />
                    Share post
                  </button>
                  <div className="h-px bg-border/40 mx-3" />
                  <button
                    onClick={() => { setShowMenu(false); setShowReportSheet(true); }}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-amber-500"
                    data-testid="button-report-post"
                  >
                    <Flag className="w-4 h-4" />
                    Report post
                  </button>
                  <div className="h-px bg-border/40 mx-3" />
                  <button
                    onClick={() => blockMutation.mutate()}
                    className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-muted transition-colors text-red-500"
                    data-testid="button-block-user"
                    disabled={blockMutation.isPending}
                  >
                    <UserX className="w-4 h-4" />
                    {blockMutation.isPending ? "Blocking..." : `Block @${post.user?.username || post.user?.firstName || "user"}`}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardHeader>

        {/* ── Media ── */}
        <div
          className={`relative bg-black ${(post.type === "video" || post.type === "reel") && post.videoUrl ? "aspect-[9/16]" : "aspect-square"}`}
          onDoubleClick={handleLike}
        >
          {(post.type === "video" || post.type === "reel") && post.videoUrl ? (
            // Video / Reel — show actual playable video
            <video
              src={post.videoUrl}
              controls
              playsInline
              poster={post.imageUrl?.startsWith("data:") || post.imageUrl?.startsWith("http") ? post.imageUrl : undefined}
              className="w-full h-full object-contain bg-black"
              preload="metadata"
            />
          ) : (
            <img
              src={post.imageUrl}
              alt="Post content"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
          {/* Double-tap heart */}
          <AnimatePresence>
            {showHeart && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Video badge */}
          {(post.type === "video" || post.type === "reel") && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
              {post.type === "reel" ? "REEL" : "VIDEO"}
            </div>
          )}
        </div>

        <CardContent className="p-4 pb-2 bg-[#594f4f5c]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex space-x-4">
              <Button
                variant="ghost"
                size="icon"
                className={cn("hover:text-destructive hover:bg-destructive/10 -ml-2", liked && "text-destructive")}
                onClick={handleLike}
                disabled={likeMutation.isPending}
                data-testid={`button-like-${post.id}`}
              >
                <Heart className={cn("w-6 h-6 transition-all duration-150", liked ? "fill-destructive text-destructive scale-110" : "")} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowComments(v => !v)} data-testid={`button-comment-${post.id}`}>
                <MessageCircle className={cn("w-6 h-6", showComments && "text-primary")} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowShareSheet(true)} data-testid="button-share-post">
                <Send className="w-6 h-6" />
              </Button>
            </div>
            <Button variant="ghost" size="icon">
              <Bookmark className="w-6 h-6" />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm">{likeCount} {likeCount === 1 ? "like" : "likes"}</p>
            <p className="text-sm">
              <span className="font-semibold mr-2">{post.user?.firstName}:</span>
              {post.caption}
            </p>
            {post.commentsCount > 0 && (
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowComments(v => !v)}
                data-testid={`button-view-comments-${post.id}`}
              >
                {showComments ? "Hide comments" : `View all ${post.commentsCount} comment${post.commentsCount !== 1 ? "s" : ""}`}
              </button>
            )}
            {/* Comment list */}
            <AnimatePresence>
              {showComments && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {commentsLoading ? (
                    <div className="space-y-2 mt-1">
                      {[1, 2].map(i => (
                        <div key={i} className="flex gap-2 items-center animate-pulse">
                          <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                          <div className="h-3 bg-muted rounded w-3/4" />
                        </div>
                      ))}
                    </div>
                  ) : commentsList && commentsList.length > 0 ? (
                    <div className="space-y-2 mt-1">
                      {commentsList.map((c: any) => (
                        <div key={c.id} className="flex gap-2 items-start" data-testid={`comment-${c.id}`}>
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted shrink-0 mt-0.5">
                            {c.user?.profileImageUrl
                              ? <img src={c.user.profileImageUrl} className="w-full h-full object-cover" alt="" />
                              : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-500 text-white text-[9px] font-bold">{c.user?.firstName?.[0] ?? "?"}</div>
                            }
                          </div>
                          <p className="text-sm leading-snug">
                            <span className="font-semibold mr-1">{c.user?.firstName ?? "User"}</span>
                            {c.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No comments yet.</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <form onSubmit={handleComment} className="w-full flex gap-2 items-center">
            <Input
              placeholder="Add a comment..."
              className="border-none shadow-none focus-visible:ring-0 px-0 h-auto py-2"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {comment && (
              <Button type="submit" variant="ghost" className="text-primary font-semibold hover:text-primary/80 px-2" disabled={commentMutation.isPending}>
                Post
              </Button>
            )}
          </form>
        </CardFooter>
      </Card>

      {/* ── Report Bottom Sheet ── */}
      <AnimatePresence>
        {showReportSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowReportSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border/60 pb-10"
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h3 className="text-base font-bold">Report this post</h3>
                <button onClick={() => setShowReportSheet(false)} className="p-1 rounded-full hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground px-5 pb-3">Why are you reporting this content?</p>
              <div className="space-y-0.5 px-3">
                {REPORT_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(r => r === reason ? "" : reason)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-3 rounded-xl text-sm transition-colors",
                      reportReason === reason ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted"
                    )}
                    data-testid={`report-reason-${reason.replace(/\s/g, "-").toLowerCase()}`}
                  >
                    {reason}
                    {reportReason === reason && <ChevronDown className="w-4 h-4" />}
                  </button>
                ))}
              </div>
              <div className="px-5 pt-4">
                <Button
                  className="w-full rounded-xl"
                  disabled={!reportReason || reportMutation.isPending}
                  onClick={() => reportMutation.mutate(reportReason || customReason)}
                  data-testid="button-submit-report"
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Share Bottom Sheet ── */}
      <AnimatePresence>
        {showShareSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowShareSheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl border-t border-border/60 pb-10"
            >
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-3 mb-2" />
              <div className="flex items-center justify-between px-5 pt-2 pb-4">
                <h3 className="text-base font-bold">Share post</h3>
                <button onClick={() => setShowShareSheet(false)} className="p-1 rounded-full hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Post preview strip */}
              <div className="mx-5 mb-5 flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/40">
                <img
                  src={post.imageUrl}
                  alt="Post"
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{post.user?.firstName} {post.user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{post.caption || "No caption"}</p>
                </div>
              </div>

              {/* Share actions */}
              <div className="px-5 space-y-2">
                {/* Native share — opens system share sheet (WhatsApp, IG, etc.) */}
                <button
                  onClick={handleNativeShare}
                  className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 hover:from-primary/30 hover:to-accent/30 transition-all"
                  data-testid="button-native-share"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                    <Share2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Share to…</p>
                    <p className="text-xs text-muted-foreground">WhatsApp, Instagram &amp; more</p>
                  </div>
                </button>

                {/* Copy link */}
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl bg-muted/40 border border-border/40 hover:bg-muted transition-all"
                  data-testid="button-copy-link"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Link2 className={cn("w-4 h-4", linkCopied ? "text-green-500" : "")} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{linkCopied ? "Copied!" : "Copy link"}</p>
                    <p className="text-xs text-muted-foreground">Share the post URL</p>
                  </div>
                </button>

                {/* Share via DM */}
                <button
                  onClick={() => { setShowShareSheet(false); window.location.href = "/messages"; }}
                  className="flex items-center gap-4 w-full px-4 py-3.5 rounded-2xl bg-muted/40 border border-border/40 hover:bg-muted transition-all"
                  data-testid="button-share-dm"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold">Send as message</p>
                    <p className="text-xs text-muted-foreground">Share directly in a DM</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

