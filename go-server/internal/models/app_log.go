package models

import "time"

// AppLog is a single persisted log record.
type AppLog struct {
	ID         int64          `json:"id"`
	CreatedAt  string         `json:"createdAt"`
	Level      string         `json:"level"`
	Source     string         `json:"source"`
	Message    string         `json:"message"`
	RequestID  string         `json:"requestId,omitempty"`
	Method     string         `json:"method,omitempty"`
	Path       string         `json:"path,omitempty"`
	Status     int            `json:"status,omitempty"`
	DurationMs int            `json:"durationMs,omitempty"`
	Attrs      map[string]any `json:"attrs,omitempty"`
}

// LogQuery holds filter parameters for querying logs.
type LogQuery struct {
	Level     string
	Source    string
	RequestID string
	Search    string
	Before    *time.Time
	After     *time.Time
	Limit     int
	Cursor    int64 // keyset on id; 0 means no cursor
}
