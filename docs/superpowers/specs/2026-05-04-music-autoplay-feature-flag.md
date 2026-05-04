# Music Autoplay Feature Flag

## Overview

Add a `music_autoplay` feature flag that controls whether background music starts automatically when a guest opens the wedding invitation. When enabled, music plays immediately on the "Open Invitation" button click (the WelcomeOverlay dismiss gesture). When disabled, the existing click-to-play behavior is preserved.

## Problem

Currently guests must manually click the play button to start background music. Wedding e-invitation sites typically autoplay music to create an immersive experience from the moment the invitation opens. The challenge is that modern browsers block programmatic autoplay unless triggered inside a user gesture callback.

## Solution

Trigger music playback from within the `WelcomeOverlay` "Open Invitation" button handler. This click is a browser-recognized user gesture, making `audio.play()` reliable on all browsers including iOS Safari. A new `music_autoplay` feature flag controls whether this trigger fires.

## Feature Flag Design

| Flag key | Default | Purpose |
|---|---|---|
| `music_autoplay` | `TRUE` | Autoplay music on overlay dismiss |

**Flag interaction rules:**
- `music` OFF → `AudioPlayer` does not render; `music_autoplay` has no effect
- `music` ON + `music_autoplay` ON → music starts on "Open Invitation" click
- `music` ON + `music_autoplay` OFF → existing click-to-play behavior unchanged

## Architecture

### Component Wiring (App.tsx)

Lift a single boolean state `overlayDismissed` into `App.tsx` to bridge `WelcomeOverlay` and `AudioPlayer`:

```
App.tsx
 ├── overlayDismissed: boolean  (useState, starts false)
 ├── <WelcomeOverlay onDismiss={() => setOverlayDismissed(true)} />
 └── <AudioPlayer overlayDismissed={overlayDismissed} />
```

### WelcomeOverlay.tsx

- Accept optional `onDismiss?: () => void` prop
- Call `onDismiss()` at the end of the existing `handleOpen()` function (one line added)
- No other changes

### AudioPlayer.tsx

- Accept `overlayDismissed: boolean` prop
- Read `useMusicAutoplayEnabled()` hook
- Add a `useEffect` watching `overlayDismissed`:
  - When it flips to `true` and autoplay is enabled → call `audio.play()`
  - Set `isPlaying(true)` on success
- On mount: if `sessionStorage.getItem("welcome_overlay_opened")` is already set and autoplay is enabled → attempt `audio.play()` (graceful fallback — may be blocked by browser on a fresh session with no prior gesture; play button shows normally if blocked)
- Play/pause button remains visible and functional in all cases

### useFeatureFlags.ts

Add convenience hook:

```ts
export function useMusicAutoplayEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('music_autoplay');
}
```

### Backend Migration

New file: `go-server/migrations/002_add_music_autoplay_flag.sql`

```sql
INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
VALUES ('music_autoplay', 'Music Autoplay', 'Autoplay background music when invitation opens', TRUE)
ON CONFLICT (feature_key) DO NOTHING;
```

## Data Flow

```
Guest opens invite URL
  └── WelcomeOverlay shows
        └── Guest clicks "Open Invitation"
              ├── handleOpen() runs (user gesture context)
              ├── onDismiss() called → overlayDismissed = true
              └── AudioPlayer useEffect fires
                    ├── [music_autoplay ON]  → audio.play() → isPlaying = true
                    └── [music_autoplay OFF] → no-op, play button available
```

## Edge Cases

| Scenario | Behavior |
|---|---|
| Overlay already dismissed (same session, page refresh) | Attempt `audio.play()` on mount; browser may block — play button shows normally |
| Welcome screen feature disabled | No overlay → no gesture trigger → play button only (autoplay effectively blocked by browser) |
| `music` flag OFF | `AudioPlayer` does not render; `music_autoplay` irrelevant |
| `audio.play()` rejects (any reason) | Catch error silently, leave `isPlaying = false`, play button visible |

## Files Changed

| File | Change |
|---|---|
| `go-server/migrations/002_add_music_autoplay_flag.sql` | New migration inserting `music_autoplay` flag |
| `client/src/hooks/useFeatureFlags.ts` | Add `useMusicAutoplayEnabled()` convenience hook |
| `client/src/App.tsx` | Add `overlayDismissed` state, wire props to both components |
| `client/src/components/WelcomeOverlay.tsx` | Accept `onDismiss` prop, call it in `handleOpen()` |
| `client/src/components/AudioPlayer.tsx` | Accept `overlayDismissed` prop, add autoplay logic |

## Testing Plan

1. `music` OFF → `AudioPlayer` not rendered; no play button visible
2. `music` ON + `music_autoplay` ON → click "Open Invitation" → music plays, button shows Volume2 icon
3. `music` ON + `music_autoplay` OFF → overlay dismiss has no effect on audio; click play button works
4. Refresh after overlay dismissed → autoplay attempt on mount (expected to be blocked in many browsers — play button shows)
5. Toggle `music_autoplay` flag in admin → change reflected within polling interval (~10s)
6. Test on iOS Safari to verify gesture-gated autoplay works
7. `npm run check` — no TypeScript errors
