package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestInvite_BulkCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"Alice", "Bob", "Charlie"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	if len(invites) != 3 {
		t.Fatalf("expected 3 invites, got %d", len(invites))
	}

	// Verify each invite has correct structure and unique codes
	codes := make(map[string]bool)
	expectedNames := []string{"Alice", "Bob", "Charlie"}
	for i, raw := range invites {
		inv := raw.(map[string]interface{})
		if inv["name"] != expectedNames[i] {
			t.Fatalf("invite %d: expected name %q, got %v", i, expectedNames[i], inv["name"])
		}
		code, ok := inv["code"].(string)
		if !ok || len(code) != 5 {
			t.Fatalf("invite %d: expected 5-char code, got %v", i, inv["code"])
		}
		if codes[code] {
			t.Fatalf("invite %d: duplicate code %q", i, code)
		}
		codes[code] = true
		assertKeyExists(t, inv, "id")
		assertKeyExists(t, inv, "rsvpId")
		assertKeyExists(t, inv, "createdAt")
	}
}

func TestInvite_BulkCreate_UniqueCodesLargeBatch(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	names := make([]string, 20)
	for i := range names {
		names[i] = fmt.Sprintf("Guest %d", i+1)
	}

	body := jsonBody(map[string]interface{}{
		"names": names,
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	if len(invites) != 20 {
		t.Fatalf("expected 20 invites, got %d", len(invites))
	}

	codes := make(map[string]bool)
	for i, raw := range invites {
		inv := raw.(map[string]interface{})
		code := inv["code"].(string)
		if codes[code] {
			t.Fatalf("invite %d: duplicate code %q", i, code)
		}
		codes[code] = true
	}
}

func TestInvite_BulkCreate_EmptyNames_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_BulkCreate_MissingNames_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_BulkCreate_EmptyStringInNames_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"Alice", "", "Charlie"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestInvite_BulkCreate_SanitizesNames(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"<script>alert('xss')</script>Alice", "Bob<b>Bold</b>"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invites := result["invites"].([]interface{})
	for _, raw := range invites {
		inv := raw.(map[string]interface{})
		name := inv["name"].(string)
		if strings.Contains(name, "<script>") || strings.Contains(name, "<b>") {
			t.Fatalf("expected sanitized name, got %q", name)
		}
	}
}

func TestInvite_BulkCreate_ExceedsLimit_Returns400(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	names := make([]string, 501)
	for i := range names {
		names[i] = fmt.Sprintf("Guest %d", i+1)
	}

	body := jsonBody(map[string]interface{}{
		"names": names,
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}
