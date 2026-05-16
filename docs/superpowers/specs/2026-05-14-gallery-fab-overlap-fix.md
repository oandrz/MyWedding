# Gallery FAB Overlap Fix

**Date:** 2026-05-14
**Status:** Approved

## Problem

On the `/gallery` page the floating upload button (FAB) and the global music player button both sit in the bottom-right corner and overlap, making the FAB difficult to tap.

- **AudioPlayer** (`client/src/components/AudioPlayer.tsx:81`): `fixed bottom-8 right-8 z-50` — bottom edge 32px from viewport bottom, height ~56px, top edge ~88px from bottom. z-index 50.
- **Gallery FAB** (`client/src/pages/Gallery.tsx:163`): `fixed bottom-6 right-6 z-20` — bottom edge 24px from viewport bottom. z-index 20.

The FAB's bottom edge (24px) is below the music button's top edge (88px), so they physically overlap. The music button's higher z-index (50 vs 20) means it sits on top and blocks taps on the FAB.

## Solution

Raise the Gallery FAB's vertical position from `bottom-6` to `bottom-28`.

```
bottom of viewport
├── 32px  ← AudioPlayer bottom edge (bottom-8)
├── 88px  ← AudioPlayer top edge  (32px + 56px height)
├── 112px ← FAB bottom edge       (bottom-28)  ← new
├── 168px ← FAB top edge          (112px + 56px height)
```

This gives 24px of clearance between the two buttons. The `right-6` offset is unchanged so both buttons remain visually aligned on the right side, making the stacking look intentional.

## Scope

- **One file changed:** `client/src/pages/Gallery.tsx`
- **One attribute changed:** `bottom-6` → `bottom-28` on the FAB anchor element
- No changes to `AudioPlayer.tsx`, `App.tsx`, tests, or any other file.

## Out of Scope

- Repositioning the music player
- Shared FAB container or portal patterns
- Changes to z-index values
