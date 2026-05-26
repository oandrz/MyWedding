# RSVP Max Guests Configurable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the admin to configure a global max guest count that dynamically controls the guest dropdown on the RSVP form.

**Architecture:** A new `rsvp_max_guests` key is stored in the existing `app_settings` table. `RsvpSection.tsx` already fetches `/api/app-settings` for the deadline — it derives `maxGuests` from the same response and renders dropdown options dynamically. The admin page (`RsvpDeadlinePage.tsx`) is renamed to `RsvpSettingsPage.tsx` and gains a second card for the max guests setting. No backend changes needed.

**Tech Stack:** React 18, TypeScript, TanStack React Query, Vitest, Testing Library, Shadcn/Radix UI, Tailwind CSS.

---

## Files

| File | Action |
|------|--------|
| `client/src/components/__tests__/RsvpSection.test.tsx` | Modify — add two test cases for dynamic options |
| `client/src/components/RsvpSection.tsx` | Modify — derive `maxGuests` from app settings, dynamic dropdown |
| `client/src/pages/admin/__tests__/RsvpSettingsPage.test.tsx` | Create — tests for the new settings page |
| `client/src/pages/admin/RsvpSettingsPage.tsx` | Create — renamed + extended `RsvpDeadlinePage` with max guests card |
| `client/src/pages/admin/AdminLayout.tsx` | Modify — update import and nav label |
| `client/src/pages/admin/RsvpDeadlinePage.tsx` | Delete — replaced by `RsvpSettingsPage.tsx` |

---

## Task 1: Dynamic guest dropdown in `RsvpSection.tsx`

**Files:**
- Modify: `client/src/components/__tests__/RsvpSection.test.tsx`
- Modify: `client/src/components/RsvpSection.tsx`

- [ ] **Step 1: Add failing tests to `RsvpSection.test.tsx`**

Add the helper function `renderWithMaxGuests` and two new test cases inside the existing `describe("RsvpSection")` block, after the last existing test:

```tsx
function renderWithMaxGuests(maxGuests: number) {
  const qc = createTestQueryClient();
  qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
  qc.setQueryData(["/api/feature-flags"], {
    featureFlags: [{ id: 1, featureKey: "rsvp", featureName: "RSVP", description: "", enabled: true, updatedAt: "" }],
  });
  qc.setQueryData(["/api/app-settings"], {
    settings: [
      { id: 1, settingKey: "rsvp_max_guests", settingValue: String(maxGuests), settingType: "number", description: null, updatedAt: "" },
    ],
  });
  return render(
    <QueryClientProvider client={qc}>
      <RsvpSection />
    </QueryClientProvider>
  );
}
```

```tsx
  it("renders dynamic guest count options up to rsvp_max_guests", () => {
    renderWithMaxGuests(3);
    const select = screen.getByLabelText(/number of guests/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
    expect(select.options[0].value).toBe("1");
    expect(select.options[1].value).toBe("2");
    expect(select.options[2].value).toBe("3");
  });

  it("falls back to 4 guest options when rsvp_max_guests is not set", () => {
    renderRsvpSection();
    const select = screen.getByLabelText(/number of guests/i) as HTMLSelectElement;
    expect(select.options).toHaveLength(4);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/components/__tests__/RsvpSection.test.tsx
```

Expected: The first new test fails because the dropdown currently has 4 hardcoded options regardless of the setting.

- [ ] **Step 3: Derive `maxGuests` in `RsvpSection.tsx`**

After line 68 (the closing `})();` of the `isDeadlinePassed` block), add the following:

```tsx
  const maxGuests = (() => {
    const setting = appSettingsData?.settings?.find(
      (s: any) => s.settingKey === 'rsvp_max_guests'
    );
    const parsed = parseInt(setting?.settingValue ?? '4', 10);
    return parsed > 0 ? parsed : 4;
  })();
```

- [ ] **Step 4: Replace hardcoded `<option>` elements in `RsvpSection.tsx`**

Find the guest count `<select>` block (around line 441–445) that currently reads:

```tsx
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
```

Replace it with:

```tsx
                    {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/components/__tests__/RsvpSection.test.tsx
```

