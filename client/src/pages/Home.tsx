import { usePosts } from "@/hooks/use-posts";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { BannerAd } from "@/components/ads/BannerAd";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Play, ThumbsUp, ThumbsDown, Share2, MoreVertical,
  MessageSquare, Eye, ChevronRight, Flame, Music,
  Globe, Gamepad2, Utensils, Plane, Cpu, Plus,
  CheckCircle2, Clock, Zap
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

// Fake reels data for the Reels shelf
const REELS = [
  { id: 1, user: "Alex_Gamer", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex", thumb: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=200&h=350&fit=crop", views: "2.1M", live: false },
  { id: 2, user: "TravelQueen", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Travel", thumb: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=200&h=350&fit=crop", views: "890K", live: true },
  { id: 3, user: "ChefMike", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike", thumb: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=200&h=350&fit=crop", views: "1.4M", live: false },
  { id: 4, user: "MusicVibes", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Music", thumb: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&h=350&fit=crop", views: "3.2M", live: false },
  { id: 5, user: "TechNerd99", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Tech", thumb: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&h=350&fit=crop", views: "567K", live: true },
  { id: 6, user: "NatureLens", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nature", thumb: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=200&h=350&fit=crop", views: "4.7M", live: false },
];

function formatViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function duration() {
  const mins = Math.floor(Math.random() * 15) + 1;
  const secs = Math.floor(Math.random() * 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function Home() {
  const { data: posts, isLoading } = usePosts();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");

  const likeMutation = useMutation({
    mutationFn: (postId: number) => apiRequest("POST", `/api/posts/${postId}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/posts"] }),
  });

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

        {/* ── REELS SHELF (YouTube Shorts style) ── */}
        <div className="mt-1 pb-2 border-b border-white/5">
          {/* Section header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-pink-500 to-purple-500" />
              <span className="text-[13px] font-black text-white tracking-wide">Reels</span>
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <button className="flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-white transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Reels horizontal scroll */}
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-3">
            {/* Add reel button */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-[88px] h-[148px] rounded-xl bg-white/5 border border-white/10 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/10 transition-colors">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[9px] text-zinc-500 font-semibold">Create</span>
              </div>
              <span className="text-[10px] text-zinc-600 font-medium">Your Reel</span>
            </div>

            {REELS.map((reel) => (
              <div key={reel.id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
                <div className="w-[88px] h-[148px] rounded-xl overflow-hidden relative">
                  <img
                    src={reel.thumb}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                  {/* Live badge */}
                  {reel.live && (
                    <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md tracking-wide flex items-center gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                  )}

                  {/* Play icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                      <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                    </div>
                  </div>

                  {/* Views */}
                  <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5">
                    <Eye className="w-2.5 h-2.5 text-white/80" />
                    <span className="text-[8px] text-white/90 font-bold">{reel.views}</span>
                  </div>

                  {/* Avatar */}
                  <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border-2 border-black overflow-hidden">
                    <img src={reel.avatar} className="w-full h-full object-cover" />
                  </div>
                </div>
                <span className="text-[9px] text-zinc-500 font-medium mt-2 max-w-[80px] truncate text-center">{reel.user}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── VIDEO FEED (YouTube card style) ── */}
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
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : posts?.length === 0 ? (
            <div className="text-center py-20 text-zinc-600">
              <Play className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No videos yet. Be the first!</p>
            </div>
          ) : (
            posts?.map((post, index) => {
              const views = Math.floor(Math.random() * 5_000_000) + 10_000;
              const dur = duration();
              return (
                <div key={post.id} className="mb-1 group cursor-pointer">
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-video bg-zinc-900 overflow-hidden">
                    <img
                      src={post.imageUrl}
                      alt={post.caption}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 bg-black/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      {dur}
                    </div>
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-7 h-7 text-white fill-white ml-1" />
                      </div>
                    </div>
                    {/* Live badge */}
                    {post.type === "live" && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                      </div>
                    )}
                  </div>

                  {/* Video info row */}
                  <div className="flex gap-3 px-3 py-3">
                    {/* Channel avatar */}
                    <div className="shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800">
                        <img
                          src={post.user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user?.firstName}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2 mb-1">
                        {post.caption || `${post.user?.firstName}'s ${post.type === "live" ? "Live Stream" : "Video"}`}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          {post.user?.firstName} {post.user?.lastName}
                          {post.user?.isCelebrity && <CheckCircle2 className="w-3 h-3 text-blue-400 fill-blue-400" />}
                        </span>
                        <span>·</span>
                        <span>{formatViews(views)} views</span>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                      </div>

                      {/* Action row */}
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => likeMutation.mutate(post.id)}
                          className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${post.hasLiked ? "text-primary" : "text-zinc-500 hover:text-white"}`}
                        >
                          <ThumbsUp className={`w-3.5 h-3.5 ${post.hasLiked ? "fill-current" : ""}`} />
                          {post.likesCount > 0 ? post.likesCount : "Like"}
                        </button>
                        <button className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {post.commentsCount > 0 ? post.commentsCount : "Comment"}
                        </button>
                        <button className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-white transition-colors">
                          <Share2 className="w-3.5 h-3.5" />
                          Share
                        </button>
                      </div>
                    </div>

                    {/* More options */}
                    <button className="shrink-0 text-zinc-600 hover:text-white transition-colors self-start mt-0.5">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-white/5 mx-3" />

                  {/* Ad injection */}
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
    </div>
  );
}
