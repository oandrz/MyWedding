package router

import (
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
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

	sanitizer := service.NewSanitizer()

	rsvp := &handler.RsvpHandler{Repo: repo, Sanitizer: sanitizer}
	message := &handler.MessageHandler{Repo: repo, Sanitizer: sanitizer}
	media := &handler.MediaHandler{Repo: repo}
	configImage := &handler.ConfigImageHandler{Repo: repo, Cache: cache}
	featureFlag := &handler.FeatureFlagHandler{Repo: repo, Cache: cache}
	appSetting := &handler.AppSettingHandler{Repo: repo}
	welcomeScreen := &handler.WelcomeScreenHandler{Repo: repo, Sanitizer: sanitizer}
	invite := &handler.InviteHandler{Repo: repo, Sanitizer: sanitizer}
	schedule := &handler.ScheduleHandler{Repo: repo}

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

	// Public config routes — server-side cache (30s TTL) handles repeat reads;
	// no browser-level Cache-Control so admin mutations reflect immediately on refetch.
	r.Get("/api/config-images", configImage.ListAll)
	r.Get("/api/config-images/{type}", configImage.ListByType)

	r.Get("/api/feature-flags", featureFlag.List)
	r.Get("/api/feature-flags/{featureKey}", featureFlag.Get)

	r.Get("/api/app-settings", appSetting.List)
	r.Get("/api/settings/music", appSetting.GetMusic)
	r.Get("/api/settings/{settingKey}", appSetting.Get)

	r.Get("/api/welcome-screen", welcomeScreen.Get)
	r.Get("/api/schedule", schedule.List)

	r.Get("/api/invites/{code}", invite.GetByCode)

	// File upload routes (if storage is configured)
	var upload *handler.UploadHandler
	if o.storage != nil {
		upload = &handler.UploadHandler{
			Repo:      repo,
			Storage:   o.storage,
			Cache:     cache,
			Sanitizer: sanitizer,
		}
		r.Post("/api/upload", upload.Upload)
		r.Get("/storage/*", upload.ServeStorage)
	}

	// Google Drive routes (if configured)
	if o.drive != nil {
		gdrive := &handler.GoogleDriveHandler{
			Drive: o.drive,
		}
		r.Get("/api/drive-folder-contents", gdrive.GetDriveFolderContents)
		r.Get("/api/drive-thumbnail", gdrive.GetThumbnail)
	}

	loginRateLimiter := middleware.NewRateLimiter(5, 60)

	// Admin routes
	r.Route("/api/admin", func(r chi.Router) {
		// Login does not require auth but is rate-limited to 5 attempts/min/IP
		r.With(loginRateLimiter.Middleware).Post("/login", auth.Login)

		// Validate requires auth but NOT CSRF (enables CSRF token recovery)
		r.With(middleware.Auth(sessions)).Post("/validate", auth.Validate)

		// All other admin routes require auth + CSRF
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(sessions))
			r.Use(middleware.CSRFProtection(csrf))

			r.Post("/logout", auth.Logout)

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
				r.Post("/upload/signed-url", upload.GetSignedUploadURL)
				r.Post("/upload/complete", upload.CompleteConfigImageUpload)
			}

			r.Patch("/feature-flags/{featureKey}", featureFlag.Update)
			r.Post("/feature-flags", featureFlag.CreateFlag)

			r.Patch("/app-settings/bulk", appSetting.BulkUpdate)
			r.Patch("/app-settings/{settingKey}", appSetting.Update)

			r.Patch("/welcome-screen", welcomeScreen.Update)

			r.Post("/schedule", schedule.Create)
			r.Put("/schedule/{id}", schedule.Update)
			r.Delete("/schedule/{id}", schedule.Delete)
			r.Patch("/schedule/reorder", schedule.Reorder)

			r.Delete("/rsvp/{id}", rsvp.Delete)
			r.Delete("/messages/{id}", message.Delete)

			r.Post("/invites", invite.Create)
			r.Post("/invites/bulk", invite.BulkCreate)
			r.Delete("/invites/bulk", invite.BulkDelete)
			r.Get("/invites", invite.List)
			r.Delete("/invites/{id}", invite.Delete)
			r.Patch("/invites/{id}", invite.Update)
			r.Put("/invites/{id}/wa-sent", invite.MarkWaSent)
			r.Delete("/invites/{id}/wa-sent", invite.UnmarkWaSent)

			// WhatsApp automation routes (only registered when WA service is configured)
			if o.whatsapp != nil {
				wa := &handler.WAHandler{WA: o.whatsapp}
				r.Get("/wa/sessions", wa.Sessions)
				r.Post("/wa/sessions/{side}/connect", wa.Connect)
				r.Delete("/wa/sessions/{side}", wa.DisconnectSession)
				r.Post("/wa/send-all", wa.SendAll)
				// Static segment "active" must be registered before the wildcard {id}.
				r.Get("/wa/job/active", wa.ActiveJob)
				r.Get("/wa/job/{id}", wa.GetJob)
				r.Post("/wa/job/{id}/pause", wa.PauseJob)
				r.Post("/wa/job/{id}/resume", wa.ResumeJob)
				r.Delete("/wa/job/{id}", wa.AbortJob)
				r.Post("/wa/send/{inviteId}", wa.SendOne)
			}
		})
	})

	// Serve static files in production (SPA fallback)
	if cfg.StaticDir != "" {
		staticFS := http.Dir(cfg.StaticDir)
		fileServer := http.FileServer(staticFS)
		r.NotFound(func(w http.ResponseWriter, req *http.Request) {
			// Try file first, fallback to index.html for SPA routes
			f, err := staticFS.Open(req.URL.Path)
			if err == nil {
				f.Close()
				fileServer.ServeHTTP(w, req)
				return
			}
			http.ServeFile(w, req, filepath.Join(cfg.StaticDir, "index.html"))
		})
	}

	return r
}

// Option configures the router.
type Option func(*options)

type options struct {
	storage    service.ObjectStorage
	drive      *service.GoogleDriveService
	dbPool     interface{ Ping(context.Context) error }
	whatsapp   service.WhatsAppServicer
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

// WithWhatsApp sets the WhatsApp service for WA automation routes.
func WithWhatsApp(wa service.WhatsAppServicer) Option {
	return func(o *options) {
		o.whatsapp = wa
	}
}
