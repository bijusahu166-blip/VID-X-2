import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { 
  Heart, MessageCircle, Share2, Play, VolumeX, Volume2, 
  Radio, Maximize2, Minimize2, Loader2, Bookmark 
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVideoSettings } from "@/contexts/VideoSettingsContext";
import { toCloudinaryVideoUrl } from "@/lib/utils";
import { Share } from "@capacitor/share"; // Make sure to install this

interface ReelPost {
  id: number;
  userId: string;
  imageUrl: string;
  caption: string | null;
  type: string | null;
  videoUrl: string | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; username?: string; profileImageUrl?: string };
  likesCount?: number;
  commentsCount?: number;
  hasLiked?: boolean;
}

function ReelCard({ reel, isActive }: { reel: ReelPost; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Default muted for autoplay
  const [isBuffering, setIsBuffering] = useState(true);
  const [liked, setLiked] = useState(reel.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(reel.likesCount ?? 0);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Play/Pause Logic with Sound Fix
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.muted = isMuted;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsBuffering(false);
          })
          .catch(() => {
            // Auto-play block fix: mute and play
            video.muted = true;
            setIsMuted(true);
            video.play();
          });
      }
    } else {
      video.pause();
      video.currentTime = 0; // Reset to avoid lag on next scroll
      setIsPlaying(false);
    }
  }, [isActive, isMuted]);

  // 2. Share Logic (Native)
  const handleShare = async () => {
    try {
      await Share.share({
        title: 'Check this on VID-X',
        text: reel.caption || 'Awesome Reel!',
        url: window.location.href,
        dialogTitle: 'Share with friends',
      });
    } catch (err) {
      // Fallback if plugin fails
      navigator.share?.({ title: 'VID-X', url: window.location.href });
    }
  };

  // 3. Like Logic
  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${reel.id}/like`, { method: "POST", credentials: "include" });
      return res.json();
    },
    onMutate: () => {
      setLiked(!liked);
      setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    },
    onSuccess: (data) => {
      setLiked(data.added);
      setLikeCount(data.likesCount);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const videoSrc = reel.videoUrl ? toCloudinaryVideoUrl(reel.videoUrl) : null;

  return (
    <div className="snap-start h-full w-full relative bg-black flex items-center justify-center overflow-hidden">
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          src={videoSrc!}
          className="absolute inset-0 w-full h-full object-contain"
          loop
          playsInline
          muted={isMuted}
          preload="auto" // Faster loading
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onClick={() => setIsPlaying(!isPlaying)}
        />
      ) : (
        <img src={reel.imageUrl} className="w-full h-full object-contain" alt="post" />
      )}

      {/* Buffering Spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="w-10 h-10 text-white animate-spin opacity-50" />
        </div>
      )}

      {/* Play/Pause Icon Overlay */}
      {!isPlaying && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Play className="w-16 h-16 text-white/50 fill-white/20" />
        </div>
      )}

      {/* Sound Toggle Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
        className="absolute right-4 top-1/2 -translate-y-12 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-white/20 z-20"
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-20">
        <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden shadow-lg">
          <img src={reel.user?.profileImageUrl || "/default-avatar.png"} alt="user" className="w-full h-full object-cover" />
        </div>

        <button onClick={() => likeMutation.mutate()} className="flex flex-col items-center">
          <Heart className={`w-8 h-8 ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          <span className="text-xs font-bold">{likeCount}</span>
        </button>

        <button onClick={() => toast({ title: "Comments", description: "Coming Soon!" })} className="flex flex-col items-center">
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-xs font-bold">{reel.commentsCount || 0}</span>
        </button>

        <button onClick={() => setSaved(!saved)} className="flex flex-col items-center">
          <Bookmark className={`w-8 h-8 ${saved ? "fill-yellow-500 text-yellow-500" : "text-white"}`} />
          <span className="text-xs font-bold">Save</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center">
          <Share2 className="w-8 h-8 text-white" />
          <span className="text-xs font-bold">Share</span>
        </button>
      </div>

      {/* Info Bottom */}
      <div className="absolute left-4 bottom-24 right-16 z-20">
        <h3 className="font-bold text-white mb-1">@{reel.user?.username || "user"}</h3>
        <p className="text-sm text-white/90 line-clamp-2">{reel.caption}</p>
      </div>
      
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
    </div>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allPosts, isLoading } = useQuery<ReelPost[]>({
    queryKey: ["/api/posts"],
  });

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
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 snap-y snap-mandatory overflow-y-scroll no-scrollbar"
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>
        ) : (
          reels.map((reel, i) => (
            <ReelCard key={reel.id} reel={reel} isActive={i === activeIndex} />
          ))
        )}
      </div>
      <BottomNav />
    </div>
  );
}