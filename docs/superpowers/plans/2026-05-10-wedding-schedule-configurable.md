# Wedding Day Schedule — Admin-Configurable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `WEDDING_SCHEDULE` constant with a fully CRUD-able, drag-and-droppable schedule managed from the admin page, backed by a new `schedule_events` Postgres table.

**Architecture:** New `schedule_events` table → Go handler following the `welcome_screen` pattern → public `GET /api/schedule` + admin CRUD endpoints → `SchedulePage.tsx` using `@dnd-kit/sortable` → `DetailsSection.tsx` fetches from API instead of constants.

**Tech Stack:** Go + pgx, Chi router, React 18 + TypeScript, TanStack React Query, @dnd-kit/core + @dnd-kit/sortable (already installed), Shadcn/Tailwind.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `go-server/migrations/009_add_schedule_events.sql` | DB table definition |
| Create | `go-server/internal/models/schedule_event.go` | ScheduleEvent + input structs |
| Modify | `go-server/internal/repository/repository.go` | Add 5 new interface methods |
| Modify | `go-server/internal/repository/memory.go` | In-memory implementations |
| Modify | `go-server/internal/repository/postgres.go` | Postgres implementations |
| Create | `go-server/internal/handler/schedule.go` | HTTP handler (List, Create, Update, Delete, Reorder) |
| Create | `go-server/internal/handler/schedule_test.go` | Handler tests (TDD) |
| Modify | `go-server/internal/handler/handler_test.go` | Add schedule routes to protected-routes test |
| Modify | `go-server/internal/router/router.go` | Register schedule routes |
| Create | `client/src/pages/admin/SchedulePage.tsx` | Admin CRUD + drag-and-drop page |
| Modify | `client/src/pages/admin/AdminLayout.tsx` | Add Schedule nav item + route |
| Modify | `client/src/components/DetailsSection.tsx` | Fetch from API; remove constant |
| Modify | `client/src/lib/constants.ts` | Remove WEDDING_SCHEDULE |

---

## Task 1: Database Migration

**Files:**
- Create: `go-server/migrations/009_add_schedule_events.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- go-server/migrations/009_add_schedule_events.sql
CREATE TABLE schedule_events (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  time        TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Commit**

```bash
git add go-server/migrations/009_add_schedule_events.sql
git commit -m "feat: add schedule_events migration"
```

---

## Task 2: Go Model

**Files:**
- Create: `go-server/internal/models/schedule_event.go`

- [ ] **Step 1: Create the model file**

```go
// go-server/internal/models/schedule_event.go
package models

import "time"

type ScheduleEvent struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Time        string    `json:"time"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
}

type InsertScheduleEvent struct {
	Title       string `json:"title"`
	Time        string `json:"time"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
}

type UpdateScheduleEvent struct {
	Title       string `json:"title"`
	Time        string `json:"time"`
	Description string `json:"description"`
}

