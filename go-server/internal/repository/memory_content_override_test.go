package repository

import (
	"context"
	"testing"

	"github.com/andreasronaldo/wedding-server/internal/models"
)

func TestMemoryContentOverridesUpsertAndGet(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	n, err := repo.UpsertContentOverrides(ctx, []models.InsertContentOverride{
		{Key: "hero.title", Locale: "en", Value: "Hello"},
		{Key: "hero.title", Locale: "id", Value: "Halo"},
	})
	if err != nil {
		t.Fatalf("upsert: %v", err)
	}
	if n != 2 {
		t.Fatalf("want 2 upserted, got %d", n)
	}

	// Conflict updates value, does not duplicate.
	if _, err := repo.UpsertContentOverrides(ctx, []models.InsertContentOverride{
		{Key: "hero.title", Locale: "en", Value: "Hi"},
	}); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	all, err := repo.GetAllContentOverrides(ctx)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(all) != 2 {
		t.Fatalf("want 2 rows, got %d", len(all))
	}
	got := map[string]string{}
	for _, o := range all {
		got[o.Key+"|"+o.Locale] = o.Value
	}
	if got["hero.title|en"] != "Hi" {
		t.Fatalf("want updated en=Hi, got %q", got["hero.title|en"])
	}
	if got["hero.title|id"] != "Halo" {
		t.Fatalf("want id=Halo, got %q", got["hero.title|id"])
	}
}
