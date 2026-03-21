# Production Cleanup & Admin UX Improvements

**Date:** 2026-03-22
**Status:** Approved
**Branch:** phase/0-scaffold

## Summary

Two focused improvement areas for the pre-launch wedding platform:
1. **Production cleanup** — remove debug code, fix dead UI, batch E-gift API calls, add error boundary
2. **Admin UX** — add search and filter to the RSVP page

## Context

- Platform is pre-launch (not yet shared with guests)
- ~100 expected guests — client-side filtering is sufficient, no server-side pagination needed
- No CSV export needed — admin UI is enough at this scale
- Thumbnail migration feature removed (endpoint never existed)

---

## Part A: Production Cleanup

### A1. Remove debug telemetry from GallerySection

**File:** `client/src/components/GallerySection.tsx`

**What:** Delete all `fetch("http://127.0.0.1:7242/ingest/...")` calls. These are leftover agent debug telemetry that should not ship to production.

**Acceptance criteria:** No references to `127.0.0.1:7242` remain in the codebase.

### A2. Remove debug logging from RsvpSection

**File:** `client/src/components/RsvpSection.tsx`

**What:** Remove all `console.log` statements (4 occurrences) in `onSuccess`, `onError`, and form handlers. Keep `console.error` on line 136 — it logs genuine submission failures which are useful for debugging production issues.

**Acceptance criteria:** No `console.log` calls remain in `RsvpSection.tsx`. The single `console.error` for submission failures is intentionally retained.

### A3. Add error handling to GallerySection

**File:** `client/src/components/GallerySection.tsx`

**What:** Two distinct failure modes need handling:

1. **API error (data fetching failure):** Check the `error` state from `useQuery`. When `error` is truthy, render fallback UI instead of the empty grid. This is NOT caught by React error boundaries — it requires a conditional render check.

2. **Render error (unexpected component crash):** Wrap the gallery content in a React error boundary (a small class component or `react-error-boundary` if already available) to catch unexpected exceptions during rendering.

Both failure modes use the same **fallback UI:** A centered card with a camera icon and text: "Gallery photos couldn't be loaded. Please try again later." with a retry button that calls `queryClient.invalidateQueries`.

**Acceptance criteria:**
- API failure (useQuery `error` state) shows fallback UI, not empty grid
- Unexpected render errors are caught by error boundary and show fallback UI
- Retry button re-fetches gallery data
- Normal gallery rendering is unaffected

### A4. Remove thumbnail migration section from ConfigPage

**File:** `client/src/pages/admin/ConfigPage.tsx`

**What:** Remove the "Gallery Performance" section entirely — the heading, description text, and "Migrate Thumbnails" button. The endpoint `/api/admin/migrate-thumbnails` was never implemented in the Go backend.

**Acceptance criteria:** No references to `migrate-thumbnails` remain in the frontend. Clean up any unused imports that become dead code after removing this section (e.g., `Zap`, `Image`, `CheckCircle`, `XCircle` icons — verify each is not used elsewhere in the file before removing).

### A5. Batch E-gift settings into one API call

**Files:**
- `client/src/pages/admin/ConfigPage.tsx` — change 6 individual PATCH calls to one bulk call
- `go-server/internal/handler/app_setting.go` — add bulk update handler
- `go-server/internal/repository/repository.go` — add `UpdateAppSettings(ctx context.Context, settings []models.InsertAppSetting) error` to interface
- `go-server/internal/repository/memory.go` — implement for in-memory store
- `go-server/internal/repository/postgres.go` — implement for Postgres
- `go-server/internal/router/router.go` — register new route

**New endpoint:** `PATCH /api/admin/app-settings/bulk`

**Request body:**
```json
{
  "settings": [
    { "settingKey": "egift_groom_name", "settingValue": "John" },
    { "settingKey": "egift_groom_bank", "settingValue": "Bank A" },
    { "settingKey": "egift_groom_account", "settingValue": "1234567890" },
    { "settingKey": "egift_bride_name", "settingValue": "Jane" },
    { "settingKey": "egift_bride_bank", "settingValue": "Bank B" },
    { "settingKey": "egift_bride_account", "settingValue": "0987654321" }
  ]
}
```

