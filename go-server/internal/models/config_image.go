package models

// ConfigImage represents a configurable image used in the application UI.
type ConfigImage struct {
	ID           int     `json:"id"`
	ImageKey     string  `json:"imageKey"`
	ImageURL     string  `json:"imageUrl"`
	ThumbnailURL *string `json:"thumbnailUrl"`
	ImageType    string  `json:"imageType"`
	Title        *string `json:"title"`
	Description  *string `json:"description"`
	IsActive     bool    `json:"isActive"`
	DisplayOrder int     `json:"displayOrder"`
	UpdatedAt    string  `json:"updatedAt"`
}

// InsertConfigImage contains the fields required to create or update a config image.
type InsertConfigImage struct {
	ImageKey     string  `json:"imageKey"`
	ImageURL     string  `json:"imageUrl"`
	ThumbnailURL *string `json:"thumbnailUrl"`
	ImageType    string  `json:"imageType"`
	Title        *string `json:"title"`
	Description  *string `json:"description"`
	IsActive     *bool   `json:"isActive"`
	DisplayOrder *int    `json:"displayOrder"`
}
