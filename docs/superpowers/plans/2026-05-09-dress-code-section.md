# Dress Code Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guest-facing Dress Code section showing forbidden attire colors, managed dynamically from a new admin page.

**Architecture:** Colors are stored as a JSON string in the existing `app_settings` table under key `dress_code_colors`. A single migration seeds the `dress_code` feature flag. All reads/writes reuse existing endpoints — zero new Go files. Frontend adds a `DressCodeSection` component, a `DressCodePage` admin page, and wires both into the existing page compositions.

**Tech Stack:** Vitest + Testing Library (frontend tests), React Query, framer-motion, Tailwind CSS, lucide-react, native HTML `<input type="color">`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `go-server/migrations/008_add_dress_code.sql` | Create | Seed `dress_code` feature flag |
| `client/src/hooks/useFeatureFlags.ts` | Modify | Export `useDressCodeEnabled` convenience hook |
| `client/src/components/DressCodeSection.tsx` | Create | Guest-facing section: reads colors from app_settings, renders swatches |
| `client/src/components/__tests__/DressCodeSection.test.tsx` | Create | Tests for DressCodeSection |
| `client/src/pages/Home.tsx` | Modify | Mount DressCodeSection after DetailsSection, guarded by feature flag |
| `client/src/pages/admin/DressCodePage.tsx` | Create | Admin color manager: add/remove colors, save to app_settings |
| `client/src/pages/admin/__tests__/DressCodePage.test.tsx` | Create | Tests for DressCodePage |
| `client/src/pages/admin/AdminLayout.tsx` | Modify | Add "Dress Code" nav entry + route |

---

## Task 1: Migration — seed dress_code feature flag

**Files:**
- Create: `go-server/migrations/008_add_dress_code.sql`

- [ ] **Step 1: Create the migration file**

```sql
INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
VALUES ('dress_code', 'Dress Code', 'Show dress code section with forbidden attire colors', FALSE)
ON CONFLICT (feature_key) DO NOTHING;
```

- [ ] **Step 2: Verify file exists and content is correct**

```bash
cat go-server/migrations/008_add_dress_code.sql
```
Expected: the INSERT statement above.

- [ ] **Step 3: Commit**

```bash
git add go-server/migrations/008_add_dress_code.sql
git commit -m "feat: add dress_code feature flag migration"
```

---

## Task 2: Feature flag hook

**Files:**
- Modify: `client/src/hooks/useFeatureFlags.ts`

- [ ] **Step 1: Add `useDressCodeEnabled` at the end of the file, after `useMusicAutoplayEnabled`**

Open `client/src/hooks/useFeatureFlags.ts` and append:

```ts
export function useDressCodeEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('dress_code');
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run check
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useFeatureFlags.ts
git commit -m "feat: add useDressCodeEnabled hook"
```

---

## Task 3: DressCodeSection component (TDD)

**Files:**
- Create: `client/src/components/DressCodeSection.tsx`
- Create: `client/src/components/__tests__/DressCodeSection.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/components/__tests__/DressCodeSection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, whileInView, viewport, variants, ...rest } = props;
      return <div {...rest}>{children}</div>;
    },
    h2: ({ children, ...props }: any) => {
      const { initial, whileInView, viewport, variants, ...rest } = props;
      return <h2 {...rest}>{children}</h2>;
    },
    p: ({ children, ...props }: any) => {
      const { initial, whileInView, viewport, variants, ...rest } = props;
      return <p {...rest}>{children}</p>;
    },
  },
}));

import DressCodeSection from "../DressCodeSection";

function renderWithColors(colors: { hex: string; label: string }[] | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (colors !== null) {
    qc.setQueryData(["/api/app-settings"], {
      settings: [{ settingKey: "dress_code_colors", settingValue: JSON.stringify(colors) }],
    });
  }
  return render(
    <QueryClientProvider client={qc}><DressCodeSection /></QueryClientProvider>
  );
}

describe("DressCodeSection", () => {
  it("renders nothing while data is loading (no query data seeded)", () => {
    const { container } = renderWithColors(null);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when colors array is empty", () => {
    const { container } = renderWithColors([]);
    expect(container.firstChild).toBeNull();
  });

  it("renders heading and subtitle when colors are present", () => {
    renderWithColors([{ hex: "#FFFFFF", label: "White" }]);
    expect(screen.getByText("Dress Code")).toBeInTheDocument();
    expect(screen.getByText("Attire")).toBeInTheDocument();
    expect(screen.getByText(/avoid wearing the following colors/i)).toBeInTheDocument();
  });

  it("renders a swatch and label for each color", () => {
    renderWithColors([
      { hex: "#FFFFFF", label: "White" },
      { hex: "#FFD700", label: "Gold" },
    ]);
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    const swatch0 = screen.getByTestId("color-swatch-0");
    const swatch1 = screen.getByTestId("color-swatch-1");
    expect(swatch0).toHaveStyle({ backgroundColor: "#FFFFFF" });
    expect(swatch1).toHaveStyle({ backgroundColor: "#FFD700" });
  });

  it("renders nothing when dress_code_colors value is malformed JSON", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["/api/app-settings"], {
      settings: [{ settingKey: "dress_code_colors", settingValue: "{{invalid" }],
    });
    const { container } = render(
      <QueryClientProvider client={qc}><DressCodeSection /></QueryClientProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- DressCodeSection
```
Expected: FAIL — `Cannot find module '../DressCodeSection'`

