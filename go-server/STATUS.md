## Current Phase: Phase 3 — Core API Endpoints
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

### In Progress
(none)

### Remaining
- [ ] Phase 4: File Upload & Object Storage
- [ ] Phase 5: Google Drive Integration
- [ ] Phase 6: Production Hardening & CI/CD
- [ ] Phase 7: API Parity Verification

### Notes for Next Agent
- **Total tests**: 100+ across 6 packages, all passing
- **Binary builds**: `go build -o bin/wedding-server ./cmd/server`
- **Architecture**: Chi router, handler structs with dependency injection, repository pattern
- **Main.go**: Uses MemoryRepository for now — Phase 4+ will add PostgresRepository
- **Cookie settings**: env-aware (secure + sameSite=none in prod, lax in dev)
- **Cache**: 30s TTL on feature flags and config images, invalidated on writes
- **Missing from Phase 3**: File upload endpoints (Phase 4), Google Drive (Phase 5), /storage/* serving (Phase 4)
- **Key files**:
  - Router: `internal/router/router.go`
  - Handlers: `internal/handler/*.go`
  - Models: `internal/models/*.go`
  - Repository: `internal/repository/repository.go` (interface), `memory.go` (impl)
  - Middleware: `internal/middleware/*.go`
  - Config: `internal/config/config.go`
  - Tests: `internal/handler/handler_test.go` (63 tests), `internal/repository/memory_test.go`, `internal/middleware/*_test.go`
