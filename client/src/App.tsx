import { SplashScreen } from '@capacitor/splash-screen';
import { Switch, Route } from "wouter";
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
import { useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

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

function IntroVideo({ onFinish }: { onFinish: () => void }) {
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {
        // Video bilkul play hi nahi ho paya — turant finish kar do
        onFinish();
      });
    });
  }, []);

  // Safety net: agar 4 second me video khatam ya start hi nahi hui, force finish
  useEffect(() => {
    const timeout = setTimeout(() => {
      onFinish();
    }, 4000);
    return () => clearTimeout(timeout);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <video
        src={introVideo}
        autoPlay
        playsInline
        preload="auto"
        onCanPlay={() => setReady(true)}
        onEnded={onFinish}
        onError={onFinish}
        className="w-full h-full object-cover"
        style={{ opacity: ready ? 1 : 0 }}
      />
    </div>
  );
}

function useServerVersionWatcher() {
  const knownVersion = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/version`, { cache: "no-store" });
        if (!res.ok) return;
        const { v } = await res.json();
        if (knownVersion.current === null) {
          knownVersion.current = v;
        } else if (knownVersion.current !== v) {
          window.location.reload();
        }
      } catch {}
    };

    check();
    timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);
}

function GlobalCallOverlay() {
  const { callState } = useCall();
  return (
    <>
      {(callState === "outgoing" || callState === "active") && <VideoCallScreen />}
      {callState === "incoming" && <IncomingCallScreen />}
    </>
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
      <Switch>
        <Route path="/voice-rooms/create" component={VoiceRoomCreate} />
        <Route path="/buy-coins" component={BuyCoins} />
        <Route path="/voice-rooms/:id" component={VoiceRoomScreen} />
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/reading" component={Reading} />
        <Route path="/reels" component={Reels} />
        <Route path="/post/:id" component={PostView} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/messages" component={Messages} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/Subscription" component={Subscription} />
        <Route component={NotFound} />
      </Switch>
      <GlobalCallOverlay />
    </>
  );
}

function App() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.add("dark");
  }

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener('appUrlOpen', async (data) => {
      if (data.url.includes('auth-callback')) {
        await Browser.close();
        window.location.href = '/';
      }
    });
    return () => { listener.then(l => l.remove()); };
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
    Promise.all([
      queryClient.prefetchQuery({
        queryKey: ["/api/posts"],
        queryFn: () => fetch(`${API_BASE}/api/posts`, { credentials: "include" }).then(r => r.json()),
      }),
      queryClient.prefetchQuery({
        queryKey: ["/api/stories"],
        queryFn: () => fetch(`${API_BASE}/api/posts`, { credentials: "include" })
          .then(r => r.json())
          .then(data => Array.isArray(data) ? data.filter((p: any) => p.type === "story") : []),
      }),
      queryClient.prefetchQuery({
        queryKey: ["/api/voice-rooms"],
        queryFn: () => fetch(`${API_BASE}/api/voice-rooms`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
      }),
      queryClient.prefetchQuery({
        queryKey: ["/api/books"],
        queryFn: () => fetch(`${API_BASE}/api/books`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
      }),
    ]).finally(() => setDataReady(true));
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