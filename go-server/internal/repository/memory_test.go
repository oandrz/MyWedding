package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/mywedding/platform/internal/models"
)

func newCtx() context.Context {
	return context.Background()
}

// ---------------------------------------------------------------------------
// User tests
// ---------------------------------------------------------------------------

func TestCreateUser(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	u, err := repo.CreateUser(ctx, models.InsertUser{Username: "admin", Password: "secret"})
	if err != nil {
		t.Fatalf("CreateUser returned error: %v", err)
	}
	if u.ID != 1 {
		t.Fatalf("expected ID 1, got %d", u.ID)
	}
	if u.Username != "admin" {
		t.Fatalf("expected username admin, got %s", u.Username)
	}
	if u.Password != "secret" {
		t.Fatalf("expected password to be stored, got %s", u.Password)
	}
}

func TestGetUser(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateUser(ctx, models.InsertUser{Username: "admin", Password: "secret"})

	u, err := repo.GetUser(ctx, 1)
	if err != nil {
		t.Fatalf("GetUser returned error: %v", err)
	}
	if u == nil {
		t.Fatal("expected user, got nil")
	}
	if u.Username != "admin" {
		t.Fatalf("expected admin, got %s", u.Username)
	}
}

func TestGetUserNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	u, err := repo.GetUser(ctx, 999)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if u != nil {
		t.Fatal("expected nil user for missing ID")
	}
}

func TestGetUserByUsername(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateUser(ctx, models.InsertUser{Username: "admin", Password: "secret"})

	u, err := repo.GetUserByUsername(ctx, "admin")
	if err != nil {
		t.Fatalf("GetUserByUsername returned error: %v", err)
	}
	if u == nil {
		t.Fatal("expected user, got nil")
	}
	if u.ID != 1 {
		t.Fatalf("expected ID 1, got %d", u.ID)
	}
}

func TestGetUserByUsernameNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	u, err := repo.GetUserByUsername(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if u != nil {
		t.Fatal("expected nil user for missing username")
	}
}

func TestUserPasswordHiddenInJSON(t *testing.T) {
	u := models.User{ID: 1, Username: "admin", Password: "secret"}
	data, err := json.Marshal(u)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	if strings.Contains(string(data), "secret") {
		t.Fatal("password should be hidden in JSON output")
	}
	if strings.Contains(string(data), "password") {
		t.Fatal("password key should not appear in JSON output")
	}
}

// ---------------------------------------------------------------------------
// RSVP tests
// ---------------------------------------------------------------------------

func TestCreateRsvp(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	gc := 2
	r, err := repo.CreateRsvp(ctx, models.InsertRsvp{
		Name: "Alice", Email: "alice@example.com", AttendanceType: "both", GuestCount: &gc,
	})
	if err != nil {
		t.Fatalf("CreateRsvp returned error: %v", err)
	}
	if r.ID != 1 {
		t.Fatalf("expected ID 1, got %d", r.ID)
	}
	if r.Name != "Alice" {
		t.Fatalf("expected Alice, got %s", r.Name)
	}
	if r.GuestCount == nil || *r.GuestCount != 2 {
		t.Fatalf("expected guestCount 2, got %v", r.GuestCount)
	}
}

func TestUpdateRsvp(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateRsvp(ctx, models.InsertRsvp{
		Name: "Alice", Email: "alice@example.com", AttendanceType: "both",
	})

	gc := 5
	r, err := repo.UpdateRsvp(ctx, 1, models.InsertRsvp{
		Name: "Alice Updated", Email: "alice@example.com", AttendanceType: "decline", GuestCount: &gc,
	})
	if err != nil {
		t.Fatalf("UpdateRsvp returned error: %v", err)
	}
	if r == nil {
		t.Fatal("expected updated rsvp, got nil")
	}
	if r.Name != "Alice Updated" {
		t.Fatalf("expected Alice Updated, got %s", r.Name)
	}
	if r.AttendanceType != "decline" {
		t.Fatalf("expected attendance type decline, got %s", r.AttendanceType)
	}
	if r.GuestCount == nil || *r.GuestCount != 5 {
		t.Fatalf("expected guestCount 5, got %v", r.GuestCount)
	}
}

func TestUpdateRsvpNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	r, err := repo.UpdateRsvp(ctx, 999, models.InsertRsvp{Name: "X", Email: "x@x.com"})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if r != nil {
		t.Fatal("expected nil for missing RSVP")
	}
}

func TestGetRsvps(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateRsvp(ctx, models.InsertRsvp{Name: "A", Email: "a@a.com", AttendanceType: "both"})
	repo.CreateRsvp(ctx, models.InsertRsvp{Name: "B", Email: "b@b.com", AttendanceType: "decline"})

	all, err := repo.GetRsvps(ctx)
	if err != nil {
		t.Fatalf("GetRsvps returned error: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2 rsvps, got %d", len(all))
	}
}

func TestGetRsvpByEmail(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateRsvp(ctx, models.InsertRsvp{Name: "A", Email: "a@a.com", AttendanceType: "both"})

	r, err := repo.GetRsvpByEmail(ctx, "a@a.com")
	if err != nil {
		t.Fatalf("GetRsvpByEmail returned error: %v", err)
	}
	if r == nil || r.Name != "A" {
		t.Fatal("expected to find rsvp by email")
	}
}

func TestGetRsvpByEmailNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	r, err := repo.GetRsvpByEmail(ctx, "missing@x.com")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if r != nil {
		t.Fatal("expected nil for missing email")
	}
}

func TestGetRsvpByName(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateRsvp(ctx, models.InsertRsvp{Name: "Alice", Email: "a@a.com", AttendanceType: "both"})

	r, err := repo.GetRsvpByName(ctx, "Alice")
	if err != nil {
		t.Fatalf("GetRsvpByName returned error: %v", err)
	}
	if r == nil || r.Email != "a@a.com" {
		t.Fatal("expected to find rsvp by name")
	}
}

