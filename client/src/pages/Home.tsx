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
    <div className="min-h-screen bg-[#bda0ba05] ml-[162.876px] mr-[162.876px] mt-[0px] mb-[0px] pt-[0px] pb-[0px]">
      <Header />
      <main className="max-w-md mx-auto px-0 sm:px-4 pl-[0px] pr-[0px] text-left mt-[100px] mb-[100px] pt-[1px] pb-[1px] ml-[-144px] mr-[-144px]">
        {/* Stories/Status Bar - Only My Story */}
        <div className="mb-8 px-4 sm:px-0">
          <div className="flex space-x-6 px-2 py-4 pl-[4px] pr-[4px] text-center ml-[-34px] mr-[-34px] mt-[-46px] mb-[-46px]">
            {/* My Story */}
            <div className="flex flex-col items-center space-y-2 font-extrabold text-[19px] text-left ml-[2px] mr-[2px] mt-[-7px] mb-[-7px] pt-[-10px] pb-[-10px] pl-[7px] pr-[7px]">
              <div className="relative w-20 h-20 p-[3px] bg-status-premium clip-pentagon shadow-lg ml-[13px] mr-[13px] mt-[3px] mb-[3px] pl-[3px] pr-[3px] pt-[1px] pb-[1px]">
                <div className="w-full h-full bg-background clip-pentagon p-[2px]">
                  <div className="w-full h-full bg-muted flex items-center justify-center overflow-hidden clip-pentagon">
                     {user?.profileImageUrl ? (
                       <img src={user.profileImageUrl} alt="Me" className="w-full h-full object-cover" />
                     ) : (
                       <Plus className="w-8 h-8 text-muted-foreground" />
                     )}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-600 text-white rounded-full p-1 border-2 border-background shadow-md ml-[14px] mr-[14px] mt-[-2px] mb-[-2px] pt-[8px] pb-[8px] pl-[2px] pr-[2px]">
                  <Plus className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xs tracking-tight ml-[4px] mr-[4px] pl-[0px] pr-[0px] pt-[0px] pb-[0px] font-black bg-[#302b2b0d]">Your Story</span>
            </div>
          </div>
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
