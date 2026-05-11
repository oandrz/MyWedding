package service

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"strings"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

const weddingFolderID = "1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC"

// GoogleDriveService handles Google Drive operations.
type GoogleDriveService struct {
	oauthConfig *oauth2.Config
	token       *oauth2.Token
	folderID    string
}

// NewGoogleDriveService creates a new Drive service.
func NewGoogleDriveService(clientID, clientSecret, redirectURI, refreshToken string) *GoogleDriveService {
	if redirectURI == "" {
		redirectURI = "http://localhost:5000/auth/google/callback"
	}

	cfg := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURI,
		Scopes:       []string{drive.DriveScope},
		Endpoint:     google.Endpoint,
	}

	var token *oauth2.Token
	if refreshToken != "" {
		token = &oauth2.Token{RefreshToken: refreshToken}
		slog.Info("Google Drive service initialized with refresh token")
	} else {
		slog.Info("Google Drive service initialized — OAuth2 setup required")
	}

	return &GoogleDriveService{
		oauthConfig: cfg,
		token:       token,
		folderID:    weddingFolderID,
	}
}

// GetAuthURL returns the OAuth2 authorization URL.
func (s *GoogleDriveService) GetAuthURL() string {
	return s.oauthConfig.AuthCodeURL("state-token", oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "consent"))
}

// HandleAuthCallback exchanges the auth code for tokens.
func (s *GoogleDriveService) HandleAuthCallback(ctx context.Context, code string) (*oauth2.Token, error) {
	token, err := s.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	s.token = token
	return token, nil
}

func (s *GoogleDriveService) driveService(ctx context.Context) (*drive.Service, error) {
	if s.token == nil {
		return nil, fmt.Errorf("no access, refresh token or API key set; please complete OAuth2 authorization first")
	}
	client := s.oauthConfig.Client(ctx, s.token)
	return drive.NewService(ctx, option.WithHTTPClient(client))
}

// UploadFile uploads a file buffer to Google Drive.
func (s *GoogleDriveService) UploadFile(ctx context.Context, data []byte, filename, mimeType, guestName string) (fileID, webViewLink string, err error) {
	srv, err := s.driveService(ctx)
	if err != nil {
		return "", "", err
	}

	name := filename
	if guestName != "" {
		name = guestName + "_" + filename
	}

	f := &drive.File{
		Name:    name,
		Parents: []string{s.folderID},
	}

	res, err := srv.Files.Create(f).
		Media(bytes.NewReader(data)).
		Fields("id,webViewLink").
		Do()
	if err != nil {
		return "", "", fmt.Errorf("drive upload failed: %w", err)
	}

	// Make publicly viewable
	_, permErr := srv.Permissions.Create(res.Id, &drive.Permission{
		Role: "reader",
		Type: "anyone",
	}).Do()
	if permErr != nil {
		slog.Warn("Failed to set public permission", "fileId", res.Id, "error", permErr)
	}

	slog.Info("Uploaded to Google Drive", "file", name, "id", res.Id)
	return res.Id, res.WebViewLink, nil
}

// GetFolderContents lists files in the wedding folder.
func (s *GoogleDriveService) GetFolderContents(ctx context.Context) ([]*drive.File, error) {
	srv, err := s.driveService(ctx)
	if err != nil {
		return nil, err
	}

	q := fmt.Sprintf("'%s' in parents", s.folderID)
	res, err := srv.Files.List().
		Q(q).
		Fields("files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)").
		OrderBy("createdTime desc").
		Do()
	if err != nil {
		return nil, fmt.Errorf("drive list failed: %w", err)
	}

	return res.Files, nil
}

// DetectMediaTypeFromMIME returns "image" or "video" based on MIME type.
func DetectMediaTypeFromMIME(mimeType string) string {
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	return "image"
}
