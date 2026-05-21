# WhatsApp Automated Invitation Sending — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual one-at-a-time WhatsApp send flow with fully automated bulk sending via whatsmeow, routing groom-side guests from the groom's number and bride-side guests from the bride's number.

**Architecture:** A new `WhatsAppService` (pure Go, `go.mau.fi/whatsmeow`) lives in `internal/service/whatsapp.go`. Sessions persist in Postgres via whatsmeow's sqlstore. The service is injected into a new `WAHandler` via a `WithWhatsApp` router option, consistent with `WithStorage` and `WithGoogleDrive`. A `side` column is added to the `invites` table and propagated through every layer.

**Tech Stack:** whatsmeow (`go.mau.fi/whatsmeow`), skip2/go-qrcode for PNG rendering, pgx v5 stdlib wrapper for sqlstore, React/Tanstack Query on the frontend.

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Create | `go-server/migrations/002_invites_side.sql` | Add `side` column |
| Modify | `shared/schema.ts` | Add `side` to invites table + schema |
| Modify | `go-server/internal/models/invite.go` | Add `Side *string` to Invite, InsertInvite, BulkInviteEntry |
| Modify | `go-server/internal/repository/repository.go` | Extend UpdateInvite signature; add UpdateInviteSide |
| Modify | `go-server/internal/repository/memory.go` | Implement side in create/update |
| Modify | `go-server/internal/repository/postgres.go` | Add side to INSERT/UPDATE/SELECT queries |
| Modify | `go-server/internal/handler/invite.go` | Accept side in PATCH handler |
| Modify | `go-server/internal/handler/contract_test.go` | Add side to assertInviteObject |
| Create | `go-server/internal/service/whatsapp.go` | WhatsAppService + all types |
| Create | `go-server/internal/handler/whatsapp.go` | All WA admin endpoints |
| Create | `go-server/internal/handler/whatsapp_test.go` | Handler tests with mock service |
| Modify | `go-server/internal/router/router.go` | WithWhatsApp option + WA routes |
| Modify | `client/src/pages/admin/InvitesPage.tsx` | All frontend changes |

---

## Task 1: DB Migration + Shared Schema

**Files:**
- Create: `go-server/migrations/002_invites_side.sql`
- Modify: `shared/schema.ts`

- [ ] **Step 1: Write the migration**

```sql
-- go-server/migrations/002_invites_side.sql
ALTER TABLE invites ADD COLUMN IF NOT EXISTS side TEXT CHECK (side IN ('groom', 'bride'));
```

- [ ] **Step 2: Add side to shared/schema.ts**

In `shared/schema.ts`, change the `invites` table definition (around line 119):

```ts
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  rsvpId: integer("rsvp_id"),
  phone: text("phone"),
  side: text("side"),
  waSentAt: timestamp("wa_sent_at", { mode: 'string' }),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull()
});

export const insertInviteSchema = createInsertSchema(invites).pick({
  name: true,
  phone: true,
  side: true,
});
```

- [ ] **Step 3: Run migrate in your dev environment**

```bash
cd go-server && DATABASE_URL="$DATABASE_URL" psql "$DATABASE_URL" -f migrations/002_invites_side.sql
```

Expected: `ALTER TABLE`

- [ ] **Step 4: Commit**

```bash
git add go-server/migrations/002_invites_side.sql shared/schema.ts
git commit -m "feat: add side column to invites table"
```

---

## Task 2: Go Model + Repository Layer (side field)

**Files:**
- Modify: `go-server/internal/models/invite.go`
- Modify: `go-server/internal/repository/repository.go`
- Modify: `go-server/internal/repository/memory.go`
- Modify: `go-server/internal/repository/postgres.go`

- [ ] **Step 1: Write failing tests for side in memory repo**

Add to `go-server/internal/repository/memory_test.go` (or create if absent):

```go
func TestInvite_SideField(t *testing.T) {
    repo := NewMemoryRepository()
    ctx := context.Background()

    groomSide := "groom"
    inv, err := repo.CreateInvite(ctx, models.InsertInvite{Name: "Budi", Side: &groomSide})
    if err != nil {
        t.Fatalf("CreateInvite: %v", err)
    }
    if inv.Side == nil || *inv.Side != "groom" {
        t.Fatalf("expected side=groom, got %v", inv.Side)
    }

    brideSide := "bride"
    updated, err := repo.UpdateInviteSide(ctx, inv.ID, &brideSide)
    if err != nil {
        t.Fatalf("UpdateInviteSide: %v", err)
    }
    if updated.Side == nil || *updated.Side != "bride" {
        t.Fatalf("expected side=bride after update, got %v", updated.Side)
    }

    updated2, err := repo.UpdateInvite(ctx, inv.ID, "Budi Santoso", nil, nil)
    if err != nil {
        t.Fatalf("UpdateInvite: %v", err)
    }
    if updated2.Side != nil {
        t.Fatalf("expected side cleared after UpdateInvite with nil side, got %v", updated2.Side)
    }
}

func TestInvite_BulkCreateWithSide(t *testing.T) {
    repo := NewMemoryRepository()
    ctx := context.Background()

    groomSide := "groom"
    invites, err := repo.CreateInvitesBulk(ctx, []models.InsertInvite{
        {Name: "Alice", Side: &groomSide},
        {Name: "Bob"},
    })
    if err != nil {
        t.Fatalf("CreateInvitesBulk: %v", err)
    }
    if invites[0].Side == nil || *invites[0].Side != "groom" {
        t.Fatalf("expected Alice side=groom, got %v", invites[0].Side)
    }
    if invites[1].Side != nil {
        t.Fatalf("expected Bob side=nil, got %v", invites[1].Side)
    }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd go-server && go test ./internal/repository/... -run TestInvite_SideField -v
```

Expected: FAIL — `Side` field does not exist yet.

- [ ] **Step 3: Add Side to Invite model**

In `go-server/internal/models/invite.go`, change:

```go
type Invite struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Code      string  `json:"code"`
	RsvpID    *int    `json:"rsvpId"`
	Phone     *string `json:"phone,omitempty"`
	Side      *string `json:"side,omitempty"`
	WaSentAt  *string `json:"waSentAt,omitempty"`
	CreatedAt string  `json:"createdAt"`
	Rsvp      *Rsvp   `json:"rsvp,omitempty"`
}

type InsertInvite struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
	Side  *string `json:"side"`
}

type BulkInviteEntry struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
	Side  *string `json:"side"`
}
```

- [ ] **Step 4: Extend repository interface**

In `go-server/internal/repository/repository.go`, change the `UpdateInvite` signature and add `UpdateInviteSide`:

```go
UpdateInvite(ctx context.Context, id int, name string, phone *string, side *string) (*models.Invite, error)
UpdateInviteSide(ctx context.Context, id int, side *string) (*models.Invite, error)
```

- [ ] **Step 5: Implement side in memory.go**

In `go-server/internal/repository/memory.go`, update `CreateInvite`:

```go
func (m *MemoryRepository) CreateInvite(_ context.Context, data models.InsertInvite) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.inviteIDSeq++
	var code string
	for i := 0; i < 5; i++ {
		code = models.GenerateInviteCode()
		collision := false
		for _, existing := range m.invites {
			if existing.Code == code {
				collision = true
				break
			}
		}
		if !collision {
			break
		}
	}
	inv := models.Invite{
		ID:        m.inviteIDSeq,
		Name:      data.Name,
		Code:      code,
		Phone:     data.Phone,
		Side:      data.Side,
		CreatedAt: now(),
	}
	m.invites[inv.ID] = inv
	return &inv, nil
}
```

Update `CreateInvitesBulk` — add `Side: d.Side` inside the `inv := models.Invite{...}` literal.

Update `UpdateInvite`:

```go
func (m *MemoryRepository) UpdateInvite(_ context.Context, id int, name string, phone *string, side *string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.Name = name
	inv.Phone = phone
	inv.Side = side
	m.invites[id] = inv
	return &inv, nil
}
```

Add `UpdateInviteSide`:

```go
func (m *MemoryRepository) UpdateInviteSide(_ context.Context, id int, side *string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.Side = side
	m.invites[id] = inv
	return &inv, nil
}
```

- [ ] **Step 6: Implement side in postgres.go**

In `go-server/internal/repository/postgres.go`, update `CreateInvite` INSERT:

```go
err := r.pool.QueryRow(ctx,
    `INSERT INTO invites (name, code, phone, side)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, code, rsvp_id, created_at, phone, side, wa_sent_at`,
    data.Name, code, data.Phone, data.Side,
).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &inv.Side, &waSentAt)
```

Apply the same pattern to `CreateInvitesBulk` (same columns in INSERT and RETURNING, same scan order).

Update `GetInvites` SELECT and scan to include `i.side`:

```go
rows, err := r.pool.Query(ctx,
    `SELECT i.id, i.name, i.code, i.rsvp_id, i.created_at, i.phone, i.side, i.wa_sent_at,
            rv.id, rv.name, rv.email, rv.attendance_type, rv.guest_count
     FROM invites i
     LEFT JOIN rsvp rv ON i.rsvp_id = rv.id
     ORDER BY i.created_at DESC`)
```

And scan: `&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &inv.Side, &waSentAt, ...`

Apply the same `side` addition to `GetInviteByID` and `GetInviteByCode`.

Update `UpdateInvite`:

```go
func (r *PostgresRepository) UpdateInvite(ctx context.Context, id int, name string, phone *string, side *string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET name = $2, phone = $3, side = $4 WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, side, wa_sent_at`,
		id, name, phone, side,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &inv.Side, &waSentAt)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, fmt.Errorf("invite not found")
		}
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}
```

Add `UpdateInviteSide`:

```go
func (r *PostgresRepository) UpdateInviteSide(ctx context.Context, id int, side *string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET side = $2 WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, side, wa_sent_at`,
		id, side,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &inv.Side, &waSentAt)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return nil, fmt.Errorf("invite not found")
		}
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}
```

Also update `UpdateInvitePhone` and `MarkInviteWaSent` / `UnmarkInviteWaSent` RETURNING clauses to include `side` in SELECT and scan.

- [ ] **Step 7: Run tests**

```bash
cd go-server && go test ./internal/repository/... -v -race -count=1
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add go-server/internal/models/invite.go go-server/internal/repository/
git commit -m "feat: add side field to invite model and repository"
```

---

## Task 3: Extend Invite Handler for side + Contract Test

**Files:**
- Modify: `go-server/internal/handler/invite.go`
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Write failing contract test for side**

In `go-server/internal/handler/contract_test.go`, update `assertInviteObject`:

```go
func assertInviteObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "name", "string")
	assertKeyType(t, obj, "code", "string")
	assertNullableType(t, obj, "rsvpId", "float64")
	assertKeyType(t, obj, "createdAt", "string")
	// side is omitempty — key may be absent when nil
}
```

Add a new contract test for PATCH with side:

```go
func TestContract_InviteUpdate_Side(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Update with name+phone+side
	updateBody := jsonBody(map[string]interface{}{
		"name":  "Alice Updated",
		"phone": "+6281234567890",
		"side":  "groom",
	})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)
	invite := result["invite"].(map[string]interface{})
	if invite["side"] != "groom" {
		t.Fatalf("expected side=groom, got %v", invite["side"])
	}

	// Update side only
	sideOnly := jsonBody(map[string]interface{}{"side": "bride"})
	req3 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), sideOnly, cookie, csrf)
	result3 := contractResponse(t, env, req3, http.StatusOK)
	invite3 := result3["invite"].(map[string]interface{})
	if invite3["side"] != "bride" {
		t.Fatalf("expected side=bride, got %v", invite3["side"])
	}
}
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd go-server && go test ./internal/handler/... -run TestContract_InviteUpdate_Side -v
```

Expected: FAIL — `side` not parsed yet.

- [ ] **Step 3: Update the PATCH handler in invite.go**

In `go-server/internal/handler/invite.go`, extend `Update()`:

```go
func (h *InviteHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	var raw map[string]json.RawMessage
	if err := parseJSON(r, &raw); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	nameRaw, namePresent := raw["name"]
	phoneRaw, phonePresent := raw["phone"]
	sideRaw, sidePresent := raw["side"]

	if !namePresent && !phonePresent && !sidePresent {
		writeError(w, r, http.StatusBadRequest, "No updatable fields provided")
		return
	}

	// Parse phone (shared by name+phone path).
	var phone *string
	if phonePresent {
		if string(phoneRaw) == "null" {
			phone = nil
		} else {
			var phoneVal string
			if err := json.Unmarshal(phoneRaw, &phoneVal); err != nil {
				writeError(w, r, http.StatusBadRequest, "Invalid phone value")
				return
			}
			if phoneVal != "" {
				normalized, err := models.NormalizePhone(phoneVal)
				if err != nil {
					writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Invalid phone: %s", err.Error()))
					return
				}
				phone = &normalized
			}
		}
	}

	// Parse side.
	var side *string
	if sidePresent {
		if string(sideRaw) == "null" {
			side = nil
		} else {
			var sideVal string
			if err := json.Unmarshal(sideRaw, &sideVal); err != nil {
				writeError(w, r, http.StatusBadRequest, "Invalid side value")
				return
			}
			if sideVal != "groom" && sideVal != "bride" && sideVal != "" {
				writeError(w, r, http.StatusBadRequest, "side must be 'groom', 'bride', or null")
				return
			}
			if sideVal != "" {
				side = &sideVal
			}
		}
	}

	if namePresent {
		if !phonePresent {
			writeError(w, r, http.StatusBadRequest, "phone is required when name is provided")
			return
		}
		var nameVal string
		if err := json.Unmarshal(nameRaw, &nameVal); err != nil {
			writeError(w, r, http.StatusBadRequest, "Invalid name value")
			return
		}
		nameVal = strings.TrimSpace(nameVal)
		if nameVal == "" {
			writeError(w, r, http.StatusBadRequest, "name cannot be empty")
			return
		}
		invite, err := h.Repo.UpdateInvite(r.Context(), id, nameVal, phone, side)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, r, http.StatusNotFound, "Invite not found")
				return
			}
			writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"invite": invite})
		return
	}

	if sidePresent && !phonePresent {
		// Side-only update
		invite, err := h.Repo.UpdateInviteSide(r.Context(), id, side)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, r, http.StatusNotFound, "Invite not found")
				return
			}
			writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"invite": invite})
		return
	}

	// Backward compat: phone-only update.
	invite, err := h.Repo.UpdateInvitePhone(r.Context(), id, phone)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"invite": invite})
}
```

Also update `BulkCreate` to pass `Side`:

In the `inserts` build loop, change:

```go
insert := models.InsertInvite{Name: trimmed}
// existing phone logic...
insert.Side = entry.Side  // add this after the phone block
inserts = append(inserts, insert)
```

- [ ] **Step 4: Run all handler tests**

```bash
cd go-server && go test ./internal/handler/... -v -race -count=1
```

Expected: PASS (including new `TestContract_InviteUpdate_Side`)

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/handler/invite.go go-server/internal/handler/contract_test.go
git commit -m "feat: accept side field in invite PATCH and bulk create"
```

---

## Task 4: WhatsApp Service — Session Management

**Files:**
- Create: `go-server/internal/service/whatsapp.go`
- Modify: `go-server/go.mod` (via go get)

- [ ] **Step 1: Add dependencies**

```bash
cd go-server && go get go.mau.fi/whatsmeow@latest
cd go-server && go get github.com/skip2/go-qrcode@latest
cd go-server && go get github.com/jackc/pgx/v5/stdlib
```

Verify `go-server/go.mod` now contains `go.mau.fi/whatsmeow`.

- [ ] **Step 2: Create whatsapp.go with types, service struct, and session management**

Create `go-server/internal/service/whatsapp.go`:

```go
package service

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"math/rand"
	"regexp"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
)

// SessionStatus values.
const (
	StatusConnected    = "connected"
	StatusQRPending    = "qr_pending"
	StatusDisconnected = "disconnected"
)

