# Invite-Code RSVP Design

**Date:** 2026-03-24
**Status:** Approved
**Goal:** Replace email-based RSVP deduplication with personalized invite codes, behind a feature flag.

## Problem

The current RSVP flow requires guests to enter an email address. This adds unnecessary friction — guests shouldn't need to provide an email just to RSVP to a wedding. Email also serves as the deduplication key, which needs a replacement.

## Solution

Introduce an **invites** system where each guest gets a personalized link with a unique 5-character code. The invite code replaces email as the dedup mechanism. The new flow is gated behind a feature flag (`invite_code_rsvp`) so the existing email-based flow remains as a fallback.

## Data Model

### New `invites` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | `SERIAL PRIMARY KEY` | |
| `name` | `TEXT NOT NULL` | Guest name (displayed in greeting) |
| `code` | `TEXT NOT NULL UNIQUE` | 5-char lowercase alphanumeric |
| `rsvp_id` | `INTEGER REFERENCES rsvp(id) ON DELETE SET NULL` | Null = not yet responded |
| `created_at` | `TIMESTAMPTZ DEFAULT NOW()` | |

### `rsvp` table (unchanged)

Email column stays for backward compatibility behind the feature flag. When the flag is off, the existing email-based flow works as-is.

### Cascade behavior

Deleting an invite cascades to delete its linked RSVP. Implemented at the application level (handler deletes RSVP first, then invite) rather than DB-level CASCADE, since `rsvp_id` is on the invites table (not the other direction).

### Code generation

- 5-char lowercase alphanumeric (`a-z0-9`)
- Generated server-side using `crypto/rand`
- 36^5 = ~60 million combinations (more than sufficient for wedding guest lists)
- Uniqueness enforced by DB unique constraint; collision retry on insert

## API Endpoints

### New endpoints

**Admin routes (under `/api/admin/`, behind auth + CSRF middleware):**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/admin/invites` | Create invite (name → generates code) |
| `GET` | `/api/admin/invites` | List all invites with RSVP status |
| `DELETE` | `/api/admin/invites/{id}` | Delete invite (cascades: deletes linked RSVP) |

**Public routes (no auth):**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/invites/{code}` | Lookup invite by code (guest-facing) |

**Response shape for `GET /api/invites/{code}`:**
```json
{
  "invite": {
    "id": 1,
    "name": "Christine",
    "code": "k3m9x",
    "rsvpId": null,
    "createdAt": "2026-03-24T10:00:00Z",
    "rsvp": null
  }
}
```
When the guest has already RSVP'd, `rsvp` is populated:
```json
{
  "invite": {
    "id": 1,
    "name": "Christine",
    "code": "k3m9x",
    "rsvpId": 5,
    "createdAt": "2026-03-24T10:00:00Z",
    "rsvp": {
      "id": 5,
      "name": "Christine",
      "attendanceType": "both",
      "guestCount": 2
    }
  }
}
```

### Modified endpoints

| Method | Path | Change |
|--------|------|--------|
| `POST` | `/api/rsvp` | When flag on: requires `code` instead of `email`. Looks up invite, creates/updates RSVP, sets `invite.rsvp_id`. When flag off: existing email-based behavior. |
| `GET` | `/api/rsvp` | Unchanged (admin list still works). |
| `GET` | `/api/rsvp/{email}` | Unchanged (still available when flag is off). |

### RSVP creation flow (flag on)

1. Guest visits `yoursite.com?code=k3m9x`
2. Frontend calls `GET /api/invites/k3m9x` → gets invite with associated RSVP data (if any)
3. Guest sees personalized greeting, fills attendance type + guest count
4. Frontend calls `POST /api/rsvp` with `{ code: "k3m9x", attendanceType: "both", guestCount: 2 }`
5. Backend looks up invite by code, creates/updates RSVP, sets `invite.rsvp_id`

### Welcome screen integration

The existing welcome screen uses `?to=GuestName` to personalize the greeting. With the invite-code flow, the frontend reads `?code=` from the URL, calls `GET /api/invites/{code}` to resolve the guest name, then passes the resolved name to the welcome screen component. The `?to=` param is no longer needed when `?code=` is present. Fallback behavior: if neither `?code=` nor `?to=` is present, the welcome screen uses `fallbackName` as it does today.

## Feature Flag

- **Flag name:** `invite_code_rsvp`
- **Default:** `false`
- **When `false`:** Current email-based RSVP flow (no changes to existing behavior)
- **When `true`:** Invite-code flow is active

