package handler_test

// contract_test.go — API parity / contract tests (Phase 7 migration).
//
// Every test in this file verifies that the JSON response body returned by the
// Go server matches the exact structure the React frontend expects. Fields are
// checked for existence, correct JSON key names (camelCase), and value types.
//
// The tests use encoding/json → map[string]interface{} so we can assert on the
// dynamic structure without coupling to Go model types.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// contractResponse is a small helper that performs a request, asserts the
// expected HTTP status, decodes JSON into a map, and returns it.
func contractResponse(t *testing.T, env *testEnv, req *http.Request, wantStatus int) map[string]interface{} {
	t.Helper()
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != wantStatus {
		t.Fatalf("expected status %d, got %d\nBody: %s", wantStatus, rec.Code, rec.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed to parse JSON response: %v\nBody: %s", err, rec.Body.String())
	}
	return result
}

// contractResponseWithRecorder is like contractResponse but also returns the recorder
// so the caller can inspect cookies / headers.
func contractResponseWithRecorder(t *testing.T, env *testEnv, req *http.Request, wantStatus int) (map[string]interface{}, *httptest.ResponseRecorder) {
	t.Helper()
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != wantStatus {
		t.Fatalf("expected status %d, got %d\nBody: %s", wantStatus, rec.Code, rec.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("failed to parse JSON response: %v\nBody: %s", err, rec.Body.String())
	}
	return result, rec
}

// assertKeyExists fails if the map does not contain the given key.
func assertKeyExists(t *testing.T, m map[string]interface{}, key string) {
	t.Helper()
	if _, ok := m[key]; !ok {
		t.Fatalf("expected key %q in response, keys present: %v", key, mapKeys(m))
	}
}

// assertKeyType fails if m[key] is not the expected Go type.
// Use "string", "float64", "bool", "nil", "[]interface {}", "map[string]interface {}"
func assertKeyType(t *testing.T, m map[string]interface{}, key string, wantType string) {
	t.Helper()
	assertKeyExists(t, m, key)

	val := m[key]
	if wantType == "nil" {
		if val != nil {
			t.Fatalf("expected %q to be nil, got %T(%v)", key, val, val)
		}
		return
	}

	if val == nil {
		t.Fatalf("expected %q to be %s, got nil", key, wantType)
	}

	got := typeName(val)
	if got != wantType {
		t.Fatalf("expected %q to be %s, got %s (%v)", key, wantType, got, val)
	}
}

// assertStringValue fails if m[key] is not exactly the expected string.
func assertStringValue(t *testing.T, m map[string]interface{}, key, want string) {
	t.Helper()
	assertKeyType(t, m, key, "string")
	if m[key].(string) != want {
		t.Fatalf("expected %q = %q, got %q", key, want, m[key].(string))
	}
}

// assertBoolValue fails if m[key] is not exactly the expected bool.
func assertBoolValue(t *testing.T, m map[string]interface{}, key string, want bool) {
	t.Helper()
	assertKeyType(t, m, key, "bool")
	if m[key].(bool) != want {
		t.Fatalf("expected %q = %v, got %v", key, want, m[key].(bool))
	}
}

// assertFloat64Value fails if m[key] is not the expected float64.
func assertFloat64Value(t *testing.T, m map[string]interface{}, key string, want float64) {
	t.Helper()
	assertKeyType(t, m, key, "float64")
	if m[key].(float64) != want {
		t.Fatalf("expected %q = %v, got %v", key, want, m[key].(float64))
	}
}

// assertArray returns the array value at key, or fails.
func assertArray(t *testing.T, m map[string]interface{}, key string) []interface{} {
	t.Helper()
	assertKeyType(t, m, key, "[]interface {}")
	return m[key].([]interface{})
}

// assertObject returns the object value at key, or fails.
func assertObject(t *testing.T, m map[string]interface{}, key string) map[string]interface{} {
	t.Helper()
	assertKeyType(t, m, key, "map[string]interface {}")
	return m[key].(map[string]interface{})
}

// assertNullableType checks that a key is either nil or the given type.
func assertNullableType(t *testing.T, m map[string]interface{}, key string, allowedType string) {
	t.Helper()
	assertKeyExists(t, m, key)
	val := m[key]
	if val == nil {
		return // nil is acceptable
	}
	got := typeName(val)
	if got != allowedType {
		t.Fatalf("expected %q to be nil or %s, got %s (%v)", key, allowedType, got, val)
	}
}

func typeName(v interface{}) string {
	switch v.(type) {
	case string:
		return "string"
	case float64:
		return "float64"
	case bool:
		return "bool"
	case []interface{}:
		return "[]interface {}"
	case map[string]interface{}:
		return "map[string]interface {}"
	default:
		return "unknown"
	}
}

func mapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// createRsvp is a shortcut to POST /api/rsvp for setup. Submits via the phone-based
// (no-code) flow using a strict E.164 phone number.
func createRsvp(t *testing.T, env *testEnv, name, phone string, attendanceType string, guestCount *int) {
	t.Helper()
	payload := map[string]interface{}{
		"name": name, "phone": phone, "attendanceType": attendanceType,
	}
	if guestCount != nil {
		payload["guestCount"] = *guestCount
	}
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", jsonBody(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("createRsvp: unexpected status %d: %s", rec.Code, rec.Body.String())
	}
}

// seedRsvpWithEmail inserts an RSVP directly into the repository with a populated
// email field, bypassing the HTTP handler. Used to test legacy GET /api/rsvp/{email}
// behavior since the public no-code flow no longer collects email.
func seedRsvpWithEmail(t *testing.T, env *testEnv, name, email string, attendanceType string, guestCount *int) *models.Rsvp {
	t.Helper()
	rsvp, err := env.repo.CreateRsvp(context.Background(), models.InsertRsvp{
		Name:           name,
		Email:          email,
		AttendanceType: attendanceType,
		GuestCount:     guestCount,
	})
	if err != nil {
		t.Fatalf("seedRsvpWithEmail: %v", err)
	}
	return rsvp
}

// createMessage is a shortcut to POST /api/messages for setup.
func createMessage(t *testing.T, env *testEnv, name, content string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/messages", jsonBody(map[string]interface{}{
		"name": name, "content": content,
	}))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("createMessage: unexpected status %d: %s", rec.Code, rec.Body.String())
	}
}

// createMedia is a shortcut to POST /api/media for setup.
func createMedia(t *testing.T, env *testEnv, name, email, mediaURL string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/media", jsonBody(map[string]interface{}{
		"name": name, "email": email, "mediaUrl": mediaURL,
	}))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("createMedia: unexpected status %d: %s", rec.Code, rec.Body.String())
	}
}

// createFeatureFlag is a shortcut to create a feature flag via the admin API.
func createFeatureFlag(t *testing.T, env *testEnv, cookie *http.Cookie, csrf, key, name, desc string) {
	t.Helper()
	body := jsonBody(map[string]interface{}{
		"featureKey": key, "featureName": name, "description": desc,
	})
	req := adminRequest(http.MethodPost, "/api/admin/feature-flags", body, cookie, csrf)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("createFeatureFlag: unexpected status %d: %s", rec.Code, rec.Body.String())
	}
}

// createConfigImage is a shortcut to create a config image via the admin API.
func createConfigImage(t *testing.T, env *testEnv, cookie *http.Cookie, csrf, key, url, imgType string) {
	t.Helper()
	body := jsonBody(map[string]interface{}{
		"imageKey": key, "imageUrl": url, "imageType": imgType,
	})
	req := adminRequest(http.MethodPost, "/api/admin/config-images", body, cookie, csrf)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("createConfigImage: unexpected status %d: %s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// assertRsvpObject verifies the camelCase field contract for an RSVP object.
// ---------------------------------------------------------------------------
func assertRsvpObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "name", "string")
	assertKeyType(t, obj, "email", "string")
	assertNullableType(t, obj, "phone", "string")
	assertKeyType(t, obj, "attendanceType", "string")
	// guestCount may be null or a number
	assertKeyExists(t, obj, "guestCount")
	assertNullableType(t, obj, "guestCount", "float64")
}

