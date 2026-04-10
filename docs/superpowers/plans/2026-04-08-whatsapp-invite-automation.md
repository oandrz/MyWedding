# WhatsApp Invite Automation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add semi-automated WhatsApp outreach to invites — phone numbers, message templates, wa.me deep links, step-by-step Send All dialog, and sent/unsent tracking.

**Architecture:** Phone + wa_sent_at columns on invites table. Message template stored in existing app_settings. wa.me link generation is client-side. New PATCH/PUT/DELETE endpoints for invite update and sent status. Frontend gets inline phone edit, template editor, and Send All dialog.

**Tech Stack:** Go (Chi + pgx), React 18 + TypeScript + TanStack Query, Shadcn/Radix UI + Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-08-whatsapp-invite-automation-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `go-server/migrations/006_add_whatsapp_fields.sql` | Create | Schema migration |
| `go-server/internal/models/invite.go` | Modify | Add Phone, WaSentAt fields; update InsertInvite and BulkCreateInvitesRequest; add phone validation |
| `go-server/internal/repository/repository.go` | Modify | Add UpdateInvitePhone, MarkInviteWaSent, UnmarkInviteWaSent to interface |
| `go-server/internal/repository/memory.go` | Modify | Implement new repo methods |
| `go-server/internal/repository/postgres.go` | Modify | Implement new repo methods; update all invite queries to include phone/wa_sent_at columns |
| `go-server/internal/handler/invite.go` | Modify | Update Create/BulkCreate; add Update, MarkWaSent, UnmarkWaSent handlers |
| `go-server/internal/router/router.go` | Modify | Register 3 new routes |
| `go-server/internal/handler/invite_test.go` | Modify | Update bulk create tests; add new endpoint tests |
| `go-server/internal/handler/contract_test.go` | Modify | Add contract tests for new response shapes |
| `shared/schema.ts` | Modify | Add phone/waSentAt to invites table + schema |
| `client/src/pages/admin/InvitesPage.tsx` | Modify | Phone column, inline edit, WA status, template editor, Send All dialog, CSV phone import |

---

## Chunk 1: Backend — Models, Repository, Migration

### Task 1: Database Migration

**Files:**
- Create: `go-server/migrations/006_add_whatsapp_fields.sql`

- [ ] **Step 1: Create the migration file**

```sql
ALTER TABLE invites
  ADD COLUMN phone TEXT,
  ADD COLUMN wa_sent_at TIMESTAMPTZ;
```

- [ ] **Step 2: Commit**

```bash
git add go-server/migrations/006_add_whatsapp_fields.sql
git commit -m "feat: add phone and wa_sent_at columns to invites table"
```

---

### Task 2: Go Model Changes

**Files:**
- Modify: `go-server/internal/models/invite.go`

- [ ] **Step 1: Write phone validation test**

Create a test file for the phone validation function:

```go
// go-server/internal/models/invite_test.go
package models

import "testing"

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"valid indonesian", "+6281234567890", "+6281234567890", false},
		{"valid singapore", "+6591234567", "+6591234567", false},
		{"with spaces", "+62 812 3456 7890", "+6281234567890", false},
		{"with dashes", "+62-812-3456-7890", "+6281234567890", false},
		{"with parens", "+62(812)34567890", "+6281234567890", false},
		{"mixed formatting", "+65 9123-4567", "+6591234567", false},
		{"missing plus", "6281234567890", "", true},
		{"too short", "+12345", "", true},
		{"too long", "+1234567890123456", "", true},
		{"letters", "+62abc1234567", "", true},
		{"empty", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizePhone(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NormalizePhone(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("NormalizePhone(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/models -run TestNormalizePhone -v`
Expected: FAIL — `NormalizePhone` not defined

- [ ] **Step 3: Implement model changes**

In `go-server/internal/models/invite.go`:

1. Add `Phone` and `WaSentAt` fields to `Invite` struct (after `CreatedAt`):

```go
Phone    *string `json:"phone,omitempty"`
WaSentAt *string `json:"waSentAt,omitempty"`
```

2. Add `Phone` field to `InsertInvite`:

```go
type InsertInvite struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
}
```

3. Update `BulkCreateInvitesRequest` for backward compatibility:

```go
type BulkCreateInvitesRequest struct {
	Names   []string           `json:"names"`
	Invites []BulkInviteEntry  `json:"invites"`
}

type BulkInviteEntry struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
}
```

4. Add `NormalizePhone` function:

```go
import (
	"fmt"
	"regexp"
	"strings"
)

var phoneDigitsOnly = regexp.MustCompile(`[^\d]`)

// NormalizePhone strips formatting and validates E.164 format.
// Returns normalized phone or error if invalid.
func NormalizePhone(raw string) (string, error) {
	if raw == "" {
		return "", fmt.Errorf("phone number is required")
	}

	trimmed := strings.TrimSpace(raw)
	if !strings.HasPrefix(trimmed, "+") {
		return "", fmt.Errorf("phone must start with + (international format)")
	}

	// Keep the +, strip everything else that isn't a digit
	digits := phoneDigitsOnly.ReplaceAllString(trimmed[1:], "")

	// Check for non-digit characters (letters etc.) by comparing lengths
	stripped := strings.NewReplacer(" ", "", "-", "", "(", "", ")", "").Replace(trimmed[1:])
	if stripped != digits {
		return "", fmt.Errorf("phone contains invalid characters")
	}

	if len(digits) < 7 || len(digits) > 15 {
		return "", fmt.Errorf("phone must have 7-15 digits after +")
	}

	return "+" + digits, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd go-server && go test ./internal/models -run TestNormalizePhone -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/models/invite.go go-server/internal/models/invite_test.go
git commit -m "feat: add phone/waSentAt fields to Invite model with E.164 validation"
```

---

### Task 3: Repository Interface + Memory Implementation

**Files:**
- Modify: `go-server/internal/repository/repository.go` (line 66-73)
- Modify: `go-server/internal/repository/memory.go` (line 673-806)
- Test: `go-server/internal/repository/memory_test.go`

- [ ] **Step 1: Write failing tests for new repository methods**

Add to `go-server/internal/repository/memory_test.go`:

```go
func TestMemory_UpdateInvitePhone(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	inv, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	phone := "+6281234567890"
	updated, err := repo.UpdateInvitePhone(ctx, inv.ID, &phone)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated == nil {
		t.Fatal("expected invite, got nil")
	}
	if updated.Phone == nil || *updated.Phone != phone {
		t.Fatalf("expected phone %q, got %v", phone, updated.Phone)
	}

	// Clear phone
	updated2, err := repo.UpdateInvitePhone(ctx, inv.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated2.Phone != nil {
		t.Fatalf("expected nil phone, got %v", updated2.Phone)
	}

	// Not found
	_, err = repo.UpdateInvitePhone(ctx, 9999, &phone)
	if err == nil {
		t.Fatal("expected error for non-existent invite")
	}
}

func TestMemory_MarkUnmarkInviteWaSent(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	inv, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Bob"})

	// Mark sent
	updated, err := repo.MarkInviteWaSent(ctx, inv.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.WaSentAt == nil {
		t.Fatal("expected waSentAt to be set")
	}

	// Unmark sent
	updated2, err := repo.UnmarkInviteWaSent(ctx, inv.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated2.WaSentAt != nil {
		t.Fatalf("expected waSentAt to be nil, got %v", updated2.WaSentAt)
	}
}

func TestMemory_CreateInvite_WithPhone(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	phone := "+6591234567"
	inv, err := repo.CreateInvite(ctx, models.InsertInvite{Name: "Charlie", Phone: &phone})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inv.Phone == nil || *inv.Phone != phone {
		t.Fatalf("expected phone %q, got %v", phone, inv.Phone)
	}
}

func TestMemory_CreateInvitesBulk_WithPhone(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	phone := "+6281234567890"
	invites, err := repo.CreateInvitesBulk(ctx, []models.InsertInvite{
		{Name: "Alice", Phone: &phone},
		{Name: "Bob"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(invites) != 2 {
		t.Fatalf("expected 2, got %d", len(invites))
	}
	if invites[0].Phone == nil || *invites[0].Phone != phone {
		t.Fatalf("expected phone on first invite")
	}
	if invites[1].Phone != nil {
		t.Fatalf("expected nil phone on second invite")
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd go-server && go test ./internal/repository -run "TestMemory_(UpdateInvitePhone|MarkUnmark|CreateInvite_WithPhone|CreateInvitesBulk_WithPhone)" -v`
Expected: FAIL — methods not defined

- [ ] **Step 3: Add new methods to repository interface**

In `go-server/internal/repository/repository.go`, add after `CreateInvitesBulk` (line 73):

```go
UpdateInvitePhone(ctx context.Context, id int, phone *string) (*models.Invite, error)
MarkInviteWaSent(ctx context.Context, id int) (*models.Invite, error)
UnmarkInviteWaSent(ctx context.Context, id int) (*models.Invite, error)
```

- [ ] **Step 4: Implement memory repository methods**

In `go-server/internal/repository/memory.go`:

1. Update `CreateInvite` (line 694) to include Phone:

```go
inv := models.Invite{
	ID:        m.inviteIDSeq,
	Name:      data.Name,
	Code:      code,
	Phone:     data.Phone,
	CreatedAt: now(),
}
```

2. Update `CreateInvitesBulk` (line 796) similarly:

```go
inv := models.Invite{
	ID:        m.inviteIDSeq,
	Name:      d.Name,
	Code:      code,
	Phone:     d.Phone,
	CreatedAt: now(),
}
```

3. Add new methods after `CreateInvitesBulk`:

