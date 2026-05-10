package handler_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ---------------------------------------------------------------------------
// Schedule Events
// ---------------------------------------------------------------------------

func TestScheduleList_Empty(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	events, ok := result["scheduleEvents"].([]interface{})
	if !ok {
		t.Fatalf("expected scheduleEvents array, got keys: %v", mapKeys(result))
	}
	if len(events) != 0 {
		t.Fatalf("expected 0 events, got %d", len(events))
	}
}

func TestScheduleCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title":       "Holy Matrimony",
		"time":        "2:00 PM - 3:00 PM",
		"description": "Exchange of vows and rings",
		"sortOrder":   0,
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	event, ok := result["scheduleEvent"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected scheduleEvent object, keys: %v", mapKeys(result))
	}
	if event["title"] != "Holy Matrimony" {
		t.Fatalf("expected title 'Holy Matrimony', got %v", event["title"])
	}
	assertKeyExists(t, event, "id")
	assertKeyExists(t, event, "sortOrder")
	assertKeyExists(t, event, "createdAt")
}

func TestScheduleCreate_MissingFields(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony",
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestScheduleCreate_Unauthorized(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony", "time": "2:00 PM", "description": "vows",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/schedule", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestScheduleList_WithEvents(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	for i, title := range []string{"Holy Matrimony", "Teapai", "Dinner Reception"} {
		body := jsonBody(map[string]interface{}{
			"title": title, "time": "2:00 PM", "description": "desc", "sortOrder": i,
		})
		req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create %s: expected 201, got %d", title, rec.Code)
		}
	}

	req := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	events := assertArray(t, result, "scheduleEvents")
	if len(events) != 3 {
		t.Fatalf("expected 3 events, got %d", len(events))
	}

	first := events[0].(map[string]interface{})
	assertKeyExists(t, first, "id")
	assertKeyExists(t, first, "title")
	assertKeyExists(t, first, "time")
	assertKeyExists(t, first, "description")
	assertKeyExists(t, first, "sortOrder")
	assertKeyExists(t, first, "createdAt")
}

func TestScheduleUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony", "time": "2:00 PM - 3:00 PM", "description": "vows", "sortOrder": 0,
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	result := parseResponse(t, rec)
	id := int(result["scheduleEvent"].(map[string]interface{})["id"].(float64))

	updateBody := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony Updated", "time": "3:00 PM - 4:00 PM", "description": "updated",
	})
	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/schedule/%d", id), updateBody, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}

	result2 := parseResponse(t, rec2)
	event := result2["scheduleEvent"].(map[string]interface{})
	if event["title"] != "Holy Matrimony Updated" {
		t.Fatalf("expected updated title, got %v", event["title"])
	}
}

func TestScheduleUpdate_NotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title": "X", "time": "1:00 PM", "description": "desc",
	})
	req := adminRequest(http.MethodPut, "/api/admin/schedule/999", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestScheduleDelete(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"title": "Holy Matrimony", "time": "2:00 PM", "description": "vows", "sortOrder": 0,
	})
	req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	result := parseResponse(t, rec)
	id := int(result["scheduleEvent"].(map[string]interface{})["id"].(float64))

	req2 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/schedule/%d", id), nil, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}

	req3 := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec3 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec3, req3)
	result3 := parseResponse(t, rec3)
	events := assertArray(t, result3, "scheduleEvents")
	if len(events) != 0 {
		t.Fatalf("expected 0 events after delete, got %d", len(events))
	}
}

func TestScheduleDelete_NotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodDelete, "/api/admin/schedule/999", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestScheduleReorder(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	var ids []int
	for i, title := range []string{"A", "B", "C"} {
		body := jsonBody(map[string]interface{}{
			"title": title, "time": "2:00 PM", "description": "desc", "sortOrder": i,
		})
		req := adminRequest(http.MethodPost, "/api/admin/schedule", body, cookie, csrfToken)
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
		r := parseResponse(t, rec)
		ids = append(ids, int(r["scheduleEvent"].(map[string]interface{})["id"].(float64)))
	}

	reorderBody := jsonBody(map[string]interface{}{
		"events": []map[string]interface{}{
			{"id": ids[2], "sortOrder": 0},
			{"id": ids[1], "sortOrder": 1},
			{"id": ids[0], "sortOrder": 2},
		},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/schedule/reorder", reorderBody, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodGet, "/api/schedule", nil)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)
	result := parseResponse(t, rec2)
	events := assertArray(t, result, "scheduleEvents")
	first := events[0].(map[string]interface{})
	if first["title"] != "C" {
		t.Fatalf("expected first event to be 'C' after reorder, got %v", first["title"])
	}
}
