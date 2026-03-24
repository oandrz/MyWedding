# Invite-Code RSVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invite-code-based RSVP flow behind a feature flag, keeping the existing email-based flow as fallback.

**Architecture:** New `invites` table with 5-char codes linked to RSVPs via FK. Feature flag `invite_code_rsvp` switches between email-based (off) and code-based (on) RSVP flows. Admin manages invites; guests use personalized links.

**Tech Stack:** Go (Chi router, pgx), React 18 + TypeScript + Vite, TanStack React Query, Wouter, Zod, Shadcn/Radix UI

**Spec:** `docs/superpowers/specs/2026-03-24-invite-code-rsvp-design.md`

---

## Chunk 1: Backend — Model, Migration, Repository

### Task 1: Create Invite Model

**Files:**
- Create: `go-server/internal/models/invite.go`

- [ ] **Step 1: Create the invite model file**

```go
package models

import (
	"crypto/rand"
	"math/big"
)

// Invite represents a guest invitation with a unique code.
type Invite struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	RsvpID    *int   `json:"rsvpId"`
	CreatedAt string `json:"createdAt"`
	Rsvp      *Rsvp  `json:"rsvp,omitempty"`
}

// InsertInvite contains the fields required to create an invite.
type InsertInvite struct {
	Name string `json:"name"`
}

// GenerateInviteCode creates a random 5-character lowercase alphanumeric code.
func GenerateInviteCode() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 5)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		b[i] = charset[n.Int64()]
	}
	return string(b)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd go-server && go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/models/invite.go
git commit -m "feat: add Invite model"
```

---

### Task 2: Create Database Migration

**Files:**
- Create: `go-server/migrations/005_add_invites.sql`

- [ ] **Step 1: Write the migration**

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS invites (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    rsvp_id INTEGER REFERENCES rsvp(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add go-server/migrations/005_add_invites.sql
git commit -m "feat: add invites table migration"
```

---

### Task 3: Add Invite Repository Interface Methods

**Files:**
- Modify: `go-server/internal/repository/repository.go`

- [ ] **Step 1: Add invite methods to the Repository interface**

Add after the `// Messages` section (after line 64):

```go
	// Invites
	CreateInvite(ctx context.Context, data models.InsertInvite) (*models.Invite, error)
	GetInvites(ctx context.Context) ([]models.Invite, error)
	GetInviteByID(ctx context.Context, id int) (*models.Invite, error)
	GetInviteByCode(ctx context.Context, code string) (*models.Invite, error)
	DeleteInvite(ctx context.Context, id int) (bool, error)
	UpdateInviteRsvpID(ctx context.Context, inviteID int, rsvpID *int) error
```

- [ ] **Step 2: Verify it compiles (expect failures — implementations missing)**

Run: `cd go-server && go build ./...`
Expected: Compile errors for `MemoryRepository` and `PostgresRepository` not implementing the new methods. This is expected — we'll fix in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/repository/repository.go
git commit -m "feat: add invite methods to Repository interface"
```

---

### Task 4: Implement In-Memory Invite Repository + Tests (TDD)

**Files:**
- Modify: `go-server/internal/repository/memory.go`
- Modify: `go-server/internal/repository/memory_test.go`

- [ ] **Step 1: Write failing tests for invite CRUD**

Add to `memory_test.go`:

```go
// ---------------------------------------------------------------------------
// Invite tests
// ---------------------------------------------------------------------------

func TestCreateInvite(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	inv, err := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})
	if err != nil {
		t.Fatalf("CreateInvite returned error: %v", err)
	}
	if inv.ID != 1 {
		t.Fatalf("expected ID 1, got %d", inv.ID)
	}
	if inv.Name != "Alice" {
		t.Fatalf("expected name Alice, got %s", inv.Name)
	}
	if len(inv.Code) != 5 {
		t.Fatalf("expected 5-char code, got %q (len %d)", inv.Code, len(inv.Code))
	}
	if inv.RsvpID != nil {
		t.Fatalf("expected nil rsvpId, got %v", inv.RsvpID)
	}
}

func TestGetInvites(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})
	repo.CreateInvite(ctx, models.InsertInvite{Name: "Bob"})

	invites, err := repo.GetInvites(ctx)
	if err != nil {
		t.Fatalf("GetInvites returned error: %v", err)
	}
	if len(invites) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(invites))
	}
}

func TestGetInviteByID(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	created, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	inv, err := repo.GetInviteByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetInviteByID returned error: %v", err)
	}
	if inv == nil {
		t.Fatal("expected invite, got nil")
	}
	if inv.Name != "Alice" {
		t.Fatalf("expected Alice, got %s", inv.Name)
	}
}

func TestGetInviteByIDNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	inv, err := repo.GetInviteByID(ctx, 999)
	if err != nil {
		t.Fatalf("GetInviteByID returned error: %v", err)
	}
	if inv != nil {
		t.Fatal("expected nil for missing id")
	}
}

func TestGetInviteByCode(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	created, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	inv, err := repo.GetInviteByCode(ctx, created.Code)
	if err != nil {
		t.Fatalf("GetInviteByCode returned error: %v", err)
	}
	if inv == nil {
		t.Fatal("expected invite, got nil")
	}
	if inv.Name != "Alice" {
		t.Fatalf("expected Alice, got %s", inv.Name)
	}
}

func TestGetInviteByCodeNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	inv, err := repo.GetInviteByCode(ctx, "zzzzz")
	if err != nil {
		t.Fatalf("GetInviteByCode returned error: %v", err)
	}
	if inv != nil {
		t.Fatal("expected nil for missing code")
	}
}

func TestDeleteInvite(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	deleted, err := repo.DeleteInvite(ctx, 1)
	if err != nil {
		t.Fatalf("DeleteInvite returned error: %v", err)
	}
	if !deleted {
		t.Fatal("expected deleted=true")
	}

	invites, _ := repo.GetInvites(ctx)
	if len(invites) != 0 {
		t.Fatalf("expected 0 invites after delete, got %d", len(invites))
	}
}

func TestDeleteInviteNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	deleted, err := repo.DeleteInvite(ctx, 999)
	if err != nil {
		t.Fatalf("DeleteInvite returned error: %v", err)
	}
	if deleted {
		t.Fatal("expected deleted=false for missing invite")
	}
}

func TestUpdateInviteRsvpID(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	created, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	rsvpID := 42
	err := repo.UpdateInviteRsvpID(ctx, created.ID, &rsvpID)
	if err != nil {
		t.Fatalf("UpdateInviteRsvpID returned error: %v", err)
	}

	inv, _ := repo.GetInviteByCode(ctx, created.Code)
	if inv.RsvpID == nil || *inv.RsvpID != 42 {
		t.Fatalf("expected rsvpId=42, got %v", inv.RsvpID)
	}

	// Clear rsvpID
	err = repo.UpdateInviteRsvpID(ctx, created.ID, nil)
	if err != nil {
		t.Fatalf("UpdateInviteRsvpID (nil) returned error: %v", err)
	}
	inv, _ = repo.GetInviteByCode(ctx, created.Code)
	if inv.RsvpID != nil {
		t.Fatalf("expected nil rsvpId, got %v", inv.RsvpID)
	}
}

func TestGetInviteByCode_PopulatesRsvp(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	gc := 2
	rsvp, _ := repo.CreateRsvp(ctx, models.InsertRsvp{
		Name: "Alice", Email: "a@a.com", AttendanceType: "both", GuestCount: &gc,
	})

	inv, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})
	repo.UpdateInviteRsvpID(ctx, inv.ID, &rsvp.ID)

	fetched, _ := repo.GetInviteByCode(ctx, inv.Code)
	if fetched.Rsvp == nil {
		t.Fatal("expected Rsvp to be populated")
	}
	if fetched.Rsvp.ID != rsvp.ID {
		t.Fatalf("expected rsvp ID %d, got %d", rsvp.ID, fetched.Rsvp.ID)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd go-server && go test ./internal/repository/ -run TestCreateInvite -v`
Expected: Compile error — methods don't exist yet

- [ ] **Step 3: Add invite fields to MemoryRepository struct and constructor**

In `memory.go`, add to the `MemoryRepository` struct (after `messageIDSeq int`):

```go
	invites      map[int]models.Invite
	inviteIDSeq  int
```

In `NewMemoryRepository()`, add to the map initialization:

```go
		invites:      make(map[int]models.Invite),
```

- [ ] **Step 4: Implement in-memory invite methods**

Add to `memory.go` after the Messages section. Use `models.GenerateInviteCode()` (defined in `models/invite.go`) — do NOT create a local `generateCode` function:

```go
// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

func (m *MemoryRepository) CreateInvite(_ context.Context, data models.InsertInvite) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.inviteIDSeq++

	// Generate unique code (retry on collision)
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
		CreatedAt: now(),
	}
	m.invites[inv.ID] = inv
	return &inv, nil
}

func (m *MemoryRepository) GetInvites(_ context.Context) ([]models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.Invite, 0, len(m.invites))
	for _, inv := range m.invites {
		// Populate Rsvp if linked
		if inv.RsvpID != nil {
			if r, ok := m.rsvps[*inv.RsvpID]; ok {
				inv.Rsvp = &r
			}
		}
		result = append(result, inv)
	}
	return result, nil
}