func TestDeleteRsvp(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateRsvp(ctx, models.InsertRsvp{Name: "A", Email: "a@a.com", AttendanceType: "both"})

	ok, err := repo.DeleteRsvp(ctx, 1)
	if err != nil {
		t.Fatalf("DeleteRsvp returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected true for successful delete")
	}

	r, _ := repo.GetRsvpByEmail(ctx, "a@a.com")
	if r != nil {
		t.Fatal("rsvp should be deleted")
	}
}

func TestDeleteRsvpNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ok, err := repo.DeleteRsvp(ctx, 999)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if ok {
		t.Fatal("expected false for missing RSVP")
	}
}

// ---------------------------------------------------------------------------
// Media tests
// ---------------------------------------------------------------------------

func TestCreateMedia(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	caption := "nice photo"
	md, err := repo.CreateMedia(ctx, models.InsertMedia{
		Name: "Alice", Email: "a@a.com", MediaURL: "https://example.com/pic.jpg", Caption: &caption,
	})
	if err != nil {
		t.Fatalf("CreateMedia returned error: %v", err)
	}
	if md.ID != 1 {
		t.Fatalf("expected ID 1, got %d", md.ID)
	}
	if md.MediaType != "image" {
		t.Fatalf("expected default mediaType 'image', got %s", md.MediaType)
	}
	if md.Approved {
		t.Fatal("expected approved to default to false")
	}
	if md.CreatedAt == "" {
		t.Fatal("expected createdAt to be set")
	}
}

func TestCreateMediaWithExplicitType(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	mt := "video"
	md, err := repo.CreateMedia(ctx, models.InsertMedia{
		Name: "Bob", Email: "b@b.com", MediaURL: "https://example.com/vid.mp4", MediaType: &mt,
	})
	if err != nil {
		t.Fatalf("CreateMedia returned error: %v", err)
	}
	if md.MediaType != "video" {
		t.Fatalf("expected mediaType 'video', got %s", md.MediaType)
	}
}

func TestGetMediaByID(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateMedia(ctx, models.InsertMedia{
		Name: "Alice", Email: "a@a.com", MediaURL: "https://example.com/pic.jpg",
	})

	md, err := repo.GetMediaByID(ctx, 1)
	if err != nil {
		t.Fatalf("GetMediaByID returned error: %v", err)
	}
	if md == nil {
		t.Fatal("expected media, got nil")
	}
}

func TestGetMediaByIDNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	md, err := repo.GetMediaByID(ctx, 999)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if md != nil {
		t.Fatal("expected nil for missing media")
	}
}

func TestGetAllMedia(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateMedia(ctx, models.InsertMedia{Name: "A", Email: "a@a.com", MediaURL: "u1"})
	repo.CreateMedia(ctx, models.InsertMedia{Name: "B", Email: "b@b.com", MediaURL: "u2"})

	all, err := repo.GetAllMedia(ctx)
	if err != nil {
		t.Fatalf("GetAllMedia returned error: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2, got %d", len(all))
	}
}

func TestGetApprovedMedia(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateMedia(ctx, models.InsertMedia{Name: "A", Email: "a@a.com", MediaURL: "u1"})
	repo.CreateMedia(ctx, models.InsertMedia{Name: "B", Email: "b@b.com", MediaURL: "u2"})

	// None approved yet
	approved, err := repo.GetApprovedMedia(ctx)
	if err != nil {
		t.Fatalf("GetApprovedMedia returned error: %v", err)
	}
	if len(approved) != 0 {
		t.Fatalf("expected 0 approved, got %d", len(approved))
	}

	// Approve one
	repo.UpdateMediaApproval(ctx, 1, true)
	approved, err = repo.GetApprovedMedia(ctx)
	if err != nil {
		t.Fatalf("GetApprovedMedia returned error: %v", err)
	}
	if len(approved) != 1 {
		t.Fatalf("expected 1 approved, got %d", len(approved))
	}
}

func TestUpdateMediaApproval(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateMedia(ctx, models.InsertMedia{Name: "A", Email: "a@a.com", MediaURL: "u1"})

	md, err := repo.UpdateMediaApproval(ctx, 1, true)
	if err != nil {
		t.Fatalf("UpdateMediaApproval returned error: %v", err)
	}
	if md == nil || !md.Approved {
		t.Fatal("expected media to be approved")
	}
}

func TestUpdateMediaApprovalNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	md, err := repo.UpdateMediaApproval(ctx, 999, true)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if md != nil {
		t.Fatal("expected nil for missing media")
	}
}

// ---------------------------------------------------------------------------
// Config Image tests
// ---------------------------------------------------------------------------

func TestCreateConfigImage(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	title := "Hero"
	ci, err := repo.CreateConfigImage(ctx, models.InsertConfigImage{
		ImageKey: "hero-1", ImageURL: "https://example.com/hero.jpg", ImageType: "hero", Title: &title,
	})
	if err != nil {
		t.Fatalf("CreateConfigImage returned error: %v", err)
	}
	if ci.ID != 1 {
		t.Fatalf("expected ID 1, got %d", ci.ID)
	}
	if !ci.IsActive {
		t.Fatal("expected isActive to default to true")
	}
	if ci.DisplayOrder != 0 {
		t.Fatalf("expected displayOrder 0, got %d", ci.DisplayOrder)
	}
}

func TestCreateConfigImageWithOptions(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	active := false
	order := 3
	ci, err := repo.CreateConfigImage(ctx, models.InsertConfigImage{
		ImageKey: "bg-1", ImageURL: "https://example.com/bg.jpg", ImageType: "background",
		IsActive: &active, DisplayOrder: &order,
	})
	if err != nil {
		t.Fatalf("CreateConfigImage returned error: %v", err)
	}
	if ci.IsActive {
		t.Fatal("expected isActive false")
	}
	if ci.DisplayOrder != 3 {
		t.Fatalf("expected displayOrder 3, got %d", ci.DisplayOrder)
	}
}

