package service

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"log/slog"
	"math/rand"
	"regexp"
	"strings"
	"sync"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	"github.com/andreasronaldo/wedding-server/internal/models"
	"github.com/andreasronaldo/wedding-server/internal/repository"
)

// waLogAdapter bridges slog to the whatsmeow Logger interface.
type waLogAdapter struct{ sub string }

func (l waLogAdapter) Debugf(msg string, args ...interface{}) {
	slog.Debug(fmt.Sprintf(msg, args...), "wa", l.sub)
}
func (l waLogAdapter) Infof(msg string, args ...interface{}) {
	slog.Info(fmt.Sprintf(msg, args...), "wa", l.sub)
}
func (l waLogAdapter) Warnf(msg string, args ...interface{}) {
	slog.Warn(fmt.Sprintf(msg, args...), "wa", l.sub)
}
func (l waLogAdapter) Errorf(msg string, args ...interface{}) {
	slog.Error(fmt.Sprintf(msg, args...), "wa", l.sub)
}
func (l waLogAdapter) Sub(module string) waLog.Logger {
	return waLogAdapter{sub: l.sub + "/" + module}
}

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

const defaultWATemplate = "Hi {name}, you're invited to our wedding! RSVP here: {link}"

// renderWATemplate substitutes {name}, {code}, and {link} in the template.
func renderWATemplate(tmpl, name, code, baseURL string) string {
	link := baseURL + "/?code=" + code
	msg := strings.ReplaceAll(tmpl, "{name}", name)
	msg = strings.ReplaceAll(msg, "{code}", code)
	msg = strings.ReplaceAll(msg, "{link}", link)
	return msg
}