func (m *MemoryRepository) GetInviteByID(_ context.Context, id int) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[id]
	if !ok {
		return nil, nil
	}
	if inv.RsvpID != nil {
		if r, ok := m.rsvps[*inv.RsvpID]; ok {
			inv.Rsvp = &r
		}
	}
	return &inv, nil
}

func (m *MemoryRepository) GetInviteByCode(_ context.Context, code string) (*models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, inv := range m.invites {
		if inv.Code == code {
			// Populate Rsvp if linked
			if inv.RsvpID != nil {
				if r, ok := m.rsvps[*inv.RsvpID]; ok {
					inv.Rsvp = &r
				}
			}
			return &inv, nil
		}
	}
	return nil, nil
}

func (m *MemoryRepository) DeleteInvite(_ context.Context, id int) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.invites[id]; !ok {
		return false, nil
	}
	delete(m.invites, id)
	return true, nil
}

func (m *MemoryRepository) UpdateInviteRsvpID(_ context.Context, inviteID int, rsvpID *int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	inv, ok := m.invites[inviteID]
	if !ok {
		return nil
	}
	inv.RsvpID = rsvpID
	m.invites[inviteID] = inv
	return nil
}
```

No additional imports needed in `memory.go` — `models.GenerateInviteCode()` is called via the existing `models` import.

- [ ] **Step 5: Run all invite tests to verify they pass**

Run: `cd go-server && go test ./internal/repository/ -run TestCreateInvite\|TestGetInvites\|TestGetInviteByID\|TestGetInviteByCode\|TestDeleteInvite\|TestUpdateInviteRsvpID -v -race`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/repository/memory.go go-server/internal/repository/memory_test.go
git commit -m "feat: implement in-memory invite repository with tests"
```

---

### Task 5: Implement Postgres Invite Repository

**Files:**
- Modify: `go-server/internal/repository/postgres.go`

- [ ] **Step 1: Add Postgres invite implementations**

Add after the Messages section in `postgres.go`. Use `models.GenerateInviteCode()` — do NOT create a local `generateCode` function:

