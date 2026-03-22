-- 003_add_indexes.sql
-- Add indexes on frequently queried columns for email lookups and sorted queries.

CREATE INDEX IF NOT EXISTS idx_rsvp_email ON rsvp(email);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
