## Current Phase: Phase 8 — Frontend Switch to Go Backend
## Status: COMPLETED
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

### Phase 7: API Parity Verification — COMPLETED
- [x] Contract test suite (74 tests across all 22 endpoint groups)
- [x] JSON response structure verification (correct keys, types, camelCase)
- [x] HTTP status code verification (201 for creates, 200 for reads, 404 for missing)
- [x] Cross-cutting tests: error shape, no snake_case keys, Content-Type headers

### Phase 8: Frontend Switch to Go Backend — COMPLETED
- [x] Vite dev proxy: `/api`, `/storage`, `/auth` → Go server (localhost:5000)
- [x] Package.json scripts: `dev` → `vite`, `build` → `vite build`, removed Express/esbuild
- [x] Go dev port changed to 5000 (.env.development)
- [x] Go static file serving: `StaticDir` config + SPA fallback via Chi NotFound handler
- [x] Multi-stage Dockerfile: node build → go build → alpine runtime with frontend assets
- [x] docker-compose.prod.yml: build context set to project root, STATIC_DIR configured
- [x] docker-compose.dev.yml: frontend service added (node:20-alpine, vite --host)
- [x] Cleanup: deleted server/, app_modules/, Flask files, old Dockerfile, docker-compose.local.yml, docker-run.sh, drizzle.config.ts
- [x] Pruned 30+ server-side deps from package.json (express, passport, pg, sharp, multer, etc.)
- [x] All Go tests pass (140+), frontend builds, TypeScript compiles

### Notes for Next Agent
- **All 8 phases complete**
- **Express/Flask fully removed** — Go is the sole backend
- **Dev workflow**: Terminal 1: `cd go-server && go run ./cmd/server` (port 5000), Terminal 2: `npm run dev` (port 5173, proxies to Go)
- **Prod workflow**: `npm run build` then `STATIC_DIR=../dist/public go run ./cmd/server` (serves everything on port 5000)
- **Total tests**: 140+ across 6 packages, all passing (74 contract tests + 63 handler tests + middleware/repo/service tests)
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
