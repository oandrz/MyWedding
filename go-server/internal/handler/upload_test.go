package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/middleware"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/router"
	"github.com/andreasronaldo/wedding-server/internal/service"
)

// TestUpload_NoStorage_Returns404 verifies that the upload route is not
// registered when no storage backend is provided to the router.
// WithStorage is optional — omitting it leaves /api/upload unregistered (404).
func TestUpload_NoStorage_Returns404(t *testing.T) {
	cfg := &config.Config{
		Env:         "development",
		CORSOrigins: []string{"*"},
	}
	repo := repository.NewMemoryRepository()
	sessions := middleware.NewSessionStore(30 * time.Minute)
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(5 * time.Minute)
	// Deliberately omit router.WithStorage so upload routes are not registered.
	h := router.New(cfg, repo, sessions, csrf, cache)

	req := httptest.NewRequest(http.MethodPost, "/api/upload", nil)
	req.Header.Set("Content-Type", "multipart/form-data")

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when storage is not configured, got %d\nBody: %s", rec.Code, rec.Body.String())
	}
}