```go
// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateInvite(ctx context.Context, data models.InsertInvite) (*models.Invite, error) {
	// Retry on unique constraint collision (up to 3 attempts)
	for attempt := 0; attempt < 3; attempt++ {
		code := models.GenerateInviteCode()
		var inv models.Invite
		var createdAt time.Time
		err := r.pool.QueryRow(ctx,
			`INSERT INTO invites (name, code)
			 VALUES ($1, $2)
			 RETURNING id, name, code, rsvp_id, created_at`,
			data.Name, code,
		).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt)
		if err != nil {
			// Check for unique constraint violation on code
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				continue
			}
			return nil, err
		}
		inv.CreatedAt = createdAt.Format(time.RFC3339)
		return &inv, nil
	}
	return nil, fmt.Errorf("failed to generate unique invite code after 3 attempts")
}

func (r *PostgresRepository) GetInvites(ctx context.Context) ([]models.Invite, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT i.id, i.name, i.code, i.rsvp_id, i.created_at,
		        rv.id, rv.name, rv.email, rv.attendance_type, rv.guest_count
		 FROM invites i
		 LEFT JOIN rsvp rv ON i.rsvp_id = rv.id
		 ORDER BY i.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Invite, 0)
	for rows.Next() {
		var inv models.Invite
		var createdAt time.Time
		var rsvpID, rsvpGuestCount *int
		var rsvpName, rsvpEmail, rsvpAttendanceType *string

		if err := rows.Scan(
			&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt,
			&rsvpID, &rsvpName, &rsvpEmail, &rsvpAttendanceType, &rsvpGuestCount,
		); err != nil {
			return nil, err
		}
		inv.CreatedAt = createdAt.Format(time.RFC3339)

		if rsvpID != nil {
			inv.Rsvp = &models.Rsvp{
				ID:             *rsvpID,
				Name:           *rsvpName,
				Email:          *rsvpEmail,
				AttendanceType: *rsvpAttendanceType,
				GuestCount:     rsvpGuestCount,
			}
		}
		result = append(result, inv)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) GetInviteByID(ctx context.Context, id int) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var rsvpID, rsvpGuestCount *int
	var rsvpName, rsvpEmail, rsvpAttendanceType *string

	err := r.pool.QueryRow(ctx,
		`SELECT i.id, i.name, i.code, i.rsvp_id, i.created_at,
		        rv.id, rv.name, rv.email, rv.attendance_type, rv.guest_count
		 FROM invites i
		 LEFT JOIN rsvp rv ON i.rsvp_id = rv.id
		 WHERE i.id = $1`, id,
	).Scan(
		&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt,
		&rsvpID, &rsvpName, &rsvpEmail, &rsvpAttendanceType, &rsvpGuestCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)

	if rsvpID != nil {
		inv.Rsvp = &models.Rsvp{
			ID:             *rsvpID,
			Name:           *rsvpName,
			Email:          *rsvpEmail,
			AttendanceType: *rsvpAttendanceType,
			GuestCount:     rsvpGuestCount,
		}
	}
	return &inv, nil
}

func (r *PostgresRepository) GetInviteByCode(ctx context.Context, code string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var rsvpID, rsvpGuestCount *int
	var rsvpName, rsvpEmail, rsvpAttendanceType *string

	err := r.pool.QueryRow(ctx,
		`SELECT i.id, i.name, i.code, i.rsvp_id, i.created_at,
		        rv.id, rv.name, rv.email, rv.attendance_type, rv.guest_count
		 FROM invites i
		 LEFT JOIN rsvp rv ON i.rsvp_id = rv.id
		 WHERE i.code = $1`, code,
	).Scan(
		&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt,
		&rsvpID, &rsvpName, &rsvpEmail, &rsvpAttendanceType, &rsvpGuestCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)

	if rsvpID != nil {
		inv.Rsvp = &models.Rsvp{
			ID:             *rsvpID,
			Name:           *rsvpName,
			Email:          *rsvpEmail,
			AttendanceType: *rsvpAttendanceType,
			GuestCount:     rsvpGuestCount,
		}
	}
	return &inv, nil
}

func (r *PostgresRepository) DeleteInvite(ctx context.Context, id int) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM invites WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *PostgresRepository) UpdateInviteRsvpID(ctx context.Context, inviteID int, rsvpID *int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE invites SET rsvp_id = $1 WHERE id = $2`,
		rsvpID, inviteID,
	)
	return err
}
```

Add required imports to `postgres.go` if not already present: `"fmt"`, `"strings"`. The `models.GenerateInviteCode()` is called via the existing `models` import.

- [ ] **Step 2: Verify it compiles**

Run: `cd go-server && go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/repository/postgres.go
git commit -m "feat: implement Postgres invite repository"
```

---

### Task 6: Run Full Test Suite

- [ ] **Step 1: Run all Go tests**

Run: `cd go-server && make test`
Expected: All tests pass (existing tests should be unaffected)

---

## Chunk 2: Backend — Invite Handler, RSVP Handler Modification, Router

### Task 7: Create Invite Handler + Tests (TDD)

**Files:**
- Create: `go-server/internal/handler/invite.go`
- Create: `go-server/internal/handler/invite_test.go`

- [ ] **Step 1: Write failing tests for invite handler**

Create `go-server/internal/handler/invite_test.go`:

**Auth pattern:** Tests use `adminLogin(t, env)` → returns `(*http.Cookie, string)`, then `adminRequest(method, path, body, cookie, csrfToken)` → returns `*http.Request`. These helpers exist in `handler_test.go`.

```go
package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInvite_Create(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"name": "Alice",
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invite := result["invite"].(map[string]interface{})
	if invite["name"] != "Alice" {
		t.Fatalf("expected name=Alice, got %v", invite["name"])
	}
	code, ok := invite["code"].(string)
	if !ok || len(code) != 5 {
		t.Fatalf("expected 5-char code, got %v", invite["code"])
	}
	assertKeyExists(t, invite, "id")
	assertKeyExists(t, invite, "rsvpId")
	assertKeyExists(t, invite, "createdAt")
}

func TestInvite_Create_EmptyName_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"name": "",
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_List(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create two invites
	for _, name := range []string{"Alice", "Bob"} {
		body := jsonBody(map[string]interface{}{"name": name})
		req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
		contractResponse(t, env, req, http.StatusCreated)
	}

	req := adminRequest(http.MethodGet, "/api/admin/invites", nil, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	invites := result["invites"].([]interface{})
	if len(invites) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(invites))
	}
}

func TestInvite_GetByCode(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	code := createResult["invite"].(map[string]interface{})["code"].(string)

	// Get by code (public route — no auth needed)
	req2 := httptest.NewRequest(http.MethodGet, "/api/invites/"+code, nil)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if invite["name"] != "Alice" {
		t.Fatalf("expected Alice, got %v", invite["name"])
	}
}

func TestInvite_GetByCode_NotFound(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/invites/zzzzz", nil)
	contractResponse(t, env, req, http.StatusNotFound)
}

