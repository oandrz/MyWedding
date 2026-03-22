# Production Readiness & Portfolio Quality Improvements

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Security hardening, performance optimization, code quality, test coverage, developer experience

## Context

MyWedding is a full-stack wedding e-invitation platform (React/TypeScript + Go/Chi + PostgreSQL) serving ~100-200 guests on a single instance. It also serves as a portfolio and learning project for future reuse.

A comprehensive codebase analysis identified improvements across security, performance, code quality, test coverage, and developer experience. This spec organizes them into two phases: **Phase 1** addresses issues that could affect the wedding day experience, **Phase 2** elevates the project to portfolio quality.

## Phase 1: Must Ship (Wedding Day Readiness)

### 1.1 Security Hardening

#### Admin Password Hashing

**Problem:** Admin password is compared in plaintext in `auth.go`. Visible in environment variables and logs.

**Solution:**
- Add `golang.org/x/crypto/bcrypt` dependency
- On login, compare submitted password with `bcrypt.CompareHashAndPassword`
- Store hashed password in `ADMIN_PASSWORD_HASH` env var
- Provide a CLI command or startup log that prints the hash for a given password (one-time setup)
- Fallback: if `ADMIN_PASSWORD_HASH` is not set but `ADMIN_PASSWORD` is, hash it at startup and log a deprecation warning

**Files:**
- `go-server/internal/handler/auth.go` — replace plaintext comparison
- `go-server/internal/config/config.go` — add `AdminPasswordHash` field
- `go-server/go.mod` — add bcrypt dependency

#### Input Sanitization (XSS Prevention)

**Problem:** Guest-submitted content (messages, captions, welcome screen text) is stored and rendered without sanitization. A malicious guest could inject `<script>` tags.

**Solution:**
- Add `github.com/microcosm-cc/bluemonday` dependency
- Create `internal/service/sanitizer.go` with a strict policy (allow basic formatting tags only: `<b>`, `<i>`, `<em>`, `<strong>`, `<br>`)
- Sanitize in handlers before persisting: `message.go`, `rsvp.go` (name field), `welcome_screen.go`
- React already escapes output by default, but server-side sanitization is the defense-in-depth layer

**Files:**
- `go-server/internal/service/sanitizer.go` — new, sanitization service
- `go-server/internal/handler/message.go` — sanitize content before save
- `go-server/internal/handler/rsvp.go` — sanitize name before save
- `go-server/internal/handler/welcome_screen.go` — sanitize text fields before save

#### Rate Limiting on Login

**Problem:** No limit on `POST /api/admin/login`. An attacker can brute-force the password.

**Solution:**
- Create `internal/middleware/ratelimit.go` — simple in-memory rate limiter
- Track attempts by IP using `map[string][]time.Time` with periodic cleanup
- Limit: 5 attempts per IP per 60 seconds
- Return `429 Too Many Requests` when exceeded
- Apply only to the login route

**Files:**
- `go-server/internal/middleware/ratelimit.go` — new
- `go-server/internal/router/router.go` — apply to login route

#### File Upload Size Limits

**Problem:** Upload endpoints read the entire request body into memory before validation. Large files (or malicious uploads) can spike memory.

**Solution:**
- Wrap request body with `http.MaxBytesReader(w, r.Body, maxSize)` at the start of upload handlers
- Limits: 10MB for images, 50MB for music files
- Returns `413 Request Entity Too Large` if exceeded
- Enforced before any `io.ReadAll` or processing

**Files:**
- `go-server/internal/handler/upload.go` — add MaxBytesReader
- `go-server/internal/handler/config_image.go` — add MaxBytesReader for image uploads

### 1.2 Performance

#### Pagination for Media and Messages

**Problem:** `GetAllMedia()` and `GetAllMessages()` return the entire table. With 200+ records, this wastes bandwidth, memory, and slows page load.

**Solution:**

Backend:
- Add `GetMediaPaginated(ctx, limit, offset int) ([]Media, int, error)` to repository interface
- Add `GetMessagesPaginated(ctx, limit, offset int) ([]Message, int, error)` to repository interface
- Implement in both `memory.go` and `postgres.go`
- Update handlers to accept `?limit=20&offset=0` query params, default limit=20
- Response shape: `{"data": [...], "total": 150, "limit": 20, "offset": 0}`

Frontend:
- Replace `useQuery` with `useInfiniteQuery` for media and message lists
- Add infinite scroll trigger (IntersectionObserver) to GallerySection and MessageWallSection
- Show loading skeleton while fetching next page

