import { BottomNav } from "@/components/layout/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  Settings,
  Grid,
  Bookmark,
  Users,
  PawPrint,
  History as HistoryIcon,
  BarChart3,
  ChevronRight,
  UserCheck,
  CreditCard,
  BadgeCheck,
  Lock,
  Star,
  Users2,
  Ban,
  EyeOff,
  UserPlus,
  MessageSquare,
  AtSign,
  MessageCircle,
  Share2,
  LogOut,
  Menu
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosts } from "@/hooks/use-posts";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";

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
  { name: "Snowy", emoji: "🦜" }, { name: "Ginger", emoji: "🦩" },
  { name: "Pepper", emoji: "🦚" }, { name: "Lucky", emoji: "🦢" },
  { name: "Angel", emoji: "🐝" }, { name: "Honey", emoji: "🦋" },
  { name: "Tommy", emoji: "🐙" }, { name: "Oscar", emoji: "🦑" },
  { name: "Prince", emoji: "🐠" }, { name: "Princess", emoji: "🐬" }
];

function SettingRow({ icon: Icon, label, sub, onClick }: { icon: any; label: string; sub?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-left"
    >
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

  return (
    <div className="min-h-screen bg-background pb-20 relative overflow-hidden">
      {/* Animated gradient blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute top-40 -right-10 w-80 h-80 bg-accent/15 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-emerald-500/10 rounded-full blur-[90px] animate-pulse [animation-delay:4s]" />
      </div>

      {/* ── Profile header bar ── */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-14 pb-4">
        <h1 className="text-lg font-bold">{user?.firstName} {user?.lastName}</h1>

        <div className="flex items-center gap-2">
          {/* Settings */}
          <Dialog>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="rounded-full">
                <Settings className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
                <DialogTitle className="text-xl font-display">Settings</DialogTitle>
                <DialogDescription className="sr-only">Manage your account settings and privacy.</DialogDescription>
              </DialogHeader>
              <ScrollAreaUI className="max-h-[80vh]">
                <div className="py-3 space-y-1">

                  {/* ─ How you use LITLink ─ */}
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-3 pb-1">How you use LITLink</p>
                  <SettingRow icon={BarChart3} label="Insights" />

                  {/* ─ For professionals ─ */}
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-4 pb-1">For professionals</p>
                  <SettingRow icon={UserCheck} label="Account type and tools" />
                  <SettingRow icon={CreditCard} label="Ads payments" />
                  <SettingRow icon={BadgeCheck} label="LITLink Verified" sub="Subscribed" />

                  {/* ─ Who can see your content ─ */}
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-4 pb-1">Who can see your content</p>
                  <SettingRow icon={Lock} label="Account privacy" sub="Public" />
                  <SettingRow icon={Star} label="Close Friends" sub="15 members" />
                  <SettingRow icon={Users2} label="Crossposting" />
                  <SettingRow icon={Ban} label="Blocked" sub="3 accounts" />
                  <SettingRow icon={EyeOff} label="Hide story and live" />
                  <SettingRow icon={UserPlus} label="Activity in Friends tab" />

                  {/* ─ How others can interact ─ */}
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-5 pt-4 pb-1">How others can interact with you</p>
                  <SettingRow icon={MessageSquare} label="Messages and story replies" />
                  <SettingRow icon={AtSign} label="Tags and mentions" />
                  <SettingRow icon={MessageCircle} label="Comments" />
                  <SettingRow icon={Share2} label="Sharing and reuse" />

                  {/* ─ Ads preferences ─ */}
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

                  {/* ─ Account ─ */}
                  <Separator className="my-3" />
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-5 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm font-semibold">Log out</span>
                  </button>
                </div>
              </ScrollAreaUI>
            </DialogContent>
          </Dialog>

          {/* Hamburger menu placeholder */}
          <Button size="icon" variant="ghost" className="rounded-full">
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* ── Profile info ── */}
      <div className="relative z-10 px-4 space-y-4">
        {/* Avatar + stats row */}
        <div className="flex items-center justify-between">
          <div className="relative">
            <Avatar className="w-20 h-20 ring-2 ring-primary ring-offset-2 ring-offset-background">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">{user?.firstName?.[0]}</AvatarFallback>
            </Avatar>
            {selectedPet && (
              <div className="absolute -top-3 -right-2 bg-background rounded-full p-0.5 shadow-lg animate-bounce">
                <span className="text-2xl">{selectedPet.emoji}</span>
              </div>
            )}
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="font-bold text-base">{myPosts.length}</div>
              <div className="text-xs text-muted-foreground">Posts</div>
            </div>
            <div>
              <div className="font-bold text-base">1.2k</div>
              <div className="text-xs text-muted-foreground">Followers</div>
            </div>
            <div>
              <div className="font-bold text-base">840</div>
              <div className="text-xs text-muted-foreground">Following</div>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Digital Creator 📸<br />Capturing moments from around the world.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button className="flex-1 rounded-xl font-semibold h-9" variant="secondary">
            Edit Profile
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button className="flex-1 rounded-xl font-semibold h-9 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white gap-2 border-0">
                <PawPrint className="w-4 h-4" /> Own Pet
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border border-border/40 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-center font-display text-xl">Select Your 3D Pet</DialogTitle>
                <DialogDescription className="sr-only">Choose a pet to display on your profile.</DialogDescription>
              </DialogHeader>
              <ScrollAreaUI className="h-[300px] mt-4">
                <div className="grid grid-cols-3 gap-3 p-1">
                  {PETS.map((pet) => (
                    <Button
                      key={pet.name}
                      variant={selectedPet?.name === pet.name ? "default" : "outline"}
                      className="h-auto py-4 flex flex-col gap-2 rounded-xl"
                      onClick={() => setSelectedPet(pet)}
                    >
                      <span className="text-2xl">{pet.emoji}</span>
                      <span className="text-[10px] font-bold">{pet.name}</span>
                    </Button>
                  ))}
                </div>
              </ScrollAreaUI>
              {selectedPet && (
                <Button className="w-full mt-3" onClick={() => setSelectedPet(null)} variant="ghost">
                  Remove Pet
                </Button>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Content tabs ── */}
      <div className="relative z-10 mt-4">
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full grid grid-cols-4 rounded-none h-11 bg-transparent border-b border-border/40">
            {[
              { value: "posts", icon: Grid },
              { value: "reels", icon: Users },
              { value: "saved", icon: Bookmark },
              { value: "history", icon: HistoryIcon },
            ].map(({ value, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                <Icon className="w-5 h-5" />
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            <div className="grid grid-cols-3 gap-0.5">
              {myPosts.map((post) => (
                <div key={post.id} className="aspect-square bg-muted relative group cursor-pointer overflow-hidden">
                  <img src={post.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reels" className="py-20 text-center text-muted-foreground">
            No reels yet
          </TabsContent>

          <TabsContent value="saved" className="py-20 text-center text-muted-foreground">
            No saved posts
          </TabsContent>

          <TabsContent value="history" className="p-4">
            <div className="space-y-3">
              {history && history.length > 0 ? (
                history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <HistoryIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold capitalize">{item.action.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">{item.metadata || "No details"}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-muted-foreground">
                  Your activity history will appear here.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
