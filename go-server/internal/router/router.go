package router

import (
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
func New(cfg *config.Config, repo repository.Repository, sessions *middleware.SessionStore, csrf *middleware.CSRFStore, cache *service.Cache) *chi.Mux {
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
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ok",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// Public routes
	r.Post("/api/rsvp", rsvp.Create)
	r.Get("/api/rsvp", rsvp.List)
	r.Get("/api/rsvp/check", rsvp.Check) // Must be before /{email}
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

			r.Patch("/feature-flags/{featureKey}", featureFlag.Update)
			r.Post("/feature-flags", featureFlag.CreateFlag)

			r.Patch("/app-settings/{settingKey}", appSetting.Update)

			r.Patch("/welcome-screen", welcomeScreen.Update)
		})
	})

	return r
}