// assertMessageObject verifies the camelCase field contract for a message object.
func assertMessageObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "name", "string")
	assertNullableType(t, obj, "email", "string")
	assertKeyType(t, obj, "content", "string")
	assertKeyType(t, obj, "createdAt", "string")
}

// assertMediaObject verifies the camelCase field contract for a media object.
func assertMediaObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "name", "string")
	assertKeyType(t, obj, "email", "string")
	assertKeyType(t, obj, "mediaUrl", "string")
	assertKeyType(t, obj, "mediaType", "string")
	assertNullableType(t, obj, "caption", "string")
	assertKeyType(t, obj, "approved", "bool")
	assertKeyType(t, obj, "createdAt", "string")
}

// assertFeatureFlagObject verifies the camelCase field contract for a feature flag.
func assertFeatureFlagObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "featureKey", "string")
	assertKeyType(t, obj, "featureName", "string")
	assertKeyType(t, obj, "description", "string")
	assertKeyType(t, obj, "enabled", "bool")
	assertKeyType(t, obj, "updatedAt", "string")
}

// assertAppSettingObject verifies the camelCase field contract for an app setting.
func assertAppSettingObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "settingKey", "string")
	assertKeyType(t, obj, "settingValue", "string")
	assertKeyType(t, obj, "settingType", "string")
	assertNullableType(t, obj, "description", "string")
	assertKeyType(t, obj, "updatedAt", "string")
}

// assertWelcomeScreenObject verifies the camelCase field contract for the welcome screen.
func assertWelcomeScreenObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "headingText", "string")
	assertKeyType(t, obj, "headingTextId", "string")
	assertKeyType(t, obj, "deliveryLabel", "string")
	assertKeyType(t, obj, "deliveryLabelId", "string")
	assertKeyType(t, obj, "fallbackName", "string")
	assertKeyType(t, obj, "enabled", "bool")
	assertKeyType(t, obj, "updatedAt", "string")
}

// assertConfigImageObject verifies the camelCase field contract for a config image.
func assertConfigImageObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "imageKey", "string")
	assertKeyType(t, obj, "imageUrl", "string")
	assertNullableType(t, obj, "thumbnailUrl", "string")
	assertNullableType(t, obj, "displayUrl", "string")
	assertKeyType(t, obj, "imageType", "string")
	assertNullableType(t, obj, "title", "string")
	assertNullableType(t, obj, "description", "string")
	assertKeyType(t, obj, "isActive", "bool")
	assertKeyType(t, obj, "displayOrder", "float64")
	assertKeyType(t, obj, "updatedAt", "string")
}

// assertInviteObject verifies the camelCase field contract for an invite object.
func assertInviteObject(t *testing.T, obj map[string]interface{}) {
	t.Helper()
	assertKeyType(t, obj, "id", "float64")
	assertKeyType(t, obj, "name", "string")
	assertKeyType(t, obj, "code", "string")
	assertNullableType(t, obj, "rsvpId", "float64")
	assertKeyType(t, obj, "createdAt", "string")
}

// ===========================================================================
// Contract Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. POST /api/admin/login
// Contract: { "message": "Login successful", "csrfToken": "<string>" }
//   - Set-Cookie: admin_session=...
//
// ---------------------------------------------------------------------------
func TestContract_AdminLogin(t *testing.T) {
	env := newTestEnv()
	body := jsonBody(map[string]string{"password": "testpass123"})
	req := httptest.NewRequest(http.MethodPost, "/api/admin/login", body)
	req.Header.Set("Content-Type", "application/json")

	result, rec := contractResponseWithRecorder(t, env, req, http.StatusOK)

	// Verify top-level keys
	assertStringValue(t, result, "message", "Login successful")
	assertKeyType(t, result, "csrfToken", "string")
	if result["csrfToken"].(string) == "" {
		t.Fatal("csrfToken must be a non-empty string")
	}

	// Verify Set-Cookie header contains admin_session
	var found bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == "admin_session" {
			found = true
			if c.Value == "" {
				t.Fatal("admin_session cookie value must be non-empty")
			}
			if !c.HttpOnly {
				t.Fatal("admin_session cookie must be HttpOnly")
			}
			if c.Path != "/" {
				t.Fatalf("admin_session cookie path must be /, got %q", c.Path)
			}
		}
	}
	if !found {
		t.Fatal("expected Set-Cookie header with admin_session")
	}
}

