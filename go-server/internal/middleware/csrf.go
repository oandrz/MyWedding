package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"sync"
)

type CSRFStore struct {
	mu     sync.Mutex
	tokens map[string]string // sessionID → token
}

func NewCSRFStore() *CSRFStore {
	return &CSRFStore{
		tokens: make(map[string]string),
	}
}

func (c *CSRFStore) GenerateToken(sessionID string) string {
	c.mu.Lock()
	defer c.mu.Unlock()

	b := make([]byte, 32)
	rand.Read(b)
	token := hex.EncodeToString(b)
	c.tokens[sessionID] = token
	return token
}

func (c *CSRFStore) GetToken(sessionID string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	token, ok := c.tokens[sessionID]
	return token, ok
}

func (c *CSRFStore) DeleteToken(sessionID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.tokens, sessionID)
}

func CSRFProtection(csrf *CSRFStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip for safe methods
			if r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Get session ID from cookie
			cookie, err := r.Cookie("admin_session")
			if err != nil || cookie.Value == "" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(map[string]string{"message": "No session found"})
				return
			}

			expectedToken, ok := csrf.GetToken(cookie.Value)
			if !ok {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(map[string]string{"message": "CSRF token not found"})
				return
			}

			providedToken := r.Header.Get("X-CSRF-Token")
			if providedToken == "" || providedToken != expectedToken {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				json.NewEncoder(w).Encode(map[string]string{"message": "Invalid CSRF token"})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
