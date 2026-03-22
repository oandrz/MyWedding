package handler

import (
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/middleware"
)

// AuthHandler handles authentication-related endpoints.
type AuthHandler struct {
	Config   *config.Config
	Sessions middleware.Sessions
	CSRF     *middleware.CSRFStore
}

// Login handles POST /api/admin/login.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := parseJSON(r, &body); err != nil {
		writeError(w, r, http.StatusBadRequest, "Password is required")
		return
	}

	if body.Password == "" {
		writeError(w, r, http.StatusBadRequest, "Password is required")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(h.Config.AdminPasswordHash), []byte(body.Password)); err != nil {
		writeError(w, r, http.StatusUnauthorized, "Invalid admin password")
		return
	}

	// Create session
	session := h.Sessions.CreateSession(r.RemoteAddr)
	csrfToken := h.CSRF.GenerateToken(session.SessionID)

	// Set cookie — same-origin deployment uses Lax; Secure only when CORS origins use HTTPS
	secure := hasHTTPSOrigin(h.Config.CORSOrigins)

	http.SetCookie(w, &http.Cookie{
		Name:     "admin_session",
		Value:    session.SessionID,
		HttpOnly: true,
		Secure:   secure,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   h.Config.SessionMaxAge,
	})

	writeJSON(w, http.StatusOK, map[string]string{
		"message":   "Login successful",
		"csrfToken": csrfToken,
	})
}

// Logout handles POST /api/admin/logout.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	sessionID := middleware.GetSessionID(r)

	h.Sessions.DeleteSession(sessionID)
	h.CSRF.DeleteToken(sessionID)

	http.SetCookie(w, &http.Cookie{
		Name:     "admin_session",
		Value:    "",
		HttpOnly: true,
		Secure:   hasHTTPSOrigin(h.Config.CORSOrigins),
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Logout successful",
	})
}

// Validate handles POST /api/admin/validate.
// Returns the existing CSRF token or generates a new one if missing (e.g. after server restart).
func (h *AuthHandler) Validate(w http.ResponseWriter, r *http.Request) {
	sessionID := middleware.GetSessionID(r)

	// Reuse existing token if available; generate only if missing (server restart recovery)
	csrfToken, ok := h.CSRF.GetToken(sessionID)
	if !ok {
		csrfToken = h.CSRF.GenerateToken(sessionID)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":   "Admin session is valid",
		"valid":     true,
		"csrfToken": csrfToken,
	})
}

// hasHTTPSOrigin returns true if any configured CORS origin uses HTTPS.
func hasHTTPSOrigin(origins []string) bool {
	for _, origin := range origins {
		if strings.HasPrefix(origin, "https://") {
			return true
		}
	}
	return false
}
