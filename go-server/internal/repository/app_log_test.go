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