func TestInvite_Delete(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Delete using the actual invite ID
	req2 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	if result["message"] != "Invite deleted successfully" {
		t.Fatalf("unexpected message: %v", result["message"])
	}
}

func TestInvite_Delete_CascadesRsvp(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create RSVP via email flow
	rsvpBody := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "both", "guestCount": 2,
	})
	rsvpReq := httptest.NewRequest(http.MethodPost, "/api/rsvp", rsvpBody)
	rsvpReq.Header.Set("Content-Type", "application/json")
	rsvpResult := contractResponse(t, env, rsvpReq, http.StatusCreated)
	rsvpID := int(rsvpResult["rsvp"].(map[string]interface{})["id"].(float64))

	// Create invite
	invBody := jsonBody(map[string]interface{}{"name": "Alice"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invResult := contractResponse(t, env, invReq, http.StatusCreated)
	inviteID := int(invResult["invite"].(map[string]interface{})["id"].(float64))

	// Manually link rsvp_id (simulating what the RSVP handler would do)
	env.repo.UpdateInviteRsvpID(context.Background(), inviteID, &rsvpID)

	// Delete invite — should cascade to delete the RSVP
	delReq := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d", inviteID), nil, cookie, csrf)
	contractResponse(t, env, delReq, http.StatusOK)

	// Verify RSVP is gone
	listReq := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	listResult := contractResponse(t, env, listReq, http.StatusOK)
	rsvps := listResult["rsvps"].([]interface{})
	if len(rsvps) != 0 {
		t.Fatalf("expected 0 rsvps after cascade delete, got %d", len(rsvps))
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd go-server && go test ./internal/handler/ -run TestInvite -v`
Expected: Compile error — handler doesn't exist yet

- [ ] **Step 3: Create the invite handler**

Create `go-server/internal/handler/invite.go`:

```go
package handler

import (
	"net/http"
	"strconv"

	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)

// InviteHandler handles invite-related endpoints.
type InviteHandler struct {
	Repo      repository.Repository
	Sanitizer *service.Sanitizer
}

// Create handles POST /api/admin/invites.
func (h *InviteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertInvite
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Name == "" {
		writeError(w, r, http.StatusBadRequest, "Name is required")
		return
	}

	if h.Sanitizer != nil {
		body.Name = h.Sanitizer.Sanitize(body.Name)
	}

	invite, err := h.Repo.CreateInvite(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create invite")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"invite": invite,
	})
}

// List handles GET /api/admin/invites.
func (h *InviteHandler) List(w http.ResponseWriter, r *http.Request) {
	invites, err := h.Repo.GetInvites(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get invites")
		return
	}

	if invites == nil {
		invites = make([]models.Invite, 0)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invites": invites,
	})
}

// GetByCode handles GET /api/invites/{code}.
func (h *InviteHandler) GetByCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	invite, err := h.Repo.GetInviteByCode(r.Context(), code)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get invite")
		return
	}

	if invite == nil {
		writeError(w, r, http.StatusNotFound, "Invite not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invite": invite,
	})
}

// Delete handles DELETE /api/admin/invites/{id}.
// Cascade: if the invite has a linked RSVP, delete the RSVP first.
func (h *InviteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	// Look up invite by ID to check for linked RSVP
	targetInvite, err := h.Repo.GetInviteByID(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check invite")
		return
	}
	if targetInvite == nil {
		writeError(w, r, http.StatusNotFound, "Invite not found")
		return
	}

	// Cascade: delete linked RSVP first
	if targetInvite.RsvpID != nil {
		h.Repo.DeleteRsvp(r.Context(), *targetInvite.RsvpID)
	}

	deleted, err := h.Repo.DeleteInvite(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to delete invite")
		return
	}

	if !deleted {
		writeError(w, r, http.StatusNotFound, "Invite not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Invite deleted successfully",
	})
}
```

- [ ] **Step 4: Run invite handler tests**

Run: `cd go-server && go test ./internal/handler/ -run TestInvite -v -race`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/handler/invite.go go-server/internal/handler/invite_test.go
git commit -m "feat: add invite handler with cascade delete"
```

---

### Task 8: Wire Invite Routes in Router

**Files:**
- Modify: `go-server/internal/router/router.go`

- [ ] **Step 1: Add invite handler initialization and routes**

In `router.go`, add after the `welcomeScreen` handler initialization (after line 51):

```go
	invite := &handler.InviteHandler{Repo: repo, Sanitizer: sanitizer}
```

Add the public invite route after the other public routes (after line 98, before the upload routes section):

```go
	r.Get("/api/invites/{code}", invite.GetByCode)
```

Add admin invite routes inside the auth+CSRF group (after line 165, before the closing `})`):

