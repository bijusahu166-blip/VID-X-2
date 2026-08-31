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
 * Bottom navigation is shown only on the main navigation screens.
 * Full-screen/detail/action screens must never show it.
 */
function shouldHideBottomNav(location: string) {
  const path =
    (location.split("?")[0] || "/").replace(/\/+$/, "") || "/";

  // Direct chat / chat detail
  if (path.startsWith("/messages/")) {
    return true;
  }

  // Voice rooms
  if (
    path === "/voice-room/create" ||
    path === "/voice-rooms/create" ||
    path.startsWith("/voice-rooms/")
  ) {
    return true;
  }

  // Upload / create screens
  const hiddenExactRoutes = [
    "/upload",
    "/upload/video",
    "/upload/image",
    "/upload/photo",
    "/create",
    "/create-post",
    "/create-post/video",
    "/create-post/photo",
    "/post/create",
    "/video/upload",
    "/photo/upload",
    "/reel/create",
    "/reels/create",

    // Full-screen/action pages
    "/camera",
    "/record",
    "/record-video",
    "/record-audio",
    "/live",
    "/go-live",
    "/live/create",

    // Utility/action pages
    "/subscription",
    "/buy-coins",
    "/notifications",
  ];

  if (hiddenExactRoutes.includes(path)) {
    return true;
  }

  // Nested upload/create routes
  if (
    path.startsWith("/upload/") ||
    path.startsWith("/create/") ||
    path.startsWith("/create-post/")
  ) {
    return true;
  }

  // Full-screen post/video/story viewers
  if (
    path.startsWith("/post/") ||
    path.startsWith("/posts/") ||
    path.startsWith("/video/") ||
    path.startsWith("/videos/") ||
    path.startsWith("/story/") ||
    path.startsWith("/stories/")
  ) {
    return true;
  }

  // Reel details/full-screen reel.
  // Keep the main /reels tab visible.
  if (path.startsWith("/reels/") && path !== "/reels") {
    return true;
  }

  return false;
}

export function BottomNav() {
  const [location] = useLocation();

  // IMPORTANT:
  // Keep hooks unconditional. Do not put useQuery behind an early return.
  const hideBottomNav = shouldHideBottomNav(location);

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