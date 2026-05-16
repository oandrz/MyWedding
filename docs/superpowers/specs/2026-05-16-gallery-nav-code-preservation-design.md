# Design: Gallery Minimal Nav + Invite Code Preservation

**Date:** 2026-05-16
**Status:** Approved

## Problem

1. Guests who arrive via a personalised invite link (`/?code=klycp`) lose their `?code` param when navigating away from the home page (e.g. to `/gallery`) and then clicking Home in the navbar. They land on `/` with no code, so the RSVP section and welcome overlay lose personalisation.

2. The `/gallery` page shares the same full `NavBar` as the home page, exposing Home and Wishes navigation that makes the gallery feel part of the main invitation flow rather than a standalone memories space.

## Goals

- Navigating Home from any page preserves the guest's `?code` in the URL.
- `/gallery` shows only the "A&C" logo — no navigation links.
- The `/gallery` URL itself never carries the `?code` param (sharing the gallery link stays code-free).

## Solution

### 1. Synchronous code capture in `main.tsx`

Before React renders, read `?code` from the URL and write it to `sessionStorage`:

```ts
const code = new URLSearchParams(window.location.search).get('code');
if (code) sessionStorage.setItem('inviteCode', code);
```

Writing here (synchronously, before `createRoot`) guarantees every component reads the correct value on first mount. Writing only when a code is present in the URL means:
- A new code in the URL always overwrites the old one (same-tab, different-guest handled correctly).
- Visiting a page without a code (e.g. `/gallery`) never clears a previously stored code.

### 2. NavBar: `minimal` prop + code-aware home link

**`minimal` prop:**
`NavBar` accepts `minimal?: boolean`. When `true`:
- The desktop nav links div is not rendered.
- The mobile hamburger button and slide-down menu are not rendered.
- Only the logo (`<Link>A&C</Link>`) is shown.

**Code-aware home href:**
When `minimal` is `false` (normal mode), NavBar reads `sessionStorage.getItem('inviteCode')` once on mount via lazy `useState`:

```ts
const [inviteCode] = useState(() =>
  typeof window !== 'undefined' ? sessionStorage.getItem('inviteCode') ?? '' : ''
);
const homeHref = inviteCode ? `/?code=${encodeURIComponent(inviteCode)}` : '/';
```

Both the desktop Home link and the mobile Home link use `homeHref` instead of the hardcoded `"/"`.

### 3. Gallery.tsx

Change `<NavBar />` to `<NavBar minimal />`. No other changes to the gallery page.

## Files Changed

| File | Change |
|------|--------|
| `client/src/main.tsx` | Synchronous sessionStorage write before `createRoot` |
| `client/src/components/NavBar.tsx` | Add `minimal` prop; compute `homeHref` from sessionStorage |
| `client/src/pages/Gallery.tsx` | Pass `minimal` to `<NavBar>` |

## What Does Not Change

- `WelcomeOverlay` and `RsvpSection` continue reading `?code` from `window.location.search` directly — correct because the URL will now contain the code when the guest uses the NavBar home link.
- The Memories link in NavBar stays `href="/gallery"` (no code appended).
- `hasShownThisLoad` in `WelcomeOverlay` prevents the overlay re-appearing on home navigation.

## Known Edge Cases

| Scenario | Behaviour | Acceptable? |
|----------|-----------|-------------|
| Revoked invite code stored in sessionStorage | Home link still appends code; RSVP section shows "Invalid invite code" | Yes — tab close clears sessionStorage |
| Two guests share a tab sequentially | Second guest's code overwrites first on URL load | Yes — handled by always-overwrite logic |
| Guest visits `/gallery` directly (no prior code) | sessionStorage empty; Home link goes to `/` | Correct |
