package logsink

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mywedding/platform/internal/models"
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
	stopOnce *sync.Once
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
		stopOnce: &sync.Once{},
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
		// InsertLogs must finish before the batch backing array is reused below.
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
	s.stopOnce.Do(func() { close(s.done) })
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