```go
func (m *MemoryRepository) UpdateInvitePhone(_ context.Context, id int, phone *string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.Phone = phone
	m.invites[id] = inv
	return &inv, nil
}

func (m *MemoryRepository) MarkInviteWaSent(_ context.Context, id int) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	ts := now()
	inv.WaSentAt = &ts
	m.invites[id] = inv
	return &inv, nil
}

func (m *MemoryRepository) UnmarkInviteWaSent(_ context.Context, id int) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, fmt.Errorf("invite not found")
	}
	inv.WaSentAt = nil
	m.invites[id] = inv
	return &inv, nil
}
```

Note: `memory.go` needs `"fmt"` added to its imports.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd go-server && go test ./internal/repository -run "TestMemory_(UpdateInvitePhone|MarkUnmark|CreateInvite_WithPhone|CreateInvitesBulk_WithPhone)" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/repository/repository.go go-server/internal/repository/memory.go go-server/internal/repository/memory_test.go
git commit -m "feat: add UpdateInvitePhone, MarkInviteWaSent, UnmarkInviteWaSent to repository"
```

---

### Task 4: PostgreSQL Repository Implementation

**Files:**
- Modify: `go-server/internal/repository/postgres.go` (lines 768-975)

**IMPORTANT: pgx scanning rule for `wa_sent_at`** — pgx cannot scan `TIMESTAMPTZ` directly into `*string`. All postgres methods that scan `wa_sent_at` must use a `*time.Time` intermediary variable, then convert to `*string` via RFC3339 formatting. This matches the existing `createdAt` pattern. Use this helper at the top of the invite section:

```go
// scanWaSentAt converts a *time.Time from pgx scan into the *string format used by the Invite model.
func scanWaSentAt(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}
```

- [ ] **Step 1: Add scanWaSentAt helper to postgres.go**

Add the helper function above in the invite section of `postgres.go`.

- [ ] **Step 2: Update CreateInvite to include phone column**

In `postgres.go`, update `CreateInvite` (line 768). Change the INSERT and RETURNING to include `phone`. Scan `wa_sent_at` into `*time.Time`:

```go
func (r *PostgresRepository) CreateInvite(ctx context.Context, data models.InsertInvite) (*models.Invite, error) {
	for attempt := 0; attempt < 3; attempt++ {
		code := models.GenerateInviteCode()
		var inv models.Invite
		var createdAt time.Time
		var waSentAt *time.Time
		err := r.pool.QueryRow(ctx,
			`INSERT INTO invites (name, code, phone)
			 VALUES ($1, $2, $3)
			 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
			data.Name, code, data.Phone,
		).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				continue
			}
			return nil, err
		}
		inv.CreatedAt = createdAt.Format(time.RFC3339)
		inv.WaSentAt = scanWaSentAt(waSentAt)
		return &inv, nil
	}
	return nil, fmt.Errorf("failed to generate unique invite code after 3 attempts")
}
```

- [ ] **Step 3: Update CreateInvitesBulk to include phone column**

Update `CreateInvitesBulk` (line 791). Same pattern — add `phone` to INSERT, scan `wa_sent_at` into `*time.Time`, convert via `scanWaSentAt`. Add `d.Phone` as the third INSERT parameter.

- [ ] **Step 4: Update GetInvites to include phone/wa_sent_at columns**

Update `GetInvites` (line 848). Add `i.phone, i.wa_sent_at` to SELECT. Add `var waSentAt *time.Time` variable. Scan order: `&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt, &rsvpID, ...`. After scan: `inv.WaSentAt = scanWaSentAt(waSentAt)`.

- [ ] **Step 5: Update GetInviteByID similarly**

Update `GetInviteByID` (line 889) — same pattern with `*time.Time` intermediary.

- [ ] **Step 6: Update GetInviteByCode**

Update `GetInviteByCode` (line 925) — add `i.phone, i.wa_sent_at` to SELECT and scan with `*time.Time` intermediary like the other methods. Do NOT strip PII here — the repository returns full data and the **handler** is responsible for redacting admin-only fields (see Task 6 Step 4 for handler-level PII stripping).

- [ ] **Step 7: Add new methods**

Add after `UpdateInviteRsvpID` (line 975):

```go
func (r *PostgresRepository) UpdateInvitePhone(ctx context.Context, id int, phone *string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET phone = $1 WHERE id = $2
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		phone, id,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}

func (r *PostgresRepository) MarkInviteWaSent(ctx context.Context, id int) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET wa_sent_at = NOW() WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		id,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}

func (r *PostgresRepository) UnmarkInviteWaSent(ctx context.Context, id int) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET wa_sent_at = NULL WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		id,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}
```

- [ ] **Step 8: Run all repo tests**

Run: `cd go-server && go test ./internal/repository/... -v -race`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add go-server/internal/repository/postgres.go
git commit -m "feat: implement WhatsApp invite methods in postgres repository"
```

---

## Chunk 2: Backend — Handlers + Routes + Tests

### Task 5: Update Invite Handler — Create and BulkCreate

**Files:**
- Modify: `go-server/internal/handler/invite.go` (lines 22-96)

- [ ] **Step 1: Write failing test for Create with phone**

Add to `go-server/internal/handler/invite_test.go`:

```go
func TestInvite_Create_WithPhone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"name":  "Alice",
		"phone": "+6281234567890",
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invite := result["invite"].(map[string]interface{})
	if invite["name"] != "Alice" {
		t.Fatalf("expected name=Alice, got %v", invite["name"])
	}
	if invite["phone"] != "+6281234567890" {
		t.Fatalf("expected phone, got %v", invite["phone"])
	}
}

func TestInvite_Create_InvalidPhone_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"name":  "Alice",
		"phone": "not-a-phone",
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run "TestInvite_Create_(WithPhone|InvalidPhone)" -v`
Expected: FAIL — phone not stored/validated

- [ ] **Step 3: Update Create handler**

In `go-server/internal/handler/invite.go`, update `Create` (line 22). After sanitizing the name (line 36), add phone validation:

```go
// Validate and normalize phone if provided
if body.Phone != nil && *body.Phone != "" {
	normalized, err := models.NormalizePhone(*body.Phone)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Invalid phone: %s", err.Error()))
		return
	}
	body.Phone = &normalized
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run "TestInvite_Create_(WithPhone|InvalidPhone)" -v`
Expected: PASS

- [ ] **Step 5: Write failing test for BulkCreate with new format**

Add to `invite_test.go`:

```go
func TestInvite_BulkCreate_WithInvitesFormat(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"invites": []map[string]interface{}{
			{"name": "Alice", "phone": "+6281234567890"},
			{"name": "Bob"},
		},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	if len(invites) != 2 {
		t.Fatalf("expected 2, got %d", len(invites))
	}

	first := invites[0].(map[string]interface{})
	if first["phone"] != "+6281234567890" {
		t.Fatalf("expected phone on first invite, got %v", first["phone"])
	}
}

func TestInvite_BulkCreate_LegacyNamesFormat(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Old format still works for backward compatibility
	body := jsonBody(map[string]interface{}{
		"names": []string{"Alice", "Bob"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	if len(invites) != 2 {
		t.Fatalf("expected 2, got %d", len(invites))
	}
}

func TestInvite_BulkCreate_InvalidPhone_SkipsPhone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Invalid phone should be silently skipped (stored as NULL), not reject the batch
	body := jsonBody(map[string]interface{}{
		"invites": []map[string]interface{}{
			{"name": "Alice", "phone": "bad-phone"},
		},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	if len(invites) != 1 {
		t.Fatalf("expected 1 invite, got %d", len(invites))
	}
	inv := invites[0].(map[string]interface{})
	if inv["name"] != "Alice" {
		t.Fatalf("expected Alice, got %v", inv["name"])
	}
	// Phone should be omitted (nil + omitempty) since it was invalid
	if _, hasPhone := inv["phone"]; hasPhone {
		t.Fatalf("expected phone to be omitted for invalid input, got %v", inv["phone"])
	}
}
```

- [ ] **Step 6: Update BulkCreate handler**

In `invite.go`, replace the `BulkCreate` handler (line 52-96) with:

```go
func (h *InviteHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	var body models.BulkCreateInvitesRequest
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Support both formats: new "invites" array and legacy "names" array
	entries := body.Invites
	if len(entries) == 0 && len(body.Names) > 0 {
		entries = make([]models.BulkInviteEntry, len(body.Names))
		for i, name := range body.Names {
			entries[i] = models.BulkInviteEntry{Name: name}
		}
	}

	if len(entries) == 0 {
		writeError(w, r, http.StatusBadRequest, "Invites array is required and cannot be empty")
		return
	}

	if len(entries) > maxBulkInvites {
		writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Cannot import more than %d invites at once", maxBulkInvites))
		return
	}

	inserts := make([]models.InsertInvite, 0, len(entries))
	for _, entry := range entries {
		trimmed := strings.TrimSpace(entry.Name)
		if trimmed == "" {
			writeError(w, r, http.StatusBadRequest, "All names must be non-empty")
			return
		}
		if h.Sanitizer != nil {
			trimmed = h.Sanitizer.SanitizeStrict(trimmed)
			if trimmed == "" {
				writeError(w, r, http.StatusBadRequest, "All names must be non-empty")
				return
			}
		}

		insert := models.InsertInvite{Name: trimmed}

		// Validate and normalize phone if provided (do NOT sanitize phone).
		// Invalid phones are silently skipped (stored as NULL) — per spec,
		// "can be fixed later via inline edit". Frontend shows warning badges.
		if entry.Phone != nil && *entry.Phone != "" {
			normalized, err := models.NormalizePhone(*entry.Phone)
			if err == nil {
				insert.Phone = &normalized
			}
			// Invalid phone → stored as NULL, fixable via inline edit later
		}

		inserts = append(inserts, insert)
	}

	invites, err := h.Repo.CreateInvitesBulk(r.Context(), inserts)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create invites")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"invites": invites,
	})
}
```

- [ ] **Step 7: Run all bulk create tests**

Run: `cd go-server && go test ./internal/handler -run "TestInvite_BulkCreate" -v`
Expected: ALL PASS (including existing tests that use legacy `names` format)

- [ ] **Step 8: Commit**

```bash
git add go-server/internal/handler/invite.go go-server/internal/handler/invite_test.go
git commit -m "feat: update Create/BulkCreate handlers with phone support and backward compat"
```

---

### Task 6: New Handlers — Update, MarkWaSent, UnmarkWaSent

**Files:**
- Modify: `go-server/internal/handler/invite.go`
- Modify: `go-server/internal/handler/invite_test.go`

- [ ] **Step 1: Write failing tests**

Add to `invite_test.go`:

```go
func TestInvite_Update_Phone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Update phone
	updateBody := jsonBody(map[string]interface{}{"phone": "+6281234567890"})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if invite["phone"] != "+6281234567890" {
		t.Fatalf("expected phone, got %v", invite["phone"])
	}
}

func TestInvite_Update_ClearPhone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice", "phone": "+6281234567890"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Clear phone by sending null
	updateBody := jsonBody(map[string]interface{}{"phone": nil})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if _, hasPhone := invite["phone"]; hasPhone {
		t.Fatalf("expected phone to be omitted (nil), got %v", invite["phone"])
	}
}

func TestInvite_Update_InvalidPhone_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	updateBody := jsonBody(map[string]interface{}{"phone": "bad"})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	contractResponse(t, env, req2, http.StatusBadRequest)
}

func TestInvite_Update_NotFound_Returns404(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	updateBody := jsonBody(map[string]interface{}{"phone": "+6281234567890"})
	req := adminRequest(http.MethodPatch, "/api/admin/invites/9999", updateBody, cookie, csrf)
	contractResponse(t, env, req, http.StatusNotFound)
}

func TestInvite_MarkWaSent(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Mark sent
	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if _, ok := invite["waSentAt"]; !ok {
		t.Fatal("expected waSentAt to be set")
	}
}

func TestInvite_UnmarkWaSent(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Mark sent
	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	contractResponse(t, env, req2, http.StatusOK)

	// Unmark sent
	req3 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req3, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if _, ok := invite["waSentAt"]; ok {
		t.Fatalf("expected waSentAt to be omitted, got %v", invite["waSentAt"])
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd go-server && go test ./internal/handler -run "TestInvite_(Update|MarkWaSent|UnmarkWaSent)" -v`
Expected: FAIL — handlers and routes not defined

- [ ] **Step 3: Add new handlers to invite.go**

Append to `go-server/internal/handler/invite.go`. Note: add `"encoding/json"` to the imports in `invite.go`:

```go
// Update handles PATCH /api/admin/invites/{id}.
// Partial update — only explicitly provided fields are changed.
// Uses json.RawMessage to distinguish between "phone": null (clear) and absent phone (no change).
func (h *InviteHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	// Parse into raw map to detect which fields were explicitly sent
	var raw map[string]json.RawMessage
	if err := parseJSON(r, &raw); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Only update phone if the "phone" key was explicitly present in the request
	phoneRaw, phonePresent := raw["phone"]
	if !phonePresent {
		writeError(w, r, http.StatusBadRequest, "No updatable fields provided")
		return
	}

	var phone *string
	// json.RawMessage "null" means explicit clear
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

	invite, err := h.Repo.UpdateInvitePhone(r.Context(), id, phone)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invite": invite,
	})
}

// MarkWaSent handles PUT /api/admin/invites/{id}/wa-sent.
func (h *InviteHandler) MarkWaSent(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	invite, err := h.Repo.MarkInviteWaSent(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to mark invite as sent")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invite": invite,
	})
}

