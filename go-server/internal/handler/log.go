package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mywedding/platform/internal/models"
	"github.com/mywedding/platform/internal/repository"
)

// LogHandler serves the admin log viewer endpoints.
type LogHandler struct {
	Repo    repository.Repository
	Dropped func() int64 // returns count of dropped log entries; may be nil
}

func (h *LogHandler) droppedCount() int64 {
	if h.Dropped == nil {
		return 0
	}
	return h.Dropped()
}

// List handles GET /api/admin/logs.
func (h *LogHandler) List(w http.ResponseWriter, r *http.Request) {
	q := parseLogQuery(r)
	logs, err := h.Repo.QueryLogs(r.Context(), q)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to query logs")
		return
	}

	var nextCursor *int64
	if len(logs) == q.Limit && len(logs) > 0 {
		c := logs[len(logs)-1].ID
		nextCursor = &c
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs":         logs,
		"nextCursor":   nextCursor,
		"droppedCount": h.droppedCount(),
	})
}

// ByRequestID handles GET /api/admin/logs/{requestId}.
func (h *LogHandler) ByRequestID(w http.ResponseWriter, r *http.Request) {
	reqID := chi.URLParam(r, "requestId")
	logs, err := h.Repo.QueryLogs(r.Context(), models.LogQuery{RequestID: reqID, Limit: 200})
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to query logs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"logs": logs,
	})
}

func parseLogQuery(r *http.Request) models.LogQuery {
	qs := r.URL.Query()
	q := models.LogQuery{
		Level:     qs.Get("level"),
		Source:    qs.Get("source"),
		RequestID: qs.Get("requestId"),
		Search:    qs.Get("q"),
	}
	if v := qs.Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			q.Limit = n
		}
	}
	if q.Limit <= 0 || q.Limit > 200 {
		q.Limit = 50
	}
	if v := qs.Get("cursor"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			q.Cursor = n
		}
	}
	if v := qs.Get("before"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.Before = &t
		}
	}
	if v := qs.Get("after"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			q.After = &t
		}
	}
	return q
}
