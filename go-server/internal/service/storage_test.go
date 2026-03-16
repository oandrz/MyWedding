package service

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestLocalStorageUpload(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

	url, err := s.Upload(context.Background(), []byte("hello"), "test.txt", "text/plain", "uploads")
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	if url != "/storage/uploads/test.txt" {
		t.Errorf("unexpected URL: %s", url)
	}

	data, err := os.ReadFile(filepath.Join(dir, "uploads", "test.txt"))
	if err != nil {
		t.Fatalf("file not found on disk: %v", err)
	}
	if string(data) != "hello" {
		t.Errorf("unexpected content: %s", string(data))
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
		url, err := s.UploadAdminImage(context.Background(), []byte("img"), "test.jpg", "image/jpeg", tc.imageType)
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

func TestLocalStorageDownloadBuffer(t *testing.T) {
	dir := t.TempDir()
	s := NewLocalStorage(dir)

	s.Upload(context.Background(), []byte("content"), "dl.txt", "text/plain", "test")

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

	s.Upload(context.Background(), []byte("x"), "del.txt", "text/plain", "test")

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
