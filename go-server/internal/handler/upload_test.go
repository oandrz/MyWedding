package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestUpload_NoStorage_Returns404 verifies that the upload route is not
// registered when no storage backend is configured (the default test env).
// In production the route is only wired when WithStorage is provided to the
// router, so a request without storage should get a 404 Not Found.
func TestUpload_NoStorage_Returns404(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodPost, "/api/upload", nil)
	req.Header.Set("Content-Type", "multipart/form-data")

	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when storage is not configured, got %d\nBody: %s", rec.Code, rec.Body.String())
	}
}
