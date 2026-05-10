# Fix: Wedding Detail Schedule Times

**Date:** 2026-05-10

## Problem

The "Schedule" card inside the "The Details" section (`DetailsSection.tsx`) displays hardcoded times for Holy Matrimony and Wedding Reception that do not match the authoritative times defined in `WEDDING_SCHEDULE` in `constants.ts`.

| Event label (card) | Incorrect time | Correct time (from WEDDING_SCHEDULE) |
|---|---|---|
| Holy Matrimony | 2:00 PM - 3:30 PM | 2:00 PM - 3:00 PM |
| Wedding Reception | 6:15 PM - 8:00 PM | 5:30 PM - 8:00 PM |

## Scope

Single file change only: `client/src/components/DetailsSection.tsx`.

## Design

Update the two hardcoded time strings in the schedule summary card (lines ~89 and ~96) to match `WEDDING_SCHEDULE[0].time` and `WEDDING_SCHEDULE[2].time` respectively. The event labels ("Holy Matrimony", "Wedding Reception") remain unchanged. The Teapai event is intentionally omitted from the summary card.

## Out of Scope

- Refactoring to derive card times dynamically from `WEDDING_SCHEDULE` at runtime (not needed for a one-off fix)
- Changes to the full "Wedding Day Schedule" timeline (already correct)
- Any backend changes
