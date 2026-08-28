import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Mic, Lock, CheckCircle2, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const REQUIRED_POSTS = 10;

interface CreatorStats {
  postCount?: number;
  totalPostCount?: number;
  educationalPostCount?: number;
  requiredEducationalPosts?: number;
  voiceRoomUnlocked?: boolean;

  // Old API compatibility
  videoCount?: number;
  postCountLegacy?: number;
}

export default function VoiceRoomCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const [roomType, setRoomType] =
    useState<"1v1" | "2v2" | "group">("group");

  const [requiresApproval, setRequiresApproval] = useState(false);

  /*
   * FREE ROOM
   * Coins are only for gifts inside the room.
   */
  const joinCost = 0;

  /*
   * Fetch creator stats.
   *
   * IMPORTANT:
   * We do NOT poll every 3 seconds.
   * The backend calculates the real post count.
   */
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch,
  } = useQuery<CreatorStats>({
    queryKey: ["/api/users/me/stats"],
    queryFn: async () => {
      const res = await fetch("/api/users/me/stats", {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Could not load creator stats");
      }

      return res.json();
    },

    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  });

  /*
   * NEW RULE:
   * Any 10 real posts are enough.
   *
   * Backend should return postCount.
   */
  const postCount =
    Number(
      stats?.totalPostCount ??
      stats?.postCount ??
      0
    );

  /*
   * Prefer backend's unlocked flag.
   * Also calculate locally so UI becomes correct immediately
   * when count reaches 10.
   */
  const isEligible =
    !statsLoading &&
    !statsError &&
    (
      stats?.voiceRoomUnlocked === true ||
      postCount >= REQUIRED_POSTS
    );

  const remainingPosts = Math.max(
    REQUIRED_POSTS - postCount,
    0
  );

  const handleCreate = async () => {
    if (loading) return;

    /*
     * Never allow frontend-only bypass.
     * Backend also checks eligibility.
     */
    if (!isEligible) {
      toast({
        title: "Voice Room locked",
        description: `Create ${remainingPosts} more post${
          remainingPosts === 1 ? "" : "s"
        } to unlock Voice Rooms.`,
        variant: "destructive",
      });

      await refetch();
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest(
        "POST",
        "/api/voice-rooms",
        {
          title: title.trim() || "Voice Room",
          joinCost,
          requiresApproval,
          roomType,
        }
      );

      const room = await response.json();

      if (!room?.id) {
        throw new Error("Room was created but no room ID was returned.");
      }

      /*
       * Real room created by backend.
       * Host is already attached to the room server-side.
       */
      navigate(`/voice-rooms/${room.id}`);
    } catch (err: any) {
      const message =
        err?.message || "Could not create Voice Room";

      toast({
        title: "Could not create room",
        description: message,
        variant: "destructive",
      });

      /*
       * Refresh eligibility in case backend state changed.
       */
      refetch();
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
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>

          <h1 className="text-white font-bold text-lg">
            Start a Voice Room
          </h1>
        </div>

        {/* Mic icon */}
        <div className="flex flex-col items-center py-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <Mic className="w-7 h-7 text-white" />
          </div>
        </div>

        {/* Loading */}
        {statsLoading && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-pink-400 animate-spin" />

              <div>
                <p className="text-white text-sm font-semibold">
                  Checking Voice Room eligibility...
                </p>

                <p className="text-zinc-500 text-xs mt-1">
                  Checking your post progress.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {statsError && !statsLoading && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-red-300 text-sm font-semibold">
              Could not check Voice Room eligibility.
            </p>

            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-bold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Unlocked */}
        {!statsLoading && !statsError && isEligible && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />

              <div>
                <p className="text-green-300 text-sm font-semibold">
                  Voice Room Unlocked! 🎉
                </p>

                <p className="text-zinc-400 text-xs mt-1">
                  You have created {postCount} posts.
                  You can now host a real Voice Room.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Locked */}
        {!statsLoading && !statsError && !isEligible && (
          <div className="mb-5 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />

              <div className="flex-1">
                <p className="text-orange-300 text-sm font-semibold">
                  Voice Room Locked
                </p>

                <p className="text-zinc-400 text-xs mt-1">
                  Create {remainingPosts} more post
                  {remainingPosts === 1 ? "" : "s"} to unlock.
                </p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-zinc-500">
                      Progress
                    </span>

                    <span className="text-white font-bold">
                      {Math.min(postCount, REQUIRED_POSTS)}/
                      {REQUIRED_POSTS}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all"
                      style={{
                        width: `${Math.min(
                          (postCount / REQUIRED_POSTS) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => navigate("/")}
                  className="mt-3 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg px-3 py-2 transition-colors"
                >
                  Create Posts →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <div
          className={`space-y-4 transition-opacity ${
            !isEligible
              ? "opacity-40 pointer-events-none select-none"
              : "opacity-100"
          }`}
        >
          {/* Title */}
          <div>
            <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
              Room Title
            </label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday Night Talk"
              disabled={!isEligible}
              className="w-full mt-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          {/* Free */}
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
            <p className="text-xs text-green-300 font-semibold">
              🎉 Free to join
            </p>

            <p className="text-[10px] text-zinc-500 mt-0.5">
              Anyone can join and listen for free.
              Coins are only used for gifts.
            </p>
          </div>

          {/* Room type */}
          <div>
            <p className="text-xs text-zinc-400 font-semibold mb-2 uppercase tracking-wider">
              Room Format
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  key: "1v1" as const,
                  label: "1 vs 1",
                  seats: "2 seats",
                },
                {
                  key: "2v2" as const,
                  label: "2 vs 2",
                  seats: "4 seats",
                },
                {
                  key: "group" as const,
                  label: "Group",
                  seats: "8 seats",
                },
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
                  <span className="text-sm">
                    {option.label}
                  </span>

                  <span className="text-[10px] text-zinc-500">
                    {option.seats}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Approval */}
          <div className="flex items-center justify-between py-2 px-1">
            <span className="text-xs text-zinc-300 font-medium">
              Require approval to speak
            </span>

            <input
              type="checkbox"
              disabled={!isEligible}
              checked={requiresApproval}
              onChange={(e) =>
                setRequiresApproval(e.target.checked)
              }
              className="w-4 h-4 accent-pink-500 rounded"
            />
          </div>
        </div>

        {/* Create */}
        <button
          onClick={handleCreate}
          disabled={loading || statsLoading || statsError || !isEligible}
          className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-sm disabled:opacity-40 hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          {statsLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking...
            </>
          ) : loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : !isEligible ? (
            `Locked — ${remainingPosts} more post${
              remainingPosts === 1 ? "" : "s"
            }`
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Start Real Voice Room
            </>
          )}
        </button>
      </main>
    </div>
  );
}