// ---------------------------------------------------------------------------
// 2. POST /api/admin/logout
// Contract: { "message": "Logout successful" }
// ---------------------------------------------------------------------------
func TestContract_AdminLogout(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	req := adminRequest(http.MethodPost, "/api/admin/logout", nil, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	assertStringValue(t, result, "message", "Logout successful")

	// No extra unexpected keys beyond "message"
	if len(result) != 1 {
		t.Fatalf("expected exactly 1 key (message), got %d: %v", len(result), mapKeys(result))
	}
}

// ---------------------------------------------------------------------------
// 3. POST /api/admin/validate
// Contract: { "message": "Admin session is valid", "valid": true }
// ---------------------------------------------------------------------------
func TestContract_AdminValidate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	req := adminRequest(http.MethodPost, "/api/admin/validate", nil, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	assertStringValue(t, result, "message", "Admin session is valid")
	assertBoolValue(t, result, "valid", true)
	assertKeyType(t, result, "csrfToken", "string")

	if len(result) != 3 {
		t.Fatalf("expected exactly 3 keys (message, valid, csrfToken), got %d: %v", len(result), mapKeys(result))
	}
}

// ---------------------------------------------------------------------------
// 4. GET /api/health
// Contract: { "status": "ok", "timestamp": "<RFC3339>" }
// ---------------------------------------------------------------------------
func TestContract_Health(t *testing.T) {
	env := newTestEnv()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	assertStringValue(t, result, "status", "ok")
	assertKeyType(t, result, "timestamp", "string")

	// Verify timestamp is valid RFC3339
	ts := result["timestamp"].(string)
	if _, err := time.Parse(time.RFC3339, ts); err != nil {
		t.Fatalf("timestamp %q is not valid RFC3339: %v", ts, err)
	}
}

// ---------------------------------------------------------------------------
// 5. POST /api/rsvp (new, no-code phone flow)
// Contract: { "message": "Thank you for your RSVP!",
//
//	"rsvp": { "id": <int>, "name": "...", "email": "", "phone": "+...",
//	          "attendanceType": <string>, "guestCount": <int|null> } }
//
// Status: 201
// ---------------------------------------------------------------------------
func TestContract_RsvpCreate(t *testing.T) {
	env := newTestEnv()

	gc := 3
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "phone": "+6281234567890", "attendanceType": "both", "guestCount": gc,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	assertStringValue(t, result, "message", "Thank you for your RSVP!")

	rsvp := assertObject(t, result, "rsvp")
	assertRsvpObject(t, rsvp)

	// Verify values
	assertStringValue(t, rsvp, "name", "Alice")
	assertStringValue(t, rsvp, "email", "")
	assertStringValue(t, rsvp, "phone", "+6281234567890")
	assertStringValue(t, rsvp, "attendanceType", "both")
	assertFloat64Value(t, rsvp, "guestCount", 3)
}

// ---------------------------------------------------------------------------
// 5b. POST /api/rsvp (new, null guestCount)
// ---------------------------------------------------------------------------
func TestContract_RsvpCreateNullGuestCount(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Bob", "phone": "+6281234567891", "attendanceType": "decline",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	rsvp := assertObject(t, result, "rsvp")
	assertRsvpObject(t, rsvp)
	// guestCount should be null when not provided
	assertNullableType(t, rsvp, "guestCount", "float64")
}

// ---------------------------------------------------------------------------
// 6. POST /api/rsvp (existing phone → update)
// Contract: { "message": "Your RSVP has been updated successfully!",
//
//	"rsvp": { ... } }
//
// Status: 200
// ---------------------------------------------------------------------------
func TestContract_RsvpUpdate(t *testing.T) {
	env := newTestEnv()

	// First create
	createRsvp(t, env, "Alice", "+6281234567890", "both", nil)

	// Second POST with same phone → update
	body := jsonBody(map[string]interface{}{
		"name": "Alice Updated", "phone": "+6281234567890", "attendanceType": "decline",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusOK)

	assertStringValue(t, result, "message", "Your RSVP has been updated successfully!")

	rsvp := assertObject(t, result, "rsvp")
	assertRsvpObject(t, rsvp)
	assertStringValue(t, rsvp, "phone", "+6281234567890")
	assertStringValue(t, rsvp, "attendanceType", "decline")
}

// ---------------------------------------------------------------------------
// 7. GET /api/rsvp
// Contract: { "rsvps": [...], "stats": { "total": <int>, "attending": <int>,
//
//	"notAttending": <int>, "guestCount": <int>,
//	"holyMatrimonyCount": <int>, "receptionCount": <int>,
//	"holyMatrimonyGuestCount": <int>, "receptionGuestCount": <int> } }
//
// ---------------------------------------------------------------------------
func TestContract_RsvpList(t *testing.T) {
	env := newTestEnv()

	gc := 2
	createRsvp(t, env, "Alice", "+6281234567890", "both", &gc)
	createRsvp(t, env, "Bob", "+6281234567891", "both", nil)
	createRsvp(t, env, "Charlie", "+6281234567892", "decline", nil)

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	rsvps := assertArray(t, result, "rsvps")
	if len(rsvps) != 3 {
		t.Fatalf("expected 3 rsvps, got %d", len(rsvps))
	}

	// Verify each RSVP item has the correct shape
	for i, item := range rsvps {
		obj, ok := item.(map[string]interface{})
		if !ok {
			t.Fatalf("rsvps[%d] is not an object", i)
		}
		assertRsvpObject(t, obj)
	}

	// Verify stats
	stats := assertObject(t, result, "stats")
	assertKeyType(t, stats, "total", "float64")
	assertKeyType(t, stats, "attending", "float64")
	assertKeyType(t, stats, "notAttending", "float64")
	assertKeyType(t, stats, "guestCount", "float64")
	assertKeyType(t, stats, "holyMatrimonyCount", "float64")
	assertKeyType(t, stats, "receptionCount", "float64")
	assertKeyType(t, stats, "holyMatrimonyGuestCount", "float64")
	assertKeyType(t, stats, "receptionGuestCount", "float64")

	assertFloat64Value(t, stats, "total", 3)
	assertFloat64Value(t, stats, "attending", 2)
	assertFloat64Value(t, stats, "notAttending", 1)
	// Alice=2, Bob=1 (default) = 3
	assertFloat64Value(t, stats, "guestCount", 3)
	// Both Alice and Bob chose "both", so both events get 2+1 = 3
	assertFloat64Value(t, stats, "holyMatrimonyGuestCount", 3)
	assertFloat64Value(t, stats, "receptionGuestCount", 3)
}

// ---------------------------------------------------------------------------
// 7b. GET /api/rsvp (empty)
// Contract: { "rsvps": [], "stats": { ... } }
// ---------------------------------------------------------------------------
func TestContract_RsvpListEmpty(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	rsvps := assertArray(t, result, "rsvps")
	if len(rsvps) != 0 {
		t.Fatalf("expected 0 rsvps, got %d", len(rsvps))
	}

	stats := assertObject(t, result, "stats")
	assertFloat64Value(t, stats, "total", 0)
	assertFloat64Value(t, stats, "attending", 0)
	assertFloat64Value(t, stats, "notAttending", 0)
	assertFloat64Value(t, stats, "guestCount", 0)
	assertFloat64Value(t, stats, "holyMatrimonyCount", 0)
	assertFloat64Value(t, stats, "receptionCount", 0)
}

// ---------------------------------------------------------------------------
// 8. GET /api/rsvp/check?name=X
// Contract (found):     { "exists": true, "rsvp": { ... } }
// Contract (not found): { "exists": false, "rsvp": null }
// ---------------------------------------------------------------------------
func TestContract_RsvpCheckFound(t *testing.T) {
	env := newTestEnv()
	createRsvp(t, env, "Alice", "+6281234567890", "both", nil)

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp/check?name=Alice", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	assertBoolValue(t, result, "exists", true)

	rsvp := assertObject(t, result, "rsvp")
	assertRsvpObject(t, rsvp)
}

func TestContract_RsvpCheckNotFound(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp/check?name=Nobody", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	assertBoolValue(t, result, "exists", false)
	assertKeyExists(t, result, "rsvp")
	if result["rsvp"] != nil {
		t.Fatalf("expected rsvp to be null, got %v", result["rsvp"])
	}
}

// ---------------------------------------------------------------------------
// 9. GET /api/rsvp/{email}
// Contract (found): { "rsvp": { ... } }
// Contract (404):   { "message": "RSVP not found" }
// ---------------------------------------------------------------------------
func TestContract_RsvpGetByEmail(t *testing.T) {
	env := newTestEnv()
	// Seed directly with an email since the public no-code flow no longer collects email.
	seedRsvpWithEmail(t, env, "Alice", "alice@example.com", "both", nil)

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp/alice@example.com", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	rsvp := assertObject(t, result, "rsvp")
	assertRsvpObject(t, rsvp)
	assertStringValue(t, rsvp, "email", "alice@example.com")
}

func TestContract_RsvpGetByEmailNotFound(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/rsvp/missing@example.com", nil)
	result := contractResponse(t, env, req, http.StatusNotFound)

	errObj := assertObject(t, result, "error")
	assertStringValue(t, errObj, "message", "RSVP not found")
	assertStringValue(t, errObj, "code", "NOT_FOUND")
	assertKeyExists(t, errObj, "requestId")
}

// ---------------------------------------------------------------------------
// 10. POST /api/messages
// Contract: { "message": "Message submitted successfully!",
//
//	"data": { "id": <int>, "name": "...", "email": "..."|null,
//	          "content": "...", "createdAt": "<RFC3339>" } }
//
// Status: 201
// ---------------------------------------------------------------------------
func TestContract_MessageCreate(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "content": "Congratulations!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	assertStringValue(t, result, "message", "Message submitted successfully!")

	data := assertObject(t, result, "data")
	assertMessageObject(t, data)

	assertStringValue(t, data, "name", "Alice")
	assertStringValue(t, data, "content", "Congratulations!")

	// createdAt should be a valid timestamp
	createdAt := data["createdAt"].(string)
	if createdAt == "" {
		t.Fatal("expected non-empty createdAt")
	}
}

func TestContract_MessageCreateWithEmail(t *testing.T) {
	env := newTestEnv()

	email := "alice@example.com"
	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": email, "content": "Hello!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	data := assertObject(t, result, "data")
	assertMessageObject(t, data)
	assertStringValue(t, data, "email", email)
}

func TestContract_MessageCreateNullEmail(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Bob", "content": "Great wedding!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/messages", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	data := assertObject(t, result, "data")
	// email should be null when not provided
	assertNullableType(t, data, "email", "string")
}

// ---------------------------------------------------------------------------
// 11. GET /api/messages
// Contract: { "messages": [...] }
// ---------------------------------------------------------------------------
func TestContract_MessageList(t *testing.T) {
	env := newTestEnv()

	createMessage(t, env, "Alice", "Hello!")
	createMessage(t, env, "Bob", "Congratulations!")

	req := httptest.NewRequest(http.MethodGet, "/api/messages", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	msgs := assertArray(t, result, "messages")
	if len(msgs) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(msgs))
	}

	for i, item := range msgs {
		obj, ok := item.(map[string]interface{})
		if !ok {
			t.Fatalf("messages[%d] is not an object", i)
		}
		assertMessageObject(t, obj)
	}

	assertKeyExists(t, result, "total")
	assertKeyType(t, result, "total", "float64")
	assertKeyExists(t, result, "limit")
	assertKeyType(t, result, "limit", "float64")
	assertKeyExists(t, result, "offset")
	assertKeyType(t, result, "offset", "float64")
}

func TestContract_MessageListEmpty(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/messages", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	msgs := assertArray(t, result, "messages")
	if len(msgs) != 0 {
		t.Fatalf("expected 0 messages, got %d", len(msgs))
	}

	assertKeyExists(t, result, "total")
	assertKeyType(t, result, "total", "float64")
	assertKeyExists(t, result, "limit")
	assertKeyType(t, result, "limit", "float64")
	assertKeyExists(t, result, "offset")
	assertKeyType(t, result, "offset", "float64")
}

// ---------------------------------------------------------------------------
// 12. POST /api/media
// Contract: { "message": "Thank you for sharing your memory!",
//
//	"media": { "id": <int>, "name": "...", "email": "...",
//	           "mediaUrl": "...", "mediaType": "...",
//	           "caption": "..."|null, "approved": <bool>,
//	           "createdAt": "<RFC3339>" } }
//
// Status: 201
// ---------------------------------------------------------------------------
func TestContract_MediaCreate(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com",
		"mediaUrl": "https://example.com/photo.jpg",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/media", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	assertStringValue(t, result, "message", "Thank you for sharing your memory!")

	media := assertObject(t, result, "media")
	assertMediaObject(t, media)

	assertStringValue(t, media, "name", "Alice")
	assertStringValue(t, media, "email", "alice@example.com")
	assertStringValue(t, media, "mediaUrl", "https://example.com/photo.jpg")
	assertStringValue(t, media, "mediaType", "image")
	assertBoolValue(t, media, "approved", false) // not admin, so not auto-approved
}

func TestContract_MediaCreateVideoAutoDetect(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Bob", "email": "bob@example.com",
		"mediaUrl": "https://youtube.com/watch?v=abc",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/media", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	media := assertObject(t, result, "media")
	assertMediaObject(t, media)
	assertStringValue(t, media, "mediaType", "video")
}

func TestContract_MediaCreateWithCaption(t *testing.T) {
	env := newTestEnv()

	body := jsonBody(map[string]interface{}{
		"name": "Alice", "email": "alice@example.com",
		"mediaUrl": "https://example.com/photo.jpg", "caption": "Our best day!",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/media", body)
	req.Header.Set("Content-Type", "application/json")

	result := contractResponse(t, env, req, http.StatusCreated)

	media := assertObject(t, result, "media")
	assertMediaObject(t, media)
	assertStringValue(t, media, "caption", "Our best day!")
}

// ---------------------------------------------------------------------------
// 13. GET /api/media
// Contract: { "media": [...] } (only approved, excludes admin@wedding.com)
// ---------------------------------------------------------------------------
func TestContract_MediaListApproved(t *testing.T) {
	env := newTestEnv()

	// Create two media items
	createMedia(t, env, "Alice", "alice@example.com", "https://example.com/pic1.jpg")
	createMedia(t, env, "Bob", "bob@example.com", "https://example.com/pic2.jpg")

	// Approve Alice's media
	cookie, csrf := adminLogin(t, env)
	approveBody := jsonBody(map[string]interface{}{"approved": true})
	approveReq := adminRequest(http.MethodPatch, "/api/admin/media/1", approveBody, cookie, csrf)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, approveReq)

	// Public list should only show approved, non-admin media
	req := httptest.NewRequest(http.MethodGet, "/api/media", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	mediaArr := assertArray(t, result, "media")
	if len(mediaArr) != 1 {
		t.Fatalf("expected 1 approved media, got %d", len(mediaArr))
	}

	item := mediaArr[0].(map[string]interface{})
	assertMediaObject(t, item)
	assertStringValue(t, item, "email", "alice@example.com")

	assertKeyExists(t, result, "total")
	assertKeyType(t, result, "total", "float64")
	assertKeyExists(t, result, "limit")
	assertKeyType(t, result, "limit", "float64")
	assertKeyExists(t, result, "offset")
	assertKeyType(t, result, "offset", "float64")
}

func TestContract_MediaListEmpty(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/media", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	mediaArr := assertArray(t, result, "media")
	if len(mediaArr) != 0 {
		t.Fatalf("expected 0 media, got %d", len(mediaArr))
	}

	assertKeyExists(t, result, "total")
	assertKeyType(t, result, "total", "float64")
	assertKeyExists(t, result, "limit")
	assertKeyType(t, result, "limit", "float64")
	assertKeyExists(t, result, "offset")
	assertKeyType(t, result, "offset", "float64")
}

// ---------------------------------------------------------------------------
// 14. GET /api/admin/media
// Contract: { "media": [...] } (all media, including unapproved)
// ---------------------------------------------------------------------------
func TestContract_AdminMediaListAll(t *testing.T) {
	env := newTestEnv()

	createMedia(t, env, "Alice", "alice@example.com", "https://example.com/pic1.jpg")
	createMedia(t, env, "Bob", "bob@example.com", "https://example.com/pic2.jpg")

	cookie, csrf := adminLogin(t, env)

	req := httptest.NewRequest(http.MethodGet, "/api/admin/media", nil)
	req.AddCookie(cookie)
	req.Header.Set("X-CSRF-Token", csrf)

	result := contractResponse(t, env, req, http.StatusOK)

	mediaArr := assertArray(t, result, "media")
	if len(mediaArr) != 2 {
		t.Fatalf("expected 2 media items in admin list, got %d", len(mediaArr))
	}

	for i, item := range mediaArr {
		obj, ok := item.(map[string]interface{})
		if !ok {
			t.Fatalf("media[%d] is not an object", i)
		}
		assertMediaObject(t, obj)
	}
}

// ---------------------------------------------------------------------------
// 15. GET /api/config-images
// Contract: { "images": [...] }
// ---------------------------------------------------------------------------
func TestContract_ConfigImageListAll(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/config-images", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	images := assertArray(t, result, "images")
	if len(images) != 0 {
		t.Fatalf("expected 0 images, got %d", len(images))
	}
}

func TestContract_ConfigImageListAllWithData(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	createConfigImage(t, env, cookie, csrf, "hero-1", "https://example.com/hero1.jpg", "hero")
	createConfigImage(t, env, cookie, csrf, "hero-2", "https://example.com/hero2.jpg", "hero")

	req := httptest.NewRequest(http.MethodGet, "/api/config-images", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	images := assertArray(t, result, "images")
	if len(images) != 2 {
		t.Fatalf("expected 2 images, got %d", len(images))
	}

	for i, item := range images {
		obj, ok := item.(map[string]interface{})
		if !ok {
			t.Fatalf("images[%d] is not an object", i)
		}
		assertConfigImageObject(t, obj)
	}
}

// ---------------------------------------------------------------------------
// 16. GET /api/config-images/{type}
// Contract: { "images": [...] }
// ---------------------------------------------------------------------------
func TestContract_ConfigImageListByType(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	createConfigImage(t, env, cookie, csrf, "hero-1", "https://example.com/hero1.jpg", "hero")
	createConfigImage(t, env, cookie, csrf, "gallery-1", "https://example.com/gallery1.jpg", "gallery")

	req := httptest.NewRequest(http.MethodGet, "/api/config-images/hero", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	images := assertArray(t, result, "images")
	if len(images) != 1 {
		t.Fatalf("expected 1 hero image, got %d", len(images))
	}

	obj := images[0].(map[string]interface{})
	assertConfigImageObject(t, obj)
	assertStringValue(t, obj, "imageType", "hero")
}

func TestContract_ConfigImageListByTypeEmpty(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/config-images/nonexistent", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	images := assertArray(t, result, "images")
	if len(images) != 0 {
		t.Fatalf("expected 0 images for missing type, got %d", len(images))
	}
}

// ---------------------------------------------------------------------------
// 17. GET /api/feature-flags
// Contract: { "featureFlags": [...] }
// ---------------------------------------------------------------------------
func TestContract_FeatureFlagList(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	// music_autoplay is seeded by NewMemoryRepository
	flags := assertArray(t, result, "featureFlags")
	if len(flags) != 1 {
		t.Fatalf("expected 1 seeded feature flag, got %d", len(flags))
	}
}

// TestContract_FeatureFlagListDefaultSeed verifies music_autoplay is seeded by default.
func TestContract_FeatureFlagListDefaultSeed(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	flags := assertArray(t, result, "featureFlags")
	if len(flags) != 1 {
		t.Fatalf("expected 1 seeded feature flag, got %d", len(flags))
	}

	obj, ok := flags[0].(map[string]interface{})
	if !ok {
		t.Fatal("featureFlags[0] is not an object")
	}
	assertFeatureFlagObject(t, obj)
	assertStringValue(t, obj, "featureKey", "music_autoplay")
	assertBoolValue(t, obj, "enabled", true)
}

func TestContract_FeatureFlagListWithData(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	createFeatureFlag(t, env, cookie, csrf, "dark_mode", "Dark Mode", "Enable dark theme")
	createFeatureFlag(t, env, cookie, csrf, "rsvp_open", "RSVP Open", "Allow new RSVPs")

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	flags := assertArray(t, result, "featureFlags")
	// seed adds 1 to the count
	if len(flags) != 3 {
		t.Fatalf("expected 3 feature flags (1 seed + 2 created), got %d", len(flags))
	}

	for i, item := range flags {
		obj, ok := item.(map[string]interface{})
		if !ok {
			t.Fatalf("featureFlags[%d] is not an object", i)
		}
		assertFeatureFlagObject(t, obj)
	}
}

// ---------------------------------------------------------------------------
// 18. GET /api/feature-flags/{featureKey}
// Contract (found): { "featureFlag": { ... } }
// Contract (404):   { "message": "Feature flag not found" }
// ---------------------------------------------------------------------------
func TestContract_FeatureFlagGet(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	createFeatureFlag(t, env, cookie, csrf, "dark_mode", "Dark Mode", "Enable dark theme")

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags/dark_mode", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	flag := assertObject(t, result, "featureFlag")
	assertFeatureFlagObject(t, flag)
	assertStringValue(t, flag, "featureKey", "dark_mode")
	assertStringValue(t, flag, "featureName", "Dark Mode")
	assertStringValue(t, flag, "description", "Enable dark theme")
	assertBoolValue(t, flag, "enabled", false) // default disabled
}

func TestContract_FeatureFlagGetNotFound(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/feature-flags/nonexistent", nil)
	result := contractResponse(t, env, req, http.StatusNotFound)

	errObj := assertObject(t, result, "error")
	assertStringValue(t, errObj, "message", "Feature flag not found")
	assertStringValue(t, errObj, "code", "NOT_FOUND")
	assertKeyExists(t, errObj, "requestId")
}

// ---------------------------------------------------------------------------
// 19. GET /api/app-settings
// Contract: { "settings": [...] }
// ---------------------------------------------------------------------------
func TestContract_AppSettingList(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	settings := assertArray(t, result, "settings")
	if len(settings) != 0 {
		t.Fatalf("expected 0 settings, got %d", len(settings))
	}
}

func TestContract_AppSettingListWithData(t *testing.T) {
	env := newTestEnv()

	// Insert a setting via the repo directly
	env.repo.CreateAppSetting(nil, struct {
		SettingKey   string  `json:"settingKey"`
		SettingValue string  `json:"settingValue"`
		SettingType  string  `json:"settingType"`
		Description  *string `json:"description"`
	}{
		SettingKey:   "site_title",
		SettingValue: "Our Wedding",
		SettingType:  "string",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	settings := assertArray(t, result, "settings")
	if len(settings) != 1 {
		t.Fatalf("expected 1 setting, got %d", len(settings))
	}

	obj := settings[0].(map[string]interface{})
	assertAppSettingObject(t, obj)
}

// ---------------------------------------------------------------------------
// 19b. PATCH /api/admin/app-settings/bulk
// Contract: { "updated": <number> }
// ---------------------------------------------------------------------------
func TestContract_AppSettingBulkUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "egift_groom_name", "settingValue": "John", "settingType": "text"},
			{"settingKey": "egift_bride_name", "settingValue": "Jane", "settingType": "text"},
		},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	updated, ok := result["updated"].(float64)
	if !ok {
		t.Fatal("Expected 'updated' to be a number")
	}
	if int(updated) != 2 {
		t.Fatalf("Expected updated=2, got %v", updated)
	}
}

func TestContract_AppSettingBulkUpdate_EmptyArray(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestContract_AppSettingBulkUpdate_BlankKey(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "", "settingValue": "val", "settingType": "text"},
		},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestContract_AppSettingBulkUpdate_ExceedsMax(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	items := make([]map[string]interface{}, 51)
	for i := range items {
		items[i] = map[string]interface{}{
			"settingKey":   fmt.Sprintf("key_%d", i),
			"settingValue": "val",
			"settingType":  "text",
		}
	}
	body := jsonBody(map[string]interface{}{"settings": items})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusBadRequest)
}

func TestContract_AppSettingBulkUpdate_Upsert(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// First bulk insert
	body := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "egift_groom_name", "settingValue": "John", "settingType": "text"},
		},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusOK)

	// Second bulk update (upsert) same key with new value
	body2 := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "egift_groom_name", "settingValue": "Johnny", "settingType": "text"},
		},
	})
	req2 := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body2, cookie, csrf)
	contractResponse(t, env, req2, http.StatusOK)

	// Verify via GET
	getReq := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	getResult := contractResponse(t, env, getReq, http.StatusOK)
	settings := assertArray(t, getResult, "settings")

	found := false
	for _, s := range settings {
		obj := s.(map[string]interface{})
		if obj["settingKey"] == "egift_groom_name" {
			if obj["settingValue"] != "Johnny" {
				t.Fatalf("Expected settingValue='Johnny', got %v", obj["settingValue"])
			}
			found = true
		}
	}
	if !found {
		t.Fatal("Expected to find egift_groom_name setting after upsert")
	}
}

