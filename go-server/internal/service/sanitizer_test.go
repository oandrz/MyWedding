package service

import "testing"

func TestSanitize(t *testing.T) {
	s := NewSanitizer()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"plain text", "Hello World", "Hello World"},
		{"strips script", `<script>alert('xss')</script>Hello`, "Hello"},
		{"allows bold", "<b>Bold</b>", "<b>Bold</b>"},
		{"allows italic", "<i>Italic</i>", "<i>Italic</i>"},
		{"allows em", "<em>Emphasis</em>", "<em>Emphasis</em>"},
		{"allows strong", "<strong>Strong</strong>", "<strong>Strong</strong>"},
		{"allows br", "Line1<br>Line2", "Line1<br>Line2"},
		{"strips div", "<div>Content</div>", "Content"},
		{"strips onclick", `<b onclick="alert('xss')">Bold</b>`, "<b>Bold</b>"},
		{"strips img", `<img src="x" onerror="alert('xss')">`, ""},
		{"empty string", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := s.Sanitize(tt.input)
			if got != tt.want {
				t.Errorf("Sanitize(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
