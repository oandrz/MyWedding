# Production Readiness & Portfolio Quality Improvements — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the MyWedding platform for wedding-day reliability and elevate code quality to portfolio standard.

**Architecture:** Two-phase approach. Phase 1 adds security middleware (bcrypt, rate limiting, sanitization), performance infrastructure (pagination, HTTP caching, streaming uploads), and database indexes. Phase 2 introduces structured error responses, frontend/backend test coverage with MSW, component refactoring, and documentation cleanup. All changes use TDD with the existing `testEnv` test harness.

**Tech Stack:** Go 1.25 / Chi v5 / pgx v5 / bcrypt / bluemonday / React 18 / TanStack Query / Vitest / MSW

**Spec:** `docs/superpowers/specs/2026-03-22-production-readiness-improvements.md`

---

## File Map

### Phase 1 — New Files
| File | Responsibility |
|------|---------------|
| `go-server/migrations/003_add_indexes.sql` | Database indexes for email and created_at columns |
| `go-server/internal/service/sanitizer.go` | HTML sanitization service using bluemonday |
| `go-server/internal/service/sanitizer_test.go` | Tests for sanitizer |
| `go-server/internal/middleware/ratelimit.go` | In-memory IP-based rate limiter |
| `go-server/internal/middleware/ratelimit_test.go` | Tests for rate limiter |
| `go-server/internal/middleware/cache_headers.go` | HTTP Cache-Control + ETag middleware |
| `go-server/internal/middleware/cache_headers_test.go` | Tests for cache headers |

### Phase 1 — Modified Files
| File | Change |
|------|--------|
| `go-server/go.mod` | Add bcrypt, bluemonday dependencies |
| `go-server/internal/config/config.go` | Add `AdminPasswordHash` field |
| `go-server/internal/handler/auth.go` | Use bcrypt for password comparison |
| `go-server/internal/handler/message.go` | Add sanitization + pagination support |
| `go-server/internal/handler/rsvp.go` | Add sanitization on name field |
| `go-server/internal/handler/welcome_screen.go` | Add sanitization on text fields |
| `go-server/internal/handler/upload.go` | Add caption sanitization + streaming refactor |
| `go-server/internal/handler/media.go` | Add pagination support |
| `go-server/internal/handler/contract_test.go` | Update contracts for pagination response envelope |
| `go-server/internal/handler/handler_test.go` | Update `testEnv` for bcrypt password |
| `go-server/internal/repository/repository.go` | Add paginated methods to interface |
| `go-server/internal/repository/memory.go` | Implement paginated methods |
| `go-server/internal/repository/postgres.go` | Implement paginated methods with LIMIT/OFFSET |
| `go-server/internal/router/router.go` | Wire rate limiter + cache headers middleware |
| `go-server/internal/service/storage.go` | Change ObjectStorage interface to accept `io.Reader` |
| `go-server/internal/service/storage_supabase.go` | Update SupabaseStorage for `io.Reader` |
| `go-server/internal/service/storage_test.go` | Update tests for `io.Reader` |
| `go-server/internal/handler/config_image.go` | Update upload callers for `io.Reader` |

### Phase 2 — New Files
| File | Responsibility |
|------|---------------|
| `go-server/internal/handler/errors.go` | AppError type, respondError helper, error code constants |
| `go-server/internal/handler/rsvp_test.go` | RSVP handler business logic tests |
| `go-server/internal/handler/media_test.go` | Media handler tests |
| `go-server/internal/handler/message_test.go` | Message handler tests |
| `go-server/internal/handler/upload_test.go` | Upload handler tests |
| `client/src/test/mocks/handlers.ts` | MSW request handlers |
| `client/src/test/setup.ts` | MSW server setup |
| `client/src/components/__tests__/RsvpSection.test.tsx` | RSVP form tests |
| `client/src/hooks/__tests__/useFeatureFlags.test.ts` | Feature flag tests |
| `client/src/lib/__tests__/queryClient.test.ts` | API error handling tests |
| `client/src/components/__tests__/MessagesSection.test.tsx` | Message form tests |
| `client/src/components/__tests__/MessageWallSection.test.tsx` | Message list + pagination tests |
| `client/src/hooks/useImageAnalysis.ts` | Extracted image analysis hook |
| `client/src/components/ImagePreview.tsx` | Extracted image preview component |
| `client/src/hooks/useDragAndDrop.ts` | Extracted drag-and-drop hook |
| `client/src/components/ImageGrid.tsx` | Extracted image grid component |
| `docs/API.md` | API endpoint reference |

### Phase 2 — Modified Files
| File | Change |
|------|--------|
| `go-server/internal/handler/*.go` | Replace `writeError` with `respondError` |
| `go-server/internal/middleware/logging.go` | Add request ID to log attributes |
| `client/src/lib/queryClient.ts` | Parse structured error responses |
| `client/src/components/ImageUploadModal.tsx` | Extract hooks and components |
| `client/src/components/ImageManager.tsx` | Extract hooks and components |

---

## Chunk 1: Phase 1 — Security & Database

### Task 1: Database Indexes

**Files:**
- Create: `go-server/migrations/003_add_indexes.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 003_add_indexes.sql
-- Add indexes on frequently queried columns for email lookups and sorted queries.

CREATE INDEX IF NOT EXISTS idx_rsvp_email ON rsvp(email);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd go-server && cat migrations/003_add_indexes.sql`
Expected: the SQL above, no syntax errors

- [ ] **Step 3: Commit**

```bash
git add go-server/migrations/003_add_indexes.sql
git commit -m "feat: add database indexes for email and created_at columns"
```

---

### Task 2: Admin Password Hashing (bcrypt)

**Files:**
- Modify: `go-server/internal/config/config.go`
- Modify: `go-server/internal/handler/auth.go`
- Modify: `go-server/internal/handler/handler_test.go`
- Modify: `go-server/go.mod`

- [ ] **Step 1: Add bcrypt dependency**

Run: `cd go-server && go get golang.org/x/crypto/bcrypt`
Expected: `go.mod` updated (note: `golang.org/x/crypto` is already an indirect dep at v0.48.0, this promotes it to direct)

- [ ] **Step 2: Write failing test — bcrypt login accepts hashed password**

In `go-server/internal/handler/handler_test.go`, add after the existing `newTestEnv` function:

```go
// newTestEnvWithBcrypt creates a test env that uses ADMIN_PASSWORD_HASH for auth.
func newTestEnvWithBcrypt() *testEnv {
	hash, _ := bcrypt.GenerateFromPassword([]byte("testpass123"), bcrypt.DefaultCost)

	cfg := &config.Config{
		Env:               "development",
		Port:              5000,
		AdminPasswordHash: string(hash),
		SessionMaxAge:     1800,
		CORSOrigins:       []string{"*"},
	}

	repo := repository.NewMemoryRepository()
	sessions := middleware.NewSessionStore(30 * time.Minute)
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(5 * time.Minute)
	r := router.New(cfg, repo, sessions, csrf, cache)

	return &testEnv{
		handler:  r,
		cfg:      cfg,
		repo:     repo,
		sessions: sessions,
		csrf:     csrf,
		cache:    cache,
	}
}
```

