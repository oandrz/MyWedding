package handler_test

import (
	"bytes"
	"context"
	"image"
	"image/jpeg"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/middleware"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/router"
	"github.com/andreasronaldo/wedding-server/internal/service"
)

// mockStorage is a controllable test double for service.ObjectStorage.
type mockStorage struct {
	signedURL    string
	signedURLErr error
	downloadData []byte
	downloadErr  error
	uploadURL    string
	uploadErr    error
}

func (m *mockStorage) Upload(_ context.Context, _ io.Reader, _ int64, _, _, _ string) (string, error) {
	return m.uploadURL, m.uploadErr
}
func (m *mockStorage) UploadAdminImage(_ context.Context, _ io.Reader, _ int64, _, _, _ string) (string, error) {
	return m.uploadURL, m.uploadErr
}
func (m *mockStorage) Download(_ context.Context, _ string, _ http.ResponseWriter) error { return nil }
func (m *mockStorage) DownloadBuffer(_ context.Context, _ string) ([]byte, error) {
	return m.downloadData, m.downloadErr
}
func (m *mockStorage) Delete(_ context.Context, _ string) error { return nil }
func (m *mockStorage) ParsePublicURL(u string) string           { return u }
func (m *mockStorage) CreateSignedUploadURL(_ context.Context, _ string) (string, error) {
	return m.signedURL, m.signedURLErr
}

// newTestEnvWithStorage builds a full router with a mock storage backend.
func newTestEnvWithStorage(storage service.ObjectStorage) *testEnv {
	hash, _ := bcrypt.GenerateFromPassword([]byte("testpass123"), bcrypt.DefaultCost)
	cfg := &config.Config{
		Env:               "development",
		Port:              5000,
		AdminPassword:     "testpass123",
		AdminPasswordHash: string(hash),
		SessionMaxAge:     1800,
		CORSOrigins:       []string{"*"},
	}
	repo := repository.NewMemoryRepository()
	sessions := middleware.NewSessionStore(30 * time.Minute)
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(5 * time.Minute)
	r := router.New(cfg, repo, sessions, csrf, cache, router.WithStorage(storage))
	return &testEnv{
		handler:  r,
		cfg:      cfg,
		repo:     repo,
		sessions: sessions,
		csrf:     csrf,
		cache:    cache,
	}
}

// testJPEGBytes returns a minimal 10×10 JPEG that imaging.Resize can process.
func testJPEGBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("failed to create test JPEG: %v", err)
	}
	return buf.Bytes()
}

// ---------------------------------------------------------------------------
// GetSignedUploadURL — POST /api/admin/upload/signed-url
// ---------------------------------------------------------------------------

func TestGetSignedUploadURL_Success(t *testing.T) {
	storage := &mockStorage{signedURL: "https://xyz.supabase.co/storage/v1/object/upload/sign/bucket/path?token=abc"}
	env := newTestEnvWithStorage(storage)
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"imageKey":  "gallery_123",
		"imageType": "gallery",
		"filename":  "photo.jpg",
	})
	req := adminRequest(http.MethodPost, "/api/admin/upload/signed-url", body, cookie, csrfToken)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	result := parseResponse(t, rec)
	if result["signedUrl"] == nil || result["signedUrl"] == "" {
		t.Fatal("expected non-empty signedUrl in response")
	}
	storagePath, _ := result["storagePath"].(string)
	if !strings.HasPrefix(storagePath, "admin/gallery/") {
		t.Fatalf("expected storagePath to start with admin/gallery/, got %q", storagePath)
	}
	if !strings.HasSuffix(storagePath, ".jpg") {
		t.Fatalf("expected storagePath to end with .jpg, got %q", storagePath)
	}
}

func TestGetSignedUploadURL_MissingFields(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	cases := []map[string]interface{}{
		{"imageType": "gallery", "filename": "photo.jpg"},    // missing imageKey
		{"imageKey": "gallery_123", "filename": "photo.jpg"}, // missing imageType
		{"imageKey": "gallery_123", "imageType": "gallery"},  // missing filename
	}
	for _, body := range cases {
		req := adminRequest(http.MethodPost, "/api/admin/upload/signed-url", jsonBody(body), cookie, csrfToken)
		rec := newRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for body %v, got %d: %s", body, rec.Code, rec.Body.String())
		}
	}
}

