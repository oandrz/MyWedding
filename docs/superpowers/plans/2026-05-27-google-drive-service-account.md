# Google Drive Service Account Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the expiring OAuth2 user token with a Google Service Account so the gallery never breaks due to token expiration.

**Architecture:** The `GoogleDriveService` struct is simplified to a single `httpClient *http.Client` built from service account credentials at startup. All Drive API calls are unchanged — only the authentication layer swaps out. The OAuth2 init path in `main.go`, three routes, and three handler methods are removed as dead code.

**Tech Stack:** Go, `golang.org/x/oauth2/google` (service account credentials), `google.golang.org/api/drive/v3`, Docker Compose on EC2.

---

## File Map

| File | Change |
|------|--------|
| `go-server/internal/config/config.go` | Remove 3 Google OAuth fields, add `GoogleServiceAccountJSON` |
| `go-server/internal/service/googledrive.go` | Replace struct + constructor + auth; remove OAuth2 methods |
| `go-server/internal/service/googledrive_test.go` | Create — tests for new constructor |
| `go-server/internal/handler/googledrive.go` | Remove `GetAuthURL`, `AuthCallback`, `UploadToDrive` |
| `go-server/internal/router/router.go` | Remove 3 routes (`/api/google-auth-url`, `/auth/google/callback`, `/api/upload-to-drive`) |
| `go-server/cmd/server/main.go` | Replace Drive initialization block |
| `go-server/docker-compose.prod.yml` | Swap env vars |
| `go-server/.env.development` | Swap env vars |

---

### Task 1: Update config to add service account field

**Files:**
- Modify: `go-server/internal/config/config.go`

- [ ] **Step 1: Remove OAuth2 fields and add service account field**

In `config.go`, replace:
```go
GoogleClientID     string
GoogleSecret       string
GoogleRefresh      string
```
with:
```go
GoogleServiceAccountJSON string
```

- [ ] **Step 2: Update Load() to read the new env var**

In the `cfg := &Config{...}` block, remove:
```go
GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
GoogleSecret:       getEnv("GOOGLE_CLIENT_SECRET", ""),
GoogleRefresh:      getEnv("GOOGLE_REFRESH_TOKEN", ""),
```
Add:
```go
GoogleServiceAccountJSON: getEnv("GOOGLE_SERVICE_ACCOUNT_JSON", ""),
```

- [ ] **Step 3: Verify the file compiles**

```bash
cd go-server && go build ./internal/config/...
```
Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add go-server/internal/config/config.go
git commit -m "refactor: replace OAuth2 config fields with service account JSON field"
```

---

### Task 2: Write failing tests for the new service constructor

**Files:**
- Create: `go-server/internal/service/googledrive_test.go`

- [ ] **Step 1: Create the test file**

```go
package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"testing"
)

func validServiceAccountJSON(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	raw, _ := json.Marshal(map[string]string{
		"type":         "service_account",
		"project_id":   "test-project",
		"private_key_id": "key-id",
		"private_key":  string(keyPEM),
		"client_email": "test@test-project.iam.gserviceaccount.com",
		"client_id":    "123456789",
		"auth_uri":     "https://accounts.google.com/o/oauth2/auth",
		"token_uri":    "https://oauth2.googleapis.com/token",
	})
	return base64.StdEncoding.EncodeToString(raw)
}

func TestNewGoogleDriveServiceFromServiceAccount(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{
			name:    "empty input returns error",
			input:   "",
			wantErr: true,
		},
		{
			name:    "invalid base64 returns error",
			input:   "not-valid-base64!!!",
			wantErr: true,
		},
		{
			name:    "valid base64 but invalid JSON returns error",
			input:   base64.StdEncoding.EncodeToString([]byte("not json")),
			wantErr: true,
		},
		{
			name:    "valid service account JSON returns service",
			input:   validServiceAccountJSON(t),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc, err := NewGoogleDriveServiceFromServiceAccount(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if svc == nil {
				t.Fatal("expected non-nil service")
			}
			if svc.httpClient == nil {
				t.Fatal("expected non-nil httpClient")
			}
			if svc.folderID == "" {
				t.Fatal("expected non-empty folderID")
			}
		})
	}
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd go-server && go test ./internal/service/... -run TestNewGoogleDriveServiceFromServiceAccount -v
```
Expected: FAIL — `NewGoogleDriveServiceFromServiceAccount` is undefined.

---

### Task 3: Refactor service/googledrive.go

**Files:**
- Modify: `go-server/internal/service/googledrive.go`

- [ ] **Step 1: Replace the struct and imports**

Replace the entire file with:

```go
package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"sync"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

