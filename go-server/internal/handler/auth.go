package handler

import (
	"crypto/subtle"
	"net/http"

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
		writeError(w, http.StatusBadRequest, "Password is required")
		return
	}

	if body.Password == "" {
		writeError(w, http.StatusBadRequest, "Password is required")
		return
	}

	if subtle.ConstantTimeCompare([]byte(body.Password), []byte(h.Config.AdminPassword)) != 1 {
		writeError(w, http.StatusUnauthorized, "Invalid admin password")
		return
	}

	// Create session
	session := h.Sessions.CreateSession(r.RemoteAddr)
	csrfToken := h.CSRF.GenerateToken(session.SessionID)

	// Set cookie
	sameSite := http.SameSiteLaxMode
	if h.Config.IsProduction() {
		sameSite = http.SameSiteNoneMode
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "admin_session",
		Value:    session.SessionID,
		HttpOnly: true,
		Secure:   h.Config.IsProduction(),
		Path:     "/",
		SameSite: sameSite,
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
		Path:     "/",
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
