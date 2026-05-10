# RSVP Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-close RSVP submissions on a configurable deadline date, enforced server-side (403) and surfaced to guests as a "RSVP is now closed" message, with an admin page to configure and test the deadline.

**Architecture:** A single `rsvp_deadline` app_setting (ISO date string) is read by the Go RSVP handler on every submission and by the frontend `RsvpSection` to conditionally render a closed state. A new `RsvpDeadlinePage` admin page wraps the existing `PATCH /api/admin/app-settings/bulk` endpoint in a date picker UI.

**Tech Stack:** Go (Chi router, in-memory/postgres repository), React 18, TypeScript, TanStack React Query, Shadcn/Radix UI, Tailwind CSS, Vitest

---

## File Map

| Action | File | Purpose |
|---|---|---|
| Modify | `go-server/internal/handler/rsvp.go` | Add deadline check before processing RSVP |
| Modify | `go-server/internal/handler/rsvp_test.go` | Deadline enforcement tests |
| Modify | `client/src/components/RsvpSection.tsx` | Read deadline, render closed state, handle 403 |
| Modify | `client/src/components/__tests__/RsvpSection.test.tsx` | Closed state tests |
| Create | `client/src/pages/admin/RsvpDeadlinePage.tsx` | Admin deadline configuration page |
| Modify | `client/src/pages/admin/AdminLayout.tsx` | Add nav item and route |

---

## Task 1: Backend — Write Failing Deadline Tests

**Files:**
- Modify: `go-server/internal/handler/rsvp_test.go`

- [ ] **Step 1: Add `"time"` import to rsvp_test.go**

Open `go-server/internal/handler/rsvp_test.go`. The import block currently has:
```go
import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/models"
)
```

Change it to:
```go
import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
)
```

- [ ] **Step 2: Append the three deadline tests to rsvp_test.go**

Add these functions at the end of the file:

```go
// ---------------------------------------------------------------------------
// RSVP Deadline Enforcement
// ---------------------------------------------------------------------------

func TestRsvp_Create_PastDeadline_Returns403(t *testing.T) {
	env := newTestEnv()

	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	if _, err := env.repo.UpsertAppSettings(context.Background(), []models.InsertAppSetting{
		{SettingKey: "rsvp_deadline", SettingValue: yesterday, SettingType: "date"},
	}); err != nil {
		t.Fatalf("failed to seed rsvp_deadline: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusForbidden)
}

func TestRsvp_Create_FutureDeadline_Proceeds(t *testing.T) {
	env := newTestEnv()

	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	if _, err := env.repo.UpsertAppSettings(context.Background(), []models.InsertAppSetting{
		{SettingKey: "rsvp_deadline", SettingValue: tomorrow, SettingType: "date"},
	}); err != nil {
		t.Fatalf("failed to seed rsvp_deadline: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusCreated)
}

func TestRsvp_Create_NoDeadlineSetting_Proceeds(t *testing.T) {
	env := newTestEnv()
	// No rsvp_deadline setting seeded — should proceed normally

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusCreated)
}

func TestRsvp_Create_MalformedDeadline_Proceeds(t *testing.T) {
	env := newTestEnv()

	if _, err := env.repo.UpsertAppSettings(context.Background(), []models.InsertAppSetting{
		{SettingKey: "rsvp_deadline", SettingValue: "not-a-date", SettingType: "date"},
	}); err != nil {
		t.Fatalf("failed to seed rsvp_deadline: %v", err)
	}

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusCreated)
}
```

- [ ] **Step 3: Run the tests to confirm they fail**

```bash
cd go-server && go test ./internal/handler -run TestRsvp_Create_PastDeadline_Returns403 -v -race -count=1
```

Expected: `FAIL` — `expected 403, got 201` (deadline check not yet implemented).

---

## Task 2: Backend — Implement Deadline Check in rsvp.go

**Files:**
- Modify: `go-server/internal/handler/rsvp.go`

- [ ] **Step 1: Add `"time"` import to rsvp.go**

The current import block in `go-server/internal/handler/rsvp.go`:
```go
import (
	"net/http"
	"strconv"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)
```

Change it to:
```go
import (
	"net/http"
	"strconv"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)
```

- [ ] **Step 2: Add deadline check at the top of Create**

Replace the `Create` function body — add the check before the code-vs-email routing:

