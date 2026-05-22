package service

import (
	"context"
	"testing"
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
