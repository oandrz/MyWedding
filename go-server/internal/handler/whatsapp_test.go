package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/andreasronaldo/wedding-server/internal/config"
	"github.com/andreasronaldo/wedding-server/internal/middleware"
	"github.com/andreasronaldo/wedding-server/internal/repository"
	"github.com/andreasronaldo/wedding-server/internal/router"
	"github.com/andreasronaldo/wedding-server/internal/service"
	"golang.org/x/crypto/bcrypt"
)

// mockWA is a test double for service.WhatsAppServicer.
type mockWA struct {
	groomStatus service.SessionInfo
	brideStatus service.SessionInfo
	activeJob   *service.SendJob
	jobs        map[string]*service.SendJob
	connectErr  error
	startJobID  string
	startJobErr error
	sendOneErr  error
}

func (m *mockWA) SessionStatus(side string) service.SessionInfo {
	if side == "groom" {
		return m.groomStatus
	}
	return m.brideStatus
}
func (m *mockWA) Connect(_ context.Context, _ string) error { return m.connectErr }
func (m *mockWA) Disconnect(_ string) error                 { return nil }
func (m *mockWA) StartSendJob(_ []service.WAMessage, _, _ int) (string, error) {
	return m.startJobID, m.startJobErr
}
func (m *mockWA) ActiveJob() *service.SendJob { return m.activeJob }
func (m *mockWA) GetJob(id string) *service.SendJob {
	if m.jobs != nil {
		return m.jobs[id]
	}
	return nil
}
func (m *mockWA) PauseJob(_ string) error                          { return nil }
func (m *mockWA) ResumeJob(_ string) error                         { return nil }
func (m *mockWA) AbortJob(_ string) error                          { return nil }
func (m *mockWA) SendOne(_ context.Context, _ int, _ string) error { return m.sendOneErr }

// newTestEnvWithWAService creates a testEnv wired with the given WhatsAppServicer.
func newTestEnvWithWAService(wa service.WhatsAppServicer) *testEnv {
	hash, _ := bcrypt.GenerateFromPassword([]byte("testpass123"), bcrypt.DefaultCost)
	cfg := &config.Config{
		Env:               "development",
		Port:              5000,
		AdminPassword:     "testpass123",
		AdminPasswordHash: string(hash),
		SessionMaxAge:     1800,
		CORSOrigins:       []string{"*"},
	}
	repo := repository.NewMemoryRepository()
	sessions := middleware.NewSessionStore(30 * time.Minute)
	csrf := middleware.NewCSRFStore()
	cache := service.NewCache(5 * time.Minute)
	storage := service.NewLocalStorage(os.TempDir())
	r := router.New(cfg, repo, sessions, csrf, cache,
		router.WithStorage(storage),
		router.WithWhatsApp(wa),
	)
	return &testEnv{handler: r, cfg: cfg, repo: repo, sessions: sessions, csrf: csrf, cache: cache}
}

// TestContract_WA_SessionStatus verifies GET /api/admin/wa/session returns both session statuses.
func TestContract_WA_SessionStatus(t *testing.T) {
	wa := &mockWA{
		groomStatus: service.SessionInfo{Status: "connected", Phone: "+628111111111"},
		brideStatus: service.SessionInfo{Status: "disconnected"},
	}
	env := newTestEnvWithWAService(wa)
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodGet, "/api/admin/wa/session", nil, cookie, csrfToken)
	body := contractResponse(t, env, req, http.StatusOK)

	groom, ok := body["groom"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected groom to be an object, got %T", body["groom"])
	}
	if groom["status"] != "connected" {
		t.Errorf("groom.status = %v, want connected", groom["status"])
	}

	bride, ok := body["bride"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected bride to be an object, got %T", body["bride"])
	}
	if bride["status"] != "disconnected" {
		t.Errorf("bride.status = %v, want disconnected", bride["status"])
	}
}

// TestContract_WA_ActiveJob_None verifies GET /api/admin/wa/job/active returns null when no job.
func TestContract_WA_ActiveJob_None(t *testing.T) {
	wa := &mockWA{}
	env := newTestEnvWithWAService(wa)
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodGet, "/api/admin/wa/job/active", nil, cookie, csrfToken)
	rec := httptest.NewRecorder()
	env.handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	got := strings.TrimSpace(rec.Body.String())
	if got != "null" {
		t.Errorf("expected body null, got %q", got)
	}
}

// TestContract_WA_SendAll_Conflict verifies POST /api/admin/wa/send-all returns 409 with flat error object.
func TestContract_WA_SendAll_Conflict(t *testing.T) {
	wa := &mockWA{
		startJobErr: fmt.Errorf("job_already_running:job-123"),
	}
	env := newTestEnvWithWAService(wa)
	cookie, csrfToken := adminLogin(t, env)

	payload := jsonBody(map[string]interface{}{
		"messages": []interface{}{},
		"delayMin": 5,
		"delayMax": 10,
	})
	req := adminRequest(http.MethodPost, "/api/admin/wa/send-all", payload, cookie, csrfToken)
	body := contractResponse(t, env, req, http.StatusConflict)

	if body["error"] != "job_already_running" {
		t.Errorf("error = %v, want job_already_running", body["error"])
	}
	if body["jobId"] != "job-123" {
		t.Errorf("jobId = %v, want job-123", body["jobId"])
	}
}

// TestContract_WA_GetJob_NotFound verifies GET /api/admin/wa/job/{id} returns 404 for unknown job.
func TestContract_WA_GetJob_NotFound(t *testing.T) {
	wa := &mockWA{}
	env := newTestEnvWithWAService(wa)
	cookie, csrfToken := adminLogin(t, env)

	req := adminRequest(http.MethodGet, "/api/admin/wa/job/nonexistent-id", nil, cookie, csrfToken)
	contractResponse(t, env, req, http.StatusNotFound)
}
