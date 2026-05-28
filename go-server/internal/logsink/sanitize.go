package logsink

import "strings"

// deniedSubstrings are matched (case-insensitive) against attr keys; any match is dropped.
var deniedSubstrings = []string{
	"cookie", "authorization", "token", "password", "csrf", "secret", "apikey",
}

// SanitizeAttrs returns a copy of attrs with sensitive keys removed.
func SanitizeAttrs(attrs map[string]any) map[string]any {
	if len(attrs) == 0 {
		return nil
	}
	out := make(map[string]any, len(attrs))
	for k, v := range attrs {
		lk := strings.ToLower(k)
		denied := false
		for _, sub := range deniedSubstrings {
			if strings.Contains(lk, sub) {
				denied = true
				break
			}
		}
		if !denied {
			out[k] = v
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// SanitizePath strips the query string, leaving only the URL path.
func SanitizePath(p string) string {
	if i := strings.IndexByte(p, '?'); i >= 0 {
		return p[:i]
	}
	return p
}
