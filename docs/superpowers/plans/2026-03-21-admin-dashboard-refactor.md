# Admin Dashboard Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the 1,222-line AdminDashboard.tsx monolith into route-based admin pages with a shared layout, per-page data loading, and sidebar navigation.

**Architecture:** Replace the single tabbed dashboard with Wouter nested routes under `/admin`. A shared `AdminLayout` handles auth, nav, and auto-logout context. Each page is a standalone file with its own queries/mutations.

**Tech Stack:** React 18, TypeScript, Wouter v3.3.5 (nested routing), TanStack React Query, Shadcn/Radix UI, Vitest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-21-admin-dashboard-refactor-design.md`

---

## Dependency Graph

```
Task 0: Test Infrastructure Setup
  ↓
Task 1: useDeleteConfirmation hook ──────────────────┐
  ↓                                                   │
Task 2: AdminContext + AdminLayout ──────────────┐    │
  ↓                                               │    │
  ├── Task 3: RsvpPage      (needs Task 1, 2) ◄──┤◄───┤
  ├── Task 4: MessagesPage   (needs Task 1, 2) ◄──┤◄───┘
  ├── Task 5: ConfigPage     (needs Task 2)    ◄──┤
  ├── Task 6: WelcomePage    (needs Task 2)    ◄──┤
  ├── Task 7: FlagsPage      (needs Task 2)    ◄──┤
  └── Task 8: StatsPage      (needs Task 2)    ◄──┘
       ↓
Task 9: MusicManager context update (needs Task 2)
       ↓
Task 10: App.tsx routing + delete old file (needs all above)
       ↓
Task 11: Final verification
```

**Parallelizable:** Tasks 3–8 can all run in parallel after Tasks 0, 1, and 2 are complete. Task 1 and Task 2 can also run in parallel after Task 0.

---

## Chunk 1: Foundation (Tasks 0–2)

### Task 0: Test Infrastructure Setup

**Why:** The project has Vitest installed but no React Testing Library, no jsdom environment, no `test` script, and `vitest.config.ts` is set to `environment: "node"` with `include: ["tests/**/*.test.ts"]`. We need to configure it for React component testing.

**Files:**
- Modify: `package.json` (add test script)
- Modify: `vitest.config.ts` (add jsdom environment for component tests, expand include pattern)
- Modify: `tsconfig.json` (exclude `*.test.tsx` from type-checking)

- [ ] **Step 1: Install testing dependencies**

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Update vitest.config.ts to support React component tests**

Replace the entire file with:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [
      ["client/src/**/*.test.tsx", "jsdom"],
    ],
    include: [
      "tests/**/*.test.ts",
      "client/src/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["./client/src/test-setup.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
});
```

**Note:** Keep `environment: "node"` as default so existing `tests/**/*.test.ts` files are unaffected. The `environmentMatchGlobs` setting switches to `jsdom` only for React component tests (`*.test.tsx`).

- [ ] **Step 3: Create test setup file**