Add import for `"golang.org/x/crypto/bcrypt"`.

Then in a new test in `contract_test.go` or a suitable location, add:

```go
func TestLogin_BcryptPassword(t *testing.T) {
	env := newTestEnvWithBcrypt()

	body := jsonBody(map[string]string{"password": "testpass123"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusOK)
	assertKeyExists(t, result, "csrfToken")
}

func TestLogin_BcryptPassword_WrongPassword(t *testing.T) {
	env := newTestEnvWithBcrypt()

	body := jsonBody(map[string]string{"password": "wrongpassword"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")

	contractResponse(t, env, req, http.StatusUnauthorized)
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run TestLogin_Bcrypt -v`
Expected: FAIL — `AdminPasswordHash` field doesn't exist on Config

- [ ] **Step 4: Add AdminPasswordHash to Config**

In `go-server/internal/config/config.go`, add field to struct:

```go
type Config struct {
	// ... existing fields ...
	AdminPassword     string
	AdminPasswordHash string // bcrypt hash — preferred over AdminPassword
	SessionMaxAge     int
	// ... rest ...
}
```

In the `Load()` function, after setting `AdminPassword`, add:

```go
cfg.AdminPasswordHash = getEnv("ADMIN_PASSWORD_HASH", "")

// If no hash provided but plaintext password exists, hash it at startup and warn
if cfg.AdminPasswordHash == "" && cfg.AdminPassword != "" {
	slog.Warn("ADMIN_PASSWORD is deprecated — use ADMIN_PASSWORD_HASH with a bcrypt hash instead")
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("Failed to hash admin password", "error", err)
		os.Exit(1)
	}
	cfg.AdminPasswordHash = string(hash)
}
```

Add `"golang.org/x/crypto/bcrypt"` to imports in `config.go`. (`"os"` is already imported.)

- [ ] **Step 5: Update auth.go Login to use bcrypt**

Replace the constant-time compare block in `auth.go` (line 34):

```go
// Old:
if subtle.ConstantTimeCompare([]byte(body.Password), []byte(h.Config.AdminPassword)) != 1 {

// New:
if err := bcrypt.CompareHashAndPassword([]byte(h.Config.AdminPasswordHash), []byte(body.Password)); err != nil {
```

Update imports: remove `"crypto/subtle"`, add `"golang.org/x/crypto/bcrypt"`.

- [ ] **Step 6: Update existing newTestEnv to work with bcrypt fallback**

The existing `newTestEnv` sets `AdminPassword: "testpass123"`. Since the `Load()` function auto-hashes plaintext passwords, but test doesn't call `Load()`, update `newTestEnv` to also set the hash:

```go
func newTestEnv() *testEnv {
	hash, _ := bcrypt.GenerateFromPassword([]byte("testpass123"), bcrypt.DefaultCost)

	cfg := &config.Config{
		Env:               "development",
		Port:              5000,
		AdminPassword:     "testpass123",
		AdminPasswordHash: string(hash),
		SessionMaxAge:     1800,
		CORSOrigins:       []string{"*"},
	}
	// ... rest unchanged ...
}
```

- [ ] **Step 7: Run all tests to verify**

Run: `cd go-server && go test ./internal/handler -run TestLogin -v`
Expected: All login tests PASS (both bcrypt-specific and existing contract tests)

Run: `cd go-server && make test`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
cd go-server && git add -A
git commit -m "feat: replace plaintext admin password with bcrypt hashing"
```

---

### Task 3: Input Sanitization (XSS Prevention)

**Files:**
- Create: `go-server/internal/service/sanitizer.go`
- Create: `go-server/internal/service/sanitizer_test.go`
- Modify: `go-server/internal/handler/message.go`
- Modify: `go-server/internal/handler/rsvp.go`
- Modify: `go-server/internal/handler/welcome_screen.go`
- Modify: `go-server/internal/handler/upload.go`
- Modify: `go-server/go.mod`

- [ ] **Step 1: Add bluemonday dependency**

Run: `cd go-server && go get github.com/microcosm-cc/bluemonday`

- [ ] **Step 2: Write failing test for sanitizer**

Create `go-server/internal/service/sanitizer_test.go`:

```go
package service

import "testing"

func TestSanitize(t *testing.T) {
	s := NewSanitizer()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"plain text", "Hello World", "Hello World"},
		{"strips script", `<script>alert('xss')</script>Hello`, "Hello"},
		{"allows bold", "<b>Bold</b>", "<b>Bold</b>"},
		{"allows italic", "<i>Italic</i>", "<i>Italic</i>"},
		{"allows em", "<em>Emphasis</em>", "<em>Emphasis</em>"},
		{"allows strong", "<strong>Strong</strong>", "<strong>Strong</strong>"},
		{"allows br", "Line1<br>Line2", "Line1<br>Line2"},
		{"strips div", "<div>Content</div>", "Content"},
		{"strips onclick", `<b onclick="alert('xss')">Bold</b>`, "<b>Bold</b>"},
		{"strips img", `<img src="x" onerror="alert('xss')">`, ""},
		{"empty string", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := s.Sanitize(tt.input)
			if got != tt.want {
				t.Errorf("Sanitize(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd go-server && go test ./internal/service -run TestSanitize -v`
Expected: FAIL — `NewSanitizer` undefined

- [ ] **Step 4: Implement sanitizer**

Create `go-server/internal/service/sanitizer.go`:

```go
package service

import "github.com/microcosm-cc/bluemonday"

// Sanitizer strips dangerous HTML tags from user input while allowing basic formatting.
type Sanitizer struct {
	policy *bluemonday.Policy
}

// NewSanitizer creates a sanitizer that allows only basic formatting tags.
func NewSanitizer() *Sanitizer {
	p := bluemonday.NewPolicy()
	p.AllowElements("b", "i", "em", "strong", "br")
	return &Sanitizer{policy: p}
}

// Sanitize strips disallowed HTML from the input string.
func (s *Sanitizer) Sanitize(input string) string {
	return s.policy.Sanitize(input)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd go-server && go test ./internal/service -run TestSanitize -v`
Expected: All PASS

- [ ] **Step 6: Wire sanitizer into handlers**

In `go-server/internal/handler/message.go`, add a `Sanitizer` field and use it:

```go
type MessageHandler struct {
	Repo      repository.Repository
	Sanitizer *service.Sanitizer
}
```

In `Create`, after the validation block (`if body.Name == "" || body.Content == ""`), add:

```go
if h.Sanitizer != nil {
	body.Name = h.Sanitizer.Sanitize(body.Name)
	body.Content = h.Sanitizer.Sanitize(body.Content)
}
```

Apply the same pattern to:

**`rsvp.go`** — add `Sanitizer *service.Sanitizer` field to `RsvpHandler`, sanitize `body.Name` in `Create` after validation.

**`welcome_screen.go`** — add `Sanitizer *service.Sanitizer` field to `WelcomeScreenHandler`. In `Update`, after `parseJSON`, sanitize pointer fields:

```go
if h.Sanitizer != nil {
	if body.HeadingText != nil {
		sanitized := h.Sanitizer.Sanitize(*body.HeadingText)
		body.HeadingText = &sanitized
	}
	if body.DeliveryLabel != nil {
		sanitized := h.Sanitizer.Sanitize(*body.DeliveryLabel)
		body.DeliveryLabel = &sanitized
	}
	if body.FallbackName != nil {
		sanitized := h.Sanitizer.Sanitize(*body.FallbackName)
		body.FallbackName = &sanitized
	}
}
```

Note: `InsertWelcomeScreen` fields are `*string` (pointer), not plain `string`. Must dereference before sanitizing.

**`upload.go`** — add `Sanitizer *service.Sanitizer` field to `UploadHandler` struct (existing fields: `Repo`, `Storage`, `Cache`). Sanitize `caption` in `Upload` (line 77, after `caption := r.FormValue("caption")`):

```go
if h.Sanitizer != nil && caption != "" {
	caption = h.Sanitizer.Sanitize(caption)
}
```

- [ ] **Step 7: Update router.go to inject sanitizer**

In `go-server/internal/router/router.go`, create the sanitizer and inject it:

```go
sanitizer := service.NewSanitizer()

rsvp := &handler.RsvpHandler{Repo: repo, Sanitizer: sanitizer}
message := &handler.MessageHandler{Repo: repo, Sanitizer: sanitizer}
welcomeScreen := &handler.WelcomeScreenHandler{Repo: repo, Sanitizer: sanitizer}
```

For `UploadHandler` (inside the `if o.storage != nil` block):

```go
upload = &handler.UploadHandler{
	Repo:      repo,
	Storage:   o.storage,
	Cache:     cache,
	Sanitizer: sanitizer,
}
```

Add import: `"github.com/andreasronaldo/wedding-server/internal/service"` (already imported for `service.Cache`).

- [ ] **Step 8: Run all tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
cd go-server && git add -A
git commit -m "feat: add XSS input sanitization with bluemonday"
```

---

### Task 4: Rate Limiting on Login

**Files:**
- Create: `go-server/internal/middleware/ratelimit.go`
- Create: `go-server/internal/middleware/ratelimit_test.go`
- Modify: `go-server/internal/router/router.go`

- [ ] **Step 1: Write failing test for rate limiter**

Create `go-server/internal/middleware/ratelimit_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiter_AllowsUnderLimit(t *testing.T) {
	rl := NewRateLimiter(5, 60)
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/login", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, rec.Code)
		}
	}
}

func TestRateLimiter_BlocksOverLimit(t *testing.T) {
	rl := NewRateLimiter(3, 60)
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodPost, "/api/admin/login", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}

	// 4th request should be blocked
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", nil)
	req.RemoteAddr = "192.168.1.1:12345"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", rec.Code)
	}
}

