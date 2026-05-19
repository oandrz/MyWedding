package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

// Compile-time check that PostgresRepository implements Repository.
var _ Repository = (*PostgresRepository)(nil)

// PostgresRepository implements the Repository interface using a pgx connection pool.
type PostgresRepository struct {
	pool *pgxpool.Pool
}

// NewPostgresRepository creates a new PostgreSQL-backed repository.
func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

func (r *PostgresRepository) GetUser(ctx context.Context, id int) (*models.User, error) {
	var u models.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, username, password FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Username, &u.Password)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *PostgresRepository) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	var u models.User
	err := r.pool.QueryRow(ctx,
		`SELECT id, username, password FROM users WHERE username = $1`, username,
	).Scan(&u.ID, &u.Username, &u.Password)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *PostgresRepository) CreateUser(ctx context.Context, user models.InsertUser) (*models.User, error) {
	var u models.User
	err := r.pool.QueryRow(ctx,
		`INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, password`,
		user.Username, user.Password,
	).Scan(&u.ID, &u.Username, &u.Password)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ---------------------------------------------------------------------------
// RSVP
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateRsvp(ctx context.Context, data models.InsertRsvp) (*models.Rsvp, error) {
	var rv models.Rsvp
	err := r.pool.QueryRow(ctx,
		`INSERT INTO rsvp (name, email, attendance_type, guest_count)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, name, email, attendance_type, guest_count`,
		data.Name, data.Email, data.AttendanceType, data.GuestCount,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
	if err != nil {
		return nil, err
	}
	return &rv, nil
}

func (r *PostgresRepository) UpdateRsvp(ctx context.Context, id int, data models.InsertRsvp) (*models.Rsvp, error) {
	var rv models.Rsvp
	err := r.pool.QueryRow(ctx,
		`UPDATE rsvp SET name = $1, email = $2, attendance_type = $3, guest_count = $4
		 WHERE id = $5
		 RETURNING id, name, email, attendance_type, guest_count`,
		data.Name, data.Email, data.AttendanceType, data.GuestCount, id,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rv, nil
}

func (r *PostgresRepository) GetRsvps(ctx context.Context) ([]models.Rsvp, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, attendance_type, guest_count FROM rsvp`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Rsvp, 0)
	for rows.Next() {
		var rv models.Rsvp
		if err := rows.Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount); err != nil {
			return nil, err
		}
		result = append(result, rv)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) GetRsvpByEmail(ctx context.Context, email string) (*models.Rsvp, error) {
	var rv models.Rsvp
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, email, attendance_type, guest_count FROM rsvp WHERE email = $1`, email,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rv, nil
}

func (r *PostgresRepository) GetRsvpByName(ctx context.Context, name string) (*models.Rsvp, error) {
	var rv models.Rsvp
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, email, attendance_type, guest_count FROM rsvp WHERE name = $1`, name,
	).Scan(&rv.ID, &rv.Name, &rv.Email, &rv.AttendanceType, &rv.GuestCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rv, nil
}

func (r *PostgresRepository) DeleteRsvp(ctx context.Context, id int) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM rsvp WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateMedia(ctx context.Context, data models.InsertMedia) (*models.Media, error) {
	mediaType := "image"
	if data.MediaType != nil {
		mediaType = *data.MediaType
	}

	var md models.Media
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`INSERT INTO media (name, email, media_url, media_type, caption, approved)
		 VALUES ($1, $2, $3, $4, $5, false)
		 RETURNING id, name, email, media_url, media_type, caption, approved, created_at`,
		data.Name, data.Email, data.MediaURL, mediaType, data.Caption,
	).Scan(&md.ID, &md.Name, &md.Email, &md.MediaURL, &md.MediaType, &md.Caption, &md.Approved, &createdAt)
	if err != nil {
		return nil, err
	}
	md.CreatedAt = createdAt.Format(time.RFC3339)
	return &md, nil
}

func (r *PostgresRepository) GetMediaByID(ctx context.Context, id int) (*models.Media, error) {
	var md models.Media
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, email, media_url, media_type, caption, approved, created_at
		 FROM media WHERE id = $1`, id,
	).Scan(&md.ID, &md.Name, &md.Email, &md.MediaURL, &md.MediaType, &md.Caption, &md.Approved, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	md.CreatedAt = createdAt.Format(time.RFC3339)
	return &md, nil
}

func (r *PostgresRepository) GetAllMedia(ctx context.Context) ([]models.Media, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, media_url, media_type, caption, approved, created_at FROM media`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Media, 0)
	for rows.Next() {
		var md models.Media
		var createdAt time.Time
		if err := rows.Scan(&md.ID, &md.Name, &md.Email, &md.MediaURL, &md.MediaType, &md.Caption, &md.Approved, &createdAt); err != nil {
			return nil, err
		}
		md.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, md)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) GetApprovedMedia(ctx context.Context) ([]models.Media, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, media_url, media_type, caption, approved, created_at
		 FROM media WHERE approved = true`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Media, 0)
	for rows.Next() {
		var md models.Media
		var createdAt time.Time
		if err := rows.Scan(&md.ID, &md.Name, &md.Email, &md.MediaURL, &md.MediaType, &md.Caption, &md.Approved, &createdAt); err != nil {
			return nil, err
		}
		md.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, md)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) GetApprovedMediaPaginated(ctx context.Context, limit, offset int) ([]models.Media, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM media WHERE approved = true`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, media_url, media_type, caption, approved, created_at FROM media WHERE approved = true ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result := make([]models.Media, 0)
	for rows.Next() {
		var md models.Media
		var createdAt time.Time
		if err := rows.Scan(&md.ID, &md.Name, &md.Email, &md.MediaURL, &md.MediaType, &md.Caption, &md.Approved, &createdAt); err != nil {
			return nil, 0, err
		}
		md.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, md)
	}
	return result, total, rows.Err()
}

func (r *PostgresRepository) UpdateMediaApproval(ctx context.Context, id int, approved bool) (*models.Media, error) {
	var md models.Media
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE media SET approved = $1 WHERE id = $2
		 RETURNING id, name, email, media_url, media_type, caption, approved, created_at`,
		approved, id,
	).Scan(&md.ID, &md.Name, &md.Email, &md.MediaURL, &md.MediaType, &md.Caption, &md.Approved, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	md.CreatedAt = createdAt.Format(time.RFC3339)
	return &md, nil
}

// ---------------------------------------------------------------------------
// Config Images
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateConfigImage(ctx context.Context, data models.InsertConfigImage) (*models.ConfigImage, error) {
	isActive := true
	if data.IsActive != nil {
		isActive = *data.IsActive
	}

	displayOrder := 0
	if data.DisplayOrder != nil {
		displayOrder = *data.DisplayOrder
	}

	var ci models.ConfigImage
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`INSERT INTO config_images (image_key, image_url, thumbnail_url, image_type, title, description, is_active, display_order)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id, image_key, image_url, thumbnail_url, image_type, title, description, is_active, display_order, updated_at`,
		data.ImageKey, data.ImageURL, data.ThumbnailURL, data.ImageType, data.Title, data.Description, isActive, displayOrder,
	).Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt)
	if err != nil {
		return nil, err
	}
	ci.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ci, nil
}