Create `client/src/test-setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Exclude test files from TypeScript type-checking**

In `tsconfig.json`, update the `exclude` array to also exclude `.test.tsx` files:

```json
"exclude": ["node_modules", "build", "dist", "**/*.test.ts", "**/*.test.tsx"]
```

- [ ] **Step 5: Add test script to package.json**

Add to the `"scripts"` section:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify test infrastructure works**

Create a smoke test at `client/src/pages/admin/__tests__/smoke.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("test infrastructure", () => {
  it("renders a React component", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
```

Run: `npm run test`
Expected: 1 test passing.

- [ ] **Step 7: Commit**

```bash
git add package.json vitest.config.ts tsconfig.json client/src/test-setup.ts client/src/pages/admin/__tests__/smoke.test.tsx
git commit -m "chore: configure Vitest + React Testing Library for component tests"
```

---

### Task 1: useDeleteConfirmation Hook

**Dependencies:** Task 0
**Files:**
- Create: `client/src/hooks/useDeleteConfirmation.ts`
- Create: `client/src/hooks/__tests__/useDeleteConfirmation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `client/src/hooks/__tests__/useDeleteConfirmation.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeleteConfirmation } from "../useDeleteConfirmation";

describe("useDeleteConfirmation", () => {
  it("initially has no item to delete", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    expect(result.current.itemToDelete).toBeNull();
  });

  it("requestDelete sets the item to delete", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.requestDelete(42));
    expect(result.current.itemToDelete).toBe(42);
  });

  it("confirmDelete calls onDelete with the item and clears it", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.requestDelete(42));
    act(() => result.current.confirmDelete());
    expect(onDelete).toHaveBeenCalledWith(42);
    expect(result.current.itemToDelete).toBeNull();
  });

  it("confirmDelete does nothing if no item is set", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.confirmDelete());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("cancelDelete clears the item without calling onDelete", () => {
    const onDelete = vi.fn();
    const { result } = renderHook(() => useDeleteConfirmation(onDelete));
    act(() => result.current.requestDelete(42));
    act(() => result.current.cancelDelete());
    expect(result.current.itemToDelete).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/hooks/__tests__/useDeleteConfirmation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `client/src/hooks/useDeleteConfirmation.ts`:

```typescript
import { useState } from "react";

export function useDeleteConfirmation(onDelete: (id: number) => void) {
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const requestDelete = (id: number) => setItemToDelete(id);

  const confirmDelete = () => {
    if (itemToDelete !== null) {
      onDelete(itemToDelete);
      setItemToDelete(null);
    }
  };

  const cancelDelete = () => setItemToDelete(null);

  return { itemToDelete, requestDelete, confirmDelete, cancelDelete };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- client/src/hooks/__tests__/useDeleteConfirmation.test.ts`
Expected: 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useDeleteConfirmation.ts client/src/hooks/__tests__/useDeleteConfirmation.test.ts
git commit -m "feat: add useDeleteConfirmation hook with tests"
```

---

### Task 2: AdminContext + AdminLayout

**Dependencies:** Task 0
**Files:**
- Create: `client/src/pages/admin/AdminContext.tsx`
- Create: `client/src/pages/admin/AdminLayout.tsx`
- Create: `client/src/pages/admin/__tests__/AdminLayout.test.tsx`

**Important Wouter v3 rules:**
- Inside `<Route path="/admin" nest>`, all child paths are relative to `/admin`. So `<Route path="/rsvps">` resolves to `/admin/rsvps`.
- To navigate **outside** the nested context (e.g., `/admin-login`), use the `~` prefix: `navigate("~/admin-login")`.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/AdminLayout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock wouter
const mockNavigate = vi.fn();
const mockLocation = "/rsvps";
vi.mock("wouter", () => ({
  useLocation: () => [mockLocation, mockNavigate],
  Switch: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ children, component: Component }: any) => {
    if (Component) return <Component />;
    return <>{children}</>;
  },
  Redirect: ({ to }: { to: string }) => <div data-testid={`redirect-${to}`} />,
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock fetch for session validation
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    sessionStorage.clear();
  });

  it("shows loading state while validating session", async () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    expect(screen.getByTestId("admin-loading")).toBeInTheDocument();
  });

  it("redirects to login on 401", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401 });
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("~/admin-login", expect.anything());
    });
  });

  it("renders sidebar nav links when authenticated", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: "test-token" }),
    });
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(screen.getByText("RSVP")).toBeInTheDocument();
    });
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Flags")).toBeInTheDocument();
    expect(screen.getByText("Statistics")).toBeInTheDocument();
  });

  it("stores CSRF token from validation response", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: "new-csrf-token" }),
    });
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(sessionStorage.getItem("csrfToken")).toBe("new-csrf-token");
    });
  });

  it("logout clears session and redirects", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: "tok" }) }) // validate
      .mockResolvedValueOnce({ ok: true }); // logout
    const { AdminLayout } = await import("../AdminLayout");
    renderWithProviders(<AdminLayout />);
    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("Logout"));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("~/admin-login", expect.anything());
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/pages/admin/__tests__/AdminLayout.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create AdminContext**

