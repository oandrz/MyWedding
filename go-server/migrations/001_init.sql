-- Wedding E-Invitation Platform: Initial Schema
-- Mirrors shared/schema.ts (Drizzle ORM definitions)

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rsvp (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    attending BOOLEAN NOT NULL,
    guest_count INTEGER
);

CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL,
    caption TEXT,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config_images (
    id SERIAL PRIMARY KEY,
    image_key TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    image_type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
    id SERIAL PRIMARY KEY,
    feature_key TEXT NOT NULL UNIQUE,
    feature_name TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    setting_type TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS welcome_screen (
    id SERIAL PRIMARY KEY,
    heading_text TEXT NOT NULL DEFAULT 'The Wedding of Andreas & Christine',
    delivery_label TEXT NOT NULL DEFAULT 'Kindly Delivered to',
    fallback_name TEXT NOT NULL DEFAULT 'Our Dearest Guest',
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default feature flags
INSERT INTO feature_flags (feature_key, feature_name, description, enabled) VALUES
    ('rsvp', 'RSVP Form', 'Allow guests to RSVP', TRUE),
    ('messages', 'Message Board', 'Allow guests to leave messages', TRUE),
    ('gallery', 'Photo Gallery', 'Display photo gallery', TRUE),
    ('music', 'Background Music', 'Play background music', FALSE),
    ('countdown', 'Countdown Timer', 'Show countdown to wedding date', FALSE),
    ('memories', 'Memories', 'Show memories section', TRUE),
    ('egift', 'E-Gift', 'Allow digital gifts', TRUE)
ON CONFLICT (feature_key) DO NOTHING;

-- Seed default app settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, description) VALUES
    ('background_music_url', '/music/wedding-piano.mp3', 'audio', 'Background music URL'),
    ('egift_groom_name', 'Andreas', 'text', 'Groom name for e-gift'),
    ('egift_groom_bank', 'Bank BCA', 'text', 'Groom bank for e-gift'),
    ('egift_groom_account', '1234567890', 'text', 'Groom account number'),
    ('egift_bride_name', 'Christine', 'text', 'Bride name for e-gift'),
    ('egift_bride_bank', 'Bank BCA', 'text', 'Bride bank for e-gift'),
    ('egift_bride_account', '0987654321', 'text', 'Bride account number')
ON CONFLICT (setting_key) DO NOTHING;

-- Seed default welcome screen
INSERT INTO welcome_screen (id, heading_text, delivery_label, fallback_name, enabled) VALUES
    (1, 'The Wedding of Andreas & Christine', 'Kindly Delivered to', 'Our Dearest Guest', TRUE)
ON CONFLICT (id) DO NOTHING;
