package models

// User represents a registered user in the system.
type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Password string `json:"-"`
}

// InsertUser contains the fields required to create a new user.
type InsertUser struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
