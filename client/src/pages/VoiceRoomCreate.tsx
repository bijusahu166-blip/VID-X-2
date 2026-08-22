import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Mic, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const MIN_VIDEOS_OR_POSTS = 20;

interface CreatorStats {
  videoCount: number;
  postCount: number;
}

export default function VoiceRoomCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [roomType, setRoomType] = useState<"1v1" | "2v2" | "group">("group");
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Joining a voice room is always free now — no per-room coin cost.
  // Coins are only spent on gifts inside the room.
  const joinCost = 0;

  // ── Eligibility check ──
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<CreatorStats>({
    queryKey: ["/api/users/me/stats"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load creator stats");
      return res.json();
    },
  });

  const videoCount = stats?.videoCount ?? 0;
  const postCount = stats?.postCount ?? 0;
  const isEligible = !statsLoading && !statsError && (videoCount >= MIN_VIDEOS_OR_POSTS || postCount >= MIN_VIDEOS_OR_POSTS);

  const handleCreate = async () => {
    if (loading || !isEligible) return;
    setLoading(true);
    try {
      const res: any = await apiRequest("POST", "/api/voice-rooms", {
        title: title.trim() || "Voice Room",
        joinCost: Number(joinCost) || 0,
        requiresApproval,
        roomType,
      });
      const room = res.json ? await res.json() : res;
      navigate(`/voice-rooms/${room.id}`);
    } catch (err: any) {
      toast({ title: "Could not create room", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-10">
      <Header />
      <main className="mx-auto max-w-[480px] px-4" style={{ paddingTop: "var(--header-total)" }}>
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate("/")} className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-white font-bold text-lg">Start a Voice Room</h1>
        </div>

        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center mb-4">
            <Mic className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* ── Eligibility notice ── */}
        {!statsLoading && !isEligible && (
          <div className="mb-5 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-orange-300 text-sm font-semibold mb-1">
                  Voice Rooms unlock at {MIN_VIDEOS_OR_POSTS} videos or {MIN_VIDEOS_OR_POSTS} posts
                </p>
                <p className="text-zinc-400 text-xs mb-3">
                  You currently have {videoCount} video{videoCount === 1 ? "" : "s"} and {postCount} post{postCount === 1 ? "" : "s"}.
                  Post educational content to unlock hosting.
                </p>
                <button
                  onClick={() => navigate("/educational")}
                  className="text-xs font-bold text-white bg-orange-500/80 hover:bg-orange-500 rounded-lg px-3 py-2"
                >
                  Go to Educational Tab →
                </button>
              </div>
            </div>
          </div>
        )}

        {statsError && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300 text-xs">
              Couldn't verify your eligibility right now. Please try again in a moment.
            </p>
          </div>
        )}

        <div className={`space-y-4 ${!isEligible ? "opacity-50 pointer-events-none" : ""}`}>
          <div>
            <label className="text-xs text-zinc-400 font-semibold">Room Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday Night Talk"
              disabled={!isEligible}
              className="w-full mt-1 bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500/50"
            />
          </div>

          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-green-300 font-semibold">🎉 Free to join</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Anyone can join and listen for free. Coins are only used for sending gifts.
            </p>
          </div>

          {/* ── Room Format Selector ── */}
          <div>
            <p className="text-xs text-zinc-400 font-semibold mb-2">Room Format</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "1v1", label: "1 vs 1", seats: "2 seats" },
                { key: "2v2", label: "2 vs 2", seats: "4 seats" },
                { key: "group", label: "Group", seats: "8 seats" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setRoomType(opt.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-colors ${
                    roomType === opt.key
                      ? "border-pink-500 bg-pink-500/10 text-white"
                      : "border-white/10 bg-white/5 text-zinc-400"
                  }`}
                >
                  <span className="text-sm font-bold">{opt.label}</span>
                  <span className="text-[10px] text-zinc-500">{opt.seats}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Approval Toggle ── */}
          <div className="flex items-center justify-between py-2 px-1">
            <span className="text-xs text-zinc-300 font-medium">Require approval to speak</span>
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !isEligible || statsLoading}
          className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-sm disabled:opacity-40"
        >
          {statsLoading ? "Checking eligibility..." : loading ? "Starting..." : !isEligible ? "Locked — see requirement above" : "Start Room"}
        </button>
      </main>
    </div>
  );
}