```go
// Create handles POST /api/rsvp.
func (h *RsvpHandler) Create(w http.ResponseWriter, r *http.Request) {
	if setting, err := h.Repo.GetAppSetting(r.Context(), "rsvp_deadline"); err == nil && setting != nil {
		if deadline, err := time.Parse("2006-01-02", setting.SettingValue); err == nil {
			now := time.Now().UTC()
			today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
			if !today.Before(deadline) {
				writeError(w, r, http.StatusForbidden, "RSVP submissions are closed")
				return
			}
		}
	}

	var body rsvpRequest
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Route based on request body: code present → invite code flow, otherwise → email flow
	if body.Code != "" {
		h.createWithCode(w, r, body)
	} else {
		h.createWithEmail(w, r, body)
	}
}
```

- [ ] **Step 3: Run all four deadline tests**

```bash
cd go-server && go test ./internal/handler -run "TestRsvp_Create_PastDeadline|TestRsvp_Create_FutureDeadline|TestRsvp_Create_NoDeadline|TestRsvp_Create_MalformedDeadline" -v -race -count=1
```

Expected output: all four tests PASS.

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
cd go-server && make test
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/handler/rsvp.go go-server/internal/handler/rsvp_test.go
git commit -m "feat: enforce rsvp_deadline setting in RSVP handler (403 when past)"
```

---

## Task 3: Frontend — Write Failing Tests for RsvpSection Closed State

**Files:**
- Modify: `client/src/components/__tests__/RsvpSection.test.tsx`

- [ ] **Step 1: Add a helper function for rendering with deadline**

In `RsvpSection.test.tsx`, add a new helper after the existing `renderRsvpSection` function:

```tsx
function renderWithDeadline(pastDeadline: boolean) {
  const qc = createTestQueryClient();
  const offsetMs = pastDeadline ? -86400000 : 86400000; // -1 day or +1 day
  const deadline = new Date(Date.now() + offsetMs).toISOString().split('T')[0];

  qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
  qc.setQueryData(["/api/feature-flags"], {
    featureFlags: [{ id: 1, featureKey: "rsvp", featureName: "RSVP", description: "", enabled: true, updatedAt: "" }],
  });
  qc.setQueryData(["/api/app-settings"], {
    settings: [{ id: 1, settingKey: "rsvp_deadline", settingValue: deadline, settingType: "date", description: null, updatedAt: "" }],
  });

  return render(
    <QueryClientProvider client={qc}>
      <RsvpSection />
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Add the closed state and open state tests**

Append to the `describe("RsvpSection", ...)` block:

```tsx
it("shows closed message when rsvp_deadline is in the past", async () => {
  renderWithDeadline(true);
  await waitFor(() => {
    expect(screen.getByText(/rsvp is now closed/i)).toBeInTheDocument();
  });
  expect(screen.queryByTestId("button-submit-rsvp")).not.toBeInTheDocument();
});

it("shows form when rsvp_deadline is in the future", async () => {
  renderWithDeadline(false);
  await waitFor(() => {
    expect(screen.getByTestId("button-submit-rsvp")).toBeInTheDocument();
  });
  expect(screen.queryByText(/rsvp is now closed/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Add a test for 403 on submission**

Also append to the `describe("RsvpSection", ...)` block:

```tsx
it("shows closed toast when submit returns 403", async () => {
  const qc = createTestQueryClient();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
  qc.setQueryData(["/api/feature-flags"], {
    featureFlags: [{ id: 1, featureKey: "rsvp", featureName: "RSVP", description: "", enabled: true, updatedAt: "" }],
  });
  qc.setQueryData(["/api/app-settings"], {
    settings: [{ id: 1, settingKey: "rsvp_deadline", settingValue: tomorrow, settingType: "date", description: null, updatedAt: "" }],
  });

  const originalFetch = global.fetch;
  global.fetch = vi.fn((url, options) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    if (urlStr.includes("/api/rsvp") && options?.method === "POST") {
      return Promise.resolve(
        new Response(
          JSON.stringify({ error: { message: "RSVP submissions are closed", code: "FORBIDDEN" } }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        )
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
    );
  }) as any;

  render(
    <QueryClientProvider client={qc}>
      <RsvpSection />
    </QueryClientProvider>
  );

  fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "John" } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "john@test.com" } });
  fireEvent.click(screen.getByTestId("button-submit-rsvp"));

  await waitFor(() => {
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "RSVP Closed" })
    );
  });

  global.fetch = originalFetch;
});
```

- [ ] **Step 4: Run the new tests to confirm they fail**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/components/__tests__/RsvpSection.test.tsx 2>&1 | tail -30
```

