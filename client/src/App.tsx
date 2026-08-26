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

// Main tabs swipe order.
// BottomNav order should match this order.
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
      video.play().catch(() => {
        onFinish();
      });
    });
  }, [onFinish]);

  useEffect(() => {
    const timeout = window.setTimeout(onFinish, 4000);
    return () => window.clearTimeout(timeout);
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
        const v = String(data?.v ?? "");

        if (!v) return;

        if (knownVersion.current === null) {
          knownVersion.current = v;
          return;
        }

        if (knownVersion.current !== v) {
          window.location.reload();
        }
      } catch {
        // Network/version check should never break the app.
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

// ─────────────────────────────────────────────────────────────────────────────
// Swipe navigation helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function isVideoLikeTarget(target: EventTarget | null): boolean {
  const el = getElement(target);
  if (!el) return false;

  return Boolean(
    el.closest(
      [
        "video",
        "[data-reels-feed='true']",
        "[data-story-viewer='true']",
        "[data-live-viewer='true']",
      ].join(",")
    )
  );
}

function SwipeTabs({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  const cleanPath = useMemo(() => location.split("?")[0] || "/", [location]);

  const currentIndex = SWIPE_TABS.findIndex((path) => path === cleanPath);

  const canSwipe =
    currentIndex >= 0 &&
    !cleanPath.startsWith("/voice-rooms") &&
    !cleanPath.startsWith("/post/");

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const startTimeRef = useRef(0);

  const trackingRef = useRef(false);
  const lockRef = useRef(false);
  const horizontalScrollerRef = useRef<HTMLElement | null>(null);

  const [direction, setDirection] = useState<1 | -1>(1);

  const navigateToIndex = useCallback(
    (nextIndex: number, dir: 1 | -1) => {
      if (lockRef.current) return;
      if (nextIndex < 0 || nextIndex >= SWIPE_TABS.length) return;

      const nextPath = SWIPE_TABS[nextIndex];
      if (!nextPath || nextPath === cleanPath) return;

      lockRef.current = true;
      setDirection(dir);
      navigate(nextPath);

      window.setTimeout(() => {
        lockRef.current = false;
      }, NAV_LOCK_MS);
    },
    [cleanPath, navigate]
  );

  const onTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!canSwipe || lockRef.current) {
        trackingRef.current = false;
        return;
      }

      if (hasSwipeBlocker(event.target)) {
        trackingRef.current = false;
        return;
      }

      // Reels / Story / Live can have their own gestures.
      if (isVideoLikeTarget(event.target)) {
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

      horizontalScrollerRef.current = findHorizontalScroller(event.target);
      trackingRef.current = true;
    },
    [canSwipe]
  );

  const onTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!trackingRef.current || !canSwipe) return;

      const touch = event.touches[0];
      if (!touch) return;

      currentXRef.current = touch.clientX;
      currentYRef.current = touch.clientY;

      const dx = touch.clientX - startXRef.current;
      const dy = touch.clientY - startYRef.current;

      // If the gesture becomes clearly vertical, let normal page scrolling win.
      if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
        trackingRef.current = false;
        return;
      }

      const scroller = horizontalScrollerRef.current;
      if (scroller && Math.abs(dx) > 12) {
        const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
        const atLeftEdge = scroller.scrollLeft <= 2;
        const atRightEdge = scroller.scrollLeft >= maxScrollLeft - 2;

        // Horizontal child gets priority while it can still scroll.
        if (
          (dx < 0 && !atRightEdge) ||
          (dx > 0 && !atLeftEdge)
        ) {
          trackingRef.current = false;
        }
      }
    },
    [canSwipe]
  );

  const onTouchEnd = useCallback(() => {
    if (!trackingRef.current || !canSwipe || lockRef.current) {
      trackingRef.current = false;
      horizontalScrollerRef.current = null;
      return;
    }

    trackingRef.current = false;

    const dx = currentXRef.current - startXRef.current;
    const dy = currentYRef.current - startYRef.current;
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);

    horizontalScrollerRef.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) <= Math.abs(dy) * SWIPE_DOMINANCE) return;

    // Very slow drag usually means the user was scrolling/selecting, not paging.
    if (elapsed > 1200 && Math.abs(dx) < 140) return;

    if (dx < 0) {
      navigateToIndex(currentIndex + 1, 1);
    } else {
      navigateToIndex(currentIndex - 1, -1);
    }
  }, [canSwipe, currentIndex, navigateToIndex]);

  const onTouchCancel = useCallback(() => {
    trackingRef.current = false;
    horizontalScrollerRef.current = null;
  }, []);

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden overscroll-x-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={cleanPath}
          initial={{
            opacity: 0.96,
            x: direction === 1 ? 42 : -42,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          exit={{
            opacity: 0.96,
            x: direction === 1 ? -42 : 42,
          }}
          transition={{
            duration: 0.2,
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
          <Route path="/Subscription" component={Subscription} />

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
      console.warn("[OneSignal] VITE_ONESIGNAL_APP_ID is not configured");
      return;
    }

    try {
      OneSignal.initialize(appId);
      OneSignal.Notifications.requestPermission(true);
    } catch (error) {
      console.warn("[OneSignal] Initialization failed:", error);
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
          // Prefer the dedicated endpoint; fallback safely.
          const res = await fetch(`${API_BASE}/api/stories`, {
            credentials: "include",
          });

          if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
          }

          const postsRes = await fetch(`${API_BASE}/api/posts`, {
            credentials: "include",
          });

          if (!postsRes.ok) return [];

          const posts = await postsRes.json();
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