Create `client/src/pages/admin/AdminContext.tsx`:

```tsx
import { createContext, useContext } from "react";

interface AdminContextType {
  handleAutoLogout: (error: Error) => void;
}

export const AdminContext = createContext<AdminContextType>({
  handleAutoLogout: () => {},
});

export const useAdminContext = () => useContext(AdminContext);
```

- [ ] **Step 4: Create AdminLayout**

Create `client/src/pages/admin/AdminLayout.tsx`:

```tsx
import { useState, useEffect } from "react";
import { Switch, Route, Redirect, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3 } from "lucide-react";
import { AdminContext } from "./AdminContext";

// Lazy imports for pages (will be added as pages are created)
// import RsvpPage from "./RsvpPage";
// etc.

const NAV_ITEMS = [
  { path: "/rsvps", label: "RSVP", icon: Users },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/config", label: "Configuration", icon: Settings },
  { path: "/welcome", label: "Welcome", icon: Mail },
  { path: "/flags", label: "Flags", icon: Flag },
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
                <p className="text-sm text-gray-600">Andreas & Christine's Wedding Dashboard</p>
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
              {/* Page routes will be added as pages are created in Tasks 3-8 */}
              {/* <Route path="/rsvps" component={RsvpPage} /> */}
              {/* <Route path="/messages" component={MessagesPage} /> */}
              {/* <Route path="/config" component={ConfigPage} /> */}
              {/* <Route path="/welcome" component={WelcomePage} /> */}
              {/* <Route path="/flags" component={FlagsPage} /> */}
              {/* <Route path="/stats" component={StatsPage} /> */}
            </Switch>
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- client/src/pages/admin/__tests__/AdminLayout.test.tsx`
Expected: All 5 tests passing.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/AdminContext.tsx client/src/pages/admin/AdminLayout.tsx client/src/pages/admin/__tests__/AdminLayout.test.tsx
git commit -m "feat: add AdminLayout with auth guard, sidebar nav, and AdminContext"
```

---

## Chunk 2: Page Components (Tasks 3–8)

> **All tasks in this chunk can run in parallel.** Each task creates one page + its tests. They all depend on Tasks 0, 1, and 2 being complete.

### Task 3: RsvpPage

**Dependencies:** Tasks 0, 1, 2
**Files:**
- Create: `client/src/pages/admin/RsvpPage.tsx`
- Create: `client/src/pages/admin/__tests__/RsvpPage.test.tsx`

**Source reference:** `client/src/pages/AdminDashboard.tsx` lines 70-77 (query), 177-210 (delete mutation/state), 384-405 (stats calculation), 432-457 (stats cards), 722-830 (tab content)

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/RsvpPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
  AdminContext: { Provider: ({ children }: any) => children },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/rsvps", vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import RsvpPage from "../RsvpPage";

const mockRsvpData = {
  rsvps: [
    { id: 1, name: "Alice", email: "alice@test.com", attending: true, guestCount: 2 },
    { id: 2, name: "Bob", email: "bob@test.com", attending: false, guestCount: 0 },
  ],
  stats: { attending: 1, guestCount: 2, notAttending: 1 },
};

function createTestQueryClient(data: any = mockRsvpData) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["/api/rsvp"], data);
  return client;
}

function renderRsvpPage(queryClient?: QueryClient) {
  const qc = queryClient ?? createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}><RsvpPage /></QueryClientProvider>
  );
}

describe("RsvpPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders stats cards with correct counts", () => {
    renderRsvpPage();
    expect(screen.getByText("1")).toBeInTheDocument(); // attending
    expect(screen.getByText("2")).toBeInTheDocument(); // total guests
  });

  it("renders RSVP entries with names and emails", () => {
    renderRsvpPage();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows attending badge for attending guests", () => {
    renderRsvpPage();
    expect(screen.getByText("Attending")).toBeInTheDocument();
    expect(screen.getByText("Not Attending")).toBeInTheDocument();
  });

  it("shows empty state when no RSVPs", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(["/api/rsvp"], { rsvps: [], stats: { attending: 0, guestCount: 0, notAttending: 0 } });
    renderRsvpPage(qc);
    expect(screen.getByText("No RSVP responses yet")).toBeInTheDocument();
  });

  it("shows delete confirmation when trash button clicked", async () => {
    renderRsvpPage();
    const trashButtons = screen.getAllByRole("button", { name: "" }); // trash icon buttons
    await userEvent.click(trashButtons[0]);
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/pages/admin/__tests__/RsvpPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement RsvpPage**

Create `client/src/pages/admin/RsvpPage.tsx`. Extract from `AdminDashboard.tsx`:
- The RSVP query (lines 70-77)
- The delete RSVP mutation (lines 178-197)
- The `calculateAttendance` helper (lines 384-405)
- The stats cards JSX (lines 432-457)
- The RSVP table JSX (lines 722-830)
- Use `useDeleteConfirmation` hook instead of local `rsvpToDelete` state
- Use `useAdminContext().handleAutoLogout` for error handling

The component should:
1. Fetch `/api/rsvp` via `useQuery`
2. Calculate stats from the response
3. Render two stat cards at the top (Attending / Total Guests)
4. Render the RSVP list below with delete confirmation using `useDeleteConfirmation`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- client/src/pages/admin/__tests__/RsvpPage.test.tsx`
Expected: All tests passing.

