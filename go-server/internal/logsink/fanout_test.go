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