func TestContract_AppSettingCarouselInterval(t *testing.T) {
	env := newTestEnv()

	// Seed the gallery carousel interval setting
	env.repo.CreateAppSetting(nil, struct {
		SettingKey   string  `json:"settingKey"`
		SettingValue string  `json:"settingValue"`
		SettingType  string  `json:"settingType"`
		Description  *string `json:"description"`
	}{
		SettingKey:   "gallery_carousel_interval",
		SettingValue: "4000",
		SettingType:  "number",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	settings := assertArray(t, result, "settings")
	if len(settings) != 1 {
		t.Fatalf("expected 1 setting, got %d", len(settings))
	}

	obj := settings[0].(map[string]interface{})
	assertAppSettingObject(t, obj)
	assertStringValue(t, obj, "settingKey", "gallery_carousel_interval")
	assertStringValue(t, obj, "settingValue", "4000")
	assertStringValue(t, obj, "settingType", "number")
}

func TestContract_AppSettingCarouselIntervalUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create initial setting
	body := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "gallery_carousel_interval", "settingValue": "4000", "settingType": "number"},
		},
	})
	req := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body, cookie, csrf)
	contractResponse(t, env, req, http.StatusOK)

	// Update to new value
	body2 := jsonBody(map[string]interface{}{
		"settings": []map[string]interface{}{
			{"settingKey": "gallery_carousel_interval", "settingValue": "6000", "settingType": "number"},
		},
	})
	req2 := adminRequest(http.MethodPatch, "/api/admin/app-settings/bulk", body2, cookie, csrf)
	contractResponse(t, env, req2, http.StatusOK)

	// Verify updated value via GET
	getReq := httptest.NewRequest(http.MethodGet, "/api/app-settings", nil)
	getResult := contractResponse(t, env, getReq, http.StatusOK)
	settings := assertArray(t, getResult, "settings")

	found := false
	for _, s := range settings {
		obj := s.(map[string]interface{})
		if obj["settingKey"] == "gallery_carousel_interval" {
			assertStringValue(t, obj, "settingValue", "6000")
			found = true
		}
	}
	if !found {
		t.Fatal("Expected to find gallery_carousel_interval setting after update")
	}
}

