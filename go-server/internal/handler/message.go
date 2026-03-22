package handler

import (
	"net/http"
	"strconv"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
)

// MessageHandler handles message-related endpoints.
type MessageHandler struct {
	Repo      repository.Repository
	Sanitizer *service.Sanitizer
}

// Create handles POST /api/messages.
func (h *MessageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertMessage
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Name == "" || body.Content == "" {
		writeError(w, r, http.StatusBadRequest, "Name and content are required")
		return
	}

	if h.Sanitizer != nil {
		body.Name = h.Sanitizer.Sanitize(body.Name)
		body.Content = h.Sanitizer.Sanitize(body.Content)
	}

	msg, err := h.Repo.CreateMessage(r.Context(), body)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to create message")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Message submitted successfully!",
		"data":    msg,
	})
}

// List handles GET /api/messages.
func (h *MessageHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	messages, total, err := h.Repo.GetMessagesPaginated(r.Context(), limit, offset)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get messages")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"messages": messages,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// Delete handles DELETE /api/messages/{id}.
func (h *MessageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid message ID")
		return
	}

	deleted, err := h.Repo.DeleteMessage(r.Context(), id)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to delete message")
		return
	}

	if !deleted {
		writeError(w, r, http.StatusNotFound, "Message not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Message deleted successfully",
	})
}