func (r *PostgresRepository) UpdateConfigImage(ctx context.Context, imageKey string, data models.InsertConfigImage) (*models.ConfigImage, error) {
	var ci models.ConfigImage
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE config_images
		 SET image_url = $1, thumbnail_url = $2, image_type = $3, title = $4, description = $5,
		     is_active = COALESCE($6, is_active), display_order = COALESCE($7, display_order),
		     updated_at = NOW()
		 WHERE image_key = $8
		 RETURNING id, image_key, image_url, thumbnail_url, image_type, title, description, is_active, display_order, updated_at`,
		data.ImageURL, data.ThumbnailURL, data.ImageType, data.Title, data.Description, data.IsActive, data.DisplayOrder, imageKey,
	).Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ci.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ci, nil
}

func (r *PostgresRepository) DeleteConfigImage(ctx context.Context, imageKey string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM config_images WHERE image_key = $1`, imageKey)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *PostgresRepository) GetConfigImage(ctx context.Context, imageKey string) (*models.ConfigImage, error) {
	var ci models.ConfigImage
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT id, image_key, image_url, thumbnail_url, image_type, title, description, is_active, display_order, updated_at
		 FROM config_images WHERE image_key = $1`, imageKey,
	).Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ci.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ci, nil
}

func (r *PostgresRepository) GetConfigImagesByType(ctx context.Context, imageType string) ([]models.ConfigImage, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, image_key, image_url, thumbnail_url, image_type, title, description, is_active, display_order, updated_at
		 FROM config_images WHERE image_type = $1 ORDER BY display_order`, imageType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ConfigImage, 0)
	for rows.Next() {
		var ci models.ConfigImage
		var updatedAt time.Time
		if err := rows.Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt); err != nil {
			return nil, err
		}
		ci.UpdatedAt = updatedAt.Format(time.RFC3339)
		result = append(result, ci)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) GetAllConfigImages(ctx context.Context) ([]models.ConfigImage, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, image_key, image_url, thumbnail_url, image_type, title, description, is_active, display_order, updated_at
		 FROM config_images ORDER BY display_order`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ConfigImage, 0)
	for rows.Next() {
		var ci models.ConfigImage
		var updatedAt time.Time
		if err := rows.Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt); err != nil {
			return nil, err
		}
		ci.UpdatedAt = updatedAt.Format(time.RFC3339)
		result = append(result, ci)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) ReorderConfigImages(ctx context.Context, imageType string, orderedKeys []string) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for i, key := range orderedKeys {
		_, err := tx.Exec(ctx,
			`UPDATE config_images SET display_order = $1, updated_at = NOW()
			 WHERE image_key = $2 AND image_type = $3`,
			i, key, imageType)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// ---------------------------------------------------------------------------
// Feature Flags
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateFeatureFlag(ctx context.Context, data models.InsertFeatureFlag) (*models.FeatureFlag, error) {
	enabled := false
	if data.Enabled != nil {
		enabled = *data.Enabled
	}

	var ff models.FeatureFlag
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, feature_key, feature_name, description, enabled, updated_at`,
		data.FeatureKey, data.FeatureName, data.Description, enabled,
	).Scan(&ff.ID, &ff.FeatureKey, &ff.FeatureName, &ff.Description, &ff.Enabled, &updatedAt)
	if err != nil {
		return nil, err
	}
	ff.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ff, nil
}

