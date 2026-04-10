package models

import "testing"

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{"valid indonesian", "+6281234567890", "+6281234567890", false},
		{"valid singapore", "+6591234567", "+6591234567", false},
		{"with spaces", "+62 812 3456 7890", "+6281234567890", false},
		{"with dashes", "+62-812-3456-7890", "+6281234567890", false},
		{"with parens", "+62(812)34567890", "+6281234567890", false},
		{"mixed formatting", "+65 9123-4567", "+6591234567", false},
		{"missing plus", "6281234567890", "", true},
		{"too short", "+12345", "", true},
		{"too long", "+1234567890123456", "", true},
		{"letters", "+62abc1234567", "", true},
		{"empty", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizePhone(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NormalizePhone(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("NormalizePhone(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
