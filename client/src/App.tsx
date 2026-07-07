import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { CallProvider, useCall } from "@/contexts/CallContext";
import { VideoSettingsProvider } from "@/contexts/VideoSettingsContext";
import { VideoCallScreen } from "@/components/call/VideoCallScreen";
import { IncomingCallScreen } from "@/components/call/IncomingCallScreen";
import { useEffect, useRef } from "react";

import VoiceRoomCreate from "@/pages/VoiceRoomCreate";
import VoiceRoomScreen from "@/pages/VoiceRoomScreen";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import Reading from "@/pages/Reading";
import AimSelection from "@/pages/AimSelection";
import Reels from "@/pages/Reels";
import PrivacyPolicy from "./pages/privacypolicy";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import Notifications from "@/pages/Notifications";
import Jobs from "@/pages/Jobs";

// Polls the server version every 30s. When the server restarts (new code deployed),
// the version changes and the browser hard-reloads to pick up the latest bundle.
function useServerVersionWatcher() {
  const knownVersion = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { v } = await res.json();
        if (knownVersion.current === null) {
          knownVersion.current = v;
        } else if (knownVersion.current !== v) {
          // Server restarted — force a full reload to get latest JS
          window.location.reload();
        }
      } catch {
        // Ignore network errors (server may be restarting)
      }
    };

    check(); // Initial check
    timer = setInterval(check, 30_000); // Re-check every 30s
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

  // Goal set nahi hai toh AimSelection screen dikhao
 const localGoal = localStorage.getItem("user_goal");
  if (!(user as any).goal && !localGoal) {
    return <AimSelection />;
  }

  return (
    <>
      <Switch>
        <Route path="/voice-rooms/create" component={VoiceRoomCreate} />
        <Route path="/voice-rooms/:id" component={VoiceRoomScreen} />
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/reading" component={Reading} />
        <Route path="/reels" component={Reels} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/messages" component={Messages} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/Privacy-Policy" component={PrivacyPolicy} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/:id" component={Profile} />
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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VideoSettingsProvider>
          <CallProvider>
            <Toaster />
            <Router />
          </CallProvider>
        </VideoSettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
