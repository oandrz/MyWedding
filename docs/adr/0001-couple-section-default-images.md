# ADR 0001: Use locally bundled images as CoupleSection profile fallbacks

**Date:** 2026-05-28
**Status:** Accepted
**Deciders:** Project Maintainer

## Context

The home page's Couple section (`client/src/components/CoupleSection.tsx`) renders bride and groom profile photos fetched via React Query from `/api/config-images/bride-profile` and `/api/config-images/groom-profile`. When the query returns no data — initial load, empty result, or failed request — the component falls back to two hardcoded Unsplash URLs (lines 35 and 38).

Under high load this fallback becomes visible to real users: the configured photos disappear and are replaced by generic stock images that do not match the wedding's visual design. The flash is noticeable and off-brand.

The user has supplied two dedicated placeholder JPGs intended to replace the Unsplash defaults:

- `client/src/assets/groom_default.jpg`
- `client/src/assets/bride_default.jpg`

## Decision

Replace the two Unsplash URL string literals in `CoupleSection.tsx` with locally bundled Vite imports of the user-supplied JPGs.

Imports use the existing `@` Vite alias (which resolves to `client/src/`):

```ts
import groomDefaultImg from "@/assets/groom_default.jpg";
import brideDefaultImg from "@/assets/bride_default.jpg";
```

These replace the Unsplash URLs as the `||` fallback for `brideImage` (line 35) and `groomImage` (line 38). The fetch logic, query keys, `ConfigImage` shape, and DOM markup are unchanged.

### Alternatives considered

1. **Place the JPGs in `/public/images/` and reference by URL path.** Rejected — bypasses Vite's content hashing and bundling, and offers no real benefit over an import for files this small. Imports also colocate the asset reference with the component that uses it.

2. **Swap the default *and* fix the revert-under-load behavior** (e.g. add a skeleton loader, retry policy, or persist the last-known-good image in `localStorage` / React Query cache). Rejected for this change to keep scope tight. The revert behavior is a separate concern and can get its own ADR if the team wants to eliminate the flash entirely.

3. **Keep the Unsplash URLs.** Rejected — they are the root cause of the off-brand flash and depend on a third-party CDN.

## Consequences

**Positive**
- Fallback image is design-consistent with the rest of the wedding site.
- No external network dependency for the fallback — eliminates DNS, CDN, and CORS failure modes for that asset.
- Vite content-hashes the JPGs, so they cache aggressively in browsers and the build CDN.
- The placeholder no longer flashes a generic stock photo when the API call is slow or empty, reducing the visual impact of the underlying load issue.

**Negative**
- Two new JPGs ship as part of the JS bundle. Acceptable trade-off — they replace external assets and load once per user.
- The underlying root cause (configured photos disappearing under load) is **not addressed** by this change. Users will still see the placeholder swap in during slow/failed API calls — it will just look intentional rather than broken. A follow-up may be warranted.

**Neutral**
- The `@assets` Vite alias documented in `CLAUDE.md` maps to `attached_assets/` and is *not* used here. Files under `client/src/assets/` are imported via the `@` alias instead. Future contributors should be aware of the distinction.

## Implementation

Single-file change in `client/src/components/CoupleSection.tsx`:

1. Add the two imports near the top of the file.
2. Replace the Unsplash URL on line 35 with `brideDefaultImg`.
3. Replace the Unsplash URL on line 38 with `groomDefaultImg`.

No tests added — visual change only. Verification is manual: run dev server, block the two `/api/config-images/*-profile` requests in DevTools, hard-reload, and confirm the new local images render inside the circular frames with the existing `object-cover` crop.

## Follow-ups (not part of this ADR)

- Investigate why the React Query call for config images returns empty under high load. Candidate fixes: longer cache TTL, retry policy, persisting last-known-good image, or a loading-state skeleton that suppresses the fallback while the query is in flight.
