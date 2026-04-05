# CSV Bulk Invite Import — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CSV upload flow to the admin Invites page so the user can bulk-import guest names from a Google Sheets export.

**Architecture:** Frontend-only CSV parsing (browser `FileReader` + RFC 4180 parser) sends confirmed names to a new `POST /api/admin/invites/bulk` endpoint. The Go backend validates, sanitizes, and inserts all invites in a single transaction.

**Tech Stack:** Go (Chi router, pgx), React 18, TypeScript, TanStack Query, Shadcn UI, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-05-csv-bulk-invite-import-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `go-server/internal/models/invite.go` | Add `BulkCreateInvitesRequest` struct |
| Modify | `go-server/internal/repository/repository.go` | Add `CreateInvitesBulk` to interface |
| Modify | `go-server/internal/repository/memory.go` | Implement `CreateInvitesBulk` for in-memory store |
| Modify | `go-server/internal/repository/postgres.go` | Implement `CreateInvitesBulk` with transaction + code-collision retry |
| Modify | `go-server/internal/handler/invite.go` | Add `BulkCreate` handler method |
| Modify | `go-server/internal/router/router.go` | Register `POST /api/admin/invites/bulk` route |
| Modify | `go-server/internal/handler/invite_test.go` | Add bulk create handler tests |
| Modify | `go-server/internal/repository/memory_test.go` | Add `CreateInvitesBulk` repository tests |
| Modify | `go-server/internal/handler/contract_test.go` | Add bulk response contract test |
| Modify | `client/src/pages/admin/InvitesPage.tsx` | Add CSV import card with upload → preview → confirm flow |

---

## Chunk 1: Backend — Model + Repository

### Task 1: Add `BulkCreateInvitesRequest` model

**Files:**
- Modify: `go-server/internal/models/invite.go:18-21`

- [ ] **Step 1: Add the request struct**

Add after `InsertInvite` in `go-server/internal/models/invite.go`:

```go
// BulkCreateInvitesRequest is the request body for bulk invite creation.
type BulkCreateInvitesRequest struct {
	Names []string `json:"names"`
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd go-server && go build ./...`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/models/invite.go
git commit -m "feat(invite): add BulkCreateInvitesRequest model"
```

---

### Task 2: Add `CreateInvitesBulk` to repository interface

**Files:**
- Modify: `go-server/internal/repository/repository.go:72`

- [ ] **Step 1: Add the method signature**

Add after the `UpdateInviteRsvpID` line (line 72) in the `Repository` interface:

```go
	CreateInvitesBulk(ctx context.Context, data []InsertInvite) ([]Invite, error)
```

Note: Use `models.InsertInvite` and `models.Invite` — the full import path prefix is already in the file. The actual types in the interface use the `models.` prefix.

- [ ] **Step 2: Verify it compiles (expect compile errors)**

Run: `cd go-server && go build ./...`
Expected: Compile errors — `MemoryRepository` and `PostgresRepository` don't implement `CreateInvitesBulk` yet. This is correct.

---

### Task 3: Implement `CreateInvitesBulk` in memory repository

**Files:**
- Modify: `go-server/internal/repository/memory.go` (add after `UpdateInviteRsvpID` at line 770)
- Test: `go-server/internal/repository/memory_test.go`

- [ ] **Step 1: Write the failing test**

Add to the end of `go-server/internal/repository/memory_test.go`:

```go
// ---------------------------------------------------------------------------
// Invite Bulk tests
// ---------------------------------------------------------------------------

