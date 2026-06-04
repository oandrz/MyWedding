# Gallery Display-Size Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve a pre-generated ~1600px "display" image (instead of the ~1MB original) to the gallery fullscreen detail viewer, and reduce neighbor preloading from ±2 to ±1, to cut detail-view egress by roughly an order of magnitude.

**Architecture:** Mirror the existing thumbnail pattern. At upload, generate a second downscaled JPEG (1600px/q80) alongside the 600px thumbnail and store its URL in a new `display_url` column. The frontend detail viewer loads `displayUrl` (falling back to the original when null). A one-off Go command backfills display images for photos already uploaded. The blur placeholder and carousel keep using the thumbnail; the original is now only a fallback.

**Tech Stack:** Go (Chi, pgx, `disintegration/imaging`), Postgres, React/TypeScript + Vite + Vitest, Drizzle ORM schema.

**Working directories:** Go commands run from `go-server/`. Frontend/npm commands run from the repo root `/Volumes/Oink_Machine/Intelij/MyWedding`.

---

### Task 1: Display filename helper (`imageopt`)

`OptimizeImage(data, width, quality)` already accepts an arbitrary width and refuses to enlarge, so it needs no change — we only add a filename helper for the display variant.

**Files:**
- Create: `go-server/internal/service/imageopt_test.go`
- Modify: `go-server/internal/service/imageopt.go`

- [ ] **Step 1: Write the failing test**

Create `go-server/internal/service/imageopt_test.go`:

```go
package service

import "testing"

func TestGenerateDisplayFilename(t *testing.T) {
	cases := []struct {
		name     string
		input    string
		expected string
	}{
		{"with extension", "gallery_123-456.jpg", "gallery_123-456-display.jpg"},
		{"png becomes display jpg", "photo.png", "photo-display.jpg"},
		{"no extension", "photo", "photo-display.jpg"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := GenerateDisplayFilename(tc.input); got != tc.expected {
				t.Errorf("GenerateDisplayFilename(%q) = %q, want %q", tc.input, got, tc.expected)
			}
		})
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/service -run TestGenerateDisplayFilename -v`
Expected: FAIL — `undefined: GenerateDisplayFilename`.

- [ ] **Step 3: Add the helper**

In `go-server/internal/service/imageopt.go`, add below `GenerateThumbnailFilename`:

```go
// GenerateDisplayFilename creates a display-size filename from the original.
func GenerateDisplayFilename(original string) string {
	lastDot := strings.LastIndex(original, ".")
	if lastDot > 0 {
		return original[:lastDot] + "-display.jpg"
	}
	return original + "-display.jpg"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd go-server && go test ./internal/service -run TestGenerateDisplayFilename -v`
Expected: PASS (all three sub-cases).

- [ ] **Step 5: Commit**

```bash
cd go-server && git add internal/service/imageopt.go internal/service/imageopt_test.go
git commit -m "feat(imageopt): add GenerateDisplayFilename helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add `displayUrl` to model, schema, migration, and repositories

This task adds the field everywhere it must be carried, with no behavior change yet. It compiles and existing tests still pass.

**Files:**
- Modify: `shared/schema.ts:43-72`
- Modify: `go-server/internal/models/config_image.go`
- Create: `go-server/migrations/002_add_display_url.sql`
- Modify: `go-server/internal/repository/postgres.go` (config image queries, lines ~311-426)
- Modify: `go-server/internal/repository/memory.go` (Create ~313, Update ~334)

- [ ] **Step 1: Add the column to the Drizzle schema**

In `shared/schema.ts`, inside the `configImages` table (after the `thumbnailUrl` line at `:47`):

```ts
  thumbnailUrl: text("thumbnail_url"), // Optimized thumbnail for fast loading
  displayUrl: text("display_url"), // Downscaled ~1600px image for the detail viewer
```

And in `insertConfigImageSchema.pick({ ... })` (around `:66-72`), add `displayUrl: true,` after `thumbnailUrl: true,`:

```ts
  thumbnailUrl: true,
  displayUrl: true,
```

- [ ] **Step 2: Add the field to the Go models**

In `go-server/internal/models/config_image.go`, add `DisplayURL` after `ThumbnailURL` in **both** structs:

```go
// in ConfigImage:
	ThumbnailURL *string `json:"thumbnailUrl"`
	DisplayURL   *string `json:"displayUrl"`
