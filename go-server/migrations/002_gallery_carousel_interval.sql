INSERT INTO app_settings (setting_key, setting_value, setting_type, description)
VALUES ('gallery_carousel_interval', '4000', 'number', 'Gallery carousel auto-scroll interval in milliseconds')
ON CONFLICT (setting_key) DO NOTHING;
