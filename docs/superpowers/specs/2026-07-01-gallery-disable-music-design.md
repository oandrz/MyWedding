# Gallery: Disable Autoplay & Hide Music Button

**Date:** 2026-07-01
**Status:** Approved for planning

## Problem

On the `/gallery` page, background music should not play automatically, and the
floating "Play Music / Stop Music" button should not be shown. Visitors should
experience a silent gallery.

## Current Behavior

The music player is **global**, not gallery-specific:

- `client/src/components/AudioPlayer.tsx` renders a single `<audio>` element plus
  a fixed bottom-right floating pill ("Play Music" / "Stop Music"). It is mounted
  once at the app root (`client/src/App.tsx:57`), outside the router, so it
  persists across all routes.
- It already self-hides on admin pages via a `return null` guard
  (`AudioPlayer.tsx:18,67`): `const isAdminPage = location.includes('/admin')`.
- Autoplay is deferred to a user gesture: dismissing the welcome overlay calls
  `audioPlayerRef.current?.startAutoplay()` (`App.tsx:47-51`), gated by the
  `useMusicEnabled` and `useMusicAutoplayEnabled` feature flags.
- The Gallery page component itself (`client/src/pages/Gallery.tsx`) contains no
  audio code.

## Scope

- **`/gallery` only.** All other routes (home, etc.) keep music and the button
  exactly as they are today.
- `/memories` also renders the `Gallery` component but is explicitly **out of
  scope** — only the literal `/gallery` path changes.

## Design

Extend the existing early-return guard in `AudioPlayer.tsx` to also short-circuit
on the gallery route, mirroring the established `isAdminPage` pattern.

```ts
const isGalleryPage = location === "/gallery";
...
if (isAdminPage || isGalleryPage || !isMusicEnabled) {
  return null;
}
```

Returning `null` unmounts the `<audio>` element, which satisfies all three
requirements with a single guard:

- **Hides the button** — the entire player, including the bottom-right pill, is
  unmounted.
- **Pauses playing music** — unmounting `<audio>` stops playback immediately, so
  music started on the home page goes silent upon navigating to `/gallery`.
- **No autoplay** — `startAutoplay()` calls `audioEl.current.play()`, but with the
  audio unmounted `audioEl.current` is `null`, so the call safely no-ops.

## Behavior When Leaving the Gallery

The player remounts fresh in the paused state: the button reappears (showing
"Play Music") on other routes, but music does **not** auto-resume. The visitor
restarts it with the button. This is the intended, simplest behavior; remembering
and resuming prior playback is explicitly not implemented.

## Alternatives Considered

- **Keep `<audio>` mounted; only hide the button and add a pause effect.** Would
  allow auto-resume after leaving the gallery, but adds component state and an
  effect for a behavior that was not requested. Rejected in favor of the minimal
  unmount approach.

## Testing

`AudioPlayer` has no existing component tests; this is a presentational routing
guard. Verify manually:

1. Enable music. On `/` (home), start music via the button.
2. Navigate to `/gallery` → music stops, no floating button visible.
3. Navigate back to `/` → button reappears in the paused ("Play Music") state;
   music does not auto-resume.
4. Direct-load `/gallery` and dismiss the welcome overlay (if shown) → no music
   starts, no button.

## Files Changed

- `client/src/components/AudioPlayer.tsx` — add `isGalleryPage` and include it in
  the existing early-return guard.
