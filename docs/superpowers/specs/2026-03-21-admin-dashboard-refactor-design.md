# Admin Dashboard Refactor: Route-Based Pages + UX Improvements

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Refactor + small UX improvements (no new features, no visual redesign)

## Problem

`AdminDashboard.tsx` is a 1,222-line monolith containing 6 tab panels, ~400 lines of hooks (queries, mutations, state, effects) declared at the top of one function, and all tab data loading on mount regardless of which tab is active. This makes the file hard to maintain, slow to load, and difficult to extend.

## Solution

Decompose the monolithic admin dashboard into route-based pages with a shared layout. Each page is a standalone file that only fetches its own data.

## Route Structure

| Route | Page Component | Data Loaded |
|-------|---------------|-------------|
| `/admin` | Redirects to `/admin/rsvps` | — |
| `/admin/rsvps` | `RsvpPage` | RSVPs only |
| `/admin/messages` | `MessagesPage` | Messages only |
| `/admin/config` | `ConfigPage` | Config images, app settings |
| `/admin/welcome` | `WelcomePage` | Welcome screen |
| `/admin/flags` | `FlagsPage` | Feature flags + welcome screen (for enable toggle) |
| `/admin/stats` | `StatsPage` | RSVPs (for stats) |
| `/admin-login` | `AdminLogin` (unchanged) | — |

The old `/admin-dashboard` route redirects to `/admin/rsvps` for backward compatibility.

### Wouter Nested Routing (v3.3.5)

The project uses Wouter v3.3.5, which supports nested routing via the `nest` prop on `<Route>`. In `App.tsx`:

```tsx
// App.tsx — replaces the old /admin and /admin-dashboard routes
<Route path="/admin" nest>
  <AdminLayout />
</Route>
<Route path="/admin-dashboard">
  <Redirect to="/admin/rsvps" replace />
</Route>
```

Inside `AdminLayout`, a nested `<Switch>` uses paths **relative to the `/admin` base**:

