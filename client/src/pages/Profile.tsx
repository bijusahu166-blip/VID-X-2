import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
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
  Share2
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosts } from "@/hooks/use-posts";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

const PETS = [
  { name: "Buddy", emoji: "🐶" },
  { name: "Charlie", emoji: "🐱" },
  { name: "Max", emoji: "🐹" },
  { name: "Bella", emoji: "🐰" },
  { name: "Lucy", emoji: "🦊" },
  { name: "Rocky", emoji: "🐻" },
  { name: "Daisy", emoji: "🐼" },
  { name: "Coco", emoji: "🐨" },
  { name: "Milo", emoji: "🐯" },
  { name: "Luna", emoji: "🦁" },
  { name: "Teddy", emoji: "🐮" },
  { name: "Simba", emoji: "🐷" },
  { name: "Oliver", emoji: "🐸" },
  { name: "Leo", emoji: "🐵" },
  { name: "Rosie", emoji: "🦄" },
  { name: "Ruby", emoji: "🦖" },
  { name: "Jack", emoji: "🐉" },
  { name: "Tiger", emoji: "🐆" },
  { name: "Bruno", emoji: "🐘" },
  { name: "Shadow", emoji: "🦒" },
  { name: "Snowy", emoji: "🦜" },
  { name: "Ginger", emoji: "🦩" },
  { name: "Pepper", emoji: "🦚" },
  { name: "Lucky", emoji: "🦢" },
  { name: "Angel", emoji: "🐝" },
  { name: "Honey", emoji: "🦋" },
  { name: "Tommy", emoji: "🐙" },
  { name: "Oscar", emoji: "🦑" },
  { name: "Prince", emoji: "🐠" },
  { name: "Princess", emoji: "🐬" }
];