func TestRateLimiter_DifferentIPsIndependent(t *testing.T) {
	rl := NewRateLimiter(1, 60)
	handler := rl.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// First IP uses its 1 attempt
	req1 := httptest.NewRequest(http.MethodPost, "/", nil)
	req1.RemoteAddr = "10.0.0.1:1234"
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("IP1 first request: expected 200, got %d", rec1.Code)
	}

	// Second IP should still be allowed
	req2 := httptest.NewRequest(http.MethodPost, "/", nil)
	req2.RemoteAddr = "10.0.0.2:1234"
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("IP2 first request: expected 200, got %d", rec2.Code)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/middleware -run TestRateLimiter -v`
Expected: FAIL — `NewRateLimiter` undefined

- [ ] **Step 3: Implement rate limiter**

Create `go-server/internal/middleware/ratelimit.go`:

```go
package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"
	"time"
)

// RateLimiter tracks request attempts per IP within a time window.
type RateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	limit    int
	window   time.Duration
}

// NewRateLimiter creates a rate limiter allowing `limit` requests per `windowSec` seconds per IP.
func NewRateLimiter(limit, windowSec int) *RateLimiter {
	return &RateLimiter{
		attempts: make(map[string][]time.Time),
		limit:    limit,
		window:   time.Duration(windowSec) * time.Second,
	}
}

// Middleware returns an http.Handler that enforces rate limiting.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)

		rl.mu.Lock()
		now := time.Now()
		cutoff := now.Add(-rl.window)

		// Remove expired entries
		valid := rl.attempts[ip][:0]
		for _, t := range rl.attempts[ip] {
			if t.After(cutoff) {
				valid = append(valid, t)
			}
		}

		if len(valid) >= rl.limit {
			rl.attempts[ip] = valid
			rl.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{
				"message": "Too many login attempts. Please try again later.",
			})
			return
		}

		rl.attempts[ip] = append(valid, now)
		rl.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}

// extractIP returns the IP address from the request, stripping the port.
func extractIP(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd go-server && go test ./internal/middleware -run TestRateLimiter -v`
Expected: All PASS

- [ ] **Step 5: Wire rate limiter to login route in router.go**

In `go-server/internal/router/router.go`, after the global middleware block, create the rate limiter:

```go
loginRateLimiter := middleware.NewRateLimiter(5, 60)
```

Inside the `r.Route("/api/admin", func(r chi.Router) {...})` block (line ~131 of `router.go`), replace the login route:

```go
// Old:
r.Post("/login", auth.Login)

// New:
r.With(loginRateLimiter.Middleware).Post("/login", auth.Login)
```

- [ ] **Step 6: Run all tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd go-server && git add -A
git commit -m "feat: add rate limiting on admin login (5 attempts/min/IP)"
```

---

## Chunk 2: Phase 1 — Performance

### Task 5: HTTP Cache Headers Middleware

**Files:**
- Create: `go-server/internal/middleware/cache_headers.go`
- Create: `go-server/internal/middleware/cache_headers_test.go`
- Modify: `go-server/internal/router/router.go`

- [ ] **Step 1: Write failing test for cache headers middleware**

Create `go-server/internal/middleware/cache_headers_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCacheControl_SetsHeaders(t *testing.T) {
	handler := CacheControl(60)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":"test"}`))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	cc := rec.Header().Get("Cache-Control")
	if cc != "public, max-age=60" {
		t.Fatalf("expected Cache-Control 'public, max-age=60', got %q", cc)
	}

	etag := rec.Header().Get("ETag")
	if etag == "" {
		t.Fatal("expected ETag header to be set")
	}
}

func TestCacheControl_304OnMatchingETag(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":"test"}`))
	})
	handler := CacheControl(60)(inner)

	// First request to get ETag
	req1 := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	etag := rec1.Header().Get("ETag")

	// Second request with If-None-Match
	req2 := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	req2.Header.Set("If-None-Match", etag)
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", rec2.Code)
	}
}

