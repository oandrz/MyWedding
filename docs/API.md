# API Reference

All endpoints are served by the Go backend (Chi router). JSON request/response bodies use **camelCase** field names.

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check with optional database connectivity status |

## Public Endpoints

### RSVP

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/rsvp` | No | Submit or update an RSVP |
| GET | `/api/rsvp` | No | List all RSVPs with stats |
| GET | `/api/rsvp/check` | No | Check if an RSVP exists |
| GET | `/api/rsvp/{email}` | No | Get RSVP by email address |

### Messages

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/messages` | No | Post a guest message |
| GET | `/api/messages` | No | List all messages (paginated) |

### Media

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/media` | No | Submit a media item for approval |
| GET | `/api/media` | No | List approved media items |

### Configuration (cached, 60 s)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config-images` | No | List all config images |
| GET | `/api/config-images/{type}` | No | List config images by type |
| GET | `/api/feature-flags` | No | List all feature flags |
| GET | `/api/feature-flags/{featureKey}` | No | Get a single feature flag |
| GET | `/api/app-settings` | No | List all app settings |
| GET | `/api/settings/music` | No | Get music setting |
| GET | `/api/settings/{settingKey}` | No | Get a single app setting |
| GET | `/api/welcome-screen` | No | Get welcome screen content |

### File Upload (requires storage)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/upload` | No | Upload a file to object storage |
| GET | `/storage/*` | No | Serve an uploaded file |

### Google Drive (requires Drive config)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/google-auth-url` | No | Get Google OAuth authorization URL |
| GET | `/auth/google/callback` | No | Google OAuth callback |
| POST | `/api/upload-to-drive` | No | Upload a file to Google Drive |
| GET | `/api/drive-folder-contents` | No | List contents of the Drive folder |

## Authenticated Endpoints (require auth + CSRF)

These routes require a valid session and a CSRF token header.

### Resource Deletion

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| DELETE | `/api/rsvp/{id}` | Auth + CSRF | Delete an RSVP |
| DELETE | `/api/messages/{id}` | Auth + CSRF | Delete a message |

## Admin Endpoints (`/api/admin`)

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/login` | No (rate-limited) | Admin login (5 attempts/min/IP) |
| POST | `/api/admin/validate` | Auth only | Validate session and recover CSRF token |
| POST | `/api/admin/logout` | Auth + CSRF | Admin logout |

### Media Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/media` | Auth + CSRF | List all media (including unapproved) |
| PATCH | `/api/admin/media/{id}` | Auth + CSRF | Approve or reject a media item |

### Config Images

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/config-images` | Auth + CSRF | Create a config image entry |
| PUT | `/api/admin/config-images/{imageKey}` | Auth + CSRF | Update a config image |
| PUT | `/api/admin/config-images-reorder` | Auth + CSRF | Reorder config images |
| DELETE | `/api/admin/config-images/{imageKey}` | Auth + CSRF | Delete a config image |

### Admin Uploads (requires storage)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/config-images-upload` | Auth + CSRF | Upload a config image file |
| POST | `/api/admin/settings/music-upload` | Auth + CSRF | Upload a music file |

### Feature Flags

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/feature-flags` | Auth + CSRF | Create a feature flag |
| PATCH | `/api/admin/feature-flags/{featureKey}` | Auth + CSRF | Update a feature flag |

### App Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/api/admin/app-settings/bulk` | Auth + CSRF | Bulk update app settings |
| PATCH | `/api/admin/app-settings/{settingKey}` | Auth + CSRF | Update a single app setting |

### Welcome Screen

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/api/admin/welcome-screen` | Auth + CSRF | Update welcome screen content |
