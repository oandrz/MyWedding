# Admin Logging System — Design

**Date:** 2026-05-28
**Status:** Approved (design); pending implementation plan

## Goal

Give the admin a way to debug **production issues** after the fact: log in, find the
relevant error or request, and see enough context (request ID, status, duration,
external API result, stack/error details) to understand what happened. Delivered as the
first tool under a new **Development** section in the admin navigation, leaving room to
add more debug tools later.

## Scope

**In scope (v1):**
- Persist logs to Postgres so the admin UI can query them.
- Capture: errors (WARN/ERROR), all HTTP requests, and external API calls
  (WhatsApp, Google Drive, Supabase).
- Admin log viewer: paginated table with filters, row expansion, request-trace view.
- 7-day retention, auto-purged in-process.
- New "Development" nav group containing a single "Logs" page.

**Out of scope (v1):**
- Live tail / websockets (manual refresh only).
- Audit-style "who did what" admin-action logging.
- Other dev tools (system info, env viewer, cache inspector) — nav is structured to add
  them later without redesign.
- External log services (Logtail/Axiom).

## Key decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Storage | Postgres table `app_logs` | One system, SQL-queryable, already in prod |
| Write path | Buffered custom `slog.Handler` (fan-out) | No per-request DB latency; reuses existing slog calls |
| Capture | Errors + all HTTP + external API calls | Matches "debug prod" use case |
| Retention | 7 days, in-process ticker | Low-traffic site; simplest for single instance |
| Viewer UX | Table + filters + row expansion | Familiar Sentry-lite pattern |
| Other dev tools | Logs only in v1 | Smallest shippable slice |

## 1. Data model & storage

Migration `go-server/migrations/014_add_app_logs.sql`:

```sql
CREATE TABLE app_logs (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    level       TEXT NOT NULL,            -- INFO | WARN | ERROR
    source      TEXT NOT NULL,            -- http | external | app
    message     TEXT NOT NULL,
    request_id  TEXT,                     -- correlates rows from one request
    method      TEXT,                     -- HTTP only
    path        TEXT,                     -- path only; query string stripped
    status      INT,                      -- HTTP only
    duration_ms INT,                      -- HTTP only
    attrs       JSONB                      -- remaining sanitized slog attrs
);

CREATE INDEX idx_app_logs_created_at ON app_logs (created_at DESC);
CREATE INDEX idx_app_logs_level_created_at ON app_logs (level, created_at DESC);
CREATE INDEX idx_app_logs_request_id ON app_logs (request_id);
```

**Models** (`internal/models/`): `AppLog` struct with `json:"camelCase"` tags
(`createdAt`, `requestId`, `durationMs`, etc.) and `LogQuery` for filter params.

**Security — PII/secret protection (mandatory):**
- Never store request headers, cookies, or query strings.
- Store the URL **path only** (`r.URL.Path`), never `r.URL.RawQuery`.
- The sink applies a denylist on attr keys, dropping any whose (lowercased) key
  contains: `cookie`, `authorization`, `token`, `password`, `csrf`, `secret`, `apikey`.
- Rationale: "all HTTP requests" otherwise risks persisting live `admin_session`
  cookies or tokens embedded in URLs.

## 2. Write path — buffered slog handler (Option A)

```
slog call → FanoutHandler ─┬→ existing stdout handler (text/json, unchanged)
                           └→ DBSink.Handle() → buffered channel → worker goroutine → batch INSERT
```

- **Location:** new package `internal/logsink/` (handler, worker, sanitization).
- **Wiring (`main.go`):** installed only when `dbPool != nil`. Wrap the existing
  stdout handler so `slog.SetDefault` uses the fan-out. When there is no Postgres
  (dev/in-memory), the sink is **not installed** — logging behaves exactly as today.
- **Worker:** drains the channel, batch-inserts up to ~100 rows or flushes every 1s.
  On graceful shutdown, drains remaining buffered entries before the pool closes.
- **Backpressure:** buffered channel (size ~1000). If full, **drop the newest entry and
  increment an atomic dropped-counter** — never block a request. Counter is exposed via
  the logs API so the UI can warn when entries were lost.
- **Recursion guard (mandatory):** the sink's own failures (insert errors, marshal
  errors) write to **stderr directly**, never via slog — otherwise an insert error would
  re-enter the channel and loop.

**What gets captured:**
- **HTTP** (`source=http`): promote `middleware/logging.go` from `slog.Debug` →
  `slog.Info`; include `request_id`, `method`, path, `status`, `duration_ms`.
  **Exclude `/api/health` and `/storage/*`** so health checks and static assets don't
  flood the table. Note: promoting to INFO means these lines now also appear on stdout in
  prod (previously suppressed at Debug) — intended.