func TestUpdateConfigImage(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateConfigImage(ctx, models.InsertConfigImage{
		ImageKey: "hero-1", ImageURL: "https://example.com/hero.jpg", ImageType: "hero",
	})

	newTitle := "Updated Hero"
	ci, err := repo.UpdateConfigImage(ctx, "hero-1", models.InsertConfigImage{
		ImageKey: "hero-1", ImageURL: "https://example.com/hero-v2.jpg", ImageType: "hero", Title: &newTitle,
	})
	if err != nil {
		t.Fatalf("UpdateConfigImage returned error: %v", err)
	}
	if ci == nil {
		t.Fatal("expected updated config image, got nil")
	}
	if ci.ImageURL != "https://example.com/hero-v2.jpg" {
		t.Fatalf("expected updated URL, got %s", ci.ImageURL)
	}
	if ci.Title == nil || *ci.Title != "Updated Hero" {
		t.Fatal("expected updated title")
	}
}

func TestUpdateConfigImageNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ci, err := repo.UpdateConfigImage(ctx, "nonexistent", models.InsertConfigImage{
		ImageKey: "x", ImageURL: "x", ImageType: "x",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if ci != nil {
		t.Fatal("expected nil for missing config image")
	}
}

func TestDeleteConfigImage(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateConfigImage(ctx, models.InsertConfigImage{
		ImageKey: "hero-1", ImageURL: "u", ImageType: "hero",
	})

	ok, err := repo.DeleteConfigImage(ctx, "hero-1")
	if err != nil {
		t.Fatalf("DeleteConfigImage returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected true for successful delete")
	}

	ci, _ := repo.GetConfigImage(ctx, "hero-1")
	if ci != nil {
		t.Fatal("config image should be deleted")
	}
}

func TestDeleteConfigImageNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ok, err := repo.DeleteConfigImage(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if ok {
		t.Fatal("expected false for missing config image")
	}
}

func TestGetConfigImage(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateConfigImage(ctx, models.InsertConfigImage{
		ImageKey: "hero-1", ImageURL: "u", ImageType: "hero",
	})

	ci, err := repo.GetConfigImage(ctx, "hero-1")
	if err != nil {
		t.Fatalf("GetConfigImage returned error: %v", err)
	}
	if ci == nil {
		t.Fatal("expected config image, got nil")
	}
	if ci.ImageKey != "hero-1" {
		t.Fatalf("expected hero-1, got %s", ci.ImageKey)
	}
}

func TestGetConfigImageNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ci, err := repo.GetConfigImage(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if ci != nil {
		t.Fatal("expected nil for missing config image")
	}
}

func TestGetConfigImagesByType(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "h1", ImageURL: "u1", ImageType: "hero"})
	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "h2", ImageURL: "u2", ImageType: "hero"})
	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "b1", ImageURL: "u3", ImageType: "background"})

	heroes, err := repo.GetConfigImagesByType(ctx, "hero")
	if err != nil {
		t.Fatalf("GetConfigImagesByType returned error: %v", err)
	}
	if len(heroes) != 2 {
		t.Fatalf("expected 2 hero images, got %d", len(heroes))
	}

	bgs, err := repo.GetConfigImagesByType(ctx, "background")
	if err != nil {
		t.Fatalf("GetConfigImagesByType returned error: %v", err)
	}
	if len(bgs) != 1 {
		t.Fatalf("expected 1 background image, got %d", len(bgs))
	}
}

func TestGetConfigImagesByTypeEmpty(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	result, err := repo.GetConfigImagesByType(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("GetConfigImagesByType returned error: %v", err)
	}
	if result == nil {
		t.Fatal("expected empty slice, got nil")
	}
	if len(result) != 0 {
		t.Fatalf("expected 0, got %d", len(result))
	}
}

func TestGetAllConfigImages(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "h1", ImageURL: "u1", ImageType: "hero"})
	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "b1", ImageURL: "u2", ImageType: "background"})

	all, err := repo.GetAllConfigImages(ctx)
	if err != nil {
		t.Fatalf("GetAllConfigImages returned error: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2, got %d", len(all))
	}
}

func TestReorderConfigImages(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "h1", ImageURL: "u1", ImageType: "hero"})
	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "h2", ImageURL: "u2", ImageType: "hero"})
	repo.CreateConfigImage(ctx, models.InsertConfigImage{ImageKey: "h3", ImageURL: "u3", ImageType: "hero"})

	err := repo.ReorderConfigImages(ctx, "hero", []string{"h3", "h1", "h2"})
	if err != nil {
		t.Fatalf("ReorderConfigImages returned error: %v", err)
	}

	ci1, _ := repo.GetConfigImage(ctx, "h3")
	ci2, _ := repo.GetConfigImage(ctx, "h1")
	ci3, _ := repo.GetConfigImage(ctx, "h2")

	if ci1.DisplayOrder != 0 {
		t.Fatalf("expected h3 displayOrder 0, got %d", ci1.DisplayOrder)
	}
	if ci2.DisplayOrder != 1 {
		t.Fatalf("expected h1 displayOrder 1, got %d", ci2.DisplayOrder)
	}
	if ci3.DisplayOrder != 2 {
		t.Fatalf("expected h2 displayOrder 2, got %d", ci3.DisplayOrder)
	}
}

// ---------------------------------------------------------------------------
// Feature Flag tests
// ---------------------------------------------------------------------------

