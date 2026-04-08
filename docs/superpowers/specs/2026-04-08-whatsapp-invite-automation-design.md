# WhatsApp Invite Automation — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Approach:** Semi-automated (wa.me deep links, not API-based)

## Overview

Add WhatsApp outreach capabilities to the invite management system. Admins can store phone numbers on invites, customize a message template, and use a step-by-step "Send All" dialog that opens `wa.me` deep links for manual sending from their personal WhatsApp. Per-invite sent/unsent tracking persists progress.

## Goals

- Store phone numbers on invites (via manual entry, inline edit, or CSV bulk import)
- Provide a customizable WhatsApp message template with variable interpolation
- Generate `wa.me` deep links with pre-filled messages
- Step-by-step "Send All" dialog to work through unsent invites
- Track sent/unsent status per invite

## Non-Goals

- WhatsApp Business API integration or automated sending
- Phone number field on RSVP table
- Message history or audit log beyond a single `wa_sent_at` timestamp
- Auto-guessing country codes from local phone formats

---

## 1. Database Changes

### Migration: `006_add_whatsapp_fields.sql`

```sql
ALTER TABLE invites
  ADD COLUMN phone TEXT,
  ADD COLUMN wa_sent_at TIMESTAMPTZ;
```

- `phone` — Nullable. Stores international format (E.164), e.g., `+6281234567890`.
- `wa_sent_at` — Nullable. Timestamp when admin marked the invite as sent. `NULL` = unsent.

No changes to the `rsvp` table.

## 2. Go Model Changes

### `internal/models/invite.go`

Add fields to `Invite` struct:

```go
Phone    *string `json:"phone"`
WaSentAt *string `json:"waSentAt"`
```

Update `InsertInvite` to accept optional phone:

```go
Phone *string `json:"phone"`
```

## 3. Shared Schema Changes

### `shared/schema.ts`

Add `phone` (text, nullable) and `waSentAt` (timestamp, nullable) to the invites Drizzle table definition and corresponding Zod schemas.

## 4. API Changes

### Modified Endpoints

| Method | Endpoint | Change |
|--------|----------|--------|
| `POST` | `/api/admin/invites` | Accept optional `phone` field in request body |
| `POST` | `/api/admin/invites/bulk` | **Breaking:** Request body changes from `{ names: string[] }` to `{ invites: [{ name: string, phone?: string }] }` |

### New Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `PUT` | `/api/admin/invites/{id}` | Admin+CSRF | Update invite fields (phone number) |
| `PUT` | `/api/admin/invites/{id}/wa-sent` | Admin+CSRF | Mark invite as sent (sets `wa_sent_at = NOW()`) |
| `DELETE` | `/api/admin/invites/{id}/wa-sent` | Admin+CSRF | Unmark sent (sets `wa_sent_at = NULL`) |

### Bulk Create Breaking Change

**Before:**
```json
{ "names": ["John Doe", "Jane Doe"] }
```

**After:**
```json
{
  "invites": [
    { "name": "John Doe", "phone": "+6281234567890" },
    { "name": "Jane Doe" }
  ]
}
```

Phone is optional per entry. Max 500 invites per request (unchanged).

### Message Template Storage

Uses existing `app_settings` table — no new endpoints needed.

- **Key:** `wa_message_template`
- **Read:** `GET /api/settings/wa_message_template`
- **Write:** `PATCH /api/admin/app-settings/wa_message_template`

Default template (client-side fallback if setting not found):

```
Hi {name}, you're invited to our wedding! RSVP here: {link}
```

Available variables: `{name}`, `{code}`, `{link}`

## 5. Phone Number Handling

### Validation Rules

- Must start with `+` followed by 7-15 digits (E.164 format)
- Strip spaces, dashes, and parentheses before validation
- If user enters a number without `+`, show validation error requesting international format
- No auto-guessing of country codes (guests span Indonesia `+62` and Singapore `+65`)

### Normalization

Input: `+62 812-3456-7890` → Stored: `+6281234567890`

### wa.me Link Generation

