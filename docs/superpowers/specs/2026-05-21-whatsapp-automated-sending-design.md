# WhatsApp Automated Invitation Sending

**Date:** 2026-05-21
**Status:** Approved
**Supersedes:** `docs/superpowers/specs/2026-04-08-whatsapp-invite-automation-design.md` (that spec covered the original manual wa.me flow; this replaces it with full automation)

## Overview

Currently sending WhatsApp invitations requires the admin to step through each guest one at a time in a dialog and manually press Send inside WhatsApp for every message. With 289 guests split between groom-side and bride-side, this is ~289 manual Send actions across two people.

This feature replaces the manual flow with fully automated sending using **whatsmeow** (`github.com/tulir/whatsmeow`) — a pure Go library that implements the WhatsApp multi-device protocol. No separate process, no Node.js, no headless browser. The library integrates as a service struct inside the existing Go server.

Groom-side guests are sent from the groom's personal WhatsApp number; bride-side guests from the bride's. Both accounts scan a QR code once; sessions persist in Postgres so no re-scan is needed on server restart.

---

## Architecture

```
Admin Browser
    ↕ HTTP
Go Backend :5000
    ├── internal/service/whatsapp.go   (new — WhatsAppService)
    ├── internal/handler/whatsapp.go   (new — WA admin endpoints)
    └── invites table                  (changed — +side field)
    ↕ WA multi-device protocol
WhatsApp (groom session + bride session)

PostgreSQL
    ├── invites (+ side column)
    └── whatsmeow session tables (auto-created by sqlstore)
```

The `WhatsAppService` is injected into the WA handler via the existing router functional-options pattern (`WithWhatsApp`), consistent with how storage and Google Drive are wired today.

---

## Data Model

### Migration

```sql
ALTER TABLE invites ADD COLUMN side TEXT CHECK (side IN ('groom', 'bride'));
```

`side` is nullable. Guests without a side are imported normally but skipped during automated sending with a warning shown in the UI.

### Schema changes (`shared/schema.ts`)

Add `side` to the `invites` table definition and the `insertInviteSchema`.

### Go layer changes for `side`

| File | Change |
|------|--------|
| `internal/models/invite.go` | Add `Side *string \`json:"side"\`` to `Invite` struct |
| `internal/repository/repository.go` | Add `side *string` to `CreateInviteParams`; add `side *string` to `UpdateInviteParams` |
| `internal/repository/memory.go` | Store and return `Side` in create/update/list operations |
| `internal/repository/postgres.go` | Include `side` column in INSERT and UPDATE queries |
| `internal/handler/contract_test.go` | Add `"side"` to the invite JSON field contract |

### JID-to-role mapping

whatsmeow sessions are keyed by device JID (e.g. `6281234567890.0:12@lid`). On server restart the sqlstore reconnects the client, but `WhatsAppService` needs to know which stored session belongs to groom and which to bride.

Two `app_settings` rows are used as the mapping:

| Key | Value |
|-----|-------|
| `wa_groom_jid` | JID string of the groom's linked device, e.g. `6281234567890.0:12@lid` |
| `wa_bride_jid` | JID string of the bride's linked device |

When a session is successfully established (QR scan complete), the handler writes the device JID to the corresponding `app_settings` key via the existing `UpdateAppSetting` repository call. On `WhatsAppService.Init()`, both keys are read to select the correct sqlstore device for each client. If a key is absent or the stored device no longer exists in the sqlstore, that side starts in `disconnected` state.

---

## whatsmeow Service (`internal/service/whatsapp.go`)

```go
type WhatsAppService struct {
    groomClient *whatsmeow.Client
    brideClient *whatsmeow.Client
    store       *sqlstore.Container  // backed by the existing pgx pool
    jobs        sync.Map             // jobID → *SendJob
}
```

### Session lifecycle

- On startup, `WhatsAppService.Init()` connects to Postgres via whatsmeow's `sqlstore.NewWithDB`, loads any persisted sessions, and attempts to restore both clients.
- If a session exists and is valid, the client reconnects automatically — no QR needed.
- If no session exists, the client emits a QR code event. The handler polls this and serves it to the frontend.
- Sessions are stored in whatsmeow-managed tables (auto-created on first run).

