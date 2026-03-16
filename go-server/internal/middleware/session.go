package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

type Session struct {
	SessionID      string    `json:"sessionId"`
	CreatedAt      time.Time `json:"createdAt"`
	LastAccessedAt time.Time `json:"lastAccessedAt"`
	IP             string    `json:"ip,omitempty"`
}

// Sessions defines the interface for session management.
// Both SessionStore (in-memory) and RedisSessionStore implement this.
type Sessions interface {
	CreateSession(ip string) *Session
	GetSession(sessionID string) *Session
	DeleteSession(sessionID string) bool
}

// generateSessionID produces a cryptographically random 64-character hex string.
func generateSessionID() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return hex.EncodeToString(b)
}

type SessionStore struct {
	mu              sync.Mutex
	sessions        map[string]*Session
	sessionDuration time.Duration
}

func NewSessionStore(maxAge time.Duration) *SessionStore {
	return &SessionStore{
		sessions:        make(map[string]*Session),
		sessionDuration: maxAge,
	}
}

func (s *SessionStore) CreateSession(ip string) *Session {
	s.mu.Lock()
	defer s.mu.Unlock()

	sessionID := generateSessionID()
	now := time.Now()
	session := &Session{
		SessionID:      sessionID,
		CreatedAt:      now,
		LastAccessedAt: now,
		IP:             ip,
	}
	s.sessions[sessionID] = session
	s.cleanupExpired()
	return session
}

func (s *SessionStore) GetSession(sessionID string) *Session {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[sessionID]
	if !ok {
		return nil
	}

	if s.isExpired(session) {
		delete(s.sessions, sessionID)
		return nil
	}

	session.LastAccessedAt = time.Now()
	return session
}

func (s *SessionStore) DeleteSession(sessionID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, ok := s.sessions[sessionID]
	if ok {
		delete(s.sessions, sessionID)
	}
	return ok
}

func (s *SessionStore) isExpired(session *Session) bool {
	return time.Since(session.LastAccessedAt) > s.sessionDuration
}

func (s *SessionStore) cleanupExpired() {
	now := time.Now()
	for id, session := range s.sessions {
		if now.Sub(session.LastAccessedAt) > s.sessionDuration {
			delete(s.sessions, id)
		}
	}
}
