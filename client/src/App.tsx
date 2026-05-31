import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Gallery from "@/pages/Gallery";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import AdminLogin from "@/pages/AdminLogin";
import NotFound from "@/pages/not-found";
import AudioPlayer, { AudioPlayerHandle } from "@/components/AudioPlayer";
import WelcomeOverlay from "@/components/WelcomeOverlay";
import { useRef, useCallback } from "react";
import { useMusicAutoplayEnabled, useMusicEnabled } from "@/hooks/useFeatureFlags";
import { LanguageProvider } from "@/contexts/LanguageContext";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/memories" component={Gallery} />
      <Route path="/admin" nest>
        <AdminLayout />
      </Route>
      <Route path="/admin-dashboard">
        <Redirect to="/admin/rsvps" replace />
      </Route>
      <Route path="/admin-login" component={AdminLogin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const audioPlayerRef = useRef<AudioPlayerHandle>(null);
  const isMusicEnabled = useMusicEnabled();
  const isMusicAutoplayEnabled = useMusicAutoplayEnabled();

  const handleOverlayDismiss = useCallback(() => {
    if (isMusicEnabled && isMusicAutoplayEnabled) {
      audioPlayerRef.current?.startAutoplay();
    }
  }, [isMusicEnabled, isMusicAutoplayEnabled]);

  return (
    <>
      <WelcomeOverlay onDismiss={handleOverlayDismiss} />
      <Router />
      <AudioPlayer ref={audioPlayerRef} />
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