// UnmarkWaSent handles DELETE /api/admin/invites/{id}/wa-sent.
func (h *InviteHandler) UnmarkWaSent(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	invite, err := h.Repo.UnmarkInviteWaSent(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to unmark invite sent status")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invite": invite,
	})
}
```

- [ ] **Step 4: Strip PII from GetByCode handler**

In `go-server/internal/handler/invite.go`, update the existing `GetByCode` handler (line 115-133). After the nil check and before `writeJSON`, add:

```go
// Strip PII — phone and waSentAt are admin-only fields
invite.Phone = nil
invite.WaSentAt = nil
```

This ensures the public endpoint never leaks phone numbers. The stripping happens at the handler layer (not repository) so it works with both memory and postgres repos, and the contract test `TestContract_InviteGetByCode_NoPII` will pass.

- [ ] **Step 5: Register routes in router.go**

In `go-server/internal/router/router.go`, add after line 173 (`r.Delete("/invites/{id}", invite.Delete)`):

```go
r.Patch("/invites/{id}", invite.Update)
r.Put("/invites/{id}/wa-sent", invite.MarkWaSent)
r.Delete("/invites/{id}/wa-sent", invite.UnmarkWaSent)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd go-server && go test ./internal/handler -run "TestInvite_(Update|MarkWaSent|UnmarkWaSent)" -v`
Expected: PASS

- [ ] **Step 7: Run ALL handler tests to confirm no regressions**

Run: `cd go-server && go test ./internal/handler/... -v -race`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add go-server/internal/handler/invite.go go-server/internal/handler/invite_test.go go-server/internal/router/router.go
git commit -m "feat: add Update, MarkWaSent, UnmarkWaSent invite handlers and routes"
```