- [ ] **Step 5: Run TypeScript check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/RsvpPage.tsx client/src/pages/admin/__tests__/RsvpPage.test.tsx
git commit -m "feat: add RsvpPage with stats cards, RSVP list, and delete confirmation"
```

---

### Task 4: MessagesPage

**Dependencies:** Tasks 0, 1, 2
**Files:**
- Create: `client/src/pages/admin/MessagesPage.tsx`
- Create: `client/src/pages/admin/__tests__/MessagesPage.test.tsx`

**Source reference:** `client/src/pages/AdminDashboard.tsx` lines 120-157 (query + mutation), 159-170 (delete state), 833-920 (tab content)

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/MessagesPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/messages", vi.fn()],
}));

import MessagesPage from "../MessagesPage";

const mockMessages = {
  messages: [
    { id: 1, name: "Alice", email: "alice@test.com", content: "Congrats!", createdAt: "2026-03-20T10:00:00Z" },
    { id: 2, name: "Bob", email: "bob@test.com", content: "So happy for you!", createdAt: "2026-03-20T11:00:00Z" },
  ],
};

function renderMessagesPage(data: any = mockMessages) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/messages"], data);
  return render(
    <QueryClientProvider client={qc}><MessagesPage /></QueryClientProvider>
  );
}

describe("MessagesPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders message list with names and content", () => {
    renderMessagesPage();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Congrats!")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("So happy for you!")).toBeInTheDocument();
  });

  it("shows total message count", () => {
    renderMessagesPage();
    expect(screen.getByText("Total messages: 2")).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    renderMessagesPage({ messages: [] });
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("shows delete confirmation on trash click", async () => {
    renderMessagesPage();
    const trashButtons = screen.getAllByRole("button");
    const deleteBtn = trashButtons.find(btn => btn.querySelector(".lucide-trash-2"));
    if (deleteBtn) await userEvent.click(deleteBtn);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/pages/admin/__tests__/MessagesPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement MessagesPage**

Create `client/src/pages/admin/MessagesPage.tsx`. Extract from `AdminDashboard.tsx`:
- The messages query (lines 120-135)
- The delete message mutation (lines 138-157)
- The messages tab JSX (lines 833-920)
- Use `useDeleteConfirmation` hook
- Use `useAdminContext().handleAutoLogout` for error handling
- Import `Message` from `@shared/schema`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- client/src/pages/admin/__tests__/MessagesPage.test.tsx`
Expected: All tests passing.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/MessagesPage.tsx client/src/pages/admin/__tests__/MessagesPage.test.tsx
git commit -m "feat: add MessagesPage with message list and delete confirmation"
```

---

### Task 5: ConfigPage

**Dependencies:** Tasks 0, 2
**Files:**
- Create: `client/src/pages/admin/ConfigPage.tsx`
- Create: `client/src/pages/admin/__tests__/ConfigPage.test.tsx`

**Source reference:** `client/src/pages/AdminDashboard.tsx` lines 265-367 (egift state/query/mutation, thumbnail mutation), 488-719 (tab content including Google Drive, ImageManager, MusicManager, E-Gift form, thumbnail section)

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/ConfigPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/config", vi.fn()],
}));

// Mock ImageManager and MusicManager to isolate ConfigPage tests
vi.mock("@/components/ImageManager", () => ({
  default: () => <div data-testid="image-manager">ImageManager</div>,
}));

vi.mock("@/components/MusicManager", () => ({
  default: () => <div data-testid="music-manager">MusicManager</div>,
}));

import ConfigPage from "../ConfigPage";

function renderConfigPage(settings: any[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/app-settings"], { settings });
  return render(
    <QueryClientProvider client={qc}><ConfigPage /></QueryClientProvider>
  );
}

describe("ConfigPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Google Drive section", () => {
    renderConfigPage();
    expect(screen.getByText("Google Drive Integration")).toBeInTheDocument();
    expect(screen.getByText("Configure Google Drive OAuth")).toBeInTheDocument();
  });

  it("renders ImageManager component", () => {
    renderConfigPage();
    expect(screen.getByTestId("image-manager")).toBeInTheDocument();
  });

  it("renders MusicManager component", () => {
    renderConfigPage();
    expect(screen.getByTestId("music-manager")).toBeInTheDocument();
  });

  it("renders E-Gift form", () => {
    renderConfigPage();
    expect(screen.getByText("E-Gift Bank Accounts")).toBeInTheDocument();
    expect(screen.getByLabelText("Account Holder Name")).toBeDefined();
  });

  it("renders Gallery Performance section", () => {
    renderConfigPage();
    expect(screen.getByText("Gallery Performance")).toBeInTheDocument();
    expect(screen.getByText("Generate Gallery Thumbnails")).toBeInTheDocument();
  });

  it("loads e-gift settings into form", () => {
    const settings = [
      { settingKey: "egift_groom_name", settingValue: "Andreas" },
      { settingKey: "egift_groom_bank", settingValue: "BCA" },
    ];
    renderConfigPage(settings);
    expect(screen.getByDisplayValue("Andreas")).toBeInTheDocument();
    expect(screen.getByDisplayValue("BCA")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/pages/admin/__tests__/ConfigPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement ConfigPage**

Create `client/src/pages/admin/ConfigPage.tsx`. Extract from `AdminDashboard.tsx`:
- E-Gift state, query, mutation (lines 265-335)
- Thumbnail migration state and mutation (lines 337-367)
- The entire config tab JSX (lines 488-719)
- Pass `useAdminContext().handleAutoLogout` to `MusicManager` via its `onAutoLogout` prop (until Task 9 updates MusicManager)
- Import `ImageManager` and `MusicManager` as before

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- client/src/pages/admin/__tests__/ConfigPage.test.tsx`
Expected: All tests passing.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/ConfigPage.tsx client/src/pages/admin/__tests__/ConfigPage.test.tsx
git commit -m "feat: add ConfigPage with Google Drive, images, music, e-gift, and thumbnails"
```

---

### Task 6: WelcomePage

**Dependencies:** Tasks 0, 2
**Files:**
- Create: `client/src/pages/admin/WelcomePage.tsx`
- Create: `client/src/pages/admin/__tests__/WelcomePage.test.tsx`

**Source reference:** `client/src/pages/AdminDashboard.tsx` lines 212-263 (welcome state/query/mutation), 996-1110 (tab content)

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/WelcomePage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/welcome", vi.fn()],
}));

import WelcomePage from "../WelcomePage";

const mockWelcomeData = {
  welcomeScreen: {
    headingText: "The Wedding of A & C",
    deliveryLabel: "Kindly Delivered to",
    fallbackName: "Our Dearest Guest",
    enabled: true,
  },
};

function renderWelcomePage(data: any = mockWelcomeData) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/welcome-screen"], data);
  return render(
    <QueryClientProvider client={qc}><WelcomePage /></QueryClientProvider>
  );
}

describe("WelcomePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders form with loaded welcome screen data", () => {
    renderWelcomePage();
    expect(screen.getByDisplayValue("The Wedding of A & C")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Kindly Delivered to")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Our Dearest Guest")).toBeInTheDocument();
  });

  it("renders preview section", () => {
    renderWelcomePage();
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("renders usage instructions", () => {
    renderWelcomePage();
    expect(screen.getByText("How to Use")).toBeInTheDocument();
  });

  it("has a save button", () => {
    renderWelcomePage();
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/pages/admin/__tests__/WelcomePage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement WelcomePage**

Create `client/src/pages/admin/WelcomePage.tsx`. Extract from `AdminDashboard.tsx`:
- Welcome screen state and query (lines 212-236)
- Welcome screen mutation (lines 239-263)
- The welcome tab JSX (lines 996-1110)
- Use `useAdminContext().handleAutoLogout` for error handling
- Import `WelcomeScreen` from `@shared/schema`
- **Do NOT include the enabled toggle** — that stays on FlagsPage per spec

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- client/src/pages/admin/__tests__/WelcomePage.test.tsx`
Expected: All tests passing.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/WelcomePage.tsx client/src/pages/admin/__tests__/WelcomePage.test.tsx
git commit -m "feat: add WelcomePage with welcome screen text configuration"
```

---

### Task 7: FlagsPage

**Dependencies:** Tasks 0, 2
**Files:**
- Create: `client/src/pages/admin/FlagsPage.tsx`
- Create: `client/src/pages/admin/__tests__/FlagsPage.test.tsx`

**Source reference:** `client/src/pages/AdminDashboard.tsx` lines 79-118 (feature flags query + mutation), 212-236 (welcome query for enabled toggle), 1113-1222 (tab content)

**Important:** Import `FeatureFlag` from `@shared/schema` — do NOT re-declare the interface. Also fetches `/api/welcome-screen` for the welcome screen enabled toggle.

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/FlagsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/flags", vi.fn()],
}));

import FlagsPage from "../FlagsPage";

const mockFlags = {
  featureFlags: [
    { id: 1, featureKey: "rsvp", featureName: "RSVP Form", description: "RSVP form toggle", enabled: true, updatedAt: "2026-03-20" },
    { id: 2, featureKey: "gallery", featureName: "Photo Gallery", description: "Gallery toggle", enabled: false, updatedAt: "2026-03-20" },
  ],
};

const mockWelcome = {
  welcomeScreen: { headingText: "", deliveryLabel: "", fallbackName: "", enabled: true },
};

function renderFlagsPage(flags = mockFlags, welcome = mockWelcome) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/feature-flags"], flags);
  qc.setQueryData(["/api/welcome-screen"], welcome);
  return render(
    <QueryClientProvider client={qc}><FlagsPage /></QueryClientProvider>
  );
}

describe("FlagsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders feature flag toggles", () => {
    renderFlagsPage();
    expect(screen.getByText("RSVP Form")).toBeInTheDocument();
    expect(screen.getByText("Photo Gallery")).toBeInTheDocument();
  });

  it("shows enabled/disabled badges", () => {
    renderFlagsPage();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders welcome screen toggle", () => {
    renderFlagsPage();
    expect(screen.getByText("Enable Welcome Screen")).toBeInTheDocument();
  });

  it("shows feature key codes", () => {
    renderFlagsPage();
    expect(screen.getByText("rsvp")).toBeInTheDocument();
    expect(screen.getByText("gallery")).toBeInTheDocument();
  });

  it("shows info box about feature flags", () => {
    renderFlagsPage();
    expect(screen.getByText("How Feature Flags Work")).toBeInTheDocument();
  });

  it("shows empty state when no flags", () => {
    renderFlagsPage({ featureFlags: [] });
    expect(screen.getByText("No additional feature flags configured")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/pages/admin/__tests__/FlagsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement FlagsPage**

Create `client/src/pages/admin/FlagsPage.tsx`. Extract from `AdminDashboard.tsx`:
- Feature flags query (lines 79-95) and mutation (lines 98-118)
- Welcome screen query (lines 221-224) and the enabled toggle portion of the welcome mutation
- The flags tab JSX (lines 1113-1222) including the welcome screen toggle at the top
- Import `FeatureFlag` type from `@shared/schema`
- Use `useAdminContext().handleAutoLogout` for error handling

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- client/src/pages/admin/__tests__/FlagsPage.test.tsx`
Expected: All tests passing.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/FlagsPage.tsx client/src/pages/admin/__tests__/FlagsPage.test.tsx
git commit -m "feat: add FlagsPage with feature flags and welcome screen toggle"
```

---

### Task 8: StatsPage

**Dependencies:** Tasks 0, 2
**Files:**
- Create: `client/src/pages/admin/StatsPage.tsx`
- Create: `client/src/pages/admin/__tests__/StatsPage.test.tsx`

**Source reference:** `client/src/pages/AdminDashboard.tsx` lines 384-405 (calculateAttendance), 923-993 (stats tab content)

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/StatsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: vi.fn() }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/stats", vi.fn()],
}));

import StatsPage from "../StatsPage";

const mockRsvpData = {
  rsvps: [
    { id: 1, name: "Alice", attending: true, guestCount: 3 },
    { id: 2, name: "Bob", attending: true, guestCount: 2 },
    { id: 3, name: "Carol", attending: false, guestCount: 0 },
  ],
};

function renderStatsPage(data = mockRsvpData) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(["/api/rsvp"], data);
  return render(
    <QueryClientProvider client={qc}><StatsPage /></QueryClientProvider>
  );
}

describe("StatsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders attending count", () => {
    renderStatsPage();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 attending
    expect(screen.getByText("Confirmed Attending")).toBeInTheDocument();
  });

  it("renders not attending count", () => {
    renderStatsPage();
    expect(screen.getByText("1")).toBeInTheDocument(); // 1 not attending
    expect(screen.getByText("Not Attending")).toBeInTheDocument();
  });

  it("renders total guest count", () => {
    renderStatsPage();
    expect(screen.getByText("5")).toBeInTheDocument(); // 3 + 2
    expect(screen.getByText("Total Expected Guests")).toBeInTheDocument();
  });

  it("renders attendance rate percentage", () => {
    renderStatsPage();
    expect(screen.getByText("67%")).toBeInTheDocument(); // 2/3 = 67%
  });

  it("renders total responses", () => {
    renderStatsPage();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Total Responses")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- client/src/pages/admin/__tests__/StatsPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement StatsPage**

Create `client/src/pages/admin/StatsPage.tsx`. Extract from `AdminDashboard.tsx`:
- Reuse the `calculateAttendance` logic (lines 384-405)
- The stats tab JSX (lines 923-993) — stat cards + response summary
- Fetch `/api/rsvp` via `useQuery`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- client/src/pages/admin/__tests__/StatsPage.test.tsx`
Expected: All tests passing.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/StatsPage.tsx client/src/pages/admin/__tests__/StatsPage.test.tsx
git commit -m "feat: add StatsPage with attendance analytics"
```

---

## Chunk 3: Integration (Tasks 9–11)

### Task 9: Update MusicManager Context Fallback

**Dependencies:** Task 2
**Files:**
- Modify: `client/src/components/MusicManager.tsx`

- [ ] **Step 1: Update MusicManager to support optional onAutoLogout with context fallback**

In `client/src/components/MusicManager.tsx`:

1. Make `onAutoLogout` optional in the props interface:
```typescript
interface MusicManagerProps {
  onAutoLogout?: (error: Error) => void;
}
```

2. Import and use context as fallback:
```typescript
import { useAdminContext } from "@/pages/admin/AdminContext";

