import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Mic, MicOff, X, Send, Coins, Play, Settings, UserX, UserPlus, Check, Gift,
  Shield, Lock, Unlock, Volume2, VolumeX, Trash2, Ban,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiUrl} from "@/lib/queryClient";
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
  requires_approval: boolean;
  is_locked?: boolean;
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

interface JoinRequest {
  id: number;
  room_id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  profile_image_url: string | null;
}

const MAX_SEATS = 12;
const WS_RECONNECT_DELAY_MS = 3000;

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

  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [giftTargetUserId, setGiftTargetUserId] = useState<string | null>(null);
  const [floatingGifts, setFloatingGifts] = useState<{ id: string; icon: string; name: string }[]>([]);
  const [chatText, setChatText] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [showCostEditor, setShowCostEditor] = useState(false);
  const [newCost, setNewCost] = useState(0);
  const [newRequiresApproval, setNewRequiresApproval] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [speakingUsers, setSpeakingUsers] = useState<Set<number>>(new Set());
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const agoraClient = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const { data: room, refetch: refetchRoom } = useQuery<Room>({
    queryKey: ["/api/voice-rooms", roomId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/voice-rooms/${roomId}`), { credentials: "include" });
      if (!res.ok) throw new Error("Room not found");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: messages = [] } = useQuery<RoomMessage[]>({
    queryKey: ["/api/voice-rooms", roomId, "messages"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/voice-rooms/${roomId}/messages`), { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 4000,
  });

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins/balance"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/coins/balance"), { credentials: "include" });
      return res.json();
    },
  });

  const { data: giftCatalog = [] } = useQuery<{ id: number; name: string; icon: string; price_coins: number }[]>({
    queryKey: ["/api/gifts/catalog"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/gifts/catalog"), { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isHost = room?.host_id === currentUserId;
  // Guard against `room.seats` being missing on a malformed/partial API response —
  // without the extra `?.` here a network hiccup would crash the whole screen.
  const mySeat = room?.seats?.find(s => s.user_id === currentUserId);

  // ── Host follow status ──
  // Only viewers need this. The host never sees a Follow button for themselves.
  const { data: hostFollowData } = useQuery<{ following: boolean }>({
    queryKey: ["/api/users", room?.host_id, "follow-status"],
    queryFn: async () => {
      const hostId = room?.host_id;
      if (!hostId || hostId === currentUserId) return { following: false };

      const res = await fetch(apiUrl(`/api/users/${hostId}/follow-status`), {
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) return { following: false };

      const data = await res.json().catch(() => ({}));
      return { following: Boolean(data?.following) };
    },
    enabled: !!room?.host_id && room.host_id !== currentUserId,
    staleTime: 5000,
  });

  const isFollowingHost = Boolean(hostFollowData?.following);

  const hostFollowMutation = useMutation({
    mutationFn: async (nextFollowing: boolean) => {
      const hostId = room?.host_id;

      if (!hostId || hostId === currentUserId) {
        return { following: false };
      }

      const res = await fetch(apiUrl(`/api/users/${hostId}/follow`), {
        method: nextFollowing ? "POST" : "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "Could not update follow");
      }

      return {
        following: Boolean(data?.following),
      };
    },

    // Optimistic UI: Follow -> Following instantly on tap.
    onMutate: async (nextFollowing: boolean) => {
      const hostId = room?.host_id;
      if (!hostId) return;

      const key = ["/api/users", hostId, "follow-status"];

      await qc.cancelQueries({
        queryKey: key,
      });

      const previous =
        qc.getQueryData<{ following: boolean }>(key);

      qc.setQueryData(key, {
        following: nextFollowing,
      });

      return {
        previous,
        key,
      };
    },

    onError: (err: any, _nextFollowing, context) => {
      if (context?.key) {
        qc.setQueryData(
          context.key,
          context.previous ?? { following: false }
        );
      }

      toast({
        title: "Could not update follow",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    },

    onSuccess: (data) => {
      const hostId = room?.host_id;
      if (!hostId) return;

      qc.setQueryData(
        ["/api/users", hostId, "follow-status"],
        { following: data.following }
      );

      qc.invalidateQueries({
        queryKey: ["/api/users", hostId],
      });

      qc.invalidateQueries({
        queryKey: ["/api/profile"],
      });
    },
  });

  const { data: joinRequests = [] } = useQuery<JoinRequest[]>({
    queryKey: ["/api/voice-rooms", roomId, "join-requests"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/voice-rooms/${roomId}/join-requests`), { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!isHost,
    refetchInterval: 5000,
  });

  const connectToAgora = useCallback(async () => {
    if (connected || !room) return;
    let client: IAgoraRTCClient | null = null;
    try {
      const tokenRes: any = await apiRequest("POST", "/api/agora/token", { channelName: room.channel_name });
      const tokenData = tokenRes.json ? await tokenRes.json() : tokenRes;
      if (!isMountedRef.current) return;

      client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      agoraClient.current = client;

      client.on("user-published", async (remoteUser, mediaType) => {
        await client!.subscribe(remoteUser, mediaType);
        if (mediaType === "audio") {
          remoteUser.audioTrack?.play();
        }
      });

      client.enableAudioVolumeIndicator();
      client.on("volume-indicator", (volumes: any[]) => {
        const speaking = new Set<number>();
        volumes.forEach((v: any) => {
          if (v.level > 5) speaking.add(v.uid);
        });
        if (isMountedRef.current) setSpeakingUsers(speaking);
      });

      await client.join(tokenData.appId, tokenData.channelName, tokenData.token, tokenData.uid);
      if (!isMountedRef.current) {
        // Component unmounted mid-connect — leave immediately, don't leak the session.
        await client.leave().catch(() => {});
        return;
      }

      // Microphone access is a separate failure point from joining the channel.
      // If this throws (permission denied, no device, etc.) we must leave the
      // channel we just joined instead of leaving an orphaned connection behind.
      try {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        if (!isMountedRef.current) {
          audioTrack.close();
          await client.leave().catch(() => {});
          return;
        }
        localAudioTrack.current = audioTrack;
        await client.publish([audioTrack]);
      } catch (micErr: any) {
        await client.leave().catch(() => {});
        agoraClient.current = null;
        toast({
          title: "Microphone access needed",
          description: micErr?.message || "Please allow microphone access to join the voice room.",
          variant: "destructive",
        });
        return;
      }

      setConnected(true);
    } catch (err: any) {
      if (client) {
        await client.leave().catch(() => {});
        if (agoraClient.current === client) agoraClient.current = null;
      }
      toast({ title: "Voice connection failed", description: err.message, variant: "destructive" });
    }
  }, [connected, room, toast]);

  const joinRoom = useCallback(async () => {
    if (!room || joining) return;
    setJoining(true);
    try {
      const res: any = await apiRequest("POST", `/api/voice-rooms/${roomId}/join`, {});
      const data = res.json ? await res.json() : res;
      if (!isMountedRef.current) return;
      if (data.requiresApproval) {
        await apiRequest("POST", `/api/voice-rooms/${roomId}/request-join`, {});
        if (isMountedRef.current) {
          setRequestSent(true);
          toast({ title: "Request sent to host" });
        }
        return;
      }
      if (data.message && !data.success) {
        toast({ title: data.message, variant: "destructive" });
        return;
      }
      await connectToAgora();
      refetchRoom();
    } catch (err: any) {
      const msg = err?.message || "Could not join room";
      if (msg.toLowerCase().includes("approval")) {
        await apiRequest("POST", `/api/voice-rooms/${roomId}/request-join`, {}).catch(() => {});
        if (isMountedRef.current) {
          setRequestSent(true);
          toast({ title: "Request sent to host" });
        }
      } else if (msg.toLowerCase().includes("locked")) {
        toast({ title: "This room is locked by the host", variant: "destructive" });
      } else {
        toast({ title: msg, variant: "destructive" });
      }
    } finally {
      if (isMountedRef.current) setJoining(false);
    }
  }, [room, roomId, joining, connectToAgora, refetchRoom]);

  useEffect(() => {
    if (room && mySeat && !connected) {
      connectToAgora();
    }
  }, [room, mySeat, connected, connectToAgora]);

  // ── WebSocket with auto-reconnect ──
  // The original connection had no recovery path: one dropped connection (common
  // when a phone backgrounds the app) silently killed mute/kick/gift updates for
  // the rest of the session. This now reconnects with a fixed backoff until the
  // component unmounts.
  useEffect(() => {
    if (!currentUserId) return;
    isMountedRef.current = true;

    const connectWebSocket = () => {
      if (!isMountedRef.current) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "register", userId: currentUserId }));
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.roomId !== roomId) return;

          if (data.type === "voice_room_join_response") {
            if (data.approved) {
              toast({ title: "Host approved your request!" });
              setRequestSent(false);
              refetchRoom();
            } else {
              toast({ title: "Host denied your request", variant: "destructive" });
              setRequestSent(false);
            }
          }
          if (data.type === "voice_room_force_mute") {
            setForceMuted(data.muted);
            if (data.muted && localAudioTrack.current) {
              localAudioTrack.current.setEnabled(false);
              setIsMuted(true);
            }
            toast({ title: data.muted ? "Host muted you" : "Host unmuted you" });
          }
          if (data.type === "voice_room_kicked") {
            toast({ title: "You were removed from the room", variant: "destructive" });
            leaveRoom();
          }
          if (data.type === "voice_room_banned") {
            toast({ title: "You were banned from this room", variant: "destructive" });
            leaveRoom();
          }
          if (data.type === "voice_room_locked") {
            refetchRoom();
            toast({ title: data.locked ? "Host locked the room" : "Host unlocked the room" });
          }
          if (data.type === "voice_room_chat_cleared") {
            qc.invalidateQueries({ queryKey: ["/api/voice-rooms", roomId, "messages"] });
          }

          if (data.type === "voice_room_ended") {
            toast({ title: "Room ended by host" });
            void cleanupVoiceConnection().finally(() => navigate("/"));
            return;
          }
          if (data.type === "voice_room_join_request") {
            qc.invalidateQueries({ queryKey: ["/api/voice-rooms", roomId, "join-requests"] });
            toast({ title: `${data.user?.firstName ?? "Someone"} wants to join` });
          }
          if (data.type === "voice_room_gift") {
            const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            setFloatingGifts(prev => [...prev, { id, icon: data.gift.icon, name: data.gift.name }]);
            setTimeout(() => setFloatingGifts(prev => prev.filter(f => f.id !== id)), 2500);
          }
          if (data.type === "voice_room_gift") {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setFloatingGifts(prev => [...prev, { id, icon: data.gift.icon, name: data.gift.name }]);
  setTimeout(() => setFloatingGifts(prev => prev.filter(f => f.id !== id)), 2500);
}
if (data.type === "voice_room_message") {          // 👈 ye poora block naya hai, add karo
  qc.invalidateQueries({ queryKey: ["/api/voice-rooms", roomId, "messages"] });
}
        } catch {
          // Malformed message from server — ignore rather than crash the screen.
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        wsReconnectTimer.current = setTimeout(connectWebSocket, WS_RECONNECT_DELAY_MS);
      };
    };

    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
      wsRef.current?.close();
    };
  }, [currentUserId, roomId]);

  const cleanupVoiceConnection = useCallback(async () => {
    if (wsReconnectTimer.current) {
      clearTimeout(wsReconnectTimer.current);
      wsReconnectTimer.current = null;
    }

    if (localAudioTrack.current) {
      try {
        localAudioTrack.current.stop();
      } catch {}
      try {
        localAudioTrack.current.close();
      } catch {}
      localAudioTrack.current = null;
    }

    if (agoraClient.current) {
      try {
        await agoraClient.current.leave();
      } catch {}
      agoraClient.current = null;
    }

    setConnected(false);
    setIsMuted(false);
    setForceMuted(false);
  }, []);

  const openBuyCoins = useCallback(() => {
    setShowGiftPicker(false);

    const returnTo = `${window.location.pathname}${window.location.search}`;
    navigate(`/buy-coins?returnTo=${encodeURIComponent(returnTo)}`);
  }, [navigate]);

  useEffect(() => {
    if (room?.is_active === false) {
      void cleanupVoiceConnection().finally(() => navigate("/"));
    }
  }, [room?.is_active, cleanupVoiceConnection, navigate]);

  const leaveRoom = async () => {
    // Host ke back dabane par room sirf "leave" nahi hona chahiye — warna
    // room database mein active/zombie reh jaata hai. Host ke liye ye
    // properly room end karta hai; baaki participants ke liye normal leave.
    if (isHost) {
      await endRoom();
      return;
    }
    try {
      await cleanupVoiceConnection();
      await apiRequest("POST", `/api/voice-rooms/${roomId}/leave`, {}).catch(() => {});
    } finally {
      navigate("/");
    }
  };

  const toggleMute = async () => {
    if (!localAudioTrack.current || forceMuted) return;
    if (isMuted) {
      await localAudioTrack.current.setEnabled(true);
    } else {
      await localAudioTrack.current.setEnabled(false);
    }
    setIsMuted(!isMuted);
  };

  const endRoom = async () => {
    if (!isHost || isEnding) return;

    setIsEnding(true);
    try {
      const res = await fetch(apiUrl(`/api/voice-rooms/${roomId}/end`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `Could not end room (${res.status})`);
      }

      // End locally immediately instead of calling /leave and waiting again.
      await cleanupVoiceConnection();

      qc.setQueryData(["/api/voice-rooms", roomId], (old: any) =>
        old ? { ...old, is_active: false, seats: [] } : old
      );
      qc.invalidateQueries({ queryKey: ["/api/voice-rooms"] });

      toast({ title: "Room ended" });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Could not end room",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
      setIsEnding(false);
    }
  };

  const updateSettings = async () => {
    try {
      await apiRequest("PATCH", `/api/voice-rooms/${roomId}/cost`, { joinCost: newCost });
      await apiRequest("PATCH", `/api/voice-rooms/${roomId}/settings`, { requiresApproval: newRequiresApproval });
      setShowCostEditor(false);
      refetchRoom();
      toast({ title: "Room settings updated" });
    } catch {
      toast({ title: "Could not update settings", variant: "destructive" });
    }
  };

  const respondToRequest = async (targetUserId: string, action: "approve" | "deny") => {
    try {
      await apiRequest("POST", `/api/voice-rooms/${roomId}/join-requests/${targetUserId}/${action}`, {});
      qc.invalidateQueries({ queryKey: ["/api/voice-rooms", roomId, "join-requests"] });
      refetchRoom();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    }
  };

  const toggleSeatMute = async (targetUserId: string, currentlyMuted: boolean) => {
    try {
      await apiRequest("POST", `/api/voice-rooms/${roomId}/seats/${targetUserId}/mute`, { muted: !currentlyMuted });
      refetchRoom();
      setSelectedSeat(null);
    } catch {
      toast({ title: "Could not update mute", variant: "destructive" });
    }
  };

  const kickUser = async (targetUserId: string) => {
    try {
      await apiRequest("DELETE", `/api/voice-rooms/${roomId}/seats/${targetUserId}`, {});
      refetchRoom();
      setSelectedSeat(null);
      toast({ title: "User removed" });
    } catch {
      toast({ title: "Could not remove user", variant: "destructive" });
    }
  };

  // ── NEW: permanent ban (kick + block from rejoining) ──
  // Needs a matching backend route: POST /api/voice-rooms/:id/ban/:userId
  // which should (1) remove the seat, (2) add the user to a banned list for
  // this room, and (3) reject future /join or /request-join calls from them.
  const banUser = async (targetUserId: string) => {
    if (!window.confirm("Ban this user from the room? They won't be able to rejoin.")) return;
    try {
      await apiRequest("POST", `/api/voice-rooms/${roomId}/ban/${targetUserId}`, {});
      refetchRoom();
      setSelectedSeat(null);
      toast({ title: "User banned from room" });
    } catch {
      toast({ title: "Could not ban user", variant: "destructive" });
    }
  };

  // ── NEW: mute everyone at once ──
  // Needs: POST /api/voice-rooms/:id/mute-all { muted: boolean }
  // Should set is_muted on every non-host seat and broadcast
  // voice_room_force_mute to each affected user over the websocket.
  const allNonHostMuted = (room?.seats ?? [])
    .filter(s => s.user_id !== room?.host_id)
    .every(s => s.is_muted);
  const hasNonHostSeats = (room?.seats ?? []).some(s => s.user_id !== room?.host_id);

  const muteAllMutation = useMutation({
    mutationFn: (muted: boolean) => apiRequest("POST", `/api/voice-rooms/${roomId}/mute-all`, { muted }),
    onSuccess: () => {
      refetchRoom();
      toast({ title: allNonHostMuted ? "Everyone unmuted" : "Everyone muted" });
    },
    onError: () => toast({ title: "Could not update mute for everyone", variant: "destructive" }),
  });

  // ── NEW: lock/unlock room ──
  // Needs: PATCH /api/voice-rooms/:id/lock { locked: boolean }
  // Should reject /join and /request-join while locked (except for the host).
  const lockRoomMutation = useMutation({
    mutationFn: (locked: boolean) => apiRequest("PATCH", `/api/voice-rooms/${roomId}/lock`, { locked }),
    onSuccess: () => {
      refetchRoom();
      toast({ title: room?.is_locked ? "Room unlocked" : "Room locked" });
    },
    onError: () => toast({ title: "Could not update room lock", variant: "destructive" }),
  });

  // ── NEW: clear chat ──
  // Needs: DELETE /api/voice-rooms/:id/messages
  const clearChatMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/voice-rooms/${roomId}/messages`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/voice-rooms", roomId, "messages"] });
      toast({ title: "Chat cleared" });
    },
    onError: () => toast({ title: "Could not clear chat", variant: "destructive" }),
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => apiRequest("POST", `/api/voice-rooms/${roomId}/messages`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/voice-rooms", roomId, "messages"] });
      setChatText("");
    },
    onError: () => {
      toast({ title: "Message not sent", variant: "destructive" });
    },
  });

  const sendGift = useMutation({
    mutationFn: async ({
      giftId,
      receiverId,
    }: {
      giftId: number;
      receiverId: string;
    }) => {
      const res = await fetch(apiUrl("/api/gifts/send"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          giftId,
          receiverId,
          roomId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 402 || data?.code === "INSUFFICIENT_COINS") {
        const error: any = new Error(data?.message || "Not enough coins");
        error.status = 402;
        error.required = Number(data?.required ?? 0);
        error.balance = Number(data?.balance ?? 0);
        throw error;
      }

      if (!res.ok) {
        const error: any = new Error(data?.message || "Could not send gift");
        error.status = res.status;
        throw error;
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/coins/balance"] });

      const gift = giftCatalog.find((g) => g.id === variables.giftId);
      if (gift) {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setFloatingGifts((prev) => [
          ...prev,
          { id, icon: gift.icon, name: gift.name },
        ]);
        setTimeout(
          () => setFloatingGifts((prev) => prev.filter((f) => f.id !== id)),
          2500
        );
      }

      setShowGiftPicker(false);
      setGiftTargetUserId(null);
    },
    onError: (err: any) => {
      if (err?.status === 402) {
        const missing = Math.max(
          0,
          Number(err?.required ?? 0) - Number(err?.balance ?? 0)
        );

        toast({
          title: "Not enough coins",
          description:
            missing > 0
              ? `You need ${missing} more coins. Opening Buy Coins...`
              : "Opening Buy Coins...",
        });

        openBuyCoins();
        return;
      }

      toast({
        title: err?.message || "Could not send gift",
        variant: "destructive",
      });
    },
  });

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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
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
  const isLocked = !!room.is_locked;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "linear-gradient(180deg, #2a0a45, #10041f 60%, #050208)" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button onClick={leaveRoom} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="text-center flex-1">
          <p className="text-white font-bold text-sm truncate">{room.title}</p>
          <p className="text-[10px] text-zinc-400 flex items-center justify-center gap-1">
            {seats.length}/{MAX_SEATS} in room
            {isLocked && (
              <span className="inline-flex items-center gap-0.5 text-orange-400">
                <Lock className="w-2.5 h-2.5" /> Locked
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
            <Coins className="w-3 h-3 text-yellow-400" />
            <span className="text-[11px] text-white font-semibold">{coinData?.balance ?? 0}</span>
          </div>
          {isHost && joinRequests.length > 0 && (
            <button
              onClick={() => setShowRequests(true)}
              className="relative w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            >
              <Check className="w-4 h-4 text-white" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                {joinRequests.length}
              </span>
            </button>
          )}
          {isHost && (
            <button
              onClick={() => setShowAdminPanel(true)}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              title="Admin Panel"
            >
              <Shield className="w-4 h-4 text-white" />
            </button>
          )}
          {isHost && (
            <button
              onClick={() => { setNewCost(room.join_cost); setNewRequiresApproval(room.requires_approval); setShowCostEditor(true); }}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              title="Room Settings"
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
          const canControl = isHost && seat.user_id !== room.host_id;
          return (
            <div
              key={seat.id}
              className="flex flex-col items-center gap-1 min-w-0"
            >
              {/* Follow button appears directly ABOVE the host only for other users */}
              {seat.user_id === room.host_id && seat.user_id !== currentUserId ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!hostFollowMutation.isPending) {
                      hostFollowMutation.mutate(!isFollowingHost);
                    }
                  }}
                  disabled={hostFollowMutation.isPending}
                  className={`mb-1 h-6 px-2.5 rounded-full text-[9px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-60 ${
                    isFollowingHost
                      ? "bg-white/10 border border-white/15 text-zinc-200"
                      : "bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-[0_0_10px_rgba(236,72,153,0.35)]"
                  }`}
                >
                  {!isFollowingHost && <UserPlus className="w-2.5 h-2.5" />}
                  {isFollowingHost ? "Following" : "Follow"}
                </button>
              ) : (
                <div className="h-7" />
              )}

              <button
                type="button"
                onClick={() => {
                  if (canControl) {
                    setSelectedSeat(seat);
                    return;
                  }

                  if (seat.user_id !== currentUserId) {
                    setGiftTargetUserId(seat.user_id);
                    setShowGiftPicker(true);
                  }
                }}
                className="flex flex-col items-center gap-1 min-w-0"
              >
                <div className="relative">
                  <div className={`w-14 h-14 rounded-full overflow-hidden ring-2 transition-all ${
                    isSpeaking
                      ? "ring-4 ring-green-400 shadow-[0_0_16px_4px_rgba(74,222,128,0.6)] animate-pulse"
                      : "ring-pink-500/50"
                  }`}>
                    <img
                      src={seat.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seat.user_id}`}
                      alt={seat.first_name || "Voice room user"}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {seat.user_id === room.host_id && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded-full">
                      HOST
                    </span>
                  )}

                  {seat.is_muted && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <MicOff className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </div>

                <span className="text-[9px] text-zinc-300 truncate max-w-[56px]">
                  {seat.first_name}
                </span>
              </button>
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

      {/* ── Floating Gift Animations ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-32 flex flex-col items-center gap-2 z-40">
        {floatingGifts.map((g) => (
          <div key={g.id} className="animate-bounce bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
            <span className="text-2xl">{g.icon}</span>
            <span className="text-white text-xs font-bold">{g.name}!</span>
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
<div
  className="px-3 py-3 border-t border-white/10 bg-black/40 backdrop-blur-xl"
  style={{
    paddingBottom:
      "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
  }}
>
  {!mySeat ? (
    /* =====================================================
       VIEWER MODE
       User room mein listener hai.
       Voice seat join nahi ki hai.
       Lekin Chat + Gift available hain.
    ===================================================== */
    <div className="space-y-2">
      {/* Small Join button */}
      <div className="flex justify-center">
        {isLocked && !isHost ? (
          <button
            disabled
            className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-500 font-bold text-xs flex items-center justify-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            Room is locked
          </button>
        ) : (
          <button
            onClick={joinRoom}
            disabled={joining || requestSent}
            className="px-7 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold text-xs disabled:opacity-50"
          >
            {requestSent
              ? "Waiting for approval..."
              : joining
              ? "Joining..."
              : room.join_cost > 0
              ? `Join (${room.join_cost} coins)`
              : "Join"}
          </button>
        )}
      </div>

      {/* Chat + Gift */}
      <div className="flex items-center gap-2">
        {/* Gift */}
        <button
          type="button"
          onClick={() => {
            if (!room?.host_id) return;

            setGiftTargetUserId(room.host_id);
            setShowGiftPicker(true);
          }}
          disabled={!room?.host_id}
          className="w-11 h-11 shrink-0 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/15 transition-colors disabled:opacity-50"
          aria-label="Send gift"
        >
          <Gift className="w-4 h-4 text-pink-400" />
        </button>

        {/* Chat input */}
        <input
          value={chatText}
          onChange={(e) => setChatText(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              chatText.trim() &&
              !sendMessage.isPending
            ) {
              sendMessage.mutate(chatText.trim());
            }
          }}
          placeholder="Chat in this room..."
          className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder-zinc-500 focus:border-pink-500/50"
        />

        {/* Send */}
        <button
          type="button"
          onClick={() => {
            if (
              chatText.trim() &&
              !sendMessage.isPending
            ) {
              sendMessage.mutate(chatText.trim());
            }
          }}
          disabled={
            !chatText.trim() ||
            sendMessage.isPending
          }
          className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 flex items-center justify-center disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>

      <p className="text-center text-[10px] text-zinc-600">
        You are listening. Join only if you want to speak.
      </p>
    </div>
  ) : (
    /* =====================================================
       MEMBER / SPEAKER MODE
       User already has a seat.
    ===================================================== */
    <div className="flex items-center gap-2">
      {/* Gift */}
      <button
        type="button"
        onClick={() => {
          const targetUserId =
            room.host_id === currentUserId
              ? seats.find(
                  (s) =>
                    s.user_id !== currentUserId
                )?.user_id ?? null
              : room.host_id;

          setGiftTargetUserId(targetUserId);
          setShowGiftPicker(true);
        }}
        className="w-11 h-11 shrink-0 rounded-xl bg-white/10 flex items-center justify-center"
        aria-label="Send gift"
      >
        <Gift className="w-4 h-4 text-pink-400" />
      </button>

      {/* Mic */}
      <button
        onClick={toggleMute}
        disabled={forceMuted}
        className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${
          isMuted || forceMuted
            ? "bg-red-500"
            : "bg-white/10"
        } disabled:opacity-70`}
        aria-label={
          isMuted || forceMuted
            ? "Unmute microphone"
            : "Mute microphone"
        }
      >
        {isMuted || forceMuted ? (
          <MicOff className="w-4 h-4 text-white" />
        ) : (
          <Mic className="w-4 h-4 text-white" />
        )}
      </button>

      {/* Chat */}
      <input
        value={chatText}
        onChange={(e) =>
          setChatText(e.target.value)
        }
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            chatText.trim() &&
            !sendMessage.isPending
          ) {
            sendMessage.mutate(chatText.trim());
          }
        }}
        placeholder="Type..."
        className="flex-1 min-w-0 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder-zinc-500"
      />

      {/* Send */}
      <button
        type="button"
        onClick={() => {
          if (
            chatText.trim() &&
            !sendMessage.isPending
          ) {
            sendMessage.mutate(chatText.trim());
          }
        }}
        disabled={
          !chatText.trim() ||
          sendMessage.isPending
        }
        className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 flex items-center justify-center disabled:opacity-40"
        aria-label="Send message"
      >
        <Send className="w-4 h-4 text-white" />
      </button>
    </div>
  )}
</div>

      {/* ── Seat Control Modal (host: mute/kick/ban) ── */}
      {selectedSeat && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-6" onClick={() => setSelectedSeat(null)}>
          <div className="bg-[#1a0a2e] border border-white/10 rounded-2xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <p className="text-white font-bold text-sm mb-4">{selectedSeat.first_name}</p>
            <button
              onClick={() => toggleSeatMute(selectedSeat.user_id, selectedSeat.is_muted)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/8 hover:bg-white/12 mb-2 text-left"
            >
              <MicOff className="w-4 h-4 text-orange-400" />
              <span className="text-white text-sm">{selectedSeat.is_muted ? "Unmute user" : "Mute user"}</span>
            </button>
            <button
              onClick={() => kickUser(selectedSeat.user_id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 mb-2 text-left"
            >
              <UserX className="w-4 h-4 text-orange-400" />
              <span className="text-orange-400 text-sm">Remove from room</span>
            </button>
            <button
              onClick={() => banUser(selectedSeat.user_id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 mb-2 text-left"
            >
              <Ban className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm">Ban permanently</span>
            </button>
            <button onClick={() => setSelectedSeat(null)} className="w-full py-2.5 rounded-xl bg-white/10 text-zinc-300 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Pending Join Requests Modal (host) ── */}
      {showRequests && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-6" onClick={() => setShowRequests(false)}>
          <div className="bg-[#1a0a2e] border border-white/10 rounded-2xl p-5 w-full max-w-xs max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <p className="text-white font-bold text-sm mb-4">Join Requests</p>
            {joinRequests.length === 0 ? (
              <p className="text-zinc-500 text-xs">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {joinRequests.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
                    <img
                      src={r.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${r.user_id}`}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <span className="flex-1 text-white text-xs font-semibold">{r.first_name}</span>
                    <button onClick={() => respondToRequest(r.user_id, "approve")} className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button onClick={() => respondToRequest(r.user_id, "deny")} className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setShowRequests(false)} className="w-full mt-4 py-2.5 rounded-xl bg-white/10 text-zinc-300 text-sm">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Room Settings Modal (host) ── */}
      {showCostEditor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-6" onClick={() => setShowCostEditor(false)}>
          <div className="bg-[#1a0a2e] border border-white/10 rounded-2xl p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <p className="text-white font-bold text-sm mb-3">Room Settings</p>
            <label className="text-xs text-zinc-400 font-semibold">Join Cost (coins)</label>
            <input
              type="number"
              min={0}
              value={newCost}
              onChange={(e) => setNewCost(Number(e.target.value))}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none mb-3 mt-1"
            />
            <button
              onClick={() => setNewRequiresApproval(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/8 mb-4"
            >
              <span className="text-white text-sm">Require approval to join</span>
              <div className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${newRequiresApproval ? "bg-pink-500 justify-end" : "bg-white/20 justify-start"}`}>
                <div className="w-5 h-5 rounded-full bg-white" />
              </div>
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowCostEditor(false)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-zinc-300 text-sm">
                Cancel
              </button>
              <button onClick={updateSettings} className="flex-1 py-2.5 rounded-xl bg-pink-500 text-white text-sm font-bold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW: Admin Panel (host) ── */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end justify-center" onClick={() => setShowAdminPanel(false)}>
          <div
            className="bg-[#1a0a2e] border-t border-white/10 rounded-t-3xl p-5 w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-pink-400" />
              <p className="text-white font-bold text-sm">Admin Panel</p>
            </div>

            {/* Room-wide controls */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                onClick={() => muteAllMutation.mutate(!allNonHostMuted)}
                disabled={!hasNonHostSeats || muteAllMutation.isPending}
                className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-40"
              >
                {allNonHostMuted ? <Volume2 className="w-4 h-4 text-green-400" /> : <VolumeX className="w-4 h-4 text-orange-400" />}
                <span className="text-white text-xs font-semibold">{allNonHostMuted ? "Unmute All" : "Mute All"}</span>
              </button>
              <button
                onClick={() => lockRoomMutation.mutate(!isLocked)}
                disabled={lockRoomMutation.isPending}
                className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-40"
              >
                {isLocked ? <Unlock className="w-4 h-4 text-green-400" /> : <Lock className="w-4 h-4 text-orange-400" />}
                <span className="text-white text-xs font-semibold">{isLocked ? "Unlock Room" : "Lock Room"}</span>
              </button>
              <button
                onClick={() => { if (window.confirm("Clear all chat messages for everyone?")) clearChatMutation.mutate(); }}
                disabled={clearChatMutation.isPending}
                className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span className="text-white text-xs font-semibold">Clear Chat</span>
              </button>
              <button
                onClick={() => { setShowAdminPanel(false); setShowRequests(true); }}
                className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-xl bg-white/8 hover:bg-white/12 relative"
              >
                <Check className="w-4 h-4 text-pink-400" />
                <span className="text-white text-xs font-semibold">Join Requests</span>
                {joinRequests.length > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                    {joinRequests.length}
                  </span>
                )}
              </button>
            </div>

            {/* Per-user management */}
            <p className="text-xs text-zinc-400 font-semibold mb-2">Manage Participants</p>
            {seats.filter(s => s.user_id !== room.host_id).length === 0 ? (
              <p className="text-zinc-500 text-xs mb-2">No other participants yet</p>
            ) : (
              <div className="space-y-2">
                {seats.filter(s => s.user_id !== room.host_id).map((seat) => (
                  <div key={seat.id} className="flex items-center gap-2 bg-white/5 rounded-xl p-2">
                    <img
                      src={seat.profile_image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${seat.user_id}`}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <span className="flex-1 text-white text-xs font-semibold truncate">{seat.first_name}</span>
                    <button
                      onClick={() => toggleSeatMute(seat.user_id, seat.is_muted)}
                      className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center"
                      title={seat.is_muted ? "Unmute" : "Mute"}
                    >
                      <MicOff className={`w-3.5 h-3.5 ${seat.is_muted ? "text-orange-400" : "text-zinc-400"}`} />
                    </button>
                    <button
                      onClick={() => kickUser(seat.user_id)}
                      className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center"
                      title="Remove"
                    >
                      <UserX className="w-3.5 h-3.5 text-orange-400" />
                    </button>
                    <button
                      onClick={() => banUser(seat.user_id)}
                      className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center"
                      title="Ban"
                    >
                      <Ban className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setShowAdminPanel(false)} className="w-full mt-5 py-2.5 rounded-xl bg-white/10 text-zinc-300 text-sm">
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Gift Picker Modal ── */}
      {showGiftPicker && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end justify-center" onClick={() => setShowGiftPicker(false)}>
          <div className="bg-[#1a0a2e] border-t border-white/10 rounded-t-3xl p-5 w-full max-w-md max-h-[60vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold text-sm">Send a Gift</p>
              <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
                <Coins className="w-3 h-3 text-yellow-400" />
                <span className="text-[11px] text-white font-semibold">{coinData?.balance ?? 0}</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {giftCatalog.map((gift) => {
                const balance = coinData?.balance ?? 0;
                const canAfford = balance >= gift.price_coins;
                return (
                  <button
                    key={gift.id}
                    onClick={() => {
                      if (!canAfford) {
                        // NOTE: "/coins" is a placeholder route for the buy-coins
                        // screen — swap it for the actual path used in this app.
                        toast({
                          title: "Not enough coins",
                          description: `You need ${gift.price_coins - balance} more coins for ${gift.name}.`,
                        });
                        setShowGiftPicker(false);
                        openBuyCoins();
                        return;
                      }
                      if (giftTargetUserId) sendGift.mutate({ giftId: gift.id, receiverId: giftTargetUserId });
                    }}
                    disabled={sendGift.isPending}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                      canAfford ? "bg-white/5 hover:bg-white/10" : "bg-white/[0.02] opacity-40"
                    }`}
                  >
                    <span className="text-3xl">{gift.icon}</span>
                    <span className="text-[9px] text-zinc-300 truncate w-full text-center">{gift.name}</span>
                    <span className={`text-[9px] font-bold ${canAfford ? "text-yellow-400" : "text-red-400"}`}>
                      {gift.price_coins}{!canAfford && " 🔒"}
                    </span>
                  </button>
                );
              })}
            </div>
            {giftCatalog.some(g => (coinData?.balance ?? 0) < g.price_coins) && (
              <button
                onClick={() => { setShowGiftPicker(false); openBuyCoins(); }}
                className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <Coins className="w-3.5 h-3.5" /> Buy Coins
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}