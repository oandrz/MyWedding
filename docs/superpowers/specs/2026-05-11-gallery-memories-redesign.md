# Gallery Memories — Full Page Redesign

**Date:** 2026-05-11
**Status:** Approved

## Problem

The `/gallery` page currently shows an embedded Google Drive iframe for viewing photos. The iframe looks clunky, is not mobile-friendly, and doesn't match the wedding invitation's visual style. Guests want a native, beautiful way to browse and share wedding memories.

## Goal

Replace the iframe with a full-page masonry gallery that shows everything in the Google Drive wedding folder, auto-refreshes as guests upload during the event, and lets guests upload via a floating action button — all without leaving the page.

## Decisions

| Question | Decision |
|---|---|
| Layout | Masonry grid (CSS columns — photos at natural proportions, nothing cropped) |
| Photo source | Full Google Drive folder via existing `GET /api/drive-folder-contents` |
| Auto-refresh | React Query `refetchInterval: 30_000` (30s polling) |
| Upload trigger | Floating "+" button (fixed, bottom-right) |
| Upload UX | Bottom sheet slides up in-page, no navigation away |
| Lightbox | Full-screen overlay, prev/next, built inline (no new library) |
| Backend changes | None |

## Page Structure

Three regions, no tab structure:

1. **Minimal sticky header** — "Wedding Memories" title + pulsing "● live" indicator. NavBar sits above it.
2. **Masonry grid** — fills remaining viewport. CSS columns: 3 on desktop (≥1024px), 2 on tablet (640–1023px), 1 on mobile (<640px). Photos fade in on mount.
3. **Floating "+" button** — fixed bottom-right, rose (`bg-rose-500`). Opens the upload bottom sheet.

## Data Flow

```
Browser — GET /api/drive-folder-contents (every 30s)
Go handler → GoogleDriveService.GetFolderContents()
Response: [{ id, name, mimeType, thumbnailLink, createdTime }, ...]

Thumbnail URL: thumbnailLink with trailing =s<n> replaced with =s600
               e.g. "https://lh3.googleusercontent.com/...=s220" → "...=s600"
Lightbox URL:  https://drive.google.com/uc?export=view&id={id}
Guest name:    parsed from filename prefix — "{guestName}_{originalFilename}"
               falls back to "Wedding Guest" if no underscore found
```

## Components

### `Gallery.tsx` (full rewrite)

- Fetches `GET /api/drive-folder-contents` via React Query with `refetchInterval: 30_000`
- Renders masonry grid, lightbox overlay, floating "+" button
- Manages lightbox state: `selectedIndex`, `isLightboxOpen`
- On new photos arriving (poll returns more items than previous): pulses the live indicator for 1s

**Masonry grid:** CSS `columns` with `break-inside: avoid` on each photo tile. Each tile:
- `<img>` with `thumbnailLink` (size `=s600`) — `object-fit: cover`, rounded corners, subtle shadow
- Guest name label shown on hover as a semi-transparent overlay at the bottom
- `onClick` → opens lightbox at that index

**Lightbox overlay:**
- Fixed full-screen backdrop (`bg-black/80`)
- Centred `<img>` using direct Drive view URL `https://drive.google.com/uc?export=view&id={id}`
- Left/right arrow buttons for prev/next (keyboard arrow keys also work)
- Close button top-right (Escape key also closes)
- Click backdrop to close

**Live indicator:** A `<span>` with a rose dot. When `newPhotosArrived` state is true, a CSS pulse animation runs for 1s then resets.

### `UploadSheet.tsx` (new component)

Extracted and adapted from the existing "Share Photos" tab in `Gallery.tsx`.

Props: `open: boolean`, `onClose: () => void`

- Slides up from bottom via CSS `transform: translateY` transition
- Translucent backdrop behind it; clicking backdrop calls `onClose`
- "×" close button top-right
- Guest name `<Input>` (optional)
- Drag-and-drop zone (same logic as today — `onDragEnter`, `onDragLeave`, `onDrop`, file input ref)
- Accepts `image/*,video/*`, max 10 files
- On submit: calls `POST /api/upload-to-drive` (unchanged)
- On success: toast + `onClose()` — the 30s poll picks up new photos automatically
- On error: toast with retry option, sheet stays open

## States

**Loading (first fetch):** 3-column shimmer skeleton — same column layout as the real grid, no layout shift on hydration.

**Empty:** Centred camera icon + "No memories yet — be the first to share!" + "Share a Photo" button that opens the upload sheet.

**Error:** Soft error message "Couldn't load photos right now" + manual "Retry" button. Floating "+" remains available.

**Broken thumbnail (files added directly to Drive without public permissions):** The `<img>` `onError` handler shows a placeholder tile with a "View in Drive →" link (`webViewLink`).

## Files Changed

| File | Change |
|---|---|
| `client/src/pages/Gallery.tsx` | Full rewrite |
| `client/src/components/UploadSheet.tsx` | New component (extracted from old Gallery.tsx upload tab) |

## What Does Not Change

- All `go-server/` code — no backend changes
- `MemoriesGoogleDrive.tsx`, `MemoriesGoogleDriveUpload.tsx` — separate routes, untouched
- `GallerySection.tsx` — homepage carousel, untouched
- `GET /api/drive-folder-contents` endpoint — used as-is
- `POST /api/upload-to-drive` endpoint — used as-is

## Testing

1. Run `npm run dev` + `make run-dev` (Go server must be running for Drive API calls)
2. Visit `/gallery` — verify masonry grid renders with real Drive photos
3. Verify auto-refresh: upload a photo via the "+" button, wait ≤30s, confirm it appears without manual reload
4. Verify lightbox: click a photo, confirm full-res loads, prev/next and keyboard navigation work, Escape closes
5. Verify mobile: open on a phone or DevTools mobile emulation — 1-column layout, bottom sheet slides up, "+" button is tappable
6. Verify empty state: temporarily point to an empty Drive folder or mock an empty response
7. Verify broken-thumbnail fallback: add a file to Drive directly (without public permissions) and confirm the fallback tile appears
