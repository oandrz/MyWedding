package middleware

import (
	"bytes"
	"crypto/sha256"
	"fmt"
	"net/http"
)

// cachingResponseWriter captures the response body and status for ETag computation.
type cachingResponseWriter struct {
	http.ResponseWriter
	buf        bytes.Buffer
	statusCode int
	written    bool
}

func (w *cachingResponseWriter) WriteHeader(code int) {
	w.statusCode = code
	w.written = true
}

func (w *cachingResponseWriter) Write(b []byte) (int, error) {
	if !w.written {
		w.statusCode = http.StatusOK
		w.written = true
	}
	return w.buf.Write(b)
}

// CacheControl returns middleware that sets Cache-Control and ETag headers.
// maxAge is in seconds. ETag is computed from a hash of the response body.
func CacheControl(maxAge int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Capture the response to compute ETag
			crw := &cachingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}
			next.ServeHTTP(crw, r)

			body := crw.buf.Bytes()
			hash := sha256.Sum256(body)
			etag := fmt.Sprintf(`"%x"`, hash[:8])

			// Check If-None-Match
			if r.Header.Get("If-None-Match") == etag {
				w.Header().Set("ETag", etag)
				w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", maxAge))
				w.WriteHeader(http.StatusNotModified)
				return
			}

			w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", maxAge))
			w.Header().Set("ETag", etag)
			w.WriteHeader(crw.statusCode)
			w.Write(body) //nolint:errcheck
		})
	}
}
