package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/config"
)

// --- Auth Middleware Tests ---

func TestAuthNoSession(t *testing.T) {
	sessions := NewSessionStore(30 * time.Minute)
	handler := Auth(sessions)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}

	var body map[string]interface{}
	json.NewDecoder(w.Body).Decode(&body)
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("expected 'error' object in response")
	}
	if errObj["message"] != "Unauthorized: No session found" {
		t.Errorf("unexpected message: %s", errObj["message"])
	}
}

func TestAuthInvalidSession(t *testing.T) {
	sessions := NewSessionStore(30 * time.Minute)
	handler := Auth(sessions)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/test", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: "invalid-id"})
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}

	var body map[string]interface{}
	json.NewDecoder(w.Body).Decode(&body)
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("expected 'error' object in response")
	}
	if errObj["message"] != "Unauthorized: Invalid or expired session" {
		t.Errorf("unexpected message: %s", errObj["message"])
	}
}

func TestAuthValidSession(t *testing.T) {
	sessions := NewSessionStore(30 * time.Minute)
	session := sessions.CreateSession("127.0.0.1")

	called := false
	handler := Auth(sessions)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		sid := GetSessionID(r)
		if sid != session.SessionID {
			t.Errorf("expected session ID %s, got %s", session.SessionID, sid)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/test", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: session.SessionID})
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !called {
		t.Error("handler was not called")
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- CSRF Tests ---

func TestCSRFSkipsGET(t *testing.T) {
	csrf := NewCSRFStore()
	handler := CSRFProtection(csrf)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for GET, got %d", w.Code)
	}
}

func TestCSRFNoSessionOnPOST(t *testing.T) {
	csrf := NewCSRFStore()
	handler := CSRFProtection(csrf)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestCSRFMissingToken(t *testing.T) {
	csrf := NewCSRFStore()
	csrf.GenerateToken("session123")

	handler := CSRFProtection(csrf)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: "session123"})
	// No X-CSRF-Token header
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestCSRFInvalidToken(t *testing.T) {
	csrf := NewCSRFStore()
	csrf.GenerateToken("session123")

	handler := CSRFProtection(csrf)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: "session123"})
	req.Header.Set("X-CSRF-Token", "wrong-token")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403, got %d", w.Code)
	}
}

func TestCSRFValidToken(t *testing.T) {
	csrf := NewCSRFStore()
	token := csrf.GenerateToken("session123")

	handler := CSRFProtection(csrf)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	req.AddCookie(&http.Cookie{Name: "admin_session", Value: "session123"})
	req.Header.Set("X-CSRF-Token", token)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

// --- CORS Tests ---

func TestCORSDevAllowsAll(t *testing.T) {
	os.Clearenv()
	os.Setenv("GO_ENV", "development")
	cfg := config.Load()

	handler := CORS(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	origin := w.Header().Get("Access-Control-Allow-Origin")
	if origin != "http://localhost:3000" {
		t.Errorf("expected origin http://localhost:3000, got %s", origin)
	}

	credentials := w.Header().Get("Access-Control-Allow-Credentials")
	if credentials != "true" {
		t.Errorf("expected credentials true, got %s", credentials)
	}
}

func TestCORSProdAllowsListed(t *testing.T) {
	os.Clearenv()
	os.Setenv("GO_ENV", "production")
	os.Setenv("CORS_ORIGINS", "https://wedding.com")
	cfg := config.Load()

	handler := CORS(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Allowed origin
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://wedding.com")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	origin := w.Header().Get("Access-Control-Allow-Origin")
	if origin != "https://wedding.com" {
		t.Errorf("expected origin https://wedding.com, got %s", origin)
	}

	// Disallowed origin
	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req2.Header.Set("Origin", "https://evil.com")
	w2 := httptest.NewRecorder()

	handler.ServeHTTP(w2, req2)

	origin2 := w2.Header().Get("Access-Control-Allow-Origin")
	if origin2 != "" {
		t.Errorf("expected empty origin for disallowed, got %s", origin2)
	}
}

func TestCORSPreflight(t *testing.T) {
	os.Clearenv()
	os.Setenv("GO_ENV", "development")
	cfg := config.Load()

	handler := CORS(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError) // Should not reach here
	}))

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for OPTIONS, got %d", w.Code)
	}

	methods := w.Header().Get("Access-Control-Allow-Methods")
	if methods == "" {
		t.Error("expected Access-Control-Allow-Methods header")
	}
}