Expected: the three new tests FAIL because the closed state branch doesn't exist yet.

---

## Task 4: Frontend — Implement Closed State in RsvpSection

**Files:**
- Modify: `client/src/components/RsvpSection.tsx`

- [ ] **Step 1: Add the `/api/app-settings` query**

After the existing `useFeatureFlags` lines (around line 47-48), add:

```tsx
const { data: appSettingsData } = useQuery<{ settings: any[] }>({
  queryKey: ['/api/app-settings'],
  staleTime: 60 * 1000,
});
```

- [ ] **Step 2: Derive isDeadlinePassed**

After the `const rsvpEnabled = ...` line, add:

```tsx
const isDeadlinePassed = (() => {
  const deadlineSetting = appSettingsData?.settings?.find(
    (s: any) => s.settingKey === 'rsvp_deadline'
  );
  if (!deadlineSetting) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineSetting.settingValue + 'T00:00:00');
  return deadline <= today;
})();
```

- [ ] **Step 3: Add the closed state render branch**

After the existing flag check (line ~202-204):
```tsx
if (!isFlagsLoading && !rsvpEnabled) {
  return null;
}
```

Add this block immediately after it:
```tsx
if (rsvpEnabled && isDeadlinePassed) {
  return (
    <section id="rsvp" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture">
      <div className="container mx-auto px-4">
        <div className="max-w-xl mx-auto glass-card p-8 md:p-10 rounded-2xl text-center">
          <i className="fas fa-calendar-times text-4xl text-muted-foreground mb-4 block"></i>
          <h3 className="text-3xl font-cormorant text-foreground mb-3">RSVP is Now Closed</h3>
          <p className="text-muted-foreground font-montserrat">
            We are no longer accepting RSVPs. Thank you to everyone who has already responded!
          </p>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Handle 403 in the mutation onError**

Replace the existing `onError` callback in the `useMutation` block:

```tsx
onError: (error) => {
  const status = (error as any)?.cause?.status;
  if (status === 403) {
    toast({
      title: "RSVP Closed",
      description: "RSVP submissions are now closed.",
      variant: "destructive",
    });
    queryClient.invalidateQueries({ queryKey: ['/api/app-settings'] });
    return;
  }
  console.error("RSVP submission error:", error);
  toast({
    title: "Error",
    description: `Failed to submit RSVP: ${error instanceof Error ? error.message : 'Unknown error'}`,
    variant: "destructive",
  });
},
```

- [ ] **Step 5: Run the tests**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/components/__tests__/RsvpSection.test.tsx 2>&1 | tail -30
```

Expected: all tests PASS including the two new deadline tests.

- [ ] **Step 6: TypeScript check**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/RsvpSection.tsx client/src/components/__tests__/RsvpSection.test.tsx
git commit -m "feat: show RSVP closed message when rsvp_deadline has passed"
```

---

## Task 5: Admin — Create RsvpDeadlinePage

**Files:**
- Create: `client/src/pages/admin/RsvpDeadlinePage.tsx`

- [ ] **Step 1: Create the file**

Create `client/src/pages/admin/RsvpDeadlinePage.tsx` with this content:

```tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { WEDDING_DATE } from "@/lib/constants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Loader2 } from "lucide-react";

function getDefaultDeadline(): string {
  const d = new Date(WEDDING_DATE);
  d.setDate(d.getDate() - 10);
  return d.toISOString().split("T")[0];
}