func TestCacheControl_200OnDifferentETag(t *testing.T) {
	handler := CacheControl(60)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":"test"}`))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	req.Header.Set("If-None-Match", `"stale-etag"`)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/middleware -run TestCacheControl -v`
Expected: FAIL — `CacheControl` undefined

- [ ] **Step 3: Implement cache headers middleware**

Create `go-server/internal/middleware/cache_headers.go`:

```go
package middleware

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"net/http"
)

// cachingResponseWriter captures the response body and status for ETag computation.
type cachingResponseWriter struct {
	http.ResponseWriter
	buf        bytes.Buffer
	statusCode int
	written    bool
}

func (w *cachingResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.written = true
}

func (w *cachingResponseWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.statusCode = http.StatusOK
		w.written = true
	}
	return w.buf.Write(b)
}

// CacheControl returns middleware that sets Cache-Control and ETag headers.
// maxAge is in seconds. ETag is computed from a hash of the response body.
func CacheControl(maxAge int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Capture the response to compute ETag
			crw := &cachingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(crw, r)

			body := crw.buf.Bytes()
			hash := sha256.Sum256(body)
			etag := fmt.Sprintf(`"%x"`, hash[:8])

			// Check If-None-Match
			if r.Header.Get("If-None-Match") == etag {
				w.Header().Set("ETag", etag)
				w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", maxAge))
				w.WriteHeader(http.StatusNotModified)
				return
			}

			w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", maxAge))
			w.Header().Set("ETag", etag)
			w.WriteHeader(crw.statusCode)
			w.Write(body)
		})
	}
}
```

> **Note:** The spec suggests using a version counter or last-modified timestamp from the cache service for ETag generation (to avoid buffering). This body-hashing approach is simpler to implement as a standalone middleware and is acceptable for the small response sizes on these config endpoints (~1-5KB). If response sizes grow, consider switching to a version-counter approach integrated with the cache service.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd go-server && go test ./internal/middleware -run TestCacheControl -v`
Expected: All PASS

- [ ] **Step 5: Wire middleware to public GET routes in router.go**

In `go-server/internal/router/router.go`, add the cache middleware to public config endpoints. Group them:

```go
// Public config routes with caching (data changes rarely)
cacheConfig := chi.Chain(middleware.CacheControl(60))

r.With(cacheConfig.Handler).Get("/api/config-images", configImage.ListAll)
r.With(cacheConfig.Handler).Get("/api/config-images/{type}", configImage.ListByType)
r.With(cacheConfig.Handler).Get("/api/feature-flags", featureFlag.List)
r.With(cacheConfig.Handler).Get("/api/feature-flags/{featureKey}", featureFlag.Get)
r.With(cacheConfig.Handler).Get("/api/app-settings", appSetting.List)
r.With(cacheConfig.Handler).Get("/api/settings/music", appSetting.GetMusic)
r.With(cacheConfig.Handler).Get("/api/settings/{settingKey}", appSetting.Get)
r.With(cacheConfig.Handler).Get("/api/welcome-screen", welcomeScreen.Get)
```

Remove the duplicate plain `r.Get(...)` lines for these routes.

- [ ] **Step 6: Run all tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd go-server && git add -A
git commit -m "feat: add HTTP cache headers middleware (Cache-Control + ETag)"
```

---

### Task 6: Pagination — Backend

**Files:**
- Modify: `go-server/internal/repository/repository.go`
- Modify: `go-server/internal/repository/memory.go`
- Modify: `go-server/internal/repository/postgres.go`
- Modify: `go-server/internal/handler/message.go`
- Modify: `go-server/internal/handler/media.go`
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Write failing repository test for paginated messages**

In `go-server/internal/repository/memory_test.go`, add:

```go
func TestGetMessagesPaginated(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	// Create 5 messages
	for i := 1; i <= 5; i++ {
		repo.CreateMessage(ctx, models.InsertMessage{
			Name:    fmt.Sprintf("User%d", i),
			Content: fmt.Sprintf("Message %d", i),
		})
	}

	tests := []struct {
		name      string
		limit     int
		offset    int
		wantCount int
		wantTotal int
	}{
		{"first page", 2, 0, 2, 5},
		{"second page", 2, 2, 2, 5},
		{"last page partial", 2, 4, 1, 5},
		{"offset beyond total", 2, 10, 0, 5},
		{"all at once", 10, 0, 5, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msgs, total, err := repo.GetMessagesPaginated(ctx, tt.limit, tt.offset)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(msgs) != tt.wantCount {
				t.Errorf("got %d messages, want %d", len(msgs), tt.wantCount)
			}
			if total != tt.wantTotal {
				t.Errorf("got total %d, want %d", total, tt.wantTotal)
			}
		})
	}
}

func TestGetApprovedMediaPaginated(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	for i := 1; i <= 5; i++ {
		mediaType := "image"
		repo.CreateMedia(ctx, models.InsertMedia{
			Name:      fmt.Sprintf("User%d", i),
			Email:     fmt.Sprintf("user%d@test.com", i),
			MediaURL:  fmt.Sprintf("https://example.com/photo%d.jpg", i),
			MediaType: &mediaType,
		})
	}

	// Approve all media (CreateMedia defaults to approved=false)
	// Use the repo to update approval status, or set up test data appropriately.
	// Note: Check the actual MemoryRepository.CreateMedia to see the default approval state.
	// If media is created as unapproved, approve them first via UpdateMediaApproval.

	media, total, err := repo.GetApprovedMediaPaginated(ctx, 2, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Assertions depend on default approval state — adjust expected counts accordingly
	_ = media
	_ = total
}
```

Add `"fmt"` to the imports of `memory_test.go` if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/repository -run TestGetMessagesPaginated -v`
Expected: FAIL — `GetMessagesPaginated` not defined

- [ ] **Step 3: Add paginated methods to repository interface**

In `go-server/internal/repository/repository.go`, add to the interface under the existing methods:

```go
// Messages (continued)
GetMessagesPaginated(ctx context.Context, limit, offset int) ([]models.Message, int, error)

// Media (continued)
GetApprovedMediaPaginated(ctx context.Context, limit, offset int) ([]models.Media, int, error)
```

> **Note:** We use `GetApprovedMediaPaginated` (not `GetMediaPaginated`) because the public `/api/media` endpoint must only return approved media. The `WHERE approved = true` filter is applied at the database level so `total` accurately reflects the filtered count.

- [ ] **Step 4: Implement in memory.go**

In `go-server/internal/repository/memory.go`, add after `GetAllMessages`:

```go
func (m *MemoryRepository) GetMessagesPaginated(_ context.Context, limit, offset int) ([]models.Message, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	all := make([]models.Message, 0, len(m.messages))
	for _, msg := range m.messages {
		all = append(all, msg)
	}
	total := len(all)

	// Sort by ID descending (newest first)
	sort.Slice(all, func(i, j int) bool { return all[i].ID > all[j].ID })

	if offset >= total {
		return []models.Message{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return all[offset:end], total, nil
}
```

Add `"sort"` to imports.

Add after `GetApprovedMedia` (or `GetAllMedia`):

```go
func (m *MemoryRepository) GetApprovedMediaPaginated(_ context.Context, limit, offset int) ([]models.Media, int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Filter to approved media only (same as GetApprovedMedia)
	approved := make([]models.Media, 0)
	for _, md := range m.media {
		if md.Approved {
			approved = append(approved, md)
		}
	}
	total := len(approved)

	sort.Slice(approved, func(i, j int) bool { return approved[i].ID > approved[j].ID })

	if offset >= total {
		return []models.Media{}, total, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return approved[offset:end], total, nil
}
```

- [ ] **Step 5: Implement in postgres.go**

In `go-server/internal/repository/postgres.go`, add after `GetAllMessages`:

```go
func (r *PostgresRepository) GetMessagesPaginated(ctx context.Context, limit, offset int) ([]models.Message, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, content, created_at FROM messages ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result := make([]models.Message, 0)
	for rows.Next() {
		var msg models.Message
		var createdAt time.Time
		if err := rows.Scan(&msg.ID, &msg.Name, &msg.Email, &msg.Content, &createdAt); err != nil {
			return nil, 0, err
		}
		msg.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, msg)
	}
	return result, total, rows.Err()
}
```

Add after `GetAllMedia` (similar pattern but filtered to approved only):

```go
func (r *PostgresRepository) GetApprovedMediaPaginated(ctx context.Context, limit, offset int) ([]models.Media, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM media WHERE approved = true`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, media_url, media_type, caption, approved, created_at FROM media WHERE approved = true ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result := make([]models.Media, 0)
	for rows.Next() {
		var md models.Media
		var createdAt time.Time
		if err := rows.Scan(&md.ID, &md.Name, &md.Email, &md.MediaURL, &md.MediaType, &md.Caption, &md.Approved, &createdAt); err != nil {
			return nil, 0, err
		}
		md.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, md)
	}
	return result, total, rows.Err()
}
```

- [ ] **Step 6: Run repository tests**

Run: `cd go-server && go test ./internal/repository -run TestGetMessagesPaginated -v`
Run: `cd go-server && go test ./internal/repository -run TestGetApprovedMediaPaginated -v`
Expected: All PASS

- [ ] **Step 7: Update message handler for pagination**

In `go-server/internal/handler/message.go`, update the `List` method:

```go
func (h *MessageHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	messages, total, err := h.Repo.GetMessagesPaginated(r.Context(), limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get messages")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"messages": messages,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}
```

- [ ] **Step 8: Update media handler for pagination**

In `go-server/internal/handler/media.go`, update the `ListApproved` method:

```go
func (h *MediaHandler) ListApproved(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	media, total, err := h.Repo.GetApprovedMediaPaginated(r.Context(), limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get media")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"media":  media,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
```

Add `"strconv"` to imports in both files (already imported in `media.go`).

- [ ] **Step 9: Update contract tests**

In `go-server/internal/handler/contract_test.go`, find the message list contract test and update assertions to include pagination fields. Add assertions for `total`, `limit`, `offset` keys:

```go
assertKeyExists(t, result, "total")
assertKeyType(t, result, "total", "float64")
assertKeyExists(t, result, "limit")
assertKeyType(t, result, "limit", "float64")
assertKeyExists(t, result, "offset")
assertKeyType(t, result, "offset", "float64")
```

Apply the same to the media list contract test.

- [ ] **Step 10: Run all tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 11: Commit**

```bash
cd go-server && git add -A
git commit -m "feat: add pagination for media and messages endpoints"
```

---

### Task 7: Streaming File Uploads

**Files:**
- Modify: `go-server/internal/service/storage.go`
- Modify: `go-server/internal/service/storage_supabase.go`
- Modify: `go-server/internal/handler/upload.go`
- Modify: `go-server/internal/handler/config_image.go`
- Modify: `go-server/internal/service/storage_test.go`
- Modify: `go-server/internal/service/storage_supabase_test.go`

**Note:** This is a larger refactor. The `ObjectStorage` interface changes from `[]byte` to `io.Reader`. All implementations and callers must be updated together.

- [ ] **Step 1: Update ObjectStorage interface**

In `go-server/internal/service/storage.go`, change:

```go
type ObjectStorage interface {
	Upload(ctx context.Context, data io.Reader, size int64, filename, contentType, directory string) (string, error)
	UploadAdminImage(ctx context.Context, data io.Reader, size int64, filename, contentType, imageType string) (string, error)
	Download(ctx context.Context, objectPath string, w http.ResponseWriter) error
	DownloadBuffer(ctx context.Context, objectPath string) ([]byte, error)
	Delete(ctx context.Context, objectPath string) error
	ParsePublicURL(publicURL string) string
}
```

Add `"io"` to imports.

- [ ] **Step 2: Update LocalStorage implementation**

```go
func (s *LocalStorage) Upload(_ context.Context, data io.Reader, size int64, filename, contentType, directory string) (string, error) {
	dir := filepath.Join(s.baseDir, directory)
	os.MkdirAll(dir, 0o755)

	path := filepath.Join(dir, filename)
	f, err := os.Create(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	if _, err := io.Copy(f, data); err != nil {
		return "", err
	}

	return "/storage/" + directory + "/" + filename, nil
}

func (s *LocalStorage) UploadAdminImage(_ context.Context, data io.Reader, size int64, filename, contentType, imageType string) (string, error) {
	dir := adminImageDirectory(imageType)
	return s.Upload(context.Background(), data, size, filename, contentType, dir)
}
```

- [ ] **Step 3: Update SupabaseStorage implementation**

In `go-server/internal/service/storage_supabase.go`, update `Upload` and `UploadAdminImage` to accept `io.Reader` and `size int64` instead of `[]byte`. Read the data from the reader when constructing the HTTP request body.

For the Supabase HTTP upload, use the reader directly as the request body:

```go
func (s *SupabaseStorage) Upload(ctx context.Context, data io.Reader, size int64, filename, contentType, directory string) (string, error) {
	// ... existing Supabase upload logic, but use data (io.Reader) as req.Body ...
}
```

- [ ] **Step 4: Update upload.go callers**

In `go-server/internal/handler/upload.go`, the `Upload` method at line 84 currently does `data, err := io.ReadAll(file)`. Replace with passing the file reader directly:

```go
// Old:
data, err := io.ReadAll(file)
// ... then Storage.Upload(ctx, data, ...)

// New:
url, err := h.Storage.Upload(r.Context(), file, header.Size, uniqueName, ct, "uploads")
```

Remove the `io.ReadAll` call. The `file` from `r.FormFile()` is already an `io.Reader`.

Apply similar changes to `ConfigImageUpload` and `MusicUpload` methods.

- [ ] **Step 5: Update config_image.go callers**

In `go-server/internal/handler/config_image.go`, the `ConfigImageUpload` method calls `service.OptimizeImage(data, 600, 80)` which requires `[]byte` input. The `io.ReadAll` call **must remain** here for image optimization. Update the subsequent upload calls to wrap the result:

```go
// Keep io.ReadAll for OptimizeImage (requires []byte)
data, err := io.ReadAll(file)
// ... OptimizeImage(data, ...) ...

// Update upload calls to wrap []byte as io.Reader:
// Old: h.Storage.Upload(r.Context(), opt.ThumbnailBuffer, thumbName, ...)
// New:
h.Storage.Upload(r.Context(), bytes.NewReader(opt.ThumbnailBuffer), int64(len(opt.ThumbnailBuffer)), thumbName, opt.ThumbnailContentType, "admin/gallery/thumbnails")

// Old: h.Storage.UploadAdminImage(r.Context(), opt.Data, ...)
// New:
h.Storage.UploadAdminImage(r.Context(), bytes.NewReader(opt.Data), int64(len(opt.Data)), filename, opt.ContentType, imageType)
```

Add `"bytes"` to imports in `config_image.go`.

- [ ] **Step 6: Update storage tests**

In `go-server/internal/service/storage_test.go`, update test calls to pass `bytes.NewReader(data)` and `int64(len(data))` instead of `[]byte`:

```go
// Old:
url, err := storage.Upload(ctx, []byte("test data"), "test.txt", "text/plain", "uploads")

// New:
data := []byte("test data")
url, err := storage.Upload(ctx, bytes.NewReader(data), int64(len(data)), "test.txt", "text/plain", "uploads")
```

Apply same to `storage_supabase_test.go`.

- [ ] **Step 7: Run all tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
cd go-server && git add -A
git commit -m "refactor: change ObjectStorage interface from []byte to io.Reader for streaming"
```

---

### Task 8: Pagination — Frontend

**Files:**
- Modify: `client/src/components/MessageWallSection.tsx`

**Note:** This task updates the frontend to consume the new paginated messages API. It depends on Task 6 (backend pagination) being completed.

**GallerySection:** `GallerySection.tsx` fetches from `/api/config-images/gallery` (admin-configured gallery images), NOT from `/api/media`. Since config-images are a small admin-curated set (not hundreds of guest uploads), pagination is not needed for this endpoint. Only `MessageWallSection` needs the pagination update.

- [ ] **Step 1: Update MessageWallSection for pagination**

In `client/src/components/MessageWallSection.tsx`:

1. Replace `useQuery` with `useInfiniteQuery` from `@tanstack/react-query`:

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

const PAGE_SIZE = 20;

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  isError,
} = useInfiniteQuery({
  queryKey: ["/api/messages"],
  queryFn: async ({ pageParam = 0 }) => {
    const res = await fetch(`/api/messages?limit=${PAGE_SIZE}&offset=${pageParam}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch messages");
    return res.json();
  },
  initialPageParam: 0,
  getNextPageParam: (lastPage) => {
    const nextOffset = lastPage.offset + lastPage.limit;
    return nextOffset < lastPage.total ? nextOffset : undefined;
  },
});

const messages = data?.pages.flatMap((page) => page.messages) ?? [];
const total = data?.pages[0]?.total ?? 0;
```

2. Add a "Load more" button after the message list:

```tsx
{hasNextPage && (
  <Button
    variant="outline"
    onClick={() => fetchNextPage()}
    disabled={isFetchingNextPage}
  >
    {isFetchingNextPage ? "Loading..." : "Load more"}
  </Button>
)}
```

- [ ] **Step 2: Run frontend type check**

Run: `npm run check`
Expected: No TypeScript errors

- [ ] **Step 3: Run frontend tests**

Run: `npm run test`
Expected: Existing tests pass

- [ ] **Step 4: Commit**

```bash
git add client/src/components/MessageWallSection.tsx
git commit -m "feat: add frontend pagination with Load More for messages"
```

---

## Chunk 3: Phase 2 — Portfolio Polish

### Task 9: Structured Error Responses

**Files:**
- Create: `go-server/internal/handler/errors.go`
- Modify: `go-server/internal/handler/helpers.go`
- Modify: all handler files (`.go`) — replace `writeError` calls
- Modify: `client/src/lib/queryClient.ts`

- [ ] **Step 1: Write test for respondError helper**

Add to an appropriate test file (e.g., a new section in `contract_test.go`):

```go
func TestRespondError_Format(t *testing.T) {
	env := newTestEnv()

	// Use a known endpoint that returns an error — POST /api/rsvp with empty body
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", jsonBody(map[string]string{}))
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusBadRequest)

	// After migration, errors should have "error" envelope
	errObj, ok := result["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'error' object in response, got keys: %v", mapKeys(result))
	}
	assertKeyExists(t, errObj, "code")
	assertKeyExists(t, errObj, "message")
	assertKeyExists(t, errObj, "requestId")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run TestRespondError_Format -v`
Expected: FAIL — response still has `{"message": "..."}` format

- [ ] **Step 3: Create errors.go**

Create `go-server/internal/handler/errors.go`:

```go
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// Error code constants
const (
	ErrCodeBadRequest      = "BAD_REQUEST"
	ErrCodeUnauthorized    = "UNAUTHORIZED"
	ErrCodeForbidden       = "FORBIDDEN"
	ErrCodeNotFound        = "NOT_FOUND"
	ErrCodeTooManyRequests = "TOO_MANY_REQUESTS"
	ErrCodeInternal        = "INTERNAL_ERROR"
	ErrCodeDuplicateEmail  = "RSVP_DUPLICATE_EMAIL"
	ErrCodeUploadTooLarge  = "UPLOAD_TOO_LARGE"
	ErrCodeInvalidFileType = "INVALID_FILE_TYPE"
)

