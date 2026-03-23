# RSVP Attendance Type Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the RSVP `attending` boolean with `attendanceType` string (both/holy_matrimony/reception/decline) to track per-event attendance.

**Architecture:** Backend-first TDD approach. Update Go models and repository layer, then handler logic with validation and expanded stats. Migrate the database schema. Update shared TypeScript schema. Finally update frontend RSVP form (pill buttons) and admin pages (4 stat cards, 5 filter tabs, event badges).

**Tech Stack:** Go (Chi router, pgx), React 18, TypeScript, Vite, Zod, TanStack React Query, Tailwind CSS, Shadcn/Radix UI

**Spec:** `docs/superpowers/specs/2026-03-23-rsvp-attendance-type-design.md`

---

## Chunk 1: Backend — Model, Repository, Migration

### Task 1: Update Go Model

**Files:**
- Modify: `go-server/internal/models/rsvp.go`

- [ ] **Step 1: Update Rsvp and InsertRsvp structs, add IsAttending helper**

Replace the entire file content with:

```go
package models

// Rsvp represents a guest RSVP record.
type Rsvp struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	AttendanceType string `json:"attendanceType"`
	GuestCount     *int   `json:"guestCount"`
}

// InsertRsvp contains the fields required to create or update an RSVP.
type InsertRsvp struct {
	Name           string `json:"name"`
	Email          string `json:"email"`
	AttendanceType string `json:"attendanceType"`
	GuestCount     *int   `json:"guestCount"`
}

// IsAttending returns true if the guest is attending any event.
func (r Rsvp) IsAttending() bool {
	return r.AttendanceType != "decline"
}

// ValidAttendanceTypes contains the allowed values for AttendanceType.
var ValidAttendanceTypes = map[string]bool{
	"both":           true,
	"holy_matrimony": true,
	"reception":      true,
	"decline":        true,
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd go-server && go build ./internal/models/`
Expected: Compilation errors in files that reference `Attending` — that's expected at this stage, we'll fix them next.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/models/rsvp.go
git commit -m "refactor: replace Attending bool with AttendanceType string in RSVP model"
```

---

### Task 2: Update In-Memory Repository

**Files:**
- Modify: `go-server/internal/repository/memory.go:93-121` (RSVP section only)

- [ ] **Step 1: Update CreateRsvp to use AttendanceType**

In `memory.go`, change the `CreateRsvp` function (line ~93-106):

Replace:
```go
	r := models.Rsvp{
		ID:         m.rsvpIDSeq,
		Name:       data.Name,
		Email:      data.Email,
		Attending:  data.Attending,
		GuestCount: data.GuestCount,
	}
```

With:
```go
	r := models.Rsvp{
		ID:             m.rsvpIDSeq,
		Name:           data.Name,
		Email:          data.Email,
		AttendanceType: data.AttendanceType,
		GuestCount:     data.GuestCount,
	}
```

- [ ] **Step 2: Update UpdateRsvp to use AttendanceType**

In `memory.go`, change the `UpdateRsvp` function (line ~108-121):

Replace:
```go
	r.Name = data.Name
	r.Email = data.Email
	r.Attending = data.Attending
	r.GuestCount = data.GuestCount
```

With:
```go
	r.Name = data.Name
	r.Email = data.Email
	r.AttendanceType = data.AttendanceType
	r.GuestCount = data.GuestCount
```

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/repository/memory.go
git commit -m "refactor: update in-memory repository for AttendanceType field"
```

---

### Task 3: Update PostgreSQL Repository

**Files:**
- Modify: `go-server/internal/repository/postgres.go:76-160` (RSVP section only)

- [ ] **Step 1: Update all RSVP SQL queries from `attending` to `attendance_type`**

In `CreateRsvp` (line ~76-88), replace:
```go
	err := r.pool.QueryRow(ctx,
		`INSERT INTO rsvp (name, email, attending, guest_count)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, name, email, attending, guest_count`,
		data.Name, data.Email, data.Attending, data.GuestCount,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.Attending, &rv.GuestCount)
```

With:
```go
	err := r.pool.QueryRow(ctx,
		`INSERT INTO rsvp (name, email, attendance_type, guest_count)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, name, email, attendance_type, guest_count`,
		data.Name, data.Email, data.AttendanceType, data.GuestCount,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
```

In `UpdateRsvp` (line ~90-105), replace:
```go
	err := r.pool.QueryRow(ctx,
		`UPDATE rsvp SET name = $1, email = $2, attending = $3, guest_count = $4
		 WHERE id = $5
		 RETURNING id, name, email, attending, guest_count`,
		data.Name, data.Email, data.Attending, data.GuestCount, id,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.Attending, &rv.GuestCount)
```

