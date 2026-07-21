# Configurable Content Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all build-time invitation text (prose + names/date/venue) editable from the admin page, bilingual (EN/ID), backed by a runtime override layer that falls back to compiled defaults.

**Architecture:** A `content_overrides(key, locale, value)` table stores admin edits. The frontend fetches all overrides once and merges them over the compiled `locales`/`constants` defaults — DB value wins, else compiled default. An empty table reproduces today's site exactly. A shared field registry declares every editable key (section, label, type, bilingual) and drives the admin editor.

**Tech Stack:** Go (Chi, pgx), React 18 + TypeScript, TanStack React Query, Vite, Postgres, Vitest, Go `testing` + race detector.

## Global Constraints

- Go module import prefix: `github.com/andreasronaldo/wedding-server`.
- All Go model JSON tags are camelCase; contract tests enforce this.
- Admin mutations require CSRF token + session (auth+CSRF route group).
- Migrations are manual (`make migrate`); docker-dev does NOT auto-apply. New endpoint returns empty until migration is run.
- Locales are EN/ID only. Non-translated (structural) values use `locale = '*'`.
- Empty override table MUST render identical to current site (defaults win).
- Backend tests run with `-race -count=1`; use the in-memory repository (no DB).
- Frontend prose keys MUST match existing `TranslationKey`s in `client/src/locales/en.ts`.

---

## Phase 1 — Backend storage & API

### Task 1: Migration — `content_overrides` table

**Files:**
- Create: `go-server/migrations/011_content_overrides.sql`

**Interfaces:**
- Produces: table `content_overrides(key TEXT, locale TEXT, value TEXT, updated_at TIMESTAMPTZ)`, PK `(key, locale)`.

- [ ] **Step 1: Write the migration**

```sql
-- 011_content_overrides.sql
-- Runtime overrides for build-time invitation text. Empty table => compiled defaults win.
CREATE TABLE IF NOT EXISTS content_overrides (
    key        TEXT        NOT NULL,
    locale     TEXT        NOT NULL,          -- 'en' | 'id' | '*'
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, locale)
);
```

- [ ] **Step 2: Verify SQL parses**

Run: `cd go-server && grep -c "CREATE TABLE" migrations/011_content_overrides.sql`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add go-server/migrations/011_content_overrides.sql
git commit -m "feat(db): add content_overrides table migration"
```

---

### Task 2: Model — `ContentOverride`

**Files:**
- Create: `go-server/internal/models/content_override.go`

**Interfaces:**
- Produces: `models.ContentOverride{Key, Locale, Value string; UpdatedAt string}` and `models.InsertContentOverride{Key, Locale, Value string}`.

- [ ] **Step 1: Write the model**

```go
package models

// ContentOverride is a runtime override for a build-time text key.
type ContentOverride struct {
	Key       string `json:"key"`
	Locale    string `json:"locale"`
	Value     string `json:"value"`
	UpdatedAt string `json:"updatedAt"`
}

