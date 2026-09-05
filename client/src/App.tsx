import OneSignal from "onesignal-cordova-plugin";
import { SplashScreen } from "@capacitor/splash-screen";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { CallProvider, useCall } from "@/contexts/CallContext";
import { VideoSettingsProvider } from "@/contexts/VideoSettingsContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { BottomNavVisibilityProvider } from "@/contexts/BottomNavVisibilityContext";
import { VideoCallScreen } from "@/components/call/VideoCallScreen";
import { IncomingCallScreen } from "@/components/call/IncomingCallScreen";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { AnimatePresence, motion } from "framer-motion";
import { App as CapacitorApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

import introVideo from "@/assets/intro.mp4";
import VoiceRoomCreate from "@/pages/VoiceRoomCreate";
import BuyCoins from "@/pages/BuyCoins";
import VoiceRoomScreen from "@/pages/VoiceRoomScreen";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import Reading from "@/pages/Reading";
import AimSelection from "@/pages/AimSelection";
import Reels from "@/pages/Reels";
import PostView from "@/pages/PostView";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import Notifications from "@/pages/Notifications";
import Jobs from "@/pages/Jobs";
import Subscription from "@/pages/Subscription";
import DeleteAccount from "./pages/DeleteAccount";

const API_BASE = Capacitor.isNativePlatform() ? "https://iqpartner.xyz" : "";

const SWIPE_TABS = [
  "/",
  "/search",
  "/jobs",
  "/reels",
  "/messages",
  "/profile",
] as const;

const SWIPE_THRESHOLD = 80;
const SWIPE_DOMINANCE = 1.25;
const NAV_LOCK_MS = 320;

function IntroVideo({ onFinish }: { onFinish: () => void }) {
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.play().catch(() => {
      video.muted = true;
      video.play().catch(onFinish);
    });
  }, [onFinish]);

  useEffect(() => {
    const timer = window.setTimeout(onFinish, 4000);
    return () => window.clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[10000] bg-black flex items-center justify-center">
      <video
        ref={videoRef}
        src={introVideo}
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => setReady(true)}
        onEnded={onFinish}
        onError={onFinish}
        className="w-full h-full object-cover"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 180ms ease" }}
      />
    </div>
  );
}