const weddingFolderID = "1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC"

var sizePattern = regexp.MustCompile(`=s\d+$`)

// GoogleDriveService handles Google Drive read operations.
type GoogleDriveService struct {
	httpClient *http.Client
	folderID   string
	thumbLinks sync.Map // fileID → thumbnailLink string
}

// NewGoogleDriveServiceFromServiceAccount creates a Drive service from a base64-encoded service account JSON key.
func NewGoogleDriveServiceFromServiceAccount(saJSONBase64 string) (*GoogleDriveService, error) {
	if saJSONBase64 == "" {
		return nil, fmt.Errorf("service account JSON is empty")
	}
	saJSON, err := base64.StdEncoding.DecodeString(saJSONBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode service account JSON: %w", err)
	}
	creds, err := google.CredentialsFromJSON(context.Background(), saJSON, drive.DriveReadonlyScope)
	if err != nil {
		return nil, fmt.Errorf("failed to parse service account credentials: %w", err)
	}
	slog.Info("Google Drive service initialized with service account")
	return &GoogleDriveService{
		httpClient: oauth2.NewClient(context.Background(), creds.TokenSource),
		folderID:   weddingFolderID,
	}, nil
}

func (s *GoogleDriveService) driveService(ctx context.Context) (*drive.Service, error) {
	return drive.NewService(ctx, option.WithHTTPClient(s.httpClient))
}

// GetFolderContents lists files in the wedding folder and caches thumbnail links.
func (s *GoogleDriveService) GetFolderContents(ctx context.Context) ([]*drive.File, error) {
	srv, err := s.driveService(ctx)
	if err != nil {
		return nil, err
	}

	q := fmt.Sprintf("'%s' in parents and trashed = false", s.folderID)
	res, err := srv.Files.List().
		Q(q).
		Fields("files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)").
		OrderBy("createdTime desc").
		Do()
	if err != nil {
		return nil, fmt.Errorf("drive list failed: %w", err)
	}

	current := make(map[string]struct{}, len(res.Files))
	for _, f := range res.Files {
		current[f.Id] = struct{}{}
		if f.ThumbnailLink != "" {
			s.thumbLinks.Store(f.Id, f.ThumbnailLink)
		}
	}
	s.thumbLinks.Range(func(key, _ any) bool {
		if _, ok := current[key.(string)]; !ok {
			s.thumbLinks.Delete(key)
		}
		return true
	})

	return res.Files, nil
}