With:
```go
	err := r.pool.QueryRow(ctx,
		`UPDATE rsvp SET name = $1, email = $2, attendance_type = $3, guest_count = $4
		 WHERE id = $5
		 RETURNING id, name, email, attendance_type, guest_count`,
		data.Name, data.Email, data.AttendanceType, data.GuestCount, id,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
```

In `GetRsvps` (line ~107-124), replace all `attending` with `attendance_type` in the SELECT and Scan:
```go
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, attendance_type, guest_count FROM rsvp`)
```
```go
	if err := rows.Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount); err != nil {
```

In `GetRsvpByEmail` (line ~126-138), same pattern:
```go
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, email, attendance_type, guest_count FROM rsvp WHERE email = $1`, email,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
```

In `GetRsvpByName` (line ~140-152), same pattern:
```go
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, email, attendance_type, guest_count FROM rsvp WHERE name = $1`, name,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
```

- [ ] **Step 2: Verify compilation**

Run: `cd go-server && go build ./internal/repository/`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/repository/postgres.go
git commit -m "refactor: update PostgreSQL repository queries for attendance_type column"
```

---

### Task 4: Create Database Migration

**Files:**
- Create: `go-server/migrations/002_attendance_type.sql`

- [ ] **Step 1: Write the migration file**

```sql
BEGIN;

ALTER TABLE rsvp ADD COLUMN attendance_type TEXT NOT NULL DEFAULT 'both';

-- DEFAULT sets all rows to 'both'; fix declined rows explicitly:
UPDATE rsvp SET attendance_type = 'decline' WHERE attending = false;

ALTER TABLE rsvp DROP COLUMN attending;

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add go-server/migrations/002_attendance_type.sql
git commit -m "feat: add migration to replace attending with attendance_type"
```

---

## Chunk 2: Backend — Handler Logic and Tests (TDD)

### Task 5: Write failing handler tests for attendance type validation

**Files:**
- Modify: `go-server/internal/handler/rsvp_test.go`

- [ ] **Step 1: Update existing test and add new validation tests**

Replace the entire file with:

```go
package handler_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRsvp_Create_WithAttendanceType(t *testing.T) {
	tests := []struct {
		name           string
		attendanceType string
		wantStatus     int
	}{
		{"both", "both", http.StatusCreated},
		{"holy_matrimony", "holy_matrimony", http.StatusCreated},
		{"reception", "reception", http.StatusCreated},
		{"decline", "decline", http.StatusCreated},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			env := newTestEnv()
			body := jsonBody(map[string]interface{}{
				"name": "Alice", "email": "alice@test.com",
				"attendanceType": tc.attendanceType, "guestCount": 2,
			})
			req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
			req.Header.Set("Content-Type", "application/json")
			result := contractResponse(t, env, req, tc.wantStatus)

			rsvp := result["rsvp"].(map[string]interface{})
			if rsvp["attendanceType"] != tc.attendanceType {
				t.Fatalf("expected attendanceType=%s, got %v", tc.attendanceType, rsvp["attendanceType"])
			}
		})
	}
}

func TestRsvp_InvalidAttendanceType_Returns400(t *testing.T) {
	env := newTestEnv()
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attendanceType": "party",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestRsvp_Decline_ClearsGuestCount(t *testing.T) {
	env := newTestEnv()
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "decline", "guestCount": 3,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusCreated)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["guestCount"] != nil {
		t.Fatalf("expected guestCount=nil for decline, got %v", rsvp["guestCount"])
	}
}

func TestRsvp_DuplicateEmail_UpdatesAttendanceType(t *testing.T) {
	env := newTestEnv()

	body1 := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "both", "guestCount": 2,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body1)
	req1.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req1, http.StatusCreated)

	body2 := jsonBody(map[string]interface{}{
		"name": "Alice Updated", "email": "alice@test.com",
		"attendanceType": "reception",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body2)
	req2.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req2, http.StatusOK)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice Updated" {
		t.Fatalf("expected updated name, got %v", rsvp["name"])
	}
	if rsvp["attendanceType"] != "reception" {
		t.Fatalf("expected attendanceType=reception, got %v", rsvp["attendanceType"])
	}
}

func TestRsvp_ListStats_IncludesEventCounts(t *testing.T) {
	env := newTestEnv()

	// Create mixed RSVPs
	for _, tc := range []struct {
		name, email, attendanceType string
	}{
		{"Alice", "alice@test.com", "both"},
		{"Bob", "bob@test.com", "holy_matrimony"},
		{"Charlie", "charlie@test.com", "reception"},
		{"Diana", "diana@test.com", "decline"},
	} {
		body := jsonBody(map[string]interface{}{
			"name": tc.name, "email": tc.email,
			"attendanceType": tc.attendanceType, "guestCount": 1,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
		req.Header.Set("Content-Type", "application/json")
		contractResponse(t, env, req, http.StatusCreated)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	stats := result["stats"].(map[string]interface{})

	// total=4, attending=3, notAttending=1
	if stats["total"] != float64(4) {
		t.Fatalf("expected total=4, got %v", stats["total"])
	}
	if stats["attending"] != float64(3) {
		t.Fatalf("expected attending=3, got %v", stats["attending"])
	}
	if stats["notAttending"] != float64(1) {
		t.Fatalf("expected notAttending=1, got %v", stats["notAttending"])
	}
	// holyMatrimonyCount: both + holy_matrimony = 2
	if stats["holyMatrimonyCount"] != float64(2) {
		t.Fatalf("expected holyMatrimonyCount=2, got %v", stats["holyMatrimonyCount"])
	}
	// receptionCount: both + reception = 2
	if stats["receptionCount"] != float64(2) {
		t.Fatalf("expected receptionCount=2, got %v", stats["receptionCount"])
	}
}

func TestRsvp_EmptyBody_Returns400(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", jsonBody(map[string]string{}))
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestRsvp_EmptyList_ReturnsEmptyArray(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	result := contractResponse(t, env, req, http.StatusOK)
	rsvps := result["rsvps"].([]interface{})
	if len(rsvps) != 0 {
		t.Fatalf("expected empty array, got %d items", len(rsvps))
	}
}

func TestRsvp_MalformedJSON_Returns400(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", strings.NewReader("{invalid json"))
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd go-server && go test ./internal/handler/ -run "TestRsvp_Create_WithAttendanceType|TestRsvp_InvalidAttendanceType|TestRsvp_Decline_ClearsGuestCount|TestRsvp_ListStats" -v`
Expected: FAIL — handler doesn't validate `attendanceType` yet, stats don't include event counts.

---

### Task 6: Implement handler changes to make tests pass

**Files:**
- Modify: `go-server/internal/handler/rsvp.go`

- [ ] **Step 1: Add attendanceType validation to Create handler**

In `rsvp.go`, after the `if body.Name == "" || body.Email == ""` check (line ~27-30), add:

```go
	if !models.ValidAttendanceTypes[body.AttendanceType] {
		writeError(w, r, http.StatusBadRequest, "Invalid attendance type. Must be: both, holy_matrimony, reception, or decline")
		return
	}

	// Force guestCount to nil for declined RSVPs
	if body.AttendanceType == "decline" {
		body.GuestCount = nil
	}
```

- [ ] **Step 2: Update List handler stats computation**

In `rsvp.go`, replace the stats computation block (line ~82-99) with:

```go
	// Calculate stats
	total := len(rsvps)
	attending := 0
	notAttending := 0
	guestCount := 0
	holyMatrimonyCount := 0
	receptionCount := 0

	for _, rsvp := range rsvps {
		if rsvp.IsAttending() {
			attending++
			if rsvp.GuestCount != nil {
				guestCount += *rsvp.GuestCount
			} else {
				guestCount += 1
			}
		} else {
			notAttending++
		}

		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "holy_matrimony" {
			holyMatrimonyCount++
		}
		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "reception" {
			receptionCount++
		}
	}
```

Also update the stats map in the `writeJSON` call (line ~101-109):

```go
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rsvps": rsvps,
		"stats": map[string]int{
			"total":               total,
			"attending":           attending,
			"notAttending":        notAttending,
			"guestCount":          guestCount,
			"holyMatrimonyCount":  holyMatrimonyCount,
			"receptionCount":      receptionCount,
		},
	})
```

- [ ] **Step 3: Run all RSVP tests**

Run: `cd go-server && go test ./internal/handler/ -run "TestRsvp" -v -race`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add go-server/internal/handler/rsvp.go go-server/internal/handler/rsvp_test.go
git commit -m "feat: add attendanceType validation and per-event stats to RSVP handler"
```

---

### Task 7: Update contract tests

**Files:**
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Update `createRsvp` helper signature**

Find the `createRsvp` function (line ~174-190) and replace it with:

```go
// createRsvp is a shortcut to POST /api/rsvp for setup.
func createRsvp(t *testing.T, env *testEnv, name, email string, attendanceType string, guestCount *int) {
	t.Helper()
	payload := map[string]interface{}{
		"name": name, "email": email, "attendanceType": attendanceType,
	}
	if guestCount != nil {
		payload["guestCount"] = *guestCount
	}
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", jsonBody(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("createRsvp: unexpected status %d: %s", rec.Code, rec.Body.String())
	}
}
```

- [ ] **Step 2: Update `assertRsvpObject` to expect `attendanceType` string**

Find `assertRsvpObject` (line ~249-256) and replace:

```go
	assertKeyType(t, obj, "attending", "bool")
