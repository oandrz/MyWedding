# Admin Logging System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist errors, HTTP requests, and external API calls to a Postgres `app_logs` table via a buffered slog fan-out handler, and surface them in a new admin **Development > Logs** viewer with filtering, request tracing, and 7-day retention.

**Architecture:** A custom `slog.Handler` fans out every log record to both the existing stdout handler (unchanged) and a new DB sink. The DB sink sanitizes records, pushes them to a buffered channel, and a worker goroutine batch-inserts to Postgres. The sink is only installed when Postgres is available; otherwise logging is unchanged. A new admin handler queries the table, and a React page renders a filterable table. An in-process ticker purges rows older than 7 days.

**Tech Stack:** Go 1.x (`log/slog`, Chi router, pgx/pgxpool), React 18 + TypeScript + Vite + TanStack React Query + Wouter + Shadcn UI.

Spec: `docs/superpowers/specs/2026-05-28-admin-logging-system-design.md`

**Conventions to follow throughout:**
- Go module path prefix: `github.com/andreasronaldo/wedding-server`
- All model JSON tags are camelCase (contract tests enforce this).
- Table-driven tests with `-race`; run via `cd go-server && go test ./... -race -count=1`.
- Tests use the in-memory repository — no DB required.
- Admin mutations need auth + CSRF; the logs routes are GET-only but still live inside the authed admin group.

---

## Task 1: Migration + models

**Files:**
- Create: `go-server/migrations/014_add_app_logs.sql`
- Create: `go-server/internal/models/app_log.go`

- [ ] **Step 1: Write the migration**

Create `go-server/migrations/014_add_app_logs.sql`:

```sql
CREATE TABLE IF NOT EXISTS app_logs (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    level       TEXT NOT NULL,
    source      TEXT NOT NULL,
    message     TEXT NOT NULL,
    request_id  TEXT,
    method      TEXT,
    path        TEXT,
    status      INT,
    duration_ms INT,
    attrs       JSONB
);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level_created_at ON app_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_request_id ON app_logs (request_id);
```

- [ ] **Step 2: Write the models**

Create `go-server/internal/models/app_log.go`:

```go
package models

import "time"

// AppLog is a single persisted log record.
type AppLog struct {
	ID         int64             `json:"id"`
	CreatedAt  string            `json:"createdAt"`
	Level      string            `json:"level"`
	Source     string            `json:"source"`
	Message    string            `json:"message"`
	RequestID  string            `json:"requestId,omitempty"`
	Method     string            `json:"method,omitempty"`
	Path       string            `json:"path,omitempty"`
	Status     int               `json:"status,omitempty"`
	DurationMs int               `json:"durationMs,omitempty"`
	Attrs      map[string]any    `json:"attrs,omitempty"`
}

// LogQuery holds filter parameters for querying logs.
type LogQuery struct {
	Level     string
	Source    string
	RequestID string
	Search    string
	Before    *time.Time
	After     *time.Time
	Limit     int
	Cursor    int64 // keyset on id; 0 means no cursor
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd go-server && go build ./...`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```bash
git add go-server/migrations/014_add_app_logs.sql go-server/internal/models/app_log.go
git commit -m "feat(logs): add app_logs migration and models"
```

---

## Task 2: Repository interface + memory impl (no-op) + postgres impl

**Files:**
- Modify: `go-server/internal/repository/repository.go` (add 3 methods to the interface)
- Modify: `go-server/internal/repository/memory.go` (no-op impls)
- Modify: `go-server/internal/repository/postgres.go` (real impls)
- Test: `go-server/internal/repository/app_log_test.go`

- [ ] **Step 1: Add methods to the Repository interface**

In `go-server/internal/repository/repository.go`, add to the `Repository` interface (place near the end, before the closing brace). The file currently imports only `context` and `models` — add `"time"` to the import block:

```go
	// App Logs
	InsertLogs(ctx context.Context, logs []models.AppLog) error
	QueryLogs(ctx context.Context, q models.LogQuery) ([]models.AppLog, error)
	DeleteLogsOlderThan(ctx context.Context, cutoff time.Time) (int64, error)
```

- [ ] **Step 2: Write the failing test (memory no-op behavior)**

Create `go-server/internal/repository/app_log_test.go`:

```go
package repository

import (
	"context"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

func TestMemoryRepository_AppLogs_NoOp(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	if err := repo.InsertLogs(ctx, []models.AppLog{{Level: "INFO", Source: "app", Message: "hi"}}); err != nil {
		t.Fatalf("InsertLogs returned error: %v", err)
	}

	logs, err := repo.QueryLogs(ctx, models.LogQuery{Limit: 50})
	if err != nil {
		t.Fatalf("QueryLogs returned error: %v", err)
	}
	if len(logs) != 0 {
		t.Fatalf("expected memory repo to return 0 logs, got %d", len(logs))
	}

	n, err := repo.DeleteLogsOlderThan(ctx, time.Now())
	if err != nil {
		t.Fatalf("DeleteLogsOlderThan returned error: %v", err)
	}
	if n != 0 {
		t.Fatalf("expected 0 deleted, got %d", n)
	}
}
```

- [ ] **Step 2b: Run the test to verify it fails**

Run: `cd go-server && go test ./internal/repository -run TestMemoryRepository_AppLogs_NoOp -v`
Expected: FAIL — compile error, `InsertLogs` not implemented on `*MemoryRepository`.

- [ ] **Step 3: Implement memory no-ops**

Add to `go-server/internal/repository/memory.go` (add `"time"` to imports if not already there — it is):

```go
// ---------------------------------------------------------------------------
// App Logs (no-op: dev/in-memory has no log sink installed)
// ---------------------------------------------------------------------------

func (r *MemoryRepository) InsertLogs(ctx context.Context, logs []models.AppLog) error {
	return nil
}

func (r *MemoryRepository) QueryLogs(ctx context.Context, q models.LogQuery) ([]models.AppLog, error) {
	return []models.AppLog{}, nil
}

func (r *MemoryRepository) DeleteLogsOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	return 0, nil
}
```

- [ ] **Step 4: Implement postgres methods**

Add to `go-server/internal/repository/postgres.go` (uses `time`, `fmt`, `strings` — add `"strings"` to imports if not present). The query builder uses positional args:

```go
// ---------------------------------------------------------------------------
// App Logs
// ---------------------------------------------------------------------------

func (r *PostgresRepository) InsertLogs(ctx context.Context, logs []models.AppLog) error {
	if len(logs) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, l := range logs {
		batch.Queue(
			`INSERT INTO app_logs (level, source, message, request_id, method, path, status, duration_ms, attrs)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
			l.Level, l.Source, l.Message, nullStr(l.RequestID), nullStr(l.Method),
			nullStr(l.Path), nullInt(l.Status), nullInt(l.DurationMs), l.Attrs,
		)
	}
	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()
	for range logs {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func (r *PostgresRepository) QueryLogs(ctx context.Context, q models.LogQuery) ([]models.AppLog, error) {
	var conds []string
	var args []any
	i := 1
	add := func(cond string, val any) {
		conds = append(conds, fmt.Sprintf(cond, i))
		args = append(args, val)
		i++
	}
	if q.Level != "" {
		add("level = $%d", q.Level)
	}
	if q.Source != "" {
		add("source = $%d", q.Source)
	}
	if q.RequestID != "" {
		add("request_id = $%d", q.RequestID)
	}
	if q.Search != "" {
		// Two placeholders bound to the same value — not expressible via add().
		conds = append(conds, fmt.Sprintf("(message ILIKE $%d OR path ILIKE $%d)", i, i+1))
		args = append(args, "%"+q.Search+"%", "%"+q.Search+"%")
		i += 2
	}
	if q.Before != nil {
		add("created_at < $%d", *q.Before)
	}
	if q.After != nil {
		add("created_at > $%d", *q.After)
	}
	if q.Cursor > 0 {
		add("id < $%d", q.Cursor)
	}

	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}
	limit := q.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	sql := fmt.Sprintf(
		`SELECT id, created_at, level, source, message, request_id, method, path, status, duration_ms, attrs
		 FROM app_logs %s ORDER BY id DESC LIMIT %d`, where, limit)

	rows, err := r.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.AppLog, 0)
	for rows.Next() {
		var l models.AppLog
		var createdAt time.Time
		var reqID, method, path *string
		var status, durationMs *int
		if err := rows.Scan(&l.ID, &createdAt, &l.Level, &l.Source, &l.Message,
			&reqID, &method, &path, &status, &durationMs, &l.Attrs); err != nil {
			return nil, err
		}
		l.CreatedAt = createdAt.Format(time.RFC3339)
		if reqID != nil {
			l.RequestID = *reqID
		}
		if method != nil {
			l.Method = *method
		}
		if path != nil {
			l.Path = *path
		}
		if status != nil {
			l.Status = *status
		}
		if durationMs != nil {
			l.DurationMs = *durationMs
		}
		result = append(result, l)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) DeleteLogsOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM app_logs WHERE created_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// nullStr returns nil for empty strings so NULL is stored instead of "".
func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// nullInt returns nil for zero ints so NULL is stored instead of 0.
func nullInt(n int) any {
	if n == 0 {
		return nil
	}
	return n
}
```

Note: `pgx` is already imported in `postgres.go` (as `github.com/jackc/pgx/v5`). If `nullStr`/`nullInt` names already exist in the file, reuse them instead of redefining.

- [ ] **Step 5: Run the memory test to verify it passes**

Run: `cd go-server && go test ./internal/repository -run TestMemoryRepository_AppLogs_NoOp -v`
Expected: PASS.

- [ ] **Step 6: Verify full build + lint**

Run: `cd go-server && go build ./... && make lint`
Expected: no errors. Fix any unused-import or naming collisions.

- [ ] **Step 7: Commit**

```bash
git add go-server/internal/repository/
git commit -m "feat(logs): add InsertLogs/QueryLogs/DeleteLogsOlderThan to repository"
```

---

## Task 3: logsink package — sanitization

**Files:**
- Create: `go-server/internal/logsink/sanitize.go`
- Test: `go-server/internal/logsink/sanitize_test.go`

- [ ] **Step 1: Write the failing test**

Create `go-server/internal/logsink/sanitize_test.go`:

```go
package logsink

import "testing"

func TestSanitizeAttrs_DropsSecrets(t *testing.T) {
	in := map[string]any{
		"service":       "whatsapp",
		"Authorization": "Bearer xyz",
		"cookie":        "admin_session=abc",
		"csrfToken":     "t",
		"password":      "p",
		"apiKey":        "k",
		"latencyMs":     42,
	}
	out := SanitizeAttrs(in)

	for _, banned := range []string{"Authorization", "cookie", "csrfToken", "password", "apiKey"} {
		if _, ok := out[banned]; ok {
			t.Errorf("expected key %q to be dropped", banned)
		}
	}
	if out["service"] != "whatsapp" {
		t.Errorf("expected safe key 'service' to be preserved")
	}
	if out["latencyMs"] != 42 {
		t.Errorf("expected safe key 'latencyMs' to be preserved")
	}
}

