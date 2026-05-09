import { useState, useEffect } from "react";
import { Switch, Route, Redirect, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3, TicketCheck, Palette } from "lucide-react";
import { AdminContext } from "./AdminContext";
import RsvpPage from "./RsvpPage";
import MessagesPage from "./MessagesPage";
import ConfigPage from "./ConfigPage";
import WelcomePage from "./WelcomePage";
import FlagsPage from "./FlagsPage";
import StatsPage from "./StatsPage";
import InvitesPage from "./InvitesPage";
import DressCodePage from "./DressCodePage";

const NAV_ITEMS = [
  { path: "/rsvps", label: "RSVP", icon: Users },
  { path: "/invites", label: "Invites", icon: TicketCheck },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/config", label: "Configuration", icon: Settings },
  { path: "/welcome", label: "Welcome", icon: Mail },
  { path: "/flags", label: "Flags", icon: Flag },
  { path: "/dress-code", label: "Dress Code", icon: Palette },
  { path: "/stats", label: "Statistics", icon: BarChart3 },
];

export function AdminLayout() {
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleAutoLogout = (error: Error) => {
    if (error.message.includes("401") || error.message.includes("403")) {
      sessionStorage.removeItem("csrfToken");
      toast({
        title: "Session expired",
        description: "Your admin session has expired. Please log in again.",
        variant: "destructive",
      });
      navigate("~/admin-login", { replace: true });
    }
  };

  useEffect(() => {
    const validateSession = async () => {
      try {
        const res = await fetch("/api/admin/validate", {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.csrfToken) {
            sessionStorage.setItem("csrfToken", data.csrfToken);
          }
          setIsAuthenticated(true);
        } else if (res.status === 401) {
          navigate("~/admin-login", { replace: true });
        }
      } catch {
        // Network error — pages will surface errors
      }
    };
    validateSession();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    } catch {
      // Logout best-effort
    }
    sessionStorage.removeItem("csrfToken");
    toast({ title: "Logged out", description: "You have been logged out successfully" });
    navigate("~/admin-login", { replace: true });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="admin-loading">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
      </div>
    );
  }

  return (
    <AdminContext.Provider value={{ handleAutoLogout }}>
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50">
        {/* Header */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Toggle navigation"
              >
                <Settings className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Wedding Admin</h1>
                <p className="text-sm text-gray-600">Andreas &amp; Christine's Wedding Dashboard</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
          {/* Sidebar */}
          <nav
            className={`${
              sidebarOpen ? "block" : "hidden"
            } md:block w-full md:w-56 shrink-0`}
          >
            <div className="bg-white rounded-lg shadow-sm border p-2 space-y-1">
              {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                const isActive = location === path || (path === "/rsvps" && location === "/");
                return (
                  <Link
                    key={path}
                    href={path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-rose-50 text-rose-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Page Content */}
          <main className="flex-1 min-w-0">
            <Switch>
              <Route path="/">
                <Redirect to="/rsvps" replace />
              </Route>
              <Route path="/rsvps" component={RsvpPage} />
              <Route path="/invites" component={InvitesPage} />
              <Route path="/messages" component={MessagesPage} />
              <Route path="/config" component={ConfigPage} />
              <Route path="/welcome" component={WelcomePage} />
              <Route path="/flags" component={FlagsPage} />
              <Route path="/dress-code" component={DressCodePage} />
              <Route path="/stats" component={StatsPage} />
            </Switch>
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
