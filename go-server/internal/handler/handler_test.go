package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/middleware"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/router"
	"github.com/andreasronaldo/wedding-server/internal/service"
)

type testEnv struct {
	handler  http.Handler
	cfg      *config.Config
	repo     *repository.MemoryRepository
	sessions *middleware.SessionStore
	csrf     *middleware.CSRFStore
	cache    *service.Cache
}

func newTestEnv() *testEnv {
	cfg := &config.Config{
		Env:           "development",
		Port:          5000,
		AdminPassword: "testpass123",
		SessionMaxAge: 1800,
		CORSOrigins:   []string{"*"},
	}

	repo := repository.NewMemoryRepository()
	sessions := middleware.NewSessionStore(30 * time.Minute)
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(5 * time.Minute)

	r := router.New(cfg, repo, sessions, csrf, cache)

	return &testEnv{
		handler:  r,
		cfg:      cfg,
		repo:     repo,
		sessions: sessions,
		csrf:     csrf,
		cache:    cache,
	}
}

func jsonBody(v interface{}) *bytes.Buffer {
	b, _ := json.Marshal(v)
	return bytes.NewBuffer(b)
}

func parseResponse(t *testing.T, rec *httptest.ResponseRecorder) map[string]interface{} {
	t.Helper()
	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("Failed to parse response JSON: %v\nBody: %s", err, rec.Body.String())
	}
	return result
}

// adminLogin logs in as admin and returns the session cookie and CSRF token.
func adminLogin(t *testing.T, env *testEnv) (*http.Cookie, string) {
	t.Helper()
	body := jsonBody(map[string]string{"password": "testpass123"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Login failed with status %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	csrfToken, ok := result["csrfToken"].(string)
	if !ok || csrfToken == "" {
		t.Fatal("Expected csrfToken in login response")
	}

	var sessionCookie *http.Cookie
	for _, c := range rec.Result().Cookies() {
		if c.Name == "admin_session" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("Expected admin_session cookie in login response")
	}

	return sessionCookie, csrfToken
}

// adminRequest creates an authenticated request with CSRF token.
// body can be a *bytes.Buffer (already encoded) or nil.
func adminRequest(method, path string, body *bytes.Buffer, cookie *http.Cookie, csrfToken string) *http.Request {
	if body == nil {
		body = bytes.NewBuffer(nil)
	}
	req := httptest.NewRequest(method, path, body)
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	req.Header.Set("X-CSRF-Token", csrfToken)
	return req
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

func TestHealthEndpoint(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	if result["status"] != "ok" {
		t.Fatalf("expected status ok, got %v", result["status"])
	}
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

func TestAuthLoginSuccess(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]string{"password": "testpass123"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Login successful" {
		t.Fatalf("expected 'Login successful', got %v", result["message"])
	}
	if result["csrfToken"] == nil || result["csrfToken"] == "" {
		t.Fatal("expected csrfToken in response")
	}

	// Check cookie
	var found bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == "admin_session" {
			found = true
			if !c.HttpOnly {
				t.Fatal("expected HttpOnly cookie")
			}
			if c.Path != "/" {
				t.Fatalf("expected cookie path /, got %s", c.Path)
			}
		}
	}
	if !found {
		t.Fatal("expected admin_session cookie")
	}
}

func TestAuthLoginWrongPassword(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]string{"password": "wrongpassword"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	if result["message"] != "Invalid admin password" {
		t.Fatalf("expected 'Invalid admin password', got %v", result["message"])
	}
}

func TestAuthLoginEmptyPassword(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]string{"password": ""})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestAuthLoginNoPassword(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]string{})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestAuthValidate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodPost, "/api/admin/validate", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["valid"] != true {
		t.Fatalf("expected valid true, got %v", result["valid"])
	}
}

func TestAuthLogout(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodPost, "/api/admin/logout", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Logout successful" {
		t.Fatalf("expected 'Logout successful', got %v", result["message"])
	}

	// Verify session is invalidated - validate should now fail
	req2 := adminRequest(http.MethodPost, "/api/admin/validate", nil, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 after logout, got %d", rec2.Code)
	}
}

func TestAuthUnauthorizedNoSession(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/validate", nil)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestAuthUnauthorizedInvalidSession(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodPost, "/api/admin/validate", nil)
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: "invalid-session-id"})
	req.Header.Set("X-CSRF-Token", "fake-token")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