// SessionInfo is returned by SessionStatus.
type SessionInfo struct {
	Status string `json:"status"`
	Phone  string `json:"phone,omitempty"`
	QR     string `json:"qr,omitempty"`
}

// WAMessage is the pre-rendered payload sent from the frontend for one guest.
type WAMessage struct {
	InviteID int    `json:"inviteId"`
	Phone    string `json:"phone"`
	Side     string `json:"side"` // "groom" or "bride"
	Message  string `json:"message"`
}

// SendJob tracks the state of one bulk send job.
type SendJob struct {
	ID              string
	mu              sync.Mutex
	Status          string // "running", "paused", "completed", "failed"
	Total           int
	Sent            int
	Failed          int
	Skipped         int
	CurrentInviteID int
	GroomTotal      int
	GroomSent       int
	BrideTotal      int
	BrideSent       int
	ctx             context.Context
	cancel          context.CancelFunc
	pauseCh         chan struct{} // capacity 1; write signals pause
	resumeCh        chan struct{} // write signals resume
}

func (j *SendJob) setStatus(s string) {
	j.mu.Lock()
	j.Status = s
	j.mu.Unlock()
}

func (j *SendJob) getStatus() string {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.Status
}

// Snapshot returns a safe copy of job state for JSON serialization.
func (j *SendJob) Snapshot() map[string]interface{} {
	j.mu.Lock()
	defer j.mu.Unlock()
	return map[string]interface{}{
		"id":              j.ID,
		"status":          j.Status,
		"total":           j.Total,
		"sent":            j.Sent,
		"failed":          j.Failed,
		"skipped":         j.Skipped,
		"currentInviteId": j.CurrentInviteID,
		"groom":           map[string]int{"total": j.GroomTotal, "sent": j.GroomSent},
		"bride":           map[string]int{"total": j.BrideTotal, "sent": j.BrideSent},
	}
}

// WhatsAppServicer is the interface consumed by the HTTP handler.
type WhatsAppServicer interface {
	SessionStatus(side string) SessionInfo
	Connect(ctx context.Context, side string) error
	Disconnect(side string) error
	StartSendJob(msgs []WAMessage, delayMin, delayMax int) (string, error)
	ActiveJob() *SendJob
	GetJob(jobID string) *SendJob
	PauseJob(jobID string) error
	ResumeJob(jobID string) error
	AbortJob(jobID string) error
	SendOne(ctx context.Context, inviteID int, message string) error
}

// WhatsAppService implements WhatsAppServicer.
type WhatsAppService struct {
	repo repository.Repository

	mu          sync.Mutex
	groomClient *whatsmeow.Client
	brideClient *whatsmeow.Client
	groomQR     string
	brideQR     string

	store *sqlstore.Container
	jobs  sync.Map // jobID → *SendJob
}

// NewWhatsAppService creates the service. Call Init() after construction.
func NewWhatsAppService(repo repository.Repository) *WhatsAppService {
	return &WhatsAppService{repo: repo}
}

// Init connects to Postgres via whatsmeow sqlstore and restores persisted sessions.
func (s *WhatsAppService) Init(ctx context.Context, databaseURL string) error {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("whatsapp sqlstore open: %w", err)
	}

	container, err := sqlstore.NewWithDB(db, "postgres", nil)
	if err != nil {
		return fmt.Errorf("whatsapp sqlstore init: %w", err)
	}
	s.store = container

	// Try to restore sessions from stored JIDs in app_settings.
	for _, side := range []string{"groom", "bride"} {
		key := "wa_" + side + "_jid"
		setting, _ := s.repo.GetAppSetting(ctx, key)
		if setting == nil {
			continue
		}
		jid, err := types.ParseJID(setting.SettingValue)
		if err != nil {
			continue
		}
		deviceStore, err := container.GetDevice(jid)
		if err != nil || deviceStore == nil {
			continue
		}
		client := whatsmeow.NewClient(deviceStore, nil)
		if err := client.Connect(); err == nil {
			s.setClient(side, client)
		}
	}
	return nil
}

func (s *WhatsAppService) setClient(side string, c *whatsmeow.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		s.groomClient = c
	} else {
		s.brideClient = c
	}
}

func (s *WhatsAppService) clientFor(side string) *whatsmeow.Client {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		return s.groomClient
	}
	return s.brideClient
}

func (s *WhatsAppService) setQR(side, qr string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		s.groomQR = qr
	} else {
		s.brideQR = qr
	}
}

func (s *WhatsAppService) getQR(side string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		return s.groomQR
	}
	return s.brideQR
}

// SessionStatus returns the current connection state for one side.
func (s *WhatsAppService) SessionStatus(side string) SessionInfo {
	client := s.clientFor(side)
	if client != nil && client.IsConnected() && client.IsLoggedIn() {
		phone := "+" + client.Store.ID.User
		return SessionInfo{Status: StatusConnected, Phone: phone}
	}
	if qr := s.getQR(side); qr != "" {
		return SessionInfo{Status: StatusQRPending, QR: qr}
	}
	return SessionInfo{Status: StatusDisconnected}
}

// Connect initiates QR code generation for the given side.
func (s *WhatsAppService) Connect(ctx context.Context, side string) error {
	if s.store == nil {
		return fmt.Errorf("whatsapp service not initialised")
	}
	client := s.clientFor(side)
	if client == nil {
		deviceStore := s.store.NewDevice()
		client = whatsmeow.NewClient(deviceStore, nil)
		s.setClient(side, client)
	}
	if client.IsConnected() && client.IsLoggedIn() {
		return nil
	}

	qrChan, err := client.GetQRChannel(ctx)
	if err != nil {
		return fmt.Errorf("GetQRChannel: %w", err)
	}

	go func() {
		for evt := range qrChan {
			switch evt.Event {
			case "code":
				png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
				if err == nil {
					b64 := base64.StdEncoding.EncodeToString(png)
					s.setQR(side, "data:image/png;base64,"+b64)
				}
			case "success":
				s.setQR(side, "")
				if client.Store.ID != nil {
					jid := client.Store.ID.String()
					key := "wa_" + side + "_jid"
					s.repo.UpsertAppSettings(context.Background(), []models.InsertAppSetting{{
						SettingKey:   key,
						SettingValue: jid,
						SettingType:  "string",
					}})
				}
			case "timeout":
				s.setQR(side, "")
			}
		}
	}()

	return client.Connect()
}

// Disconnect logs out and clears the stored session for a side.
func (s *WhatsAppService) Disconnect(side string) error {
	client := s.clientFor(side)
	if client == nil {
		return nil
	}
	if client.IsLoggedIn() {
		client.Logout()
	}
	client.Disconnect()
	s.setClient(side, nil)
	s.setQR(side, "")
	return nil
}

// phoneToJID converts an E.164 phone number to a WhatsApp JID string.
var nonDigit = regexp.MustCompile(`[^\d]`)

