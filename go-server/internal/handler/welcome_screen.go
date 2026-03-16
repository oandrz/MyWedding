package handler

import (
	"net/http"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
)

// WelcomeScreenHandler handles welcome screen endpoints.
type WelcomeScreenHandler struct {
	Repo repository.Repository
}

// Get handles GET /api/welcome-screen.
func (h *WelcomeScreenHandler) Get(w http.ResponseWriter, r *http.Request) {
	ws, err := h.Repo.GetWelcomeScreen(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get welcome screen")
		return
	}

	if ws == nil {
		// Return a default welcome screen
		ws = &models.WelcomeScreen{
			ID:            0,
			HeadingText:   "Welcome",
			DeliveryLabel: "Delivery",
			FallbackName:  "Guest",
			Enabled:       true,
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"welcomeScreen": ws,
	})
}

// Update handles PATCH /api/admin/welcome-screen.
func (h *WelcomeScreenHandler) Update(w http.ResponseWriter, r *http.Request) {
	var body models.InsertWelcomeScreen
	if err := parseJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ws, err := h.Repo.UpdateWelcomeScreen(r.Context(), body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update welcome screen")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":       "Welcome screen configuration updated successfully",
		"welcomeScreen": ws,
	})
}
