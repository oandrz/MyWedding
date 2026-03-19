package middleware

import (
	"net/http"
	"time"
)

// ExtendWriteDeadline returns middleware that extends the server's
// read/write deadlines for long-running handlers such as file uploads
// to external services. It uses http.ResponseController to override
// the connection-level deadline without changing the global server config.
func ExtendWriteDeadline(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			rc := http.NewResponseController(w)
			deadline := time.Now().Add(d)
			_ = rc.SetReadDeadline(deadline)
			_ = rc.SetWriteDeadline(deadline)
			next.ServeHTTP(w, r)
		})
	}
}