1. Strip `+` prefix: `+6281234567890` → `6281234567890`
2. Replace template variables: `{name}` → guest name, `{code}` → invite code, `{link}` → full invite URL
3. URL-encode the message
4. Build: `https://wa.me/6281234567890?text={urlEncodedMessage}`

## 6. CSV Import Changes

### Phone Column Auto-Detection

Case-insensitive header matching (in priority order):
`"phone"`, `"phone number"`, `"whatsapp"`, `"wa"`, `"no hp"`, `"nomor hp"`, `"mobile"`

### Import Behavior

- Phone column is optional — CSV with only a name column still works
- Each phone value is normalized before preview
- Invalid phone numbers show a warning badge in preview but are still importable (can be fixed later via inline edit)
- Empty phone values stored as `NULL`

### Preview Dialog

Shows two columns: Name and Phone (if phone column detected). Duplicate detection remains name-based.

## 7. Frontend Changes

### 7a. Invites Table (`InvitesPage.tsx`)

- **New columns:** "Phone" (editable inline) and "WA Status" (sent/unsent badge with timestamp)
- **Inline phone edit:** Click phone cell to edit, validates E.164, saves via `PUT /api/admin/invites/{id}`
- **WhatsApp icon button** per row: Opens `wa.me` deep link in new tab (disabled if no phone). After opening, prompts "Mark as sent?"
- **Stats bar:** Add "Sent" / "Unsent" counts

### 7b. Message Template Editor

Located on the Invites page (collapsible section or tab):

- Textarea for template string
- Available variables shown as clickable chips: `{name}`, `{code}`, `{link}`
- Live preview panel showing rendered message with sample data
- Save button → `PATCH /api/admin/app-settings/wa_message_template`
- Loaded on mount via `GET /api/settings/wa_message_template`, falls back to default

### 7c. "Send All" Step-by-Step Dialog

Trigger: "Send All Unsent" button (shown when unsent invites with phone numbers exist).

**Dialog flow:**

1. Opens showing progress: "1 of N unsent"
2. Displays current invite: name, phone, rendered message preview
3. **"Open WhatsApp"** button → opens `wa.me` link in new tab
4. **"Mark Sent & Next"** → calls `PUT /api/admin/invites/{id}/wa-sent`, advances to next
5. **"Skip"** → advances without marking
6. **"Pause"** → closes dialog (progress persisted via `wa_sent_at` on each invite)
7. Auto-closes when all processed, shows summary (X sent, Y skipped)

### 7d. CSV Import Updates

- Preview dialog shows name + phone columns when phone column detected
- Column selector dropdown allows changing which column maps to phone (like existing name column selector)

## 8. Testing

### Backend

- Contract tests for new/modified endpoints (response shape, status codes)
- Phone validation unit tests (valid E.164, missing `+`, too short, too long, with spaces/dashes)
- Bulk create with mixed phone/no-phone entries
- Mark/unmark sent endpoints

### Frontend

- CSV parser tests for phone column detection
- Phone validation in inline edit
- Template variable replacement
- wa.me link generation

## 9. Files to Modify

| File | Change |
|------|--------|
| `go-server/migrations/006_add_whatsapp_fields.sql` | **New** — schema migration |
| `go-server/internal/models/invite.go` | Add `Phone`, `WaSentAt` fields |
| `go-server/internal/handler/invite.go` | Update Create/BulkCreate, add Update/MarkSent/UnmarkSent handlers |
| `go-server/internal/repository/repository.go` | Add `UpdateInvite`, `MarkInviteWaSent`, `UnmarkInviteWaSent` methods |
| `go-server/internal/repository/postgres.go` | Implement new repo methods, update existing queries to include new columns |
| `go-server/internal/repository/memory.go` | Implement new repo methods for testing |
| `go-server/internal/router/router.go` | Register new routes |
| `go-server/internal/handler/contract_test.go` | Add contract tests for new endpoints |
| `shared/schema.ts` | Add `phone`, `waSentAt` to invites schema |
| `client/src/pages/admin/InvitesPage.tsx` | Phone column, inline edit, WA status, template editor, Send All dialog |
