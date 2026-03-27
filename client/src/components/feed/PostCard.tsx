import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Send, Bookmark, CheckCircle2, MoreVertical, Flag, UserX, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useLikePost, useAddComment } from "@/hooks/use-posts";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useEffect, useRef } from "react";
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
  const [reportReason, setReportReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [reported, setReported] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
    likeMutation.mutate(post.id);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
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
    commentMutation.mutate({ postId: post.id, content: comment });
    setComment("");
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
              <Button variant="ghost" size="icon" className="hover:text-destructive hover:bg-destructive/10 -ml-2" onClick={handleLike}>
                <Heart className={cn("w-6 h-6 transition-all", post.hasLiked ? "fill-destructive text-destructive" : "")} />
              </Button>
              <Button variant="ghost" size="icon">
                <MessageCircle className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon">
                <Send className="w-6 h-6" />
              </Button>
            </div>
            <Button variant="ghost" size="icon">
              <Bookmark className="w-6 h-6" />
            </Button>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-sm">{post.likesCount || 0} likes</p>
            <p className="text-sm">
              <span className="font-semibold mr-2">{post.user?.firstName}:</span>
              {post.caption}
            </p>
            {post.commentsCount > 0 && (
              <button className="text-sm text-muted-foreground hover:text-foreground">
                View all {post.commentsCount} comments
              </button>
            )}
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
    </>
  );
}
