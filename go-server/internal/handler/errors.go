package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	chimw "github.com/go-chi/chi/v5/middleware"
)

const (
	ErrCodeBadRequest      = "BAD_REQUEST"
	ErrCodeUnauthorized    = "UNAUTHORIZED"
	ErrCodeForbidden       = "FORBIDDEN"
	ErrCodeNotFound        = "NOT_FOUND"
	ErrCodeConflict        = "CONFLICT"
	ErrCodeTooManyRequests = "TOO_MANY_REQUESTS"
	ErrCodeInternal        = "INTERNAL_ERROR"
	ErrCodeDuplicateEmail  = "RSVP_DUPLICATE_EMAIL"
	ErrCodeUploadTooLarge  = "UPLOAD_TOO_LARGE"
	ErrCodeInvalidFileType = "INVALID_FILE_TYPE"
)

// AppError represents a structured error response.
type AppError struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	RequestID string `json:"requestId"`
}

// respondError writes a structured JSON error response.
func respondError(w http.ResponseWriter, r *http.Request, statusCode int, code, message string) {
	reqID := chimw.GetReqID(r.Context())

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	err := json.NewEncoder(w).Encode(map[string]interface{}{
		"error": AppError{
			Code:      code,
			Message:   message,
			RequestID: reqID,
		},
	})
	if err != nil {
		slog.Error("Failed to encode error response", "error", err)
	}
}

// statusToCode maps an HTTP status code to a structured error code.
func statusToCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return ErrCodeBadRequest
	case http.StatusUnauthorized:
		return ErrCodeUnauthorized
	case http.StatusForbidden:
		return ErrCodeForbidden
	case http.StatusNotFound:
		return ErrCodeNotFound
	case http.StatusConflict:
		return ErrCodeConflict
	case http.StatusTooManyRequests:
		return ErrCodeTooManyRequests
	default:
		return ErrCodeInternal
	}
}
