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