### Where the flag is checked

- **Frontend (`RsvpSection.tsx`):** Decides which form to render (email form vs. code-based form)
- **Backend (`POST /api/rsvp` handler):** Decides whether to validate by code or email

### Future cleanup

Once the invite-code flow is validated in production, a follow-up task will:
- Remove email from the `rsvp` table and model
- Remove `GetRsvpByEmail` and `GET /api/rsvp/{email}`
- Remove the feature flag check (invite-code becomes the only path)

## Frontend Changes

### Guest experience (`RsvpSection.tsx`) — flag on

- Read `code` from URL query param (`?code=k3m9x`)
- If no code present → RSVP section is hidden entirely
- If code present → call `GET /api/invites/{code}` to fetch guest name
- If invalid code → show a friendly "Invalid invite link" message
- Show personalized greeting: "Hi [Name], you're invited!"
- Name field is read-only (pre-filled from invite)
- Email field is not shown
- If guest already RSVP'd → pre-fill attendance type and guest count for editing

### Guest experience — flag off

- Current email-based form (unchanged)

### Admin — new Invites page (`admin/InvitesPage.tsx`)

- List all invites: name, code, RSVP status (pending / responded)
- "Add Guest" button → simple form with just a name field
- Each invite row shows a "Copy Link" button (copies the full personalized URL)
- Delete invite button (with confirmation — warns that linked RSVP will also be deleted)
- Search/filter by name

### Admin — RSVP page (`admin/RsvpPage.tsx`)

- Unchanged (email still displayed when flag is off; when flag is on, email may be empty for new code-based RSVPs)

### Shared schema (`shared/schema.ts`)

- Add `invites` table definition and Zod validation schema

## Backend Changes

### New files

- `internal/models/invite.go` — `Invite` and `InsertInvite` structs:
  ```go
  type Invite struct {
      ID        int    `json:"id"`
      Name      string `json:"name"`
      Code      string `json:"code"`
      RsvpID    *int   `json:"rsvpId"`
      CreatedAt string `json:"createdAt"`
      Rsvp      *Rsvp  `json:"rsvp,omitempty"` // populated on GetByCode
  }
  type InsertInvite struct {
      Name string `json:"name"`
  }
  ```
- `internal/handler/invite.go` — `InviteHandler` with Create, List, Delete, GetByCode methods
- `internal/handler/invite_test.go` — Handler tests

### New repository interface methods

```go
CreateInvite(ctx context.Context, data models.InsertInvite) (*models.Invite, error)
GetInvites(ctx context.Context) ([]models.Invite, error)
GetInviteByCode(ctx context.Context, code string) (*models.Invite, error)
DeleteInvite(ctx context.Context, id int) (bool, error)
UpdateInviteRsvpID(ctx context.Context, inviteID int, rsvpID *int) error
```

### Modified files

- `internal/repository/repository.go` — Add invite CRUD interface methods (above)
- `internal/repository/memory.go` — In-memory invite implementation
- `internal/repository/postgres.go` — Postgres invite implementation
- `internal/handler/rsvp.go` — `Create` method checks feature flag; when on, validates by code. `InsertRsvp.Email` becomes `*string` (pointer, optional) so code-based RSVPs can omit it. A new `Code *string` field is added to the RSVP request body for the code-based flow.
- `internal/router/router.go` — Add admin invite routes under `/api/admin/invites` and public route at `/api/invites/{code}`

### New migration

- `go-server/migrations/005_add_invites.sql` — Create invites table

## Testing

### New tests

- `handler/invite_test.go` — Create invite, list invites, delete invite, get by code (valid + invalid), cascade delete behavior
- `repository/memory_test.go` — Invite CRUD methods

### Updated tests

- `handler/rsvp_test.go` — Add tests for RSVP creation via code (when flag on), existing email tests remain (when flag off)
- `handler/contract_test.go` — Invite JSON structure (camelCase fields, correct types)
- `client/src/components/__tests__/RsvpSection.test.tsx` — Code-based flow rendering
- `client/src/pages/admin/__tests__/RsvpPage.test.tsx` — Unchanged (email still present)

### Key test scenarios

- Create invite → generates 5-char code
- RSVP with valid code → creates RSVP + links to invite
- RSVP with same code again → updates existing RSVP
- RSVP with invalid code → 404
- RSVP without code (flag on) → 400
- Delete invite with linked RSVP → both deleted
- Delete invite without RSVP → only invite deleted
- Flag off → email-based flow works as before
