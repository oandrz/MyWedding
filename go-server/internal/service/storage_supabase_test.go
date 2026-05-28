package service

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestSupabase(t *testing.T, handler http.HandlerFunc) (*SupabaseStorage, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	s := NewSupabaseStorageWithClient(srv.Client(), srv.URL, "test-key", "test-bucket", "development")
	return s, srv
}

func TestSupabaseUpload(t *testing.T) {
	var gotMethod, gotPath, gotContentType, gotUpsert, gotAuth string
	var gotBody []byte

	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		gotContentType = r.Header.Get("Content-Type")
		gotUpsert = r.Header.Get("x-upsert")
		gotAuth = r.Header.Get("Authorization")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	hello := []byte("hello")
	url, err := s.Upload(context.Background(), bytes.NewReader(hello), int64(len(hello)), "test.txt", "text/plain", "uploads")
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}

	if gotMethod != http.MethodPost {
		t.Errorf("expected POST, got %s", gotMethod)
	}
	if gotPath != "/storage/v1/object/test-bucket/development/uploads/test.txt" {
		t.Errorf("unexpected path: %s", gotPath)
	}
	if gotContentType != "text/plain" {
		t.Errorf("unexpected content-type: %s", gotContentType)
	}
	if gotUpsert != "true" {
		t.Errorf("expected x-upsert: true, got %s", gotUpsert)
	}
	if gotAuth != "Bearer test-key" {
		t.Errorf("unexpected auth header: %s", gotAuth)
	}
	if string(gotBody) != "hello" {
		t.Errorf("unexpected body: %s", string(gotBody))
	}
	if url != "/storage/uploads/test.txt" {
		t.Errorf("unexpected returned URL: %s", url)
	}
}

func TestSupabaseUploadAdminImage(t *testing.T) {
	cases := []struct {
		imageType string
		wantDir   string
	}{
		{"banner", "admin/banner"},
		{"gallery", "admin/gallery"},
		{"bride-profile", "admin/profiles/bride"},
		{"groom-profile", "admin/profiles/groom"},
		{"verse-image", "admin/verse"},
		{"unknown", "admin/other"},
	}

	for _, tc := range cases {
		t.Run(tc.imageType, func(t *testing.T) {
			var gotPath string
			s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.Path
				w.WriteHeader(http.StatusOK)
			})
			defer srv.Close()

			img := []byte("img")
			url, err := s.UploadAdminImage(context.Background(), bytes.NewReader(img), int64(len(img)), "test.jpg", "image/jpeg", tc.imageType)
			if err != nil {
				t.Fatalf("upload failed: %v", err)
			}

			expectedPath := "/storage/v1/object/test-bucket/development/" + tc.wantDir + "/test.jpg"
			if gotPath != expectedPath {
				t.Errorf("expected path %s, got %s", expectedPath, gotPath)
			}
			expectedURL := "/storage/" + tc.wantDir + "/test.jpg"
			if url != expectedURL {
				t.Errorf("expected URL %s, got %s", expectedURL, url)
			}
		})
	}
}

func TestSupabaseDownload(t *testing.T) {
	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/jpeg")
		w.Header().Set("Content-Length", "5")
		w.Write([]byte("image"))
	})
	defer srv.Close()

	rec := httptest.NewRecorder()
	err := s.Download(context.Background(), "uploads/photo.jpg", rec)
	if err != nil {
		t.Fatalf("download failed: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if rec.Header().Get("Content-Type") != "image/jpeg" {
		t.Errorf("unexpected content-type: %s", rec.Header().Get("Content-Type"))
	}
	if rec.Header().Get("Cache-Control") != "public, max-age=604800" {
		t.Errorf("unexpected cache-control: %s", rec.Header().Get("Cache-Control"))
	}
	if rec.Body.String() != "image" {
		t.Errorf("unexpected body: %s", rec.Body.String())
	}
}

func TestSupabaseDownload404(t *testing.T) {
	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	defer srv.Close()

	rec := httptest.NewRecorder()
	err := s.Download(context.Background(), "nonexistent.txt", rec)
	if err != nil {
		t.Fatalf("expected nil error on 404, got: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "File not found") {
		t.Errorf("expected 'File not found' in body, got: %s", rec.Body.String())
	}
}

func TestSupabaseDownloadBuffer(t *testing.T) {
	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("buffer-content"))
	})
	defer srv.Close()

	data, err := s.DownloadBuffer(context.Background(), "test/file.txt")
	if err != nil {
		t.Fatalf("download buffer failed: %v", err)
	}
	if string(data) != "buffer-content" {
		t.Errorf("unexpected content: %s", string(data))
	}
}

func TestSupabaseDownloadBuffer404(t *testing.T) {
	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	defer srv.Close()

	_, err := s.DownloadBuffer(context.Background(), "nonexistent.txt")
	if err == nil {
		t.Fatal("expected error on 404")
	}
	if !strings.Contains(err.Error(), "object not found") {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSupabaseDelete(t *testing.T) {
	var gotMethod, gotPath string
	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	})
	defer srv.Close()

	err := s.Delete(context.Background(), "uploads/photo.jpg")
	if err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	if gotMethod != http.MethodDelete {
		t.Errorf("expected DELETE, got %s", gotMethod)
	}
	if gotPath != "/storage/v1/object/test-bucket/development/uploads/photo.jpg" {
		t.Errorf("unexpected path: %s", gotPath)
	}
}

func TestSupabaseDeleteGraceful404(t *testing.T) {
	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	})
	defer srv.Close()

	err := s.Delete(context.Background(), "nonexistent.txt")
	if err != nil {
		t.Fatalf("expected no error on 404 delete, got: %v", err)
	}
}

func TestSupabaseParsePublicURL(t *testing.T) {
	s := &SupabaseStorage{}

	tests := []struct {
		input string
		want  string
	}{
		{"/storage/uploads/test.jpg", "uploads/test.jpg"},
		{"/storage/admin/gallery/img.png", "admin/gallery/img.png"},
		{"http://example.com/storage/foo.txt", "foo.txt"},
		{"no-match", ""},
	}

	for _, tc := range tests {
		got := s.ParsePublicURL(tc.input)
		if got != tc.want {
			t.Errorf("ParsePublicURL(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestSupabaseEnvPrefixEmpty(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	s := NewSupabaseStorageWithClient(srv.Client(), srv.URL, "key", "bucket", "")

	x := []byte("x")
	_, err := s.Upload(context.Background(), bytes.NewReader(x), int64(len(x)), "f.txt", "text/plain", "dir")
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	// Without env prefix, path should not have an extra segment
	if gotPath != "/storage/v1/object/bucket/dir/f.txt" {
		t.Errorf("unexpected path with empty prefix: %s", gotPath)
	}
}

func TestSupabaseUploadError(t *testing.T) {
	s, srv := newTestSupabase(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":"internal"}`))
	})
	defer srv.Close()

	x2 := []byte("x")
	_, err := s.Upload(context.Background(), bytes.NewReader(x2), int64(len(x2)), "f.txt", "text/plain", "dir")
	if err == nil {
		t.Fatal("expected error on 500")
	}
	if !strings.Contains(err.Error(), "500") {
		t.Errorf("error should mention status code: %v", err)
	}
}
