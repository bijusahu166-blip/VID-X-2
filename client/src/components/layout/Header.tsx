import { Plus, Bell, Video, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLocation } from "wouter";
import { CreatePostDialog } from "@/components/feed/CreatePostDialog";
import { RandomCallScreen } from "@/components/call/RandomCallScreen";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import logoSrc from "@assets/WhatsApp_Image_2026-02-25_at_11.51.01_AM_1774520807664.jpeg";

export function Header() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRandomCallOpen, setIsRandomCallOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    staleTime: 10000,
  });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      {/*
        ── Solid black status-bar cover ─────────────────────────────────
        Always 0.5 cm tall (or the device's safe-area-inset-top if larger).
        z-index 9999 keeps it above everything including modals.
      */}
      <div
        className="fixed top-0 left-0 right-0 bg-black"
        style={{ height: "var(--top-bar-h)", zIndex: 9999, minHeight: "19px" }}
        aria-hidden="true"
      />

      {/* Header — sits flush below the black bar */}
      <header
        className="fixed left-0 right-0 z-50 w-full h-14"
        style={{
          top: "var(--top-bar-h)",
          background: "rgba(0,0,0,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center justify-between h-full px-4 max-w-sm mx-auto">

          {/* Left: Logo */}
          <div className="flex items-center gap-2">
            <img src={logoSrc} alt="VID-X" className="w-8 h-8 rounded-lg object-cover" />
            <h1
              className="font-display text-[22px] leading-none font-black"
              style={{
                background: "linear-gradient(90deg, #a855f7, #ec4899, #f97316)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              VID-X
            </h1>
          </div>

          {/* Right: Call + Create + Notifications */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Video Call — Agora RTC powered */}
            <button
              onClick={() => toast({ title: "Random call locked", description: "This feature is coming soon. Upcoming features are not available yet.", variant: "default" })}
              data-testid="button-random-video-call"
              className="relative flex flex-col items-center justify-center w-10 h-10 rounded-full transition-all active:scale-90"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #db2777)",
                boxShadow: "0 0 14px rgba(168,85,247,0.6)",
              }}
            >
              <Video className="w-4 h-4 text-white" />
              <Lock className="absolute bottom-0 right-0 w-3 h-3 text-white" />
              {/* Pulse ring to indicate "active" */}
              <span className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "rgba(168,85,247,0.3)", animationDuration: "2s" }} />
              <span className="sr-only">Random Video Call</span>
            </button>

            {/* Create Post button */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-full border border-green-500/50 hover:bg-green-500/10 transition-all duration-300 shrink-0"
              style={{ boxShadow: "0 0 10px rgba(74,222,128,0.5)" }}
              data-testid="button-create-post"
            >
              <Plus className="w-5 h-5 text-green-400" />
              <span className="sr-only">Create</span>
            </Button>

            {/* Notifications */}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/notifications")}
              className="rounded-full w-9 h-9 hover:bg-white/10 transition-colors relative"
              data-testid="button-notifications"
            >
              <Bell className="w-4 h-4 text-zinc-300" />
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
