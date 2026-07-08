import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Mic, MicOff, X, Send, Coins, Play, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

interface Seat {
  id: number;
  room_id: number;
  user_id: string;
  seat_number: number;
  is_muted: boolean;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
}

interface Room {
  id: number;
  host_id: string;
  channel_name: string;
  title: string;
  join_cost: number;
  is_active: boolean;
  seats: Seat[];
}

interface RoomMessage {
  id: number;
  room_id: number;
  user_id: string;
  content: string;
  created_at: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
}

const MAX_SEATS = 12;

// user_id (string) ko Agora ke numeric uid me convert karta hai — token generation
// (server/agora.ts) me use hone wale hash se match hona chahiye
function stringToNumericUid(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash === 0 ? 1 : hash;
}

export default function VoiceRoomScreen() {
  const params = useParams<{ id: string }>();
  const roomId = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const currentUserId: string = (user as any)?.id ?? "";

  const [chatText, setChatText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showCostEditor, setShowCostEditor] = useState(false);
  const [newCost, setNewCost] = useState(0);
  const [watchingAd, setWatchingAd] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<Set<number>>(new Set());

  const agoraClient = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

  const { data: room, refetch: refetchRoom } = useQuery<Room>({
    queryKey: ["/api/voice-rooms", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/voice-rooms/${roomId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Room not found");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery<RoomMessage[]>({
    queryKey: ["/api/voice-rooms", roomId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/voice-rooms/${roomId}/messages`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 4000,
  });

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins/balance"],
    queryFn: async () => {
      const res = await fetch("/api/coins/balance", { credentials: "include" });
      return res.json();
    },
  });

  const isHost = room?.host_id === currentUserId;
  const mySeat = room?.seats.find(s => s.user_id === currentUserId);

  const connectToAgora = useCallback(async () => {
    if (connected || !room) return;
    try {
      const tokenRes: any = await apiRequest("POST", "/api/agora/token", { channelName: room.channel_name });
      const tokenData = tokenRes.json ? await tokenRes.json() : tokenRes;

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      agoraClient.current = client;

      await client.join(tokenData.appId, tokenData.channelName, tokenData.token, tokenData.uid);

      const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrack.current = audioTrack;
      await client.publish([audioTrack]);

      client.on("user-published", async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === "audio") {
          remoteUser.audioTrack?.play();
        }
      });

      // ── Active speaker detection (glow indicator ke liye) ──
      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (volumes: any[]) => {
        const speaking = new Set<number>();
        volumes.forEach((v: any) => {
          if (v.level > 5) speaking.add(v.uid);
        });
        setSpeakingUsers(speaking);
      });

      setConnected(true);
    } catch (err: any) {
      toast({ title: "Voice connection failed", description: err.message, variant: "destructive" });
    }
  }, [connected, room, toast]);

  // ── Join room (coins/free-join logic on backend) then connect Agora ──
  const joinRoom = useCallback(async () => {
    if (!room || joining) return;
    setJoining(true);
    try {
      const res: any = await apiRequest("POST", `/api/voice-rooms/${roomId}/join`, {});
      const data = res.json ? await res.json() : res;
      if (data.message && !data.success) {
        toast({ title: data.message, variant: "destructive" });
        setJoining(false);
        return;
      }
      await connectToAgora();
      refetchRoom();
    } catch (err: any) {
      const msg = err?.message || "Could not join room";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setJoining(false);
    }
  }, [room, roomId, joining, connectToAgora, refetchRoom]);

  // ── Agar user pehle se seat me hai (refresh/dobara open karne par) to
  //    auto Agora connect karo — "Join Room" button na dabana pade ──
  useEffect(() => {
    if (room && mySeat && !connected) {
      connectToAgora();
    }
  }, [room, mySeat, connected, connectToAgora]);

  const leaveRoom = async () => {
    try {
      if (localAudioTrack.current) {
        localAudioTrack.current.close();
        localAudioTrack.current = null;
      }
      if (agoraClient.current) {
        await agoraClient.current.leave();
        agoraClient.current = null;
      }
      setConnected(false);
      await apiRequest("POST", `/api/voice-rooms/${roomId}/leave`, {});
      navigate("/");
    } catch {
      navigate("/");
    }
  };

  const toggleMute = async () => {
    if (!localAudioTrack.current) return;
    if (isMuted) {
      await localAudioTrack.current.setEnabled(true);
    } else {
      await localAudioTrack.current.setEnabled(false);
    }
    setIsMuted(!isMuted);
  };

  const endRoom = async () => {
    try {
      await apiRequest("POST", `/api/voice-rooms/${roomId}/end`, {});
      leaveRoom();
    } catch (err: any) {
      toast({ title: "Could not end room", variant: "destructive" });
    }
  };

  const updateCost = async () => {
    try {
      await apiRequest("PATCH", `/api/voice-rooms/${roomId}/cost`, { joinCost: newCost });
      setShowCostEditor(false);
      refetchRoom();
      toast({ title: "Join cost updated" });
    } catch {
      toast({ title: "Could not update cost", variant: "destructive" });
    }
  };

  const sendMessage = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/voice-rooms/${roomId}/messages`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/voice-rooms", roomId, "messages"] });
      setChatText("");
    },
  });

  // ── Watch Ad → 20 coins ──
  const watchAd = async () => {
    setWatchingAd(true);
    try {
      const AdMobPlugin = (window as any).Capacitor?.Plugins?.AdMob;
      if (AdMobPlugin) {
        await AdMobPlugin.prepareRewardVideoAd({ adId: "YOUR_ADMOB_REWARDED_AD_UNIT_ID" });
        const result = await AdMobPlugin.showRewardVideoAd();
        if (!result) throw new Error("Ad not completed");
      } else {
        toast({ title: "Ads only work in the mobile app", variant: "destructive" });
        setWatchingAd(false);
        return;
      }
      const res: any = await apiRequest("POST", "/api/coins/earn-ad", {});
      const data = res.json ? await res.json() : res;
      qc.invalidateQueries({ queryKey: ["/api/coins/balance"] });
      toast({ title: `+${data.earned} coins earned!` });
    } catch (err: any) {
      toast({ title: "Ad failed or was skipped", variant: "destructive" });
    } finally {
      setWatchingAd(false);
    }
  };

  useEffect(() => {
    return () => {
      localAudioTrack.current?.close();
      agoraClient.current?.leave().catch(() => {});
    };
  }, []);

  if (!room) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading room...</p>
      </div>
    );
  }

  const seats = room.seats || [];
  const emptySeatSlots = Math.max(0, MAX_SEATS - seats.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "linear-gradient(180deg, #2a0a45, #10041f 60%, #050208)" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={leaveRoom} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="text-center flex-1">
          <p className="text-white font-bold text-sm truncate">{room.title}</p>
          <p className="text-[10px] text-zinc-400">{seats.length}/{MAX_SEATS} in room</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
            <Coins className="w-3 h-3 text-yellow-400" />
            <span className="text-[11px] text-white font-semibold">{coinData?.balance ?? 0}</span>
          </div>
          {isHost && (
            <button
              onClick={() => { setNewCost(room.join_cost); setShowCostEditor(true); }}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            >
              <Settings className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* ── Seats Grid ── */}
      <div className="grid grid-cols-4 gap-4 px-4 py-5">
        {seats.map((seat) => {
          const isSpeaking = speakingUsers.has(stringToNumericUid(seat.user_id));
          return (
            <div key={seat.id} className="flex flex-col items-center gap-1">
              <div className="relative">
                <div className={`w-14 h-14 rounded-full overflow-hidden ring-2 transition-all ${
                  isSpeaking
                    ? "ring-4 ring-green-400 shadow-[0_0_16px_4px_rgba(74,222,128,0.6)] animate-pulse"
                    : "ring-pink-500/50"
                }`}>
                  <img
                    src={seat.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seat.user_id}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                {seat.user_id === room.host_id && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded-full">
                    HOST
                  </span>
                )}
              </div>
              <span className="text-[9px] text-zinc-300 truncate max-w-[56px]">{seat.first_name}</span>
            </div>
          );
        })}
        {Array.from({ length: emptySeatSlots }).map((_, i) => (
          <div key={`empty-${i}`} className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
              <span className="text-white/30 text-xl">+</span>
            </div>
            <span className="text-[9px] text-transparent">-</span>
          </div>
        ))}
      </div>

      {/* ── Watch Ad Button ── */}
      <div className="px-4 pb-2">
        <button
          onClick={watchAd}
          disabled={watchingAd}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          {watchingAd ? "Loading ad..." : "Watch Ad, Get 20 Coins"}
        </button>
      </div>

      {/* ── Live Chat (newest on top) ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col-reverse gap-2">
        {[...messages].reverse().map((m) => (
          <div key={m.id} className="bg-black/30 rounded-xl px-3 py-2 max-w-[85%]">
            <p className="text-[10px] text-pink-300 font-semibold">{m.first_name}</p>
            <p className="text-[13px] text-white">{m.content}</p>
          </div>
        ))}
      </div>

      {/* ── Bottom Controls ── */}
      <div className="px-3 py-3 border-t border-white/10 bg-black/40 backdrop-blur-xl"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-center gap-2">
          {!mySeat ? (
            <button
              onClick={joinRoom}
              disabled={joining}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-sm disabled:opacity-50"
            >
              {joining ? "Joining..." : room.join_cost > 0 ? `Join Room (${room.join_cost} coins)` : "Join Room"}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${isMuted ? "bg-red-500" : "bg-white/10"}`}
              >
                {isMuted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
              </button>
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && chatText.trim()) sendMessage.mutate(chatText.trim()); }}
                placeholder="Type..."
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder-zinc-500"
              />
              <button
                onClick={() => chatText.trim() && sendMessage.mutate(chatText.trim())}
                className="w-11 h-11 rounded-xl bg-pink-500 flex items-center justify-center"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
              {isHost && (
                <button onClick={endRoom} className="px-3 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold">
                  End
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Cost Editor Modal ── */}
      {showCostEditor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-6" onClick={() => setShowCostEditor(false)}>
          <div className="bg-[#1a0a2e] border border-white/10 rounded-2xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <p className="text-white font-bold text-sm mb-3">Set Join Cost</p>
            <input
              type="number"
              min={0}
              value={newCost}
              onChange={(e) => setNewCost(Number(e.target.value))}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCostEditor(false)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-zinc-300 text-sm">
                Cancel
              </button>
              <button onClick={updateCost} className="flex-1 py-2.5 rounded-xl bg-pink-500 text-white text-sm font-bold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}