func TestSanitizePath_StripsQuery(t *testing.T) {
	if got := SanitizePath("/api/rsvp?token=secret"); got != "/api/rsvp" {
		t.Errorf("expected query stripped, got %q", got)
	}
	if got := SanitizePath("/api/rsvp"); got != "/api/rsvp" {
		t.Errorf("expected unchanged, got %q", got)
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-server && go test ./internal/logsink -run TestSanitize -v`
Expected: FAIL — package/functions do not exist.

- [ ] **Step 3: Implement sanitization**

Create `go-server/internal/logsink/sanitize.go`:

```go
package logsink

import "strings"

// deniedSubstrings are matched (case-insensitive) against attr keys; any match is dropped.
var deniedSubstrings = []string{
	"cookie", "authorization", "token", "password", "csrf", "secret", "apikey",
}

// SanitizeAttrs returns a copy of attrs with sensitive keys removed.
func SanitizeAttrs(attrs map[string]any) map[string]any {
	if len(attrs) == 0 {
		return nil
	}
	out := make(map[string]any, len(attrs))
	for k, v := range attrs {
		lk := strings.ToLower(k)
		denied := false
		for _, sub := range deniedSubstrings {
			if strings.Contains(lk, sub) {
				denied = true
				break
			}
		}
		if !denied {
			out[k] = v
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// SanitizePath strips the query string, leaving only the URL path.
func SanitizePath(p string) string {
	if i := strings.IndexByte(p, '?'); i >= 0 {
		return p[:i]
	}
	return p
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-server && go test ./internal/logsink -run TestSanitize -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/logsink/sanitize.go go-server/internal/logsink/sanitize_test.go
git commit -m "feat(logs): add attr/path sanitization for log sink"
```

---

## Task 4: logsink package — DB sink (channel + worker + backpressure)

**Files:**
- Create: `go-server/internal/logsink/sink.go`
- Test: `go-server/internal/logsink/sink_test.go`

The sink implements `slog.Handler`. It records into a buffered channel; a worker batch-inserts. On a full channel it drops the newest entry and increments an atomic counter. Its own errors go to stderr (recursion guard).

- [ ] **Step 1: Write the failing test**

Create `go-server/internal/logsink/sink_test.go`:

```go
package logsink

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

// fakeInserter captures inserted logs.
type fakeInserter struct {
	mu   sync.Mutex
	logs []models.AppLog
}

func (f *fakeInserter) InsertLogs(ctx context.Context, logs []models.AppLog) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.logs = append(f.logs, logs...)
	return nil
}

func (f *fakeInserter) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.logs)
}

func TestSink_BatchInsertsRecords(t *testing.T) {
	f := &fakeInserter{}
	s := New(f, Options{BufferSize: 100, BatchSize: 10, FlushInterval: 20 * time.Millisecond})
	s.Start()
	defer s.Stop(context.Background())

	for i := 0; i < 5; i++ {
		s.enqueue(models.AppLog{Level: "INFO", Source: "app", Message: "hi"})
	}

	deadline := time.Now().Add(time.Second)
	for f.count() < 5 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if f.count() != 5 {
		t.Fatalf("expected 5 inserted, got %d", f.count())
	}
}

func TestSink_DropsWhenFull(t *testing.T) {
	f := &fakeInserter{}
	// Buffer of 1, worker not started → channel fills immediately.
	s := New(f, Options{BufferSize: 1, BatchSize: 10, FlushInterval: time.Second})

	for i := 0; i < 10; i++ {
		s.enqueue(models.AppLog{Level: "INFO", Source: "app", Message: "x"})
	}
	if s.Dropped() == 0 {
		t.Fatalf("expected some dropped entries, got 0")
	}
}

func TestSink_WithAttrs_CarriesAttrs(t *testing.T) {
	f := &fakeInserter{}
	s := New(f, Options{BufferSize: 100, BatchSize: 10, FlushInterval: 20 * time.Millisecond})
	s.Start()
	defer s.Stop(context.Background())

	logger := slog.New(s).With("source", "external", "service", "whatsapp")
	logger.Info("sent")

	deadline := time.Now().Add(time.Second)
	for f.count() == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.logs) == 0 {
		t.Fatal("expected a record")
	}
	got := f.logs[0]
	if got.Source != "external" {
		t.Errorf("expected source from WithAttrs to be 'external', got %q", got.Source)
	}
	if got.Attrs["service"] != "whatsapp" {
		t.Errorf("expected service attr 'whatsapp', got %v", got.Attrs["service"])
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-server && go test ./internal/logsink -run TestSink -v`
Expected: FAIL — `New`, `Options`, `enqueue`, `Start`, `Stop`, `Dropped` not defined.

- [ ] **Step 3: Implement the sink**

Create `go-server/internal/logsink/sink.go`:

```go
package logsink

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

// Inserter is the subset of the repository the sink needs.
type Inserter interface {
	InsertLogs(ctx context.Context, logs []models.AppLog) error
}

// Options configures the sink worker.
type Options struct {
	BufferSize    int
	BatchSize     int
	FlushInterval time.Duration
}

// Sink is a slog.Handler that persists records to the DB via a background worker.
// The worker-owning fields are shared via pointers so that handlers derived through
// WithAttrs/WithGroup feed the same channel while carrying their own accumulated attrs.
type Sink struct {
	inserter Inserter
	opts     Options
	ch       chan models.AppLog
	dropped  *atomic.Int64
	done     chan struct{}
	wg       *sync.WaitGroup
	preAttrs []slog.Attr // attrs accumulated via WithAttrs
}

// New creates a sink. Call Start to launch the worker.
func New(inserter Inserter, opts Options) *Sink {
	if opts.BufferSize <= 0 {
		opts.BufferSize = 1000
	}
	if opts.BatchSize <= 0 {
		opts.BatchSize = 100
	}
	if opts.FlushInterval <= 0 {
		opts.FlushInterval = time.Second
	}
	return &Sink{
		inserter: inserter,
		opts:     opts,
		ch:       make(chan models.AppLog, opts.BufferSize),
		dropped:  &atomic.Int64{},
		done:     make(chan struct{}),
		wg:       &sync.WaitGroup{},
	}
}

// enqueue adds a record without blocking; drops the newest on a full channel.
func (s *Sink) enqueue(l models.AppLog) {
	select {
	case s.ch <- l:
	default:
		s.dropped.Add(1)
	}
}

// Dropped returns the number of records dropped due to backpressure.
func (s *Sink) Dropped() int64 { return s.dropped.Load() }

// Start launches the worker goroutine.
func (s *Sink) Start() {
	s.wg.Add(1)
	go s.run()
}

func (s *Sink) run() {
	defer s.wg.Done()
	ticker := time.NewTicker(s.opts.FlushInterval)
	defer ticker.Stop()

	batch := make([]models.AppLog, 0, s.opts.BatchSize)
	flush := func() {
		if len(batch) == 0 {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		if err := s.inserter.InsertLogs(ctx, batch); err != nil {
			// Recursion guard: never log via slog here; write to stderr directly.
			fmt.Fprintf(os.Stderr, "logsink: insert failed: %v\n", err)
		}
		cancel()
		batch = batch[:0]
	}

	for {
		select {
		case <-s.done:
			// Drain remaining records.
			for {
				select {
				case l := <-s.ch:
					batch = append(batch, l)
					if len(batch) >= s.opts.BatchSize {
						flush()
					}
				default:
					flush()
					return
				}
			}
		case l := <-s.ch:
			batch = append(batch, l)
			if len(batch) >= s.opts.BatchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

// Stop signals the worker to drain and waits for it (bounded by ctx).
func (s *Sink) Stop(ctx context.Context) {
	close(s.done)
	finished := make(chan struct{})
	go func() { s.wg.Wait(); close(finished) }()
	select {
	case <-finished:
	case <-ctx.Done():
	}
}

// Enabled implements slog.Handler: capture INFO and above.
func (s *Sink) Enabled(_ context.Context, level slog.Level) bool {
	return level >= slog.LevelInfo
}

// Handle implements slog.Handler: convert the record to an AppLog and enqueue it.
func (s *Sink) Handle(_ context.Context, r slog.Record) error {
	l := models.AppLog{
		Level:   r.Level.String(),
		Message: r.Message,
		Source:  "app",
	}
	attrs := make(map[string]any)
	apply := func(a slog.Attr) {
		switch a.Key {
		case "source":
			l.Source = a.Value.String()
		case "requestId":
			l.RequestID = a.Value.String()
		case "method":
			l.Method = a.Value.String()
		case "path":
			l.Path = SanitizePath(a.Value.String())
		case "status":
			l.Status = int(a.Value.Int64())
		case "durationMs":
			l.DurationMs = int(a.Value.Int64())
		default:
			attrs[a.Key] = a.Value.Any()
		}
	}
	// Attrs accumulated via WithAttrs come first; record attrs may override them.
	for _, a := range s.preAttrs {
		apply(a)
	}
	r.Attrs(func(a slog.Attr) bool {
		apply(a)
		return true
	})
	l.Attrs = SanitizeAttrs(attrs)
	s.enqueue(l)
	return nil
}

// clone returns a shallow copy that shares the worker-owning fields (channel, counter,
// done, waitgroup) but carries its own preAttrs slice.
func (s *Sink) clone() *Sink {
	c := *s
	return &c
}

// WithAttrs implements slog.Handler, accumulating attrs onto a derived sink that feeds
// the same worker channel.
func (s *Sink) WithAttrs(attrs []slog.Attr) slog.Handler {
	if len(attrs) == 0 {
		return s
	}
	c := s.clone()
	c.preAttrs = append(append([]slog.Attr{}, s.preAttrs...), attrs...)
	return c
}

// WithGroup implements slog.Handler. Grouping is not modeled in the flat app_logs table,
// so the derived sink shares the same worker and attrs.
func (s *Sink) WithGroup(_ string) slog.Handler { return s }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-server && go test ./internal/logsink -run TestSink -v -race`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/logsink/sink.go go-server/internal/logsink/sink_test.go
git commit -m "feat(logs): add buffered DB log sink with backpressure"
```

---

## Task 5: logsink package — fan-out handler

**Files:**
- Create: `go-server/internal/logsink/fanout.go`
- Test: `go-server/internal/logsink/fanout_test.go`

The fan-out forwards each record to both the stdout handler (unchanged behavior) and the sink.

- [ ] **Step 1: Write the failing test**

Create `go-server/internal/logsink/fanout_test.go`:

```go
package logsink

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
)

func TestFanout_WritesToBothHandlers(t *testing.T) {
	var buf bytes.Buffer
	stdout := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelInfo})

	f := &fakeInserter{}
	sink := New(f, Options{BufferSize: 10})
	sink.Start()
	defer sink.Stop(context.Background())

	fan := NewFanout(stdout, sink)
	logger := slog.New(fan)
	logger.Info("hello", "source", "app")

	if !strings.Contains(buf.String(), "hello") {
		t.Errorf("expected stdout handler to receive record, got %q", buf.String())
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-server && go test ./internal/logsink -run TestFanout -v`
Expected: FAIL — `NewFanout` not defined.

- [ ] **Step 3: Implement the fan-out**

Create `go-server/internal/logsink/fanout.go`:

```go
package logsink

import (
	"context"
	"log/slog"
)

// Fanout forwards records to multiple handlers.
type Fanout struct {
	handlers []slog.Handler
}

// NewFanout creates a fan-out over the given handlers.
func NewFanout(handlers ...slog.Handler) *Fanout {
	return &Fanout{handlers: handlers}
}

func (f *Fanout) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range f.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (f *Fanout) Handle(ctx context.Context, r slog.Record) error {
	for _, h := range f.handlers {
		if h.Enabled(ctx, r.Level) {
			_ = h.Handle(ctx, r.Clone())
		}
	}
	return nil
}

func (f *Fanout) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := make([]slog.Handler, len(f.handlers))
	for i, h := range f.handlers {
		next[i] = h.WithAttrs(attrs)
	}
	return &Fanout{handlers: next}
}

func (f *Fanout) WithGroup(name string) slog.Handler {
	next := make([]slog.Handler, len(f.handlers))
	for i, h := range f.handlers {
		next[i] = h.WithGroup(name)
	}
	return &Fanout{handlers: next}
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-server && go test ./internal/logsink -run TestFanout -v -race`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/internal/logsink/fanout.go go-server/internal/logsink/fanout_test.go
git commit -m "feat(logs): add fan-out slog handler"
```

---

## Task 6: HTTP middleware — promote to INFO, add request ID, exclude noise

**Files:**
- Modify: `go-server/internal/middleware/logging.go`
- Test: `go-server/internal/middleware/logging_test.go`

- [ ] **Step 1: Write the failing test**

Create `go-server/internal/middleware/logging_test.go`:

```go
package middleware

import "testing"

func TestShouldSkipLogging(t *testing.T) {
	cases := []struct {
		path string
		skip bool
	}{
		{"/api/health", true},
		{"/storage/photo.jpg", true},
		{"/storage/", true},
		{"/api/rsvp", false},
		{"/api/admin/logs", false},
	}
	for _, c := range cases {
		if got := shouldSkipLogging(c.path); got != c.skip {
			t.Errorf("shouldSkipLogging(%q) = %v, want %v", c.path, got, c.skip)
		}
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-server && go test ./internal/middleware -run TestShouldSkipLogging -v`
Expected: FAIL — `shouldSkipLogging` not defined.

- [ ] **Step 3: Update the middleware**

Replace the contents of `go-server/internal/middleware/logging.go` with:

```go
package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// shouldSkipLogging excludes health checks and static asset serving from log capture.
func shouldSkipLogging(path string) bool {
	if path == "/api/health" {
		return true
	}
	if strings.HasPrefix(path, "/storage/") {
		return true
	}
	return false
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		if shouldSkipLogging(r.URL.Path) {
			return
		}

		reqID := chimw.GetReqID(r.Context())
		slog.Info("HTTP request",
			"source", "http",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"durationMs", time.Since(start).Milliseconds(),
			"requestId", reqID,
		)
	})
}
```

Note: this changes the attr keys (`duration` → `durationMs`, adds `source`) and the level (`Debug` → `Info`). The sink's `Handle` (Task 4) reads exactly these keys.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-server && go test ./internal/middleware -run TestShouldSkipLogging -v`
Expected: PASS.

- [ ] **Step 5: Run the full middleware suite to check for regressions**

Run: `cd go-server && go test ./internal/middleware -v -race`
Expected: PASS (no existing test asserts on the old Debug log text; if one does, update it).

- [ ] **Step 6: Commit**

```bash
git add go-server/internal/middleware/logging.go go-server/internal/middleware/logging_test.go
git commit -m "feat(logs): capture HTTP requests at INFO, exclude health/static"
```

---

## Task 7: Standardize external API call logging

**Files:**
- Modify: `go-server/internal/service/whatsapp.go`
- Modify: `go-server/internal/service/googledrive.go`
- Modify: `go-server/internal/service/storage_supabase.go`

Goal: ensure outbound-call log lines carry `"source", "external"` and a `"service"` attr so they land in the table tagged correctly. This is additive — find existing `slog.Info/Warn/Error` calls around outbound HTTP/API calls and add the two attrs; add a log line where a meaningful external call has none.

- [ ] **Step 1: Inventory existing external-call log sites**

Run: `cd go-server && grep -n "slog\." internal/service/whatsapp.go internal/service/googledrive.go internal/service/storage_supabase.go`
Note each line that wraps an outbound call (send message, Drive API call, Supabase upload/delete).

- [ ] **Step 2: Add standardized attrs**

For each external-call log site found, ensure the call includes `"source", "external"` and `"service", "<name>"` where name is `whatsapp`, `googledrive`, or `supabase`. Example transformation in `storage_supabase.go` — a successful upload:

```go
slog.Info("Supabase upload complete",
	"source", "external",
	"service", "supabase",
	"path", objectPath,
	"status", resp.StatusCode,
)
```

And an error path:

```go
slog.Error("Supabase upload failed",
	"source", "external",
	"service", "supabase",
	"path", objectPath,
	"error", err,
)
```

Apply the equivalent in `whatsapp.go` (`service=whatsapp`, log send success/failure) and `googledrive.go` (`service=googledrive`, log API call success/failure). Do not log request bodies, tokens, or auth headers (the sink also strips them, but keep call sites clean).

- [ ] **Step 3: Verify build + existing service tests**

Run: `cd go-server && go build ./... && go test ./internal/service -race -count=1`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add go-server/internal/service/whatsapp.go go-server/internal/service/googledrive.go go-server/internal/service/storage_supabase.go
git commit -m "feat(logs): tag external API call logs with source/service attrs"
```

---

## Task 8: Wire sink + retention into main.go

**Files:**
- Modify: `go-server/cmd/server/main.go`

- [ ] **Step 1: Install the fan-out sink when Postgres is available**

In `go-server/cmd/server/main.go`, after the `dbPool`/`repo` selection block (around line 41-59) where `dbPool` is known, and after the existing `slog.SetDefault` block (lines 26-32) — restructure so the sink wraps the stdout handler only when `dbPool != nil`. Add import `"github.com/andreasronaldo/wedding-server/internal/logsink"`.

Replace the logging setup (lines 25-32) to first build the stdout handler into a variable, then later (after `dbPool` is determined) optionally wrap it. Concretely:

a) Keep building `logHandler` (the stdout handler) as today, but do NOT call `slog.SetDefault` yet — move that down.

b) After the repository/dbPool block completes, add:

```go
	// Persist logs to Postgres when available (production / DB-backed dev).
	var sink *logsink.Sink
	if dbPool != nil {
		sink = logsink.New(repo, logsink.Options{})
		sink.Start()
		slog.SetDefault(slog.New(logsink.NewFanout(logHandler, sink)))
		slog.Info("Log persistence enabled (app_logs)")
	} else {
		slog.SetDefault(slog.New(logHandler))
	}
```

Important: any `slog` calls that currently happen *between* old line 32 and this new block (the DB/Redis selection logs) will only reach stdout, not the table — that's acceptable (they run before the sink exists). Ensure exactly one `slog.SetDefault` call remains.

- [ ] **Step 2: Start the retention ticker**

After the sink block, add a 7-day retention loop (only when `dbPool != nil`):

```go
	// Retention: purge logs older than 7 days, on boot and every 6h.
	if dbPool != nil {
		go func() {
			purge := func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				cutoff := time.Now().Add(-7 * 24 * time.Hour)
				if n, err := repo.DeleteLogsOlderThan(ctx, cutoff); err != nil {
					slog.Warn("Log retention purge failed", "error", err)
				} else if n > 0 {
					slog.Info("Log retention purge", "deleted", n)
				}
			}
			purge()
			ticker := time.NewTicker(6 * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				purge()
			}
		}()
	}
```

- [ ] **Step 3: Drain the sink on graceful shutdown**

In the shutdown section (after `srv.Shutdown`, before `dbPool.Close()`), add:

```go
	if sink != nil {
		drainCtx, drainCancel := context.WithTimeout(context.Background(), 5*time.Second)
		sink.Stop(drainCtx)
		drainCancel()
		slog.Info("Log sink drained")
	}
```

Place this BEFORE `dbPool.Close()` so the final batch can still write.

- [ ] **Step 4: Verify build**

Run: `cd go-server && go build ./... && make lint`
Expected: no errors.

- [ ] **Step 5: Smoke test with in-memory mode (no DB)**

Run: `cd go-server && GO_ENV=development go run ./cmd/server` for a few seconds, confirm it starts and logs to stdout as before (no sink), then Ctrl-C.
Expected: starts cleanly, "using in-memory repository" path, no panics.

- [ ] **Step 6: Commit**

```bash
git add go-server/cmd/server/main.go
git commit -m "feat(logs): wire log sink and 7-day retention into server"
```

---

## Task 9: Log query handler + routes

**Files:**
- Create: `go-server/internal/handler/log.go`
- Modify: `go-server/internal/router/router.go`
- Test: `go-server/internal/handler/log_test.go`

The handler needs the dropped-counter. Expose it from the sink via a small interface passed to the handler.

- [ ] **Step 1: Write the failing test**

Create `go-server/internal/handler/log_test.go`:

```go
package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/repository"
)

func TestLogHandler_List_ReturnsShape(t *testing.T) {
	repo := repository.NewMemoryRepository()
	h := &LogHandler{Repo: repo, Dropped: func() int64 { return 3 }}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/logs?level=ERROR&limit=10", nil)
	rr := httptest.NewRecorder()
	h.List(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var body struct {
		Logs         []any  `json:"logs"`
		NextCursor   *int64 `json:"nextCursor"`
		DroppedCount int64  `json:"droppedCount"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.DroppedCount != 3 {
		t.Errorf("expected droppedCount 3, got %d", body.DroppedCount)
	}
	if body.Logs == nil {
		t.Errorf("expected logs array, got nil")
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run TestLogHandler_List_ReturnsShape -v`
Expected: FAIL — `LogHandler` not defined.

- [ ] **Step 3: Implement the handler**

Create `go-server/internal/handler/log.go`:

```go
package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/go-chi/chi/v5"
)

// LogHandler serves the admin log viewer endpoints.
type LogHandler struct {
	Repo    repository.Repository
	Dropped func() int64 // returns count of dropped log entries; may be nil
}

func (h *LogHandler) droppedCount() int64 {
	if h.Dropped == nil {
		return 0
	}
	return h.Dropped()
}

// List handles GET /api/admin/logs.
func (h *LogHandler) List(w http.ResponseWriter, r *http.Request) {
	q := parseLogQuery(r)
	logs, err := h.Repo.QueryLogs(r.Context(), q)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to query logs")
		return
	}

	var nextCursor *int64
	if len(logs) == q.Limit && len(logs) > 0 {
		c := logs[len(logs)-1].ID
		nextCursor = &c
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs":         logs,
		"nextCursor":   nextCursor,
		"droppedCount": h.droppedCount(),
	})
}

// ByRequestID handles GET /api/admin/logs/{requestId}.
func (h *LogHandler) ByRequestID(w http.ResponseWriter, r *http.Request) {
	reqID := chi.URLParam(r, "requestId")
	logs, err := h.Repo.QueryLogs(r.Context(), models.LogQuery{RequestID: reqID, Limit: 200})
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to query logs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs": logs,
	})
}

func parseLogQuery(r *http.Request) models.LogQuery {
	qs := r.URL.Query()
	q := models.LogQuery{
		Level:     qs.Get("level"),
		Source:    qs.Get("source"),
		RequestID: qs.Get("requestId"),
		Search:    qs.Get("q"),
	}
	if v := qs.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			q.Limit = n
		}
	}
	if q.Limit <= 0 || q.Limit > 200 {
		q.Limit = 50
	}
	if v := qs.Get("cursor"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			q.Cursor = n
		}
	}
	if v := qs.Get("before"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.Before = &t
		}
	}
	if v := qs.Get("after"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.After = &t
		}
	}
	return q
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run TestLogHandler_List_ReturnsShape -v`
Expected: PASS.

- [ ] **Step 5: Wire routes + pass dropped-counter from main**

The handler needs the sink's `Dropped` function. Thread it through the router via a new option.

In `go-server/internal/router/router.go`:

a) Add a field to the `options` struct (near line 225):

```go
	logDropped func() int64
```

b) Add an option constructor (near the other `With*` functions):

```go
// WithLogDropped sets the dropped-log counter accessor for the logs endpoint.
func WithLogDropped(f func() int64) Option {
	return func(o *options) {
		o.logDropped = f
	}
}
```

c) Inside the authed admin group in `New` (within the `r.Group(func(r chi.Router){ ... })` block, alongside the other admin routes), register the routes:

```go
			logHandler := &handler.LogHandler{Repo: repo, Dropped: o.logDropped}
			r.Get("/logs", logHandler.List)
			r.Get("/logs/{requestId}", logHandler.ByRequestID)
```

d) In `go-server/cmd/server/main.go`, pass the option when the sink exists. Where `routerOpts` is assembled, add (after the sink is created):

```go
	if sink != nil {
		routerOpts = append(routerOpts, router.WithLogDropped(sink.Dropped))
	}
```

Ensure this runs before `router.New(...)` is called (line ~120).

- [ ] **Step 6: Run handler + router tests, build, lint**

Run: `cd go-server && go test ./internal/handler ./internal/router -race -count=1 && go build ./... && make lint`
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git add go-server/internal/handler/log.go go-server/internal/handler/log_test.go go-server/internal/router/router.go go-server/cmd/server/main.go
git commit -m "feat(logs): add GET /api/admin/logs query + trace endpoints"
```

---

## Task 10: Contract test for logs response shape

**Files:**
- Modify: `go-server/internal/handler/contract_test.go`

- [ ] **Step 1: Add a contract test**

Append to `go-server/internal/handler/contract_test.go` a test asserting camelCase keys. Match the existing style in that file (inspect it first to reuse helpers). Minimal form:

```go
func TestContract_LogsListShape(t *testing.T) {
	repo := repository.NewMemoryRepository()
	h := &LogHandler{Repo: repo, Dropped: func() int64 { return 0 }}

	req := httptest.NewRequest(http.MethodGet, "/api/admin/logs", nil)
	rr := httptest.NewRecorder()
	h.List(rr, req)

	var raw map[string]json.RawMessage
	if err := json.NewDecoder(rr.Body).Decode(&raw); err != nil {
		t.Fatalf("decode: %v", err)
	}
	for _, key := range []string{"logs", "nextCursor", "droppedCount"} {
		if _, ok := raw[key]; !ok {
			t.Errorf("expected camelCase key %q in response", key)
		}
	}
}
```

If the file already imports `encoding/json`, `net/http`, `net/http/httptest`, `repository`, reuse them; otherwise add.

- [ ] **Step 2: Run the contract test**

Run: `cd go-server && go test ./internal/handler -run TestContract_LogsListShape -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/handler/contract_test.go
git commit -m "test(logs): contract test for logs list response shape"
```

---

## Task 11: Frontend — Development nav group + route

**Files:**
- Modify: `client/src/pages/admin/AdminLayout.tsx`
- Create: `client/src/pages/admin/LogsPage.tsx` (stub first; filled in Task 12)

- [ ] **Step 1: Create a minimal LogsPage stub**

Create `client/src/pages/admin/LogsPage.tsx`:

```tsx
export default function LogsPage() {
  return (
    <div data-testid="logs-page">
      <h2 className="text-xl font-semibold text-gray-900">Logs</h2>
    </div>
  );
}
```

- [ ] **Step 2: Add the import, nav group, and route in AdminLayout.tsx**

In `client/src/pages/admin/AdminLayout.tsx`:

a) Add to the lucide-react import (line 5): add `ScrollText`.

b) Add the page import after the other page imports (after line 16):

```tsx
import LogsPage from "./LogsPage";
```

c) After `NAV_ITEMS` (line 29), add a second nav group:

```tsx
const DEV_NAV_ITEMS = [
  { path: "/dev/logs", label: "Logs", icon: ScrollText },
];
```

d) In the sidebar, after the existing `NAV_ITEMS.map(...)` block (after line 143, still inside the sidebar `<div className="bg-white rounded-lg ...">`), add a labeled Development section:

```tsx
              <div className="pt-2 mt-2 border-t">
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Development
                </p>
                {DEV_NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                  const isActive = location === path;
                  return (
                    <Link
                      key={path}
                      href={path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-rose-50 text-rose-700"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
```

e) Add the route inside the `<Switch>` (after line 162, before `</Switch>`):

```tsx
              <Route path="/dev/logs" component={LogsPage} />
```

- [ ] **Step 3: Type-check**

Run (from project root): `npm run check`
Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/AdminLayout.tsx client/src/pages/admin/LogsPage.tsx
git commit -m "feat(logs): add Development nav group and Logs route"
```

---

## Task 12: Frontend — LogsPage table, filters, expansion

**Files:**
- Modify: `client/src/pages/admin/LogsPage.tsx`
- Test: `client/src/pages/admin/__tests__/LogsPage.test.tsx`

Inspect `client/src/pages/admin/RsvpPage.tsx` (or another admin page) first to copy the exact React Query setup, fetch wrapper, and `useContext(AdminContext)`/`handleAutoLogout` usage already in the codebase, then mirror it here.

- [ ] **Step 1: Write the failing test**

Create `client/src/pages/admin/__tests__/LogsPage.test.tsx`. Mirror the structure of `AdminLayout.test.tsx` (same testing library, same query-client wrapper). Core assertions:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LogsPage from "../LogsPage";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LogsPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      logs: [
        {
          id: 1,
          createdAt: "2026-05-28T10:00:00Z",
          level: "ERROR",
          source: "http",
          message: "boom",
          requestId: "abc",
          method: "POST",
          path: "/api/rsvp",
          status: 500,
          durationMs: 12,
          attrs: { error: "db down" },
        },
      ],
      nextCursor: null,
      droppedCount: 0,
    }),
  }) as unknown as typeof fetch;
});

test("renders log rows", async () => {
  renderPage();
  await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  expect(screen.getByText("/api/rsvp")).toBeInTheDocument();
});

test("shows empty state when no logs", async () => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ logs: [], nextCursor: null, droppedCount: 0 }),
  });
  renderPage();
  await waitFor(() =>
    expect(screen.getByText(/no logs captured/i)).toBeInTheDocument()
  );
});

