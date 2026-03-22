package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCacheControl_SetsHeaders(t *testing.T) {
	handler := CacheControl(60)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":"test"}`))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	cc := rec.Header().Get("Cache-Control")
	if cc != "public, max-age=60" {
		t.Fatalf("expected Cache-Control 'public, max-age=60', got %q", cc)
	}

	etag := rec.Header().Get("ETag")
	if etag == "" {
		t.Fatal("expected ETag header to be set")
	}
}

func TestCacheControl_304OnMatchingETag(t *testing.T) {
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":"test"}`))
	})
	handler := CacheControl(60)(inner)

	// First request to get ETag
	req1 := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	etag := rec1.Header().Get("ETag")

	// Second request with If-None-Match
	req2 := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	req2.Header.Set("If-None-Match", etag)
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", rec2.Code)
	}
}

func TestCacheControl_200OnDifferentETag(t *testing.T) {
	handler := CacheControl(60)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":"test"}`))
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	req.Header.Set("If-None-Match", `"stale-etag"`)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
