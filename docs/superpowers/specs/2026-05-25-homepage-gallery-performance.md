# Homepage Gallery Performance — Spec

**Date**: 2026-05-25  
**Scope**: `client/src/components/GallerySection.tsx` and its test file only. No backend changes.

---

## Problem

The homepage gallery carousel loads small thumbnails (`/storage/admin/gallery/thumbnails/…`). When a user clicks an image to open the fullscreen viewer, the viewer loads the full-size image (`/storage/admin/gallery/…`) — a completely different URL the browser has never fetched. Every click is a cold network request: browser → Go server → Supabase → response. The result is a blank or jarring transition while the user waits.

The same problem occurs when navigating next/previous in the fullscreen viewer: each new index loads a full-size URL that hasn't been preloaded.

---

## Root Cause

`photo.thumbnail` (carousel) and `photo.src` (fullscreen viewer) are different URLs. The browser cache for the thumbnail gives no benefit when opening the full-size view.

---

## Solution

Two complementary layers:

### Layer A — Preload full-size images in the background

Move the network request for full-size images to *before* the user clicks, using `new Image()` to prime the browser HTTP cache silently.

**Trigger 1 — thumbnail load**: `OptimizedImage` receives an `onLoad` callback prop. When its `<img>` fires `onLoad`, the parent calls `preloadImage(photo.src)` for that index. As the user scrolls the carousel, full-size images for visible items are fetched in the background.

**Trigger 2 — fullscreen open/navigate**: When `selectedImageIndex` is set or changes, immediately preload indices `[index-2, index-1, index+1, index+2]` (with wraparound). This covers images the user navigates to without ever scrolling past in the carousel.

**Implementation detail**: A `preloadedUrls` ref (`useRef<Set<string>>`) prevents duplicate requests. `new Image()` objects are created and immediately dereferenced — the browser initiates the fetch regardless, and `Cache-Control: public, max-age=3600` ensures the response is cached.

### Layer B — Blur-up placeholder in the fullscreen viewer

Show the already-cached thumbnail as a blurred background the instant the fullscreen opens — zero wait. The full-size image loads on top and fades in.

**Loading state**: `isFullSizeLoaded: boolean`, reset to `false` on every `selectedImageIndex` change, set to `true` on full-size `onLoad`.

**DOM structure** (inside the existing fullscreen `Dialog`):

```
<div> (relative container)
  <!-- bottom layer: blurred thumbnail, always visible -->
  <img src={photo.thumbnail} style="filter: blur(20px); transform: scale(1.1); opacity: 1" />

  <!-- top layer: full-size, fades in when loaded -->
  <img src={photo.src} key={selectedImageIndex} style="opacity: isFullSizeLoaded ? 1 : 0; transition: opacity 300ms" />
</div>
```

The `key={selectedImageIndex}` on the full-size `<img>` ensures React unmounts/remounts it on navigation, preventing stale `onLoad` callbacks from a previous index.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| `photo.thumbnail === photo.src` (no DB thumbnail) | Skip blur layer; render single `<img>` with spinner overlay while loading |
| Full-size `onError` | Set `isFullSizeLoaded = true` to remove spinner; blurred thumbnail remains as graceful degraded state |
| Rapid next/prev clicks | `key` change unmounts old full-size `<img>`, stale `onLoad` is dropped; `isFullSizeLoaded` resets immediately |
| Preload called twice for same URL | `preloadedUrls` Set is a no-op guard |

---

## Files Changed

| File | Change |
|------|--------|
| `client/src/components/GallerySection.tsx` | Add `onLoad` prop to `OptimizedImage`; add `preloadImage` helper + `preloadedUrls` ref; add `isFullSizeLoaded` state; replace single `<img>` in fullscreen viewer with blur-up two-layer structure |
| `client/src/components/__tests__/GallerySection.test.tsx` | Add 5 new test cases (see Testing section) |

No other files are modified. No backend changes.

---

## Testing

New test cases added to the existing test file:

1. **Preload on thumbnail load** — mock `window.Image`, simulate `onLoad` on a carousel thumbnail, assert `new Image()` was constructed with the correct full-size URL.
2. **Preload neighbors on open** — open fullscreen at index 2, assert `new Image()` was called for indices 0, 1, 3, 4.
3. **Blur layer renders immediately** — open fullscreen while `isFullSizeLoaded` is false, assert blurred thumbnail `<img>` is in the DOM.
4. **Full-size fade-in** — simulate `onLoad` on the full-size `<img>`, assert blur layer is hidden and full-size has `opacity: 1`.
5. **No blur when thumbnail equals src** — when `thumbnailUrl` is null in the API response, assert only one `<img>` is rendered in the fullscreen viewer.
