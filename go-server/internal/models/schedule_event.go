// go-server/internal/models/schedule_event.go
package models

type ScheduleEvent struct {
	ID          int    `json:"id"`
	Title       string `json:"title"`
	Time        string `json:"time"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
	CreatedAt   string `json:"createdAt"`
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
