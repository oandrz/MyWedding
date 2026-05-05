# Welcome Overlay Always-Show Design

**Goal:** Show the WelcomeOverlay on every fresh page load (new tab, refresh) so the gesture-to-autoplay chain fires reliably on every real visit, including return visits.

**Architecture:** Replace the `sessionStorage` tracking in `WelcomeOverlay` with a module-level variable. Module-level state resets when the JS runtime restarts (fresh page load, refresh) but persists across React re-renders and SPA navigation — which is exactly the right semantic for "show once per real visit, not per SPA navigation."

**Tech Stack:** React, TypeScript, Vitest

---

## Background

The WelcomeOverlay currently uses `sessionStorage` to track whether it has already shown during a tab session. Once dismissed, it never shows again until the tab is closed. This means:

- Return visits (new tab, refresh) used to skip the overlay after the first ever dismissal — actually, sessionStorage persists across refreshes, so refreshing the page also skips the overlay. This breaks music autoplay on refresh.
- The only way music autoplays is on the very first visit to the site in a new tab.

The fix is to show the overlay on every fresh page load, ensuring the gesture-to-autoplay chain always has an opportunity to fire.

## Behaviour

| Scenario | Before | After |
|---|---|---|
| First visit (new tab) | Overlay shows | Overlay shows ✓ |
| Refresh | Overlay skipped (sessionStorage) | Overlay shows ✓ |
| New tab (return visit) | Overlay skipped (sessionStorage) | Overlay shows ✓ |
| SPA navigation (Home → Gallery → Home) | Overlay skipped | Overlay skipped ✓ |
| Admin pages | Never shows | Never shows ✓ |

## Implementation

### `client/src/components/WelcomeOverlay.tsx`

Add a module-level variable at the top of the file:

```ts
let hasShownThisLoad = false;
```

In the `useEffect` that controls when the overlay opens, replace:

```ts
const hasOpenedOverlay = sessionStorage.getItem("welcome_overlay_opened");
if (hasOpenedOverlay) {
  return;
}
```

with:

```ts
if (hasShownThisLoad) {
  return;
}
```

In `handleOpen` (the dismiss handler), replace:

```ts
sessionStorage.setItem("welcome_overlay_opened", "true");
```

with:

```ts
hasShownThisLoad = true;
```

No other changes to `WelcomeOverlay`. The `onDismiss` prop and the rest of the gesture-to-autoplay chain in `App.tsx` remain unchanged.

### `client/src/components/__tests__/WelcomeOverlay.test.tsx`

- Remove any test setup that reads/writes `welcome_overlay_opened` from `sessionStorage`
- The module-level `hasShownThisLoad` starts as `false` in every test file (Vitest loads a fresh module per file). Tests that need to simulate "already shown this load" must import and set the variable directly, or use `vi.isolateModules()` to get a clean module instance between cases.
- Existing test for `onDismiss` callback remains unchanged
- Add a test confirming `onDismiss` is called when "Open Invitation" is clicked (already exists — verify it still passes)

## What Does Not Change

- `App.tsx` — no changes. The `audioPlayerRef`, `handleOverlayDismiss`, and `useMusicAutoplayEnabled` wiring stays as-is.
- `AudioPlayer.tsx` — no changes.
- Feature flags — `music_autoplay` flag still controls whether autoplay fires on dismiss.
- Admin page guard — overlay still never shows on `/admin` routes.
- Invite code / guest name personalisation — unchanged.

## Testing

Run frontend tests:
```bash
npm run check     # TypeScript type check
npx vitest run    # All tests
```

Manually verify:
1. Fresh tab → overlay shows → click "Open Invitation" → music autoplays
2. Refresh → overlay shows → music autoplays
3. Navigate Home → Gallery → Home within same session → overlay does NOT show again
4. Admin page → overlay never shows
