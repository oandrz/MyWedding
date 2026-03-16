package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/database"
	"github.com/andreasronaldo/wedding-server/internal/middleware"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/router"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg := config.Load()

	// Configure structured logging
	var logHandler slog.Handler
	if cfg.IsProduction() {
		logHandler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel()})
	} else {
		logHandler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel()})
	}
	slog.SetDefault(slog.New(logHandler))

	ctx := context.Background()

	// Initialize repository: PostgreSQL if DATABASE_URL is set, otherwise in-memory
	var repo repository.Repository
	var dbPool *pgxpool.Pool
	var routerOpts []router.Option

	if cfg.DatabaseURL != "" {
		pool, err := database.Connect(ctx, cfg.DatabaseURL)
		if err != nil {
			slog.Error("Failed to connect to database", "error", err)
			os.Exit(1)
		}
		dbPool = pool
		repo = repository.NewPostgresRepository(pool)
		routerOpts = append(routerOpts, router.WithDBPool(pool))
		slog.Info("Using PostgreSQL repository")
	} else {
		repo = repository.NewMemoryRepository()
		slog.Warn("No DATABASE_URL set — using in-memory repository (data will not persist)")
	}

	var sessions middleware.Sessions
	var redisSessions *middleware.RedisSessionStore
	sessionDuration := time.Duration(cfg.SessionMaxAge) * time.Second
	if cfg.RedisURL != "" {
		var err error
		redisSessions, err = middleware.NewRedisSessionStore(cfg.RedisURL, sessionDuration)
		if err != nil {
			slog.Error("Failed to connect to Redis", "error", err)
			os.Exit(1)
		}
		sessions = redisSessions
		slog.Info("Using Redis session store")
	} else {
		sessions = middleware.NewSessionStore(sessionDuration)
		slog.Info("Using in-memory session store")
	}
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(30 * time.Second)

	// Object storage (GCS or local fallback)
	if cfg.GCSBucketID != "" {
		gcs, err := service.NewGCSStorage(ctx, cfg.GCSBucketID)
		if err != nil {
			slog.Error("Failed to initialize GCS storage", "error", err)
			os.Exit(1)
		}
		routerOpts = append(routerOpts, router.WithStorage(gcs))
		slog.Info("GCS storage enabled", "bucket", cfg.GCSBucketID)
	} else if !cfg.IsProduction() {
		localStorage := service.NewLocalStorage("./storage")
		routerOpts = append(routerOpts, router.WithStorage(localStorage))
		slog.Info("Local file storage enabled (development)")
	}

	// Google Drive integration
	if cfg.GoogleClientID != "" && cfg.GoogleSecret != "" {
		redirectURI := os.Getenv("GOOGLE_REDIRECT_URI")
		gdrive := service.NewGoogleDriveService(
			cfg.GoogleClientID, cfg.GoogleSecret, redirectURI, cfg.GoogleRefresh,
		)
		routerOpts = append(routerOpts, router.WithGoogleDrive(gdrive))
		slog.Info("Google Drive integration enabled")
	}

	r := router.New(cfg, repo, sessions, csrf, cache, routerOpts...)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("Server starting", "port", cfg.Port, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("Shutting down server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server shutdown error", "error", err)
	}

	// Close database pool
	if dbPool != nil {
		dbPool.Close()
		slog.Info("Database connection pool closed")
	}

	// Close Redis client
	if redisSessions != nil {
		if err := redisSessions.Close(); err != nil {
			slog.Error("Redis close error", "error", err)
		} else {
			slog.Info("Redis connection closed")
		}
	}

	slog.Info("Server stopped")
}
