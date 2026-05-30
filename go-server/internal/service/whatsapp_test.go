package service

import (
	"context"
	"testing"

	"github.com/mywedding/platform/internal/models"
	"github.com/mywedding/platform/internal/repository"
)

func TestPhoneToJID(t *testing.T) {
	cases := []struct {
		in  string
		out string
	}{
		{"+6281234567890", "6281234567890@s.whatsapp.net"},
		{"+1-800-555-1234", "18005551234@s.whatsapp.net"},
		{"+44 20 7946 0958", "442079460958@s.whatsapp.net"},
	}
	for _, c := range cases {
		got := phoneToJID(c.in)
		if got != c.out {
			t.Errorf("phoneToJID(%q) = %q, want %q", c.in, got, c.out)
		}
	}
}

func TestSendJob_PauseResume(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	job := &SendJob{
		ID:       "test-job",
		Status:   "running",
		ctx:      ctx,
		cancel:   cancel,
		pauseCh:  make(chan struct{}, 1),
		resumeCh: make(chan struct{}, 1),
	}

	// Signal pause by writing to pauseCh
	job.pauseCh <- struct{}{}
	if len(job.pauseCh) != 1 {
		t.Fatal("expected pauseCh to have 1 item")
	}

	// Signal abort via context cancel
	job.cancel()
	if err := ctx.Err(); err == nil {
		t.Fatal("expected context to be cancelled")
	}
}

func TestSendJob_Snapshot(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	job := &SendJob{
		ID:         "abc123",
		Status:     "running",
		Total:      10,
		Sent:       3,
		GroomTotal: 6,
		GroomSent:  3,
		BrideTotal: 4,
		ctx:        ctx,
		cancel:     cancel,
		pauseCh:    make(chan struct{}, 1),
		resumeCh:   make(chan struct{}, 1),
	}
	snap := job.Snapshot()
	if snap["id"] != "abc123" {
		t.Fatalf("expected id=abc123, got %v", snap["id"])
	}
	if snap["total"].(int) != 10 {
		t.Fatalf("expected total=10, got %v", snap["total"])
	}
	groom := snap["groom"].(map[string]int)
	if groom["sent"] != 3 {
		t.Fatalf("expected groom.sent=3, got %v", groom["sent"])
	}
}

func TestRenderWATemplate(t *testing.T) {
	cases := []struct {
		name    string
		tmpl    string
		guest   string
		code    string
		baseURL string
		want    string
	}{
		{
			name:    "all vars substituted",
			tmpl:    "Hi {name}, RSVP: {link} code={code}",
			guest:   "Alice",
			code:    "abc12",
			baseURL: "https://example.com",
			want:    "Hi Alice, RSVP: https://example.com/?code=abc12 code=abc12",
		},
		{
			name:    "no vars",
			tmpl:    "Plain message",
			guest:   "Bob",
			code:    "xyz99",
			baseURL: "https://example.com",
			want:    "Plain message",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := renderWATemplate(c.tmpl, c.guest, c.code, c.baseURL)
			if got != c.want {
				t.Errorf("got %q, want %q", got, c.want)
			}
		})
	}
}

func TestBuildAndStartSendJob_SkipLogic(t *testing.T) {
	repo := repository.NewMemoryRepository()
	ctx := context.Background()

	phone := "+6281111111111"
	side := "groom"

	// invite 1: eligible
	inv1, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Alice", Phone: &phone, Side: &side})
	// invite 2: no phone
	inv2, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Bob"})
	// invite 3: no side
	inv3, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Carol", Phone: &phone})
	// invite 4: has phone and side but already sent — should be skipped
	inv4, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Dave", Phone: &phone, Side: &side})
	_, _ = repo.MarkInviteWaSent(ctx, inv4.ID)
	// invite 999: doesn't exist (deleted)

	svc := NewWhatsAppService(repo)
	jobID, err := svc.BuildAndStartSendJob(ctx, []int{inv1.ID, inv2.ID, inv3.ID, inv4.ID, 999}, "https://example.com", 0, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if jobID == "" {
		t.Fatal("expected non-empty jobID")
	}

	job := svc.GetJob(jobID)
	if job == nil {
		t.Fatal("job not found")
	}
	snap := job.Snapshot()
	if snap["total"].(int) != 1 {
		t.Errorf("total = %v, want 1 (only Alice is eligible)", snap["total"])
	}
}

func TestBuildAndStartSendJob_DefaultTemplate(t *testing.T) {
	repo := repository.NewMemoryRepository()
	ctx := context.Background()

	phone := "+6281111111111"
	side := "groom"
	inv, _ := repo.CreateInvite(ctx, models.InsertInvite{Name: "Dave", Phone: &phone, Side: &side})

	svc := NewWhatsAppService(repo)
	// No wa_message_template in repo — should use the default
	jobID, err := svc.BuildAndStartSendJob(ctx, []int{inv.ID}, "https://example.com", 0, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	job := svc.GetJob(jobID)
	if job == nil {
		t.Fatal("job not found")
	}
	if snap := job.Snapshot(); snap["total"].(int) != 1 {
		t.Errorf("total = %v, want 1", snap["total"])
	}
}

func TestBuildAndStartSendJob_NoEligibleInvites(t *testing.T) {
	repo := repository.NewMemoryRepository()
	ctx := context.Background()

	svc := NewWhatsAppService(repo)
	_, err := svc.BuildAndStartSendJob(ctx, []int{9999}, "https://example.com", 0, 1)
	if err == nil {
		t.Fatal("expected error for no eligible invites")
	}
	if err.Error() != "no_eligible_invites" {
		t.Errorf("err = %q, want no_eligible_invites", err.Error())
	}
}