func TestCreateInvitesBulk(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	names := []models.InsertInvite{
		{Name: "Alice"},
		{Name: "Bob"},
		{Name: "Charlie"},
	}

	invites, err := repo.CreateInvitesBulk(ctx, names)
	if err != nil {
		t.Fatalf("CreateInvitesBulk returned error: %v", err)
	}
	if len(invites) != 3 {
		t.Fatalf("expected 3 invites, got %d", len(invites))
	}

	// Verify each invite has correct name, unique code, and sequential IDs
	codes := make(map[string]bool)
	for i, inv := range invites {
		if inv.Name != names[i].Name {
			t.Fatalf("invite %d: expected name %q, got %q", i, names[i].Name, inv.Name)
		}
		if len(inv.Code) != 5 {
			t.Fatalf("invite %d: expected 5-char code, got %q", i, inv.Code)
		}
		if codes[inv.Code] {
			t.Fatalf("invite %d: duplicate code %q", i, inv.Code)
		}
		codes[inv.Code] = true
		if inv.ID == 0 {
			t.Fatalf("invite %d: expected non-zero ID", i)
		}
		if inv.CreatedAt == "" {
			t.Fatalf("invite %d: expected non-empty CreatedAt", i)
		}
	}

	// Verify all invites are retrievable via GetInvites
	all, err := repo.GetInvites(ctx)
	if err != nil {
		t.Fatalf("GetInvites returned error: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("expected 3 invites from GetInvites, got %d", len(all))
	}
}

func TestCreateInvitesBulk_Empty(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	invites, err := repo.CreateInvitesBulk(ctx, []models.InsertInvite{})
	if err != nil {
		t.Fatalf("CreateInvitesBulk with empty slice returned error: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected 0 invites, got %d", len(invites))
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/repository -run TestCreateInvitesBulk -v`
Expected: FAIL — `CreateInvitesBulk` not implemented

- [ ] **Step 3: Write the implementation**

Add to the end of the Invites section in `go-server/internal/repository/memory.go` (after `UpdateInviteRsvpID`):

```go
func (m *MemoryRepository) CreateInvitesBulk(_ context.Context, data []models.InsertInvite) ([]models.Invite, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	result := make([]models.Invite, 0, len(data))
	for _, d := range data {
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
			Name:      d.Name,
			Code:      code,
			CreatedAt: now(),
		}
		m.invites[inv.ID] = inv
		result = append(result, inv)
	}
	return result, nil
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd go-server && go test ./internal/repository -run TestCreateInvitesBulk -v`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/repository/repository.go go-server/internal/repository/memory.go go-server/internal/repository/memory_test.go
git commit -m "feat(invite): add CreateInvitesBulk to repository interface and memory impl"
```

---

### Task 4: Implement `CreateInvitesBulk` in Postgres repository

**Files:**
- Modify: `go-server/internal/repository/postgres.go` (add after the existing `CreateInvite` method around line 789)

- [ ] **Step 1: Write the implementation**

Add after the existing `CreateInvite` method in `go-server/internal/repository/postgres.go`:

**Important:** In PostgreSQL, a failed query inside a transaction aborts the transaction. The existing single `CreateInvite` does NOT use a transaction, so its retry loop works. For bulk insert within a transaction, we must use SAVEPOINTs so a unique constraint violation can be rolled back without poisoning the outer transaction.

```go
func (r *PostgresRepository) CreateInvitesBulk(ctx context.Context, data []models.InsertInvite) ([]models.Invite, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	result := make([]models.Invite, 0, len(data))
	for i, d := range data {
		var inv models.Invite
		var createdAt time.Time
		inserted := false
		sp := fmt.Sprintf("sp_%d", i)

		for attempt := 0; attempt < 3; attempt++ {
			code := models.GenerateInviteCode()

			if _, err := tx.Exec(ctx, "SAVEPOINT "+sp); err != nil {
				return nil, fmt.Errorf("savepoint %s: %w", sp, err)
			}

			err := tx.QueryRow(ctx,
				`INSERT INTO invites (name, code)
				 VALUES ($1, $2)
				 RETURNING id, name, code, rsvp_id, created_at`,
				d.Name, code,
			).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt)
			if err != nil {
				if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
					tx.Exec(ctx, "ROLLBACK TO SAVEPOINT "+sp)
					continue
				}
				return nil, fmt.Errorf("insert invite %q: %w", d.Name, err)
			}

			if _, err := tx.Exec(ctx, "RELEASE SAVEPOINT "+sp); err != nil {
				return nil, fmt.Errorf("release savepoint %s: %w", sp, err)
			}
			inv.CreatedAt = createdAt.Format(time.RFC3339)
			inserted = true
			break
		}

		if !inserted {
			return nil, fmt.Errorf("failed to generate unique invite code for %q after 3 attempts", d.Name)
		}
		result = append(result, inv)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	return result, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd go-server && go build ./...`
Expected: No errors — both `MemoryRepository` and `PostgresRepository` now satisfy the `Repository` interface

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/repository/postgres.go
git commit -m "feat(invite): add CreateInvitesBulk Postgres implementation with transaction"
```

---

## Chunk 2: Backend — Handler + Router + Tests

### Task 5: Add `BulkCreate` handler

**Files:**
- Modify: `go-server/internal/handler/invite.go` (add after the `Create` method, around line 45)
- Test: `go-server/internal/handler/invite_test.go`

- [ ] **Step 1: Write the failing tests**

Add to the end of `go-server/internal/handler/invite_test.go`:

```go
func TestInvite_BulkCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"Alice", "Bob", "Charlie"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	if len(invites) != 3 {
		t.Fatalf("expected 3 invites, got %d", len(invites))
	}

	// Verify each invite has correct structure and unique codes
	codes := make(map[string]bool)
	expectedNames := []string{"Alice", "Bob", "Charlie"}
	for i, raw := range invites {
		inv := raw.(map[string]interface{})
		if inv["name"] != expectedNames[i] {
			t.Fatalf("invite %d: expected name %q, got %v", i, expectedNames[i], inv["name"])
		}
		code, ok := inv["code"].(string)
		if !ok || len(code) != 5 {
			t.Fatalf("invite %d: expected 5-char code, got %v", i, inv["code"])
		}
		if codes[code] {
			t.Fatalf("invite %d: duplicate code %q", i, code)
		}
		codes[code] = true
		assertKeyExists(t, inv, "id")
		assertKeyExists(t, inv, "rsvpId")
		assertKeyExists(t, inv, "createdAt")
	}
}

func TestInvite_BulkCreate_UniqueCodesLargeBatch(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	names := make([]string, 20)
	for i := range names {
		names[i] = fmt.Sprintf("Guest %d", i+1)
	}

	body := jsonBody(map[string]interface{}{
		"names": names,
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	if len(invites) != 20 {
		t.Fatalf("expected 20 invites, got %d", len(invites))
	}

	codes := make(map[string]bool)
	for i, raw := range invites {
		inv := raw.(map[string]interface{})
		code := inv["code"].(string)
		if codes[code] {
			t.Fatalf("invite %d: duplicate code %q", i, code)
		}
		codes[code] = true
	}
}

func TestInvite_BulkCreate_EmptyNames_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_BulkCreate_MissingNames_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_BulkCreate_EmptyStringInNames_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"Alice", "", "Charlie"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_BulkCreate_SanitizesNames(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"<script>alert('xss')</script>Alice", "Bob<b>Bold</b>"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	for _, raw := range invites {
		inv := raw.(map[string]interface{})
		name := inv["name"].(string)
		if strings.Contains(name, "<script>") || strings.Contains(name, "<b>") {
			t.Fatalf("expected sanitized name, got %q", name)
		}
	}
}

func TestInvite_BulkCreate_ExceedsLimit_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	names := make([]string, 501)
	for i := range names {
		names[i] = fmt.Sprintf("Guest %d", i+1)
	}

	body := jsonBody(map[string]interface{}{
		"names": names,
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Note: The `TestInvite_BulkCreate_SanitizesNames` test uses `strings.Contains`, so you must add `"strings"` to the import block in `invite_test.go` if not already present.

Run: `cd go-server && go test ./internal/handler -run TestInvite_BulkCreate -v`
Expected: FAIL — route not registered, 404 responses

- [ ] **Step 3: Write the handler implementation**

Add after the `Create` method in `go-server/internal/handler/invite.go` (after line 45):

```go
const maxBulkInvites = 500

// BulkCreate handles POST /api/admin/invites/bulk.
func (h *InviteHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	var body models.BulkCreateInvitesRequest
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(body.Names) == 0 {
		writeError(w, r, http.StatusBadRequest, "Names array is required and cannot be empty")
		return
	}

	if len(body.Names) > maxBulkInvites {
		writeError(w, r, http.StatusBadRequest, "Cannot import more than 500 names at once")
		return
	}

	// Validate and sanitize all names
	inserts := make([]models.InsertInvite, 0, len(body.Names))
	for _, name := range body.Names {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			writeError(w, r, http.StatusBadRequest, "All names must be non-empty")
			return
		}
		if h.Sanitizer != nil {
			trimmed = h.Sanitizer.Sanitize(trimmed)
		}
		inserts = append(inserts, models.InsertInvite{Name: trimmed})
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

Update the import block in `invite.go` to add `"strings"`:

```go
import (
	"net/http"
	"strconv"
	"strings"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)
```

- [ ] **Step 4: Register the route**

In `go-server/internal/router/router.go`, add inside the admin auth+CSRF group (after line 170, after `r.Post("/invites", invite.Create)`):

```go
			r.Post("/invites/bulk", invite.BulkCreate)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd go-server && go test ./internal/handler -run TestInvite_BulkCreate -v`
Expected: All 7 tests PASS

- [ ] **Step 6: Run ALL existing tests to check for regressions**

Run: `cd go-server && go test ./... -race -count=1`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add go-server/internal/handler/invite.go go-server/internal/handler/invite_test.go go-server/internal/router/router.go
git commit -m "feat(invite): add BulkCreate handler and route for POST /api/admin/invites/bulk"
```

---

### Task 6: Add bulk response contract test

**Files:**
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Write the contract test**

Add to the end of `go-server/internal/handler/contract_test.go`:

```go
// ---------------------------------------------------------------------------
// Invite Bulk — Contract
// ---------------------------------------------------------------------------

func TestContract_InviteBulkCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"Alice", "Bob"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	// Response must have "invites" array
	assertKeyExists(t, result, "invites")
	invites := result["invites"].([]interface{})
	if len(invites) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(invites))
	}

	// Each invite must have the expected fields and types
	for i, raw := range invites {
		inv := raw.(map[string]interface{})
		assertKeyType(t, inv, "id", "float64")
		assertKeyType(t, inv, "name", "string")
		assertKeyType(t, inv, "code", "string")
		assertKeyType(t, inv, "createdAt", "string")
		// rsvpId should be nil for new invites
		assertKeyExists(t, inv, "rsvpId")
		if inv["rsvpId"] != nil {
			t.Fatalf("invite %d: expected rsvpId to be nil, got %v", i, inv["rsvpId"])
		}
	}
}
```

- [ ] **Step 2: Run the contract test**

Run: `cd go-server && go test ./internal/handler -run TestContract_InviteBulkCreate -v`
Expected: PASS

- [ ] **Step 3: Run ALL tests again**

Run: `cd go-server && go test ./... -race -count=1`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add go-server/internal/handler/contract_test.go
git commit -m "test(invite): add bulk create contract test"
```

---

## Chunk 3: Frontend — CSV Import UI

### Task 7: Add CSV import card to InvitesPage

**Files:**
- Modify: `client/src/pages/admin/InvitesPage.tsx`

This is a single frontend task that adds the CSV import flow. The component uses three states (upload, preview, result) managed with `useState`. Since the existing InvitesPage is 308 lines and this adds meaningful UI, all the logic goes into the same file following the existing pattern.

- [ ] **Step 1: Add imports and CSV parsing utility**

At the top of `InvitesPage.tsx`, add `Upload` to the lucide-react imports, and `useRef` and `useCallback` to the React imports.

Add a CSV parsing function before the component:

```typescript
/** RFC 4180-aware CSV parser. Handles quoted fields and BOM. */
function parseCSV(text: string): string[][] {
  // Strip UTF-8 BOM
  const content = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        row.push(field);
        field = "";
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
        if (ch === "\r") i++; // skip \n in \r\n
      } else {
        field += ch;
      }
    }
  }
  // Last field/row
  if (field || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim())) rows.push(row);
  }
  return rows;
}

const NAME_HEADERS = ["full name", "name", "guest name", "guest", "nama", "nama lengkap"];

type ImportEntry = { name: string; checked: boolean; dupType: "none" | "existing" | "inFile" };

type ImportState =
  | { step: "upload" }
  | {
      step: "preview";
      headers: string[];
      rawRows: string[][];
      nameColumnIndex: number;
      entries: ImportEntry[];
    }
  | { step: "importing" };
```

- [ ] **Step 2: Add import state and bulk mutation inside the component**

Inside `InvitesPage`, after the existing `deleteInviteMutation`, add:

```typescript
  const [importState, setImportState] = useState<ImportState>({ step: "upload" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bulkCreateMutation = useMutation({
    mutationFn: async (names: string[]) => {
      const response = await apiRequest("POST", "/api/admin/invites/bulk", { names });
      return response.json();
    },
    onSuccess: (data: { invites: Invite[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setImportState({ step: "upload" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({
        title: "Success",
        description: `Created ${data.invites.length} invites`,
      });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      setImportState({ step: "upload" });
      toast({
        title: "Error",
        description: `Failed to import invites: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          toast({ title: "Error", description: "CSV has no data rows", variant: "destructive" });
          return;
        }

        const headers = rows[0].map((h) => h.trim());
        // Auto-detect name column
        let nameCol = headers.findIndex((h) =>
          NAME_HEADERS.includes(h.toLowerCase())
        );
        if (nameCol === -1) nameCol = 0; // fallback to first column

        const existingNames = new Set(
          (data?.invites ?? []).map((inv) => inv.name.toLowerCase().trim())
        );
        const seenNames = new Set<string>();

        const entries = rows
          .slice(1)
          .map((row) => {
            const raw = row[nameCol]?.trim() ?? "";
            return raw;
          })
          .filter((name) => name.length > 0)
          .map((name) => {
            const lower = name.toLowerCase();
            let dupType: "none" | "existing" | "inFile" = "none";
            if (existingNames.has(lower)) {
              dupType = "existing";
            } else if (seenNames.has(lower)) {
              dupType = "inFile";
            }
            seenNames.add(lower);
            return { name, checked: dupType === "none", dupType };
          });

        if (entries.length === 0) {
          toast({ title: "Error", description: "No names found in CSV", variant: "destructive" });
          return;
        }

        const rawRows = rows.slice(1);
        setImportState({ step: "preview", headers, rawRows, nameColumnIndex: nameCol, entries });
      };
      reader.readAsText(file);
    },
    [data, toast]
  );

  /** Derive entries from raw CSV rows for a given column index. */
  const deriveEntries = useCallback(
    (rawRows: string[][], colIndex: number): ImportEntry[] => {
      const existingNames = new Set(
        (data?.invites ?? []).map((inv) => inv.name.toLowerCase().trim())
      );
      const seenNames = new Set<string>();

      return rawRows
        .map((row) => (row[colIndex]?.trim() ?? ""))
        .filter((name) => name.length > 0)
        .map((name) => {
          const lower = name.toLowerCase();
          let dupType: "none" | "existing" | "inFile" = "none";
          if (existingNames.has(lower)) {
            dupType = "existing";
          } else if (seenNames.has(lower)) {
            dupType = "inFile";
          }
          seenNames.add(lower);
          return { name, checked: dupType === "none", dupType };
        });
    },
    [data]
  );

  const handleToggleEntry = (index: number) => {
    if (importState.step !== "preview") return;
    setImportState({
      ...importState,
      entries: importState.entries.map((entry, i) =>
        i === index ? { ...entry, checked: !entry.checked } : entry
      ),
    });
  };

  const handleColumnChange = (newIndex: number) => {
    if (importState.step !== "preview") return;
    const entries = deriveEntries(importState.rawRows, newIndex);
    setImportState({ ...importState, nameColumnIndex: newIndex, entries });
  };

  const handleImport = () => {
    if (importState.step !== "preview") return;
    const selectedNames = importState.entries
      .filter((e) => e.checked)
      .map((e) => e.name);
    if (selectedNames.length === 0) return;
    setImportState({ step: "importing" });
    bulkCreateMutation.mutate(selectedNames);
  };

  const handleCancelImport = () => {
    setImportState({ step: "upload" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
```

- [ ] **Step 3: Add the import card JSX**

In the JSX return, add between the "Create New Invite" `</Card>` (line 179) and the search section (line 182). The card renders differently based on `importState.step`:

```tsx
      {/* Import from CSV */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Import from CSV</CardTitle>
          <CardDescription>
            Upload a CSV file exported from Google Sheets to bulk-create invites
          </CardDescription>
        </CardHeader>
        <CardContent>
          {importState.step === "upload" && (
            <div className="flex items-center gap-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="flex-1"
              />
            </div>
          )}

          {importState.step === "preview" && (
            <div className="space-y-4">
              {/* Column selector */}
              {importState.headers.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Name column:</span>
                  <select
                    value={importState.nameColumnIndex}
                    onChange={(e) => handleColumnChange(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    {importState.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Summary */}
              <div className="text-sm text-gray-600">
                Found <strong>{importState.entries.length}</strong> names
                {importState.entries.filter((e) => e.dupType !== "none").length > 0 && (
                  <> — <strong className="text-amber-600">
                    {importState.entries.filter((e) => e.dupType !== "none").length} duplicates
                  </strong></>
                )}
              </div>

              {/* Name list */}
              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {importState.entries.map((entry, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={entry.checked}
                      onChange={() => handleToggleEntry(i)}
                      className="rounded"
                    />
                    <span className={entry.dupType !== "none" ? "text-amber-600" : ""}>
                      {entry.name}
                    </span>
                    {entry.dupType === "existing" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Already exists
                      </span>
                    )}
                    {entry.dupType === "inFile" && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                        Duplicate in file
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={!importState.entries.some((e) => e.checked)}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import {importState.entries.filter((e) => e.checked).length} Selected
                </Button>
                <Button variant="outline" onClick={handleCancelImport}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {importState.step === "importing" && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="text-gray-500">Creating invites...</span>
            </div>
          )}
        </CardContent>
      </Card>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 5: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/InvitesPage.tsx
git commit -m "feat(invite): add CSV import UI with preview and duplicate detection"
```

---

## Chunk 4: End-to-end verification

### Task 8: Full test suite and manual verification

- [ ] **Step 1: Run full Go test suite**

Run: `cd go-server && go test ./... -race -count=1 -v`
Expected: All tests PASS with no race conditions

- [ ] **Step 2: Run Go linter**

Run: `cd go-server && make lint`
Expected: No lint errors

- [ ] **Step 3: Run TypeScript check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 4: Build frontend**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Manual verification**

Start both servers:
- Terminal 1: `cd go-server && make run-dev`
- Terminal 2: `npm run dev`

Test the flow:
1. Log in to admin
2. Go to Invites tab
3. Upload a CSV file (export from your Google Sheet)
4. Verify the preview shows names correctly
5. Verify duplicates are flagged
6. Confirm import
7. Verify invites appear in the list

- [ ] **Step 6: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final cleanup for CSV bulk invite import"
```