// AppError represents a structured error response.
type AppError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	RequestID  string `json:"requestId"`
	StatusCode int    `json:"-"`
}

// respondError writes a structured error JSON response.
func respondError(w http.ResponseWriter, r *http.Request, statusCode int, code, message string) {
	reqID := chimw.GetReqID(r.Context())

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	err := json.NewEncoder(w).Encode(map[string]interface{}{
		"error": AppError{
			Code:      code,
			Message:   message,
			RequestID: reqID,
		},
	})
	if err != nil {
		slog.Error("Failed to encode error response", "error", err)
	}
}
```

- [ ] **Step 4: Migrate writeError calls to respondError**

Update `writeError` in `helpers.go` to call `respondError` (backward-compatible bridge):

```go
// writeError writes a structured JSON error response.
// Deprecated: Use respondError directly for specific error codes.
func writeError(w http.ResponseWriter, r *http.Request, status int, message string) {
	code := statusToCode(status)
	respondError(w, r, status, code, message)
}

func statusToCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return ErrCodeBadRequest
	case http.StatusUnauthorized:
		return ErrCodeUnauthorized
	case http.StatusForbidden:
		return ErrCodeForbidden
	case http.StatusNotFound:
		return ErrCodeNotFound
	case http.StatusTooManyRequests:
		return ErrCodeTooManyRequests
	default:
		return ErrCodeInternal
	}
}
```

**Breaking change:** `writeError` signature changes from `writeError(w, status, message)` to `writeError(w, r, status, message)` (adds `*http.Request` for request ID). Update all call sites across all handler files to pass `r`.

In every handler file, replace:
```go
writeError(w, http.StatusBadRequest, "message")
// becomes:
writeError(w, r, http.StatusBadRequest, "message")
```

This affects: `auth.go`, `rsvp.go`, `message.go`, `media.go`, `upload.go`, `config_image.go`, `feature_flag.go`, `app_setting.go`, `welcome_screen.go`, `googledrive.go`.

- [ ] **Step 5: Update frontend error parsing**

In `client/src/lib/queryClient.ts`, update `apiRequest` error handling to parse the new format:

```typescript
// After the response.ok check:
if (!response.ok) {
  const errorBody = await response.json().catch(() => null);
  const errorMessage = errorBody?.error?.message || `Request failed with status ${response.status}`;
  const errorCode = errorBody?.error?.code;
  throw new Error(errorMessage, { cause: { code: errorCode, status: response.status } });
}
```

- [ ] **Step 6: Run all tests**

Run: `cd go-server && make test`
Run: `npm run check`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add go-server/internal/handler/ client/src/lib/queryClient.ts
git commit -m "feat: add structured error responses with error codes and request IDs"
```

