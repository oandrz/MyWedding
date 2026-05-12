# Gallery Mobile Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix blurry thumbnails, switch to 2-column mobile grid, fix iOS upload file picker, and add lightbox swipe navigation.

**Architecture:** Four targeted edits to `Gallery.tsx` and `UploadSheet.tsx` — no new files, no new libraries. Each task follows TDD: update/add the failing test first, then fix the implementation.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + React Testing Library, TanStack React Query

---

## File Map

| File | What changes |
|---|---|
| `client/src/pages/Gallery.tsx` | `thumbnailUrl` resolution, mobile columns, guest name classes, swipe handlers |
| `client/src/pages/__tests__/Gallery.test.tsx` | Update `=s600` assertion; add grid, guest name, swipe tests |
| `client/src/components/UploadSheet.tsx` | Replace programmatic `click()` with `<label htmlFor>` |
| `client/src/components/__tests__/UploadSheet.test.tsx` | Add label/input linkage test |

---

## Task 1: Fix thumbnail resolution (`=s600` → `=s800`)

**Files:**
- Modify: `client/src/pages/__tests__/Gallery.test.tsx:58-63`
- Modify: `client/src/pages/Gallery.tsx:17-18` (thumbnailUrl) and `:195` (lightbox src)

- [ ] **Step 1: Update the existing thumbnail test to assert `=s800`**

In `client/src/pages/__tests__/Gallery.test.tsx`, change the test at line 58:

```tsx
it("uses s800 thumbnail URL (not s220)", () => {
  renderGallery();
  const imgs = screen.getAllByRole("img") as HTMLImageElement[];
  expect(imgs[0].src).toContain("=s800");
  expect(imgs[0].src).not.toContain("=s220");
  expect(imgs[0].src).not.toContain("=s600");
});
```

- [ ] **Step 2: Run the test — verify it FAILS**

```bash
npx vitest run client/src/pages/__tests__/Gallery.test.tsx --reporter verbose
```

Expected: FAIL on the `=s800` assertion (still returns `=s600`).

- [ ] **Step 3: Update `thumbnailUrl` in `Gallery.tsx`**

```tsx
export function thumbnailUrl(link: string): string {
  return link.replace(/=s\d+$/, "=s800");
}
```

- [ ] **Step 4: Update the lightbox `src` to use `=s1600` (line ~195)**

Find this line:
```tsx
src={thumbnailUrl(files[lightboxIndex].thumbnailLink).replace("=s600", "=s1600")}
```

Change to:
```tsx
src={thumbnailUrl(files[lightboxIndex].thumbnailLink).replace("=s800", "=s1600")}
```

- [ ] **Step 5: Run tests — verify they PASS**

```bash
npx vitest run client/src/pages/__tests__/Gallery.test.tsx --reporter verbose
```

Expected: all 12 tests pass.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Gallery.tsx client/src/pages/__tests__/Gallery.test.tsx
git commit -m "fix: increase thumbnail resolution to s800 for retina displays"
```

---

## Task 2: Switch to 2-column mobile grid + always-visible guest names

**Files:**
- Modify: `client/src/pages/__tests__/Gallery.test.tsx` (add 2 tests)
- Modify: `client/src/pages/Gallery.tsx` (3 className changes — grid div, skeleton div, name overlay div)

- [ ] **Step 1: Add a test for the 2-column grid class**

Add to `client/src/pages/__tests__/Gallery.test.tsx` inside the `describe` block:

```tsx
it("uses 2-column grid layout", () => {
  renderGallery();
  const grid = screen.getByTestId("photo-grid");
  expect(grid.className).toContain("columns-2");
  expect(grid.className).not.toContain("columns-1");
});