```go
			r.Post("/invites", invite.Create)
			r.Get("/invites", invite.List)
			r.Delete("/invites/{id}", invite.Delete)
```

- [ ] **Step 2: Verify it compiles and tests pass**

Run: `cd go-server && go build ./... && make test`
Expected: Build succeeds, all tests pass

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/router/router.go
git commit -m "feat: wire invite routes in router"
```

---

### Task 9: Modify RSVP Handler for Feature Flag

**Files:**
- Modify: `go-server/internal/handler/rsvp.go`
- Modify: `go-server/internal/handler/rsvp_test.go`

- [ ] **Step 1: Write failing test for code-based RSVP creation**

Add to `rsvp_test.go`. Ensure the file's import block includes `"context"` and `"github.com/andreasronaldo/wedding-server/internal/models"`:

```go
func TestRsvp_Create_WithInviteCode(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Enable the feature flag (*bool required)
	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	// Create an invite
	invBody := jsonBody(map[string]interface{}{"name": "Alice"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invResult := contractResponse(t, env, invReq, http.StatusCreated)
	code := invResult["invite"].(map[string]interface{})["code"].(string)

	// Submit RSVP with code
	body := jsonBody(map[string]interface{}{
		"code": code, "attendanceType": "both", "guestCount": 2,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusCreated)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice" {
		t.Fatalf("expected name=Alice, got %v", rsvp["name"])
	}
	if rsvp["attendanceType"] != "both" {
		t.Fatalf("expected attendanceType=both, got %v", rsvp["attendanceType"])
	}
}

func TestRsvp_Create_WithInviteCode_Update(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	// Create invite
	invBody := jsonBody(map[string]interface{}{"name": "Alice"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invResult := contractResponse(t, env, invReq, http.StatusCreated)
	code := invResult["invite"].(map[string]interface{})["code"].(string)

	// First RSVP
	body1 := jsonBody(map[string]interface{}{
		"code": code, "attendanceType": "both", "guestCount": 2,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body1)
	req1.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req1, http.StatusCreated)

	// Update RSVP with same code
	body2 := jsonBody(map[string]interface{}{
		"code": code, "attendanceType": "reception", "guestCount": 1,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body2)
	req2.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req2, http.StatusOK)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["attendanceType"] != "reception" {
		t.Fatalf("expected updated attendanceType=reception, got %v", rsvp["attendanceType"])
	}
}

func TestRsvp_Create_WithInviteCode_InvalidCode(t *testing.T) {
	env := newTestEnv()

	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	body := jsonBody(map[string]interface{}{
		"code": "zzzzz", "attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusNotFound)
}

func TestRsvp_Create_WithInviteCode_NoCode(t *testing.T) {
	env := newTestEnv()

	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	body := jsonBody(map[string]interface{}{
		"attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestRsvp_Create_FlagOff_StillUsesEmail(t *testing.T) {
	env := newTestEnv()

	// Flag off (default) — email-based flow should work
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "both", "guestCount": 2,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusCreated)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice" {
		t.Fatalf("expected name=Alice, got %v", rsvp["name"])
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd go-server && go test ./internal/handler/ -run TestRsvp_Create_WithInviteCode -v`
Expected: FAIL — handler doesn't support code-based flow yet

- [ ] **Step 3: Modify RSVP handler Create method**

Create a new request body struct to accept both flows. Update `rsvp.go`:

Add a new request struct at the top of the file (after the imports):

```go
// rsvpRequest is the combined request body for both email-based and code-based RSVP flows.
type rsvpRequest struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	Code           string `json:"code"`
	AttendanceType string `json:"attendanceType"`
	GuestCount     *int   `json:"guestCount"`
}
```

Replace the `Create` method:

```go
// Create handles POST /api/rsvp.
func (h *RsvpHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body rsvpRequest
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Check feature flag
	useInviteCode := false
	flag, _ := h.Repo.GetFeatureFlag(r.Context(), "invite_code_rsvp")
	if flag != nil && flag.Enabled {
		useInviteCode = true
	}

	if !models.ValidAttendanceTypes[body.AttendanceType] {
		writeError(w, r, http.StatusBadRequest, "Invalid attendance type. Must be: both, holy_matrimony, reception, or decline")
		return
	}

	if body.AttendanceType == "decline" {
		body.GuestCount = nil
	}

	if useInviteCode {
		h.createWithCode(w, r, body)
	} else {
		h.createWithEmail(w, r, body)
	}
}

func (h *RsvpHandler) createWithEmail(w http.ResponseWriter, r *http.Request, body rsvpRequest) {
	if body.Name == "" || body.Email == "" {
		writeError(w, r, http.StatusBadRequest, "Name and email are required")
		return
	}

	name := body.Name
	if h.Sanitizer != nil {
		name = h.Sanitizer.Sanitize(name)
	}

	insertData := models.InsertRsvp{
		Name:           name,
		Email:          body.Email,
		AttendanceType: body.AttendanceType,
		GuestCount:     body.GuestCount,
	}

	existing, err := h.Repo.GetRsvpByEmail(r.Context(), body.Email)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check existing RSVP")
		return
	}

	if existing != nil {
		updated, err := h.Repo.UpdateRsvp(r.Context(), existing.ID, insertData)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "Failed to update RSVP")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"message": "Your RSVP has been updated successfully!",
			"rsvp":    updated,
		})
		return
	}

	rsvp, err := h.Repo.CreateRsvp(r.Context(), insertData)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create RSVP")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Thank you for your RSVP!",
		"rsvp":    rsvp,
	})
}

func (h *RsvpHandler) createWithCode(w http.ResponseWriter, r *http.Request, body rsvpRequest) {
	if body.Code == "" {
		writeError(w, r, http.StatusBadRequest, "Invite code is required")
		return
	}

	invite, err := h.Repo.GetInviteByCode(r.Context(), body.Code)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to look up invite")
		return
	}
	if invite == nil {
		writeError(w, r, http.StatusNotFound, "Invalid invite code")
		return
	}

	name := invite.Name
	if h.Sanitizer != nil {
		name = h.Sanitizer.Sanitize(name)
	}

	insertData := models.InsertRsvp{
		Name:           name,
		Email:          "", // No email in code-based flow
		AttendanceType: body.AttendanceType,
		GuestCount:     body.GuestCount,
	}

	if invite.RsvpID != nil {
		// Update existing RSVP
		updated, err := h.Repo.UpdateRsvp(r.Context(), *invite.RsvpID, insertData)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "Failed to update RSVP")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"message": "Your RSVP has been updated successfully!",
			"rsvp":    updated,
		})
		return
	}

	// Create new RSVP and link to invite
	rsvp, err := h.Repo.CreateRsvp(r.Context(), insertData)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create RSVP")
		return
	}

	if err := h.Repo.UpdateInviteRsvpID(r.Context(), invite.ID, &rsvp.ID); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to link RSVP to invite")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Thank you for your RSVP!",
		"rsvp":    rsvp,
	})
}
```

- [ ] **Step 4: Run all RSVP tests (both old and new)**

Run: `cd go-server && go test ./internal/handler/ -run TestRsvp -v -race`
Expected: All PASS (both old email-based and new code-based tests)

- [ ] **Step 5: Run full test suite**

Run: `cd go-server && make test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/handler/rsvp.go go-server/internal/handler/rsvp_test.go
git commit -m "feat: add code-based RSVP flow behind invite_code_rsvp flag"
```

---

## Chunk 3: Frontend — Shared Schema, RsvpSection, Admin InvitesPage, Admin Layout

### Task 10: Update Shared Schema

**Files:**
- Modify: `shared/schema.ts`

- [ ] **Step 1: Add invites table and schema**

Add after the `rsvp` table section in `shared/schema.ts`:

```typescript
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  rsvpId: integer("rsvp_id"),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull()
});