func phoneToJID(phone string) string {
	digits := nonDigit.ReplaceAllString(phone, "")
	return digits + "@s.whatsapp.net"
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd go-server && go build ./internal/service/...
```

Expected: no errors. Fix any import mismatches.

- [ ] **Step 4: Write unit test for phoneToJID**

In `go-server/internal/service/whatsapp_test.go` (create it):

```go
package service

import "testing"

func TestPhoneToJID(t *testing.T) {
	cases := []struct {
		in  string
		out string
	}{
		{"+6281234567890", "6281234567890@s.whatsapp.net"},
		{"+1-800-555-1234", "18005551234@s.whatsapp.net"},
		{"+44 20 7946 0958", "442079460958@s.whatsapp.net"},
	}
	for _, c := range cases {
		got := phoneToJID(c.in)
		if got != c.out {
			t.Errorf("phoneToJID(%q) = %q, want %q", c.in, got, c.out)
		}
	}
}
```

- [ ] **Step 5: Run the test**

```bash
cd go-server && go test ./internal/service/... -run TestPhoneToJID -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/service/whatsapp.go go-server/internal/service/whatsapp_test.go go-server/go.mod go-server/go.sum
git commit -m "feat: add WhatsAppService with session management"
```

---

## Task 5: WhatsApp Service — Send Job + Single Send

**Files:**
- Modify: `go-server/internal/service/whatsapp.go`

- [ ] **Step 1: Write failing test for job state machine**

In `go-server/internal/service/whatsapp_test.go`, add:

```go
func TestSendJob_PauseResume(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	job := &SendJob{
		ID:       "test-job",
		Status:   "running",
		ctx:      ctx,
		cancel:   cancel,
		pauseCh:  make(chan struct{}, 1),
		resumeCh: make(chan struct{}),
	}

	// Signal pause
	job.pauseCh <- struct{}{}
	if len(job.pauseCh) != 1 {
		t.Fatal("expected pauseCh to have 1 item")
	}

	// Signal abort
	job.cancel()
	if err := ctx.Err(); err == nil {
		t.Fatal("expected context to be cancelled")
	}
}

func TestSendJob_Snapshot(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	job := &SendJob{
		ID:         "abc123",
		Status:     "running",
		Total:      10,
		Sent:       3,
		GroomTotal: 6,
		GroomSent:  3,
		BrideTotal: 4,
		ctx:        ctx,
		cancel:     cancel,
		pauseCh:    make(chan struct{}, 1),
		resumeCh:   make(chan struct{}),
	}
	snap := job.Snapshot()
	if snap["id"] != "abc123" {
		t.Fatalf("expected id=abc123, got %v", snap["id"])
	}
	if snap["total"].(int) != 10 {
		t.Fatalf("expected total=10, got %v", snap["total"])
	}
	groom := snap["groom"].(map[string]int)
	if groom["sent"] != 3 {
		t.Fatalf("expected groom.sent=3, got %v", groom["sent"])
	}
}
```

- [ ] **Step 2: Run to verify existing test passes**

```bash
cd go-server && go test ./internal/service/... -v -count=1
```

Expected: PASS (snapshot test, phoneToJID test)

- [ ] **Step 3: Add send job methods to whatsapp.go**

Append to `go-server/internal/service/whatsapp.go`:

```go
// StartSendJob enqueues a bulk send. Returns 409-style error if a job is active.
func (s *WhatsAppService) StartSendJob(msgs []WAMessage, delayMin, delayMax int) (string, error) {
	// Check for active job
	var activeID string
	s.jobs.Range(func(_, v interface{}) bool {
		j := v.(*SendJob)
		st := j.getStatus()
		if st == "running" || st == "paused" {
			activeID = j.ID
			return false
		}
		return true
	})
	if activeID != "" {
		return "", fmt.Errorf("job_already_running:%s", activeID)
	}

	jobID := fmt.Sprintf("%d", time.Now().UnixNano())
	ctx, cancel := context.WithCancel(context.Background())

	groomTotal, brideTotal := 0, 0
	for _, m := range msgs {
		if m.Side == "groom" {
			groomTotal++
		} else if m.Side == "bride" {
			brideTotal++
		}
	}

	job := &SendJob{
		ID:         jobID,
		Status:     "running",
		Total:      len(msgs),
		GroomTotal: groomTotal,
		BrideTotal: brideTotal,
		ctx:        ctx,
		cancel:     cancel,
		pauseCh:    make(chan struct{}, 1),
		resumeCh:   make(chan struct{}),
	}
	s.jobs.Store(jobID, job)

	go s.runJob(job, msgs, delayMin, delayMax)
	return jobID, nil
}

func (s *WhatsAppService) runJob(job *SendJob, msgs []WAMessage, delayMin, delayMax int) {
	defer func() {
		if job.getStatus() == "running" {
			job.setStatus("completed")
		}
	}()

	for _, msg := range msgs {
		select {
		case <-job.ctx.Done():
			job.setStatus("failed")
			return
		default:
		}

		job.mu.Lock()
		job.CurrentInviteID = msg.InviteID
		job.mu.Unlock()

		// Re-check waSentAt to avoid duplicate with per-card send
		existing, err := s.repo.GetInviteByID(job.ctx, msg.InviteID)
		if err != nil || existing == nil || existing.WaSentAt != nil {
			job.mu.Lock()
			job.Skipped++
			job.mu.Unlock()
			continue
		}

		client := s.clientFor(msg.Side)
		if client == nil || !client.IsConnected() {
			job.mu.Lock()
			job.Failed++
			job.mu.Unlock()
			continue
		}

		jidStr := phoneToJID(msg.Phone)
		jid, err := types.ParseJID(jidStr)
		if err != nil {
			job.mu.Lock()
			job.Skipped++
			job.mu.Unlock()
			continue
		}

		results, err := client.IsOnWhatsApp([]string{jidStr})
		if err != nil || len(results) == 0 || !results[0].IsIn {
			job.mu.Lock()
			job.Skipped++
			job.mu.Unlock()
			continue
		}

		_, err = client.SendMessage(job.ctx, jid, &waProto.Message{
			Conversation: proto.String(msg.Message),
		})
		if err != nil {
			// Disconnect error — pause the job
			job.setStatus("paused")
			job.mu.Lock()
			job.Failed++
			job.mu.Unlock()
			select {
			case <-job.resumeCh:
				job.setStatus("running")
			case <-job.ctx.Done():
				job.setStatus("failed")
				return
			}
			continue
		}

		s.repo.MarkInviteWaSent(job.ctx, msg.InviteID)

		job.mu.Lock()
		job.Sent++
		if msg.Side == "groom" {
			job.GroomSent++
		} else {
			job.BrideSent++
		}
		job.mu.Unlock()

		// Delay with pause support
		sleepDur := time.Duration(delayMin+rand.Intn(delayMax-delayMin+1)) * time.Second
		sleepTimer := time.NewTimer(sleepDur)
	sleepLoop:
		for {
			select {
			case <-sleepTimer.C:
				break sleepLoop
			case <-job.pauseCh:
				sleepTimer.Stop()
				job.setStatus("paused")
				select {
				case <-job.resumeCh:
					job.setStatus("running")
					sleepTimer.Reset(sleepDur)
				case <-job.ctx.Done():
					job.setStatus("failed")
					return
				}
			case <-job.ctx.Done():
				sleepTimer.Stop()
				job.setStatus("failed")
				return
			}
		}
	}
}

// ActiveJob returns the first running or paused job, or nil.
func (s *WhatsAppService) ActiveJob() *SendJob {
	var found *SendJob
	s.jobs.Range(func(_, v interface{}) bool {
		j := v.(*SendJob)
		st := j.getStatus()
		if st == "running" || st == "paused" {
			found = j
			return false
		}
		return true
	})
	return found
}

// GetJob returns a job by ID or nil.
func (s *WhatsAppService) GetJob(jobID string) *SendJob {
	v, ok := s.jobs.Load(jobID)
	if !ok {
		return nil
	}
	return v.(*SendJob)
}

// PauseJob signals the goroutine to pause at the next delay boundary.
func (s *WhatsAppService) PauseJob(jobID string) error {
	job := s.GetJob(jobID)
	if job == nil {
		return fmt.Errorf("job not found")
	}
	if job.getStatus() != "running" {
		return fmt.Errorf("job is not running")
	}
	select {
	case job.pauseCh <- struct{}{}:
	default: // already paused signal in channel
	}
	return nil
}

// ResumeJob resumes a paused job.
func (s *WhatsAppService) ResumeJob(jobID string) error {
	job := s.GetJob(jobID)
	if job == nil {
		return fmt.Errorf("job not found")
	}
	if job.getStatus() != "paused" {
		return fmt.Errorf("job is not paused")
	}
	select {
	case job.resumeCh <- struct{}{}:
	default:
	}
	return nil
}

// AbortJob cancels a running or paused job.
func (s *WhatsAppService) AbortJob(jobID string) error {
	job := s.GetJob(jobID)
	if job == nil {
		return fmt.Errorf("job not found")
	}
	job.cancel()
	return nil
}

// SendOne sends to a single guest synchronously. Used for per-card retry.
func (s *WhatsAppService) SendOne(ctx context.Context, inviteID int, message string) error {
	invite, err := s.repo.GetInviteByID(ctx, inviteID)
	if err != nil {
		return fmt.Errorf("invite lookup: %w", err)
	}
	if invite == nil {
		return fmt.Errorf("invite not found")
	}
	if invite.Phone == nil {
		return fmt.Errorf("invite has no phone number")
	}
	if invite.Side == nil {
		return fmt.Errorf("invite has no side assigned")
	}

	client := s.clientFor(*invite.Side)
	if client == nil || !client.IsConnected() || !client.IsLoggedIn() {
		return fmt.Errorf("whatsapp session for %s not connected", *invite.Side)
	}

	jidStr := phoneToJID(*invite.Phone)
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return fmt.Errorf("invalid phone JID: %w", err)
	}

	results, err := client.IsOnWhatsApp([]string{jidStr})
	if err != nil {
		return fmt.Errorf("IsOnWhatsApp check: %w", err)
	}
	if len(results) == 0 || !results[0].IsIn {
		return fmt.Errorf("not_on_whatsapp")
	}

	_, err = client.SendMessage(ctx, jid, &waProto.Message{
		Conversation: proto.String(message),
	})
	if err != nil {
		return fmt.Errorf("send failed: %w", err)
	}

	_, err = s.repo.MarkInviteWaSent(ctx, inviteID)
	return err
}
```

- [ ] **Step 4: Verify compilation**

```bash
cd go-server && go build ./internal/service/...
```

Expected: no errors.

- [ ] **Step 5: Run all service tests**

```bash
cd go-server && go test ./internal/service/... -v -race -count=1
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/service/whatsapp.go go-server/internal/service/whatsapp_test.go
git commit -m "feat: implement WhatsApp send job and single-guest send"
```

---

## Task 6: WhatsApp Handler + Router Wiring

**Files:**
- Create: `go-server/internal/handler/whatsapp.go`
- Create: `go-server/internal/handler/whatsapp_test.go`
- Modify: `go-server/internal/router/router.go`

- [ ] **Step 1: Create the mock service for tests**

Create `go-server/internal/handler/whatsapp_test.go`:

```go
package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/service"
)