func (r *PostgresRepository) UpdateFeatureFlag(ctx context.Context, featureKey string, enabled bool) (*models.FeatureFlag, error) {
	var ff models.FeatureFlag
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE feature_flags SET enabled = $1, updated_at = NOW()
		 WHERE feature_key = $2
		 RETURNING id, feature_key, feature_name, description, enabled, updated_at`,
		enabled, featureKey,
	).Scan(&ff.ID, &ff.FeatureKey, &ff.FeatureName, &ff.Description, &ff.Enabled, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ff.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ff, nil
}

func (r *PostgresRepository) GetFeatureFlag(ctx context.Context, featureKey string) (*models.FeatureFlag, error) {
	var ff models.FeatureFlag
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT id, feature_key, feature_name, description, enabled, updated_at
		 FROM feature_flags WHERE feature_key = $1`, featureKey,
	).Scan(&ff.ID, &ff.FeatureKey, &ff.FeatureName, &ff.Description, &ff.Enabled, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ff.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ff, nil
}

func (r *PostgresRepository) GetAllFeatureFlags(ctx context.Context) ([]models.FeatureFlag, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, feature_key, feature_name, description, enabled, updated_at FROM feature_flags`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.FeatureFlag, 0)
	for rows.Next() {
		var ff models.FeatureFlag
		var updatedAt time.Time
		if err := rows.Scan(&ff.ID, &ff.FeatureKey, &ff.FeatureName, &ff.Description, &ff.Enabled, &updatedAt); err != nil {
			return nil, err
		}
		ff.UpdatedAt = updatedAt.Format(time.RFC3339)
		result = append(result, ff)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// App Settings
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateAppSetting(ctx context.Context, data models.InsertAppSetting) (*models.AppSetting, error) {
	var as models.AppSetting
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, setting_key, setting_value, setting_type, description, updated_at`,
		data.SettingKey, data.SettingValue, data.SettingType, data.Description,
	).Scan(&as.ID, &as.SettingKey, &as.SettingValue, &as.SettingType, &as.Description, &updatedAt)
	if err != nil {
		return nil, err
	}
	as.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &as, nil
}

