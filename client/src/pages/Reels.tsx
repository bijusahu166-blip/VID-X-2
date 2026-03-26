import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Heart, MessageCircle, Share2, Play, Pause, VolumeX, Volume2, Radio } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const [isMuted, setIsMuted] = useState(true);
  const [liked, setLiked] = useState(reel.hasLiked ?? false);
  const [likeCount, setLikeCount] = useState(reel.likesCount ?? 0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); }
    else { video.pause(); setIsPlaying(false); }
  };

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${reel.id}/like`, { method: "POST", credentials: "include" });
      return res.json();
    },
    onMutate: () => {
      setLiked(l => !l);
      setLikeCount(c => liked ? c - 1 : c + 1);
    },
    onSuccess: (data) => {
      setLiked(data.added);
      setLikeCount(data.likesCount);
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const hasVideo = Boolean(reel.videoUrl);

  return (
    <div className="snap-start h-full w-full relative bg-black flex items-center justify-center overflow-hidden">
      {hasVideo ? (
        <video
          ref={videoRef}
          src={reel.videoUrl!}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          onClick={togglePlay}
          data-testid={`video-reel-${reel.id}`}
        />
      ) : (
        <img
          src={reel.imageUrl}
          alt="reel"
          className="absolute inset-0 w-full h-full object-cover"
          onClick={togglePlay}
        />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

      {/* Play/Pause overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {/* LIVE badge */}
      {reel.type === "live" && (
        <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-black px-2 py-1 rounded-full">
          <Radio className="w-3 h-3 animate-pulse" />
          LIVE
        </div>
      )}

      {/* Mute button (top right) */}
      <button
        onClick={() => setIsMuted(m => !m)}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center"
        data-testid={`button-mute-${reel.id}`}
      >
        {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>

      {/* Right action bar */}
      <div className="absolute right-4 bottom-28 flex flex-col gap-5 items-center">
        {/* Avatar */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white">
            {reel.user?.profileImageUrl ? (
              <img src={reel.user.profileImageUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                {reel.user?.firstName?.[0] ?? "?"}
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border border-black">
            <span className="text-white text-[8px] font-black">+</span>
          </div>
        </div>

        {/* Like */}
        <button
          onClick={() => likeMutation.mutate()}
          className="flex flex-col items-center gap-1"
          data-testid={`button-like-${reel.id}`}
        >
          <Heart className={`w-7 h-7 transition-colors ${liked ? "fill-red-500 text-red-500" : "text-white"}`} />
          <span className="text-xs text-white font-medium">{likeCount > 999 ? `${(likeCount/1000).toFixed(1)}k` : likeCount}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1" data-testid={`button-comment-${reel.id}`}>
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-xs text-white font-medium">{reel.commentsCount ?? 0}</span>
        </button>

        {/* Share */}
        <button
          className="flex flex-col items-center gap-1"
          onClick={() => { navigator.share?.({ title: reel.caption ?? "Check this reel!", url: window.location.href }).catch(() => {}); }}
          data-testid={`button-share-${reel.id}`}
        >
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-xs text-white font-medium">Share</span>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute left-4 bottom-28 max-w-[65%]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-bold text-white text-sm">@{reel.user?.username ?? reel.user?.firstName ?? "user"}</span>
        </div>
        {reel.caption && (
          <p className="text-white text-sm line-clamp-3 leading-relaxed">{reel.caption}</p>
        )}
        {!hasVideo && (
          <p className="text-yellow-400 text-xs mt-1 font-semibold">📹 No video file uploaded yet</p>
        )}
      </div>
    </div>
  );
}

export default function Reels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allPosts, isLoading } = useQuery<ReelPost[]>({
    queryKey: ["/api/posts"],
  });

  const reels = (allPosts ?? []).filter(p => p.type === "reel" || p.type === "video" || p.type === "live");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const index = Math.round(container.scrollTop / container.clientHeight);
      setActiveIndex(index);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <Header />
      <div
        ref={containerRef}
        className="flex-1 relative snap-y snap-mandatory overflow-y-scroll no-scrollbar pt-14"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {isLoading && (
          <div className="snap-start h-full flex items-center justify-center">
            <div className="text-zinc-400 text-sm">Loading reels...</div>
          </div>
        )}

        {!isLoading && reels.length === 0 && (
          <div className="snap-start h-full flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center">
              <Play className="w-10 h-10 text-zinc-600" />
            </div>
            <div className="text-center px-8">
              <p className="text-white font-bold text-lg mb-2">No Reels Yet</p>
              <p className="text-zinc-500 text-sm">Upload a reel or video using the + button to see it here.</p>
            </div>
          </div>
        )}

        {reels.map((reel, i) => (
          <ReelCard key={reel.id} reel={reel} isActive={i === activeIndex} />
        ))}
      </div>
      <div className="relative z-50">
        <BottomNav />
      </div>
    </div>
  );
}
