package models

// ContentOverride is a runtime override for a build-time text key.
type ContentOverride struct {
	Key       string `json:"key"`
	Locale    string `json:"locale"`
	Value     string `json:"value"`
	UpdatedAt string `json:"updatedAt"`
}

// InsertContentOverride contains the fields required to create or update an override.
type InsertContentOverride struct {
	Key    string `json:"key"`
	Locale string `json:"locale"`
	Value  string `json:"value"`
}
