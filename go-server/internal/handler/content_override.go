package handler

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
)

// ContentOverrideHandler handles content override endpoints.
type ContentOverrideHandler struct {
	Repo repository.Repository
}

// List handles GET /api/content-overrides.
func (h *ContentOverrideHandler) List(w http.ResponseWriter, r *http.Request) {
	overrides, err := h.Repo.GetAllContentOverrides(r.Context())
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to get content overrides")
		return
	}
	if overrides == nil {
		overrides = make([]models.ContentOverride, 0)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"overrides": overrides,
	})
}

// BulkUpdate handles PATCH /api/admin/content-overrides/bulk.
func (h *ContentOverrideHandler) BulkUpdate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Overrides []models.InsertContentOverride `json:"overrides"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	if len(body.Overrides) == 0 {
		writeError(w, r, http.StatusBadRequest, "Overrides array must not be empty")
		return
	}
	if len(body.Overrides) > 500 {
		writeError(w, r, http.StatusBadRequest, "Overrides array must not exceed 500 items")
		return
	}

	inserts := make([]models.InsertContentOverride, 0, len(body.Overrides))
	for _, o := range body.Overrides {
		o.Key = strings.TrimSpace(o.Key)
		if !AllowedContentKeys[o.Key] {
			writeError(w, r, http.StatusBadRequest, "Unknown content key: "+o.Key)
			return
		}
		if o.Locale != "en" && o.Locale != "id" && o.Locale != "*" {
			writeError(w, r, http.StatusBadRequest, "Invalid locale for key "+o.Key)
			return
		}
		if len(o.Value) > 5000 {
			writeError(w, r, http.StatusBadRequest, "Value too long for key "+o.Key)
			return
		}
		// Interpolation tokens must survive edits (e.g. "{name}", "{count}").
		if tokens, ok := InterpolatedContentKeys[o.Key]; ok && o.Value != "" {
			for _, tok := range tokens {
				if !strings.Contains(o.Value, tok) {
					writeError(w, r, http.StatusBadRequest, "Value for "+o.Key+" must contain "+tok)
					return
				}
			}
		}
		// Structural type validation.
		if typ, ok := StructuralContentKeys[o.Key]; ok && o.Value != "" {
			switch typ {
			case "date":
				if _, err := time.Parse(time.RFC3339, o.Value); err != nil {
					writeError(w, r, http.StatusBadRequest, "Invalid date (want RFC3339) for "+o.Key)
					return
				}
			case "url":
				u, err := url.ParseRequestURI(o.Value)
				if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
					writeError(w, r, http.StatusBadRequest, "Invalid URL for "+o.Key)
					return
				}
			}
		}
		inserts = append(inserts, models.InsertContentOverride{
			Key:    o.Key,
			Locale: o.Locale,
			Value:  o.Value,
		})
	}

	updated, err := h.Repo.UpsertContentOverrides(r.Context(), inserts)
	if err != nil {
		writeError(w, r, http.StatusInternalServerError, "Failed to update content overrides")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"updated": updated,
	})
}
