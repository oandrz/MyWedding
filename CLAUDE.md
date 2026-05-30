# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MyWedding is a full-stack wedding e-invitation platform with a React/TypeScript frontend and a Go backend (Chi router + pgx). The Go server is the sole backend — there is no Express or Python server.

## Commands

### Go Backend (run from `go-server/`)

```bash
make test              # Run all tests with race detector (-v -race -count=1)
make lint              # golangci-lint run ./...
make build             # Compile to bin/wedding-server
make run-dev           # GO_ENV=development go run ./cmd/server (port 5000)
make docker-dev        # Docker Compose: app + Postgres + Redis with hot-reload
```

Run a single test:
```bash
cd go-server && go test ./internal/handler -run TestCreateRsvp -v
```

### Frontend (run from project root)

```bash
npm install            # Install dependencies (first time or after package.json changes)
npm run dev            # Vite dev server on :5173 (proxies /api, /storage, /auth to :5000)
npm run build          # Build to dist/public
npm run check          # TypeScript type check
```

### Production Preview (single process)

```bash
npm run build && cd go-server && STATIC_DIR=../dist/public go run ./cmd/server
```

## Architecture

### Backend (`go-server/`)

- **Go module**: `github.com/mywedding/platform` — use this as the import path prefix for all internal packages
- **Entry point**: `cmd/server/main.go` — loads config, wires dependencies, starts server with graceful shutdown
- **Router**: `internal/router/router.go` — Chi router, defines all routes and middleware chain
- **Handlers**: `internal/handler/` — one file per domain (rsvp, media, messages, config_images, feature_flags, app_settings, welcome_screen, auth, upload, google_drive)
- **Repository**: `internal/repository/` — interface in `repository.go`, with `memory.go` (dev/test) and `postgres.go` (production) implementations
- **Middleware**: `internal/middleware/` — auth, CORS, CSRF, logging, sessions
- **Services**: `internal/service/` — cache (30s TTL), object storage (GCS or local), Google Drive, image optimization
- **Models**: `internal/models/` — domain structs with `json:"camelCase"` tags
- **Config**: `internal/config/config.go` — loads `.env.{GO_ENV}` then `.env`, env vars override file values

**Dependency injection pattern**: Handlers are structs that receive repo, sessions, cache, storage via field injection in `router.go`. The router accepts functional options (`WithStorage`, `WithGoogleDrive`, `WithDBPool`).

### Frontend (`client/`)

- React 18 + TypeScript + Vite
- Routing: Wouter (`client/src/App.tsx`)
- Server state: TanStack React Query
- UI: Shadcn/Radix UI components + Tailwind CSS
- Path aliases: `@` → `client/src`, `@shared` → `shared/`, `@assets` → `attached_assets/`

### Shared (`shared/`)

- `schema.ts` — Drizzle ORM table definitions + Zod validation schemas (used by frontend)

## Environment Behavior

| Aspect | Development (`GO_ENV=development`) | Production |
|--------|-------------------------------------|------------|
| Database | Falls back to in-memory if DATABASE_URL unset | Exits on connection failure |
| Redis | Falls back to in-memory sessions | Exits on connection failure |
| Logging | Text format | JSON structured |
| CORS | Allow `*` | Requires explicit allowlist |
| Cookies | Secure=false, SameSite=Lax | Secure=true, SameSite=None |
| Static files | Vite serves (separate process) | Go serves from STATIC_DIR |

## Database

Schema in `go-server/migrations/001_init.sql`. Eight tables: users, rsvp, media, messages, config_images, feature_flags, app_settings, welcome_screen.

Migrate: `make migrate` (requires `DATABASE_URL` env var).

## Testing Conventions

- Table-driven tests throughout
- Contract tests in `handler/contract_test.go` verify JSON response structure (camelCase fields, correct types, status codes)
- Tests use the in-memory repository — no database required
- Race detector always enabled (`-race` flag)

## Development Workflows

**Create new Branch**: Create new branch from `main` or `develop` (depending on feature)
**Feature development**: Investigate → Design → TDD (write tests first) → Implement → Verify
**Create Pull Request**: Create pull request to `main` or `develop` (depending on feature)
**Bug fixes**: Investigate → Find root cause → Reproduce with test → Fix → Verify → Document in `go-server/issuesResolution.md`

## Gotchas

- **macOS port 5000**: AirPlay Receiver may conflict. Disable AirPlay Receiver in System Settings or change `PORT` in `go-server/.env.development`.
- **Vite proxy**: Dev frontend on :5173 proxies `/api`, `/storage`, `/auth` to the Go server. Both must be running for full-stack dev.
- **JSON field casing**: All Go model JSON tags use camelCase. Contract tests enforce this.
- **CSRF tokens**: Admin mutations require CSRF tokens from the session. Tests must set up sessions properly.
