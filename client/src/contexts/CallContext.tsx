import { createContext, useContext, useRef, useState, useEffect, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

export type CallState = "idle" | "outgoing" | "incoming" | "active";

export interface IncomingCallData {
  from: string;
  callerName: string;
  callerAvatar?: string;
  audioOnly: boolean;
  offer: RTCSessionDescriptionInit;
}

interface CallContextType {
  callState: CallState;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callWith: { id: string; name: string; avatar?: string; audioOnly: boolean } | null;
  incomingCall: IncomingCallData | null;
  isMuted: boolean;
  isCameraOn: boolean;
  startCall: (targetId: string, name: string, avatar?: string, audioOnly?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = (user as any)?.id ?? "";

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callWith, setCallWith] = useState<{ id: string; name: string; avatar?: string; audioOnly: boolean } | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const callWithRef = useRef(callWith);
  callWithRef.current = callWith;

  const sendWs = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    setCallWith(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOn(true);
  }, []);

  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  const createPC = useCallback((targetId: string) => {
    if (pcRef.current) {
      pcRef.current.close();
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendWs({ type: "ice-candidate", to: targetId, candidate: e.candidate });
      }
    };

    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    pc.ontrack = (e) => {
      remote.addTrack(e.track);
      setRemoteStream(new MediaStream(remote.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        cleanupRef.current();
      }
    };

    return pc;
  }, [sendWs]);

  const getLocalStream = useCallback(async (audioOnly: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: audioOnly ? false : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const handleMessage = useCallback(async (data: string) => {
    let msg: any;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === "call-offer") {
      setIncomingCall({
        from: msg.from,
        callerName: msg.callerName || "Someone",
        callerAvatar: msg.callerAvatar,
        audioOnly: msg.audioOnly || false,
        offer: msg.sdp,
      });
      setCallState("incoming");
    } else if (msg.type === "call-answer") {
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(() => {});
        setCallState("active");
      }
    } else if (msg.type === "ice-candidate") {
      if (pcRef.current && msg.candidate) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
      }
    } else if (msg.type === "call-reject" || msg.type === "call-end") {
      cleanupRef.current();
    } else if (msg.type === "follower_update") {
      // Real-time follower count — dispatch a CustomEvent so Profile pages can update immediately
      window.dispatchEvent(new CustomEvent("litlink:follower_update", {
        detail: { userId: msg.userId, followersCount: msg.followersCount },
      }));
    } else if (msg.type === "view_update") {
      // Real-time view count — dispatch so Reels/video components can update the counter
      window.dispatchEvent(new CustomEvent("litlink:view_update", {
        detail: { postId: msg.postId, viewerCount: msg.viewerCount },
      }));
    }
  }, []);

  const messageHandlerRef = useRef(handleMessage);
  messageHandlerRef.current = handleMessage;

  // Connect WebSocket when logged in
  useEffect(() => {
    if (!userId) return;

    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "register", userId }));
      };
      ws.onmessage = (e) => { messageHandlerRef.current(e.data); };
      ws.onclose = () => {
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => { ws.close(); };
    };

    connect();

    return () => {
      destroyed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCall = useCallback(async (targetId: string, name: string, avatar?: string, audioOnly = false) => {
    if (callState !== "idle") return;
    try {
      const stream = await getLocalStream(audioOnly);
      const pc = createPC(targetId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callerName = [(user as any)?.firstName, (user as any)?.lastName].filter(Boolean).join(" ") || "Someone";
      sendWs({
        type: "call-offer",
        to: targetId,
        sdp: offer,
        callerName,
        callerAvatar: (user as any)?.profileImageUrl,
        audioOnly,
      });

      setCallWith({ id: targetId, name, avatar, audioOnly });
      setCallState("outgoing");
      setIsCameraOn(!audioOnly);
    } catch (err) {
      console.error("Failed to start call:", err);
      cleanupRef.current();
    }
  }, [callState, getLocalStream, createPC, sendWs, user]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      const stream = await getLocalStream(incomingCall.audioOnly);
      const pc = createPC(incomingCall.from);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendWs({ type: "call-answer", to: incomingCall.from, sdp: answer });

      setCallWith({ id: incomingCall.from, name: incomingCall.callerName, avatar: incomingCall.callerAvatar, audioOnly: incomingCall.audioOnly });
      setIncomingCall(null);
      setCallState("active");
      setIsCameraOn(!incomingCall.audioOnly);
    } catch (err) {
      console.error("Failed to accept call:", err);
      cleanupRef.current();
    }
  }, [incomingCall, getLocalStream, createPC, sendWs]);

  const rejectCall = useCallback(() => {
    if (incomingCall) sendWs({ type: "call-reject", to: incomingCall.from });
    setIncomingCall(null);
    setCallState("idle");
  }, [incomingCall, sendWs]);

  const endCall = useCallback(() => {
    if (callWithRef.current) sendWs({ type: "call-end", to: callWithRef.current.id });
    cleanup();
  }, [sendWs, cleanup]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(m => !m);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsCameraOn(c => !c);
    }
  }, []);

  return (
    <CallContext.Provider value={{
      callState,
      localStream,
      remoteStream,
      callWith,
      incomingCall,
      isMuted,
      isCameraOn,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleMute,
      toggleCamera,
    }}>
      {children}
    </CallContext.Provider>
  );
}
