package models

// FeatureFlag represents a feature toggle in the application.
type FeatureFlag struct {
	ID          int    `json:"id"`
	FeatureKey  string `json:"featureKey"`
	FeatureName string `json:"featureName"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	UpdatedAt   string `json:"updatedAt"`
}

// InsertFeatureFlag contains the fields required to create a new feature flag.
type InsertFeatureFlag struct {
	FeatureKey  string `json:"featureKey"`
	FeatureName string `json:"featureName"`
	Description string `json:"description"`
	Enabled     *bool  `json:"enabled"`
}