```

With:

```go
	assertKeyType(t, obj, "attendanceType", "string")
```

- [ ] **Step 3: Update all `createRsvp` call sites**

Replace all calls from `createRsvp(t, env, name, email, true/false, gc)` to `createRsvp(t, env, name, email, "both"/"decline", gc)`.

Specifically, search for all instances of `createRsvp(t, env,` and change:
- `true` → `"both"`
- `false` → `"decline"`

- [ ] **Step 4: Update all `assertBoolValue(t, rsvp, "attending", ...)` assertions**

Replace:
- `assertBoolValue(t, rsvp, "attending", true)` → `assertStringValue(t, rsvp, "attendanceType", "both")`
- `assertBoolValue(t, rsvp, "attending", false)` → `assertStringValue(t, rsvp, "attendanceType", "decline")`

Also update the contract test for the POST /api/rsvp that sends `"attending": true` — change payload to `"attendanceType": "both"`.

Also update the stats contract assertions to include:
```go
	assertKeyType(t, stats, "holyMatrimonyCount", "float64")
	assertKeyType(t, stats, "receptionCount", "float64")
```

- [ ] **Step 5: Run all contract tests**

Run: `cd go-server && go test ./internal/handler/ -v -race`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/handler/contract_test.go
git commit -m "test: update contract tests for attendanceType field"
```

---

## Chunk 3: Shared Schema and Frontend RSVP Form

### Task 8: Update shared schema

**Files:**
- Modify: `shared/schema.ts`

- [ ] **Step 1: Replace `attending` with `attendanceType` in the rsvp table and insertRsvpSchema**

In `shared/schema.ts`, replace (line ~11-29):

```typescript
export const rsvp = pgTable("rsvp", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  attending: boolean("attending").notNull(),
  guestCount: integer("guest_count"),
});
```

With:

```typescript
export const rsvp = pgTable("rsvp", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  attendanceType: text("attendance_type").notNull().default("both"),
  guestCount: integer("guest_count"),
});
```

And replace (line ~24-29):

```typescript
export const insertRsvpSchema = createInsertSchema(rsvp).pick({
  name: true,
  email: true,
  attending: true,
  guestCount: true,
});
```

With:

```typescript
export const insertRsvpSchema = createInsertSchema(rsvp).pick({
  name: true,
  email: true,
  attendanceType: true,
  guestCount: true,
});
```

- [ ] **Step 2: Run TypeScript check to see what breaks**

Run: `npm run check`
Expected: Type errors in files referencing `rsvp.attending` — that's expected.

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "refactor: replace attending with attendanceType in shared schema"
```

---

### Task 9: Update MSW mock handlers

**Files:**
- Modify: `client/src/test/mocks/handlers.ts`

- [ ] **Step 1: Update RSVP POST mock to use attendanceType**

In `handlers.ts`, replace (line ~44-49):

```typescript
  http.post("/api/rsvp", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      message: "Thank you for your RSVP!",
      rsvp: { id: 1, ...body, attending: true },
    }, { status: 201 });
  }),
