# Issues Resolution Log

## Issue 1: Server Crashes on Startup Without PostgreSQL/Redis

**Date:** 2026-03-16

**Symptom:**
Running `GO_ENV=development go run ./cmd/server` crashes immediately:
```
level=ERROR msg="Failed to connect to database" error="failed to ping database: ...connect: connection refused"
exit status 1
```

**Root Cause:**
`.env.development` had `DATABASE_URL` and `REDIS_URL` hardcoded to `localhost:5432` and `localhost:6379`.
When these values are set, `main.go` attempts to connect and calls `os.Exit(1)` on failure — even in
development mode where in-memory fallbacks should be used instead.

**Resolution:**
1. **`go-server/cmd/server/main.go`** — In development mode, failed DB/Redis connections now log a
   warning and fall back to in-memory implementations instead of crashing. Production mode retains
   the hard `os.Exit(1)` since a missing database is a real problem.
2. **`go-server/.env.development`** — Commented out `DATABASE_URL` and `REDIS_URL` so the default
   dev experience requires zero external dependencies.
3. **`go-server/.env.example`** — Added comments explaining the fallback behavior.

---

## Issue 2: Port 5000 Conflict with macOS AirPlay Receiver

**Date:** 2026-03-16

**Symptom:**
After fixing Issue 1, the server still fails to start:
```
level=ERROR msg="Server failed to start" error="listen tcp :5000: bind: address already in use"
```

**Root Cause:**
On macOS Monterey and later, the AirPlay Receiver service (`ControlCenter.app`) binds to port 5000
by default. The dev config used `PORT=5000`, causing a conflict.

**Resolution:**
Changed the default development port from `5000` to `8080` in `go-server/.env.development`.
Alternative: users can disable AirPlay Receiver in System Settings → General → AirDrop & Handoff.

---

## Issue 3: Express Frontend Server Port 5000 Conflict on macOS

**Date:** 2026-03-16

**Symptom:**
Running `npm run dev` (which runs `tsx server/index.ts`) crashes with `EADDRINUSE` or `ENOTSUP`:
```
Error: listen EADDRINUSE: address already in use :::5000
```
The `reusePort: true` option also causes `ENOTSUP` on macOS.

**Root Cause:**
`server/index.ts` had port `5000` hardcoded and used `reusePort: true` (a Replit-specific option unsupported on macOS). The `.env` files documented an `EXPRESS_PORT` variable but the code never read it. macOS AirPlay Receiver occupies port 5000 by default.

**Resolution:**
1. **`server/index.ts`** — Replaced hardcoded port `5000` with `process.env.EXPRESS_PORT || "3000"`. Removed `reusePort: true` which caused `ENOTSUP` on macOS.
2. Default port is now `3000`, configurable via `EXPRESS_PORT` env var.

---

## Issue 4: Missing @dnd-kit Dependencies Cause Vite Resolution Errors

**Date:** 2026-03-16

**Symptom:**
After fixing Issue 3, `npm run dev` starts on port 3000 but Vite fails to resolve three `@dnd-kit` packages:
```
@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
```
These are imported by `ImageManager.tsx` for drag-and-drop image reordering.

**Root Cause:**
The packages are listed in `package.json` (dependencies) but were never installed — `node_modules/@dnd-kit/` was empty. This happens after a fresh clone or when `node_modules` is cleaned without re-running `npm install`.

**Resolution:**
Ran `npm install` to install all dependencies from `package.json` + `package-lock.json`, populating the missing `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` packages.

---

## Issue 6: Production Deploys Not Visible — CloudFront CDN Cache

**Date:** 2026-05-10

**Symptom:**
Frontend changes deployed to production (Docker rebuild + `docker compose up -d`) were not visible to any users — desktop browser hard refresh, incognito window, and mobile all showed the old website. The Go server and Docker container had the correct new code confirmed via `grep` inside the running container.

**Root Cause:**
The production URL `https://d3uvailo5cuieu.cloudfront.net/` goes through AWS CloudFront. CloudFront cached the old `index.html` and JS assets at its edge nodes. After a Docker redeploy, CloudFront continued serving the cached old content to all clients — bypassing the origin server entirely — until its cache TTL expired.