function useServerVersionWatcher() {
  const knownVersion = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/version`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok || cancelled) return;

        const data = await res.json();
        const version = String(data?.v ?? "");
        if (!version) return;

        if (knownVersion.current === null) {
          knownVersion.current = version;
          return;
        }

        if (knownVersion.current !== version) {
          window.location.reload();
        }
      } catch {}
    };

    void check();
    const timer = window.setInterval(check, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
}

function GlobalCallOverlay() {
  const { callState } = useCall();

  return (
    <>
      {(callState === "outgoing" || callState === "active") && (
        <VideoCallScreen />
      )}
      {callState === "incoming" && <IncomingCallScreen />}
    </>
  );
}

function getElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

function shouldBlockPageSwipe(target: EventTarget | null): boolean {
  const el = getElement(target);
  if (!el) return false;

  return Boolean(
    el.closest(
      [
        "input",
        "textarea",
        "select",
        "[contenteditable='true']",
        "[role='dialog']",
        "[data-no-page-swipe='true']",
        "[data-story-viewer='true']",
        "[data-live-viewer='true']",
      ].join(",")
    )
  );
}

function findHorizontalScroller(target: EventTarget | null): HTMLElement | null {
  let el = getElement(target);

  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;

    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth + 8
    ) {
      return el;
    }

    el = el.parentElement;
  }

  return null;
}

function SwipeTabs({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const cleanPath = useMemo(() => location.split("?")[0] || "/", [location]);
  const currentIndex = SWIPE_TABS.findIndex((p) => p === cleanPath);
  const canSwipe = currentIndex >= 0;

  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const startedAt = useRef(0);

  const tracking = useRef(false);
  const locked = useRef(false);
  const horizontalScroller = useRef<HTMLElement | null>(null);

  const [direction, setDirection] = useState<1 | -1>(1);

  const go = useCallback(
    (nextIndex: number, dir: 1 | -1) => {
      if (locked.current) return;
      if (nextIndex < 0 || nextIndex >= SWIPE_TABS.length) return;

      const next = SWIPE_TABS[nextIndex];
      if (!next || next === cleanPath) return;

      locked.current = true;
      setDirection(dir);
      navigate(next);

      window.setTimeout(() => {
        locked.current = false;
      }, NAV_LOCK_MS);
    },
    [cleanPath, navigate]
  );

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!canSwipe || locked.current || shouldBlockPageSwipe(e.target)) {
        tracking.current = false;
        return;
      }

      const t = e.touches[0];
      if (!t) return;

      startX.current = t.clientX;
      startY.current = t.clientY;
      currentX.current = t.clientX;
      currentY.current = t.clientY;
      startedAt.current = Date.now();
      horizontalScroller.current = findHorizontalScroller(e.target);
      tracking.current = true;
    },
    [canSwipe]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (!tracking.current || !canSwipe) return;

      const t = e.touches[0];
      if (!t) return;

      currentX.current = t.clientX;
      currentY.current = t.clientY;

      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;

      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
        tracking.current = false;
        return;
      }

      const scroller = horizontalScroller.current;
      if (scroller && Math.abs(dx) > 12) {
        const max = scroller.scrollWidth - scroller.clientWidth;
        const atLeft = scroller.scrollLeft <= 2;
        const atRight = scroller.scrollLeft >= max - 2;

        if ((dx < 0 && !atRight) || (dx > 0 && !atLeft)) {
          tracking.current = false;
        }
      }
    },
    [canSwipe]
  );

  const handleTouchEnd = useCallback(() => {
    if (!tracking.current || !canSwipe || locked.current) {
      tracking.current = false;
      horizontalScroller.current = null;
      return;
    }

    tracking.current = false;

    const dx = currentX.current - startX.current;
    const dy = currentY.current - startY.current;
    const elapsed = Math.max(1, Date.now() - startedAt.current);

    horizontalScroller.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DOMINANCE) return;
    if (elapsed > 1200 && Math.abs(dx) < 140) return;

    if (dx < 0) {
      go(currentIndex + 1, 1);
    } else {
      go(currentIndex - 1, -1);
    }
  }, [canSwipe, currentIndex, go]);

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        tracking.current = false;
        horizontalScroller.current = null;
      }}
    >
     {canSwipe ? (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={cleanPath}
      initial={{ opacity: 0.98, x: direction === 1 ? 34 : -34 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0.98, x: direction === 1 ? -34 : 34 }}
      transition={{
        duration: 0.18,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="min-h-screen w-full will-change-transform"
    >
      {children}
    </motion.div>
  </AnimatePresence>
) : (
  <div className="min-h-screen w-full">
    {children}
  </div>
)}
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  useServerVersionWatcher();

  // Public page — must be reachable without login (Play Store requirement)
  if (typeof window !== "undefined" && window.location.pathname === "/delete-account") {
    return <DeleteAccount />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Login />;

  const localGoal = localStorage.getItem("user_goal");
  if (!(user as any).goal && !localGoal) return <AimSelection />;

 return (
  <>
    <SwipeTabs>
      <Switch>
        <Route path="/voice-rooms/create" component={VoiceRoomCreate} />
        <Route path="/buy-coins" component={BuyCoins} />
        <Route path="/voice-rooms/:id" component={VoiceRoomScreen} />

        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/reels" component={Reels} />
        <Route path="/messages" component={Messages} />
        <Route path="/profile" component={Profile} />

        <Route path="/reading" component={Reading} />
        <Route path="/post/:id" component={PostView} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/delete-account" component={DeleteAccount} />
        
        <Route component={NotFound} />
      </Switch>
    </SwipeTabs>

    {/* Rendered OUTSIDE SwipeTabs' motion.div on purpose: that div carries
        Framer Motion's transform (and will-change-transform) for the page
        slide animation, and CSS makes ANY transformed ancestor become the
        containing block for position:fixed descendants. BottomNav was
        getting trapped inside it — sticking to the bottom of the page
        content instead of the real viewport. Its own internal route check
        (shouldHideBottomNav) already decides when to hide itself, so one
        instance here covers every page. It ALSO reads
        BottomNavVisibilityContext (provided further up, in App()) so any
        component — a chat thread, a settings panel, a comment/report sheet
        — can hide it too, even without changing the route. */}
    <BottomNav />

    <GlobalCallOverlay />
  </>
);
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    SplashScreen.hide().catch(() => {});
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    if (!appId) return;

    try {
      OneSignal.initialize(appId);
      OneSignal.Notifications.requestPermission(true);
    } catch (err) {
      console.warn("[OneSignal]", err);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let removeListener: (() => void) | null = null;

    CapacitorApp.addListener("appUrlOpen", async (data) => {
      if (!data?.url?.includes("auth-callback")) return;

      try {
        await Browser.close();
      } catch {}

      if (!cancelled) {
        window.location.href = "/";
      }
    })
      .then((listener) => {
        if (cancelled) {
          listener.remove();
        } else {
          removeListener = () => listener.remove();
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <VideoSettingsProvider>
            <CallProvider>
              {/* Must wrap BOTH BottomNav (in Router) and every page/overlay
                  that might need to hide it — Home's comment/report sheets,
                  Profile's settings panel, Messages' chat thread, etc. —
                  so it needs to sit above Router in the tree, not inside it. */}
              <BottomNavVisibilityProvider>
                <Toaster />
                <AppContent />
              </BottomNavVisibilityProvider>
            </CallProvider>
          </VideoSettingsProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const [videoEnded, setVideoEnded] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const { isLoading: authLoading } = useAuth();

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ["/api/posts"],
        queryFn: async () => {
          const res = await fetch(`${API_BASE}/api/posts`, {
            credentials: "include",
          });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        },
      }),

      queryClient.prefetchQuery({
        queryKey: ["/api/stories"],
        queryFn: async () => {
          const res = await fetch(`${API_BASE}/api/stories`, {
            credentials: "include",
          });

          if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
          }

          const fallback = await fetch(`${API_BASE}/api/posts`, {
            credentials: "include",
          });
          if (!fallback.ok) return [];

          const posts = await fallback.json();
          return Array.isArray(posts)
            ? posts.filter((p: any) => p?.type === "story")
            : [];
        },
      }),

      queryClient.prefetchQuery({
        queryKey: ["/api/voice-rooms"],
        queryFn: async () => {
          const res = await fetch(`${API_BASE}/api/voice-rooms`, {
            credentials: "include",
          });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        },
      }),

      queryClient.prefetchQuery({
        queryKey: ["/api/books"],
        queryFn: async () => {
          const res = await fetch(`${API_BASE}/api/books`, {
            credentials: "include",
          });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        },
      }),
    ]).finally(() => {
      if (!cancelled) setDataReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const showIntro = !videoEnded || authLoading || !dataReady;

  return (
    <>
      <Router />
      {showIntro && <IntroVideo onFinish={() => setVideoEnded(true)} />}
    </>
  );
}

export default App;