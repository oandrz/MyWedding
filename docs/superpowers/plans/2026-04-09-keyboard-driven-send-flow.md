# Keyboard-Driven Single-Action Send Flow — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the Send All WhatsApp dialog to reduce per-invite actions from 5 to 2 by merging open+mark into one button, adding keyboard shortcuts, and providing undo.

**Architecture:** Frontend-only changes to one file (`client/src/pages/admin/InvitesPage.tsx`). No new dependencies, no backend changes. Uses existing `markWaSentMutation` and `unmarkWaSentMutation`.

**Tech Stack:** React 18, TypeScript, TanStack React Query, shadcn/Radix Dialog, lucide-react, vitest + testing-library

**Spec:** `docs/superpowers/specs/2026-04-09-keyboard-driven-send-flow-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `client/src/pages/admin/InvitesPage.tsx` | Modify (lines 17-20, 132-137, 542-568, 963-1058) | All changes: state, handlers, keyboard shortcuts, dialog JSX |
| `client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx` | Create | Tests for the Send All dialog behavior |

---

## Chunk 1: Tests + Implementation

### Task 1: Create test file with test scaffolding

**Files:**
- Create: `client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`

- [ ] **Step 1: Create the test file with mocks and render helper**

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Must mock before importing the component
const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
}));

// Mock apiRequest so mutations resolve successfully without hitting the network.
// This is CRITICAL — without it, markWaSentMutation.onSuccess never fires and the
// dialog won't advance after "Send & Next".
const mockApiRequest = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});
vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual("@/lib/queryClient");
  return { ...actual, apiRequest: (...args: unknown[]) => mockApiRequest(...args) };
});

// Mock window.open to capture deep link calls
const mockWindowOpen = vi.fn();
Object.defineProperty(window, "open", { value: mockWindowOpen, writable: true });

import InvitesPage from "../InvitesPage";

const mockInvites = {
  invites: [
    { id: 1, name: "Alice", code: "ABC1", phone: "+6281111111111", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 2, name: "Bob", code: "ABC2", phone: "+6282222222222", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 3, name: "Charlie", code: "ABC3", phone: "+6283333333333", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
    { id: 4, name: "NoPhone", code: "ABC4", phone: null, waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
  ],
};

function renderInvitesPage(invites = mockInvites) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(["/api/admin/invites"], invites);
  qc.setQueryData(["/api/settings/wa_message_template"], undefined);
  return { qc, ...render(<QueryClientProvider client={qc}><InvitesPage /></QueryClientProvider>) };
}

/** Opens the Send All dialog by clicking the "Send All Unsent" button. */
async function openSendAllDialog(user: ReturnType<typeof userEvent.setup>) {
  const btn = screen.getByRole("button", { name: /send all unsent/i });
  await user.click(btn);
}
```

- [ ] **Step 2: Run test file to verify it compiles**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`
Expected: 0 tests, no compilation errors (file has no test cases yet)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx
git commit -m "test: scaffold Send All dialog test file"
```

---

### Task 2: Write tests for "Send & Next" merged behavior

**Files:**
- Modify: `client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`

- [ ] **Step 1: Add tests for the merged "Send & Next" button**

Add these test cases after the render helper:

```tsx
describe("Send All Dialog — Send & Next", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockReturnValue({});
  });

  it("shows 'Send & Next' button instead of separate 'Open WhatsApp' and 'Mark Sent & Next'", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    expect(screen.getByRole("button", { name: /send & next/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open whatsapp/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark sent & next/i })).not.toBeInTheDocument();
  });

  it("opens wa.me link when 'Send & Next' is clicked", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    await user.click(screen.getByRole("button", { name: /send & next/i }));

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
    const url = mockWindowOpen.mock.calls[0][0] as string;
    expect(url).toContain("wa.me/6281111111111");
  });

  it("shows keyboard hints text", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    expect(screen.getByText(/enter to send/i)).toBeInTheDocument();
    expect(screen.getByText(/s to skip/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`
Expected: FAIL — "Send & Next" button not found (current button says "Open WhatsApp")

- [ ] **Step 3: Commit failing tests**

```bash
git add client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx
git commit -m "test: add failing tests for Send & Next merged button"
```

