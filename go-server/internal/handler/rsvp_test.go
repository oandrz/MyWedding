package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

func TestRsvp_Create_WithAttendanceType(t *testing.T) {
	tests := []struct {
		name           string
		attendanceType string
		wantStatus     int
	}{
		{"both", "both", http.StatusCreated},
		{"holy_matrimony", "holy_matrimony", http.StatusCreated},
		{"reception", "reception", http.StatusCreated},
		{"decline", "decline", http.StatusCreated},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			env := newTestEnv()
			body := jsonBody(map[string]interface{}{
				"name": "Alice", "email": "alice@test.com",
				"attendanceType": tc.attendanceType, "guestCount": 2,
			})
			req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
			req.Header.Set("Content-Type", "application/json")
			result := contractResponse(t, env, req, tc.wantStatus)

			rsvp := result["rsvp"].(map[string]interface{})
			if rsvp["attendanceType"] != tc.attendanceType {
				t.Fatalf("expected attendanceType=%s, got %v", tc.attendanceType, rsvp["attendanceType"])
			}
		})
	}
}

func TestRsvp_InvalidAttendanceType_Returns400(t *testing.T) {
	env := newTestEnv()
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com", "attendanceType": "party",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestRsvp_Decline_ClearsGuestCount(t *testing.T) {
	env := newTestEnv()
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "decline", "guestCount": 3,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusCreated)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["guestCount"] != nil {
		t.Fatalf("expected guestCount=nil for decline, got %v", rsvp["guestCount"])
	}
}

func TestRsvp_DuplicateEmail_UpdatesAttendanceType(t *testing.T) {
	env := newTestEnv()

	body1 := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "both", "guestCount": 2,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body1)
	req1.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req1, http.StatusCreated)

	body2 := jsonBody(map[string]interface{}{
		"name": "Alice Updated", "email": "alice@test.com",
		"attendanceType": "reception",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body2)
	req2.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req2, http.StatusOK)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice Updated" {
		t.Fatalf("expected updated name, got %v", rsvp["name"])
	}
	if rsvp["attendanceType"] != "reception" {
		t.Fatalf("expected attendanceType=reception, got %v", rsvp["attendanceType"])
	}
}

func TestRsvp_ListStats_IncludesEventCounts(t *testing.T) {
	env := newTestEnv()

	// Create mixed RSVPs
	for _, tc := range []struct {
		name, email, attendanceType string
	}{
		{"Alice", "alice@test.com", "both"},
		{"Bob", "bob@test.com", "holy_matrimony"},
		{"Charlie", "charlie@test.com", "reception"},
		{"Diana", "diana@test.com", "decline"},
	} {
		body := jsonBody(map[string]interface{}{
			"name": tc.name, "email": tc.email,
			"attendanceType": tc.attendanceType, "guestCount": 1,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
		req.Header.Set("Content-Type", "application/json")
		contractResponse(t, env, req, http.StatusCreated)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	stats := result["stats"].(map[string]interface{})

	// total=4, attending=3, notAttending=1
	if stats["total"] != float64(4) {
		t.Fatalf("expected total=4, got %v", stats["total"])
	}
	if stats["attending"] != float64(3) {
		t.Fatalf("expected attending=3, got %v", stats["attending"])
	}
	if stats["notAttending"] != float64(1) {
		t.Fatalf("expected notAttending=1, got %v", stats["notAttending"])
	}
	// holyMatrimonyCount: both + holy_matrimony = 2
	if stats["holyMatrimonyCount"] != float64(2) {
		t.Fatalf("expected holyMatrimonyCount=2, got %v", stats["holyMatrimonyCount"])
	}
	// receptionCount: both + reception = 2
	if stats["receptionCount"] != float64(2) {
		t.Fatalf("expected receptionCount=2, got %v", stats["receptionCount"])
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

// ---------------------------------------------------------------------------
// Code-based RSVP tests (invite_code_rsvp feature flag)
// ---------------------------------------------------------------------------

func TestRsvp_Create_WithInviteCode(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	// Create an invite
	invBody := jsonBody(map[string]interface{}{"name": "Alice"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invResult := contractResponse(t, env, invReq, http.StatusCreated)
	code := invResult["invite"].(map[string]interface{})["code"].(string)

	// Submit RSVP with code
	body := jsonBody(map[string]interface{}{
		"code": code, "attendanceType": "both", "guestCount": 2,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusCreated)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice" {
		t.Fatalf("expected name=Alice, got %v", rsvp["name"])
	}
	if rsvp["attendanceType"] != "both" {
		t.Fatalf("expected attendanceType=both, got %v", rsvp["attendanceType"])
	}
}

func TestRsvp_Create_WithInviteCode_Update(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	// Create invite
	invBody := jsonBody(map[string]interface{}{"name": "Alice"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invResult := contractResponse(t, env, invReq, http.StatusCreated)
	code := invResult["invite"].(map[string]interface{})["code"].(string)

	// First RSVP
	body1 := jsonBody(map[string]interface{}{
		"code": code, "attendanceType": "both", "guestCount": 2,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body1)
	req1.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req1, http.StatusCreated)

	// Update RSVP with same code
	body2 := jsonBody(map[string]interface{}{
		"code": code, "attendanceType": "reception", "guestCount": 1,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body2)
	req2.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req2, http.StatusOK)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["attendanceType"] != "reception" {
		t.Fatalf("expected updated attendanceType=reception, got %v", rsvp["attendanceType"])
	}
}

func TestRsvp_Create_WithInviteCode_InvalidCode(t *testing.T) {
	env := newTestEnv()

	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	body := jsonBody(map[string]interface{}{
		"code": "zzzzz", "attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusNotFound)
}

func TestRsvp_Create_WithInviteCode_NoCode(t *testing.T) {
	env := newTestEnv()

	enabled := true
	env.repo.CreateFeatureFlag(context.Background(), models.InsertFeatureFlag{
		FeatureKey: "invite_code_rsvp", FeatureName: "Invite Code RSVP", Enabled: &enabled,
	})

	body := jsonBody(map[string]interface{}{
		"attendanceType": "both",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestRsvp_Create_FlagOff_StillUsesEmail(t *testing.T) {
	env := newTestEnv()

	// Flag off (default) — email-based flow should work
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@test.com",
		"attendanceType": "both", "guestCount": 2,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusCreated)

	rsvp := result["rsvp"].(map[string]interface{})
	if rsvp["name"] != "Alice" {
		t.Fatalf("expected name=Alice, got %v", rsvp["name"])
	}
}