export const insertInviteSchema = createInsertSchema(invites).pick({
  name: true,
});
```

Add the type exports:

```typescript
export type Invite = typeof invites.$inferSelect;
export type InsertInvite = z.infer<typeof insertInviteSchema>;
```

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat: add invites table to shared schema"
```

---

### Task 11: Update RsvpSection for Code-Based Flow

**Files:**
- Modify: `client/src/components/RsvpSection.tsx`

- [ ] **Step 1: Update RsvpSection to support both flows**

The key changes:
1. Read `?code=` from URL params
2. Fetch feature flags to check `invite_code_rsvp`
3. When flag on + code present: fetch invite, show personalized greeting, hide email field
4. When flag on + no code: hide RSVP section entirely
5. When flag off: existing email-based flow (unchanged)

Replace the entire `RsvpSection.tsx` content. The key additions are:
- Query for feature flags: `useQuery` to `/api/feature-flags/invite_code_rsvp`
- Query for invite by code: `useQuery` to `/api/invites/{code}` (when code present)
- Conditional rendering based on flag + code
- Modified form schema (email optional when flag on)
- Modified mutation to send `code` instead of `email` when flag on

This is a large change. The implementer should:
1. Add state for `inviteCode` (read from `?code=` URL param)
2. Add `useQuery` for the feature flag
3. Add `useQuery` for the invite (enabled when code is present)
4. Create two Zod schemas: one with email (flag off), one without (flag on)
5. When flag on + no code: return `null` (hide section)
6. When flag on + code + invite loaded: show greeting + form without email
7. When flag on + code + invite not found: show error message
8. Mutation sends `{ code, attendanceType, guestCount }` when flag on

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RsvpSection.tsx
git commit -m "feat: update RsvpSection for code-based flow behind feature flag"
```

---

### Task 12: Create Admin InvitesPage

**Files:**
- Create: `client/src/pages/admin/InvitesPage.tsx`

- [ ] **Step 1: Create the invites admin page**

Follow the patterns from `RsvpPage.tsx`:
- `useQuery` to `/api/admin/invites` for the invite list
- "Add Guest" form with just a name input
- `useMutation` for POST `/api/admin/invites`
- Each row shows: name, code, RSVP status (badge), "Copy Link" button, delete button
- "Copy Link" copies `${window.location.origin}?code=${invite.code}` to clipboard
- Delete uses `useDeleteConfirmation` hook (same pattern as `RsvpPage.tsx`)
- Delete mutation calls `DELETE /api/admin/invites/{id}`
- Search/filter by name with `useDebounce`

Use Shadcn components: `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `Badge`, `Button`, `Input`.
Lucide icons: `UserPlus`, `Copy`, `Trash2`, `Search`, `X`, `Loader2`, `Link`, `Check`.

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat: add admin InvitesPage"
```

---

### Task 13: Wire InvitesPage into Admin Layout

**Files:**
- Modify: `client/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Add import and nav item**