---

### Task 3: Write tests for keyboard shortcuts

**Files:**
- Modify: `client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`

- [ ] **Step 1: Add keyboard shortcut tests**

```tsx
describe("Send All Dialog — Keyboard Shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockReturnValue({});
  });

  it("Enter key triggers send-and-next", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    await user.keyboard("{Enter}");

    expect(mockWindowOpen).toHaveBeenCalledTimes(1);
  });

  it("S key triggers skip (advances without opening link)", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    // First invite is Alice. Press S to skip.
    expect(screen.getByText("Alice")).toBeInTheDocument();
    await user.keyboard("s");

    // Should advance to Bob without opening a link
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("Enter is no-op when mutation is pending", async () => {
    const user = userEvent.setup();
    // Make apiRequest hang (never resolve) so mutation stays pending
    mockApiRequest.mockReturnValueOnce(new Promise(() => {}));
    renderInvitesPage();
    await openSendAllDialog(user);

    // First Enter triggers send (mutation starts but never resolves)
    await user.keyboard("{Enter}");
    expect(mockWindowOpen).toHaveBeenCalledTimes(1);

    // Second Enter should be no-op because mutation is still pending
    await user.keyboard("{Enter}");
    expect(mockWindowOpen).toHaveBeenCalledTimes(1); // still 1, not 2
  });

  it("S key is no-op when an input element is focused", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    // The dialog should show Alice first
    expect(screen.getByText("Alice")).toBeInTheDocument();

    // Focus an input element (the search input is outside the dialog but still in the DOM)
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.click(searchInput);
    await user.keyboard("s");

    // Should NOT have advanced — Alice is still shown
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`
Expected: FAIL — keyboard shortcuts not implemented yet

- [ ] **Step 3: Commit failing tests**

```bash
git add client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx
git commit -m "test: add failing tests for keyboard shortcuts"
```

---

### Task 4: Write tests for Undo button

**Files:**
- Modify: `client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`

- [ ] **Step 1: Add undo tests**

```tsx
describe("Send All Dialog — Undo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen.mockReturnValue({});
  });

  it("does not show Undo button before any send", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
  });

  it("shows Undo button after first send", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    await user.click(screen.getByRole("button", { name: /send & next/i }));

    // Wait for mutation to resolve and re-render
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    });
  });

  it("clicking Undo calls unmark mutation and decrements sent count", async () => {
    const user = userEvent.setup();
    renderInvitesPage();
    await openSendAllDialog(user);

    // Send first invite
    await user.click(screen.getByRole("button", { name: /send & next/i }));

    // Wait for mutation to complete and Undo to appear
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument();
    });

    // Verify sent count shows 1
    expect(screen.getByText(/sent: 1/i)).toBeInTheDocument();

    // Click Undo
    await user.click(screen.getByRole("button", { name: /undo/i }));

    // Undo calls DELETE /api/admin/invites/{id}/wa-sent
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith("DELETE", expect.stringContaining("/wa-sent"));
    });

    // Undo button should disappear (single-level undo)
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument();
    });
  });

  it("shows completion summary with correct sent/skipped counts", async () => {
    const user = userEvent.setup();
    // Only 2 unsent invites with phone numbers
    renderInvitesPage({
      invites: [
        { id: 1, name: "Alice", code: "ABC1", phone: "+6281111111111", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
        { id: 2, name: "Bob", code: "ABC2", phone: "+6282222222222", waSentAt: null, rsvp: null, createdAt: "2026-04-01T00:00:00Z" },
      ],
    });
    await openSendAllDialog(user);

    // Send Alice
    await user.click(screen.getByRole("button", { name: /send & next/i }));
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());

    // Skip Bob
    await user.click(screen.getByRole("button", { name: /skip/i }));

    // Should show completion summary
    await waitFor(() => {
      expect(screen.getByText("All done!")).toBeInTheDocument();
      expect(screen.getByText(/sent: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/skipped: 1/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`
Expected: FAIL — "Send & Next" not found, Undo not implemented

- [ ] **Step 3: Commit failing tests**

```bash
git add client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx
git commit -m "test: add failing tests for undo button"
```