func TestGetSignedUploadURL_InvalidImageType(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"imageKey": "x", "imageType": "not-a-type", "filename": "photo.jpg",
	})
	req := adminRequest(http.MethodPost, "/api/admin/upload/signed-url", body, cookie, csrfToken)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGetSignedUploadURL_RequiresAuth(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/upload/signed-url", nil)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func newRecorder() *httptest.ResponseRecorder { return httptest.NewRecorder() }

// ---------------------------------------------------------------------------
// CompleteConfigImageUpload — POST /api/admin/upload/complete
// ---------------------------------------------------------------------------

func TestCompleteConfigImageUpload_GalleryWithThumbnail(t *testing.T) {
	jpegData := testJPEGBytes(t)
	storage := &mockStorage{
		downloadData: jpegData,
		uploadURL:    "/storage/admin/gallery/thumbnails/gallery_123-thumb.jpg",
	}
	env := newTestEnvWithStorage(storage)
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"storagePath": "admin/gallery/gallery_123-1715000000000.jpg",
		"imageKey":    "gallery_123",
		"imageType":   "gallery",
		"title":       "Wedding shot",
		"description": "",
	})
	req := adminRequest(http.MethodPost, "/api/admin/upload/complete", body, cookie, csrfToken)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	result := parseResponse(t, rec)
	if result["image"] == nil {
		t.Fatal("expected image in response")
	}
	img := result["image"].(map[string]interface{})
	if img["imageUrl"] != "/storage/admin/gallery/gallery_123-1715000000000.jpg" {
		t.Fatalf("unexpected imageUrl: %v", img["imageUrl"])
	}
	// thumbnailUrl should be set because DownloadBuffer + Upload both succeed
	if img["thumbnailUrl"] == nil {
		t.Fatal("expected thumbnailUrl for gallery image with valid JPEG")
	}
}

func TestCompleteConfigImageUpload_NonGallery_NoThumbnail(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"storagePath": "admin/banner/banner-1715000000000.jpg",
		"imageKey":    "banner",
		"imageType":   "banner",
	})
	req := adminRequest(http.MethodPost, "/api/admin/upload/complete", body, cookie, csrfToken)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	result := parseResponse(t, rec)
	img := result["image"].(map[string]interface{})
	if img["thumbnailUrl"] != nil {
		t.Fatalf("expected nil thumbnailUrl for banner image, got %v", img["thumbnailUrl"])
	}
}

func TestCompleteConfigImageUpload_MissingFields(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	cases := []map[string]interface{}{
		{"imageKey": "gallery_123", "imageType": "gallery"},             // missing storagePath
		{"storagePath": "admin/gallery/x.jpg", "imageType": "gallery"},  // missing imageKey
		{"storagePath": "admin/gallery/x.jpg", "imageKey": "gallery_123"}, // missing imageType
	}
	for _, body := range cases {
		req := adminRequest(http.MethodPost, "/api/admin/upload/complete", jsonBody(body), cookie, csrfToken)
		rec := newRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for body %v, got %d: %s", body, rec.Code, rec.Body.String())
		}
	}
}

func TestCompleteConfigImageUpload_RequiresAuth(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/upload/complete", nil)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestCompleteConfigImageUpload_UpsertExisting(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	upload := func(title string) {
		body := jsonBody(map[string]interface{}{
			"storagePath": "admin/banner/banner-1715000000000.jpg",
			"imageKey":    "banner",
			"imageType":   "banner",
			"title":       title,
		})
		req := adminRequest(http.MethodPost, "/api/admin/upload/complete", body, cookie, csrfToken)
		rec := newRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
		}
	}

	upload("first")
	upload("second") // same imageKey — should update, not duplicate

	// Verify only one record exists via the list endpoint
	req := httptest.NewRequest(http.MethodGet, "/api/config-images/banner", nil)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)
	result := parseResponse(t, rec)
	images := result["images"].([]interface{})
	if len(images) != 1 {
		t.Fatalf("expected 1 image after upsert, got %d", len(images))
	}
}

func TestCompleteConfigImageUpload_StoragePathMismatch(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	// storagePath is in banner directory but imageType is gallery
	body := jsonBody(map[string]interface{}{
		"storagePath": "admin/banner/some-file.jpg",
		"imageKey":    "gallery_123",
		"imageType":   "gallery",
	})
	req := adminRequest(http.MethodPost, "/api/admin/upload/complete", body, cookie, csrfToken)
	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for mismatched storagePath, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestCompleteConfigImageUpload_InvalidImageKey(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	badKeys := []string{"../etc/passwd", "foo/bar", "foo.jpg", "key with space"}
	for _, k := range badKeys {
		body := jsonBody(map[string]interface{}{
			"storagePath": "admin/banner/banner-1715000000000.jpg",
			"imageKey":    k,
			"imageType":   "banner",
		})
		req := adminRequest(http.MethodPost, "/api/admin/upload/complete", body, cookie, csrfToken)
		rec := newRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("imageKey %q: expected 400, got %d: %s", k, rec.Code, rec.Body.String())
		}
	}
}

func TestGetSignedUploadURL_InvalidImageKey(t *testing.T) {
	env := newTestEnvWithStorage(&mockStorage{})
	cookie, csrfToken := adminLogin(t, env)

	badKeys := []string{"../etc/passwd", "foo/bar", "foo.jpg", "key with space"}
	for _, k := range badKeys {
		body := jsonBody(map[string]interface{}{
			"imageKey": k, "imageType": "gallery", "filename": "photo.jpg",
		})
		req := adminRequest(http.MethodPost, "/api/admin/upload/signed-url", body, cookie, csrfToken)
		rec := newRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("imageKey %q: expected 400, got %d: %s", k, rec.Code, rec.Body.String())
		}
	}
}
