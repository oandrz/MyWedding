# Production Cleanup & Admin UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove debug code, fix dead UI, batch E-gift API calls, add gallery error handling, and add search/filter to the RSVP admin page.

**Architecture:** Frontend-only changes for cleanup tasks (A1–A4) and RSVP search/filter (B1–B4). One full-stack change (A5) adds a bulk settings endpoint in Go and updates the ConfigPage to use it.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack React Query, Shadcn/Radix UI, Go + Chi router + pgx

**Spec:** `docs/superpowers/specs/2026-03-22-cleanup-and-admin-ux-design.md`

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `client/src/components/GallerySection.tsx` | Remove debug telemetry, add API error + render error handling |
| Modify | `client/src/components/RsvpSection.tsx` | Remove `console.log` statements |
| Modify | `client/src/pages/admin/ConfigPage.tsx` | Remove thumbnail migration section, switch to bulk E-gift API |
| Modify | `client/src/pages/admin/__tests__/ConfigPage.test.tsx` | Update tests for removed section + bulk API |
| Modify | `client/src/pages/admin/RsvpPage.tsx` | Add search bar, filter tabs, filtered stats, empty state |
| Modify | `client/src/pages/admin/__tests__/RsvpPage.test.tsx` | Add tests for search/filter |
| Create | `client/src/hooks/useDebounce.ts` | Debounce hook for search input |
| Modify | `go-server/internal/repository/repository.go` | Add `UpsertAppSettings` to interface |
| Modify | `go-server/internal/repository/memory.go` | Implement `UpsertAppSettings` for in-memory store |
| Modify | `go-server/internal/repository/postgres.go` | Implement `UpsertAppSettings` for Postgres |
| Modify | `go-server/internal/handler/app_setting.go` | Add `BulkUpdate` handler |
| Modify | `go-server/internal/handler/contract_test.go` | Add contract test for bulk endpoint |
| Modify | `go-server/internal/router/router.go` | Register `PATCH /api/admin/app-settings/bulk` |

---

## Chunk 1: Frontend Cleanup (Tasks 1–4)

### Task 1: Remove debug telemetry from GallerySection

**Files:**
- Modify: `client/src/components/GallerySection.tsx:14-17` (telemetry in `getResponsiveImageUrl`)
- Modify: `client/src/components/GallerySection.tsx:72-83` (mount/unmount telemetry)
- Modify: `client/src/components/GallerySection.tsx:99-104` (API state telemetry)

- [ ] **Step 1: Remove the 3 telemetry blocks**

Delete the `// #region agent log` / `// #endregion` blocks (lines 14–17, 72–83, 99–104). Also remove the now-unused refs `apiCallStartTime` and `mountCount` (lines 73–74).

After edits, `getResponsiveImageUrl` should start:
```typescript
const getResponsiveImageUrl = (baseUrl: string, width: number, quality: number = 75): string => {
  if (!baseUrl.includes('unsplash.com')) return baseUrl;
```

And the component body should go directly from `isGalleryInView` line to the `useQuery` call with no mount/unmount telemetry between them.

- [ ] **Step 2: Verify no references to 127.0.0.1:7242 remain**

Run: `grep -r "127.0.0.1:7242" client/`
Expected: No output (zero matches)

- [ ] **Step 3: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add client/src/components/GallerySection.tsx
git commit -m "fix: remove debug telemetry from GallerySection"
```

---

### Task 2: Remove console.log from RsvpSection

**Files:**
- Modify: `client/src/components/RsvpSection.tsx:87,90,94,146`

- [ ] **Step 1: Remove the 4 console.log lines**

Delete these exact lines (keep `console.error` on line 136):
- Line 87: `console.log("Submitting RSVP:", data);`
- Line 90: `console.log("RSVP response:", responseData);`
- Line 94: `console.log("RSVP submitted successfully:", data);`
- Line 146: `console.log("Form data to submit:", data);`

- [ ] **Step 2: Verify no console.log remains, console.error is kept**

Run: `grep -n "console\." client/src/components/RsvpSection.tsx`
Expected: Only one line with `console.error("RSVP submission error:", error);`

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RsvpSection.tsx
git commit -m "fix: remove debug console.log from RsvpSection"
```

