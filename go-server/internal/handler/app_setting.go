package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mywedding/platform/internal/models"
	"github.com/mywedding/platform/internal/repository"
)

// AppSettingHandler handles app setting endpoints.
type AppSettingHandler struct {
	Repo repository.Repository
}

// List handles GET /api/app-settings.
func (h *AppSettingHandler) List(w http.ResponseWriter, r *http.Request) {
	settings, err := h.Repo.GetAllAppSettings(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get app settings")
		return
	}

	if settings == nil {
		settings = make([]models.AppSetting, 0)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"settings": settings,
	})
}

// GetMusic handles GET /api/settings/music.
func (h *AppSettingHandler) GetMusic(w http.ResponseWriter, r *http.Request) {
	setting, err := h.Repo.GetAppSetting(r.Context(), "background_music_url")
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get music setting")
		return
	}

	if setting == nil {
		writeJSON(w, http.StatusOK, map[string]string{
			"musicUrl": "/music/wedding-piano.mp3",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"musicUrl": setting.SettingValue,
	})
}

// Get handles GET /api/settings/{settingKey}.
func (h *AppSettingHandler) Get(w http.ResponseWriter, r *http.Request) {
	settingKey := chi.URLParam(r, "settingKey")

	setting, err := h.Repo.GetAppSetting(r.Context(), settingKey)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get app setting")
		return
	}

	if setting == nil {
		writeError(w, r, http.StatusNotFound, "Setting not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"setting": setting,
	})
}

// BulkUpdate handles PATCH /api/admin/app-settings/bulk.
func (h *AppSettingHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Settings []struct {
			SettingKey   string  `json:"settingKey"`
			SettingValue string  `json:"settingValue"`
			SettingType  string  `json:"settingType"`
			Description  *string `json:"description"`
		} `json:"settings"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(body.Settings) == 0 {
		writeError(w, r, http.StatusBadRequest, "Settings array must not be empty")
		return
	}
	if len(body.Settings) > 50 {
		writeError(w, r, http.StatusBadRequest, "Settings array must not exceed 50 items")
		return
	}

	inserts := make([]models.InsertAppSetting, 0, len(body.Settings))
	for _, s := range body.Settings {
		if s.SettingKey == "" {
			writeError(w, r, http.StatusBadRequest, "Each setting must have a non-empty settingKey")
			return
		}
		inserts = append(inserts, models.InsertAppSetting{
			SettingKey:   s.SettingKey,
			SettingValue: s.SettingValue,
			SettingType:  s.SettingType,
			Description:  s.Description,
		})
	}

	updated, err := h.Repo.UpsertAppSettings(r.Context(), inserts)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update app settings")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"updated": updated,
	})
}

// Update handles PATCH /api/admin/app-settings/{settingKey}.
func (h *AppSettingHandler) Update(w http.ResponseWriter, r *http.Request) {
	settingKey := chi.URLParam(r, "settingKey")

	var body struct {
		SettingValue string  `json:"settingValue"`
		SettingType  string  `json:"settingType"`
		Description  *string `json:"description"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.SettingValue == "" {
		writeError(w, r, http.StatusBadRequest, "Setting value is required")
		return
	}

	// Get existing to preserve fields not provided
	existing, err := h.Repo.GetAppSetting(r.Context(), settingKey)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get app setting")
		return
	}

	settingType := body.SettingType
	if settingType == "" && existing != nil {
		settingType = existing.SettingType
	}

	description := body.Description
	if description == nil && existing != nil {
		description = existing.Description
	}

	data := models.InsertAppSetting{
		SettingKey:   settingKey,
		SettingValue: body.SettingValue,
		SettingType:  settingType,
		Description:  description,
	}

	setting, err := h.Repo.UpdateAppSetting(r.Context(), settingKey, data)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update app setting")
		return
	}

	if setting == nil {
		writeError(w, r, http.StatusNotFound, "Setting not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Setting updated successfully",
		"setting": setting,
	})
}
