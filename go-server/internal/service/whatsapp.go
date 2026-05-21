package service

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"regexp"
	"sync"

	_ "github.com/jackc/pgx/v5/stdlib"
	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
)

// Session status constants.
const (
	StatusConnected    = "connected"
	StatusQRPending    = "qr_pending"
	StatusDisconnected = "disconnected"
)

// SessionInfo is returned by SessionStatus.
type SessionInfo struct {
	Status string `json:"status"`
	Phone  string `json:"phone,omitempty"`
	QR     string `json:"qr,omitempty"`
}

// WAMessage is the pre-rendered payload for one guest sent from the frontend.
type WAMessage struct {
	InviteID int    `json:"inviteId"`
	Phone    string `json:"phone"`
	Side     string `json:"side"` // "groom" or "bride"
	Message  string `json:"message"`
}

// SendJob tracks the state of one bulk send job.
type SendJob struct {
	ID              string
	mu              sync.Mutex
	Status          string // "running", "paused", "completed", "failed"
	Total           int
	Sent            int
	Failed          int
	Skipped         int
	CurrentInviteID int
	GroomTotal      int
	GroomSent       int
	BrideTotal      int
	BrideSent       int
	ctx             context.Context
	cancel          context.CancelFunc
	pauseCh         chan struct{} // capacity 1; write signals pause
	resumeCh        chan struct{} // unbuffered; write signals resume
}

func (j *SendJob) setStatus(s string) {
	j.mu.Lock()
	j.Status = s
	j.mu.Unlock()
}

func (j *SendJob) getStatus() string {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.Status
}

// Snapshot returns a safe copy of job state for JSON serialization.
func (j *SendJob) Snapshot() map[string]interface{} {
	j.mu.Lock()
	defer j.mu.Unlock()
	return map[string]interface{}{
		"id":              j.ID,
		"status":          j.Status,
		"total":           j.Total,
		"sent":            j.Sent,
		"failed":          j.Failed,
		"skipped":         j.Skipped,
		"currentInviteId": j.CurrentInviteID,
		"groom":           map[string]int{"total": j.GroomTotal, "sent": j.GroomSent},
		"bride":           map[string]int{"total": j.BrideTotal, "sent": j.BrideSent},
	}
}

// WhatsAppServicer is the interface consumed by the HTTP handler.
type WhatsAppServicer interface {
	SessionStatus(side string) SessionInfo
	Connect(ctx context.Context, side string) error
	Disconnect(side string) error
	StartSendJob(msgs []WAMessage, delayMin, delayMax int) (string, error)
	ActiveJob() *SendJob
	GetJob(jobID string) *SendJob
	PauseJob(jobID string) error
	ResumeJob(jobID string) error
	AbortJob(jobID string) error
	SendOne(ctx context.Context, inviteID int, message string) error
}

// WhatsAppService implements WhatsAppServicer.
type WhatsAppService struct {
	repo repository.Repository

	mu          sync.Mutex
	groomClient *whatsmeow.Client
	brideClient *whatsmeow.Client
	groomQR     string
	brideQR     string

	store *sqlstore.Container
	jobs  sync.Map // jobID → *SendJob
}

// NewWhatsAppService creates the service. Call Init() after construction.
func NewWhatsAppService(repo repository.Repository) *WhatsAppService {
	return &WhatsAppService{repo: repo}
}

// Init connects to Postgres via whatsmeow sqlstore and restores persisted sessions.
func (s *WhatsAppService) Init(ctx context.Context, databaseURL string) error {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return fmt.Errorf("whatsapp sqlstore open: %w", err)
	}

	container := sqlstore.NewWithDB(db, "postgres", nil)
	s.store = container

	// Try to restore sessions from stored JIDs in app_settings.
	for _, side := range []string{"groom", "bride"} {
		key := "wa_" + side + "_jid"
		setting, _ := s.repo.GetAppSetting(ctx, key)
		if setting == nil {
			continue
		}
		jid, err := types.ParseJID(setting.SettingValue)
		if err != nil {
			continue
		}
		deviceStore, err := container.GetDevice(ctx, jid)
		if err != nil || deviceStore == nil {
			continue
		}
		client := whatsmeow.NewClient(deviceStore, nil)
		if err := client.Connect(); err == nil {
			s.setClient(side, client)
		}
	}
	return nil
}