func TestCreateFeatureFlag(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ff, err := repo.CreateFeatureFlag(ctx, models.InsertFeatureFlag{
		FeatureKey: "dark_mode", FeatureName: "Dark Mode", Description: "Enable dark mode",
	})
	if err != nil {
		t.Fatalf("CreateFeatureFlag returned error: %v", err)
	}
	// seed occupies ID 1 and flagIDSeq starts at 1, so first CreateFeatureFlag gets ID 2
	if ff.ID != 2 {
		t.Fatalf("expected ID 2, got %d", ff.ID)
	}
	if ff.Enabled {
		t.Fatal("expected enabled to default to false")
	}
}

func TestCreateFeatureFlagEnabled(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	enabled := true
	ff, err := repo.CreateFeatureFlag(ctx, models.InsertFeatureFlag{
		FeatureKey: "dark_mode", FeatureName: "Dark Mode", Description: "Enable dark mode", Enabled: &enabled,
	})
	if err != nil {
		t.Fatalf("CreateFeatureFlag returned error: %v", err)
	}
	if !ff.Enabled {
		t.Fatal("expected enabled to be true")
	}
}

func TestUpdateFeatureFlag(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateFeatureFlag(ctx, models.InsertFeatureFlag{
		FeatureKey: "dark_mode", FeatureName: "Dark Mode", Description: "Enable dark mode",
	})

	ff, err := repo.UpdateFeatureFlag(ctx, "dark_mode", true)
	if err != nil {
		t.Fatalf("UpdateFeatureFlag returned error: %v", err)
	}
	if ff == nil {
		t.Fatal("expected feature flag, got nil")
	}
	if !ff.Enabled {
		t.Fatal("expected enabled to be true after toggle")
	}

	// Toggle back off
	ff, err = repo.UpdateFeatureFlag(ctx, "dark_mode", false)
	if err != nil {
		t.Fatalf("UpdateFeatureFlag returned error: %v", err)
	}
	if ff.Enabled {
		t.Fatal("expected enabled to be false after toggle off")
	}
}

func TestUpdateFeatureFlagNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ff, err := repo.UpdateFeatureFlag(ctx, "nonexistent", true)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if ff != nil {
		t.Fatal("expected nil for missing feature flag")
	}
}

func TestGetFeatureFlag(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateFeatureFlag(ctx, models.InsertFeatureFlag{
		FeatureKey: "dark_mode", FeatureName: "Dark Mode", Description: "Enable dark mode",
	})

	ff, err := repo.GetFeatureFlag(ctx, "dark_mode")
	if err != nil {
		t.Fatalf("GetFeatureFlag returned error: %v", err)
	}
	if ff == nil {
		t.Fatal("expected feature flag, got nil")
	}
	if ff.FeatureKey != "dark_mode" {
		t.Fatalf("expected dark_mode, got %s", ff.FeatureKey)
	}
}

func TestGetFeatureFlagNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ff, err := repo.GetFeatureFlag(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if ff != nil {
		t.Fatal("expected nil for missing feature flag")
	}
}

func TestGetAllFeatureFlags(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateFeatureFlag(ctx, models.InsertFeatureFlag{
		FeatureKey: "f1", FeatureName: "Flag 1", Description: "d1",
	})
	repo.CreateFeatureFlag(ctx, models.InsertFeatureFlag{
		FeatureKey: "f2", FeatureName: "Flag 2", Description: "d2",
	})

	all, err := repo.GetAllFeatureFlags(ctx)
	if err != nil {
		t.Fatalf("GetAllFeatureFlags returned error: %v", err)
	}
	// seed adds 1 to the count
	if len(all) != 3 {
		t.Fatalf("expected 3 (1 seed + 2 created), got %d", len(all))
	}
}

// ---------------------------------------------------------------------------
// App Setting tests
// ---------------------------------------------------------------------------

func TestCreateAppSetting(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	desc := "Site name setting"
	as, err := repo.CreateAppSetting(ctx, models.InsertAppSetting{
		SettingKey: "site_name", SettingValue: "Our Wedding", SettingType: "string", Description: &desc,
	})
	if err != nil {
		t.Fatalf("CreateAppSetting returned error: %v", err)
	}
	if as.ID != 1 {
		t.Fatalf("expected ID 1, got %d", as.ID)
	}
	if as.SettingKey != "site_name" {
		t.Fatalf("expected site_name, got %s", as.SettingKey)
	}
}

func TestUpdateAppSetting(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateAppSetting(ctx, models.InsertAppSetting{
		SettingKey: "site_name", SettingValue: "Our Wedding", SettingType: "string",
	})

	as, err := repo.UpdateAppSetting(ctx, "site_name", models.InsertAppSetting{
		SettingKey: "site_name", SettingValue: "The Wedding", SettingType: "string",
	})
	if err != nil {
		t.Fatalf("UpdateAppSetting returned error: %v", err)
	}
	if as == nil {
		t.Fatal("expected updated app setting, got nil")
	}
	if as.SettingValue != "The Wedding" {
		t.Fatalf("expected The Wedding, got %s", as.SettingValue)
	}
}

func TestUpdateAppSettingNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	as, err := repo.UpdateAppSetting(ctx, "nonexistent", models.InsertAppSetting{
		SettingKey: "x", SettingValue: "x", SettingType: "x",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if as != nil {
		t.Fatal("expected nil for missing app setting")
	}
}

func TestGetAppSetting(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateAppSetting(ctx, models.InsertAppSetting{
		SettingKey: "site_name", SettingValue: "Our Wedding", SettingType: "string",
	})

	as, err := repo.GetAppSetting(ctx, "site_name")
	if err != nil {
		t.Fatalf("GetAppSetting returned error: %v", err)
	}
	if as == nil {
		t.Fatal("expected app setting, got nil")
	}
	if as.SettingValue != "Our Wedding" {
		t.Fatalf("expected Our Wedding, got %s", as.SettingValue)
	}
}

func TestGetAppSettingNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	as, err := repo.GetAppSetting(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if as != nil {
		t.Fatal("expected nil for missing app setting")
	}
}

func TestGetAllAppSettings(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateAppSetting(ctx, models.InsertAppSetting{
		SettingKey: "s1", SettingValue: "v1", SettingType: "string",
	})
	repo.CreateAppSetting(ctx, models.InsertAppSetting{
		SettingKey: "s2", SettingValue: "v2", SettingType: "string",
	})

	all, err := repo.GetAllAppSettings(ctx)
	if err != nil {
		t.Fatalf("GetAllAppSettings returned error: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2, got %d", len(all))
	}
}

// ---------------------------------------------------------------------------
// Welcome Screen tests
// ---------------------------------------------------------------------------

func TestGetWelcomeScreenDefault(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ws, err := repo.GetWelcomeScreen(ctx)
	if err != nil {
		t.Fatalf("GetWelcomeScreen returned error: %v", err)
	}
	if ws != nil {
		t.Fatal("expected nil for uninitialized welcome screen")
	}
}

func TestUpdateWelcomeScreen(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	heading := "Welcome to Our Wedding"
	ws, err := repo.UpdateWelcomeScreen(ctx, models.InsertWelcomeScreen{
		HeadingText: &heading,
	})
	if err != nil {
		t.Fatalf("UpdateWelcomeScreen returned error: %v", err)
	}
	if ws == nil {
		t.Fatal("expected welcome screen, got nil")
	}
	if ws.HeadingText != "Welcome to Our Wedding" {
		t.Fatalf("expected heading, got %s", ws.HeadingText)
	}
	// Defaults from initialization
	if ws.DeliveryLabel != "Delivery" {
		t.Fatalf("expected default deliveryLabel, got %s", ws.DeliveryLabel)
	}
	if ws.FallbackName != "Guest" {
		t.Fatalf("expected default fallbackName, got %s", ws.FallbackName)
	}
	if !ws.Enabled {
		t.Fatal("expected default enabled true")
	}
}

func TestUpdateWelcomeScreenPartial(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	// First update initializes
	heading := "Hello"
	repo.UpdateWelcomeScreen(ctx, models.InsertWelcomeScreen{HeadingText: &heading})

	// Second update only changes enabled
	enabled := false
	ws, err := repo.UpdateWelcomeScreen(ctx, models.InsertWelcomeScreen{Enabled: &enabled})
	if err != nil {
		t.Fatalf("UpdateWelcomeScreen returned error: %v", err)
	}
	if ws.HeadingText != "Hello" {
		t.Fatalf("heading should not have changed, got %s", ws.HeadingText)
	}
	if ws.Enabled {
		t.Fatal("expected enabled to be false")
	}
}

func TestGetWelcomeScreenAfterUpdate(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	heading := "Hello"
	repo.UpdateWelcomeScreen(ctx, models.InsertWelcomeScreen{HeadingText: &heading})

	ws, err := repo.GetWelcomeScreen(ctx)
	if err != nil {
		t.Fatalf("GetWelcomeScreen returned error: %v", err)
	}
	if ws == nil {
		t.Fatal("expected welcome screen, got nil")
	}
	if ws.HeadingText != "Hello" {
		t.Fatalf("expected Hello, got %s", ws.HeadingText)
	}
}

// ---------------------------------------------------------------------------
// Message tests
// ---------------------------------------------------------------------------

func TestCreateMessage(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	email := "alice@example.com"
	msg, err := repo.CreateMessage(ctx, models.InsertMessage{
		Name: "Alice", Email: &email, Content: "Congratulations!",
	})
	if err != nil {
		t.Fatalf("CreateMessage returned error: %v", err)
	}
	if msg.ID != 1 {
		t.Fatalf("expected ID 1, got %d", msg.ID)
	}
	if msg.Name != "Alice" {
		t.Fatalf("expected Alice, got %s", msg.Name)
	}
	if msg.Email == nil || *msg.Email != "alice@example.com" {
		t.Fatal("expected email to be set")
	}
	if msg.CreatedAt == "" {
		t.Fatal("expected createdAt to be set")
	}
}

func TestCreateMessageWithoutEmail(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	msg, err := repo.CreateMessage(ctx, models.InsertMessage{
		Name: "Bob", Content: "Best wishes!",
	})
	if err != nil {
		t.Fatalf("CreateMessage returned error: %v", err)
	}
	if msg.Email != nil {
		t.Fatal("expected nil email")
	}
}

func TestGetMessageByID(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateMessage(ctx, models.InsertMessage{Name: "Alice", Content: "Hello"})

	msg, err := repo.GetMessageByID(ctx, 1)
	if err != nil {
		t.Fatalf("GetMessageByID returned error: %v", err)
	}
	if msg == nil {
		t.Fatal("expected message, got nil")
	}
	if msg.Content != "Hello" {
		t.Fatalf("expected Hello, got %s", msg.Content)
	}
}

func TestGetMessageByIDNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	msg, err := repo.GetMessageByID(ctx, 999)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if msg != nil {
		t.Fatal("expected nil for missing message")
	}
}

func TestGetAllMessages(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateMessage(ctx, models.InsertMessage{Name: "A", Content: "c1"})
	repo.CreateMessage(ctx, models.InsertMessage{Name: "B", Content: "c2"})

	all, err := repo.GetAllMessages(ctx)
	if err != nil {
		t.Fatalf("GetAllMessages returned error: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("expected 2, got %d", len(all))
	}
}

func TestDeleteMessage(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateMessage(ctx, models.InsertMessage{Name: "A", Content: "c1"})

	ok, err := repo.DeleteMessage(ctx, 1)
	if err != nil {
		t.Fatalf("DeleteMessage returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected true for successful delete")
	}

	msg, _ := repo.GetMessageByID(ctx, 1)
	if msg != nil {
		t.Fatal("message should be deleted")
	}
}

func TestDeleteMessageNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	ok, err := repo.DeleteMessage(ctx, 999)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if ok {
		t.Fatal("expected false for missing message")
	}
}

