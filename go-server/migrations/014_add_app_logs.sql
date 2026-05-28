CREATE TABLE IF NOT EXISTS app_logs (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    level       TEXT NOT NULL,
    source      TEXT NOT NULL,
    message     TEXT NOT NULL,
    request_id  TEXT,
    method      TEXT,
    path        TEXT,
    status      INT,
    duration_ms INT,
    attrs       JSONB
);

CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level_created_at ON app_logs (level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_request_id ON app_logs (request_id);