---

### Task 10: Request ID Propagation to Logs

**Files:**
- Modify: `go-server/internal/middleware/logging.go`

- [ ] **Step 1: Update logging middleware**

In `go-server/internal/middleware/logging.go`, add request ID to log attributes:

```go
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		reqID := chimw.GetReqID(r.Context())
		slog.Debug("Request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"duration", time.Since(start).String(),
			"requestId", reqID,
		)
	})
}
```

- [ ] **Step 2: Run tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/middleware/logging.go
git commit -m "feat: propagate request ID to structured logs"
```

---

### Task 11: Frontend Test Setup (MSW)

**Files:**
- Create: `client/src/test/mocks/handlers.ts`
- Create: `client/src/test/setup.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Install MSW**

Run: `npm install -D msw`

- [ ] **Step 2: Create MSW handlers**

Create `client/src/test/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/feature-flags", () => {
    return HttpResponse.json({
      featureFlags: [
        { id: 1, featureKey: "rsvp_enabled", featureName: "RSVP", enabled: true },
        { id: 2, featureKey: "gallery_enabled", featureName: "Gallery", enabled: true },
        { id: 3, featureKey: "messages_enabled", featureName: "Messages", enabled: true },
      ],
    });
  }),

  http.get("/api/app-settings", () => {
    return HttpResponse.json({
      settings: [],
    });
  }),

  http.get("/api/messages", ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "20");
    const offset = Number(url.searchParams.get("offset") || "0");
    return HttpResponse.json({
      messages: [],
      total: 0,
      limit,
      offset,
    });
  }),

  http.get("/api/media", ({ request }) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || "20");
    const offset = Number(url.searchParams.get("offset") || "0");
    return HttpResponse.json({
      media: [],
      total: 0,
      limit,
      offset,
    });
  }),

  http.post("/api/rsvp", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      message: "Thank you for your RSVP!",
      rsvp: { id: 1, ...body, attending: true },
    }, { status: 201 });
  }),

  http.post("/api/messages", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      message: "Message submitted successfully!",
      data: { id: 1, ...body, createdAt: new Date().toISOString() },
    }, { status: 201 });
  }),
];
```

