import { Plus, Bell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreatePostDialog } from "@/components/feed/CreatePostDialog";
import { AIChatDrawer } from "@/components/chat/AIChatDrawer";

export function Header() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-background/95 backdrop-blur border-b border-border/40 h-14">
      <div className="flex items-center justify-between gap-4 h-full px-4 max-w-sm mx-auto">
        {/* Left: Neon Create Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-full shadow-[0_0_10px_rgba(74,222,128,0.6)] border border-green-500/50 hover:bg-green-500/10 hover:shadow-[0_0_15px_rgba(74,222,128,0.8)] transition-all duration-300"
          data-testid="button-create-post"
        >
          <Plus className="w-5 h-5 text-green-500" />
          <span className="sr-only">Create</span>
        </Button>

        {/* Center: Logo */}
        <h1 className="font-display bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent truncate font-extrabold text-[29px] text-left">LITLink</h1>

        {/* Right: Notifications only (AI Assistant moved to Messages) */}
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full hover:bg-secondary transition-colors"
            data-testid="button-notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="sr-only">Notifications</span>
          </Button>
        </div>
      </div>
      <CreatePostDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </header>
  );
}
