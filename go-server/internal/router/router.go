package router

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/handler"
	"github.com/andreasronaldo/wedding-server/internal/middleware"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
)

// New creates and configures the application router with all routes.
// storage may be nil if file uploads are not configured.
func New(cfg *config.Config, repo repository.Repository, sessions middleware.Sessions, csrf *middleware.CSRFStore, cache *service.Cache, opts ...Option) *chi.Mux {
	o := options{}
	for _, opt := range opts {
		opt(&o)
	}

	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.CORS(cfg))
	r.Use(middleware.Logging)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)

	// Initialize handlers
	auth := &handler.AuthHandler{
		Config:   cfg,
		Sessions: sessions,
		CSRF:     csrf,
	}

	rsvp := &handler.RsvpHandler{Repo: repo}
	message := &handler.MessageHandler{Repo: repo}
	media := &handler.MediaHandler{Repo: repo}
	configImage := &handler.ConfigImageHandler{Repo: repo, Cache: cache}
	featureFlag := &handler.FeatureFlagHandler{Repo: repo, Cache: cache}
	appSetting := &handler.AppSettingHandler{Repo: repo}
	welcomeScreen := &handler.WelcomeScreenHandler{Repo: repo}

	// Health check
	r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"status":    "ok",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		}

		if o.dbPool != nil {
			if err := o.dbPool.Ping(r.Context()); err != nil {
				resp["database"] = "unhealthy"
				resp["status"] = "degraded"
			} else {
				resp["database"] = "healthy"
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(resp)
	})

	// Public routes
	r.Post("/api/rsvp", rsvp.Create)
	r.Get("/api/rsvp", rsvp.List)
	r.Get("/api/rsvp/check", rsvp.Check)
	r.Get("/api/rsvp/{email}", rsvp.GetByEmail)

	r.Post("/api/messages", message.Create)
	r.Get("/api/messages", message.List)

	r.Post("/api/media", media.Create)
	r.Get("/api/media", media.ListApproved)

	r.Get("/api/config-images", configImage.ListAll)
	r.Get("/api/config-images/{type}", configImage.ListByType)

	r.Get("/api/feature-flags", featureFlag.List)
	r.Get("/api/feature-flags/{featureKey}", featureFlag.Get)

	r.Get("/api/app-settings", appSetting.List)
	r.Get("/api/settings/music", appSetting.GetMusic)
	r.Get("/api/settings/{settingKey}", appSetting.Get)

	r.Get("/api/welcome-screen", welcomeScreen.Get)

	// File upload routes (if storage is configured)
	var upload *handler.UploadHandler
	if o.storage != nil {
		upload = &handler.UploadHandler{
			Repo:    repo,
			Storage: o.storage,
			Cache:   cache,
		}
		r.Post("/api/upload", upload.Upload)
		r.Get("/storage/*", upload.ServeStorage)
	}

	// Google Drive routes (if configured)
	if o.drive != nil {
		gdrive := &handler.GoogleDriveHandler{
			Repo:  repo,
			Drive: o.drive,
		}
		r.Get("/api/google-auth-url", gdrive.GetAuthURL)
		r.Get("/auth/google/callback", gdrive.AuthCallback)
		r.Post("/api/upload-to-drive", gdrive.UploadToDrive)
		r.Get("/api/drive-folder-contents", gdrive.GetDriveFolderContents)
	}

	// Routes that need auth but aren't under /api/admin prefix
	authCSRF := chi.Chain(
		middleware.Auth(sessions),
		middleware.CSRFProtection(csrf),
	)
	r.With(authCSRF.Handler).Delete("/api/rsvp/{id}", rsvp.Delete)
	r.With(authCSRF.Handler).Delete("/api/messages/{id}", message.Delete)

	// Admin routes
	r.Route("/api/admin", func(r chi.Router) {
		// Login does not require auth
		r.Post("/login", auth.Login)

		// All other admin routes require auth + CSRF
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(sessions))
			r.Use(middleware.CSRFProtection(csrf))

			r.Post("/logout", auth.Logout)
			r.Post("/validate", auth.Validate)

			r.Get("/media", media.ListAll)
			r.Patch("/media/{id}", media.UpdateApproval)

			r.Post("/config-images", configImage.Create)
			r.Put("/config-images/{imageKey}", configImage.Update)
			r.Put("/config-images-reorder", configImage.Reorder)
			r.Delete("/config-images/{imageKey}", configImage.Delete)

			// Upload routes (admin)
			if upload != nil {
				r.Post("/config-images-upload", upload.ConfigImageUpload)
				r.Post("/settings/music-upload", upload.MusicUpload)
			}

			r.Patch("/feature-flags/{featureKey}", featureFlag.Update)
			r.Post("/feature-flags", featureFlag.CreateFlag)

			r.Patch("/app-settings/{settingKey}", appSetting.Update)

			r.Patch("/welcome-screen", welcomeScreen.Update)
		})
	})

	return r
}

// Option configures the router.
type Option func(*options)

type options struct {
	storage service.ObjectStorage
	drive   *service.GoogleDriveService
	dbPool  interface{ Ping(context.Context) error }
}

// WithStorage sets the object storage for file upload routes.
func WithStorage(s service.ObjectStorage) Option {
	return func(o *options) {
		o.storage = s
	}
}

// WithGoogleDrive sets the Google Drive service for drive integration routes.
func WithGoogleDrive(d *service.GoogleDriveService) Option {
	return func(o *options) {
		o.drive = d
	}
}

// WithDBPool sets the database pool for health check connectivity reporting.
func WithDBPool(pool interface{ Ping(context.Context) error }) Option {
	return func(o *options) {
		o.dbPool = pool
	}
}