---

### Task 3: Add error handling to GallerySection

**Files:**
- Modify: `client/src/components/GallerySection.tsx`

- [ ] **Step 1: Add the gallery error fallback UI**

After the `useQuery` call (around line 88), add a conditional check for the `error` state. Insert before the `shouldShowGallery` check (before line 129):

```typescript
// Error fallback UI for both API errors and render errors
const GalleryErrorFallback = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Camera className="h-12 w-12 text-gray-300 mb-4" />
    <p className="text-gray-500 text-lg mb-2">Gallery photos couldn't be loaded</p>
    <p className="text-gray-400 text-sm mb-4">Please try again later</p>
    <button
      onClick={onRetry}
      className="px-6 py-2 rounded-full text-white font-montserrat text-sm shadow-md hover:shadow-lg transition-all hover:brightness-110"
      style={{ backgroundColor: '#dba9a9' }}
    >
      Try Again
    </button>
  </div>
);
```

Move this **outside** the `GallerySection` component (place it between `OptimizedImage` and `GallerySection`). Add `Camera` to the lucide-react imports.

- [ ] **Step 2: Add API error check inside GallerySection**

In the render body of `GallerySection`, after the `if (!shouldShowGallery)` guard, add an error check:

```typescript
if (error) {
  return (
    <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <GalleryErrorFallback onRetry={() => queryClient.invalidateQueries({ queryKey: ["/api/config-images/gallery"] })} />
      </div>
    </section>
  );
}
```

Add `import { queryClient } from "@/lib/queryClient";` to the imports.

- [ ] **Step 3: Add React error boundary wrapper**

Create a small class component at the top of the file (after imports):

```typescript
import { Component, type ReactNode } from "react";

class GalleryErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
```

Then wrap the `<section>` return in the main render with:
```typescript
return (
  <GalleryErrorBoundary
    fallback={
      <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture">
        <div className="container mx-auto px-4">
          <GalleryErrorFallback onRetry={() => window.location.reload()} />
        </div>
      </section>
    }
  >
    {/* existing section JSX */}
  </GalleryErrorBoundary>
);
```

Update the `import` from `"react"` to also include `Component` and `ReactNode`:
```typescript
import { useRef, useState, useEffect, Component, type ReactNode } from "react";
```

- [ ] **Step 4: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/GallerySection.tsx
git commit -m "feat: add error handling to GallerySection for API and render failures"
```

---

### Task 4: Remove thumbnail migration from ConfigPage + update tests

**Files:**
- Modify: `client/src/pages/admin/ConfigPage.tsx:21,23-26,29-33,147-178,263-328`
- Modify: `client/src/pages/admin/__tests__/ConfigPage.test.tsx:61-65`

- [ ] **Step 1: Remove thumbnail migration code from ConfigPage**

Delete these blocks from `ConfigPage.tsx`:
1. The `MigrationResult` interface (lines 29–33)
2. The `migrationResult` state and `thumbnailMigrationMutation` (lines 147–178)
3. The entire "Gallery Performance Optimization" Card JSX (lines 263–328)

- [ ] **Step 2: Remove unused imports**

After removing the above, check which imports from lucide-react are still used:
- `Settings` — used (Google Drive + Image Config cards)
- `Music` — used (Music Config card)
- `Gift` — used (E-Gift card)
- `Loader2` — used (E-Gift save button spinner)
- `Zap` — **remove** (only used in Gallery Performance heading)
- `Image` — **remove** (only used in thumbnail button)
- `CheckCircle` — **remove** (only used in migration results)
- `XCircle` — **remove** (only used in migration results)

Update import to:
```typescript
import {
  Settings,
  Music,
  Gift,
  Loader2,
} from "lucide-react";
```

- [ ] **Step 3: Update ConfigPage test — remove Gallery Performance test**

In `client/src/pages/admin/__tests__/ConfigPage.test.tsx`, delete the test at lines 61–65:
```typescript
  it("renders Gallery Performance section", () => {
    renderConfigPage();
    expect(screen.getByText("Gallery Performance")).toBeInTheDocument();
    expect(screen.getByText("Generate Gallery Thumbnails")).toBeInTheDocument();
  });
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run client/src/pages/admin/__tests__/ConfigPage.test.tsx`
Expected: All remaining tests pass

- [ ] **Step 5: Verify no migrate-thumbnails references remain**

Run: `grep -r "migrate-thumbnails\|MigrationResult\|thumbnailMigration" client/`
Expected: No output

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/ConfigPage.tsx client/src/pages/admin/__tests__/ConfigPage.test.tsx
git commit -m "fix: remove dead thumbnail migration section from ConfigPage"
```