- [ ] **Step 3: Create MSW server setup**

Create `client/src/test/setup.ts`:

```typescript
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 4: Wire up in vitest config**

In `vitest.config.ts`, **append** the new setup file to the existing `setupFiles` array (do NOT replace it — the existing `./client/src/test-setup.ts` imports `@testing-library/jest-dom/vitest` which existing tests depend on):

```typescript
// Existing:
setupFiles: ["./client/src/test-setup.ts"],
// Change to:
setupFiles: ["./client/src/test-setup.ts", "./client/src/test/setup.ts"],
```

- [ ] **Step 5: Run tests to verify setup works**

Run: `npm run test`
Expected: Existing tests still pass. MSW server starts and stops cleanly.

- [ ] **Step 6: Commit**

```bash
git add client/src/test/ vitest.config.ts package.json package-lock.json
git commit -m "chore: add MSW test infrastructure for frontend API mocking"
```

---

### Task 12: Frontend Test Coverage

**Files:**
- Create: `client/src/components/__tests__/RsvpSection.test.tsx`
- Create: `client/src/hooks/__tests__/useFeatureFlags.test.ts`
- Create: `client/src/lib/__tests__/queryClient.test.ts`
- Create: `client/src/components/__tests__/MessagesSection.test.tsx`
- Create: `client/src/components/__tests__/MessageWallSection.test.tsx`

**Note:** Each test file is an independent unit. They can be implemented in any order. Write tests using MSW handlers from Task 11. Focus on the key scenarios listed in the spec.

**Convention:** Existing tests live in `__tests__/` subdirectories (e.g., `components/__tests__/GallerySection.test.tsx`). Follow this pattern.

**Environment:** All `.test.tsx` files that render React components MUST include `// @vitest-environment jsdom` as the first line. The vitest config defaults to `node` environment; component tests need the jsdom override. See existing tests (e.g., `GallerySection.test.tsx`) for the pattern.

- [ ] **Step 1: Write RSVP form tests**

Create `client/src/components/__tests__/RsvpSection.test.tsx` with tests for:
- Renders form fields (name, email, guest count)
- Pre-fills name from URL `?to=` param (requires setting `window.location.search = "?to=Alice"` before rendering, e.g., via `Object.defineProperty(window, 'location', ...)`)
- Shows validation error when required fields empty
- Submits successfully and shows confirmation

Use `@testing-library/react` with `render`, `screen`, `fireEvent`/`userEvent`.

Remember to add `// @vitest-environment jsdom` as the first line.

- [ ] **Step 2: Write feature flag tests**

Create `client/src/hooks/__tests__/useFeatureFlags.test.ts` with tests for:
- Returns correct flag values from API response
- Returns defaults on API error
- Hook re-fetches on interval

Use `renderHook` from `@testing-library/react` with MSW.

- [ ] **Step 3: Write API error handling tests**

Create `client/src/lib/__tests__/queryClient.test.ts` with tests for:
- `apiRequest` throws with structured error message on 4xx
- `apiRequest` includes CSRF token header for admin routes
- `getQueryFn` returns null on 401 when configured to returnNull

- [ ] **Step 4: Write messages form tests**

Create `client/src/components/__tests__/MessagesSection.test.tsx` with tests for:
- Renders form fields
- Shows validation error for empty name/content
- Submits successfully

Remember to add `// @vitest-environment jsdom` as the first line.

- [ ] **Step 5: Write message wall tests**

Create `client/src/components/__tests__/MessageWallSection.test.tsx` with tests for:
- Renders messages from API
- Shows "Load more" when more pages available
- Shows empty state when no messages

Remember to add `// @vitest-environment jsdom` as the first line.

- [ ] **Step 6: Run all frontend tests**

Run: `npm run test`
Expected: All new tests PASS

- [ ] **Step 7: Commit**

```bash
git add client/src/components/__tests__/RsvpSection.test.tsx client/src/hooks/__tests__/useFeatureFlags.test.ts client/src/lib/__tests__/queryClient.test.ts client/src/components/__tests__/MessagesSection.test.tsx client/src/components/__tests__/MessageWallSection.test.tsx
git commit -m "test: add frontend test coverage for RSVP, feature flags, API errors, messages"
```

---

### Task 13: Backend Test Coverage

**Files:**
- Create: `go-server/internal/handler/rsvp_test.go`
- Create: `go-server/internal/handler/media_test.go`
- Create: `go-server/internal/handler/message_test.go`
- Create: `go-server/internal/handler/upload_test.go`
- Create: `go-server/internal/middleware/ratelimit_test.go` (if not already created in Task 4)
- Create: `go-server/internal/service/sanitizer_test.go` (if not already created in Task 3)

