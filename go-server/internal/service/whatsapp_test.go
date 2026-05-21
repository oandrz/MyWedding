package service

import "testing"

func TestPhoneToJID(t *testing.T) {
	cases := []struct {
		in  string
		out string
	}{
		{"+6281234567890", "6281234567890@s.whatsapp.net"},
		{"+1-800-555-1234", "18005551234@s.whatsapp.net"},
		{"+44 20 7946 0958", "442079460958@s.whatsapp.net"},
	}
	for _, c := range cases {
		got := phoneToJID(c.in)
		if got != c.out {
			t.Errorf("phoneToJID(%q) = %q, want %q", c.in, got, c.out)
		}
	}
}