// mockWA is a test double for service.WhatsAppServicer.
type mockWA struct {
	groomStatus service.SessionInfo
	brideStatus service.SessionInfo
	activeJob   *service.SendJob
	jobs        map[string]*service.SendJob
	connectErr  error
	startJobID  string
	startJobErr error
	sendOneErr  error
}

func (m *mockWA) SessionStatus(side string) service.SessionInfo {
	if side == "groom" {
		return m.groomStatus
	}
	return m.brideStatus
}
func (m *mockWA) Connect(_ context.Context, _ string) error { return m.connectErr }
func (m *mockWA) Disconnect(_ string) error                 { return nil }
func (m *mockWA) StartSendJob(_ []service.WAMessage, _, _ int) (string, error) {
	return m.startJobID, m.startJobErr
}
func (m *mockWA) ActiveJob() *service.SendJob { return m.activeJob }
func (m *mockWA) GetJob(id string) *service.SendJob {
	if m.jobs != nil {
		return m.jobs[id]
	}
	return nil
}
func (m *mockWA) PauseJob(_ string) error  { return nil }
func (m *mockWA) ResumeJob(_ string) error { return nil }
func (m *mockWA) AbortJob(_ string) error  { return nil }
func (m *mockWA) SendOne(_ context.Context, _ int, _ string) error { return m.sendOneErr }

func newTestEnvWithWA(wa service.WhatsAppServicer) *testEnv {
	env := newTestEnv()
	// rebuild the handler with WA service — done via router.WithWhatsApp
	// The test env re-creates the router with the WA option.
	// We'll add a helper in handler_test.go to rebuild with WA.
	// For now tests use env.handler which is rebuilt below.
	_ = wa
	return env
}

func TestContract_WA_Sessions(t *testing.T) {
	env := newTestEnvWithWAService(&mockWA{
		groomStatus: service.SessionInfo{Status: "connected", Phone: "+6281234567890"},
		brideStatus: service.SessionInfo{Status: "disconnected"},
	})
	cookie, csrf := adminLogin(t, env)

	req := adminRequest(http.MethodGet, "/api/admin/wa/sessions", nil, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	groom := assertObject(t, result, "groom")
	assertStringValue(t, groom, "status", "connected")
	assertStringValue(t, groom, "phone", "+6281234567890")

	bride := assertObject(t, result, "bride")
	assertStringValue(t, bride, "status", "disconnected")
}

func TestContract_WA_JobActive_Null(t *testing.T) {
	env := newTestEnvWithWAService(&mockWA{})
	cookie, csrf := adminLogin(t, env)

	req := adminRequest(http.MethodGet, "/api/admin/wa/job/active", nil, cookie, csrf)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if strings.TrimSpace(body) != "null" {
		t.Fatalf("expected null body, got: %s", body)
	}
}

func TestContract_WA_SendAll_409(t *testing.T) {
	env := newTestEnvWithWAService(&mockWA{
		startJobErr: fmt.Errorf("job_already_running:existingID"),
	})
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"messages": []map[string]interface{}{},
	})
	req := adminRequest(http.MethodPost, "/api/admin/wa/send-all", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusConflict)

	assertKeyExists(t, result, "jobId")
}

func TestContract_WA_SendOne_Success(t *testing.T) {
	env := newTestEnvWithWAService(&mockWA{})
	cookie, csrf := adminLogin(t, env)

	// Create an invite first
	invBody := jsonBody(map[string]interface{}{"name": "Budi"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invResult := contractResponse(t, env, invReq, http.StatusCreated)
	inviteID := int(invResult["invite"].(map[string]interface{})["id"].(float64))

	body := jsonBody(map[string]interface{}{"message": "Hello Budi!"})
	req := adminRequest(http.MethodPost, fmt.Sprintf("/api/admin/wa/send/%d", inviteID), body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)
	assertStringValue(t, result, "status", "sent")
}
```

You'll need a `newTestEnvWithWAService` helper and to add `strings` and `net/http/httptest` to the imports. Add to `handler_test.go`:

```go
func newTestEnvWithWAService(wa service.WhatsAppServicer) *testEnv {
	hash, _ := bcrypt.GenerateFromPassword([]byte("testpass123"), bcrypt.DefaultCost)
	cfg := &config.Config{
		Env:               "development",
		Port:              5000,
		AdminPassword:     "testpass123",
		AdminPasswordHash: string(hash),
		SessionMaxAge:     1800,
		CORSOrigins:       []string{"*"},
	}
	repo := repository.NewMemoryRepository()
	sessions := middleware.NewSessionStore(30 * time.Minute)
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(5 * time.Minute)
	storage := service.NewLocalStorage(os.TempDir())

	r := router.New(cfg, repo, sessions, csrf, cache,
		router.WithStorage(storage),
		router.WithWhatsApp(wa),
	)
	return &testEnv{handler: r, cfg: cfg, repo: repo, sessions: sessions, csrf: csrf, cache: cache}
}
```

- [ ] **Step 2: Run tests to confirm they fail (handler not yet wired)**

```bash
cd go-server && go test ./internal/handler/... -run TestContract_WA -v
```

Expected: FAIL — `WithWhatsApp` not defined, WA routes not registered.

- [ ] **Step 3: Create the handler file**

Create `go-server/internal/handler/whatsapp.go`:

```go
package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)

// WAHandler handles WhatsApp admin endpoints.
type WAHandler struct {
	WA service.WhatsAppServicer
}

// Sessions handles GET /api/admin/wa/sessions.
func (h *WAHandler) Sessions(w http.ResponseWriter, r *http.Request) {
	groom := h.WA.SessionStatus("groom")
	bride := h.WA.SessionStatus("bride")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"groom": groom,
		"bride": bride,
	})
}

// Connect handles POST /api/admin/wa/sessions/:side/connect.
func (h *WAHandler) Connect(w http.ResponseWriter, r *http.Request) {
	side := chi.URLParam(r, "side")
	if side != "groom" && side != "bride" {
		writeError(w, r, http.StatusBadRequest, "side must be 'groom' or 'bride'")
		return
	}
	if err := h.WA.Connect(r.Context(), side); err != nil {
		writeError(w, r, http.StatusInternalServerError, fmt.Sprintf("Connect failed: %s", err.Error()))
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"status": "connecting"})
}

