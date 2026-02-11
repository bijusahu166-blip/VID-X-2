import { Link, useLocation } from "wouter";
import { Home, Search, PlusSquare, PlaySquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreatePostDialog } from "@/components/feed/CreatePostDialog";
import { useState } from "react";

export function BottomNav() {
  const [location] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Search, label: "Search", href: "/search" },
    { icon: PlusSquare, label: "Create", action: () => setIsCreateOpen(true) },
    { icon: PlaySquare, label: "Reels", href: "/reels" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border pb-safe">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === location;
            
            if (item.action) {
              return (
                <button
                  key="create"
                  onClick={item.action}
                  className="p-2 rounded-full hover:bg-secondary transition-colors"
                >
                  <Icon className="w-6 h-6" />
                  <span className="sr-only">{item.label}</span>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 cursor-pointer",
                    isActive 
                      ? "text-primary scale-110" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("w-6 h-6", isActive && "fill-current")} />
                  <span className="sr-only">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      <CreatePostDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </>
  );
}
