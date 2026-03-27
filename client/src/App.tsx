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

import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import Reading from "@/pages/Reading";
import Reels from "@/pages/Reels";
import Profile from "@/pages/Profile";
import Messages from "@/pages/Messages";
import Notifications from "@/pages/Notifications";

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

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/reading" component={Reading} />
        <Route path="/reels" component={Reels} />
        <Route path="/messages" component={Messages} />
        <Route path="/notifications" component={Notifications} />
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
