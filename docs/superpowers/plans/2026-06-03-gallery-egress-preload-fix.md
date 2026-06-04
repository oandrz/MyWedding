# Gallery Cached-Egress Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the gallery from auto-downloading every full-resolution original on each visit, and make served images browser-cacheable for a year, cutting Supabase cached egress by ~85–95%.

**Architecture:** Two small, independent changes. (1) Frontend: remove the carousel `onLoad` handler that preloads each slide's full-resolution original — the Autoplay carousel currently marches through all slides and downloads every original whether or not anyone opens a photo. Full images then load only when a visitor opens the lightbox (the existing ±2 neighbor preload while the lightbox is open is unchanged). (2) Backend: raise the `Cache-Control` on served storage objects from 7 days to 1 year `immutable`, which is safe because object filenames are unique/timestamped.

**Tech Stack:** React + TypeScript + Vitest (frontend); Go + standard `net/http` + `go test` (backend).

**Spec:** `docs/superpowers/specs/2026-06-03-gallery-egress-preload-fix-design.md`

---

### Task 1: Remove eager full-image preload from the gallery carousel

**Files:**
- Modify: `client/src/components/GallerySection.tsx` (the `<OptimizedImage>` usage inside the carousel, currently at ~line 307–312)
- Test: `client/src/components/__tests__/GallerySection.test.tsx` (the test at ~line 161, "preloads full-size image when carousel thumbnail loads")

Context: In `GallerySection.tsx` the carousel renders each slide as:

```jsx
<OptimizedImage
  thumbnail={photo.thumbnail}
  alt={photo.alt}
  index={index}
  onLoad={() => preloadImage(photo.src)}
/>
```

`OptimizedImage` forwards its `onLoad` prop to the thumbnail `<img>`. When a thumbnail
loads, this preloads `photo.src` — the full-resolution original. Combined with the
Autoplay carousel auto-advancing through every slide, this downloads all originals on
every visit. We remove the `onLoad` line so the carousel loads thumbnails only. The
`preloadImage` function and the lightbox neighbor-preload `useEffect` (±2) stay.

- [ ] **Step 1: Replace the failing test with one asserting the new behavior**

In `client/src/components/__tests__/GallerySection.test.tsx`, replace the entire test
that currently starts with `it("preloads full-size image when carousel thumbnail loads", ...)`
(lines ~161–179) with:

```tsx
  it("does NOT preload full-size images when a carousel thumbnail loads", () => {
    const preloadedSrcs: string[] = [];
    class MockImage {
      set src(val: string) { preloadedSrcs.push(val); }
      get src() { return ""; }
    }
    vi.stubGlobal("Image", MockImage);

    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    // Find the first carousel thumbnail and fire its load event.
    const thumbnailImg = document.querySelector<HTMLImageElement>(
      'img[src="/storage/gallery/thumbnails/thumb1.jpg"]'
    );
    expect(thumbnailImg).not.toBeNull();
    fireEvent.load(thumbnailImg!);

    // No full-resolution original should have been preloaded by rendering /
    // loading carousel thumbnails. Full images load only when the lightbox opens.
    expect(preloadedSrcs).not.toContain("/storage/gallery/img1.jpg");
    expect(preloadedSrcs).toHaveLength(0);
  });
```

Leave the other tests in the `GallerySection — Preloading` block (the "±2 neighbor"
and "wraps at index 0" tests) unchanged — they cover the lightbox preload we are keeping.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run client/src/components/__tests__/GallerySection.test.tsx -t "does NOT preload"`
Expected: FAIL — `preloadedSrcs` contains `/storage/gallery/img1.jpg` (length 1, not 0),
because the current code still preloads on thumbnail load.

- [ ] **Step 3: Remove the eager preload in the component**

In `client/src/components/GallerySection.tsx`, change the `<OptimizedImage>` usage inside
the carousel from:

```jsx
                          <OptimizedImage
                            thumbnail={photo.thumbnail}
                            alt={photo.alt}
                            index={index}
                            onLoad={() => preloadImage(photo.src)}
                          />
```

to (delete the `onLoad` line):

```jsx
                          <OptimizedImage
                            thumbnail={photo.thumbnail}
                            alt={photo.alt}
                            index={index}
                          />