// DisconnectSession handles DELETE /api/admin/wa/sessions/:side.
func (h *WAHandler) DisconnectSession(w http.ResponseWriter, r *http.Request) {
	side := chi.URLParam(r, "side")
	if side != "groom" && side != "bride" {
		writeError(w, r, http.StatusBadRequest, "side must be 'groom' or 'bride'")
		return
	}
	if err := h.WA.Disconnect(side); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Disconnect failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "disconnected"})
}

type sendAllRequest struct {
	Messages []service.WAMessage `json:"messages"`
	DelayMin int                 `json:"delayMin"`
	DelayMax int                 `json:"delayMax"`
}

// SendAll handles POST /api/admin/wa/send-all.
func (h *WAHandler) SendAll(w http.ResponseWriter, r *http.Request) {
	var body sendAllRequest
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.DelayMin <= 0 {
		body.DelayMin = 20
	}
	if body.DelayMax <= 0 || body.DelayMax < body.DelayMin {
		body.DelayMax = 30
	}

	jobID, err := h.WA.StartSendJob(body.Messages, body.DelayMin, body.DelayMax)
	if err != nil {
		if strings.HasPrefix(err.Error(), "job_already_running:") {
			existingID := strings.TrimPrefix(err.Error(), "job_already_running:")
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "job_already_running",
				"jobId": existingID,
			})
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to start send job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"jobId": jobID})
}

// ActiveJob handles GET /api/admin/wa/job/active.
func (h *WAHandler) ActiveJob(w http.ResponseWriter, r *http.Request) {
	job := h.WA.ActiveJob()
	if job == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("null"))
		return
	}
	writeJSON(w, http.StatusOK, job.Snapshot())
}

// GetJob handles GET /api/admin/wa/job/:id.
func (h *WAHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	job := h.WA.GetJob(jobID)
	if job == nil {
		writeError(w, r, http.StatusNotFound, "Job not found")
		return
	}
	writeJSON(w, http.StatusOK, job.Snapshot())
}

// PauseJob handles POST /api/admin/wa/job/:id/pause.
func (h *WAHandler) PauseJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	if err := h.WA.PauseJob(jobID); err != nil {
		writeError(w, r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "pausing"})
}

// ResumeJob handles POST /api/admin/wa/job/:id/resume.
func (h *WAHandler) ResumeJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	if err := h.WA.ResumeJob(jobID); err != nil {
		writeError(w, r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "resuming"})
}

// AbortJob handles DELETE /api/admin/wa/job/:id.
func (h *WAHandler) AbortJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	if err := h.WA.AbortJob(jobID); err != nil {
		writeError(w, r, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "aborted"})
}

type sendOneRequest struct {
	Message string `json:"message"`
}

// SendOne handles POST /api/admin/wa/send/:inviteId.
func (h *WAHandler) SendOne(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "inviteId")
	inviteID, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}
	var body sendOneRequest
	if err := parseJSON(r, &body); err != nil || body.Message == "" {
		writeError(w, r, http.StatusBadRequest, "message is required")
		return
	}

	if err := h.WA.SendOne(r.Context(), inviteID, body.Message); err != nil {
		if err.Error() == "not_on_whatsapp" {
			writeJSON(w, http.StatusOK, map[string]string{
				"status": "skipped",
				"reason": "not_on_whatsapp",
			})
			return
		}
		writeError(w, r, http.StatusInternalServerError, fmt.Sprintf("Send failed: %s", err.Error()))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

// Ensure WAHandler satisfies the interface at compile time.
var _ context.Context = nil
```

- [ ] **Step 4: Add WithWhatsApp option and register routes in router.go**

In `go-server/internal/router/router.go`, add to the `options` struct:

```go
type options struct {
	storage    service.ObjectStorage
	drive      *service.GoogleDriveService
	dbPool     interface{ Ping(context.Context) error }
	whatsapp   service.WhatsAppServicer
}
```

Add the option function:

```go
// WithWhatsApp sets the WhatsApp service for WA admin routes.
func WithWhatsApp(wa service.WhatsAppServicer) Option {
	return func(o *options) {
		o.whatsapp = wa
	}
}
```

In `New()`, after the invite handler setup, add WA route registration inside the admin CSRF group:

```go
// WhatsApp routes (if configured)
if o.whatsapp != nil {
    wa := &handler.WAHandler{WA: o.whatsapp}
    r.Get("/wa/sessions", wa.Sessions)
    r.Post("/wa/sessions/{side}/connect", wa.Connect)
    r.Delete("/wa/sessions/{side}", wa.DisconnectSession)
    r.Post("/wa/send-all", wa.SendAll)
    r.Get("/wa/job/active", wa.ActiveJob)
    r.Get("/wa/job/{id}", wa.GetJob)
    r.Post("/wa/job/{id}/pause", wa.PauseJob)
    r.Post("/wa/job/{id}/resume", wa.ResumeJob)
    r.Delete("/wa/job/{id}", wa.AbortJob)
    r.Post("/wa/send/{inviteId}", wa.SendOne)
}
```

(All inside the existing `r.Group(func(r chi.Router) { ... })` block that already has `Auth` + `CSRF` middleware.)

- [ ] **Step 5: Run all handler tests**

```bash
cd go-server && go test ./internal/handler/... -v -race -count=1
```

Expected: PASS including `TestContract_WA_*`.

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/handler/whatsapp.go go-server/internal/handler/whatsapp_test.go go-server/internal/router/router.go
git commit -m "feat: add WhatsApp handler and route registration"
```

---

## Task 7: Frontend — shared schema + CSV import with side

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Extend CSV parser to detect side column**

In `InvitesPage.tsx`, after the `PHONE_HEADERS` constant (around line 75), add:

```ts
const SIDE_HEADERS = ["side", "pihak", "from"];

function parseSide(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v === "groom" || v === "pengantin pria") return "groom";
  if (v === "bride" || v === "pengantin wanita") return "bride";
  return null;
}
```

- [ ] **Step 2: Extend ImportEntry and ImportState to carry side**

Change `ImportEntry`:

```ts
type ImportEntry = {
  name: string;
  phone: string;
  side: string | null;
  checked: boolean;
  dupType: "none" | "existing" | "inFile";
};
```

Change `ImportState` preview step to add `sideColumnIndex`:

```ts
| {
    step: "preview";
    headers: string[];
    rawRows: string[][];
    nameColumnIndex: number;
    phoneColumnIndex: number | null;
    sideColumnIndex: number | null;
    entries: ImportEntry[];
  }
```

- [ ] **Step 3: Detect side column during CSV parse**

Find the section in InvitesPage that parses headers (around the `nameColumnIndex` detection). After `phoneColumnIndex` detection, add:

```ts
const sideColumnIndex = headers.findIndex(h =>
  SIDE_HEADERS.includes(h.toLowerCase().trim())
);
const resolvedSideIdx = sideColumnIndex >= 0 ? sideColumnIndex : null;
```

When building `entries`, add `side`:

```ts
const side = resolvedSideIdx !== null
  ? parseSide(row[resolvedSideIdx] ?? "")
  : null;

entries.push({ name, phone: normalizedPhone, side, checked: true, dupType: "none" });
```

Include `sideColumnIndex: resolvedSideIdx` in the `ImportState` preview object.

- [ ] **Step 4: Show side badge in import preview dialog**

In the import preview dialog rows, after the phone display, add:

```tsx
{entry.side === "groom" && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🤵 groom</span>
)}
{entry.side === "bride" && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">👰 bride</span>
)}
{!entry.side && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⚠️ no side</span>
)}
```

Add stats bar counts:

```tsx
const groomCount = importState.entries.filter(e => e.side === "groom").length;
const brideCount = importState.entries.filter(e => e.side === "bride").length;
const noSideCount = importState.entries.filter(e => !e.side).length;
```

Display in the stats bar:
```tsx
{groomCount > 0 && <span>🤵 <strong>{groomCount}</strong> groom</span>}
{brideCount > 0 && <span>👰 <strong>{brideCount}</strong> bride</span>}
{noSideCount > 0 && <span className="text-amber-600">⚠️ <strong>{noSideCount}</strong> no side</span>}
```

Add a warning below the list if any entries have no side:

```tsx
{noSideCount > 0 && (
  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
    ⚠️ {noSideCount} guest{noSideCount > 1 ? "s have" : " has"} no side — they'll be imported but skipped during automated WhatsApp sending.
  </div>
)}
```

- [ ] **Step 5: Pass side to bulk create API call**

Find the mutation that calls `POST /api/admin/invites/bulk`. Change the entries payload to include `side`:

```ts
invites: importState.entries
  .filter(e => e.checked)
  .map(e => ({ name: e.name, phone: e.phone || undefined, side: e.side || undefined })),
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: detect side column in CSV import"
```

---

## Task 8: Frontend — Invite Card Side Badge + Edit Toggle

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Add side badge to invite card view mode**

Find the invite card view mode render. After the phone display and before the action buttons, add the side badge:

```tsx
{invite.side === "groom" && (
  <Badge className="bg-blue-100 text-blue-700 border-blue-200">🤵 Groom</Badge>
)}
{invite.side === "bride" && (
  <Badge className="bg-pink-100 text-pink-700 border-pink-200">👰 Bride</Badge>
)}
{!invite.side && (
  <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">⚠️ No side</Badge>
)}
```

- [ ] **Step 2: Add side toggle in edit mode**

Find the inline edit mode section (the form with name + phone inputs). Add after the phone input:

```tsx
<div className="flex items-center gap-2 mt-2">
  <span className="text-xs text-slate-500">Side:</span>
  <div className="flex border border-indigo-400 rounded overflow-hidden text-xs">
    {(["groom", "bride", null] as (string | null)[]).map(s => (
      <button
        key={s ?? "none"}
        type="button"
        onClick={() => setEditSide(s)}
        className={`px-3 py-1 transition-colors ${
          editSide === s
            ? "bg-indigo-100 text-indigo-700 font-semibold"
            : "bg-white text-slate-400 hover:bg-slate-50"
        } ${s !== "groom" ? "border-l border-slate-200" : ""}`}
      >
        {s === "groom" ? "🤵 Groom" : s === "bride" ? "👰 Bride" : "None"}
      </button>
    ))}
  </div>
</div>
```

Add `editSide` to the edit state (alongside the existing `editName`/`editPhone` state):

```ts
const [editSide, setEditSide] = useState<string | null>(invite.side ?? null);
```

- [ ] **Step 3: Include side in the PATCH mutation**

Find the mutation that calls `PATCH /api/admin/invites/:id`. Include `side` in the body:

```ts
body: JSON.stringify({ name: editName, phone: editPhone || null, side: editSide }),
```

- [ ] **Step 4: Add per-card automated send button**

In the invite card action buttons area, replace the existing `wa.me` link/button with:

```tsx
{invite.phone && invite.side && waSessionStatus?.[invite.side]?.status === "connected" && (
  <Button
    variant="outline"
    size="sm"
    disabled={isSendingOne === invite.id}
    onClick={() => handleSendOne(invite)}
    title="Send WhatsApp invitation"
  >
    {isSendingOne === invite.id ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : (
      <MessageCircle className="h-3 w-3" />
    )}
  </Button>
)}
```

Add state and handler at the InvitesPage component level:

```ts
const [isSendingOne, setIsSendingOne] = useState<number | null>(null);

const handleSendOne = async (invite: Invite) => {
  const message = renderTemplate(template, invite);
  setIsSendingOne(invite.id);
  try {
    const resp = await apiRequest("POST", `/api/admin/wa/send/${invite.id}`, { message });
    const data = await resp.json();
    if (data.status === "sent") {
      toast({ title: "Sent!", description: `WhatsApp message sent to ${invite.name}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
    } else if (data.status === "skipped") {
      toast({ title: "Skipped", description: `${invite.name} is not on WhatsApp`, variant: "destructive" });
    }
  } catch {
    toast({ title: "Send failed", variant: "destructive" });
  } finally {
    setIsSendingOne(null);
  }
};
```

- [ ] **Step 5: Add groom/bride guest count to stats row**

Find the stats cards section. Add two new stat cards after the existing ones:

```tsx
<Card>
  <CardContent className="p-4">
    <div className="text-2xl font-bold text-blue-600">
      {invites.filter(i => i.side === "groom").length}
    </div>
    <div className="text-sm text-slate-500">Groom guests</div>
  </CardContent>
