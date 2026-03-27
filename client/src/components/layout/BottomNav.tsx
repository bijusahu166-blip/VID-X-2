import { Link, useLocation } from "wouter";
import { Home, PlaySquare, MessageCircle, Search, User, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

export function BottomNav() {
  const [location] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    staleTime: 10000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Search, label: "Explore", href: "/search" },
    { icon: PlaySquare, label: "Reels", href: "/reels" },
    { icon: Bell, label: "Alerts", href: "/notifications", badge: unreadCount },
    { icon: MessageCircle, label: "DMs", href: "/messages" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom-nav">
      <div className="flex justify-center pb-3 pt-1 px-4">
        <div className="flex items-center justify-between gap-1 bg-black rounded-2xl px-3 py-2 shadow-2xl w-full max-w-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href !== "#" && item.href === location;

            return (
              <Link key={item.href} href={item.href}>
                <div className="nav-spin-border">
                  <div
                    data-testid={`link-${item.label.toLowerCase()}`}
                    className={cn(
                      "relative flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary/20 text-primary"
                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.badge != null && item.badge > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                    <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