### Key methods

| Method | Purpose |
|--------|---------|
| `SessionStatus(side string) SessionInfo` | Returns `connected`, `qr_pending`, or `disconnected` plus QR data URI if pending |
| `Connect(side string) error` | Initiates QR code generation for the given side; transitions state to `qr_pending` |
| `Disconnect(side string) error` | Logs out and clears the stored session |
| `StartSendJob(msgs []WAMessage, delayRange [2]int) (string, error)` | Enqueues a send job, returns jobID |
| `GetJob(jobID string) *SendJob` | Returns current job state for polling |
| `PauseJob(jobID string)` | Signals the job goroutine to pause |
| `ResumeJob(jobID string)` | Resumes a paused job |

### Phone-to-JID conversion

Before sending, each guest's phone number is normalised to a WhatsApp JID:

1. Strip all non-digit characters and leading `+`.
2. Build the JID: `<digits>@s.whatsapp.net` (e.g. `+6281234567890` → `6281234567890@s.whatsapp.net`).
3. Call `client.IsOnWhatsApp([]string{jid})` to verify the number has a WhatsApp account.
4. If not found: mark the message as skipped with reason `"not_on_whatsapp"` and continue to the next guest.

### Send job

Each job runs in a goroutine. `WhatsAppService` holds a `Repository` reference so it can write directly to Postgres without going through an HTTP callback. For each message:

1. Pick the correct client based on `side`.
2. Normalise the phone to JID and verify via `IsOnWhatsApp`; skip with reason `"not_on_whatsapp"` if absent.
3. Send the message via `client.SendMessage`.
4. On success: call `repo.MarkWaSent(ctx, inviteID)` to set `waSentAt = now()` in Postgres.
5. Sleep for a random delay between 20 and 30 seconds before the next message.
6. Update job state (sent count, current invite ID, status).

Job state is in-memory (`sync.Map`). Jobs are not persisted — if the server restarts mid-send, the job is lost but already-sent invites remain marked in Postgres. The admin can restart sending; already-sent guests are excluded.

---

## New Go Endpoints (`internal/handler/whatsapp.go`)

