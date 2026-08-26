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

// ── API BASE ──────────────────────────────────────────────────────────────
const API_BASE = Capacitor.isNativePlatform() ? "https://iqpartner.xyz" : "";

// Bottom nav / swipe order
const SWIPE_TABS = [
  "/",
  "/search",
  "/jobs",
  "/reels",
  "/messages",
  "/profile",
] as const;

const SWIPE_THRESHOLD = 82;
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
      video.play().catch(() => onFinish());
    });
  }, [onFinish]);

  useEffect(() => {
    const timer = window.setTimeout(onFinish, 4000);
    return () => window.clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
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
        style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 180ms ease",
        }}
      />
    </div>
  );
}

function useServerVersionWatcher() {
  const knownVersion = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
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
      } catch {
        // Version check must never crash the app.
      }
    };

    void check();
    timer = setInterval(check, 30_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
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

// ── Swipe helpers ─────────────────────────────────────────────────────────

function getElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

function hasSwipeBlocker(target: EventTarget | null): boolean {
  const el = getElement(target);
  if (!el) return false;

  return Boolean(
    el.closest(
      [
        "input",
        "textarea",
        "select",
        "option",
        "[contenteditable='true']",
        "[data-no-page-swipe='true']",
        "[role='dialog']",
      ].join(",")
    )
  );
}

function findHorizontalScroller(
  target: EventTarget | null
): HTMLElement | null {
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

function shouldProtectGesture(target: EventTarget | null): boolean {
  const el = getElement(target);
  if (!el) return false;

  return Boolean(
    el.closest(
      [
        "[data-story-viewer='true']",
        "[data-live-viewer='true']",
        "[data-no-page-swipe='true']",
      ].join(",")
    )
  );
}

function SwipeTabs({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  const cleanPath = useMemo(
    () => location.split("?")[0] || "/",
    [location]
  );

  const currentIndex = SWIPE_TABS.findIndex(
    (path) => path === cleanPath
  );

  const canSwipe = currentIndex >= 0;

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);

  const trackingRef = useRef(false);
  const navLockRef = useRef(false);
  const horizontalScrollerRef = useRef<HTMLElement | null>(null);

  const [direction, setDirection] = useState<1 | -1>(1);

  const goToIndex = useCallback(
    (nextIndex: number, dir: 1 | -1) => {
      if (navLockRef.current) return;
      if (nextIndex < 0 || nextIndex >= SWIPE_TABS.length) return;

      const nextPath = SWIPE_TABS[nextIndex];
      if (!nextPath || nextPath === cleanPath) return;

      navLockRef.current = true;
      setDirection(dir);
      navigate(nextPath);

      window.setTimeout(() => {
        navLockRef.current = false;
      }, NAV_LOCK_MS);
    },
    [cleanPath, navigate]
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!canSwipe || navLockRef.current) {
        trackingRef.current = false;
        return;
      }

      if (
        hasSwipeBlocker(event.target) ||
        shouldProtectGesture(event.target)
      ) {
        trackingRef.current = false;
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        trackingRef.current = false;
        return;
      }

      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      currentXRef.current = touch.clientX;
      currentYRef.current = touch.clientY;
      startTimeRef.current = Date.now();

      horizontalScrollerRef.current =
        findHorizontalScroller(event.target);

      trackingRef.current = true;
    },
    [canSwipe]
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!trackingRef.current || !canSwipe) return;

      const touch = event.touches[0];
      if (!touch) return;

      currentXRef.current = touch.clientX;
      currentYRef.current = touch.clientY;

      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;

      // Vertical page scroll gets priority.
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
        trackingRef.current = false;
        return;
      }

      // Horizontal inner carousels get priority while they can still scroll.
      const scroller = horizontalScrollerRef.current;
      if (scroller && Math.abs(dx) > 12) {
        const maxScrollLeft =
          scroller.scrollWidth - scroller.clientWidth;

        const atLeft = scroller.scrollLeft <= 2;
        const atRight =
          scroller.scrollLeft >= maxScrollLeft - 2;

        if (
          (dx < 0 && !atRight) ||
          (dx > 0 && !atLeft)
        ) {
          trackingRef.current = false;
        }
      }
    },
    [canSwipe]
  );

  const handleTouchEnd = useCallback(() => {
    if (
      !trackingRef.current ||
      !canSwipe ||
      navLockRef.current
    ) {
      trackingRef.current = false;
      horizontalScrollerRef.current = null;
      return;
    }

    trackingRef.current = false;

    const dx =
      currentXRef.current - startXRef.current;
    const dy =
      currentYRef.current - startYRef.current;

    const elapsed = Math.max(
      1,
      Date.now() - startTimeRef.current
    );

    horizontalScrollerRef.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DOMINANCE)
      return;

    if (elapsed > 1200 && Math.abs(dx) < 140) return;

    if (dx < 0) {
      goToIndex(currentIndex + 1, 1);
    } else {
      goToIndex(currentIndex - 1, -1);
    }
  }, [canSwipe, currentIndex, goToIndex]);

  const handleTouchCancel = useCallback(() => {
    trackingRef.current = false;
    horizontalScrollerRef.current = null;
  }, []);

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden overscroll-x-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cleanPath}
          initial={{
            opacity: 0.97,
            x: direction === 1 ? 36 : -36,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          exit={{
            opacity: 0.97,
            x: direction === 1 ? -36 : 36,
          }}
          transition={{
            duration: 0.18,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="min-h-screen w-full will-change-transform"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  useServerVersionWatcher();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const localGoal = localStorage.getItem("user_goal");

  if (!(user as any).goal && !localGoal) {
    return <AimSelection />;
  }

  return (
    <>
      <SwipeTabs>
        <Switch>
          <Route
            path="/voice-rooms/create"
            component={VoiceRoomCreate}
          />
          <Route path="/buy-coins" component={BuyCoins} />
          <Route
            path="/voice-rooms/:id"
            component={VoiceRoomScreen}
          />

          <Route path="/" component={Home} />
          <Route path="/search" component={Search} />
          <Route path="/jobs" component={Jobs} />
          <Route path="/reels" component={Reels} />
          <Route path="/messages" component={Messages} />
          <Route path="/profile" component={Profile} />

          <Route path="/reading" component={Reading} />
          <Route path="/post/:id" component={PostView} />
          <Route
            path="/notifications"
            component={Notifications}
          />
          <Route path="/profile/:id" component={Profile} />
          <Route
            path="/subscription"
            component={Subscription}
          />
          <Route
            path="/Subscription"
            component={Subscription}
          />

          <Route component={NotFound} />
        </Switch>
      </SwipeTabs>

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

    if (!appId) {
      console.warn(
        "[OneSignal] VITE_ONESIGNAL_APP_ID not configured"
      );
      return;
    }

    try {
      OneSignal.initialize(appId);
      OneSignal.Notifications.requestPermission(true);
    } catch (error) {
      console.warn(
        "[OneSignal] Initialization failed:",
        error
      );
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let removeListener: (() => void) | null = null;

    CapacitorApp.addListener(
      "appUrlOpen",
      async (data) => {
        if (!data?.url?.includes("auth-callback")) return;

        try {
          await Browser.close();
        } catch {}

        if (!cancelled) {
          window.location.href = "/";
        }
      }
    )
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
              <Toaster />
              <AppContent />
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

          const fallback = await fetch(
            `${API_BASE}/api/posts`,
            {
              credentials: "include",
            }
          );

          if (!fallback.ok) return [];

          const posts = await fallback.json();

          return Array.isArray(posts)
            ? posts.filter(
                (post: any) => post?.type === "story"
              )
            : [];
        },
      }),

      queryClient.prefetchQuery({
        queryKey: ["/api/voice-rooms"],
        queryFn: async () => {
          const res = await fetch(
            `${API_BASE}/api/voice-rooms`,
            {
              credentials: "include",
            }
          );

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

  const showIntro =
    !videoEnded || authLoading || !dataReady;

  return (
    <>
      <Router />
      {showIntro && (
        <IntroVideo
          onFinish={() => setVideoEnded(true)}
        />
      )}
    </>
  );
}

export default App;