function computeStatus(deadlineValue: string | null): {
  isPast: boolean;
  daysFromToday: number | null;
} {
  if (!deadlineValue) return { isPast: false, daysFromToday: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineValue + "T00:00:00");
  const isPast = deadline <= today;
  const daysFromToday = Math.round(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return { isPast, daysFromToday };
}

export default function RsvpDeadlinePage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();
  const [deadlineInput, setDeadlineInput] = useState<string>(getDefaultDeadline());
  const [savedDeadline, setSavedDeadline] = useState<string | null>(null);

  const { data: appSettingsData, isLoading } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  useEffect(() => {
    if (appSettingsData?.settings) {
      const setting = appSettingsData.settings.find(
        (s: any) => s.settingKey === "rsvp_deadline"
      );
      if (setting) {
        setSavedDeadline(setting.settingValue);
        setDeadlineInput(setting.settingValue);
      }
    }
  }, [appSettingsData]);

  const mutation = useMutation({
    mutationFn: async (dateValue: string) => {
      await apiRequest("PATCH", "/api/admin/app-settings/bulk", {
        settings: [
          {
            settingKey: "rsvp_deadline",
            settingValue: dateValue,
            settingType: "date",
            description: "Date on which RSVP submissions close (inclusive)",
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Success", description: "RSVP deadline updated" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update deadline: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const { isPast, daysFromToday } = computeStatus(savedDeadline);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
            <p className="text-gray-500">Loading settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-rose-600" />
          <div>
            <CardTitle className="text-xl">RSVP Deadline</CardTitle>
            <CardDescription>
              Configure when RSVP submissions automatically close
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        {savedDeadline && (
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <span className="text-sm font-medium text-gray-700">Current Status:</span>
            {isPast ? (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                CLOSED — closed {Math.abs(daysFromToday!)} day{Math.abs(daysFromToday!) !== 1 ? "s" : ""} ago
              </Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800 border-green-200">
                OPEN — closes in {daysFromToday} day{daysFromToday !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {/* Warning banner when past */}
        {savedDeadline && isPast && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>Deadline is in the past.</strong> RSVP is currently closed for guests. Update the date to reopen.
            </p>
          </div>
        )}

        {/* Deadline Date Picker */}
        <div className="space-y-2">
          <Label htmlFor="rsvp-deadline">
            Deadline Date
          </Label>
          <p className="text-xs text-muted-foreground">
            RSVP closes on this date (inclusive). Change to any past date to test the closed state.
          </p>
          <div className="flex items-center gap-3">
            <Input
              id="rsvp-deadline"
              type="date"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="max-w-[200px]"
              data-testid="input-rsvp-deadline"
            />
            <Button
              onClick={() => mutation.mutate(deadlineInput)}
              disabled={mutation.isPending || !deadlineInput}
              data-testid="button-save-rsvp-deadline"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </div>

        {/* Info box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Testing:</strong> Set the deadline to yesterday to verify guests see the closed message, then restore it to the intended date.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -20
```

Expected: no errors.

---

## Task 6: Admin — Wire Nav Item and Route

**Files:**
- Modify: `client/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Add import for the new page and icon**

In `AdminLayout.tsx`, the current import lines include:
```tsx
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3, TicketCheck, Palette } from "lucide-react";
import DressCodePage from "./DressCodePage";
```

Change them to:
```tsx
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3, TicketCheck, Palette, CalendarClock } from "lucide-react";
import DressCodePage from "./DressCodePage";
import RsvpDeadlinePage from "./RsvpDeadlinePage";
```

- [ ] **Step 2: Add the nav item**

In `NAV_ITEMS`, after the `dress-code` entry:
```tsx
{ path: "/dress-code", label: "Dress Code", icon: Palette },
```

Add:
```tsx
{ path: "/rsvp-deadline", label: "RSVP Deadline", icon: CalendarClock },
```

- [ ] **Step 3: Add the route**

In the `<Switch>` block, after the dress-code route:
```tsx
<Route path="/dress-code" component={DressCodePage} />
```

Add:
```tsx
<Route path="/rsvp-deadline" component={RsvpDeadlinePage} />
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 5: Run all frontend tests**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run 2>&1 | tail -20
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/RsvpDeadlinePage.tsx client/src/pages/admin/AdminLayout.tsx
git commit -m "feat: add RSVP Deadline admin page with date picker and status indicator"
```

---

## Task 7: Manual Smoke Test

- [ ] **Step 1: Start both servers**

Terminal 1 (backend):
```bash
cd go-server && make run-dev
```

Terminal 2 (frontend):
```bash
npm run dev
```

- [ ] **Step 2: Test the closed state**

1. Navigate to `http://localhost:5173/admin` and log in
2. Click "RSVP Deadline" in the sidebar
3. Set the deadline to yesterday's date and click Save
4. Verify the status badge shows "CLOSED"
5. Open a new tab at `http://localhost:5173` (guest view)
6. Scroll to the RSVP section — verify "RSVP is Now Closed" message appears instead of the form

- [ ] **Step 3: Test enforcement via API**

```bash
curl -s -X POST http://localhost:5000/api/rsvp \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","attendanceType":"both"}' | python3 -m json.tool
```

Expected: `{"error": {"message": "RSVP submissions are closed", ...}}` with HTTP 403.

- [ ] **Step 4: Restore the deadline and verify RSVP reopens**

Back in admin, set the deadline to a future date. Refresh the guest view. Confirm the RSVP form appears again.

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -p
git commit -m "fix: <describe any fixups from smoke test>"
```