Expected: All tests pass including both new test cases.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/RsvpSection.tsx client/src/components/__tests__/RsvpSection.test.tsx
git commit -m "feat: dynamic RSVP guest count dropdown from rsvp_max_guests setting"
```

---

## Task 2: Admin UI — extend RSVP Deadline page to RSVP Settings page

**Files:**
- Create: `client/src/pages/admin/__tests__/RsvpSettingsPage.test.tsx`
- Create: `client/src/pages/admin/RsvpSettingsPage.tsx`
- Modify: `client/src/pages/admin/AdminLayout.tsx`
- Delete: `client/src/pages/admin/RsvpDeadlinePage.tsx`

- [ ] **Step 1: Write failing tests in `RsvpSettingsPage.test.tsx`**

Create the file at `client/src/pages/admin/__tests__/RsvpSettingsPage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import RsvpSettingsPage from "../RsvpSettingsPage";

function renderPage(settings: any[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/app-settings"], { settings });
  return render(
    <QueryClientProvider client={qc}>
      <RsvpSettingsPage />
    </QueryClientProvider>
  );
}

describe("RsvpSettingsPage – max guests", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders max guests heading, input, and save button", () => {
    renderPage();
    expect(screen.getByText("Max Guests per RSVP")).toBeInTheDocument();
    expect(screen.getByTestId("input-rsvp-max-guests")).toBeInTheDocument();
    expect(screen.getByTestId("button-save-rsvp-max-guests")).toBeInTheDocument();
  });

  it("defaults to 4 when rsvp_max_guests setting is absent", () => {
    renderPage([]);
    expect(screen.getByTestId("input-rsvp-max-guests")).toHaveValue(4);
  });

  it("shows current value from settings", () => {
    renderPage([
      { settingKey: "rsvp_max_guests", settingValue: "6", settingType: "number", description: null, updatedAt: "" },
    ]);
    expect(screen.getByTestId("input-rsvp-max-guests")).toHaveValue(6);
  });

  it("save button is disabled when input is empty", () => {
    renderPage();
    fireEvent.change(screen.getByTestId("input-rsvp-max-guests"), { target: { value: "" } });
    expect(screen.getByTestId("button-save-rsvp-max-guests")).toBeDisabled();
  });

  it("calls bulk update API with rsvp_max_guests when Save is clicked", async () => {
    let capturedBody: any;
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url, options) => {
      if (url.toString().includes("/api/admin/app-settings/bulk")) {
        capturedBody = JSON.parse(options!.body as string);
        return Promise.resolve(new Response(
          JSON.stringify({ updated: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));
      }
      return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
    }) as any;

    renderPage([
      { settingKey: "rsvp_max_guests", settingValue: "4", settingType: "number", description: null, updatedAt: "" },
    ]);

    fireEvent.change(screen.getByTestId("input-rsvp-max-guests"), { target: { value: "5" } });
    fireEvent.click(screen.getByTestId("button-save-rsvp-max-guests"));

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
      expect(capturedBody.settings[0].settingKey).toBe("rsvp_max_guests");
      expect(capturedBody.settings[0].settingValue).toBe("5");
    });

    global.fetch = originalFetch;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/RsvpSettingsPage.test.tsx
```

Expected: Fails with "Cannot find module '../RsvpSettingsPage'" — confirms the test is wired up correctly before implementation.

- [ ] **Step 3: Create `RsvpSettingsPage.tsx`**

Create the file at `client/src/pages/admin/RsvpSettingsPage.tsx` with the following content. This is the existing `RsvpDeadlinePage.tsx` content, renamed, with a second card added for max guests:

```tsx
import { useState, useEffect, useRef } from "react";
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
import { CalendarClock, Loader2, Users } from "lucide-react";

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

