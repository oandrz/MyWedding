# Gallery Upload — Supabase Signed URL Design

**Date:** 2026-05-10  
**Status:** Approved

## Problem

Admin gallery image uploads fail in production with a CloudFront 403 "Request blocked" error. The production server sits behind a CloudFront distribution with a built-in WAF whose `SizeRestrictions_BODY` rule blocks request bodies over ~8KB. Image uploads (up to 10MB) trigger this rule before the request reaches the Go backend. Staging does not have this WAF and works fine.

The WAF cannot be configured to add path exceptions through the available dashboard interface, so the fix must move the image binary out of the CloudFront request path entirely.

## Solution

Replace the single multipart upload with a 3-step signed URL flow. Steps 1 and 3 are small JSON requests that pass through CloudFront without issue. Step 2 — the image binary — goes directly from the browser to Supabase Storage, bypassing CloudFront entirely.

## Architecture

```
Step 1  Browser ──POST JSON { imageKey, imageType, filename }──► CloudFront ──► Go
        Go creates signed upload URL via Supabase API
        Go ──{ signedUrl, storagePath }──► Browser

Step 2  Browser ──PUT (image binary)──────────────────────────► Supabase direct
        (bypasses CloudFront — no WAF inspection)
        Supabase ──200 OK──► Browser

Step 3  Browser ──POST JSON { storagePath, metadata }──────────► CloudFront ──► Go
        Go downloads image from Supabase (service key)
        Go generates 600px JPEG thumbnail via existing imageopt.go (gallery only)
        Go uploads thumbnail to Supabase
        Go saves ConfigImage record to DB (upsert by imageKey)
        Go ──{ configImage record }──► Browser
```

Guests are never affected. The thumbnail generation latency (~1–2s) is in the admin upload flow only.

## Backend

### New endpoints (both protected by existing Auth + CSRF middleware)

**`POST /api/admin/upload/signed-url`**

Request:
```json
{ "imageKey": "gallery_1715427890123", "imageType": "gallery", "filename": "photo.jpg" }
```

Behaviour:
- Validates `imageKey` (required), `imageType` (must be one of: banner, gallery, bride-profile, groom-profile, verse-image)
- Generates unique filename: `{imageKey}-{unixMillis}.{ext}` (same format as today)
- Derives storage path: `admin/{imageType}/{uniqueFilename}` (prefixed with env prefix internally)
- Calls `storage.CreateSignedUploadURL(ctx, storagePath)`
- Returns `{ signedUrl, storagePath }` — storagePath is the logical path (no env prefix) stored in DB

Response:
```json
{ "signedUrl": "https://...supabase.co/storage/v1/object/upload/sign/...?token=...", "storagePath": "admin/gallery/gallery_1715427890123-1715427890123.jpg" }
```

**`POST /api/admin/upload/complete`**

Request:
```json
{ "storagePath": "admin/gallery/gallery_1715427890123-1715427890123.jpg", "imageKey": "gallery_1715427890123", "imageType": "gallery", "title": "", "description": "" }
```

Behaviour:
- Downloads the uploaded image from Supabase using the service key
- If `imageType == "gallery"`: runs `service.OptimizeImage(data, 600, 80)` and uploads thumbnail to `admin/gallery/thumbnails/{uniqueName}-thumb.jpg`
- Upserts ConfigImage record (create if new imageKey, update if existing)
- Invalidates cache
- Returns full ConfigImage record

### New storage method

Added to `ObjectStorage` interface and `SupabaseStorage`:

```go
CreateSignedUploadURL(ctx context.Context, objectPath string) (signedUrl string, err error)
```

Calls Supabase Storage REST API to generate a time-limited (2-hour) signed upload URL. The object path is prefixed with the env prefix before calling Supabase.

### Files changed

| File | Change |
|---|---|
| `service/storage.go` | Add `CreateSignedUploadURL` to interface |
| `service/storage_supabase.go` | Implement `CreateSignedUploadURL` (~20 lines) |
| `handler/upload.go` | Add `GetSignedUploadURL` and `CompleteConfigImageUpload` handlers (~80 lines) |
| `router/router.go` | Register 2 new routes under admin group (~4 lines) |
| Handler tests | Table-driven tests for both new endpoints (~80 lines) |

The existing `ConfigImageUpload` handler is not modified or removed.

## Frontend

**Only `client/src/components/ImageUploadModal.tsx` changes.**

The `fileMutation` function is refactored from a single `apiRequest` call to a 3-step sequence:

```typescript
// Step 1 — get signed URL (tiny JSON, passes WAF)
const { signedUrl, storagePath } = await apiRequest('POST', '/api/admin/upload/signed-url', {
  imageKey, imageType, filename: file.name
}).then(r => r.json());

// Step 2 — upload directly to Supabase (bypasses CloudFront)
await fetch(signedUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});

// Step 3 — complete upload: thumbnail + DB save (tiny JSON, passes WAF)
return apiRequest('POST', '/api/admin/upload/complete', {
  storagePath, imageKey, imageType,
  title: data.title || '',
  description: data.description || '',
}).then(r => r.json());
```

Success/error handling, toast messages, and query invalidation are unchanged — they trigger after Step 3.

| File | Change |
|---|---|
| `ImageUploadModal.tsx` | `fileMutation` refactored to 3-step flow (~40 lines changed) |

## Prerequisites

Before deploying, add the production domain to Supabase Storage CORS:

1. Supabase Dashboard → Storage → Configuration → CORS
2. Add allowed origin: `https://yourdomain.com`

Without this, Step 2 (browser PUT to Supabase) will be rejected by the browser's CORS policy.

## What does not change

- `imageopt.go` — no changes
- DB schema — no changes
- `/storage/*` proxy route — no changes (images served the same way)
- `GallerySection`, `ImageGrid`, `useImagePreloader` — no changes
- Previously uploaded images — unaffected, served identically
- Auth and CSRF middleware — no changes (new endpoints go through the same middleware chain)
- `ConfigImageUpload` handler — kept as-is (not removed or called from the new frontend flow; it remains for any direct API consumers or future rollback)

## Testing

1. Enable "monitor mode" in the WAF dashboard temporarily (stops blocking while testing)
2. Upload a gallery image in admin — verify success toast and image appears in gallery
3. Check DB: `imageUrl` and `thumbnailUrl` both populated for gallery uploads
4. Check Supabase Storage: original file at `admin/gallery/`, thumbnail at `admin/gallery/thumbnails/`
5. Visit the guest-facing gallery page — confirm images load at thumbnail size (600px), not full resolution
6. Disable monitor mode — uploads should still succeed (Step 2 bypasses CloudFront)
7. Run `make test` in `go-server/` — all tests pass
