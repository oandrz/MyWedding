package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"testing"
)

func validServiceAccountJSON(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	raw, marshalErr := json.Marshal(map[string]string{
		"type":              "service_account",
		"project_id":        "test-project",
		"private_key_id":    "key-id",
		"private_key":       string(keyPEM),
		"client_email":      "test@test-project.iam.gserviceaccount.com",
		"client_id":         "123456789",
		"auth_uri":          "https://accounts.google.com/o/oauth2/auth",
		"token_uri":         "https://oauth2.googleapis.com/token",
	})
	if marshalErr != nil {
		t.Fatalf("marshal service account JSON: %v", marshalErr)
	}
	return base64.StdEncoding.EncodeToString(raw)
}

func TestNewGoogleDriveServiceFromServiceAccount(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{
			name:    "empty input returns error",
			input:   "",
			wantErr: true,
		},
		{
			name:    "invalid base64 returns error",
			input:   "not-valid-base64!!!",
			wantErr: true,
		},
		{
			name:    "valid base64 but invalid JSON returns error",
			input:   base64.StdEncoding.EncodeToString([]byte("not json")),
			wantErr: true,
		},
		{
			name:    "valid service account JSON returns service",
			input:   validServiceAccountJSON(t),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, err := NewGoogleDriveServiceFromServiceAccount(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if svc == nil {
				t.Fatal("expected non-nil service")
			}
			if svc.httpClient == nil {
				t.Fatal("expected non-nil httpClient")
			}
			if svc.folderID == "" {
				t.Fatal("expected non-empty folderID")
			}
		})
	}
}