---

### Task 7: Contract Tests for New Endpoints

**Files:**
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Add contract tests for PATCH, PUT wa-sent, DELETE wa-sent**

Add to `contract_test.go` to verify JSON response shapes match frontend expectations:

```go
func TestContract_InviteUpdate_Phone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice", "phone": "+6281234567890"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// PATCH phone
	updateBody := jsonBody(map[string]interface{}{"phone": "+6591234567"})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	assertKeyExists(t, invite, "id")
	assertKeyType(t, invite, "id", "float64")
	assertKeyExists(t, invite, "name")
	assertKeyType(t, invite, "name", "string")
	assertKeyExists(t, invite, "code")
	assertKeyType(t, invite, "code", "string")
	assertKeyExists(t, invite, "phone")
	assertKeyType(t, invite, "phone", "string")
}

func TestContract_InviteMarkWaSent(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// PUT wa-sent
	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	assertKeyExists(t, invite, "id")
	assertKeyExists(t, invite, "waSentAt")
	assertKeyType(t, invite, "waSentAt", "string")
}

func TestContract_InviteUnmarkWaSent(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Mark then unmark
	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	contractResponse(t, env, req2, http.StatusOK)

	req3 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req3, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	assertKeyExists(t, invite, "id")
	// waSentAt should be omitted (nil + omitempty)
	if _, ok := invite["waSentAt"]; ok {
		t.Fatalf("expected waSentAt to be omitted after unmark, got %v", invite["waSentAt"])
	}
}

func TestContract_InviteGetByCode_NoPII(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite with phone
	body := jsonBody(map[string]interface{}{"name": "Alice", "phone": "+6281234567890"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	code := createResult["invite"].(map[string]interface{})["code"].(string)

	// Public endpoint should NOT expose phone
	req2 := httptest.NewRequest(http.MethodGet, "/api/invites/"+code, nil)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if _, ok := invite["phone"]; ok {
		t.Fatalf("public endpoint should not expose phone, got %v", invite["phone"])
	}
	if _, ok := invite["waSentAt"]; ok {
		t.Fatalf("public endpoint should not expose waSentAt, got %v", invite["waSentAt"])
	}
}
```

