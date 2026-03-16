package handler

import (
	"encoding/json"
	"net/http"
	"strings"
)

// writeJSON writes a JSON response with the given status code.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

// writeError writes a JSON error response with the given status code and message.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

// parseJSON decodes the request body into v.
func parseJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// detectMediaType determines the media type from a URL string.
// YouTube/Vimeo links and video file extensions return "video".
// Image file extensions return "image". Default is "image".
func detectMediaType(url string) string {
	lower := strings.ToLower(url)

	// Check for video hosting platforms
	if strings.Contains(lower, "youtube.com") || strings.Contains(lower, "youtu.be") ||
		strings.Contains(lower, "vimeo.com") {
		return "video"
	}

	// Check for image extensions
	imageExts := []string{".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}
	for _, ext := range imageExts {
		if strings.HasSuffix(lower, ext) {
			return "image"
		}
	}

	// Check for video extensions
	videoExts := []string{".mp4", ".mov", ".avi", ".wmv", ".webm", ".mkv"}
	for _, ext := range videoExts {
		if strings.HasSuffix(lower, ext) {
			return "video"
		}
	}

	return "image"
}
