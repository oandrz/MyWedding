package models

// Media represents an uploaded media item (photo/video).
type Media struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	MediaURL  string  `json:"mediaUrl"`
	MediaType string  `json:"mediaType"`
	Caption   *string `json:"caption"`
	Approved  bool    `json:"approved"`
	CreatedAt string  `json:"createdAt"`
}

// InsertMedia contains the fields required to create a new media item.
type InsertMedia struct {
	Name      string  `json:"name"`
	Email     string  `json:"email"`
	MediaURL  string  `json:"mediaUrl"`
	MediaType *string `json:"mediaType"`
	Caption   *string `json:"caption"`
}
