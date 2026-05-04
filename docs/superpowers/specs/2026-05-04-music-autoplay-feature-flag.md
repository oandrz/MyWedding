# Music Autoplay Feature Flag

## Overview

Add a `music_autoplay` feature flag that controls whether background music starts automatically when a guest opens the wedding invitation. When enabled, music plays immediately on the "Open Invitation" button click (the WelcomeOverlay dismiss gesture). When disabled, the existing click-to-play behavior is preserved.

## Problem

Currently guests must manually click the play button to start background music. Wedding e-invitation sites typically autoplay music to create an immersive experience from the moment the invitation opens. The challenge is that modern browsers — especially iOS Safari — block programmatic autoplay unless `audio.play()` is called synchronously inside a user gesture event handler.

## Solution

Trigger music playback synchronously within the `WelcomeOverlay` "Open Invitation" button handler call stack. The call chain must stay synchronous end-to-end:

```
button click → handleOpen() → onDismiss() (App.tsx) → audioPlayerRef.current.startAutoplay() → audio.play()
```

Routing through React state (`setState`) and then `useEffect` breaks the iOS Safari gesture context because the effect runs asynchronously after re-render. `forwardRef` + `useImperativeHandle` on `AudioPlayer` is used to expose a `startAutoplay()` method that can be called directly.

## Feature Flag Design

| Flag key | Default | Purpose |
|---|---|---|
| `music_autoplay` | `TRUE` | Autoplay music on overlay dismiss |

**Note:** `music` defaults to `FALSE` and `music_autoplay` defaults to `TRUE`. When an admin first enables `music`, autoplay will be active immediately. This is intentional — the expected first-time experience is autoplay on.

**Flag interaction rules:**
- `music` OFF → `AudioPlayer` does not render; `music_autoplay` has no effect
- `music` ON + `music_autoplay` ON → music starts synchronously on "Open Invitation" click
- `music` ON + `music_autoplay` OFF → existing click-to-play behavior unchanged

## Architecture

### Component Wiring (App.tsx)

`App.tsx` holds a ref to `AudioPlayer`'s imperative handle and reads `useMusicAutoplayEnabled()` to decide whether to trigger playback on overlay dismiss:

```tsx
import AudioPlayer, { AudioPlayerHandle } from '@/components/AudioPlayer';

const audioPlayerRef = useRef<AudioPlayerHandle>(null);
const isMusicAutoplayEnabled = useMusicAutoplayEnabled();

const handleOverlayDismiss = useCallback(() => {
  if (isMusicAutoplayEnabled) {
    audioPlayerRef.current?.startAutoplay();
  }
}, [isMusicAutoplayEnabled]);

// JSX:
<WelcomeOverlay onDismiss={handleOverlayDismiss} />
<AudioPlayer ref={audioPlayerRef} />
```

### WelcomeOverlay.tsx

- Accept optional `onDismiss?: () => void` prop
- Call `onDismiss?.()` at the end of the existing `handleOpen()` function (one line added)
- No other changes

Updated TypeScript interface:
```ts
interface WelcomeOverlayProps {
  onDismiss?: () => void;
}
```

### AudioPlayer.tsx

Convert to `forwardRef` component exposing an imperative `startAutoplay()` handle. `AudioPlayerHandle` must be exported so `App.tsx` can type its ref:

```ts
export interface AudioPlayerHandle {
  startAutoplay: () => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, Record<string, never>>((_, ref) => {
  useImperativeHandle(ref, () => ({
    startAutoplay: () => {
      if (!audioEl.current) return;
      audioEl.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {}); // silently fall back; play button remains available
    },
  }), []); // empty deps — handle is stable
  // ... rest of component unchanged
});
```

- No `overlayDismissed` prop needed
- No `useEffect` for autoplay — call chain is fully synchronous
- Play/pause button remains visible and functional in all cases
- `isPlaying` is set to `true` on successful play, so button shows the correct state

**On refresh (overlay already dismissed in sessionStorage):** Do NOT attempt `audio.play()` on mount. There is no user gesture available and all modern browsers will block it. The play button shows as normal. This is acceptable — returning visitors can click the play button.

### useFeatureFlags.ts

Add convenience hook:

```ts
export function useMusicAutoplayEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('music_autoplay');
}
```

Note: `isFeatureEnabled` defaults to `true` when a flag key is not found. In development (in-memory repository, no database), `music_autoplay` will not be seeded but will behave as `true` by default — autoplay is active in dev without needing explicit seeding. However, the backend contract test (`GET /api/feature-flags`) asserts the key is present in the response. For that test to pass, `music_autoplay` must be seeded into `MemoryRepository` (see backend section below).

### Backend Migration

New file: `go-server/migrations/002_add_music_autoplay_flag.sql`

```sql
INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
VALUES ('music_autoplay', 'Music Autoplay', 'Autoplay background music when invitation opens', TRUE)
ON CONFLICT (feature_key) DO NOTHING;
```

