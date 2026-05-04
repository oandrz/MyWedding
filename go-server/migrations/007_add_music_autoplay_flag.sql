INSERT INTO feature_flags (feature_key, feature_name, description, enabled)
VALUES ('music_autoplay', 'Music Autoplay', 'Autoplay background music when invitation opens', TRUE)
ON CONFLICT (feature_key) DO NOTHING;
