package handler

import (
	"net/http"
	"strings"

	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)

// WAHandler handles WhatsApp automation endpoints.
type WAHandler struct {
	WA service.WhatsAppServicer
}

// SessionStatus handles GET /api/admin/wa/session.
// Returns the connection status for both groom and bride sides.
func (h *WAHandler) SessionStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"groom": h.WA.SessionStatus("groom"),
		"bride": h.WA.SessionStatus("bride"),
	})
}

// Connect handles POST /api/admin/wa/connect/{side}.
// Initiates a WhatsApp session for the given side.
func (h *WAHandler) Connect(w http.ResponseWriter, r *http.Request) {
	side := chi.URLParam(r, "side")
	if side != "groom" && side != "bride" {
		writeError(w, r, http.StatusBadRequest, "side must be 'groom' or 'bride'")
		return
	}

	if err := h.WA.Connect(r.Context(), side); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to connect WhatsApp session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"session": h.WA.SessionStatus(side),
	})
}

// Disconnect handles DELETE /api/admin/wa/connect/{side}.
// Terminates a WhatsApp session for the given side.
func (h *WAHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	side := chi.URLParam(r, "side")
	if side != "groom" && side != "bride" {
		writeError(w, r, http.StatusBadRequest, "side must be 'groom' or 'bride'")
		return
	}

	if err := h.WA.Disconnect(side); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to disconnect WhatsApp session")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"session": h.WA.SessionStatus(side),
	})
}

// SendAll handles POST /api/admin/wa/send-all.
// Starts a bulk send job. Returns 409 if a job is already running.
func (h *WAHandler) SendAll(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Messages []service.WAMessage `json:"messages"`
		DelayMin int                 `json:"delayMin"`
		DelayMax int                 `json:"delayMax"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	jobID, err := h.WA.StartSendJob(body.Messages, body.DelayMin, body.DelayMax)
	if err != nil {
		if strings.HasPrefix(err.Error(), "job_already_running:") {
			existingID := strings.TrimPrefix(err.Error(), "job_already_running:")
			writeJSON(w, http.StatusConflict, map[string]string{
				"error": "job_already_running",
				"jobId": existingID,
			})
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to start send job")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"jobId": jobID,
	})
}

// ActiveJob handles GET /api/admin/wa/job/active.
// Returns the currently active job snapshot, or literal null if none.
func (h *WAHandler) ActiveJob(w http.ResponseWriter, r *http.Request) {
	job := h.WA.ActiveJob()
	if job == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("null"))
		return
	}
	writeJSON(w, http.StatusOK, job.Snapshot())
}

// GetJob handles GET /api/admin/wa/job/{id}.
// Returns the job snapshot for the given job ID.
func (h *WAHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	job := h.WA.GetJob(jobID)
	if job == nil {
		writeError(w, r, http.StatusNotFound, "Job not found")
		return
	}
	writeJSON(w, http.StatusOK, job.Snapshot())
}

// PauseJob handles POST /api/admin/wa/job/{id}/pause.
func (h *WAHandler) PauseJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	if err := h.WA.PauseJob(jobID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Job not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to pause job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Job paused"})
}

// ResumeJob handles POST /api/admin/wa/job/{id}/resume.
func (h *WAHandler) ResumeJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	if err := h.WA.ResumeJob(jobID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Job not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to resume job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Job resumed"})
}

// AbortJob handles DELETE /api/admin/wa/job/{id}.
func (h *WAHandler) AbortJob(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	if err := h.WA.AbortJob(jobID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, r, http.StatusNotFound, "Job not found")
			return
		}
		writeError(w, r, http.StatusInternalServerError, "Failed to abort job")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Job aborted"})
}

// SendOne handles POST /api/admin/wa/send-one.
// Sends a single WhatsApp message to one invite.
func (h *WAHandler) SendOne(w http.ResponseWriter, r *http.Request) {
	var body struct {
		InviteID int    `json:"inviteId"`
		Message  string `json:"message"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.InviteID == 0 {
		writeError(w, r, http.StatusBadRequest, "inviteId is required")
		return
	}
	if body.Message == "" {
		writeError(w, r, http.StatusBadRequest, "message is required")
		return
	}

	if err := h.WA.SendOne(r.Context(), body.InviteID, body.Message); err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to send message")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "Message sent"})
}