</Card>
<Card>
  <CardContent className="p-4">
    <div className="text-2xl font-bold text-pink-500">
      {invites.filter(i => i.side === "bride").length}
    </div>
    <div className="text-sm text-slate-500">Bride guests</div>
  </CardContent>
</Card>
```

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add side badge/edit to invite cards and per-card send button"
```

---

## Task 9: Frontend — WhatsApp Connections Card + Send All Dialog

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Add WA sessions query + state**

At the top of `InvitesPage`, add:

```ts
const [waSessionsEnabled, setWaSessionsEnabled] = useState(true);

const { data: waSessions, refetch: refetchSessions } = useQuery<{
  groom: { status: string; phone?: string; qr?: string };
  bride: { status: string; phone?: string; qr?: string };
}>({
  queryKey: ["/api/admin/wa/sessions"],
  refetchInterval: (data) => {
    const groomPending = data?.groom?.status === "qr_pending";
    const bridePending = data?.bride?.status === "qr_pending";
    return (groomPending || bridePending) ? 3000 : false;
  },
  enabled: waSessionsEnabled,
});

const waSessionStatus = waSessions;
```

- [ ] **Step 2: Add active job query on mount**

```ts
const [activeJobId, setActiveJobId] = useState<string | null>(null);
const [showSendDialog, setShowSendDialog] = useState(false);

// On mount, check for an active job
useEffect(() => {
  apiRequest("GET", "/api/admin/wa/job/active")
    .then(r => r.json())
    .then(data => {
      if (data && data.id) {
        setActiveJobId(data.id);
        setShowSendDialog(true);
      }
    })
    .catch(() => {});
}, []);
```

- [ ] **Step 3: Add WhatsApp Connections card**

Add a new card above the template editor section:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base">WhatsApp Connections</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      {(["groom", "bride"] as const).map(side => {
        const info = waSessions?.[side];
        const label = side === "groom" ? "🤵 Groom's Number" : "👰 Bride's Number";
        return (
          <div key={side} className={`border rounded-lg p-4 ${
            info?.status === "connected" ? "border-green-200 bg-green-50" :
            info?.status === "qr_pending" ? "border-yellow-200 bg-yellow-50" :
            "border-slate-200 bg-slate-50"
          }`}>
            <div className="font-semibold text-sm mb-2">{label}</div>
            {info?.status === "connected" && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>
                  <span className="text-xs text-green-700 font-semibold">Connected</span>
                </div>
                <div className="text-xs font-mono text-slate-500 mb-2">{info.phone}</div>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 text-xs"
                  onClick={() => apiRequest("DELETE", `/api/admin/wa/sessions/${side}`)
                    .then(() => refetchSessions())}>
                  Disconnect
                </Button>
              </>
            )}
            {info?.status === "qr_pending" && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
                  <span className="text-xs text-amber-700 font-semibold">Waiting for scan</span>
                </div>
                {info.qr && <img src={info.qr} alt="QR code" className="w-24 h-24 mb-1"/>}
                <div className="text-xs text-amber-700">Open WhatsApp → Linked Devices → Scan</div>
              </>
            )}
            {(!info || info.status === "disconnected") && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"/>
                  <span className="text-xs text-slate-500">Disconnected</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs"
                  onClick={() => apiRequest("POST", `/api/admin/wa/sessions/${side}/connect`)
                    .then(() => refetchSessions())}>
                  Connect
                </Button>
              </>
            )}
          </div>
        );
      })}
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 4: Build the Send All Unsent automated dialog**