func (r *PostgresRepository) UpdateAppSetting(ctx context.Context, settingKey string, data models.InsertAppSetting) (*models.AppSetting, error) {
	var as models.AppSetting
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE app_settings SET setting_value = $1, setting_type = $2, description = $3, updated_at = NOW()
		 WHERE setting_key = $4
		 RETURNING id, setting_key, setting_value, setting_type, description, updated_at`,
		data.SettingValue, data.SettingType, data.Description, settingKey,
	).Scan(&as.ID, &as.SettingKey, &as.SettingValue, &as.SettingType, &as.Description, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	as.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &as, nil
}

func (r *PostgresRepository) UpsertAppSettings(ctx context.Context, settings []models.InsertAppSetting) (int, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, s := range settings {
		_, err := tx.Exec(ctx,
			`INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (setting_key) DO UPDATE SET
			   setting_value = EXCLUDED.setting_value,
			   setting_type = EXCLUDED.setting_type,
			   description = EXCLUDED.description,
			   updated_at = NOW()`,
			s.SettingKey, s.SettingValue, s.SettingType, s.Description,
		)
		if err != nil {
			return 0, err
		}
		count++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return count, nil
}

func (r *PostgresRepository) GetAppSetting(ctx context.Context, settingKey string) (*models.AppSetting, error) {
	var as models.AppSetting
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT id, setting_key, setting_value, setting_type, description, updated_at
		 FROM app_settings WHERE setting_key = $1`, settingKey,
	).Scan(&as.ID, &as.SettingKey, &as.SettingValue, &as.SettingType, &as.Description, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	as.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &as, nil
}

