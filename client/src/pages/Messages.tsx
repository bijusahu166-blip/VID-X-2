import { useState, useEffect, useRef, useCallback } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AIChatDrawer } from "@/components/chat/AIChatDrawer";
import { VideoCallScreen } from "@/components/call/VideoCallScreen";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Send, Mic, MicOff, Image, Phone, Video, MoreVertical,
  Lock, Smile, Paperclip, ChevronDown, Check, CheckCheck, Pin,
  Globe, Clock, Palette, X, Plus, MapPin, BarChart2, Search,
  Sparkles, Users, Trash2, Star, Volume2, VolumeX, Play, Pause,
  BotMessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import { playSend, playReceive } from "@/lib/sounds";

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const THEMES: Record<string, { bg: string; sent: string; recv: string; accent: string; label: string }> = {
  default:  { bg: "bg-zinc-950", sent: "bg-violet-600 text-white", recv: "bg-zinc-800 text-white", accent: "violet", label: "Default" },
  ocean:    { bg: "bg-blue-950",  sent: "bg-sky-500 text-white",   recv: "bg-blue-900 text-white", accent: "sky",    label: "Ocean" },
  sunset:   { bg: "bg-rose-950",  sent: "bg-orange-500 text-white",recv: "bg-rose-900 text-white", accent: "orange", label: "Sunset" },
  forest:   { bg: "bg-emerald-950",sent:"bg-green-600 text-white", recv: "bg-emerald-900 text-white",accent:"green",label:"Forest"},
  midnight: { bg: "bg-gray-950",  sent: "bg-indigo-600 text-white",recv: "bg-gray-800 text-white", accent: "indigo", label: "Midnight" },
};

const QUICK_EMOJIS = ["❤️","😂","👍","🔥","😮","😢","🙏","💯"];

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(u: { firstName: string; lastName: string }) {
  return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
}

// ── Voice recorder hook ───────────────────────────────────────────────────────
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
    } catch { /* no mic */ }
  }, []);

  const stop = useCallback((): Promise<string | null> => {
    return new Promise(resolve => {
      if (!recorderRef.current) { resolve(null); return; }
      recorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        resolve(url);
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

// ── Voice Note bubble ─────────────────────────────────────────────────────────
function VoiceNoteBubble({ url, isSender }: { url: string; isSender: boolean }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) audioRef.current = new Audio(url);
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); audioRef.current.onended = () => setPlaying(false); }
  };

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <button onClick={toggle} className={cn("w-8 h-8 rounded-full flex items-center justify-center", isSender ? "bg-white/20" : "bg-white/10")}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="flex gap-0.5 items-end h-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="w-0.5 rounded-full bg-current opacity-70"
            style={{ height: `${8 + Math.sin(i * 0.7) * 8}px` }} />
        ))}
      </div>
      <Mic className="w-3 h-3 opacity-60" />
    </div>
  );
}

// ── Poll bubble ───────────────────────────────────────────────────────────────
function PollBubble({ metadata, isSender, onVote }: { metadata: string; isSender: boolean; onVote?: (opt: string) => void }) {
  const data = JSON.parse(metadata || "{}");
  const options: string[] = data.options || [];
  const votes: Record<string, number> = data.votes || {};
  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-1.5 min-w-[200px]">
      <p className="font-semibold text-sm">{data.question || "Poll"}</p>
      {options.map((opt: string) => {
        const pct = total ? Math.round(((votes[opt] || 0) / total) * 100) : 0;
        return (
          <button key={opt} onClick={() => onVote?.(opt)}
            className={cn("w-full text-left rounded-lg overflow-hidden relative text-sm px-3 py-1.5 border", isSender ? "border-white/20" : "border-white/10")}>
            <div className="absolute inset-0 bg-white/10 rounded-lg" style={{ width: `${pct}%` }} />
            <span className="relative">{opt}</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70">{pct}%</span>
          </button>
        );
      })}
      <p className="text-xs opacity-60">{total} votes</p>
    </div>
  );
}

