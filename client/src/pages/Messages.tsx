import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Send, Mic, MicOff, Image, MoreVertical,
  Lock, Smile, Paperclip, Check, CheckCheck, Pin,
  Globe, Clock, Palette, X, Plus, MapPin, BarChart2, Search,
  Users, Trash2, Play, Pause, BotMessageSquare, Zap, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { playSend, playReceive } from "@/lib/sounds";
import { encryptMessage, decryptMessage, isEncrypted } from "@/lib/e2ee";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DirectMessage {
  id: number;
  chatId: number;
  senderId: string;
  content: string | null;
  type: string;
  mediaUrl: string | null;
  metadata: string | null;
  readAt: string | null;
  pinnedAt: string | null;
  expiresAt: string | null;
  reactions: string;
  replyToId: number | null;
  createdAt: string;
}

interface ChatContact {
  id: number;
  user1Id: string;
  user2Id: string;
  theme: string;
  e2eEnabled: boolean;
  lastMessageAt: string;
  otherUser: { id: string; firstName: string; lastName: string; profileImageUrl: string | null; email: string };
  lastMsg: DirectMessage | null;
  unread: number;
  isOnline: boolean;
  lastSeen: string | null;
}

interface AppUser {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  email: string;
}

// ── Premium Themes ─────────────────────────────────────────────────────────────
const THEMES: Record<string, {
  bg: string; sent: string; recv: string;
  accent: string; label: string; glow: string; headerBg: string;
}> = {
  noir:     { bg: "bg-[#0a0a0f]",  sent: "bg-gradient-to-br from-violet-600 to-indigo-700 text-white", recv: "bg-[#1a1a2e] text-white border border-white/5", accent: "violet", label: "Noir",     glow: "shadow-violet-500/20",  headerBg: "bg-[#0d0d16]/90" },
  aurora:   { bg: "bg-[#060d1a]",  sent: "bg-gradient-to-br from-cyan-500 to-blue-600 text-white",   recv: "bg-[#0d1f35] text-white border border-cyan-900/30", accent: "cyan",   label: "Aurora",   glow: "shadow-cyan-500/20",    headerBg: "bg-[#060d1a]/90" },
  ember:    { bg: "bg-[#120a08]",  sent: "bg-gradient-to-br from-orange-500 to-rose-600 text-white", recv: "bg-[#1f1008] text-white border border-orange-900/30", accent: "orange", label: "Ember",   glow: "shadow-orange-500/20",  headerBg: "bg-[#120a08]/90" },
  forest:   { bg: "bg-[#070f0a]",  sent: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",recv: "bg-[#0d1f12] text-white border border-emerald-900/30",accent: "emerald",label: "Forest",  glow: "shadow-emerald-500/20", headerBg: "bg-[#070f0a]/90" },
  sakura:   { bg: "bg-[#120810]",  sent: "bg-gradient-to-br from-pink-500 to-rose-500 text-white",   recv: "bg-[#1f1020] text-white border border-pink-900/30",  accent: "pink",   label: "Sakura",   glow: "shadow-pink-500/20",    headerBg: "bg-[#120810]/90" },
};

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "👍", "😮", "😢", "🙏", "💯"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMsgTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(u: { firstName: string; lastName: string }) {
  return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
}

// ── Voice Recorder Hook ───────────────────────────────────────────────────────
function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch { }
  }, []);

  const stop = useCallback((): Promise<string | null> => {
    return new Promise(resolve => {
      if (!recorderRef.current) { resolve(null); return; }
      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        resolve(URL.createObjectURL(blob));
      };
      recorderRef.current.stop();
      recorderRef.current.stream.getTracks().forEach(t => t.stop());
      recorderRef.current = null;
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    });
  }, []);

  const cancel = useCallback(() => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current.stream.getTracks().forEach(t => t.stop());
    recorderRef.current = null;
    setRecording(false);
    chunksRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return { recording, duration, start, stop, cancel };
}

// ── WebSocket Hook ────────────────────────────────────────────────────────────
function useChatSocket(
  chatId: number,
  currentUserId: string,
  onMessage: (msg: DirectMessage) => void,
  onDelete: (id: number) => void
) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!currentUserId || !chatId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "register", userId: currentUserId }));

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "new_message" && data.chatId === chatId) {
          onMessage(data.message);
          playReceive();
        }
        if (data.type === "delete_message") {
          onDelete(data.messageId);
        }
      } catch { }
    };

    ws.onerror = () => { };
    ws.onclose = () => { };

    return () => { ws.close(); };
  }, [chatId, currentUserId]);
}

