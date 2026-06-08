CREATE TABLE IF NOT EXISTS restore_runs (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type  VARCHAR(20)  NOT NULL CHECK (source_type IN ('cloud', 'upload_json', 'upload_sql')),
  source_label TEXT,
  status       VARCHAR(20)  NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  summary      TEXT,
  error        TEXT,
  started_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
  started_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_restore_runs_started_at ON restore_runs(started_at DESC);