func TestRsvpCreate(t *testing.T) {
	env := newTestEnv()

	gc := 2
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "attending": true, "guestCount": gc,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Thank you for your RSVP!" {
		t.Fatalf("expected create message, got %v", result["message"])
	}
	if result["rsvp"] == nil {
		t.Fatal("expected rsvp in response")
	}
}

func TestRsvpCreateDuplicateEmailUpdates(t *testing.T) {
	env := newTestEnv()

	// First create
	body1 := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "attending": true,
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body1)
	req1.Header.Set("Content-Type", "application/json")
	rec1 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201 for first create, got %d", rec1.Code)
	}

	// Second create with same email -> update
	body2 := jsonBody(map[string]interface{}{
		"name": "Alice Updated", "email": "alice@example.com", "attending": false,
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/rsvp", body2)
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200 for duplicate email, got %d: %s", rec2.Code, rec2.Body.String())
	}

	result := parseResponse(t, rec2)
	if result["message"] != "Your RSVP has been updated successfully!" {
		t.Fatalf("expected update message, got %v", result["message"])
	}
}

func TestRsvpListWithStats(t *testing.T) {
	env := newTestEnv()

	// Create some RSVPs
	gc2 := 2
	for _, r := range []map[string]interface{}{
		{"name": "Alice", "email": "alice@example.com", "attending": true, "guestCount": gc2},
		{"name": "Bob", "email": "bob@example.com", "attending": true},
		{"name": "Charlie", "email": "charlie@example.com", "attending": false},
	} {
		body := jsonBody(r)
		req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
	}

	// List
	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)

	rsvps, ok := result["rsvps"].([]interface{})
	if !ok {
		t.Fatal("expected rsvps array")
	}
	if len(rsvps) != 3 {
		t.Fatalf("expected 3 rsvps, got %d", len(rsvps))
	}

	stats, ok := result["stats"].(map[string]interface{})
	if !ok {
		t.Fatal("expected stats object")
	}
	if stats["total"] != float64(3) {
		t.Fatalf("expected total 3, got %v", stats["total"])
	}
	if stats["attending"] != float64(2) {
		t.Fatalf("expected attending 2, got %v", stats["attending"])
	}
	if stats["notAttending"] != float64(1) {
		t.Fatalf("expected notAttending 1, got %v", stats["notAttending"])
	}
	// Alice has guestCount 2, Bob has no guestCount (default 1) = 3
	if stats["guestCount"] != float64(3) {
		t.Fatalf("expected guestCount 3, got %v", stats["guestCount"])
	}
}

func TestRsvpCheck(t *testing.T) {
	env := newTestEnv()

	// Create an RSVP
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "attending": true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	// Check existing
	req2 := httptest.NewRequest(http.MethodGet, "/api/rsvp/check?name=Alice", nil)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2.Code)
	}

	result := parseResponse(t, rec2)
	if result["exists"] != true {
		t.Fatalf("expected exists true, got %v", result["exists"])
	}

	// Check non-existing
	req3 := httptest.NewRequest(http.MethodGet, "/api/rsvp/check?name=Unknown", nil)
	rec3 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec3, req3)

	result3 := parseResponse(t, rec3)
	if result3["exists"] != false {
		t.Fatalf("expected exists false, got %v", result3["exists"])
	}
}

func TestRsvpCheckMissingName(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp/check", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}
}

func TestRsvpGetByEmail(t *testing.T) {
	env := newTestEnv()

	// Create
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "attending": true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	// Get by email
	req2 := httptest.NewRequest(http.MethodGet, "/api/rsvp/alice@example.com", nil)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2.Code)
	}

	result := parseResponse(t, rec2)
	if result["rsvp"] == nil {
		t.Fatal("expected rsvp in response")
	}
}