type ScheduleOrderItem struct {
	ID        int `json:"id"`
	SortOrder int `json:"sortOrder"`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd go-server && go build ./...
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/models/schedule_event.go
git commit -m "feat: add ScheduleEvent model"
```

---

## Task 3: Repository Interface

**Files:**
- Modify: `go-server/internal/repository/repository.go`

- [ ] **Step 1: Add the 5 schedule methods to the interface**

Add the following block inside `repository.go` after the `// Invites` section (before the closing `}`):

```go
	// Schedule Events
	GetScheduleEvents(ctx context.Context) ([]models.ScheduleEvent, error)
	CreateScheduleEvent(ctx context.Context, data models.InsertScheduleEvent) (*models.ScheduleEvent, error)
	UpdateScheduleEvent(ctx context.Context, id int, data models.UpdateScheduleEvent) (*models.ScheduleEvent, error)
	DeleteScheduleEvent(ctx context.Context, id int) (bool, error)
	ReorderScheduleEvents(ctx context.Context, items []models.ScheduleOrderItem) error
```

- [ ] **Step 2: Verify it compiles (will fail — implementations missing)**

```bash
cd go-server && go build ./...
```

Expected: errors like `MemoryRepository does not implement Repository (missing GetScheduleEvents method)`. This is correct — the next tasks add the implementations.

---

## Task 4: Memory Repository

**Files:**
- Modify: `go-server/internal/repository/memory.go`

- [ ] **Step 1: Add schedule fields to the MemoryRepository struct**

Find the struct definition (lines 15–35). Add these two fields after `inviteIDSeq`:

```go
	scheduleEvents map[int]models.ScheduleEvent
	scheduleIDSeq  int
```

- [ ] **Step 2: Initialize the map in NewMemoryRepository**

Find the `return &MemoryRepository{` call. Add:

```go
		scheduleEvents: make(map[int]models.ScheduleEvent),
```

- [ ] **Step 3: Add the 5 method implementations**

Append to the end of `memory.go`, before the final blank line:

```go
// ---------------------------------------------------------------------------
// Schedule Events
// ---------------------------------------------------------------------------

func (m *MemoryRepository) GetScheduleEvents(_ context.Context) ([]models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	result := make([]models.ScheduleEvent, 0, len(m.scheduleEvents))
	for _, e := range m.scheduleEvents {
		result = append(result, e)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].SortOrder < result[j].SortOrder
	})
	return result, nil
}

func (m *MemoryRepository) CreateScheduleEvent(_ context.Context, data models.InsertScheduleEvent) (*models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.scheduleIDSeq++
	e := models.ScheduleEvent{
		ID:          m.scheduleIDSeq,
		Title:       data.Title,
		Time:        data.Time,
		Description: data.Description,
		SortOrder:   data.SortOrder,
		CreatedAt:   time.Now().UTC(),
	}
	m.scheduleEvents[e.ID] = e
	return &e, nil
}

func (m *MemoryRepository) UpdateScheduleEvent(_ context.Context, id int, data models.UpdateScheduleEvent) (*models.ScheduleEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e, ok := m.scheduleEvents[id]
	if !ok {
		return nil, nil
	}
	e.Title = data.Title
	e.Time = data.Time
	e.Description = data.Description
	m.scheduleEvents[id] = e
	return &e, nil
}

func (m *MemoryRepository) DeleteScheduleEvent(_ context.Context, id int) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.scheduleEvents[id]; !ok {
		return false, nil
	}
	delete(m.scheduleEvents, id)
	return true, nil
}

func (m *MemoryRepository) ReorderScheduleEvents(_ context.Context, items []models.ScheduleOrderItem) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, item := range items {
		e, ok := m.scheduleEvents[item.ID]
		if !ok {
			continue
		}
		e.SortOrder = item.SortOrder
		m.scheduleEvents[item.ID] = e
	}
	return nil
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd go-server && go build ./...
```

Expected: error only from `postgres.go` (not yet implemented). MemoryRepository errors should be gone.

---

## Task 5: Postgres Repository

**Files:**
- Modify: `go-server/internal/repository/postgres.go`

- [ ] **Step 1: Add the 5 method implementations**

Append to the end of `postgres.go`:

```go
// ---------------------------------------------------------------------------
// Schedule Events
// ---------------------------------------------------------------------------

func (r *PostgresRepository) GetScheduleEvents(ctx context.Context) ([]models.ScheduleEvent, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, title, time, description, sort_order, created_at
		 FROM schedule_events ORDER BY sort_order ASC, id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ScheduleEvent, 0)
	for rows.Next() {
		var e models.ScheduleEvent
		if err := rows.Scan(&e.ID, &e.Title, &e.Time, &e.Description, &e.SortOrder, &e.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, e)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) CreateScheduleEvent(ctx context.Context, data models.InsertScheduleEvent) (*models.ScheduleEvent, error) {
	var e models.ScheduleEvent
	err := r.pool.QueryRow(ctx,
		`INSERT INTO schedule_events (title, time, description, sort_order)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, title, time, description, sort_order, created_at`,
		data.Title, data.Time, data.Description, data.SortOrder,
	).Scan(&e.ID, &e.Title, &e.Time, &e.Description, &e.SortOrder, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *PostgresRepository) UpdateScheduleEvent(ctx context.Context, id int, data models.UpdateScheduleEvent) (*models.ScheduleEvent, error) {
	var e models.ScheduleEvent
	err := r.pool.QueryRow(ctx,
		`UPDATE schedule_events
		 SET title = $1, time = $2, description = $3
		 WHERE id = $4
		 RETURNING id, title, time, description, sort_order, created_at`,
		data.Title, data.Time, data.Description, id,
	).Scan(&e.ID, &e.Title, &e.Time, &e.Description, &e.SortOrder, &e.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *PostgresRepository) DeleteScheduleEvent(ctx context.Context, id int) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM schedule_events WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *PostgresRepository) ReorderScheduleEvents(ctx context.Context, items []models.ScheduleOrderItem) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, item := range items {
		_, err := tx.Exec(ctx,
			`UPDATE schedule_events SET sort_order = $1 WHERE id = $2`,
			item.SortOrder, item.ID)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
```

- [ ] **Step 2: Verify the whole project compiles**

```bash
cd go-server && go build ./...
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/models/schedule_event.go \
        go-server/internal/repository/repository.go \
        go-server/internal/repository/memory.go \
        go-server/internal/repository/postgres.go
git commit -m "feat: add schedule_events repository layer"
```

---

## Task 6: Handler Tests (TDD — write tests first)

**Files:**
- Create: `go-server/internal/handler/schedule_test.go`

- [ ] **Step 1: Create the test file**

```go
// go-server/internal/handler/schedule_test.go
package handler_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// Schedule Events
// ---------------------------------------------------------------------------

func TestScheduleList_Empty(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	events, ok := result["scheduleEvents"].([]interface{})
	if !ok {
		t.Fatalf("expected scheduleEvents array, got keys: %v", mapKeys(result))
	}
	if len(events) != 0 {
		t.Fatalf("expected 0 events, got %d", len(events))
	}
}

func TestScheduleCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title":       "Holy Matrimony",
		"time":        "2:00 PM - 3:00 PM",
		"description": "Exchange of vows and rings",
		"sortOrder":   0,
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	event, ok := result["scheduleEvent"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected scheduleEvent object, keys: %v", mapKeys(result))
	}
	if event["title"] != "Holy Matrimony" {
		t.Fatalf("expected title 'Holy Matrimony', got %v", event["title"])
	}
	assertKeyExists(t, event, "id")
	assertKeyExists(t, event, "sortOrder")
	assertKeyExists(t, event, "createdAt")
}

func TestScheduleCreate_MissingFields(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony",
		// missing time and description
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestScheduleCreate_Unauthorized(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony", "time": "2:00 PM", "description": "vows",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/schedule", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestScheduleList_WithEvents(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	for i, title := range []string{"Holy Matrimony", "Teapai", "Dinner Reception"} {
		body := jsonBody(map[string]interface{}{
			"title": title, "time": "2:00 PM", "description": "desc", "sortOrder": i,
		})
		req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create %s: expected 201, got %d", title, rec.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	events := assertArray(t, result, "scheduleEvents")
	if len(events) != 3 {
		t.Fatalf("expected 3 events, got %d", len(events))
	}

	// Verify camelCase fields on first event
	first := events[0].(map[string]interface{})
	assertKeyExists(t, first, "id")
	assertKeyExists(t, first, "title")
	assertKeyExists(t, first, "time")
	assertKeyExists(t, first, "description")
	assertKeyExists(t, first, "sortOrder")
	assertKeyExists(t, first, "createdAt")
}

func TestScheduleUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create
	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony", "time": "2:00 PM - 3:00 PM", "description": "vows", "sortOrder": 0,
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	result := parseResponse(t, rec)
	id := int(result["scheduleEvent"].(map[string]interface{})["id"].(float64))

	// Update
	updateBody := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony Updated", "time": "3:00 PM - 4:00 PM", "description": "updated",
	})
	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/schedule/%d", id), updateBody, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}

	result2 := parseResponse(t, rec2)
	event := result2["scheduleEvent"].(map[string]interface{})
	if event["title"] != "Holy Matrimony Updated" {
		t.Fatalf("expected updated title, got %v", event["title"])
	}
}

func TestScheduleUpdate_NotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title": "X", "time": "1:00 PM", "description": "desc",
	})
	req := adminRequest(http.MethodPut, "/api/admin/schedule/999", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestScheduleDelete(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create
	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony", "time": "2:00 PM", "description": "vows", "sortOrder": 0,
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	result := parseResponse(t, rec)
	id := int(result["scheduleEvent"].(map[string]interface{})["id"].(float64))

	// Delete
	req2 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/schedule/%d", id), nil, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}

	// Verify gone
	req3 := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec3 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec3, req3)
	result3 := parseResponse(t, rec3)
	events := assertArray(t, result3, "scheduleEvents")
	if len(events) != 0 {
		t.Fatalf("expected 0 events after delete, got %d", len(events))
	}
}

func TestScheduleDelete_NotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodDelete, "/api/admin/schedule/999", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestScheduleReorder(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	var ids []int
	for i, title := range []string{"A", "B", "C"} {
		body := jsonBody(map[string]interface{}{
			"title": title, "time": "2:00 PM", "description": "desc", "sortOrder": i,
		})
		req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
		r := parseResponse(t, rec)
		ids = append(ids, int(r["scheduleEvent"].(map[string]interface{})["id"].(float64)))
	}

	// Reverse order: C(0), B(1), A(2)
	reorderBody := jsonBody(map[string]interface{}{
		"events": []map[string]interface{}{
			{"id": ids[2], "sortOrder": 0},
			{"id": ids[1], "sortOrder": 1},
			{"id": ids[0], "sortOrder": 2},
		},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/schedule/reorder", reorderBody, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// Verify new order
	req2 := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)
	result := parseResponse(t, rec2)
	events := assertArray(t, result, "scheduleEvents")
	first := events[0].(map[string]interface{})
	if first["title"] != "C" {
		t.Fatalf("expected first event to be 'C' after reorder, got %v", first["title"])
	}
}
```

- [ ] **Step 2: Run tests — expect failures (routes not yet registered)**

```bash
cd go-server && go test ./internal/handler -run TestSchedule -v
```

Expected: all tests output `expected 201, got 404` or similar — confirming the tests are live and routes don't exist yet.

---

## Task 7: Handler Implementation

**Files:**
- Create: `go-server/internal/handler/schedule.go`

- [ ] **Step 1: Create the handler file**

```go
// go-server/internal/handler/schedule.go
package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
)

// ScheduleHandler handles schedule event endpoints.
type ScheduleHandler struct {
	Repo repository.Repository
}

// List handles GET /api/schedule.
func (h *ScheduleHandler) List(w http.ResponseWriter, r *http.Request) {
	events, err := h.Repo.GetScheduleEvents(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get schedule events")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"scheduleEvents": events,
	})
}

// Create handles POST /api/admin/schedule.
func (h *ScheduleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertScheduleEvent
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Title == "" || body.Time == "" || body.Description == "" {
		writeError(w, r, http.StatusBadRequest, "title, time, and description are required")
		return
	}

	event, err := h.Repo.CreateScheduleEvent(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create schedule event")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":       "Schedule event created successfully",
		"scheduleEvent": event,
	})
}

// Update handles PUT /api/admin/schedule/{id}.
func (h *ScheduleHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid event ID")
		return
	}

	var body models.UpdateScheduleEvent
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Title == "" || body.Time == "" || body.Description == "" {
		writeError(w, r, http.StatusBadRequest, "title, time, and description are required")
		return
	}

	event, err := h.Repo.UpdateScheduleEvent(r.Context(), id, body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update schedule event")
		return
	}
	if event == nil {
		writeError(w, r, http.StatusNotFound, "Schedule event not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":       "Schedule event updated successfully",
		"scheduleEvent": event,
	})
}

// Delete handles DELETE /api/admin/schedule/{id}.
func (h *ScheduleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid event ID")
		return
	}

	deleted, err := h.Repo.DeleteScheduleEvent(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to delete schedule event")
		return
	}
	if !deleted {
		writeError(w, r, http.StatusNotFound, "Schedule event not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Schedule event deleted successfully",
	})
}

// Reorder handles PATCH /api/admin/schedule/reorder.
func (h *ScheduleHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Events []models.ScheduleOrderItem `json:"events"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(body.Events) == 0 {
		writeError(w, r, http.StatusBadRequest, "events array is required")
		return
	}

	if err := h.Repo.ReorderScheduleEvents(r.Context(), body.Events); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to reorder schedule events")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Schedule events reordered successfully",
	})
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd go-server && go build ./...
```

Expected: no output (success).

---

## Task 8: Register Routes

**Files:**
- Modify: `go-server/internal/router/router.go`

- [ ] **Step 1: Instantiate the handler**

Find the line `welcomeScreen := &handler.WelcomeScreenHandler{...}` (around line 51). Add immediately after it:

```go
	schedule := &handler.ScheduleHandler{Repo: repo}