func (r *PostgresRepository) GetAllAppSettings(ctx context.Context) ([]models.AppSetting, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, setting_key, setting_value, setting_type, description, updated_at FROM app_settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.AppSetting, 0)
	for rows.Next() {
		var as models.AppSetting
		var updatedAt time.Time
		if err := rows.Scan(&as.ID, &as.SettingKey, &as.SettingValue, &as.SettingType, &as.Description, &updatedAt); err != nil {
			return nil, err
		}
		as.UpdatedAt = updatedAt.Format(time.RFC3339)
		result = append(result, as)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// Welcome Screen
// ---------------------------------------------------------------------------

func (r *PostgresRepository) GetWelcomeScreen(ctx context.Context) (*models.WelcomeScreen, error) {
	var ws models.WelcomeScreen
	var updatedAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT id, heading_text, heading_text_id, delivery_label, delivery_label_id,
		        fallback_name, enabled, updated_at
		 FROM welcome_screen WHERE id = 1`,
	).Scan(&ws.ID, &ws.HeadingText, &ws.HeadingTextID, &ws.DeliveryLabel, &ws.DeliveryLabelID,
		&ws.FallbackName, &ws.Enabled, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	ws.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ws, nil
}

func (r *PostgresRepository) UpdateWelcomeScreen(ctx context.Context, data models.InsertWelcomeScreen) (*models.WelcomeScreen, error) {
	var ws models.WelcomeScreen
	var updatedAt time.Time

	err := r.pool.QueryRow(ctx,
		`INSERT INTO welcome_screen (id, heading_text, heading_text_id, delivery_label, delivery_label_id, fallback_name, enabled)
		 VALUES (1,
		     COALESCE($1, 'Welcome'),
		     COALESCE($2, ''),
		     COALESCE($3, 'Delivery'),
		     COALESCE($4, ''),
		     COALESCE($5, 'Guest'),
		     COALESCE($6, true))
		 ON CONFLICT (id) DO UPDATE SET
		     heading_text      = COALESCE($1, welcome_screen.heading_text),
		     heading_text_id   = COALESCE($2, welcome_screen.heading_text_id),
		     delivery_label    = COALESCE($3, welcome_screen.delivery_label),
		     delivery_label_id = COALESCE($4, welcome_screen.delivery_label_id),
		     fallback_name     = COALESCE($5, welcome_screen.fallback_name),
		     enabled           = COALESCE($6, welcome_screen.enabled),
		     updated_at        = NOW()
		 RETURNING id, heading_text, heading_text_id, delivery_label, delivery_label_id,
		           fallback_name, enabled, updated_at`,
		data.HeadingText, data.HeadingTextID, data.DeliveryLabel, data.DeliveryLabelID,
		data.FallbackName, data.Enabled,
	).Scan(&ws.ID, &ws.HeadingText, &ws.HeadingTextID, &ws.DeliveryLabel, &ws.DeliveryLabelID,
		&ws.FallbackName, &ws.Enabled, &updatedAt)
	if err != nil {
		return nil, fmt.Errorf("upsert welcome_screen: %w", err)
	}
	ws.UpdatedAt = updatedAt.Format(time.RFC3339)
	return &ws, nil
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateMessage(ctx context.Context, data models.InsertMessage) (*models.Message, error) {
	var msg models.Message
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`INSERT INTO messages (name, email, content)
		 VALUES ($1, $2, $3)
		 RETURNING id, name, email, content, created_at`,
		data.Name, data.Email, data.Content,
	).Scan(&msg.ID, &msg.Name, &msg.Email, &msg.Content, &createdAt)
	if err != nil {
		return nil, err
	}
	msg.CreatedAt = createdAt.Format(time.RFC3339)
	return &msg, nil
}

func (r *PostgresRepository) GetMessageByID(ctx context.Context, id int) (*models.Message, error) {
	var msg models.Message
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT id, name, email, content, created_at FROM messages WHERE id = $1`, id,
	).Scan(&msg.ID, &msg.Name, &msg.Email, &msg.Content, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	msg.CreatedAt = createdAt.Format(time.RFC3339)
	return &msg, nil
}

func (r *PostgresRepository) GetAllMessages(ctx context.Context) ([]models.Message, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, content, created_at FROM messages`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Message, 0)
	for rows.Next() {
		var msg models.Message
		var createdAt time.Time
		if err := rows.Scan(&msg.ID, &msg.Name, &msg.Email, &msg.Content, &createdAt); err != nil {
			return nil, err
		}
		msg.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, msg)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) GetMessagesPaginated(ctx context.Context, limit, offset int) ([]models.Message, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM messages`).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.pool.Query(ctx,
		`SELECT id, name, email, content, created_at FROM messages ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	result := make([]models.Message, 0)
	for rows.Next() {
		var msg models.Message
		var createdAt time.Time
		if err := rows.Scan(&msg.ID, &msg.Name, &msg.Email, &msg.Content, &createdAt); err != nil {
			return nil, 0, err
		}
		msg.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, msg)
	}
	return result, total, rows.Err()
}

func (r *PostgresRepository) DeleteMessage(ctx context.Context, id int) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM messages WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

func (r *PostgresRepository) CreateInvite(ctx context.Context, data models.InsertInvite) (*models.Invite, error) {
	for attempt := 0; attempt < 3; attempt++ {
		code := models.GenerateInviteCode()
		var inv models.Invite
		var createdAt time.Time
		var waSentAt *time.Time
		err := r.pool.QueryRow(ctx,
			`INSERT INTO invites (name, code, phone)
			 VALUES ($1, $2, $3)
			 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
			data.Name, code, data.Phone,
		).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
		if err != nil {
			if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
				continue
			}
			return nil, err
		}
		inv.CreatedAt = createdAt.Format(time.RFC3339)
		inv.WaSentAt = scanWaSentAt(waSentAt)
		return &inv, nil
	}
	return nil, fmt.Errorf("failed to generate unique invite code after 3 attempts")
}

