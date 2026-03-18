# Go Wedding Server — Onboarding & Handover Guide

This document is for engineers picking up the Go backend for the first time. It covers how to run the server, where things live, how the pieces connect, and the conventions you need to follow.

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Architecture Overview](#architecture-overview)
5. [Configuration & Environment](#configuration--environment)
6. [Request Lifecycle](#request-lifecycle)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Data Models](#data-models)
9. [Repository Layer](#repository-layer)
10. [Middleware Stack](#middleware-stack)
11. [Services](#services)
12. [Testing](#testing)
13. [Docker & Deployment](#docker--deployment)
14. [Production Deployment (AWS EC2)](#production-deployment-aws-ec2)
15. [Conventions & Gotchas](#conventions--gotchas)

---

## What This Is

The **sole backend** for a wedding e-invitation platform. Express.js and Flask have been removed — Go serves both APIs and the React frontend. In production the Go server serves built static assets directly; in development Vite runs separately and proxies API calls to Go.

**Key facts:**
- **Framework:** Chi (`go-chi/chi/v5`) — lightweight, stdlib-compatible
- **Database:** PostgreSQL via pgx/v5, with an in-memory fallback for development
- **Sessions:** In-memory or Redis, swappable at runtime
- **File storage:** Google Cloud Storage or local filesystem
- **Total Go code:** ~9,200 lines across 38 files
- **Tests:** 193 tests across 7 packages, all passing

---

## Quick Start

### Without Docker (fastest for local dev)

```bash
cd go-server

# No database needed — defaults to in-memory storage
GO_ENV=development go run ./cmd/server
# Server starts on :5000
```

### Full-stack dev (two terminals)

```bash
# Terminal 1: Go API server
cd go-server && GO_ENV=development go run ./cmd/server
# API on :5000

# Terminal 2: Vite dev server (from project root)
npm run dev
# Frontend on :5173, proxies /api, /storage, /auth to :5000
```

### Production preview (single process)

```bash
npm run build
cd go-server && STATIC_DIR=../dist/public go run ./cmd/server
# Full app at http://localhost:5000
```

### With Docker (full stack: Postgres + Redis)

```bash
cd go-server
make docker-dev
# Starts app (:5000) + PostgreSQL (:5432) + Redis (:6379)
# Hot-reload via Air — edit Go files and the server restarts automatically
```

### Run tests

```bash
make test
# or: go test ./... -v -race -count=1
```

### Build binary

```bash
make build
# Output: bin/wedding-server
```

### Makefile targets at a glance

| Target | What it does |
|--------|-------------|
| `make build` | Compile to `bin/wedding-server` |
| `make test` | Run all tests with race detector |
| `make run` | Build + run (development mode) |
| `make run-dev` | `go run` directly (no binary) |
| `make lint` | Run golangci-lint |
| `make docker-dev` | Docker Compose with hot-reload + Postgres + Redis |
| `make docker-prod` | Docker Compose with optimized binary |
| `make migrate` | Run SQL migrations against `$DATABASE_URL` |

---

## Project Structure

```
go-server/
├── cmd/server/
│   └── main.go                  # Entry point — wires everything together
│
├── internal/
│   ├── config/config.go         # Env-aware configuration loading (includes StaticDir)
│   ├── database/database.go     # PostgreSQL connection pool setup
│   │
│   ├── models/                  # 8 domain structs (one file each)
│   │   ├── rsvp.go              #   Rsvp + InsertRsvp
│   │   ├── media.go             #   Media + InsertMedia
│   │   ├── message.go           #   Message + InsertMessage
│   │   ├── config_image.go      #   ConfigImage + InsertConfigImage
│   │   ├── feature_flag.go      #   FeatureFlag + InsertFeatureFlag
│   │   ├── app_setting.go       #   AppSetting + InsertAppSetting
│   │   ├── welcome_screen.go    #   WelcomeScreen + InsertWelcomeScreen
│   │   └── user.go              #   User + InsertUser
│   │
│   ├── repository/              # Data access layer
│   │   ├── repository.go        #   Repository interface (35 methods)
│   │   ├── memory.go            #   In-memory implementation (dev/test)
│   │   └── postgres.go          #   PostgreSQL implementation (production)
│   │
│   ├── handler/                 # HTTP handlers (one file per domain)
│   │   ├── auth.go              #   Login, Logout, Validate
│   │   ├── rsvp.go              #   RSVP CRUD + stats
│   │   ├── message.go           #   Message CRUD
│   │   ├── media.go             #   Media CRUD + approval
│   │   ├── config_image.go      #   Config image CRUD + reorder
│   │   ├── feature_flag.go      #   Feature flag CRUD
│   │   ├── app_setting.go       #   App settings CRUD + music
│   │   ├── welcome_screen.go    #   Welcome screen get/update
│   │   ├── upload.go            #   File uploads (images, music)
│   │   ├── googledrive.go       #   Google Drive integration
│   │   └── helpers.go           #   writeJSON, writeError, parseJSON
│   │
│   ├── middleware/              # HTTP middleware
│   │   ├── session.go           #   Sessions interface + in-memory store
│   │   ├── redis_session.go     #   Redis-backed session store
│   │   ├── auth.go              #   Cookie-based auth middleware
│   │   ├── csrf.go              #   CSRF token store + middleware
│   │   ├── cors.go              #   Environment-aware CORS
│   │   └── logging.go           #   Request logging
│   │
│   ├── service/                 # Business logic / external integrations
│   │   ├── cache.go             #   TTL cache (30s for config/flags)
│   │   ├── storage.go           #   ObjectStorage interface (GCS + local)
│   │   ├── imageopt.go          #   Image resizing / thumbnails
│   │   └── googledrive.go       #   Google Drive OAuth2 + upload
│   │
│   └── router/router.go        # Route registration + middleware wiring + SPA static file fallback
│
├── migrations/
│   └── 001_init.sql             # Schema (8 tables) + seed data
│
├── .env.development             # Dev defaults
├── .env.production              # Prod template
├── .env.example                 # All env vars documented
├── Dockerfile                   # 3-stage production build (frontend + Go + runtime)
├── Dockerfile.dev               # Dev build with Air hot-reload
├── docker-compose.dev.yml       # App + Postgres + Redis + Frontend (dev)
├── docker-compose.prod.yml      # App + Postgres + Redis (prod)
├── Makefile                     # Build/run/test shortcuts
└── STATUS.md                    # Phase completion tracker
```

**Reading order for a new engineer:** `config.go` → `models/` → `repository/repository.go` → `handler/helpers.go` → any handler → `router/router.go` → `main.go`.

---

## Architecture Overview

**Development mode** (two processes):
```
  Browser → Vite (:5173) ──proxy /api,/storage,/auth──→ Go (:5000) → Repository
```

**Production mode** (single process):
```
  Browser → Go (:5000) ─┬─ /api/*, /storage/*, /auth/* → Handlers → Repository
                         └─ everything else → static files (SPA fallback to index.html)
```

**Internal architecture:**
```
                    ┌──────────────────────────────┐
                    │       Chi Router (:5000)      │
                    │  CORS → Logging → Recovery    │
                    └──────────────┬───────────────┘
                                   │
         ┌─────────────────────────┼──────────────────────────┐
         │                         │                           │
    Public Routes           Auth + CSRF            Static Files (prod)
         │                  (admin only)           SPA fallback
         ▼                         ▼                           ▼
   ┌──────────┐         ┌──────────────┐          ┌────────────────┐
   │ Handlers │         │Admin Handlers│          │  STATIC_DIR /  │
   └────┬─────┘         └──────┬───────┘          │  index.html    │
        │                      │                  └────────────────┘
        └──────────┬───────────┘
                   ▼
          ┌────────────────┐
          │   Repository   │◄─── Interface
          │  (35 methods)  │
          └───┬────────┬───┘
              │        │
     ┌────────▼──┐  ┌──▼──────────┐
     │  Memory   │  │  Postgres   │
     │  (dev)    │  │  (prod)     │
     └───────────┘  └─────────────┘
```

**Runtime auto-selection** (in `main.go`):

| Component | Condition | Production | Development fallback |
|-----------|-----------|-----------|---------------------|
| Repository | `DATABASE_URL` set? | PostgresRepository | MemoryRepository |
| Sessions | `REDIS_URL` set? | RedisSessionStore | In-memory SessionStore |
| File storage | `GCS_BUCKET_ID` set? | GCSStorage | LocalStorage (`./storage/`) |
| Google Drive | `GOOGLE_CLIENT_ID` + `SECRET` set? | Enabled | Disabled (routes not registered) |

This means you can run the server with zero external dependencies — just `go run ./cmd/server`.

---

## Configuration & Environment

All configuration is loaded in `internal/config/config.go`. The server reads from environment variables, with `.env.{GO_ENV}` files as defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `GO_ENV` | `development` | `development` or `production` |
| `PORT` | `5000` | HTTP server port |
| `DATABASE_URL` | _(empty)_ | PostgreSQL connection string. If empty, uses in-memory. |
| `REDIS_URL` | _(empty)_ | Redis connection string. If empty, uses in-memory sessions. |
| `ADMIN_PASSWORD` | `admin123` | Password for admin login |
| `SESSION_MAX_AGE` | `1800` | Session duration in seconds (30 min) |
| `CORS_ORIGINS` | `*` (dev) | Comma-separated allowed origins (prod only) |
| `GCS_BUCKET_ID` | _(empty)_ | GCS bucket for file uploads |
| `GOOGLE_CLIENT_ID` | _(empty)_ | OAuth2 client ID for Google Drive |
| `GOOGLE_CLIENT_SECRET` | _(empty)_ | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | _(empty)_ | Pre-authorized refresh token |
| `STATIC_DIR` | _(empty)_ | Path to built frontend assets. Set in production to serve SPA from Go. |
| `VITE_API_URL` | `http://localhost:5000` | Vite dev proxy target (frontend only, not Go) |

**What changes between dev and prod:**

| Behavior | Development | Production |
|----------|-------------|------------|
| Logging | Text format, debug level | JSON format, info level |
| CORS | Allow all origins, SameSite=Lax | Allowlisted origins, SameSite=None, Secure |
| Cookies | `secure=false` | `secure=true` |
| Storage | Local filesystem | GCS |
| Sessions | In-memory | Redis |

---

## Request Lifecycle

Here's what happens when a request hits the server:

```
1. CORS middleware        → Sets Access-Control headers, handles OPTIONS preflight
2. Logging middleware     → Logs method, path (and status + duration on completion)
3. RequestID middleware   → Adds X-Request-Id header
4. RealIP middleware      → Extracts real client IP from X-Forwarded-For
5. Recoverer middleware   → Catches panics, returns 500

   For admin routes, two more middlewares run:
6. Auth middleware        → Reads "admin_session" cookie → validates against session store
                            → 401 if missing/expired → sets sessionID in context
7. CSRF middleware        → Reads X-CSRF-Token header → validates against CSRF store
                            → 403 if invalid (skipped for GET/HEAD/OPTIONS)

8. Handler function       → Parses request → calls Repository → returns JSON
```

**Auth flow:**

```
POST /api/admin/login  { "password": "..." }
  → constant-time password compare
  → creates session (in-memory or Redis)
  → generates CSRF token for that session
  → sets "admin_session" cookie
  → returns { "message": "Login successful", "csrfToken": "..." }

Subsequent admin requests must include:
  - Cookie: admin_session=<sessionID>
  - Header: X-CSRF-Token: <token>  (for POST/PUT/PATCH/DELETE)
```

---

## API Endpoints Reference

### Public Endpoints (no auth required)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/health` | _(inline)_ | Health check + optional DB status |
| POST | `/api/rsvp` | `RsvpHandler.Create` | Submit or update RSVP (upsert by email) |
| GET | `/api/rsvp` | `RsvpHandler.List` | All RSVPs + stats (total, attending, etc.) |
| GET | `/api/rsvp/check` | `RsvpHandler.Check` | Check if guest exists (`?name=X&email=Y`) |
| GET | `/api/rsvp/{email}` | `RsvpHandler.GetByEmail` | Get RSVP by email |
| POST | `/api/messages` | `MessageHandler.Create` | Submit a guestbook message |
| GET | `/api/messages` | `MessageHandler.List` | All messages |
| POST | `/api/media` | `MediaHandler.Create` | Submit media metadata |
| GET | `/api/media` | `MediaHandler.ListApproved` | Approved media only |
| GET | `/api/config-images` | `ConfigImageHandler.ListAll` | All config images (cached) |
| GET | `/api/config-images/{type}` | `ConfigImageHandler.ListByType` | By type (cached) |
| GET | `/api/feature-flags` | `FeatureFlagHandler.List` | All feature flags (cached) |
| GET | `/api/feature-flags/{key}` | `FeatureFlagHandler.Get` | Single flag |
| GET | `/api/app-settings` | `AppSettingHandler.List` | All settings |
| GET | `/api/settings/music` | `AppSettingHandler.GetMusic` | Background music URL |
| GET | `/api/settings/{key}` | `AppSettingHandler.Get` | Single setting |
| GET | `/api/welcome-screen` | `WelcomeScreenHandler.Get` | Welcome screen config |
| POST | `/api/upload` | `UploadHandler.Upload` | File upload (10MB, images/video) |
| GET | `/storage/*` | `UploadHandler.ServeStorage` | Serve uploaded files |

### Auth-Protected Endpoints (cookie + CSRF required)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/api/admin/login` | `AuthHandler.Login` | Admin login (no auth needed) |
| POST | `/api/admin/logout` | `AuthHandler.Logout` | Clear session |
| POST | `/api/admin/validate` | `AuthHandler.Validate` | Check session validity |
| DELETE | `/api/rsvp/{id}` | `RsvpHandler.Delete` | Delete RSVP |
| DELETE | `/api/messages/{id}` | `MessageHandler.Delete` | Delete message |
| GET | `/api/admin/media` | `MediaHandler.ListAll` | All media (incl. unapproved) |
| PATCH | `/api/admin/media/{id}` | `MediaHandler.UpdateApproval` | Approve/reject media |
| POST | `/api/admin/config-images` | `ConfigImageHandler.Create` | Create/upsert config image |
| PUT | `/api/admin/config-images/{key}` | `ConfigImageHandler.Update` | Update config image |
| PUT | `/api/admin/config-images-reorder` | `ConfigImageHandler.Reorder` | Reorder images |
| DELETE | `/api/admin/config-images/{key}` | `ConfigImageHandler.Delete` | Delete config image |
| POST | `/api/admin/config-images-upload` | `UploadHandler.ConfigImageUpload` | Upload + thumbnail |
| POST | `/api/admin/settings/music-upload` | `UploadHandler.MusicUpload` | Upload music (20MB) |
| PATCH | `/api/admin/feature-flags/{key}` | `FeatureFlagHandler.Update` | Toggle flag |
| POST | `/api/admin/feature-flags` | `FeatureFlagHandler.CreateFlag` | Create new flag |
| PATCH | `/api/admin/app-settings/{key}` | `AppSettingHandler.Update` | Update setting |
| PATCH | `/api/admin/welcome-screen` | `WelcomeScreenHandler.Update` | Update welcome screen |

### Google Drive Endpoints (only registered if credentials configured)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/api/google-auth-url` | `GoogleDriveHandler.GetAuthURL` | OAuth2 consent URL |
| GET | `/auth/google/callback` | `GoogleDriveHandler.AuthCallback` | OAuth2 callback (HTML) |
| POST | `/api/upload-to-drive` | `GoogleDriveHandler.UploadToDrive` | Multi-file upload |
| GET | `/api/drive-folder-contents` | `GoogleDriveHandler.GetDriveFolderContents` | List files |

---

## Data Models

All models live in `internal/models/`, one file per entity. Every model has a read struct and an `Insert` struct for creation/updates.

**Key conventions:**
- All JSON tags use **camelCase** (e.g., `json:"guestCount"`, `json:"mediaUrl"`) to match the React frontend
- Nullable fields use Go pointers: `*string`, `*int`, `*bool` — they serialize as `null` in JSON
- Timestamps are `string` fields formatted as RFC3339 (not `time.Time`) for consistent JSON output
- `User.Password` has `json:"-"` — never exposed in API responses

| Model | DB Table | Notable Fields |
|-------|----------|----------------|
| `User` | `users` | Password excluded from JSON |
| `Rsvp` | `rsvp` | `GuestCount *int` (nullable) |
| `Media` | `media` | `MediaType` auto-detected from MIME, `CreatedAt` as RFC3339 string |
| `ConfigImage` | `config_images` | `DisplayOrder` for sorting, `IsActive` for visibility |
| `FeatureFlag` | `feature_flags` | `Enabled` toggles features on/off |
| `AppSetting` | `app_settings` | Key-value pairs with `SettingType` |
| `WelcomeScreen` | `welcome_screen` | Single row (id=1), partial updates via pointers |
| `Message` | `messages` | `Email *string` (optional) |

---

## Repository Layer

`internal/repository/repository.go` defines the `Repository` interface — 35 methods covering all 8 entities.

**Two implementations:**

| Implementation | File | When used | Notes |
|---------------|------|-----------|-------|
| `MemoryRepository` | `memory.go` (584 lines) | Tests, local dev without DB | Thread-safe (sync.Mutex), auto-incrementing IDs |
| `PostgresRepository` | `postgres.go` (676 lines) | Production | pgx/v5 parameterized queries, transactions for reorder |

**Pattern for "not found":** All getters return `(nil, nil)` — first nil means "not found", second nil means "no error". Handlers check `if result == nil` to return 404.

**Pattern for "delete":** Returns `(bool, error)` — bool indicates whether a row was actually deleted.

---

## Middleware Stack

Defined in `internal/middleware/`. Applied in `router.go` in this order:

```
Global (all routes):
  1. CORS         → env-aware (allow-all in dev, allowlist in prod)
  2. Logging      → slog.Debug with method, path, status, duration
  3. RequestID    → chi built-in
  4. RealIP       → chi built-in
  5. Recoverer    → chi built-in (panic recovery)

Admin routes only:
  6. Auth         → reads "admin_session" cookie, validates session, sets context
  7. CSRF         → validates X-CSRF-Token header (skips GET/HEAD/OPTIONS)
```

**Session stores** implement the `Sessions` interface:

```go
type Sessions interface {
    CreateSession(ip string) *Session
    GetSession(sessionID string) *Session
    DeleteSession(sessionID string) bool
}
```

- `SessionStore` — in-memory with `sync.Mutex`, cleans expired sessions on create
- `RedisSessionStore` — Redis-backed, refreshes TTL on every access

---

## Services

### Cache (`service/cache.go`)
- 30-second TTL, in-memory, thread-safe
- Used by: `ConfigImageHandler` (list all, list by type), `FeatureFlagHandler` (list)
- Invalidated on any write operation via `InvalidateAll()`

### ObjectStorage (`service/storage.go`)
Interface with two implementations:

| | GCSStorage | LocalStorage |
|---|---|---|
| Used when | `GCS_BUCKET_ID` is set | Development fallback |
| Stores at | GCS bucket | `./storage/` directory |
| URLs | `/storage/{dir}/{file}` | Same pattern |

Admin image directories: `admin/banner`, `admin/gallery`, `admin/profiles/bride`, `admin/profiles/groom`, `admin/verse`.

### Image Optimizer (`service/imageopt.go`)
- Resizes to 600px width (maintains aspect ratio)
- JPEG output, quality 80
- Used by `ConfigImageUpload` to generate thumbnails

### Google Drive (`service/googledrive.go`)
- OAuth2 flow for authorization
- Uploads to a hardcoded wedding folder (`1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC`)
- Auto-sets public read permission on uploaded files

---

## Testing

### Test counts

| Package | Tests | What's covered |
|---------|-------|----------------|
| `cmd/server` | 2 | Health endpoint, method validation |
| `internal/config` | 4 | Dev/prod/default config loading |
| `internal/handler` | 143 | 63 handler tests + 74 contract tests + 6 cross-cutting |
| `internal/middleware` | 19 | Session expiry, auth 401, CSRF, CORS |
| `internal/repository` | 16 | CRUD for all entities, JSON serialization |
| `internal/service` | 9 | Cache TTL, LocalStorage operations |
| **Total** | **193** | |

### Running tests

```bash
# All tests
go test ./... -count=1

# With verbose output
go test ./... -v -count=1

# With race detector (slower but catches concurrency bugs)
go test ./... -v -race -count=1

# Specific package
go test ./internal/handler/ -v -count=1

# Specific test
go test ./internal/handler/ -run TestContract_RsvpCreate -v
```

### Contract tests (`handler/contract_test.go`)

These are the most important tests for maintaining API parity with the Express.js server. They verify:
- Every endpoint returns the correct JSON keys
- Values have the correct types (string, number, bool, null, array, object)
- HTTP status codes match expectations (201 for creates, 200 for reads, 404 for missing)
- All JSON field names are camelCase (no snake_case leaking through)
- Error responses always have the shape `{"message": "..."}`

**If you change any handler's response shape, a contract test should fail.** This is by design — it protects the frontend from breaking.

### Test infrastructure (`handler/handler_test.go`)

Tests use a shared setup:

```go
env := newTestEnv()                        // Creates config, MemoryRepository, router
sessionID, csrfToken := loginAdmin(env)    // Authenticates, returns credentials
req := adminRequest("POST", "/api/admin/config-images", body, sessionID, csrfToken)
w := httptest.NewRecorder()
env.handler.ServeHTTP(w, req)
```

---

## Docker & Deployment

### Development

```bash
make docker-dev
# or: docker compose -f docker-compose.dev.yml up --build
```

This starts:
- **App** on `:5000` with Air hot-reload (edit Go files → auto-restart)
- **PostgreSQL 14** on `:5432` (db: `wedding_invitation_db`, user: `wedding_user`)
- **Redis 7** on `:6379`
- **Frontend** on `:5173` (Vite dev server, proxies `/api` to the Go app)
- **Delve debugger** on `:2345` (attach your IDE for step debugging)

Alternatively, skip Docker for the frontend and use the [two-terminal workflow](#full-stack-dev-two-terminals) described above.

### Production

```bash
make docker-prod
# or: docker compose -f docker-compose.prod.yml up --build
```

Uses a 3-stage Dockerfile:
1. **Frontend build:** `node:20-alpine` → `npm run build` produces React assets in `dist/public`
2. **Go build:** `golang:1.23-alpine` → compiles static binary with `-ldflags="-s -w"`
3. **Runtime:** `alpine:3.19` → minimal image with binary + frontend assets + migrations

Note: `docker-compose.prod.yml` sets the build context to `..` (project root) with `dockerfile: go-server/Dockerfile` so both frontend and Go source are available during the build.

### CI (GitHub Actions)

Workflow at `.github/workflows/go-ci.yml` runs on pushes to `golang_master` or `phase/*` branches:
1. **Lint** — golangci-lint
2. **Test** — `go vet` + `go test` with coverage
3. **Build** — compiles binary

---

## Production Deployment (AWS EC2)

The app runs on a single EC2 instance: Go backend + React SPA served by Nginx, with PostgreSQL and Redis in Docker Compose on the same VM. Google Cloud Storage handles file uploads.

**Key files:**

| File | Purpose |
|------|---------|
| `go-server/docker-compose.prod.yml` | Compose config for app + Postgres + Redis |
| `deploy.sh` | One-command deploy (build, start, health check) |
| `go-server/.env.production` | Production secrets template (edit on server) |
| `nginx/wedding.conf` | Reverse proxy: port 80 → app on :5000 |
| `gcs-key.json` | GCS service account key (not in repo — copy to server) |

### Prerequisites

Before deploying, have these ready:

- [ ] AWS account with EC2 access
- [ ] SSH key pair (`.pem` file from AWS)
- [ ] GCS service account JSON key (`gcs-key.json`)
- [ ] Google OAuth credentials (client ID, secret, refresh token — copy from `.env.development`)
- [ ] A strong admin password and DB password (`openssl rand -base64 24`)

### AWS Setup

- [ ] Launch EC2 instance: **t3.small**, Ubuntu 24.04 LTS, 20GB gp3 storage
- [ ] Security Group: allow SSH (port 22, your IP only) and HTTP (port 80, anywhere)
- [ ] Allocate an Elastic IP and associate it with the instance
- [ ] SSH in: `ssh -i your-key.pem ubuntu@<elastic-ip>`

### Server Setup

Run these on the EC2 instance:

```bash
# 1. Install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 git nginx
sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# 2. Clone the repo (SSH — requires GitHub SSH key, see note below)
git clone git@github.com:oandrz/MyWedding.git ~/weddingAws
cd ~/weddingAws
git checkout phase/0-scaffold
# Note: HTTPS clone won't work with password auth. Set up an SSH key on the
# EC2 instance (ssh-keygen -t ed25519) and add the public key to GitHub.

# 3. Create .env.production (this file is gitignored — must be created on server)
cat > ~/weddingAws/go-server/.env.production << 'EOF'
GO_ENV=production
PORT=5000
DB_PASSWORD=CHANGE_ME_strong_db_password
REDIS_URL=redis://redis:6379
ADMIN_PASSWORD=CHANGE_ME_strong_admin_password
SESSION_MAX_AGE=1800
CORS_ORIGINS=http://YOUR_ELASTIC_IP
GCS_BUCKET_ID=your-gcs-bucket-name
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REFRESH_TOKEN=your-google-refresh-token
EOF
nano ~/weddingAws/go-server/.env.production
# Replace all placeholder values with real credentials

# 4. Copy gcs-key.json to server (run from your local machine)
#    scp -i your-key.pem gcs-key.json ubuntu@<elastic-ip>:~/weddingAws/gcs-key.json

# 5. Configure Nginx
sudo cp ~/weddingAws/nginx/wedding.conf /etc/nginx/sites-available/wedding
sudo ln -s /etc/nginx/sites-available/wedding /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl enable nginx

# 6. Deploy (first time — run migration)
cd ~/weddingAws
chmod +x deploy.sh
APP_DIR=~/weddingAws MIGRATE=1 ./deploy.sh
```

### Post-Deploy Checklist

- [ ] `curl http://<elastic-ip>/api/health` returns `{"status":"ok"}`
- [ ] Frontend loads in browser at `http://<elastic-ip>`
- [ ] Admin login works with your `ADMIN_PASSWORD`
- [ ] Submit a test RSVP
- [ ] Upload a test photo (verifies GCS connection)
- [ ] Set up daily Postgres backups:
  ```bash
  mkdir -p ~/backups
  cat > ~/backup.sh << 'BKEOF'
  #!/bin/bash
  docker compose --env-file ~/weddingAws/go-server/.env.production \
    -f ~/weddingAws/go-server/docker-compose.prod.yml exec -T postgres \
    pg_dump -U wedding_user wedding_invitation_db | gzip > ~/backups/wedding_$(date +%Y%m%d).sql.gz
  find ~/backups -mtime +30 -delete
  BKEOF
  chmod +x ~/backup.sh
  (crontab -l 2>/dev/null; echo "0 3 * * * ~/backup.sh") | crontab -
  ```
- [ ] Enable unattended security updates: `sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`

### SSH Access

An SSH shortcut is configured in `~/.ssh/config`:

```
Host wedding
    HostName 13.215.13.47
    User ubuntu
    IdentityFile ~/Downloads/wedding-key.pem
```

Connect with: `ssh wedding`

### Updating the App

```bash
ssh wedding
cd ~/weddingAws && APP_DIR=~/weddingAws ./deploy.sh
```

The deploy script pulls latest code, rebuilds Docker images, restarts services, and verifies the health check. Add `MIGRATE=1` if the update includes schema changes.

### Adding a Domain + HTTPS (Later)

1. Buy a domain and point an A record to your Elastic IP
2. Update `CORS_ORIGINS` in `.env.production` to `https://yourdomain.com`
3. Install Certbot: `sudo apt install -y certbot python3-certbot-nginx`
4. Run: `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`
5. Redeploy: `cd ~/weddingAws && APP_DIR=~/weddingAws ./deploy.sh`

### Troubleshooting

| Issue | Fix |
|-------|-----|
| Health check fails | `cd ~/weddingAws/go-server && docker compose --env-file .env.production -f docker-compose.prod.yml logs app` |
| Postgres won't start | Verify `DB_PASSWORD` in `.env.production` hasn't changed after first run |
| Can't reach site | Check Security Group has port 80 open; check `sudo systemctl status nginx` |
| GCS upload fails | Verify `gcs-key.json` exists at `~/weddingAws/gcs-key.json` |
| Out of memory (t3.micro) | Enable swap: `sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile` |

---

## Conventions & Gotchas

### Things to know

1. **The table is `rsvp`, not `rsvps`.** The migration uses singular. All queries match.

2. **JSON is always camelCase.** The React frontend expects `guestCount`, `mediaUrl`, `createdAt`, etc. — never `guest_count`. The contract tests enforce this.

3. **Error responses always have this shape:** `{"message": "description"}` — one key, always `message`.

4. **"Not found" from the repository returns `(nil, nil)`**, not an error. Handlers check `if result == nil` and return 404.

5. **Nullable fields use pointers.** `*string`, `*int`, `*bool` serialize as JSON `null`. Regular fields always have a value.

6. **Timestamps are strings, not `time.Time`.** The PostgresRepository scans into `time.Time` then formats to RFC3339 before storing in the model struct. This ensures consistent JSON output.

7. **The health endpoint reports DB status** only when a database pool is configured. Without it, the response is just `{"status":"ok","timestamp":"..."}`.

8. **Cache invalidation is aggressive.** Any write to config images or feature flags calls `InvalidateAll()`, clearing the entire cache. This is simple and correct for this scale.

9. **Admin uploads from `admin@wedding.com` are auto-approved.** The `ListApproved` handler filters these out from the public media gallery.

10. **Google Drive folder ID is hardcoded** in `service/googledrive.go` line 16. Change it if you're deploying for a different wedding.

11. **The Go server serves the frontend in production.** When `STATIC_DIR` is set, Chi's `NotFound` handler serves static files with SPA fallback to `index.html`. All `/api/*`, `/storage/*`, `/auth/*` routes take priority over static files.

### Adding a new endpoint

1. Add the model to `models/` (if new entity)
2. Add methods to the `Repository` interface in `repository/repository.go`
3. Implement in both `memory.go` and `postgres.go`
4. Create a handler file in `handler/`
5. Register the route in `router/router.go`
6. Add handler tests in `handler_test.go`
7. Add contract tests in `contract_test.go`
8. Run `go test ./... -count=1` to verify

### Adding a new middleware

1. Create the middleware in `middleware/`
2. Apply it in `router/router.go` (globally or per-route group)
3. Add tests in `middleware_test.go`

---

## File Sizes at a Glance

| Area | Lines | Key files |
|------|-------|-----------|
| Handlers | ~1,600 | `upload.go` (353), `config_image.go` (204), `rsvp.go` (177) |
| Repository | ~1,320 | `postgres.go` (676), `memory.go` (584) |
| Tests | ~4,400 | `contract_test.go` (1,433), `handler_test.go` (1,353), `memory_test.go` (1,240) |
| Middleware | ~420 | `session.go` (104), `redis_session.go` (102), `csrf.go` (88) |
| Services | ~465 | `storage.go` (197), `googledrive.go` (141) |
| Config/Router/Main | ~450 | `router.go` (194), `main.go` (148), `config.go` (108) |
| **Total** | **~9,200** | |