```

With:

```typescript
  http.post("/api/rsvp", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      message: "Thank you for your RSVP!",
      rsvp: { id: 1, ...body },
    }, { status: 201 });
  }),
```

- [ ] **Step 2: Commit**

```bash
git add client/src/test/mocks/handlers.ts
git commit -m "fix: update MSW mock to stop overriding attending field"
```

---

### Task 10: Write failing RSVP form tests, then implement

**Files:**
- Modify: `client/src/components/__tests__/RsvpSection.test.tsx`
- Modify: `client/src/components/RsvpSection.tsx`

- [ ] **Step 1: Update RsvpSection tests**

Replace the entire test file with:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    form: ({ children, onSubmit, ...props }: any) => (
      <form onSubmit={onSubmit} {...props}>{children}</form>
    ),
    button: ({ children, ...props }: any) => {
      const { whileHover, whileTap, ...htmlProps } = props;
      return <button {...htmlProps}>{children}</button>;
    },
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
  },
  useInView: () => true,
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

// Mock useToast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

import RsvpSection from "../RsvpSection";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderRsvpSection() {
  const qc = createTestQueryClient();
  qc.setQueryData(["/api/rsvp/check", ""], { exists: false, rsvp: null });
  return render(
    <QueryClientProvider client={qc}>
      <RsvpSection />
    </QueryClientProvider>
  );
}

describe("RsvpSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      value: { search: "", href: "http://localhost" },
      writable: true,
    });
  });

  it("renders form fields (name, email, guest count)", () => {
    renderRsvpSection();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of guests/i)).toBeInTheDocument();
  });

  it("renders attendance type pill buttons", () => {
    renderRsvpSection();
    expect(screen.getByRole("button", { name: /both/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /holy matrimony/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reception/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /decline/i })).toBeInTheDocument();
  });

  it("hides guest count when Decline is selected", async () => {
    renderRsvpSection();
    const declineBtn = screen.getByRole("button", { name: /decline/i });
    fireEvent.click(declineBtn);
    await waitFor(() => {
      expect(screen.queryByLabelText(/number of guests/i)).not.toBeInTheDocument();
    });
  });

  it("shows guest count for non-decline attendance types", () => {
    renderRsvpSection();
    // "Both" is default, guest count should be visible
    expect(screen.getByLabelText(/number of guests/i)).toBeInTheDocument();
  });

  it("shows validation error when required fields are empty", async () => {
    renderRsvpSection();
    const nameInput = screen.getByLabelText(/^name$/i);
    fireEvent.change(nameInput, { target: { value: "" } });
    const submitButton = screen.getByTestId("button-submit-rsvp");
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it("submits with attendanceType in payload", async () => {
    let capturedBody: any;
    const originalFetch = global.fetch;
    global.fetch = vi.fn((url, options) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr.includes("/api/rsvp") && options?.method === "POST") {
        capturedBody = JSON.parse(options.body as string);
        return Promise.resolve(
          new Response(
            JSON.stringify({ message: "Thank you!", rsvp: { id: 1, attendanceType: "both" } }),
            { status: 201, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (urlStr.includes("/api/rsvp/check")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ exists: false, rsvp: null }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as any;

    renderRsvpSection();

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "John Doe" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "john@example.com" } });

    const submitButton = screen.getByTestId("button-submit-rsvp");
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(capturedBody).toBeDefined();
      expect(capturedBody.attendanceType).toBe("both");
      expect(capturedBody).not.toHaveProperty("attending");
    });

    global.fetch = originalFetch;
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run client/src/components/__tests__/RsvpSection.test.tsx`
Expected: FAIL — pill buttons don't exist yet.