// in InsertConfigImage:
	ThumbnailURL *string `json:"thumbnailUrl"`
	DisplayURL   *string `json:"displayUrl"`
```

- [ ] **Step 3: Create the migration**

Create `go-server/migrations/002_add_display_url.sql`:

```sql
-- Add a downscaled "display" image URL for the gallery detail viewer.
-- Nullable: existing rows are backfilled by cmd/backfill-display; the detail
-- view falls back to image_url when this is NULL.
ALTER TABLE config_images ADD COLUMN IF NOT EXISTS display_url TEXT;
```

- [ ] **Step 4: Thread `display_url` through the Postgres repository**

In `go-server/internal/repository/postgres.go`, update the four config-image query helpers. Add `display_url` to every column list and `&ci.DisplayURL` to every `Scan`, placing it immediately after the `thumbnail_url` / `&ci.ThumbnailURL` position.

**`CreateConfigImage` (~324-329):**

```go
	err := r.pool.QueryRow(ctx,
		`INSERT INTO config_images (image_key, image_url, thumbnail_url, display_url, image_type, title, description, is_active, display_order)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id, image_key, image_url, thumbnail_url, display_url, image_type, title, description, is_active, display_order, updated_at`,
		data.ImageKey, data.ImageURL, data.ThumbnailURL, data.DisplayURL, data.ImageType, data.Title, data.Description, isActive, displayOrder,
	).Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.DisplayURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt)
```

**`UpdateConfigImage` (~340-348):**

```go
	err := r.pool.QueryRow(ctx,
		`UPDATE config_images
		 SET image_url = $1, thumbnail_url = $2, display_url = $3, image_type = $4, title = $5, description = $6,
		     is_active = COALESCE($7, is_active), display_order = COALESCE($8, display_order),
		     updated_at = NOW()
		 WHERE image_key = $9
		 RETURNING id, image_key, image_url, thumbnail_url, display_url, image_type, title, description, is_active, display_order, updated_at`,
		data.ImageURL, data.ThumbnailURL, data.DisplayURL, data.ImageType, data.Title, data.Description, data.IsActive, data.DisplayOrder, imageKey,
	).Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.DisplayURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt)
```

**`GetConfigImage` (~370-373):**

```go
	err := r.pool.QueryRow(ctx,
		`SELECT id, image_key, image_url, thumbnail_url, display_url, image_type, title, description, is_active, display_order, updated_at
		 FROM config_images WHERE image_key = $1`, imageKey,
	).Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.DisplayURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt)