func TestRsvpGetByEmailNotFound(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp/missing@example.com", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestRsvpDelete(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create RSVP
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "attending": true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	// Delete with auth
	req2 := adminRequest(http.MethodDelete, "/api/rsvp/1", nil, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestRsvpDeleteNotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodDelete, "/api/rsvp/999", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestRsvpDeleteUnauthorized(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodDelete, "/api/rsvp/1", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

func TestMessageCreate(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "content": "Congratulations!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Message submitted successfully!" {
		t.Fatalf("expected success message, got %v", result["message"])
	}
	if result["data"] == nil {
		t.Fatal("expected data in response")
	}
}

func TestMessageList(t *testing.T) {
	env := newTestEnv()

	// Create messages
	for _, name := range []string{"Alice", "Bob"} {
		body := jsonBody(map[string]interface{}{
			"name": name, "content": "Hello from " + name,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
	}

	// List
	req := httptest.NewRequest(http.MethodGet, "/api/messages", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	messages, ok := result["messages"].([]interface{})
	if !ok {
		t.Fatal("expected messages array")
	}
	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}
}

func TestMessageDelete(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create message
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "content": "Hello!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	// Delete
	req2 := adminRequest(http.MethodDelete, "/api/messages/1", nil, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestMessageDeleteNotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodDelete, "/api/messages/999", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestMessageDeleteUnauthorized(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodDelete, "/api/messages/1", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Feature Flags
// ---------------------------------------------------------------------------

func TestFeatureFlagList(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	flags, ok := result["featureFlags"].([]interface{})
	if !ok {
		t.Fatal("expected featureFlags array")
	}
	if len(flags) != 0 {
		t.Fatalf("expected 0 flags, got %d", len(flags))
	}
}

func TestFeatureFlagCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"featureKey": "dark_mode", "featureName": "Dark Mode", "description": "Enable dark mode",
	})
	req := adminRequest(http.MethodPost, "/api/admin/feature-flags", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Feature flag created successfully" {
		t.Fatalf("expected create message, got %v", result["message"])
	}
}

func TestFeatureFlagCreateDuplicate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"featureKey": "dark_mode", "featureName": "Dark Mode", "description": "Enable dark mode",
	})

	// First create
	req := adminRequest(http.MethodPost, "/api/admin/feature-flags", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for first create, got %d", rec.Code)
	}

	// Duplicate
	body2 := jsonBody(map[string]interface{}{
		"featureKey": "dark_mode", "featureName": "Dark Mode", "description": "Duplicate",
	})
	req2 := adminRequest(http.MethodPost, "/api/admin/feature-flags", body2, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestFeatureFlagGet(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create
	body := jsonBody(map[string]interface{}{
		"featureKey": "dark_mode", "featureName": "Dark Mode", "description": "Enable dark mode",
	})
	req := adminRequest(http.MethodPost, "/api/admin/feature-flags", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	// Get
	req2 := httptest.NewRequest(http.MethodGet, "/api/feature-flags/dark_mode", nil)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2.Code)
	}

	result := parseResponse(t, rec2)
	if result["featureFlag"] == nil {
		t.Fatal("expected featureFlag in response")
	}
}

func TestFeatureFlagGetNotFound(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags/nonexistent", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestFeatureFlagUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create
	createBody := jsonBody(map[string]interface{}{
		"featureKey": "dark_mode", "featureName": "Dark Mode", "description": "Enable dark mode",
	})
	req := adminRequest(http.MethodPost, "/api/admin/feature-flags", createBody, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	// Update
	updateBody := jsonBody(map[string]interface{}{"enabled": true})
	req2 := adminRequest(http.MethodPatch, "/api/admin/feature-flags/dark_mode", updateBody, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}

	result := parseResponse(t, rec2)
	msg, _ := result["message"].(string)
	if msg == "" {
		t.Fatal("expected message in response")
	}
}

// ---------------------------------------------------------------------------
// App Settings
// ---------------------------------------------------------------------------

func TestAppSettingList(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	settings, ok := result["settings"].([]interface{})
	if !ok {
		t.Fatal("expected settings array")
	}
	if len(settings) != 0 {
		t.Fatalf("expected 0 settings, got %d", len(settings))
	}
}

func TestAppSettingGetMusicDefault(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/settings/music", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	if result["musicUrl"] != "/music/wedding-piano.mp3" {
		t.Fatalf("expected default music URL, got %v", result["musicUrl"])
	}
}

func TestAppSettingGetByKey(t *testing.T) {
	env := newTestEnv()

	// We need to create a setting via the repo directly since there's no public create endpoint
	// Instead, let's use the admin update flow. But first we need a setting to exist.
	// Let's test the 404 case first.
	req := httptest.NewRequest(http.MethodGet, "/api/settings/nonexistent", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestAppSettingUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create a setting in the repo directly
	env.repo.CreateAppSetting(nil, struct {
		SettingKey   string  `json:"settingKey"`
		SettingValue string  `json:"settingValue"`
		SettingType  string  `json:"settingType"`
		Description  *string `json:"description"`
	}{
		SettingKey:   "site_name",
		SettingValue: "Our Wedding",
		SettingType:  "string",
	})

	// Update via API
	body := jsonBody(map[string]interface{}{
		"settingValue": "The Wedding",
	})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/site_name", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Setting updated successfully" {
		t.Fatalf("expected update message, got %v", result["message"])
	}

	// Verify via GET
	req2 := httptest.NewRequest(http.MethodGet, "/api/settings/site_name", nil)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2.Code)
	}

	result2 := parseResponse(t, rec2)
	setting, ok := result2["setting"].(map[string]interface{})
	if !ok {
		t.Fatal("expected setting in response")
	}
	if setting["settingValue"] != "The Wedding" {
		t.Fatalf("expected 'The Wedding', got %v", setting["settingValue"])
	}
}

// ---------------------------------------------------------------------------
// Welcome Screen
// ---------------------------------------------------------------------------

func TestWelcomeScreenGetDefault(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/welcome-screen", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	ws, ok := result["welcomeScreen"].(map[string]interface{})
	if !ok {
		t.Fatal("expected welcomeScreen in response")
	}
	if ws["headingText"] != "Welcome" {
		t.Fatalf("expected default headingText 'Welcome', got %v", ws["headingText"])
	}
}

func TestWelcomeScreenUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"headingText": "Welcome to Our Wedding",
	})
	req := adminRequest(http.MethodPatch, "/api/admin/welcome-screen", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Welcome screen configuration updated successfully" {
		t.Fatalf("expected update message, got %v", result["message"])
	}

	ws, ok := result["welcomeScreen"].(map[string]interface{})
	if !ok {
		t.Fatal("expected welcomeScreen in response")
	}
	if ws["headingText"] != "Welcome to Our Wedding" {
		t.Fatalf("expected updated headingText, got %v", ws["headingText"])
	}
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

