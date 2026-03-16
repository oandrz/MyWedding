package models

// Message represents a guest-book style message.
type Message struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Email     *string `json:"email"`
	Content   string  `json:"content"`
	CreatedAt string  `json:"createdAt"`
}

// InsertMessage contains the fields required to create a new message.
type InsertMessage struct {
	Name    string  `json:"name"`
	Email   *string `json:"email"`
	Content string  `json:"content"`
}