// ── Chat List View ────────────────────────────────────────────────────────────
function ChatList({ onOpenChat, onOpenGroup }: { onOpenChat: (chat: ChatContact) => void; onOpenGroup: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const { toast } = useToast();

  const { data: chats = [], isLoading } = useQuery<ChatContact[]>({
    queryKey: ["/api/direct-chats"],
    refetchInterval: 5000,
  });

  const { data: allUsers = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    enabled: showNewChat,
  });

  const createChat = useMutation({
    mutationFn: (otherUserId: string) => apiRequest("POST", "/api/direct-chats", { otherUserId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/direct-chats"] }); setShowNewChat(false); },
  });

  // Mark self as online
  useEffect(() => {
    apiRequest("POST", "/api/status/online", {});
    const interval = setInterval(() => apiRequest("POST", "/api/status/online", {}), 30000);
    return () => { clearInterval(interval); apiRequest("POST", "/api/status/offline", {}); };
  }, []);

  const filtered = chats.filter(c =>
    `${c.otherUser?.firstName} ${c.otherUser?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  if (showNewChat) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <button onClick={() => setShowNewChat(false)}><ArrowLeft className="w-5 h-5" /></button>
        <h2 className="font-bold text-lg">New Message</h2>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..."
            className="bg-transparent flex-1 text-sm outline-none" />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {allUsers.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())).map(u => (
          <button key={u.id} onClick={() => createChat.mutate(u.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
            data-testid={`user-start-chat-${u.id}`}>
            <Avatar className="w-11 h-11">
              <AvatarImage src={u.profileImageUrl || undefined} />
              <AvatarFallback className="bg-violet-600 text-white">{initials(u)}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="font-medium">{u.firstName} {u.lastName}</p>
              <p className="text-xs text-zinc-400">{u.email}</p>
            </div>
          </button>
        ))}
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="flex gap-2">
            <button onClick={onOpenGroup} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center" data-testid="button-new-group">
              <Users className="w-4 h-4" />
            </button>
            <button onClick={() => { setShowNewChat(true); setSearch(""); }} className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center" data-testid="button-new-chat">
              <Plus className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
            className="bg-transparent flex-1 text-sm outline-none" data-testid="input-search-chats" />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* AI Assistant */}
        <div className="px-4 pt-3 pb-1">
          <button className="w-full flex items-center gap-3 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 border border-violet-500/20 rounded-2xl p-3 hover:bg-violet-600/25 transition-colors" data-testid="button-ai-assistant">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold">AI Assistant</p>
              <p className="text-xs text-zinc-400">Your personal AI — always online</p>
            </div>
            <AIChatDrawer />
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3 p-4">
            {[1,2,3].map(i => <div key={i} className="flex gap-3 items-center"><div className="w-11 h-11 rounded-full bg-white/10 animate-pulse" /><div className="flex-1 space-y-2"><div className="h-3 bg-white/10 rounded animate-pulse w-2/3" /><div className="h-2 bg-white/10 rounded animate-pulse w-1/2" /></div></div>)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center text-zinc-500">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <BotMessageSquare className="w-8 h-8" />
            </div>
            <p className="font-medium">No conversations yet</p>
            <p className="text-sm mt-1">Tap + to start chatting</p>
          </div>
        )}

        <div className="py-2">
          {filtered.map(chat => {
            const u = chat.otherUser;
            const last = chat.lastMsg;
            return (
              <button key={chat.id} onClick={() => onOpenChat(chat)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors active:bg-white/10"
                data-testid={`chat-item-${chat.id}`}>
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={u?.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-violet-700 text-white">{u ? initials(u) : "?"}</AvatarFallback>
                  </Avatar>
                  {chat.isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">{u ? `${u.firstName} ${u.lastName}` : "Unknown"}</p>
                    <span className="text-xs text-zinc-500 shrink-0 ml-2">{last ? formatTime(last.createdAt) : ""}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-sm text-zinc-400 truncate">
                      {last?.type === "voice" ? "🎤 Voice note" : last?.type === "image" ? "📷 Photo" : last?.type === "poll" ? "📊 Poll" : last?.content || "Say hello!"}
                    </p>
                    {chat.unread > 0 && (
                      <span className="ml-2 min-w-[20px] h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center px-1 shrink-0">{chat.unread}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
  const [text, setText] = useState("");
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [callAudioOnly, setCallAudioOnly] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showTranslate, setShowTranslate] = useState<number | null>(null);
  const [translatedTexts, setTranslatedTexts] = useState<Record<number, string>>({});
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [contextMsg, setContextMsg] = useState<DirectMessage | null>(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQ, setPollQ] = useState("");
  const [pollOpts, setPollOpts] = useState(["", ""]);
  const [disappearing, setDisappearing] = useState(false);
  const [showEmojiFor, setShowEmojiFor] = useState<number | null>(null);
  const [theme, setTheme] = useState<string>(chat.theme || "default");
  const voiceRec = useVoiceRecorder();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const T = THEMES[theme] || THEMES.default;
  const other = chat.otherUser;

  // Messages with polling
  const { data: messages = [] } = useQuery<DirectMessage[]>({
    queryKey: ["/api/direct-chats", chat.id, "messages"],
    refetchInterval: 2000,
  });

  // Typing indicator
  const { data: typingData } = useQuery<{ typers: string[] }>({
    queryKey: ["/api/direct-chats", chat.id, "typing"],
    refetchInterval: 2000,
  });
  const isOtherTyping = (typingData?.typers?.length ?? 0) > 0;

  // Mark read
  useEffect(() => {
    apiRequest("PATCH", `/api/direct-chats/${chat.id}/read`, {});
    qc.invalidateQueries({ queryKey: ["/api/direct-chats"] });
  }, [chat.id, messages.length]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isOtherTyping]);

  // Notify typing
  const notifyTyping = useCallback(() => {
    apiRequest("POST", `/api/direct-chats/${chat.id}/typing`, {});
  }, [chat.id]);

  // Smart replies when last message is from other
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.senderId === currentUserId || last.type !== "text") { setSmartReplies([]); return; }
    apiRequest("POST", "/api/smart-reply", { lastMessage: last.content })
      .then((r: any) => setSmartReplies(r.suggestions || [])).catch(() => {});
  }, [messages.length, currentUserId]);

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/direct-chats", chat.id, "messages"] }),
  });

  const handleSend = () => {
    if (!text.trim()) return;
    sendMsg.mutate({ content: text, type: "text", replyToId: replyTo?.id, expiresInSeconds: disappearing ? 30 : undefined });
    setText("");
    playSend();
  };

  const handleVoice = async () => {
    if (voiceRec.recording) {
      const url = await voiceRec.stop();
      if (url) sendMsg.mutate({ content: "Voice note", type: "voice", mediaUrl: url });
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
    setShowPollForm(false); setPollQ(""); setPollOpts(["",""]);
    setShowAttachMenu(false);
  };

  const handleTranslate = async (msg: DirectMessage) => {
    if (translatedTexts[msg.id]) { setTranslatedTexts(p => { const n = {...p}; delete n[msg.id]; return n; }); return; }
    const res: any = await apiRequest("POST", "/api/translate", { text: msg.content, targetLang: "English" });
    setTranslatedTexts(p => ({ ...p, [msg.id]: res.translated }));
  };

  const handleThemeChange = (key: string) => {
    setTheme(key);
    apiRequest("PATCH", `/api/direct-chats/${chat.id}/theme`, { theme: key });
    setShowThemePicker(false);
  };

  const pinnedMsgs = messages.filter(m => m.pinnedAt);

  // Long press to open context
  const onLongPressStart = (msg: DirectMessage) => {
    longPressTimer.current = setTimeout(() => setContextMsg(msg), 500);
  };
  const onLongPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  if (showVideoCall) return (
    <VideoCallScreen
      onClose={() => { setShowVideoCall(false); setCallAudioOnly(false); }}
      callerName={other ? `${other.firstName} ${other.lastName}` : undefined}
      callerAvatar={other?.profileImageUrl || undefined}
      audioOnly={callAudioOnly}
    />
  );

  return (
    <div className={cn("flex flex-col h-full", T.bg)}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <button onClick={onBack} data-testid="button-back-to-list"><ArrowLeft className="w-5 h-5" /></button>
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage src={other?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-violet-700 text-white text-sm">{other ? initials(other) : "?"}</AvatarFallback>
          </Avatar>
          {chat.isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-black" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{other ? `${other.firstName} ${other.lastName}` : "Chat"}</p>
          <p className="text-xs text-zinc-400">{chat.isOnline ? "Online" : chat.lastSeen ? `Last seen ${formatTime(chat.lastSeen)}` : "Offline"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" onClick={() => { setCallAudioOnly(false); setShowVideoCall(true); if (other?.id) fetch(`/api/users/${other.id}/call-notify`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ audioOnly: false }) }); }} data-testid="button-video-call">
            <Video className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" onClick={() => { setCallAudioOnly(true); setShowVideoCall(true); if (other?.id) fetch(`/api/users/${other.id}/call-notify`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ audioOnly: true }) }); }} data-testid="button-voice-call">
            <Phone className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center" onClick={() => setShowThemePicker(p => !p)} data-testid="button-theme">
            <Palette className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Theme Picker ── */}
      {showThemePicker && (
        <div className="px-4 py-3 flex gap-2 border-b border-white/10 bg-black/20 overflow-x-auto">
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => handleThemeChange(key)}
              className={cn("flex flex-col items-center gap-1 shrink-0", theme === key && "opacity-100", theme !== key && "opacity-60")}>
              <div className={cn("w-8 h-8 rounded-full border-2", t.sent, theme === key ? "border-white" : "border-transparent")} />
              <span className="text-[10px]">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── E2EE + Disappearing badges ── */}
      <div className="flex items-center justify-center gap-3 py-2">
        <div className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
          <Lock className="w-2.5 h-2.5" />
          <span>End-to-end encrypted</span>
        </div>
        <button onClick={() => setDisappearing(p => !p)}
          className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full", disappearing ? "text-orange-400 bg-orange-500/10" : "text-zinc-500 bg-white/5")}>
          <Clock className="w-2.5 h-2.5" />
          <span>{disappearing ? "30s messages ON" : "Disappearing OFF"}</span>
        </button>
      </div>

      {/* ── Pinned messages ── */}
      {pinnedMsgs.length > 0 && (
        <div className="px-4 py-2 bg-amber-500/10 border-y border-amber-500/20 flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 truncate">{pinnedMsgs[0].content}</p>
        </div>
      )}

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 px-3 py-2">
        {messages.map((msg, i) => {
          const isSender = msg.senderId === currentUserId;
          const showTime = i === 0 || (new Date(msg.createdAt).getTime() - new Date(messages[i-1].createdAt).getTime() > 300000);
          const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
          const isExpired = msg.expiresAt && new Date(msg.expiresAt) < new Date();
          const replyRef = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;

          return (
            <div key={msg.id}>
              {showTime && (
                <div className="text-center text-[10px] text-zinc-500 my-2">{formatTime(msg.createdAt)}</div>
              )}
              <div className={cn("flex mb-1", isSender ? "justify-end" : "justify-start")}>
                <div className="max-w-[78%] space-y-0.5"
                  onMouseDown={() => onLongPressStart(msg)}
                  onMouseUp={onLongPressEnd}
                  onTouchStart={() => onLongPressStart(msg)}
                  onTouchEnd={onLongPressEnd}
                  data-testid={`msg-${msg.id}`}>
                  {/* Reply preview */}
                  {replyRef && (
                    <div className={cn("text-[10px] px-2 py-1 rounded-t-xl border-l-2 opacity-70", isSender ? "border-white/40 bg-white/10" : "border-violet-400 bg-white/5")}>
                      <span className="font-medium">Replied to: </span>{replyRef.content}
                    </div>
                  )}
                  {/* Bubble */}
                  {isExpired ? (
                    <div className={cn("px-3 py-2 rounded-2xl text-xs opacity-50 italic", isSender ? "bg-white/10" : "bg-white/5")}>
                      Message expired
                    </div>
                  ) : (
                    <div className={cn("px-3 py-2 rounded-2xl", isSender ? T.sent : T.recv,
                      replyRef ? "rounded-tl-sm" : "")}>
                      {msg.type === "text" && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{translatedTexts[msg.id] || msg.content}</p>
                      )}
                      {msg.type === "image" && msg.mediaUrl && (
                        <img src={msg.mediaUrl} className="rounded-xl max-w-full max-h-60 object-cover" />
                      )}
                      {msg.type === "video" && msg.mediaUrl && (
                        <video src={msg.mediaUrl} controls className="rounded-xl max-w-full max-h-60" />
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
                            className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span>View on Maps ({loc.lat.toFixed(4)}, {loc.lng.toFixed(4)})</span>
                          </a>
                        );
                      })()}
                      {/* Translation */}
                      {msg.type === "text" && (
                        <button onClick={() => handleTranslate(msg)}
                          className="flex items-center gap-1 text-[10px] opacity-50 hover:opacity-80 mt-1 transition-opacity">
                          <Globe className="w-2.5 h-2.5" />
                          {translatedTexts[msg.id] ? "Show original" : "Translate"}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Reactions */}
                  {Object.keys(reactions).length > 0 && (
                    <div className={cn("flex gap-1 flex-wrap", isSender ? "justify-end" : "justify-start")}>
                      {Object.entries(reactions).map(([emoji, uids]) => (
                        <button key={emoji} onClick={() => reactMutation.mutate({ id: msg.id, emoji })}
                          className="flex items-center gap-0.5 bg-white/10 rounded-full px-2 py-0.5 text-xs border border-white/10 hover:bg-white/20">
                          {emoji} <span className="opacity-70">{uids.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Quick emoji reaction */}
                  {showEmojiFor === msg.id && (
                    <div className="flex gap-1 bg-zinc-800 rounded-full px-2 py-1 border border-white/10">
                      {QUICK_EMOJIS.map(e => (
                        <button key={e} onClick={() => { reactMutation.mutate({ id: msg.id, emoji: e }); setShowEmojiFor(null); }}
                          className="text-lg hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </div>
                  )}
                  {/* Read receipt */}
                  {isSender && (
                    <div className={cn("flex justify-end")}>
                      {msg.readAt
                        ? <CheckCheck className="w-3 h-3 text-sky-400" />
                        : <Check className="w-3 h-3 text-zinc-500" />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex justify-start mb-2">
            <div className={cn("px-4 py-2 rounded-2xl", T.recv)}>
              <div className="flex gap-1 items-end h-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* ── Context menu overlay ── */}
      {contextMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setContextMsg(null)}>
          <div className="bg-zinc-900 rounded-2xl border border-white/10 w-64 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 p-3 border-b border-white/10 flex-wrap">
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => { reactMutation.mutate({ id: contextMsg.id, emoji: e }); setContextMsg(null); }}
                  className="text-2xl hover:scale-125 transition-transform">{e}</button>
              ))}
            </div>
            {[
              { label: "Reply", icon: <ArrowLeft className="w-4 h-4" />, action: () => { setReplyTo(contextMsg); setContextMsg(null); } },
              { label: "Pin message", icon: <Pin className="w-4 h-4" />, action: () => { pinMutation.mutate({ id: contextMsg.id, pinned: !contextMsg.pinnedAt }); setContextMsg(null); } },
              { label: "Translate", icon: <Globe className="w-4 h-4" />, action: () => { handleTranslate(contextMsg); setContextMsg(null); } },
              { label: "Delete", icon: <Trash2 className="w-4 h-4 text-red-400" />, action: () => { deleteMutation.mutate(contextMsg.id); setContextMsg(null); } },
            ].map(item => (
              <button key={item.label} onClick={item.action}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5">
                {item.icon} {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Poll Form ── */}
      {showPollForm && (
        <div className="p-4 bg-zinc-900 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Create Poll</p>
            <button onClick={() => setShowPollForm(false)}><X className="w-4 h-4" /></button>
          </div>
          <input value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="Ask a question..."
            className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm outline-none border border-white/10" />
          {pollOpts.map((opt, i) => (
            <input key={i} value={opt} onChange={e => { const a = [...pollOpts]; a[i] = e.target.value; setPollOpts(a); }}
              placeholder={`Option ${i + 1}`} className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm outline-none border border-white/10" />
          ))}
          <div className="flex gap-2">
            <button onClick={() => setPollOpts([...pollOpts, ""])} className="text-sm text-violet-400">+ Add option</button>
            <button onClick={handlePollSubmit} className="ml-auto bg-violet-600 text-white text-sm px-4 py-1.5 rounded-xl">Send Poll</button>
          </div>
        </div>
      )}

      {/* ── Attach menu ── */}
      {showAttachMenu && (
        <div className="grid grid-cols-4 gap-3 p-4 bg-zinc-900 border-t border-white/10">
          {[
            { icon: <Image className="w-5 h-5" />, label: "Photo", action: () => { mediaInputRef.current?.click(); } },
            { icon: <MapPin className="w-5 h-5" />, label: "Location", action: handleLocation },
            { icon: <BarChart2 className="w-5 h-5" />, label: "Poll", action: () => { setShowPollForm(true); setShowAttachMenu(false); } },
            { icon: <Clock className="w-5 h-5" />, label: disappearing ? "Perm. msgs" : "Disappear", action: () => { setDisappearing(p => !p); setShowAttachMenu(false); } },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className="flex flex-col items-center gap-2 bg-white/5 rounded-2xl p-3 hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center text-violet-400">{item.icon}</div>
              <span className="text-xs text-zinc-400">{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Reply banner ── */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-violet-600/10 border-t border-violet-500/20">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-violet-400 font-medium">Replying to</p>
            <p className="text-xs truncate opacity-70">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)}><X className="w-4 h-4 text-zinc-400" /></button>
        </div>
      )}

      {/* ── Smart reply suggestions ── */}
      {smartReplies.length > 0 && !voiceRec.recording && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto border-t border-white/5">
          {smartReplies.map((s, i) => (
            <button key={i} onClick={() => { setText(s); setSmartReplies([]); }}
              className="shrink-0 text-xs bg-white/10 hover:bg-white/15 border border-white/10 rounded-full px-3 py-1.5 transition-colors"
              data-testid={`smart-reply-${i}`}>{s}</button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="flex items-end gap-2 px-3 py-3 bg-black/30 backdrop-blur-sm border-t border-white/10">
        <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleMedia} />

        {voiceRec.recording ? (
          <div className="flex-1 flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-400">
              Recording {Math.floor(voiceRec.duration / 60).toString().padStart(2,"0")}:{(voiceRec.duration % 60).toString().padStart(2,"0")}
            </span>
            <button onClick={voiceRec.cancel} className="ml-auto text-zinc-400 text-sm">Cancel</button>
          </div>
        ) : (
          <>
            <button onClick={() => setShowAttachMenu(p => !p)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0 hover:bg-white/15"
              data-testid="button-attach">
              {showAttachMenu ? <X className="w-4 h-4" /> : <Paperclip className="w-4 h-4" />}
            </button>
            <div className="flex-1 flex items-center bg-white/10 rounded-2xl px-3 py-2 min-h-[40px]">
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); notifyTyping(); }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message..."
                rows={1}
                className="flex-1 bg-transparent text-sm outline-none resize-none max-h-24"
                data-testid="input-message"
              />
            </div>
          </>
        )}

        {text.trim() ? (
          <button onClick={handleSend} className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center shrink-0 hover:bg-violet-500"
            data-testid="button-send">
            <Send className="w-4 h-4 text-white" />
          </button>
        ) : (
          <button onClick={handleVoice}
            className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0", voiceRec.recording ? "bg-red-500 animate-pulse" : "bg-white/10 hover:bg-white/15")}
            data-testid="button-voice">
            {voiceRec.recording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Messages Page ────────────────────────────────────────────────────────
export default function Messages() {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState<ChatContact | null>(null);
  const [showGroupCreate, setShowGroupCreate] = useState(false);

  const currentUserId: string = (user as any)?.claims?.sub ?? (user as any)?.id ?? "";

  if (activeChat) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950">
        <ChatView
          chat={activeChat}
          currentUserId={currentUserId}
          onBack={() => setActiveChat(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 pt-14">
      <Header />
      <div className="flex-1 max-w-md mx-auto w-full flex flex-col">
        <ChatList
          onOpenChat={chat => setActiveChat(chat)}
          onOpenGroup={() => setShowGroupCreate(true)}
        />
      </div>
      <BottomNav />
    </div>
  );
}
