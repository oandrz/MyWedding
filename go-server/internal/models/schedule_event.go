// go-server/internal/models/schedule_event.go
package models

import "time"

type ScheduleEvent struct {
	ID          int       `json:"id"`
	Title       string    `json:"title"`
	Time        string    `json:"time"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
}

type InsertScheduleEvent struct {
	Title       string `json:"title"`
	Time        string `json:"time"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
}

type UpdateScheduleEvent struct {
	Title       string `json:"title"`
	Time        string `json:"time"`
	Description string `json:"description"`
}

type ScheduleOrderItem struct {
	ID        int `json:"id"`
	SortOrder int `json:"sortOrder"`
}