// GetThumbnailReader fetches a file's thumbnail and returns a reader for the image bytes.
func (s *GoogleDriveService) GetThumbnailReader(ctx context.Context, fileID, size string) (io.ReadCloser, string, error) {
	var thumbLink string
	if v, ok := s.thumbLinks.Load(fileID); ok {
		thumbLink = v.(string)
	} else {
		srv, err := s.driveService(ctx)
		if err != nil {
			return nil, "", err
		}
		f, err := srv.Files.Get(fileID).Fields("thumbnailLink").Do()
		if err != nil {
			return nil, "", fmt.Errorf("failed to get thumbnail link: %w", err)
		}
		if f.ThumbnailLink == "" {
			return nil, "", fmt.Errorf("no thumbnail available for file %s", fileID)
		}
		thumbLink = f.ThumbnailLink
		s.thumbLinks.Store(fileID, thumbLink)
	}

	px := strings.TrimPrefix(size, "w")
	if px == "" {
		px = "800"
	}
	url := sizePattern.ReplaceAllString(thumbLink, "=s"+px)

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, "", fmt.Errorf("thumbnail fetch failed: %w", err)
	}
	if resp.StatusCode != 200 {
		resp.Body.Close()
		return nil, "", fmt.Errorf("thumbnail fetch returned %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}
	return resp.Body, ct, nil
}

// DetectMediaTypeFromMIME returns "image" or "video" based on MIME type.
func DetectMediaTypeFromMIME(mimeType string) string {
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	return "image"
}

// keep bytes import used only in removed UploadFile — suppress unused import error
var _ = bytes.NewReader
```

Wait — `bytes` is no longer needed since `UploadFile` is removed. Use this version instead (no `bytes` import):

```go
package service

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"sync"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

const weddingFolderID = "1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC"

var sizePattern = regexp.MustCompile(`=s\d+$`)

// GoogleDriveService handles Google Drive read operations.
type GoogleDriveService struct {
	httpClient *http.Client
	folderID   string
	thumbLinks sync.Map // fileID → thumbnailLink string
}

// NewGoogleDriveServiceFromServiceAccount creates a Drive service from a base64-encoded service account JSON key.
func NewGoogleDriveServiceFromServiceAccount(saJSONBase64 string) (*GoogleDriveService, error) {
	if saJSONBase64 == "" {
		return nil, fmt.Errorf("service account JSON is empty")
	}
	saJSON, err := base64.StdEncoding.DecodeString(saJSONBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode service account JSON: %w", err)
	}
	creds, err := google.CredentialsFromJSON(context.Background(), saJSON, drive.DriveReadonlyScope)
	if err != nil {
		return nil, fmt.Errorf("failed to parse service account credentials: %w", err)
	}
	slog.Info("Google Drive service initialized with service account")
	return &GoogleDriveService{
		httpClient: oauth2.NewClient(context.Background(), creds.TokenSource),
		folderID:   weddingFolderID,
	}, nil
}

func (s *GoogleDriveService) driveService(ctx context.Context) (*drive.Service, error) {
	return drive.NewService(ctx, option.WithHTTPClient(s.httpClient))
}

// GetFolderContents lists files in the wedding folder and caches thumbnail links.
func (s *GoogleDriveService) GetFolderContents(ctx context.Context) ([]*drive.File, error) {
	srv, err := s.driveService(ctx)
	if err != nil {
		return nil, err
	}

	q := fmt.Sprintf("'%s' in parents and trashed = false", s.folderID)
	res, err := srv.Files.List().
		Q(q).
		Fields("files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)").
		OrderBy("createdTime desc").
		Do()
	if err != nil {
		return nil, fmt.Errorf("drive list failed: %w", err)
	}

	current := make(map[string]struct{}, len(res.Files))
	for _, f := range res.Files {
		current[f.Id] = struct{}{}
		if f.ThumbnailLink != "" {
			s.thumbLinks.Store(f.Id, f.ThumbnailLink)
		}
	}
	s.thumbLinks.Range(func(key, _ any) bool {
		if _, ok := current[key.(string)]; !ok {
			s.thumbLinks.Delete(key)
		}
		return true
	})

	return res.Files, nil
}

// GetThumbnailReader fetches a file's thumbnail and returns a reader for the image bytes.
func (s *GoogleDriveService) GetThumbnailReader(ctx context.Context, fileID, size string) (io.ReadCloser, string, error) {
	var thumbLink string
	if v, ok := s.thumbLinks.Load(fileID); ok {
		thumbLink = v.(string)
	} else {
		srv, err := s.driveService(ctx)
		if err != nil {
			return nil, "", err
		}
		f, err := srv.Files.Get(fileID).Fields("thumbnailLink").Do()
		if err != nil {
			return nil, "", fmt.Errorf("failed to get thumbnail link: %w", err)
		}
		if f.ThumbnailLink == "" {
			return nil, "", fmt.Errorf("no thumbnail available for file %s", fileID)
		}
		thumbLink = f.ThumbnailLink
		s.thumbLinks.Store(fileID, thumbLink)
	}

	px := strings.TrimPrefix(size, "w")
	if px == "" {
		px = "800"
	}
	url := sizePattern.ReplaceAllString(thumbLink, "=s"+px)

	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, "", fmt.Errorf("thumbnail fetch failed: %w", err)
	}
	if resp.StatusCode != 200 {
		resp.Body.Close()
		return nil, "", fmt.Errorf("thumbnail fetch returned %d", resp.StatusCode)
	}

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}
	return resp.Body, ct, nil
}