func TestMediaCreate(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "mediaUrl": "https://example.com/pic.jpg",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/media", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Thank you for sharing your memory!" {
		t.Fatalf("expected success message, got %v", result["message"])
	}

	media, ok := result["media"].(map[string]interface{})
	if !ok {
		t.Fatal("expected media in response")
	}
	if media["mediaType"] != "image" {
		t.Fatalf("expected auto-detected mediaType 'image', got %v", media["mediaType"])
	}
}

func TestMediaCreateVideoDetection(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Bob", "email": "bob@example.com", "mediaUrl": "https://youtube.com/watch?v=abc",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/media", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	media, ok := result["media"].(map[string]interface{})
	if !ok {
		t.Fatal("expected media in response")
	}
	if media["mediaType"] != "video" {
		t.Fatalf("expected auto-detected mediaType 'video', got %v", media["mediaType"])
	}
}

func TestMediaListApprovedFiltersAdmin(t *testing.T) {
	env := newTestEnv()

	// Create guest media
	body1 := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "mediaUrl": "https://example.com/pic1.jpg",
	})
	req1 := httptest.NewRequest(http.MethodPost, "/api/media", body1)
	req1.Header.Set("Content-Type", "application/json")
	rec1 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec1, req1)

	// Create admin media (auto-approved)
	body2 := jsonBody(map[string]interface{}{
		"name": "Admin", "email": "admin@wedding.com", "mediaUrl": "https://example.com/admin.jpg",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/media", body2)
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	// Approve guest media via admin endpoint
	cookie, csrfToken := adminLogin(t, env)
	approveBody := jsonBody(map[string]interface{}{"approved": true})
	req3 := adminRequest(http.MethodPatch, "/api/admin/media/1", approveBody, cookie, csrfToken)
	rec3 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec3, req3)

	// List approved - should exclude admin@wedding.com
	req4 := httptest.NewRequest(http.MethodGet, "/api/media", nil)
	rec4 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec4, req4)

	if rec4.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec4.Code)
	}

	result := parseResponse(t, rec4)
	media, ok := result["media"].([]interface{})
	if !ok {
		t.Fatal("expected media array")
	}
	if len(media) != 1 {
		t.Fatalf("expected 1 media (admin filtered out), got %d", len(media))
	}

	// Check that the remaining one is from Alice
	item := media[0].(map[string]interface{})
	if item["email"] != "alice@example.com" {
		t.Fatalf("expected alice@example.com, got %v", item["email"])
	}
}

