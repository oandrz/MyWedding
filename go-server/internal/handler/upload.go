package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
)

const (
	maxImageSize = 10 << 20 // 10MB
	maxAudioSize = 20 << 20 // 20MB
)

var allowedImageMIME = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/gif":       true,
	"image/webp":      true,
	"video/mp4":       true,
	"video/quicktime": true,
	"video/x-msvideo": true,
}

var allowedAudioMIME = map[string]bool{
	"audio/mpeg": true,
	"audio/mp3":  true,
	"audio/wav":  true,
	"audio/ogg":  true,
	"audio/webm": true,
}

var validConfigImageTypes = map[string]bool{
	"banner":        true,
	"gallery":       true,
	"bride-profile": true,
	"groom-profile": true,
	"verse-image":   true,
}

// validImageKeyRE restricts imageKey to safe characters only (no path traversal).
var validImageKeyRE = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// UploadHandler handles file upload endpoints.
type UploadHandler struct {
	Repo      repository.Repository
	Storage   service.ObjectStorage
	Cache     *service.Cache
	Sanitizer *service.Sanitizer
}

// Upload handles POST /api/upload — multipart file upload.
func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize)

	if err := r.ParseMultipartForm(maxImageSize); err != nil {
		writeError(w, r, http.StatusBadRequest, "File too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	if !allowedImageMIME[header.Header.Get("Content-Type")] {
		writeError(w, r, http.StatusBadRequest, "Invalid file type. Only images and videos are allowed.")
		return
	}

	name := r.FormValue("name")
	email := r.FormValue("email")
	caption := r.FormValue("caption")

	if h.Sanitizer != nil && caption != "" {
		caption = h.Sanitizer.Sanitize(caption)
	}

	if name == "" || email == "" {
		writeError(w, r, http.StatusBadRequest, "Missing required fields")
		return
	}

	// Detect media type from MIME
	ct := header.Header.Get("Content-Type")
	mediaType := "image"
	if strings.HasPrefix(ct, "video/") {
		mediaType = "video"
	}

	// Generate unique filename
	ext := fileExtension(header.Filename)
	uniqueName := fmt.Sprintf("%d-%s.%s", time.Now().UnixMilli(), randomHex(8), ext)

	isAdmin := email == "admin@wedding.com"
	var dir string
	if isAdmin {
		dir = "admin/gallery"
	} else {
		dir = "uploads"
	}

	fileURL, err := h.Storage.Upload(r.Context(), file, header.Size, uniqueName, ct, dir)
	if err != nil {
		slog.Error("File upload error", "error", err)
		writeError(w, r, http.StatusInternalServerError, "Failed to upload file")
		return
	}

	var captionPtr *string
	if caption != "" {
		captionPtr = &caption
	}

	insertMedia := models.InsertMedia{
		Name:      name,
		Email:     email,
		MediaURL:  fileURL,
		MediaType: &mediaType,
		Caption:   captionPtr,
	}

	media, err := h.Repo.CreateMedia(r.Context(), insertMedia)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create media entry")
		return
	}

	if isAdmin {
		media, _ = h.Repo.UpdateMediaApproval(r.Context(), media.ID, true)
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "File uploaded successfully!",
		"media":   media,
	})
}