// DetectMediaTypeFromMIME returns "image" or "video" based on MIME type.
func DetectMediaTypeFromMIME(mimeType string) string {
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	return "image"
}
```

- [ ] **Step 2: Run the service tests**

```bash
cd go-server && go test ./internal/service/... -run TestNewGoogleDriveServiceFromServiceAccount -v -race
```
Expected: all 4 cases PASS.

- [ ] **Step 3: Verify the package compiles**

```bash
cd go-server && go build ./internal/service/...
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add go-server/internal/service/googledrive.go go-server/internal/service/googledrive_test.go
git commit -m "feat: replace OAuth2 with service account auth in GoogleDriveService"
```

---

### Task 4: Remove dead routes from router.go

**Files:**
- Modify: `go-server/internal/router/router.go`

> **Order matters:** Update the router BEFORE trimming the handler struct. The router references `GoogleDriveHandler` — removing `Repo` from the router first ensures each step compiles.

- [ ] **Step 1: Update the Drive routes block**

Find this block (around line 118):
```go
// Google Drive routes (if configured)
if o.drive != nil {
    gdrive := &handler.GoogleDriveHandler{
        Repo:  repo,
        Drive: o.drive,
    }
    r.Get("/api/google-auth-url", gdrive.GetAuthURL)
    r.Get("/auth/google/callback", gdrive.AuthCallback)
    r.Post("/api/upload-to-drive", gdrive.UploadToDrive)
    r.Get("/api/drive-folder-contents", gdrive.GetDriveFolderContents)
    r.Get("/api/drive-thumbnail", gdrive.GetThumbnail)
}
```

Replace with:
```go
// Google Drive routes (if configured)
if o.drive != nil {
    gdrive := &handler.GoogleDriveHandler{
        Drive: o.drive,
    }
    r.Get("/api/drive-folder-contents", gdrive.GetDriveFolderContents)
    r.Get("/api/drive-thumbnail", gdrive.GetThumbnail)
}
```

- [ ] **Step 2: Compile**

```bash
cd go-server && go build ./internal/router/...
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/router/router.go
git commit -m "refactor: remove OAuth2 and upload routes from router"
```

---

### Task 5: Trim handler/googledrive.go

**Files:**
- Modify: `go-server/internal/handler/googledrive.go`

- [ ] **Step 1: Remove GetAuthURL, AuthCallback, UploadToDrive, and Repo field**

Replace the entire file with:

```go
package handler

import (
	"io"
	"log/slog"
	"net/http"

	"github.com/andreasronaldo/wedding-server/internal/service"
)

// GoogleDriveHandler handles Google Drive integration endpoints.
type GoogleDriveHandler struct {
	Drive *service.GoogleDriveService
}

// GetDriveFolderContents handles GET /api/drive-folder-contents.
func (h *GoogleDriveHandler) GetDriveFolderContents(w http.ResponseWriter, r *http.Request) {
	files, err := h.Drive.GetFolderContents(r.Context())
	if err != nil {
		slog.Error("Error fetching Drive contents", "error", err)
		writeError(w, r, http.StatusInternalServerError, "Failed to fetch folder contents")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"files": files})
}

// GetThumbnail proxies a Drive file thumbnail through the server so guest
// browsers don't need Google authentication.
// GET /api/drive-thumbnail?id={fileID}&sz=w800
func (h *GoogleDriveHandler) GetThumbnail(w http.ResponseWriter, r *http.Request) {
	fileID := r.URL.Query().Get("id")
	if fileID == "" {
		writeError(w, r, http.StatusBadRequest, "id parameter required")
		return
	}
	size := r.URL.Query().Get("sz")
	if size == "" {
		size = "w800"
	}

	body, contentType, err := h.Drive.GetThumbnailReader(r.Context(), fileID, size)
	if err != nil {
		slog.Error("Thumbnail proxy failed", "fileID", fileID, "error", err)
		http.Error(w, "thumbnail unavailable", http.StatusBadGateway)
		return
	}
	defer body.Close()

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	io.Copy(w, body)
}
```

- [ ] **Step 2: Compile to catch errors**

```bash
cd go-server && go build ./internal/handler/...
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add go-server/internal/handler/googledrive.go
git commit -m "refactor: remove OAuth2 and upload handler methods from GoogleDriveHandler"
```

---

### Task 6: Update main.go Drive initialization

**Files:**
- Modify: `go-server/cmd/server/main.go`

- [ ] **Step 1: Replace the Google Drive block**

Find this block (around line 98):
```go
// Google Drive integration
if cfg.GoogleClientID != "" && cfg.GoogleSecret != "" {
    redirectURI := os.Getenv("GOOGLE_REDIRECT_URI")

    // Env var takes precedence; fall back to token persisted in DB after OAuth
    refreshToken := cfg.GoogleRefresh
    if refreshToken == "" {
        if setting, err := repo.GetAppSetting(ctx, "google_refresh_token"); err == nil && setting != nil {
            refreshToken = setting.SettingValue
            slog.Info("Loaded Google refresh token from database")
        }
    }

    gdrive := service.NewGoogleDriveService(
        cfg.GoogleClientID, cfg.GoogleSecret, redirectURI, refreshToken,
    )
    routerOpts = append(routerOpts, router.WithGoogleDrive(gdrive))
    slog.Info("Google Drive integration enabled")
}
```

Replace with:
```go
// Google Drive integration (service account)
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

