BEGIN;

ALTER TABLE rsvp ADD COLUMN attendance_type TEXT NOT NULL DEFAULT 'both';

-- DEFAULT sets all rows to 'both'; fix declined rows explicitly:
UPDATE rsvp SET attendance_type = 'decline' WHERE attending = false;

ALTER TABLE rsvp DROP COLUMN attending;

COMMIT;
