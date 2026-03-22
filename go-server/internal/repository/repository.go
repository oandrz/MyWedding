package repository

import (
	"context"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

// Repository defines the storage interface for all wedding application data.
// Implementations include in-memory (for development/testing) and PostgreSQL (for production).
type Repository interface {
	// User
	GetUser(ctx context.Context, id int) (*models.User, error)
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	CreateUser(ctx context.Context, user models.InsertUser) (*models.User, error)

	// RSVP
	CreateRsvp(ctx context.Context, data models.InsertRsvp) (*models.Rsvp, error)
	UpdateRsvp(ctx context.Context, id int, data models.InsertRsvp) (*models.Rsvp, error)
	GetRsvps(ctx context.Context) ([]models.Rsvp, error)
	GetRsvpByEmail(ctx context.Context, email string) (*models.Rsvp, error)
	GetRsvpByName(ctx context.Context, name string) (*models.Rsvp, error)
	DeleteRsvp(ctx context.Context, id int) (bool, error)

	// Media
	CreateMedia(ctx context.Context, data models.InsertMedia) (*models.Media, error)
	GetMediaByID(ctx context.Context, id int) (*models.Media, error)
	GetAllMedia(ctx context.Context) ([]models.Media, error)
	GetApprovedMedia(ctx context.Context) ([]models.Media, error)
	GetApprovedMediaPaginated(ctx context.Context, limit, offset int) ([]models.Media, int, error)
	UpdateMediaApproval(ctx context.Context, id int, approved bool) (*models.Media, error)

	// Config Images
	CreateConfigImage(ctx context.Context, data models.InsertConfigImage) (*models.ConfigImage, error)
	UpdateConfigImage(ctx context.Context, imageKey string, data models.InsertConfigImage) (*models.ConfigImage, error)
	DeleteConfigImage(ctx context.Context, imageKey string) (bool, error)
	GetConfigImage(ctx context.Context, imageKey string) (*models.ConfigImage, error)
	GetConfigImagesByType(ctx context.Context, imageType string) ([]models.ConfigImage, error)
	GetAllConfigImages(ctx context.Context) ([]models.ConfigImage, error)
	ReorderConfigImages(ctx context.Context, imageType string, orderedKeys []string) error

	// Feature Flags
	CreateFeatureFlag(ctx context.Context, data models.InsertFeatureFlag) (*models.FeatureFlag, error)
	UpdateFeatureFlag(ctx context.Context, featureKey string, enabled bool) (*models.FeatureFlag, error)
	GetFeatureFlag(ctx context.Context, featureKey string) (*models.FeatureFlag, error)
	GetAllFeatureFlags(ctx context.Context) ([]models.FeatureFlag, error)

	// App Settings
	CreateAppSetting(ctx context.Context, data models.InsertAppSetting) (*models.AppSetting, error)
	UpdateAppSetting(ctx context.Context, settingKey string, data models.InsertAppSetting) (*models.AppSetting, error)
	UpsertAppSettings(ctx context.Context, settings []models.InsertAppSetting) (int, error)
	GetAppSetting(ctx context.Context, settingKey string) (*models.AppSetting, error)
	GetAllAppSettings(ctx context.Context) ([]models.AppSetting, error)

	// Welcome Screen
	GetWelcomeScreen(ctx context.Context) (*models.WelcomeScreen, error)
	UpdateWelcomeScreen(ctx context.Context, data models.InsertWelcomeScreen) (*models.WelcomeScreen, error)

	// Messages
	CreateMessage(ctx context.Context, data models.InsertMessage) (*models.Message, error)
	GetMessageByID(ctx context.Context, id int) (*models.Message, error)
	GetAllMessages(ctx context.Context) ([]models.Message, error)
	GetMessagesPaginated(ctx context.Context, limit, offset int) ([]models.Message, int, error)
	DeleteMessage(ctx context.Context, id int) (bool, error)
}
