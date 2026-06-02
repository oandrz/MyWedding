# Gallery Cached-Egress Fix — Stop Preloading Unviewed Full Images

**Date:** 2026-06-03
**Status:** Approved (design)
**Scope:** Approach A (frontend preload fix + cache headers). Approaches B (optimized
display variants) and C (external CDN) are explicitly deferred.

## Problem

The Supabase **cached egress** quota on the Free plan (5 GB) was exceeded — 7.23 GB used.

"Cached egress" is, by Supabase's definition, *Storage bytes served from CDN cache
hits* and applies to no other service. So the entire 7.23 GB is image bytes served
from Supabase Storage.

Only ~84 MB of assets are stored (67 full images averaging ~1.2 MB — up to ~5 MB — plus
small ~65 KB thumbnails). 7.23 GB ÷ 84 MB ≈ **~86× re-serving**. This is a volume-×-size
problem, not a missing-cache problem (the private bucket still caches well because every
fetch goes through the Go server with the same service-role identity → consistent cache
key → cache hits).

## Root cause

`client/src/components/GallerySection.tsx` renders the gallery as an **Autoplay** carousel
(`embla-carousel-autoplay`, 2–10 s timer). Each carousel item shows a thumbnail and runs:

```jsx
onLoad={() => preloadImage(photo.src)}   // photo.src = the full-resolution original
```

Because Autoplay auto-advances through every slide with no user interaction, each slide's
thumbnail loads, fires `onLoad`, and **preloads that slide's full-resolution original**.
Result: every visit to the wedding page silently downloads all ~67 full images (~80 MB),
whether or not the visitor ever opens a single photo. ~90 such visits ≈ the observed 7 GB.

Contributing factor: the browser `Cache-Control` was only recently raised to 7 days
(`max-age=604800`), so before that, repeat visits also re-fetched.

## Goal

Download a full-resolution original **only when a visitor explicitly opens a photo** in the
lightbox (plus a small neighbor preload for smooth navigation). Strengthen browser caching
so returning visitors reuse cached bytes. Target: per-visit egress ~80 MB → ~4–8 MB
(~85–95% reduction), bringing usage back under the 5 GB cached quota.

## Scope

### In scope
1. **Frontend — `client/src/components/GallerySection.tsx`**
   - **Remove** `onLoad={() => preloadImage(photo.src)}` from the carousel item. The
     carousel renders **thumbnails only**; nothing preloads full originals on render /
     autoplay / scroll.
   - **Unchanged:** the lightbox loads the full `src` when a user opens a photo (correct,
     on-demand behavior), with the existing thumbnail blur-up placeholder.
   - **Unchanged:** the neighbor-preload `useEffect` that runs *only while the lightbox is
     open* stays at **±2** (preloads up to 4 adjacent full images for instant next/prev).
     Decision confirmed with the user.

2. **Cache headers — Go storage serving**
   - `go-server/internal/service/storage_supabase.go` → `Download()`
   - `go-server/internal/service/storage.go` → `LocalStorage.Download()`
   - Change `Cache-Control: public, max-age=604800` → `public, max-age=31536000, immutable`
     (1 year). Safe because object filenames are unique and timestamped
     (`gallery_<ts>-<ts>.jpg`), so a given URL's content never changes.

### Out of scope (deferred)
- **B:** pre-generated resized/WebP "display" variants served in the lightbox.
- **C:** fronting Supabase Storage with an external CDN (Cloudflare).
- Any change to thumbnail generation, the upload pipeline, or bucket visibility.

## Test plan (TDD)

`client/src/components/__tests__/GallerySection.test.tsx` currently asserts the *buggy*
behavior (full `imageUrl`s preloaded on render). Rewrite the affected cases:

- **On initial render (no lightbox open):** assert that **no** full `imageUrl` is preloaded
  — only thumbnail URLs are referenced by the rendered carousel.
- **On opening the lightbox at index N:** assert the full `imageUrl` for N and its ±2
  neighbors are preloaded (existing neighbor behavior preserved).
- Keep existing assertions that the grid/carousel renders **thumbnail** URLs.

Write/adjust the failing tests first, then make the component change pass them.

## Verification

- `npm run check` (types) and the gallery test suite pass.
- Manual: load the wedding page with the gallery, let Autoplay run, and confirm via browser
  DevTools Network that **no** `/storage/gallery/<full>.jpg` originals are requested until a
  photo is opened; opening a photo requests that original (and ±2 neighbors).
- Confirm responses carry `Cache-Control: public, max-age=31536000, immutable` and that a
  reload serves images from browser cache (no new Storage request).
- Follow up after deploy: watch the Supabase usage dashboard's cached-egress trend drop.

## Risks / notes

- Opening a photo now incurs a brief first-load (no longer pre-fetched on page render). The
  thumbnail blur-up placeholder already covers this; perceived impact is minimal.
- `immutable` + 1-year TTL relies on filenames being unique per upload. This holds today
  (timestamped names, upsert to the same path only on identical re-upload). If a future
  feature overwrites an existing path with new content, switch that path to a versioned
  URL or shorter TTL.
- If cached egress does not fall enough after this ships, revisit Approach B (display
  variants) for the images visitors actually open.
