package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestInvite_Create(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"name": "Alice",
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invite := result["invite"].(map[string]interface{})
	if invite["name"] != "Alice" {
		t.Fatalf("expected name=Alice, got %v", invite["name"])
	}
	code, ok := invite["code"].(string)
	if !ok || len(code) != 5 {
		t.Fatalf("expected 5-char code, got %v", invite["code"])
	}
	assertKeyExists(t, invite, "id")
	assertKeyExists(t, invite, "rsvpId")
	assertKeyExists(t, invite, "createdAt")
}

func TestInvite_Create_EmptyName_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"name": "",
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_List(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create two invites
	for _, name := range []string{"Alice", "Bob"} {
		body := jsonBody(map[string]interface{}{"name": name})
		req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
		contractResponse(t, env, req, http.StatusCreated)
	}

	req := adminRequest(http.MethodGet, "/api/admin/invites", nil, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	invites := result["invites"].([]interface{})
	if len(invites) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(invites))
	}
}

func TestInvite_GetByCode(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	code := createResult["invite"].(map[string]interface{})["code"].(string)

	// Get by code (public route — no auth needed)
	req2 := httptest.NewRequest(http.MethodGet, "/api/invites/"+code, nil)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if invite["name"] != "Alice" {
		t.Fatalf("expected Alice, got %v", invite["name"])
	}
}

func TestInvite_GetByCode_NotFound(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/invites/zzzzz", nil)
	contractResponse(t, env, req, http.StatusNotFound)
}

func TestInvite_Delete(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Delete using the actual invite ID
	req2 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	if result["message"] != "Invite deleted successfully" {
		t.Fatalf("unexpected message: %v", result["message"])
	}
}

func TestInvite_Delete_CascadesRsvp(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create RSVP via email flow
	rsvpBody := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "both", "guestCount": 2,
	})
	rsvpReq := httptest.NewRequest(http.MethodPost, "/api/rsvp", rsvpBody)
	rsvpReq.Header.Set("Content-Type", "application/json")
	rsvpResult := contractResponse(t, env, rsvpReq, http.StatusCreated)
	rsvpID := int(rsvpResult["rsvp"].(map[string]interface{})["id"].(float64))

	// Create invite
	invBody := jsonBody(map[string]interface{}{"name": "Alice"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invResult := contractResponse(t, env, invReq, http.StatusCreated)
	inviteID := int(invResult["invite"].(map[string]interface{})["id"].(float64))

	// Manually link rsvp_id (simulating what the RSVP handler would do)
	env.repo.UpdateInviteRsvpID(context.Background(), inviteID, &rsvpID)

	// Delete invite — should cascade to delete the RSVP
	delReq := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d", inviteID), nil, cookie, csrf)
	contractResponse(t, env, delReq, http.StatusOK)

	// Verify RSVP is gone
	listReq := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	listResult := contractResponse(t, env, listReq, http.StatusOK)
	rsvps := listResult["rsvps"].([]interface{})
	if len(rsvps) != 0 {
		t.Fatalf("expected 0 rsvps after cascade delete, got %d", len(rsvps))
	}
}