```

**`GetConfigImagesByType` (~385-397):**

```go
	rows, err := r.pool.Query(ctx,
		`SELECT id, image_key, image_url, thumbnail_url, display_url, image_type, title, description, is_active, display_order, updated_at
		 FROM config_images WHERE image_type = $1 ORDER BY display_order`, imageType)
	// ...
		if err := rows.Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.DisplayURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt); err != nil {
```

**`GetAllConfigImages` (~407-419):**

```go
	rows, err := r.pool.Query(ctx,
		`SELECT id, image_key, image_url, thumbnail_url, display_url, image_type, title, description, is_active, display_order, updated_at
		 FROM config_images ORDER BY display_order`)
	// ...
		if err := rows.Scan(&ci.ID, &ci.ImageKey, &ci.ImageURL, &ci.ThumbnailURL, &ci.DisplayURL, &ci.ImageType, &ci.Title, &ci.Description, &ci.IsActive, &ci.DisplayOrder, &updatedAt); err != nil {
```

- [ ] **Step 5: Thread `DisplayURL` through the memory repository**

In `go-server/internal/repository/memory.go`:

`CreateConfigImage` (~313, in the `models.ConfigImage{...}` literal, after `ThumbnailURL: data.ThumbnailURL,`):

```go
		ThumbnailURL: data.ThumbnailURL,
		DisplayURL:   data.DisplayURL,
```

`UpdateConfigImage` (~336, after `ci.ThumbnailURL = data.ThumbnailURL`):

```go
			ci.ThumbnailURL = data.ThumbnailURL
			ci.DisplayURL = data.DisplayURL
```

- [ ] **Step 6: Verify compile + existing tests pass**

Run: `cd go-server && go build ./... && go test ./internal/repository ./internal/models -count=1`
Expected: builds clean; repository/model tests PASS (the new field is nil-valued and ignored by existing assertions).

Run (frontend type check): `npm run check`
Expected: passes — `ConfigImage` now includes `displayUrl: string | null`.

- [ ] **Step 7: Commit**

```bash
git add shared/schema.ts go-server/internal/models/config_image.go go-server/migrations/002_add_display_url.sql go-server/internal/repository/postgres.go go-server/internal/repository/memory.go
git commit -m "feat(config-image): add display_url column and thread through model/repo/schema

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Generate the display image on upload (both paths)

Both upload handlers already build a 600px thumbnail for gallery images. Add an analogous 1600px display block right after each thumbnail block. Failure is non-fatal (log + leave null), exactly like the thumbnail.

**Files:**
- Modify: `go-server/internal/handler/upload.go` (direct path ~208-228, signed-URL path ~351-372)
- Test: `go-server/internal/handler/upload_test.go`

- [ ] **Step 1: Write the failing test**

Add to `go-server/internal/handler/upload_test.go`. (This mirrors how existing upload tests post a multipart gallery image; reuse the file's existing multipart helper if present — search the file for an existing gallery-upload test and copy its request setup. The assertion below is the new behavior.)

```go
func TestUploadConfigImage_GeneratesDisplayURL(t *testing.T) {
	env := newUploadTestEnv(t) // use this file's existing test-env constructor
	cookie, csrf := env.adminSession(t)

	// 1x1 px PNG is fine; OptimizeImage will pass it through without enlarging.
	body, contentType := multipartGalleryImage(t, "gallery_test", tinyPNG())

	rec := env.postMultipart(t, "/api/admin/config-images", body, contentType, cookie, csrf)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		Image models.ConfigImage `json:"image"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Image.DisplayURL == nil || *resp.Image.DisplayURL == "" {
		t.Fatalf("expected displayUrl to be set for gallery upload, got %v", resp.Image.DisplayURL)
	}
	if !strings.Contains(*resp.Image.DisplayURL, "-display.jpg") {
		t.Errorf("displayUrl = %q, want it to contain -display.jpg", *resp.Image.DisplayURL)
	}
}
```

> If `newUploadTestEnv`, `adminSession`, `multipartGalleryImage`, `postMultipart`, or `tinyPNG` are named differently in `upload_test.go`, use the actual existing helpers — do not invent new ones. The only genuinely new assertion is on `DisplayURL`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd go-server && go test ./internal/handler -run TestUploadConfigImage_GeneratesDisplayURL -v`
Expected: FAIL — `displayUrl` is nil because the handler doesn't generate it yet.

- [ ] **Step 3: Add the display block to the direct upload path**

In `go-server/internal/handler/upload.go`, in the direct multipart handler, right after the thumbnail block closes (after line ~222, before `isActive := true`):

```go
	// Generate display-size image (~1600px) for gallery detail view
	var displayURL *string
	if imageType == "gallery" {
		opt, err := service.OptimizeImage(data, 1600, 80)
		if err == nil {
			displayName := service.GenerateDisplayFilename(uniqueName)
			dispURL, err := h.Storage.Upload(r.Context(), bytes.NewReader(opt.ThumbnailBuffer), int64(len(opt.ThumbnailBuffer)), displayName, opt.ThumbnailContentType, "admin/gallery/display")
			if err == nil {
				displayURL = &dispURL
				slog.Debug("Generated display image", "url", dispURL)
			} else {
				slog.Warn("Display image upload failed, proceeding without it", "error", err)
			}
		} else {
			slog.Warn("Display image generation failed, proceeding without it", "error", err)
		}
	}
```

Then add `DisplayURL: displayURL,` to the `insertData := models.InsertConfigImage{...}` literal (after `ThumbnailURL: thumbnailURL,`):

```go
		ThumbnailURL: thumbnailURL,
		DisplayURL:   displayURL,
```

- [ ] **Step 4: Add the display block to the signed-URL path**

In the signed-URL notify handler, the original bytes are already read into `data` for thumbnailing inside the `else` branch (~353). Add the display block right after the thumbnail block, **inside that same `else` branch** (so it reuses the downloaded `data`), before the block closes at ~371:

```go
		var displayURL *string
		opt2, err := service.OptimizeImage(data, 1600, 80)
		if err == nil {
			base := req.StoragePath[strings.LastIndex(req.StoragePath, "/")+1:]
			displayName := service.GenerateDisplayFilename(base)
			dispURL, err := h.Storage.Upload(r.Context(), bytes.NewReader(opt2.ThumbnailBuffer), int64(len(opt2.ThumbnailBuffer)), displayName, opt2.ThumbnailContentType, "admin/gallery/display")
			if err == nil {
				displayURL = &dispURL
				slog.Debug("Generated display image", "url", dispURL)
			} else {
				slog.Warn("Display image upload failed, proceeding without it", "error", err)
			}
		} else {
			slog.Warn("Display image generation failed, proceeding without it", "error", err)
		}
```

> **Scope note:** `displayURL` here is declared inside the `else` branch but is consumed by `insertData` after the branch. Hoist its declaration: declare `var displayURL *string` next to `var thumbnailURL *string` at the top of the gallery block (~351), and inside the `else` branch assign to it (use `displayURL = &dispURL`, not a new `var`). Then add `DisplayURL: displayURL,` to this path's `insertData` literal after `ThumbnailURL: thumbnailURL,`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd go-server && go test ./internal/handler -run TestUploadConfigImage_GeneratesDisplayURL -v`
Expected: PASS.

- [ ] **Step 6: Run the full handler suite (no regressions)**

Run: `cd go-server && go test ./internal/handler -count=1`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd go-server && git add internal/handler/upload.go internal/handler/upload_test.go
git commit -m "feat(upload): generate 1600px display image for gallery uploads

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Contract test for `displayUrl`

**Files:**
- Modify: `go-server/internal/handler/contract_test.go:343-355`

- [ ] **Step 1: Add the assertion to the contract helper**

In `assertConfigImageObject` (~348), after the `thumbnailUrl` line:

```go
	assertNullableType(t, obj, "thumbnailUrl", "string")
	assertNullableType(t, obj, "displayUrl", "string")
```

- [ ] **Step 2: Run the contract tests**

Run: `cd go-server && go test ./internal/handler -run TestContract -v`
Expected: PASS — every config-image response now also carries a `displayUrl` key (null or string).

- [ ] **Step 3: Commit**

```bash
cd go-server && git add internal/handler/contract_test.go
git commit -m "test(contract): assert displayUrl on config image responses

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Backfill command for existing gallery images

A standalone, idempotent Go command. It re-uses production config (`DATABASE_URL`, Supabase vars). Run once after deploy.

**Files:**
- Create: `go-server/cmd/backfill-display/main.go`

- [ ] **Step 1: Write the command**

Create `go-server/cmd/backfill-display/main.go`:

```go
// Command backfill-display generates a ~1600px "display" image for every gallery
// config image that does not yet have one, and records its URL in display_url.
// Idempotent: rows with a non-null display_url are skipped, so it is safe to re-run.
//
// Usage (from go-server/, with prod env loaded):
//   DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... SUPABASE_BUCKET_ID=... \
//     go run ./cmd/backfill-display
package main

import (
	"bytes"
	"context"
	"log"

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
	} else {
		storage = service.NewLocalStorage("./storage")
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
		if idx := lastSlash(objectPath); idx >= 0 {
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

func lastSlash(s string) int {
	for i := len(s) - 1; i >= 0; i-- {
		if s[i] == '/' {
			return i
		}
	}
	return -1
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd go-server && go build ./cmd/backfill-display`
Expected: builds clean, produces no errors.

- [ ] **Step 3: Smoke-run against local/dev (optional, non-fatal)**

Run (no DATABASE_URL → expected to exit cleanly with a fatal message, proving wiring):
`cd go-server && go run ./cmd/backfill-display` 
Expected: logs `DATABASE_URL is required` and exits. (Running against a real DB is a deploy-time step, documented in the command header.)

- [ ] **Step 4: Commit**

```bash
cd go-server && git add cmd/backfill-display/main.go
git commit -m "feat(cmd): add backfill-display command for existing gallery images

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — use display image in the detail viewer, preload ±1

**Files:**
- Modify: `client/src/components/GallerySection.tsx` (mapping ~154-160, preload ~190-196, blur condition ~356, detail img ~366-368)
- Modify: `client/src/components/__tests__/GallerySection.test.tsx` (mock data ~62-66, preload tests ~184-228)

- [ ] **Step 1: Update the mock data and rewrite the preload tests (failing first)**

In `client/src/components/__tests__/GallerySection.test.tsx`, add a `displayUrl` to each `MOCK_GALLERY_IMAGES_WITH_THUMBS` row (~62-66). Example for row 1 — apply the same pattern to rows 2–5:

```ts
  { id: 1, imageUrl: "/storage/gallery/img1.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb1.jpg", displayUrl: "/storage/gallery/display/disp1.jpg", title: "Photo 1", description: "", category: "gallery", displayOrder: 1 },
  { id: 2, imageUrl: "/storage/gallery/img2.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb2.jpg", displayUrl: "/storage/gallery/display/disp2.jpg", title: "Photo 2", description: "", category: "gallery", displayOrder: 2 },
  { id: 3, imageUrl: "/storage/gallery/img3.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb3.jpg", displayUrl: "/storage/gallery/display/disp3.jpg", title: "Photo 3", description: "", category: "gallery", displayOrder: 3 },
  { id: 4, imageUrl: "/storage/gallery/img4.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb4.jpg", displayUrl: "/storage/gallery/display/disp4.jpg", title: "Photo 4", description: "", category: "gallery", displayOrder: 4 },
  { id: 5, imageUrl: "/storage/gallery/img5.jpg", thumbnailUrl: "/storage/gallery/thumbnails/thumb5.jpg", displayUrl: "/storage/gallery/display/disp5.jpg", title: "Photo 5", description: "", category: "gallery", displayOrder: 5 },
```

Replace the `"preloads ±2 neighbor full-size images when fullscreen opens"` test (~184-204) with a ±1 display-URL version:

```ts
  it("preloads only ±1 neighbor display images when fullscreen opens", () => {
    const preloadedSrcs: string[] = [];
    class MockImage {
      set src(val: string) { preloadedSrcs.push(val); }
      get src() { return ""; }
    }
    vi.stubGlobal("Image", MockImage);

    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    // Open fullscreen at index 2 (middle)
    const carouselItem = screen.getByTestId("gallery-image-2");
    fireEvent.click(carouselItem.querySelector(".cursor-pointer")!);

    // Only immediate neighbors (indices 1 and 3) and only their DISPLAY images.
    expect(preloadedSrcs).toContain("/storage/gallery/display/disp2.jpg"); // index 1
    expect(preloadedSrcs).toContain("/storage/gallery/display/disp4.jpg"); // index 3
    // ±2 neighbors must NOT be preloaded:
    expect(preloadedSrcs).not.toContain("/storage/gallery/display/disp1.jpg"); // index 0
    expect(preloadedSrcs).not.toContain("/storage/gallery/display/disp5.jpg"); // index 4
    // Originals must NOT be preloaded:
    expect(preloadedSrcs).not.toContain("/storage/gallery/img2.jpg");
  });
```

Replace the `"wraps correctly when fullscreen opens at index 0"` test (~206-228) with:

```ts
  it("preloads ±1 display images with wraparound at index 0", () => {
    const preloadedSrcs: string[] = [];
    class MockImage {
      set src(val: string) { preloadedSrcs.push(val); }
      get src() { return ""; }
    }
    vi.stubGlobal("Image", MockImage);

    renderGallerySection(MOCK_GALLERY_IMAGES_WITH_THUMBS);

    const carouselItem = screen.getByTestId("gallery-image-0");
    fireEvent.click(carouselItem.querySelector(".cursor-pointer")!);

    // Neighbors of index 0: -1 → index 4 (disp5), +1 → index 1 (disp2)
    expect(preloadedSrcs).toContain("/storage/gallery/display/disp5.jpg");
    expect(preloadedSrcs).toContain("/storage/gallery/display/disp2.jpg");
    expect(preloadedSrcs).not.toContain("/storage/gallery/display/disp3.jpg"); // index 2 (±2)
    expect(preloadedSrcs).not.toContain("/storage/gallery/display/disp4.jpg"); // index 3 (±2)
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- GallerySection`
Expected: FAIL — the component still preloads `img*.jpg` originals at ±2, not `disp*.jpg` at ±1.

- [ ] **Step 3: Add `display` to the gallery mapping**

In `GallerySection.tsx`, in the `galleryImages` mapping (~154-160), add a `display` field:

```tsx
  const galleryImages = galleryData?.images && galleryData.images.length > 0
    ? galleryData.images.map(img => ({
      src: img.imageUrl,
      thumbnail: (img as any).thumbnailUrl || img.imageUrl,
      display: (img as any).displayUrl || img.imageUrl,
      alt: img.title || img.description || "Gallery image"
    }))
    : GALLERY_PHOTOS.map(p => ({ ...p, thumbnail: p.src, display: p.src }));
```

- [ ] **Step 4: Preload ±1 display images**

Replace the neighbor preload effect (~190-196):

```tsx
  // Preload ±1 neighbor DISPLAY images when fullscreen opens or navigates.
  useEffect(() => {
    if (selectedImageIndex === null || galleryImages.length === 0) return;
    const neighborIndices = new Set(
      [-1, 1].map((offset) => (selectedImageIndex + offset + galleryImages.length) % galleryImages.length)
    );
    neighborIndices.forEach((idx) => preloadImage(galleryImages[idx].display));
  }, [selectedImageIndex, galleryImages, preloadImage]);
```

- [ ] **Step 5: Point the detail image and blur condition at `display`**

In the fullscreen viewer, change the blur-placeholder condition (~356) to compare thumbnail against `display`, and set the main image `src` to `display` (~368):

```tsx
                  {galleryImages[selectedImageIndex].thumbnail !== galleryImages[selectedImageIndex].display && (
                    <img
                      src={galleryImages[selectedImageIndex].thumbnail}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ filter: "blur(20px)", transform: "scale(1.05)" }}
                      data-testid="blur-placeholder"
                    />
                  )}
                  <img
                    key={selectedImageIndex}
                    src={galleryImages[selectedImageIndex].display}
                    alt={galleryImages[selectedImageIndex].alt}
                    className="relative max-w-[calc(100vw-80px)] max-h-[calc(100vh-80px)] md:max-w-[calc(100vw-120px)] md:max-h-[calc(100vh-120px)] w-auto h-auto object-contain transition-opacity duration-300"
                    style={{ opacity: isFullSizeLoaded ? 1 : 0 }}
                    onLoad={() => setIsFullSizeLoaded(true)}
                    onError={() => setIsFullSizeLoaded(true)}
                    data-testid="fullsize-image"
                  />
```

- [ ] **Step 6: Run the gallery tests to verify they pass**

Run: `npm run test -- GallerySection`
Expected: PASS — including the rewritten ±1 preload tests and the existing blur-up tests. (The `"does not render blur placeholder when thumbnail and src are the same URL"` test uses `MOCK_GALLERY_IMAGES` with no thumbnailUrl/displayUrl, so thumbnail === display === imageUrl and no blur renders — still correct under the new condition.)

- [ ] **Step 7: Type check**

Run: `npm run check`
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add client/src/components/GallerySection.tsx client/src/components/__tests__/GallerySection.test.tsx
git commit -m "perf(gallery): serve display-size image in detail view, preload only ±1

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Full verification

- [ ] **Step 1: Backend suite with race detector**

Run: `cd go-server && make test`
Expected: all packages PASS with `-race`.

- [ ] **Step 2: Backend lint**

Run: `cd go-server && make lint`
Expected: no findings.

- [ ] **Step 3: Frontend full test + type check + build**

Run (from repo root): `npm run test && npm run check && npm run build`
Expected: all green; build emits to `dist/public`.

- [ ] **Step 4: Manual byte-size verification (closes the spec's open assumption)**

Build and run the dev stack, upload one representative ~1MB gallery photo via the admin UI, then open it in the home-page detail viewer with the browser network tab open. Confirm:
- the request for the detail image is the `-display.jpg` URL, not the original;
- its transferred size is materially smaller than the original (target ≤ ~300KB — record the actual number);
- opening a photo preloads exactly two `-display.jpg` neighbors (not four originals).

Record the measured display size in `go-server/issuesResolution.md` along with the symptom/root-cause/resolution (per repo convention for resolved issues).

- [ ] **Step 5: Deploy-time note (not a code step)**

After deploying, run the migration (`make migrate`) and then the backfill once: `go run ./cmd/backfill-display` with prod env. Existing photos serve the original until backfilled (correct, just not yet cheaper).

---

## Notes for the implementer

- **`OptimizedImage` struct field names** (`ThumbnailBuffer`, `ThumbnailContentType`) are generic byte/content-type carriers — reusing them for the display image is intentional, not a copy-paste error. Do not rename them.
- **Mirror the thumbnail, don't improve on it.** `display_url` is overwritten (not COALESCE-preserved) on update, exactly like `thumbnail_url`, because the upload handlers always regenerate both. Keep them symmetric.
- **Egress success is measured in bytes, not request count.** After this change the network tab still shows ~3 requests on open — that is expected and not a regression (see spec).
- **1600px/q80 is the single quality knob** and assumes a mobile-first audience. If desktop sharpness is a complaint, raising the width in the three call sites (`upload.go` ×2, `backfill-display/main.go`) plus re-running the backfill is the lever.
