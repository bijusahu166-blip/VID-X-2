import { BottomNav } from "@/components/layout/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  Settings, Grid, Bookmark, Users, PawPrint,
  History as HistoryIcon, BarChart3, ChevronRight, UserCheck,
  CreditCard, BadgeCheck, Lock, Star, Users2, Ban, EyeOff,
  UserPlus, MessageSquare, AtSign, MessageCircle, Share2,
  LogOut, Menu, Zap, Trophy, Flame, Shield, Sword, Target,
  Crown, Cpu, Wifi, Battery, Signal
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosts } from "@/hooks/use-posts";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

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

function SettingRow({ icon: Icon, label, sub }: { icon: any; label: string; sub?: string }) {
  return (
    <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-left">
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

export default function Profile() {
  const { user, logout } = useAuth();
  const { data: posts } = usePosts();
  const [selectedPet, setSelectedPet] = useState<{ name: string; emoji: string } | null>(null);
  const { data: history } = useQuery<any[]>({ queryKey: ["/api/history"] });
  const myPosts = posts || [];

  const xp = 7340;
  const xpMax = 10000;
  const level = 42;
  const rank = "DIAMOND";
  const rankColor = "#f472b6";

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
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-14 pb-2">
          <div className="flex items-center gap-1 text-pink-400 text-[10px] font-mono font-bold">
            <Signal className="w-3 h-3" />
            <span>5G</span>
            <Wifi className="w-3 h-3 ml-1" />
            <Battery className="w-3 h-3 ml-1" />
            <span>98%</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Settings */}
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="w-8 h-8 rounded-full text-pink-400 hover:bg-pink-400/10">
                  <Settings className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
                  <DialogTitle className="text-xl font-display">Settings</DialogTitle>
                  <DialogDescription className="sr-only">Manage your account settings.</DialogDescription>
                </DialogHeader>
                <ScrollAreaUI className="max-h-[80vh]">
                  <div className="py-3 space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-3 pb-1">How you use LITLink</p>
                    <SettingRow icon={BarChart3} label="Insights" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-4 pb-1">For professionals</p>
                    <SettingRow icon={UserCheck} label="Account type and tools" />
                    <SettingRow icon={CreditCard} label="Ads payments" />
                    <SettingRow icon={BadgeCheck} label="LITLink Verified" sub="Subscribed" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-4 pb-1">Who can see your content</p>
                    <SettingRow icon={Lock} label="Account privacy" sub="Public" />
                    <SettingRow icon={Star} label="Close Friends" sub="15 members" />
                    <SettingRow icon={Users2} label="Crossposting" />
                    <SettingRow icon={Ban} label="Blocked" sub="3 accounts" />
                    <SettingRow icon={EyeOff} label="Hide story and live" />
                    <SettingRow icon={UserPlus} label="Activity in Friends tab" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-4 pb-1">How others can interact with you</p>
                    <SettingRow icon={MessageSquare} label="Messages and story replies" />
                    <SettingRow icon={AtSign} label="Tags and mentions" />
                    <SettingRow icon={MessageCircle} label="Comments" />
                    <SettingRow icon={Share2} label="Sharing and reuse" />
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
                    <button onClick={logout} className="w-full flex items-center gap-3 px-5 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors">
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm font-semibold">Log out</span>
                    </button>
                  </div>
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
                <p className="text-[11px] text-pink-400/70 font-mono mt-0.5">@{user?.firstName?.toLowerCase()}_litlink</p>
                <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                  📸 Digital Creator · Content Warrior<br />Capturing worlds, one frame at a time.
                </p>
              </div>
            </div>

            {/* XP Progress bar */}
            <div className="mt-4 space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest font-mono">XP Progress</span>
                <span className="text-[9px] font-mono text-zinc-400">{xp.toLocaleString()} / {xpMax.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div className="h-full rounded-full relative overflow-hidden"
                  style={{
                    width: `${(xp / xpMax) * 100}%`,
                    background: "linear-gradient(90deg, #7c3aed, #db2777, #ec4899)",
                    boxShadow: "0 0 8px rgba(6,182,212,0.8)",
                    transition: "width 1s ease",
                  }}>
                  <div className="absolute inset-0 animate-pulse opacity-40"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)", animation: "shimmer 2s linear infinite" }} />
                </div>
              </div>
            </div>

            {/* Stats: Posts / Followers / Following */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { value: myPosts.length.toString(), label: "POSTS", color: "#c084fc", glow: "rgba(192,132,252,0.3)" },
                { value: "1.2K", label: "CREW", color: "#34d399", glow: "rgba(52,211,153,0.3)" },
                { value: "840", label: "ALLIES", color: "#fb923c", glow: "rgba(251,146,60,0.3)" },
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
        <button className="flex-1 h-10 rounded-xl font-black text-[11px] uppercase tracking-widest relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(37,99,235,0.3))",
            border: "1px solid rgba(124,58,237,0.5)",
            boxShadow: "0 0 15px rgba(124,58,237,0.2)",
          }}>
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
                  <div key={post.id} className="aspect-square bg-zinc-900 relative group cursor-pointer overflow-hidden">
                    <img src={post.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 border border-pink-500/0 group-hover:border-pink-500/40 transition-colors" />
                  </div>
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
    </div>
  );
}