**Files:**
- `go-server/internal/repository/repository.go` — add paginated methods to interface
- `go-server/internal/repository/memory.go` — implement paginated methods
- `go-server/internal/repository/postgres.go` — implement with `LIMIT/OFFSET` SQL
- `go-server/internal/handler/media.go` — accept pagination params
- `go-server/internal/handler/message.go` — accept pagination params
- `client/src/components/GallerySection.tsx` — useInfiniteQuery + infinite scroll
- `client/src/components/MessageWallSection.tsx` — useInfiniteQuery + infinite scroll

#### HTTP Cache Headers

**Problem:** Public read-heavy endpoints return no cache headers. Every guest's browser makes fresh requests for data that changes rarely.

**Solution:**
- Create `internal/middleware/cache_headers.go` with a configurable `CacheControl` middleware
- Apply `Cache-Control: public, max-age=60` to:
  - `GET /api/feature-flags`
  - `GET /api/config-images`
  - `GET /api/app-settings`
  - `GET /api/welcome-screen`
- Add `ETag` generation based on content hash (MD5 of JSON response)
- Handle `If-None-Match` → return `304 Not Modified` when ETag matches
- Admin mutation handlers don't need changes — the 60s max-age handles staleness

**Files:**
- `go-server/internal/middleware/cache_headers.go` — new
- `go-server/internal/router/router.go` — apply middleware to public GET routes

#### Streaming File Uploads

**Problem:** Upload handlers use `io.ReadAll` to read the entire file into memory before processing.

**Solution:**
- Replace `io.ReadAll` with `io.LimitReader` + streaming write to storage
- For image optimization: stream to a temp file, process from disk, then upload to storage
- Buffer size: 1-2MB chunks
- Combined with the MaxBytesReader from 1.1, this bounds memory regardless of file size

**Files:**
- `go-server/internal/handler/upload.go` — refactor to streaming
- `go-server/internal/service/storage.go` — ensure storage interface supports `io.Reader` (not just `[]byte`)

### 1.3 Database

#### Add Indexes

**Problem:** No indexes on frequently queried columns. Table scans on every email lookup and sorted query.

**Solution:**
- New migration file `002_add_indexes.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_rsvp_email ON rsvp(email);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
```

**Files:**
- `go-server/migrations/002_add_indexes.sql` — new

---

## Phase 2: Portfolio Polish

### 2.1 Large Component Refactoring

#### ImageUploadModal.tsx (804 lines → ~3 units)

**Extract:**
- `useImageAnalysis` hook — file validation, dimension detection, aspect ratio checks, compression recommendations (~150 lines)
- `ImagePreview` component — preview rendering with crop/resize indicators (~150 lines)
- `ImageUploadModal` remains as orchestrator — modal shell, form state, submit logic (~250 lines)

**Files:**
- `client/src/hooks/useImageAnalysis.ts` — new
- `client/src/components/ImagePreview.tsx` — new
- `client/src/components/ImageUploadModal.tsx` — refactor, reduced

#### ImageManager.tsx (761 lines → ~3 units)

**Extract:**
- `useDragAndDrop` hook — @dnd-kit sensors, collision detection, reorder callbacks, drop handlers (~200 lines)
- `ImageGrid` component — the visual grid/card rendering (~200 lines)
- `ImageManager` remains as container with state management (~250 lines)

**Files:**
- `client/src/hooks/useDragAndDrop.ts` — new
- `client/src/components/ImageGrid.tsx` — new
- `client/src/components/ImageManager.tsx` — refactor, reduced

### 2.2 Structured Error Responses

**Current:** Handlers return inconsistent error shapes — sometimes `{"error": "message"}`, sometimes plain text, sometimes just a status code.

**Solution:**
- Define `AppError` struct:

```go
type AppError struct {
    Code       string `json:"code"`
    Message    string `json:"message"`
    RequestID  string `json:"requestId"`
    StatusCode int    `json:"-"`
}
```

- Helper function `respondError(w http.ResponseWriter, r *http.Request, err AppError)`:
  - Sets HTTP status code
  - Injects request ID from Chi context
  - Writes JSON error envelope: `{"error": {...}}`
- Define error codes as constants: `ErrRsvpDuplicateEmail`, `ErrUploadTooLarge`, `ErrUnauthorized`, etc.
- Update all handlers to use `respondError` instead of ad-hoc error writing
- Frontend: update `apiRequest()` in `queryClient.ts` to parse error codes for user-friendly toasts

**Files:**
- `go-server/internal/handler/errors.go` — new, AppError type + respondError helper + error code constants
- `go-server/internal/handler/*.go` — all handlers updated to use respondError
- `client/src/lib/queryClient.ts` — parse structured errors

### 2.3 Frontend Test Coverage

**Testing approach:** Use MSW (Mock Service Worker) for API mocking — intercepts fetch at the network level, giving more realistic tests than manually stubbing.

**Priority test targets:**

