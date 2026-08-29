import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Mic, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const REQUIRED_VIDEOS = 10;

interface ProfileData {
  id?: string;
  username?: string | null;
  videoCount?: number;
  voiceRoomUnlocked?: boolean;
}

interface CreatorStats {
  videoCount?: number;
  requiredVideos?: number;
  voiceRoomUnlocked?: boolean;
}

export default function VoiceRoomCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [roomType, setRoomType] = useState<"1v1" | "2v2" | "group">("group");
  const [requiresApproval, setRequiresApproval] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/profile");
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery<CreatorStats>({
    queryKey: ["/api/users/me/stats"],
    queryFn: async () => {
      const response = await fetch("/api/users/me/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not load video progress");
      return response.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  const loadingStats = profileLoading || statsLoading;

  // Profile is the primary display source. Stats endpoint stays as server-side truth/fallback.
  const videoCount = Math.max(
    Number(profile?.videoCount ?? 0),
    Number(stats?.videoCount ?? 0),
  );

  const isEligible =
    !loadingStats &&
    !statsError &&
    (profile?.voiceRoomUnlocked === true ||
      stats?.voiceRoomUnlocked === true ||
      videoCount >= REQUIRED_VIDEOS);

  const remainingVideos = Math.max(REQUIRED_VIDEOS - videoCount, 0);

  const handleCreate = async () => {
    if (loading) return;

    if (!isEligible) {
      toast({
        title: "Voice Room locked",
        description:
          remainingVideos > 0
            ? `Upload ${remainingVideos} more video${remainingVideos === 1 ? "" : "s"} to unlock.`
            : "Video progress is still syncing. Please try again.",
        variant: "destructive",
      });
      await Promise.allSettled([refetchStats()]);
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/voice-rooms", {
        title: title.trim() || "Voice Room",
        joinCost: 0,
        requiresApproval,
        roomType,
      });

      const room = await response.json();
      if (!room?.id) throw new Error("Room was created but no room ID was returned.");

      navigate(`/voice-rooms/${room.id}`);
    } catch (error: any) {
      toast({
        title: "Could not create room",
        description: error?.message || "Could not create Voice Room",
        variant: "destructive",
      });
      await refetchStats();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-10 text-white">
      <Header />
      <main
        className="mx-auto max-w-[480px] px-4"
        style={{ paddingTop: "var(--header-total)" }}
      >
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-white font-bold text-lg">Start a Voice Room</h1>
        </div>

        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Mic className="w-7 h-7 text-white" />
          </div>
        </div>

        {loadingStats && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />
              <div>
                <p className="text-white text-sm font-semibold">Checking your video progress...</p>
                <p className="text-zinc-500 text-xs mt-1">Connected to your profile.</p>
              </div>
            </div>
          </div>
        )}

        {statsError && !loadingStats && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300 text-sm font-semibold">Could not check video progress.</p>
            <button
              onClick={() => refetchStats()}
              className="mt-3 px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-bold"
            >
              Try Again
            </button>
          </div>
        )}

        {!loadingStats && !statsError && isEligible && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-green-300 text-sm font-semibold">Voice Room Unlocked! 🎉</p>
                <p className="text-zinc-400 text-xs mt-1">
                  Your profile has {videoCount} video{videoCount === 1 ? "" : "s"}. You can host a real Voice Room.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loadingStats && !statsError && !isEligible && (
          <div className="mb-5 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-orange-300 text-sm font-semibold">Voice Room Locked</p>
                <p className="text-zinc-400 text-xs mt-1">
                  Upload {remainingVideos} more video{remainingVideos === 1 ? "" : "s"} to unlock.
                </p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-zinc-500">Video Progress</span>
                    <span className="text-white font-bold">
                      {Math.min(videoCount, REQUIRED_VIDEOS)}/{REQUIRED_VIDEOS}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all"
                      style={{
                        width: `${Math.min((videoCount / REQUIRED_VIDEOS) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => navigate("/")}
                  className="mt-3 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-2 transition-colors"
                >
                  Upload Videos →
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`space-y-4 transition-opacity ${!isEligible ? "opacity-40 pointer-events-none select-none" : "opacity-100"}`}>
          <div>
            <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Room Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Friday Night Talk"
              disabled={!isEligible}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-green-300 font-semibold">🎉 Free to join</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Anyone can join and listen for free. Coins are only used for gifts.</p>
          </div>

          <div>
            <p className="text-xs text-zinc-400 font-semibold mb-2 uppercase tracking-wider">Room Format</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "1v1" as const, label: "1 vs 1", seats: "2 seats" },
                { key: "2v2" as const, label: "2 vs 2", seats: "4 seats" },
                { key: "group" as const, label: "Group", seats: "8 seats" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={!isEligible}
                  onClick={() => setRoomType(option.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                    roomType === option.key
                      ? "border-pink-500 bg-pink-500/10 text-white font-bold"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <span className="text-sm">{option.label}</span>
                  <span className="text-[10px] text-zinc-500">{option.seats}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-1">
            <span className="text-xs text-zinc-300 font-medium">Require approval to speak</span>
            <input
              type="checkbox"
              disabled={!isEligible}
              checked={requiresApproval}
              onChange={(event) => setRequiresApproval(event.target.checked)}
              className="w-4 h-4 accent-pink-500 rounded"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || loadingStats || statsError || !isEligible}
          className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          {loadingStats ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
          ) : loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
          ) : !isEligible ? (
            `Locked — ${remainingVideos} more video${remainingVideos === 1 ? "" : "s"}`
          ) : (
            <><Mic className="w-4 h-4" /> Start Real Voice Room</>
          )}
        </button>
      </main>
    </div>
  );
}
