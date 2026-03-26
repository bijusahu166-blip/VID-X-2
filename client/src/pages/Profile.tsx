import { BottomNav } from "@/components/layout/BottomNav";
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
  Crown, Cpu, BadgeCheck, BarChart3, Lock
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosts } from "@/hooks/use-posts";
import { useState, useRef } from "react";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Pencil } from "lucide-react";

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

function fmtN(n: number | undefined): string {
  if (n === undefined || n === null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + "K";
  return n.toString();
}

function OtherUserProfile({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user: me } = useAuth();

  const { data: profileData, isLoading } = useQuery<any>({
    queryKey: ["/api/users", userId],
    queryFn: () => fetch(`/api/users/${userId}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: userPosts, isLoading: postsLoading } = useQuery<any[]>({
    queryKey: ["/api/posts", "user", userId],
    queryFn: () => fetch(`/api/posts?userId=${userId}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: followStatus } = useQuery<{ following: boolean }>({
    queryKey: ["/api/users", userId, "follow-status"],
    queryFn: () => fetch(`/api/users/${userId}/follow-status`, { credentials: "include" }).then(r => r.json()),
  });

  const [followLoading, setFollowLoading] = useState(false);
  const isFollowing = followStatus?.following ?? false;
  const [viewingPost, setViewingPost] = useState<any | null>(null);

  const toggleFollow = async () => {
    setFollowLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      await fetch(`/api/users/${userId}/follow`, { method, credentials: "include" });
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

  const [msgLoading, setMsgLoading] = useState(false);
  const startMessage = async () => {
    setMsgLoading(true);
    try {
      await fetch("/api/direct-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ otherUserId: userId }),
      });
      navigate("/messages");
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
  const postCount = userPosts?.length ?? 0;

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 sticky top-0 z-40 bg-black/95 backdrop-blur">
        <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center" data-testid="button-back-profile">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <span className="font-bold text-white">{name}</span>
      </div>

      {/* Cover */}
      <div className="relative">
        <div className="h-36 w-full" style={{ background: "linear-gradient(135deg, #1a0030, #0d001a)" }} />
        <div className="absolute -bottom-10 left-4">
          <div className="w-20 h-20 rounded-full border-4 border-black overflow-hidden bg-zinc-800">
            {u?.profileImageUrl
              ? <img src={u.profileImageUrl} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600 text-2xl font-black text-white">{initials}</div>
            }
          </div>
        </div>
      </div>

      <div className="px-4 pt-14">
        {/* Name + action buttons */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black text-white">{name}</h1>
              {u?.isCelebrity && <span className="text-blue-400 text-sm">✓</span>}
            </div>
            <p className="text-[12px] text-pink-400/70 font-mono mt-0.5">
              @{u?.username || u?.firstName?.toLowerCase() || "user"}
            </p>
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
            {userPosts.map((post: any) => (
              <button
                key={post.id}
                className="aspect-square bg-zinc-900 overflow-hidden relative group text-left"
                onClick={() => setViewingPost(post)}
                data-testid={`post-thumb-${post.id}`}
              >
                {post.imageUrl && !post.imageUrl.startsWith("blob:") ? (
                  <img src={post.imageUrl} alt="" className="w-full h-full object-cover group-active:opacity-80 transition-opacity" />
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

      <BottomNav />

      {viewingPost && (
        <PostViewerModal
          post={viewingPost}
          onClose={() => setViewingPost(null)}
          allPosts={userPosts ?? []}
        />
      )}
    </div>
  );
}

export default function Profile() {
  const params = useParams<{ id?: string }>();
  const { user, logout } = useAuth();

  const { data: posts } = usePosts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedPet, setSelectedPet] = useState<{ name: string; emoji: string } | null>(null);
  const { data: history } = useQuery<any[]>({ queryKey: ["/api/history"] });
  const { data: xpData } = useQuery<{ totalXP: number; xpInLevel: number; xpMax: number; level: number; breakdown: any }>({
    queryKey: ["/api/profile/xp"],
  });
  const { data: myStats } = useQuery<{ followersCount: number; followingCount: number; postsCount: number }>({
    queryKey: ["/api/users", user?.id],
    queryFn: () => fetch(`/api/users/${user?.id}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!user?.id,
  });
  const myPosts = posts?.filter(p => p.userId === user?.id) || [];
  const [settingsPanel, setSettingsPanel] = useState<string | null>(null);
  const [accountPrivate, setAccountPrivate] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [allowTags, setAllowTags] = useState(true);

  // ── Edit Profile ──────────────────────────────────────────────────────────
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [viewingMyPost, setViewingMyPost] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openEditProfile = () => {
    setEditFirstName(user?.firstName || "");
    setEditLastName(user?.lastName || "");
    setEditUsername((user as any)?.username || "");
    setEditBio((user as any)?.bio || "");
    setEditAvatarUrl(user?.profileImageUrl || "");
    setShowEditProfile(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; username?: string; bio?: string; profileImageUrl?: string }) =>
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
    });
  };

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setEditAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

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
        <div className="absolute top-0 left-0 right-0 flex items-center justify-end px-4 pt-14 pb-2">
          <div className="flex items-center gap-1">
            {/* Settings */}
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

                      {/* Section: How you use LITLink */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">How you use LITLink</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: TrendingUp, label: "InsightX", emoji: "📊", color: "#a78bfa", panel: "InsightX" },
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

                      {/* Section: For professionals */}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-3">For Professionals</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { icon: Wrench,      label: "ProTools Hub",  color: "#f59e0b", panel: "ProTools Hub" },
                            { icon: Wallet,      label: "AdPay Center",  color: "#34d399", panel: "AdPay Center" },
                            { icon: ShieldCheck, label: "VerifyPlus",    color: "#818cf8", panel: "VerifyPlus", sub: "Subscribed" },
                          ].map((s) => (
                            <button key={s.panel} onClick={() => setSettingsPanel(s.panel)}
                              className="flex flex-col items-center gap-3 pt-4 pb-3 px-2 rounded-2xl border border-white/8 bg-white/4 hover:bg-white/8 active:scale-95 transition-all">
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${s.color}22`, border: `1px solid ${s.color}44` }}>
                                <s.icon className="w-6 h-6" style={{ color: s.color }} />
                              </div>
                              <span className="text-[9px] font-bold text-center leading-tight text-zinc-300">{s.label}</span>
                              {s.sub && <span className="text-[8px] text-emerald-400 font-semibold -mt-1">{s.sub}</span>}
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
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-4 pb-1">Ads preferences</p>
                      <div className="px-5 py-3 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">Personalized Ads</Label>
                            <p className="text-[11px] text-muted-foreground">Based on your interests</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Ad Frequency</Label>
                          <RadioGroup defaultValue="medium" className="grid grid-cols-3 gap-2">
                            {["Low", "Med", "High"].map((v) => (
                              <div key={v} className="flex items-center gap-2 bg-muted/50 px-3 py-2.5 rounded-xl cursor-pointer">
                                <RadioGroupItem value={v.toLowerCase()} id={v.toLowerCase()} />
                                <Label htmlFor={v.toLowerCase()} className="cursor-pointer text-sm">{v}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <button onClick={() => logout()} className="w-full flex items-center gap-3 px-5 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-semibold">Log out</span>
                      </button>
                    </div>
                  )}

                  {/* ── SUB: INSIGHTX ── */}
                  {settingsPanel === "InsightX" && (
                    <div className="p-5 space-y-4">
                      {[
                        { label: "Profile views this week", value: "1,248", change: "+18%" },
                        { label: "Post impressions", value: "8,490", change: "+7%" },
                        { label: "Follower growth", value: "+124", change: "this month" },
                        { label: "Avg. engagement rate", value: "4.2%", change: "above average" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <div className="text-right">
                            <div className="text-sm font-bold">{item.value}</div>
                            <div className="text-[10px] text-green-400">{item.change}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── SUB: PRIVACYLOCK ── */}
                  {settingsPanel === "PrivacyLock" && (
                    <div className="p-5 space-y-5">
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

                  {/* ── SUB: BLOCKED ── */}
                  {settingsPanel === "BlockShield" && (
                    <div className="p-5 space-y-3">
                      <p className="text-[11px] text-muted-foreground">Blocked accounts can't see your content or interact with you.</p>
                      {["@spammer99", "@troll_user", "@fake_account"].map((handle) => (
                        <div key={handle} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">👤</div>
                            <span className="text-sm font-medium">{handle}</span>
                          </div>
                          <button className="text-[11px] text-blue-400 font-semibold px-3 py-1 rounded-full border border-blue-400/30 hover:bg-blue-400/10 transition-colors">
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── SUB: CLOSE FRIENDS ── */}
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

                  {/* ── SUB: GENERIC (ProTools Hub, ShareSync, GhostView, FriendPulse, Sharing, AdPay Center) ── */}
                  {["ProTools Hub", "ShareSync", "GhostView", "FriendPulse", "Sharing and reuse", "AdPay Center"].includes(settingsPanel ?? "") && (
                    <div className="p-5 space-y-4">
                      <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <Settings className="w-7 h-7 opacity-40" />
                        </div>
                        <div className="text-sm font-medium">More options coming soon</div>
                        <div className="text-[11px] opacity-60 max-w-[200px]">This feature is being built. Check back in the next update.</div>
                      </div>
                    </div>
                  )}

                </ScrollAreaUI>
              </DialogContent>
            </Dialog>

            <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full text-pink-400 hover:bg-pink-400/10">
              <Menu className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Rank badge top-center */}
        <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border"
          style={{ borderColor: rankColor, color: rankColor, background: `${rankColor}18`, boxShadow: `0 0 12px ${rankColor}40` }}>
          <Crown className="w-3 h-3" />
          {rank}
        </div>
      </div>

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
              {/* Hexagonal-style avatar with glow ring */}
              <div className="relative shrink-0">
                <div className="w-[72px] h-[72px] rounded-2xl p-[3px] relative"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #db2777, #db2777, #7c3aed)",
                    backgroundSize: "300% 300%",
                    animation: "gradientShift 3s ease infinite",
                    boxShadow: "0 0 20px rgba(124,58,237,0.6), 0 0 40px rgba(219,39,119,0.3)",
                  }}>
                  <div className="w-full h-full rounded-xl overflow-hidden bg-black">
                    <Avatar className="w-full h-full rounded-xl">
                      <AvatarImage src={user?.profileImageUrl || undefined} className="rounded-xl" />
                      <AvatarFallback className="text-2xl rounded-xl bg-gradient-to-br from-purple-900 to-pink-900">
                        {user?.firstName?.[0]}
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
                <p className="text-[11px] text-pink-400/70 font-mono mt-0.5">@{(user as any)?.username ?? `${user?.firstName?.toLowerCase()}_litlink`}</p>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  {(user as any)?.bio || "📸 Digital Creator · Content Warrior"}
                </p>
              </div>
            </div>

            {/* XP Progress bar */}
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

            {/* Stats: Posts / Followers / Following */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { value: fmtN(myStats?.postsCount ?? myPosts.length), label: "POSTS", color: "#c084fc", glow: "rgba(192,132,252,0.3)" },
                { value: fmtN(myStats?.followersCount), label: "CREW", color: "#34d399", glow: "rgba(52,211,153,0.3)" },
                { value: fmtN(myStats?.followingCount), label: "ALLIES", color: "#fb923c", glow: "rgba(251,146,60,0.3)" },
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
            {selectedPet && (
              <Button className="w-full mt-3" onClick={() => setSelectedPet(null)} variant="ghost">Remove Pet</Button>
            )}
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

      {/* ══ CONTENT TABS ══ */}
      <div className="mt-4">
        <Tabs defaultValue="posts">
          <TabsList className="w-full grid grid-cols-4 h-10 bg-transparent border-b border-white/5 rounded-none px-4">
            {[
              { value: "posts", icon: Grid, label: "POSTS" },
              { value: "reels", icon: Users, label: "REELS" },
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

          <TabsContent value="reels" className="py-20 text-center">
            <div className="text-4xl mb-3">🎬</div>
            <p className="text-zinc-600 text-sm font-mono">NO REELS YET</p>
          </TabsContent>

          <TabsContent value="saved" className="py-20 text-center">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-zinc-600 text-sm font-mono">ARCHIVE EMPTY</p>
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
              {/* Avatar picker */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-violet-500/50"
                    style={{ boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}>
                    {editAvatarUrl ? (
                      <img src={editAvatarUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-violet-900 to-pink-900 flex items-center justify-center text-2xl font-black text-white">
                        {editFirstName?.[0] || user?.firstName?.[0] || "?"}
                      </div>
                    )}
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

      <BottomNav />

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