// ---------------------------------------------------------------------------
// JSON serialization tests — verify camelCase keys
// ---------------------------------------------------------------------------

func TestRsvpJSONCamelCase(t *testing.T) {
	gc := 3
	r := models.Rsvp{ID: 1, Name: "Alice", Email: "a@a.com", AttendanceType: "both", GuestCount: &gc}
	data, err := json.Marshal(r)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	s := string(data)
	for _, key := range []string{`"id"`, `"name"`, `"email"`, `"attendanceType"`, `"guestCount"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("expected camelCase key %s in JSON: %s", key, s)
		}
	}
}

func TestMediaJSONCamelCase(t *testing.T) {
	md := models.Media{
		ID: 1, Name: "A", Email: "a@a.com", MediaURL: "u", MediaType: "image",
		Approved: false, CreatedAt: "2024-01-01T00:00:00Z",
	}
	data, err := json.Marshal(md)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	s := string(data)
	for _, key := range []string{`"mediaUrl"`, `"mediaType"`, `"createdAt"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("expected camelCase key %s in JSON: %s", key, s)
		}
	}
}

func TestConfigImageJSONCamelCase(t *testing.T) {
	ci := models.ConfigImage{
		ID: 1, ImageKey: "k", ImageURL: "u", ImageType: "hero",
		IsActive: true, DisplayOrder: 0, UpdatedAt: "2024-01-01T00:00:00Z",
	}
	data, err := json.Marshal(ci)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	s := string(data)
	for _, key := range []string{`"imageKey"`, `"imageUrl"`, `"thumbnailUrl"`, `"imageType"`, `"isActive"`, `"displayOrder"`, `"updatedAt"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("expected camelCase key %s in JSON: %s", key, s)
		}
	}
}

func TestFeatureFlagJSONCamelCase(t *testing.T) {
	ff := models.FeatureFlag{
		ID: 1, FeatureKey: "k", FeatureName: "n", Description: "d", Enabled: true, UpdatedAt: "t",
	}
	data, err := json.Marshal(ff)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	s := string(data)
	for _, key := range []string{`"featureKey"`, `"featureName"`, `"updatedAt"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("expected camelCase key %s in JSON: %s", key, s)
		}
	}
}

func TestAppSettingJSONCamelCase(t *testing.T) {
	as := models.AppSetting{
		ID: 1, SettingKey: "k", SettingValue: "v", SettingType: "string", UpdatedAt: "t",
	}
	data, err := json.Marshal(as)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	s := string(data)
	for _, key := range []string{`"settingKey"`, `"settingValue"`, `"settingType"`, `"updatedAt"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("expected camelCase key %s in JSON: %s", key, s)
		}
	}
}

func TestWelcomeScreenJSONCamelCase(t *testing.T) {
	ws := models.WelcomeScreen{
		ID: 1, HeadingText: "h", DeliveryLabel: "d", FallbackName: "f", Enabled: true, UpdatedAt: "t",
	}
	data, err := json.Marshal(ws)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	s := string(data)
	for _, key := range []string{`"headingText"`, `"deliveryLabel"`, `"fallbackName"`, `"updatedAt"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("expected camelCase key %s in JSON: %s", key, s)
		}
	}
}

func TestMessageJSONCamelCase(t *testing.T) {
	msg := models.Message{
		ID: 1, Name: "A", Content: "c", CreatedAt: "t",
	}
	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	s := string(data)
	for _, key := range []string{`"createdAt"`} {
		if !strings.Contains(s, key) {
			t.Fatalf("expected camelCase key %s in JSON: %s", key, s)
		}
	}
}

// ---------------------------------------------------------------------------
// Pagination tests
// ---------------------------------------------------------------------------

func TestGetMessagesPaginated(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	for i := 1; i <= 5; i++ {
		repo.CreateMessage(ctx, models.InsertMessage{
			Name:    fmt.Sprintf("User%d", i),
			Content: fmt.Sprintf("Message %d", i),
		})
	}

	tests := []struct {
		name      string
		limit     int
		offset    int
		wantCount int
		wantTotal int
	}{
		{"first page", 2, 0, 2, 5},
		{"second page", 2, 2, 2, 5},
		{"last page partial", 2, 4, 1, 5},
		{"offset beyond total", 2, 10, 0, 5},
		{"all at once", 10, 0, 5, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msgs, total, err := repo.GetMessagesPaginated(ctx, tt.limit, tt.offset)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(msgs) != tt.wantCount {
				t.Errorf("got %d messages, want %d", len(msgs), tt.wantCount)
			}
			if total != tt.wantTotal {
				t.Errorf("got total %d, want %d", total, tt.wantTotal)
			}
		})
	}
}