---

## Chunk 2: Bulk E-Gift API (Task 5)

### Task 5: Add bulk app settings endpoint (Backend)

**Files:**
- Modify: `go-server/internal/repository/repository.go:47-51` (App Settings section)
- Modify: `go-server/internal/repository/memory.go:431-487` (App Settings section)
- Modify: `go-server/internal/repository/postgres.go:490-563` (App Settings section)
- Modify: `go-server/internal/handler/app_setting.go`
- Modify: `go-server/internal/router/router.go:160`
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Write the contract test for bulk update**

Add to `go-server/internal/handler/contract_test.go`:

```go
func TestContract_AppSettingBulkUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"settings": []map[string]string{
			{"settingKey": "egift_groom_name", "settingValue": "John", "settingType": "text"},
			{"settingKey": "egift_bride_name", "settingValue": "Jane", "settingType": "text"},
		},
	})

	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	assertKeyType(t, result, "updated", "float64")
	if result["updated"].(float64) != 2 {
		t.Fatalf("expected updated=2, got %v", result["updated"])
	}
}

func TestContract_AppSettingBulkUpdate_EmptyArray(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"settings": []map[string]string{},
	})

	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestContract_AppSettingBulkUpdate_BlankKey(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"settings": []map[string]string{
			{"settingKey": "", "settingValue": "val", "settingType": "text"},
		},
	})

	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestContract_AppSettingBulkUpdate_ExceedsMax(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	settings := make([]map[string]string, 51)
	for i := range settings {
		settings[i] = map[string]string{
			"settingKey": fmt.Sprintf("key_%d", i), "settingValue": "val", "settingType": "text",
		}
	}
	body := jsonBody(map[string]interface{}{"settings": settings})

	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestContract_AppSettingBulkUpdate_Upsert(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// First call creates settings
	body1 := jsonBody(map[string]interface{}{
		"settings": []map[string]string{
			{"settingKey": "test_key", "settingValue": "original", "settingType": "text"},
		},
	})
	req1 := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body1, cookie, csrf)
	contractResponse(t, env, req1, http.StatusOK)

	// Second call updates existing
	body2 := jsonBody(map[string]interface{}{
		"settings": []map[string]string{
			{"settingKey": "test_key", "settingValue": "updated", "settingType": "text"},
		},
	})
	req2 := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body2, cookie, csrf)
	contractResponse(t, env, req2, http.StatusOK)

	// Verify value was updated
	getReq := httptest.NewRequest(http.MethodGet, "/api/settings/test_key", nil)
	getResult := contractResponse(t, env, getReq, http.StatusOK)
	setting := getResult["setting"].(map[string]interface{})
	if setting["settingValue"].(string) != "updated" {
		t.Fatalf("expected settingValue=updated, got %v", setting["settingValue"])
	}
}
```