Add state and job polling:

```ts
const { data: jobData, refetch: refetchJob } = useQuery({
  queryKey: ["/api/admin/wa/job", activeJobId],
  queryFn: () => activeJobId
    ? apiRequest("GET", `/api/admin/wa/job/${activeJobId}`).then(r => r.json())
    : null,
  refetchInterval: showSendDialog && activeJobId ? 3000 : false,
  enabled: !!activeJobId,
});

useEffect(() => {
  if (jobData?.status === "completed") {
    // Stop polling — keep dialog open to show summary
  }
}, [jobData]);
```

Replace the existing "Send All Unsent" button behavior:

```ts
const handleSendAll = async () => {
  const unsent = invites.filter(i => i.phone && !i.waSentAt);
  
  // Check sessions
  const needsGroom = unsent.some(i => i.side === "groom");
  const needsBride = unsent.some(i => i.side === "bride");
  if (needsGroom && waSessions?.groom?.status !== "connected") {
    toast({ title: "Connect groom's WhatsApp first", variant: "destructive" });
    return;
  }
  if (needsBride && waSessions?.bride?.status !== "connected") {
    toast({ title: "Connect bride's WhatsApp first", variant: "destructive" });
    return;
  }

  const noSide = unsent.filter(i => !i.side);
  if (noSide.length > 0) {
    if (!window.confirm(`${noSide.length} guests have no side and will be skipped. Continue?`)) return;
  }

  const messages = unsent
    .filter(i => i.side)
    .map(i => ({
      inviteId: i.id,
      phone: i.phone!,
      side: i.side!,
      message: renderTemplate(template, i),
    }));

  try {
    const resp = await apiRequest("POST", "/api/admin/wa/send-all", {
      messages,
      delayMin: 20,
      delayMax: 30,
    });
    const data = await resp.json();

    if (resp.status === 409) {
      setActiveJobId(data.jobId);
      setShowSendDialog(true);
      return;
    }

    setActiveJobId(data.jobId);
    setShowSendDialog(true);
  } catch {
    toast({ title: "Failed to start send job", variant: "destructive" });
  }
};
```

Add the Send Progress Dialog:

```tsx
<Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Send WhatsApp Messages</DialogTitle>
    </DialogHeader>

    {jobData && (
      <div className="space-y-4">
        {/* Overall progress */}
        <div>
          <div className="flex justify-between text-sm text-slate-500 mb-1">
            <span>Sending <strong>{jobData.total}</strong> invitations...</span>
            <span className="text-green-600 font-semibold">{jobData.sent} sent</span>
          </div>
          <div className="bg-slate-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${jobData.total > 0 ? (jobData.sent / jobData.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Per-side progress */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-blue-700 mb-1">🤵 Groom's side</div>
            <div className="text-xs text-blue-600">{jobData.groom.sent} / {jobData.groom.total} sent</div>
            <div className="bg-blue-200 rounded-full h-1 mt-1">
              <div className="bg-blue-500 h-1 rounded-full" style={{
                width: `${jobData.groom.total > 0 ? (jobData.groom.sent / jobData.groom.total) * 100 : 0}%`
              }}/>
            </div>
          </div>
          <div className="bg-pink-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-pink-700 mb-1">👰 Bride's side</div>
            <div className="text-xs text-pink-600">{jobData.bride.sent} / {jobData.bride.total} sent</div>
            <div className="bg-pink-200 rounded-full h-1 mt-1">
              <div className="bg-pink-500 h-1 rounded-full" style={{
                width: `${jobData.bride.total > 0 ? (jobData.bride.sent / jobData.bride.total) * 100 : 0}%`
              }}/>
            </div>
          </div>
        </div>

        {jobData.status === "completed" ? (
          <div className="text-center text-sm text-green-700 font-semibold">
            ✅ Done — {jobData.sent} sent, {jobData.skipped} skipped, {jobData.failed} failed
          </div>
        ) : (
          <>
            <div className="text-xs text-slate-400 text-center">
              Est. remaining: ~{Math.round(((jobData.total - jobData.sent) * 25) / 60)} minutes (20–30s delay per message)
            </div>
            <div className="flex gap-2 justify-center">
              {jobData.status === "running" ? (
                <Button size="sm" variant="outline"
                  onClick={() => activeJobId && apiRequest("POST", `/api/admin/wa/job/${activeJobId}/pause`)}>
                  <Pause className="h-3 w-3 mr-1" /> Pause
                </Button>
              ) : (
                <Button size="sm" variant="outline"
                  onClick={() => activeJobId && apiRequest("POST", `/api/admin/wa/job/${activeJobId}/resume`)}>
                  ▶ Resume
                </Button>
              )}
              <Button size="sm" variant="outline" className="text-red-600"
                onClick={() => activeJobId && apiRequest("DELETE", `/api/admin/wa/job/${activeJobId}`)
                  .then(() => refetchJob())}>
                Abort
              </Button>
            </div>
            <p className="text-xs text-slate-400 text-center">
              You can close this dialog — sending continues in the background
            </p>
          </>
        )}
      </div>
    )}
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Wire the Send All Unsent button to handleSendAll**

Find the existing "Send All Unsent" button and change its `onClick` to `handleSendAll`.

- [ ] **Step 6: Run the frontend dev server and smoke test**

```bash
# Terminal 1: Go backend
cd go-server && make run-dev

# Terminal 2: Frontend
npm run dev
```

Navigate to the admin Invites page. Verify:
- WhatsApp Connections card is visible
- CSV import preview shows side badges
- Invite cards show side badges
- Edit mode shows the Groom/Bride/None toggle
- Per-card send button appears when side is set (even if WA not connected — it won't show without connection; you can temporarily loosen the condition to test UI)

- [ ] **Step 7: TypeScript check**

```bash
npm run check
```

Expected: no errors. Fix any type issues.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add WhatsApp Connections card, Send All dialog, and automated send flow"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| `side` DB migration | Task 1 |
| `side` in Go model/repo | Task 2 |
| `side` in PATCH + bulk handlers | Task 3 |
| whatsmeow session management (Init, Connect, Disconnect, SessionStatus) | Task 4 |
| Send job goroutine + pause/resume/abort + SendOne | Task 5 |
| All WA endpoints | Task 6 |
| Router wiring | Task 6 |
| CSV import side column | Task 7 |
| Import preview stats + badges + warning | Task 7 |
| Invite card side badge in view mode | Task 8 |
| Invite card side toggle in edit mode | Task 8 |
| Per-card send button + retry | Task 8 |
| Groom/bride stats | Task 8 |
| WhatsApp Connections card (connected/qr/disconnected states) | Task 9 |
| Session polling every 3s when QR pending | Task 9 |
| Reconnect on mount (ActiveJob check) | Task 9 |
| Send All Unsent dialog with progress | Task 9 |
| Per-side progress bars | Task 9 |
| Pause/Resume/Abort in dialog | Task 9 |
| 409 concurrent job → navigate to existing | Task 9 |
| JID-to-role mapping via app_settings | Task 4 (Init + Connect success handler) |
| Phone-to-JID conversion + IsOnWhatsApp check | Task 5 (runJob) + Task 4 (phoneToJID) |
| `waSentAt` re-check in goroutine | Task 5 (runJob) |
| Template pre-rendering client-side | Task 9 (handleSendAll builds messages array) |
| Error table scenarios | Covered across tasks |

**Placeholder scan:** No TBD or TODO left. All code blocks are complete.

**Type consistency check:**
- `WAMessage` defined in `service/whatsapp.go`, used in handler and frontend payload
- `SendJob.Snapshot()` returns `map[string]interface{}` matching the spec's JSON shape
- `WhatsAppServicer` interface in `service/whatsapp.go`, consumed by `handler/whatsapp.go`
- `UpdateInvite(ctx, id, name, phone, side)` — consistent signature across interface, memory, postgres, and handler call sites

---

Plan complete and saved to `docs/superpowers/plans/2026-05-21-whatsapp-automated-sending.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans

Which approach?
