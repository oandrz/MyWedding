package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)

// InviteHandler handles invite-related endpoints.
type InviteHandler struct {
	Repo      repository.Repository
	Sanitizer *service.Sanitizer
}

// Create handles POST /api/admin/invites.
func (h *InviteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertInvite
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Name == "" {
		writeError(w, r, http.StatusBadRequest, "Name is required")
		return
	}

	if h.Sanitizer != nil {
		body.Name = h.Sanitizer.Sanitize(body.Name)
	}

	invite, err := h.Repo.CreateInvite(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create invite")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"invite": invite,
	})
}

const maxBulkInvites = 500

// BulkCreate handles POST /api/admin/invites/bulk.
func (h *InviteHandler) BulkCreate(w http.ResponseWriter, r *http.Request) {
	var body models.BulkCreateInvitesRequest
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(body.Names) == 0 {
		writeError(w, r, http.StatusBadRequest, "Names array is required and cannot be empty")
		return
	}

	if len(body.Names) > maxBulkInvites {
		writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Cannot import more than %d names at once", maxBulkInvites))
		return
	}

	// Validate and sanitize all names
	inserts := make([]models.InsertInvite, 0, len(body.Names))
	for _, name := range body.Names {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			writeError(w, r, http.StatusBadRequest, "All names must be non-empty")
			return
		}
		if h.Sanitizer != nil {
			trimmed = h.Sanitizer.SanitizeStrict(trimmed)
			if trimmed == "" {
				writeError(w, r, http.StatusBadRequest, "All names must be non-empty")
				return
			}
		}
		inserts = append(inserts, models.InsertInvite{Name: trimmed})
	}

	invites, err := h.Repo.CreateInvitesBulk(r.Context(), inserts)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create invites")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"invites": invites,
	})
}

// List handles GET /api/admin/invites.
func (h *InviteHandler) List(w http.ResponseWriter, r *http.Request) {
	invites, err := h.Repo.GetInvites(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get invites")
		return
	}

	if invites == nil {
		invites = make([]models.Invite, 0)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invites": invites,
	})
}

// GetByCode handles GET /api/invites/{code}.
func (h *InviteHandler) GetByCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")

	invite, err := h.Repo.GetInviteByCode(r.Context(), code)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get invite")
		return
	}

	if invite == nil {
		writeError(w, r, http.StatusNotFound, "Invite not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invite": invite,
	})
}

// Delete handles DELETE /api/admin/invites/{id}.
// Cascade: if the invite has a linked RSVP, delete the RSVP first.
func (h *InviteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	targetInvite, err := h.Repo.GetInviteByID(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check invite")
		return
	}
	if targetInvite == nil {
		writeError(w, r, http.StatusNotFound, "Invite not found")
		return
	}

	// Cascade: delete linked RSVP first
	if targetInvite.RsvpID != nil {
		h.Repo.DeleteRsvp(r.Context(), *targetInvite.RsvpID)
	}

	deleted, err := h.Repo.DeleteInvite(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to delete invite")
		return
	}

	if !deleted {
		writeError(w, r, http.StatusNotFound, "Invite not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Invite deleted successfully",
	})
}