Note: The test file (`contract_test.go`) already imports `"net/http/httptest"` but does NOT import `"fmt"`. You must add `"fmt"` to the import block since `TestContract_AppSettingBulkUpdate_ExceedsMax` uses `fmt.Sprintf`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run TestContract_AppSettingBulk -v`
Expected: FAIL — route not registered, handler not defined

- [ ] **Step 3: Add UpsertAppSettings to repository interface**

In `go-server/internal/repository/repository.go`, add after `GetAllAppSettings` (line 51):

```go
	UpsertAppSettings(ctx context.Context, settings []models.InsertAppSetting) (int, error)
```

- [ ] **Step 4: Implement UpsertAppSettings in memory.go**

Add to `go-server/internal/repository/memory.go` after the `GetAllAppSettings` method:

```go
func (m *MemoryRepository) UpsertAppSettings(_ context.Context, settings []models.InsertAppSetting) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	updated := 0
	for _, data := range settings {
		found := false
		for id, as := range m.appSettings {
			if as.SettingKey == data.SettingKey {
				as.SettingValue = data.SettingValue
				as.SettingType = data.SettingType
				as.Description = data.Description
				as.UpdatedAt = now()
				m.appSettings[id] = as
				found = true
				updated++
				break
			}
		}
		if !found {
			m.settingIDSeq++
			m.appSettings[m.settingIDSeq] = models.AppSetting{
				ID:           m.settingIDSeq,
				SettingKey:   data.SettingKey,
				SettingValue: data.SettingValue,
				SettingType:  data.SettingType,
				Description:  data.Description,
				UpdatedAt:    now(),
			}
			updated++
		}
	}
	return updated, nil
}
```

- [ ] **Step 5: Implement UpsertAppSettings in postgres.go**

Add to `go-server/internal/repository/postgres.go` after `GetAllAppSettings`:

```go
func (r *PostgresRepository) UpsertAppSettings(ctx context.Context, settings []models.InsertAppSetting) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	updated := 0
	for _, data := range settings {
		tag, err := tx.Exec(ctx,
			`INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (setting_key) DO UPDATE SET
			   setting_value = EXCLUDED.setting_value,
			   setting_type = EXCLUDED.setting_type,
			   description = EXCLUDED.description,
			   updated_at = NOW()`,
			data.SettingKey, data.SettingValue, data.SettingType, data.Description,
		)
		if err != nil {
			return 0, err
		}
		updated += int(tag.RowsAffected())
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return updated, nil
}
```

- [ ] **Step 6: Add BulkUpdate handler**

Add to `go-server/internal/handler/app_setting.go`:

```go
// BulkUpdate handles PATCH /api/admin/app-settings/bulk.
func (h *AppSettingHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Settings []models.InsertAppSetting `json:"settings"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(body.Settings) == 0 {
		writeError(w, http.StatusBadRequest, "Settings array must not be empty")
		return
	}
	if len(body.Settings) > 50 {
		writeError(w, http.StatusBadRequest, "Settings array exceeds maximum of 50 items")
		return
	}
	for _, s := range body.Settings {
		if s.SettingKey == "" {
			writeError(w, http.StatusBadRequest, "Each setting must have a non-empty settingKey")
			return
		}
	}

	updated, err := h.Repo.UpsertAppSettings(r.Context(), body.Settings)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update settings")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"updated": updated,
	})
}
```

- [ ] **Step 7: Register route in router.go**

In `go-server/internal/router/router.go`, inside the admin auth+CSRF group (around line 160), add before the existing `r.Patch("/app-settings/{settingKey}"...` line:

```go
			r.Patch("/app-settings/bulk", appSetting.BulkUpdate)
```

**Important:** This must come **before** the `r.Patch("/app-settings/{settingKey}"...` route so Chi matches the literal `/bulk` path before the `{settingKey}` wildcard.

- [ ] **Step 8: Run tests**

Run: `cd go-server && go test ./internal/handler -run TestContract_AppSettingBulk -v`
Expected: All 5 tests PASS

- [ ] **Step 9: Run full backend test suite**

Run: `cd go-server && make test`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
cd go-server
git add internal/repository/repository.go internal/repository/memory.go internal/repository/postgres.go internal/handler/app_setting.go internal/handler/contract_test.go internal/router/router.go
git commit -m "feat: add PATCH /api/admin/app-settings/bulk endpoint with upsert semantics"
```

---

### Task 6: Update ConfigPage to use bulk API

**Files:**
- Modify: `client/src/pages/admin/ConfigPage.tsx:75-138`
- Modify: `client/src/pages/admin/__tests__/ConfigPage.test.tsx`

- [ ] **Step 1: Write the test for bulk E-gift save**

Add to `client/src/pages/admin/__tests__/ConfigPage.test.tsx`:

```typescript
import userEvent from "@testing-library/user-event";

// Add to the top-level mock setup (after existing mocks):
const mockApiRequest = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ updated: 6 }) });
vi.mock("@/lib/queryClient", () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    getQueryCache: vi.fn(() => ({ findAll: () => [] })),
    defaultQueryOptions: vi.fn(() => ({})),
    getDefaultOptions: vi.fn(() => ({ queries: {} })),
    mount: vi.fn(),
    unmount: vi.fn(),
  },
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));
```

Add the test:

```typescript
  it("submits e-gift settings as a single bulk API call", async () => {
    const user = userEvent.setup();
    renderConfigPage([
      { settingKey: "egift_groom_name", settingValue: "Andreas" },
    ]);

    const saveButton = screen.getByTestId("button-save-egift");
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "PATCH",
        "/api/admin/app-settings/bulk",
        expect.objectContaining({
          settings: expect.arrayContaining([
            expect.objectContaining({ settingKey: "egift_groom_name" }),
          ]),
        })
      );
    });
    // Verify it was called exactly once (bulk), not 6 times
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });
```

Add `waitFor` to the import from `@testing-library/react`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/pages/admin/__tests__/ConfigPage.test.tsx`
Expected: New test FAILS (still using individual PATCH calls)

