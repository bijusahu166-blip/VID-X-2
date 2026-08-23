import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Mic, Lock, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Rules: Exactly 4 videos AND 3 photo posts required
const REQUIRED_VIDEOS = 4;
const REQUIRED_POSTS = 3;

interface CreatorStats {
  videoCount: number;
  postCount: number;
  voiceRoomUnlocked: boolean;
}

export default function VoiceRoomCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [roomType, setRoomType] = useState<"1v1" | "2v2" | "group">("group");
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Joining a voice room is free
  const joinCost = 0;

  // ── Auto-fetching Eligibility check ──
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<CreatorStats>({
    queryKey: ["/api/users/me/stats"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Could not load creator stats");
      return res.json();
    },
    refetchOnWindowFocus: true, // Window active hone par auto refresh
    refetchInterval: 3000,      // Har 3 second me background auto-check taaki video/post upload hotey hi automatic unlocked ho jaaye
  });

  const videoCount = stats?.videoCount ?? 0;
  const postCount = stats?.postCount ?? 0;

  // Criteria validation
 const isEligible = !statsLoading && !statsError && !!stats?.voiceRoomUnlocked

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
    <div className="min-h-screen bg-black pb-10 text-white">
      <Header />
      <main className="mx-auto max-w-[480px] px-4" style={{ paddingTop: "var(--header-total)" }}>
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate("/")} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-white font-bold text-lg">Start a Voice Room</h1>
        </div>

        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center mb-4 shadow-lg shadow-pink-500/20">
            <Mic className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* ── Condition Alert Banner ── */}
        {!statsLoading && (
          isEligible ? (
            /* Criteria Full Status (Unlocked Box) */
            <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 transition-all animate-in fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-green-300 text-sm font-semibold">
                    Voice Room Unlocked! 🎉
                  </p>
                  <p className="text-zinc-400 text-xs mt-1">
                    You have met the requirements ({videoCount}/{REQUIRED_VIDEOS} videos & {postCount}/{REQUIRED_POSTS} photo posts). You can now host rooms.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Locked Status Banner */
            <div className="mb-5 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 transition-all">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-orange-300 text-sm font-semibold mb-1">
                    Voice Rooms unlock at {REQUIRED_VIDEOS} videos and {REQUIRED_POSTS} photo posts
                  </p>
                  <p className="text-zinc-400 text-xs mb-3">
                    Your current progress: <span className="text-white font-medium">{videoCount}/{REQUIRED_VIDEOS} videos</span> & <span className="text-white font-medium">{postCount}/{REQUIRED_POSTS} posts</span>.
                  </p>
                  <button
                    onClick={() => navigate("/educational")}
                    className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-2 transition-colors"
                  >
                    Go to Educational Tab →
                  </button>
                </div>
              </div>
            </div>
          )
        )}

        {statsError && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300 text-xs">
              Couldn't verify your eligibility right now. Please try again in a moment.
            </p>
          </div>
        )}

        {/* ── Form Inputs (Criteria full hotey hi UI automatic active ho jata hai) ── */}
        <div className={`space-y-4 transition-all duration-300 ${!isEligible ? "opacity-40 pointer-events-none select-none" : "opacity-100"}`}>
          <div>
            <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Room Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday Night Talk"
              disabled={!isEligible}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500 transition-colors"
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
            <p className="text-xs text-zinc-400 font-semibold mb-2 uppercase tracking-wider">Room Format</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { key: "1v1", label: "1 vs 1", seats: "2 seats" },
                  { key: "2v2", label: "2 vs 2", seats: "4 seats" },
                  { key: "group", label: "Group", seats: "8 seats" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  disabled={!isEligible}
                  onClick={() => setRoomType(opt.key)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${
                    roomType === opt.key
                      ? "border-pink-500 bg-pink-500/10 text-white font-bold"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <span className="text-sm">{opt.label}</span>
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
              disabled={!isEligible}
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="w-4 h-4 accent-pink-500 rounded cursor-pointer disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* ── Submit Button ── */}
        <button
          onClick={handleCreate}
          disabled={loading || !isEligible || statsLoading}
          className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 active:scale-[0.99] transition-all"
        >
          {statsLoading
            ? "Checking eligibility..."
            : loading
            ? "Starting..."
            : !isEligible
            ? "Locked — Upload 3 videos & 4 posts"
            : "Start Room"}
        </button>
      </main>
    </div>
  );
}