```

- [ ] **Step 2: Register the public route**

Find `r.Get("/api/welcome-screen", welcomeScreen.Get)` (around line 99). Add after it:

```go
	r.Get("/api/schedule", schedule.List)
```

- [ ] **Step 3: Register the admin routes**

Find `r.Patch("/welcome-screen", welcomeScreen.Update)` (around line 165). Add after it:

```go
			r.Post("/schedule", schedule.Create)
			r.Put("/schedule/{id}", schedule.Update)
			r.Delete("/schedule/{id}", schedule.Delete)
			r.Patch("/schedule/reorder", schedule.Reorder)
```

- [ ] **Step 4: Run all handler tests**

```bash
cd go-server && go test ./internal/handler -v -race -count=1
```

Expected: all tests PASS, no data race detected. Pay attention to the new `TestSchedule*` tests — they must all be green.

- [ ] **Step 5: Run full test suite**

```bash
cd go-server && make test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/handler/schedule.go \
        go-server/internal/handler/schedule_test.go \
        go-server/internal/router/router.go
git commit -m "feat: add schedule handler and routes"
```

---

## Task 9: Update Protected Routes Test

**Files:**
- Modify: `go-server/internal/handler/handler_test.go`

- [ ] **Step 1: Add the 4 new admin schedule routes to the `TestProtectedRoutesRequireAuth` table**

Find the `routes` slice inside `TestProtectedRoutesRequireAuth`. Add these entries:

```go
		{http.MethodPost, "/api/admin/schedule"},
		{http.MethodPut, "/api/admin/schedule/1"},
		{http.MethodDelete, "/api/admin/schedule/1"},
		{http.MethodPatch, "/api/admin/schedule/reorder"},
