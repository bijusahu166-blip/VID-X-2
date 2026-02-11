import { BottomNav } from "@/components/layout/BottomNav";
import { Heart, MessageCircle, Share2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Reels() {
  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <div className="flex-1 relative snap-y snap-mandatory overflow-y-scroll no-scrollbar">
        {[1, 2, 3].map((i) => (
          <div key={i} className="snap-start h-full w-full relative flex items-center justify-center bg-zinc-900">
            {/* Video Placeholder */}
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Reel {i}</h2>
              <p className="text-zinc-400">Video playback would go here</p>
            </div>

            {/* Overlay Actions */}
            <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center">
              <div className="flex flex-col items-center gap-1">
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/20">
                  <Heart className="w-7 h-7" />
                </Button>
                <span className="text-xs font-medium">12.5k</span>
              </div>
              
              <div className="flex flex-col items-center gap-1">
                <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/20">
                  <MessageCircle className="w-7 h-7" />
                </Button>
                <span className="text-xs font-medium">542</span>
              </div>

              <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/20">
                <Share2 className="w-7 h-7" />
              </Button>
              
              <Button size="icon" variant="ghost" className="rounded-full hover:bg-white/20">
                <MoreVertical className="w-6 h-6" />
              </Button>
            </div>

            {/* Overlay Info */}
            <div className="absolute left-4 bottom-20 max-w-[70%]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-zinc-700 rounded-full" />
                <span className="font-semibold text-sm">username</span>
                <Button variant="outline" size="sm" className="h-6 text-xs bg-transparent border-white/50 text-white hover:bg-white/20 hover:text-white">
                  Follow
                </Button>
              </div>
              <p className="text-sm line-clamp-2">This is a beautiful caption for the reel shown above. #viral #trending</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="relative z-50">
        <BottomNav />
      </div>
    </div>
  );
}
