package logsink

import (
	"context"
	"log/slog"
	"sync"
	"testing"
	"time"

	"github.com/mywedding/platform/internal/models"
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
