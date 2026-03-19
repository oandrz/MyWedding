package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestExtendWriteDeadline_CallsNextHandler(t *testing.T) {
	called := false
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	handler := ExtendWriteDeadline(2 * time.Minute)(inner)

	req := httptest.NewRequest(http.MethodPost, "/upload", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Fatal("expected inner handler to be called")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}
	if rec.Body.String() != "ok" {
		t.Fatalf("expected body 'ok', got %q", rec.Body.String())
	}
}

func TestExtendWriteDeadline_NoPanicWithTestRecorder(t *testing.T) {
	// httptest.ResponseRecorder has no real net.Conn, so SetWriteDeadline
	// returns an error. The middleware must not panic in this case.
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	handler := ExtendWriteDeadline(30 * time.Second)(inner)

	req := httptest.NewRequest(http.MethodPost, "/upload", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", rec.Code)
	}
}