---

### Task 5: Implement state changes and handlers

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx:17-20` (import)
- Modify: `client/src/pages/admin/InvitesPage.tsx:132-137` (state)
- Modify: `client/src/pages/admin/InvitesPage.tsx:542-568` (handlers)

- [ ] **Step 1: Add `Undo2` to the lucide-react import**

At line 17-20, add `Undo2` to the import:

```typescript
import {
  Loader2, Trash2, Search, X, TicketCheck, Plus, Copy, Check, Upload, FileSpreadsheet,
  AlertTriangle, Users, Phone, MessageCircle, Send, ChevronDown, ChevronUp, SkipForward, Pause, Undo2,
} from "lucide-react";
```

- [ ] **Step 2: Add `lastSentInviteId` state**

After line 136 (`const [sendAllSkipCount, setSendAllSkipCount] = useState(0);`), add:

```typescript
const [lastSentInviteId, setLastSentInviteId] = useState<number | null>(null);
```

- [ ] **Step 3: Reset `lastSentInviteId` on dialog open**

At line 620, the "Send All Unsent" button's onClick already resets index and counts. Add `setLastSentInviteId(null)` to that handler:

```typescript
onClick={() => {
  sendAllListRef.current = [...unsentWithPhone];
  setSendAllIndex(0);
  setSendAllSentCount(0);
  setSendAllSkipCount(0);
  setLastSentInviteId(null);
  setSendAllOpen(true);
}}
```

- [ ] **Step 4: Replace `handleSendAllMarkSent` with `handleSendAndNext`**

Replace lines 545-558 with:

```typescript
const handleSendAndNext = () => {
  if (!currentSendInvite) return;

  // Open wa.me deep link
  const msg = renderTemplate(templateText, currentSendInvite);
  const result = window.open(buildWaLink(currentSendInvite.phone!, msg), "_blank");
  if (!result) {
    toast({ title: "Popup blocked", description: "Please allow popups for this site", variant: "destructive" });
  }

  // Track for undo
  setLastSentInviteId(currentSendInvite.id);

  // Mark sent and advance
  markWaSentMutation.mutate(currentSendInvite.id, {
    onSuccess: () => {
      setSendAllSentCount((c) => c + 1);
      setSendAllIndex((i) => i + 1);
    },
  });
};
```

Note: the completion check is removed — when `sendAllIndex` advances past the list length, `currentSendInvite` becomes `undefined` and the in-dialog completion summary renders automatically (the existing `{!currentSendInvite && sendAllOpen && (...)}` block at line 1047).

- [ ] **Step 5: Update `handleSendAllSkip` to keep dialog open**

Replace lines 560-568 with:

```typescript
const handleSendAllSkip = () => {
  setSendAllSkipCount((c) => c + 1);
  setSendAllIndex((i) => i + 1);
};
```

Same as above — no explicit close/toast on last invite. The in-dialog summary handles it.

- [ ] **Step 6: Add `handleUndo` handler**

After `handleSendAllSkip`, add:

```typescript
const handleUndo = () => {
  if (lastSentInviteId === null) return;
  unmarkWaSentMutation.mutate(lastSentInviteId, {
    onSuccess: () => {
      setSendAllSentCount((c) => Math.max(0, c - 1));
      setLastSentInviteId(null);
    },
  });
};
```

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add Send & Next handler, undo, and state changes"
```

---

### Task 6: Implement keyboard shortcuts

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx` (after the handlers, before the `if (isLoading)` return)

- [ ] **Step 1: Add refs for handler functions and a useEffect for keyboard shortcuts**

The keyboard `useEffect` needs stable references to `handleSendAndNext` and `handleSendAllSkip`. Using `useCallback` is problematic because `markWaSentMutation` changes reference on every render. Instead, use refs to hold the latest handler versions:

Add this after the `handleUndo` handler and before the `if (isLoading)` block:

```typescript
// Refs for stable keyboard shortcut access to handlers
const handleSendAndNextRef = useRef(handleSendAndNext);
handleSendAndNextRef.current = handleSendAndNext;
const handleSendAllSkipRef = useRef(handleSendAllSkip);
handleSendAllSkipRef.current = handleSendAllSkip;

