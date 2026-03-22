package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	chimw "github.com/go-chi/chi/v5/middleware"
)

type contextKey string

const SessionIDKey contextKey = "sessionID"

func Auth(sessions Sessions) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("admin_session")
			if err != nil || cookie.Value == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]interface{}{"error": map[string]string{"code": "UNAUTHORIZED", "message": "Unauthorized: No session found", "requestId": chimw.GetReqID(r.Context())}}) //nolint:errcheck
				return
			}

			session := sessions.GetSession(cookie.Value)
			if session == nil {
				// Clear invalid cookie
				http.SetCookie(w, &http.Cookie{
					Name:     "admin_session",
					Value:    "",
					Path:     "/",
					MaxAge:   -1,
					HttpOnly: true,
				})
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusUnauthorized)
				json.NewEncoder(w).Encode(map[string]interface{}{"error": map[string]string{"code": "UNAUTHORIZED", "message": "Unauthorized: Invalid or expired session", "requestId": chimw.GetReqID(r.Context())}}) //nolint:errcheck
				return
			}

			ctx := context.WithValue(r.Context(), SessionIDKey, cookie.Value)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetSessionID(r *http.Request) string {
	if val, ok := r.Context().Value(SessionIDKey).(string); ok {
		return val
	}
	return ""
}