it("guest name overlay has opacity-100 (always visible on mobile)", () => {
  renderGallery();
  // The overlay wrapper must include opacity-100 for mobile visibility
  const overlays = document.querySelectorAll("[data-testid='guest-name-overlay']");
  expect(overlays.length).toBeGreaterThan(0);
  overlays.forEach((el) => {
    expect(el.className).toContain("opacity-100");
  });
});
```

- [ ] **Step 2: Run the new tests — verify they FAIL**

```bash
npx vitest run client/src/pages/__tests__/Gallery.test.tsx --reporter verbose
```

Expected: the two new tests fail (`photo-grid` testid not found, `guest-name-overlay` not found).

- [ ] **Step 3: Update the grid container in `Gallery.tsx`**

Find (line ~109):
```tsx
<div className="columns-1 sm:columns-2 lg:columns-3 gap-2">
```

Replace with:
```tsx
<div className="columns-2 lg:columns-3 gap-2" data-testid="photo-grid">
```

- [ ] **Step 4: Update the skeleton grid in `GallerySkeleton` (line ~222)**

Find:
```tsx
<div className="columns-1 sm:columns-2 lg:columns-3 gap-2" data-testid="gallery-skeleton">
```

Replace with:
```tsx
<div className="columns-2 lg:columns-3 gap-2" data-testid="gallery-skeleton">
```

- [ ] **Step 5: Update the guest name overlay div (line ~136)**

Find:
```tsx
<div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
```

Replace with:
```tsx
<div
  data-testid="guest-name-overlay"
  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg px-3 py-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
>
```

- [ ] **Step 6: Run all Gallery tests — verify they PASS**

```bash
npx vitest run client/src/pages/__tests__/Gallery.test.tsx --reporter verbose
```

Expected: all 14 tests pass.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/Gallery.tsx client/src/pages/__tests__/Gallery.test.tsx
git commit -m "fix: 2-column mobile grid, always-visible guest names on mobile"
```

---

## Task 3: Fix iOS upload file picker

**Files:**
- Modify: `client/src/components/__tests__/UploadSheet.test.tsx` (add 1 test)
- Modify: `client/src/components/UploadSheet.tsx` (add `id` to input, replace Button with label)

- [ ] **Step 1: Add a test that verifies the label-based file input linkage**

Add to `client/src/components/__tests__/UploadSheet.test.tsx` inside the `describe` block:

```tsx
it("Choose Photos is a label linked to the file input (no programmatic click)", () => {
  render(<UploadSheet open={true} onClose={vi.fn()} />);
  const label = document.querySelector('label[for="file-upload"]') as HTMLLabelElement;
  expect(label).toBeInTheDocument();
  expect(label.textContent).toContain("Choose Photos");
  const input = document.getElementById("file-upload") as HTMLInputElement;
  expect(input).toBeInTheDocument();
  expect(input.type).toBe("file");
});
```

- [ ] **Step 2: Run the new test — verify it FAILS**

```bash
npx vitest run client/src/components/__tests__/UploadSheet.test.tsx --reporter verbose
```

Expected: FAIL — no `label[for="file-upload"]` found.

- [ ] **Step 3: Add `id="file-upload"` to the file input in `UploadSheet.tsx`**

Find (line ~117):
```tsx
<input
  ref={fileInputRef}
  type="file"
  multiple
  accept="image/*,video/*"
  className="hidden"
  onChange={(e) => e.target.files && handleFiles(e.target.files)}
/>
```

Replace with:
```tsx
<input
  id="file-upload"
  ref={fileInputRef}
  type="file"
  multiple
  accept="image/*,video/*"
  className="hidden"
  onChange={(e) => e.target.files && handleFiles(e.target.files)}
/>
```

- [ ] **Step 4: Replace the `<Button onClick={() => ref.click()}>` with a `<label htmlFor>`**

Find (line ~146):
```tsx
<Button
  variant="outline"
  onClick={() => fileInputRef.current?.click()}
>
  Choose Photos
</Button>
```

Replace with:
```tsx
<Button variant="outline" asChild>
  <label htmlFor="file-upload" className="cursor-pointer">
    Choose Photos
  </label>
</Button>
```

- [ ] **Step 5: Run all UploadSheet tests — verify they PASS**

```bash
npx vitest run client/src/components/__tests__/UploadSheet.test.tsx --reporter verbose
```

