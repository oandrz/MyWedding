package models

// Rsvp represents a guest RSVP record.
type Rsvp struct {
	ID         int    `json:"id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Attending  bool   `json:"attending"`
	GuestCount *int   `json:"guestCount"`
}

// InsertRsvp contains the fields required to create or update an RSVP.
type InsertRsvp struct {
	Name       string `json:"name"`
	Email      string `json:"email"`
	Attending  bool   `json:"attending"`
	GuestCount *int   `json:"guestCount"`
}
