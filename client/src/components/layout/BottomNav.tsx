import { Link, useLocation } from "wouter";
import { Home, PlaySquare, MessageCircle, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: PlaySquare, label: "Reels", href: "/reels" },
    { icon: MessageCircle, label: "DMs", href: "/messages" }, // Prime center spot
    { icon: Search, label: "Explore", href: "/search" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.href === location;
          
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center w-12 h-12 rounded-full transition-all duration-200 cursor-pointer",
                  isActive 
                    ? "text-primary scale-110" 
                    : "text-muted-foreground hover:text-foreground",
                  index === 2 && "text-primary" // Highlight DMs center spot
                )}
                data-testid={`link-${item.label.toLowerCase()}`}
              >
                <Icon className={cn("w-6 h-6", isActive && "fill-current")} />
                <span className="sr-only">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
