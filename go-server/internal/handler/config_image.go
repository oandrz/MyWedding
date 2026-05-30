package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mywedding/platform/internal/models"
	"github.com/mywedding/platform/internal/repository"
	"github.com/mywedding/platform/internal/service"
)

// ConfigImageHandler handles config image endpoints.
type ConfigImageHandler struct {
	Repo  repository.Repository
	Cache *service.Cache
}

// ListAll handles GET /api/config-images (cached).
func (h *ConfigImageHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	cacheKey := "config_images_all"

	if cached, ok := h.Cache.Get(cacheKey); ok {
		if images, ok := cached.([]models.ConfigImage); ok {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"images": images,
			})
			return
		}
	}

	images, err := h.Repo.GetAllConfigImages(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get config images")
		return
	}

	if images == nil {
		images = make([]models.ConfigImage, 0)
	}

	h.Cache.Set(cacheKey, images)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"images": images,
	})
}

// ListByType handles GET /api/config-images/{type} (cached).
func (h *ConfigImageHandler) ListByType(w http.ResponseWriter, r *http.Request) {
	imageType := chi.URLParam(r, "type")
	cacheKey := "config_images_" + imageType

	if cached, ok := h.Cache.Get(cacheKey); ok {
		if images, ok := cached.([]models.ConfigImage); ok {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"images": images,
			})
			return
		}
	}

	images, err := h.Repo.GetConfigImagesByType(r.Context(), imageType)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get config images")
		return
	}

	if images == nil {
		images = make([]models.ConfigImage, 0)
	}

	h.Cache.Set(cacheKey, images)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"images": images,
	})
}

// Create handles POST /api/admin/config-images.
func (h *ConfigImageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertConfigImage
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.ImageKey == "" || body.ImageURL == "" || body.ImageType == "" {
		writeError(w, r, http.StatusBadRequest, "imageKey, imageUrl, and imageType are required")
		return
	}

	// Upsert: check if imageKey already exists
	existing, err := h.Repo.GetConfigImage(r.Context(), body.ImageKey)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check existing config image")
		return
	}

	var image *models.ConfigImage
	if existing != nil {
		image, err = h.Repo.UpdateConfigImage(r.Context(), body.ImageKey, body)
	} else {
		image, err = h.Repo.CreateConfigImage(r.Context(), body)
	}

	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to save config image")
		return
	}

	h.invalidateCache()

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Image configuration updated successfully",
		"image":   image,
	})
}

// Update handles PUT /api/admin/config-images/{imageKey}.
func (h *ConfigImageHandler) Update(w http.ResponseWriter, r *http.Request) {
	imageKey := chi.URLParam(r, "imageKey")

	var body models.InsertConfigImage
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	body.ImageKey = imageKey

	image, err := h.Repo.UpdateConfigImage(r.Context(), imageKey, body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update config image")
		return
	}

	if image == nil {
		writeError(w, r, http.StatusNotFound, "Config image not found")
		return
	}

	h.invalidateCache()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Image configuration updated successfully",
		"image":   image,
	})
}

// Reorder handles PUT /api/admin/config-images-reorder.
func (h *ConfigImageHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ImageType   string   `json:"imageType"`
		OrderedKeys []string `json:"orderedKeys"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.ImageType == "" || len(body.OrderedKeys) == 0 {
		writeError(w, r, http.StatusBadRequest, "imageType and orderedKeys are required")
		return
	}

	err := h.Repo.ReorderConfigImages(r.Context(), body.ImageType, body.OrderedKeys)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to reorder config images")
		return
	}

	h.invalidateCache()

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Images reordered successfully",
	})
}

// Delete handles DELETE /api/admin/config-images/{imageKey}.
func (h *ConfigImageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	imageKey := chi.URLParam(r, "imageKey")

	deleted, err := h.Repo.DeleteConfigImage(r.Context(), imageKey)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to delete config image")
		return
	}

	if !deleted {
		writeError(w, r, http.StatusNotFound, "Config image not found")
		return
	}

	h.invalidateCache()

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Config image deleted successfully",
	})
}

// invalidateCache clears all config image cache entries.
func (h *ConfigImageHandler) invalidateCache() {
	h.Cache.InvalidateAll()
}
