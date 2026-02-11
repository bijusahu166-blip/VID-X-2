import { Plus, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { CreatePostDialog } from "@/components/feed/CreatePostDialog";

export function Header() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border p-2 px-4">
      <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto">
        {/* Left: Neon Create Button */}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-full shadow-[0_0_15px_rgba(34,197,94,0.5)] border border-green-500 hover:bg-green-500/10 transition-all duration-300"
          data-testid="button-create-post"
        >
          <Plus className="w-6 h-6 text-green-500" />
          <span className="sr-only">Create</span>
        </Button>

        {/* Center: Search Bar (Simplified) */}
        <div className="flex-1 max-w-md relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search"
            className="w-full bg-secondary rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            data-testid="input-header-search"
          />
        </div>

        {/* Right: Notifications */}
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full hover:bg-secondary transition-colors"
          data-testid="button-notifications"
        >
          <Bell className="w-6 h-6" />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>

      <CreatePostDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </header>
  );
}
