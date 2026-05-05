import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { 
  Heart, MessageCircle, Share2, Play, VolumeX, Volume2, 
  Radio, Loader2, Bookmark, Send 
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { toCloudinaryVideoUrl } from "@/lib/utils";
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

function ReelCard({ reel, isActive }: { reel: ReelPost; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [showComments, setShowComments] = useState(false);
  
  // Real-time UI updates
  const [liked, setLiked] = useState(reel.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(reel.likesCount ?? 0);
  const [saved, setSaved] = useState(reel.hasSaved ?? false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Play/Pause & Sound Fix
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.muted = isMuted;
      video.play().then(() => setIsPlaying(true)).catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play();
      });
    } else {
      video.pause();
      video.currentTime = 0;
      setIsPlaying(false);
    }
  }, [isActive, isMuted]);

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
      queryClient.invalidateQueries({ queryKey: ["/api/user/saved"] }); // Profile tab update karne ke liye
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

  return (
    <div className="snap-start h-full w-full relative bg-black flex items-center justify-center overflow-hidden">
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          src={toCloudinaryVideoUrl(reel.videoUrl)}
          className="absolute inset-0 w-full h-full object-cover"
          loop playsInline muted={isMuted} preload="auto"
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onClick={() => {
            if (isPlaying) videoRef.current?.pause();
            else videoRef.current?.play();
            setIsPlaying(!isPlaying);
          }}
        />
      ) : (
        <img src={reel.imageUrl} className="w-full h-full object-cover" />
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
        
        <button onClick={() => setIsMuted(!isMuted)} className="w-10 h-10 rounded-full bg-black/40 border border-white/20 flex items-center justify-center">
          {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* Caption Area */}
      <div className="absolute left-4 bottom-24 right-16 z-20">
        <h3 className="font-bold text-white text-lg drop-shadow-md">@{reel.user?.username || "user"}</h3>
        <p className="text-sm text-white/90 line-clamp-2 drop-shadow-md">{reel.caption}</p>
      </div>

      {/* Comment Sheet */}
      <Sheet open={showComments} onOpenChange={setShowComments}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-[30px] bg-zinc-900 border-t-zinc-800 text-white">
          <SheetHeader>
            <SheetTitle className="text-white border-b border-zinc-800 pb-4">Comments</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 text-zinc-400 text-center">
            No comments yet. Be the first!
          </div>
          <div className="p-4 flex gap-2 border-t border-zinc-800">
            <input placeholder="Add a comment..." className="flex-1 bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none" />
            <button className="p-2 bg-cyan-500 rounded-full text-black"><Send size={18}/></button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: allPosts, isLoading } = useQuery<ReelPost[]>({ queryKey: ["/api/posts"] });
  const reels = (allPosts ?? []).filter(p => p.type === "reel");

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
          reels.map((reel, i) => <ReelCard key={reel.id} reel={reel} isActive={i === activeIndex} />)
        )}
      </div>
      <BottomNav />
    </div>
  );
}