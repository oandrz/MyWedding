package service

import (
	"bytes"
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestLocalStorageUpload(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

	data := []byte("hello")
	url, err := s.Upload(context.Background(), bytes.NewReader(data), int64(len(data)), "test.txt", "text/plain", "uploads")
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	if url != "/storage/uploads/test.txt" {
		t.Errorf("unexpected URL: %s", url)
	}

	fileData, err := os.ReadFile(filepath.Join(dir, "uploads", "test.txt"))
	if err != nil {
		t.Fatalf("file not found on disk: %v", err)
	}
	if string(fileData) != "hello" {
		t.Errorf("unexpected content: %s", string(fileData))
	}
}

func TestLocalStorageAdminImage(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

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
		img := []byte("img")
		url, err := s.UploadAdminImage(context.Background(), bytes.NewReader(img), int64(len(img)), "test.jpg", "image/jpeg", tc.imageType)
		if err != nil {
			t.Errorf("%s: upload failed: %v", tc.imageType, err)
			continue
		}
		expected := "/storage/" + tc.wantDir + "/test.jpg"
		if url != expected {
			t.Errorf("%s: expected %s, got %s", tc.imageType, expected, url)
		}
	}
}

func TestLocalStorageDownloadCacheControl(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

	content := []byte("image-bytes")
	s.Upload(context.Background(), bytes.NewReader(content), int64(len(content)), "photo.jpg", "image/jpeg", "uploads")

	rec := httptest.NewRecorder()
	if err := s.Download(context.Background(), "uploads/photo.jpg", rec); err != nil {
		t.Fatalf("download failed: %v", err)
	}

	// Long-lived cache header is the egress-reduction lever; uploaded URLs are
	// immutable (unique filenames), so a 7-day TTL is safe. Lock it in.
	if got := rec.Header().Get("Cache-Control"); got != "public, max-age=604800" {
		t.Errorf("unexpected cache-control: %q", got)
	}
	if rec.Body.String() != "image-bytes" {
		t.Errorf("unexpected body: %s", rec.Body.String())
	}
}

func TestLocalStorageDownloadBuffer(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

	content := []byte("content")
	s.Upload(context.Background(), bytes.NewReader(content), int64(len(content)), "dl.txt", "text/plain", "test")

	data, err := s.DownloadBuffer(context.Background(), "test/dl.txt")
	if err != nil {
		t.Fatalf("download failed: %v", err)
	}
	if string(data) != "content" {
		t.Errorf("unexpected content: %s", string(data))
	}
}

func TestLocalStorageDelete(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

	x := []byte("x")
	s.Upload(context.Background(), bytes.NewReader(x), int64(len(x)), "del.txt", "text/plain", "test")

	err := s.Delete(context.Background(), "test/del.txt")
	if err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	_, err = s.DownloadBuffer(context.Background(), "test/del.txt")
	if err == nil {
		t.Error("expected error after delete")
	}
}

func TestParsePublicURL(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

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
