package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/mywedding/platform/internal/models"
	"github.com/mywedding/platform/internal/repository"
)

// ScheduleHandler handles schedule event endpoints.
type ScheduleHandler struct {
	Repo repository.Repository
}

// List handles GET /api/schedule.
func (h *ScheduleHandler) List(w http.ResponseWriter, r *http.Request) {
	events, err := h.Repo.GetScheduleEvents(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get schedule events")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"scheduleEvents": events,
	})
}

// Create handles POST /api/admin/schedule.
func (h *ScheduleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertScheduleEvent
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Title == "" || body.Time == "" || body.Description == "" {
		writeError(w, r, http.StatusBadRequest, "title, time, and description are required")
		return
	}

	event, err := h.Repo.CreateScheduleEvent(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create schedule event")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message":       "Schedule event created successfully",
		"scheduleEvent": event,
	})
}

// Update handles PUT /api/admin/schedule/{id}.
func (h *ScheduleHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid event ID")
		return
	}

	var body models.UpdateScheduleEvent
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Title == "" || body.Time == "" || body.Description == "" {
		writeError(w, r, http.StatusBadRequest, "title, time, and description are required")
		return
	}

	event, err := h.Repo.UpdateScheduleEvent(r.Context(), id, body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update schedule event")
		return
	}
	if event == nil {
		writeError(w, r, http.StatusNotFound, "Schedule event not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":       "Schedule event updated successfully",
		"scheduleEvent": event,
	})
}

// Delete handles DELETE /api/admin/schedule/{id}.
func (h *ScheduleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid event ID")
		return
	}

	deleted, err := h.Repo.DeleteScheduleEvent(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to delete schedule event")
		return
	}
	if !deleted {
		writeError(w, r, http.StatusNotFound, "Schedule event not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Schedule event deleted successfully",
	})
}

// Reorder handles PATCH /api/admin/schedule/reorder.
func (h *ScheduleHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Events []models.ScheduleOrderItem `json:"events"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(body.Events) == 0 {
		writeError(w, r, http.StatusBadRequest, "events array is required")
		return
	}

	if err := h.Repo.ReorderScheduleEvents(r.Context(), body.Events); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to reorder schedule events")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Schedule events reordered successfully",
	})
}
