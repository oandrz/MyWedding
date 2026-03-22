package handler

import (
	"net/http"
	"strconv"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)

// RsvpHandler handles RSVP-related endpoints.
type RsvpHandler struct {
	Repo      repository.Repository
	Sanitizer *service.Sanitizer
}

// Create handles POST /api/rsvp.
func (h *RsvpHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertRsvp
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Name == "" || body.Email == "" {
		writeError(w, r, http.StatusBadRequest, "Name and email are required")
		return
	}

	if h.Sanitizer != nil {
		body.Name = h.Sanitizer.Sanitize(body.Name)
	}

	// Check if RSVP already exists for this email
	existing, err := h.Repo.GetRsvpByEmail(r.Context(), body.Email)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check existing RSVP")
		return
	}

	if existing != nil {
		// Update existing RSVP
		updated, err := h.Repo.UpdateRsvp(r.Context(), existing.ID, body)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "Failed to update RSVP")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"message": "Your RSVP has been updated successfully!",
			"rsvp":    updated,
		})
		return
	}

	// Create new RSVP
	rsvp, err := h.Repo.CreateRsvp(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create RSVP")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Thank you for your RSVP!",
		"rsvp":    rsvp,
	})
}

// List handles GET /api/rsvp.
func (h *RsvpHandler) List(w http.ResponseWriter, r *http.Request) {
	rsvps, err := h.Repo.GetRsvps(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get RSVPs")
		return
	}

	if rsvps == nil {
		rsvps = make([]models.Rsvp, 0)
	}

	// Calculate stats
	total := len(rsvps)
	attending := 0
	notAttending := 0
	guestCount := 0

	for _, rsvp := range rsvps {
		if rsvp.Attending {
			attending++
			if rsvp.GuestCount != nil {
				guestCount += *rsvp.GuestCount
			} else {
				guestCount += 1
			}
		} else {
			notAttending++
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rsvps": rsvps,
		"stats": map[string]int{
			"total":        total,
			"attending":    attending,
			"notAttending": notAttending,
			"guestCount":   guestCount,
		},
	})
}

// GetByEmail handles GET /api/rsvp/{email}.
func (h *RsvpHandler) GetByEmail(w http.ResponseWriter, r *http.Request) {
	email := chi.URLParam(r, "email")

	rsvp, err := h.Repo.GetRsvpByEmail(r.Context(), email)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get RSVP")
		return
	}

	if rsvp == nil {
		writeError(w, r, http.StatusNotFound, "RSVP not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rsvp": rsvp,
	})
}

// Check handles GET /api/rsvp/check?name=...
func (h *RsvpHandler) Check(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		writeError(w, r, http.StatusBadRequest, "Name query parameter is required")
		return
	}

	rsvp, err := h.Repo.GetRsvpByName(r.Context(), name)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check RSVP")
		return
	}

	if rsvp == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"exists": false,
			"rsvp":   nil,
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"exists": true,
		"rsvp":   rsvp,
	})
}

// Delete handles DELETE /api/rsvp/{id}.
func (h *RsvpHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid RSVP ID")
		return
	}

	deleted, err := h.Repo.DeleteRsvp(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to delete RSVP")
		return
	}

	if !deleted {
		writeError(w, r, http.StatusNotFound, "RSVP not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "RSVP deleted successfully",
	})
}
