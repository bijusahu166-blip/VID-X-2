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
    { icon: Home,          label: "Home",    href: "/" },
    { icon: Search,        label: "Explore", href: "/search" },
    { icon: PlaySquare,    label: "Reels",   href: "/reels" },
    { icon: Bell,          label: "Alerts",  href: "/notifications", badge: unreadCount },
    { icon: MessageCircle, label: "DMs",     href: "/messages" },
    { icon: User,          label: "Profile", href: "/profile" },
  ];

  return (
    /*
     * The nav is fixed at bottom:0. We add padding-bottom via inline style so
     * the pill always floats above the home indicator / Android gesture bar.
     * env(safe-area-inset-bottom) adapts per device; 8px is the minimum gap.
     */
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      {/* Outer wrapper adds lateral padding + a small top gap */}
      <div className="flex justify-center px-4 pt-1">
        {/* Floating pill */}
        <div className="flex items-end justify-between gap-1 bg-black rounded-2xl px-2 pt-2 pb-2 shadow-2xl w-full max-w-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href !== "#" && item.href === location;

            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div
                  data-testid={`link-${item.label.toLowerCase()}`}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-xl transition-all duration-200 w-full",
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "text-zinc-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                  <span className="text-[9px] font-medium leading-none">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
