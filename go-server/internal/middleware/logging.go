package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// shouldSkipLogging excludes health checks and static asset serving from log capture.
func shouldSkipLogging(path string) bool {
	if path == "/api/health" {
		return true
	}
	if strings.HasPrefix(path, "/storage/") {
		return true
	}
	return false
}

func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)

		next.ServeHTTP(ww, r)

		if shouldSkipLogging(r.URL.Path) {
			return
		}

		reqID := chimw.GetReqID(r.Context())
		slog.Info("HTTP request",
			"source", "http",
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"durationMs", time.Since(start).Milliseconds(),
			"requestId", reqID,
		)
	})
}
