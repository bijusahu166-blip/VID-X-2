import { Link, useLocation } from "wouter";
import {
  Home,
  PlaySquare,
  MessageCircle,
  Search,
  User,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

type NavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
};

const NAV_ITEMS_BASE: Omit<NavItem, "badge">[] = [
  { id: "home", icon: Home, label: "Home", href: "/" },
  { id: "search", icon: Search, label: "Explore", href: "/search" },
  { id: "jobs", icon: Briefcase, label: "Jobs", href: "/jobs" },
  { id: "reels", icon: PlaySquare, label: "Reels", href: "/reels" },
  { id: "messages", icon: MessageCircle, label: "DMs", href: "/messages" },
  { id: "profile", icon: User, label: "Me", href: "/profile" },
];

function isRouteActive(location: string, href: string): boolean {
  const cleanPath = location.split("?")[0] || "/";

  if (href === "/") return cleanPath === "/";
  if (href === "/profile") {
    return cleanPath === "/profile";
  }

  return cleanPath === href;
}

export function BottomNav() {
  const [location] = useLocation();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 1,
  });

  const unreadCount = Number(unreadData?.count ?? 0);

  const navItems: NavItem[] = NAV_ITEMS_BASE.map((item) =>
    item.id === "messages"
      ? { ...item, badge: unreadCount }
      : item
  );

  return (
    <nav
      className="fixed left-0 right-0 z-50 pointer-events-none"
      style={{
        bottom: 0,
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
      }}
    >
      <div className="mx-3 mt-1 pointer-events-auto">
        <div
          className="flex items-center justify-around rounded-2xl border border-white/5"
          style={{
            padding: "8px 4px",
            background: "rgba(10,10,10,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow:
              "0 -4px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isRouteActive(location, item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex-1"
              >
                <div
                  data-testid={`link-${item.label.toLowerCase()}`}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 rounded-xl",
                    "transition-[transform,color,background-color] duration-200 ease-out",
                    "active:scale-90 select-none touch-manipulation",
                    isActive
                      ? "text-primary"
                      : "text-zinc-500 hover:text-white",
                    item.id === "jobs" &&
                      "bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl bg-primary/10" />
                  )}

                  <Icon
                    className={cn(
                      item.id === "jobs" ? "w-6 h-6" : "w-5 h-5",
                      "shrink-0 relative z-[1]",
                      (isActive || item.id === "jobs") &&
                        "drop-shadow-[0_0_6px_currentColor]"
                    )}
                  />

                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute top-0.5 right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 leading-none z-[2]">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}