package config

import (
	"os"
	"testing"
)

func TestLoadDevelopmentConfig(t *testing.T) {
	// Clear and set environment
	os.Clearenv()
	os.Setenv("GO_ENV", "development")
	os.Setenv("PORT", "5000")
	os.Setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/testdb")
	os.Setenv("ADMIN_PASSWORD", "testpass")

	cfg := Load()

	if cfg.Env != "development" {
		t.Errorf("expected env=development, got %s", cfg.Env)
	}
	if cfg.IsProduction() {
		t.Error("expected IsProduction()=false for development")
	}
	if cfg.Port != 5000 {
		t.Errorf("expected port=5000, got %d", cfg.Port)
	}
	if cfg.DatabaseURL != "postgresql://user:pass@localhost:5432/testdb" {
		t.Errorf("unexpected DatabaseURL: %s", cfg.DatabaseURL)
	}
	if cfg.AdminPassword != "testpass" {
		t.Errorf("expected admin password 'testpass', got %s", cfg.AdminPassword)
	}
	// Dev should allow all origins
	if len(cfg.CORSOrigins) != 1 || cfg.CORSOrigins[0] != "*" {
		t.Errorf("expected CORS origins [*], got %v", cfg.CORSOrigins)
	}
}

func TestLoadProductionConfig(t *testing.T) {
	os.Clearenv()
	os.Setenv("GO_ENV", "production")
	os.Setenv("PORT", "8080")
	os.Setenv("DATABASE_URL", "postgresql://prod:pass@db:5432/proddb")
	os.Setenv("CORS_ORIGINS", "https://wedding.com,https://www.wedding.com")

	cfg := Load()

	if cfg.Env != "production" {
		t.Errorf("expected env=production, got %s", cfg.Env)
	}
	if !cfg.IsProduction() {
		t.Error("expected IsProduction()=true for production")
	}
	if cfg.Port != 8080 {
		t.Errorf("expected port=8080, got %d", cfg.Port)
	}
	if len(cfg.CORSOrigins) != 2 {
		t.Fatalf("expected 2 CORS origins, got %d: %v", len(cfg.CORSOrigins), cfg.CORSOrigins)
	}
	if cfg.CORSOrigins[0] != "https://wedding.com" {
		t.Errorf("unexpected first CORS origin: %s", cfg.CORSOrigins[0])
	}
	if cfg.CORSOrigins[1] != "https://www.wedding.com" {
		t.Errorf("unexpected second CORS origin: %s", cfg.CORSOrigins[1])
	}
}

func TestDefaultConfig(t *testing.T) {
	os.Clearenv()
	// No GO_ENV set — should default to development

	cfg := Load()

	if cfg.Env != "development" {
		t.Errorf("expected default env=development, got %s", cfg.Env)
	}
	if cfg.Port != 5000 {
		t.Errorf("expected default port=5000, got %d", cfg.Port)
	}
	if cfg.SessionMaxAge != 1800 {
		t.Errorf("expected default session max age 1800, got %d", cfg.SessionMaxAge)
	}
	if cfg.AdminPassword != "admin123" {
		t.Errorf("expected default admin password, got %s", cfg.AdminPassword)
	}
}

func TestLogLevel(t *testing.T) {
	os.Clearenv()
	os.Setenv("GO_ENV", "development")
	devCfg := Load()

	os.Clearenv()
	os.Setenv("GO_ENV", "production")
	prodCfg := Load()

	if devCfg.LogLevel() >= prodCfg.LogLevel() {
		t.Error("dev log level should be lower (more verbose) than production")
	}
}
