package middleware

import "testing"

func TestShouldSkipLogging(t *testing.T) {
	cases := []struct {
		path string
		skip bool
	}{
		{"/api/health", true},
		{"/storage/photo.jpg", true},
		{"/storage/", true},
		{"/api/rsvp", false},
		{"/api/admin/logs", false},
	}
	for _, c := range cases {
		if got := shouldSkipLogging(c.path); got != c.skip {
			t.Errorf("shouldSkipLogging(%q) = %v, want %v", c.path, got, c.skip)
		}
	}
}
