import { Plus, Bell, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation } from "wouter";
import { CreatePostDialog } from "@/components/feed/CreatePostDialog";
import { RandomCallScreen } from "@/components/call/RandomCallScreen";
import { useQuery } from "@tanstack/react-query";
import logoSrc from "@assets/WhatsApp_Image_2026-02-25_at_11.51.01_AM_1774520807664.jpeg";

export function Header() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRandomCallOpen, setIsRandomCallOpen] = useState(false);
  const [, navigate] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    staleTime: 10000,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 w-full bg-background/95 backdrop-blur border-b border-border/40 h-14">
        <div className="flex items-center justify-between gap-4 h-full px-4 max-w-sm mx-auto">

          {/* Left: Create Button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsCreateOpen(true)}
            className="rounded-full shadow-[0_0_10px_rgba(74,222,128,0.6)] border border-green-500/50 hover:bg-green-500/10 transition-all duration-300 shrink-0"
            data-testid="button-create-post"
          >
            <Plus className="w-5 h-5 text-green-500" />
            <span className="sr-only">Create</span>
          </Button>

          {/* Center: Logo */}
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="VID-X" className="w-8 h-8 rounded-lg object-cover" />
            <h1 className="font-display bg-clip-text bg-gradient-to-r from-primary to-accent text-[22px] leading-none font-black text-[transparent]">VID-X</h1>
          </div>

          {/* Right: icons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Random Video Call button */}
            <div className="spin-border-green">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsRandomCallOpen(true)}
                className="rounded-full w-9 h-9 text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors relative z-10"
                data-testid="button-random-video-call"
              >
                <Video className="w-4 h-4" />
                <span className="sr-only">Random Video Call</span>
              </Button>
            </div>

            {/* Notifications bell — navigates to /notifications */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/notifications")}
              className="rounded-full w-9 h-9 hover:bg-secondary transition-colors relative"
              data-testid="button-notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </div>
        </div>
      </header>

      <CreatePostDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      {isRandomCallOpen && <RandomCallScreen onClose={() => setIsRandomCallOpen(false)} />}
    </>
  );
}