**Resolution:**
1. **Immediate fix:** Invalidate the CloudFront cache via AWS Console → CloudFront → Invalidations → `/*`, or via CLI: `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"`. Changes became visible immediately after invalidation.
2. **`deploy.sh`** — Added automatic CloudFront cache invalidation at the end of every deploy. Reads `CLOUDFRONT_DISTRIBUTION_ID` from `.env.production`. Safe to omit (skipped with a warning if the variable is unset).
3. **`go-server/internal/router/router.go`** — Added `Cache-Control: no-cache, no-store, must-revalidate` response header for `index.html` and SPA fallback responses. Hashed Vite assets are unaffected. Prevents browsers and CDNs from caching the HTML entry point.

**Key diagnostic steps that identified the root cause:**
- `grep "Color To Avoid" /app/dist/public/assets/*.js` inside the container confirmed new code WAS deployed.
- `curl -si http://127.0.0.1:5000/` confirmed the origin server was serving the correct content.
- The production URL domain `d3uvailo5cuieu.cloudfront.net` identified CloudFront as the intermediary.

---

## Issue 7: CloudFront WAF 403 on Admin Gallery Image Upload

**Date:** 2026-05-11

**Symptom:**
Admin users received a raw CloudFront-generated 403 HTML error page when uploading gallery images in production. The upload request (`POST /api/admin/config-images-upload`) never reached the Go backend — the response body was CloudFront's own HTML, not the server's JSON error format. Admin login (POST `/api/auth/login`) worked fine.

**Root Cause:**
AWS WAF is attached to the CloudFront distribution in front of the production server. The `SizeRestrictions_BODY` managed rule (AWSManagedRulesCommonRuleSet) blocks POST bodies larger than ~8 KB. Image uploads (multipart/form-data, up to 10 MB) far exceeded this limit. Login requests (~100 bytes JSON body) passed because they were well under the threshold.

Key diagnostic signals:
- The 403 response was HTML, not JSON — Go never serves HTML 403s, so the request was blocked at the edge.
- Login (small JSON body) succeeded; upload (large binary body) failed — the discriminating factor was body size/type, not HTTP method or auth.

**Resolution:**
Replaced the single-step multipart upload with a 3-step signed URL flow that bypasses the WAF entirely:

1. **Get signed URL** (`POST /api/admin/upload/signed-url`) — client sends a small JSON payload (~50 bytes) to the Go backend. Go calls Supabase Storage to obtain a pre-signed PUT URL and returns it with a `storagePath` to the client.
2. **Direct PUT to Supabase** — client uploads the binary file directly to Supabase Storage using the signed URL. This request goes to `*.supabase.co` — it never passes through CloudFront at all.
3. **Complete upload** (`POST /api/admin/upload/complete`) — client sends another small JSON payload with `storagePath`, `imageKey`, `imageType`, and metadata. Go validates the path, generates a thumbnail (for gallery images), and upserts the `config_images` record.

**Files changed:**
- `go-server/internal/service/storage.go` — Added `CreateSignedUploadURL` to `ObjectStorage` interface; exported `AdminImageDirectory` helper; added `LocalStorage` stub returning a descriptive error.
- `go-server/internal/service/storage_supabase.go` — Implemented `SupabaseStorage.CreateSignedUploadURL` calling `POST /storage/v1/object/upload/sign/{bucket}/{path}` and extracting the `url` field from the response.
- `go-server/internal/handler/upload.go` — Added `GetSignedUploadURL` and `CompleteConfigImageUpload` handlers; added `validImageKeyRE` regex (`^[a-zA-Z0-9_-]+$`) applied to all three upload endpoints to prevent path traversal.
- `go-server/internal/router/router.go` — Registered the two new admin routes under the `WithStorage` guard.
- `client/src/components/ImageUploadModal.tsx` — Replaced single `fileMutation` multipart POST with the 3-step flow.

