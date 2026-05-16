package handler

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
)

// GoogleDriveHandler handles Google Drive integration endpoints.
type GoogleDriveHandler struct {
	Repo  repository.Repository
	Drive *service.GoogleDriveService
}

// GetAuthURL handles GET /api/google-auth-url.
func (h *GoogleDriveHandler) GetAuthURL(w http.ResponseWriter, r *http.Request) {
	authURL := h.Drive.GetAuthURL()
	writeJSON(w, http.StatusOK, map[string]string{"authUrl": authURL})
}

// AuthCallback handles GET /auth/google/callback.
func (h *GoogleDriveHandler) AuthCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Authorization code missing", http.StatusBadRequest)
		return
	}

	tokens, err := h.Drive.HandleAuthCallback(r.Context(), code)
	if err != nil {
		slog.Error("OAuth callback error", "error", err)
		http.Error(w, "Authorization failed", http.StatusInternalServerError)
		return
	}

	// Persist refresh token to DB so future server restarts load it automatically.
	// Google only returns a refresh token on first auth or when prompt=consent is used.
	if tokens.RefreshToken != "" {
		desc := "Google OAuth2 refresh token — auto-saved after authorization"
		if _, saveErr := h.Repo.UpsertAppSettings(r.Context(), []models.InsertAppSetting{
			{
				SettingKey:   "google_refresh_token",
				SettingValue: tokens.RefreshToken,
				SettingType:  "string",
				Description:  &desc,
			},
		}); saveErr != nil {
			slog.Warn("Failed to persist Google refresh token to database", "error", saveErr)
		} else {
			slog.Info("Google refresh token saved to database")
		}
	}

	w.Header().Set("Content-Type", "text/html")
	fmt.Fprintf(w, `<html><body>
		<h2>Google Drive Authorization Successful!</h2>
		<p>The refresh token has been saved automatically — no manual steps needed.</p>
		<p>You can close this window.</p>
	</body></html>`)
}

// UploadToDrive handles POST /api/upload-to-drive.
func (h *GoogleDriveHandler) UploadToDrive(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, r, http.StatusBadRequest, "File too large")
		return
	}

	guestName := r.FormValue("guestName")

	// Get all files from the multipart form
	form := r.MultipartForm
	if form == nil || form.File["files"] == nil {
		writeError(w, r, http.StatusBadRequest, "No files uploaded")
		return
	}

	files := form.File["files"]
	type uploadResult struct {
		Filename    string `json:"filename"`
		Success     bool   `json:"success"`
		FileID      string `json:"fileId,omitempty"`
		WebViewLink string `json:"webViewLink,omitempty"`
		MediaID     int    `json:"mediaId,omitempty"`
		Error       string `json:"error,omitempty"`
	}

	var results []uploadResult

	for _, fh := range files {
		file, err := fh.Open()
		if err != nil {
			results = append(results, uploadResult{
				Filename: fh.Filename,
				Success:  false,
				Error:    err.Error(),
			})
			continue
		}

		data, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			results = append(results, uploadResult{
				Filename: fh.Filename,
				Success:  false,
				Error:    err.Error(),
			})
			continue
		}

		fileID, webViewLink, err := h.Drive.UploadFile(
			r.Context(), data, fh.Filename, fh.Header.Get("Content-Type"), guestName,
		)
		if err != nil {
			slog.Error("Google Drive upload failed", "file", fh.Filename, "error", err)
			results = append(results, uploadResult{
				Filename: fh.Filename,
				Success:  false,
				Error:    err.Error(),
			})
			continue
		}

		// Create media entry
		directURL := fmt.Sprintf("https://drive.google.com/uc?export=view&id=%s", fileID)
		mediaType := service.DetectMediaTypeFromMIME(fh.Header.Get("Content-Type"))
		caption := "Shared via Google Drive"
		name := guestName
		if name == "" {
			name = "Wedding Guest"
		}

		mediaEntry, err := h.Repo.CreateMedia(r.Context(), models.InsertMedia{
			Name:      name,
			Email:     "guest@wedding.com",
			MediaURL:  directURL,
			MediaType: &mediaType,
			Caption:   &caption,
		})

		var mediaID int
		if err == nil && mediaEntry != nil {
			// Auto-approve Google Drive uploads
			h.Repo.UpdateMediaApproval(r.Context(), mediaEntry.ID, true)
			mediaID = mediaEntry.ID
		}

		results = append(results, uploadResult{
			Filename:    fh.Filename,
			Success:     true,
			FileID:      fileID,
			WebViewLink: webViewLink,
			MediaID:     mediaID,
		})
	}

	successCount := 0
	failCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		} else {
			failCount++
		}
	}

	msg := fmt.Sprintf("Successfully uploaded %d file(s)", successCount)
	if failCount > 0 {
		msg += fmt.Sprintf(", %d failed", failCount)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":      msg,
		"successCount": successCount,
		"results":      results,
	})
}

// GetDriveFolderContents handles GET /api/drive-folder-contents.
func (h *GoogleDriveHandler) GetDriveFolderContents(w http.ResponseWriter, r *http.Request) {
	files, err := h.Drive.GetFolderContents(r.Context())
	if err != nil {
		slog.Error("Error fetching Drive contents", "error", err)
		writeError(w, r, http.StatusInternalServerError, "Failed to fetch folder contents")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"files": files})
}

// GetThumbnail proxies a Drive file thumbnail through the server so guest
// browsers don't need Google authentication.
// GET /api/drive-thumbnail?id={fileID}&sz=w800
func (h *GoogleDriveHandler) GetThumbnail(w http.ResponseWriter, r *http.Request) {
	fileID := r.URL.Query().Get("id")
	if fileID == "" {
		writeError(w, r, http.StatusBadRequest, "id parameter required")
		return
	}
	size := r.URL.Query().Get("sz")
	if size == "" {
		size = "w800"
	}

	body, contentType, err := h.Drive.GetThumbnailReader(r.Context(), fileID, size)
	if err != nil {
		slog.Error("Thumbnail proxy failed", "fileID", fileID, "error", err)
		http.Error(w, "thumbnail unavailable", http.StatusBadGateway)
		return
	}
	defer body.Close()

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	io.Copy(w, body)
}