- [ ] **Step 2: Run contract tests**

Run: `cd go-server && go test ./internal/handler -run "TestContract_Invite" -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/handler/contract_test.go
git commit -m "test: add contract tests for invite update, wa-sent, and PII protection"
```

---

### Task 8: Full Backend Test Suite

**Files:**
- Test: `go-server/internal/handler/invite_test.go`

- [ ] **Step 1: Run the complete test suite**

Run: `cd go-server && make test`
Expected: ALL PASS

- [ ] **Step 2: Run linter**

Run: `cd go-server && make lint`
Expected: PASS (no lint errors)

- [ ] **Step 3: Commit any linter fixes if needed**

---

## Chunk 3: Shared Schema + Frontend

### Task 9: Shared Schema Changes

**Files:**
- Modify: `shared/schema.ts` (lines 117-127)

- [ ] **Step 1: Update invites table definition**

In `shared/schema.ts`, update the invites pgTable (line 117):

```typescript
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  rsvpId: integer("rsvp_id"),
  phone: text("phone"),
  waSentAt: timestamp("wa_sent_at", { mode: 'string' }),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull()
});
```

- [ ] **Step 2: Update insertInviteSchema**

Update the pick schema (line 125):

```typescript
export const insertInviteSchema = createInsertSchema(invites).pick({
  name: true,
  phone: true,
});
```

- [ ] **Step 3: Run TypeScript check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "feat: add phone and waSentAt to invites schema"
```

---

### Task 10: Frontend — Phone Column + Inline Edit + WA Status

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

This is a large frontend task. Break the InvitesPage changes into substeps.

- [ ] **Step 1: Add new mutations**

Add after `deleteInviteMutation` (line 132):

```typescript
const updateInviteMutation = useMutation({
  mutationFn: async ({ id, phone }: { id: number; phone: string | null }) => {
    const response = await apiRequest("PATCH", `/api/admin/invites/${id}`, { phone });
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
  },
  onError: (error: Error) => {
    handleAutoLogout(error);
    toast({ title: "Error", description: `Failed to update phone: ${error.message}`, variant: "destructive" });
  },
});

const markWaSentMutation = useMutation({
  mutationFn: async (id: number) => {
    const response = await apiRequest("PUT", `/api/admin/invites/${id}/wa-sent`);
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
  },
  onError: (error: Error) => {
    handleAutoLogout(error);
    toast({ title: "Error", description: `Failed to mark sent: ${error.message}`, variant: "destructive" });
  },
});

