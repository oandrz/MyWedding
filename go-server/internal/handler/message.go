package handler

import (
	"net/http"
	"strconv"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/go-chi/chi/v5"
)

// MessageHandler handles message-related endpoints.
type MessageHandler struct {
	Repo repository.Repository
}

// Create handles POST /api/messages.
func (h *MessageHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body models.InsertMessage
	if err := parseJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Name == "" || body.Content == "" {
		writeError(w, http.StatusBadRequest, "Name and content are required")
		return
	}

	msg, err := h.Repo.CreateMessage(r.Context(), body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to create message")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Message submitted successfully!",
		"data":    msg,
	})
}

// List handles GET /api/messages.
func (h *MessageHandler) List(w http.ResponseWriter, r *http.Request) {
	messages, err := h.Repo.GetAllMessages(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to get messages")
		return
	}

	if messages == nil {
		messages = make([]models.Message, 0)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"messages": messages,
	})
}

// Delete handles DELETE /api/messages/{id}.
func (h *MessageHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid message ID")
		return
	}

	deleted, err := h.Repo.DeleteMessage(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete message")
		return
	}

	if !deleted {
		writeError(w, http.StatusNotFound, "Message not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Message deleted successfully",
	})
}