func (r *PostgresRepository) CreateInvitesBulk(ctx context.Context, data []models.InsertInvite) ([]models.Invite, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	result := make([]models.Invite, 0, len(data))
	for i, d := range data {
		var inv models.Invite
		var createdAt time.Time
		inserted := false
		sp := fmt.Sprintf("sp_%d", i)

		for attempt := 0; attempt < 3; attempt++ {
			code := models.GenerateInviteCode()

			if _, err := tx.Exec(ctx, "SAVEPOINT "+sp); err != nil {
				return nil, fmt.Errorf("savepoint %s: %w", sp, err)
			}

			var waSentAt *time.Time
			err := tx.QueryRow(ctx,
				`INSERT INTO invites (name, code, phone)
				 VALUES ($1, $2, $3)
				 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
				d.Name, code, d.Phone,
			).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
			if err != nil {
				if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
					if _, err := tx.Exec(ctx, "ROLLBACK TO SAVEPOINT "+sp); err != nil {
						return nil, fmt.Errorf("rollback to savepoint %s: %w", sp, err)
					}
					continue
				}
				return nil, fmt.Errorf("insert invite %q: %w", d.Name, err)
			}

			if _, err := tx.Exec(ctx, "RELEASE SAVEPOINT "+sp); err != nil {
				return nil, fmt.Errorf("release savepoint %s: %w", sp, err)
			}
			inv.CreatedAt = createdAt.Format(time.RFC3339)
			inv.WaSentAt = scanWaSentAt(waSentAt)
			inserted = true
			break
		}

		if !inserted {
			return nil, fmt.Errorf("failed to generate unique invite code for %q after 3 attempts", d.Name)
		}
		result = append(result, inv)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	return result, nil
}

func (r *PostgresRepository) GetInvites(ctx context.Context) ([]models.Invite, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT i.id, i.name, i.code, i.rsvp_id, i.created_at, i.phone, i.wa_sent_at,
		        rv.id, rv.name, rv.email, rv.attendance_type, rv.guest_count
		 FROM invites i
		 LEFT JOIN rsvp rv ON i.rsvp_id = rv.id
		 ORDER BY i.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Invite, 0)
	for rows.Next() {
		var inv models.Invite
		var createdAt time.Time
		var waSentAt *time.Time
		var rsvpID, rsvpGuestCount *int
		var rsvpName, rsvpEmail, rsvpAttendanceType *string

		if err := rows.Scan(
			&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt,
			&rsvpID, &rsvpName, &rsvpEmail, &rsvpAttendanceType, &rsvpGuestCount,
		); err != nil {
			return nil, err
		}
		inv.CreatedAt = createdAt.Format(time.RFC3339)
		inv.WaSentAt = scanWaSentAt(waSentAt)

		if rsvpID != nil {
			inv.Rsvp = &models.Rsvp{
				ID:             *rsvpID,
				Name:           *rsvpName,
				Email:          *rsvpEmail,
				AttendanceType: *rsvpAttendanceType,
				GuestCount:     rsvpGuestCount,
			}
		}
		result = append(result, inv)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) GetInviteByID(ctx context.Context, id int) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	var rsvpID, rsvpGuestCount *int
	var rsvpName, rsvpEmail, rsvpAttendanceType *string

	err := r.pool.QueryRow(ctx,
		`SELECT i.id, i.name, i.code, i.rsvp_id, i.created_at, i.phone, i.wa_sent_at,
		        rv.id, rv.name, rv.email, rv.attendance_type, rv.guest_count
		 FROM invites i
		 LEFT JOIN rsvp rv ON i.rsvp_id = rv.id
		 WHERE i.id = $1`, id,
	).Scan(
		&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt,
		&rsvpID, &rsvpName, &rsvpEmail, &rsvpAttendanceType, &rsvpGuestCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)

	if rsvpID != nil {
		inv.Rsvp = &models.Rsvp{
			ID:             *rsvpID,
			Name:           *rsvpName,
			Email:          *rsvpEmail,
			AttendanceType: *rsvpAttendanceType,
			GuestCount:     rsvpGuestCount,
		}
	}
	return &inv, nil
}

func (r *PostgresRepository) GetInviteByCode(ctx context.Context, code string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	var rsvpID, rsvpGuestCount *int
	var rsvpName, rsvpEmail, rsvpAttendanceType *string

	err := r.pool.QueryRow(ctx,
		`SELECT i.id, i.name, i.code, i.rsvp_id, i.created_at, i.phone, i.wa_sent_at,
		        rv.id, rv.name, rv.email, rv.attendance_type, rv.guest_count
		 FROM invites i
		 LEFT JOIN rsvp rv ON i.rsvp_id = rv.id
		 WHERE i.code = $1`, code,
	).Scan(
		&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt,
		&rsvpID, &rsvpName, &rsvpEmail, &rsvpAttendanceType, &rsvpGuestCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)

	if rsvpID != nil {
		inv.Rsvp = &models.Rsvp{
			ID:             *rsvpID,
			Name:           *rsvpName,
			Email:          *rsvpEmail,
			AttendanceType: *rsvpAttendanceType,
			GuestCount:     rsvpGuestCount,
		}
	}
	return &inv, nil
}

func (r *PostgresRepository) DeleteInvite(ctx context.Context, id int) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM invites WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *PostgresRepository) UpdateInviteRsvpID(ctx context.Context, inviteID int, rsvpID *int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE invites SET rsvp_id = $1 WHERE id = $2`,
		rsvpID, inviteID,
	)
	return err
}

// scanWaSentAt converts a *time.Time from pgx scan into the *string format used by the Invite model.
func scanWaSentAt(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}

func (r *PostgresRepository) UpdateInvitePhone(ctx context.Context, id int, phone *string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET phone = $1 WHERE id = $2
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		phone, id,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}

func (r *PostgresRepository) UpdateInvite(ctx context.Context, id int, name string, phone *string) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET name = $2, phone = $3 WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		id, name, phone,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}

func (r *PostgresRepository) MarkInviteWaSent(ctx context.Context, id int) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET wa_sent_at = NOW() WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		id,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}

