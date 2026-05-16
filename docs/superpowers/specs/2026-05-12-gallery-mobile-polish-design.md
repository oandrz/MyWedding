# Gallery Mobile Polish — Image Quality, Mobile Grid, Upload Fix, Swipe

**Date:** 2026-05-12
**Status:** Approved

## Problem

Three issues found after the Gallery Memories redesign went live:

1. **Blurry grid thumbnails** — `=s600` thumbnail resolution is too low for retina/3× phone screens (a 2-column mobile grid renders each photo at ~190px CSS width × 3 DPR = ~570 physical pixels needed; `=s600` is borderline and looks noticeably soft).
2. **Mobile layout feels like a feed** — 1-column layout on mobile shows very large individual photos but few at a time; guests want a gallery feel.
3. **Upload broken on iOS** — `fileInputRef.current?.click()` called programmatically inside a button onClick is blocked by iOS Safari. Guests tap "Choose Photos" and nothing happens.

Bonus improvement: guest name labels use `group-hover:opacity-100` — invisible on touch devices.

## Decisions

| Question | Decision |
|---|---|
| Grid thumbnail resolution | `=s800` — covers all phone DPR with headroom, conservative file size |
| Lightbox resolution | `=s1600` — no change, user reported no lightbox blur |
| Mobile grid columns | `columns-2` on mobile (was `columns-1`) |
| Guest name on mobile | Always visible; desktop keeps hover-only |
| Upload fix approach | `<label htmlFor>` wrapping file input — native browser behavior, no programmatic click |
| Swipe navigation | Touch events on lightbox backdrop, 50px threshold, no new libraries |

## Files Changed

| File | Change |
|---|---|
| `client/src/pages/Gallery.tsx` | `thumbnailUrl` returns `=s800`; mobile columns; guest name always-visible on mobile; touch swipe handlers |
| `client/src/components/UploadSheet.tsx` | Replace programmatic `click()` with `<label htmlFor>` |
| `client/src/pages/__tests__/Gallery.test.tsx` | Update thumbnail URL assertions (`=s600` → `=s800`); add swipe tests |
| `client/src/components/__tests__/UploadSheet.test.tsx` | Update file input interaction to use label click |

## Detailed Changes

### `thumbnailUrl()` — `Gallery.tsx`

```ts
export function thumbnailUrl(link: string): string {
  return link.replace(/=s\d+$/, "=s800");
}
```

Lightbox src uses the same helper but overrides to `=s1600`:

```tsx
src={thumbnailUrl(files[lightboxIndex].thumbnailLink).replace("=s800", "=s1600")}
```

### Mobile grid columns — `Gallery.tsx`

```tsx
// Before
<div className="columns-1 sm:columns-2 lg:columns-3 gap-2">

// After
<div className="columns-2 lg:columns-3 gap-2">
```

### Guest name label — `Gallery.tsx`

```tsx
// Before — hover only, invisible on mobile
<div className="... opacity-0 group-hover:opacity-100 transition-opacity">

// After — always visible on mobile, hover on desktop
<div className="... opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
```

### Upload fix — `UploadSheet.tsx`

Replace the drag-drop `<div>` + hidden `<input>` + `<Button onClick={() => ref.click()}>` pattern:

```tsx
// Before
<input ref={fileInputRef} type="file" multiple accept="image/*,video/*"
  className="hidden" onChange={...} />
<Button variant="outline" onClick={() => fileInputRef.current?.click()}>
  Choose Photos
</Button>

// After — label triggers input natively, no programmatic click needed
<label htmlFor="file-upload" className="cursor-pointer">
  <input id="file-upload" ref={fileInputRef} type="file" multiple
    accept="image/*,video/*" className="hidden" onChange={...} />
  <Button variant="outline" type="button" asChild>
    <span>Choose Photos</span>
  </Button>
</label>
```

The drag-and-drop zone outer `<div>` also gets `onClick={() => fileInputRef.current?.click()}` removed — tapping anywhere in the zone triggers the label naturally.

### Lightbox swipe — `Gallery.tsx`

```tsx
const touchStartX = useRef<number>(0);

// On the lightbox backdrop div:
onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
onTouchEnd={(e) => {
  const delta = e.changedTouches[0].clientX - touchStartX.current;
  if (delta > 50) prevPhoto();
  else if (delta < -50) nextPhoto();
}}
```

Threshold is 50px. Tapping (delta < 50px) still closes the lightbox via `onClick`. Keyboard arrows continue working alongside swipe.

## States Unchanged

- Loading skeleton
- Empty state
- Error state
- Broken thumbnail fallback
- FAB position and appearance

## Testing

1. Open `/gallery` on a phone or DevTools mobile emulation — verify 2-column layout
2. Verify photos are sharp (not blurry) on a retina screen
3. Open upload sheet on iOS Safari — tap "Choose Photos" — verify file picker opens
4. Open a photo in lightbox — swipe left/right — verify navigation works
5. Verify guest names are visible on mobile without tapping/hovering
6. Run `npm test` — all existing tests should pass with `=s800` assertion update
