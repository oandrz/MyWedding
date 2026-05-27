# Google Drive Service Account Migration

**Date:** 2026-05-27
**Status:** Approved

## Problem

The Google Drive integration uses OAuth2 user credentials. The OAuth consent screen is in **Testing mode**, which causes refresh tokens to expire after 7 days. This breaks the `/gallery` page (returns `INTERNAL_ERROR`) every week and requires manual re-authorization to fix.

## Solution

Replace OAuth2 user credentials with a **Google Service Account** — a non-human identity whose credentials never expire and are purpose-built for server-to-server API access.

## Context

The service account is **read-only**:
- `GET /api/drive-folder-contents` — lists files in the shared Drive folder for the gallery
- `GET /api/drive-thumbnail` — proxies thumbnails through the server

Guests do not upload through the backend. The gallery FAB button opens a shared Google Drive link directly in the browser; guests upload via Google's own UI. The backend's `POST /api/upload-to-drive` endpoint is dead code and will be removed.

## Architecture

### `service/googledrive.go`

**Struct — simplified:**

```go
type GoogleDriveService struct {
    httpClient *http.Client  // authenticated, handles token refresh automatically
    folderID   string
    thumbLinks sync.Map
}
```

The `oauthConfig` and `token` fields are removed. `httpClient` is built once at startup from the service account credentials and handles all authentication transparently.

**Constructor — replace OAuth2 with service account:**

```go
func NewGoogleDriveServiceFromServiceAccount(saJSONBase64 string) (*GoogleDriveService, error)
```

- Decodes the base64 string to raw JSON
- Parses credentials via `google.CredentialsFromJSON` with `drive.DriveReadonlyScope`
- Builds `httpClient` via `oauth2.NewClient(context.Background(), creds.TokenSource)`
- Returns the service or an error if the JSON is malformed

**Methods removed:**
- `GetAuthURL` — no longer needed
- `HandleAuthCallback` — no longer needed

**Methods unchanged:**
- `GetFolderContents` — identical, uses `driveService(ctx)` internally
- `GetThumbnailReader` — switches from `s.oauthConfig.Client(ctx, s.token)` to `s.httpClient`
- `DetectMediaTypeFromMIME` — unchanged

**`driveService()` — simplified:**

```go
func (s *GoogleDriveService) driveService(ctx context.Context) (*drive.Service, error) {
    return drive.NewService(ctx, option.WithHTTPClient(s.httpClient))
}
```

### `internal/handler/googledrive.go`

**Handlers removed:**
- `GetAuthURL`
- `AuthCallback`
- `UploadToDrive`

**Handlers unchanged:**
- `GetDriveFolderContents`
- `GetThumbnail`

### `internal/router/router.go`

**Routes removed:**
- `GET /api/google-auth-url`
- `GET /auth/google/callback`
- `POST /api/upload-to-drive`

**Routes unchanged:**
- `GET /api/drive-folder-contents`
- `GET /api/drive-thumbnail`

### `internal/config/config.go`

**Fields removed:** `GoogleClientID`, `GoogleSecret`, `GoogleRefresh`

**Field added:**
```go
GoogleServiceAccountJSON string  // base64-encoded service account key JSON
```

Loaded from env var `GOOGLE_SERVICE_ACCOUNT_JSON`.

### `cmd/server/main.go`

Replace the entire Google Drive initialization block:

```go
if cfg.GoogleServiceAccountJSON != "" {
    gdrive, err := service.NewGoogleDriveServiceFromServiceAccount(cfg.GoogleServiceAccountJSON)
    if err != nil {
        slog.Error("Failed to initialize Google Drive service account", "error", err)
    } else {
        routerOpts = append(routerOpts, router.WithGoogleDrive(gdrive))
        slog.Info("Google Drive integration enabled (service account)")
    }
}
```

### `go-server/docker-compose.prod.yml`

Remove: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

Add:
```yaml
- GOOGLE_SERVICE_ACCOUNT_JSON=${GOOGLE_SERVICE_ACCOUNT_JSON}
```

## One-Time Setup (Google Cloud Console)

1. **Create service account:** IAM & Admin → Service Accounts → Create
   - Name: `wedding-gallery-reader` (or similar)
   - Grant no project roles (access is at folder level, not project level)
2. **Create JSON key:** Service account → Keys → Add Key → JSON → Download
3. **Share the Drive folder** with the service account email (Viewer role is sufficient)
4. **Base64-encode the key** on your local machine:
   ```bash
   base64 -i service-account-key.json | tr -d '\n'
   ```
5. **Add to EC2** — append to your production `.env` file:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON=<base64string>
   ```
6. **Remove old vars** from production `.env`:
   ```
   GOOGLE_CLIENT_ID
   GOOGLE_CLIENT_SECRET
   GOOGLE_REFRESH_TOKEN
   ```

## Deployment

After setting the env var on EC2:
```bash
docker compose -f go-server/docker-compose.prod.yml up -d --build
```

The server logs should show:
```
"Google Drive integration enabled (service account)"
```

## Testing

- Unit tests: mock `*http.Client` in `NewGoogleDriveServiceFromServiceAccount`; verify error returned on malformed JSON
- Integration: hit `GET /api/drive-folder-contents` locally with a real service account key in `GOOGLE_SERVICE_ACCOUNT_JSON` — confirm file list returns
- Production smoke test: access `/gallery` page after deployment

## What Does Not Change

- Gallery frontend (`Gallery.tsx`, `GallerySection.tsx`) — no changes
- `GET /api/drive-folder-contents` and `GET /api/drive-thumbnail` response shapes — unchanged
- Guest upload flow — guests continue to use the FAB → shared Drive link directly