// Keyboard shortcuts for Send All dialog
useEffect(() => {
  if (!sendAllOpen) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't fire shortcuts when typing in editable elements
    const tag = (e.target as HTMLElement).tagName;
    const isEditable = (e.target as HTMLElement).isContentEditable;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;

    if (e.key === "Enter") {
      e.preventDefault();
      handleSendAndNextRef.current();
    } else if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      handleSendAllSkipRef.current();
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [sendAllOpen]);
```

**Why refs instead of `useCallback`:** The `markWaSentMutation` object returned by `useMutation` changes reference on every render. Including it in a `useCallback` dep array would regenerate the callback every render, which would cause the `useEffect` to re-register the listener every render. Refs avoid this — the `useEffect` registers once when `sendAllOpen` becomes true, and reads the latest handler via `.current`.

**Note:** The `isPending` guard is already inside `handleSendAndNext` (it early-returns if `!currentSendInvite`, and the button's `disabled` state prevents click-based double-triggers). For the keyboard path, add the `isPending` guard directly inside the handlers or in the `handleKeyDown` function. Since `markWaSentMutation.isPending` also changes reference, read it from a ref too:

```typescript
const isPendingRef = useRef(false);
isPendingRef.current = markWaSentMutation.isPending || unmarkWaSentMutation.isPending;
```

Then in `handleKeyDown`, add before the key checks:

```typescript
if (isPendingRef.current) return;
```

- [ ] **Step 2: Run tests**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`
Expected: Keyboard shortcut tests should now pass (or be closer to passing)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add keyboard shortcuts for Send All dialog"
```

---

### Task 7: Update dialog JSX

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx:1012-1044` (dialog actions area)

- [ ] **Step 1: Replace the actions section**

Replace lines 1012-1043 (the `{/* Actions */}` section with the two button rows) with:

```tsx
{/* Actions */}
<div className="flex gap-2">
  <Button
    onClick={handleSendAndNext}
    disabled={markWaSentMutation.isPending}
    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
    autoFocus
  >
    {markWaSentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
    Send & Next
  </Button>
</div>
<div className="flex gap-2">
  {lastSentInviteId !== null && (
    <Button
      onClick={handleUndo}
      disabled={unmarkWaSentMutation.isPending}
      variant="ghost"
      className="gap-2"
    >
      <Undo2 className="h-4 w-4" />
      Undo
    </Button>
  )}
  <Button onClick={handleSendAllSkip} variant="ghost" className="gap-2">
    <SkipForward className="h-4 w-4" />
    Skip
  </Button>
  <Button onClick={() => setSendAllOpen(false)} variant="ghost" className="gap-2">
    <Pause className="h-4 w-4" />
    Pause
  </Button>
</div>
<p className="text-xs text-muted-foreground text-center">
  Enter to send &middot; S to skip &middot; Esc to pause
</p>
```

- [ ] **Step 2: Run all tests**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/admin/__tests__/InvitesPage.sendall.test.tsx`
Expected: All tests pass

- [ ] **Step 3: Run TypeScript type check**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: update Send All dialog JSX with merged button, undo, and keyboard hints"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npm test`
Expected: All tests pass (both new and existing)

- [ ] **Step 2: Run TypeScript check**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check`
Expected: No type errors

- [ ] **Step 3: Manual smoke test**

Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run dev` (in one terminal)
Run: `cd /Volumes/Oink_Machine/Intelij/MyWedding/go-server && make run-dev` (in another)

Verify in browser at `http://localhost:5173`:
1. Navigate to Admin → Invites
2. Ensure at least 2 invites have phone numbers
3. Click "Send All Unsent" — dialog opens
4. Verify "Send & Next" button is green and focused
5. Press Enter — wa.me link opens in new tab, dialog advances to next invite
6. Verify "Undo" button appears
7. Press S — skips to next invite without opening link
8. Press Escape — dialog closes (pause)
9. Reopen, send one, click "Undo" — undo button disappears, sent count decrements
10. Verify keyboard hints text is visible at bottom of dialog

- [ ] **Step 4: Commit any fixes from smoke test**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```

(Skip this step if no fixes are needed.)
