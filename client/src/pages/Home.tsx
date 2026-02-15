import { usePosts } from "@/hooks/use-posts";
import { PostCard } from "@/components/feed/PostCard";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { AIChatDrawer } from "@/components/chat/AIChatDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { data: posts, isLoading } = usePosts();
  const { user } = useAuth();

  return (
    <div className="min-h-screen pb-20 bg-[#fff7f700]">
      <Header />
      <main className="max-w-md mx-auto pt-16 px-0 sm:px-4">
        {/* Stories/Status Bar */}
        <div className="mb-8 px-4 sm:px-0">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex space-x-6 px-2 py-4">
              {/* My Story */}
              <div className="flex flex-col items-center space-y-2">
                <div className="relative w-20 h-20 p-[3px] bg-status-premium clip-pentagon shadow-lg">
                  <div className="w-full h-full bg-background clip-pentagon p-[2px]">
                    <div className="w-full h-full bg-muted flex items-center justify-center overflow-hidden clip-pentagon">
                       {user?.profileImageUrl ? (
                         <img src={user.profileImageUrl} alt="Me" className="w-full h-full object-cover" />
                       ) : (
                         <Plus className="w-8 h-8 text-muted-foreground" />
                       )}
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 border-2 border-background shadow-md">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-xs tracking-tight font-extrabold bg-[#ffb8b8] ml-[4px] mr-[4px] pl-[0px] pr-[0px] pt-[0px] pb-[0px]">Your Story</span>
              </div>

              {/* Fake Stories */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center space-y-2 font-black">
                  <div className="w-20 h-20 p-[3px] bg-status-premium clip-pentagon shadow-lg hover:scale-105 transition-transform duration-300">
                    <div className="w-full h-full bg-background clip-pentagon p-[2px]">
                      <img 
                        src={`https://images.unsplash.com/photo-${1500000000000 + i}?w=150&h=150&fit=crop`} 
                        alt="Story" 
                        className="w-full h-full object-cover clip-pentagon"
                      />
                    </div>
                  </div>
                  <span className="text-xs font-medium opacity-80 bg-[#bda0ba0d]">User {i}</span>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>

        {/* Feed */}
        <div className="space-y-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="space-y-4 mb-8 p-4 bg-card rounded-3xl">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                </div>
                <Skeleton className="h-[300px] w-full rounded-xl" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[80%]" />
              </div>
            ))
          ) : posts?.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No posts yet. Be the first!</p>
            </div>
          ) : (
            posts?.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