test("shows dropped banner when droppedCount > 0", async () => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ logs: [], nextCursor: null, droppedCount: 5 }),
  });
  renderPage();
  await waitFor(() =>
    expect(screen.getByText(/5 .*dropped/i)).toBeInTheDocument()
  );
});

test("clicking a request ID loads the request trace", async () => {
  const user = userEvent.setup();
  renderPage();
  // Expand the row, then click "view trace".
  await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  await user.click(screen.getByText("boom"));
  const traceBtn = await screen.findByText(/view trace/i);
  await user.click(traceBtn);

  // The trace endpoint should have been requested.
  await waitFor(() =>
    expect(
      (global.fetch as any).mock.calls.some((c: any[]) =>
        String(c[0]).includes("/api/admin/logs/abc")
      )
    ).toBe(true)
  );
  expect(screen.getByText(/back to all logs/i)).toBeInTheDocument();
});
```

This test uses `userEvent` — add `import userEvent from "@testing-library/user-event";` to the test file's imports (it ships with the testing-library setup the repo already uses; confirm against `AdminLayout.test.tsx`).

Match the actual test runner (the repo uses Vitest if `vi` is available; if it uses Jest, swap `vi` → `jest`). Confirm by checking `AdminLayout.test.tsx` imports.

- [ ] **Step 2: Run the test to verify it fails**

Run (project root): `npm run test -- LogsPage` (or the repo's test command from `package.json`).
Expected: FAIL — page renders only the stub heading.

- [ ] **Step 3: Implement LogsPage**

Replace `client/src/pages/admin/LogsPage.tsx` with a full implementation. Key requirements (adapt fetch wrapper to match sibling pages):

```tsx
import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface AppLog {
  id: number;
  createdAt: string;
  level: string;
  source: string;
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  attrs?: Record<string, unknown>;
}