**Response:** `200 OK` with `{ "updated": 6 }`

**Backend behavior:**
- Requires auth + CSRF (same as existing admin routes)
- **Upsert semantics:** For each setting, attempt update first; if the key does not exist, create it. This handles fresh deployments where e-gift settings haven't been seeded yet.
- Updates all settings in a single transaction (Postgres) or loop (in-memory)
- Returns 400 if `settings` array is empty, exceeds 50 items, or any `settingKey` is blank

**Frontend behavior:**
- The E-gift save button collects all 6 fields and sends one `PATCH /api/admin/app-settings/bulk` request
- Single success/error toast instead of 6

**Acceptance criteria:**
- Saving E-gift config makes exactly 1 API call (down from 6)
- All 6 values are persisted correctly
- Contract test covers the new endpoint's response shape
- Error handling: single toast on failure

---

## Part B: RSVP Page Search & Filter

**File:** `client/src/pages/admin/RsvpPage.tsx`

### B1. Search bar

**Placement:** Between the stats cards row and the RSVP table.

**Behavior:**
- Text input with search icon and placeholder: "Search by name or email..."
- Filters the RSVP list client-side as the user types
- Debounced at 300ms to avoid re-renders on every keystroke
- Case-insensitive match against `name` and `email` fields
- Clear button (X) appears when text is entered

### B2. Filter tabs

**Placement:** Same row as the search bar, aligned right.

**Options:** "All" | "Attending" | "Not Attending"

**Behavior:**
- One active at a time (default: "All")
- Uses Shadcn `Tabs` or `ToggleGroup` component for consistency
- Combines with search — both filters apply simultaneously

### B3. Stats cards reflect filtered view

When search or filter is active, both stats cards update to reflect the filtered subset:
- **"Confirmed Attending"** — count of filtered RSVPs where `attending === true`
- **"Total Expected Guests"** — sum of `guestCount` for filtered RSVPs where `attending === true`

Each card shows a subtle label like "3 of 100 shown" so the admin knows they're looking at a filtered view. When no filter/search is active (showing all), the label is hidden.

### B4. Empty state

When the combination of search + filter yields zero results:
- Show centered text: "No guests match your search"
- If a filter is active, suggest clearing it

### Implementation approach

```typescript
const [searchText, setSearchText] = useState("");
const [attendingFilter, setAttendingFilter] = useState<"all" | "attending" | "not-attending">("all");
const debouncedSearch = useDebounce(searchText, 300);

const filteredRsvps = useMemo(() => {
  return rsvps.filter(rsvp => {
    const matchesSearch = !debouncedSearch ||
      rsvp.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      rsvp.email.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchesFilter =
      attendingFilter === "all" ||
      (attendingFilter === "attending" && rsvp.attending) ||
      (attendingFilter === "not-attending" && !rsvp.attending);

    return matchesSearch && matchesFilter;
  });
}, [rsvps, debouncedSearch, attendingFilter]);
```

A new `useDebounce` hook needs to be created at `client/src/hooks/useDebounce.ts` (does not exist yet). Simple implementation: `useEffect` + `setTimeout`/`clearTimeout`. No new dependencies needed.

**Acceptance criteria:**
- Search filters RSVP list by name or email (case-insensitive)
- Filter tabs toggle between All/Attending/Not Attending
- Search + filter combine correctly
- Stats cards show filtered counts with "X of Y shown" label
- Empty state displays when no results match
- Existing delete functionality works on filtered results

---

## Out of Scope

- Server-side pagination (not needed for 100 guests)
- CSV/PDF export (admin UI sufficient)
- Messages page search/filter
- Thumbnail migration implementation
- Analytics/monitoring
- CI/CD pipeline
