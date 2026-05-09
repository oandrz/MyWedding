INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
VALUES ('dress_code', 'Dress Code', 'Show dress code section with forbidden attire colors', FALSE)
ON CONFLICT (feature_key) DO NOTHING;
