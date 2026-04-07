package models

import (
	"crypto/rand"
	"math/big"
)

// Invite represents a guest invitation with a unique code.
type Invite struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	RsvpID    *int   `json:"rsvpId"`
	CreatedAt string `json:"createdAt"`
	Rsvp      *Rsvp  `json:"rsvp,omitempty"`
}

// InsertInvite contains the fields required to create an invite.
type InsertInvite struct {
	Name string `json:"name"`
}

// BulkCreateInvitesRequest is the request body for bulk invite creation.
type BulkCreateInvitesRequest struct {
	Names []string `json:"names"`
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