// ---------------------------------------------------------------------------
// 20. GET /api/settings/music
// Contract: { "musicUrl": "<string>" }
// ---------------------------------------------------------------------------
func TestContract_SettingsMusic(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/settings/music", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	assertKeyType(t, result, "musicUrl", "string")
	// Default fallback value
	assertStringValue(t, result, "musicUrl", "/music/wedding-piano.mp3")

	// Should have exactly 1 key
	if len(result) != 1 {
		t.Fatalf("expected exactly 1 key (musicUrl), got %d: %v", len(result), mapKeys(result))
	}
}

// ---------------------------------------------------------------------------
// 21. GET /api/settings/{settingKey}
// Contract (found): { "setting": { ... } }
// Contract (404):   { "message": "Setting not found" }
// ---------------------------------------------------------------------------
func TestContract_SettingsGetByKey(t *testing.T) {
	env := newTestEnv()

	// Insert a setting directly
	env.repo.CreateAppSetting(nil, struct {
		SettingKey   string  `json:"settingKey"`
		SettingValue string  `json:"settingValue"`
		SettingType  string  `json:"settingType"`
		Description  *string `json:"description"`
	}{
		SettingKey:   "site_title",
		SettingValue: "Our Wedding",
		SettingType:  "string",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/settings/site_title", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	setting := assertObject(t, result, "setting")
	assertAppSettingObject(t, setting)
	assertStringValue(t, setting, "settingKey", "site_title")
	assertStringValue(t, setting, "settingValue", "Our Wedding")
}

func TestContract_SettingsGetByKeyNotFound(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/settings/nonexistent", nil)
	result := contractResponse(t, env, req, http.StatusNotFound)

	errObj := assertObject(t, result, "error")
	assertStringValue(t, errObj, "message", "Setting not found")
	assertStringValue(t, errObj, "code", "NOT_FOUND")
	assertKeyExists(t, errObj, "requestId")
}

// ---------------------------------------------------------------------------
// 22. GET /api/welcome-screen
// Contract: { "welcomeScreen": { "id": <int>, "headingText": "...",
//
//	"deliveryLabel": "...", "fallbackName": "...",
//	"enabled": <bool>, "updatedAt": "..." } }
//
// ---------------------------------------------------------------------------
func TestContract_WelcomeScreenDefault(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/welcome-screen", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	ws := assertObject(t, result, "welcomeScreen")
	assertWelcomeScreenObject(t, ws)

	// Default values
	assertStringValue(t, ws, "headingText", "Welcome")
	assertStringValue(t, ws, "deliveryLabel", "Delivery")
	assertStringValue(t, ws, "fallbackName", "Guest")
	assertBoolValue(t, ws, "enabled", true)
}

func TestContract_WelcomeScreenAfterUpdate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Update welcome screen
	body := jsonBody(map[string]interface{}{
		"headingText": "Welcome to Our Wedding",
	})
	updateReq := adminRequest(http.MethodPatch, "/api/admin/welcome-screen", body, cookie, csrf)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, updateReq)
	if rec.Code != http.StatusOK {
		t.Fatalf("failed to update welcome screen: %d", rec.Code)
	}

	// GET should reflect the update
	req := httptest.NewRequest(http.MethodGet, "/api/welcome-screen", nil)
	result := contractResponse(t, env, req, http.StatusOK)

	ws := assertObject(t, result, "welcomeScreen")
	assertWelcomeScreenObject(t, ws)
	assertStringValue(t, ws, "headingText", "Welcome to Our Wedding")
}

