import { Link, useLocation } from "wouter";
import { Home, PlaySquare, MessageCircle, Search, User, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CreatePostDialog } from "@/components/feed/CreatePostDialog";

export function BottomNav() {
  const [location] = useLocation();
  const [isLiveOpen, setIsLiveOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    staleTime: 10000,
  });
  const unreadCount = unreadData?.count ?? 0;

  type NavItem =
    | { id: string; icon: React.ElementType; label: string; href: string; badge?: number; isLive?: false }
    | { id: string; isLive: true };

  const navItems: NavItem[] = [
    { id: "home",     icon: Home,          label: "Home",    href: "/" },
    { id: "search",   icon: Search,        label: "Explore", href: "/search" },
    { id: "live",     isLive: true },
    { id: "reels",    icon: PlaySquare,    label: "Reels",   href: "/reels" },
    { id: "messages", icon: MessageCircle, label: "DMs",     href: "/messages", badge: unreadCount },
    { id: "profile",  icon: User,          label: "Me",      href: "/profile" },
  ];

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
      >
        {/* Floating pill */}
        <div className="mx-3 mt-1">
          <div
            className="flex items-center justify-around bg-black rounded-2xl shadow-2xl border border-white/5"
            style={{ padding: "6px 4px" }}
          >
            {navItems.map((item) => {
              if (item.isLive) {
                return (
                  <button
                    key="live"
                    onClick={() => setIsLiveOpen(true)}
                    data-testid="button-go-live-nav"
                    className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 relative"
                  >
                    {/* Glowing Live button */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center -mt-5 border-2 border-red-500/60 transition-all active:scale-90"
                      style={{
                        background: "linear-gradient(135deg, #dc2626, #ec4899)",
                        boxShadow: "0 0 18px rgba(220,38,38,0.7), 0 -4px 16px rgba(220,38,38,0.4)",
                      }}
                    >
                      <Radio className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[9px] font-black text-red-400 tracking-wide mt-0.5">LIVE</span>
                  </button>
                );
              }

              const Icon = item.icon!;
              const isActive = item.href !== "#" && item.href === location;

              return (
                <Link key={item.id} href={item.href!} className="flex-1">
                  <div
                    data-testid={`link-${item.label!.toLowerCase()}`}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-xl transition-all duration-200",
                      isActive
                        ? "text-primary"
                        : "text-zinc-500 hover:text-white"
                    )}
                  >
                    {isActive && (
                      <div className="absolute inset-0 rounded-xl bg-primary/10" />
                    )}
                    <Icon className={cn("w-5 h-5 shrink-0 relative", isActive && "drop-shadow-[0_0_6px_currentColor]")} />
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute top-0.5 right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                    <span className="text-[9px] font-semibold leading-none relative">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Live dialog — opened when user taps the LIVE button in bottom nav */}
      <CreatePostDialog
        open={isLiveOpen}
        onOpenChange={setIsLiveOpen}
        defaultTab="live"
      />
    </>
  );
}