Add import at top:
```typescript
import InvitesPage from "./InvitesPage";
```

Add to the `lucide-react` import: `UserPlus`

Add to `NAV_ITEMS` array (after the RSVP item):
```typescript
  { path: "/invites", label: "Invites", icon: UserPlus },
```

Add route inside `<Switch>` (after the `/rsvps` route):
```tsx
<Route path="/invites" component={InvitesPage} />
```

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/AdminLayout.tsx
git commit -m "feat: wire InvitesPage into admin layout"
```

---

### Task 14: Update Welcome Screen Integration

**Files:**
- Modify: `client/src/components/WelcomeOverlay.tsx` (or whichever component reads `?to=`)

- [ ] **Step 1: Update welcome screen to resolve name from invite code**

Check where `?to=` is read in `WelcomeOverlay.tsx`. Add logic:
- If `?code=` param exists, fetch `GET /api/invites/{code}` and use the invite name
- If `?to=` param exists (no code), use it directly (existing behavior)
- If neither, use `fallbackName` (existing behavior)

This may require lifting the invite fetch to a parent component or using a shared query key so both `WelcomeOverlay` and `RsvpSection` can access the invite data without duplicate fetches.

- [ ] **Step 2: Verify TypeScript check passes**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/WelcomeOverlay.tsx
git commit -m "feat: resolve guest name from invite code in welcome screen"
```

---

## Chunk 4: Tests and Verification

### Task 15: Update Frontend Tests

**Files:**
- Modify: `client/src/components/__tests__/RsvpSection.test.tsx`

- [ ] **Step 1: Add tests for code-based flow**

Add test cases:
- When feature flag on + code in URL: renders personalized greeting, no email field
- When feature flag on + no code: RSVP section is hidden
- When feature flag on + invalid code: shows error message
- When feature flag off: renders email field (existing behavior)

Mock the feature flag API response and invite API response using the existing `vi.mock` and `global.fetch` patterns from the existing test file.

- [ ] **Step 2: Run frontend tests**

Run: `cd client && npx vitest run src/components/__tests__/RsvpSection.test.tsx`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/__tests__/RsvpSection.test.tsx
git commit -m "test: add RsvpSection tests for invite-code flow"
```

---

### Task 16: Add Invite Contract Tests

**Files:**
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Add contract tests for invite JSON structure**

Add contract tests that verify:
- Invite JSON has keys: `id` (float64), `name` (string), `code` (string), `rsvpId` (nil or float64), `createdAt` (string)
- Invite list response has `invites` key (array)

Follow the existing `assertKeyExists` / `assertKeyType` patterns.

- [ ] **Step 2: Run contract tests**

Run: `cd go-server && go test ./internal/handler/ -run TestContract -v -race`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/handler/contract_test.go
git commit -m "test: add invite contract tests"
```

---

### Task 17: Full Verification

- [ ] **Step 1: Run all Go tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 2: Run all frontend tests**

Run: `npm run check && cd client && npx vitest run`
Expected: No type errors, all tests PASS

- [ ] **Step 3: Build and verify**

Run: `npm run build && cd go-server && make build`
Expected: Both build successfully

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: final cleanup for invite-code RSVP feature"
```
