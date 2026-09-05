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
import { useBottomNavVisibility } from "@/contexts/BottomNavVisibilityContext";

type NavItem = {
  id: string;
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: number;
};

const NAV_ITEMS: Omit<NavItem, "badge">[] = [
  {
    id: "home",
    icon: Home,
    label: "Home",
    href: "/",
  },
  {
    id: "search",
    icon: Search,
    label: "Explore",
    href: "/search",
  },
  {
    id: "jobs",
    icon: Briefcase,
    label: "Jobs",
    href: "/jobs",
  },
  {
    id: "reels",
    icon: PlaySquare,
    label: "Reels",
    href: "/reels",
  },
  {
    id: "messages",
    icon: MessageCircle,
    label: "DMs",
    href: "/messages",
  },
  {
    id: "profile",
    icon: User,
    label: "Me",
    href: "/profile",
  },
];

function isActiveRoute(location: string, href: string) {
  const path = location.split("?")[0] || "/";

  if (href === "/") {
    return path === "/";
  }

  if (href === "/profile") {
    return path === "/profile";
  }

  return path === href;
}

/**
 * Bottom navigation is shown ONLY on the main tab screens — everywhere else
 * it's hidden by default.
 *
 * This is deliberately a WHITELIST, not a blacklist. An earlier version
 * hid known problem routes and showed the nav on everything else — which
 * meant any new screen that forgot to get added to that list would show
 * the nav by mistake. Whitelisting the handful of real main-tab routes
 * means the safe/default outcome for every other route (existing or
 * future) is "hidden", with zero maintenance needed elsewhere.
 *
 * NOTE: this only covers routes that actually change the URL. Overlays
 * that open WITHOUT a route change — a chat thread opened as internal
 * state inside /messages, a settings panel inside /profile, a
 * comment/report bottom sheet on the home feed — do NOT go through here.
 * Those are handled separately via BottomNavVisibilityContext (see
 * useHideBottomNavWhenOpen), which any component can call regardless of
 * the current route. Between the two, the nav can only ever be visible
 * on a bare main-tab screen with no overlay open.
 */
const MAIN_TAB_ROUTES = ["/", "/search", "/jobs", "/reels", "/messages", "/profile"];

function isMainTabRoute(path: string) {
  if (MAIN_TAB_ROUTES.includes(path)) return true;
  // Viewing someone else's profile (/profile/:id) is still the same "Me"
  // tab experience, just for another user — keep it visible there too.
  if (path.startsWith("/profile/")) return true;
  return false;
}

function shouldHideBottomNav(location: string) {
  const path =
    (location.split("?")[0] || "/").replace(/\/+$/, "") || "/";

  return !isMainTabRoute(path);
}

export function BottomNav() {
  const [location] = useLocation();

  // IMPORTANT:
  // Keep hooks unconditional. Do not put useQuery behind an early return.
  const hideByRoute = shouldHideBottomNav(location);
  const { isHidden: hideByOverlay } = useBottomNavVisibility();
  const hideBottomNav = hideByRoute || hideByOverlay;

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    enabled: !hideBottomNav,
    refetchInterval: hideBottomNav ? false : 30000,
    staleTime: 10000,
    retry: 1,
  });

  if (hideBottomNav) {
    return null;
  }

  const unreadCount = Number(unreadData?.count ?? 0);

  const navItems: NavItem[] = NAV_ITEMS.map((item) =>
    item.id === "messages"
      ? {
          ...item,
          badge: unreadCount,
        }
      : item
  );

  return (
    <nav
      data-no-page-swipe="true"
      aria-label="Main navigation"
      // z-[45]: needs to sit above normal page content (sticky headers/tabs
      // commonly use z-40) but BELOW modal dialogs — shadcn/Radix Dialog
      // overlays and content use z-50 by default. At z-[9999] this nav used
      // to render on top of any open dialog (e.g. the upload dialog's
      // Publish/Share button), making that button unreachable.
      className="fixed left-0 right-0 z-[45] pointer-events-none"
      style={{
        bottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
        transform: "translate3d(0, 0, 0)",
        WebkitTransform: "translate3d(0, 0, 0)",
        padding: 0,
        willChange: "transform",
      }}
    >
      <div
        className="mx-3 pointer-events-auto"
        style={{
          padding: 0,
        }}
      >
        <div
          className="mx-auto flex w-full max-w-[560px] items-center justify-around rounded-2xl border border-white/10"
          style={{
            minHeight: "64px",
            padding: "7px 4px",
            background: "rgba(10,10,10,0.98)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            boxShadow:
              "0 -4px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
            transform: "translateZ(0)",
            WebkitTransform: "translateZ(0)",
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActiveRoute(location, item.href);

            return (
              <Link
                key={item.id}
                href={item.href}
                className="min-w-0 flex-1"
              >
                <div
                  data-testid={`link-${item.label.toLowerCase()}`}
                  className={cn(
                    "relative mx-0.5 flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl",
                    "px-1 py-1.5 select-none touch-manipulation",
                    active
                      ? "text-primary"
                      : "text-zinc-500 hover:text-white",
                    item.id === "jobs" &&
                      "border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-purple-500/10"
                  )}
                >
                  {active && (
                    <div className="absolute inset-0 rounded-xl bg-primary/10" />
                  )}

                  <Icon
                    className={cn(
                      item.id === "jobs" ? "h-6 w-6" : "h-5 w-5",
                      "relative z-[1] shrink-0",
                      (active || item.id === "jobs") &&
                        "drop-shadow-[0_0_6px_currentColor]"
                    )}
                  />

                  {item.badge != null && item.badge > 0 && (
                    <span className="absolute right-0.5 top-0.5 z-[2] flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-black leading-none text-white">
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