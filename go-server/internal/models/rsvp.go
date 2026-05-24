package models

// Rsvp represents a guest RSVP record.
type Rsvp struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	Email          string  `json:"email"`
	Phone          *string `json:"phone"`
	AttendanceType string  `json:"attendanceType"`
	GuestCount     *int    `json:"guestCount"`
}

// InsertRsvp contains the fields required to create or update an RSVP.
type InsertRsvp struct {
	Name           string  `json:"name"`
	Email          string  `json:"email"`
	Phone          *string `json:"phone"`
	AttendanceType string  `json:"attendanceType"`
	GuestCount     *int    `json:"guestCount"`
}

// IsAttending returns true if the guest is attending any event.
func (r Rsvp) IsAttending() bool {
	return r.AttendanceType != "decline"
}

// ValidAttendanceTypes contains the allowed values for AttendanceType.
var ValidAttendanceTypes = map[string]bool{
	"both":           true,
	"holy_matrimony": true,
	"reception":      true,
	"decline":        true,
}