```

- [ ] **Step 2: Run the test**

```bash
cd go-server && go test ./internal/handler -run TestProtectedRoutesRequireAuth -v
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/handler/handler_test.go
git commit -m "test: add schedule routes to protected-routes test"
```

---

## Task 10: Frontend — Admin SchedulePage

**Files:**
- Create: `client/src/pages/admin/SchedulePage.tsx`

- [ ] **Step 1: Create the page component**

```tsx
// client/src/pages/admin/SchedulePage.tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, Loader2, CalendarDays } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ScheduleEvent {
  id: number;
  title: string;
  time: string;
  description: string;
  sortOrder: number;
  createdAt: string;
}

interface EventFormState {
  title: string;
  time: string;
  description: string;
}

const EMPTY_FORM: EventFormState = { title: "", time: "", description: "" };

function SortableRow({
  event,
  onEdit,
  onDelete,
}: {
  event: ScheduleEvent;
  onEdit: (e: ScheduleEvent) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: event.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-3 rounded-lg border bg-white p-4 shadow-sm transition-opacity ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <button
        className="mt-1 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900">{event.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{event.time}</p>
        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{event.description}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" onClick={() => onEdit(event)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-rose-600 border-rose-200 hover:bg-rose-50"
          onClick={() => onDelete(event.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const { data: queryData, isLoading } = useQuery<{ scheduleEvents: ScheduleEvent[] }>({
    queryKey: ["/api/schedule"],
  });

  useEffect(() => {
    if (queryData?.scheduleEvents) {
      setEvents(queryData.scheduleEvents);
    }
  }, [queryData]);

  const createMutation = useMutation({
    mutationFn: (data: EventFormState & { sortOrder: number }) =>
      apiRequest("POST", "/api/admin/schedule", data).then((r) => r.json()),
    onSuccess: (data: { scheduleEvent: ScheduleEvent }) => {
      setEvents((prev) => [...prev, data.scheduleEvent]);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setForm(EMPTY_FORM);
      setShowForm(false);
      toast({ title: "Event added" });
    },
    onError: (err: Error) => {
      handleAutoLogout(err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EventFormState }) =>
      apiRequest("PUT", `/api/admin/schedule/${id}`, data).then((r) => r.json()),
    onSuccess: (data: { scheduleEvent: ScheduleEvent }) => {
      setEvents((prev) =>
        prev.map((e) => (e.id === data.scheduleEvent.id ? data.scheduleEvent : e))
      );
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      toast({ title: "Event updated" });
    },
    onError: (err: Error) => {
      handleAutoLogout(err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/schedule/${id}`),
    onSuccess: (_, id) => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Event deleted" });
    },
    onError: (err: Error) => {
      handleAutoLogout(err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PATCH", "/api/admin/schedule/reorder", { events: items }),
    onError: (err: Error) => {
      handleAutoLogout(err);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Reorder failed", description: err.message, variant: "destructive" });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = events.findIndex((e) => e.id === active.id);
    const newIndex = events.findIndex((e) => e.id === over.id);
    const newOrder = arrayMove(events, oldIndex, newIndex);
    setEvents(newOrder);
    reorderMutation.mutate(newOrder.map((e, i) => ({ id: e.id, sortOrder: i })));
  }

  function handleEditClick(e: ScheduleEvent) {
    setEditingId(e.id);
    setForm({ title: e.title, time: e.time, description: e.description });
    setShowForm(true);
  }

  function handleDeleteClick(id: number) {
    if (!confirm("Delete this event?")) return;
    deleteMutation.mutate(id);
  }

  function handleSave() {
    if (!form.title.trim() || !form.time.trim() || !form.description.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate({ ...form, sortOrder: events.length });
    }
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-rose-600" />
            <div>
              <CardTitle className="text-xl">Wedding Day Schedule</CardTitle>
              <CardDescription>Drag to reorder events</CardDescription>
            </div>
          </div>
          {!showForm && (
            <Button
              onClick={() => {
                setForm(EMPTY_FORM);
                setEditingId(null);
                setShowForm(true);
              }}
            >
              + Add Event
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={events.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {events.map((event) => (
                  <SortableRow
                    key={event.id}
                    event={event}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {events.length === 0 && !isLoading && !showForm && (
          <p className="text-center text-sm text-gray-400 py-6">
            No events yet. Click "+ Add Event" to get started.
          </p>
        )}

        {showForm && (
          <div className="rounded-lg border border-dashed p-4 space-y-3 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700">
              {editingId !== null ? "Edit Event" : "Add New Event"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sched-title">Title</Label>
                <Input
                  id="sched-title"
                  placeholder="e.g. Holy Matrimony"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sched-time">Time</Label>
                <Input
                  id="sched-time"
                  placeholder="e.g. 2:00 PM – 3:00 PM"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sched-desc">Description</Label>
              <Textarea
                id="sched-desc"
                placeholder="Brief description of this event"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run the TypeScript type check**

```bash
cd /path/to/project && npm run check
```

Expected: no errors related to `SchedulePage.tsx`.

---

## Task 11: Update AdminLayout

**Files:**
- Modify: `client/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Import SchedulePage and add the CalendarDays icon**

At the top of `AdminLayout.tsx`, find the lucide-react import line:

```tsx
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3, TicketCheck, Palette, CalendarClock } from "lucide-react";
```

Add `Calendar` to the import list:

```tsx
import { Loader2, LogOut, Users, MessageSquare, Settings, Mail, Flag, BarChart3, TicketCheck, Palette, CalendarClock, Calendar } from "lucide-react";
```

- [ ] **Step 2: Import SchedulePage**

After the existing page imports, add:

```tsx
import SchedulePage from "./SchedulePage";
```

- [ ] **Step 3: Add Schedule to NAV_ITEMS**

Find the `NAV_ITEMS` array. Add the Schedule item (place it between Dress Code and RSVP Deadline for logical grouping):

```tsx
  { path: "/schedule", label: "Schedule", icon: Calendar },
```

The updated array should be:

```tsx
const NAV_ITEMS = [
  { path: "/rsvps", label: "RSVP", icon: Users },
  { path: "/invites", label: "Invites", icon: TicketCheck },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/config", label: "Configuration", icon: Settings },
  { path: "/welcome", label: "Welcome", icon: Mail },
  { path: "/flags", label: "Flags", icon: Flag },
  { path: "/schedule", label: "Schedule", icon: Calendar },
  { path: "/dress-code", label: "Dress Code", icon: Palette },
  { path: "/rsvp-deadline", label: "RSVP Deadline", icon: CalendarClock },
  { path: "/stats", label: "Statistics", icon: BarChart3 },
];
```

- [ ] **Step 4: Add the route inside the Switch**

Find `<Route path="/dress-code" component={DressCodePage} />`. Add before it:

```tsx
              <Route path="/schedule" component={SchedulePage} />
```

- [ ] **Step 5: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

---

## Task 12: Guest-Facing Changes

**Files:**
- Modify: `client/src/components/DetailsSection.tsx`
- Modify: `client/src/lib/constants.ts`

- [ ] **Step 1: Remove WEDDING_SCHEDULE from constants.ts**

In `client/src/lib/constants.ts`, delete lines 22–38 (the entire `WEDDING_SCHEDULE` export):

```ts
// DELETE this entire block:
export const WEDDING_SCHEDULE = [
  {
    title: "Holy Matrimony",
    time: "2:00 PM - 3:00 PM",
    description: "Exchange of vows and rings in a beautiful ceremony at Casakhasa"
  },
  {
    title: "Teapai",
    time: "4:30 PM - 5:00 PM",
    description: "Traditional tea ceremony with family members"
  },
  {
    title: "Dinner Reception",
    time: "5:30 PM - 8:00 PM",
    description: "Dinner, toasts, and speeches celebrating the newlyweds at Casakhasa"
  }
];
```

- [ ] **Step 2: Update DetailsSection.tsx imports**

At the top of `DetailsSection.tsx`:

Replace:
```tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Car, ParkingSquare } from "lucide-react";
import { WEDDING_SCHEDULE, VENUES, WEDDING_DATE } from "@/lib/constants";
```

With:
```tsx
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Car, ParkingSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { VENUES, WEDDING_DATE } from "@/lib/constants";
```

- [ ] **Step 3: Add the schedule query inside the component**

Inside `DetailsSection`, after the existing `useRef`/`useInView` calls (around line 20), add:

```tsx
  const { data: scheduleData } = useQuery<{ scheduleEvents: Array<{ id: number; title: string; time: string; description: string; sortOrder: number }> }>({
    queryKey: ["/api/schedule"],
  });
  const scheduleEvents = scheduleData?.scheduleEvents ?? [];
```

- [ ] **Step 4: Update the quick-view card in DetailsSection.tsx**

Find the quick-view schedule block (lines 77–100, the `{/* Schedule */}` comment block). Replace the hardcoded two-column grid with one that uses `scheduleEvents`:

```tsx
            {/* Schedule */}
            {scheduleEvents.length > 0 && (
              <div>
                <div className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-4">
                  Schedule
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                  <div className="text-center md:border-r md:border-primary/20 md:pr-8">
                    <div className="text-xl md:text-2xl font-cormorant font-semibold text-primary mb-1">
                      {scheduleEvents[0].title}
                    </div>
                    <div className="text-lg md:text-xl font-cormorant text-foreground">
                      {scheduleEvents[0].time}
                    </div>
                  </div>
                  {scheduleEvents.length > 1 && (
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-cormorant font-semibold text-primary mb-1">
                        {scheduleEvents[scheduleEvents.length - 1].title}
                      </div>
                      <div className="text-lg md:text-xl font-cormorant text-foreground">
                        {scheduleEvents[scheduleEvents.length - 1].time}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
```

- [ ] **Step 5: Update the timeline section in DetailsSection.tsx**

Find the `{/* Schedule */}` block near line 194 and the `{WEDDING_SCHEDULE.map(...)` inside it (around line 215). 

Replace the `WEDDING_SCHEDULE.map(...)` with `scheduleEvents.map(...)` and wrap the whole section in a conditional:

```tsx
        {/* Schedule */}
        {scheduleEvents.length > 0 && (
          <motion.div 
            className="max-w-3xl mx-auto"
            ref={scheduleRef}
            variants={staggerContainer}
            initial="hidden"
            animate={isScheduleInView ? "visible" : "hidden"}
          >
            <motion.h3 
              className="text-4xl md:text-5xl font-cormorant font-bold text-center text-foreground mb-10"
              variants={fadeIn}
            >
              Wedding Day Schedule
            </motion.h3>
            
            <div className="relative">
              <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-primary bg-opacity-30"></div>
              
              <div className="space-y-12">
                {scheduleEvents.map((item, index) => (
                  <motion.div 
                    key={item.id}
                    className="relative flex items-center justify-between"
                    variants={fadeIn}
                    initial="hidden"
                    animate={isScheduleInView ? "visible" : "hidden"}
                    custom={index}
                    transition={{ delay: index * 0.2 }}
                  >
                    <div className="w-5/12 pr-8 text-right">
                      <h4 className="font-cormorant text-xl text-primary">{item.title}</h4>
                      <p className="font-montserrat text-sm text-foreground">{item.time}</p>
                    </div>
                    
                    <motion.div 
                      className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-primary z-10"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.2 + 0.1, duration: 0.5 }}
                    ></motion.div>
                    
                    <div className="w-5/12 pl-8">
                      <p className="font-montserrat text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
```

- [ ] **Step 6: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/SchedulePage.tsx \
        client/src/pages/admin/AdminLayout.tsx \
        client/src/components/DetailsSection.tsx \
        client/src/lib/constants.ts
git commit -m "feat: admin schedule page with drag-and-drop, update guest-facing DetailsSection"
```

---

## Task 13: Full Verification

- [ ] **Step 1: Run all Go tests**

```bash
cd go-server && make test
```

Expected: PASS with no race conditions.

- [ ] **Step 2: Run TypeScript check**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 3: Start backend + frontend**

In terminal 1:
```bash
cd go-server && make run-dev
```

In terminal 2:
```bash
npm run dev
```

- [ ] **Step 4: Smoke-test the admin schedule page**

1. Open `http://localhost:5173/admin`
2. Navigate to **Schedule** in the sidebar
3. Add "Holy Matrimony" / "2:00 PM – 3:00 PM" / "Exchange of vows and rings in a beautiful ceremony at Casakhasa"
4. Add "Teapai" / "4:30 PM – 5:00 PM" / "Traditional tea ceremony with family members"
5. Add "Dinner Reception" / "5:30 PM – 8:00 PM" / "Dinner, toasts, and speeches celebrating the newlyweds at Casakhasa"
6. Drag Teapai to the top — verify it moves
7. Edit "Holy Matrimony" title → save → confirm the title updates in the list
8. Delete one event → confirm it disappears

- [ ] **Step 5: Smoke-test the guest-facing schedule**

1. Open `http://localhost:5173`
2. Scroll to the Details section
3. Verify the "Wedding Day Schedule" timeline shows the 3 events in the correct order
4. Verify the quick-view card at the top of Details shows the first and last events

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: post-integration smoke-test corrections"
```
