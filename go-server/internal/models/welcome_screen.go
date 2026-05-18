package models

type WelcomeScreen struct {
	ID              int    `json:"id"`
	HeadingText     string `json:"headingText"`
	HeadingTextId   string `json:"headingTextId"`
	DeliveryLabel   string `json:"deliveryLabel"`
	DeliveryLabelId string `json:"deliveryLabelId"`
	FallbackName    string `json:"fallbackName"`
	Enabled         bool   `json:"enabled"`
	UpdatedAt       string `json:"updatedAt"`
}

type InsertWelcomeScreen struct {
	HeadingText     *string `json:"headingText"`
	HeadingTextId   *string `json:"headingTextId"`
	DeliveryLabel   *string `json:"deliveryLabel"`
	DeliveryLabelId *string `json:"deliveryLabelId"`
	FallbackName    *string `json:"fallbackName"`
	Enabled         *bool   `json:"enabled"`
}