// InsertContentOverride contains the fields required to create or update an override.
type InsertContentOverride struct {
	Key    string `json:"key"`
	Locale string `json:"locale"`
	Value  string `json:"value"`
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd go-server && go build ./internal/models/`
Expected: no output (success)

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/models/content_override.go
git commit -m "feat(models): add ContentOverride model"
```

---

### Task 3: Repository interface + in-memory implementation

**Files:**
- Modify: `go-server/internal/repository/repository.go` (add methods to interface after the App Settings block, ~line 55)
- Modify: `go-server/internal/repository/memory.go` (add field ~line 28, init ~line 57, methods at end of file)
- Test: `go-server/internal/repository/memory_content_override_test.go`

**Interfaces:**
- Consumes: `models.ContentOverride`, `models.InsertContentOverride` (Task 2).
- Produces:
  - `GetAllContentOverrides(ctx context.Context) ([]models.ContentOverride, error)`
  - `UpsertContentOverrides(ctx context.Context, items []models.InsertContentOverride) (int, error)`

- [ ] **Step 1: Write the failing test**

```go
// go-server/internal/repository/memory_content_override_test.go
package repository

import (
	"context"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

func TestMemoryContentOverridesUpsertAndGet(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	n, err := repo.UpsertContentOverrides(ctx, []models.InsertContentOverride{
		{Key: "hero.title", Locale: "en", Value: "Hello"},
		{Key: "hero.title", Locale: "id", Value: "Halo"},
	})
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if n != 2 {
		t.Fatalf("want 2 upserted, got %d", n)
	}

	// Conflict updates value, does not duplicate.
	if _, err := repo.UpsertContentOverrides(ctx, []models.InsertContentOverride{
		{Key: "hero.title", Locale: "en", Value: "Hi"},
	}); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	all, err := repo.GetAllContentOverrides(ctx)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("want 2 rows, got %d", len(all))
	}
	got := map[string]string{}
	for _, o := range all {
		got[o.Key+"|"+o.Locale] = o.Value
	}
	if got["hero.title|en"] != "Hi" {
		t.Fatalf("want updated en=Hi, got %q", got["hero.title|en"])
	}
	if got["hero.title|id"] != "Halo" {
		t.Fatalf("want id=Halo, got %q", got["hero.title|id"])
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/repository -run TestMemoryContentOverrides -v`
Expected: FAIL — `repo.UpsertContentOverrides undefined`

- [ ] **Step 3: Add methods to the interface**

In `repository.go`, after the App Settings block (after line 55, before `// Welcome Screen`), add:

```go
	// Content Overrides
	GetAllContentOverrides(ctx context.Context) ([]models.ContentOverride, error)
	UpsertContentOverrides(ctx context.Context, items []models.InsertContentOverride) (int, error)
```

- [ ] **Step 4: Add storage to MemoryRepository**

In `memory.go`, add a field alongside `appSettings` (~line 28):

```go
	contentOverrides map[string]models.ContentOverride // key = key + "|" + locale
```

In the constructor where `appSettings` is initialized (~line 57):

```go
		contentOverrides: make(map[string]models.ContentOverride),
```

At the end of `memory.go`, add the methods (the memory repo already holds `mu sync.RWMutex` used by other methods — match the existing locking style in this file):

```go
func (m *MemoryRepository) UpsertContentOverrides(_ context.Context, items []models.InsertContentOverride) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	count := 0
	for _, it := range items {
		m.contentOverrides[it.Key+"|"+it.Locale] = models.ContentOverride{
			Key:       it.Key,
			Locale:    it.Locale,
			Value:     it.Value,
			UpdatedAt: "",
		}
		count++
	}
	return count, nil
}

func (m *MemoryRepository) GetAllContentOverrides(_ context.Context) ([]models.ContentOverride, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]models.ContentOverride, 0, len(m.contentOverrides))
	for _, o := range m.contentOverrides {
		result = append(result, o)
	}
	return result, nil
}
```

> Note: confirm the mutex field name by grepping `memory.go` for `m.mu` (or `sync.RWMutex`); use whatever the existing methods use. If methods use no lock, omit locking to match.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd go-server && go test ./internal/repository -run TestMemoryContentOverrides -race -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/repository/repository.go go-server/internal/repository/memory.go go-server/internal/repository/memory_content_override_test.go
git commit -m "feat(repo): content overrides interface + in-memory impl"
```

---

### Task 4: Postgres repository implementation

**Files:**
- Modify: `go-server/internal/repository/postgres.go` (add methods after the App Settings block, ~after line 636)

**Interfaces:**
- Consumes: interface from Task 3.
- Produces: Postgres impl of `GetAllContentOverrides` / `UpsertContentOverrides`.

- [ ] **Step 1: Add the methods**

After `GetAllAppSettings` (ends ~line 636), before the Welcome Screen section, add:

```go
// ---------------------------------------------------------------------------
// Content Overrides
// ---------------------------------------------------------------------------

func (r *PostgresRepository) UpsertContentOverrides(ctx context.Context, items []models.InsertContentOverride) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, it := range items {
		_, err := tx.Exec(ctx,
			`INSERT INTO content_overrides (key, locale, value)
			 VALUES ($1, $2, $3)
			 ON CONFLICT (key, locale) DO UPDATE SET
			   value = EXCLUDED.value,
			   updated_at = NOW()`,
			it.Key, it.Locale, it.Value,
		)
		if err != nil {
			return 0, err
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *PostgresRepository) GetAllContentOverrides(ctx context.Context) ([]models.ContentOverride, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT key, locale, value, updated_at FROM content_overrides`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ContentOverride, 0)
	for rows.Next() {
		var o models.ContentOverride
		var updatedAt time.Time
		if err := rows.Scan(&o.Key, &o.Locale, &o.Value, &updatedAt); err != nil {
			return nil, err
		}
		o.UpdatedAt = updatedAt.Format(time.RFC3339)
		result = append(result, o)
	}
	return result, rows.Err()
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd go-server && go build ./...`
Expected: no output (success). If `PostgresRepository` no longer satisfies `Repository`, the build fails here — that confirms the interface is wired.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/repository/postgres.go
git commit -m "feat(repo): postgres content overrides impl"
```

---

### Task 5: Handler — public GET + admin bulk PATCH with validation

**Files:**
- Create: `go-server/internal/handler/content_override.go`
- Create: `go-server/internal/handler/content_override_allowlist.go`
- Test: `go-server/internal/handler/content_override_test.go`

**Interfaces:**
- Consumes: `repository.Repository` (Tasks 3–4).
- Produces:
  - `ContentOverrideHandler{Repo repository.Repository}`
  - `(h) List(w, r)` → `GET /api/content-overrides` → `{"overrides": [...]}`
  - `(h) BulkUpdate(w, r)` → `PATCH /api/admin/content-overrides/bulk`, body `{"overrides":[{key,locale,value}]}`
  - `AllowedContentKeys map[string]bool` and `StructuralContentKeys map[string]string` (key → type `date|url|time|text`) in the allowlist file.

- [ ] **Step 1: Write the failing test**

```go
// go-server/internal/handler/content_override_test.go
package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/repository"
)

func newContentHandler() *ContentOverrideHandler {
	return &ContentOverrideHandler{Repo: repository.NewMemoryRepository()}
}

func TestContentOverrideListEmpty(t *testing.T) {
	h := newContentHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/content-overrides", nil)
	rec := httptest.NewRecorder()
	h.List(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	var body struct {
		Overrides []map[string]any `json:"overrides"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Overrides == nil {
		t.Fatalf("overrides must be [] not null")
	}
}

func TestContentOverrideBulkUpdateRejectsUnknownKey(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"not.a.real.key","locale":"en","value":"x"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for unknown key, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateRejectsBadLocale(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"hero.saveTheDate","locale":"fr","value":"x"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for bad locale, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateRejectsBadDate(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"wedding.date","locale":"*","value":"not-a-date"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for bad date, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateRejectsMissingToken(t *testing.T) {
	h := newContentHandler()
	// rsvp.rsvpThankYou must keep "{name}".
	payload := `{"overrides":[{"key":"rsvp.rsvpThankYou","locale":"en","value":"Thanks!"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for missing {name}, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateAccepts(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"hero.saveTheDate","locale":"en","value":"Save the Date"},{"key":"wedding.date","locale":"*","value":"2026-07-05T14:00:00+07:00"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run TestContentOverride -v`
Expected: FAIL — `ContentOverrideHandler` undefined.

- [ ] **Step 3: Write the allowlist**

The allowlist is the server-side mirror of the frontend registry (Task 8). Keep the two in sync; Task 8 adds a parity test. Structural keys carry a validation type.

```go
// go-server/internal/handler/content_override_allowlist.go
package handler

// StructuralContentKeys maps non-translated ('*' locale) keys to a validation type.
var StructuralContentKeys = map[string]string{
	"wedding.date":        "date", // RFC3339
	"venue.matrimony.mapUrl": "url",
	"venue.reception.mapUrl": "url",
	"venue.matrimony.time":   "text",
	"venue.reception.time":   "text",
}

// InterpolatedContentKeys maps keys whose value MUST retain interpolation
// tokens (a non-empty override missing a required token is rejected).
var InterpolatedContentKeys = map[string][]string{
	"rsvp.rsvpThankYou":    {"{name}"},
	"messages.seeAllWishes": {"{count}"},
}

// proseContentKeys are bilingual (en/id) text keys — the union of locale keys
// plus migrated literals. Must match client/src/shared registry keys.
var proseContentKeys = []string{
	// HeroSection
	"hero.gettingMarried", "hero.saveTheDate", "hero.rsvpNow",
	"hero.days", "hero.hours", "hero.minutes", "hero.seconds",
	// WelcomeOverlay
	"welcome.openInvitation", "welcome.selectLanguage",
	// DetailsSection
	"details.theDetails", "details.detailsSubtitle", "details.date", "details.schedule",
	"details.location", "details.viewOnMaps", "details.gettingThere",
	"details.rideHailingTitle", "details.rideHailingBody", "details.valetTitle",
	"details.valetBody", "details.weddingDaySchedule",
	// Venue text (bilingual titles/location/address)
	"venue.matrimony.title", "venue.reception.title",
	"venue.location", "venue.address",
	// BibleVerseSection
	"bible.verse", "bible.verseRef",
	// CoupleSection
	"couple.ourLoveStory", "couple.theGroom", "couple.theBride",
	"couple.secondSonOf", "couple.secondDaughterOf", "couple.howWeMet",
	"couple.story1", "couple.story2", "couple.story3", "couple.storyQuote",
	"couple.groomName", "couple.brideName",
	"couple.groomFather", "couple.groomMother",
	"couple.brideFather", "couple.brideMother",
	// DressCodeSection
	"dress.dressCode", "dress.colorToAvoid", "dress.dressCodeSubtitle",
	// GallerySection
	"gallery.ourGallery", "gallery.gallerySubtitle",
	// RsvpSection
	"rsvp.rsvp", "rsvp.rsvpSubtitle", "rsvp.willYouAttend", "rsvp.attendBoth",
	"rsvp.attendHolyMatrimony", "rsvp.attendReception", "rsvp.attendDecline",
	"rsvp.numberOfGuests", "rsvp.submitRsvp", "rsvp.updateRsvp",
	"rsvp.rsvpThankYou", "rsvp.rsvpConfirmAttending", "rsvp.rsvpConfirmDecline",
	// MessagesSection
	"messages.wishesTitle", "messages.wishesSubtitle", "messages.yourName",
	"messages.yourMessage", "messages.sendWish", "messages.noMessages",
	"messages.seeAllWishes", "messages.thankYouMessage",
	// EGiftSection
	"egift.eGiftTitle", "egift.eGiftSubtitle", "egift.groom", "egift.bride",
	"egift.copyAccountNumber", "egift.copied",
	// Footer
	"footer.madeWithLove", "footer.monogram",
	// NavBar
	"nav.home", "nav.ourStory", "nav.weddingDetails", "nav.wishes", "nav.monogram",
}

// AllowedContentKeys is the set of every editable key (prose + structural).
var AllowedContentKeys = func() map[string]bool {
	m := make(map[string]bool, len(proseContentKeys)+len(StructuralContentKeys))
	for _, k := range proseContentKeys {
		m[k] = true
	}
	for k := range StructuralContentKeys {
		m[k] = true
	}
	return m
}()
```

> The key list above is the canonical set. Task 8 builds the TS registry from exactly these keys and adds a parity test. If you add/remove a key later, change both.

- [ ] **Step 4: Write the handler**

```go
// go-server/internal/handler/content_override.go
package handler

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
)

// ContentOverrideHandler handles content override endpoints.
type ContentOverrideHandler struct {
	Repo repository.Repository
}

// List handles GET /api/content-overrides.
func (h *ContentOverrideHandler) List(w http.ResponseWriter, r *http.Request) {
	overrides, err := h.Repo.GetAllContentOverrides(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get content overrides")
		return
	}
	if overrides == nil {
		overrides = make([]models.ContentOverride, 0)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"overrides": overrides,
	})
}

// BulkUpdate handles PATCH /api/admin/content-overrides/bulk.
func (h *ContentOverrideHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Overrides []models.InsertContentOverride `json:"overrides"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(body.Overrides) == 0 {
		writeError(w, r, http.StatusBadRequest, "Overrides array must not be empty")
		return
	}
	if len(body.Overrides) > 500 {
		writeError(w, r, http.StatusBadRequest, "Overrides array must not exceed 500 items")
		return
	}

	inserts := make([]models.InsertContentOverride, 0, len(body.Overrides))
	for _, o := range body.Overrides {
		o.Key = strings.TrimSpace(o.Key)
		if !AllowedContentKeys[o.Key] {
			writeError(w, r, http.StatusBadRequest, "Unknown content key: "+o.Key)
			return
		}
		if o.Locale != "en" && o.Locale != "id" && o.Locale != "*" {
			writeError(w, r, http.StatusBadRequest, "Invalid locale for key "+o.Key)
			return
		}
		if len(o.Value) > 5000 {
			writeError(w, r, http.StatusBadRequest, "Value too long for key "+o.Key)
			return
		}
		// Interpolation tokens must survive edits (e.g. "{name}", "{count}").
		if tokens, ok := InterpolatedContentKeys[o.Key]; ok && o.Value != "" {
			for _, tok := range tokens {
				if !strings.Contains(o.Value, tok) {
					writeError(w, r, http.StatusBadRequest, "Value for "+o.Key+" must contain "+tok)
					return
				}
			}
		}
		// Structural type validation.
		if typ, ok := StructuralContentKeys[o.Key]; ok && o.Value != "" {
			switch typ {
			case "date":
				if _, err := time.Parse(time.RFC3339, o.Value); err != nil {
					writeError(w, r, http.StatusBadRequest, "Invalid date (want RFC3339) for "+o.Key)
					return
				}
			case "url":
				u, err := url.ParseRequestURI(o.Value)
				if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
					writeError(w, r, http.StatusBadRequest, "Invalid URL for "+o.Key)
					return
				}
			}
		}
		inserts = append(inserts, models.InsertContentOverride{
			Key:    o.Key,
			Locale: o.Locale,
			Value:  o.Value,
		})
	}

	updated, err := h.Repo.UpsertContentOverrides(r.Context(), inserts)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update content overrides")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"updated": updated,
	})
}
```

> `writeJSON`, `writeError`, `parseJSON` are existing helpers in the `handler` package (used by `app_setting.go`). Do not redefine them.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run TestContentOverride -race -v`
Expected: PASS (all 5 tests)

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/handler/content_override.go go-server/internal/handler/content_override_allowlist.go go-server/internal/handler/content_override_test.go
git commit -m "feat(handler): content overrides list + validated bulk update"
```

---

### Task 6: Wire routes

**Files:**
- Modify: `go-server/internal/router/router.go` (handler construct ~line 50, public route ~line 100, admin route ~line 166)

**Interfaces:**
- Consumes: `ContentOverrideHandler` (Task 5).
- Produces: routes `GET /api/content-overrides`, `PATCH /api/admin/content-overrides/bulk`.

- [ ] **Step 1: Construct the handler**

After the `appSetting`/`welcomeScreen` handler construction (~line 51), add:

```go
	contentOverride := &handler.ContentOverrideHandler{Repo: repo}
```

- [ ] **Step 2: Add the public route**

Near the other public reads (after line 100, `r.Get("/api/welcome-screen", welcomeScreen.Get)`), add:

```go
	r.Get("/api/content-overrides", contentOverride.List)
```

- [ ] **Step 3: Add the admin route**

Inside the auth+CSRF group, near line 166 (`r.Patch("/welcome-screen", welcomeScreen.Update)`), add:

```go
			r.Patch("/content-overrides/bulk", contentOverride.BulkUpdate)
```

- [ ] **Step 4: Build + run full backend tests**

Run: `cd go-server && go build ./... && make test`
Expected: build succeeds; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/router/router.go
git commit -m "feat(router): wire content overrides routes"
```

---

## Phase 2 — Shared registry & frontend read path

### Task 7: Content registry (shared source of truth)

**Files:**
- Create: `client/src/content/registry.ts`
- Test: `client/src/content/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `TranslationKey` union is NOT reused here (registry uses new dotted keys); prose defaults resolved at runtime from `locales`, not duplicated.
- Produces:
  - `type ContentField = { section: string; key: string; label: string; type: "text"|"textarea"|"date"|"time"|"url"; bilingual: boolean; localeKey?: TranslationKey }`
  - `CONTENT_REGISTRY: ContentField[]`
  - `CONTENT_SECTIONS: string[]` (ordered, unique sections)

**Design note:** The registry key (e.g. `"hero.saveTheDate"`) is the DB key. `localeKey` (e.g. `"saveTheDate"`) points at the existing compiled `locales` entry used as the default. Structural fields have no `localeKey`; their defaults come from `constants.ts` via `useWeddingConfig` (Task 9).

- [ ] **Step 1: Write the failing parity test**

```ts
// client/src/content/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
import { CONTENT_REGISTRY } from "../registry";
import { en } from "@/locales/en";

describe("content registry", () => {
  it("has unique keys", () => {
    const keys = CONTENT_REGISTRY.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every bilingual field's localeKey exists in en locale", () => {
    for (const f of CONTENT_REGISTRY) {
      if (f.bilingual && f.localeKey) {
        expect(en).toHaveProperty(f.localeKey);
      }
    }
  });

  it("structural (non-bilingual) fields have no localeKey", () => {
    for (const f of CONTENT_REGISTRY) {
      if (!f.bilingual) expect(f.localeKey).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/content/__tests__/registry.test.ts`
Expected: FAIL — cannot resolve `../registry`.

- [ ] **Step 3: Write the registry**

Keys MUST match `proseContentKeys` + `StructuralContentKeys` in the Go allowlist (Task 5). `localeKey` values MUST be existing keys in `client/src/locales/en.ts`. Migrated-literal fields (parents, names, nav, monogram, venue) get NEW `localeKey`s that Task 10/Task 11 will add to the locale files — for now leave those with `localeKey` pointing at the new key name that will be added; the parity test only checks bilingual fields whose `localeKey` is set, so add the locale entries in Task 11 BEFORE this test's second assertion can pass for them. To keep this task green now, only set `localeKey` for fields whose locale entry ALREADY exists; leave `localeKey` undefined for not-yet-migrated literals and set them in Task 11.

```ts
// client/src/content/registry.ts
import type { TranslationKey } from "@/locales/en";

export type ContentFieldType = "text" | "textarea" | "date" | "time" | "url";

export interface ContentField {
  section: string;
  key: string;           // DB key, e.g. "hero.saveTheDate"
  label: string;         // admin label
  type: ContentFieldType;
  bilingual: boolean;    // true => en+id rows; false => '*' row
  localeKey?: TranslationKey; // compiled default source (bilingual prose only)
}

export const CONTENT_REGISTRY: ContentField[] = [
  // Hero
  { section: "Hero", key: "hero.gettingMarried", label: "“We're Getting Married”", type: "text", bilingual: true, localeKey: "gettingMarried" },
  { section: "Hero", key: "hero.saveTheDate", label: "Save the Date button", type: "text", bilingual: true, localeKey: "saveTheDate" },
  { section: "Hero", key: "hero.rsvpNow", label: "RSVP Now button", type: "text", bilingual: true, localeKey: "rsvpNow" },
  { section: "Hero", key: "hero.days", label: "Countdown “Days”", type: "text", bilingual: true, localeKey: "days" },
  { section: "Hero", key: "hero.hours", label: "Countdown “Hours”", type: "text", bilingual: true, localeKey: "hours" },
  { section: "Hero", key: "hero.minutes", label: "Countdown “Minutes”", type: "text", bilingual: true, localeKey: "minutes" },
  { section: "Hero", key: "hero.seconds", label: "Countdown “Seconds”", type: "text", bilingual: true, localeKey: "seconds" },

  // Welcome overlay
  { section: "Welcome", key: "welcome.openInvitation", label: "Open Invitation button", type: "text", bilingual: true, localeKey: "openInvitation" },
  { section: "Welcome", key: "welcome.selectLanguage", label: "“Select your language”", type: "text", bilingual: true, localeKey: "selectLanguage" },

  // Details
  { section: "Details", key: "details.theDetails", label: "Section title", type: "text", bilingual: true, localeKey: "theDetails" },
  { section: "Details", key: "details.detailsSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "detailsSubtitle" },
  { section: "Details", key: "details.date", label: "“Date” label", type: "text", bilingual: true, localeKey: "date" },
  { section: "Details", key: "details.schedule", label: "“Schedule” label", type: "text", bilingual: true, localeKey: "schedule" },
  { section: "Details", key: "details.location", label: "“Location” label", type: "text", bilingual: true, localeKey: "location" },
  { section: "Details", key: "details.viewOnMaps", label: "View on Maps link", type: "text", bilingual: true, localeKey: "viewOnMaps" },
  { section: "Details", key: "details.gettingThere", label: "Getting There title", type: "text", bilingual: true, localeKey: "gettingThere" },
  { section: "Details", key: "details.rideHailingTitle", label: "Ride-hailing title", type: "text", bilingual: true, localeKey: "rideHailingTitle" },
  { section: "Details", key: "details.rideHailingBody", label: "Ride-hailing body", type: "textarea", bilingual: true, localeKey: "rideHailingBody" },
  { section: "Details", key: "details.valetTitle", label: "Valet title", type: "text", bilingual: true, localeKey: "valetTitle" },
  { section: "Details", key: "details.valetBody", label: "Valet body", type: "textarea", bilingual: true, localeKey: "valetBody" },
  { section: "Details", key: "details.weddingDaySchedule", label: "Schedule heading", type: "text", bilingual: true, localeKey: "weddingDaySchedule" },

  // Bible
  { section: "Bible Verse", key: "bible.verse", label: "Verse text", type: "textarea", bilingual: true, localeKey: "bibleVerse" },
  { section: "Bible Verse", key: "bible.verseRef", label: "Verse reference", type: "text", bilingual: true, localeKey: "bibleVerseRef" },

  // Couple (existing locale-backed)
  { section: "Couple", key: "couple.ourLoveStory", label: "“Our Love Story”", type: "text", bilingual: true, localeKey: "ourLoveStory" },
  { section: "Couple", key: "couple.theGroom", label: "“The Groom”", type: "text", bilingual: true, localeKey: "theGroom" },
  { section: "Couple", key: "couple.theBride", label: "“The Bride”", type: "text", bilingual: true, localeKey: "theBride" },
  { section: "Couple", key: "couple.secondSonOf", label: "“the second son of”", type: "text", bilingual: true, localeKey: "secondSonOf" },
  { section: "Couple", key: "couple.secondDaughterOf", label: "“the second daughter of”", type: "text", bilingual: true, localeKey: "secondDaughterOf" },
  { section: "Couple", key: "couple.howWeMet", label: "“How We Met”", type: "text", bilingual: true, localeKey: "howWeMet" },
  { section: "Couple", key: "couple.story1", label: "Story paragraph 1", type: "textarea", bilingual: true, localeKey: "ourStoryParagraph1" },
  { section: "Couple", key: "couple.story2", label: "Story paragraph 2", type: "textarea", bilingual: true, localeKey: "ourStoryParagraph2" },
  { section: "Couple", key: "couple.story3", label: "Story paragraph 3", type: "textarea", bilingual: true, localeKey: "ourStoryParagraph3" },
  { section: "Couple", key: "couple.storyQuote", label: "Story quote", type: "text", bilingual: true, localeKey: "ourStoryQuote" },
  // Couple — migrated literals (localeKey added in Task 11)
  { section: "Couple", key: "couple.groomName", label: "Groom display name", type: "text", bilingual: true },
  { section: "Couple", key: "couple.brideName", label: "Bride display name", type: "text", bilingual: true },
  { section: "Couple", key: "couple.groomFather", label: "Groom's father", type: "text", bilingual: true },
  { section: "Couple", key: "couple.groomMother", label: "Groom's mother", type: "text", bilingual: true },
  { section: "Couple", key: "couple.brideFather", label: "Bride's father", type: "text", bilingual: true },
  { section: "Couple", key: "couple.brideMother", label: "Bride's mother", type: "text", bilingual: true },

  // Dress code
  { section: "Dress Code", key: "dress.dressCode", label: "Section title", type: "text", bilingual: true, localeKey: "dressCode" },
  { section: "Dress Code", key: "dress.colorToAvoid", label: "“Color To Avoid”", type: "text", bilingual: true, localeKey: "colorToAvoid" },
  { section: "Dress Code", key: "dress.dressCodeSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "dressCodeSubtitle" },

  // Gallery
  { section: "Gallery", key: "gallery.ourGallery", label: "Section title", type: "text", bilingual: true, localeKey: "ourGallery" },
  { section: "Gallery", key: "gallery.gallerySubtitle", label: "Subtitle", type: "text", bilingual: true, localeKey: "gallerySubtitle" },

  // RSVP
  { section: "RSVP", key: "rsvp.rsvp", label: "Section title", type: "text", bilingual: true, localeKey: "rsvp" },
  { section: "RSVP", key: "rsvp.rsvpSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "rsvpSubtitle" },
  { section: "RSVP", key: "rsvp.willYouAttend", label: "“Will You Attend?”", type: "text", bilingual: true, localeKey: "willYouAttend" },
  { section: "RSVP", key: "rsvp.attendBoth", label: "Both ceremonies option", type: "text", bilingual: true, localeKey: "attendBoth" },
  { section: "RSVP", key: "rsvp.attendHolyMatrimony", label: "Holy Matrimony option", type: "text", bilingual: true, localeKey: "attendHolyMatrimony" },
  { section: "RSVP", key: "rsvp.attendReception", label: "Reception option", type: "text", bilingual: true, localeKey: "attendReception" },
  { section: "RSVP", key: "rsvp.attendDecline", label: "Decline option", type: "text", bilingual: true, localeKey: "attendDecline" },
  { section: "RSVP", key: "rsvp.numberOfGuests", label: "“Number of Guests”", type: "text", bilingual: true, localeKey: "numberOfGuests" },
  { section: "RSVP", key: "rsvp.submitRsvp", label: "Submit button", type: "text", bilingual: true, localeKey: "submitRsvp" },
  { section: "RSVP", key: "rsvp.updateRsvp", label: "Update button", type: "text", bilingual: true, localeKey: "updateRsvp" },
  { section: "RSVP", key: "rsvp.rsvpThankYou", label: "Thank-you (keep {name})", type: "text", bilingual: true, localeKey: "rsvpThankYou" },
  { section: "RSVP", key: "rsvp.rsvpConfirmAttending", label: "Attending confirmation", type: "textarea", bilingual: true, localeKey: "rsvpConfirmAttending" },
  { section: "RSVP", key: "rsvp.rsvpConfirmDecline", label: "Decline confirmation", type: "textarea", bilingual: true, localeKey: "rsvpConfirmDecline" },

  // Messages
  { section: "Messages", key: "messages.wishesTitle", label: "Section title", type: "text", bilingual: true, localeKey: "wishesTitle" },
  { section: "Messages", key: "messages.wishesSubtitle", label: "Subtitle", type: "text", bilingual: true, localeKey: "wishesSubtitle" },
  { section: "Messages", key: "messages.yourName", label: "“Your Name”", type: "text", bilingual: true, localeKey: "yourName" },
  { section: "Messages", key: "messages.yourMessage", label: "“Your Message”", type: "text", bilingual: true, localeKey: "yourMessage" },
  { section: "Messages", key: "messages.sendWish", label: "Send button", type: "text", bilingual: true, localeKey: "sendWish" },
  { section: "Messages", key: "messages.noMessages", label: "Empty state", type: "text", bilingual: true, localeKey: "noMessages" },
  { section: "Messages", key: "messages.seeAllWishes", label: "See-all (keep {count})", type: "text", bilingual: true, localeKey: "seeAllWishes" },
  { section: "Messages", key: "messages.thankYouMessage", label: "Message thank-you", type: "text", bilingual: true, localeKey: "thankYouMessage" },

  // E-Gift
  { section: "E-Gift", key: "egift.eGiftTitle", label: "Section title", type: "text", bilingual: true, localeKey: "eGiftTitle" },
  { section: "E-Gift", key: "egift.eGiftSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "eGiftSubtitle" },
  { section: "E-Gift", key: "egift.groom", label: "“Groom” label", type: "text", bilingual: true, localeKey: "groom" },
  { section: "E-Gift", key: "egift.bride", label: "“Bride” label", type: "text", bilingual: true, localeKey: "bride" },
  { section: "E-Gift", key: "egift.copyAccountNumber", label: "Copy-account button", type: "text", bilingual: true, localeKey: "copyAccountNumber" },
  { section: "E-Gift", key: "egift.copied", label: "“Copied!” toast", type: "text", bilingual: true, localeKey: "copied" },

  // Footer
  { section: "Footer", key: "footer.madeWithLove", label: "Footer text", type: "text", bilingual: true, localeKey: "madeWithLove" },
  { section: "Footer", key: "footer.monogram", label: "Monogram (e.g. A&C)", type: "text", bilingual: true },

  // Nav (migrated literals; localeKey added in Task 11)
  { section: "Navigation", key: "nav.home", label: "Home", type: "text", bilingual: true },
  { section: "Navigation", key: "nav.ourStory", label: "Our Story", type: "text", bilingual: true },
  { section: "Navigation", key: "nav.weddingDetails", label: "Wedding Details", type: "text", bilingual: true },
  { section: "Navigation", key: "nav.wishes", label: "Wishes", type: "text", bilingual: true },
  { section: "Navigation", key: "nav.monogram", label: "Nav monogram", type: "text", bilingual: true },

  // Venue text (migrated literals)
  { section: "Venue", key: "venue.matrimony.title", label: "Matrimony event title", type: "text", bilingual: true },
  { section: "Venue", key: "venue.reception.title", label: "Reception event title", type: "text", bilingual: true },
  { section: "Venue", key: "venue.location", label: "Venue name", type: "text", bilingual: true },
  { section: "Venue", key: "venue.address", label: "Venue address", type: "textarea", bilingual: true },

  // Structural (non-translated)
  { section: "Wedding Data", key: "wedding.date", label: "Wedding date & time", type: "date", bilingual: false },
  { section: "Wedding Data", key: "venue.matrimony.time", label: "Matrimony time range", type: "text", bilingual: false },
  { section: "Wedding Data", key: "venue.reception.time", label: "Reception time range", type: "text", bilingual: false },
  { section: "Wedding Data", key: "venue.matrimony.mapUrl", label: "Matrimony map URL", type: "url", bilingual: false },
  { section: "Wedding Data", key: "venue.reception.mapUrl", label: "Reception map URL", type: "url", bilingual: false },
];

export const CONTENT_SECTIONS: string[] = Array.from(
  new Set(CONTENT_REGISTRY.map((f) => f.section))
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/content/__tests__/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/content/registry.ts client/src/content/__tests__/registry.test.ts
git commit -m "feat(content): shared field registry"
```

---

### Task 8: Registry ↔ allowlist parity test (Go)

**Files:**
- Create: `go-server/internal/handler/content_override_parity_test.go`
- Create: `go-server/testdata/content_keys.txt` (generated list, checked in)
- Create: `client/scripts/dump-content-keys.mjs` (dev helper to regenerate the list)

**Interfaces:**
- Consumes: `AllowedContentKeys` (Task 5), `CONTENT_REGISTRY` (Task 7).
- Produces: a test that fails if Go allowlist and TS registry drift.

**Approach:** The TS registry is the human source; the Go allowlist is hand-maintained to match. To detect drift without a JS→Go build step, check in a plain-text key list generated from the registry, and have BOTH a Go test (list == allowlist) and the registry test (list == registry keys). A committed artifact keeps them honest.

- [ ] **Step 1: Write the key-dump helper**

```js
// client/scripts/dump-content-keys.mjs
// Regenerate go-server/testdata/content_keys.txt from the TS registry.
// Run: node client/scripts/dump-content-keys.mjs
import { CONTENT_REGISTRY } from "../src/content/registry.ts";
import { writeFileSync } from "node:fs";

const keys = CONTENT_REGISTRY.map((f) => f.key).sort();
writeFileSync(
  new URL("../../go-server/testdata/content_keys.txt", import.meta.url),
  keys.join("\n") + "\n"
);
console.log(`wrote ${keys.length} keys`);
```

> If `.ts` import under Node is awkward in this repo, run via `npx tsx client/scripts/dump-content-keys.mjs`. `tsx` is available through Vite's toolchain; if not installed, add it as a devDependency in this step.

- [ ] **Step 2: Generate the key list**

Run: `node client/scripts/dump-content-keys.mjs || npx tsx client/scripts/dump-content-keys.mjs`
Expected: prints `wrote N keys`; creates `go-server/testdata/content_keys.txt`.

- [ ] **Step 3: Write the Go parity test**

```go
// go-server/internal/handler/content_override_parity_test.go
package handler

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func TestAllowlistMatchesRegistryDump(t *testing.T) {
	// Path relative to this test file: ../../testdata/content_keys.txt
	data, err := os.ReadFile(filepath.Join("..", "..", "testdata", "content_keys.txt"))
	if err != nil {
		t.Fatalf("read key dump: %v (run: node client/scripts/dump-content-keys.mjs)", err)
	}
	var fromDump []string
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			fromDump = append(fromDump, line)
		}
	}
	sort.Strings(fromDump)

	fromAllow := make([]string, 0, len(AllowedContentKeys))
	for k := range AllowedContentKeys {
		fromAllow = append(fromAllow, k)
	}
	sort.Strings(fromAllow)

	if strings.Join(fromDump, ",") != strings.Join(fromAllow, ",") {
		t.Fatalf("registry/allowlist drift:\n dump=%v\n allow=%v", fromDump, fromAllow)
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run TestAllowlistMatchesRegistryDump -v`
Expected: PASS. If it FAILS, the registry and allowlist disagree — reconcile the two key lists (they must be identical sets).

- [ ] **Step 5: Add a TS test asserting registry == dump**

Append to `client/src/content/__tests__/registry.test.ts`:

```ts
it("registry keys match the checked-in Go dump", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dump = fs
    .readFileSync(path.resolve(__dirname, "../../../../go-server/testdata/content_keys.txt"), "utf8")
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
  const keys = CONTENT_REGISTRY.map((f) => f.key).sort();
  expect(keys).toEqual(dump);
});
```

> Adjust the relative path if the test file's depth differs. Verify the resolved path points at `go-server/testdata/content_keys.txt`.

- [ ] **Step 6: Run both tests**

Run: `npx vitest run client/src/content/__tests__/registry.test.ts && cd go-server && go test ./internal/handler -run TestAllowlist -v`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add client/scripts/dump-content-keys.mjs go-server/testdata/content_keys.txt go-server/internal/handler/content_override_parity_test.go client/src/content/__tests__/registry.test.ts
git commit -m "test(content): registry/allowlist parity guard"
```

---

### Task 9: `useContentOverrides` hook + `t()` merge

**Files:**
- Create: `client/src/content/useContentOverrides.ts`
- Modify: `client/src/contexts/LanguageContext.tsx`
- Modify: `client/src/App.tsx` (ensure `LanguageProvider` is INSIDE `QueryClientProvider`)
- Test: `client/src/content/__tests__/useContentOverrides.test.tsx`

**Interfaces:**
- Consumes: `apiRequest`/`queryClient` conventions; endpoint `GET /api/content-overrides` returning `{ overrides: {key, locale, value}[] }`.
- Produces:
  - `useContentOverrides(): { map: Record<string, Record<string, string>> }` where `map[locale][key] = value`.
  - `t(key)` now returns override → compiled default.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/content/__tests__/useContentOverrides.test.tsx
import { describe, it, expect } from "vitest";
import { buildOverrideMap } from "../useContentOverrides";

describe("buildOverrideMap", () => {
  it("groups by locale then key", () => {
    const map = buildOverrideMap([
      { key: "hero.saveTheDate", locale: "en", value: "Save!" },
      { key: "hero.saveTheDate", locale: "id", value: "Simpan!" },
      { key: "wedding.date", locale: "*", value: "2026-07-05T14:00:00+07:00" },
    ]);
    expect(map.en["hero.saveTheDate"]).toBe("Save!");
    expect(map.id["hero.saveTheDate"]).toBe("Simpan!");
    expect(map["*"]["wedding.date"]).toBe("2026-07-05T14:00:00+07:00");
  });

  it("ignores empty values", () => {
    const map = buildOverrideMap([{ key: "hero.rsvpNow", locale: "en", value: "" }]);
    expect(map.en?.["hero.rsvpNow"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/content/__tests__/useContentOverrides.test.tsx`
Expected: FAIL — cannot resolve `../useContentOverrides`.

- [ ] **Step 3: Write the hook**

```ts
// client/src/content/useContentOverrides.ts
import { useQuery } from "@tanstack/react-query";

export interface ContentOverrideRow {
  key: string;
  locale: string;
  value: string;
}

export type OverrideMap = Record<string, Record<string, string>>; // [locale][key] = value

export function buildOverrideMap(rows: ContentOverrideRow[]): OverrideMap {
  const map: OverrideMap = {};
  for (const r of rows) {
    if (!r.value) continue; // empty => fall back to default
    (map[r.locale] ??= {})[r.key] = r.value;
  }
  return map;
}

export function useContentOverrides(): { map: OverrideMap; isLoading: boolean } {
  const { data, isLoading } = useQuery<{ overrides: ContentOverrideRow[] }>({
    queryKey: ["/api/content-overrides"],
  });
  const map = buildOverrideMap(data?.overrides ?? []);
  return { map, isLoading };
}
```

- [ ] **Step 4: Run unit test to verify it passes**

Run: `npx vitest run client/src/content/__tests__/useContentOverrides.test.tsx`
Expected: PASS

- [ ] **Step 5: Merge overrides into `t()`**

Rewrite `client/src/contexts/LanguageContext.tsx`. The registry key differs from the raw `TranslationKey` (dotted vs flat). `t()` is called with flat `TranslationKey`s throughout the app; map each flat key to its dotted registry key via a reverse lookup built from the registry's `localeKey`.

```tsx
import { createContext, useContext, useState, useMemo } from "react";
import { en, type TranslationKey, interpolate } from "@/locales/en";
import { id } from "@/locales/id";
import { CONTENT_REGISTRY } from "@/content/registry";
import { useContentOverrides } from "@/content/useContentOverrides";

type Lang = "en" | "id";

const translations: Record<Lang, Record<TranslationKey, string>> = { en, id };

// Reverse map: flat locale key -> dotted DB key (only bilingual fields with a localeKey).
const LOCALE_KEY_TO_DB_KEY: Partial<Record<TranslationKey, string>> = {};
for (const f of CONTENT_REGISTRY) {
  if (f.bilingual && f.localeKey) LOCALE_KEY_TO_DB_KEY[f.localeKey] = f.key;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  dateLocale: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readLangFromURL(): Lang {
  if (typeof window === "undefined") return "en";
  const param = new URLSearchParams(window.location.search).get("lang");
  return param === "id" ? "id" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLangFromURL);
  const { map } = useContentOverrides();

  const setLang = (next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("lang", next);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
  };

  const t = useMemo(
    () =>
      (key: TranslationKey): string => {
        const dbKey = LOCALE_KEY_TO_DB_KEY[key];
        if (dbKey) {
          const override = map[lang]?.[dbKey] ?? map.en?.[dbKey];
          if (override) return override;
        }
        return translations[lang][key] ?? translations.en[key];
      },
    [lang, map]
  );

  const dateLocale = lang === "id" ? "id-ID" : "en-GB";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export { interpolate };
```

- [ ] **Step 6: Ensure provider order in App.tsx**

Open `client/src/App.tsx`. Confirm `<LanguageProvider>` is rendered INSIDE `<QueryClientProvider>` (the hook uses React Query). If `LanguageProvider` currently wraps `QueryClientProvider`, swap them so QueryClient is outermost. Show the corrected nesting:

```tsx
<QueryClientProvider client={queryClient}>
  <LanguageProvider>
    {/* ...existing tree... */}
  </LanguageProvider>
</QueryClientProvider>
```

- [ ] **Step 6b: Guard existing tests against the new QueryClient dependency**

`LanguageProvider` now calls `useQuery`, which throws "No QueryClient set" if
mounted without a `QueryClientProvider` ancestor. Find every test that renders
`LanguageProvider` (directly or via a component tree) and confirm each wraps in a
QueryClient:

Run: `grep -rln "LanguageProvider\|useLanguage" client/src --include=*.test.tsx --include=*.test.ts`
For each hit, ensure the render wraps the tree in
`<QueryClientProvider client={new QueryClient(...)}>`. If the repo has a shared
test render helper, update it once there instead. `useContentOverrides` returns
an empty map when the query has no data, so no fetch mock is required for these
tests to pass — only the provider must exist.

- [ ] **Step 7: Typecheck + full frontend tests**

Run: `npm run check && npx vitest run`
Expected: typecheck passes; all tests PASS. (Existing `t()` callers still compile — signature unchanged.)

- [ ] **Step 8: Commit**

```bash
git add client/src/content/useContentOverrides.ts client/src/contexts/LanguageContext.tsx client/src/App.tsx client/src/content/__tests__/useContentOverrides.test.tsx
git commit -m "feat(content): merge overrides into t()"
```

---

### Task 10: `useWeddingConfig` hook (structural values)

**Files:**
- Create: `client/src/content/useWeddingConfig.ts`
- Test: `client/src/content/__tests__/useWeddingConfig.test.ts`

**Interfaces:**
- Consumes: `useContentOverrides` (Task 9), `WEDDING_DATE`/`VENUES` from `@/lib/constants`.
- Produces:
  - `parseWeddingConfig(map: OverrideMap): { weddingDate: Date; venues: VenueConfig[] }` (pure, testable)
  - `useWeddingConfig(): { weddingDate: Date; venues: VenueConfig[] }`
  - `VenueConfig = { key: "matrimony"|"reception"; title: string; time: string; location: string; address: string; mapUrl: string }`

- [ ] **Step 1: Write the failing test**

```ts
// client/src/content/__tests__/useWeddingConfig.test.ts
import { describe, it, expect } from "vitest";
import { parseWeddingConfig } from "../useWeddingConfig";
import { WEDDING_DATE } from "@/lib/constants";

describe("parseWeddingConfig", () => {
  it("falls back to constants when no override", () => {
    const cfg = parseWeddingConfig({});
    expect(cfg.weddingDate.getTime()).toBe(WEDDING_DATE.getTime());
    expect(cfg.venues).toHaveLength(2);
  });

  it("uses a valid date override", () => {
    const cfg = parseWeddingConfig({ "*": { "wedding.date": "2027-01-02T10:00:00+07:00" } });
    expect(cfg.weddingDate.getUTCFullYear()).toBe(2027);
  });

  it("falls back on an invalid date override", () => {
    const cfg = parseWeddingConfig({ "*": { "wedding.date": "garbage" } });
    expect(cfg.weddingDate.getTime()).toBe(WEDDING_DATE.getTime());
  });

  it("overrides a venue time via '*' locale", () => {
    const cfg = parseWeddingConfig({ "*": { "venue.matrimony.time": "1:00 PM - 5:00 PM" } });
    expect(cfg.venues[0].time).toBe("1:00 PM - 5:00 PM");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/content/__tests__/useWeddingConfig.test.ts`
Expected: FAIL — cannot resolve `../useWeddingConfig`.

- [ ] **Step 3: Write the hook**

Note: venue title/location/address are bilingual (rows under `en`/`id`), while time/mapUrl are `*`. `parseWeddingConfig` takes the full map and a `lang` for the bilingual bits; default `lang="en"`.

```ts
// client/src/content/useWeddingConfig.ts
import { WEDDING_DATE, VENUES } from "@/lib/constants";
import { useContentOverrides, type OverrideMap } from "./useContentOverrides";
import { useLanguage } from "@/contexts/LanguageContext";

export interface VenueConfig {
  key: "matrimony" | "reception";
  title: string;
  time: string;
  location: string;
  address: string;
  mapUrl: string;
  icon: string;
}

// Existing hardcoded map embeds (from DetailsSection). Kept as defaults.
const DEFAULT_MAP_URLS: Record<"matrimony" | "reception", string> = {
  matrimony: "",
  reception: "",
};

function pick(map: OverrideMap, lang: string, key: string, fallback: string): string {
  return map[lang]?.[key] ?? map.en?.[key] ?? map["*"]?.[key] ?? fallback;
}

export function parseWeddingConfig(map: OverrideMap, lang = "en"): {
  weddingDate: Date;
  venues: VenueConfig[];
} {
  // Wedding date (structural, '*').
  let weddingDate = WEDDING_DATE;
  const rawDate = map["*"]?.["wedding.date"];
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) weddingDate = parsed;
  }

  const venues: VenueConfig[] = [
    {
      key: "matrimony",
      title: pick(map, lang, "venue.matrimony.title", VENUES[0].title),
      time: map["*"]?.["venue.matrimony.time"] ?? VENUES[0].time,
      location: pick(map, lang, "venue.location", VENUES[0].location),
      address: pick(map, lang, "venue.address", VENUES[0].address),
      mapUrl: map["*"]?.["venue.matrimony.mapUrl"] ?? DEFAULT_MAP_URLS.matrimony,
      icon: VENUES[0].icon,
    },
    {
      key: "reception",
      title: pick(map, lang, "venue.reception.title", VENUES[1].title),
      time: map["*"]?.["venue.reception.time"] ?? VENUES[1].time,
      location: pick(map, lang, "venue.location", VENUES[1].location),
      address: pick(map, lang, "venue.address", VENUES[1].address),
      mapUrl: map["*"]?.["venue.reception.mapUrl"] ?? DEFAULT_MAP_URLS.reception,
      icon: VENUES[1].icon,
    },
  ];

  return { weddingDate, venues };
}

export function useWeddingConfig() {
  const { map } = useContentOverrides();
  const { lang } = useLanguage();
  return parseWeddingConfig(map, lang);
}
```

> Before writing, open `client/src/components/DetailsSection.tsx` and copy the two real hardcoded Google Maps embed URLs (`:139` link and `:168` iframe src) into `DEFAULT_MAP_URLS` so the defaults match today's site exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run client/src/content/__tests__/useWeddingConfig.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/content/useWeddingConfig.ts client/src/content/__tests__/useWeddingConfig.test.ts
git commit -m "feat(content): useWeddingConfig for structural overrides"
```

---

## Phase 3 — Migrate literals & wire consumers

### Task 11: Add locale keys for migrated literals

**Files:**
- Modify: `client/src/locales/en.ts`
- Modify: `client/src/locales/id.ts`
- Modify: `client/src/content/registry.ts` (set `localeKey` on the migrated fields)

**Interfaces:**
- Consumes: registry (Task 7).
- Produces: new `TranslationKey`s: `groomName`, `brideName`, `groomFather`, `groomMother`, `brideFather`, `brideMother`, `footerMonogram`, `navHome`, `navOurStory`, `navWeddingDetails`, `navWishes`, `navMonogram`.

- [ ] **Step 1: Add keys to `en.ts`**

Inside the `en` object (before the closing `} as const;`), add:

```ts
  // Migrated literals — Couple names/parents
  groomName: "Andreas",
  brideName: "Christine Natasya Serena",
  groomFather: "( † ) Mr. Buyung Oentoro",
  groomMother: "Mrs. Tjhin Miauw Fun",
  brideFather: "Mr. Chai Ko Kiun",
  brideMother: "Mrs. Bong Lie Fong",
  // Footer / Nav monograms + labels
  footerMonogram: "A&C",
  navMonogram: "A&C",
  navHome: "Home",
  navOurStory: "Our Story",
  navWeddingDetails: "Wedding Details",
  navWishes: "Wishes",
```

- [ ] **Step 2: Add the same keys to `id.ts`**

Open `client/src/locales/id.ts` and add the same keys with Indonesian values (names/monograms stay identical; translate nav labels):

```ts
  groomName: "Andreas",
  brideName: "Christine Natasya Serena",
  groomFather: "( † ) Bapak Buyung Oentoro",
  groomMother: "Ibu Tjhin Miauw Fun",
  brideFather: "Bapak Chai Ko Kiun",
  brideMother: "Ibu Bong Lie Fong",
  footerMonogram: "A&C",
  navMonogram: "A&C",
  navHome: "Beranda",
  navOurStory: "Kisah Kami",
  navWeddingDetails: "Detail Pernikahan",
  navWishes: "Ucapan",
```

> Match the exact key set in both files, or the `Record<Lang, ...>` typing in `LanguageContext` breaks. Run `npm run check` to confirm.

- [ ] **Step 3: Set `localeKey` on migrated registry fields**

In `client/src/content/registry.ts`, add `localeKey` to the fields that had none:

```ts
  { section: "Couple", key: "couple.groomName", label: "Groom display name", type: "text", bilingual: true, localeKey: "groomName" },
  { section: "Couple", key: "couple.brideName", label: "Bride display name", type: "text", bilingual: true, localeKey: "brideName" },
  { section: "Couple", key: "couple.groomFather", label: "Groom's father", type: "text", bilingual: true, localeKey: "groomFather" },
  { section: "Couple", key: "couple.groomMother", label: "Groom's mother", type: "text", bilingual: true, localeKey: "groomMother" },
  { section: "Couple", key: "couple.brideFather", label: "Bride's father", type: "text", bilingual: true, localeKey: "brideFather" },
  { section: "Couple", key: "couple.brideMother", label: "Bride's mother", type: "text", bilingual: true, localeKey: "brideMother" },
  { section: "Footer", key: "footer.monogram", label: "Monogram (e.g. A&C)", type: "text", bilingual: true, localeKey: "footerMonogram" },
  { section: "Navigation", key: "nav.home", label: "Home", type: "text", bilingual: true, localeKey: "navHome" },
  { section: "Navigation", key: "nav.ourStory", label: "Our Story", type: "text", bilingual: true, localeKey: "navOurStory" },
  { section: "Navigation", key: "nav.weddingDetails", label: "Wedding Details", type: "text", bilingual: true, localeKey: "navWeddingDetails" },
  { section: "Navigation", key: "nav.wishes", label: "Wishes", type: "text", bilingual: true, localeKey: "navWishes" },
  { section: "Navigation", key: "nav.monogram", label: "Nav monogram", type: "text", bilingual: true, localeKey: "navMonogram" },
```

> Venue bilingual fields (`venue.matrimony.title`, `venue.reception.title`, `venue.location`, `venue.address`) stay WITHOUT `localeKey` — their defaults come from `constants.ts` via `useWeddingConfig`, not the locale files. The registry parity test only asserts `localeKey` existence when set, so this is fine.

- [ ] **Step 4: Typecheck + registry test**

Run: `npm run check && npx vitest run client/src/content/__tests__/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/locales/en.ts client/src/locales/id.ts client/src/content/registry.ts
git commit -m "feat(content): locale keys for migrated literals"
```

---

### Task 12: Wire CoupleSection to `t()` keys

**Files:**
- Modify: `client/src/components/CoupleSection.tsx` (lines ~81, 84, 86, 107, 110, 112 and the `GROOM_NAME`/`BRIDE_NAME` headings)

**Interfaces:**
- Consumes: `useLanguage().t`, keys `groomName`, `brideName`, `groomFather`, `groomMother`, `brideFather`, `brideMother` (Task 11).

- [ ] **Step 1: Replace the literals**

Open `CoupleSection.tsx`. Ensure `const { t } = useLanguage();` is present (it already uses `t` for `ourLoveStory` etc.). Replace:
- the groom heading (`{GROOM_NAME}`) → `{t("groomName")}`
- `( † ) Mr. Buyung Oentoro` → `{t("groomFather")}`
- `Mrs. Tjhin Miauw Fun` → `{t("groomMother")}`
- the bride heading (`{BRIDE_NAME}`) → `{t("brideName")}`
- `Mr. Chai Ko Kiun` → `{t("brideFather")}`
- `Mrs. Bong Lie Fong` → `{t("brideMother")}`

Remove now-unused `GROOM_NAME`/`BRIDE_NAME` imports if they are no longer referenced in this file.

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: PASS (no unused-import or missing-symbol errors).

- [ ] **Step 3: Verify defaults unchanged in the browser**

Run: `npm run dev` (and the Go server per CLAUDE.md). Load the invitation with an empty `content_overrides` table. Confirm Couple section shows the same names/parents as before.
Expected: identical to current site.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/CoupleSection.tsx
git commit -m "feat(couple): route names/parents through t()"
```

---

### Task 13: Wire NavBar and Footer monograms/labels

**Files:**
- Modify: `client/src/components/NavBar.tsx` (labels ~129/151/172/242 + mobile ~297-351, monogram ~96)
- Modify: `client/src/components/Footer.tsx` (monogram ~42; couple names heading ~28)

**Interfaces:**
- Consumes: keys `navHome`, `navOurStory`, `navWeddingDetails`, `navWishes`, `navMonogram`, `footerMonogram`, `groomName`, `brideName`.

- [ ] **Step 1: NavBar**

Ensure `const { t } = useLanguage();` exists in `NavBar.tsx` (add if missing). Replace each hardcoded label (`Home`, `Our Story`, `Wedding Details`, `Wishes`) — both desktop and mobile duplicates — with `t("navHome")`, `t("navOurStory")`, `t("navWeddingDetails")`, `t("navWishes")`. Replace the `A&C` monogram with `t("navMonogram")`.

- [ ] **Step 2: Footer**

In `Footer.tsx`, replace `A&C` monogram with `t("footerMonogram")`. For the `{GROOM_NAME} & {BRIDE_NAME}` heading (~line 28), use `{t("groomName")} & {t("brideName")}`. Add `const { t } = useLanguage();` if not present; drop unused constant imports.

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/components/NavBar.tsx client/src/components/Footer.tsx
git commit -m "feat(nav,footer): route labels/monograms through t()"
```

---

### Task 14: Wire structural consumers to `useWeddingConfig`

**Files:**
- Modify: `client/src/components/CountdownSection.tsx` (and/or `HeroSection.tsx` if the countdown lives there)
- Modify: `client/src/components/DetailsSection.tsx` (venue map iframe `:168`, link `:139`, address `:135`, location `:132`, times, calendar link builder)
- Modify: any calendar-link builder that imports `WEDDING_DATE`

**Interfaces:**
- Consumes: `useWeddingConfig()` (Task 10).

- [ ] **Step 1: Find all `WEDDING_DATE` / `VENUES` importers**

Run: `grep -rn "WEDDING_DATE\|VENUES\|FORMATTED_WEDDING_DATE" client/src --include=*.tsx --include=*.ts | grep -v content/ | grep -v constants.ts`
Expected: a list of consuming components. Each must switch from the constant to `useWeddingConfig()`.

- [ ] **Step 2: Replace countdown source**

In the component computing the countdown, replace `WEDDING_DATE` with `const { weddingDate } = useWeddingConfig();` and use `weddingDate`. Keep the existing countdown math unchanged (it already operates on a `Date`).

- [ ] **Step 3: Replace venue rendering in DetailsSection**

Replace `VENUES.map(...)` with `const { venues } = useWeddingConfig();` then `venues.map(...)`. Use `venue.mapUrl` for the iframe `src` and the "View on Maps" link `href`; `venue.location`, `venue.address`, `venue.time`, `venue.title` for text. Preserve existing markup/classes.

- [ ] **Step 4: Typecheck + tests**

Run: `npm run check && npx vitest run`
Expected: PASS

- [ ] **Step 5: Browser verify defaults**

Run: with empty overrides, load the page. Countdown, venue map, address, times, and calendar links must match the current site exactly.
Expected: identical.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/CountdownSection.tsx client/src/components/DetailsSection.tsx client/src/components/HeroSection.tsx
git commit -m "feat(details,countdown): read structural data from useWeddingConfig"
```

---

## Phase 4 — Admin editor

### Task 15: `ContentPage` admin editor

**Files:**
- Create: `client/src/pages/admin/ContentPage.tsx`
- Modify: `client/src/pages/admin/AdminLayout.tsx` (import, `NAV_ITEMS`, `<Route>`)
- Test: `client/src/pages/admin/__tests__/ContentPage.test.tsx`

**Interfaces:**
- Consumes: `CONTENT_REGISTRY`, `CONTENT_SECTIONS` (Task 7); `useContentOverrides` map (Task 9); compiled `en`/`id` locales for defaults; `apiRequest`/`queryClient`; `useAdminContext().handleAutoLogout`.
- Produces: admin route `/content` rendering one accordion panel per section; bulk save to `PATCH /api/admin/content-overrides/bulk`.

- [ ] **Step 1: Write the failing test**

```tsx
// client/src/pages/admin/__tests__/ContentPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContentPage from "../ContentPage";
import { AdminContext } from "../AdminContext";
import { CONTENT_REGISTRY } from "@/content/registry";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Empty overrides response.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ overrides: [] }),
  }) as unknown as typeof fetch;
  return render(
    <QueryClientProvider client={qc}>
      <AdminContext.Provider value={{ handleAutoLogout: vi.fn() }}>
        <ContentPage />
      </AdminContext.Provider>
    </QueryClientProvider>
  );
}

describe("ContentPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders an input for a known field with its default value", async () => {
    renderPage();
    // Field: hero.saveTheDate (en) — default "Save the Date"
    const input = await screen.findByTestId("content-hero.saveTheDate-en");
    expect((input as HTMLInputElement).value).toBe("Save the Date");
  });

  it("renders every registry field", async () => {
    renderPage();
    // At least one input per bilingual field's en locale.
    const firstBilingual = CONTENT_REGISTRY.find((f) => f.bilingual)!;
    expect(await screen.findByTestId(`content-${firstBilingual.key}-en`)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run client/src/pages/admin/__tests__/ContentPage.test.tsx`
Expected: FAIL — cannot resolve `../ContentPage`.

- [ ] **Step 3: Write ContentPage**

```tsx
// client/src/pages/admin/ContentPage.tsx
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAdminContext } from "./AdminContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { CONTENT_REGISTRY, CONTENT_SECTIONS, type ContentField } from "@/content/registry";
import { en } from "@/locales/en";
import { id } from "@/locales/id";
import { WEDDING_DATE, VENUES } from "@/lib/constants";

type OverrideRow = { key: string; locale: string; value: string };
type FormState = Record<string, string>; // fieldId = `${key}|${locale}` -> value

function defaultFor(field: ContentField, locale: "en" | "id" | "*"): string {
  if (field.bilingual && field.localeKey) {
    return (locale === "id" ? id : en)[field.localeKey] ?? "";
  }
  // Structural / venue defaults from constants.
  switch (field.key) {
    case "wedding.date":
      return WEDDING_DATE.toISOString();
    case "venue.matrimony.time":
      return VENUES[0].time;
    case "venue.reception.time":
      return VENUES[1].time;
    case "venue.matrimony.title":
      return VENUES[0].title;
    case "venue.reception.title":
      return VENUES[1].title;
    case "venue.location":
      return VENUES[0].location;
    case "venue.address":
      return VENUES[0].address;
    default:
      return "";
  }
}

function localesFor(field: ContentField): Array<"en" | "id" | "*"> {
  return field.bilingual ? ["en", "id"] : ["*"];
}

export default function ContentPage() {
  const { toast } = useToast();
  const { handleAutoLogout } = useAdminContext();
  const [form, setForm] = useState<FormState>({});

  const { data } = useQuery<{ overrides: OverrideRow[] }>({
    queryKey: ["/api/content-overrides"],
  });

  // Seed form: override value if present, else compiled/constant default.
  useEffect(() => {
    const overrides = data?.overrides ?? [];
    const byId: Record<string, string> = {};
    for (const o of overrides) byId[`${o.key}|${o.locale}`] = o.value;
    const next: FormState = {};
    for (const field of CONTENT_REGISTRY) {
      for (const loc of localesFor(field)) {
        const fid = `${field.key}|${loc}`;
        next[fid] = byId[fid] ?? defaultFor(field, loc);
      }
    }
    setForm(next);
  }, [data]);

  const bySection = useMemo(() => {
    const groups: Record<string, ContentField[]> = {};
    for (const f of CONTENT_REGISTRY) (groups[f.section] ??= []).push(f);
    return groups;
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      // Send EVERY field's current value. Empty string = revert (tombstone):
      // buildOverrideMap skips empty values so the read path falls back to the
      // compiled/constant default. Rows equal to the default are harmless (the
      // read path returns the same text). Do NOT diff against default — a
      // datetime-local value never string-equals the ISO default, and typing a
      // default string back must still clear a stale row. ~140 rows < 500 cap.
      const overrides: OverrideRow[] = [];
      for (const field of CONTENT_REGISTRY) {
        for (const loc of localesFor(field)) {
          const fid = `${field.key}|${loc}`;
          let value = form[fid] ?? "";
          // Convert datetime-local -> RFC3339 for the wedding date (see Step 3b).
          if (field.key === "wedding.date" && value) {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) value = d.toISOString();
          }
          overrides.push({ key: field.key, locale: loc, value });
        }
      }
      await apiRequest("PATCH", "/api/admin/content-overrides/bulk", { overrides });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content-overrides"] });
      toast({ title: "Success", description: "Content saved" });
    },
    onError: (error: Error) => {
      handleAutoLogout(error);
      toast({ title: "Error", description: `Failed to save: ${error.message}`, variant: "destructive" });
    },
  });

  const setField = (fid: string, value: string) =>
    setForm((prev) => ({ ...prev, [fid]: value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Site Content</h2>
          <p className="text-sm text-gray-600">Edit invitation text. Blank/default fields fall back to the built-in copy.</p>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="content-save">
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All
        </Button>
      </div>

      {CONTENT_SECTIONS.map((section) => (
        <Card key={section}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{section}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {bySection[section].map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <div className={field.bilingual ? "grid gap-3 md:grid-cols-2" : ""}>
                  {localesFor(field).map((loc) => {
                    const fid = `${field.key}|${loc}`;
                    const inputType =
                      field.type === "date" ? "datetime-local" : field.type === "url" ? "url" : "text";
                    return (
                      <div key={fid} className="space-y-1">
                        {field.bilingual && (
                          <span className="text-xs uppercase tracking-wide text-gray-400">
                            {loc === "en" ? "English" : "Indonesian"}
                          </span>
                        )}
                        {field.type === "textarea" ? (
                          <textarea
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            rows={3}
                            value={form[fid] ?? ""}
                            onChange={(e) => setField(fid, e.target.value)}
                            data-testid={`content-${field.key}-${loc}`}
                          />
                        ) : (
                          <Input
                            type={inputType}
                            value={form[fid] ?? ""}
                            onChange={(e) => setField(fid, e.target.value)}
                            data-testid={`content-${field.key}-${loc}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

> Note on the `datetime-local` field: the browser input yields `YYYY-MM-DDTHH:mm` (no timezone), but the server requires RFC3339. In Step 3b below, convert on save. For the first pass, if a simpler contract is acceptable, change the `wedding.date` server validation to also accept `2006-01-02T15:04` — but RFC3339 is the spec. Implement the conversion.

- [ ] **Step 3b: Seed the datetime-local field from an ISO override**

Save-side conversion (datetime-local → RFC3339) already lives in the `mutationFn`
above. For the read direction, seed the field from an ISO override back into
`datetime-local` shape in the `useEffect` (slice to `YYYY-MM-DDTHH:mm`):

```ts
if (field.key === "wedding.date" && next[fid]) {
  const d = new Date(next[fid]);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    next[fid] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
```

- [ ] **Step 4: Register the page in AdminLayout**

In `AdminLayout.tsx`:
- import: `import ContentPage from "./ContentPage";`
- add an icon to the lucide import (e.g. `FileText`).
- add to `NAV_ITEMS`: `{ path: "/content", label: "Content", icon: FileText },`
- add a route: `<Route path="/content" component={ContentPage} />`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run client/src/pages/admin/__tests__/ContentPage.test.tsx`
Expected: PASS

- [ ] **Step 6: Typecheck + full frontend tests**

Run: `npm run check && npx vitest run`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/ContentPage.tsx client/src/pages/admin/AdminLayout.tsx client/src/pages/admin/__tests__/ContentPage.test.tsx
git commit -m "feat(admin): content editor page"
```

---

## Phase 5 — End-to-end verification & docs

### Task 16: Manual E2E + issue doc

**Files:**
- Modify: `go-server/issuesResolution.md` (append an entry only if a bug was found & fixed during E2E)

- [ ] **Step 1: Run the migration**

Run: `cd go-server && make migrate` (requires `DATABASE_URL`).
Expected: `content_overrides` table created. (Skip if using in-memory dev; note the endpoint returns `{"overrides":[]}` either way.)

- [ ] **Step 2: Full-stack smoke**

Run: build + start per CLAUDE.md (`npm run dev` + Go server, or the single-process production preview). Steps:
1. Load invitation with empty overrides → confirm identical to current site (spot-check Couple, Details/venue, Countdown, Nav, Footer).
2. Log into `/admin`, open **Content**, change `hero.saveTheDate` (EN), a story paragraph, the groom name, `wedding.date`, and a venue time. Save.
3. Reload invitation → confirm the edited strings/date/time now show; unedited strings unchanged.
4. Switch `?lang=id` → confirm ID overrides apply and untouched ID strings fall back to compiled `id.ts`.
5. Revert an override by **clearing the field to empty** and saving (empty = tombstone) → confirm the site reverts to the built-in default. (Do NOT rely on retyping the default string; reverts are done by clearing.)

Expected: all pass.

- [ ] **Step 3: Backend + frontend test suites green**

Run: `cd go-server && make test` then (from root) `npm run check && npx vitest run`
Expected: all PASS.

- [ ] **Step 4: If any bug was found and fixed, document it**

Append to `go-server/issuesResolution.md` an entry with symptom, root cause, resolution (per project convention). If no bug, skip.

- [ ] **Step 5: Commit (if doc changed)**

```bash
git add go-server/issuesResolution.md
git commit -m "docs: content overrides E2E issue notes"
```

---

## Self-Review Notes

- **Spec coverage:** storage (T1), model (T2), repo (T3–T4), handler+validation (T5), routes (T6), registry (T7), parity guard (T8), read-path merge (T9), structural hook (T10), literal migration (T11–T14), admin editor (T15), E2E (T16). All spec sections mapped.
- **Type consistency:** `InsertContentOverride{Key,Locale,Value}`, `ContentOverride{...,UpdatedAt}`, `OverrideMap[locale][key]`, `ContentField`, `buildOverrideMap`, `parseWeddingConfig`, `useWeddingConfig`, `useContentOverrides` used identically across tasks.
- **Known risk carried from spec:** Go allowlist ↔ TS registry drift — guarded by T8's committed dump + two parity tests. Regenerate the dump whenever keys change.
- **Provider ordering (T9 Step 6):** verify `App.tsx` puts `QueryClientProvider` outside `LanguageProvider`; this is the one non-mechanical wiring risk.
- **Default map URLs (T10):** must be copied verbatim from `DetailsSection.tsx` so empty overrides reproduce the current map exactly.
- **Full scope:** registry now covers ALL build-time prose — including countdown labels, welcome-overlay buttons, e-gift copy toasts, and the interpolated strings (`rsvpThankYou`, `seeAllWishes`, `rsvpConfirm*`, `thankYouMessage`). Interpolated overrides are guarded server-side: a non-empty value missing its required `{name}`/`{count}` token is rejected (400). The read path is unchanged — `t()` returns the override and the existing `interpolate()` caller fills tokens.
