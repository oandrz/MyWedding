-- 016_content_overrides.sql
-- Runtime overrides for build-time invitation text. Empty table => compiled defaults win.
CREATE TABLE IF NOT EXISTS content_overrides (
    key        TEXT        NOT NULL,
    locale     TEXT        NOT NULL,          -- 'en' | 'id' | '*'
    value      TEXT        NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key, locale)
);
