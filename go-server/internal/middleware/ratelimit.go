package middleware

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"
	"time"
)

// RateLimiter tracks request attempts per IP within a time window.
type RateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
	limit    int
	window   time.Duration
}

// NewRateLimiter creates a rate limiter allowing `limit` requests per `windowSec` seconds per IP.
func NewRateLimiter(limit, windowSec int) *RateLimiter {
	return &RateLimiter{
		attempts: make(map[string][]time.Time),
		limit:    limit,
		window:   time.Duration(windowSec) * time.Second,
	}
}

// Middleware returns an http.Handler that enforces rate limiting.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := extractIP(r)

		rl.mu.Lock()
		now := time.Now()
		cutoff := now.Add(-rl.window)

		// Remove expired entries
		valid := rl.attempts[ip][:0]
		for _, t := range rl.attempts[ip] {
			if t.After(cutoff) {
				valid = append(valid, t)
			}
		}

		if len(valid) >= rl.limit {
			rl.attempts[ip] = valid
			rl.mu.Unlock()

			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(map[string]string{ //nolint:errcheck
				"message": "Too many login attempts. Please try again later.",
			})
			return
		}

		rl.attempts[ip] = append(valid, now)
		rl.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}

// extractIP returns the IP address from the request, stripping the port.
func extractIP(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
