import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Settings, Grid, Bookmark, Users, PawPrint } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosts } from "@/hooks/use-posts";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea as ScrollAreaUI } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const PET_NAMES = [
  "Buddy", "Charlie", "Max", "Bella", "Lucy", "Rocky", "Daisy", "Coco", 
  "Milo", "Luna", "Teddy", "Simba", "Oliver", "Leo", "Rosie", "Ruby", 
  "Jack", "Tiger", "Bruno", "Shadow", "Snowy", "Ginger", "Pepper", 
  "Lucky", "Angel", "Honey", "Tommy", "Oscar", "Prince", "Princess"
];

export default function Profile() {
  const { user, logout } = useAuth();
  const { data: posts } = usePosts();
  const [selectedPet, setSelectedPet] = useState<string | null>(null);

  // Filter posts by current user (in real app, use useUserPosts hook)
  // For now, showing all posts in profile for demo
  const myPosts = posts || [];

  return (
    <div className="min-h-screen bg-background pb-20 pt-14">
      <Header />
      <main>
        <div className="p-6 text-[19px] font-extrabold text-right bg-[#737d7c4d]">
          <div className="flex items-center justify-between bg-[#a9c7bfd6] mt-[-3px] mb-[-3px] ml-[-18px] mr-[-18px] pl-[0px] pr-[0px] pt-[37px] pb-[37px] relative">
            <div className="relative">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 ring-2 ring-primary ring-offset-2 ring-offset-background">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-2xl">{user?.firstName?.[0]}</AvatarFallback>
              </Avatar>
              {selectedPet && (
                <div className="absolute -top-4 -right-2 bg-background rounded-full p-1 shadow-lg animate-bounce">
                  <div className="text-[24px]">🐾</div>
                  <div className="text-[8px] font-black uppercase text-center">{selectedPet}</div>
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
                <DialogContent className="sm:max-w-md bg-card border-none shadow-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-display">Ads Preferences</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 text-left">
                        <Label className="text-base">Personalized Ads</Label>
                        <p className="text-xs text-muted-foreground">Show ads based on your interests</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="space-y-3 text-left">
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
                  </div>
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
                    {PET_NAMES.map((name) => (
                      <Button
                        key={name}
                        variant={selectedPet === name ? "default" : "outline"}
                        className="h-auto py-4 flex flex-col gap-2 rounded-xl"
                        onClick={() => setSelectedPet(name)}
                      >
                        <span className="text-2xl">🐶</span>
                        <span className="text-[10px] font-bold">{name}</span>
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
          <TabsList className="w-full grid grid-cols-3 rounded-none h-12 bg-transparent border-b">
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
        </Tabs>
      </main>
      <BottomNav />
    </div>
  );
}
