package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/config"
)

func TestHealthEndpoint(t *testing.T) {
	os.Clearenv()
	os.Setenv("GO_ENV", "development")
	cfg := config.Load()
	r := newRouter(cfg)

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

	if body["time"] == "" {
		t.Error("expected time field in response")
	}
}

func TestHealthEndpointMethod(t *testing.T) {
	os.Clearenv()
	os.Setenv("GO_ENV", "development")
	cfg := config.Load()
	r := newRouter(cfg)

	// POST should return 405
	req := httptest.NewRequest(http.MethodPost, "/api/health", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Errorf("expected status 405 for POST, got %d", w.Code)
	}
}
