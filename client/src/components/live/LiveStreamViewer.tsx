import { X, Heart, Share2, Users, Radio } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playGoLive, playNotification } from "@/lib/sounds";
import { useLocation } from "wouter";

interface LiveStreamViewerProps {
  post: any;
  onClose: () => void;
}

export function LiveStreamViewer({ post, onClose }: LiveStreamViewerProps) {
  const [, navigate] = useLocation();
  const [chatMessages, setChatMessages] = useState<{ user: string; msg: string; color: string }[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(post.viewerCount ?? post.viewer_count ?? 0);
  const [heartAnim, setHeartAnim] = useState(false);
  const [myMsg, setMyMsg] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const leftRef = useRef(false);

  const author = post.user;
  const authorName = author ? `${author.firstName} ${author.lastName}` : "Unknown";
  const authorHandle = `@${(author as any)?.username || author?.firstName?.toLowerCase() || "user"}`;
  const authorAvatar = author?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.firstName}`;

  useEffect(() => {
    playGoLive();
    leftRef.current = false;

    // Join: increment real viewer count in DB
    fetch(`/api/live/${post.id}/join`, { method: "POST", credentials: "include" })
      .then(r => r.json())
      .then(d => { if (typeof d.viewerCount === "number") setViewerCount(d.viewerCount); })
      .catch(() => {});

    // Poll real viewer count every 10 seconds
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

  const sendHeart = () => {
    setHeartAnim(true);
    setTimeout(() => setHeartAnim(false), 600);
    playNotification();
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myMsg.trim()) return;
    setChatMessages(prev => [...prev.slice(-20), { user: "You", msg: myMsg.trim(), color: "#ef4444" }]);
    setMyMsg("");
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
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
        {/* Background */}
        <div className="absolute inset-0">
          {post.videoUrl ? (
            <video
              src={post.videoUrl}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: `linear-gradient(160deg, hsl(${(post.id * 53) % 360}, 60%, 12%), hsl(${(post.id * 53 + 140) % 360}, 50%, 8%))` }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/90" />
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center gap-3 px-4 pt-4 pb-2">
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

          <div className="flex-1" />

          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center"
            data-testid="button-close-livestream"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Author pill */}
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

        {/* Chat messages (only user's own messages) */}
        <div
          ref={chatRef}
          className="relative z-10 px-4 mb-2 max-h-[35vh] overflow-y-auto flex flex-col gap-1.5 scrollbar-hide"
        >
          {chatMessages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-1.5 items-start"
            >
              <span className="text-[11px] font-bold shrink-0" style={{ color: m.color }}>{m.user}</span>
              <span className="text-white text-[11px] leading-tight">{m.msg}</span>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 flex items-center gap-3 px-4 pb-6 pt-3 bg-gradient-to-t from-black to-transparent">
          <form onSubmit={sendChat} className="flex-1 flex">
            <input
              value={myMsg}
              onChange={e => setMyMsg(e.target.value)}
              placeholder="Say something…"
              className="flex-1 h-10 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/40"
              data-testid="input-live-chat"
            />
          </form>

          <button
            onClick={sendHeart}
            className="relative w-11 h-11 flex items-center justify-center"
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