- [ ] **Step 3: Update ConfigPage mutation to use bulk endpoint**

Replace the `egiftSettingsMutation` `mutationFn` (lines 76–123) with:

```typescript
  const egiftSettingsMutation = useMutation({
    mutationFn: async (data: typeof egiftForm) => {
      const settings = [
        { settingKey: "egift_groom_name", settingValue: data.groomName, settingType: "text", description: "Groom account holder name" },
        { settingKey: "egift_groom_bank", settingValue: data.groomBank, settingType: "text", description: "Groom bank name" },
        { settingKey: "egift_groom_account", settingValue: data.groomAccount, settingType: "text", description: "Groom account number" },
        { settingKey: "egift_bride_name", settingValue: data.brideName, settingType: "text", description: "Bride account holder name" },
        { settingKey: "egift_bride_bank", settingValue: data.brideBank, settingType: "text", description: "Bride bank name" },
        { settingKey: "egift_bride_account", settingValue: data.brideAccount, settingType: "text", description: "Bride account number" },
      ];

      await apiRequest("PATCH", "/api/admin/app-settings/bulk", { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({
        title: "Success",
        description: "E-Gift settings updated successfully",
      });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update e-gift settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run client/src/pages/admin/__tests__/ConfigPage.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/ConfigPage.tsx client/src/pages/admin/__tests__/ConfigPage.test.tsx
git commit -m "feat: switch E-gift settings to bulk API call"
```

---

## Chunk 3: RSVP Search & Filter (Tasks 7–8)

### Task 7: Create useDebounce hook

**Files:**
- Create: `client/src/hooks/useDebounce.ts`

- [ ] **Step 1: Create the hook**

Create `client/src/hooks/useDebounce.ts`:

```typescript
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useDebounce.ts
git commit -m "feat: add useDebounce hook"
```

---

### Task 8: Add search and filter to RsvpPage

