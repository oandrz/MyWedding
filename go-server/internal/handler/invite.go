package handler

import (
	"encoding/json"
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

	// Validate and normalize phone if provided
	if body.Phone != nil && *body.Phone != "" {
		normalized, err := models.NormalizePhone(*body.Phone)
		if err != nil {
			writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Invalid phone: %s", err.Error()))
			return
		}
		body.Phone = &normalized
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

	// Support both formats: new "invites" array and legacy "names" array
	entries := body.Invites
	if len(entries) == 0 && len(body.Names) > 0 {
		entries = make([]models.BulkInviteEntry, len(body.Names))
		for i, name := range body.Names {
			entries[i] = models.BulkInviteEntry{Name: name}
		}
	}

	if len(entries) == 0 {
		writeError(w, r, http.StatusBadRequest, "Invites array is required and cannot be empty")
		return
	}

	if len(entries) > maxBulkInvites {
		writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Cannot import more than %d invites at once", maxBulkInvites))
		return
	}

	inserts := make([]models.InsertInvite, 0, len(entries))
	for _, entry := range entries {
		trimmed := strings.TrimSpace(entry.Name)
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

		insert := models.InsertInvite{Name: trimmed}

		// Validate and normalize phone if provided.
		// Invalid phones are silently skipped (stored as NULL) — can be fixed via inline edit.
		if entry.Phone != nil && *entry.Phone != "" {
			normalized, err := models.NormalizePhone(*entry.Phone)
			if err == nil {
				insert.Phone = &normalized
			}
		}

		inserts = append(inserts, insert)
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

	// Strip PII — phone and waSentAt are admin-only fields
	invite.Phone = nil
	invite.WaSentAt = nil

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

// Update handles PATCH /api/admin/invites/{id}.
// Partial update — uses json.RawMessage to distinguish between "phone": null (clear) and absent phone.
// When "name" is present, "phone" must also be present; both are updated via UpdateInvite.
// When only "phone" is present, UpdateInvitePhone is used (backward compat).
func (h *InviteHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	var raw map[string]json.RawMessage
	if err := parseJSON(r, &raw); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	nameRaw, namePresent := raw["name"]
	phoneRaw, phonePresent := raw["phone"]

	if !namePresent && !phonePresent {
		writeError(w, r, http.StatusBadRequest, "No updatable fields provided")
		return
	}

	// Parse phone (shared by both paths).
	var phone *string
	if phonePresent {
		if string(phoneRaw) == "null" {
			phone = nil
		} else {
			var phoneVal string
			if err := json.Unmarshal(phoneRaw, &phoneVal); err != nil {
				writeError(w, r, http.StatusBadRequest, "Invalid phone value")
				return
			}
			if phoneVal != "" {
				normalized, err := models.NormalizePhone(phoneVal)
				if err != nil {
					writeError(w, r, http.StatusBadRequest, fmt.Sprintf("Invalid phone: %s", err.Error()))
					return
				}
				phone = &normalized
			}
		}
	}

	if namePresent {
		if !phonePresent {
			writeError(w, r, http.StatusBadRequest, "phone is required when name is provided")
			return
		}
		var nameVal string
		if err := json.Unmarshal(nameRaw, &nameVal); err != nil {
			writeError(w, r, http.StatusBadRequest, "Invalid name value")
			return
		}
		nameVal = strings.TrimSpace(nameVal)
		if nameVal == "" {
			writeError(w, r, http.StatusBadRequest, "name cannot be empty")
			return
		}
		invite, err := h.Repo.UpdateInvite(r.Context(), id, nameVal, phone)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				writeError(w, r, http.StatusNotFound, "Invite not found")
				return
			}
			writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"invite": invite})
		return
	}

	// Backward compat: phone-only update.
	invite, err := h.Repo.UpdateInvitePhone(r.Context(), id, phone)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to update invite")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"invite": invite})
}

// MarkWaSent handles PUT /api/admin/invites/{id}/wa-sent.
func (h *InviteHandler) MarkWaSent(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	invite, err := h.Repo.MarkInviteWaSent(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to mark invite as sent")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invite": invite,
	})
}

// UnmarkWaSent handles DELETE /api/admin/invites/{id}/wa-sent.
func (h *InviteHandler) UnmarkWaSent(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid invite ID")
		return
	}

	invite, err := h.Repo.UnmarkInviteWaSent(r.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Invite not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to unmark invite sent status")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"invite": invite,
	})
}