- [ ] **Step 3: Create the component**

Create `client/src/components/DressCodeSection.tsx`:

```tsx
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fadeIn, staggerContainer, staggerFast } from "@/lib/animations";

interface DressCodeColor {
  hex: string;
  label: string;
}

const DressCodeSection = () => {
  const { data } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  const raw = data?.settings.find(s => s.settingKey === "dress_code_colors")?.settingValue ?? "[]";
  let colors: DressCodeColor[] = [];
  try { colors = JSON.parse(raw); } catch { colors = []; }

  if (!data || colors.length === 0) return null;

  return (
    <section
      id="dress-code"
      className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture"
    >
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
        >
          <motion.p
            className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-3"
            variants={fadeIn}
          >
            Attire
          </motion.p>
          <motion.h2
            className="text-5xl md:text-6xl font-cormorant font-bold text-foreground mb-4"
            variants={fadeIn}
          >
            Dress Code
          </motion.h2>
          <motion.div
            className="w-24 h-1 bg-primary mx-auto rounded-full mb-6"
            variants={fadeIn}
          />
          <motion.p
            className="text-muted-foreground font-montserrat max-w-2xl mx-auto"
            variants={fadeIn}
          >
            We kindly ask that guests avoid wearing the following colors to our celebration
          </motion.p>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-8 md:gap-12"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerFast}
        >
          {colors.map((color, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center gap-3"
              variants={fadeIn}
            >
              <div
                className="w-20 h-20 rounded-full border-2 border-primary shadow-md"
                style={{ backgroundColor: color.hex }}
                data-testid={`color-swatch-${index}`}
              />
              <span className="text-xs uppercase font-montserrat tracking-widest text-foreground">
                {color.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default DressCodeSection;
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- DressCodeSection
```
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/DressCodeSection.tsx client/src/components/__tests__/DressCodeSection.test.tsx
git commit -m "feat: add DressCodeSection guest component"
```

---

## Task 4: Wire DressCodeSection into Home.tsx

**Files:**
- Modify: `client/src/pages/Home.tsx`

- [ ] **Step 1: Add the import and hook at the top of Home.tsx**

In `client/src/pages/Home.tsx`, add to the imports:

```ts
import DressCodeSection from "@/components/DressCodeSection";
import { useDressCodeEnabled, useGalleryEnabled, useRsvpEnabled, useEGiftEnabled, useMessagesEnabled } from "@/hooks/useFeatureFlags";
```

Replace the existing `useFeatureFlags` import line with the one above (it already imports these — just add `useDressCodeEnabled`).

Then add inside the `Home` component body, alongside the other flag hooks:

```ts
const isDressCodeEnabled = useDressCodeEnabled();
```

- [ ] **Step 2: Insert section after DetailsSection**

In the JSX, find this existing block:
```tsx
<DetailsSection />
{/* Floral Divider */}
<div className="floral-divider w-full"></div>
{isGalleryEnabled && <GallerySection />}
```

Replace with:
```tsx
<DetailsSection />
{/* Floral Divider */}
<div className="floral-divider w-full"></div>
{isDressCodeEnabled && <DressCodeSection />}
{isDressCodeEnabled && <div className="floral-divider w-full"></div>}
{isGalleryEnabled && <GallerySection />}
```

The existing divider after DetailsSection is kept. DressCodeSection slots in after it, and adds its own divider only when visible — so Gallery always has a divider before it whether or not Dress Code is shown.

- [ ] **Step 3: Type check**

```bash
npm run check
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Home.tsx
git commit -m "feat: add DressCodeSection to Home page"
```

---

## Task 5: DressCodePage admin component (TDD)

**Files:**
- Create: `client/src/pages/admin/DressCodePage.tsx`
- Create: `client/src/pages/admin/__tests__/DressCodePage.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `client/src/pages/admin/__tests__/DressCodePage.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import DressCodePage from "../DressCodePage";

function renderDressCodePage(colors: { hex: string; label: string }[] = []) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/app-settings"], {
    settings: [{ settingKey: "dress_code_colors", settingValue: JSON.stringify(colors) }],
  });
  return render(
    <QueryClientProvider client={qc}><DressCodePage /></QueryClientProvider>
  );
}

describe("DressCodePage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders heading, add form, and save button", () => {
    renderDressCodePage();
    expect(screen.getByText("Dress Code Colors")).toBeInTheDocument();
    expect(screen.getByTestId("input-new-label")).toBeInTheDocument();
    expect(screen.getByTestId("button-add-color")).toBeInTheDocument();
    expect(screen.getByTestId("button-save")).toBeInTheDocument();
  });

  it("shows empty state when no colors configured", () => {
    renderDressCodePage([]);
    expect(screen.getByText(/no colors yet/i)).toBeInTheDocument();
  });

  it("renders existing colors loaded from settings", () => {
    renderDressCodePage([
      { hex: "#FFFFFF", label: "White" },
      { hex: "#000000", label: "Black" },
    ]);
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.getByText("Black")).toBeInTheDocument();
    expect(screen.getByTestId("color-row-0")).toBeInTheDocument();
    expect(screen.getByTestId("color-row-1")).toBeInTheDocument();
  });

  it("Add button is disabled when label input is empty", () => {
    renderDressCodePage();
    expect(screen.getByTestId("button-add-color")).toBeDisabled();
  });

  it("enables Add button when label is typed", () => {
    renderDressCodePage();
    fireEvent.change(screen.getByTestId("input-new-label"), { target: { value: "White" } });
    expect(screen.getByTestId("button-add-color")).not.toBeDisabled();
  });

  it("adds a color to the list and clears the input", () => {
    renderDressCodePage();
    fireEvent.change(screen.getByTestId("input-new-label"), { target: { value: "White" } });
    fireEvent.click(screen.getByTestId("button-add-color"));
    expect(screen.getByText("White")).toBeInTheDocument();
    expect(screen.queryByText(/no colors yet/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("input-new-label")).toHaveValue("");
  });

  it("removes a color when Remove is clicked", () => {
    renderDressCodePage([{ hex: "#FFFFFF", label: "White" }]);
    fireEvent.click(screen.getByTestId("button-remove-0"));
    expect(screen.queryByText("White")).not.toBeInTheDocument();
    expect(screen.getByText(/no colors yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- DressCodePage
```
Expected: FAIL — `Cannot find module '../DressCodePage'`

