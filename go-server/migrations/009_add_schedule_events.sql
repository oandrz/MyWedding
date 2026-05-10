CREATE TABLE schedule_events (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  time        TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
