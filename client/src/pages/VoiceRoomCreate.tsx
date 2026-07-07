import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Mic } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function VoiceRoomCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [joinCost, setJoinCost] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res: any = await apiRequest("POST", "/api/voice-rooms", {
        title: title.trim() || "Voice Room",
        joinCost: Number(joinCost) || 0,
      });
      const room = await res.json ? await res.json() : res;
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

        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-400 font-semibold">Room Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Friday Night Talk"
              className="w-full mt-1 bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-semibold">Join Cost (coins)</label>
            <input
              type="number"
              min={0}
              value={joinCost}
              onChange={(e) => setJoinCost(Number(e.target.value))}
              className="w-full mt-1 bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-pink-500/50"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              Set 0 for a free room. New users get 3 free joins before coins are charged.
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-sm disabled:opacity-50"
          >
            {loading ? "Starting..." : "Start Room"}
          </button>
        </div>
      </main>
    </div>
  );
}