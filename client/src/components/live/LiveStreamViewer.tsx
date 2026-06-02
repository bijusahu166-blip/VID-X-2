import { X, Heart, Share2, Users, Radio, Send, Wifi } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playGoLive, playNotification } from "@/lib/sounds";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAgoraRTCViewer } from "@/lib/useAgoraRTCViewer";
import { useAgoraRTM } from "@/lib/useAgoraRTM";

interface LiveStreamViewerProps {
  post: any;
  onClose: () => void;
}

export function LiveStreamViewer({ post, onClose }: LiveStreamViewerProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [viewerCount, setViewerCount] = useState<number>(post.viewerCount ?? post.viewer_count ?? 0);
  const [heartAnim, setHeartAnim] = useState(false);
  const [myMsg, setMyMsg] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leftRef = useRef(false);

  const channelName = `live_${post.id}`;
  const videoContainerId = `agora-viewer-${post.id}`;

  // Agora RTC: subscribe to the broadcaster's video/audio
  const { hostOnline, connectionState } = useAgoraRTCViewer({
    channelName,
    videoContainerId,
    enabled: true,
  });

  // Agora RTM: real-time live chat with all viewers
  const { messages, sendMessage, connected: rtmConnected } = useAgoraRTM({
    channelName,
    uid: user?.id ? String(user.id) : `anon_${Math.random().toString(36).slice(2)}`,
    displayName: user ? `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "Viewer" : "Viewer",
    color: "#a78bfa",
    enabled: true,
  });

  const author = post.user;
  const authorName = author ? `${author.firstName} ${author.lastName}` : "Unknown";
  const authorHandle = `@${(author as any)?.username || author?.firstName?.toLowerCase() || "user"}`;
  const authorAvatar = author?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.firstName}`;

  // DB: join/leave & poll viewer count
  useEffect(() => {
    playGoLive();
    leftRef.current = false;

    fetch(`/api/live/${post.id}/join`, { method: "POST", credentials: "include" })
      .then(r => r.json())
      .then(d => { if (typeof d.viewerCount === "number") setViewerCount(d.viewerCount); })
      .catch(() => {});

    pollRef.current = setInterval(() => {
      fetch(`/api/live/${post.id}/viewers`, { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (typeof d.viewerCount === "number") setViewerCount(d.viewerCount); })
        .catch(() => {});
    }, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (!leftRef.current) {
        leftRef.current = true;
        fetch(`/api/live/${post.id}/leave`, { method: "POST", credentials: "include" }).catch(() => {});
      }
    };
  }, [post.id]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendHeart = () => {
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 600);
    playNotification();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myMsg.trim()) return;
    await sendMessage(myMsg.trim());
    setMyMsg("");
  };

  const handleClose = () => {
    if (!leftRef.current) {
      leftRef.current = true;
      fetch(`/api/live/${post.id}/leave`, { method: "POST", credentials: "include" }).catch(() => {});
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black flex flex-col"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
      >
        {/* ── Agora RTC video container ─────────────────────────────────────── */}
        <div className="absolute inset-0">
          {/* Agora injects a <video> element inside this div */}
          <div
            id={videoContainerId}
            className="w-full h-full"
            style={{ background: "#000" }}
          />

          {/* Waiting for host overlay */}
          {!hostOnline && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: `linear-gradient(160deg, hsl(${(post.id * 53) % 360}, 60%, 8%), hsl(${(post.id * 53 + 140) % 360}, 50%, 5%))` }}>
              <div className="w-20 h-20 rounded-full border-2 border-red-500/40 flex items-center justify-center animate-pulse">
                <Radio className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-white/70 text-sm font-medium">
                {connectionState === "connecting" ? "Connecting to stream…" : "Waiting for host to start…"}
              </p>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-400/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/95 pointer-events-none" />
        </div>

        {/* ── Top HUD ───────────────────────────────────────────────────────── */}
        <div className="relative z-10 flex items-center gap-2 px-4 pt-4 pb-2">
          <div className="flex items-center gap-1.5 bg-red-500 px-2.5 py-1 rounded-lg">
            <Radio className="w-3 h-3 text-white" />
            <span className="text-white text-[11px] font-black tracking-widest">LIVE</span>
          </div>

          <div className="flex items-center gap-1 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full">
            <Users className="w-3 h-3 text-zinc-300" />
            <span className="text-zinc-300 text-[11px] font-bold" data-testid="text-live-viewer-count">
              {viewerCount.toLocaleString()}
            </span>
          </div>

          {/* RTM connection indicator */}
          {rtmConnected && (
            <div className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 px-2 py-0.5 rounded-full">
              <Wifi className="w-2.5 h-2.5 text-green-400" />
              <span className="text-green-400 text-[9px] font-bold">LIVE CHAT</span>
            </div>
          )}

          <div className="flex-1" />

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center"
            data-testid="button-close-livestream"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* ── Author pill ───────────────────────────────────────────────────── */}
        <div className="relative z-10 px-4 mt-1">
          <button
            className="flex items-center gap-2 bg-black/50 backdrop-blur rounded-full px-3 py-1.5"
            onClick={() => { handleClose(); navigate(`/profile/${post.userId}`); }}
          >
            <img src={authorAvatar} alt={authorName} className="w-7 h-7 rounded-full object-cover border border-white/20" />
            <div className="text-left">
              <p className="text-white text-[12px] font-bold leading-none">{authorName}</p>
              <p className="text-zinc-400 text-[10px] mt-0.5">{authorHandle}</p>
            </div>
          </button>
        </div>

        <div className="flex-1" />

        {/* ── Live chat messages ────────────────────────────────────────────── */}
        <div
          ref={chatRef}
          className="relative z-10 px-4 mb-2 max-h-[30vh] overflow-y-auto flex flex-col gap-1 scrollbar-hide"
        >
          {messages.length === 0 && rtmConnected && (
            <p className="text-white/30 text-[11px] italic text-center py-2">Be the first to say something…</p>
          )}
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-1.5 items-start"
            >
              <span className="text-[11px] font-bold shrink-0" style={{ color: m.color }}>{m.user}</span>
              <span className="text-white/90 text-[11px] leading-tight">{m.msg}</span>
            </motion.div>
          ))}
        </div>

        {/* ── Bottom bar: chat input + actions ─────────────────────────────── */}
        <div
          className="relative z-10 flex items-center gap-3 px-4 pt-3 bg-gradient-to-t from-black to-transparent"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
        >
          <form onSubmit={handleSend} className="flex-1 flex gap-2">
            <input
              value={myMsg}
              onChange={e => setMyMsg(e.target.value)}
              placeholder={rtmConnected ? "Say something to everyone…" : "Connecting chat…"}
              disabled={!rtmConnected}
              className="flex-1 h-10 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40 disabled:opacity-50"
              data-testid="input-live-chat"
            />
            <button
              type="submit"
              disabled={!rtmConnected || !myMsg.trim()}
              className="w-10 h-10 rounded-full bg-violet-600/80 border border-violet-400/40 flex items-center justify-center disabled:opacity-40 transition-all active:scale-95"
              data-testid="button-live-send"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>

          <button
            onClick={sendHeart}
            className="w-11 h-11 flex items-center justify-center"
            data-testid="button-live-like"
          >
            <Heart className={`w-7 h-7 transition-transform ${heartAnim ? "scale-150 text-red-400 fill-red-400" : "text-white"}`} />
          </button>

          <button className="w-9 h-9 flex items-center justify-center text-white/70">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