```tsx
// AdminLayout.tsx — nested routes resolve relative to /admin
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

**Path resolution rule in nested Wouter routes:** Inside `<Route path="/admin" nest>`, all paths are relative to `/admin`. So `/rsvps` resolves to `/admin/rsvps`. To navigate **outside** the nested context (e.g., to `/admin-login`), use the `~` prefix: `navigate("~/admin-login")`. Without `~`, Wouter prepends the base, so `navigate("/admin-login")` would incorrectly go to `/admin/admin-login`.

Redirects use Wouter's `<Redirect>` component with `replace` to avoid polluting browser history.

## Shared Admin Layout

A new `AdminLayout` component wraps all `/admin/*` pages:

- **Auth guard:** Validates session on mount via `POST /api/admin/validate`, redirects to `/admin-login` if unauthenticated (using `navigate("~/admin-login")` to escape the nested `/admin` base). Runs once, shared by all pages.
- **Sidebar nav:** Vertical nav on desktop (left side), collapsible on mobile (horizontal icon bar or hamburger). Shows route links with icons, highlights active route via Wouter's `useLocation`.
- **Header:** "Wedding Admin" title + logout button.
- **Auto-logout context:** `AdminLayout` provides a `handleAutoLogout` function via React Context (`AdminContext`). Any child page or component (e.g., `MusicManager`) can consume this context instead of receiving the function as a prop. This eliminates the need to thread `onAutoLogout` through multiple component layers.

```tsx
// AdminContext — created in AdminLayout, consumed by pages and components
const AdminContext = createContext<{ handleAutoLogout: (error: Error) => void }>(…);
export const useAdminContext = () => useContext(AdminContext);
```

`MusicManager` currently receives `onAutoLogout` as a prop. In `ConfigPage`, it will instead use `useAdminContext().handleAutoLogout`. The `MusicManager` prop interface should be updated to make `onAutoLogout` optional (falling back to the context) to keep backward compatibility during the transition.

```
Desktop layout:
┌──────────────────────────────────────────┐
│  Wedding Admin                  [Logout] │
├────────┬─────────────────────────────────┤
│  Nav   │                                 │
│        │   Page Content                  │
│  RSVP  │   (loaded per-route)            │
│  Msgs  │                                 │
│  Config│                                 │
│  Welc  │                                 │
│  Flags │                                 │
│  Stats │                                 │
└────────┴─────────────────────────────────┘

Mobile: sidebar collapses to bottom icon bar or top hamburger menu.
```

### Stats Cards Placement

The current dashboard shows two summary stat cards (Attending / Total Guests) above all tabs, always visible. In the new layout:

- **Stats cards move to `RsvpPage` only** — this is the page where attendance data is most relevant. They appear at the top of the RSVP page, above the table.
- **`StatsPage`** provides a more detailed breakdown (attending, not attending, total guests, per-RSVP detail).
- Stats cards are NOT shown on every page — that would require fetching RSVP data in the layout regardless of which page is active, defeating the purpose of per-page data loading.

## Page Decomposition

All new page files live under `client/src/pages/admin/`:

| File | Contents | Est. Lines |
|------|----------|-----------|
| `AdminLayout.tsx` | Auth guard, sidebar nav, header, logout, AdminContext provider, nested `<Switch>` | ~140 |
| `RsvpPage.tsx` | Stats cards + RSVP table with delete confirmations | ~150 |
| `MessagesPage.tsx` | Message list with delete confirmations | ~120 |
| `ConfigPage.tsx` | Google Drive link, ImageManager, MusicManager, E-Gift form, thumbnail migration | ~200 |
| `WelcomePage.tsx` | Welcome screen form (heading, delivery label, fallback name) | ~110 |
| `FlagsPage.tsx` | Feature flag toggles + welcome screen enabled/disabled toggle | ~130 |
| `StatsPage.tsx` | Attendance breakdown (attending, not attending, total guests) | ~80 |

### FlagsPage: Welcome Screen Toggle

The current flags tab contains both feature flag toggles AND a welcome screen enabled/disabled toggle. These are conceptually related (both are "toggles that control what guests see"), so they stay together on `FlagsPage`.

This means `FlagsPage` fetches both `/api/feature-flags` and `/api/welcome-screen`, and manages the welcome screen enable mutation. The `WelcomePage` handles only the text content (heading, delivery label, fallback name) — not the enabled toggle.

### Type Cleanup

The current `AdminDashboard.tsx` re-declares a local `FeatureFlag` interface (lines 18-25) instead of using the exported type from `@shared/schema`. The new `FlagsPage` must import `FeatureFlag` from `@shared/schema` rather than re-declaring it.

### Shared Hook

`useDeleteConfirmation` — extracted from the identical pattern used by both RSVP and Messages pages:

```typescript
// client/src/hooks/useDeleteConfirmation.ts
function useDeleteConfirmation(onDelete: (id: number) => void) {
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

The mutation function is passed at hook creation time (not at confirm-time), making the call site cleaner.

## UX Improvements

**Data loading:**
- Each page fetches only when navigated to (Wouter renders the component, triggering its `useQuery`).
- Per-page loading skeletons instead of one full-screen spinner.

**Navigation:**
- Direct URL access works — bookmarking `/admin/flags` goes straight to flags.
- Browser back/forward navigates between admin pages.
- Active route highlighted in sidebar.

**Mobile:**
- Sidebar collapses for mobile. Much better than the current 6-column grid of tiny tab triggers.

**Session handling:**
- Auth validation happens once in `AdminLayout`, not per-page.
- Auto-logout on 401/403 is centralized via `AdminContext`.

## What Does NOT Change

- **Backend APIs** — zero Go changes needed.
- **Existing component styling** — cards, forms, tables keep their current look.
- **`ImageManager.tsx`** — already extracted, just imported by `ConfigPage`. Does not use `onAutoLogout`.
- **`queryClient.ts`** and **`apiRequest`** — unchanged.
- **`AdminLogin.tsx`** — unchanged.

## File Changes Summary

| Action | File |
|--------|------|
| **Create** | `client/src/pages/admin/AdminLayout.tsx` |
| **Create** | `client/src/pages/admin/RsvpPage.tsx` |
| **Create** | `client/src/pages/admin/MessagesPage.tsx` |
| **Create** | `client/src/pages/admin/ConfigPage.tsx` |
| **Create** | `client/src/pages/admin/WelcomePage.tsx` |
| **Create** | `client/src/pages/admin/FlagsPage.tsx` |
| **Create** | `client/src/pages/admin/StatsPage.tsx` |
| **Create** | `client/src/hooks/useDeleteConfirmation.ts` |
| **Modify** | `client/src/App.tsx` (replace admin routes with nested route) |
| **Modify** | `client/src/components/MusicManager.tsx` (make `onAutoLogout` optional, add context fallback) |
| **Delete** | `client/src/pages/AdminDashboard.tsx` |

## Testing Strategy (TDD)

Follow a test-driven development approach: write unit tests first, then implement to make them pass.

### Unit Tests

Test files live alongside their components in `client/src/pages/admin/__tests__/` and `client/src/hooks/__tests__/`:

| Test File | What It Tests |
|-----------|---------------|
| `AdminLayout.test.tsx` | Auth guard redirects to `/admin-login` on 401; renders sidebar nav; renders child routes; logout clears session and redirects; provides AdminContext |
| `RsvpPage.test.tsx` | Renders stats cards with correct counts; renders RSVP table rows; delete confirmation flow works |
| `MessagesPage.test.tsx` | Renders message list; delete confirmation flow works |
| `ConfigPage.test.tsx` | Renders Google Drive, ImageManager, MusicManager, E-Gift form sections; E-Gift form submit calls correct API |
| `WelcomePage.test.tsx` | Renders welcome form with loaded data; form submit calls PATCH API |
| `FlagsPage.test.tsx` | Renders feature flag toggles; renders welcome screen enable toggle; toggle calls correct mutation |
| `StatsPage.test.tsx` | Renders attendance breakdown from RSVP data |
| `useDeleteConfirmation.test.ts` | requestDelete sets item; confirmDelete calls mutation and clears; cancelDelete clears without calling mutation |

### Test Tooling

- Use Vitest (already available via Vite) + React Testing Library
- Mock API calls with `msw` (Mock Service Worker) or `vi.mock` on `apiRequest`
- Mock Wouter navigation with `vi.mock("wouter")`

### Verification Checklist

- **TypeScript:** `npm run check` must pass with no errors.
- **Unit tests:** All tests pass via `npm run test`.
- **Manual verification:** Navigate each admin route, confirm data loads correctly and in isolation.
- **Auth guard:** Unauthenticated access to any `/admin/*` route redirects to `/admin-login`.
- **Backward compatibility:** `/admin` redirects to `/admin/rsvps`. `/admin-dashboard` redirects to `/admin/rsvps`.
- **Deep linking:** Direct navigation to `/admin/flags` loads only flags data.
- **Mobile layout:** Sidebar collapses appropriately on narrow viewports.
- **Auto-logout:** Simulate expired session, verify redirect works from any admin page.
