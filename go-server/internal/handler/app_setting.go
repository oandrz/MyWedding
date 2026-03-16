package handler

import (
	"net/http"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/go-chi/chi/v5"
)

// AppSettingHandler handles app setting endpoints.
type AppSettingHandler struct {
	Repo repository.Repository
}

// List handles GET /api/app-settings.
func (h *AppSettingHandler) List(w http.ResponseWriter, r *http.Request) {
	settings, err := h.Repo.GetAllAppSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get app settings")
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
		writeError(w, http.StatusInternalServerError, "Failed to get music setting")
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
		writeError(w, http.StatusInternalServerError, "Failed to get app setting")
		return
	}

	if setting == nil {
		writeError(w, http.StatusNotFound, "Setting not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"setting": setting,
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
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.SettingValue == "" {
		writeError(w, http.StatusBadRequest, "Setting value is required")
		return
	}

	// Get existing to preserve fields not provided
	existing, err := h.Repo.GetAppSetting(r.Context(), settingKey)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get app setting")
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
		writeError(w, http.StatusInternalServerError, "Failed to update app setting")
		return
	}

	if setting == nil {
		writeError(w, http.StatusNotFound, "Setting not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Setting updated successfully",
		"setting": setting,
	})
}
