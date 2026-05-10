# RSVP Deadline Feature Design

**Date:** 2026-05-10  
**Status:** Approved

## Problem

RSVP has no automatic close mechanism. After the wedding date passes, the countdown shows zeros but the RSVP form remains open indefinitely. Closing RSVP requires manually flipping the `rsvp` feature flag in admin.

## Solution

Store a configurable `rsvp_deadline` date in `app_settings`. The backend enforces it server-side (403 on late submissions). The frontend shows a "RSVP is now closed" message when the deadline has passed. A new admin page exposes the deadline date picker for both production configuration and testing.

## Data Model

**No new tables or migrations required.**

One new `app_settings` key:

| key | type | example value | description |
|---|---|---|---|
| `rsvp_deadline` | `date` | `"2026-06-25"` | ISO date string after which RSVP is closed |

Default (pre-filled but unsaved on first admin page load): `2026-06-25` (10 days before the wedding date of July 5, 2026).

## Open/Closed Logic

Two independent signals control RSVP availability:

| `rsvp` feature flag | `rsvp_deadline` | Guest sees |
|---|---|---|
| disabled | any | Section hidden entirely (existing behavior) |
| enabled | future date | RSVP form, submissions accepted |
| enabled | past date | "RSVP is now closed" message |

The flag remains the manual kill-switch. The deadline adds automatic date-based closure on top. If either says closed, RSVP is closed.

## Backend Changes

**File:** `go-server/internal/handler/rsvp.go` — `CreateRsvp` handler

At the start of `CreateRsvp`, before any invite/email validation:
1. Read `rsvp_deadline` from `app_settings` via the repository
2. Parse it as a date
3. If current time (UTC date) is after the deadline → return `403` with `"RSVP submissions are closed"`
4. If the setting is missing or unparseable → skip the check, proceed normally (fail open)

No new routes. No changes to the repository interface (existing `GetAppSetting` is sufficient).

## Frontend Changes

**File:** `client/src/components/RsvpSection.tsx`

1. Read `rsvp_deadline` from the existing `/api/app-settings` response
2. Add a third render branch between the "flag disabled → null" check and the form:
   - If `rsvp_deadline` exists and current date ≥ deadline → render "RSVP is now closed" message
3. If `/api/app-settings` fails → treat `rsvp_deadline` as absent, show form normally (fail open)
4. If a 403 arrives on submission (deadline slipped past mid-session) → show toast "RSVP is now closed" and switch to the closed message state

## Admin Page

**New file:** `client/src/pages/admin/RsvpDeadlinePage.tsx`  
**Nav item:** "RSVP Deadline", icon `CalendarClock`, path `/rsvp-deadline`  
**Changes to:** `AdminLayout.tsx` — add nav item and route

### Page Layout

Single card with three zones:

1. **Current Status** — badge showing `OPEN` (green, "closes in N days") or `CLOSED` (red, "closed N days ago"), computed from the saved deadline value

2. **Deadline Date** — date input pre-populated from `rsvp_deadline` app setting. Default pre-fill if unset: `2026-06-25`. Save button calls `PATCH /api/admin/app-settings/bulk` (same endpoint used by ConfigPage).

3. **Warning banner** — visible only when the saved deadline is in the past: *"Deadline is in the past. RSVP is currently closed for guests."*

### Testing Workflow

Change the deadline to a past date → verify guests see the closed message and submissions are rejected. Change it back to a future date → RSVP reopens immediately. No separate test mode needed.

## Error Handling

| Scenario | Backend | Frontend |
|---|---|---|
| `rsvp_deadline` setting missing | Skip check, proceed | Show form normally |
| `rsvp_deadline` value malformed | Skip check, log warning | Show form normally |
| Submission after deadline | Return 403 | Toast "RSVP is now closed", switch to closed message |
| `/api/app-settings` fetch fails | — | Show form normally (fail open) |

## Testing

**Backend** (`go-server/internal/handler/rsvp_test.go`):
- Table-driven cases: deadline in the past → 403; deadline in the future → proceeds to normal validation; deadline missing → proceeds normally

**Frontend** (`client/src/components/__tests__/RsvpSection.test.tsx`):
- Add cases: `rsvp_deadline` in past → renders closed message; `rsvp_deadline` in future → renders form; 403 response on submit → switches to closed message

## Out of Scope

- Changing the displayed wedding date site-wide (countdown, venues, schedule remain hardcoded in `constants.ts`)
- Auto-toggling the `rsvp` feature flag
- Email notifications when RSVP closes
