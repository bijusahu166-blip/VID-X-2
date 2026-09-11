import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useParams, useLocation } from "wouter";
import { PostViewerModal } from "@/components/post/PostViewerModal";
import { playFollow, playNotification } from "@/lib/sounds";
import { ArrowLeft } from "lucide-react";
import {
  Settings, Grid, Bookmark, Users, PawPrint,
  History as HistoryIcon, ChevronRight,
  TrendingUp, Wrench, Wallet, ShieldCheck, KeyRound, Heart,
  RefreshCw, UserX, Ghost, Activity,
  MessageSquare, AtSign, MessageCircle, Share2,
  LogOut, Menu, Zap, Trophy, Flame, Shield, Sword, Target,
  Crown, Cpu, BadgeCheck, BarChart3, Lock, Video, WifiOff, Gauge,
  MoreVertical, Flag, Trash2, Copy, Link as LinkIcon, X,
  UserCircle2, Smartphone, Bell, Palette, FileText, HelpCircle,
  Download as DownloadIcon, Repeat2, EyeOff, DollarSign, CalendarClock,
  FolderCog, LineChart, ShieldAlert, Fingerprint, Sun, Moon, Monitor,
  Type, Sparkles, Megaphone, Languages, LifeBuoy, PlusCircle
} from "lucide-react";
import { useVideoSettings, VideoQuality } from "@/contexts/VideoSettingsContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosts } from "@/hooks/use-posts";
import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, apiUrl} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Pencil } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

const PETS = [
  { name: "Buddy", emoji: "🐶" }, { name: "Charlie", emoji: "🐱" },
  { name: "Max", emoji: "🐹" }, { name: "Bella", emoji: "🐰" },
  { name: "Lucy", emoji: "🦊" }, { name: "Rocky", emoji: "🐻" },
  { name: "Daisy", emoji: "🐼" }, { name: "Coco", emoji: "🐨" },
  { name: "Milo", emoji: "🐯" }, { name: "Luna", emoji: "🦁" },
  { name: "Teddy", emoji: "🐮" }, { name: "Simba", emoji: "🐷" },
  { name: "Oliver", emoji: "🐸" }, { name: "Leo", emoji: "🐵" },
  { name: "Rosie", emoji: "🦄" }, { name: "Ruby", emoji: "🦖" },
  { name: "Jack", emoji: "🐉" }, { name: "Tiger", emoji: "🐆" },
  { name: "Bruno", emoji: "🐘" }, { name: "Shadow", emoji: "🦒" },
];

const ACHIEVEMENTS = [
  { icon: Trophy, label: "Champion", color: "#fbbf24" },
  { icon: Flame, label: "On Fire", color: "#f97316" },
  { icon: Shield, label: "Defender", color: "#f472b6" },
  { icon: Sword, label: "Warrior", color: "#c084fc" },
  { icon: Target, label: "Sharpshot", color: "#34d399" },
  { icon: Crown, label: "Royalty", color: "#f472b6" },
];

// ══════════════════════════════════════════════════════════════════════════
// Smart default avatar — round, gender-aware (boys get a male preset,
// girls get a female preset). Falls back to a neutral style if gender
// isn't set. Used anywhere a user has no uploaded profileImageUrl.
// ══════════════════════════════════════════════════════════════════════════
function getDefaultAvatar(gender: string | undefined | null, seed: string): string {
  const safeSeed = encodeURIComponent(seed || "litlink-user");
  if (gender === "female" || gender === "woman" || gender === "girl") {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${safeSeed}&top=longHairStraight,longHairCurly,longHairBun,longHairBob&hairColor=2c1b18,4a312c,724133,a55728,b58143&facialHairProbability=0&clothesColor=ff6f91,ff9ff3,e84393,fd79a8&backgroundColor=ffe0ec,ffd1e8`;
  }
  if (gender === "male" || gender === "man" || gender === "boy") {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${safeSeed}&top=shortHairShortFlat,shortHairShortRound,shortHairTheCaesar,shortHairFrizzle&facialHairProbability=30&clothesColor=3498db,2d98da,0984e3,00b894&backgroundColor=d9f0ff,dceeff`;
  }
  // Gender not set — neutral smart avatar
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${safeSeed}&backgroundColor=eeeeee,e3f2fd,f3e5f5`;
}

function SettingRow({ icon: Icon, label, sub, onClick }: { icon: any; label: string; sub?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-left active:bg-white/10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

// Reusable toggle row used across the new settings panels below
function ToggleRow({ icon: Icon, label, sub, checked, onCheckedChange }: { icon: any; label: string; sub?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border/30">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0 ml-2" />
    </div>
  );
}

// Simple selectable option row (radio-style, no backend wiring needed)
function OptionRow({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
      <span className="text-sm">{label}</span>
      {selected && <div className="w-2 h-2 rounded-full bg-pink-400" />}
    </button>
  );
}

function fmtN(n: number | undefined): string {
  if (n === undefined || n === null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return n.toString();
}

// ══════════════════════════════════════════════════════════════════════════
// Shared dropdown menu primitive (lightweight, no extra deps)
// ══════════════════════════════════════════════════════════════════════════
function DropdownMenu({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: { icon: any; label: string; onClick: () => void; danger?: boolean }[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-10 z-50 w-56 rounded-2xl border border-white/10 bg-zinc-900/98 backdrop-blur-xl shadow-2xl overflow-hidden py-1.5"
      style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.6)" }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5 ${
            item.danger ? "text-red-400" : "text-zinc-200"
          }`}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Report User dialog
// ══════════════════════════════════════════════════════════════════════════
const REPORT_REASONS = [
  "Spam",
  "Nudity or sexual content",
  "Hate speech or symbols",
  "Bullying or harassment",
  "Fake account / impersonation",
  "Violence or dangerous content",
  "Something else",
];

function ReportUserDialog({
  open,
  onOpenChange,
  targetUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetUserId: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");

  const reportMutation = useMutation({
    mutationFn: () =>
      fetch(apiUrl(`/api/users/${targetUserId}/report`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason, details }),
      }).then((r) => {
        if (!r.ok) throw new Error("Report failed");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thanks — our team will review this account." });
      onOpenChange(false);
      setReason(null);
      setDetails("");
    },
    onError: () => toast({ title: "Couldn't submit report", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Flag className="w-4 h-4 text-red-400" /> Report User</DialogTitle>
          <DialogDescription>Tell us what's wrong. Your report is anonymous.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-left transition-colors ${
                reason === r ? "border-red-400/60 bg-red-400/10 text-white" : "border-white/10 hover:bg-white/5 text-zinc-300"
              }`}
            >
              {r}
              {reason === r && <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />}
            </button>
          ))}
        </div>
        {reason === "Something else" && (
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Add a few details (optional)"
            rows={3}
            className="bg-white/5 border-white/10 rounded-xl text-sm"
          />
        )}
        <Button
          className="w-full bg-red-500 hover:bg-red-600"
          disabled={!reason || reportMutation.isPending}
          onClick={() => reportMutation.mutate()}
        >
          {reportMutation.isPending ? "Submitting…" : "Submit Report"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Blocked Accounts dialog (real API-backed, used from own profile menu)
// ══════════════════════════════════════════════════════════════════════════
function BlockedAccountsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

 const { data: blocked, isLoading } = useQuery<any[]>({
    queryKey: ["/api/users/blocked"],
    queryFn: async () => {
      const r = await fetch(apiUrl("/api/users/blocked"), { credentials: "include" });
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open,
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(apiUrl(`/api/users/${userId}/block`), { method: "DELETE", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Unblock failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users/blocked"] });
      toast({ title: "Unblocked" });
    },
    onError: () => toast({ title: "Couldn't unblock", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserX className="w-4 h-4 text-red-400" /> Blocked Accounts</DialogTitle>
          <DialogDescription>Blocked accounts can't see your profile, posts, reels or message you.</DialogDescription>
        </DialogHeader>
        <ScrollAreaUI className="max-h-80">
          <div className="space-y-2 pr-2">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />)
            ) : !blocked || blocked.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">You haven't blocked anyone.</p>
            ) : (
              blocked.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-8 h-8 rounded-full">
                      <AvatarImage src={u.profileImageUrl || getDefaultAvatar(u.gender, u.username || u.id)} className="rounded-full" />
                      <AvatarFallback className="rounded-full">{u.firstName?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">@{u.username || u.firstName}</span>
                  </div>
                  <button
                    onClick={() => unblockMutation.mutate(u.id)}
                    disabled={unblockMutation.isPending}
                    className="text-[11px] text-blue-400 font-semibold px-3 py-1 rounded-full border border-blue-400/30 hover:bg-blue-400/10 transition-colors shrink-0 disabled:opacity-50"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </ScrollAreaUI>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Remove Account dialog
// ══════════════════════════════════════════════════════════════════════════
function RemoveAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");

  const removeMutation = useMutation({
    mutationFn: () =>
      fetch(apiUrl("/api/account"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      }).then((r) => {
        if (!r.ok) throw new Error("Delete failed");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: "Account deleted", description: "Sorry to see you go." });
      window.location.href = "/";
    },
    onError: () => toast({ title: "Couldn't delete account", description: "Check your password and try again.", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400"><Trash2 className="w-4 h-4" /> Remove Account</DialogTitle>
          <DialogDescription>This permanently deletes your profile, posts, reels, messages and followers. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Confirm your password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="bg-white/5 border-white/10 rounded-xl h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Type DELETE to confirm</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="bg-white/5 border-white/10 rounded-xl h-11 font-mono"
            />
          </div>
        </div>
        <Button
          className="w-full bg-red-500 hover:bg-red-600"
          disabled={confirmText !== "DELETE" || !password || removeMutation.isPending}
          onClick={() => removeMutation.mutate()}
        >
          {removeMutation.isPending ? "Deleting…" : "Permanently Delete My Account"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Share Profile helper
// ══════════════════════════════════════════════════════════════════════════
async function shareProfile(username: string, toast: (opts: any) => void) {
  const url = `${window.location.origin}/profile/${username}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: `${username} on LITLink`, url });
      return;
    } catch {
      // user cancelled share sheet — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied!", description: url });
  } catch {
    toast({ title: "Couldn't copy link", variant: "destructive" });
  }
}