- [ ] **Step 3: Update RsvpSection.tsx with pill buttons and attendanceType**

In `RsvpSection.tsx`, make these changes:

**a)** Replace the schema (line ~14-19):

```typescript
const rsvpSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  attendanceType: z.enum(["both", "holy_matrimony", "reception", "decline"]),
  guestCount: z.number().optional()
});
```

**b)** Update `defaultValues` (line ~39-44):

```typescript
    defaultValues: {
      name: "",
      email: "",
      attendanceType: "both",
      guestCount: 1
    }
```

**c)** Replace `handleAttendanceChange` (line ~73-83) with:

```typescript
  const handleAttendanceChange = (type: "both" | "holy_matrimony" | "reception" | "decline") => {
    setValue("attendanceType", type);
    setShowGuestOptions(type !== "decline");

    if (type === "decline") {
      setValue("guestCount", undefined);
    } else if (!showGuestOptions) {
      setValue("guestCount", 1);
    }
  };
```

**d)** Replace the Attendance radio buttons section (line ~241-266) with pill buttons:

```tsx
              {/* Attendance Type */}
              <div>
                <label className="block text-foreground font-montserrat text-sm mb-4">Will you be joining us?</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "both", label: "Both" },
                    { value: "holy_matrimony", label: "Holy Matrimony" },
                    { value: "reception", label: "Reception" },
                    { value: "decline", label: "Regretfully Decline" },
                  ] as const).map((option) => {
                    const isActive = showGuestOptions
                      ? option.value !== "decline" && option.value === (document.querySelector<HTMLInputElement>('[name="attendanceType"]')?.value || "both")
                      : option.value === "decline";
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleAttendanceChange(option.value)}
                        className={`px-4 py-2 rounded-full font-montserrat text-sm transition-all duration-200 ${
                          option.value === watch("attendanceType")
                            ? "bg-primary text-white shadow-md"
                            : option.value === "decline"
                            ? "border border-gray-200 text-gray-400 hover:border-gray-300"
                            : "border border-gray-300 text-foreground hover:border-primary/50"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
```

Note: You need to add `watch` to the useForm destructure (line ~37):

```typescript
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RsvpFormValues>({
```

**e)** Update the already-RSVP'd thank-you message (line ~202-204) to reflect attendance type:

```tsx
                <p className="text-foreground font-montserrat">
                  {rsvpCheck.rsvp?.attendanceType && rsvpCheck.rsvp.attendanceType !== "decline"
                    ? `We've received your RSVP for the ${
                        rsvpCheck.rsvp.attendanceType === "both"
                          ? "Holy Matrimony and Reception"
                          : rsvpCheck.rsvp.attendanceType === "holy_matrimony"
                          ? "Holy Matrimony"
                          : "Reception"
                      } and look forward to celebrating with you.`
                    : "We've already received your RSVP."}
                </p>
```

**f)** Wrap the confetti block in the `onSuccess` callback with a conditional check. After `setIsSubmitted(true);` and before the confetti block, add a variable to capture attendance type, then wrap the confetti in a check:

```typescript
    onSuccess: (data) => {
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/check', guestName] });

      // Only fire confetti for attending guests
      if (data.rsvp?.attendanceType !== "decline") {
        // ... existing confetti code ...
      }

      toast({
        title: "RSVP Submitted",
        description: "Thank you for your response!",
        variant: "default"
      });
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/components/__tests__/RsvpSection.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/components/RsvpSection.tsx client/src/components/__tests__/RsvpSection.test.tsx
git commit -m "feat: replace attendance radio with pill buttons for attendanceType"
```

---

## Chunk 4: Frontend Admin Pages

### Task 11: Write failing admin RsvpPage tests, then implement

**Files:**
- Modify: `client/src/pages/admin/__tests__/RsvpPage.test.tsx`
- Modify: `client/src/pages/admin/RsvpPage.tsx`

- [ ] **Step 1: Update RsvpPage test mock data and assertions**

Replace the entire test file with:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockAutoLogout = vi.fn();
vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: mockAutoLogout }),
  AdminContext: { Provider: ({ children }: any) => children },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/rsvps", vi.fn()],
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import RsvpPage from "../RsvpPage";

const mockRsvpData = {
  rsvps: [
    { id: 1, name: "Alice", email: "alice@test.com", attendanceType: "both", guestCount: 2 },
    { id: 2, name: "Bob", email: "bob@test.com", attendanceType: "holy_matrimony", guestCount: 1 },
    { id: 3, name: "Charlie", email: "charlie@test.com", attendanceType: "reception", guestCount: 3 },
    { id: 4, name: "Diana", email: "diana@test.com", attendanceType: "decline", guestCount: null },
  ],
  stats: {
    total: 4, attending: 3, notAttending: 1, guestCount: 6,
    holyMatrimonyCount: 2, receptionCount: 2,
  },
};

function createTestQueryClient(data: any = mockRsvpData) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["/api/rsvp"], data);
  return client;
}

function renderRsvpPage(queryClient?: QueryClient) {
  const qc = queryClient ?? createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}><RsvpPage /></QueryClientProvider>
  );
}

describe("RsvpPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders 4 stat cards", () => {
    renderRsvpPage();
    expect(screen.getByText("Holy Matrimony RSVPs")).toBeInTheDocument();
    expect(screen.getByText("Reception RSVPs")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("Total Expected Guests")).toBeInTheDocument();
  });

  it("renders correct stat values", () => {
    renderRsvpPage();
    // holyMatrimonyCount=2, receptionCount=2, notAttending=1, guestCount=6
    expect(screen.getByText("2", { selector: '[data-testid="stat-holy-matrimony"] *' })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: '[data-testid="stat-reception"] *' })).toBeInTheDocument();
    expect(screen.getByText("1", { selector: '[data-testid="stat-declined"] *' })).toBeInTheDocument();
    expect(screen.getByText("6", { selector: '[data-testid="stat-total-guests"] *' })).toBeInTheDocument();
  });

  it("renders 5 filter tabs", () => {
    renderRsvpPage();
    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Holy Matrimony" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Reception" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Both" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Declined" })).toBeInTheDocument();
  });

  it("renders RSVP entries with names and emails", () => {
    renderRsvpPage();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("alice@test.com")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Diana")).toBeInTheDocument();
  });

  it("shows event-specific badges", () => {
    renderRsvpPage();
    // Alice has "both" => two badges
    const holyMatrimonyBadges = screen.getAllByText("Holy Matrimony");
    expect(holyMatrimonyBadges.length).toBeGreaterThanOrEqual(1);
    const receptionBadges = screen.getAllByText("Reception");
    expect(receptionBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Declined").length).toBeGreaterThanOrEqual(1);
  });

  it("filters by Holy Matrimony tab (includes both)", async () => {
    renderRsvpPage();
    const tab = screen.getByRole("tab", { name: "Holy Matrimony" });
    await userEvent.click(tab);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument(); // both
      expect(screen.getByText("Bob")).toBeInTheDocument(); // holy_matrimony
      expect(screen.queryByText("Charlie")).not.toBeInTheDocument(); // reception only
      expect(screen.queryByText("Diana")).not.toBeInTheDocument(); // decline
    });
  });

  it("filters by Reception tab (includes both)", async () => {
    renderRsvpPage();
    const tab = screen.getByRole("tab", { name: "Reception" });
    await userEvent.click(tab);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument(); // both
      expect(screen.getByText("Charlie")).toBeInTheDocument(); // reception
      expect(screen.queryByText("Bob")).not.toBeInTheDocument(); // holy_matrimony only
      expect(screen.queryByText("Diana")).not.toBeInTheDocument(); // decline
    });
  });

  it("shows empty state when no RSVPs", () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    qc.setQueryData(["/api/rsvp"], {
      rsvps: [],
      stats: { total: 0, attending: 0, notAttending: 0, guestCount: 0, holyMatrimonyCount: 0, receptionCount: 0 },
    });
    renderRsvpPage(qc);
    expect(screen.getByText("No RSVP responses yet")).toBeInTheDocument();
  });

  it("renders search input", () => {
    renderRsvpPage();
    expect(screen.getByTestId("rsvp-search-input")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    renderRsvpPage();
    const input = screen.getByTestId("rsvp-search-input");
    await userEvent.type(input, "Alice");
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run client/src/pages/admin/__tests__/RsvpPage.test.tsx`
Expected: FAIL — old mock data shape, missing stat cards, missing filter tabs.

- [ ] **Step 3: Implement RsvpPage changes**

Rewrite `client/src/pages/admin/RsvpPage.tsx` with these changes:

**a)** Update `RsvpResponse` interface (line ~16-19):

```typescript
interface RsvpResponse {
  rsvps: Rsvp[];
  stats: {
    total: number;
    attending: number;
    notAttending: number;
    guestCount: number;
    holyMatrimonyCount: number;
    receptionCount: number;
  };
}
```

**b)** Update `calculateAttendance` (line ~21-36) to use `attendanceType`:

```typescript
function calculateAttendance(rsvps: Rsvp[]) {
  let attending = 0;
  let notAttending = 0;
  let totalGuests = 0;

  rsvps.forEach((rsvp) => {
    if (rsvp.attendanceType !== "decline") {
      attending++;
      totalGuests += rsvp.guestCount || 1;
    } else {
      notAttending++;
    }
  });

  return { attending, notAttending, totalGuests };
}
```

**c)** Change filter state type (line ~75):

```typescript
  const [attendingFilter, setAttendingFilter] = useState<
    "all" | "holy_matrimony" | "reception" | "both" | "declined"
  >("all");
```

**d)** Update filter logic in `filteredRsvps` (line ~78-92):

