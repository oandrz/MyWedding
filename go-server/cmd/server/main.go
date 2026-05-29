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
	"github.com/andreasronaldo/wedding-server/internal/logsink"
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
	var sink *logsink.Sink

	if cfg.DatabaseURL != "" {
		pool, err := database.Connect(ctx, cfg.DatabaseURL)
		if err != nil {
			if cfg.IsProduction() {
				slog.Error("Failed to connect to database", "error", err)
				os.Exit(1)
			}
			slog.Warn("Database unavailable, falling back to in-memory repository", "error", err)
			repo = repository.NewMemoryRepository()
		} else {
			dbPool = pool
			repo = repository.NewPostgresRepository(pool)
			routerOpts = append(routerOpts, router.WithDBPool(pool))
			slog.Info("Using PostgreSQL repository")
		}
	} else {
		repo = repository.NewMemoryRepository()
		slog.Warn("No DATABASE_URL set — using in-memory repository (data will not persist)")
	}

	// Persist logs to Postgres when available (production / DB-backed dev).
	// Re-points the default logger at a fan-out: stdout (unchanged) + DB sink.
	if dbPool != nil {
		sink = logsink.New(repo, logsink.Options{})
		sink.Start()
		routerOpts = append(routerOpts, router.WithLogDropped(sink.Dropped))
		slog.SetDefault(slog.New(logsink.NewFanout(logHandler, sink)))
		slog.Info("Log persistence enabled (app_logs)")
	}

	// Retention: purge logs older than 7 days, on boot and every 6h.
	if dbPool != nil {
		go func() {
			purge := func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				cutoff := time.Now().Add(-7 * 24 * time.Hour)
				if n, err := repo.DeleteLogsOlderThan(ctx, cutoff); err != nil {
					slog.Warn("Log retention purge failed", "error", err)
				} else if n > 0 {
					slog.Info("Log retention purge", "deleted", n)
				}
			}
			purge()
			ticker := time.NewTicker(6 * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				purge()
			}
		}()
	}

	var sessions middleware.Sessions
	var redisSessions *middleware.RedisSessionStore
	sessionDuration := time.Duration(cfg.SessionMaxAge) * time.Second
	if cfg.RedisURL != "" {
		var err error
		redisSessions, err = middleware.NewRedisSessionStore(cfg.RedisURL, sessionDuration)
		if err != nil {
			if cfg.IsProduction() {
				slog.Error("Failed to connect to Redis", "error", err)
				os.Exit(1)
			}
			slog.Warn("Redis unavailable, falling back to in-memory session store", "error", err)
			sessions = middleware.NewSessionStore(sessionDuration)
		} else {
			sessions = redisSessions
			slog.Info("Using Redis session store")
		}
	} else {
		sessions = middleware.NewSessionStore(sessionDuration)
		slog.Info("Using in-memory session store")
	}
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(30 * time.Second)

	// Object storage: Supabase → local fallback
	if cfg.SupabaseURL != "" && cfg.SupabaseServiceKey != "" && cfg.SupabaseBucketID != "" {
		supaStorage := service.NewSupabaseStorage(
			cfg.SupabaseURL, cfg.SupabaseServiceKey, cfg.SupabaseBucketID, cfg.Env,
		)
		routerOpts = append(routerOpts, router.WithStorage(supaStorage))
		slog.Info("Supabase storage enabled", "bucket", cfg.SupabaseBucketID, "envPrefix", cfg.Env)
	} else if !cfg.IsProduction() {
		localStorage := service.NewLocalStorage("./storage")
		routerOpts = append(routerOpts, router.WithStorage(localStorage))
		slog.Info("Local file storage enabled (development)")
	}

	// Google Drive integration (service account)
	if cfg.GoogleServiceAccountJSON != "" {
		gdrive, err := service.NewGoogleDriveServiceFromServiceAccount(cfg.GoogleServiceAccountJSON)
		if err != nil {
			slog.Error("Failed to initialize Google Drive service account", "error", err)
		} else {
			routerOpts = append(routerOpts, router.WithGoogleDrive(gdrive))
			slog.Info("Google Drive integration enabled (service account)")
		}
	}

	// WhatsApp automation (requires Postgres for whatsmeow session persistence)
	if cfg.DatabaseURL != "" && dbPool != nil {
		waService := service.NewWhatsAppService(repo)
		if err := waService.Init(ctx, cfg.DatabaseURL); err != nil {
			slog.Warn("WhatsApp service init failed, WA routes disabled", "error", err)
		} else {
			routerOpts = append(routerOpts, router.WithWhatsApp(waService))
			slog.Info("WhatsApp automation enabled")
		}
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

	// Drain log sink before closing the DB pool (final batch insert needs pool open).
	if sink != nil {
		drainCtx, drainCancel := context.WithTimeout(context.Background(), 5*time.Second)
		sink.Stop(drainCtx)
		drainCancel()
		slog.Info("Log sink drained")
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