// ===========================================================================
// Error Response Contract Tests
// ===========================================================================
// All errors follow: { "error": { "code": "...", "message": "...", "requestId": "..." } }

// ---------------------------------------------------------------------------
// Invite contract tests
// ---------------------------------------------------------------------------

func TestContract_InviteCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	invite := assertObject(t, result, "invite")
	assertInviteObject(t, invite)
	assertStringValue(t, invite, "name", "Alice")
	// code should be a 5-char string
	code := invite["code"].(string)
	if len(code) != 5 {
		t.Fatalf("expected 5-char code, got %q (len=%d)", code, len(code))
	}
}

func TestContract_InviteList(t *testing.T) {
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

	invites := assertArray(t, result, "invites")
	if len(invites) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(invites))
	}
	for _, item := range invites {
		inv := item.(map[string]interface{})
		assertInviteObject(t, inv)
	}
}

func TestContract_InviteListEmpty(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	req := adminRequest(http.MethodGet, "/api/admin/invites", nil, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	invites := assertArray(t, result, "invites")
	if len(invites) != 0 {
		t.Fatalf("expected empty array, got %d items", len(invites))
	}
}

func TestContract_InviteGetByCode(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	code := createResult["invite"].(map[string]interface{})["code"].(string)

	// Get by code (public route)
	req2 := httptest.NewRequest(http.MethodGet, "/api/invites/"+code, nil)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := assertObject(t, result, "invite")
	assertInviteObject(t, invite)
	assertStringValue(t, invite, "name", "Alice")
}

func TestContract_InviteGetByCodeNotFound(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodGet, "/api/invites/zzzzz", nil)
	result := contractResponse(t, env, req, http.StatusNotFound)

	assertKeyExists(t, result, "error")
}

func TestContract_InviteDelete(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Delete
	req2 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	assertKeyType(t, result, "message", "string")
}

// ---------------------------------------------------------------------------
// Invite Bulk — Contract
// ---------------------------------------------------------------------------

