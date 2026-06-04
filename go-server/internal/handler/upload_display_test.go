package handler_test

import (
	"bytes"
	"encoding/json"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

// buildConfigImageMultipart creates a multipart/form-data body for the
// /api/admin/config-images-upload endpoint. It explicitly sets the file part's
// Content-Type to image/jpeg so the handler's MIME check passes.
func buildConfigImageMultipart(t *testing.T, imageKey, imageType string, fileData []byte) (*bytes.Buffer, string) {
	t.Helper()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	// Write text fields
	_ = w.WriteField("imageKey", imageKey)
	_ = w.WriteField("imageType", imageType)

	// Write file part with explicit image/jpeg Content-Type
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", mime.FormatMediaType("form-data", map[string]string{
		"name":     "file",
		"filename": "photo.jpg",
	}))
	h.Set("Content-Type", "image/jpeg")
	part, err := w.CreatePart(h)
	if err != nil {
		t.Fatalf("failed to create form part: %v", err)
	}
	if _, err := part.Write(fileData); err != nil {
		t.Fatalf("failed to write file data: %v", err)
	}
	w.Close()

	return &body, w.FormDataContentType()
}

// TestUploadConfigImage_GeneratesDisplayURL verifies that uploading a gallery
// image via the direct multipart endpoint generates both a thumbnailUrl and a
// displayUrl that contains "-display.jpg".
func TestUploadConfigImage_GeneratesDisplayURL(t *testing.T) {
	jpegData := testJPEGBytes(t)
	env := newTestEnv() // LocalStorage preserves filename in returned URL
	cookie, csrfToken := adminLogin(t, env)

	body, contentType := buildConfigImageMultipart(t, "gallery-test-1", "gallery", jpegData)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/config-images-upload", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-CSRF-Token", csrfToken)
	req.AddCookie(cookie)

	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Image models.ConfigImage `json:"image"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v\nBody: %s", err, rec.Body.String())
	}

	if resp.Image.ThumbnailURL == nil || *resp.Image.ThumbnailURL == "" {
		t.Fatal("expected thumbnailUrl to be set for gallery image")
	}
	if resp.Image.DisplayURL == nil || *resp.Image.DisplayURL == "" {
		t.Fatal("expected displayUrl to be set for gallery image")
	}
	if !strings.Contains(*resp.Image.DisplayURL, "-display.jpg") {
		t.Fatalf("expected displayUrl to contain -display.jpg, got %q", *resp.Image.DisplayURL)
	}
}

// TestUploadConfigImage_NonGallery_NoDisplayURL verifies that uploading a
// non-gallery (banner) image does NOT generate a displayUrl.
func TestUploadConfigImage_NonGallery_NoDisplayURL(t *testing.T) {
	jpegData := testJPEGBytes(t)
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body, contentType := buildConfigImageMultipart(t, "banner-test-1", "banner", jpegData)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/config-images-upload", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-CSRF-Token", csrfToken)
	req.AddCookie(cookie)

	rec := newRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Image models.ConfigImage `json:"image"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v\nBody: %s", err, rec.Body.String())
	}

	if resp.Image.DisplayURL != nil {
		t.Fatalf("expected displayUrl to be nil for banner image, got %q", *resp.Image.DisplayURL)
	}
}
