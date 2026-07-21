package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/repository"
)

func newContentHandler() *ContentOverrideHandler {
	return &ContentOverrideHandler{Repo: repository.NewMemoryRepository()}
}

func TestContentOverrideListEmpty(t *testing.T) {
	h := newContentHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/content-overrides", nil)
	rec := httptest.NewRecorder()
	h.List(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	var body struct {
		Overrides []map[string]any `json:"overrides"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Overrides == nil {
		t.Fatalf("overrides must be [] not null")
	}
}

func TestContentOverrideBulkUpdateRejectsUnknownKey(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"not.a.real.key","locale":"en","value":"x"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for unknown key, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateRejectsBadLocale(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"hero.saveTheDate","locale":"fr","value":"x"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for bad locale, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateRejectsBadDate(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"wedding.date","locale":"*","value":"not-a-date"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for bad date, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateRejectsMissingToken(t *testing.T) {
	h := newContentHandler()
	// rsvp.rsvpThankYou must keep "{name}".
	payload := `{"overrides":[{"key":"rsvp.rsvpThankYou","locale":"en","value":"Thanks!"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for missing {name}, got %d", rec.Code)
	}
}

func TestContentOverrideBulkUpdateAccepts(t *testing.T) {
	h := newContentHandler()
	payload := `{"overrides":[{"key":"hero.saveTheDate","locale":"en","value":"Save the Date"},{"key":"wedding.date","locale":"*","value":"2026-07-05T14:00:00+07:00"}]}`
	req := httptest.NewRequest(http.MethodPatch, "/api/admin/content-overrides/bulk", bytes.NewBufferString(payload))
	rec := httptest.NewRecorder()
	h.BulkUpdate(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
}