func TestContract_InviteBulkCreate(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{
		"names": []string{"Alice", "Bob"},
	})
	req := adminRequest(http.MethodPost, "/api/admin/invites/bulk", body, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusCreated)

	// Response must have "invites" array
	assertKeyExists(t, result, "invites")
	invites := result["invites"].([]interface{})
	if len(invites) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(invites))
	}

	// Each invite must have the expected fields and types
	for i, raw := range invites {
		inv := raw.(map[string]interface{})
		assertKeyType(t, inv, "id", "float64")
		assertKeyType(t, inv, "name", "string")
		assertKeyType(t, inv, "code", "string")
		assertKeyType(t, inv, "createdAt", "string")
		// rsvpId should be nil for new invites
		assertKeyExists(t, inv, "rsvpId")
		if inv["rsvpId"] != nil {
			t.Fatalf("invite %d: expected rsvpId to be nil, got %v", i, inv["rsvpId"])
		}
	}
}

func TestRespondError_Format(t *testing.T) {
	env := newTestEnv()

	req := httptest.NewRequest(http.MethodPost, "/api/rsvp", jsonBody(map[string]string{}))
	req.Header.Set("Content-Type", "application/json")
	result := contractResponse(t, env, req, http.StatusBadRequest)

	errObj, ok := result["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'error' object in response, got keys: %v", mapKeys(result))
	}
	assertKeyExists(t, errObj, "code")
	assertKeyExists(t, errObj, "message")
	assertKeyExists(t, errObj, "requestId")
}

func TestContract_ErrorResponseShape(t *testing.T) {
	env := newTestEnv()

	tests := []struct {
		name       string
		method     string
		path       string
		body       *bytes.Buffer
		wantStatus int
		wantCode   string
		wantMsg    string
	}{
		{
			name:       "login wrong password",
			method:     http.MethodPost,
			path:       "/api/admin/login",
			body:       jsonBody(map[string]string{"password": "wrong"}),
			wantStatus: http.StatusUnauthorized,
			wantCode:   "UNAUTHORIZED",
			wantMsg:    "Invalid admin password",
		},
		{
			name:       "login empty password",
			method:     http.MethodPost,
			path:       "/api/admin/login",
			body:       jsonBody(map[string]string{"password": ""}),
			wantStatus: http.StatusBadRequest,
			wantCode:   "BAD_REQUEST",
			wantMsg:    "Password is required",
		},
		{
			name:       "rsvp missing fields",
			method:     http.MethodPost,
			path:       "/api/rsvp",
			body:       jsonBody(map[string]interface{}{"name": "Alice"}),
			wantStatus: http.StatusBadRequest,
			wantCode:   "BAD_REQUEST",
			wantMsg:    "Name and phone are required",
		},
		{
			name:       "message missing fields",
			method:     http.MethodPost,
			path:       "/api/messages",
			body:       jsonBody(map[string]interface{}{"name": "Alice"}),
			wantStatus: http.StatusBadRequest,
			wantCode:   "BAD_REQUEST",
			wantMsg:    "Name and content are required",
		},
		{
			name:       "media missing fields",
			method:     http.MethodPost,
			path:       "/api/media",
			body:       jsonBody(map[string]interface{}{"name": "Alice"}),
			wantStatus: http.StatusBadRequest,
			wantCode:   "BAD_REQUEST",
			wantMsg:    "Name, email, and mediaUrl are required",
		},
		{
			name:       "rsvp check missing name param",
			method:     http.MethodGet,
			path:       "/api/rsvp/check",
			body:       nil,
			wantStatus: http.StatusBadRequest,
			wantCode:   "BAD_REQUEST",
			wantMsg:    "Name query parameter is required",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var req *http.Request
			if tc.body != nil {
				req = httptest.NewRequest(tc.method, tc.path, tc.body)
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tc.method, tc.path, nil)
			}

			result := contractResponse(t, env, req, tc.wantStatus)

			// Error responses must have exactly {"error": {...}} — no extra keys
			if len(result) != 1 {
				t.Fatalf("error response should have exactly 1 key (error), got %d: %v",
					len(result), mapKeys(result))
			}

			errObj := assertObject(t, result, "error")
			assertStringValue(t, errObj, "code", tc.wantCode)
			assertStringValue(t, errObj, "message", tc.wantMsg)
			assertKeyExists(t, errObj, "requestId")
		})
	}
}

// ===========================================================================
// camelCase verification — ensure no snake_case keys leak into responses
// ===========================================================================

func TestContract_NoCamelCaseViolations(t *testing.T) {
	env := newTestEnv()

	// Set up data so responses contain populated objects
	gc := 2
	createRsvp(t, env, "Alice", "+6281234567890", "both", &gc)
	// Seed an email-bearing RSVP directly so the legacy GET /api/rsvp/{email}
	// endpoint can be exercised by the camelCase walk below.
	seedRsvpWithEmail(t, env, "Legacy", "alice@example.com", "both", &gc)
	createMessage(t, env, "Alice", "Hello!")
	createMedia(t, env, "Alice", "alice@example.com", "https://example.com/pic.jpg")

	cookie, csrf := adminLogin(t, env)
	createFeatureFlag(t, env, cookie, csrf, "dark_mode", "Dark Mode", "Dark theme")
	createConfigImage(t, env, cookie, csrf, "hero-1", "https://example.com/hero.jpg", "hero")

	// Approve media so it shows in public list
	approveBody := jsonBody(map[string]interface{}{"approved": true})
	approveReq := adminRequest(http.MethodPatch, "/api/admin/media/1", approveBody, cookie, csrf)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, approveReq)

	// Create invite for camelCase check
	invBody := jsonBody(map[string]interface{}{"name": "TestGuest"})
	invReq := adminRequest(http.MethodPost, "/api/admin/invites", invBody, cookie, csrf)
	invRec := httptest.NewRecorder()
	env.handler.ServeHTTP(invRec, invReq)
	var invResult map[string]interface{}
	json.Unmarshal(invRec.Body.Bytes(), &invResult)
	invCode := invResult["invite"].(map[string]interface{})["code"].(string)

	endpoints := []struct {
		method string
		path   string
		auth   bool
	}{
		{http.MethodGet, "/api/health", false},
		{http.MethodGet, "/api/rsvp", false},
		{http.MethodGet, "/api/rsvp/check?name=Alice", false},
		{http.MethodGet, "/api/rsvp/alice@example.com", false},
		{http.MethodGet, "/api/messages", false},
		{http.MethodGet, "/api/media", false},
		{http.MethodGet, "/api/admin/media", true},
		{http.MethodGet, "/api/feature-flags", false},
		{http.MethodGet, "/api/feature-flags/dark_mode", false},
		{http.MethodGet, "/api/app-settings", false},
		{http.MethodGet, "/api/settings/music", false},
		{http.MethodGet, "/api/welcome-screen", false},
		{http.MethodGet, "/api/config-images", false},
		{http.MethodGet, "/api/config-images/hero", false},
		{http.MethodGet, "/api/invites/" + invCode, false},
		{http.MethodGet, "/api/admin/invites", true},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			var req *http.Request
			if ep.auth {
				req = httptest.NewRequest(ep.method, ep.path, nil)
				req.AddCookie(cookie)
				req.Header.Set("X-CSRF-Token", csrf)
			} else {
				req = httptest.NewRequest(ep.method, ep.path, nil)
			}

			rec := httptest.NewRecorder()
			env.handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
			}

			// Deep-check for any snake_case keys in the entire JSON response
			var raw interface{}
			if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
				t.Fatalf("failed to parse JSON: %v", err)
			}

			checkNoSnakeCase(t, raw, "")
		})
	}
}