```

Do not remove `preloadImage` or the lightbox neighbor-preload `useEffect` — they are still
used when the fullscreen viewer is open.

- [ ] **Step 4: Run the gallery tests to verify they pass**

Run: `npx vitest run client/src/components/__tests__/GallerySection.test.tsx`
Expected: PASS — all tests, including the rewritten "does NOT preload" test and the
unchanged ±2 neighbor tests.

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: PASS — no TypeScript errors. (`OptimizedImage`'s `onLoad` prop is optional, so
omitting it is valid.)

- [ ] **Step 6: Commit**

```bash
git add client/src/components/GallerySection.tsx client/src/components/__tests__/GallerySection.test.tsx
git commit -m "fix(gallery): stop preloading full-resolution images on carousel render

The Autoplay carousel preloaded every full-size original via onLoad,
downloading all gallery images on each visit and driving Supabase cached
egress. Carousel now loads thumbnails only; full images load when a photo
is opened (neighbor preload while the lightbox is open is unchanged).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Set 1-year immutable Cache-Control on served storage objects

**Files:**
- Modify: `go-server/internal/service/storage_supabase.go:163`
- Modify: `go-server/internal/service/storage.go:71`
- Test: `go-server/internal/service/storage_supabase_test.go:124` (in `TestSupabaseDownload`)
- Test: `go-server/internal/service/storage_test.go:78` (LocalStorage download test)

Context: Both `SupabaseStorage.Download` and `LocalStorage.Download` set
`Cache-Control: public, max-age=604800` (7 days). Object filenames are unique and
timestamped (e.g. `gallery_<ts>-<ts>.jpg`), so a URL's bytes never change — we can safely
cache for a year and mark `immutable`, so returning visitors reuse the browser cache
instead of re-downloading. Two existing tests pin the old string; update both first.

- [ ] **Step 1: Update both test assertions to the new header value**

In `go-server/internal/service/storage_supabase_test.go`, change the assertion at ~line 124:

```go
	if rec.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
		t.Errorf("unexpected cache-control: %s", rec.Header().Get("Cache-Control"))
	}
```

In `go-server/internal/service/storage_test.go`, change the assertion at ~line 78:

```go
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=31536000, immutable" {
```

(Leave the surrounding lines — the `t.Errorf`/`t.Fatalf` body — unchanged.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd go-server && go test ./internal/service -run 'TestSupabaseDownload$|TestLocal' -v`
Expected: FAIL — assertions report the header is still `public, max-age=604800`.
(If `TestLocal` does not match the LocalStorage download test name, run
`cd go-server && go test ./internal/service -v` and confirm the two cache-control
assertions fail.)

- [ ] **Step 3: Update the header in both storage implementations**

In `go-server/internal/service/storage_supabase.go`, line 163, change:

```go
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
```

In `go-server/internal/service/storage.go`, line 71, change:

```go
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
```

- [ ] **Step 4: Run the service tests to verify they pass**

Run: `cd go-server && go test ./internal/service -count=1`
Expected: PASS — all service tests, including both updated cache-control assertions.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/service/storage_supabase.go go-server/internal/service/storage.go go-server/internal/service/storage_supabase_test.go go-server/internal/service/storage_test.go
git commit -m "perf(storage): cache served objects for 1 year (immutable)

Filenames are unique and timestamped, so served object bytes never change.
Raise Cache-Control from 7d to 1y immutable so returning visitors reuse the
browser cache instead of re-fetching from Supabase Storage.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend gallery suite and type-check**

Run: `npx vitest run client/src/components/__tests__/GallerySection.test.tsx && npm run check`
Expected: PASS for both.

- [ ] **Step 2: Run the full Go service test suite with the race detector**

Run: `cd go-server && go test ./internal/service -race -count=1`
Expected: PASS, no race warnings.

- [ ] **Step 3: Manual smoke test (document the result; do not commit anything)**

1. Start the app (`npm run dev` + Go server, or the production-preview command from
   `CLAUDE.md`).
2. Open the wedding page with the gallery and open DevTools → Network, filter `gallery`.
3. Let the carousel Autoplay run for a full loop **without** opening any photo. Confirm
   **no** `/storage/gallery/<full>.jpg` originals are requested — only
   `/storage/gallery/thumbnails/...` thumbnails.
4. Click a photo to open the lightbox. Confirm the opened original (and its ±2 neighbors)
   are now requested.
5. Inspect a `/storage/gallery/...` response and confirm
   `Cache-Control: public, max-age=31536000, immutable`. Reload the page and confirm those
   images are served from browser cache (no new Storage request).

- [ ] **Step 4: Post-deploy follow-up (note only)**

After this ships, watch the Supabase org usage dashboard's **cached egress** trend over the
next few days; it should fall sharply. If it does not drop enough, revisit Approach B
(pre-generated optimized display variants) from the spec.