```typescript
  const filteredRsvps = useMemo(() => {
    return rsvps.filter((rsvp) => {
      const matchesSearch =
        !debouncedSearch ||
        rsvp.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        rsvp.email.toLowerCase().includes(debouncedSearch.toLowerCase());

      let matchesFilter = true;
      if (attendingFilter === "holy_matrimony") {
        matchesFilter = rsvp.attendanceType === "both" || rsvp.attendanceType === "holy_matrimony";
      } else if (attendingFilter === "reception") {
        matchesFilter = rsvp.attendanceType === "both" || rsvp.attendanceType === "reception";
      } else if (attendingFilter === "both") {
        matchesFilter = rsvp.attendanceType === "both";
      } else if (attendingFilter === "declined") {
        matchesFilter = rsvp.attendanceType === "decline";
      }

      return matchesSearch && matchesFilter;
    });
  }, [rsvps, debouncedSearch, attendingFilter]);
```

**e)** Replace the 2 stat cards (line ~109-151) with 4 stat cards. Use `data?.stats` from the API:

```tsx
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-lg" data-testid="stat-holy-matrimony">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.holyMatrimonyCount ?? 0}
            </CardTitle>
            <CardDescription className="text-rose-100">Holy Matrimony RSVPs</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-purple-400 to-indigo-500 text-white shadow-lg" data-testid="stat-reception">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.receptionCount ?? 0}
            </CardTitle>
            <CardDescription className="text-purple-100">Reception RSVPs</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg" data-testid="stat-declined">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.notAttending ?? 0}
            </CardTitle>
            <CardDescription className="text-gray-200">Declined</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-gradient-to-r from-pink-400 to-rose-500 text-white shadow-lg" data-testid="stat-total-guests">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl font-bold text-white">
              {data?.stats.guestCount ?? 0}
            </CardTitle>
            <CardDescription className="text-pink-100">Total Expected Guests</CardDescription>
          </CardHeader>
        </Card>
      </div>
```