const unmarkWaSentMutation = useMutation({
  mutationFn: async (id: number) => {
    const response = await apiRequest("DELETE", `/api/admin/invites/${id}/wa-sent`);
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
  },
  onError: (error: Error) => {
    handleAutoLogout(error);
    toast({ title: "Error", description: `Failed to update status: ${error.message}`, variant: "destructive" });
  },
});
```

- [ ] **Step 2: Add phone edit state and helper**

Add state for inline phone editing:

```typescript
const [editingPhoneId, setEditingPhoneId] = useState<number | null>(null);
const [editPhoneValue, setEditPhoneValue] = useState("");
```

Add phone validation helper and wa.me link builder:

```typescript
function isValidE164(phone: string): boolean {
  return /^\+\d{7,15}$/.test(phone.replace(/[\s\-()]/g, ""));
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("+")) return trimmed;
  return "+" + trimmed.slice(1).replace(/[^\d]/g, "");
}
```

- [ ] **Step 3: Update single create form to accept optional phone**

Update the create invite form (line 397-418) to include an optional phone input next to the name input. Update `createInviteMutation` (line 95) to send `{ name, phone }` instead of just `{ name }`. Add state:

```typescript
const [newInvitePhone, setNewInvitePhone] = useState("");
```

The mutation becomes:
```typescript
mutationFn: async ({ name, phone }: { name: string; phone?: string }) => {
  const response = await apiRequest("POST", "/api/admin/invites", {
    name,
    ...(phone ? { phone } : {}),
  });
  return response.json();
},
```

- [ ] **Step 4: Add WA stats to stats bar**

After the existing 3 stat cards (lines 369-388), add 2 more cards. Compute counts:

```typescript
const sentCount = invites.filter((i) => i.waSentAt).length;
const withPhone = invites.filter((i) => i.phone).length;
```

Add a "WA Sent" card (green) and "WA Unsent" card.

- [ ] **Step 5: Add phone and WA status to each invite card**

In the invite card rendering (line 652-721), add after the code display:
- Phone display with inline edit capability
- WhatsApp icon button (opens wa.me link)
- Sent/Unsent badge

- [ ] **Step 6: Run TypeScript check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add phone column, inline edit, and WA status to invites page"
```

---

### Task 11: Frontend — Message Template Editor

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Add template state and query**

```typescript
const DEFAULT_TEMPLATE = "Hi {name}, you're invited to our wedding! RSVP here: {link}";

const { data: templateData } = useQuery<{ setting: { settingValue: string } }>({
  queryKey: ["/api/settings/wa_message_template"],
  retry: false,
});

const [templateText, setTemplateText] = useState(DEFAULT_TEMPLATE);

// Sync fetched template
useEffect(() => {
  if (templateData?.setting?.settingValue) {
    setTemplateText(templateData.setting.settingValue);
  }
}, [templateData]);

const saveTemplateMutation = useMutation({
  mutationFn: async (template: string) => {
    const response = await apiRequest("PATCH", "/api/admin/app-settings/bulk", {
      settings: [{ settingKey: "wa_message_template", settingValue: template, settingType: "text" }],
    });
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/settings/wa_message_template"] });
    toast({ title: "Saved", description: "Message template updated" });
  },
  onError: (error: Error) => {
    handleAutoLogout(error);
    toast({ title: "Error", description: `Failed to save template: ${error.message}`, variant: "destructive" });
  },
});
```

- [ ] **Step 2: Add template rendering helper**

```typescript
function renderTemplate(template: string, invite: { name: string; code: string }): string {
  const link = `${window.location.origin}/?code=${invite.code}`;
  return template
    .replace(/\{name\}/g, invite.name)
    .replace(/\{code\}/g, invite.code)
    .replace(/\{link\}/g, link);
}

function buildWaLink(phone: string, message: string): string {
  const digits = phone.replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
```

- [ ] **Step 3: Add template editor UI**

Add a collapsible Card section between the stats and the invite list. Contains:
- Textarea with the template
- Clickable variable chips (`{name}`, `{code}`, `{link}`) that insert into textarea
- Live preview with sample data
- Save button