**Migration runner:** `make migrate` runs all `migrations/*.sql` files in alphabetical order via shell glob. `001_init.sql` runs before `002_add_music_autoplay_flag.sql`. Both are idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`). Re-running `make migrate` is safe.

### In-Memory Repository Seeding

`go-server/internal/repository/memory.go` — `NewMemoryRepository()` starts with an empty `featureFlags` map. Add the `music_autoplay` seed so backend tests that query `GET /api/feature-flags` see the flag in the response:

```go
flagIDSeq: 1,
featureFlags: map[int]models.FeatureFlag{
    1: {
        ID:          1,
        FeatureKey:  "music_autoplay",
        FeatureName: "Music Autoplay",
        Description: "Autoplay background music when invitation opens",
        Enabled:     true,
        UpdatedAt:   now(),
    },
},
```

`flagIDSeq` must be set to `1` alongside the seeded map entry. `CreateFeatureFlag` increments `flagIDSeq` before use, so leaving it at `0` would produce `ID: 1` on the next call, silently overwriting the seed. `UpdatedAt` must be non-empty (`now()`) for consistency and to avoid contract tests that assert `updatedAt` is non-empty.

If other flags are already seeded in tests, add `music_autoplay` alongside them with the next available ID and a matching `flagIDSeq` value.

## Data Flow

```
Guest opens invite URL
  └── WelcomeOverlay shows
        └── Guest clicks "Open Invitation"
              ├── handleOpen() (WelcomeOverlay.tsx)
              ├── onDismiss?.() → handleOverlayDismiss() (App.tsx)
              │     ├── [music_autoplay ON]  → audioPlayerRef.current.startAutoplay()
              │     │                          → audio.play() [synchronous, gesture context intact]
              │     │                          → setIsPlaying(true) on success
              │     └── [music_autoplay OFF] → no-op
              └── Overlay exits (AnimatePresence)
```

## Edge Cases

| Scenario | Behavior |
|---|---|
| Page refresh (overlay already dismissed via sessionStorage) | Play button shown; no autoplay attempt (no gesture available) |
| Welcome screen feature disabled | No overlay → play button only; browser will block mount-time autoplay |
| `music` flag OFF | `AudioPlayer` does not render; `music_autoplay` irrelevant |
| `audio.play()` rejects (any reason) | Silently caught; `isPlaying` stays `false`; play button visible |
| `music_autoplay` toggled in admin | Change reflected within next polling cycle (up to 60 seconds, due to exponential backoff) |
| Dev environment (in-memory repo) | `music_autoplay` not seeded but defaults to `true` via `isFeatureEnabled` fallback |

## Files Changed

| File | Change |
|---|---|
| `go-server/migrations/002_add_music_autoplay_flag.sql` | New migration inserting `music_autoplay` flag |
| `client/src/hooks/useFeatureFlags.ts` | Add `useMusicAutoplayEnabled()` convenience hook |
| `client/src/App.tsx` | Add `audioPlayerRef`, `handleOverlayDismiss`, wire props; read `useMusicAutoplayEnabled()` |
| `client/src/components/WelcomeOverlay.tsx` | Accept `onDismiss` prop, call it in `handleOpen()` |
| `client/src/components/AudioPlayer.tsx` | Convert to `forwardRef`, export `AudioPlayerHandle` interface, expose `startAutoplay()` via `useImperativeHandle` |
| `go-server/internal/repository/memory.go` | Seed `music_autoplay` flag in `NewMemoryRepository()` so backend tests see the flag |

## Testing Plan

Tests are written first (TDD) per project convention.

### Unit / Component Tests (Frontend)

1. `useMusicAutoplayEnabled()` — returns `true` when `music_autoplay` flag is enabled; returns `false` when disabled
2. `AudioPlayer` — `startAutoplay()` calls `audio.play()` and sets `isPlaying` to `true` on success
3. `AudioPlayer` — `startAutoplay()` catches `audio.play()` rejection silently; `isPlaying` remains `false`
4. `WelcomeOverlay` — calls `onDismiss` prop when "Open Invitation" is clicked

### Integration / Contract Tests (Backend)

5. `GET /api/feature-flags` response includes `music_autoplay` key with correct structure (camelCase fields, `enabled: bool`)

### Manual Verification

6. `music` OFF → `AudioPlayer` not rendered; no play button visible
7. `music` ON + `music_autoplay` ON → click "Open Invitation" → music plays, button shows Volume2 icon
8. `music` ON + `music_autoplay` OFF → overlay dismiss has no effect on audio; click play button works
9. Toggle `music_autoplay` in admin → change reflected within up to 60 seconds (exponential backoff)
10. Test on iOS Safari: click "Open Invitation" → music plays immediately (gesture-context validation)
11. `npm run check` — no TypeScript errors
