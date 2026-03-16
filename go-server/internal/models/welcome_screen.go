package models

// WelcomeScreen represents the welcome screen configuration.
type WelcomeScreen struct {
	ID            int    `json:"id"`
	HeadingText   string `json:"headingText"`
	DeliveryLabel string `json:"deliveryLabel"`
	FallbackName  string `json:"fallbackName"`
	Enabled       bool   `json:"enabled"`
	UpdatedAt     string `json:"updatedAt"`
}

// InsertWelcomeScreen contains the fields for updating the welcome screen.
type InsertWelcomeScreen struct {
	HeadingText   *string `json:"headingText"`
	DeliveryLabel *string `json:"deliveryLabel"`
	FallbackName  *string `json:"fallbackName"`
	Enabled       *bool   `json:"enabled"`
}