func (r *PostgresRepository) UnmarkInviteWaSent(ctx context.Context, id int) (*models.Invite, error) {
	var inv models.Invite
	var createdAt time.Time
	var waSentAt *time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE invites SET wa_sent_at = NULL WHERE id = $1
		 RETURNING id, name, code, rsvp_id, created_at, phone, wa_sent_at`,
		id,
	).Scan(&inv.ID, &inv.Name, &inv.Code, &inv.RsvpID, &createdAt, &inv.Phone, &waSentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("invite not found")
	}
	if err != nil {
		return nil, err
	}
	inv.CreatedAt = createdAt.Format(time.RFC3339)
	inv.WaSentAt = scanWaSentAt(waSentAt)
	return &inv, nil
}

// ---------------------------------------------------------------------------
// Schedule Events
// ---------------------------------------------------------------------------

func (r *PostgresRepository) GetScheduleEvents(ctx context.Context) ([]models.ScheduleEvent, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, title, title_id, time, description, description_id, sort_order, created_at
		 FROM schedule_events ORDER BY sort_order ASC, id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.ScheduleEvent, 0)
	for rows.Next() {
		var e models.ScheduleEvent
		var createdAt time.Time
		if err := rows.Scan(&e.ID, &e.Title, &e.TitleID, &e.Time, &e.Description, &e.DescriptionID,
			&e.SortOrder, &createdAt); err != nil {
			return nil, err
		}
		e.CreatedAt = createdAt.Format(time.RFC3339)
		result = append(result, e)
	}
	return result, rows.Err()
}

func (r *PostgresRepository) CreateScheduleEvent(ctx context.Context, data models.InsertScheduleEvent) (*models.ScheduleEvent, error) {
	var e models.ScheduleEvent
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`INSERT INTO schedule_events (title, title_id, time, description, description_id, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, title, title_id, time, description, description_id, sort_order, created_at`,
		data.Title, data.TitleID, data.Time, data.Description, data.DescriptionID, data.SortOrder,
	).Scan(&e.ID, &e.Title, &e.TitleID, &e.Time, &e.Description, &e.DescriptionID, &e.SortOrder, &createdAt)
	if err != nil {
		return nil, err
	}
	e.CreatedAt = createdAt.Format(time.RFC3339)
	return &e, nil
}

func (r *PostgresRepository) UpdateScheduleEvent(ctx context.Context, id int, data models.UpdateScheduleEvent) (*models.ScheduleEvent, error) {
	var e models.ScheduleEvent
	var createdAt time.Time
	err := r.pool.QueryRow(ctx,
		`UPDATE schedule_events
		 SET title = $1, title_id = $2, time = $3, description = $4, description_id = $5
		 WHERE id = $6
		 RETURNING id, title, title_id, time, description, description_id, sort_order, created_at`,
		data.Title, data.TitleID, data.Time, data.Description, data.DescriptionID, id,
	).Scan(&e.ID, &e.Title, &e.TitleID, &e.Time, &e.Description, &e.DescriptionID, &e.SortOrder, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	e.CreatedAt = createdAt.Format(time.RFC3339)
	return &e, nil
}

func (r *PostgresRepository) DeleteScheduleEvent(ctx context.Context, id int) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM schedule_events WHERE id = $1`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *PostgresRepository) ReorderScheduleEvents(ctx context.Context, items []models.ScheduleOrderItem) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, item := range items {
		_, err := tx.Exec(ctx,
			`UPDATE schedule_events SET sort_order = $1 WHERE id = $2`,
			item.SortOrder, item.ID)
		if err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
