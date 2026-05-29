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
