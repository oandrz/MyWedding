package models

// AppSetting represents an application configuration setting.
type AppSetting struct {
	ID           int     `json:"id"`
	SettingKey   string  `json:"settingKey"`
	SettingValue string  `json:"settingValue"`
	SettingType  string  `json:"settingType"`
	Description  *string `json:"description"`
	UpdatedAt    string  `json:"updatedAt"`
}

// InsertAppSetting contains the fields required to create or update an app setting.
type InsertAppSetting struct {
	SettingKey   string  `json:"settingKey"`
	SettingValue string  `json:"settingValue"`
	SettingType  string  `json:"settingType"`
	Description  *string `json:"description"`
}
