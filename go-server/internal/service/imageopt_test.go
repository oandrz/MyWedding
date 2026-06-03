package service

import "testing"

func TestGenerateDisplayFilename(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{"with extension", "gallery_123-456.jpg", "gallery_123-456-display.jpg"},
		{"png becomes display jpg", "photo.png", "photo-display.jpg"},
		{"no extension", "photo", "photo-display.jpg"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := GenerateDisplayFilename(tc.input); got != tc.expected {
				t.Errorf("GenerateDisplayFilename(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}
