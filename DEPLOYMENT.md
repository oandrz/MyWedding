# MyWedding — Deployment Guide

A buyer-facing guide for deploying the MyWedding white-label e-invitation platform.
The platform is a single Go binary that serves both the JSON API and the compiled
React frontend. There is no separate Node.js, Python, or Express server.

---

## 1. Prerequisites

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| Go | 1.25.0 | As declared in `go-server/go.mod` |
| Node.js | 20 | For building the React frontend |
| npm | bundled with Node 20 | — |
| PostgreSQL | 14 | Used by API data and WhatsApp session storage |
| Redis | 6+ | Required in production for persistent admin sessions |

---

## 2. Quick Start (production, single-process)

```bash
# 1. Build the React frontend
npm install
npm run build
# Output lands in dist/public/

# 2. Build the Go binary
cd go-server
make build
# Output: go-server/bin/wedding-server

# 3. Set required env vars (see Section 4), then run:
GO_ENV=production \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  ADMIN_PASSWORD_HASH="<bcrypt-hash>" \
  CORS_ORIGINS="https://your-domain.com" \
  STATIC_DIR="../dist/public" \
  ./bin/wedding-server
```

Alternatively, skip the binary step and run directly:

```bash
cd go-server
GO_ENV=production STATIC_DIR=../dist/public go run ./cmd/server
```

The server listens on port `5000` by default (`PORT` env var overrides this).

---

## 3. Database Setup

### Create the database and user

```sql
CREATE USER wedding_user WITH PASSWORD 'strong-password-here';
CREATE DATABASE wedding_invitation_db OWNER wedding_user;
```

### Run migrations

The schema is maintained as numbered SQL migration files in `go-server/migrations/`.
Run them in order using the Makefile target (requires `DATABASE_URL` to be set):

```bash
cd go-server
DATABASE_URL="postgresql://wedding_user:password@localhost:5432/wedding_invitation_db" \
  make migrate
```

This runs every file in `go-server/migrations/*.sql` against the target database.

> Note: The WhatsApp integration (whatsmeow) creates additional tables in the same
> database automatically at startup (`whatsmeow_*`). No manual migration is needed
> for those tables.

---

## 4. Environment Variables

All configuration is supplied via environment variables (or `.env` files loaded by
`godotenv` — see `go-server/internal/config/config.go`).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GO_ENV` | **Yes (prod)** | `development` | Set to `production` in all live deployments. Controls CORS policy, cookie security flags, log format, and whether the server exits or falls back gracefully when DB/Redis are unavailable. |
| `PORT` | No | `5000` | TCP port for the HTTP server. |
| `STATIC_DIR` | No | _(empty)_ | Filesystem path to the compiled frontend (`dist/public`). Required when the Go binary serves static files. |
| `DATABASE_URL` | **Yes (prod)** | _(empty)_ | PostgreSQL connection string. In production the server exits on failure; in development it falls back to an in-memory store (data not persisted). |
| `REDIS_URL` | **Yes (prod)** | _(empty)_ | Redis connection URL. In production the server exits on failure; in development it falls back to in-memory sessions. |
| `ADMIN_PASSWORD_HASH` | **Yes** | _(none)_ | bcrypt hash of the admin password. Preferred over `ADMIN_PASSWORD`. Generate with `htpasswd -bnBC 10 "" yourpassword \| tr -d ':\n'`. |
| `ADMIN_PASSWORD` | No | `admin123` | Plaintext password — deprecated. The server auto-hashes it at startup and logs a warning. **The default `admin123` is insecure; always override in production.** |
| `SESSION_MAX_AGE` | No | `1800` | Admin session lifetime in seconds. Default is 30 minutes. |
| `CORS_ORIGINS` | **Yes (prod)** | `*` (dev only) | Comma-separated list of allowed origins (e.g. `https://your-domain.com`). Only applied when `GO_ENV=production`. |
| `SUPABASE_URL` | No | _(empty)_ | Supabase project URL. All three Supabase vars must be set together to enable cloud storage. |
| `SUPABASE_SERVICE_KEY` | No | _(empty)_ | Supabase service-role API key. |
| `SUPABASE_BUCKET_ID` | No | _(empty)_ | Supabase storage bucket name. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | No | _(empty)_ | Base64-encoded service account JSON. Required for the Google Drive photo gallery feature. |

