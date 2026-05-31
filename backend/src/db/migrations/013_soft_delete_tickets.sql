ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tickets_active_idx ON tickets(deleted_at) WHERE deleted_at IS NULL;
