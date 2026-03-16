package middleware

import (
	"testing"
	"time"
)

func TestCreateSession(t *testing.T) {
	store := NewSessionStore(30 * time.Minute)
	session := store.CreateSession("127.0.0.1")

	if session == nil {
		t.Fatal("expected session, got nil")
	}
	if session.SessionID == "" {
		t.Error("expected non-empty session ID")
	}
	if session.IP != "127.0.0.1" {
		t.Errorf("expected IP 127.0.0.1, got %s", session.IP)
	}
}

func TestGetSession(t *testing.T) {
	store := NewSessionStore(30 * time.Minute)
	created := store.CreateSession("")

	got := store.GetSession(created.SessionID)
	if got == nil {
		t.Fatal("expected session, got nil")
	}
	if got.SessionID != created.SessionID {
		t.Errorf("session ID mismatch: %s vs %s", got.SessionID, created.SessionID)
	}
}

func TestGetSessionNotFound(t *testing.T) {
	store := NewSessionStore(30 * time.Minute)

	got := store.GetSession("nonexistent")
	if got != nil {
		t.Error("expected nil for nonexistent session")
	}
}

func TestSessionExpiry(t *testing.T) {
	// Use a very short duration so we can test expiry
	store := NewSessionStore(1 * time.Millisecond)
	session := store.CreateSession("")

	time.Sleep(5 * time.Millisecond)

	got := store.GetSession(session.SessionID)
	if got != nil {
		t.Error("expected nil for expired session")
	}
}

func TestDeleteSession(t *testing.T) {
	store := NewSessionStore(30 * time.Minute)
	session := store.CreateSession("")

	deleted := store.DeleteSession(session.SessionID)
	if !deleted {
		t.Error("expected delete to return true")
	}

	got := store.GetSession(session.SessionID)
	if got != nil {
		t.Error("expected nil after deletion")
	}
}

func TestDeleteSessionNotFound(t *testing.T) {
	store := NewSessionStore(30 * time.Minute)

	deleted := store.DeleteSession("nonexistent")
	if deleted {
		t.Error("expected delete to return false for nonexistent session")
	}
}

func TestSessionLastAccessedUpdate(t *testing.T) {
	store := NewSessionStore(30 * time.Minute)
	session := store.CreateSession("")
	originalAccess := session.LastAccessedAt

	time.Sleep(2 * time.Millisecond)

	got := store.GetSession(session.SessionID)
	if got == nil {
		t.Fatal("expected session, got nil")
	}
	if !got.LastAccessedAt.After(originalAccess) {
		t.Error("expected LastAccessedAt to be updated")
	}
}

func TestSessionCleanupOnCreate(t *testing.T) {
	store := NewSessionStore(1 * time.Millisecond)

	// Create a session that will expire
	store.CreateSession("")
	time.Sleep(5 * time.Millisecond)

	// Creating a new session should clean up expired ones
	store.CreateSession("")

	// The internal map should have only 1 session (expired one cleaned)
	store.mu.Lock()
	count := len(store.sessions)
	store.mu.Unlock()

	if count != 1 {
		t.Errorf("expected 1 session after cleanup, got %d", count)
	}
}