func (s *WhatsAppService) setClient(side string, c *whatsmeow.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		s.groomClient = c
	} else {
		s.brideClient = c
	}
}

func (s *WhatsAppService) clientFor(side string) *whatsmeow.Client {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		return s.groomClient
	}
	return s.brideClient
}

func (s *WhatsAppService) setQR(side, qr string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		s.groomQR = qr
	} else {
		s.brideQR = qr
	}
}

func (s *WhatsAppService) getQR(side string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if side == "groom" {
		return s.groomQR
	}
	return s.brideQR
}

// SessionStatus returns the current connection state for one side.
func (s *WhatsAppService) SessionStatus(side string) SessionInfo {
	client := s.clientFor(side)
	if client != nil && client.IsConnected() && client.IsLoggedIn() {
		phone := "+" + client.Store.ID.User
		return SessionInfo{Status: StatusConnected, Phone: phone}
	}
	if qr := s.getQR(side); qr != "" {
		return SessionInfo{Status: StatusQRPending, QR: qr}
	}
	return SessionInfo{Status: StatusDisconnected}
}

// Connect initiates QR code generation for the given side.
func (s *WhatsAppService) Connect(ctx context.Context, side string) error {
	if s.store == nil {
		return fmt.Errorf("whatsapp service not initialised")
	}
	client := s.clientFor(side)
	if client == nil {
		deviceStore := s.store.NewDevice()
		client = whatsmeow.NewClient(deviceStore, nil)
		s.setClient(side, client)
	}
	if client.IsConnected() && client.IsLoggedIn() {
		return nil
	}

	qrChan, err := client.GetQRChannel(ctx)
	if err != nil {
		return fmt.Errorf("GetQRChannel: %w", err)
	}

	go func() {
		for evt := range qrChan {
			switch evt.Event {
			case "code":
				png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
				if err == nil {
					b64 := base64.StdEncoding.EncodeToString(png)
					s.setQR(side, "data:image/png;base64,"+b64)
				}
			case "success":
				s.setQR(side, "")
				if client.Store.ID != nil {
					jid := client.Store.ID.String()
					key := "wa_" + side + "_jid"
					s.repo.UpsertAppSettings(context.Background(), []models.InsertAppSetting{{
						SettingKey:   key,
						SettingValue: jid,
						SettingType:  "string",
					}})
				}
			case "timeout":
				s.setQR(side, "")
			}
		}
	}()

	return client.Connect()
}

// Disconnect logs out and clears the stored session for a side.
func (s *WhatsAppService) Disconnect(side string) error {
	client := s.clientFor(side)
	if client == nil {
		return nil
	}
	if client.IsLoggedIn() {
		client.Logout(context.Background()) //nolint:errcheck
	}
	client.Disconnect()
	s.setClient(side, nil)
	s.setQR(side, "")
	return nil
}

// phoneToJID converts an E.164 phone number to a WhatsApp JID string.
var nonDigit = regexp.MustCompile(`[^\d]`)

func phoneToJID(phone string) string {
	digits := nonDigit.ReplaceAllString(phone, "")
	return digits + "@s.whatsapp.net"
}

// StartSendJob, runJob, ActiveJob, GetJob, PauseJob, ResumeJob, AbortJob, SendOne
// are implemented in Task 5. Stub them here to satisfy the interface:

func (s *WhatsAppService) StartSendJob(_ []WAMessage, _, _ int) (string, error) {
	return "", fmt.Errorf("not implemented")
}

func (s *WhatsAppService) ActiveJob() *SendJob { return nil }

func (s *WhatsAppService) GetJob(_ string) *SendJob { return nil }

func (s *WhatsAppService) PauseJob(_ string) error { return fmt.Errorf("not implemented") }

func (s *WhatsAppService) ResumeJob(_ string) error { return fmt.Errorf("not implemented") }

func (s *WhatsAppService) AbortJob(_ string) error { return fmt.Errorf("not implemented") }

func (s *WhatsAppService) SendOne(_ context.Context, _ int, _ string) error {
	return fmt.Errorf("not implemented")
}

// Ensure WhatsAppService implements WhatsAppServicer at compile time.
var _ WhatsAppServicer = (*WhatsAppService)(nil)