**Files:**
- Modify: `client/src/pages/admin/RsvpPage.tsx`
- Modify: `client/src/pages/admin/__tests__/RsvpPage.test.tsx`

- [ ] **Step 1: Write tests for search and filter**

Add to `client/src/pages/admin/__tests__/RsvpPage.test.tsx`:

```typescript
import { waitFor } from "@testing-library/react";

// Add more mock data for thorough filtering tests
const extendedMockData = {
  rsvps: [
    { id: 1, name: "Alice Johnson", email: "alice@test.com", attending: true, guestCount: 2 },
    { id: 2, name: "Bob Smith", email: "bob@test.com", attending: false, guestCount: 0 },
    { id: 3, name: "Charlie Brown", email: "charlie@test.com", attending: true, guestCount: 3 },
  ],
  stats: { attending: 2, guestCount: 5, notAttending: 1 },
};

function createExtendedQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["/api/rsvp"], extendedMockData);
  return client;
}
```

Add these tests inside the `describe("RsvpPage", ...)` block:

```typescript
  it("renders search input", () => {
    renderRsvpPage();
    expect(screen.getByPlaceholderText("Search by name or email...")).toBeInTheDocument();
  });

  it("renders filter tabs", () => {
    renderRsvpPage();
    expect(screen.getByText("All")).toBeInTheDocument();
    // Use getAllByText since "Attending" appears both as a tab and as a badge
    const attendingElements = screen.getAllByText("Attending");
    expect(attendingElements.length).toBeGreaterThanOrEqual(2); // tab + badge
  });

  it("filters by search text", async () => {
    renderRsvpPage(createExtendedQueryClient());
    const searchInput = screen.getByPlaceholderText("Search by name or email...");

    await userEvent.type(searchInput, "alice");

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.queryByText("Bob Smith")).not.toBeInTheDocument();
      expect(screen.queryByText("Charlie Brown")).not.toBeInTheDocument();
    });
  });

  it("filters by attending status", async () => {
    renderRsvpPage(createExtendedQueryClient());

    // Click the "Not Attending" filter tab
    const notAttendingTab = screen.getByRole("tab", { name: "Not Attending" });
    await userEvent.click(notAttendingTab);

    await waitFor(() => {
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      expect(screen.queryByText("Alice Johnson")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when search has no results", async () => {
    renderRsvpPage(createExtendedQueryClient());
    const searchInput = screen.getByPlaceholderText("Search by name or email...");

    await userEvent.type(searchInput, "nonexistent");

    await waitFor(() => {
      expect(screen.getByText("No guests match your search")).toBeInTheDocument();
    });
  });

  it("shows filtered count label when filtering", async () => {
    renderRsvpPage(createExtendedQueryClient());

    // Click the "Attending" filter tab
    const tabs = screen.getAllByText("Attending");
    // Find the tab element (not the badge)
    const attendingTab = screen.getByRole("tab", { name: "Attending" });
    await userEvent.click(attendingTab);

    await waitFor(() => {
      expect(screen.getByText(/of \d+ shown/)).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run client/src/pages/admin/__tests__/RsvpPage.test.tsx`
