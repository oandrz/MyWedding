# Admin Invites — Filter by Side (Groom / Bride / Unassigned)

**Date:** 2026-05-28
**Status:** Design approved, pending implementation plan
**Scope:** Frontend only — `client/src/pages/admin/InvitesPage.tsx`

## Goal

Let the admin narrow the Invites list to one side at a time so the groom and the bride can each focus on their own guests. A purely visual filter — no auth changes, no per-account scoping.

## Non-goals

- Server-side enforcement of who-sees-what.
- Separate groom/bride admin accounts.
- Filtering on other admin pages (RSVPs, Messages, etc.). The same URL-param pattern can be reused later if desired.
- Editing a guest's side from the filter UI (inline row editing already covers this).

## Architecture

Client-side only. The Go endpoint `GET /api/admin/invites` already returns the `side` field on every invite (see `go-server/internal/models/invite.go` — `Side *string`), and the React Query cache already holds the full list.

**State source of truth:** the URL query param `?side=`, with values `all` (or absent), `groom`, `bride`, `unassigned`. Read from `window.location.search` (or Wouter's location hook) on mount and on change; written via `history.replaceState` so flipping filters does not pollute the back/forward history.

**Single derived value:** `filteredInvites = applySearch(applySide(invites))`. Every downstream computation — stats subset, bulk-select scope, "Send All Unsent" target, the no-side warning — reads from this same array. One source, one filter, no divergent counts.

## UI

A new row of segmented chips sits above the search input, inside the "Guest Invites" card header area (around `InvitesPage.tsx:1382`).

```
[ All · 84 ]  [ 🤵 Groom · 38 ]  [ 👰 Bride · 42 ]  [ ⚠ Unassigned · 4 ]
```

- Active chip: filled, amber-tinted (matching the page's accent). Inactive: outlined.
- Counts come from the **unfiltered** `invites` array so they always show totals — that gives the admin context for what they are filtering away.
- The "Unassigned" chip only renders when `unassignedCount > 0`. Once every invite has a side, the chip disappears.
- Mobile: chips wrap to a second row naturally.

### Stats cards

The seven stats cards at the top of the page (Total / RSVPs Received / Pending / WA Sent / WA Unsent / Groom / Bride) recalculate from `filteredInvites`. When a side filter is active, the Groom and Bride cards are hidden (they would be redundant or zero), and the remaining five cards span the row.

### Send All Unsent button

The label updates dynamically — `Send All Unsent (12)` becomes `Send Groom Unsent (5)` when the groom filter is active. The job submission posts the filtered ID list.

## Filter logic

Side predicate (applied before the search filter):

| Value | Predicate |
| --- | --- |
| `all` | all invites |
| `groom` | `invite.side === "groom"` |
| `bride` | `invite.side === "bride"` |
| `unassigned` | `!invite.side` (covers `null` and `undefined`) |

Search composes on top: typing in the search box narrows within the currently selected side.

### Bulk select scope

- "Select" mode (`InvitesPage.tsx:1392`+) operates over `filteredInvites`, not the full list.
- The "Select all" checkbox checks every visible row.
- Bulk-delete sends only those IDs.
- The red "Delete All" button gets a guardrail: when a side filter is active, it switches to "Delete All Filtered" and posts an explicit ID list instead of the `deleteAll: true` flag — preventing accidental wipe of the other side. The confirmation dialog copy reflects this.

### Send All Unsent

- Unsent set is computed from `filteredInvites` (`.phone && !waSentAt`).
- The existing groom/bride WhatsApp-session connection check (`InvitesPage.tsx:668`–678) still runs, but only checks sides actually present in the filtered set. Filtering to "Groom" no longer requires bride's WA to be connected.
- The existing "X guests have no side and will be skipped" confirm continues to work. When the filter is "unassigned" specifically, short-circuit to a toast: `No unassigned guests can be sent — they need a side first.`

### Empty states

When `filteredInvites.length === 0` but `invites.length > 0`, show "No guests match this filter" instead of the existing zero-invites empty state. Reuse the existing search-empty state component with adjusted copy.

## Persistence

- Read filter on mount from `URLSearchParams`. Invalid values (e.g. `?side=foo`) fall back to `all` silently.
- Never write a default `?side=all` to keep clean URLs.
- Use `history.replaceState` (or the Wouter equivalent) so the back button still leaves the page entirely instead of cycling through filter changes.

## Testing & verification

No new backend tests (no backend change). No API contract change. No migrations.

If a sibling `__tests__/InvitesPage.test.tsx` pattern exists at implementation time, mirror it; otherwise verify manually:

1. With a mix of groom / bride / unassigned invites, each chip filters correctly and chip counts match the totals.
2. Search composes: filter to Groom, type a name fragment → only matching groom guests visible.
3. URL round-trip: navigate to `/admin/invites?side=bride`, refresh, filter is restored. `?side=foo` falls back to All without error.
4. Bulk delete with a filter active: only filtered rows deletable; "Delete All Filtered" affects only the filtered set.
5. Send All with Groom filter: button reads `Send Groom Unsent (N)`, only groom IDs appear in the POST body, bride WA disconnection does not block.
6. Unassigned chip vanishes when every invite has a side; reappears when a new no-side invite is added.
7. Stats cards recalculate on filter change; Groom and Bride cards collapse when a side filter is active.

## Files touched

- `client/src/pages/admin/InvitesPage.tsx` — sole file modified.

## Risks

- Recalculating stats from a filtered set could surprise an admin who expects global totals at a glance. Mitigation: chip labels carry the unfiltered counts, so a global view is always one click away.
- The "Delete All Filtered" rewrite touches a destructive code path. The bulk-delete API already accepts an explicit ID list, so the change is small and easy to verify in the confirm dialog copy.
