package service

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"cloud.google.com/go/storage"
)

// ObjectStorage defines the interface for file storage operations.
type ObjectStorage interface {
	Upload(ctx context.Context, data []byte, filename, contentType, directory string) (string, error)
	UploadAdminImage(ctx context.Context, data []byte, filename, contentType, imageType string) (string, error)
	Download(ctx context.Context, objectPath string, w http.ResponseWriter) error
	DownloadBuffer(ctx context.Context, objectPath string) ([]byte, error)
	Delete(ctx context.Context, objectPath string) error
	ParsePublicURL(publicURL string) string
}

// GCSStorage implements ObjectStorage using Google Cloud Storage.
type GCSStorage struct {
	client *storage.Client
	bucket string
}

// NewGCSStorage creates a new GCS-backed storage.
func NewGCSStorage(ctx context.Context, bucketID string) (*GCSStorage, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCS client: %w", err)
	}
	return &GCSStorage{client: client, bucket: bucketID}, nil
}

func (s *GCSStorage) Upload(ctx context.Context, data []byte, filename, contentType, directory string) (string, error) {
	objectName := directory + "/" + filename
	bucket := s.client.Bucket(s.bucket)
	obj := bucket.Object(objectName)
	w := obj.NewWriter(ctx)
	w.ContentType = contentType

	if _, err := w.Write(data); err != nil {
		w.Close()
		return "", fmt.Errorf("failed to write to GCS: %w", err)
	}
	if err := w.Close(); err != nil {
		return "", fmt.Errorf("failed to close GCS writer: %w", err)
	}

	slog.Debug("File uploaded to GCS", "path", objectName)
	return "/storage/" + objectName, nil
}

func (s *GCSStorage) UploadAdminImage(ctx context.Context, data []byte, filename, contentType, imageType string) (string, error) {
	dir := adminImageDirectory(imageType)
	return s.Upload(ctx, data, filename, contentType, dir)
}

func (s *GCSStorage) Download(ctx context.Context, objectPath string, w http.ResponseWriter) error {
	bucket := s.client.Bucket(s.bucket)
	obj := bucket.Object(objectPath)

	attrs, err := obj.Attrs(ctx)
	if err != nil {
		if err == storage.ErrObjectNotExist {
			http.Error(w, `{"error":"File not found"}`, http.StatusNotFound)
			return nil
		}
		return err
	}

	w.Header().Set("Content-Type", attrs.ContentType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", attrs.Size))
	w.Header().Set("Cache-Control", "public, max-age=3600")

	reader, err := obj.NewReader(ctx)
	if err != nil {
		return err
	}
	defer reader.Close()

	_, err = io.Copy(w, reader)
	return err
}

func (s *GCSStorage) DownloadBuffer(ctx context.Context, objectPath string) ([]byte, error) {
	bucket := s.client.Bucket(s.bucket)
	obj := bucket.Object(objectPath)
	reader, err := obj.NewReader(ctx)
	if err != nil {
		if err == storage.ErrObjectNotExist {
			return nil, fmt.Errorf("object not found: %s", objectPath)
		}
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

func (s *GCSStorage) Delete(ctx context.Context, objectPath string) error {
	bucket := s.client.Bucket(s.bucket)
	return bucket.Object(objectPath).Delete(ctx)
}

func (s *GCSStorage) ParsePublicURL(publicURL string) string {
	if idx := strings.Index(publicURL, "/storage/"); idx >= 0 {
		return publicURL[idx+len("/storage/"):]
	}
	return ""
}

// LocalStorage implements ObjectStorage using local filesystem (dev fallback).
type LocalStorage struct {
	baseDir string
}

// NewLocalStorage creates a file-system backed storage for development.
func NewLocalStorage(baseDir string) *LocalStorage {
	os.MkdirAll(baseDir, 0o755)
	return &LocalStorage{baseDir: baseDir}
}

func (s *LocalStorage) Upload(_ context.Context, data []byte, filename, contentType, directory string) (string, error) {
	dir := filepath.Join(s.baseDir, directory)
	os.MkdirAll(dir, 0o755)

	path := filepath.Join(dir, filename)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}

	return "/storage/" + directory + "/" + filename, nil
}

func (s *LocalStorage) UploadAdminImage(_ context.Context, data []byte, filename, contentType, imageType string) (string, error) {
	dir := adminImageDirectory(imageType)
	return s.Upload(context.Background(), data, filename, contentType, dir)
}

func (s *LocalStorage) Download(_ context.Context, objectPath string, w http.ResponseWriter) error {
	path := filepath.Join(s.baseDir, objectPath)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			http.Error(w, `{"error":"File not found"}`, http.StatusNotFound)
			return nil
		}
		return err
	}

	ct := http.DetectContentType(data)
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(data)))
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, err = w.Write(data)
	return err
}

func (s *LocalStorage) DownloadBuffer(_ context.Context, objectPath string) ([]byte, error) {
	path := filepath.Join(s.baseDir, objectPath)
	return os.ReadFile(path)
}

func (s *LocalStorage) Delete(_ context.Context, objectPath string) error {
	return os.Remove(filepath.Join(s.baseDir, objectPath))
}

func (s *LocalStorage) ParsePublicURL(publicURL string) string {
	if idx := strings.Index(publicURL, "/storage/"); idx >= 0 {
		return publicURL[idx+len("/storage/"):]
	}
	return ""
}

// adminImageDirectory maps image type to storage directory.
func adminImageDirectory(imageType string) string {
	switch imageType {
	case "banner":
		return "admin/banner"
	case "gallery":
		return "admin/gallery"
	case "bride-profile":
		return "admin/profiles/bride"
	case "groom-profile":
		return "admin/profiles/groom"
	case "verse-image":
		return "admin/verse"
	default:
		return "admin/other"
	}
}