**Note:** These complement existing `contract_test.go` (which tests JSON shape). These test business logic and edge cases.

**Dependency:** Message and media handler tests depend on Tasks 6-7 (pagination) being completed, since they test the paginated response format.

- [ ] **Step 1: Write RSVP handler tests**

Create `go-server/internal/handler/rsvp_test.go`:

```go
package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRsvp_DuplicateEmail_UpdatesExisting(t *testing.T) {
	env := newTestEnv()

	// First RSVP
	body1 := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attending": true, "guestCount": 2,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body1)
	req1.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req1, http.StatusCreated)

	// Second RSVP with same email
	body2 := jsonBody(map[string]interface{}{
		"name": "Alice Updated", "email": "alice@test.com", "attending": false,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body2)
	req2.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req2, http.StatusOK)

	// Should return updated RSVP, not create a new one
	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice Updated" {
		t.Fatalf("expected updated name, got %v", rsvp["name"])
	}
	if rsvp["attending"] != false {
		t.Fatalf("expected attending=false, got %v", rsvp["attending"])
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
```

- [ ] **Step 2: Write message handler tests**

Create `go-server/internal/handler/message_test.go` with tests for:
- Empty list returns `{"messages": [], "total": 0, ...}`
- Create message with empty name returns 400
- Pagination: offset beyond total returns empty array

- [ ] **Step 3: Write media handler tests**

Create `go-server/internal/handler/media_test.go` with tests for:
- Empty list returns `{"media": [], "total": 0, ...}`
- Pagination works with limit/offset params

- [ ] **Step 4: Write upload handler tests**

Create `go-server/internal/handler/upload_test.go` with tests for:
- Missing file returns 400
- Missing required fields returns 400

(Note: Full file upload tests need multipart form encoding — provide a helper.)

- [ ] **Step 5: Verify rate limit and sanitizer tests exist**

If not already created in Tasks 3-4, add:
- `go-server/internal/middleware/ratelimit_test.go` — test that the 6th login attempt returns 429
- `go-server/internal/service/sanitizer_test.go` — test that `<script>` tags are stripped from messages

Also add to handler tests:
- Test malformed JSON body returns 400 (send `{invalid json` to `/api/rsvp`)
- Test missing required fields return 400 with error message

- [ ] **Step 6: Run all tests**

Run: `cd go-server && make test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
cd go-server && git add internal/handler/rsvp_test.go internal/handler/media_test.go internal/handler/message_test.go internal/handler/upload_test.go
git commit -m "test: add handler-level business logic tests for RSVP, messages, media, upload"
```

---

### Task 14: Component Refactoring — ImageUploadModal

**Files:**
- Create: `client/src/hooks/useImageAnalysis.ts`
- Create: `client/src/components/ImagePreview.tsx`
- Modify: `client/src/components/ImageUploadModal.tsx`

**Note:** Read `ImageUploadModal.tsx` before starting. Identify the image analysis logic (dimension detection, aspect ratio, compression recommendations) and the preview rendering. Extract them as a hook and component respectively.

- [ ] **Step 1: Read ImageUploadModal.tsx and identify extraction boundaries**

Read the full file. Map which lines belong to:
- Image analysis logic → `useImageAnalysis` hook
- Preview rendering → `ImagePreview` component
- Orchestration (modal shell, form, submit) → stays in `ImageUploadModal`

- [ ] **Step 2: Create useImageAnalysis hook**

Extract image validation, dimension detection, and compression recommendation logic into `client/src/hooks/useImageAnalysis.ts`. The hook should accept a `File` and return analysis results (dimensions, aspectRatio, recommendations, isValid).

- [ ] **Step 3: Create ImagePreview component**

Extract preview rendering (image display with crop indicators, dimension labels) into `client/src/components/ImagePreview.tsx`.

- [ ] **Step 4: Update ImageUploadModal to use extracted pieces**

Replace inline logic with `useImageAnalysis` hook and `<ImagePreview>` component. Import them.

- [ ] **Step 5: Run frontend type check and tests**

Run: `npm run check && npm run test`
Expected: All PASS, no TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useImageAnalysis.ts client/src/components/ImagePreview.tsx client/src/components/ImageUploadModal.tsx
git commit -m "refactor: extract useImageAnalysis hook and ImagePreview from ImageUploadModal"
```

---

### Task 15: Component Refactoring — ImageManager

**Files:**
- Create: `client/src/hooks/useDragAndDrop.ts`
- Create: `client/src/components/ImageGrid.tsx`
- Modify: `client/src/components/ImageManager.tsx`

**Note:** Same approach as Task 14. Read `ImageManager.tsx` first, then extract.

- [ ] **Step 1: Read ImageManager.tsx and identify extraction boundaries**

Map which lines belong to:
- Drag-and-drop logic (@dnd-kit setup, sensors, collision, reorder) → `useDragAndDrop` hook
- Visual grid rendering → `ImageGrid` component
- Container/state management → stays in `ImageManager`

- [ ] **Step 2: Create useDragAndDrop hook**

Extract @dnd-kit sensor setup, collision detection config, and reorder callback into `client/src/hooks/useDragAndDrop.ts`.

- [ ] **Step 3: Create ImageGrid component**

Extract the grid rendering (cards with images, action buttons) into `client/src/components/ImageGrid.tsx`.

- [ ] **Step 4: Update ImageManager to use extracted pieces**

Replace inline logic with `useDragAndDrop` hook and `<ImageGrid>` component.

- [ ] **Step 5: Run frontend type check and tests**

Run: `npm run check && npm run test`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add client/src/hooks/useDragAndDrop.ts client/src/components/ImageGrid.tsx client/src/components/ImageManager.tsx
git commit -m "refactor: extract useDragAndDrop hook and ImageGrid from ImageManager"
```

---

### Task 16: Documentation Cleanup

**Files:**
- Delete: `.flask_server`, `pyproject.toml`, `poetry.lock`, `uv.lock`, `package.local.json`, `replit.md`
- Create: `docs/API.md`

- [ ] **Step 1: Remove stale files**

```bash
git rm .flask_server pyproject.toml poetry.lock uv.lock package.local.json replit.md
```

If any file is not tracked by git, use `rm` instead and don't `git rm`.

- [ ] **Step 2: Create API reference**

Create `docs/API.md` with a markdown table of all endpoints. Read `go-server/internal/router/router.go` for the full route list. Include method, path, auth required, and brief description.

Format:
```markdown
# API Reference

## Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/rsvp | Submit or update RSVP |
| GET | /api/rsvp | List all RSVPs with stats |
| ... | ... | ... |

## Admin Endpoints (require auth + CSRF)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/admin/login | Admin login |
| ... | ... | ... |
```

- [ ] **Step 3: Run tests to verify nothing broken**

Run: `cd go-server && make test && cd .. && npm run check`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add docs/API.md
git commit -m "chore: remove stale Python/Express files, add API reference docs"
```

Note: The `git rm` in Step 1 already stages the deletions. Only `docs/API.md` needs explicit staging.