**f)** Replace the 3 filter tabs (line ~174-183) with 5 tabs:

```tsx
        <Tabs
          value={attendingFilter}
          onValueChange={(v) => setAttendingFilter(v as typeof attendingFilter)}
        >
          <TabsList data-testid="rsvp-filter-tabs">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="holy_matrimony">Holy Matrimony</TabsTrigger>
            <TabsTrigger value="reception">Reception</TabsTrigger>
            <TabsTrigger value="both">Both</TabsTrigger>
            <TabsTrigger value="declined">Declined</TabsTrigger>
          </TabsList>
        </Tabs>
```

**g)** Replace the single attendance badge (line ~214-233) with event-specific badges:

```tsx
                    <div className="flex gap-1 flex-wrap">
                      {(rsvp.attendanceType === "both" || rsvp.attendanceType === "holy_matrimony") && (
                        <Badge className="w-fit bg-rose-100 text-rose-800 border-rose-200" variant="outline">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Holy Matrimony
                          </div>
                        </Badge>
                      )}
                      {(rsvp.attendanceType === "both" || rsvp.attendanceType === "reception") && (
                        <Badge className="w-fit bg-purple-100 text-purple-800 border-purple-200" variant="outline">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Reception
                          </div>
                        </Badge>
                      )}
                      {rsvp.attendanceType === "decline" && (
                        <Badge className="w-fit bg-red-100 text-red-800 border-red-200" variant="outline">
                          <div className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            Declined
                          </div>
                        </Badge>
                      )}
                    </div>
```