interface LogsResponse {
  logs: AppLog[];
  nextCursor: number | null;
  droppedCount: number;
}

const LEVELS = ["", "INFO", "WARN", "ERROR"];
const SOURCES = ["", "http", "external", "app"];
const RANGES: { label: string; hours: number }[] = [
  { label: "Last 1h", hours: 1 },
  { label: "Last 24h", hours: 24 },
  { label: "Last 7d", hours: 168 },
];

function levelClass(level: string): string {
  switch (level) {
    case "ERROR":
      return "bg-red-100 text-red-700";
    case "WARN":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function LogsPage() {
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [rangeHours, setRangeHours] = useState(24);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);

  const after = new Date(Date.now() - rangeHours * 3600 * 1000).toISOString();

  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (source) params.set("source", source);
  if (search) params.set("q", search);
  params.set("after", after);
  params.set("limit", "100");

  // When a request ID is selected, query the trace endpoint instead of the filtered list.
  const { data, isLoading, refetch } = useQuery<LogsResponse>({
    queryKey: traceId
      ? ["admin-logs-trace", traceId]
      : ["admin-logs", level, source, search, rangeHours],
    queryFn: async () => {
      const url = traceId
        ? `/api/admin/logs/${encodeURIComponent(traceId)}`
        : `/api/admin/logs?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      // The trace endpoint returns only { logs }; normalize to LogsResponse.
      return { logs: json.logs ?? [], nextCursor: json.nextCursor ?? null, droppedCount: json.droppedCount ?? 0 };
    },
  });

  const logs = data?.logs ?? [];

  return (
    <div data-testid="logs-page" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Logs</h2>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {data && data.droppedCount > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {data.droppedCount} log entries were dropped due to high volume.
        </div>
      )}

      {traceId && (
        <div className="flex items-center justify-between rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-800">
          <span>Showing trace for request <code className="font-mono">{traceId}</code></span>
          <button
            onClick={() => {
              setTraceId(null);
              setExpandedId(null);
            }}
            className="px-2 py-1 rounded border bg-white hover:bg-gray-50"
          >
            Back to all logs
          </button>
        </div>
      )}

      <div className={`flex flex-wrap gap-2 ${traceId ? "hidden" : ""}`}>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l || "All levels"}</option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="border rounded-md px-2 py-1 text-sm">
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s || "All sources"}</option>
          ))}
        </select>
        <select
          value={rangeHours}
          onChange={(e) => setRangeHours(Number(e.target.value))}
          className="border rounded-md px-2 py-1 text-sm"
        >
          {RANGES.map((r) => (
            <option key={r.hours} value={r.hours}>{r.label}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search message/path"
          className="border rounded-md px-2 py-1 text-sm flex-1 min-w-[160px]"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500">No logs captured.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="border-t cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelClass(log.level)}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{log.source}</td>
                    <td className="px-3 py-2 text-gray-600">{log.status ?? ""}</td>
                    <td className="px-3 py-2 text-gray-900 truncate max-w-[320px]">
                      {log.message}
                      {log.path ? <span className="text-gray-400"> {log.path}</span> : null}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="border-t bg-gray-50">
                      <td colSpan={5} className="px-3 py-2">
                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {log.method && (<><dt className="text-gray-400">Method</dt><dd>{log.method}</dd></>)}
                          {log.path && (<><dt className="text-gray-400">Path</dt><dd>{log.path}</dd></>)}
                          {typeof log.durationMs === "number" && (<><dt className="text-gray-400">Duration</dt><dd>{log.durationMs} ms</dd></>)}
                          {log.requestId && (
                            <>
                              <dt className="text-gray-400">Request ID</dt>
                              <dd>
                                {traceId ? (
                                  <span className="font-mono">{log.requestId}</span>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTraceId(log.requestId!);
                                      setExpandedId(null);
                                    }}
                                    className="font-mono text-rose-600 hover:underline"
                                  >
                                    {log.requestId} — view trace
                                  </button>
                                )}
                              </dd>
                            </>
                          )}
                        </dl>
                        {log.attrs && (
                          <pre className="mt-2 bg-white border rounded p-2 overflow-x-auto text-xs">
                            {JSON.stringify(log.attrs, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

Note: the per-row wrapper uses `<Fragment key={log.id}>` (imported from `react`) so the keyed-list lint/check passes. The "view trace" button calls `e.stopPropagation()` so clicking it doesn't also toggle row expansion.

- [ ] **Step 4: Run the test to verify it passes**

Run (project root): `npm run test -- LogsPage`
Expected: PASS (all three tests).

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/LogsPage.tsx client/src/pages/admin/__tests__/LogsPage.test.tsx
git commit -m "feat(logs): implement Logs viewer page with filters and expansion"
```

---

## Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Backend — full test suite with race detector**

Run: `cd go-server && make test`
Expected: all tests PASS.

- [ ] **Step 2: Backend — lint**

Run: `cd go-server && make lint`
Expected: no issues.

- [ ] **Step 3: Frontend — type check + tests**

Run (project root): `npm run check && npm run test`
Expected: no type errors; all tests pass.

- [ ] **Step 4: Manual full-stack smoke test (requires Postgres)**

Run the migration against a dev DB, then start the server with `DATABASE_URL` set and the Vite dev server. Steps:
- `cd go-server && make migrate` (with `DATABASE_URL` set)
- `cd go-server && make run-dev` (with `DATABASE_URL` set so the sink installs)
- `npm run dev` (project root)
- Log into admin, trigger an RSVP create and an error (e.g. bad request), open **Development > Logs**.
- Verify: the HTTP request rows appear, level/source filters work, row expands to show attrs, no `cookie`/`authorization` values are present in any row, `/api/health` does NOT appear.
- Click a row's request ID "view trace" link; verify the page switches to a request-scoped view (calls `/api/admin/logs/{requestId}`) and "Back to all logs" returns to the filtered list.

Expected: logs are captured and visible; secrets absent; health/static excluded; trace view works.

- [ ] **Step 5: Update issuesResolution.md if any bugs were found and fixed**

Per project convention, document any non-trivial bug discovered during implementation in `go-server/issuesResolution.md` (symptom, root cause, resolution).

- [ ] **Step 6: Final commit (if verification produced fixes)**

```bash
git add -A
git commit -m "chore(logs): verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:** schema (T1), repo+retention method (T2), buffered sink+backpressure+recursion guard+attr-carrying WithAttrs (T4), fan-out (T5), HTTP capture with health/static exclusion + INFO promotion (T6), external API tagging (T7), main wiring + retention ticker + drain (T8), query/trace endpoints + dropped counter (T9), contract test (T10), Development nav + viewer with filters/expansion/empty-state/dropped-banner + request-ID trace view (T11-12), full verification incl. secret-absence + health-exclusion + trace-view check (T13). All spec sections mapped.
- **PII/secret protection:** enforced in sink (`SanitizeAttrs`, `SanitizePath`) with a denylist, verified in T3 tests and T13 manual check.
- **No-DB behavior:** sink not installed (T8), repo methods no-op (T2), viewer shows empty state (T12) — logging unchanged in dev, per spec.
- **Type consistency:** `LogQuery`/`AppLog` fields used identically across repo, sink, handler; slog attr keys (`source`, `requestId`, `method`, `path`, `status`, `durationMs`) emitted in T6 match exactly what the sink reads in T4.
