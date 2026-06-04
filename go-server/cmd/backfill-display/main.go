// Command backfill-display generates a ~1600px "display" image for every gallery
// config image that does not yet have one, and records its URL in display_url.
// Idempotent: rows with a non-null display_url are skipped, so it is safe to re-run.
//
// Usage (from go-server/, with prod env loaded):
//
//	DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... SUPABASE_BUCKET_ID=... \
//	  go run ./cmd/backfill-display
package main

import (
	"bytes"
	"context"
	"log"
	"strings"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/database"
	"github.com/andreasronaldo/wedding-server/internal/service"
)

func main() {
	cfg := config.Load()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx := context.Background()
	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	var storage service.ObjectStorage
	if cfg.SupabaseURL != "" && cfg.SupabaseServiceKey != "" && cfg.SupabaseBucketID != "" {
		storage = service.NewSupabaseStorage(cfg.SupabaseURL, cfg.SupabaseServiceKey, cfg.SupabaseBucketID, cfg.Env)
	} else if !cfg.IsProduction() {
		storage = service.NewLocalStorage("./storage")
	} else {
		log.Fatal("no storage configured: set SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET_ID")
	}

	rows, err := pool.Query(ctx,
		`SELECT id, image_key, image_url FROM config_images
		 WHERE image_type = 'gallery' AND display_url IS NULL`)
	if err != nil {
		log.Fatalf("query: %v", err)
	}

	type job struct {
		id       int
		imageKey string
		imageURL string
	}
	var jobs []job
	for rows.Next() {
		var j job
		if err := rows.Scan(&j.id, &j.imageKey, &j.imageURL); err != nil {
			rows.Close()
			log.Fatalf("scan: %v", err)
		}
		jobs = append(jobs, j)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		log.Fatalf("rows: %v", err)
	}

	log.Printf("found %d gallery images needing a display image", len(jobs))

	var done, failed int
	for _, j := range jobs {
		objectPath := storage.ParsePublicURL(j.imageURL)
		data, err := storage.DownloadBuffer(ctx, objectPath)
		if err != nil {
			log.Printf("[skip] %s: download %s failed: %v", j.imageKey, objectPath, err)
			failed++
			continue
		}

		opt, err := service.OptimizeImage(data, 1600, 80)
		if err != nil {
			log.Printf("[skip] %s: optimize failed: %v", j.imageKey, err)
			failed++
			continue
		}

		base := objectPath
		if idx := strings.LastIndex(objectPath, "/"); idx >= 0 {
			base = objectPath[idx+1:]
		}
		displayName := service.GenerateDisplayFilename(base)
		dispURL, err := storage.Upload(ctx, bytes.NewReader(opt.ThumbnailBuffer), int64(len(opt.ThumbnailBuffer)), displayName, opt.ThumbnailContentType, "admin/gallery/display")
		if err != nil {
			log.Printf("[skip] %s: upload failed: %v", j.imageKey, err)
			failed++
			continue
		}

		if _, err := pool.Exec(ctx, `UPDATE config_images SET display_url = $1 WHERE id = $2`, dispURL, j.id); err != nil {
			log.Printf("[skip] %s: db update failed: %v", j.imageKey, err)
			failed++
			continue
		}

		log.Printf("[ok] %s -> %s", j.imageKey, dispURL)
		done++
	}

	log.Printf("backfill complete: %d updated, %d failed, %d total", done, failed, len(jobs))
}
