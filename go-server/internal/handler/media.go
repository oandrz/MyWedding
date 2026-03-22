package handler

import (
	"net/http"
	"strconv"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/go-chi/chi/v5"
)

// MediaHandler handles media-related endpoints.
type MediaHandler struct {
	Repo repository.Repository
}

// Create handles POST /api/media.
func (h *MediaHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertMedia
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Name == "" || body.Email == "" || body.MediaURL == "" {
		writeError(w, r, http.StatusBadRequest, "Name, email, and mediaUrl are required")
		return
	}

	// Auto-detect media type if not provided
	if body.MediaType == nil {
		detected := detectMediaType(body.MediaURL)
		body.MediaType = &detected
	}

	media, err := h.Repo.CreateMedia(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create media")
		return
	}

	// Auto-approve admin uploads
	if body.Email == "admin@wedding.com" {
		media, err = h.Repo.UpdateMediaApproval(r.Context(), media.ID, true)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "Failed to approve media")
			return
		}
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Thank you for sharing your memory!",
		"media":   media,
	})
}

// ListApproved handles GET /api/media.
func (h *MediaHandler) ListApproved(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	media, total, err := h.Repo.GetApprovedMediaPaginated(r.Context(), limit, offset)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get media")
		return
	}

	// Filter out admin@wedding.com entries
	filtered := make([]models.Media, 0)
	for _, m := range media {
		if m.Email != "admin@wedding.com" {
			filtered = append(filtered, m)
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"media":  filtered,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// ListAll handles GET /api/admin/media.
func (h *MediaHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	media, err := h.Repo.GetAllMedia(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get media")
		return
	}

	if media == nil {
		media = make([]models.Media, 0)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"media": media,
	})
}

// UpdateApproval handles PATCH /api/admin/media/{id}.
func (h *MediaHandler) UpdateApproval(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid media ID")
		return
	}

	var body struct {
		Approved *bool `json:"approved"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Approved == nil {
		writeError(w, r, http.StatusBadRequest, "Field 'approved' is required")
		return
	}

	media, err := h.Repo.UpdateMediaApproval(r.Context(), id, *body.Approved)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update media approval")
		return
	}

	if media == nil {
		writeError(w, r, http.StatusNotFound, "Media not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Media approval updated successfully",
		"media":   media,
	})
}
