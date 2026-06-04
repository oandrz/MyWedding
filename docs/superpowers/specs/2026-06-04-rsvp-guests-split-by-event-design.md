# Split "Total Expected Guests" by Event (RSVP admin page)

**Date:** 2026-06-04
**Status:** Approved design — ready for implementation plan
**Scope:** RSVP admin page (`/admin` RSVP tab) only

## Problem

The admin RSVP page shows a single **"Total Expected Guests"** card summing the
guest counts of every attending party. With a two-part wedding (Holy Matrimony
and Reception), the couple needs the expected headcount **per event** for venue
and catering planning, not just a combined number.

## Key Insight

No new data is required. Every RSVP already carries:

- `attendanceType` — one of `both`, `holy_matrimony`, `reception`, `decline`
- `guestCount` — nullable headcount for that party

So this is a presentation change plus two derived stats computed on the backend.

## Semantics: the "both" overlap (intentional)

A party with `attendanceType = "both"` attends **both** events, so its guests
count toward the Matrimony total **and** the Reception total. The two per-event
totals therefore overlap, and their sum can exceed the overall headcount. This is
correct: each venue must plan for everyone who will be there. Declined RSVPs are
excluded from both totals.

## Design

### 1. Backend — `go-server/internal/handler/rsvp.go` (`GetAll`)

In the existing stats loop, add two accumulators next to `holyMatrimonyCount` /
`receptionCount`, applying the **same `nil → 1` fallback** the overall
`guestCount` already uses (so parties that left guest count blank are not
undercounted):

```go
if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "holy_matrimony" {
    holyMatrimonyCount++
    holyMatrimonyGuestCount += guestCountOrOne(rsvp) // *GuestCount when set, else 1
}
if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "reception" {
    receptionCount++
    receptionGuestCount += guestCountOrOne(rsvp)
}
```

Add two camelCase fields to the `stats` map in the JSON response:

- `holyMatrimonyGuestCount`
- `receptionGuestCount`

The existing `guestCount` (combined) field stays in the response — it is harmless
and avoids touching any other consumer — it is simply no longer rendered.

The `nil → 1` fallback is currently inline in the `guestCount` branch. The
implementation may extract a small `guestCountOrOne(rsvp)` helper so all three
sums share one definition, or inline it consistently — implementer's choice, as
long as the fallback is identical across all three.

### 2. Frontend — `client/src/pages/admin/RsvpPage.tsx`

- Extend the `stats` type with `holyMatrimonyGuestCount: number` and
  `receptionGuestCount: number`.
- **Remove** the single "Total Expected Guests" card (`data-testid="stat-total-guests"`).
- **Add** two cards: **"Matrimony Guests"** and **"Reception Guests"**.
- **Reorder the cards into event pairs** so response-count vs headcount reads
  unambiguously:

  `[Holy Matrimony RSVPs] [Matrimony Guests] [Reception RSVPs] [Reception Guests] [Declined]`

  - "RSVPs" = number of responding parties (existing `holyMatrimonyCount` /
    `receptionCount`).
  - "Guests" = expected headcount (new `holyMatrimonyGuestCount` /
    `receptionGuestCount`).
- Change the grid from `lg:grid-cols-4` to `lg:grid-cols-5`; it wraps responsively
  on smaller breakpoints (keep `md:grid-cols-2`).
- Suggested `data-testid`s: `stat-holy-matrimony-guests`,
  `stat-reception-guests`. Reuse existing gradient styling conventions for the new
  cards (Matrimony guests in the rose/pink family, Reception guests in the
  purple/indigo family) so each event's two cards read as a pair.

No change to the existing attendance filter tabs or the RSVP list rendering.

### 3. Tests (TDD-first, per project conventions)

**Backend** (`go-server/internal/handler`, contract/handler test):
- Assert the response `stats` object includes `holyMatrimonyGuestCount` and
  `receptionGuestCount` as camelCase integer fields.
- Fixture covering all branches:
  - a `both` party with `guestCount = 4` → contributes 4 to **both** totals
  - a `holy_matrimony` party with `guestCount = 2` → 2 to matrimony only
  - a `reception` party with `guestCount = 3` → 3 to reception only
  - an attending party with `guestCount = nil` → contributes 1 (fallback)
  - a `decline` party → contributes 0 to both
- Verify the exact expected sums for the fixture.

**Frontend** (`client/src/pages/admin/__tests__/RsvpPage.test.tsx`):
- Mock the API to return the two new stats fields.
- Assert "Matrimony Guests" and "Reception Guests" cards render with the mocked
  values.
- Assert the old single "Total Expected Guests" card is no longer present.

## Out of Scope

- The Stats / Attendance Analytics page (`StatsPage.tsx`) keeps its single
  combined "Total Expected Guests" — unchanged.
- No database/schema changes.
- No change to the public guest-facing RSVP form.

## Files Touched

- `go-server/internal/handler/rsvp.go` — two new derived stats
- `go-server/internal/handler/*_test.go` — backend assertions
- `client/src/pages/admin/RsvpPage.tsx` — card layout + types
- `client/src/pages/admin/__tests__/RsvpPage.test.tsx` — frontend assertions