**h)** Update the guest count display condition (line ~237):

Replace `rsvp.attending && rsvp.guestCount` with `rsvp.attendanceType !== "decline" && rsvp.guestCount`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/pages/admin/__tests__/RsvpPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/RsvpPage.tsx client/src/pages/admin/__tests__/RsvpPage.test.tsx
git commit -m "feat: update admin RsvpPage with 4 stat cards, 5 filter tabs, event badges"
```

---

### Task 12: Update StatsPage

**Files:**
- Modify: `client/src/pages/admin/__tests__/StatsPage.test.tsx`
- Modify: `client/src/pages/admin/StatsPage.tsx`

- [ ] **Step 1: Update StatsPage test mock data**

Replace the entire test file with:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../AdminContext", () => ({
  useAdminContext: () => ({ handleAutoLogout: vi.fn() }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/stats", vi.fn()],
}));

import StatsPage from "../StatsPage";

const mockRsvpData = {
  rsvps: [
    { id: 1, name: "Alice", attendanceType: "both", guestCount: 3 },
    { id: 2, name: "Bob", attendanceType: "holy_matrimony", guestCount: 2 },
    { id: 3, name: "Carol", attendanceType: "decline", guestCount: null },
  ],
};

function renderStatsPage(data = mockRsvpData) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  qc.setQueryData(["/api/rsvp"], data);
  return render(
    <QueryClientProvider client={qc}><StatsPage /></QueryClientProvider>
  );
}

describe("StatsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders attending count", () => {
    renderStatsPage();
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 attending (Alice + Bob)
    expect(screen.getByText("Confirmed Attending")).toBeInTheDocument();
  });

  it("renders not attending count", () => {
    renderStatsPage();
    expect(screen.getByText("1")).toBeInTheDocument(); // 1 not attending (Carol)
    expect(screen.getByText("Not Attending")).toBeInTheDocument();
  });

  it("renders total guest count", () => {
    renderStatsPage();
    expect(screen.getByText("5")).toBeInTheDocument(); // 3 + 2
    expect(screen.getByText("Total Expected Guests")).toBeInTheDocument();
  });

  it("renders attendance rate percentage", () => {
    renderStatsPage();
    expect(screen.getByText("67%")).toBeInTheDocument(); // 2/3 = 67%
  });

  it("renders total responses", () => {
    renderStatsPage();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Total Responses")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run client/src/pages/admin/__tests__/StatsPage.test.tsx`
Expected: FAIL — `calculateAttendance` still checks `rsvp.attending`.

- [ ] **Step 3: Update StatsPage.tsx calculateAttendance function**

In `StatsPage.tsx`, replace the `calculateAttendance` function (line ~7-19):

```typescript
function calculateAttendance(rsvps: Rsvp[]) {
  let attending = 0;
  let notAttending = 0;
  let totalGuests = 0;
  rsvps.forEach((rsvp) => {
    if (rsvp.attendanceType !== "decline") {
      attending++;
      totalGuests += rsvp.guestCount || 1;
    } else {
      notAttending++;
    }
  });
  return { attending, notAttending, totalGuests };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run client/src/pages/admin/__tests__/StatsPage.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/StatsPage.tsx client/src/pages/admin/__tests__/StatsPage.test.tsx
git commit -m "fix: update StatsPage calculateAttendance for attendanceType"
```

---

## Chunk 5: Final Verification

### Task 13: Run full test suites

- [ ] **Step 1: Run all backend tests**

Run: `cd go-server && go test ./... -v -race -count=1`
Expected: ALL PASS

- [ ] **Step 2: Run all frontend tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3: Run TypeScript check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Run Go lint**

Run: `cd go-server && make lint`
Expected: No lint errors

- [ ] **Step 5: Final commit if any remaining fixes**

Only if fixes were needed in steps 1-4.