// ── Voice Note Bubble ─────────────────────────────────────────────────────────
function VoiceNoteBubble({ url, isSender }: { url: string; isSender: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = () => {
    if (!audioRef.current) audioRef.current = new Audio(url);
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); if (intervalRef.current) clearInterval(intervalRef.current); };
      audioRef.current.play().then(() => {
        setPlaying(true);
        intervalRef.current = setInterval(() => {
          if (audioRef.current) setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100);
        }, 100);
      }).catch(() => setPlaying(false));
    }
  };

  return (
    <div className="flex items-center gap-3 min-w-[180px] py-0.5">
      <button onClick={toggle}
        className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all",
          isSender ? "bg-white/20 hover:bg-white/30" : "bg-white/10 hover:bg-white/20")}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className="h-1 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full rounded-full bg-white/70 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex gap-0.5 items-end h-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-0.5 rounded-full transition-all"
              style={{
                height: `${6 + Math.abs(Math.sin(i * 0.9) * 10)}px`,
                background: i / 24 < progress / 100 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)"
              }} />
          ))}
        </div>
      </div>
      <Mic className="w-3 h-3 opacity-40 shrink-0" />
    </div>
  );
}

// ── Poll Bubble ───────────────────────────────────────────────────────────────
function PollBubble({ metadata, isSender, onVote }: { metadata: string; isSender: boolean; onVote?: (opt: string) => void }) {
  const data = JSON.parse(metadata || "{}");
  const options: string[] = data.options || [];
  const votes: Record<string, number> = data.votes || {};
  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2 min-w-[200px]">
      <p className="font-semibold text-sm">{data.question || "Poll"}</p>
      {options.map((opt: string) => {
        const pct = total ? Math.round(((votes[opt] || 0) / total) * 100) : 0;
        return (
          <button key={opt} onClick={() => onVote?.(opt)}
            className="w-full text-left rounded-xl overflow-hidden relative text-sm px-3 py-2 border border-white/10 hover:border-white/20 transition-colors">
            <div className="absolute inset-0 rounded-xl bg-white/10 transition-all" style={{ width: `${pct}%` }} />
            <div className="relative flex justify-between items-center">
              <span>{opt}</span>
              <span className="text-xs opacity-60">{pct}%</span>
            </div>
          </button>
        );
      })}
      <p className="text-[11px] opacity-50">{total} votes</p>
    </div>
  );
}

// ── Online Badge ──────────────────────────────────────────────────────────────
function OnlineBadge() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
    </span>
  );
}