- [ ] **Step 4: Run TypeScript check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add WhatsApp message template editor with live preview"
```

---

### Task 12: Frontend — Send All Dialog

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Add Send All state**

```typescript
const [sendAllOpen, setSendAllOpen] = useState(false);
const [sendAllIndex, setSendAllIndex] = useState(0);
const [sendAllSentCount, setSendAllSentCount] = useState(0);
const [sendAllSkipCount, setSendAllSkipCount] = useState(0);
```

Compute unsent invites with phone:

```typescript
const unsentWithPhone = useMemo(
  () => invites
    .filter((i) => i.phone && !i.waSentAt)
    .sort((a, b) => a.name.localeCompare(b.name)),
  [invites]
);
```

- [ ] **Step 2: Add Send All dialog UI**

Add a Dialog component with:
- Progress indicator: "N of M unsent"
- Current invite name, phone, message preview
- "Open WhatsApp" button → `window.open(buildWaLink(...))`
- "Mark Sent & Next" button → calls `markWaSentMutation`, advances index
- "Skip" button → advances without marking
- "Pause" button → closes dialog
- Auto-close with summary when index reaches end

- [ ] **Step 3: Add "Send All Unsent" trigger button**

Add a button near the stats or above the invite list:

```tsx
{unsentWithPhone.length > 0 && (
  <Button
    onClick={() => { setSendAllIndex(0); setSendAllSentCount(0); setSendAllSkipCount(0); setSendAllOpen(true); }}
    className="gap-2"
    variant="outline"
  >
    <MessageCircle className="h-4 w-4" />
    Send All Unsent ({unsentWithPhone.length})
  </Button>
)}
```

(Add `MessageCircle` to lucide-react imports)

- [ ] **Step 4: Run TypeScript check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add step-by-step Send All WhatsApp dialog"
```

---

### Task 13: Frontend — CSV Import Phone Support

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Add phone header constants**

Add alongside `NAME_HEADERS` (line 70):

```typescript
const PHONE_HEADERS = ["phone", "phone number", "whatsapp", "wa", "no hp", "nomor hp", "mobile"];
```

- [ ] **Step 2: Update ImportEntry type and ImportState**

```typescript
type ImportEntry = { name: string; phone: string; checked: boolean; dupType: "none" | "existing" | "inFile" };
```

Update ImportState preview step to include `phoneColumnIndex`:

```typescript
| {
    step: "preview";
    headers: string[];
    rawRows: string[][];
    nameColumnIndex: number;
    phoneColumnIndex: number | null;
    entries: ImportEntry[];
  }
```

- [ ] **Step 3: Update deriveEntries to include phone**

Update the `deriveEntries` callback to accept `phoneColIndex: number | null` parameter and return phone values:

```typescript
const deriveEntries = useCallback(
  (rawRows: string[][], colIndex: number, phoneColIndex: number | null): ImportEntry[] => {
    // ... existing logic ...
    return rawRows
      .map((row) => ({
        name: (row[colIndex]?.trim() ?? ""),
        phone: phoneColIndex !== null ? (row[phoneColIndex]?.trim() ?? "") : "",
      }))
      .filter(({ name }) => isValidName(name))
      .map(({ name, phone }) => {
        // ... existing duplicate logic ...
        return { name, phone, checked: dupType === "none", dupType };
      });
  },
  [data]
);
```

- [ ] **Step 4: Update processFile for phone column detection**

In `processFile`, after detecting name column, add phone column detection:

```typescript
let phoneCol: number | null = headers.findIndex((h) => PHONE_HEADERS.includes(h.toLowerCase()));
if (phoneCol === -1) phoneCol = null;
```

Pass `phoneCol` to `deriveEntries` and include in state.

- [ ] **Step 5: Update bulkCreateMutation to use new format**

```typescript
const bulkCreateMutation = useMutation({
  mutationFn: async (entries: { name: string; phone?: string }[]) => {
    const response = await apiRequest("POST", "/api/admin/invites/bulk", {
      invites: entries.map((e) => ({
        name: e.name,
        ...(e.phone ? { phone: e.phone } : {}),
      })),
    });
    return response.json();
  },
  // ... rest unchanged
});
```

Update `handleImport` to pass entries with phone data.

- [ ] **Step 6: Update preview dialog to show phone column**

Add phone column selector dropdown (similar to name column selector). Show phone values in the preview list next to names. Show warning badge for invalid phone formats.

- [ ] **Step 7: Run TypeScript check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: extend CSV import to support phone column with auto-detection"
```

---

## Chunk 4: Integration + Final Verification

### Task 14: Full Integration Test

- [ ] **Step 1: Run all backend tests**

Run: `cd go-server && make test`
Expected: ALL PASS

- [ ] **Step 2: Run linter**

Run: `cd go-server && make lint`
Expected: PASS

- [ ] **Step 3: Run TypeScript check**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Build frontend**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Verify full-stack build**

Run: `npm run build && cd go-server && make build`
Expected: Both succeed

- [ ] **Step 6: Commit any final fixes**

---

### Task 15: Manual Smoke Test Checklist

Before considering this feature complete, verify these flows manually:

- [ ] Create invite with phone number via admin UI
- [ ] Create invite without phone number (still works)
- [ ] Edit phone number inline on existing invite
- [ ] Clear phone number (set to null)
- [ ] Bulk import CSV with name + phone columns
- [ ] Bulk import CSV with name-only column (backward compat)
- [ ] WhatsApp button opens wa.me link with pre-filled message
- [ ] Mark invite as sent
- [ ] Unmark invite as sent
- [ ] Send All dialog walks through unsent invites
- [ ] Template editor saves and loads template
- [ ] Template variables render correctly in preview
- [ ] Stats show correct sent/unsent counts
