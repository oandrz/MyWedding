## Current Phase: Phase 7 — API Parity Verification
## Status: NOT_STARTED
## Last Updated: 2026-03-16

### Phase 0: Project Scaffolding & CI — COMPLETED
- [x] go.mod, folder structure, main.go with health endpoint
- [x] Env-aware config, .env files, Makefile
- [x] Docker (prod multi-stage + dev hot-reload), docker-compose (dev + prod)
- [x] GitHub Actions CI, SQL migration 001_init.sql
- [x] STATUS.md initialized

### Phase 1: Database Layer & Repository Interface — COMPLETED
- [x] 8 model structs with json:"camelCase" tags
- [x] Repository interface (35 methods)
- [x] MemoryRepository implementation (thread-safe)
- [x] Comprehensive CRUD tests + JSON serialization tests

### Phase 2: Middleware Layer — COMPLETED
- [x] Session store (configurable TTL, auto-cleanup)
- [x] Auth middleware (cookie-based, 401 responses)
- [x] CSRF middleware (per-session tokens, skips safe methods)
- [x] CORS middleware (env-aware: all in dev, allowlist in prod)
- [x] Logging middleware (slog)
- [x] TTL cache service (30s default)

### Phase 3: Core API Endpoints — COMPLETED
- [x] Auth: login, logout, validate
- [x] RSVP: create/update, list with stats, check, get by email, delete
- [x] Messages: create, list, delete
- [x] Feature flags: list (cached), get, create, update
- [x] App settings: list, music, get by key, update
- [x] Welcome screen: get, update
- [x] Media: create (auto-detect type), list approved, admin list, approval
- [x] Config images: list all/type (cached), create, update, reorder, delete
- [x] Router with public + auth-protected admin routes
- [x] 63 handler tests, all passing

### Phase 4: File Upload & Object Storage — COMPLETED
- [x] ObjectStorage interface with GCS + LocalStorage implementations
- [x] Image optimizer (JPEG, 600px width, quality 80)
- [x] Upload handler: multipart, 10MB limit, MIME filtering
- [x] Config image upload with thumbnail generation
- [x] Music upload (20MB, audio types)
- [x] GET /storage/* serving from GCS/local
- [x] Storage tests (local upload, admin dirs, download, delete, URL parsing)

### Phase 5: Google Drive Integration — COMPLETED
- [x] GoogleDriveService: OAuth2, upload, folder listing
- [x] GET /api/google-auth-url, GET /auth/google/callback
- [x] POST /api/upload-to-drive (multi-file, media entries)
- [x] GET /api/drive-folder-contents
- [x] Router options pattern (WithStorage, WithGoogleDrive)

### Phase 6: Production Hardening & CI/CD — COMPLETED
- [x] PostgresRepository implementation (all 35 methods, pgx/v5)
- [x] Database connection pool (pgxpool, MinConns=2, MaxConns=10)
- [x] main.go wired: PostgresRepository when DATABASE_URL set, fallback to MemoryRepository
- [x] main.go wired: Optional GCS/LocalStorage, optional Google Drive
- [x] Health check with DB connectivity status
- [x] Graceful shutdown with DB pool cleanup
- [x] Production logging (JSON structured in prod, text in dev)
- [x] Redis session store (REDIS_URL env var, falls back to in-memory)
- [x] Sessions interface for swappable implementations

### Remaining
- [ ] Phase 7: API Parity Verification

### Notes for Next Agent
- **Total tests**: 100+ across 6 packages, all passing
- **Binary builds**: `go build -o bin/wedding-server ./cmd/server`
- **Architecture**: Chi router, handler structs with dependency injection, repository pattern
- **Main.go**: Auto-selects PostgresRepository (if DATABASE_URL set) or MemoryRepository
- **Optional services**: GCS storage (GCS_BUCKET_ID), Google Drive (GOOGLE_CLIENT_ID+SECRET), LocalStorage fallback in dev
- **Cookie settings**: env-aware (secure + sameSite=none in prod, lax in dev)
- **Cache**: 30s TTL on feature flags and config images, invalidated on writes
- **Key files**:
  - Entry: `cmd/server/main.go`
  - Router: `internal/router/router.go`
  - Handlers: `internal/handler/*.go`
  - Models: `internal/models/*.go`
  - Repository: `internal/repository/repository.go` (interface), `memory.go`, `postgres.go`
  - Database: `internal/database/database.go`
  - Middleware: `internal/middleware/*.go`
  - Services: `internal/service/*.go` (cache, storage, googledrive, imageopt)
  - Config: `internal/config/config.go`
  - Tests: `internal/handler/handler_test.go` (63 tests), `internal/repository/memory_test.go`, `internal/middleware/*_test.go`, `internal/service/*_test.go`