export default function Profile() {
  const { user, logout } = useAuth();
  const { data: posts } = usePosts();
  const [selectedPet, setSelectedPet] = useState<{ name: string, emoji: string } | null>(null);

  const { data: history } = useQuery<any[]>({
    queryKey: ["/api/history"],
  });

  // Filter posts by current user (in real app, use useUserPosts hook)
  // For now, showing all posts in profile for demo
  const myPosts = posts || [];

  return (
    <div className="min-h-screen bg-background pb-20 pt-14 relative overflow-hidden">
      {/* Animated Multi-color Background Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[80px] animate-pulse" />
        <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] bg-accent/20 rounded-full blur-[100px] animate-bounce [animation-duration:8s]" />
        <div className="absolute -bottom-[10%] left-[20%] w-[45%] h-[45%] bg-emerald-500/10 rounded-full blur-[90px] animate-pulse [animation-duration:6s]" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>
      <Header />
      <main>
        <div className="p-6 text-[19px] font-extrabold text-right bg-[#737d7c4d]">
          <div className="flex items-center justify-between mt-[-3px] mb-[-3px] pl-[0px] pr-[0px] relative pt-[7px] pb-[7px] ml-[-20px] mr-[-20px] bg-[#4a1c1c14] text-justify font-semibold">
            <div className="relative">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 ring-2 ring-primary ring-offset-2 ring-offset-background">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-2xl">{user?.firstName?.[0]}</AvatarFallback>
              </Avatar>
              {selectedPet && (
                <div className="absolute -top-4 -right-2 rounded-full p-1 shadow-lg animate-bounce bg-[#ffffff08]">
                  <div className="text-[24px] mt-[0px] mb-[0px] pt-[0px] pb-[0px] pl-[-18px] pr-[-18px] ml-[0px] mr-[0px] bg-[#fa0c0c00]">{selectedPet.emoji}</div>
                  <div className="text-[8px] font-black uppercase text-center">{selectedPet.name}</div>
                </div>
              )}
            </div>
            
            <div className="flex gap-6 text-center">
              <div>
                <div className="font-bold text-lg">{myPosts.length}</div>
                <div className="text-xs text-muted-foreground">Posts</div>
              </div>
              <div>
                <div className="font-bold text-lg">1.2k</div>
                <div className="text-xs text-muted-foreground">Followers</div>
              </div>
              <div>
                <div className="font-bold text-lg">840</div>
                <div className="text-xs text-muted-foreground">Following</div>
              </div>
            </div>
          </div>

          <div className="space-y-1 mb-6 mt-4">
            <div className="flex items-center justify-end gap-2">
              <h2 className="font-bold text-lg">{user?.firstName} {user?.lastName}</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Settings className="w-5 h-5 text-muted-foreground cursor-pointer hover:rotate-90 transition-transform duration-500" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-card border-none shadow-2xl p-0 overflow-hidden">
                  <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-display">Settings</DialogTitle>
                  </DialogHeader>
                  <ScrollAreaUI className="max-h-[80vh] px-2 pb-6">
                    <div className="space-y-6 p-4">
                      {/* Professional Section */}
                      <section className="space-y-1">
                        <h3 className="text-xs font-bold text-muted-foreground px-2 py-2 uppercase tracking-wider">How you use RoboApp</h3>
                        <div className="space-y-1">
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <BarChart3 className="w-5 h-5" />
                              <span className="font-medium">Insights</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </section>

                      {/* For Professionals */}
                      <section className="space-y-1">
                        <h3 className="text-xs font-bold text-muted-foreground px-2 py-2 uppercase tracking-wider">For professionals</h3>
                        <div className="space-y-1">
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <UserCheck className="w-5 h-5" />
                              <span className="font-medium">Account type and tools</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <CreditCard className="w-5 h-5" />
                              <span className="font-medium">Ads payments</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <BadgeCheck className="w-5 h-5" />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">LITLink Verified</span>
                                <span className="text-[10px] text-primary font-bold">Subscribed</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </section>

                      {/* Who can see your content */}
                      <section className="space-y-1">
                        <h3 className="text-xs font-bold text-muted-foreground px-2 py-2 uppercase tracking-wider">Who can see your content</h3>
                        <div className="space-y-1">
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <Lock className="w-5 h-5" />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Account privacy</span>
                                <span className="text-[10px] text-muted-foreground">Public</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <Star className="w-5 h-5" />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Close Friends</span>
                                <span className="text-[10px] text-muted-foreground">15 members</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <Users2 className="w-5 h-5" />
                              <span className="font-medium">Crossposting</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <Ban className="w-5 h-5" />
                              <div className="flex flex-col items-start">
                                <span className="font-medium">Blocked</span>
                                <span className="text-[10px] text-muted-foreground">3 accounts</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <EyeOff className="w-5 h-5" />
                              <span className="font-medium">Hide story and live</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <UserPlus className="w-5 h-5" />
                              <span className="font-medium">Activity in Friends tab</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </section>

                      {/* How others can interact with you */}
                      <section className="space-y-1">
                        <h3 className="text-xs font-bold text-muted-foreground px-2 py-2 uppercase tracking-wider">How others can interact with you</h3>
                        <div className="space-y-1">
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <MessageSquare className="w-5 h-5" />
                              <span className="font-medium">Messages and story replies</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <AtSign className="w-5 h-5" />
                              <span className="font-medium">Tags and mentions</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <MessageCircle className="w-5 h-5" />
                              <span className="font-medium">Comments</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" className="w-full justify-between h-12 rounded-xl px-2">
                            <div className="flex items-center gap-3">
                              <Share2 className="w-5 h-5" />
                              <span className="font-medium">Sharing and reuse</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </section>

                      {/* Original Ads Section */}
                      <section className="space-y-4 pt-4 border-t">
                        <h3 className="text-xs font-bold text-muted-foreground px-2 uppercase tracking-wider">Ads Preferences</h3>
                        <div className="flex items-center justify-between px-2">
                          <div className="space-y-0.5 text-left">
                            <Label className="text-base">Personalized Ads</Label>
                            <p className="text-xs text-muted-foreground">Show ads based on your interests</p>
                          </div>
                          <Switch defaultChecked />
                        </div>
                        <div className="space-y-3 text-left px-2 pb-6">
                          <Label className="text-base">Ad Frequency</Label>
                          <RadioGroup defaultValue="medium" className="grid grid-cols-3 gap-4 mt-2">
                            <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-xl cursor-pointer">
                              <RadioGroupItem value="low" id="low" />
                              <Label htmlFor="low" className="cursor-pointer">Low</Label>
                            </div>
                            <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-xl cursor-pointer">
                              <RadioGroupItem value="medium" id="medium" />
                              <Label htmlFor="medium" className="cursor-pointer">Med</Label>
                            </div>
                            <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-xl cursor-pointer">
                              <RadioGroupItem value="high" id="high" />
                              <Label htmlFor="high" className="cursor-pointer">High</Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </section>
                    </div>
                  </ScrollAreaUI>
                </DialogContent>
              </Dialog>
            </div>
            <p className="text-sm text-muted-foreground">
              Digital Creator 📸 <br />
              Capturing moments from around the world.
            </p>
          </div>

          <div className="flex gap-2 mb-6">
            <Button className="flex-1 rounded-lg font-semibold h-9" variant="default">Edit Profile</Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex-1 rounded-lg font-semibold h-9 bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
                  <PawPrint className="w-4 h-4" /> Own Pet
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-none shadow-2xl">
                <DialogHeader>
                  <DialogTitle className="text-center font-display text-xl">Select Your 3D Pet</DialogTitle>
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
                <Button 
                  className="w-full mt-4" 
                  onClick={() => setSelectedPet(null)}
                  variant="ghost"
                >
                  Remove Pet
                </Button>
              </DialogContent>
            </Dialog>

            <Button className="rounded-lg font-semibold h-9" variant="secondary" onClick={() => logout()}>Logout</Button>
          </div>
        </div>

        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full grid grid-cols-4 rounded-none h-12 bg-transparent border-b">
            <TabsTrigger 
              value="posts" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none"
            >
              <Grid className="w-5 h-5" />
            </TabsTrigger>
            <TabsTrigger 
              value="reels" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none"
            >
              <Users className="w-5 h-5" />
            </TabsTrigger>
            <TabsTrigger 
              value="saved" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none"
            >
              <Bookmark className="w-5 h-5" />
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none"
            >
              <HistoryIcon className="w-5 h-5" />
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="posts" className="mt-0">
             <div className="grid grid-cols-3 gap-0.5 bg-[#17333821]">
                {myPosts.map((post) => (
                  <div key={post.id} className="aspect-square bg-muted relative group cursor-pointer">
                    <img src={post.imageUrl} className="w-full h-full object-cover" />
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
            <div className="space-y-4">
              {history && history.length > 0 ? (
                history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/40">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <HistoryIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold capitalize">{item.action.replace('_', ' ')}</div>
                        <div className="text-xs text-muted-foreground">{item.metadata || 'No details available'}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
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
      </main>
      <BottomNav />
    </div>
  );
}
