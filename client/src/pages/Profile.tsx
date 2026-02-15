import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Settings, Grid, Bookmark, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePosts } from "@/hooks/use-posts";

export default function Profile() {
  const { user, logout } = useAuth();
  const { data: posts } = usePosts();

  // Filter posts by current user (in real app, use useUserPosts hook)
  // For now, showing all posts in profile for demo
  const myPosts = posts || [];

  return (
    <div className="min-h-screen bg-background pb-20 pt-14">
      <Header />
      <main>
        <div className="p-6 text-[19px] font-extrabold text-right bg-[#737d7c4d]">
          <div className="flex items-center justify-between bg-[#a9c7bfd6] mt-[-3px] mb-[-3px] ml-[-18px] mr-[-18px] pl-[0px] pr-[0px] pt-[37px] pb-[37px]">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 ring-2 ring-primary ring-offset-2 ring-offset-background">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">{user?.firstName?.[0]}</AvatarFallback>
            </Avatar>
            
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

          <div className="space-y-1 mb-6">
            <h2 className="font-bold text-lg">{user?.firstName} {user?.lastName}</h2>
            <p className="text-sm text-muted-foreground">
              Digital Creator 📸 <br />
              Capturing moments from around the world.
            </p>
          </div>

          <div className="flex gap-2 mb-6">
            <Button className="flex-1 rounded-lg font-semibold h-9" variant="default">Edit Profile</Button>
            <Button className="flex-1 rounded-lg font-semibold h-9" variant="secondary" onClick={() => logout()}>Logout</Button>
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