All routes are under `/api/admin/` and require the existing admin session middleware.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/admin/wa/sessions` | Returns status + QR data URI for both groom and bride sessions |
| `POST` | `/api/admin/wa/sessions/:side/connect` | Initiates QR generation for the given side (`groom` or `bride`); transitions to `qr_pending` |
| `DELETE` | `/api/admin/wa/sessions/:side` | Disconnects and clears a session |
| `POST` | `/api/admin/wa/send-all` | Starts a send job for all unsent invites with phone + side; returns `{ jobId }` |
| `GET` | `/api/admin/wa/job/:id` | Returns job progress: total, sent, failed, currentInviteId, status |
| `POST` | `/api/admin/wa/job/:id/pause` | Pauses a running job |
| `POST` | `/api/admin/wa/job/:id/resume` | Resumes a paused job |

### `GET /api/admin/wa/sessions` response

```json
{
  "groom": { "status": "connected", "phone": "+6281234567890" },
  "bride": { "status": "qr_pending", "qr": "data:image/png;base64,..." }
}
```

### `GET /api/admin/wa/job/:id` response

```json
{
  "status": "running",
  "total": 289,
  "sent": 47,
  "failed": 0,
  "skipped": 2,
  "currentInviteId": 134,
  "groom": { "total": 158, "sent": 29 },
  "bride": { "total": 131, "sent": 18 }
}
```

---

## Existing Endpoint Changes

### `PATCH /api/admin/invites/:id`

Add `side` to the accepted request body. Accepts `"groom"`, `"bride"`, or `null` (to clear).

### `POST /api/admin/invites/bulk`

Add `side` to each invite entry. Already-null `side` is accepted silently.

---

## Frontend Changes (`client/src/pages/admin/InvitesPage.tsx`)

### 1. WhatsApp Connections card

A new collapsible card (above the template editor) shows the connection state of both sessions.

- **Connected state**: green dot, phone number, Disconnect button.
- **QR pending state**: amber dot, QR code image (base64 from the API), "Open WhatsApp → Linked Devices → Scan" instruction, countdown showing QR refresh (30s). Frontend polls `GET /api/admin/wa/sessions` every 3 seconds while any session is in `qr_pending`.
- **Disconnected state**: grey dot, Connect button (triggers a poll cycle to show QR).

### 2. CSV import — side column detection

Add `side` to `SIDE_HEADERS = ["side", "pihak", "from"]` and detect values:
- `"groom"` / `"pengantin pria"` → `"groom"`
- `"bride"` / `"pengantin wanita"` → `"bride"`
- anything else / empty → `null`

In the import preview dialog:
- Stats bar gains: `🤵 N groom · 👰 N bride · ⚠️ N no side`.
- Each entry row shows a coloured side badge (`🤵 groom` in blue, `👰 bride` in pink, `⚠️ no side` in amber).
- A warning below the list if any entries have no side: *"N guests have no side — they'll be imported but skipped during automated sending."*

Side is passed to `POST /api/admin/invites/bulk` per entry.

### 3. Invite card — side field in inline edit

The existing edit mode (name + phone) gains a three-way toggle: **Groom / Bride / None**.

- View mode: shows a small side badge on the card. Amber `⚠️ No side` badge if unassigned.
- Edit mode: toggle added below the phone input. Saves via the existing `PATCH /api/admin/invites/:id` with `side` included.

### 4. Stats row

Add two stat cards: **Groom guests** and **Bride guests** counts (derived from the invite list).

### 5. Send All Unsent — automated flow

Replace the one-at-a-time manual dialog with:

1. Admin clicks **Send All Unsent (N)**.
2. If any session needed for unsent guests is not connected, show an error: *"Connect groom/bride WhatsApp first."*
3. If unsent guests have no side, show: *"N guests have no side and will be skipped."* with a confirm to proceed.
4. On confirm: call `POST /api/admin/wa/send-all` → get `jobId`.
5. Dialog shows:
   - Overall progress bar (sent / total).
   - Per-side progress bars (groom and bride).
   - Currently sending: name, phone, side.
   - Estimated time remaining (calculated from remaining count × 25s average).
   - Pause / Resume button.
   - Note: *"You can close this dialog — sending continues in the background."*
6. Frontend polls `GET /api/admin/wa/job/:id` every 3 seconds to update the UI.
7. When the job completes, shows a summary: Sent N, Skipped N, Failed N.

The old wa.me one-at-a-time dialog is removed. Individual per-card WhatsApp icon buttons (which open wa.me links) are kept as a fallback for sending to a single guest manually.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Session disconnects mid-job | Job pauses, UI shows error on that side, admin re-scans QR, resumes job |
| Message send fails for a guest | Marked as failed in job state, not marked `waSentAt`, included in final failure count |
| Guest has no phone | Already excluded from unsent list (existing behaviour) |
| Guest has no side | Excluded from send job with a skip count |
| Guest's number not on WhatsApp | Skipped with reason `"not_on_whatsapp"`, included in skip count |
| Both sessions needed but only one connected | Send job proceeds for the connected side only; skips the other side with a warning |
| WhatsApp 4-device limit reached | QR scan will fail non-obviously (connection drops immediately after scan). `GET /api/admin/wa/sessions` will show the side reverting to `disconnected`. Admin must unlink another device in WhatsApp → Linked Devices before scanning again. |

---

## Testing

- Unit tests for side column detection in the CSV parser (new cases in existing parser tests).
- Unit tests for `WhatsAppService` method stubs using a mock whatsmeow client interface.
- Handler tests for the new WA endpoints (session status, job polling) against the in-memory repo.
- No end-to-end WhatsApp send tests — whatsmeow requires a real phone for integration.

---

## Out of Scope

- Configurable send delay (fixed at 20–30s random per message).
- Scheduling sends for a future time.
- Per-message delivery receipts from WhatsApp (read receipts).
- WhatsApp Business API.
- Sending to guests with no phone number.
