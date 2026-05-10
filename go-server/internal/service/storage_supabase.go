package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// SupabaseStorage implements ObjectStorage using Supabase Storage REST API.
type SupabaseStorage struct {
	httpClient *http.Client
	baseURL    string // e.g., "https://xyz.supabase.co"
	serviceKey string // Supabase service role key
	bucketID   string // e.g., "wedding-files"
	envPrefix  string // "development" or "production" — prepended to all paths
}

// NewSupabaseStorage creates a new Supabase-backed storage with a 30s timeout client.
func NewSupabaseStorage(baseURL, serviceKey, bucketID, envPrefix string) *SupabaseStorage {
	return &SupabaseStorage{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		baseURL:    strings.TrimRight(baseURL, "/"),
		serviceKey: serviceKey,
		bucketID:   bucketID,
		envPrefix:  envPrefix,
	}
}

// NewSupabaseStorageWithClient creates a Supabase storage with an injected HTTP client (for testing).
func NewSupabaseStorageWithClient(client *http.Client, baseURL, serviceKey, bucketID, envPrefix string) *SupabaseStorage {
	return &SupabaseStorage{
		httpClient: client,
		baseURL:    strings.TrimRight(baseURL, "/"),
		serviceKey: serviceKey,
		bucketID:   bucketID,
		envPrefix:  envPrefix,
	}
}

// objectPath prepends the env prefix to the logical path.
func (s *SupabaseStorage) objectPath(logicalPath string) string {
	if s.envPrefix == "" {
		return logicalPath
	}
	return s.envPrefix + "/" + logicalPath
}

// apiURL builds the full Supabase Storage API URL for an object.
func (s *SupabaseStorage) apiURL(objectPath string) string {
	return fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, s.bucketID, objectPath)
}

func (s *SupabaseStorage) Upload(ctx context.Context, data io.Reader, size int64, filename, contentType, directory string) (string, error) {
	logicalPath := directory + "/" + filename
	objPath := s.objectPath(logicalPath)
	url := s.apiURL(objPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, data)
	if err != nil {
		return "", fmt.Errorf("failed to create upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true")
	if size > 0 {
		req.ContentLength = size
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("supabase upload failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase upload returned %d: %s", resp.StatusCode, string(body))
	}

	slog.Debug("File uploaded to Supabase", "path", objPath)
	return "/storage/" + logicalPath, nil
}

func (s *SupabaseStorage) UploadAdminImage(ctx context.Context, data io.Reader, size int64, filename, contentType, imageType string) (string, error) {
	dir := adminImageDirectory(imageType)
	return s.Upload(ctx, data, size, filename, contentType, dir)
}

func (s *SupabaseStorage) CreateSignedUploadURL(ctx context.Context, objectPath string) (string, error) {
	objPath := s.objectPath(objectPath)
	endpoint := fmt.Sprintf("%s/storage/v1/object/sign/upload/%s/%s", s.baseURL, s.bucketID, objPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader("{}"))
	if err != nil {
		return "", fmt.Errorf("failed to create signed URL request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("signed URL request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase sign upload returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode signed URL response: %w", err)
	}
	if result.Token == "" {
		return "", fmt.Errorf("supabase returned empty token for signed upload URL")
	}

	signedURL := fmt.Sprintf("%s/storage/v1/object/upload/sign/%s/%s?token=%s",
		s.baseURL, s.bucketID, objPath, result.Token)
	return signedURL, nil
}

func (s *SupabaseStorage) Download(ctx context.Context, objectPath string, w http.ResponseWriter) error {
	objPath := s.objectPath(objectPath)
	url := s.apiURL(objPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create download request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		http.Error(w, `{"error":"File not found"}`, http.StatusNotFound)
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase download returned %d: %s", resp.StatusCode, string(body))
	}

	if ct := resp.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		w.Header().Set("Content-Length", cl)
	}
	w.Header().Set("Cache-Control", "public, max-age=3600")

	_, err = io.Copy(w, resp.Body)
	return err
}

func (s *SupabaseStorage) DownloadBuffer(ctx context.Context, objectPath string) ([]byte, error) {
	objPath := s.objectPath(objectPath)
	url := s.apiURL(objPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create download request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("supabase download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("object not found: %s", objectPath)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase download returned %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

func (s *SupabaseStorage) Delete(ctx context.Context, objectPath string) error {
	objPath := s.objectPath(objectPath)
	url := s.apiURL(objPath)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supabase delete failed: %w", err)
	}
	defer resp.Body.Close()

	// Graceful on 404
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase delete returned %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (s *SupabaseStorage) ParsePublicURL(publicURL string) string {
	if idx := strings.Index(publicURL, "/storage/"); idx >= 0 {
		return publicURL[idx+len("/storage/"):]
	}
	return ""
}
