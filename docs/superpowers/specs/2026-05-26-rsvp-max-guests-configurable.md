# RSVP Max Guests — Configurable from Admin

**Date:** 2026-05-26
**Status:** Approved

## Problem

The maximum number of guests a single RSVP can include is hardcoded as a dropdown with options 1–4 in `RsvpSection.tsx`. There is no way to change this without a code deploy.

## Goal

Allow the admin to configure the max guest count from the admin panel. The RSVP form's guest dropdown renders options dynamically up to that limit.

## Approach

Use the existing `app_settings` key/value store (same pattern as `rsvp_deadline`) with a new key `rsvp_max_guests`. No backend changes required — the generic settings endpoints already cover read and write.

## Data & Storage

- **Setting key:** `rsvp_max_guests`
- **Setting type:** `"number"`
- **Storage:** existing `app_settings` table via `GET /api/app-settings` and `PATCH /api/admin/app-settings/bulk`
- **Default fallback:** `4` — if the key is absent or unparseable, both the form and admin UI treat the limit as 4 (preserves current behavior for existing deployments)
- No schema migration needed

## Admin UI

- `RsvpDeadlinePage.tsx` → renamed to `RsvpSettingsPage.tsx`
- Nav label in `AdminLayout.tsx`: "RSVP Deadline" → "RSVP Settings"
- Route stays `/rsvp-deadline` (no redirect needed)
- A new card section is added below the existing deadline card:
  - Numeric input (min 1, max 20), label: "Max guests per RSVP"
  - Description: "Controls how many guests a single RSVP can include"
  - Independent Save button — calls `PATCH /api/admin/app-settings/bulk` with `{ settingKey: "rsvp_max_guests", settingValue: "<n>", settingType: "number" }`
  - Reads current value from the already-fetched `/api/app-settings` response

## RSVP Form (`RsvpSection.tsx`)

The form already fetches `/api/app-settings` for the deadline check. Extend that response to derive `maxGuests`:

```ts
const maxGuests = parseInt(
  appSettingsData?.settings?.find(s => s.settingKey === 'rsvp_max_guests')?.settingValue ?? '4',
  10
) || 4;
```

Replace hardcoded `<option>` elements (1–4) with:

```tsx
{Array.from({ length: maxGuests }, (_, i) => i + 1).map(n => (
  <option key={n} value={n}>{n}</option>
))}
```

No new API calls or loading state changes needed.

## Error Handling

- If `rsvp_max_guests` is missing: falls back to 4 silently
- If the value is non-numeric or ≤ 0: falls back to 4
- Admin save uses the same error/toast pattern as the deadline save

## Testing

**`RsvpSection.test.tsx`**
- Test: `appSettingsData` contains `rsvp_max_guests: "3"` → dropdown renders options 1, 2, 3 only
- Test: `appSettingsData` has no `rsvp_max_guests` key → dropdown falls back to 4 options

**`RsvpSettingsPage.test.tsx`** (renamed from `RsvpDeadlinePage.test.tsx` or new file)
- Test: max guests input is present and renders current value
- Test: clicking Save triggers `PATCH /api/admin/app-settings/bulk` with `settingKey: "rsvp_max_guests"`

No backend tests needed — no backend code changes.

## Files Changed

| File | Change |
|------|--------|
| `client/src/pages/admin/RsvpDeadlinePage.tsx` | Renamed → `RsvpSettingsPage.tsx`; add max guests card |
| `client/src/pages/admin/AdminLayout.tsx` | Import new filename; update nav label |
| `client/src/components/RsvpSection.tsx` | Dynamic guest dropdown from app settings |
| `client/src/pages/admin/__tests__/RsvpDeadlinePage.test.tsx` | Update/extend for max guests |

## Out of Scope

- Per-invite guest caps (each invite has its own limit)
- Backend enforcement of the limit (dropdown already constrains selection)
- Backend code changes of any kind
