import { usePosts } from "@/hooks/use-posts";
import { PostCard } from "@/components/feed/PostCard";
import { BottomNav } from "@/components/layout/BottomNav";
import { AIChatDrawer } from "@/components/chat/AIChatDrawer";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { data: posts, isLoading } = usePosts();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-background/80 backdrop-blur-md border-b px-4 h-14 flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          SocialApp
        </h1>
        <div className="flex gap-2">
          <AIChatDrawer />
        </div>
      </header>

      <main className="max-w-md mx-auto pt-16 px-0 sm:px-4">
        {/* Stories/Status Bar */}
        <div className="mb-6 px-4 sm:px-0">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex space-x-4">
              {/* My Story */}
              <div className="flex flex-col items-center space-y-1">
                <div className="relative w-16 h-16 rounded-full p-[2px] border-2 border-dashed border-muted-foreground/30">
                  <div className="w-full h-full rounded-full bg-muted flex items-center justify-center overflow-hidden">
                     {user?.profileImageUrl ? (
                       <img src={user.profileImageUrl} alt="Me" className="w-full h-full object-cover" />
                     ) : (
                       <Plus className="w-6 h-6 text-muted-foreground" />
                     )}
                  </div>
                  <div className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-0.5 border-2 border-background">
                    <Plus className="w-3 h-3" />
                  </div>
                </div>
                <span className="text-xs">Your Story</span>
              </div>

              {/* Fake Stories */}
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col items-center space-y-1">
                  <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                    <div className="w-full h-full rounded-full bg-background p-0.5">
                      <img 
                        src={`https://images.unsplash.com/photo-${1500000000000 + i}?w=100&h=100&fit=crop`} 
                        alt="Story" 
                        className="w-full h-full rounded-full object-cover"
                      />
                      {/* Unsplash random placeholder logic */}
                    </div>
                  </div>
                  <span className="text-xs">User {i}</span>
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
