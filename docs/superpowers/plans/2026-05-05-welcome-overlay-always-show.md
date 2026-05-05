# Welcome Overlay Always-Show Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `sessionStorage` tracking from `WelcomeOverlay` and replace it with a module-level variable so the overlay shows on every fresh page load (new tab, refresh) but not on SPA navigation within the same session.

**Architecture:** Single-file change to `WelcomeOverlay.tsx`. Add `let hasShownThisLoad = false` at module level and export a `_resetOverlayLoadState` function for test isolation. Replace two `sessionStorage` calls with reads/writes to that variable. `App.tsx`, `AudioPlayer.tsx`, and the gesture-to-autoplay chain are untouched.

**Tech Stack:** React 18, TypeScript, Vitest, @testing-library/react

---

## File Structure

| File | Change |
|---|---|
| `client/src/components/WelcomeOverlay.tsx` | Add module-level variable + export; replace 2 sessionStorage calls |
| `client/src/components/__tests__/WelcomeOverlay.test.tsx` | Add `beforeEach` reset; add 1 new test |

---

### Task 1: Replace sessionStorage with module-level variable

**Files:**
- Modify: `client/src/components/WelcomeOverlay.tsx`
- Modify: `client/src/components/__tests__/WelcomeOverlay.test.tsx`

**Context:** `WelcomeOverlay.tsx` currently guards its open logic with:
```ts
// Line ~71 inside useEffect
const hasOpenedOverlay = sessionStorage.getItem("welcome_overlay_opened");
if (hasOpenedOverlay) { return; }
```
And on dismiss (`handleOpen`):
```ts
// Line ~113
sessionStorage.setItem("welcome_overlay_opened", "true");
```
We replace both with a module-level `let` that resets on every fresh page load.

---

- [ ] **Step 1: Write the new failing test**

Open `client/src/components/__tests__/WelcomeOverlay.test.tsx` and replace its entire contents with the following. The two new tests (`does not show overlay again...` and `beforeEach` reset) will fail because `_resetOverlayLoadState` does not exist yet.

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import WelcomeOverlay, { _resetOverlayLoadState } from "../WelcomeOverlay";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...htmlProps } = props;
      return <div {...htmlProps}>{children}</div>;
    },
    h1: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...htmlProps } = props;
      return <h1 {...htmlProps}>{children}</h1>;
    },
    h2: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...htmlProps } = props;
      return <h2 {...htmlProps}>{children}</h2>;
    },
    p: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...htmlProps } = props;
      return <p {...htmlProps}>{children}</p>;
    },
    button: ({ children, ...props }: any) => {
      const { whileHover, whileTap, initial, animate, transition, ...htmlProps } = props;
      return <button {...htmlProps}>{children}</button>;
    },
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = queryKey[0] as string;
          if (key.includes("welcome-screen")) {
            return {
              welcomeScreen: {
                enabled: true,
                headingText: "You Are Invited",
                deliveryLabel: "Dear",
                fallbackName: "Guest",
              },
            };
          }
          return null;
        },
      },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: makeQueryClient() }, children);
}

beforeEach(() => {
  _resetOverlayLoadState();
});

describe("WelcomeOverlay", () => {
  it("calls onDismiss when Open Invitation button is clicked", async () => {
    const onDismiss = vi.fn();
    render(<WelcomeOverlay onDismiss={onDismiss} />, { wrapper });

    const button = await screen.findByText("Open Invitation");
    fireEvent.click(button);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not show overlay again after dismiss within the same session", async () => {
    // First render: overlay should show
    const { unmount } = render(<WelcomeOverlay />, { wrapper });
    await screen.findByText("Open Invitation");

    // Dismiss — sets hasShownThisLoad = true
    fireEvent.click(screen.getByText("Open Invitation"));
    unmount();

    // Second render without resetting module state (simulates SPA navigation back to home)
    render(<WelcomeOverlay />, { wrapper });

    await waitFor(() => {
      expect(screen.queryByTestId("welcome-overlay")).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm the new test fails**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npx vitest run client/src/components/__tests__/WelcomeOverlay.test.tsx
```

Expected: **FAIL** — TypeScript error: `_resetOverlayLoadState` is not exported from `WelcomeOverlay`.

---

- [ ] **Step 3: Add module-level variable and export to WelcomeOverlay.tsx**

Open `client/src/components/WelcomeOverlay.tsx`. After the last import line (currently line 6: `import type { WelcomeScreen } from "@shared/schema";`) and before the `PETALS` constant, add:

```ts
let hasShownThisLoad = false;
export const _resetOverlayLoadState = () => { hasShownThisLoad = false; };
```

The top of the file should now look like:

```ts
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { WelcomeScreen } from "@shared/schema";

let hasShownThisLoad = false;
export const _resetOverlayLoadState = () => { hasShownThisLoad = false; };

// Petal configuration for floating animation
const PETALS = [
  // existing petal entries unchanged
```

- [ ] **Step 4: Replace the sessionStorage.getItem guard**

Inside `WelcomeOverlay`, find the `useEffect` that controls when the overlay opens (around line 60). Locate and replace these lines:

```ts
// Check if overlay has already been opened in this session
const hasOpenedOverlay = sessionStorage.getItem("welcome_overlay_opened");

if (hasOpenedOverlay) {
  return;
}
```

with:

```ts
if (hasShownThisLoad) {
  return;
}
```

- [ ] **Step 5: Replace the sessionStorage.setItem call in handleOpen**

Find `handleOpen` (around line 103). Locate and replace:

```ts
// Mark as opened in session storage (with browser check)
if (typeof window !== 'undefined') {
  sessionStorage.setItem("welcome_overlay_opened", "true");
}
```

with:

```ts
hasShownThisLoad = true;
```

- [ ] **Step 6: Run all frontend tests to confirm everything passes**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding
npx vitest run
```

Expected: all tests pass. If the TypeScript compiler reports an error, also run:

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/WelcomeOverlay.tsx \
        client/src/components/__tests__/WelcomeOverlay.test.tsx
git commit -m "feat: show welcome overlay on every page load via module-level guard"
```