- **Errors** (`source=app`): existing `slog.Error` / `slog.Warn` calls across
  handlers/services flow in automatically — no new API.
- **External API calls** (`source=external`): keep the existing explicit-slog pattern at
  call sites in `service/whatsapp.go`, `googledrive.go`, `storage_supabase.go`.
  Standardize attr keys (`source=external`, `service=<name>`, plus latency/error) rather
  than introducing an HTTP-client wrapper.

## 3. API endpoints & retention

New `LogHandler` (`internal/handler/log.go`), mounted under the existing admin group
(auth + CSRF already applied in `router.go`):

- `GET /api/admin/logs` — paginated query.
  - Params: `level`, `source`, `requestId`, `q` (text search on message/path),
    `before`, `after` (time range), `limit` (default 50, cap 200), `cursor`
    (keyset on `id`).
  - Returns `{ logs: [...], nextCursor, droppedCount }`.
- `GET /api/admin/logs/{requestId}` — all rows for one request ID (trace view).

**Repository interface additions:**
- `InsertLogs(ctx, []models.AppLog) error` — batch insert used by the worker.
- `QueryLogs(ctx, models.LogQuery) ([]models.AppLog, error)`
- `DeleteLogsOlderThan(ctx, time.Time) (int64, error)`

Postgres impl is real; memory impl no-ops / returns empty (dev has no sink).

**Retention (7 days):** in-process `time.Ticker` goroutine started in `main.go` (only
when `dbPool != nil`). Runs `DeleteLogsOlderThan(now-7d)` once on boot and every 6h. No
external cron. Window is a single constant if it ever needs tuning.

**Volume note:** low-traffic wedding site; with health/static excluded, 7 days stays well
under any table-size concern.

## 4. Frontend — Development nav & log viewer

**Navigation (`AdminLayout.tsx`):** add a second sidebar block under a small
"Development" label, separated from the wedding-management items, with one item:
- `{ path: "/dev/logs", label: "Logs", icon: ScrollText }`
- Route: `<Route path="/dev/logs" component={LogsPage} />`

**`LogsPage.tsx`** (follows existing admin page patterns: React Query, fetch with
`credentials: "include"`, `handleAutoLogout` on 401/403):
- **Filter bar:** level (All/INFO/WARN/ERROR), source (All/http/external/app), text
  search, time range (1h / 24h / 7d), refresh button.
- **Table:** time, level (color-coded badge), source, status (http), message (truncated).
  Row click expands to full detail: method, path, duration, request ID, pretty-printed
  `attrs` JSON. Request ID is a link that filters to that request's trace
  (`/logs/{requestId}`).
- **Pagination:** "Load more" via keyset cursor.
- **Dropped-logs banner:** shown when `droppedCount > 0`.
- **Empty state:** "No logs captured" (dev with no sink, or no matching rows).
- No live tail in v1.

## 5. Testing

**Backend** (in-memory repo, table-driven, `-race`):
- `LogSink`: fan-out preserves stdout output; channel-full drops newest + increments
  counter; recursion guard (insert failure does not re-enter channel); graceful drain on
  shutdown.
- Sanitization: denylist keys stripped; query string removed from path.
- Middleware: `/api/health` and `/storage/*` excluded; normal requests captured with
  request ID.
- Handler: `GET /api/admin/logs` filtering (level/source/q/time/cursor);
  `GET /api/admin/logs/{requestId}` grouping; auth/CSRF enforced.
- Contract test: camelCase response fields (`nextCursor`, `droppedCount`, `requestId`).

**Frontend:** `LogsPage` test (mirrors `AdminLayout.test.tsx`) — renders rows, applies a
filter, expands a row, shows dropped banner and empty state.

## 6. Build sequence (TDD per step)

1. Migration `014_add_app_logs.sql` + `models.AppLog` / `models.LogQuery`.
2. Repository interface methods + memory (no-op) + postgres impls.
3. `logsink` fan-out handler + worker + sanitization (tests first).
4. Wire sink + retention ticker into `main.go`; promote HTTP middleware to INFO with
   `/api/health` + `/storage/*` exclusions.
5. Standardize `source=external` attrs at WhatsApp / Drive / Supabase call sites.
6. `LogHandler` + routes (tests first).
7. Frontend: Development nav group + `LogsPage` + tests.
8. Verification: `make test`, `make lint`, `npm run check`, manual browser check.