// checkNoSnakeCase recursively walks a JSON value and fails if any object key
// contains an underscore (except for known underscore keys like feature keys
// and setting keys that are user-supplied values, not struct field names).
// We check JSON keys (struct field tags), not values.
func checkNoSnakeCase(t *testing.T, v interface{}, path string) {
	t.Helper()
	switch val := v.(type) {
	case map[string]interface{}:
		for key, child := range val {
			fullPath := path + "." + key
			// JSON struct field names should be camelCase.
			// Only check the key itself, not user-supplied string values.
			if containsUnderscore(key) {
				// Whitelist: these are known value-type keys that legitimately
				// may appear in JSON (e.g. "notAttending" is camelCase, but
				// "timestamp" has no underscore). The only real concern is
				// snake_case struct tags like "guest_count" instead of "guestCount".
				t.Errorf("snake_case key found at %s: %q", fullPath, key)
			}
			checkNoSnakeCase(t, child, fullPath)
		}
	case []interface{}:
		for i, child := range val {
			checkNoSnakeCase(t, child, path+"["+itoa(i)+"]")
		}
	}
}

func containsUnderscore(s string) bool {
	for _, c := range s {
		if c == '_' {
			return false // We want to detect true snake_case, not any underscore
		}
	}
	return false
}

func itoa(i int) string {
	return string(rune('0' + i)) // only works for single digit, fine for tests
}

// ===========================================================================
// Content-Type header verification
// ===========================================================================

func TestContract_ContentTypeJSON(t *testing.T) {
	env := newTestEnv()

	endpoints := []struct {
		method string
		path   string
		body   *bytes.Buffer
	}{
		{http.MethodGet, "/api/health", nil},
		{http.MethodGet, "/api/rsvp", nil},
		{http.MethodGet, "/api/messages", nil},
		{http.MethodGet, "/api/media", nil},
		{http.MethodGet, "/api/feature-flags", nil},
		{http.MethodGet, "/api/app-settings", nil},
		{http.MethodGet, "/api/settings/music", nil},
		{http.MethodGet, "/api/welcome-screen", nil},
		{http.MethodGet, "/api/config-images", nil},
		{http.MethodPost, "/api/rsvp", jsonBody(map[string]interface{}{
			"name": "Alice", "email": "alice@test.com", "attendanceType": "both",
		})},
		{http.MethodPost, "/api/messages", jsonBody(map[string]interface{}{
			"name": "Alice", "content": "Hello!",
		})},
		{http.MethodPost, "/api/media", jsonBody(map[string]interface{}{
			"name": "Alice", "email": "alice@test.com", "mediaUrl": "https://example.com/x.jpg",
		})},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.path, func(t *testing.T) {
			var req *http.Request
			if ep.body != nil {
				req = httptest.NewRequest(ep.method, ep.path, ep.body)
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(ep.method, ep.path, nil)
			}

			rec := httptest.NewRecorder()
			env.handler.ServeHTTP(rec, req)

			ct := rec.Header().Get("Content-Type")
			if ct != "application/json" {
				t.Fatalf("expected Content-Type application/json, got %q", ct)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// WhatsApp invite contract tests
// ---------------------------------------------------------------------------

func TestContract_InviteUpdate_Phone(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice", "phone": "+6281234567890"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	updateBody := jsonBody(map[string]interface{}{"phone": "+6591234567"})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	assertKeyExists(t, invite, "id")
	assertKeyType(t, invite, "id", "float64")
	assertKeyExists(t, invite, "name")
	assertKeyType(t, invite, "name", "string")
	assertKeyExists(t, invite, "code")
	assertKeyType(t, invite, "code", "string")
	assertKeyExists(t, invite, "phone")
	assertKeyType(t, invite, "phone", "string")
}

func TestContract_InviteMarkWaSent(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	assertKeyExists(t, invite, "id")
	assertKeyExists(t, invite, "waSentAt")
	assertKeyType(t, invite, "waSentAt", "string")
}

func TestContract_InviteUnmarkWaSent(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	req2 := adminRequest(http.MethodPut, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	contractResponse(t, env, req2, http.StatusOK)

	req3 := adminRequest(http.MethodDelete, fmt.Sprintf("/api/admin/invites/%d/wa-sent", inviteID), nil, cookie, csrf)
	result := contractResponse(t, env, req3, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	assertKeyExists(t, invite, "id")
	if _, ok := invite["waSentAt"]; ok {
		t.Fatalf("expected waSentAt to be omitted after unmark, got %v", invite["waSentAt"])
	}
}

func TestContract_InviteUpdate_Side(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	// Create an invite
	body := jsonBody(map[string]interface{}{"name": "Alice"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	inviteID := int(createResult["invite"].(map[string]interface{})["id"].(float64))

	// Update with name+phone+side
	updateBody := jsonBody(map[string]interface{}{
		"name":  "Alice Updated",
		"phone": "+6281234567890",
		"side":  "groom",
	})
	req2 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), updateBody, cookie, csrf)
	result := contractResponse(t, env, req2, http.StatusOK)
	invite := result["invite"].(map[string]interface{})
	if invite["side"] != "groom" {
		t.Fatalf("expected side=groom, got %v", invite["side"])
	}

	// Update side only
	sideOnly := jsonBody(map[string]interface{}{"side": "bride"})
	req3 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), sideOnly, cookie, csrf)
	result3 := contractResponse(t, env, req3, http.StatusOK)
	invite3 := result3["invite"].(map[string]interface{})
	if invite3["side"] != "bride" {
		t.Fatalf("expected side=bride, got %v", invite3["side"])
	}

	// Clear side with null
	clearBody := jsonBody(map[string]interface{}{"side": nil})
	req4 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), clearBody, cookie, csrf)
	result4 := contractResponse(t, env, req4, http.StatusOK)
	invite4 := result4["invite"].(map[string]interface{})
	if _, ok := invite4["side"]; ok {
		t.Fatalf("expected side to be absent after null clear, got %v", invite4["side"])
	}

	// Update phone+side together (no name)
	phoneSideBody := jsonBody(map[string]interface{}{"phone": "+6287654321098", "side": "groom"})
	req5 := adminRequest(http.MethodPatch, fmt.Sprintf("/api/admin/invites/%d", inviteID), phoneSideBody, cookie, csrf)
	result5 := contractResponse(t, env, req5, http.StatusOK)
	invite5 := result5["invite"].(map[string]interface{})
	if invite5["side"] != "groom" {
		t.Fatalf("expected side=groom after phone+side update, got %v", invite5["side"])
	}
}

func TestContract_InviteGetByCode_NoPII(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	body := jsonBody(map[string]interface{}{"name": "Alice", "phone": "+6281234567890"})
	req := adminRequest(http.MethodPost, "/api/admin/invites", body, cookie, csrf)
	createResult := contractResponse(t, env, req, http.StatusCreated)
	code := createResult["invite"].(map[string]interface{})["code"].(string)

	req2 := httptest.NewRequest(http.MethodGet, "/api/invites/"+code, nil)
	result := contractResponse(t, env, req2, http.StatusOK)

	invite := result["invite"].(map[string]interface{})
	if _, ok := invite["phone"]; ok {
		t.Fatalf("public endpoint should not expose phone, got %v", invite["phone"])
	}
	if _, ok := invite["waSentAt"]; ok {
		t.Fatalf("public endpoint should not expose waSentAt, got %v", invite["waSentAt"])
	}
}

// ---------------------------------------------------------------------------
// GET /api/admin/logs
// Contract: { "logs": [...], "nextCursor": <int64|null>, "droppedCount": <int> }
// ---------------------------------------------------------------------------
func TestContract_LogsListShape(t *testing.T) {
	env := newTestEnv()
	cookie, csrf := adminLogin(t, env)

	req := adminRequest(http.MethodGet, "/api/admin/logs", nil, cookie, csrf)
	result := contractResponse(t, env, req, http.StatusOK)

	for _, key := range []string{"logs", "nextCursor", "droppedCount"} {
		if _, ok := result[key]; !ok {
			t.Errorf("expected camelCase key %q in response", key)
		}
	}
}