Expected: all 9 tests pass (8 existing + 1 new).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/UploadSheet.tsx client/src/components/__tests__/UploadSheet.test.tsx
git commit -m "fix: use label+htmlFor for file input so iOS Safari opens file picker"
```

---

## Task 4: Add lightbox swipe navigation

**Files:**
- Modify: `client/src/pages/__tests__/Gallery.test.tsx` (add 3 tests)
- Modify: `client/src/pages/Gallery.tsx` (add `touchStartX` ref, `didSwipe` ref, touch handlers, update backdrop `onClick`)

- [ ] **Step 1: Add swipe navigation tests**

Add to `client/src/pages/__tests__/Gallery.test.tsx` inside the `describe` block:

```tsx
it("swipes left to navigate to the next photo", () => {
  renderGallery();
  fireEvent.click(screen.getAllByRole("img")[0]); // open at index 0 → "1 / 2"
  expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();

  const lightbox = screen.getByTestId("lightbox");
  fireEvent.touchStart(lightbox, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(lightbox, { changedTouches: [{ clientX: 130, clientY: 0 }] }); // delta -70

  expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
  expect(screen.getByTestId("lightbox")).toBeInTheDocument(); // still open
});

it("swipes right to navigate to the previous photo", () => {
  renderGallery();
  fireEvent.click(screen.getAllByRole("img")[1]); // open at index 1 → "2 / 2"
  expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();

  const lightbox = screen.getByTestId("lightbox");
  fireEvent.touchStart(lightbox, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(lightbox, { changedTouches: [{ clientX: 260, clientY: 0 }] }); // delta +60

  expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  expect(screen.getByTestId("lightbox")).toBeInTheDocument(); // still open
});

it("small tap (< 50px) on lightbox backdrop closes it, does not navigate", () => {
  renderGallery();
  fireEvent.click(screen.getAllByRole("img")[0]);
  expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();

  const lightbox = screen.getByTestId("lightbox");
  fireEvent.touchStart(lightbox, { touches: [{ clientX: 200, clientY: 0 }] });
  fireEvent.touchEnd(lightbox, { changedTouches: [{ clientX: 215, clientY: 0 }] }); // delta +15
  fireEvent.click(lightbox); // click fires after tap

  expect(screen.queryByTestId("lightbox")).toBeNull(); // closed
});
```

- [ ] **Step 2: Run the new tests — verify they FAIL**

```bash
npx vitest run client/src/pages/__tests__/Gallery.test.tsx --reporter verbose
```

Expected: 3 new swipe tests fail.

- [ ] **Step 3: Add `useRef` to the React import and declare the two refs in `Gallery.tsx`**

Update the first line of `Gallery.tsx`:
```tsx
import { useState, useCallback, useEffect, useRef } from "react";
```

Then, inside the `Gallery` component, after the existing `useState`/`useCallback` declarations, add:
```tsx
const touchStartX = useRef<number>(0);
const didSwipe = useRef(false);
```

- [ ] **Step 4: Add touch handlers and update the lightbox backdrop `onClick` in `Gallery.tsx`**

Find the lightbox backdrop div (line ~162):
```tsx
<div
  className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
  onClick={closeLightbox}
  data-testid="lightbox"
>
```

Replace with:
```tsx
<div
  className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
  onClick={() => {
    if (didSwipe.current) { didSwipe.current = false; return; }
    closeLightbox();
  }}
  onTouchStart={(e) => {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  }}
  onTouchEnd={(e) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 50) { didSwipe.current = true; prevPhoto(); }
    else if (delta < -50) { didSwipe.current = true; nextPhoto(); }
  }}
  data-testid="lightbox"
>
```

- [ ] **Step 5: Run all Gallery tests — verify they PASS**

```bash
npx vitest run client/src/pages/__tests__/Gallery.test.tsx --reporter verbose
```

Expected: all 17 tests pass.

- [ ] **Step 6: Run the full frontend test suite**

```bash
npx vitest run --reporter verbose
```

Expected: all tests pass across all test files.

- [ ] **Step 7: TypeScript check**

```bash
npm run check
```

Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/Gallery.tsx client/src/pages/__tests__/Gallery.test.tsx
git commit -m "feat: add lightbox swipe navigation for mobile"
```

---

## Manual Verification

After all 4 tasks are committed:

1. Start the dev server: `npm run dev` (frontend) + `cd go-server && make run-dev` (backend)
2. Open `http://localhost:5173/gallery` in DevTools with mobile emulation (iPhone 14, 390px)
3. Verify 2-column masonry grid
4. Verify photos are sharp (not blurry)
5. Verify guest names are visible without tapping
6. Tap the "+" FAB → upload sheet opens → tap "Choose Photos" → file picker opens (this is the iOS fix)
7. Tap a photo → lightbox opens → swipe left/right → photos change → tap backdrop → lightbox closes
