# Gallery FAB Overlap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Gallery upload FAB upward so it no longer overlaps the globally-rendered music player button.

**Architecture:** Single CSS class change on the FAB anchor in `Gallery.tsx`. The AudioPlayer sits at `bottom-8` (~88px top edge from viewport bottom); changing the FAB from `bottom-6` (24px) to `bottom-28` (112px) gives 24px of clearance between the two buttons while keeping both right-aligned.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + Testing Library

---

### Task 1: Add failing test for FAB position

**Files:**
- Modify: `client/src/pages/__tests__/Gallery.test.tsx`

- [ ] **Step 1: Add the failing test**

Open `client/src/pages/__tests__/Gallery.test.tsx` and add this test inside the `describe("Gallery", ...)` block, after the existing `"FAB links to Google Drive folder"` test (around line 101):

```tsx
it("FAB is positioned above the music player (bottom-28)", () => {
  renderGallery();
  const fab = screen.getByTestId("fab-upload");
  expect(fab.className).toContain("bottom-28");
  expect(fab.className).not.toContain("bottom-6");
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check 2>&1 | tail -5; npx vitest run client/src/pages/__tests__/Gallery.test.tsx 2>&1 | tail -20
```

Expected: the new test fails with something like `expected string ... to contain 'bottom-28'`.

---

### Task 2: Apply the fix

**Files:**
- Modify: `client/src/pages/Gallery.tsx:163`

- [ ] **Step 3: Change `bottom-6` to `bottom-28` on the FAB**

In `client/src/pages/Gallery.tsx`, find the FAB anchor element (line ~163). Change its `className`:

Before:
```tsx
className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-3xl shadow-lg flex items-center justify-center transition-colors"
```

After:
```tsx
className="fixed bottom-28 right-6 z-20 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-3xl shadow-lg flex items-center justify-center transition-colors"
```

- [ ] **Step 4: Run all Gallery tests to confirm they pass**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npx vitest run client/src/pages/__tests__/Gallery.test.tsx 2>&1 | tail -20
```

Expected: all tests pass, including the new `"FAB is positioned above the music player"` test.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd /Volumes/Oink_Machine/Intelij/MyWedding && npm run check && npx vitest run 2>&1 | tail -20
```

Expected: TypeScript check passes, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Gallery.tsx client/src/pages/__tests__/Gallery.test.tsx
git commit -m "fix: raise gallery FAB to bottom-28 so it clears the music player button"
```
