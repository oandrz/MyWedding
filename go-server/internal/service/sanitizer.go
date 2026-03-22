package service

import "github.com/microcosm-cc/bluemonday"

// Sanitizer strips dangerous HTML tags from user input while allowing basic formatting.
type Sanitizer struct {
	policy *bluemonday.Policy
}

// NewSanitizer creates a sanitizer that allows only basic formatting tags.
func NewSanitizer() *Sanitizer {
	p := bluemonday.NewPolicy()
	p.AllowElements("b", "i", "em", "strong", "br")
	return &Sanitizer{policy: p}
}

// Sanitize strips disallowed HTML from the input string.
func (s *Sanitizer) Sanitize(input string) string {
	return s.policy.Sanitize(input)
}
