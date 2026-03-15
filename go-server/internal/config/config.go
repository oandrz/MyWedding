package config

import (
	"log/slog"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Env            string
	Port           int
	DatabaseURL    string
	RedisURL       string
	AdminPassword  string
	SessionMaxAge  int // seconds
	CORSOrigins    []string
	GCSBucketID    string
	GoogleClientID string
	GoogleSecret   string
	GoogleRefresh  string
}

func Load() *Config {
	env := os.Getenv("GO_ENV")
	if env == "" {
		env = "development"
	}

	// Load environment-specific .env file
	envFile := ".env." + env
	if err := godotenv.Load(envFile); err != nil {
		slog.Warn("Could not load env file, using environment variables", "file", envFile, "error", err)
	}

	// Also load .env as fallback
	_ = godotenv.Load(".env")

	port := getEnvInt("PORT", 5000)

	cfg := &Config{
		Env:            env,
		Port:           port,
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		RedisURL:       getEnv("REDIS_URL", ""),
		AdminPassword:  getEnv("ADMIN_PASSWORD", "admin123"),
		SessionMaxAge:  getEnvInt("SESSION_MAX_AGE", 1800), // 30 minutes
		GCSBucketID:    getEnv("GCS_BUCKET_ID", ""),
		GoogleClientID: getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleSecret:   getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRefresh:  getEnv("GOOGLE_REFRESH_TOKEN", ""),
	}

	if cfg.IsProduction() {
		cfg.CORSOrigins = splitEnv("CORS_ORIGINS", []string{})
	} else {
		cfg.CORSOrigins = []string{"*"}
	}

	return cfg
}

func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

func (c *Config) LogLevel() slog.Level {
	if c.IsProduction() {
		return slog.LevelInfo
	}
	return slog.LevelDebug
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

func splitEnv(key string, fallback []string) []string {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	var result []string
	for _, s := range split(val, ",") {
		s = trim(s)
		if s != "" {
			result = append(result, s)
		}
	}
	return result
}

func split(s, sep string) []string {
	var parts []string
	for {
		idx := indexOf(s, sep)
		if idx < 0 {
			parts = append(parts, s)
			break
		}
		parts = append(parts, s[:idx])
		s = s[idx+len(sep):]
	}
	return parts
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func trim(s string) string {
	for len(s) > 0 && (s[0] == ' ' || s[0] == '\t') {
		s = s[1:]
	}
	for len(s) > 0 && (s[len(s)-1] == ' ' || s[len(s)-1] == '\t') {
		s = s[:len(s)-1]
	}
	return s
}
