package config

import (
	"log/slog"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

type Config struct {
	Env                      string
	Port                     int
	DatabaseURL              string
	RedisURL                 string
	AdminPassword            string
	AdminPasswordHash        string // bcrypt hash — preferred over AdminPassword
	SessionMaxAge            int    // seconds
	CORSOrigins              []string
	SupabaseURL              string
	SupabaseServiceKey       string
	SupabaseBucketID         string
	GoogleServiceAccountJSON string
	GoogleDriveFolderID      string
	StaticDir                string
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
		Env:                      env,
		Port:                     port,
		DatabaseURL:              getEnv("DATABASE_URL", ""),
		RedisURL:                 getEnv("REDIS_URL", ""),
		AdminPassword:            getEnv("ADMIN_PASSWORD", "admin123"),
		SessionMaxAge:            getEnvInt("SESSION_MAX_AGE", 1800), // 30 minutes
		SupabaseURL:              getEnv("SUPABASE_URL", ""),
		SupabaseServiceKey:       getEnv("SUPABASE_SERVICE_KEY", ""),
		SupabaseBucketID:         getEnv("SUPABASE_BUCKET_ID", ""),
		GoogleServiceAccountJSON: getEnv("GOOGLE_SERVICE_ACCOUNT_JSON", ""),
		GoogleDriveFolderID:      getEnv("GOOGLE_DRIVE_FOLDER_ID", ""),
		StaticDir:                getEnv("STATIC_DIR", ""),
	}

	cfg.AdminPasswordHash = getEnv("ADMIN_PASSWORD_HASH", "")

	// If no hash provided but plaintext password exists, hash it at startup and warn
	if cfg.AdminPasswordHash == "" && cfg.AdminPassword != "" {
		slog.Warn("ADMIN_PASSWORD is deprecated — use ADMIN_PASSWORD_HASH with a bcrypt hash instead")
		hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
		if err != nil {
			slog.Error("Failed to hash admin password", "error", err)
			os.Exit(1)
		}
		cfg.AdminPasswordHash = string(hash)
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
	for _, s := range strings.Split(val, ",") {
		s = strings.TrimSpace(s)
		if s != "" {
			result = append(result, s)
		}
	}
	return result
}
