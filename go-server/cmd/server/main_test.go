package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/mywedding/platform/internal/config"
	"github.com/mywedding/platform/internal/middleware"
	"github.com/mywedding/platform/internal/repository"
	"github.com/mywedding/platform/internal/router"
	"github.com/mywedding/platform/internal/service"
)

func testRouter() http.Handler {
	os.Clearenv()
	os.Setenv("GO_ENV", "development")
	cfg := config.Load()
	repo := repository.NewMemoryRepository()
	sessions := middleware.NewSessionStore(30 * time.Minute)
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(30 * time.Second)
	return router.New(cfg, repo, sessions, csrf, cache)
}

func TestHealthEndpoint(t *testing.T) {
	r := testRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}

	var body map[string]string
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %s", body["status"])
	}

	if body["timestamp"] == "" {
		t.Error("expected timestamp field in response")
	}
}

func TestHealthEndpointMethod(t *testing.T) {
	r := testRouter()

	req := httptest.NewRequest(http.MethodPost, "/api/health", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405 for POST, got %d", w.Code)
	}
}
