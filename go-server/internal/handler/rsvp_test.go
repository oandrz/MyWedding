package handler_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRsvp_DuplicateEmail_UpdatesExisting(t *testing.T) {
	env := newTestEnv()

	body1 := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attending": true, "guestCount": 2,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body1)
	req1.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req1, http.StatusCreated)

	body2 := jsonBody(map[string]interface{}{
		"name": "Alice Updated", "email": "alice@test.com", "attending": false,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body2)
	req2.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req2, http.StatusOK)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice Updated" {
		t.Fatalf("expected updated name, got %v", rsvp["name"])
	}
	if rsvp["attending"] != false {
		t.Fatalf("expected attending=false, got %v", rsvp["attending"])
	}
}

func TestRsvp_EmptyBody_Returns400(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", jsonBody(map[string]string{}))
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestRsvp_EmptyList_ReturnsEmptyArray(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	result := contractResponse(t, env, req, http.StatusOK)
	rsvps := result["rsvps"].([]interface{})
	if len(rsvps) != 0 {
		t.Fatalf("expected empty array, got %d items", len(rsvps))
	}
}

func TestRsvp_MalformedJSON_Returns400(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", strings.NewReader("{invalid json"))
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}