**Bugs caught during implementation (not in original plan):**
1. **Wrong Supabase endpoint**: plan had `/storage/v1/object/sign/upload/{bucket}/{path}`; correct path is `/storage/v1/object/upload/sign/{bucket}/{path}`.
2. **Wrong response field**: plan decoded a `token` field; Supabase actually returns `{"url": "/object/upload/sign/...?token=..."}`. The full URL is reconstructed as `baseURL + "/storage/v1" + result.URL`.
3. **`storagePath` not validated against `imageType`**: a client could pass a `storagePath` pointing to a different imageType's directory. Fixed with a `strings.HasPrefix` check against `AdminImageDirectory(imageType)`.
4. **Extension derived from filename, not MIME type**: the frontend compresses all images to JPEG before upload, but kept the original filename extension (e.g., `.png`). Fixed by deriving the extension from `file.type`.

---

## Issue 8: GET /api/drive-folder-contents Returns 500 in Production

**Date:** 2026-05-11

**Symptom:**
The new `/gallery` page rendered an error state in production:
```json
{ "error": { "code": "INTERNAL_ERROR", "message": "Failed to fetch folder contents" } }
```
The `GET /api/drive-folder-contents` endpoint returned HTTP 500. Photo uploads via `POST /api/upload-to-drive` continued working.

**Root Cause:**
`NewGoogleDriveService` in `go-server/internal/service/googledrive.go` initialized the OAuth2 config with `drive.DriveFileScope` ("https://www.googleapis.com/auth/drive.file"). This scope only allows access to files the application itself created. `GetFolderContents` calls `srv.Files.List().Q("'folderID' in parents")` to list ALL files in the wedding folder — including files uploaded directly to Drive by other means — which requires the broader `drive.DriveScope` ("https://www.googleapis.com/auth/drive"). Google's API returned a 403 Forbidden, which propagated as a 500 to the client.

The upload endpoint worked because `Files.Create` is allowed under `drive.DriveFileScope` for creating new files.

**Resolution:**
Changed scope in `go-server/internal/service/googledrive.go`:
```go
// Before
Scopes: []string{drive.DriveFileScope},
// After
Scopes: []string{drive.DriveScope},
```

**Required production action:** The existing `GOOGLE_REFRESH_TOKEN` in production was issued under the old `drive.DriveFileScope` scope — it will not automatically gain the new scope. Re-authorization is required:
1. Visit `GET /api/google-auth-url` on the production server to get a new consent URL
2. Complete the OAuth flow — the callback page displays the new `GOOGLE_REFRESH_TOKEN`
3. Update `GOOGLE_REFRESH_TOKEN` in the production environment and redeploy

---

## Issue 5: 403 on PATCH /api/admin/feature-flags (CSRF token loss)

**Date:** 2026-03-16

**Symptom:**
PATCH requests to `/api/admin/feature-flags/{key}` return 403 Forbidden after Docker hot-reload or when opening admin in a new browser tab. Auth passes (valid session), but CSRF middleware rejects the request.

**Root Cause:**
CSRF tokens are stored in Go process memory (`CSRFStore.tokens` map), while sessions persist in Redis. Two scenarios cause token loss:
1. **Docker hot-reload**: Go container restarts, clearing in-memory CSRF tokens, but Redis sessions survive. Auth passes, CSRF fails → 403.
2. **New browser tab**: `admin_session` cookie persists across tabs, but `sessionStorage` (client-side CSRF token) is per-tab. New tab has no CSRF token → 403.

The `POST /api/admin/validate` endpoint could recover the token, but it was itself behind CSRF protection — a chicken-and-egg problem.

**Resolution:**
1. **`go-server/internal/router/router.go`** — Moved `/api/admin/validate` out of the CSRF-protected group. It now requires only auth middleware (not CSRF), enabling token recovery.
2. **`go-server/internal/handler/auth.go`** — Updated `Validate` to return the existing CSRF token or generate a new one if missing (server restart recovery). Reuses existing tokens to prevent multi-tab invalidation.
3. **`go-server/internal/handler/contract_test.go`** — Updated validate contract to include `csrfToken` field.
4. **`client/src/pages/AdminDashboard.tsx`** — Added `useEffect` on mount to call validate and refresh `sessionStorage` CSRF token. Updated `handleAutoLogout` to also catch 403 errors.
