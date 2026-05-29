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
