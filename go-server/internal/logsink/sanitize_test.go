package logsink

import "testing"

func TestSanitizeAttrs_DropsSecrets(t *testing.T) {
	in := map[string]any{
		"service":       "whatsapp",
		"Authorization": "Bearer xyz",
		"cookie":        "admin_session=abc",
		"csrfToken":     "t",
		"password":      "p",
		"apiKey":        "k",
		"latencyMs":     42,
	}
	out := SanitizeAttrs(in)

	for _, banned := range []string{"Authorization", "cookie", "csrfToken", "password", "apiKey"} {
		if _, ok := out[banned]; ok {
			t.Errorf("expected key %q to be dropped", banned)
		}
	}
	if out["service"] != "whatsapp" {
		t.Errorf("expected safe key 'service' to be preserved")
	}
	if out["latencyMs"] != 42 {
		t.Errorf("expected safe key 'latencyMs' to be preserved")
	}
}

func TestSanitizePath_StripsQuery(t *testing.T) {
	if got := SanitizePath("/api/rsvp?token=secret"); got != "/api/rsvp" {
		t.Errorf("expected query stripped, got %q", got)
	}
	if got := SanitizePath("/api/rsvp"); got != "/api/rsvp" {
		t.Errorf("expected unchanged, got %q", got)
	}
}
