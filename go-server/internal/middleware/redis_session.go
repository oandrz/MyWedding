package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const sessionPrefix = "session:"

// RedisSessionStore implements session storage backed by Redis.
// It exposes the same API as SessionStore so auth/CSRF middleware work unchanged.
type RedisSessionStore struct {
	client   *redis.Client
	duration time.Duration
}

// NewRedisSessionStore creates a Redis-backed session store.
func NewRedisSessionStore(redisURL string, maxAge time.Duration) (*RedisSessionStore, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis URL: %w", err)
	}

	client := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	return &RedisSessionStore{
		client:   client,
		duration: maxAge,
	}, nil
}

func (s *RedisSessionStore) GenerateSessionID() string {
	// Reuse the crypto/rand helper from the in-memory store.
	tmp := &SessionStore{}
	return tmp.GenerateSessionID()
}

func (s *RedisSessionStore) CreateSession(ip string) *Session {
	ctx := context.Background()

	sessionID := s.GenerateSessionID()
	now := time.Now()
	session := &Session{
		SessionID:      sessionID,
		CreatedAt:      now,
		LastAccessedAt: now,
		IP:             ip,
	}

	data, _ := json.Marshal(session)
	s.client.Set(ctx, sessionPrefix+sessionID, data, s.duration)

	return session
}

func (s *RedisSessionStore) GetSession(sessionID string) *Session {
	ctx := context.Background()

	data, err := s.client.Get(ctx, sessionPrefix+sessionID).Bytes()
	if err != nil {
		return nil
	}

	var session Session
	if err := json.Unmarshal(data, &session); err != nil {
		return nil
	}

	// Refresh TTL on access
	session.LastAccessedAt = time.Now()
	updated, _ := json.Marshal(&session)
	s.client.Set(ctx, sessionPrefix+sessionID, updated, s.duration)

	return &session
}

func (s *RedisSessionStore) DeleteSession(sessionID string) bool {
	ctx := context.Background()
	n, err := s.client.Del(ctx, sessionPrefix+sessionID).Result()
	return err == nil && n > 0
}

// Close shuts down the Redis client connection.
func (s *RedisSessionStore) Close() error {
	return s.client.Close()
}