// ConfigImageUpload handles POST /api/admin/config-images-upload.
func (h *UploadHandler) ConfigImageUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxImageSize)

	if err := r.ParseMultipartForm(maxImageSize); err != nil {
		writeError(w, r, http.StatusBadRequest, "File too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	ct := header.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		writeError(w, r, http.StatusBadRequest, "Only images are allowed for config images")
		return
	}

	imageKey := r.FormValue("imageKey")
	imageType := r.FormValue("imageType")
	title := r.FormValue("title")
	description := r.FormValue("description")

	if imageKey == "" || imageType == "" {
		writeError(w, r, http.StatusBadRequest, "Image key and type are required")
		return
	}

	if !validImageKeyRE.MatchString(imageKey) {
		writeError(w, r, http.StatusBadRequest, "imageKey must contain only letters, digits, hyphens, and underscores")
		return
	}

	if !validConfigImageTypes[imageType] {
		writeError(w, r, http.StatusBadRequest, "Invalid image type. Must be one of: banner, gallery, bride-profile, groom-profile, verse-image")
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to read file")
		return
	}

	ext := fileExtension(header.Filename)
	uniqueName := fmt.Sprintf("%s-%d.%s", imageKey, time.Now().UnixMilli(), ext)

	imageURL, err := h.Storage.UploadAdminImage(r.Context(), bytes.NewReader(data), int64(len(data)), uniqueName, ct, imageType)
	if err != nil {
		slog.Error("Config image upload error", "error", err)
		writeError(w, r, http.StatusInternalServerError, "Failed to upload config image")
		return
	}

	// Generate thumbnail for gallery images
	var thumbnailURL *string
	if imageType == "gallery" {
		opt, err := service.OptimizeImage(data, 600, 80)
		if err == nil {
			thumbName := service.GenerateThumbnailFilename(uniqueName)
			thumbURL, err := h.Storage.Upload(r.Context(), bytes.NewReader(opt.ThumbnailBuffer), int64(len(opt.ThumbnailBuffer)), thumbName, opt.ThumbnailContentType, "admin/gallery/thumbnails")
			if err == nil {
				thumbnailURL = &thumbURL
				slog.Debug("Generated thumbnail", "url", thumbURL)
			}
		} else {
			slog.Warn("Thumbnail generation failed, using original", "error", err)
		}
	}

	isActive := true
	insertData := models.InsertConfigImage{
		ImageKey:     imageKey,
		ImageURL:     imageURL,
		ThumbnailURL: thumbnailURL,
		ImageType:    imageType,
		IsActive:     &isActive,
	}
	if title != "" {
		insertData.Title = &title
	}
	if description != "" {
		insertData.Description = &description
	}

	existing, _ := h.Repo.GetConfigImage(r.Context(), imageKey)
	var img *models.ConfigImage
	if existing != nil {
		img, err = h.Repo.UpdateConfigImage(r.Context(), imageKey, insertData)
	} else {
		img, err = h.Repo.CreateConfigImage(r.Context(), insertData)
	}
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to save config image")
		return
	}

	h.Cache.InvalidateAll()

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Config image uploaded successfully",
		"image":   img,
	})
}

type signedURLRequest struct {
	ImageKey  string `json:"imageKey"`
	ImageType string `json:"imageType"`
	Filename  string `json:"filename"`
}

type signedURLResponse struct {
	SignedURL   string `json:"signedUrl"`
	StoragePath string `json:"storagePath"`
}

// GetSignedUploadURL handles POST /api/admin/upload/signed-url.
// Returns a time-limited Supabase signed URL so the browser can PUT the
// image binary directly to Supabase, bypassing the CloudFront WAF.
func (h *UploadHandler) GetSignedUploadURL(w http.ResponseWriter, r *http.Request) {
	var req signedURLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ImageKey == "" || req.ImageType == "" || req.Filename == "" {
		writeError(w, r, http.StatusBadRequest, "imageKey, imageType, and filename are required")
		return
	}
	if !validImageKeyRE.MatchString(req.ImageKey) {
		writeError(w, r, http.StatusBadRequest, "imageKey must contain only letters, digits, hyphens, and underscores")
		return
	}
	if !validConfigImageTypes[req.ImageType] {
		writeError(w, r, http.StatusBadRequest, "Invalid image type. Must be one of: banner, gallery, bride-profile, groom-profile, verse-image")
		return
	}

	ext := fileExtension(req.Filename)
	if ext == "" {
		ext = "jpg"
	}
	uniqueName := fmt.Sprintf("%s-%d.%s", req.ImageKey, time.Now().UnixMilli(), ext)
	storagePath := service.AdminImageDirectory(req.ImageType) + "/" + uniqueName

	signedURL, err := h.Storage.CreateSignedUploadURL(r.Context(), storagePath)
	if err != nil {
		slog.Error("Failed to create signed upload URL", "error", err)
		writeError(w, r, http.StatusInternalServerError, "Failed to create upload URL")
		return
	}

	writeJSON(w, http.StatusOK, signedURLResponse{
		SignedURL:   signedURL,
		StoragePath: storagePath,
	})
}