func TestGetApprovedMediaPaginated(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	// CreateMedia defaults to Approved=false, so we must approve them first
	for i := 1; i <= 5; i++ {
		mediaType := "image"
		md, _ := repo.CreateMedia(ctx, models.InsertMedia{
			Name:      fmt.Sprintf("User%d", i),
			Email:     fmt.Sprintf("user%d@example.com", i),
			MediaURL:  fmt.Sprintf("https://example.com/photo%d.jpg", i),
			MediaType: &mediaType,
		})
		repo.UpdateMediaApproval(ctx, md.ID, true)
	}

	tests := []struct {
		name      string
		limit     int
		offset    int
		wantCount int
		wantTotal int
	}{
		{"first page", 2, 0, 2, 5},
		{"second page", 2, 2, 2, 5},
		{"last page partial", 2, 4, 1, 5},
		{"offset beyond total", 2, 10, 0, 5},
		{"all at once", 10, 0, 5, 5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			media, total, err := repo.GetApprovedMediaPaginated(ctx, tt.limit, tt.offset)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(media) != tt.wantCount {
				t.Errorf("got %d media, want %d", len(media), tt.wantCount)
			}
			if total != tt.wantTotal {
				t.Errorf("got total %d, want %d", total, tt.wantTotal)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Invite tests
// ---------------------------------------------------------------------------

func TestCreateInvite(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	inv, err := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})
	if err != nil {
		t.Fatalf("CreateInvite returned error: %v", err)
	}
	if inv.ID != 1 {
		t.Fatalf("expected ID 1, got %d", inv.ID)
	}
	if inv.Name != "Alice" {
		t.Fatalf("expected name Alice, got %s", inv.Name)
	}
	if len(inv.Code) != 5 {
		t.Fatalf("expected 5-char code, got %q (len %d)", inv.Code, len(inv.Code))
	}
	if inv.RsvpID != nil {
		t.Fatalf("expected nil rsvpId, got %v", inv.RsvpID)
	}
}

func TestGetInvites(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})
	repo.CreateInvite(ctx, models.InsertInvite{Name: "Bob"})

	invites, err := repo.GetInvites(ctx)
	if err != nil {
		t.Fatalf("GetInvites returned error: %v", err)
	}
	if len(invites) != 2 {
		t.Fatalf("expected 2 invites, got %d", len(invites))
	}
}

func TestGetInviteByID(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	created, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	inv, err := repo.GetInviteByID(ctx, created.ID)
	if err != nil {
		t.Fatalf("GetInviteByID returned error: %v", err)
	}
	if inv == nil {
		t.Fatal("expected invite, got nil")
	}
	if inv.Name != "Alice" {
		t.Fatalf("expected Alice, got %s", inv.Name)
	}
}

func TestGetInviteByIDNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	inv, err := repo.GetInviteByID(ctx, 999)
	if err != nil {
		t.Fatalf("GetInviteByID returned error: %v", err)
	}
	if inv != nil {
		t.Fatal("expected nil for missing id")
	}
}

func TestGetInviteByCode(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	created, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	inv, err := repo.GetInviteByCode(ctx, created.Code)
	if err != nil {
		t.Fatalf("GetInviteByCode returned error: %v", err)
	}
	if inv == nil {
		t.Fatal("expected invite, got nil")
	}
	if inv.Name != "Alice" {
		t.Fatalf("expected Alice, got %s", inv.Name)
	}
}

func TestGetInviteByCodeNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	inv, err := repo.GetInviteByCode(ctx, "zzzzz")
	if err != nil {
		t.Fatalf("GetInviteByCode returned error: %v", err)
	}
	if inv != nil {
		t.Fatal("expected nil for missing code")
	}
}

func TestDeleteInvite(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	deleted, err := repo.DeleteInvite(ctx, 1)
	if err != nil {
		t.Fatalf("DeleteInvite returned error: %v", err)
	}
	if !deleted {
		t.Fatal("expected deleted=true")
	}

	invites, _ := repo.GetInvites(ctx)
	if len(invites) != 0 {
		t.Fatalf("expected 0 invites after delete, got %d", len(invites))
	}
}

func TestDeleteInviteNotFound(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	deleted, err := repo.DeleteInvite(ctx, 999)
	if err != nil {
		t.Fatalf("DeleteInvite returned error: %v", err)
	}
	if deleted {
		t.Fatal("expected deleted=false for missing invite")
	}
}

func TestUpdateInviteRsvpID(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	created, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	rsvpID := 42
	err := repo.UpdateInviteRsvpID(ctx, created.ID, &rsvpID)
	if err != nil {
		t.Fatalf("UpdateInviteRsvpID returned error: %v", err)
	}

	inv, _ := repo.GetInviteByCode(ctx, created.Code)
	if inv.RsvpID == nil || *inv.RsvpID != 42 {
		t.Fatalf("expected rsvpId=42, got %v", inv.RsvpID)
	}

	// Clear rsvpID
	err = repo.UpdateInviteRsvpID(ctx, created.ID, nil)
	if err != nil {
		t.Fatalf("UpdateInviteRsvpID (nil) returned error: %v", err)
	}
	inv, _ = repo.GetInviteByCode(ctx, created.Code)
	if inv.RsvpID != nil {
		t.Fatalf("expected nil rsvpId, got %v", inv.RsvpID)
	}
}

func TestGetInviteByCode_PopulatesRsvp(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	gc := 2
	rsvp, _ := repo.CreateRsvp(ctx, models.InsertRsvp{
		Name: "Alice", Email: "a@a.com", AttendanceType: "both", GuestCount: &gc,
	})

	inv, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})
	repo.UpdateInviteRsvpID(ctx, inv.ID, &rsvp.ID)

	fetched, _ := repo.GetInviteByCode(ctx, inv.Code)
	if fetched.Rsvp == nil {
		t.Fatal("expected Rsvp to be populated")
	}
	if fetched.Rsvp.ID != rsvp.ID {
		t.Fatalf("expected rsvp ID %d, got %d", rsvp.ID, fetched.Rsvp.ID)
	}
}

// ---------------------------------------------------------------------------
// Invite Bulk tests
// ---------------------------------------------------------------------------

