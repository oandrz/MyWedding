-- Add a downscaled "display" image URL for the gallery detail viewer.
-- Nullable: existing rows are backfilled by cmd/backfill-display; the detail
-- view falls back to image_url when this is NULL.
ALTER TABLE config_images ADD COLUMN IF NOT EXISTS display_url TEXT;
