# CSV Bulk Invite Import — Design Spec

**Date:** 2026-04-05
**Status:** Approved

## Problem

The admin currently creates invites one at a time by typing a guest name. The user has a Google Sheets guest list with ~100+ names and needs to import them in bulk without manual entry.

## Solution

Add a CSV upload flow to the admin Invites page. The user exports their Google Sheet as CSV, uploads it in the admin, selects the name column, previews the parsed names (with duplicate detection), and confirms to bulk-create invites.

## Approach

**Frontend-only CSV parsing + bulk API.** The CSV is parsed in the browser using native `FileReader` API. No file is uploaded to the server — only the confirmed list of names is sent via a new bulk create endpoint.

## Design

### Backend — Bulk Create Endpoint

**New endpoint:** `POST /api/admin/invites/bulk`

**Request body:**
```json
{ "names": ["John & Jane Doe", "Alice Smith"] }
```

**Behavior:**
- Rejects if `names` array is empty or exceeds 500 entries → 400
- Validates all names are non-empty strings after trimming
- Sanitizes each name via the existing Sanitizer
- Generates a unique invite code per name using `GenerateInviteCode()`, with retry-on-collision (same pattern as existing `CreateInvite` in postgres.go — up to 3 retries per invite if the generated code hits a UNIQUE constraint)
- Inserts all invites in a single database transaction (all-or-nothing)
- Returns the created invites

**Response (201):**
```json
{
  "invites": [
    { "id": 1, "name": "John & Jane Doe", "code": "ab3k9", "rsvpId": null, "createdAt": "..." },
    ...
  ]
}
```

**Error responses** (using existing `writeError` format):
- Empty `names` array → 400 `{ "error": "Names array is required and cannot be empty" }`
- Array exceeds 500 entries → 400 `{ "error": "Cannot import more than 500 names at once" }`
- Any name is empty string after trim → 400 `{ "error": "All names must be non-empty" }`
- Database failure → 500 `{ "error": "Failed to create invites" }` (transaction rolls back, no partial creates)

**New model:**
```go
type BulkCreateInvitesRequest struct {
    Names []string `json:"names"`
}
```

**New repository method:**
```go
CreateInvitesBulk(ctx context.Context, data []InsertInvite) ([]Invite, error)
```

- Postgres implementation: single transaction, insert each invite with code-collision retry (up to 3 attempts per invite), return all
- Memory implementation: loop through and append to in-memory slice

### Frontend — CSV Import Flow

**Location:** `InvitesPage.tsx` — new "Import from CSV" card placed between the existing "Create New Invite" card and the search bar.

**Three UI states:**

#### State 1: Upload
- Card titled "Import from CSV"
- File input accepting `.csv` files
- After file selection, parse the CSV and auto-detect the name column by matching headers against common names ("Full Name", "Name", "Guest Name", etc.)
- If no auto-match, show a dropdown to let the user select which column contains names
- Transition to State 2

#### State 2: Preview
- Summary line: "Found **82 names** — **3 duplicates**"
- Scrollable list of names, each with a checkbox
  - New names: checked by default
  - Duplicate names (case-insensitive match against existing invites): highlighted with a warning badge, unchecked by default
- "Import Selected" button (disabled if nothing selected) and "Cancel" button
- On "Import Selected": send `POST /api/admin/invites/bulk` with the selected names

#### State 3: Result
- Success toast: "Created N invites"
- Invalidate the invites query to refresh the list
- Reset the import card back to State 1

**CSV parsing approach:**
- Use `FileReader.readAsText()` to read the file
- Strip UTF-8 BOM (`\xEF\xBB\xBF`) if present at the start of the file (common in Excel/Google Sheets exports)
- Parse using RFC 4180-aware logic: handle quoted fields (e.g., `"Doe, John & Jane"`) where commas inside double quotes are not treated as delimiters
- First row is treated as headers
- Extract the selected column from each subsequent row
- Trim whitespace, filter out empty values

**Duplicate detection:**
- Compare parsed names (case-insensitive, trimmed) against the already-fetched `invites` array from the TanStack Query cache — no server round-trip needed
- Also detect duplicates **within the CSV itself**: if the same name appears multiple times in the file, flag subsequent occurrences as "duplicate in file" with a distinct indicator from the "already exists in DB" warning. These are also unchecked by default.

**Cancel / re-upload:**
- Clicking "Cancel" in the Preview state resets back to Upload state
- The file input is hidden during Preview — user must cancel to select a different file

### Testing

**Backend tests:**

`handler/invite_test.go` — table-driven tests for `BulkCreate`:
- Happy path: multiple names → all created with unique codes, returns 201
- All returned codes are unique (bulk of 20 invites, assert distinct codes)
- Empty names array → 400
- Array exceeds 500 entries → 400
- Names containing empty strings → 400
- Sanitization applied to each name

`repository/memory_test.go` — test `CreateInvitesBulk`:
- Creates correct count of invites
- Each invite gets a unique code
- All invites retrievable via `GetInvites`

`handler/contract_test.go` — bulk response contract:
- Response has `invites` array
- Each invite has `id` (number), `name` (string), `code` (string), `rsvpId` (null), `createdAt` (string)

**Frontend:**
- No component tests (consistent with existing InvitesPage pattern)
- Manual verification of the upload → preview → confirm flow

## Files Changed

| Layer | File | Change |
|-------|------|--------|
| Model | `go-server/internal/models/invite.go` | Add `BulkCreateInvitesRequest` struct |
| Repository Interface | `go-server/internal/repository/repository.go` | Add `CreateInvitesBulk` method |
| Repository (Postgres) | `go-server/internal/repository/postgres.go` | Implement bulk insert in transaction |
| Repository (Memory) | `go-server/internal/repository/memory.go` | Implement bulk insert |
| Handler | `go-server/internal/handler/invite.go` | Add `BulkCreate` method |
| Router | `go-server/internal/router/router.go` | Register `POST /api/admin/invites/bulk` |
| Tests | `go-server/internal/handler/invite_test.go` | Bulk create handler tests |
| Tests | `go-server/internal/repository/memory_test.go` | Bulk create repo tests |
| Tests | `go-server/internal/handler/contract_test.go` | Bulk response contract test |
| Frontend | `client/src/pages/admin/InvitesPage.tsx` | CSV import card with 3-state flow |

## What's NOT Changing

- No database migration — existing `invites` table supports this as-is
- No new npm dependencies — CSV parsing uses native browser APIs
- No changes to the single-invite create flow — it remains as-is
- No Google Sheets API integration — user exports to CSV manually
