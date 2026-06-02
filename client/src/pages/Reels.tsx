import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { 
  Heart, MessageCircle, Share2, Download, Play, VolumeX, Volume2, 
  Radio, Loader2, Bookmark, Send, Flag, CheckCheck, X as CloseIcon
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { toCloudinaryVideoUrl } from "@/lib/utils";
import { getGoalSubjects } from "@/lib/goal-subjects";
import { Share } from "@capacitor/share";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

function ReelCard({ reel, isActive, isMuted, onToggleSound }: { reel: ReelPost; isActive: boolean; isMuted: boolean; onToggleSound: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportView, setReportView] = useState<"menu" | "success">("menu");
  
  // Real-time UI updates
  const [liked, setLiked] = useState(reel.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(reel.likesCount ?? 0);
  const [saved, setSaved] = useState(reel.hasSaved ?? false);
  const { user } = useAuth();

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch comments when opening
  useEffect(() => {
    if (showComments) {
      fetch(`/api/posts/${reel.id}/comments`, { credentials: "include" })
        .then(r => r.json())
        .then(setComments)
        .catch(err => console.error("Failed to fetch comments", err));
    }
  }, [showComments, reel.id]);

  // 1. Play/Pause & Sound Fix
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.muted = isMuted;
      video.play().then(() => setIsPlaying(true)).catch(() => {
        if (isMuted) return;
        video.muted = true;
        onToggleSound();
        video.play().catch(() => null);
      });
    } else {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive, isMuted, onToggleSound]);

  // 2. Like Mutation
  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${reel.id}/like`, { method: "POST" });
      return res.json();
    },
    onMutate: () => {
      setLiked(!liked);
      setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    }
  });

  // 3. Save to Profile Mutation (Archive section ke liye)
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${reel.id}/save`, { method: "POST" });
      return res.json();
    },
    onSuccess: (data) => {
      setSaved(data.saved);
      toast({ title: data.saved ? "Saved to Profile" : "Removed from Profile" });
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved"] });
    }
  });

  const REPORT_REASONS = [
    "Spam or misleading",
    "Hateful or abusive",
    "Nudity or sexual content",
    "Violence or dangerous",
    "Harassment or bullying",
    "Other",
  ];

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

  const handleShare = async () => {
    try {
      await Share.share({
        title: 'Check this on VID-X',
        text: reel.caption || 'Watch this!',
        url: window.location.href,
      });
    } catch {
      navigator.share?.({ title: 'VID-X', url: window.location.href });
    }
  };

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
    if (!commentText.trim()) return;
    try {
      const res = await fetch(`/api/posts/${reel.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments([...comments, newComment]);
        setCommentText("");
        // Update count
        reel.commentsCount = (reel.commentsCount || 0) + 1;
      } else {
        toast({ title: "Failed to post comment", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error posting comment", variant: "destructive" });
    }
  };

  return (
    <div className="snap-start h-full w-full relative bg-black flex items-center justify-center overflow-hidden">
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          src={toCloudinaryVideoUrl(reel.videoUrl)}
          className="w-full h-full object-contain"
          loop playsInline muted={isMuted} preload="auto"
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => videoRef.current?.play()}
          onClick={() => {
            if (isPlaying) videoRef.current?.pause();
            else videoRef.current?.play();
            setIsPlaying(!isPlaying);
          }}
        />
      ) : (
        <img src={reel.imageUrl} className="w-full h-full object-contain" />
      )}

      {/* Overlays */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20">
          <Loader2 className="w-10 h-10 text-white animate-spin" />
        </div>
      )}

      {/* Buttons Bar */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-20">
        <button onClick={() => likeMutation.mutate()} className="flex flex-col items-center">
          <Heart className={`w-8 h-8 transition-all ${liked ? "fill-red-500 text-red-500 scale-125" : "text-white"}`} />
          <span className="text-xs font-bold text-white drop-shadow-md">{likeCount}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center">
          <MessageCircle className="w-8 h-8 text-white drop-shadow-md" />
          <span className="text-xs font-bold text-white">{reel.commentsCount || 0}</span>
        </button>

        <button onClick={() => saveMutation.mutate()} className="flex flex-col items-center">
          <Bookmark className={`w-8 h-8 ${saved ? "fill-cyan-400 text-cyan-400" : "text-white"}`} />
          <span className="text-xs font-bold text-white">{saved ? "Saved" : "Save"}</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center">
          <Share2 className="w-8 h-8 text-white" />
          <span className="text-xs font-bold text-white">Share</span>
        </button>

        <button onClick={handleDownload} className="flex flex-col items-center">
          <Download className="w-8 h-8 text-white" />
          <span className="text-xs font-bold text-white">Download</span>
        </button>
        
        <button onClick={onToggleSound} className="w-10 h-10 rounded-full bg-black/40 border border-white/20 flex items-center justify-center">
          {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>

        {user?.id !== reel.userId && (
          <button onClick={() => setShowReportMenu(true)} className="flex flex-col items-center">
            <Flag className="w-8 h-8 text-white drop-shadow-md" />
            <span className="text-xs font-bold text-white">Report</span>
          </button>
        )}
      </div>

      {/* Caption Area */}
      <div className="absolute left-4 bottom-24 right-16 z-20">
        <h3 className="font-bold text-white text-lg drop-shadow-md">@{reel.user?.username || "user"}</h3>
        <p className="text-sm text-white/90 line-clamp-2 drop-shadow-md">{reel.caption}</p>
      </div>

      {/* Report Sheet */}
      <Sheet open={showReportMenu} onOpenChange={setShowReportMenu}>
        <SheetContent side="bottom" className="h-auto rounded-t-[30px] bg-zinc-900 border-t-zinc-800 text-white p-0">
          {reportView === "menu" ? (
            <div className="p-6 space-y-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Report This Reel</h3>
                <button onClick={() => setShowReportMenu(false)} className="text-zinc-400 hover:text-white">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-zinc-400 mb-4">Why are you reporting this?</p>
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => reportMutation.mutate(reason)}
                  disabled={reportMutation.isPending}
                  className="w-full p-3 text-left bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white disabled:opacity-50 flex justify-between items-center"
                >
                  <span className="text-sm">{reason}</span>
                  {reportMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCheck className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Report Submitted</h3>
              <p className="text-sm text-zinc-400">User will be blocked in 2 hours</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Comment Sheet */}
      <Sheet open={showComments} onOpenChange={setShowComments}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-[30px] bg-zinc-900 border-t-zinc-800 text-white">
          <SheetHeader>
            <SheetTitle className="text-white border-b border-zinc-800 pb-4">Comments</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {comments.length === 0 ? (
              <p className="text-zinc-400 text-center">No comments yet. Be the first!</p>
            ) : (
              comments.map((comment: any) => (
                <div key={comment.id} className="mb-3 p-2 bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-white text-sm">{comment.user?.firstName} {comment.user?.lastName}</span>
                    <span className="text-xs text-zinc-500">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-zinc-200 text-sm">{comment.content}</p>
                </div>
              ))
            )}
          </div>
          <div className="p-4 flex gap-2 border-t border-zinc-800">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none"
              onKeyPress={(e) => e.key === "Enter" && submitComment()}
            />
            <button onClick={submitComment} className="p-2 bg-cyan-500 rounded-full text-black"><Send size={18}/></button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: allPosts, isLoading } = useQuery<ReelPost[]>({ queryKey: ["/api/posts"] });
  const reels = (allPosts ?? []).filter(p => p.type === "reel");
  const userGoal = localStorage.getItem("user_goal") || "";
  const allowedSubjects = getGoalSubjects(userGoal);
  const relevantReels = reels.filter((reel) => {
    if (!allowedSubjects.length) return true;
    const text = `${reel.caption ?? ""} ${reel.type ?? ""} ${reel.user?.username ?? ""}`.toLowerCase();
    return allowedSubjects.some(subject => text.includes(subject));
  });
  const displayReels = relevantReels.length > 0 && allowedSubjects.length > 0 ? relevantReels : reels;
  const visibleReels = displayReels.slice(0, 15);

  const handleScroll = () => {
    if (containerRef.current) {
      const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
      setActiveIndex(index);
    }
  };

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col">
      <Header />
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 snap-y snap-mandatory overflow-y-scroll no-scrollbar scroll-smooth">
        {isLoading ? (
          <div className="h-full flex items-center justify-center bg-black"><Loader2 className="animate-spin text-cyan-500 w-12 h-12" /></div>
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