package handler

import (
	"fmt"
	"net/http"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)

// FeatureFlagHandler handles feature flag endpoints.
type FeatureFlagHandler struct {
	Repo  repository.Repository
	Cache *service.Cache
}

// List handles GET /api/feature-flags (cached).
func (h *FeatureFlagHandler) List(w http.ResponseWriter, r *http.Request) {
	cacheKey := "feature_flags"

	if cached, ok := h.Cache.Get(cacheKey); ok {
		if flags, ok := cached.([]models.FeatureFlag); ok {
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"featureFlags": flags,
			})
			return
		}
	}

	flags, err := h.Repo.GetAllFeatureFlags(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get feature flags")
		return
	}

	if flags == nil {
		flags = make([]models.FeatureFlag, 0)
	}

	h.Cache.Set(cacheKey, flags)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"featureFlags": flags,
	})
}

// Get handles GET /api/feature-flags/{featureKey}.
func (h *FeatureFlagHandler) Get(w http.ResponseWriter, r *http.Request) {
	featureKey := chi.URLParam(r, "featureKey")

	flag, err := h.Repo.GetFeatureFlag(r.Context(), featureKey)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get feature flag")
		return
	}

	if flag == nil {
		writeError(w, r, http.StatusNotFound, "Feature flag not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"featureFlag": flag,
	})
}

// Update handles PATCH /api/admin/feature-flags/{featureKey}.
func (h *FeatureFlagHandler) Update(w http.ResponseWriter, r *http.Request) {
	featureKey := chi.URLParam(r, "featureKey")

	var body struct {
		Enabled *bool `json:"enabled"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Enabled == nil {
		writeError(w, r, http.StatusBadRequest, "Field 'enabled' is required and must be a boolean")
		return
	}

	flag, err := h.Repo.UpdateFeatureFlag(r.Context(), featureKey, *body.Enabled)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update feature flag")
		return
	}

	if flag == nil {
		writeError(w, r, http.StatusNotFound, "Feature flag not found")
		return
	}

	h.Cache.Invalidate("feature_flags")

	status := "enabled"
	if !*body.Enabled {
		status = "disabled"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":     fmt.Sprintf("Feature flag '%s' %s successfully", featureKey, status),
		"featureFlag": flag,
	})
}

// CreateFlag handles POST /api/admin/feature-flags.
func (h *FeatureFlagHandler) CreateFlag(w http.ResponseWriter, r *http.Request) {
	var body models.InsertFeatureFlag
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.FeatureKey == "" {
		writeError(w, r, http.StatusBadRequest, "Feature key is required")
		return
	}

	// Check for duplicate
	existing, err := h.Repo.GetFeatureFlag(r.Context(), body.FeatureKey)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check existing feature flag")
		return
	}

	if existing != nil {
		writeError(w, r, http.StatusConflict, fmt.Sprintf("Feature flag '%s' already exists", body.FeatureKey))
		return
	}

	flag, err := h.Repo.CreateFeatureFlag(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create feature flag")
		return
	}

	h.Cache.Invalidate("feature_flags")

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":     "Feature flag created successfully",
		"featureFlag": flag,
	})
}
