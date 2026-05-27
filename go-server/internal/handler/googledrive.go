package handler

import (
	"io"
	"log/slog"
	"net/http"

	"github.com/andreasronaldo/wedding-server/internal/service"
)

// GoogleDriveHandler handles Google Drive integration endpoints.
type GoogleDriveHandler struct {
	Drive *service.GoogleDriveService
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
	if _, err := io.Copy(w, body); err != nil {
		slog.Error("Thumbnail stream interrupted", "fileID", fileID, "error", err)
	}
}