func TestMediaAdminListAll(t *testing.T) {
	env := newTestEnv()

	// Create media
	for i, email := range []string{"alice@example.com", "bob@example.com"} {
		body := jsonBody(map[string]interface{}{
			"name": fmt.Sprintf("User%d", i), "email": email, "mediaUrl": fmt.Sprintf("https://example.com/pic%d.jpg", i),
		})
		req := httptest.NewRequest(http.MethodPost, "/api/media", body)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
	}

	cookie, csrfToken := adminLogin(t, env)

	// Admin list all (uses GET, no CSRF needed for GET)
	req := httptest.NewRequest(http.MethodGet, "/api/admin/media", nil)
	req.AddCookie(cookie)
	req.Header.Set("X-CSRF-Token", csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	media, ok := result["media"].([]interface{})
	if !ok {
		t.Fatal("expected media array")
	}
	if len(media) != 2 {
		t.Fatalf("expected 2 media, got %d", len(media))
	}
}

func TestMediaUpdateApproval(t *testing.T) {
	env := newTestEnv()

	// Create media
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com", "mediaUrl": "https://example.com/pic.jpg",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/media", body)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	cookie, csrfToken := adminLogin(t, env)

	// Approve
	approveBody := jsonBody(map[string]interface{}{"approved": true})
	req2 := adminRequest(http.MethodPatch, "/api/admin/media/1", approveBody, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestMediaUpdateApprovalNotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"approved": true})
	req := adminRequest(http.MethodPatch, "/api/admin/media/999", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// Config Images
// ---------------------------------------------------------------------------

func TestConfigImageListAll(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/config-images", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	images, ok := result["images"].([]interface{})
	if !ok {
		t.Fatal("expected images array")
	}
	if len(images) != 0 {
		t.Fatalf("expected 0 images, got %d", len(images))
	}
}

func TestConfigImageListByType(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/config-images/hero", nil)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	result := parseResponse(t, rec)
	images, ok := result["images"].([]interface{})
	if !ok {
		t.Fatal("expected images array")
	}
	if len(images) != 0 {
		t.Fatalf("expected 0 images, got %d", len(images))
	}
}

func TestConfigImageCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"imageKey": "hero-1", "imageUrl": "https://example.com/hero.jpg", "imageType": "hero",
	})
	req := adminRequest(http.MethodPost, "/api/admin/config-images", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Image configuration updated successfully" {
		t.Fatalf("expected success message, got %v", result["message"])
	}
}

func TestConfigImageUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create
	createBody := jsonBody(map[string]interface{}{
		"imageKey": "hero-1", "imageUrl": "https://example.com/hero.jpg", "imageType": "hero",
	})
	req1 := adminRequest(http.MethodPost, "/api/admin/config-images", createBody, cookie, csrfToken)
	rec1 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec1, req1)

	// Update
	updateBody := jsonBody(map[string]interface{}{
		"imageUrl": "https://example.com/hero-v2.jpg", "imageType": "hero",
	})
	req2 := adminRequest(http.MethodPut, "/api/admin/config-images/hero-1", updateBody, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestConfigImageReorder(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create images
	for _, key := range []string{"h1", "h2", "h3"} {
		body := jsonBody(map[string]interface{}{
			"imageKey": key, "imageUrl": "https://example.com/" + key + ".jpg", "imageType": "hero",
		})
		req := adminRequest(http.MethodPost, "/api/admin/config-images", body, cookie, csrfToken)
		rec := httptest.NewRecorder()
		env.handler.ServeHTTP(rec, req)
	}

	// Reorder
	body := jsonBody(map[string]interface{}{
		"imageType":   "hero",
		"orderedKeys": []string{"h3", "h1", "h2"},
	})
	req := adminRequest(http.MethodPut, "/api/admin/config-images-reorder", body, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	if result["message"] != "Images reordered successfully" {
		t.Fatalf("expected reorder message, got %v", result["message"])
	}
}

func TestConfigImageDelete(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	// Create
	body := jsonBody(map[string]interface{}{
		"imageKey": "hero-1", "imageUrl": "https://example.com/hero.jpg", "imageType": "hero",
	})
	req1 := adminRequest(http.MethodPost, "/api/admin/config-images", body, cookie, csrfToken)
	rec1 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec1, req1)

	// Delete
	req2 := adminRequest(http.MethodDelete, "/api/admin/config-images/hero-1", nil, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestConfigImageDeleteNotFound(t *testing.T) {
	env := newTestEnv()
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodDelete, "/api/admin/config-images/nonexistent", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// CSRF Token Recovery (validate without CSRF)
// ---------------------------------------------------------------------------

func TestValidateWithoutCSRF(t *testing.T) {
	env := newTestEnv()
	cookie, _ := adminLogin(t, env)

	// Call validate with only auth cookie, NO CSRF token
	req := httptest.NewRequest(http.MethodPost, "/api/admin/validate", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestValidateReturnsCSRFToken(t *testing.T) {
	env := newTestEnv()
	cookie, _ := adminLogin(t, env)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/validate", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	csrfToken, ok := result["csrfToken"].(string)
	if !ok || csrfToken == "" {
		t.Fatal("validate should return a csrfToken")
	}
}

func TestValidateReusesExistingToken(t *testing.T) {
	env := newTestEnv()
	cookie, originalToken := adminLogin(t, env)

	// Call validate — should return the same token, not a new one
	req := httptest.NewRequest(http.MethodPost, "/api/admin/validate", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	returnedToken := result["csrfToken"].(string)
	if returnedToken != originalToken {
		t.Fatalf("validate should reuse existing token, got different token")
	}
}

func TestValidateGeneratesTokenWhenMissing(t *testing.T) {
	env := newTestEnv()
	cookie, _ := adminLogin(t, env)

	// Simulate server restart: delete CSRF token from store
	env.csrf.DeleteToken(cookie.Value)

	req := httptest.NewRequest(http.MethodPost, "/api/admin/validate", nil)
	req.AddCookie(cookie)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	result := parseResponse(t, rec)
	csrfToken, ok := result["csrfToken"].(string)
	if !ok || csrfToken == "" {
		t.Fatal("validate should generate a new csrfToken when missing")
	}

	// The new token should work for subsequent PATCH requests
	// First create a feature flag to update
	createBody := jsonBody(map[string]interface{}{
		"featureKey": "dark_mode", "featureName": "Dark Mode", "description": "Enable dark mode",
	})
	reqCreate := adminRequest(http.MethodPost, "/api/admin/feature-flags", createBody, cookie, csrfToken)
	recCreate := httptest.NewRecorder()
	env.handler.ServeHTTP(recCreate, reqCreate)
	if recCreate.Code != http.StatusCreated {
		t.Fatalf("create flag: expected 201, got %d: %s", recCreate.Code, recCreate.Body.String())
	}

	// Now PATCH with the recovered token
	updateBody := jsonBody(map[string]interface{}{"enabled": true})
	req2 := adminRequest(http.MethodPatch, "/api/admin/feature-flags/dark_mode", updateBody, cookie, csrfToken)
	rec2 := httptest.NewRecorder()
	env.handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("PATCH with recovered token: expected 200, got %d: %s", rec2.Code, rec2.Body.String())
	}
}

// ---------------------------------------------------------------------------
// Protected routes 401 tests
// ---------------------------------------------------------------------------

func TestProtectedRoutesRequireAuth(t *testing.T) {
	env := newTestEnv()

	routes := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/api/admin/logout"},
		{http.MethodPost, "/api/admin/validate"},
		{http.MethodDelete, "/api/rsvp/1"},
		{http.MethodDelete, "/api/messages/1"},
		{http.MethodGet, "/api/admin/media"},
		{http.MethodPatch, "/api/admin/media/1"},
		{http.MethodPost, "/api/admin/config-images"},
		{http.MethodPut, "/api/admin/config-images/key"},
		{http.MethodPut, "/api/admin/config-images-reorder"},
		{http.MethodDelete, "/api/admin/config-images/key"},
		{http.MethodPatch, "/api/admin/feature-flags/key"},
		{http.MethodPost, "/api/admin/feature-flags"},
		{http.MethodPatch, "/api/admin/app-settings/key"},
		{http.MethodPatch, "/api/admin/welcome-screen"},
	}

	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			req := httptest.NewRequest(route.method, route.path, nil)
			rec := httptest.NewRecorder()
			env.handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401 for %s %s, got %d", route.method, route.path, rec.Code)
			}
		})
	}
}
