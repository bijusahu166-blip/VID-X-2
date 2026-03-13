import { Plus, Bell, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreatePostDialog } from "@/components/feed/CreatePostDialog";

export function Header() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
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
        <h1 className="font-display bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent font-extrabold text-[26px] leading-none">
          LITLink
        </h1>

        {/* Right: Video Call + Notifications */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Video call button with green spinning border */}
          <div className="spin-border-green">
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full w-9 h-9 text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors relative z-10"
              data-testid="button-video-call"
            >
              <Video className="w-4 h-4" />
              <span className="sr-only">Video Call</span>
            </Button>
          </div>

          {/* Notifications */}
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full w-9 h-9 hover:bg-secondary transition-colors"
            data-testid="button-notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="sr-only">Notifications</span>
          </Button>
        </div>
      </div>
      <CreatePostDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </header>
  );
}
