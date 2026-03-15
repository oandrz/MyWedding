## Current Phase: Phase 0 — Project Scaffolding & CI
## Status: COMPLETED
## Last Updated: 2026-03-16

### Completed
- [x] Initialize `go.mod` in `go-server/` (module: github.com/andreasronaldo/wedding-server)
- [x] Create folder structure (cmd/server, internal/{config,database,models,repository,handler,middleware,service,router}, migrations)
- [x] `cmd/server/main.go` with `GET /api/health` endpoint (Chi router, graceful shutdown)
- [x] `internal/config/config.go` — env-aware config loading (`GO_ENV=development|production`)
- [x] `.env.development`, `.env.production`, `.env.example`
- [x] `Makefile` (build, test, run, run-dev, lint, docker-dev, docker-prod)
- [x] `Dockerfile` (multi-stage: golang:1.23-alpine build → alpine:3.19 run)
- [x] `Dockerfile.dev` (with `air` hot-reload)
- [x] `.air.toml` (hot-reload configuration)
- [x] `docker-compose.dev.yml` (Go app + PostgreSQL 14 + Redis 7, debug port 2345)
- [x] `docker-compose.prod.yml` (optimized binary + PostgreSQL + Redis, restart policies)
- [x] `.github/workflows/go-ci.yml` (lint, vet, test with coverage, build)
- [x] SQL migration `001_init.sql` from `shared/schema.ts` (all 8 tables + seed data)
- [x] Tests: config loading for dev/prod envs, health endpoint 200, method not allowed 405
- [x] Initialize `STATUS.md`

### In Progress
(none)

### Remaining
(none — Phase 0 complete)

### Notes for Next Agent
- **Go version**: 1.23, module path: `github.com/andreasronaldo/wedding-server`
- **Dependencies**: chi/v5 (router), godotenv (env loading)
- **Config**: `internal/config/config.go` loads env-specific `.env.{GO_ENV}` files, exposes `IsProduction()` helper
- **Main**: `cmd/server/main.go` has `newRouter(cfg)` function (exported for testing), graceful shutdown with 10s timeout
- **SQL migration**: `migrations/001_init.sql` creates all 8 tables with seed data for feature_flags, app_settings, welcome_screen
- **All 6 tests pass**, binary builds successfully
- **Docker**: dev uses air hot-reload, prod uses multi-stage alpine build
- **Next**: Phase 1 (Database Layer & Repository Interface) and Phase 2 (Middleware) can run in parallel

### Files Created
- `go-server/go.mod`, `go-server/go.sum`
- `go-server/cmd/server/main.go`, `go-server/cmd/server/main_test.go`
- `go-server/internal/config/config.go`, `go-server/internal/config/config_test.go`
- `go-server/.env.development`, `go-server/.env.production`, `go-server/.env.example`
- `go-server/Makefile`
- `go-server/Dockerfile`, `go-server/Dockerfile.dev`, `go-server/.air.toml`
- `go-server/docker-compose.dev.yml`, `go-server/docker-compose.prod.yml`
- `go-server/.github/workflows/go-ci.yml`
- `go-server/migrations/001_init.sql`
- `go-server/STATUS.md`