---

## 5. Admin Authentication

Authentication is **password-based only** — there is no OAuth or SSO integration.

The admin panel login (`POST /api/admin/login`) accepts a JSON body `{"password": "..."}`.
The password is compared against a bcrypt hash using `golang.org/x/crypto/bcrypt`.

### Setup steps

1. Generate a bcrypt hash for your chosen password:

   ```bash
   htpasswd -bnBC 10 "" your-admin-password | tr -d ':\n'
   # Outputs something like: $2y$10$...
   ```

2. Set `ADMIN_PASSWORD_HASH` in your environment to that hash value.

3. Do **not** set `ADMIN_PASSWORD` in production — or if you must, set it to a strong
   value. The `admin123` default must not be used in any live deployment.

On successful login the server issues an `admin_session` cookie and returns a CSRF
token that all subsequent mutation requests must include in the `X-CSRF-Token` header.

---

## 6. Google Drive Integration

The server can display a photo gallery sourced from a Google Drive folder. This uses
a **service account** (not OAuth user credentials).

### Setup

1. In Google Cloud Console, create a service account with **read-only** access to Drive.
2. Download the JSON key file for the service account.
3. Share the target Google Drive folder with the service account's email address
   (view-only permission is sufficient).
4. Base64-encode the key file:

   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```

5. Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the encoded string.

> **Note:** The Google Drive folder ID is currently hardcoded in
> `go-server/internal/service/googledrive.go` (`weddingFolderID`). When deploying
> for a new client, update this constant to point to their folder, or share the
> folder used during development. This is a known white-label customization point.

---

## 7. WhatsApp Invitation Sending

The platform can send personalised WhatsApp invitations using the
`go.mau.fi/whatsmeow` library. The integration is activated automatically when
`DATABASE_URL` is set and a live database connection is established; there are no
additional WhatsApp-specific environment variables.

> **WARNING:** The WhatsApp integration uses the reverse-engineered `go.mau.fi/whatsmeow` library. This violates WhatsApp's Terms of Service. Numbers used for bulk messaging risk being banned. You assume full responsibility for the status of any WhatsApp account used with this software.

### Pairing a phone number

1. Ensure the server is running with a live PostgreSQL connection.
2. In the admin panel, navigate to the WhatsApp section and choose **Groom** or
   **Bride** side.
3. Click **Connect** — the server generates a QR code (refreshed every 15 seconds
   automatically).
4. On the phone to be paired, open WhatsApp → Settings → Linked Devices →
   Link a Device, then scan the QR code.
5. On successful pairing the server persists the session JID in the `app_settings`
   table. The session survives server restarts without re-scanning.

Sessions are stored in whatsmeow-managed tables (`whatsmeow_*`) inside the same
PostgreSQL database. WhatsApp pairing does **not** work with the in-memory fallback
store (i.e. `DATABASE_URL` must be set).

---

## 8. Object Storage

### Supabase (recommended for production)

Set all three Supabase environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`SUPABASE_BUCKET_ID`). When all three are present the server uses Supabase Storage
for all file uploads.

Features that require signed upload URLs (direct guest photo uploads) are only
available with Supabase storage.

### Local filesystem (development fallback)

When any Supabase variable is missing in development, the server automatically
creates a `./storage` directory relative to the working directory and stores files
there. This fallback is not suitable for production because files are not replicated
or durably stored.

---

## 9. Docker (optional)

Development stack with hot-reload:

```bash
cd go-server
make docker-dev
```

This runs the Go app, PostgreSQL 14, and Redis via Docker Compose and applies
migrations automatically.

---

## 10. Development Workflow

Run both processes concurrently for local development:

```bash
# Terminal 1 — Go backend on :5000
cd go-server && make run-dev

# Terminal 2 — Vite frontend on :5173 (proxies /api, /storage, /auth to :5000)
npm run dev
```

Run tests (race detector enabled):

```bash
cd go-server && make test
```
