import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Messages from "@/pages/Messages";
import Gallery from "@/pages/Gallery";
import MemoriesGoogleDrive from "@/pages/MemoriesGoogleDrive";
import MemoriesGoogleDriveUpload from "@/pages/MemoriesGoogleDriveUpload";
import GoogleDriveSetup from "@/pages/GoogleDriveSetup";
import GoogleDriveInstructions from "@/pages/GoogleDriveInstructions";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminLogin from "@/pages/AdminLogin";
import NotFound from "@/pages/not-found";
import AudioPlayer from "@/components/AudioPlayer";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/messages" component={Messages} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/memories" component={Gallery} />
      <Route path="/memories-drive" component={MemoriesGoogleDrive} />
      <Route path="/memories-upload" component={MemoriesGoogleDriveUpload} />
      <Route path="/google-drive-setup" component={GoogleDriveSetup} />
      <Route path="/google-drive-instructions" component={GoogleDriveInstructions} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin-dashboard" component={AdminDashboard} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <AudioPlayer />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