export default function RsvpSettingsPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const [deadlineInput, setDeadlineInput] = useState<string>(getDefaultDeadline());
  const [savedDeadline, setSavedDeadline] = useState<string | null>(null);
  const hasInitializedDeadlineRef = useRef(false);

  const [maxGuestsInput, setMaxGuestsInput] = useState<string>("4");
  const hasInitializedMaxGuestsRef = useRef(false);

  const { data: appSettingsData, isLoading } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  useEffect(() => {
    if (appSettingsData?.settings) {
      const deadlineSetting = appSettingsData.settings.find(
        (s: any) => s.settingKey === "rsvp_deadline"
      );
      if (deadlineSetting) {
        setSavedDeadline(deadlineSetting.settingValue);
        if (!hasInitializedDeadlineRef.current) {
          hasInitializedDeadlineRef.current = true;
          setDeadlineInput(deadlineSetting.settingValue);
        }
      }

      const maxGuestsSetting = appSettingsData.settings.find(
        (s: any) => s.settingKey === "rsvp_max_guests"
      );
      if (maxGuestsSetting && !hasInitializedMaxGuestsRef.current) {
        hasInitializedMaxGuestsRef.current = true;
        setMaxGuestsInput(maxGuestsSetting.settingValue);
      }
    }
  }, [appSettingsData]);

  const deadlineMutation = useMutation({
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

  const maxGuestsMutation = useMutation({
    mutationFn: async (value: string) => {
      await apiRequest("PATCH", "/api/admin/app-settings/bulk", {
        settings: [
          {
            settingKey: "rsvp_max_guests",
            settingValue: value,
            settingType: "number",
            description: "Maximum number of guests allowed per RSVP",
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Success", description: "Max guests updated" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({
        title: "Error",
        description: `Failed to update max guests: ${error.message}`,
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
    <div className="space-y-6">
      {/* RSVP Deadline */}
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

          {savedDeadline && isPast && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Deadline is in the past.</strong> RSVP is currently closed for guests. Update the date to reopen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rsvp-deadline">Deadline Date</Label>
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
                onClick={() => deadlineMutation.mutate(deadlineInput)}
                disabled={deadlineMutation.isPending || !deadlineInput}
                data-testid="button-save-rsvp-deadline"
              >
                {deadlineMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Testing:</strong> Set the deadline to yesterday to verify guests see the closed message, then restore it to the intended date.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Max Guests per RSVP */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-rose-600" />
            <div>
              <CardTitle className="text-xl">Max Guests per RSVP</CardTitle>
              <CardDescription>
                Controls how many guests a single RSVP can include
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rsvp-max-guests">Maximum guests</Label>
            <p className="text-xs text-muted-foreground">
              The guest count dropdown on the RSVP form will show options from 1 up to this number.
            </p>
            <div className="flex items-center gap-3">
              <Input
                id="rsvp-max-guests"
                type="number"
                min={1}
                max={20}
                value={maxGuestsInput}
                onChange={(e) => setMaxGuestsInput(e.target.value)}
                className="max-w-[120px]"
                data-testid="input-rsvp-max-guests"
              />
              <Button
                onClick={() => maxGuestsMutation.mutate(maxGuestsInput)}
                disabled={maxGuestsMutation.isPending || !maxGuestsInput}
                data-testid="button-save-rsvp-max-guests"
              >
                {maxGuestsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Update `AdminLayout.tsx`**

Make three changes in `client/src/pages/admin/AdminLayout.tsx`:

1. Replace the import line:
```tsx
// Before:
import RsvpDeadlinePage from "./RsvpDeadlinePage";
// After:
import RsvpSettingsPage from "./RsvpSettingsPage";
```

2. Update the nav label in `NAV_ITEMS`:
```tsx
// Before:
  { path: "/rsvp-deadline", label: "RSVP Deadline", icon: CalendarClock },
// After:
  { path: "/rsvp-deadline", label: "RSVP Settings", icon: CalendarClock },
```

3. Update the route component:
```tsx
// Before:
              <Route path="/rsvp-deadline" component={RsvpDeadlinePage} />
// After:
              <Route path="/rsvp-deadline" component={RsvpSettingsPage} />
```

- [ ] **Step 5: Delete `RsvpDeadlinePage.tsx`**

```bash
git rm client/src/pages/admin/RsvpDeadlinePage.tsx
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/RsvpSettingsPage.test.tsx
```

Expected: All 5 tests pass.

Then run the full suite to confirm nothing broke:

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run
```

Expected: All tests pass (existing `RsvpSection` tests, `AdminLayout` tests, etc.).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/RsvpSettingsPage.tsx \
        client/src/pages/admin/__tests__/RsvpSettingsPage.test.tsx \
        client/src/pages/admin/AdminLayout.tsx
git commit -m "feat: extend RSVP settings page with configurable max guests"
```