type completeUploadRequest struct {
	StoragePath string `json:"storagePath"`
	ImageKey    string `json:"imageKey"`
	ImageType   string `json:"imageType"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

// CompleteConfigImageUpload handles POST /api/admin/upload/complete.
// Called after the browser has PUT the image binary directly to Supabase.
// Downloads the uploaded image, generates a thumbnail for gallery images,
// and upserts the ConfigImage database record.
func (h *UploadHandler) CompleteConfigImageUpload(w http.ResponseWriter, r *http.Request) {
	var req completeUploadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.StoragePath == "" || req.ImageKey == "" || req.ImageType == "" {
		writeError(w, r, http.StatusBadRequest, "storagePath, imageKey, and imageType are required")
		return
	}
	if !validConfigImageTypes[req.ImageType] {
		writeError(w, r, http.StatusBadRequest, "Invalid image type. Must be one of: banner, gallery, bride-profile, groom-profile, verse-image")
		return
	}

	imageURL := "/storage/" + req.StoragePath

	var thumbnailURL *string
	if req.ImageType == "gallery" {
		data, err := h.Storage.DownloadBuffer(r.Context(), req.StoragePath)
		if err != nil {
			slog.Warn("Failed to download uploaded image for thumbnailing", "error", err)
		} else {
			opt, err := service.OptimizeImage(data, 600, 80)
			if err == nil {
				base := req.StoragePath[strings.LastIndex(req.StoragePath, "/")+1:]
				thumbName := service.GenerateThumbnailFilename(base)
				thumbURL, err := h.Storage.Upload(r.Context(), bytes.NewReader(opt.ThumbnailBuffer), int64(len(opt.ThumbnailBuffer)), thumbName, opt.ThumbnailContentType, "admin/gallery/thumbnails")
				if err == nil {
					thumbnailURL = &thumbURL
					slog.Debug("Generated thumbnail", "url", thumbURL)
				} else {
					slog.Warn("Thumbnail upload failed, proceeding without thumbnail", "error", err)
				}
			} else {
				slog.Warn("Thumbnail generation failed, proceeding without thumbnail", "error", err)
			}
		}
	}

	isActive := true
	insertData := models.InsertConfigImage{
		ImageKey:     req.ImageKey,
		ImageURL:     imageURL,
		ThumbnailURL: thumbnailURL,
		ImageType:    req.ImageType,
		IsActive:     &isActive,
	}
	if req.Title != "" {
		insertData.Title = &req.Title
	}
	if req.Description != "" {
		insertData.Description = &req.Description
	}

	existing, _ := h.Repo.GetConfigImage(r.Context(), req.ImageKey)
	var img *models.ConfigImage
	var err error
	if existing != nil {
		img, err = h.Repo.UpdateConfigImage(r.Context(), req.ImageKey, insertData)
	} else {
		img, err = h.Repo.CreateConfigImage(r.Context(), insertData)
	}
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to save config image")
		return
	}

	h.Cache.InvalidateAll()

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Config image uploaded successfully",
		"image":   img,
	})
}

// MusicUpload handles POST /api/admin/settings/music-upload.
func (h *UploadHandler) MusicUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAudioSize)

	if err := r.ParseMultipartForm(maxAudioSize); err != nil {
		writeError(w, r, http.StatusBadRequest, "File too large (max 20MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "No file uploaded")
		return
	}
	defer file.Close()

	ct := header.Header.Get("Content-Type")
	if !allowedAudioMIME[ct] {
		writeError(w, r, http.StatusBadRequest, "Only audio files are allowed")
		return
	}

	ext := fileExtension(header.Filename)
	uniqueName := fmt.Sprintf("background-music-%d.%s", time.Now().UnixMilli(), ext)

	musicURL, err := h.Storage.Upload(r.Context(), file, header.Size, uniqueName, ct, "admin/music")
	if err != nil {
		slog.Error("Music upload error", "error", err)
		writeError(w, r, http.StatusInternalServerError, "Failed to upload music file")
		return
	}

	settingData := models.InsertAppSetting{
		SettingKey:   "background_music_url",
		SettingValue: musicURL,
		SettingType:  "audio",
	}
	desc := "Background music file URL"
	settingData.Description = &desc

	existing, _ := h.Repo.GetAppSetting(r.Context(), "background_music_url")
	var setting *models.AppSetting
	if existing != nil {
		setting, err = h.Repo.UpdateAppSetting(r.Context(), "background_music_url", settingData)
	} else {
		setting, err = h.Repo.CreateAppSetting(r.Context(), settingData)
	}
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to save music setting")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":  "Background music uploaded successfully",
		"setting":  setting,
		"musicUrl": musicURL,
	})
}

// ServeStorage handles GET /storage/* — stream files from object storage.
func (h *UploadHandler) ServeStorage(w http.ResponseWriter, r *http.Request) {
	// Extract everything after /storage/
	path := strings.TrimPrefix(r.URL.Path, "/storage/")
	if path == "" {
		writeError(w, r, http.StatusBadRequest, "No file path specified")
		return
	}

	if err := h.Storage.Download(r.Context(), path, w); err != nil {
		slog.Error("Error serving file", "path", path, "error", err)
		if !headersSent(w) {
			writeError(w, r, http.StatusInternalServerError, "Error serving file")
		}
	}
}

func fileExtension(filename string) string {
	if idx := strings.LastIndex(filename, "."); idx >= 0 {
		return filename[idx+1:]
	}
	return ""
}

func randomHex(n int) string {
	const hex = "0123456789abcdef"
	b := make([]byte, n)
	for i := range b {
		b[i] = hex[time.Now().UnixNano()%16]
	}
	return string(b)
}

// headersSent is a best-effort check — once WriteHeader is called we can't change status.
func headersSent(w http.ResponseWriter) bool {
	// http.ResponseWriter doesn't expose this directly; we rely on the fact
	// that if Download already set headers and wrote data, the error path
	// should not try to write again. This is a no-op safeguard.
	return false
}
