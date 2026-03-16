package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

const sessionPrefix = "session:"

// Compile-time check that RedisSessionStore implements Sessions.
var _ Sessions = (*RedisSessionStore)(nil)

// RedisSessionStore implements session storage backed by Redis.
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

func (s *RedisSessionStore) CreateSession(ip string) *Session {
	ctx := context.Background()

	sessionID := generateSessionID()
	now := time.Now()
	session := &Session{
		SessionID:      sessionID,
		CreatedAt:      now,
		LastAccessedAt: now,
		IP:             ip,
	}

	data, err := json.Marshal(session)
	if err != nil {
		slog.Error("Failed to marshal session", "error", err)
		return session
	}
	if err := s.client.Set(ctx, sessionPrefix+sessionID, data, s.duration).Err(); err != nil {
		slog.Error("Failed to store session in Redis", "error", err)
	}

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
	if updated, err := json.Marshal(&session); err == nil {
		if err := s.client.Set(ctx, sessionPrefix+sessionID, updated, s.duration).Err(); err != nil {
			slog.Warn("Failed to refresh session TTL in Redis", "error", err)
		}
	}

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
