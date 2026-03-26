import { X, Heart, MessageCircle, Share2, Users, Radio } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playGoLive, playNotification } from "@/lib/sounds";
import { useLocation } from "wouter";

interface LiveStreamViewerProps {
  post: any;
  onClose: () => void;
}

const FAKE_CHAT: { user: string; msg: string; color: string }[] = [
  { user: "👑 king_vibes", msg: "LETS GOOO 🔥🔥", color: "#f97316" },
  { user: "luna_star", msg: "I'm here! 😍", color: "#a855f7" },
  { user: "tech_bro99", msg: "This is insane 😤", color: "#3b82f6" },
  { user: "xoxo_grace", msg: "First time watching live ❤️", color: "#ec4899" },
  { user: "gamer_kid", msg: "W stream", color: "#22c55e" },
  { user: "zero.cool", msg: "Can you see me?? 👀", color: "#f59e0b" },
  { user: "night_owl", msg: "bro this goes hard 💎", color: "#06b6d4" },
  { user: "art3mis", msg: "Stay live plz 🙏", color: "#e879f9" },
];

export function LiveStreamViewer({ post, onClose }: LiveStreamViewerProps) {
  const [, navigate] = useLocation();
  const [chatMessages, setChatMessages] = useState<typeof FAKE_CHAT>([]);
  const [viewerCount, setViewerCount] = useState(post.viewerCount ?? Math.floor(Math.random() * 400) + 50);
  const [heartAnim, setHeartAnim] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 1000) + 100);
  const [myMsg, setMyMsg] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  const author = post.user;
  const authorName = author ? `${author.firstName} ${author.lastName}` : "Unknown";
  const authorHandle = `@${(author as any)?.username || author?.firstName?.toLowerCase() || "user"}`;
  const authorAvatar = author?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${author?.firstName}`;

  // Simulate incoming chat messages
  useEffect(() => {
    playGoLive();
    let msgIdx = 0;
    const interval = setInterval(() => {
      const msg = FAKE_CHAT[msgIdx % FAKE_CHAT.length];
      setChatMessages(prev => [...prev.slice(-20), msg]);
      msgIdx++;
      // Simulate fluctuating viewer count
      setViewerCount((v: number) => v + Math.floor(Math.random() * 5) - 1);
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const sendHeart = () => {
    setHeartAnim(true);
    setLikeCount((n: number) => n + 1);
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

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] bg-black flex flex-col"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
      >
        {/* Background — gradient or video */}
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
          {/* LIVE badge */}
          <div className="flex items-center gap-1.5 bg-red-500 px-2.5 py-1 rounded-lg">
            <Radio className="w-3 h-3 text-white" />
            <span className="text-white text-[11px] font-black tracking-widest">LIVE</span>
          </div>

          {/* Viewer count */}
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur px-2.5 py-1 rounded-full">
            <Users className="w-3 h-3 text-zinc-300" />
            <span className="text-zinc-300 text-[11px] font-bold">{viewerCount.toLocaleString()}</span>
          </div>

          <div className="flex-1" />

          {/* Close */}
          <button
            onClick={onClose}
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
            onClick={() => { onClose(); navigate(`/profile/${post.userId}`); }}
          >
            <img src={authorAvatar} alt={authorName} className="w-7 h-7 rounded-full object-cover border border-white/20" />
            <div className="text-left">
              <p className="text-white text-[12px] font-bold leading-none">{authorName}</p>
              <p className="text-zinc-400 text-[10px] mt-0.5">{authorHandle}</p>
            </div>
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Chat messages */}
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

        {/* Bottom bar: chat input + actions */}
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

          {/* Like heart */}
          <button
            onClick={sendHeart}
            className="relative w-11 h-11 flex items-center justify-center"
            data-testid="button-live-like"
          >
            <Heart className={`w-7 h-7 transition-transform ${heartAnim ? "scale-150 text-red-400 fill-red-400" : "text-white"}`} />
            <span className="absolute -top-1 -right-1 text-[9px] font-black text-white bg-red-500 rounded-full min-w-[16px] px-0.5 text-center">
              {likeCount > 999 ? `${(likeCount / 1000).toFixed(1)}K` : likeCount}
            </span>
          </button>

          {/* Share */}
          <button className="w-9 h-9 flex items-center justify-center text-white/70">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
