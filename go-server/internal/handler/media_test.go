package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMedia_EmptyList_ReturnsPaginatedEmpty(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/media", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	media := result["media"].([]interface{})
	if len(media) != 0 {
		t.Fatalf("expected empty array, got %d items", len(media))
	}
	total := result["total"].(float64)
	if total != 0 {
		t.Fatalf("expected total=0, got %v", total)
	}
}