- [ ] **Step 3: Create the admin page**

Create `client/src/pages/admin/DressCodePage.tsx`:

```tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Palette, Loader2 } from "lucide-react";

interface DressCodeColor {
  hex: string;
  label: string;
}

export default function DressCodePage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const [colors, setColors] = useState<DressCodeColor[]>([]);
  const [newHex, setNewHex] = useState("#FFFFFF");
  const [newLabel, setNewLabel] = useState("");

  const { data: settingsData } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
  });

  useEffect(() => {
    if (settingsData?.settings) {
      const raw = settingsData.settings.find(s => s.settingKey === "dress_code_colors")?.settingValue ?? "[]";
      try { setColors(JSON.parse(raw)); } catch { setColors([]); }
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: (updatedColors: DressCodeColor[]) =>
      apiRequest("PATCH", "/api/admin/app-settings/bulk", {
        settings: [{
          settingKey: "dress_code_colors",
          settingValue: JSON.stringify(updatedColors),
          settingType: "json",
          description: "Forbidden attire colors for dress code section",
        }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-settings"] });
      toast({ title: "Saved", description: "Dress code colors updated" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to save: ${error.message}`, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    setColors(prev => [...prev, { hex: newHex, label: newLabel.trim() }]);
    setNewLabel("");
    setNewHex("#FFFFFF");
  };

  const handleRemove = (index: number) => {
    setColors(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Palette className="h-6 w-6 text-rose-500" />
          <div>
            <CardTitle className="text-xl">Dress Code Colors</CardTitle>
            <CardDescription>Add or remove colors guests should avoid wearing</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add new color */}
        <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-4 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Add Color</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white border rounded-md px-3 py-2">
              <input
                type="color"
                value={newHex}
                onChange={e => setNewHex(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 bg-transparent"
                data-testid="input-new-hex"
              />
              <span className="text-sm text-muted-foreground font-mono">{newHex}</span>
            </div>
            <Input
              placeholder="Color name (e.g. White)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="flex-1 min-w-[160px]"
              data-testid="input-new-label"
            />
            <Button
              onClick={handleAdd}
              disabled={!newLabel.trim()}
              data-testid="button-add-color"
            >
              + Add
            </Button>
          </div>
        </div>

        {/* Color list */}
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Current Colors</p>

        {colors.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-rose-200 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground italic" data-testid="empty-state">
              No colors yet — use the form above to add some
            </p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {colors.map((color, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-3 border rounded-lg bg-white"
                data-testid={`color-row-${index}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full border-2 border-primary/30 shadow-sm flex-shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{color.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{color.hex}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemove(index)}
                  className="text-rose-500 border-rose-200 hover:bg-rose-50"
                  data-testid={`button-remove-${index}`}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={() => saveMutation.mutate(colors)}
          disabled={saveMutation.isPending}
          className="w-full"
          data-testid="button-save"
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- DressCodePage
```
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/DressCodePage.tsx client/src/pages/admin/__tests__/DressCodePage.test.tsx
git commit -m "feat: add DressCodePage admin component"
```

---

## Task 6: Wire admin page into AdminLayout

**Files:**
- Modify: `client/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Add Palette to the lucide-react import**

In `client/src/pages/admin/AdminLayout.tsx`, find:
```ts
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3, TicketCheck } from "lucide-react";
```
Replace with:
```ts
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3, TicketCheck, Palette } from "lucide-react";
```

- [ ] **Step 2: Add DressCodePage import**

Add after the other admin page imports:
```ts
import DressCodePage from "./DressCodePage";
```

- [ ] **Step 3: Add nav item to NAV_ITEMS**

Find the `NAV_ITEMS` array and add the new entry after `"/flags"`:
```ts
{ path: "/dress-code", label: "Dress Code", icon: Palette },
```

- [ ] **Step 4: Add route to the Switch**

Find the `<Switch>` block and add after the `/flags` route:
```tsx
<Route path="/dress-code" component={DressCodePage} />
```

- [ ] **Step 5: Type check and run all tests**

```bash
npm run check && npm test
```
Expected: no type errors, all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/AdminLayout.tsx
git commit -m "feat: add Dress Code page to admin navigation"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start both servers**

Terminal 1:
```bash
cd go-server && make run-dev
```
Terminal 2:
```bash
npm run dev
```

- [ ] **Step 2: Verify section is hidden by default**

Open `http://localhost:5173`. Confirm no "Dress Code" section appears (feature flag seeded as `FALSE`).

- [ ] **Step 3: Enable the flag and add colors**

1. Open `http://localhost:5173/admin` and log in
2. Go to **Flags** → toggle **Dress Code** on
3. Go to **Dress Code** (new nav item) → add 2–3 colors (e.g. White `#FFFFFF`, Gold `#FFD700`) → click **Save Changes**

- [ ] **Step 4: Verify section appears on guest page**

Reload `http://localhost:5173`. Confirm the "Dress Code" section appears after "The Details" section with the correct swatches and labels.

- [ ] **Step 5: Verify remove works**

In admin, remove one color → Save. Reload guest page — swatch should be gone.

- [ ] **Step 6: Verify empty state hides section**

In admin, remove all colors → Save. Reload guest page — section should disappear entirely (even with flag enabled).