Expected: New tests FAIL (search input and filter tabs don't exist yet)

- [ ] **Step 3: Add search/filter state and filtering logic to RsvpPage**

In `client/src/pages/admin/RsvpPage.tsx`, add imports:

```typescript
import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, X } from "lucide-react";
```

After `const stats = calculateAttendance(rsvps);` (line 67), add:

```typescript
  // Search & filter state
  const [searchText, setSearchText] = useState("");
  const [attendingFilter, setAttendingFilter] = useState<"all" | "attending" | "not-attending">("all");
  const debouncedSearch = useDebounce(searchText, 300);

  const isFiltering = debouncedSearch !== "" || attendingFilter !== "all";

  const filteredRsvps = useMemo(() => {
    return rsvps.filter((rsvp) => {
      const matchesSearch =
        !debouncedSearch ||
        rsvp.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (rsvp.email && rsvp.email.toLowerCase().includes(debouncedSearch.toLowerCase()));

      const matchesFilter =
        attendingFilter === "all" ||
        (attendingFilter === "attending" && rsvp.attending) ||
        (attendingFilter === "not-attending" && !rsvp.attending);

      return matchesSearch && matchesFilter;
    });
  }, [rsvps, debouncedSearch, attendingFilter]);

  const filteredStats = useMemo(() => calculateAttendance(filteredRsvps), [filteredRsvps]);
```

- [ ] **Step 4: Update stats cards to show filtered counts**

Replace the stats cards section (lines 81–113) with:

```tsx
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-white">
                  {isFiltering ? filteredStats.attending : stats.attending}
                </CardTitle>
                <CardDescription className="text-rose-100">
                  Confirmed Attending
                </CardDescription>
                {isFiltering && (
                  <p className="text-xs text-rose-200 mt-1">
                    {filteredStats.attending} of {stats.attending} shown
                  </p>
                )}
              </div>
              <Users className="h-8 w-8 text-rose-200" />
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-pink-400 to-rose-500 text-white shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-white">
                  {isFiltering ? filteredStats.totalGuests : stats.totalGuests}
                </CardTitle>
                <CardDescription className="text-pink-100">
                  Total Expected Guests
                </CardDescription>
                {isFiltering && (
                  <p className="text-xs text-pink-200 mt-1">
                    {filteredStats.totalGuests} of {stats.totalGuests} shown
                  </p>
                )}
              </div>
              <Calendar className="h-8 w-8 text-pink-200" />
            </div>
          </CardHeader>
        </Card>
      </div>
```

- [ ] **Step 5: Add search bar and filter tabs between stats and list**

Insert after the stats cards `</div>` and before the RSVP List Card:

```tsx
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchText && (
            <button
              onClick={() => setSearchText("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Tabs
          value={attendingFilter}
          onValueChange={(v) => setAttendingFilter(v as typeof attendingFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="attending">Attending</TabsTrigger>
            <TabsTrigger value="not-attending">Not Attending</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
```

- [ ] **Step 6: Update the RSVP list to use filteredRsvps + empty state**

Change `{rsvps.map((rsvp) => (` to `{filteredRsvps.map((rsvp) => (`.

Replace the existing empty state block (lines 217–227) with:

```tsx
            {filteredRsvps.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-gray-300 mb-3" />
                {isFiltering ? (
                  <>
                    <p className="text-gray-500 text-lg">
                      No guests match your search
                    </p>
                    <p className="text-sm text-gray-400 mt-1">
                      Try adjusting your search or{" "}
                      <button
                        onClick={() => {
                          setSearchText("");
                          setAttendingFilter("all");
                        }}
                        className="text-pink-500 hover:underline"
                      >
                        clear filters
                      </button>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-500 text-lg">
                      No RSVP responses yet
                    </p>
                    <p className="text-sm text-gray-400">
                      Responses will appear here when guests submit their RSVPs
                    </p>
                  </>
                )}
              </div>
            )}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run client/src/pages/admin/__tests__/RsvpPage.test.tsx`
Expected: All tests PASS (including new search/filter tests)

- [ ] **Step 8: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 9: Run full frontend test suite**

Run: `npm test`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add client/src/hooks/useDebounce.ts client/src/pages/admin/RsvpPage.tsx client/src/pages/admin/__tests__/RsvpPage.test.tsx
git commit -m "feat: add search and filter to RSVP admin page"
```

---

## Final Verification

- [ ] **Run full backend tests:** `cd go-server && make test`
- [ ] **Run full frontend tests:** `npm test`
- [ ] **Run TypeScript check:** `npm run check`
- [ ] **Verify no debug code remains:**
  - `grep -r "127.0.0.1:7242" client/` → no output
  - `grep -r "migrate-thumbnails" client/` → no output
  - `grep -n "console\.log" client/src/components/RsvpSection.tsx` → no output
