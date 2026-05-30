package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mywedding/platform/internal/models"
	"github.com/mywedding/platform/internal/repository"
	"github.com/mywedding/platform/internal/service"
)

// RsvpHandler handles RSVP-related endpoints.
type RsvpHandler struct {
	Repo      repository.Repository
	Sanitizer *service.Sanitizer
}

// rsvpRequest is the combined request body for both phone-based and code-based RSVP flows.
type rsvpRequest struct {
	Name           string `json:"name"`
	Phone          string `json:"phone"`
	Code           string `json:"code"`
	AttendanceType string `json:"attendanceType"`
	GuestCount     *int   `json:"guestCount"`
}

// Create handles POST /api/rsvp.
func (h *RsvpHandler) Create(w http.ResponseWriter, r *http.Request) {
	if setting, err := h.Repo.GetAppSetting(r.Context(), "rsvp_deadline"); err == nil && setting != nil {
		if deadline, err := time.Parse("2006-01-02", setting.SettingValue); err == nil {
			now := time.Now().UTC()
			today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
			if !today.Before(deadline) {
				writeError(w, r, http.StatusForbidden, "RSVP submissions are closed")
				return
			}
		}
	}

	var body rsvpRequest
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Route based on request body: code present → invite code flow, otherwise → phone flow
	if body.Code != "" {
		h.createWithCode(w, r, body)
	} else {
		h.createWithPhone(w, r, body)
	}
}

func (h *RsvpHandler) createWithPhone(w http.ResponseWriter, r *http.Request, body rsvpRequest) {
	if body.Name == "" || body.Phone == "" {
		writeError(w, r, http.StatusBadRequest, "Name and phone are required")
		return
	}

	normalizedPhone, err := models.NormalizePhone(body.Phone)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid phone: "+err.Error())
		return
	}

	if !models.ValidAttendanceTypes[body.AttendanceType] {
		writeError(w, r, http.StatusBadRequest, "Invalid attendance type. Must be: both, holy_matrimony, reception, or decline")
		return
	}

	if body.AttendanceType == "decline" {
		body.GuestCount = nil
	}

	name := body.Name
	if h.Sanitizer != nil {
		name = h.Sanitizer.Sanitize(name)
	}

	insertData := models.InsertRsvp{
		Name:           name,
		Email:          "",
		Phone:          &normalizedPhone,
		AttendanceType: body.AttendanceType,
		GuestCount:     body.GuestCount,
	}

	existing, err := h.Repo.GetRsvpByPhone(r.Context(), normalizedPhone)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to check existing RSVP")
		return
	}

	if existing != nil {
		updated, err := h.Repo.UpdateRsvp(r.Context(), existing.ID, insertData)
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

	rsvp, err := h.Repo.CreateRsvp(r.Context(), insertData)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create RSVP")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Thank you for your RSVP!",
		"rsvp":    rsvp,
	})
}

func (h *RsvpHandler) createWithCode(w http.ResponseWriter, r *http.Request, body rsvpRequest) {
	if body.Code == "" {
		writeError(w, r, http.StatusBadRequest, "Invite code is required")
		return
	}

	if !models.ValidAttendanceTypes[body.AttendanceType] {
		writeError(w, r, http.StatusBadRequest, "Invalid attendance type. Must be: both, holy_matrimony, reception, or decline")
		return
	}

	if body.AttendanceType == "decline" {
		body.GuestCount = nil
	}

	invite, err := h.Repo.GetInviteByCode(r.Context(), body.Code)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to look up invite")
		return
	}
	if invite == nil {
		writeError(w, r, http.StatusNotFound, "Invalid invite code")
		return
	}

	name := invite.Name
	if h.Sanitizer != nil {
		name = h.Sanitizer.Sanitize(name)
	}

	insertData := models.InsertRsvp{
		Name:           name,
		Email:          "",
		AttendanceType: body.AttendanceType,
		GuestCount:     body.GuestCount,
	}

	if invite.RsvpID != nil {
		updated, err := h.Repo.UpdateRsvp(r.Context(), *invite.RsvpID, insertData)
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

	rsvp, err := h.Repo.CreateRsvp(r.Context(), insertData)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create RSVP")
		return
	}

	if err := h.Repo.UpdateInviteRsvpID(r.Context(), invite.ID, &rsvp.ID); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to link RSVP to invite")
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
	holyMatrimonyCount := 0
	receptionCount := 0

	for _, rsvp := range rsvps {
		if rsvp.IsAttending() {
			attending++
			if rsvp.GuestCount != nil {
				guestCount += *rsvp.GuestCount
			} else {
				guestCount += 1
			}
		} else {
			notAttending++
		}

		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "holy_matrimony" {
			holyMatrimonyCount++
		}
		if rsvp.AttendanceType == "both" || rsvp.AttendanceType == "reception" {
			receptionCount++
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rsvps": rsvps,
		"stats": map[string]int{
			"total":              total,
			"attending":          attending,
			"notAttending":       notAttending,
			"guestCount":         guestCount,
			"holyMatrimonyCount": holyMatrimonyCount,
			"receptionCount":     receptionCount,
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