// ── Chat List ─────────────────────────────────────────────────────────────────
function ChatList({
  onOpenChat,
  onOpenGroup,
  pendingOpenChatId,
}: {
  onOpenChat: (chat: ChatContact) => void;
  onOpenGroup: () => void;
  pendingOpenChatId?: number | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const { toast } = useToast();

  const { data: chats = [], isLoading } = useQuery<ChatContact[]>({
    queryKey: ["/api/direct-chats"],
    refetchInterval: 8000,
  });

  const { data: settings } = useQuery<{ blockedUsers: string[] }>({
    queryKey: ["/api/settings"],
  });

  const { data: allUsers = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    enabled: showNewChat,
  });

  const [hasOpenedPending, setHasOpenedPending] = useState(false);

  const createChat = useMutation({
    mutationFn: async (otherUserId: string) => {
      const res = await apiRequest("POST", "/api/direct-chats", { otherUserId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/direct-chats"] });
      setShowNewChat(false);
      if (data?.id) onOpenChat(data);
    },
  });

  useEffect(() => {
    apiRequest("POST", "/api/status/online", {}).catch(() => { });
    const interval = setInterval(() => apiRequest("POST", "/api/status/online", {}).catch(() => { }), 30000);
    return () => { clearInterval(interval); apiRequest("POST", "/api/status/offline", {}).catch(() => { }); };
  }, []);

  const filtered = chats.filter(c =>
    `${c.otherUser?.firstName} ${c.otherUser?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const blockedUsers = settings?.blockedUsers || [];
  const visibleChats = filtered.filter(c => !blockedUsers.includes(c.otherUser?.id || ""));

  useEffect(() => {
    if (!hasOpenedPending && pendingOpenChatId && !isLoading && visibleChats.length) {
      const pending = visibleChats.find(c => c.id === pendingOpenChatId);
      if (pending) {
        setHasOpenedPending(true);
        onOpenChat(pending);
        window.history.replaceState(null, "", "/messages");
      }
    }
  }, [hasOpenedPending, pendingOpenChatId, visibleChats, isLoading, onOpenChat]);

  if (showNewChat) return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/5">
        <button onClick={() => setShowNewChat(false)}
          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="font-semibold text-base tracking-tight">New Message</h2>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-2xl px-4 py-2.5">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..."
            className="bg-transparent flex-1 text-sm outline-none placeholder-zinc-500" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 space-y-0.5">
          {allUsers.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())).map(u => (
            <button key={u.id} onClick={() => createChat.mutate(u.id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 transition-colors active:bg-white/8">
              <div className="relative">
                <Avatar className="w-11 h-11 ring-1 ring-white/10">
                  <AvatarImage src={u.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-sm font-semibold">
                    {initials(u)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                <p className="text-xs text-zinc-500 truncate">{u.email}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Messages
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">{visibleChats.length} conversation{visibleChats.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onOpenGroup}
              className="w-9 h-9 rounded-2xl bg-white/6 border border-white/8 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95">
              <Users className="w-4 h-4 text-zinc-300" />
            </button>
            <button onClick={() => { setShowNewChat(true); setSearch(""); }}
              className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all active:scale-95">
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/8 rounded-2xl px-4 py-2.5 focus-within:border-violet-500/40 transition-colors">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
            className="bg-transparent flex-1 text-sm outline-none placeholder-zinc-500" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-1 px-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 items-center px-3 py-3 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-white/6 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/6 rounded-full animate-pulse w-1/2" />
                  <div className="h-2.5 bg-white/4 rounded-full animate-pulse w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleChats.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center px-8">
            <div className="w-20 h-20 rounded-3xl bg-white/4 border border-white/8 flex items-center justify-center mb-5">
              <BotMessageSquare className="w-9 h-9 text-zinc-600" />
            </div>
            <p className="font-semibold text-zinc-300 mb-1">No conversations yet</p>
            <p className="text-sm text-zinc-500 mb-6">Start a conversation with someone</p>
            <button onClick={() => setShowNewChat(true)}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all active:scale-95">
              New Message
            </button>
          </div>
        ) : (
          <div className="px-3 pb-4 space-y-0.5">
            {visibleChats.map(chat => {
              const u = chat.otherUser;
              const last = chat.lastMsg;
              return (
                <button key={chat.id} onClick={() => onOpenChat(chat)}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-white/4 active:bg-white/6 transition-all group">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar className="w-12 h-12 ring-1 ring-white/8">
                      <AvatarImage src={u?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-sm font-bold">
                        {u ? initials(u) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    {chat.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <OnlineBadge />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="font-semibold text-[15px] text-white truncate">
                        {u ? `${u.firstName} ${u.lastName}` : "Unknown"}
                      </p>
                      <span className="text-[11px] text-zinc-500 shrink-0 ml-2">
                        {last ? formatTime(last.createdAt) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-400 truncate leading-relaxed">
                        {last?.type === "voice" ? "🎤 Voice message"
                          : last?.type === "image" ? "📷 Photo"
                          : last?.type === "poll" ? "📊 Poll"
                          : last?.content || "Start a conversation"}
                      </p>
                      {chat.unread > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[11px] font-bold flex items-center justify-center px-1.5 shrink-0 shadow-sm shadow-violet-500/30">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Chat View ─────────────────────────────────────────────────────────────────
function ChatView({ chat, currentUserId, onBack }: { chat: ChatContact; currentUserId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [translatedTexts, setTranslatedTexts] = useState<Record<number, string>>({});
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [contextMsg, setContextMsg] = useState<DirectMessage | null>(null);
  const [showDeleteOptions, setShowDeleteOptions] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState(["", ""]);
  const [disappearing, setDisappearing] = useState(false);
  const [theme, setTheme] = useState<string>(chat.theme || "noir");
  const [decryptedContents, setDecryptedContents] = useState<Record<number, string>>({});
  const voiceRec = useVoiceRecorder();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerId = chat.otherUser?.id ?? "";
  const T = THEMES[theme] || THEMES.noir;
  const other = chat.otherUser;

  // ── Queries ──
  const { data: messages = [] } = useQuery<DirectMessage[]>({
    queryKey: ["/api/direct-chats", chat.id, "messages"],
    // No refetchInterval — WebSocket handles real-time
  });

  const { data: typingData } = useQuery<{ typers: string[] }>({
    queryKey: ["/api/direct-chats", chat.id, "typing"],
    refetchInterval: 2500,
  });
  const isOtherTyping = (typingData?.typers?.length ?? 0) > 0;

  // ── WebSocket ──
  useChatSocket(
    chat.id,
    currentUserId,
    (newMsg) => {
      qc.setQueryData<DirectMessage[]>(
        ["/api/direct-chats", chat.id, "messages"],
        (old = []) => [...old, newMsg]
      );
      qc.invalidateQueries({ queryKey: ["/api/direct-chats"] });
    },
    (deletedId) => {
      qc.setQueryData<DirectMessage[]>(
        ["/api/direct-chats", chat.id, "messages"],
        (old = []) => old.filter(m => m.id !== deletedId)
      );
    }
  );

  // ── Effects ──
  useEffect(() => {
    apiRequest("PATCH", `/api/direct-chats/${chat.id}/read`, {}).catch(() => { });
    qc.invalidateQueries({ queryKey: ["/api/direct-chats"] });
  }, [chat.id, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isOtherTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Decrypt messages
  useEffect(() => {
    if (!messages.length || !currentUserId || !partnerId) return;
    const decryptAll = async () => {
      const results: Record<number, string> = {};
      await Promise.all(messages.map(async (msg) => {
        if (msg.type !== "text" || !msg.content) return;
        if (isEncrypted(msg.content)) {
          const sId = msg.senderId;
          const rId = sId === currentUserId ? partnerId : currentUserId;
          results[msg.id] = await decryptMessage(msg.content, sId, rId);
        }
      }));
      setDecryptedContents(prev => ({ ...prev, ...results }));
    };
    decryptAll();
  }, [messages, currentUserId, partnerId]);

  const notifyTyping = useCallback(() => {
    apiRequest("POST", `/api/direct-chats/${chat.id}/typing`, {}).catch(() => { });
  }, [chat.id]);

  // Smart replies
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.senderId === currentUserId || last.type !== "text") { setSmartReplies([]); return; }
    const content = decryptedContents[last.id] || last.content;
    apiRequest("POST", "/api/smart-reply", { lastMessage: content })
      .then((r: any) => setSmartReplies(r.suggestions || [])).catch(() => { });
  }, [messages.length, currentUserId]);

  // ── Mutations ──
  const sendMsg = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/direct-chats/${chat.id}/messages`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/direct-chats", chat.id, "messages"] });
      qc.invalidateQueries({ queryKey: ["/api/direct-chats"] });
      setReplyTo(null);
      setSmartReplies([]);
    },
  });

  const reactMutation = useMutation({
    mutationFn: ({ id, emoji }: { id: number; emoji: string }) =>
      apiRequest("PATCH", `/api/messages/${id}/react`, { emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/direct-chats", chat.id, "messages"] }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) =>
      apiRequest("PATCH", `/api/messages/${id}/pin`, { pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/direct-chats", chat.id, "messages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/messages/${id}`, {}),
    onSuccess: () => {
      qc.setQueryData<DirectMessage[]>(
        ["/api/direct-chats", chat.id, "messages"],
        (old = []) => old.filter(m => m.id !== contextMsg?.id)
      );
    },
  });

  // ── Handlers ──
  const handleSend = async () => {
    if (!text.trim()) return;
    const encrypted = await encryptMessage(text, currentUserId, partnerId);
    sendMsg.mutate({ content: encrypted, type: "text", replyToId: replyTo?.id, expiresInSeconds: disappearing ? 30 : undefined });
    setText("");
    playSend();
  };

  const handleVoice = async () => {
    if (voiceRec.recording) {
      const url = await voiceRec.stop();
      if (url) sendMsg.mutate({ content: "Voice message", type: "voice", mediaUrl: url });
    } else {
      voiceRec.start();
    }
  };

  const handleMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith("video") ? "video" : "image";
    sendMsg.mutate({ content: `Shared a ${type}`, type, mediaUrl: url });
    setShowAttachMenu(false);
  };

  const handleLocation = () => {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      sendMsg.mutate({ content: "📍 Location", type: "location", metadata: JSON.stringify({ lat, lng }) });
      setShowAttachMenu(false);
    }, () => toast({ title: "Location unavailable" }));
  };

  const handlePollSubmit = () => {
    const opts = pollOpts.filter(Boolean);
    if (!pollQ || opts.length < 2) return;
    sendMsg.mutate({ content: `📊 ${pollQ}`, type: "poll", metadata: JSON.stringify({ question: pollQ, options: opts, votes: {} }) });
    setShowPollForm(false); setPollQ(""); setPollOpts(["", ""]);
    setShowAttachMenu(false);
  };

  const handleTranslate = async (msg: DirectMessage) => {
    if (translatedTexts[msg.id]) {
      setTranslatedTexts(p => { const n = { ...p }; delete n[msg.id]; return n; });
      return;
    }
    try {
      const res: any = await apiRequest("POST", "/api/translate", { text: msg.content, targetLang: "English" });
      setTranslatedTexts(p => ({ ...p, [msg.id]: res.translated }));
    } catch { }
  };

  const handleThemeChange = (key: string) => {
    setTheme(key);
    apiRequest("PATCH", `/api/direct-chats/${chat.id}/theme`, { theme: key }).catch(() => { });
    setShowThemePicker(false);
  };

  const onLongPressStart = (msg: DirectMessage) => {
    longPressTimer.current = setTimeout(() => setContextMsg(msg), 450);
  };
  const onLongPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const pinnedMsgs = messages.filter(m => m.pinnedAt);

  return (
    <div className={cn("flex flex-col h-full", T.bg)}>

      {/* ── Header ── */}
      <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-white/6 backdrop-blur-xl", T.headerBg)}>
        <button onClick={onBack}
          className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center hover:bg-white/10 transition-colors shrink-0 active:scale-95">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="relative shrink-0">
          <Avatar className="w-10 h-10 ring-1 ring-white/10">
            <AvatarImage src={other?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-sm font-bold">
              {other ? initials(other) : "?"}
            </AvatarFallback>
          </Avatar>
          {chat.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5">
              <OnlineBadge />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] truncate leading-tight">
            {other ? `${other.firstName} ${other.lastName}` : "Chat"}
          </p>
          <p className="text-[11px] text-zinc-400 leading-tight mt-0.5">
            {isOtherTyping
              ? <span className="text-violet-400 font-medium">typing...</span>
              : chat.isOnline
              ? <span className="text-green-400">Online</span>
              : chat.lastSeen
              ? `Last seen ${formatTime(chat.lastSeen)}`
              : "Offline"}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="w-8 h-8 rounded-full hover:bg-white/8 flex items-center justify-center transition-colors"
            onClick={() => setShowThemePicker(p => !p)}>
            <Palette className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* ── Theme Picker ── */}
      {showThemePicker && (
        <div className="flex gap-3 px-5 py-3 border-b border-white/6 bg-black/30 backdrop-blur-xl overflow-x-auto">
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => handleThemeChange(key)}
              className={cn("flex flex-col items-center gap-1.5 shrink-0 transition-all", theme === key ? "opacity-100 scale-105" : "opacity-50")}>
              <div className={cn("w-9 h-9 rounded-2xl border-2", t.sent, theme === key ? "border-white shadow-lg" : "border-transparent")} />
              <span className="text-[10px] font-medium text-zinc-300">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── E2EE + Disappearing badges ── */}
      <div className="flex items-center justify-center gap-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-green-400 bg-green-500/8 border border-green-500/15 px-2.5 py-1 rounded-full">
          <Lock className="w-2.5 h-2.5" />
          <span className="font-medium">End-to-end encrypted</span>
        </div>
        <button onClick={() => setDisappearing(p => !p)}
          className={cn("flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-colors",
            disappearing
              ? "text-orange-400 bg-orange-500/8 border-orange-500/20"
              : "text-zinc-500 bg-white/4 border-white/8")}>
          <Clock className="w-2.5 h-2.5" />
          <span className="font-medium">{disappearing ? "30s disappear" : "Disappear off"}</span>
        </button>
      </div>

      {/* ── Pinned message ── */}
      {pinnedMsgs.length > 0 && (
        <div className="mx-3 mb-2 px-4 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-2xl flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 truncate">{pinnedMsgs[0].content}</p>
        </div>
      )}

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 px-4 py-2">
        <div className="space-y-1">
          {messages.map((msg, i) => {
            const isSender = msg.senderId === currentUserId;
            const showDate = i === 0 || (new Date(msg.createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() > 300000);
            const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
            const isExpired = msg.expiresAt && new Date(msg.expiresAt) < new Date();
            const replyRef = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
            const displayContent = translatedTexts[msg.id] || decryptedContents[msg.id] || (isEncrypted(msg.content || "") ? "🔒 Decrypting..." : (msg.content || ""));

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/6" />
                    <span className="text-[10px] text-zinc-500 font-medium px-2">{formatTime(msg.createdAt)}</span>
                    <div className="flex-1 h-px bg-white/6" />
                  </div>
                )}

                <div className={cn("flex mb-0.5", isSender ? "justify-end" : "justify-start")}>
                  {!isSender && (
                    <Avatar className="w-7 h-7 mr-2 mt-auto mb-1 shrink-0 ring-1 ring-white/8">
                      <AvatarImage src={other?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-[10px] font-bold">
                        {other ? initials(other) : "?"}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <div className="max-w-[72%] space-y-0.5"
                    onMouseDown={() => onLongPressStart(msg)}
                    onMouseUp={onLongPressEnd}
                    onTouchStart={() => onLongPressStart(msg)}
                    onTouchEnd={onLongPressEnd}>

                    {/* Reply preview */}
                    {replyRef && (
                      <div className={cn("text-[10px] px-2.5 py-1.5 rounded-t-xl border-l-2 mb-0.5",
                        isSender ? "border-white/30 bg-white/8" : "border-violet-400/50 bg-white/5")}>
                        <span className="font-semibold text-zinc-300">Reply · </span>
                        <span className="text-zinc-400">{replyRef.content}</span>
                      </div>
                    )}

                    {isExpired ? (
                      <div className="px-4 py-2.5 rounded-2xl bg-white/4 border border-white/8">
                        <p className="text-xs text-zinc-500 italic">Message expired</p>
                      </div>
                    ) : (
                      <div className={cn(
                        "px-4 py-2.5 rounded-2xl shadow-sm",
                        isSender
                          ? `${T.sent} ${T.glow} shadow-lg rounded-br-sm`
                          : `${T.recv} rounded-bl-sm`,
                        replyRef && "rounded-tl-sm rounded-tr-sm"
                      )}>
                        {msg.type === "text" && (
                          <div>
                            <p className="text-[14px] leading-relaxed">{displayContent}</p>
                            {isEncrypted(msg.content || "") && (
                              <div className="flex items-center gap-1 mt-1 opacity-40">
                                <Lock className="w-2.5 h-2.5" />
                                <span className="text-[9px] font-semibold tracking-wider">E2EE</span>
                              </div>
                            )}
                            <button onClick={() => handleTranslate(msg)}
                              className="flex items-center gap-1 text-[10px] opacity-40 hover:opacity-70 mt-1.5 transition-opacity">
                              <Globe className="w-2.5 h-2.5" />
                              {translatedTexts[msg.id] ? "Original" : "Translate"}
                            </button>
                          </div>
                        )}
                        {msg.type === "image" && msg.mediaUrl && (
                          <img src={msg.mediaUrl} className="rounded-xl max-w-full max-h-64 object-cover" />
                        )}
                        {msg.type === "video" && msg.mediaUrl && (
                          <video src={msg.mediaUrl} controls className="rounded-xl max-w-full max-h-64" />
                        )}
                        {msg.type === "voice" && msg.mediaUrl && (
                          <VoiceNoteBubble url={msg.mediaUrl} isSender={isSender} />
                        )}
                        {msg.type === "poll" && msg.metadata && (
                          <PollBubble metadata={msg.metadata} isSender={isSender} />
                        )}
                        {msg.type === "location" && msg.metadata && (() => {
                          const loc = JSON.parse(msg.metadata);
                          return (
                            <a href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm hover:underline">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span>View location</span>
                            </a>
                          );
                        })()}
                      </div>
                    )}

                    {/* Reactions */}
                    {Object.keys(reactions).length > 0 && (
                      <div className={cn("flex gap-1 flex-wrap mt-0.5", isSender ? "justify-end" : "justify-start")}>
                        {Object.entries(reactions).map(([emoji, uids]) => (
                          <button key={emoji} onClick={() => reactMutation.mutate({ id: msg.id, emoji })}
                            className="flex items-center gap-0.5 bg-white/8 border border-white/10 rounded-full px-2 py-0.5 text-xs hover:bg-white/15 transition-colors active:scale-95">
                            {emoji} <span className="text-zinc-400 text-[10px]">{uids.length}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Timestamp + read receipt */}
                    <div className={cn("flex items-center gap-1 mt-0.5", isSender ? "justify-end" : "justify-start")}>
                      <span className="text-[10px] text-zinc-600">{formatMsgTime(msg.createdAt)}</span>
                      {isSender && (
                        msg.readAt
                          ? <CheckCheck className="w-3 h-3 text-sky-400" />
                          : <Check className="w-3 h-3 text-zinc-600" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isOtherTyping && (
            <div className="flex items-end gap-2 mb-1">
              <Avatar className="w-7 h-7 shrink-0 ring-1 ring-white/8">
                <AvatarImage src={other?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-[10px] font-bold">
                  {other ? initials(other) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className={cn("px-4 py-3 rounded-2xl rounded-bl-sm", T.recv)}>
                <div className="flex gap-1 items-center h-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                      style={{ animationDelay: `${i * 160}ms`, animationDuration: "0.9s" }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ── Context Menu (long press) ── */}
      {contextMsg && !showDeleteOptions && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={() => setContextMsg(null)}>
          <div className="bg-[#1a1a2e] border border-white/8 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {/* Quick emoji reactions */}
            <div className="flex justify-around px-4 py-4 border-b border-white/6">
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => { reactMutation.mutate({ id: contextMsg.id, emoji: e }); setContextMsg(null); }}
                  className="text-2xl hover:scale-125 active:scale-110 transition-transform">
                  {e}
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="py-2">
              {[
                {
                  label: "Reply",
                  icon: <ArrowLeft className="w-4 h-4 text-zinc-300" />,
                  action: () => { setReplyTo(contextMsg); setContextMsg(null); }
                },
                {
                  label: "Pin message",
                  icon: <Pin className="w-4 h-4 text-zinc-300" />,
                  action: () => { pinMutation.mutate({ id: contextMsg.id, pinned: !contextMsg.pinnedAt }); setContextMsg(null); }
                },
                {
                  label: "Translate",
                  icon: <Globe className="w-4 h-4 text-zinc-300" />,
                  action: () => { handleTranslate(contextMsg); setContextMsg(null); }
                },
                {
                  label: "Delete",
                  icon: <Trash2 className="w-4 h-4 text-red-400" />,
                  action: () => setShowDeleteOptions(true),
                  danger: true,
                },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className={cn("w-full flex items-center gap-4 px-5 py-3.5 text-sm hover:bg-white/4 active:bg-white/6 transition-colors",
                    item.danger && "text-red-400")}>
                  {item.icon}
                  <span className={item.danger ? "text-red-400" : "text-zinc-200"}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Options (Telegram style) ── */}
      {contextMsg && showDeleteOptions && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={() => { setContextMsg(null); setShowDeleteOptions(false); }}>
          <div className="bg-[#1a1a2e] border border-white/8 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/6">
              <p className="font-semibold text-base">Delete message?</p>
              <p className="text-xs text-zinc-500 mt-0.5">This action cannot be undone</p>
            </div>
            <div className="py-2">
              <button onClick={() => { deleteMutation.mutate(contextMsg.id); setContextMsg(null); setShowDeleteOptions(false); }}
                className="w-full flex items-center gap-4 px-5 py-3.5 text-sm hover:bg-white/4 transition-colors text-zinc-200">
                <Trash2 className="w-4 h-4 text-zinc-400" />
                Delete for me
              </button>
              {contextMsg.senderId === currentUserId && (
                <button onClick={() => { deleteMutation.mutate(contextMsg.id); setContextMsg(null); setShowDeleteOptions(false); }}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-sm hover:bg-red-500/8 transition-colors text-red-400">
                  <Trash2 className="w-4 h-4" />
                  Delete for everyone
                </button>
              )}
              <button onClick={() => { setContextMsg(null); setShowDeleteOptions(false); }}
                className="w-full flex items-center gap-4 px-5 py-3.5 text-sm hover:bg-white/4 transition-colors text-zinc-500">
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Poll Form ── */}
      {showPollForm && (
        <div className="px-4 py-4 bg-[#1a1a2e] border-t border-white/6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Create Poll</p>
            <button onClick={() => setShowPollForm(false)}
              className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <input value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="Ask a question..."
            className="w-full bg-white/6 border border-white/8 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-violet-500/50 transition-colors placeholder-zinc-500" />
          {pollOpts.map((opt, i) => (
            <input key={i} value={opt} onChange={e => { const a = [...pollOpts]; a[i] = e.target.value; setPollOpts(a); }}
              placeholder={`Option ${i + 1}`}
              className="w-full bg-white/6 border border-white/8 rounded-2xl px-4 py-2.5 text-sm outline-none focus:border-violet-500/50 transition-colors placeholder-zinc-500" />
          ))}
          <div className="flex items-center justify-between">
            <button onClick={() => setPollOpts([...pollOpts, ""])}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium">
              + Add option
            </button>
            <button onClick={handlePollSubmit}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-2xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all active:scale-95">
              Send Poll
            </button>
          </div>
        </div>
      )}

      {/* ── Attach Menu ── */}
      {showAttachMenu && (
        <div className="grid grid-cols-4 gap-3 px-4 py-4 bg-[#0d0d16] border-t border-white/6">
          {[
            { icon: <Image className="w-5 h-5" />, label: "Photo", action: () => mediaInputRef.current?.click(), color: "from-blue-500 to-cyan-500" },
            { icon: <MapPin className="w-5 h-5" />, label: "Location", action: handleLocation, color: "from-green-500 to-emerald-500" },
            { icon: <BarChart2 className="w-5 h-5" />, label: "Poll", action: () => { setShowPollForm(true); setShowAttachMenu(false); }, color: "from-violet-500 to-purple-500" },
            { icon: <Clock className="w-5 h-5" />, label: disappearing ? "Permanent" : "Disappear", action: () => { setDisappearing(p => !p); setShowAttachMenu(false); }, color: "from-orange-500 to-amber-500" },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
              <div className={cn("w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg", item.color)}>
                {item.icon}
              </div>
              <span className="text-[11px] text-zinc-400 font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Reply preview ── */}
      {replyTo && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-violet-600/8 border-t border-violet-500/15">
          <div className="w-0.5 h-8 rounded-full bg-violet-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-violet-400 font-semibold">Replying</p>
            <p className="text-xs text-zinc-400 truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)}
            className="w-6 h-6 rounded-full bg-white/8 flex items-center justify-center hover:bg-white/12 transition-colors">
            <X className="w-3 h-3 text-zinc-400" />
          </button>
        </div>
      )}

      {/* ── Smart replies ── */}
      {smartReplies.length > 0 && !voiceRec.recording && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-t border-white/5 scrollbar-hide">
          {smartReplies.map((s, i) => (
            <button key={i} onClick={() => { setText(s); setSmartReplies([]); }}
              className="shrink-0 text-xs bg-white/6 border border-white/10 rounded-full px-3.5 py-1.5 hover:bg-white/10 transition-colors whitespace-nowrap text-zinc-300">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ── Input Bar ── */}
      <div className="px-3 py-3 bg-black/50 backdrop-blur-xl border-t border-white/6"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleMedia} />

        {voiceRec.recording ? (
          /* Recording state */
          <div className="flex items-center gap-3 bg-red-500/8 border border-red-500/20 rounded-2xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <div className="flex gap-0.5 items-end h-5 flex-1">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="w-1 rounded-full bg-red-400/60 animate-pulse"
                  style={{ height: `${6 + Math.random() * 14}px`, animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
            <span className="text-sm font-mono font-semibold text-red-400 shrink-0">
              {Math.floor(voiceRec.duration / 60).toString().padStart(2, "0")}:{(voiceRec.duration % 60).toString().padStart(2, "0")}
            </span>
            <button onClick={voiceRec.cancel}
              className="text-xs text-zinc-400 hover:text-white transition-colors font-medium shrink-0 px-2 py-1 rounded-xl hover:bg-white/8">
              Cancel
            </button>
          </div>
        ) : (
          /* Normal state */
          <div className="flex items-end gap-2">
            {/* Attach */}
            <button onClick={() => setShowAttachMenu(p => !p)}
              className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 shrink-0",
                showAttachMenu ? "bg-violet-600 text-white" : "bg-white/6 border border-white/8 text-zinc-400 hover:bg-white/10 hover:text-white")}>
              {showAttachMenu ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>

            {/* Text input container */}
            <div className="flex-1 flex items-end bg-white/6 border border-white/10 rounded-2xl px-3 py-2 focus-within:border-violet-500/40 transition-colors min-h-[44px]">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => { setText(e.target.value); notifyTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message..."
                rows={1}
                className="flex-1 bg-transparent text-[14px] outline-none resize-none placeholder-zinc-500 leading-relaxed py-0.5 max-h-[120px]"
              />
              <button className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 mb-0.5 hover:bg-white/8">
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Send / Mic */}
            {text.trim() ? (
              <button onClick={handleSend}
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all active:scale-90">
                <Send className="w-4 h-4 text-white" />
              </button>
            ) : (
              <button onClick={handleVoice}
                className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90",
                  voiceRec.recording
                    ? "bg-red-500 shadow-lg shadow-red-500/30"
                    : "bg-white/6 border border-white/8 text-zinc-400 hover:bg-white/10 hover:text-white")}>
                {voiceRec.recording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Messages Page ────────────────────────────────────────────────────────
export default function Messages() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeChat, setActiveChat] = useState<ChatContact | null>(null);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [pendingOpenChatId, setPendingOpenChatId] = useState<number | null>(null);

  const currentUserId: string = (user as any)?.claims?.sub ?? (user as any)?.id ?? "";

  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const chatId = params.get("openChatId");
    if (chatId) {
      const id = Number(chatId);
      if (!Number.isNaN(id)) setPendingOpenChatId(id);
    }
  }, [location]);

  if (activeChat) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[#0a0a0f]">
        <ChatView chat={activeChat} currentUserId={currentUserId} onBack={() => setActiveChat(null)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col pb-28" style={{ paddingTop: "var(--header-total)" }}>
      <Header />
      <div className="flex-1 max-w-md mx-auto w-full flex flex-col">
        <ChatList
          onOpenChat={chat => setActiveChat(chat)}
          onOpenGroup={() => setShowGroupCreate(true)}
          pendingOpenChatId={pendingOpenChatId}
        />
      </div>
      <BottomNav />
    </div>
  );
}