- [ ] **Step 2: Remove unused os.Getenv import if no other uses**

Check if `os.Getenv` is still used elsewhere in main.go:
```bash
grep "os.Getenv" go-server/cmd/server/main.go
```
If no other uses exist, the `"os"` import is still needed for `os.Exit` and `os.Stdout` — leave it.

- [ ] **Step 3: Compile the full binary**

```bash
cd go-server && go build ./cmd/server/...
```
Expected: no output.

- [ ] **Step 4: Run the full test suite**

```bash
cd go-server && go test ./... -race -count=1
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add go-server/cmd/server/main.go
git commit -m "refactor: replace OAuth2 Drive init with service account in main.go"
```

---

### Task 7: Update environment files

**Files:**
- Modify: `go-server/docker-compose.prod.yml`
- Modify: `go-server/.env.development`

- [ ] **Step 1: Update docker-compose.prod.yml**

In the `app` service `environment:` block, remove:
```yaml
- GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
- GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
- GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH_TOKEN}
```

Add:
```yaml
- GOOGLE_SERVICE_ACCOUNT_JSON=${GOOGLE_SERVICE_ACCOUNT_JSON}
```

Also remove (if present):
```yaml
- GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
```

- [ ] **Step 2: Update .env.development**

Remove:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=
```

Add (empty — Drive is optional in dev):
```
GOOGLE_SERVICE_ACCOUNT_JSON=
```

- [ ] **Step 3: Commit**

```bash
git add go-server/docker-compose.prod.yml go-server/.env.development
git commit -m "chore: update env vars for service account migration"
```

---

### Task 8: Production deployment

These are manual steps on EC2 — not code changes.

- [ ] **Step 1: Create the service account (Google Cloud Console)**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → your project
2. IAM & Admin → Service Accounts → **Create Service Account**
3. Name: `wedding-gallery-reader`, Description: `Read-only access to wedding gallery Drive folder`
4. Skip "Grant this service account access to project" (no project roles needed)
5. Click Done

- [ ] **Step 2: Create a JSON key**

1. Click the new service account → **Keys** tab → **Add Key** → **Create new key** → **JSON**
2. Save the downloaded `.json` file (e.g., `wedding-gallery-reader.json`)

- [ ] **Step 3: Share the Drive folder with the service account**

1. Open Google Drive → find your wedding gallery folder
2. Right-click → Share → add the service account email (looks like `wedding-gallery-reader@<project>.iam.gserviceaccount.com`)
3. Set role to **Viewer**

- [ ] **Step 4: Base64-encode the key on your Mac**

```bash
base64 -i wedding-gallery-reader.json | tr -d '\n'
```
Copy the output.

- [ ] **Step 5: Set the env var on EC2**

SSH into EC2, then add to your production `.env` file:
```bash
echo 'GOOGLE_SERVICE_ACCOUNT_JSON=<paste-base64-string-here>' >> /path/to/project/.env
```

Remove the old vars if they're in the `.env` file:
```bash
sed -i '/^GOOGLE_CLIENT_ID=/d' /path/to/project/.env
sed -i '/^GOOGLE_CLIENT_SECRET=/d' /path/to/project/.env
sed -i '/^GOOGLE_REFRESH_TOKEN=/d' /path/to/project/.env
```

- [ ] **Step 6: Deploy**

```bash
docker compose -f go-server/docker-compose.prod.yml up -d --build
```

- [ ] **Step 7: Verify startup log**

```bash
docker compose -f go-server/docker-compose.prod.yml logs app 2>&1 | grep "Google Drive"
```
Expected:
```
"Google Drive service initialized with service account"
"Google Drive integration enabled (service account)"
```

- [ ] **Step 8: Smoke test**

Open `https://d3uvailo5cuieu.cloudfront.net/gallery` — images should load without errors.

```bash
curl -s https://d3uvailo5cuieu.cloudfront.net/api/drive-folder-contents | jq '.files | length'
```
Expected: a number ≥ 0 (not an error response).
