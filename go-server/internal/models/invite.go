package models

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"regexp"
	"strings"
)

// Invite represents a guest invitation with a unique code.
type Invite struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Code      string  `json:"code"`
	RsvpID    *int    `json:"rsvpId"`
	Phone     *string `json:"phone,omitempty"`
	WaSentAt  *string `json:"waSentAt,omitempty"`
	CreatedAt string  `json:"createdAt"`
	Rsvp      *Rsvp   `json:"rsvp,omitempty"`
}

// InsertInvite contains the fields required to create an invite.
type InsertInvite struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
}

// BulkCreateInvitesRequest is the request body for bulk invite creation.
type BulkCreateInvitesRequest struct {
	Names   []string          `json:"names"`
	Invites []BulkInviteEntry `json:"invites"`
}

// BulkInviteEntry represents a single invite in a bulk create request.
type BulkInviteEntry struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
}

// GenerateInviteCode creates a random 5-character lowercase alphanumeric code.
func GenerateInviteCode() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 5)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		b[i] = charset[n.Int64()]
	}
	return string(b)
}

var phoneDigitsOnly = regexp.MustCompile(`[^\d]`)

// NormalizePhone strips formatting and validates E.164 format.
// Returns normalized phone or error if invalid.
func NormalizePhone(raw string) (string, error) {
	if raw == "" {
		return "", fmt.Errorf("phone number is required")
	}

	trimmed := strings.TrimSpace(raw)
	if !strings.HasPrefix(trimmed, "+") {
		return "", fmt.Errorf("phone must start with + (international format)")
	}

	// Keep the +, strip everything else that isn't a digit
	digits := phoneDigitsOnly.ReplaceAllString(trimmed[1:], "")

	// Check for non-digit characters (letters etc.) by comparing lengths
	stripped := strings.NewReplacer(" ", "", "-", "", "(", "", ")", "").Replace(trimmed[1:])
	if stripped != digits {
		return "", fmt.Errorf("phone contains invalid characters")
	}

	if len(digits) < 7 || len(digits) > 15 {
		return "", fmt.Errorf("phone must have 7-15 digits after +")
	}

	return "+" + digits, nil
}