// BuildAndStartSendJob fetches the saved template, renders a message per invite,
// filters ineligible invites, then starts the bulk-send job.
func (s *WhatsAppService) BuildAndStartSendJob(ctx context.Context, inviteIDs []int, baseURL string, delayMin, delayMax int) (string, error) {
	tmpl := defaultWATemplate
	if setting, err := s.repo.GetAppSetting(ctx, "wa_message_template"); err == nil && setting != nil && setting.SettingValue != "" {
		tmpl = setting.SettingValue
	}

	var msgs []WAMessage
	for _, id := range inviteIDs {
		inv, err := s.repo.GetInviteByID(ctx, id)
		if err != nil || inv == nil {
			continue
		}
		if inv.Phone == nil || inv.Side == nil || inv.WaSentAt != nil {
			continue
		}
		msgs = append(msgs, WAMessage{
			InviteID: inv.ID,
			Phone:    *inv.Phone,
			Side:     *inv.Side,
			Message:  renderWATemplate(tmpl, inv.Name, inv.Code, baseURL),
		})
	}

	if len(msgs) == 0 {
		return "", fmt.Errorf("no_eligible_invites")
	}

	return s.StartSendJob(msgs, delayMin, delayMax)
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

	container := sqlstore.NewWithDB(db, "postgres", waLogAdapter{sub: "store"})
	// Run whatsmeow's own DB migrations to create/upgrade whatsmeow_* tables.
	if err := container.Upgrade(ctx); err != nil {
		return fmt.Errorf("whatsmeow sqlstore upgrade: %w", err)
	}
	s.store = container

	// Try to restore sessions from stored JIDs in app_settings.
	for _, side := range []string{"groom", "bride"} {
		key := "wa_" + side + "_jid"
		setting, _ := s.repo.GetAppSetting(ctx, key)
		if setting == nil {
			continue
		}
		slog.Info("WA restore attempt", "side", side, "jid", setting.SettingValue)
		jid, err := types.ParseJID(setting.SettingValue)
		if err != nil {
			slog.Warn("WA restore: invalid JID", "side", side, "err", err)
			continue
		}
		deviceStore, err := container.GetDevice(ctx, jid)
		if err != nil || deviceStore == nil {
			slog.Warn("WA restore: no device in store", "side", side, "err", err)
			continue
		}
		client := whatsmeow.NewClient(deviceStore, waLogAdapter{sub: side})
		if err := client.Connect(); err != nil {
			slog.Warn("WA restore: connect failed", "side", side, "err", err)
			continue
		}
		slog.Info("WA restore: success", "side", side)
		s.setClient(side, client)
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
	if client != nil && client.IsConnected() && client.IsLoggedIn() {
		return nil
	}
	// Don't start a new QR flow if one is already in progress.
	if qr := s.getQR(side); qr != "" {
		return nil
	}
	return s.startQRSession(side)
}

// startQRSession disconnects any existing client, creates a fresh device, and begins QR pairing.
// Unlike Connect, this bypasses the "QR already showing" guard, allowing internal auto-refresh.
func (s *WhatsAppService) startQRSession(side string) error {
	if client := s.clientFor(side); client != nil {
		client.Disconnect()
	}

	deviceStore := s.store.NewDevice()
	client := whatsmeow.NewClient(deviceStore, waLogAdapter{sub: side})
	s.setClient(side, client)

	// Log all whatsmeow events for diagnostics (debug level to avoid noise in production).
	client.AddEventHandler(func(evt interface{}) {
		slog.Debug("WA event", "side", side, "type", fmt.Sprintf("%T", evt))
	})

	// Use a cancellable context so the refresh timer can close qrChan directly via
	// emitQRs's ctx.Done() path, without relying on the event-dispatch chain
	// (which closes before events.Disconnected is delivered when Disconnect is called).
	ctx, cancel := context.WithCancel(context.Background())
	qrChan, err := client.GetQRChannel(ctx)
	if err != nil {
		cancel()
		return fmt.Errorf("GetQRChannel: %w", err)
	}
	go s.handleQRLoop(side, client, qrChan, cancel)

	if err := client.Connect(); err != nil {
		cancel()
		slog.Error("WA client.Connect failed", "side", side, "err", err)
		return err
	}
	slog.Info("WA client.Connect returned", "side", side)
	return nil
}

// handleQRLoop processes QR channel events. It arms a 15-second refresh timer on the first
// QR code so we reconnect before WhatsApp's companion_reg_refresh notification (~17s)
// invalidates the refs — a stale ref causes the phone to show no interaction when scanning.
//
// Terminal events (success, pairing errors, phone errors) return early with no reconnect.
// Non-terminal exits (timeout, context cancel from refresh timer) fall through to auto-reconnect.
func (s *WhatsAppService) handleQRLoop(side string, client *whatsmeow.Client, qrChan <-chan whatsmeow.QRChannelItem, cancelSession context.CancelFunc) {
	defer cancelSession()
	defer slog.Info("WA QR goroutine exited", "side", side)

	var (
		refreshTimer *time.Timer
		timerArmed   bool
	)
	defer func() {
		if refreshTimer != nil {
			refreshTimer.Stop()
		}
	}()

	for evt := range qrChan {
		slog.Info("WA QR event", "side", side, "event", evt.Event, "err", evt.Error)
		switch evt.Event {
		case "code":
			png, encErr := qrcode.Encode(evt.Code, qrcode.Medium, 256)
			if encErr == nil {
				b64 := base64.StdEncoding.EncodeToString(png)
				s.setQR(side, "data:image/png;base64,"+b64)
			}
			// Arm once. Cancelling the context closes qrChan via emitQRs's ctx.Done() path,
			// which is reliable — unlike client.Disconnect() which races with the handler queue.
			if !timerArmed {
				timerArmed = true
				refreshTimer = time.AfterFunc(15*time.Second, func() {
					slog.Info("WA QR refresh: cancelling session for fresh refs", "side", side)
					cancelSession()
				})
			}

		case "success":
			if refreshTimer != nil {
				refreshTimer.Stop()
			}
			slog.Info("WA pairing success", "side", side, "hasStoreID", client.Store.ID != nil, "loggedIn", client.IsLoggedIn())
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
			return // success — no auto-reconnect

		case "error":
			if refreshTimer != nil {
				refreshTimer.Stop()
			}
			slog.Error("WA pairing error", "side", side, "err", evt.Error)
			s.setQR(side, "")
			return // permanent error — no auto-reconnect

		case "err-scanned-without-multidevice":
			if refreshTimer != nil {
				refreshTimer.Stop()
			}
			slog.Warn("WA QR scanned but phone does not have multi-device enabled", "side", side)
			s.setQR(side, "")
			return // user must enable multi-device on phone — no auto-reconnect

		case "err-client-outdated":
			if refreshTimer != nil {
				refreshTimer.Stop()
			}
			slog.Error("WA client version rejected by server, update whatsmeow", "side", side)
			s.setQR(side, "")
			return // library update required — no auto-reconnect

		case "err-unexpected-state":
			if refreshTimer != nil {
				refreshTimer.Stop()
			}
			slog.Warn("WA unexpected session state during QR pairing", "side", side)
			s.setQR(side, "")
			return // unexpected state — no auto-reconnect

		case "timeout":
			if refreshTimer != nil {
				refreshTimer.Stop()
			}
			slog.Info("WA QR all refs exhausted (natural timeout)", "side", side)
			s.setQR(side, "")
			// fall through: qrChan is closed, loop exits below → auto-reconnect

		default:
			slog.Warn("WA unhandled qr event", "side", side, "event", evt.Event)
		}
	}

	// qrChan closed: either natural timeout (all refs exhausted) or context cancelled (15s refresh).
	// In both cases reconnect to obtain fresh refs.
	slog.Info("WA QR session ended, starting fresh session", "side", side)
	go func() {
		if err := s.startQRSession(side); err != nil {
			slog.Error("WA QR auto-reconnect failed", "side", side, "err", err)
		}
	}()
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

// StartSendJob enqueues a bulk send. Returns error with "job_already_running:<id>" prefix if active.
func (s *WhatsAppService) StartSendJob(msgs []WAMessage, delayMin, delayMax int) (string, error) {
	if delayMax <= delayMin {
		delayMax = delayMin + 1
	}

	var activeID string
	s.jobs.Range(func(_, v interface{}) bool {
		j := v.(*SendJob)
		st := j.getStatus()
		if st == "running" || st == "paused" {
			activeID = j.ID
			return false
		}
		return true
	})
	if activeID != "" {
		return "", fmt.Errorf("job_already_running:%s", activeID)
	}

	jobID := fmt.Sprintf("%d", time.Now().UnixNano())
	ctx, cancel := context.WithCancel(context.Background())

	groomTotal, brideTotal := 0, 0
	for _, m := range msgs {
		if m.Side == "groom" {
			groomTotal++
		} else if m.Side == "bride" {
			brideTotal++
		}
	}

	job := &SendJob{
		ID:         jobID,
		Status:     "running",
		Total:      len(msgs),
		GroomTotal: groomTotal,
		BrideTotal: brideTotal,
		ctx:        ctx,
		cancel:     cancel,
		pauseCh:    make(chan struct{}, 1),
		resumeCh:   make(chan struct{}, 1),
	}
	s.jobs.Store(jobID, job)

	go s.runJob(job, msgs, delayMin, delayMax)
	return jobID, nil
}

func (s *WhatsAppService) runJob(job *SendJob, msgs []WAMessage, delayMin, delayMax int) {
	defer func() {
		if job.getStatus() == "running" {
			job.setStatus("completed")
		}
	}()

	for _, msg := range msgs {
		select {
		case <-job.ctx.Done():
			job.setStatus("failed")
			return
		default:
		}

		job.mu.Lock()
		job.CurrentInviteID = msg.InviteID
		job.mu.Unlock()

		// Re-check waSentAt to avoid duplicate with per-card send.
		existing, err := s.repo.GetInviteByID(job.ctx, msg.InviteID)
		if err != nil || existing == nil || existing.WaSentAt != nil {
			job.mu.Lock()
			job.Skipped++
			job.mu.Unlock()
			continue
		}

		client := s.clientFor(msg.Side)
		if client == nil || !client.IsConnected() {
			job.mu.Lock()
			job.Failed++
			job.mu.Unlock()
			continue
		}

		jidStr := phoneToJID(msg.Phone)
		jid, err := types.ParseJID(jidStr)
		if err != nil {
			job.mu.Lock()
			job.Skipped++
			job.mu.Unlock()
			continue
		}

		results, err := client.IsOnWhatsApp(job.ctx, []string{jidStr})
		if err != nil {
			slog.Warn("IsOnWhatsApp error, attempting send anyway", "jid", jidStr, "err", err)
		} else if len(results) == 0 || !results[0].IsIn {
			returnedJID := ""
			if len(results) > 0 {
				returnedJID = results[0].JID.String()
			}
			slog.Warn("IsOnWhatsApp not registered, attempting send anyway", "jid", jidStr, "returnedJID", returnedJID)
		}

		_, err = client.SendMessage(job.ctx, jid, &waProto.Message{
			Conversation: proto.String(msg.Message),
		})
		if err != nil {
			// Likely a disconnect — pause the job so admin can reconnect.
			job.setStatus("paused")
			job.mu.Lock()
			job.Failed++
			job.mu.Unlock()
			select {
			case <-job.resumeCh:
				job.setStatus("running")
			case <-job.ctx.Done():
				job.setStatus("failed")
				return
			}
			continue
		}

		s.repo.MarkInviteWaSent(job.ctx, msg.InviteID) //nolint:errcheck

		job.mu.Lock()
		job.Sent++
		if msg.Side == "groom" {
			job.GroomSent++
		} else {
			job.BrideSent++
		}
		job.mu.Unlock()

		// Delay with pause support.
		sleepDur := time.Duration(delayMin+rand.Intn(delayMax-delayMin+1)) * time.Second
		sleepTimer := time.NewTimer(sleepDur)
	sleepLoop:
		for {
			select {
			case <-sleepTimer.C:
				break sleepLoop
			case <-job.pauseCh:
				sleepTimer.Stop()
				job.setStatus("paused")
				select {
				case <-job.resumeCh:
					job.setStatus("running")
					sleepTimer.Reset(sleepDur)
				case <-job.ctx.Done():
					job.setStatus("failed")
					return
				}
			case <-job.ctx.Done():
				sleepTimer.Stop()
				job.setStatus("failed")
				return
			}
		}
	}
}

// ActiveJob returns the first running or paused job, or nil.
func (s *WhatsAppService) ActiveJob() *SendJob {
	var found *SendJob
	s.jobs.Range(func(_, v interface{}) bool {
		j := v.(*SendJob)
		st := j.getStatus()
		if st == "running" || st == "paused" {
			found = j
			return false
		}
		return true
	})
	return found
}

// GetJob returns a job by ID or nil.
func (s *WhatsAppService) GetJob(jobID string) *SendJob {
	v, ok := s.jobs.Load(jobID)
	if !ok {
		return nil
	}
	return v.(*SendJob)
}

// PauseJob signals the goroutine to pause at the next delay boundary.
func (s *WhatsAppService) PauseJob(jobID string) error {
	job := s.GetJob(jobID)
	if job == nil {
		return fmt.Errorf("job not found")
	}
	if job.getStatus() != "running" {
		return fmt.Errorf("job is not running")
	}
	select {
	case job.pauseCh <- struct{}{}:
	default: // already signalled
	}
	return nil
}

// ResumeJob resumes a paused job.
func (s *WhatsAppService) ResumeJob(jobID string) error {
	job := s.GetJob(jobID)
	if job == nil {
		return fmt.Errorf("job not found")
	}
	if job.getStatus() != "paused" {
		return fmt.Errorf("job is not paused")
	}
	select {
	case job.resumeCh <- struct{}{}:
	default:
	}
	return nil
}

// AbortJob cancels a running or paused job.
func (s *WhatsAppService) AbortJob(jobID string) error {
	job := s.GetJob(jobID)
	if job == nil {
		return fmt.Errorf("job not found")
	}
	job.cancel()
	return nil
}

// SendOne sends to a single guest synchronously. Used for per-card retry.
func (s *WhatsAppService) SendOne(ctx context.Context, inviteID int, message string) error {
	invite, err := s.repo.GetInviteByID(ctx, inviteID)
	if err != nil {
		return fmt.Errorf("invite lookup: %w", err)
	}
	if invite == nil {
		return fmt.Errorf("invite not found")
	}
	if invite.Phone == nil {
		return fmt.Errorf("invite has no phone number")
	}
	if invite.Side == nil {
		return fmt.Errorf("invite has no side assigned")
	}

	client := s.clientFor(*invite.Side)
	if client == nil || !client.IsConnected() || !client.IsLoggedIn() {
		return fmt.Errorf("whatsapp session for %s not connected", *invite.Side)
	}

	jidStr := phoneToJID(*invite.Phone)
	jid, err := types.ParseJID(jidStr)
	if err != nil {
		return fmt.Errorf("invalid phone JID: %w", err)
	}

	results, err := client.IsOnWhatsApp(ctx, []string{jidStr})
	if err != nil {
		slog.Warn("IsOnWhatsApp error, attempting send anyway", "jid", jidStr, "err", err)
	} else if len(results) == 0 || !results[0].IsIn {
		returnedJID := ""
		if len(results) > 0 {
			returnedJID = results[0].JID.String()
		}
		slog.Warn("IsOnWhatsApp not registered, attempting send anyway", "jid", jidStr, "returnedJID", returnedJID)
	}

	_, err = client.SendMessage(ctx, jid, &waProto.Message{
		Conversation: proto.String(message),
	})
	if err != nil {
		return fmt.Errorf("send failed: %w", err)
	}

	_, err = s.repo.MarkInviteWaSent(ctx, inviteID)
	return err
}

// Ensure WhatsAppService implements WhatsAppServicer at compile time.
var _ WhatsAppServicer = (*WhatsAppService)(nil)
