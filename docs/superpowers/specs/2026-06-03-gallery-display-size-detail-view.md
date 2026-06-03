# Spec: Gallery display-size image for the detail view

**Date:** 2026-06-03
**Status:** Approved (pending spec review)
**Branch:** `task/cache_optimize`

## Problem

Clicking a gallery thumbnail on the home page opens a fullscreen detail viewer.
Opening a single photo currently pulls **up to five full-resolution originals**
(~1MB each) from storage:

1. `…-thumb.jpg` — the 600px thumbnail, reused as a blurred placeholder (cheap, usually cached).
2. `….jpg` — the **full-resolution original** of the clicked photo (~1MB) shown as the detail image.
3–5. Up to four **neighbor originals** (`±2`) eagerly fetched by the preload effect so
left/right navigation feels instant — most are never viewed.

On metered/CDN egress this is expensive: the bytes served scale with the original
file size, and the neighbor preload multiplies it by photos the guest may never open.

## Goal

**Cut egress (bytes served) on the detail-view flow.** Guests only view photos
on-screen — there is no zoom or download requirement — so the browser never needs
the full-resolution original.

### Success metric (bytes, not request count)

> Note: the network tab will **still show ~3 requests** when opening a photo
> (thumbnail + display image + up to 2 neighbor display images). The win is in
> **bytes transferred**, not request count. Do not measure success by request count.

| Metric | Before | Target |
|--------|--------|--------|
| Detail image per opened photo | ~1MB (original) | **≤ ~300KB** (display image) — *verify actual output during implementation* |
| Neighbor preload per open | up to 4 originals (~4MB) | 2 display images (~400–600KB) |
| Bytes per detail-open (open + 1 navigation) | ~5MB | **< ~1MB** |

The ~200–300KB figure is an estimate. During implementation, generate a display
image from a representative ~1MB original and record the real byte size before
treating the target as met.

## Approach

Pre-generate a **display-size** JPEG at upload, mirroring the existing thumbnail
pattern (`upload.go` already makes a 600px thumb at both upload paths). Serve that
display image to the detail viewer; reserve the original purely as a fallback. This
fits the codebase's existing pre-generation pattern and the immutable 1-year CDN
caching already in place (commit `c0a094d`).

### Display size — the one quality/egress knob

- **Width: 1600px, quality 80**, encoded JPEG. `OptimizeImage` already refuses to
  enlarge (`if bounds.Dx() <= width { width = bounds.Dx() }`), so smaller originals
  pass through unchanged.
- **Assumption (stated explicitly): the audience is mobile-first.** Phones at 2–3×
  DPR resolve roughly 1000–1300 device pixels of width, which 1600px covers cleanly.
  On a large desktop/retina display (~2500+ device px) a 1600px image will look
  slightly soft. This is an accepted trade-off given the egress goal; 1600 is a
  single constant and can be raised if desktop sharpness becomes a complaint.

## Changes

### 1. Image processing — `go-server/internal/service/imageopt.go`
- Reuse `OptimizeImage(data, 1600, 80)` to produce the display buffer.
- Add `GenerateDisplayFilename(original) → "…-display.jpg"`, mirroring
  `GenerateThumbnailFilename`.

### 2. Data model & schema
- **Drizzle / shared** — `shared/schema.ts`: add `displayUrl: text("display_url")`
  to `configImages`, and add `displayUrl: true` to `insertConfigImageSchema.pick(...)`.
  This gives the frontend a typed `ConfigImage.displayUrl: string | null`.
- **Go model** — `internal/models/config_image.go`: add
  `DisplayURL *string \`json:"displayUrl"\`` to `ConfigImage` and `InsertConfigImage`
  (mirrors `ThumbnailURL`).
- **Migration** — `migrations/002_add_display_url.sql`:
  `ALTER TABLE config_images ADD COLUMN display_url TEXT;`
- **Repository** — `internal/repository/postgres.go` and `memory.go`: read/write
  `display_url` in Create / Update / Get / List for config images.

### 3. Upload handlers — `go-server/internal/handler/upload.go`
Both paths (direct multipart `~:211`, signed-URL notify `~:357`) already produce a
thumbnail for `imageType == "gallery"`. Add an analogous display-image block:
generate `OptimizeImage(data, 1600, 80)`, upload to a `admin/gallery/display`
prefix, set `insertData.DisplayURL`. **Generation/upload failure is non-fatal** —
log a warning and leave `DisplayURL` null, exactly as the thumbnail does today.

### 4. Backfill — `go-server/cmd/backfill-display/main.go`
One-off Go command (compiled, run once against prod after deploy):
- Load all gallery `config_images` where `display_url IS NULL`.
- For each: download the original, generate the 1600px display image, upload it,
  update the row's `display_url`.
- **Idempotent** — rows that already have `display_url` are skipped, so it is safe
  to re-run. Per-image failures log and continue rather than aborting the batch.

### 5. Frontend — `client/src/components/GallerySection.tsx`
- `galleryImages` mapping: add `display: img.displayUrl || img.imageUrl`.
- Detail `<img src>` (line ~368): use `display` instead of `src`. The original
  (`imageUrl`) is now only the fallback for un-backfilled / failed images.
- Blur placeholder + carousel thumbnails keep using `thumbnail`.
- **Blur-placeholder condition** (line ~356): currently `thumbnail !== src`. Update
  it to compare against `display` (`thumbnail !== display`) so an image whose
  display URL equals its thumbnail doesn't render a redundant blur layer.
- Neighbor preload effect (lines ~190–196): change offsets `[-2,-1,1,2]` → `[-1, 1]`
  and preload the **display** URL, not the original.

### 6. Tests
- `imageopt`: unit test for `GenerateDisplayFilename`.
- Handler test: gallery upload sets `displayUrl`; non-gallery upload leaves it null.
- Contract test (`handler/contract_test.go`): `displayUrl` present with correct type
  in the gallery config-images JSON response.
- Frontend (`GallerySection.test.tsx`): detail image uses the display URL; preload
  fetches the `±1` display URLs (not `±2`, not originals).

## Out of scope
- Zoom / pinch / download of full-resolution originals (no current requirement).
- On-the-fly resizing (Approach B) and frontend-only preload tuning (Approach C) —
  considered and rejected during brainstorming.
- Non-gallery config images (banner, profile, verse) — the detail viewer is
  gallery-only, so they get no display image.

## Risks / notes
- **Backfill must run** before the egress win applies to existing photos; until
  then those photos fall back to serving the original in the detail view (correct,
  just not yet cheaper).
- **Storage growth:** one extra ~200–300KB artifact per gallery image. Negligible.
- **Display softness on desktop** — see the mobile-first assumption above.