function OtherUserProfile({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user: me } = useAuth();

  const { data: profileData, isLoading } = useQuery<any>({
    queryKey: ["/api/users", userId],
    queryFn: () => fetch(apiUrl(`/api/users/${userId}`), { credentials: "include" }).then(r => r.json()),
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

 const { data: userPosts, isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/posts", "user", userId],
    queryFn: async () => {
      const r = await fetch(apiUrl(`/api/posts?userId=${userId}`), { credentials: "include" });
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: followStatus } = useQuery<{ following: boolean }>({
    queryKey: ["/api/users", userId, "follow-status"],
    queryFn: () => fetch(apiUrl(`/api/users/${userId}/follow-status`), { credentials: "include" }).then(r => r.json()),
  });

  const { data: blockStatus } = useQuery<{ blocked: boolean }>({
    queryKey: ["/api/users", userId, "block-status"],
    queryFn: () => fetch(apiUrl(`/api/users/${userId}/block-status`), { credentials: "include" }).then(r => r.json()),
  });

  const [followLoading, setFollowLoading] = useState(false);
  const isFollowing = followStatus?.following ?? false;
  const isBlocked = blockStatus?.blocked ?? false;
  const [viewingPost, setViewingPost] = useState<any | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Real-time follower count — update the cache instantly when the WS event fires
  useEffect(() => {
    const handler = (e: Event) => {
      const { userId: updatedId, followersCount } = (e as CustomEvent).detail;
      if (String(updatedId) !== String(userId)) return;
      qc.setQueryData(["/api/users", userId], (old: any) =>
        old ? { ...old, followersCount } : old
      );
    };
    window.addEventListener("litlink:follower_update", handler);
    return () => window.removeEventListener("litlink:follower_update", handler);
  }, [userId, qc]);

  const toggleFollow = async () => {
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      await fetch(apiUrl(`/api/users/${userId}/follow`), { method, credentials: "include" });
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "follow-status"] });
      qc.invalidateQueries({ queryKey: ["/api/users", userId] });
      if (me?.id) qc.invalidateQueries({ queryKey: ["/api/users", me.id] });
      qc.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      if (!isFollowing) playFollow();
      toast({ title: isFollowing ? "Unfollowed" : "Following! They've been notified." });
    } catch {
      toast({ title: "Failed to update follow", variant: "destructive" });
    } finally {
      setFollowLoading(false);
    }
  };

  const blockMutation = useMutation({
    mutationFn: () =>
      fetch(apiUrl(`/api/users/${userId}/block`), { method: "POST", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Block failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "block-status"] });
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "follow-status"] });
      qc.invalidateQueries({ queryKey: ["/api/users", userId] });
      toast({ title: "User blocked", description: "They can no longer see your profile, posts or message you." });
    },
    onError: () => toast({ title: "Couldn't block user", variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: () =>
      fetch(apiUrl(`/api/users/${userId}/block`), { method: "DELETE", credentials: "include" }).then((r) => {
        if (!r.ok) throw new Error("Unblock failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users", userId, "block-status"] });
      toast({ title: "User unblocked" });
    },
    onError: () => toast({ title: "Couldn't unblock user", variant: "destructive" }),
  });

  const [msgLoading, setMsgLoading] = useState(false);
  const startMessage = async () => {
    setMsgLoading(true);
    try {
      const res = await fetch(apiUrl("/api/direct-chats"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otherUserId: userId }),
      });
      const data = await res.json();
      if (res.ok && data?.id) {
        navigate(`/messages?openChatId=${data.id}`);
      } else {
        navigate("/messages");
      }
    } catch {
      navigate("/messages");
    } finally {
      setMsgLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const u = profileData;
  const name = u ? `${u.firstName} ${u.lastName}` : "User";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase();
  const avatarSrc = u?.profileImageUrl || getDefaultAvatar(u?.gender, u?.username || u?.id || userId);
const sortedUserPosts = (userPosts ?? [])
  .filter((p: any) => String(p.userId) === String(userId))
  .slice()
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const postCount = sortedUserPosts.length;

  return (
    <div className="min-h-screen bg-black pb-28">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-40 bg-black/95 backdrop-blur">
        <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center" data-testid="button-back-profile">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <span className="font-bold text-white flex-1">{name}</span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center"
            data-testid="button-other-user-menu"
          >
            <Menu className="w-4 h-4 text-white" />
          </button>
          <DropdownMenu
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            items={[
              { icon: LinkIcon, label: "Share Profile", onClick: () => shareProfile(u?.username || u?.firstName || userId, toast) },
              isBlocked
                ? { icon: UserX, label: "Unblock User", onClick: () => unblockMutation.mutate() }
                : { icon: UserX, label: "Block User", onClick: () => blockMutation.mutate(), danger: true },
              { icon: Flag, label: "Report User", onClick: () => setReportOpen(true), danger: true },
            ]}
          />
        </div>
      </div>

      <ReportUserDialog open={reportOpen} onOpenChange={setReportOpen} targetUserId={userId} />

      {isBlocked ? (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
            <UserX className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-1">You've blocked {name}</h2>
          <p className="text-sm text-zinc-500 max-w-xs mb-5">They can't see your profile, posts, reels or message you. Their profile is hidden for you too.</p>
          <button
            onClick={() => unblockMutation.mutate()}
            className="px-5 py-2 rounded-full bg-white text-black text-sm font-bold"
          >
            Unblock
          </button>
        </div>
      ) : (
      <>
      {/* Cover */}
      <div className="relative">
        <div className="h-36 w-full" style={{ background: "linear-gradient(135deg, #1a0030, #0d001a)" }} />
        <div className="absolute -bottom-10 left-4">
         <div className="relative">
  {/* Round avatar (smart gender-based default when no photo uploaded) */}
  <div className="w-20 h-20 rounded-full border-4 border-black overflow-hidden bg-zinc-800">
    {u?.profileImageUrl
      ? <img src={u.profileImageUrl} className="w-full h-full object-cover rounded-full" />
      : <img src={avatarSrc} className="w-full h-full object-cover rounded-full" alt={initials} />
    }
  </div>
  {/* Pet overlay for other user's profile */}
  {u?.pet && (() => {
    try {
      const pet = JSON.parse(u.pet);
      return (
        <div className="absolute -top-3 -right-3 text-xl bg-black rounded-full p-0.5 border border-white/20">
          {pet.emoji}
        </div>
      );
    } catch { return null; }
  })()}
</div>
        </div>
      </div>

      <div className="px-4" style={{ paddingTop: "var(--header-total)" }}>
        {/* Name + action buttons */}
        <div className="flex items-start justify-between mb-4">
          <div>
           <div className="flex items-center gap-1.5 flex-wrap">
  <h1 className="text-lg font-black text-white">
    {name}
  </h1>

  {u?.isCelebrity && (
    <span className="text-blue-400 text-sm">
      ✓
    </span>
  )}

  {u?.signatureActive &&
   u?.premiumSignature &&
   (
     !u?.signatureExpiresAt ||
     new Date(u.signatureExpiresAt) > new Date()
   ) && (
    <span
      title="Premium Signature"
      className="
        inline-flex
        items-center
        gap-0.5
        px-2
        py-0.5
        rounded-full
        bg-gradient-to-r
        from-pink-500/20
        to-violet-500/20
        border
        border-pink-400/30
        text-pink-300
        text-[8px]
        font-bold
      "
    >
      ✦ Premium
    </span>
  )}
</div>

<p className="text-[12px] text-pink-400/70 font-mono mt-0.5">
  @{u?.username || u?.firstName?.toLowerCase() || "user"}
</p>

{u?.signatureActive &&
 u?.premiumSignature &&
 (
   !u?.signatureExpiresAt ||
   new Date(u.signatureExpiresAt) > new Date()
 ) && (
  <div
    className="mt-1 text-2xl text-white leading-tight"
    style={{
      fontFamily:
        u?.signatureStyle || "cursive",
    }}
  >
    {u.premiumSignature}
  </div>
)}
            {u?.bio && <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{u.bio}</p>}
          </div>
          {/* Follow + Message buttons */}
            <div className="flex flex-col gap-2 items-end">
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                data-testid="button-follow-user"
                className={`text-white text-sm font-bold px-5 py-2 rounded-full transition-colors disabled:opacity-60 ${
                  isFollowing
                    ? "bg-zinc-700 hover:bg-zinc-600 border border-zinc-600"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {followLoading ? "…" : isFollowing ? "Following ✓" : "Follow"}
              </button>
              <button
                onClick={startMessage}
                disabled={msgLoading}
                data-testid="button-message-user"
                className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700 disabled:opacity-60"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {msgLoading ? "…" : "Message"}
              </button>
            </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "POSTS", value: fmtN(u?.postsCount ?? postCount) },
            { label: "CREW", value: fmtN(u?.followersCount) },
            { label: "ALLIES", value: fmtN(u?.followingCount) },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-xl font-black text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Posts grid */}
        {postsLoading ? (
          <div className="grid grid-cols-3 gap-0.5">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="aspect-square bg-zinc-900 animate-pulse" />
            ))}
          </div>
        ) : userPosts && userPosts.length > 0 ? (
          <div className="grid grid-cols-3 gap-0.5">
            {sortedUserPosts.map((post: any) => (
              <button
                key={post.id}
                className="aspect-square bg-zinc-900 overflow-hidden relative group text-left"
                onClick={() => setViewingPost(post)}
                data-testid={`post-thumb-${post.id}`}
              >
                {post.imageUrl && !post.imageUrl.startsWith("blob:") ? (
                  <img src={post.imageUrl} alt="" className="w-full h-full object-cover group-active:opacity-80 transition-opacity" />
                  ) : (post as any).videoUrl ? (
  <video src={(post as any).videoUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center p-2"
                    style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360}, 40%, 14%), hsl(${(post.id * 47 + 120) % 360}, 50%, 20%))` }}
                  >
                    <p className="text-[8px] text-white/30 text-center leading-tight">{post.type}</p>
                  </div>
                )}
                {(post.type === "video" || post.type === "reel") && (
                  <div className="absolute top-1 right-1">
                    <div className="w-4 h-4 rounded bg-black/60 flex items-center justify-center">
                      <span className="text-[7px] text-white">▶</span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-3">
              <Grid className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-sm text-zinc-600">No posts yet</p>
          </div>
        )}
      </div>
      </>
      )}


      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          onClose={() => setViewingPost(null)}
          allPosts={sortedUserPosts}
        />
      )}
    </div>
  );
}
function OwnProfile() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { data: posts } = usePosts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { dataSaver, quality, setDataSaver, setQuality } = useVideoSettings();
  const { t, language, setLanguage } = useTranslation();
  const [selectedPet, setSelectedPet] = useState<{ name: string; emoji: string } | null>(null);
  useEffect(() => {
  if ((user as any)?.pet) {
    try {
      setSelectedPet(JSON.parse((user as any).pet));
    } catch {
      setSelectedPet(null);
    }
  }
}, [(user as any)?.pet]);
  const { data: profile, error: profileError, isLoading: profileLoading } = useQuery({
    queryKey: ["/api/profile"],
    queryFn: () => apiRequest("GET", "/api/profile").then((res) => res.json()),
    enabled: !!user?.id,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: viewedUser, error: viewedUserError, isLoading: viewedUserLoading } = useQuery({
    queryKey: ["/api/users", params.id],
    queryFn: () => params.id ? apiRequest("GET", `/api/users/${params.id}`).then((res) => res.json()) : null,
    enabled: !!params.id,
  });

  const { data: myStats, error: myStatsError, isLoading: myStatsLoading } = useQuery<{ followersCount: number; followingCount: number; postsCount: number }>({
    queryKey: ["/api/users", user?.id],
    queryFn: () => apiRequest("GET", `/api/users/${user?.id}`).then((res) => res.json()),
    enabled: !!user?.id,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
const { data: savedPostsData, isLoading: savedLoading } = useQuery<any[]>({
  queryKey: ["/api/user/saved"],
  queryFn: async () => {
    const res = await fetch(apiUrl("/api/user/saved"), { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch saved posts");
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
  enabled: !params.id, // only fetch on own profile
});

  // ══════════════════════════════════════════════════════════════════════
  // AdPay Center — real coin balance + creator earnings + withdrawals
  // ══════════════════════════════════════════════════════════════════════
  const COINS_PER_RUPEE = 50;       // 150 coins = ₹3
  const MIN_WITHDRAW_COINS = 500;   // minimum withdrawal amount

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins/balance"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/coins/balance"), { credentials: "include" });
      return res.json();
    },
    enabled: !params.id,
  });

  const { data: earningsData } = useQuery<{ gifts: any[]; totalEarnedCoins: number }>({
    queryKey: ["/api/users", user?.id, "gifts-received"],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/users/${user?.id}/gifts-received`), { credentials: "include" });
      return res.json();
    },
    enabled: !params.id && !!user?.id,
  });

  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<any[]>({
    queryKey: ["/api/withdrawals/mine"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/withdrawals/mine"), { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !params.id,
  });

  const [withdrawCoins, setWithdrawCoins] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"upi" | "bank">("upi");
  const [withdrawUpiId, setWithdrawUpiId] = useState("");
  const [withdrawBankAcc, setWithdrawBankAcc] = useState("");
  const [withdrawBankIfsc, setWithdrawBankIfsc] = useState("");
  const [withdrawBankName, setWithdrawBankName] = useState("");

  const withdrawMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/withdrawals/request", {
        coins: Number(withdrawCoins),
        method: withdrawMethod,
        upiId: withdrawMethod === "upi" ? withdrawUpiId.trim() : undefined,
        bankAccountNumber: withdrawMethod === "bank" ? withdrawBankAcc.trim() : undefined,
        bankIfsc: withdrawMethod === "bank" ? withdrawBankIfsc.trim().toUpperCase() : undefined,
        bankHolderName: withdrawMethod === "bank" ? withdrawBankName.trim() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/withdrawals/mine"] });
      qc.invalidateQueries({ queryKey: ["/api/coins/balance"] });
      toast({ title: "Withdrawal requested!", description: "We'll process it and notify you." });
      setWithdrawCoins(""); setWithdrawUpiId(""); setWithdrawBankAcc(""); setWithdrawBankIfsc(""); setWithdrawBankName("");
      setSettingsPanel("AdPay Center");
    },
    onError: (err: any) => toast({ title: "Couldn't submit request", description: err.message, variant: "destructive" }),
  });

  const { data: history, error: historyError, isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/history"],
    queryFn: () => apiRequest("GET", "/api/history").then((res) => res.json()),
    enabled: !!user?.id,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Determine current profile user
  const currentProfileUser = params.id ? viewedUser : user;
  const currentStats = params.id ? viewedUser : myStats;
  const { data: xpData, error: xpError, isLoading: xpLoading } = useQuery<{ totalXP: number; xpInLevel: number; xpMax: number; level: number; breakdown: any }>({
    queryKey: ["/api/profile/xp"],
    queryFn: () => apiRequest("GET", "/api/profile/xp").then((res) => res.json()),
    enabled: !!user?.id,
    staleTime: 10000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: profileBooksData = [], isLoading: booksLoading } = useQuery<any[]>({
    queryKey: ["/api/books", params.id ? "user" : "mine", params.id],
    queryFn: () => {
      const url = params.id ? `/api/books?userId=${params.id}` : "/api/books/mine";
      return apiRequest("GET", url).then((res) => res.json());
    },
    enabled: params.id ? true : !!user?.id,
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await fetch(apiUrl(`/api/books/${bookId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/books", params.id ? "user" : "mine", params.id] });
      toast({ title: "Book deleted" });
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const handleDeleteBook = async (bookId: number) => {
    if (!window.confirm("Delete this book? This cannot be undone.")) return;
    deleteBookMutation.mutate(bookId);
  };

  const profileBooksArray = profileBooksData as any[];

  // ── FIX: guard against posts not being an array (was crashing with
  // "l?.filter is not a function" whenever the API returned something
  // other than a plain array, e.g. an error object or undefined) ──
  const myPosts = (Array.isArray(posts) ? posts : [])
    .filter((p: any) => String(p.userId) === String(user?.id) && p.type !== "story" && p.type !== "live")
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

// ── Real InsightX calculations ──
const totalViews = myPosts.reduce((sum, p: any) => sum + (p.viewerCount ?? 0), 0);
const totalLikes = myPosts.reduce((sum, p: any) => sum + (p.likesCount ?? 0), 0);
const totalComments = myPosts.reduce((sum, p: any) => sum + (p.commentsCount ?? 0), 0);
const engagementRate = totalViews > 0 ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(1) : "0.0";

const photoCount = myPosts.filter((p: any) => p.type === "post" || p.type === "image").length;
const videoCount = myPosts.filter((p: any) => p.type === "video" || p.type === "reel").length;
const totalContentCount = photoCount + videoCount || 1;
const photoPercent = Math.round((photoCount / totalContentCount) * 100);
const videoPercent = Math.round((videoCount / totalContentCount) * 100);
  const [settingsPanel, setSettingsPanel] = useState<string | null>(null);
  const [accountPrivate, setAccountPrivate] = useState(false);

  // ── Security → Change Password ──
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/change-password", {
        currentPassword: currentPasswordInput,
        newPassword: newPasswordInput,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ description: "Password updated." });
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setSettingsPanel(null);
    },
    onError: (err: any) => {
      toast({ variant: "destructive", description: err?.message || "Could not update password." });
    },
  });

  // ── Security → Devices / Login Activity (same data, both entry points) ──
  const { data: loginSessions = [], isLoading: sessionsLoading } = useQuery<any[]>({
    queryKey: ["/api/sessions"],
    enabled: settingsPanel === "Devices" || settingsPanel === "LoginActivity",
  });
  const revokeSessionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sessions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ description: "Device signed out." });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", description: err?.message || "Could not sign out that device." });
    },
  });

  // ── Ads → Ad Topics / Hide Advertiser / Reset ──
  const [newAdTopicInput, setNewAdTopicInput] = useState("");
  const [newHiddenAdvertiserInput, setNewHiddenAdvertiserInput] = useState("");
  const { data: adPrefs = [] } = useQuery<any[]>({
    queryKey: ["/api/ad-preferences"],
    enabled: settingsPanel === "AdTopics" || settingsPanel === "HideAdvertiser",
  });
  const addAdPrefMutation = useMutation({
    mutationFn: async (vars: { type: string; value: string }) => {
      const res = await apiRequest("POST", "/api/ad-preferences", vars);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/ad-preferences"] }),
    onError: (err: any) => toast({ variant: "destructive", description: err?.message || "Could not save." }),
  });
  const removeAdPrefMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/ad-preferences/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/ad-preferences"] }),
  });
  const resetAdPrefsMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(adPrefs.map((p: any) => apiRequest("DELETE", `/api/ad-preferences/${p.id}`)));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ad-preferences"] });
      toast({ description: "Ad preferences reset." });
    },
  });

  // ── Own-profile ☰ menu (Share Profile / Blocked Accounts / Remove Account) ──
  const [ownMenuOpen, setOwnMenuOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [removeAccountOpen, setRemoveAccountOpen] = useState(false);

  // Real-time follower count on own profile — update instantly via WS event
  useEffect(() => {
    if (!user?.id) return;
    const handler = (e: Event) => {
      const { userId: updatedId, followersCount } = (e as CustomEvent).detail;
      if (String(updatedId) !== String(user.id)) return;
      qc.setQueryData(["/api/users", user.id], (old: any) =>
        old ? { ...old, followersCount } : old
      );
    };
    window.addEventListener("litlink:follower_update", handler);
    return () => window.removeEventListener("litlink:follower_update", handler);
  }, [user?.id, qc]);
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [allowTags, setAllowTags] = useState(true);

  // ── NEW: state for the settings sections added from the master table ──
  // Interactions → Notifications
  const [pushEnabled, setPushEnabled] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyRequests, setNotifyRequests] = useState(true);
  const [notifyLikes, setNotifyLikes] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyFollowers, setNotifyFollowers] = useState(true);
  const [quietMode, setQuietMode] = useState(false);

  // Account & Security → Account
  const [accountType, setAccountType] = useState<"Personal" | "Professional">("Personal");

  // Account & Security → Security
  const [twoFA, setTwoFA] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  // Account & Security → Appearance
  const [theme, setTheme] = useState<"Dark" | "Light" | "System">("Dark");
  const [fontSize, setFontSize] = useState<"Small" | "Default" | "Large">("Default");
  const [reduceMotion, setReduceMotion] = useState(false);

  // Privacy → PrivacyLock extras
  const [whoCanFollow, setWhoCanFollow] = useState<"Everyone" | "Approval">("Everyone");
  const [whoCanSeePosts, setWhoCanSeePosts] = useState<"Everyone" | "Followers">("Everyone");
  const [activityStatus, setActivityStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [findByPhone, setFindByPhone] = useState(true);
  const [findByEmail, setFindByEmail] = useState(true);

  // Privacy → ShareSync
  const [postSharing, setPostSharing] = useState(true);
  const [storySharing, setStorySharing] = useState(true);
  const [reelSharing, setReelSharing] = useState(true);
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [allowRemix, setAllowRemix] = useState(true);
  const [externalSharing, setExternalSharing] = useState(true);
  const [allowCopyLink, setAllowCopyLink] = useState(true);

  // Privacy → GhostView
  const [activityVisibility, setActivityVisibility] = useState(true);
  const [profileVisitVisibility, setProfileVisitVisibility] = useState(true);
  const [storyViewPrivacy, setStoryViewPrivacy] = useState(true);
  const [searchVisibility, setSearchVisibility] = useState(true);

  // Privacy → FriendPulse
  const [pulseRequests, setPulseRequests] = useState(true);
  const [pulsePosts, setPulsePosts] = useState(true);
  const [pulseStories, setPulseStories] = useState(true);
  const [pulseReels, setPulseReels] = useState(true);
  const [pulseMentions, setPulseMentions] = useState(true);

  // For Professionals → ProTools Hub / AdPay Center
  const [autoScheduleReminders, setAutoScheduleReminders] = useState(false);

  // ── Edit Profile ──────────────────────────────────────────────────────────
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editGender, setEditGender] = useState<string>("");
  const [viewingMyPost, setViewingMyPost] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openEditProfile = () => {
    setEditFirstName(user?.firstName || "");
    setEditLastName(user?.lastName || "");
    setEditUsername((user as any)?.username || "");
    setEditBio((user as any)?.bio || "");
    setEditAvatarUrl(user?.profileImageUrl || "");
    setEditGender((user as any)?.gender || "");
    setShowEditProfile(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; username?: string; bio?: string; profileImageUrl?: string; gender?: string }) =>
      apiRequest("PATCH", "/api/profile", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setShowEditProfile(false);
      toast({ title: "Profile updated!", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSaveProfile = () => {
    if (!editFirstName.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate({
      firstName: editFirstName.trim(),
      lastName: editLastName.trim(),
      username: editUsername.trim() || undefined,
      bio: editBio.trim() || undefined,
      profileImageUrl: editAvatarUrl || undefined,
      gender: editGender || undefined,
    });
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(apiUrl("/api/upload/profile-image"), {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    setEditAvatarUrl(data.profileImageUrl || data.imageUrl || data.url);
    toast({ title: "Photo uploaded! ✅" });
  } catch (err: any) {
    toast({ title: "Upload failed", description: err.message, variant: "destructive" });
  }
};

  const pageError = params.id ? viewedUserError :profileError;
  const loading = authLoading || profileLoading || (params.id ? viewedUserLoading : false)
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full rounded-3xl border border-white/10 bg-zinc-950/95 p-8 text-white shadow-xl">
          <h1 className="text-2xl font-semibold mb-4">Unable to load profile</h1>
          <p className="text-sm text-muted-foreground mb-6">{pageError instanceof Error ? pageError.message : "Something went wrong while loading this profile."}</p>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["/api/profile"] })}
            className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const xp = xpData?.xpInLevel ?? 0;
  const xpMax = xpData?.xpMax ?? 500;
  const level = xpData?.level ?? 1;

  const getRank = (lv: number) => {
    if (lv >= 51) return { rank: "DIAMOND",  color: "#f472b6" };
    if (lv >= 36) return { rank: "PLATINUM", color: "#e2e8f0" };
    if (lv >= 21) return { rank: "GOLD",     color: "#fbbf24" };
    if (lv >= 11) return { rank: "SILVER",   color: "#94a3b8" };
    if (lv >= 6)  return { rank: "BRONZE",   color: "#d97706" };
    return           { rank: "ROOKIE",    color: "#6b7280" };
  };
  const { rank, color: rankColor } = getRank(level);
  if (params?.id && params.id !== user?.id) {
    return <OtherUserProfile userId={params.id} />;
  }

  // Smart round default avatar for own profile (used when no photo uploaded)
  const ownAvatarSrc = currentProfileUser?.profileImageUrl || getDefaultAvatar((currentProfileUser as any)?.gender, (currentProfileUser as any)?.username || user?.id || "me");

  return (
    <div className="min-h-screen bg-black pb-28 relative">

      {/* ══ CYBER BANNER ══ */}
      <div className="relative h-52 overflow-hidden">
        {/* Animated cyber grid background */}
        <div className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0a0a1a 0%, #0d0d2b 40%, #0a001a 70%, #000 100%)",
          }}
        />
        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(96,165,250,0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(96,165,250,0.4) 1px, transparent 1px)
            `,
            backgroundSize: "32px 32px",
            animation: "gridScroll 8s linear infinite",
          }}
        />
        {/* Glow orbs */}
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent 70%)" }} />
        <div className="absolute -top-5 right-0 w-56 h-56 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #db2777, transparent 70%)" }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 h-24 opacity-40"
          style={{ background: "radial-gradient(ellipse, #be185d, transparent 70%)" }} />

        {/* Scan lines */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)",
          }}
        />

        {/* Top HUD bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-end px-4 pb-2" style={{ paddingTop: "var(--header-total)" }}>
          <div className="flex items-center gap-1">
            {/* Settings - only for own profile */}
            {!params.id && (
              <Dialog onOpenChange={(open) => { if (!open) setSettingsPanel(null); }}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full text-pink-400 hover:bg-pink-400/10" data-testid="settings-btn">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl p-0 overflow-hidden">
                <DialogDescription className="sr-only">Manage your account settings.</DialogDescription>
                <DialogHeader className="px-6 pt-5 pb-3 border-b border-border/40 flex-row items-center gap-3">
                  {settingsPanel && (
                    <button onClick={() => setSettingsPanel(null)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                  )}
                  <DialogTitle className="text-xl font-display">
                    {settingsPanel ?? "Settings"}
                  </DialogTitle>
                </DialogHeader>

                <ScrollAreaUI className="max-h-[80vh]">

                  {/* ── MAIN LIST ── */}
                  {!settingsPanel && (
                    <div className="py-4 space-y-5 px-4">
                      <button
                        onClick={() => navigate("/Subscription")}
                        className="flex w-full items-center justify-between rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/15 to-cyan-500/15 px-4 py-3 text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">Pro Access</p>
                          <p className="text-[11px] text-zinc-400">Unlock premium chat, no ads, and pro themes for ₹50</p>
                        </div>
                        <Crown className="w-4 h-4 text-purple-400" />
                      </button>

                      {/* Section: How you use LITLink */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">How you use LITLink</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: TrendingUp, label: "InsightX", emoji: "📊", color: "#a78bfa", panel: "InsightX" },
                            { icon: Video,      label: "Video",    emoji: "🎬", color: "#34d399", panel: "VideoQuality", sub: dataSaver ? "Data Saver ON" : quality === "auto" ? "Auto" : quality.charAt(0).toUpperCase() + quality.slice(1) },
                          ].map((s: any) => (
                            <button key={s.panel} onClick={() => setSettingsPanel(s.panel)}
                              className="flex flex-col items-center gap-3 pt-4 pb-3 px-2 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 active:scale-95 transition-all">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22`, border: `1px solid ${s.color}44` }}>
                                <s.icon className="w-6 h-6" style={{ color: s.color }} />
                              </div>
                              <span className="text-[9px] font-bold text-center leading-tight text-zinc-300">{s.label}</span>
                              {"sub" in s && s.sub && <span className="text-[8px] text-emerald-400 font-semibold -mt-1 text-center leading-tight">{s.sub}</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section: For professionals */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">For Professionals</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: Wrench,      label: "ProTools Hub",  color: "#f59e0b", panel: "ProTools Hub" },
                            { icon: Wallet,      label: "AdPay Center",  color: "#34d399", panel: "AdPay Center" },
                          ].map((s: any) => (
                            <button key={s.panel} onClick={() => setSettingsPanel(s.panel)}
                              className="flex flex-col items-center gap-3 pt-4 pb-3 px-2 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 active:scale-95 transition-all">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22`, border: `1px solid ${s.color}44` }}>
                                <s.icon className="w-6 h-6" style={{ color: s.color }} />
                              </div>
                              <span className="text-[9px] font-bold text-center leading-tight text-zinc-300">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section: Privacy */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">🔐 Privacy</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: KeyRound,  label: "PrivacyLock",  color: "#f472b6", panel: "PrivacyLock",  sub: accountPrivate ? "Private" : "Public" },
                            { icon: Heart,     label: "InnerCircle",  color: "#fb7185", panel: "InnerCircle",  sub: "15 members" },
                            { icon: RefreshCw, label: "ShareSync",    color: "#38bdf8", panel: "ShareSync" },
                            { icon: UserX,     label: "BlockShield",  color: "#f87171", panel: "BlockShield",  sub: "3 accounts" },
                            { icon: Ghost,     label: "GhostView",    color: "#c084fc", panel: "GhostView" },
                            { icon: Activity,  label: "FriendPulse",  color: "#fb923c", panel: "FriendPulse" },
                          ].map((s) => (
                            <button key={s.panel} onClick={() => setSettingsPanel(s.panel)}
                              className="flex flex-col items-center gap-3 pt-4 pb-3 px-2 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 active:scale-95 transition-all">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22`, border: `1px solid ${s.color}44` }}>
                                <s.icon className="w-6 h-6" style={{ color: s.color }} />
                              </div>
                              <span className="text-[9px] font-bold text-center leading-tight text-zinc-300">{s.label}</span>
                              {s.sub && <span className="text-[8px] text-zinc-500 -mt-1">{s.sub}</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section: Interactions */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">Interactions</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: MessageSquare, label: "Messages",  color: "#34d399", panel: "Messages and story replies" },
                            { icon: AtSign,        label: "Tags",      color: "#60a5fa", panel: "Tags and mentions" },
                            { icon: MessageCircle, label: "Comments",  color: "#f59e0b", panel: "Comments" },
                            { icon: Share2,        label: "Sharing",   color: "#a78bfa", panel: "Sharing and reuse" },
                            { icon: Bell,          label: "Notifications", color: "#fb7185", panel: "Notifications" },
                          ].map((s) => (
                            <button key={s.panel} onClick={() => setSettingsPanel(s.panel)}
                              className="flex flex-col items-center gap-3 pt-4 pb-3 px-2 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 active:scale-95 transition-all">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22`, border: `1px solid ${s.color}44` }}>
                                <s.icon className="w-6 h-6" style={{ color: s.color }} />
                              </div>
                              <span className="text-[9px] font-bold text-center leading-tight text-zinc-300">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section: Account & Security */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">👤 Account & Security</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: UserCircle2, label: "Account",  color: "#60a5fa", panel: "Account" },
                            { icon: Fingerprint, label: "Security", color: "#34d399", panel: "Security" },
                            { icon: Palette,     label: "Appearance", color: "#c084fc", panel: "Appearance" },
                          ].map((s) => (
                            <button key={s.panel} onClick={() => setSettingsPanel(s.panel)}
                              className="flex flex-col items-center gap-3 pt-4 pb-3 px-2 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 active:scale-95 transition-all">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22`, border: `1px solid ${s.color}44` }}>
                                <s.icon className="w-6 h-6" style={{ color: s.color }} />
                              </div>
                              <span className="text-[9px] font-bold text-center leading-tight text-zinc-300">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Section: Other */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">🌐 Other</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: Megaphone, label: "Ads",       color: "#fbbf24", panel: "AdsPrefs" },
                            { icon: Languages, label: "Language",  color: "#38bdf8", panel: "LanguagePrefs" },
                            { icon: LifeBuoy,  label: "Help & Safety", color: "#f87171", panel: "HelpSafety" },
                          ].map((s) => (
                            <button key={s.panel} onClick={() => setSettingsPanel(s.panel)}
                              className="flex flex-col items-center gap-3 pt-4 pb-3 px-2 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 active:scale-95 transition-all">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22`, border: `1px solid ${s.color}44` }}>
                                <s.icon className="w-6 h-6" style={{ color: s.color }} />
                              </div>
                              <span className="text-[9px] font-bold text-center leading-tight text-zinc-300">{s.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                     <Separator className="my-3" />

<button onClick={() => window.open("/privacy-policy.html", "_blank")}
  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 rounded-xl transition-colors">
  <Lock className="w-4 h-4 text-zinc-400" />
  <span className="text-sm font-semibold">Privacy Policy</span>
</button>

<button onClick={() => window.open("mailto:IQPartneroffical00@gmail.com")}
  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 rounded-xl transition-colors">
  <MessageSquare className="w-4 h-4 text-zinc-400" />
  <span className="text-sm font-semibold">Help & Support</span>
</button>

<Separator className="my-3" />
<button onClick={() => logout()} className="w-full flex items-center gap-3 px-5 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
  <LogOut className="w-4 h-4" />
  <span className="text-sm font-semibold">Log out</span>
</button>

<button
  onClick={async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This cannot be undone."
    );
    if (!confirmed) return;
    try {
      const res = await fetch(apiUrl("/api/profile/delete"), {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        logout();
      } else {
        alert("Failed to delete account. Please contact support.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    }
  }}
  className="w-full flex items-center gap-3 px-5 py-3 text-red-600 hover:bg-red-600/10 rounded-xl transition-colors"
>
  <UserX className="w-4 h-4" />
  <span className="text-sm font-semibold">Delete Account</span>
</button>
                    </div>
                  )}

                  {/* ── SUB: VIDEO QUALITY ── */}
                  {settingsPanel === "VideoQuality" && (
                    <div className="p-5 space-y-6">
                      {/* Data Saver toggle */}
                      <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 space-y-3">
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                            <WifiOff className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">Data Saver</p>
                            <p className="text-[11px] text-muted-foreground">Reduces data usage on videos</p>
                          </div>
                          <Switch
                            checked={dataSaver}
                            onCheckedChange={setDataSaver}
                            className="ml-auto"
                            data-testid="switch-data-saver"
                          />
                        </div>
                        {dataSaver && (
                          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                            <p className="text-[11px] text-emerald-300 font-medium">✓ Videos will not auto-play. Tap to load each video.</p>
                          </div>
                        )}
                      </div>

                      {/* Video Quality selector */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-bold">Playback Quality</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground -mt-1">Controls how videos are buffered and loaded.</p>
                        <div className="space-y-2">
                          {(["auto", "high", "medium", "low"] as VideoQuality[]).map((q) => {
                            const labels: Record<VideoQuality, { name: string; desc: string; badge: string; color: string }> = {
                              auto:   { name: "Auto",   desc: "Browser picks the best quality",  badge: "AUTO", color: "#a78bfa" },
                              high:   { name: "High",   desc: "Best quality, uses more data",    badge: "HD",   color: "#34d399" },
                              medium: { name: "Medium", desc: "Balanced quality and data usage", badge: "SD",   color: "#60a5fa" },
                              low:    { name: "Low",    desc: "Saves data, tap to load videos",  badge: "LQ",   color: "#fb923c" },
                            };
                            const info = labels[q];
                            const selected = quality === q && !dataSaver;
                            return (
                              <button
                                key={q}
                                onClick={() => setQuality(q)}
                                disabled={dataSaver}
                                data-testid={`quality-option-${q}`}
                                className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl border transition-all ${
                                  selected
                                    ? "border-primary/50 bg-primary/10"
                                    : "border-border/40 bg-muted/20 hover:bg-muted/40"
                                } ${dataSaver ? "opacity-40 cursor-not-allowed" : ""}`}
                              >
                                <div
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold w-10 text-center"
                                  style={{ background: `${info.color}22`, color: info.color, border: `1px solid ${info.color}44` }}
                                >
                                  {info.badge}
                                </div>
                                <div className="text-left flex-1">
                                  <p className="text-sm font-semibold">{info.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{info.desc}</p>
                                </div>
                                {selected && (
                                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {dataSaver && (
                          <p className="text-[11px] text-muted-foreground text-center pt-1">Disable Data Saver to change quality</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── SUB: GROW (InsightX) ── */}
                 {settingsPanel === "InsightX" && (
  <div className="p-5 space-y-4">
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">Grow</p>
          <h3 className="text-base font-bold text-white">Your real stats</h3>
        </div>
        <div className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">● Live</div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "Views", value: fmtN(totalViews) },
        { label: "Likes", value: fmtN(totalLikes) },
        { label: "Followers", value: fmtN(currentStats?.followersCount) },
        { label: "Engagement", value: `${engagementRate}%` },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{item.label}</p>
          <p className="mt-1 text-lg font-black text-white">{item.value}</p>
        </div>
      ))}
    </div>

    <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Content performance</p>
        <p className="text-[11px] text-zinc-500">All time</p>
      </div>
      {myPosts.length === 0 ? (
        <p className="text-[11px] text-zinc-600 text-center py-4">No posts yet to show performance.</p>
      ) : (
        <div className="space-y-2">
          {[
            { type: "Photos", count: photoCount, percent: `${photoPercent}%` },
            { type: "Videos", count: videoCount, percent: `${videoPercent}%` },
          ].map((item) => (
            <div key={item.type}>
              <div className="mb-1 flex items-center justify-between text-[11px] text-zinc-400">
                <span>{item.type}</span>
                <span>{item.count} · {item.percent}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400" style={{ width: item.percent }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}

                  {/* ── SUB: PRIVACYLOCK (fully expanded per master table) ── */}
                  {settingsPanel === "PrivacyLock" && (
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/30">
                        <div>
                          <div className="text-sm font-semibold">Private account</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">Only approved followers can see your content</div>
                        </div>
                        <Switch checked={accountPrivate} onCheckedChange={setAccountPrivate} />
                      </div>
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400">
                        {accountPrivate ? "🔒 Your account is private. New followers must be approved." : "🌐 Your account is public. Anyone can see your posts."}
                      </div>

                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Who can follow me</p>
                        {(["Everyone", "Approval"] as const).map((opt) => (
                          <OptionRow key={opt} label={opt} selected={whoCanFollow === opt} onClick={() => setWhoCanFollow(opt)} />
                        ))}
                      </div>

                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Who can see my posts</p>
                        {(["Everyone", "Followers"] as const).map((opt) => (
                          <OptionRow key={opt} label={opt} selected={whoCanSeePosts === opt} onClick={() => setWhoCanSeePosts(opt)} />
                        ))}
                      </div>

                      <ToggleRow icon={Activity} label="Activity Status" sub="Online-status visibility" checked={activityStatus} onCheckedChange={setActivityStatus} />
                      <ToggleRow icon={CheckCheckIconPlaceholder} label="Read Receipts" sub="Message read status" checked={readReceipts} onCheckedChange={setReadReceipts} />
                      <ToggleRow icon={Smartphone} label="Find Me by Phone" sub="Phone discoverability" checked={findByPhone} onCheckedChange={setFindByPhone} />
                      <ToggleRow icon={AtSign} label="Find Me by Email" sub="Email discoverability" checked={findByEmail} onCheckedChange={setFindByEmail} />
                    </div>
                  )}

                  {/* ── SUB: MESSAGES ── */}
                  {settingsPanel === "Messages and story replies" && (
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/30">
                        <div>
                          <div className="text-sm font-semibold">Allow messages</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">People can send you direct messages</div>
                        </div>
                        <Switch checked={allowMessages} onCheckedChange={setAllowMessages} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Message requests from</p>
                        {["Everyone", "Followers only", "No one"].map((opt) => (
                          <button key={opt} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                            <span className="text-sm">{opt}</span>
                            {opt === "Everyone" && <div className="w-2 h-2 rounded-full bg-pink-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── SUB: COMMENTS ── */}
                  {settingsPanel === "Comments" && (
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/30">
                        <div>
                          <div className="text-sm font-semibold">Allow comments</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">People can comment on your posts</div>
                        </div>
                        <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Who can comment</p>
                        {["Everyone", "People you follow", "Your followers", "No one"].map((opt) => (
                          <button key={opt} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                            <span className="text-sm">{opt}</span>
                            {opt === "Everyone" && <div className="w-2 h-2 rounded-full bg-pink-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── SUB: TAGS ── */}
                  {settingsPanel === "Tags and mentions" && (
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/30">
                        <div>
                          <div className="text-sm font-semibold">Allow tagging</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">People can tag you in posts and stories</div>
                        </div>
                        <Switch checked={allowTags} onCheckedChange={setAllowTags} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Who can tag you</p>
                        {["Everyone", "People you follow", "No one"].map((opt) => (
                          <button key={opt} className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors">
                            <span className="text-sm">{opt}</span>
                            {opt === "Everyone" && <div className="w-2 h-2 rounded-full bg-pink-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── SUB: NOTIFICATIONS (new, from master table) ── */}
                  {settingsPanel === "Notifications" && (
                    <div className="p-5 space-y-3">
                      <ToggleRow icon={Bell} label="Push Notifications" sub="Master notification control" checked={pushEnabled} onCheckedChange={setPushEnabled} />
                      <ToggleRow icon={MessageSquare} label="Messages" sub="DM alerts" checked={notifyMessages} onCheckedChange={setNotifyMessages} />
                      <ToggleRow icon={Users} label="Friend Requests" sub="Request alerts" checked={notifyRequests} onCheckedChange={setNotifyRequests} />
                      <ToggleRow icon={Heart} label="Likes" sub="Like alerts" checked={notifyLikes} onCheckedChange={setNotifyLikes} />
                      <ToggleRow icon={MessageCircle} label="Comments" sub="Comment alerts" checked={notifyComments} onCheckedChange={setNotifyComments} />
                      <ToggleRow icon={AtSign} label="Mentions & Tags" sub="Mention/tag alerts" checked={notifyMentions} onCheckedChange={setNotifyMentions} />
                      <ToggleRow icon={UserCircle2} label="New Followers" sub="Follower alerts" checked={notifyFollowers} onCheckedChange={setNotifyFollowers} />
                      <ToggleRow icon={Moon} label="Quiet Mode" sub="Temporarily silence alerts" checked={quietMode} onCheckedChange={setQuietMode} />
                    </div>
                  )}

                  {/* ── SUB: ACCOUNT (new) ── */}
                  {settingsPanel === "Account" && (
                    <div className="p-5 space-y-3">
                      <SettingRow icon={Pencil} label="Edit Profile" sub="Profile information" onClick={() => { setSettingsPanel(null); openEditProfile(); }} />
                      <SettingRow icon={AtSign} label="Username" sub={`@${(user as any)?.username || "not set"}`} onClick={() => { setSettingsPanel(null); openEditProfile(); }} />
                      <SettingRow icon={MessageSquare} label="Email" sub={(user as any)?.email || "Change email address"} />
                      <SettingRow icon={Smartphone} label="Phone Number" sub="Change phone number" />
                      <SettingRow icon={KeyRound} label="Password" sub="Change account password" />
                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Account Type</p>
                        {(["Personal", "Professional"] as const).map((opt) => (
                          <OptionRow key={opt} label={opt} selected={accountType === opt} onClick={() => setAccountType(opt)} />
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <button className="w-full h-10 rounded-xl border border-yellow-500/30 text-yellow-400 text-sm font-semibold hover:bg-yellow-500/10 transition-colors">
                        Deactivate Account
                      </button>
                      <button
                        onClick={() => { setSettingsPanel(null); setRemoveAccountOpen(true); }}
                        className="w-full h-10 rounded-xl border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors"
                      >
                        Delete Account
                      </button>
                    </div>
                  )}

                  {/* ── SUB: SECURITY (new) ── */}
                  {settingsPanel === "Security" && (
                    <div className="p-5 space-y-3">
                      <SettingRow icon={KeyRound} label="Change Password" sub="Password management" onClick={() => setSettingsPanel("ChangePassword")} />
                      <ToggleRow icon={Fingerprint} label="2FA" sub="Extra login security" checked={twoFA} onCheckedChange={setTwoFA} />
                      <SettingRow icon={HistoryIcon} label="Login Activity" sub="View recent logins" onClick={() => setSettingsPanel("LoginActivity")} />
                      <SettingRow icon={Smartphone} label="Devices" sub="Manage logged-in devices" onClick={() => setSettingsPanel("Devices")} />
                      <ToggleRow icon={ShieldAlert} label="Login Alerts" sub="New/suspicious login alerts" checked={loginAlerts} onCheckedChange={setLoginAlerts} />
                    </div>
                  )}

                  {settingsPanel === "ChangePassword" && (
                    <div className="p-5 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Current password</Label>
                        <input
                          type="password"
                          value={currentPasswordInput}
                          onChange={(e) => setCurrentPasswordInput(e.target.value)}
                          className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">New password</Label>
                        <input
                          type="password"
                          value={newPasswordInput}
                          onChange={(e) => setNewPasswordInput(e.target.value)}
                          className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Confirm new password</Label>
                        <input
                          type="password"
                          value={confirmPasswordInput}
                          onChange={(e) => setConfirmPasswordInput(e.target.value)}
                          className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={
                          changePasswordMutation.isPending ||
                          !currentPasswordInput ||
                          newPasswordInput.length < 6 ||
                          newPasswordInput !== confirmPasswordInput
                        }
                        onClick={() => changePasswordMutation.mutate()}
                      >
                        {changePasswordMutation.isPending ? "Updating..." : "Update password"}
                      </Button>
                      {newPasswordInput && newPasswordInput !== confirmPasswordInput && (
                        <p className="text-xs text-destructive">Passwords do not match.</p>
                      )}
                    </div>
                  )}

                  {(settingsPanel === "Devices" || settingsPanel === "LoginActivity") && (
                    <div className="p-5 space-y-3">
                      {sessionsLoading && (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      )}
                      {!sessionsLoading && loginSessions.length === 0 && (
                        <p className="text-sm text-muted-foreground">No login sessions found.</p>
                      )}
                      {loginSessions.map((s: any) => (
                        <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{s.deviceInfo || "Unknown device"}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.location || s.ipAddress || "Unknown location"} · {formatDistanceToNow(new Date(s.lastActive), { addSuffix: true })}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={revokeSessionMutation.isPending}
                            onClick={() => revokeSessionMutation.mutate(s.id)}
                          >
                            Sign out
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── SUB: APPEARANCE (new) ── */}
                  {settingsPanel === "Appearance" && (
                    <div className="p-5 space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Theme</p>
                        {([
                          { key: "Dark", icon: Moon },
                          { key: "Light", icon: Sun },
                          { key: "System", icon: Monitor },
                        ] as const).map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setTheme(opt.key)}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                          >
                            <span className="flex items-center gap-2 text-sm"><opt.icon className="w-3.5 h-3.5" /> {opt.key}</span>
                            {theme === opt.key && <div className="w-2 h-2 rounded-full bg-pink-400" />}
                          </button>
                        ))}
                      </div>
                      <div className="space-y-1 pt-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 pb-1">Font Size</p>
                        {(["Small", "Default", "Large"] as const).map((opt) => (
                          <OptionRow key={opt} label={opt} selected={fontSize === opt} onClick={() => setFontSize(opt)} />
                        ))}
                      </div>
                      <ToggleRow icon={Sparkles} label="Reduce Motion" sub="Reduce animations" checked={reduceMotion} onCheckedChange={setReduceMotion} />
                    </div>
                  )}

                  {/* ── SUB: ADS PREFERENCES (new panel, real content) ── */}
                  {settingsPanel === "AdsPrefs" && (
                    <div className="p-5 space-y-3">
                      <ToggleRow icon={Megaphone} label="Personalized Ads" sub="Interest-based advertising" checked={true} onCheckedChange={() => {}} />
                      <SettingRow icon={Grid} label="Ad Topics" sub="Manage preferred ad categories" onClick={() => setSettingsPanel("AdTopics")} />
                      <SettingRow icon={EyeOff} label="Hide Advertiser" sub="Hide unwanted advertisers" onClick={() => setSettingsPanel("HideAdvertiser")} />
                      <SettingRow icon={HelpCircle} label="Why This Ad?" sub="Ad explanation" />
                      <SettingRow
                        icon={RefreshCw}
                        label="Reset Ad Preferences"
                        sub="Reset ad personalization"
                        onClick={() => resetAdPrefsMutation.mutate()}
                      />
                    </div>
                  )}

                  {settingsPanel === "AdTopics" && (
                    <div className="p-5 space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={newAdTopicInput}
                          onChange={(e) => setNewAdTopicInput(e.target.value)}
                          placeholder="e.g. Fashion, Sports, Tech"
                          className="flex-1 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
                        />
                        <Button
                          size="sm"
                          disabled={!newAdTopicInput.trim() || addAdPrefMutation.isPending}
                          onClick={() => {
                            addAdPrefMutation.mutate({ type: "topic", value: newAdTopicInput.trim() });
                            setNewAdTopicInput("");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {adPrefs.filter((p: any) => p.type === "topic").map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-2">
                            <span className="text-sm">{p.value}</span>
                            <Button size="sm" variant="ghost" onClick={() => removeAdPrefMutation.mutate(p.id)}>Remove</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {settingsPanel === "HideAdvertiser" && (
                    <div className="p-5 space-y-3">
                      <div className="flex gap-2">
                        <input
                          value={newHiddenAdvertiserInput}
                          onChange={(e) => setNewHiddenAdvertiserInput(e.target.value)}
                          placeholder="Advertiser name"
                          className="flex-1 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm"
                        />
                        <Button
                          size="sm"
                          disabled={!newHiddenAdvertiserInput.trim() || addAdPrefMutation.isPending}
                          onClick={() => {
                            addAdPrefMutation.mutate({ type: "advertiser", value: newHiddenAdvertiserInput.trim() });
                            setNewHiddenAdvertiserInput("");
                          }}
                        >
                          Hide
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {adPrefs.filter((p: any) => p.type === "advertiser").map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/40 px-4 py-2">
                            <span className="text-sm">{p.value}</span>
                            <Button size="sm" variant="ghost" onClick={() => removeAdPrefMutation.mutate(p.id)}>Unhide</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── SUB: LANGUAGE (new panel) ── */}
                  {settingsPanel === "LanguagePrefs" && (
                    <div className="p-5 space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">{t("settings.language")}</Label>
                            <p className="text-[11px] text-muted-foreground">{t("settings.language.desc")}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => setLanguage("en")}
                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${language === "en" ? "bg-white text-black" : "bg-black/30 text-zinc-300"}`}
                          >
                            {t("common.english")}
                          </button>
                          <button
                            onClick={() => setLanguage("hi")}
                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${language === "hi" ? "bg-white text-black" : "bg-black/30 text-zinc-300"}`}
                          >
                            {t("common.hindi")}
                          </button>
                        </div>
                      </div>
                      <SettingRow icon={FileText} label="Content Languages" sub="Preferred content languages" />
                      <ToggleRow icon={Languages} label="Auto Translation" sub="Translate content automatically" checked={true} onCheckedChange={() => {}} />
                    </div>
                  )}

                  {/* ── SUB: HELP & SAFETY (new panel) ── */}
                  {settingsPanel === "HelpSafety" && (
                    <div className="p-5 space-y-3">
                      <SettingRow icon={HelpCircle} label="Help Center" sub="Help articles" onClick={() => window.open("mailto:IQPartneroffical00@gmail.com")} />
                      <SettingRow icon={Flag} label="Report a Problem" sub="Technical issues" onClick={() => window.open("mailto:IQPartneroffical00@gmail.com")} />
                      <SettingRow icon={UserX} label="Report Account" sub="Report a user" />
                      <SettingRow icon={Flag} label="Report Content" sub="Report post/reel" />
                      <SettingRow icon={ShieldCheck} label="Safety Center" sub="Safety information" />
                      <SettingRow icon={MessageSquare} label="Contact Support" sub="Get in touch" onClick={() => window.open("mailto:IQPartneroffical00@gmail.com")} />
                    </div>
                  )}

                  {/* ── SUB: BLOCKED ── */}
                  {settingsPanel === "BlockShield" && (
                    <div className="p-5 space-y-3">
                      <p className="text-[11px] text-muted-foreground">Blocked accounts can't see your content or interact with you. Manage your full list from the ☰ menu → Blocked Accounts.</p>
                      <button
                        onClick={() => { setSettingsPanel(null); setBlockedDialogOpen(true); }}
                        className="w-full h-10 rounded-xl border border-white/15 text-sm font-semibold hover:bg-white/5 transition-colors"
                      >
                        Open Blocked Accounts
                      </button>
                      <SettingRow icon={UserX} label="Restricted Accounts" sub="Limit interactions" />
                      <SettingRow icon={Grid} label="Hidden Words" sub="Filter specific words" />
                      <ToggleRow icon={MessageCircle} label="Comment Filtering" sub="Filter unwanted comments" checked={true} onCheckedChange={() => {}} />
                      <ToggleRow icon={MessageSquare} label="Message Filtering" sub="Filter message requests" checked={true} onCheckedChange={() => {}} />
                      <SettingRow icon={AtSign} label="Mention & Tag Control" sub="Control unwanted tags" />
                    </div>
                  )}

                  {/* ── SUB: CLOSE FRIENDS (InnerCircle) ── */}
                  {settingsPanel === "InnerCircle" && (
                    <div className="p-5 space-y-3">
                      <p className="text-[11px] text-muted-foreground">Your close friends list is only visible to you.</p>
                      {["Alice Wonder", "Bob Builder", "Carol Smith", "Dave Jones"].map((name) => (
                        <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xs font-bold text-white">
                              {name[0]}
                            </div>
                            <span className="text-sm font-medium">{name}</span>
                          </div>
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                        </div>
                      ))}
                      <button className="w-full h-10 rounded-xl border border-dashed border-white/20 text-[12px] text-muted-foreground hover:bg-white/5 transition-colors">
                        + Add more friends
                      </button>
                      <ToggleRow icon={Bell} label="Circle Notifications" sub="Circle activity alerts" checked={true} onCheckedChange={() => {}} />
                    </div>
                  )}

                  {/* ── SUB: SHARESYNC (expanded per master table) ── */}
                  {settingsPanel === "ShareSync" && (
                    <div className="p-5 space-y-3">
                      <ToggleRow icon={Share2} label="Post Sharing" sub="Allow post sharing" checked={postSharing} onCheckedChange={setPostSharing} />
                      <ToggleRow icon={Share2} label="Story Sharing" sub="Allow story sharing" checked={storySharing} onCheckedChange={setStorySharing} />
                      <ToggleRow icon={Video} label="Reel Sharing" sub="Allow reel sharing" checked={reelSharing} onCheckedChange={setReelSharing} />
                      <ToggleRow icon={DownloadIcon} label="Downloads" sub="Allow downloads" checked={allowDownloads} onCheckedChange={setAllowDownloads} />
                      <ToggleRow icon={Repeat2} label="Remix" sub="Allow remixing" checked={allowRemix} onCheckedChange={setAllowRemix} />
                      <ToggleRow icon={LinkIcon} label="External Sharing" sub="Sharing outside LITLink" checked={externalSharing} onCheckedChange={setExternalSharing} />
                      <ToggleRow icon={Copy} label="Copy Link" sub="Allow link copying" checked={allowCopyLink} onCheckedChange={setAllowCopyLink} />
                    </div>
                  )}

                  {/* ── SUB: GHOSTVIEW (expanded per master table) ── */}
                  {settingsPanel === "GhostView" && (
                    <div className="p-5 space-y-3">
                      <ToggleRow icon={Activity} label="Activity Visibility" sub="Activity visibility" checked={activityVisibility} onCheckedChange={setActivityVisibility} />
                      <ToggleRow icon={Users} label="Profile Visit Visibility" sub="Profile-visit visibility" checked={profileVisitVisibility} onCheckedChange={setProfileVisitVisibility} />
                      <ToggleRow icon={EyeOff} label="Story Viewing Privacy" sub="Story-view visibility" checked={storyViewPrivacy} onCheckedChange={setStoryViewPrivacy} />
                      <ToggleRow icon={Grid} label="Search Visibility" sub="Search/suggestion visibility" checked={searchVisibility} onCheckedChange={setSearchVisibility} />
                    </div>
                  )}

                  {/* ── SUB: FRIENDPULSE (expanded per master table) ── */}
                  {settingsPanel === "FriendPulse" && (
                    <div className="p-5 space-y-3">
                      <ToggleRow icon={Users} label="Friend Requests" sub="Request notifications" checked={pulseRequests} onCheckedChange={setPulseRequests} />
                      <ToggleRow icon={Grid} label="Friend Posts" sub="Friend-post notifications" checked={pulsePosts} onCheckedChange={setPulsePosts} />
                      <ToggleRow icon={CalendarClock} label="Friend Stories" sub="Story notifications" checked={pulseStories} onCheckedChange={setPulseStories} />
                      <ToggleRow icon={Video} label="Friend Reels" sub="Reel notifications" checked={pulseReels} onCheckedChange={setPulseReels} />
                      <ToggleRow icon={AtSign} label="Friend Mentions" sub="Mention notifications" checked={pulseMentions} onCheckedChange={setPulseMentions} />
                    </div>
                  )}

                  {/* ── SUB: PROTOOLS HUB (expanded per master table) ── */}
                  {settingsPanel === "ProTools Hub" && (
                    <div className="p-5 space-y-3">
                      <SettingRow icon={FileText} label="Drafts" sub="Manage saved content" />
                      <SettingRow icon={CalendarClock} label="Schedule Content" sub="Publish content later" />
                      <SettingRow icon={FolderCog} label="Content Management" sub="Archive / delete published content" />
                      <SettingRow icon={Wrench} label="Creator Tools" sub="Professional tools" />
                      <SettingRow icon={LineChart} label="Advanced Insights" sub="Detailed analytics" />
                      <ToggleRow icon={Bell} label="Schedule Reminders" sub="Get notified before scheduled posts go live" checked={autoScheduleReminders} onCheckedChange={setAutoScheduleReminders} />
                    </div>
                  )}

                  {/* ── SUB: ADPAY CENTER — real coin balance, earnings, withdraw ── */}
                  {settingsPanel === "AdPay Center" && (
                    <div className="p-5 space-y-4">
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">Coin Balance</p>
                          <div className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">● Live</div>
                        </div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl">💰</span>
                          <p className="text-2xl font-black text-white">{(coinData?.balance ?? 0).toLocaleString()}</p>
                          <span className="text-[11px] text-zinc-500">coins</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          ≈ ₹{((coinData?.balance ?? 0) / COINS_PER_RUPEE).toFixed(2)} · from gifts sent to you
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Total Earned</p>
                          <p className="mt-1 text-lg font-black text-white">{(earningsData?.totalEarnedCoins ?? 0).toLocaleString()}</p>
                          <p className="text-[10px] text-zinc-600">coins lifetime</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Gifts Received</p>
                          <p className="mt-1 text-lg font-black text-white">
                            {(earningsData?.gifts ?? []).reduce((s: number, g: any) => s + Number(g.count ?? 0), 0)}
                          </p>
                          <p className="text-[10px] text-zinc-600">total gifts</p>
                        </div>
                      </div>

                      {earningsData?.gifts && earningsData.gifts.length > 0 && (
                        <div className="rounded-xl border border-white/10 bg-zinc-900/70 p-3 space-y-2">
                          <p className="text-sm font-semibold text-white mb-1">Gift breakdown</p>
                          {earningsData.gifts.map((g: any) => (
                            <div key={g.name} className="flex items-center justify-between text-[12px]">
                              <span className="text-zinc-300">{g.icon} {g.name} × {g.count}</span>
                              <span className="text-emerald-400 font-semibold">+{g.total_coins}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => setSettingsPanel("Withdraw")}
                        className="w-full h-11 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
                        style={{ background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 0 15px rgba(16,185,129,0.3)" }}
                      >
                        <DollarSign className="w-4 h-4" /> Withdraw Earnings
                      </button>

                      <SettingRow
                        icon={HistoryIcon}
                        label="Transactions"
                        sub={`${withdrawals.length} request${withdrawals.length === 1 ? "" : "s"}`}
                        onClick={() => setSettingsPanel("Withdraw")}
                      />
                    </div>
                  )}

                  {/* ── SUB: WITHDRAW — disabled, policy: no manual payout flow ── */}
                  {settingsPanel === "Withdraw" && (
                    <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                        <DollarSign className="w-7 h-7 text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-white">Upcoming Feature</p>
                      <p className="text-[12px] text-zinc-500 max-w-[240px]">
                        Withdrawals are coming soon. We're setting this up properly — check back later.
                      </p>
                    </div>
                  )}

                  {/* ── SUB: SHARING (own separate box → merged into ShareSync per your requested structure, kept for back-compat) ── */}
                  {settingsPanel === "Sharing and reuse" && (
                    <div className="p-5 space-y-3">
                      <p className="text-[11px] text-muted-foreground">Sharing permissions now live under Privacy → ShareSync.</p>
                      <button
                        onClick={() => setSettingsPanel("ShareSync")}
                        className="w-full h-10 rounded-xl border border-white/15 text-sm font-semibold hover:bg-white/5 transition-colors"
                      >
                        Open ShareSync
                      </button>
                    </div>
                  )}

                  {/* ── SUB: VERIFYPLUS ── */}
                  {settingsPanel === "VerifyPlus" && (
                    <div className="p-5 space-y-4">
                      <div className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 text-center">
                        <BadgeCheck className="w-12 h-12 text-purple-400" />
                        <div className="font-bold text-lg">VerifyPlus ✔️</div>
                        <div className="text-[12px] text-muted-foreground">Your account is verified. Enjoy enhanced visibility and exclusive creator features.</div>
                      </div>
                      {[
                        { label: "Blue checkmark", desc: "Shown on your profile and posts" },
                        { label: "Priority support", desc: "Faster response from our team" },
                        { label: "Exclusive tools", desc: "Advanced analytics and monetization" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                          <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                          <div>
                            <div className="text-sm font-medium">{item.label}</div>
                            <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </ScrollAreaUI>
              </DialogContent>
            </Dialog>
            )}

            {/* ☰ Menu — own profile: Share Profile / Blocked Accounts / Remove Account */}
            {!params.id && (
              <div className="relative">
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-8 h-8 rounded-full text-pink-400 hover:bg-pink-400/10"
                  onClick={() => setOwnMenuOpen((v) => !v)}
                  data-testid="button-own-menu"
                >
                  <Menu className="w-4 h-4" />
                </Button>
                <DropdownMenu
                  open={ownMenuOpen}
                  onClose={() => setOwnMenuOpen(false)}
                  items={[
                    {
                      icon: LinkIcon,
                      label: "Share Profile",
                      onClick: () => shareProfile((user as any)?.username || user?.firstName || String(user?.id), toast),
                    },
                    {
                      icon: UserX,
                      label: "Blocked Accounts",
                      onClick: () => setBlockedDialogOpen(true),
                    },
                    {
                      icon: Trash2,
                      label: "Remove Account",
                      onClick: () => setRemoveAccountOpen(true),
                      danger: true,
                    },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

      {/* Rank badge top-center — tap to buy coins */}
        <button
          onClick={() => navigate("/buy-coins")}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border active:scale-95 transition-transform"
          style={{ top: "var(--header-total)", borderColor: rankColor, color: rankColor, background: `${rankColor}18`, boxShadow: `0 0 12px ${rankColor}40` }}
          data-testid="button-buy-coins-rank"
        >
          <Crown className="w-3 h-3" />
          {rank}
        </button>
      <button
          onClick={() => navigate("/buy-coins")}
          className="absolute right-3 flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/40 rounded-full px-2 py-1 text-[10px] font-black text-yellow-200 active:scale-95 transition-transform"
          style={{ top: "calc(var(--header-total) + 32px)" }}
          data-testid="button-buy-coins-wallet"
        >
          <span>💰</span>
          {coinData?.balance ?? currentProfileUser?.coins ?? 0}
        </button>
      </div>

      <BlockedAccountsDialog open={blockedDialogOpen} onOpenChange={setBlockedDialogOpen} />
      <RemoveAccountDialog open={removeAccountOpen} onOpenChange={setRemoveAccountOpen} />

      {/* ══ AVATAR CARD (overlapping banner) ══ */}
      <div className="relative z-10 -mt-16 px-4">
        <div className="relative rounded-2xl overflow-hidden border border-white/10"
          style={{
            background: "linear-gradient(145deg, rgba(15,15,30,0.97) 0%, rgba(10,10,20,0.99) 100%)",
            boxShadow: "0 0 40px rgba(96,165,250,0.15), 0 0 80px rgba(168,85,247,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}>

          {/* Corner decorators */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-pink-500/60 rounded-tl-2xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-purple-500/60 rounded-tr-2xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-pink-500/60 rounded-bl-2xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-purple-500/60 rounded-br-2xl" />

          <div className="p-4 pt-5">
            {/* Avatar + name row */}
            <div className="flex items-start gap-4">
              {/* Round avatar with glow ring — smart gender-based default when no photo uploaded */}
              <div className="relative shrink-0">
                <div className="w-[72px] h-[72px] rounded-full p-[3px] relative"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #db2777, #db2777, #7c3aed)",
                    backgroundSize: "300% 300%",
                    animation: "gradientShift 3s ease infinite",
                    boxShadow: "0 0 20px rgba(124,58,237,0.6), 0 0 40px rgba(219,39,119,0.3)",
                  }}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-black">
                    <Avatar className="w-full h-full rounded-full">
                      <AvatarImage src={ownAvatarSrc} className="rounded-full object-cover" />
                      <AvatarFallback className="text-2xl rounded-full bg-gradient-to-br from-purple-900 to-pink-900">
                        {currentProfileUser?.firstName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                {/* Pet overlay */}
                {selectedPet && (
                  <div className="absolute -top-3 -right-3 text-xl animate-bounce bg-black rounded-full p-0.5 border border-white/20">
                    {selectedPet.emoji}
                  </div>
                )}
                {/* Online indicator */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-black shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
              </div>

              {/* Name + level + bio */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-black text-base tracking-wide text-white">
                    {user?.firstName?.toUpperCase()} {user?.lastName?.toUpperCase()}
                  </h2>
                  <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full px-2 py-0.5 shrink-0"
                    style={{ boxShadow: "0 0 8px rgba(234,179,8,0.3)" }}>
                    <Zap className="w-2.5 h-2.5 text-yellow-400" />
                    <span className="text-[9px] font-black text-yellow-400">LV.{level}</span>
                  </div>
                </div>
                <p className="text-[11px] text-pink-400/70 font-mono mt-0.5">@{currentProfileUser?.username ?? `${currentProfileUser?.firstName?.toLowerCase()}_litlink`}</p>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  {currentProfileUser?.bio || "📸 Digital Creator · Content Warrior"}
                </p>
              </div>
            </div>

            {/* XP Progress bar - only for own profile */}
            {!params.id && (
              <div className="mt-4 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest font-mono">XP Progress · LV.{level} → LV.{level + 1}</span>
                  <span className="text-[9px] font-mono text-zinc-400">{xp} / {xpMax} XP</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full rounded-full relative overflow-hidden"
                    style={{
                      width: `${Math.min((xp / xpMax) * 100, 100)}%`,
                      background: "linear-gradient(90deg, #7c3aed, #db2777, #ec4899)",
                      boxShadow: "0 0 8px rgba(236,72,153,0.8)",
                      transition: "width 1.2s ease",
                    }}>
                    <div className="absolute inset-0 opacity-40"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", animation: "shimmer 2s linear infinite" }} />
                  </div>
                </div>
                {/* XP Breakdown */}
                {xpData && (
                  <div className="grid grid-cols-4 gap-1 mt-2">
                    {[
                      { label: "Posts", value: xpData.breakdown.posts, icon: "📸" },
                      { label: "Likes", value: xpData.breakdown.likesReceived, icon: "❤️" },
                      { label: "Comments", value: xpData.breakdown.commentsReceived, icon: "💬" },
                      { label: "Activity", value: xpData.breakdown.commentsMade, icon: "⚡" },
                    ].map(b => (
                      <div key={b.label} className="rounded-lg p-1.5 text-center bg-white/3 border border-white/5">
                        <div className="text-[10px]">{b.icon}</div>
                        <div className="text-[9px] font-black text-pink-400">+{b.value}</div>
                        <div className="text-[7px] text-zinc-600 leading-tight">{b.label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[9px] text-zinc-600 text-center pt-0.5">Total XP: {xpData?.totalXP?.toLocaleString() ?? 0}</p>
              </div>
            )}

            {/* Stats: Posts / Followers / Following */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { value: fmtN(currentStats?.postsCount ?? myPosts.length), label: "POSTS", color: "#c084fc", glow: "rgba(192,132,252,0.3)" },
                { value: fmtN(currentStats?.followersCount), label: "CREW", color: "#34d399", glow: "rgba(52,211,153,0.3)" },
                { value: fmtN(currentStats?.followingCount), label: "ALLIES", color: "#fb923c", glow: "rgba(251,146,60,0.3)" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl py-2.5 text-center border border-white/5 relative overflow-hidden"
                  style={{ background: `${s.glow.replace("0.3", "0.08")}`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)` }}>
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.color}60, transparent)` }} />
                  <div className="font-black text-lg leading-none" style={{ color: s.color, textShadow: `0 0 12px ${s.color}` }}>
                    {s.value}
                  </div>
                  <div className="text-[8px] font-black text-zinc-500 tracking-widest mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ══ ACHIEVEMENTS ══ */}
      <div className="px-4 mt-3">
        <div className="flex items-center gap-2 mb-2">
          <Trophy className="w-3 h-3 text-yellow-400" />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 font-mono">Achievements Unlocked</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {ACHIEVEMENTS.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.label} className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center border border-white/10 relative"
                  style={{ background: `${a.color}15`, boxShadow: `0 0 12px ${a.color}30` }}>
                  <div className="absolute inset-0 rounded-xl opacity-20"
                    style={{ background: `radial-gradient(circle at center, ${a.color}, transparent 70%)` }} />
                  <Icon className="w-5 h-5 relative z-10" style={{ color: a.color, filter: `drop-shadow(0 0 4px ${a.color})` }} />
                </div>
                <span className="text-[7px] text-zinc-500 font-bold text-center">{a.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ ACTION BUTTONS ══ */}
      {!params.id && (
        <div className="px-4 mt-3 flex gap-2">
        <button onClick={openEditProfile}
          className="flex-1 h-10 rounded-xl font-black text-[11px] uppercase tracking-widest relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(37,99,235,0.3))",
            border: "1px solid rgba(124,58,237,0.5)",
            boxShadow: "0 0 15px rgba(124,58,237,0.2)",
          }}
          data-testid="button-edit-profile">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.5), rgba(37,99,235,0.5))" }} />
          <span className="relative z-10 text-purple-300">⚙ Edit Profile</span>
        </button>

        <Dialog>
          <DialogTrigger asChild>
            <button className="flex-1 h-10 rounded-xl font-black text-[11px] uppercase tracking-widest relative overflow-hidden group"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.3))",
                border: "1px solid rgba(52,211,153,0.5)",
                boxShadow: "0 0 15px rgba(52,211,153,0.2)",
              }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.5), rgba(5,150,105,0.5))" }} />
              <span className="relative z-10 text-emerald-300">🐾 Own Pet</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-center font-display text-xl">Select Your 3D Pet</DialogTitle>
              <DialogDescription className="sr-only">Choose a pet avatar.</DialogDescription>
            </DialogHeader>
            <ScrollAreaUI className="h-[300px] mt-4">
              <div className="grid grid-cols-4 gap-2 p-1">
                {PETS.map((pet) => (
                  <button key={pet.name}
                    onClick={() => setSelectedPet(pet)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border transition-all ${selectedPet?.name === pet.name ? "border-primary bg-primary/20" : "border-white/10 hover:border-white/30"}`}>
                    <span className="text-2xl">{pet.emoji}</span>
                    <span className="text-[8px] font-bold text-center">{pet.name}</span>
                  </button>
                ))}
              </div>
            </ScrollAreaUI>
            <div className="flex gap-2 mt-4">
              <Button className="flex-1" onClick={async () => {
                try {
                  await apiRequest("PATCH", "/api/profile", { pet: selectedPet ? JSON.stringify(selectedPet) : null });
                  toast({ title: "Pet updated!" });
                  qc.invalidateQueries({ queryKey: ["/api/profile"] });
                   qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
                } catch (err: any) {
                  toast({ title: "Failed to update pet", description: err.message, variant: "destructive" });
                }
              }}>
                Save Pet
              </Button>
              {selectedPet && (
                <Button variant="ghost" onClick={() => setSelectedPet(null)}>Remove</Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <button className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
          <Cpu className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
      )}

      {/* ══ CONTENT TABS ══ */}
      <div className="mt-4">
        <Tabs defaultValue="posts">
          <TabsList className="w-full grid grid-cols-4 h-10 bg-transparent border-b border-white/5 rounded-none px-4">
            {[
              { value: "posts", icon: Grid, label: "POSTS" },
              { value: "books", icon: Users, label: "OWN BOOKS" },
              { value: "saved", icon: Bookmark, label: "SAVED" },
              { value: "history", icon: HistoryIcon, label: "LOG" },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger key={value} value={value}
                className="flex flex-col gap-0.5 rounded-none border-b-2 border-transparent data-[state=active]:border-pink-400 data-[state=active]:text-pink-400 data-[state=active]:shadow-none text-zinc-600 transition-colors h-10"
              >
                <Icon className="w-4 h-4" />
                <span className="text-[7px] font-black tracking-widest hidden">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            {myPosts.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-4xl mb-3">🎮</div>
                <p className="text-zinc-600 text-sm font-mono">NO CONTENT UPLOADED</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {myPosts.map((post) => (
                  <button
                    key={post.id}
                    className="aspect-square bg-zinc-900 relative group cursor-pointer overflow-hidden text-left w-full"
                    onClick={() => setViewingMyPost(post)}
                    data-testid={`my-post-thumb-${post.id}`}
                  >
                    {post.imageUrl && !String(post.imageUrl).startsWith("blob:") ? (
                      <img src={post.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360}, 40%, 14%), hsl(${(post.id * 47 + 120) % 360}, 50%, 20%))` }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 border border-pink-500/0 group-hover:border-pink-500/40 transition-colors" />
                    {(post.type === "video" || post.type === "reel") && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded bg-black/60 flex items-center justify-center">
                        <span className="text-[7px] text-white">▶</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="books" className="py-6">
            {booksLoading ? (
              <div className="grid grid-cols-3 gap-0.5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="aspect-square bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : profileBooksArray.length === 0 ? (
              <div className="py-20 text-center">
                <div className="text-4xl mb-3">📚</div>
                <p className="text-zinc-600 text-sm font-mono">NO BOOKS YET</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 px-3">
                {profileBooksArray.map((book: any) => (
                  <div key={book.id} className="rounded-2xl overflow-hidden border border-white/10 bg-zinc-950 relative group">
                    <button
                      onClick={() => handleDeleteBook(book.id)}
                      className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 border border-white/10 flex items-center justify-center text-white hover:bg-black/80"
                      aria-label="Delete book"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {book.imageUrl ? (
                      <img src={book.imageUrl} alt={book.title} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-violet-900 to-pink-900 flex items-center justify-center text-white text-sm font-bold text-center p-4">
                        {book.title}
                      </div>
                    )}
                    <div className="p-3 space-y-2">
                      <div className="text-sm font-bold text-white line-clamp-2">{book.title}</div>
                      <div className="text-[11px] text-zinc-500">{book.author || "Unknown author"}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

        <TabsContent value="saved" className="mt-0">
  {savedLoading ? (
    <div className="grid grid-cols-3 gap-0.5">
      {Array(6).fill(0).map((_, i) => (
        <div key={i} className="aspect-square bg-zinc-900 animate-pulse" />
      ))}
    </div>
  ) : !savedPostsData || savedPostsData.length === 0 ? (
    <div className="py-20 text-center">
      <div className="text-4xl mb-3">📁</div>
      <p className="text-zinc-600 text-sm font-mono">ARCHIVE EMPTY</p>
    </div>
  ) : (
    <div className="grid grid-cols-3 gap-0.5">
      {savedPostsData.map((post: any) => (
        <button
          key={post.id}
          className="aspect-square bg-zinc-900 relative overflow-hidden text-left w-full"
          onClick={() => setViewingMyPost(post)}
        >
          {post.imageUrl && !String(post.imageUrl).startsWith("blob:") ? (
            <img src={post.imageUrl} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360}, 40%, 14%), hsl(${(post.id * 47 + 120) % 360}, 50%, 20%))` }}
            />
          )}
          {(post.type === "video" || post.type === "reel") && (
            <div className="absolute top-1 right-1 w-4 h-4 rounded bg-black/60 flex items-center justify-center">
              <span className="text-[7px] text-white">▶</span>
            </div>
          )}
        </button>
      ))}
    </div>
  )}
</TabsContent>

          <TabsContent value="history" className="p-4 space-y-2">
            {history && history.length > 0 ? (
              history.slice(0, 20).map((item, i) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/5 relative overflow-hidden group"
                  style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-pink-500/40" />
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                      <HistoryIcon className="w-3 h-3 text-pink-400" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide font-mono">
                        {item.action.replace(/_/g, " ")}
                      </div>
                      <div className="text-[9px] text-zinc-600">{item.metadata || "—"}</div>
                    </div>
                  </div>
                  <div className="text-[9px] text-zinc-600 font-mono shrink-0 ml-2">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-zinc-600 text-sm font-mono">ACTIVITY LOG EMPTY</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ══ EDIT PROFILE DIALOG ══ */}
      {showEditProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <button onClick={() => setShowEditProfile(false)} className="text-sm text-zinc-400 hover:text-white transition-colors">
                Cancel
              </button>
              <h2 className="font-bold text-base">Edit Profile</h2>
              <button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="text-sm font-bold text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50"
                data-testid="button-save-profile">
                {updateProfileMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">
              {/* Avatar picker — round, smart gender-based default when empty */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-violet-500/50"
                    style={{ boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}>
                    <img
                      src={editAvatarUrl || getDefaultAvatar(editGender, editUsername || editFirstName || "me")}
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center border-2 border-zinc-900 hover:bg-violet-500 transition-colors"
                    data-testid="button-change-avatar">
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFile}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
                  Change photo
                </button>
                {editAvatarUrl && (
                  <button
                    onClick={() => setEditAvatarUrl("")}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    Use smart default avatar instead
                  </button>
                )}
              </div>

              {/* Gender — drives which smart default avatar is shown */}
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Avatar Style</Label>
                <div className="flex gap-2">
                  {([
                    { key: "male", label: "Boy" },
                    { key: "female", label: "Girl" },
                    { key: "", label: "Neutral" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setEditGender(opt.key)}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        editGender === opt.key ? "bg-white text-black" : "bg-white/5 text-zinc-300 border border-white/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600">Used for your smart default avatar when no photo is uploaded</p>
              </div>

              {/* Name fields */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">First Name</Label>
                  <div className="relative">
                    <Input
                      value={editFirstName}
                      onChange={e => setEditFirstName(e.target.value)}
                      placeholder="First name"
                      className="bg-white/5 border-white/10 focus:border-violet-500/50 rounded-xl h-11 pl-4 pr-10"
                      data-testid="input-first-name"
                    />
                    <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Last Name</Label>
                  <div className="relative">
                    <Input
                      value={editLastName}
                      onChange={e => setEditLastName(e.target.value)}
                      placeholder="Last name"
                      className="bg-white/5 border-white/10 focus:border-violet-500/50 rounded-xl h-11 pl-4 pr-10"
                      data-testid="input-last-name"
                    />
                    <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Username</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 font-mono text-sm">@</span>
                    <Input
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
                      placeholder="your_handle"
                      className="bg-white/5 border-white/10 focus:border-pink-500/50 rounded-xl h-11 pl-8 pr-10 font-mono text-sm"
                      data-testid="input-username"
                    />
                    <Pencil className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <p className="text-[10px] text-zinc-600">Only letters, numbers, and underscores</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Bio</Label>
                  <Textarea
                    value={editBio}
                    onChange={e => setEditBio(e.target.value)}
                    placeholder="Tell your story..."
                    rows={3}
                    className="bg-white/5 border-white/10 focus:border-violet-500/50 rounded-xl resize-none text-sm"
                    data-testid="input-bio"
                  />
                  <p className="text-[10px] text-zinc-600 text-right">{editBio.length}/150</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 uppercase tracking-wide font-bold">Photo URL (optional)</Label>
                  <Input
                    value={editAvatarUrl}
                    onChange={e => setEditAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-white/5 border-white/10 focus:border-violet-500/50 rounded-xl h-11"
                    data-testid="input-avatar-url"
                  />
                </div>
              </div>

              {/* Save button at bottom */}
              <button
                onClick={handleSaveProfile}
                disabled={updateProfileMutation.isPending}
                className="w-full h-12 rounded-xl font-bold text-sm text-white relative overflow-hidden disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #db2777)",
                  boxShadow: "0 0 20px rgba(124,58,237,0.4)",
                }}>
                {updateProfileMutation.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe styles */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes gridScroll {
          0% { background-position: 0 0; }
          100% { background-position: 32px 32px; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>


      {viewingMyPost && (
        <PostViewerModal
          post={viewingMyPost}
          onClose={() => setViewingMyPost(null)}
          allPosts={myPosts}
        />
      )}
    </div>
  );
}

// Small inline icon placeholder used for "Read Receipts" row (kept separate
// so it doesn't clash with the lucide-react CheckCheck import used elsewhere)
function CheckCheckIconPlaceholder(props: any) {
  return <MessageSquare {...props} />;
}

// Route-aware wrapper: other profiles render without running all of the
// own-profile queries/settings at the same time. This prevents unnecessary
// API/database connections when opening another user's profile.
export default function Profile() {
  const params = useParams<{ id?: string }>();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  if (params.id && String(params.id) !== String(user?.id)) {
    return <OtherUserProfile userId={String(params.id)} />;
  }

  return <OwnProfile />;
}
