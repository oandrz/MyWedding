# Upload Dialog Responsive Layout Fix

**Date:** 2026-05-26
**Status:** Approved

## Problem

The admin image upload dialog (`ImageUploadModal`) is only usable on very large screens (2K+ ultrawide). On mobile, tablet, and standard laptop sizes the dialog overflows the viewport vertically, pushing the Upload/Add Image button completely off-screen and unreachable.

**Root cause:** `DialogContent` has no `max-height` constraint and no overflow scroll. The Shadcn base class uses `top-[50%] translate-y-[-50%]` (centered) with no height cap, so tall content overflows both above and below the viewport with no scroll mechanism.

**Contributing factor:** The dialog contains title and description form fields that admins rarely use, adding ~170px of unnecessary height.

## Scope

Single file changed for the main fix: `client/src/components/ImageUploadModal.tsx`
One test file added/updated: `client/src/components/__tests__/ImageUploadModal.test.tsx`

No changes to backend, API contracts, routing, or other components.

## Design

### Layout: three-zone flex column

The `DialogContent` receives `p-0 gap-0` to strip its default padding (avoids fighting Shadcn's internal `grid` display declaration). An inner wrapper `<div className="flex flex-col max-h-[90vh]">` owns the layout and handles padding:

```
┌─────────────────────────────────────────┐
│ [icon] Title / Description    shrink-0  │  ← pinned header, never scrolls
├─────────────────────────────────────────┤
│ [Upload File] [Add URL]        shrink-0 │  ← tab bar, never scrolls
│─────────────────────────────────────────│
│                                         │
│  drag zone                  flex-1      │  ← scrollable middle
│  guidelines box             overflow-y  │
│                             auto        │
│                                         │
├─────────────────────────────────────────┤
│ [Upload Image]  [Cancel]      shrink-0  │  ← pinned footer, always visible
└─────────────────────────────────────────┘
```

The X close button is absolutely positioned by Shadcn (`absolute right-4 top-4`) so it is unaffected by the layout restructure.

### Footer button ↔ form linkage

Because the submit button lives outside the `<form>` element, each form gets an `id` and the footer submit button uses the standard HTML5 `form` attribute to link them:

```tsx
<form id="upload-form" onSubmit={fileForm.handleSubmit(onFileSubmit)}>
  {/* drag zone, guidelines — no title/description fields */}
</form>

{/* footer, outside the form */}
<Button type="submit" form="upload-form" disabled={...}>Upload Image</Button>
```

Same pattern for the URL tab (`id="url-form"`). Supported in all modern browsers.

### Remove title and description fields

The `<FormField>` renders for `title` and `description` are removed from both the Upload and URL `TabsContent` blocks.

The `useForm` `defaultValues` remain (`title: editingImage?.title || ""`). Rather than relying on react-hook-form's form state to round-trip these values correctly (it only applies `defaultValues` on first mount), the mutation calls explicitly pass `editingImage?.title ?? ""` and `editingImage?.description ?? ""`. This ensures existing titles and descriptions are silently preserved when an admin re-saves an image without seeing or touching those fields.

### `max-h-[90vh]` sizing

After removing title + description (~170px), the remaining content is approximately:

| Element | Estimated height |
|---|---|
| Header | 80px |
| Tab bar | 44px |
| Drag zone (p-8) | 220px |
| Guidelines box | 200px |
| Footer buttons | 52px |
| Padding + gaps | 60px |
| **Total** | **~656px** |

`90vh` on a 667px screen (iPhone SE) = 600px — the scrollable middle handles the 56px overage. On a 768px laptop = 691px — fits without scrolling. On 1080p = 972px — comfortably fits.

## Testing

One test added to `client/src/components/__tests__/ImageUploadModal.test.tsx`:

- Render the modal in upload mode
- Click the footer "Upload Image" button (which is outside the `<form>` and linked via `form="upload-form"`)
- Assert the file upload mutation fires

This test guards the `form` attribute linkage — the most fragile part of the implementation. A typo there would make the button silently no-op.

No tests needed for CSS layout behavior (not testable in jsdom).

## Files

| File | Change |
|---|---|
| `client/src/components/ImageUploadModal.tsx` | Remove title/description FormFields; restructure DialogContent with inner flex wrapper; move footer buttons outside forms; add form IDs; update mutation payloads |
| `client/src/components/__tests__/ImageUploadModal.test.tsx` | Add test verifying footer submit button triggers upload mutation |
