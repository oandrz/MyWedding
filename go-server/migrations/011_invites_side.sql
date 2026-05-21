ALTER TABLE invites ADD COLUMN IF NOT EXISTS side TEXT CHECK (side IN ('groom', 'bride'));