func TestCreateInvitesBulk(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	names := []models.InsertInvite{
		{Name: "Alice"},
		{Name: "Bob"},
		{Name: "Charlie"},
	}

	invites, err := repo.CreateInvitesBulk(ctx, names)
	if err != nil {
		t.Fatalf("CreateInvitesBulk returned error: %v", err)
	}
	if len(invites) != 3 {
		t.Fatalf("expected 3 invites, got %d", len(invites))
	}

	// Verify each invite has correct name, unique code, and sequential IDs
	codes := make(map[string]bool)
	for i, inv := range invites {
		if inv.Name != names[i].Name {
			t.Fatalf("invite %d: expected name %q, got %q", i, names[i].Name, inv.Name)
		}
		if len(inv.Code) != 5 {
			t.Fatalf("invite %d: expected 5-char code, got %q", i, inv.Code)
		}
		if codes[inv.Code] {
			t.Fatalf("invite %d: duplicate code %q", i, inv.Code)
		}
		codes[inv.Code] = true
		if inv.ID == 0 {
			t.Fatalf("invite %d: expected non-zero ID", i)
		}
		if inv.CreatedAt == "" {
			t.Fatalf("invite %d: expected non-empty CreatedAt", i)
		}
	}

	// Verify all invites are retrievable via GetInvites
	all, err := repo.GetInvites(ctx)
	if err != nil {
		t.Fatalf("GetInvites returned error: %v", err)
	}
	if len(all) != 3 {
		t.Fatalf("expected 3 invites from GetInvites, got %d", len(all))
	}
}

func TestCreateInvitesBulk_Empty(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := newCtx()

	invites, err := repo.CreateInvitesBulk(ctx, []models.InsertInvite{})
	if err != nil {
		t.Fatalf("CreateInvitesBulk with empty slice returned error: %v", err)
	}
	if len(invites) != 0 {
		t.Fatalf("expected 0 invites, got %d", len(invites))
	}
}

// ---------------------------------------------------------------------------
// Invite WhatsApp fields tests
// ---------------------------------------------------------------------------

func TestMemory_UpdateInvitePhone(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	inv, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice"})

	phone := "+6281234567890"
	updated, err := repo.UpdateInvitePhone(ctx, inv.ID, &phone)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated == nil {
		t.Fatal("expected invite, got nil")
	}
	if updated.Phone == nil || *updated.Phone != phone {
		t.Fatalf("expected phone %q, got %v", phone, updated.Phone)
	}

	// Clear phone
	updated2, err := repo.UpdateInvitePhone(ctx, inv.ID, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated2.Phone != nil {
		t.Fatalf("expected nil phone, got %v", updated2.Phone)
	}

	// Not found
	_, err = repo.UpdateInvitePhone(ctx, 9999, &phone)
	if err == nil {
		t.Fatal("expected error for non-existent invite")
	}
}

func TestMemory_MarkUnmarkInviteWaSent(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	inv, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Bob"})

	// Mark sent
	updated, err := repo.MarkInviteWaSent(ctx, inv.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.WaSentAt == nil {
		t.Fatal("expected waSentAt to be set")
	}

	// Unmark sent
	updated2, err := repo.UnmarkInviteWaSent(ctx, inv.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated2.WaSentAt != nil {
		t.Fatalf("expected waSentAt to be nil, got %v", updated2.WaSentAt)
	}
}

func TestMemory_CreateInvite_WithPhone(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	phone := "+6591234567"
	inv, err := repo.CreateInvite(ctx, models.InsertInvite{Name: "Charlie", Phone: &phone})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if inv.Phone == nil || *inv.Phone != phone {
		t.Fatalf("expected phone %q, got %v", phone, inv.Phone)
	}
}

func TestMemory_CreateInvitesBulk_WithPhone(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	phone := "+6281234567890"
	invites, err := repo.CreateInvitesBulk(ctx, []models.InsertInvite{
		{Name: "Alice", Phone: &phone},
		{Name: "Bob"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(invites) != 2 {
		t.Fatalf("expected 2, got %d", len(invites))
	}
	if invites[0].Phone == nil || *invites[0].Phone != phone {
		t.Fatalf("expected phone on first invite")
	}
	if invites[1].Phone != nil {
		t.Fatalf("expected nil phone on second invite")
	}
}

// ---------------------------------------------------------------------------
// Invite side field tests
// ---------------------------------------------------------------------------

func TestInvite_SideField(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	groomSide := "groom"
	inv, err := repo.CreateInvite(ctx, models.InsertInvite{Name: "Budi", Side: &groomSide})
	if err != nil {
		t.Fatalf("CreateInvite: %v", err)
	}
	if inv.Side == nil || *inv.Side != "groom" {
		t.Fatalf("expected side=groom, got %v", inv.Side)
	}

	brideSide := "bride"
	updated, err := repo.UpdateInviteSide(ctx, inv.ID, &brideSide)
	if err != nil {
		t.Fatalf("UpdateInviteSide: %v", err)
	}
	if updated.Side == nil || *updated.Side != "bride" {
		t.Fatalf("expected side=bride after update, got %v", updated.Side)
	}

	updated2, err := repo.UpdateInvite(ctx, inv.ID, "Budi Santoso", nil, nil)
	if err != nil {
		t.Fatalf("UpdateInvite: %v", err)
	}
	if updated2.Side != nil {
		t.Fatalf("expected side cleared after UpdateInvite with nil side, got %v", updated2.Side)
	}
}

func TestInvite_BulkCreateWithSide(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	groomSide := "groom"
	invites, err := repo.CreateInvitesBulk(ctx, []models.InsertInvite{
		{Name: "Alice", Side: &groomSide},
		{Name: "Bob"},
	})
	if err != nil {
		t.Fatalf("CreateInvitesBulk: %v", err)
	}
	if invites[0].Side == nil || *invites[0].Side != "groom" {
		t.Fatalf("expected Alice side=groom, got %v", invites[0].Side)
	}
	if invites[1].Side != nil {
		t.Fatalf("expected Bob side=nil, got %v", invites[1].Side)
	}
}

// ---------------------------------------------------------------------------
// Interface compliance — compile-time check
// ---------------------------------------------------------------------------

var _ Repository = (*MemoryRepository)(nil)