| Test file | Scope | Key scenarios |
|-----------|-------|---------------|
| `RsvpSection.test.tsx` | RSVP form flow | Email pre-fill from URL, validation errors, successful submit, duplicate email handling |
| `FeatureFlags.test.tsx` | Conditional rendering | Sections hidden when flags disabled, polling behavior, error fallback |
| `apiRequest.test.ts` | API error handling | 401 redirect, 429 rate limit toast, structured error parsing, CSRF token injection |
| `MessagesSection.test.tsx` | Message submission | Form validation, successful post, optimistic update |

**Setup:**
- Add `msw` as dev dependency
- Create `client/src/test/mocks/handlers.ts` with default API responses
- Create `client/src/test/setup.ts` to start MSW server

**Files:**
- `client/src/test/mocks/handlers.ts` — new, MSW request handlers
- `client/src/test/setup.ts` — new, MSW server setup
- `client/src/components/RsvpSection.test.tsx` — new
- `client/src/hooks/useFeatureFlags.test.ts` — new
- `client/src/lib/queryClient.test.ts` — new
- `client/src/components/MessagesSection.test.tsx` — new

### 2.4 Backend Test Coverage

**Handler-level tests:**
- Test business logic beyond contract shape — duplicate RSVP detection, media approval state transitions, pagination edge cases (empty last page, offset > total returns empty array)
- Test file upload with size limits (oversized file returns 413)
- Test rate limiting (6th login attempt returns 429)
- Test input sanitization (script tags stripped from messages)

**Edge cases:**
- Empty collections return `[]` not `null`
- Malformed JSON returns 400 with structured error
- Missing required fields return 400 with field-specific error code
- Concurrent RSVP submissions with same email (race condition test with `-race` flag)

**Files:**
- `go-server/internal/handler/rsvp_test.go` — new, handler-level tests
- `go-server/internal/handler/media_test.go` — new
- `go-server/internal/handler/message_test.go` — new
- `go-server/internal/handler/upload_test.go` — new
- `go-server/internal/middleware/ratelimit_test.go` — new
- `go-server/internal/service/sanitizer_test.go` — new

### 2.5 Developer Experience

#### Request ID Propagation

**Problem:** Chi generates request IDs via `chimw.RequestID` but they're not used in logs or error responses.

**Solution:**
- In logging middleware, extract request ID with `middleware.GetReqID(r.Context())` and add to slog attributes
- In `respondError`, include request ID in error response
- Enables "give me the request ID" debugging workflow

**Files:**
- `go-server/internal/middleware/logging.go` — add request ID to log context
- `go-server/internal/handler/errors.go` — include in error responses

#### Documentation Cleanup

**Remove stale files:**
- `.flask_server` — Python remnant, no longer relevant
- `pyproject.toml`, `poetry.lock`, `uv.lock` — old Python dependency files
- `package.local.json` — appears unused
- `replit.md` — references Express backend, outdated

**Update:**
- `replit.md` — either update to reflect Go backend or remove entirely

**Add:**
- `docs/API.md` — markdown table of all endpoints (method, path, auth required, request/response shape)

**Files:**
- Delete: `.flask_server`, `pyproject.toml`, `poetry.lock`, `uv.lock`, `package.local.json`
- Update or delete: `replit.md`
- New: `docs/API.md`

---

## Implementation Order

### Phase 1 (recommended sequence)
1. Database indexes (002_add_indexes.sql) — zero risk, immediate benefit
2. File upload size limits (MaxBytesReader) — small change, prevents memory issues
3. Admin password hashing (bcrypt) — security critical
4. Input sanitization (bluemonday) — security critical
5. Rate limiting on login — security, standalone middleware
6. HTTP cache headers — standalone middleware, no breaking changes
7. Pagination (backend then frontend) — largest change, needs both sides
8. Streaming uploads — refactor, test thoroughly

### Phase 2 (recommended sequence)
1. Structured error responses (AppError) — foundational, other work builds on it
2. Request ID propagation — quick win, improves debugging for remaining work
3. Frontend test setup (MSW) — foundational for test work
4. Frontend test coverage — use TDD where adding new behavior
5. Backend test coverage — handler tests, edge cases
6. Component refactoring — extract hooks and components from large files
7. Documentation cleanup — final polish

## Testing Strategy

- All Phase 1 changes follow TDD: write failing test first, then implement
- Backend: table-driven tests, race detector always on
- Frontend: Vitest + React Testing Library + MSW
- Contract tests updated for any response shape changes (pagination wrapper)

## Out of Scope

- Multi-instance deployment (Redis CSRF, shared cache) — single instance is sufficient for 200 guests
- WebSocket/SSE for real-time updates — polling with backoff is adequate
- Type-safe API client generation (OpenAPI) — markdown API docs suffice for portfolio
- Database migration tooling (goose/migrate) — sequential SQL files are fine at this scale