const MusicManager = ({ onAutoLogout }: MusicManagerProps) => {
  const adminContext = useAdminContext();
  const autoLogout = onAutoLogout ?? adminContext.handleAutoLogout;
  // Replace all onAutoLogout(error) calls with autoLogout(error)
```

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/MusicManager.tsx
git commit -m "refactor: make MusicManager onAutoLogout optional with AdminContext fallback"
```

---

### Task 10: Update App.tsx Routing + Delete AdminDashboard

**Dependencies:** All Tasks 1–9
**Files:**
- Modify: `client/src/App.tsx`
- Delete: `client/src/pages/AdminDashboard.tsx`
- Delete: `client/src/pages/admin/__tests__/smoke.test.tsx` (no longer needed)

- [ ] **Step 1: Uncomment page imports in AdminLayout.tsx**

In `client/src/pages/admin/AdminLayout.tsx`, uncomment and add all page imports and route definitions:

```tsx
import RsvpPage from "./RsvpPage";
import MessagesPage from "./MessagesPage";
import ConfigPage from "./ConfigPage";
import WelcomePage from "./WelcomePage";
import FlagsPage from "./FlagsPage";
import StatsPage from "./StatsPage";
```

And in the `<Switch>`:

```tsx
<Switch>
  <Route path="/"><Redirect to="/rsvps" replace /></Route>
  <Route path="/rsvps" component={RsvpPage} />
  <Route path="/messages" component={MessagesPage} />
  <Route path="/config" component={ConfigPage} />
  <Route path="/welcome" component={WelcomePage} />
  <Route path="/flags" component={FlagsPage} />
  <Route path="/stats" component={StatsPage} />
</Switch>
```

- [ ] **Step 2: Update App.tsx**

Replace the admin routes in `client/src/App.tsx`:

```tsx
import { Switch, Route, Redirect } from "wouter";
// ... other existing imports ...
import { AdminLayout } from "@/pages/admin/AdminLayout";
import AdminLogin from "@/pages/AdminLogin";
// Remove: import AdminDashboard from "@/pages/AdminDashboard";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/memories" component={Gallery} />
      <Route path="/memories-drive" component={MemoriesGoogleDrive} />
      <Route path="/memories-upload" component={MemoriesGoogleDriveUpload} />
      <Route path="/google-drive-setup" component={GoogleDriveSetup} />
      <Route path="/google-drive-instructions" component={GoogleDriveInstructions} />
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
```

- [ ] **Step 3: Delete AdminDashboard.tsx**

```bash
rm client/src/pages/AdminDashboard.tsx
rm client/src/pages/admin/__tests__/smoke.test.tsx
```

- [ ] **Step 4: Run TypeScript check**

Run: `npm run check`
Expected: No errors. No remaining imports of `AdminDashboard`.

- [ ] **Step 5: Run all tests**

Run: `npm run test`
Expected: All tests passing.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire up route-based admin pages and remove AdminDashboard monolith"
```

---

### Task 11: Final Verification

**Dependencies:** Task 10

- [ ] **Step 1: Run full test suite**

```bash
npm run test
npm run check
```

Expected: All tests passing, no TypeScript errors.

- [ ] **Step 2: Manual smoke test**

Start the dev server and verify:

```bash
npm run dev
```

1. Navigate to `/admin` — should redirect to `/admin/rsvps`
2. Navigate to `/admin-dashboard` — should redirect to `/admin/rsvps`
3. Click each sidebar nav link — page changes, data loads per-page
4. Verify `/admin/rsvps` shows stats cards + RSVP list
5. Verify `/admin/messages` shows message list
6. Verify `/admin/config` shows all config sections
7. Verify `/admin/welcome` shows welcome screen form
8. Verify `/admin/flags` shows feature flags + welcome toggle
9. Verify `/admin/stats` shows attendance analytics
10. Test deep linking: directly navigate to `/admin/flags` — should work
11. Test mobile: resize browser, verify sidebar collapses
12. Test logout: click logout, verify redirect to login

- [ ] **Step 3: Commit any fixes from manual testing**

If any fixes needed, commit them individually.

- [ ] **Step 4: Final commit message**

If all is clean:
```bash
git log --oneline -12
```

Verify the commit history is clean and each task has its own commit.
