INSERT INTO app_settings (key, value, description) VALUES
  ('backup_provider',           '',      'Active backup storage provider (s3 or r2)'),
  ('backup_access_key_id',      '',      'Access key ID for the backup storage provider'),
  ('backup_secret_access_key',  '',      'Secret access key for the backup storage provider'),
  ('backup_bucket',             '',      'Bucket name backups are uploaded to'),
  ('backup_region',             'auto',  'Region for the backup storage provider (Amazon S3 region, or "auto" for Cloudflare R2)'),
  ('backup_endpoint',           '',      'Custom S3-compatible endpoint URL (required for Cloudflare R2)'),
  ('backup_schedule_enabled',   'false', 'Run database backups on an automatic schedule'),
  ('backup_schedule_frequency', 'daily', 'How often scheduled backups run (daily, weekly, monthly)'),
  ('backup_schedule_day',       '0',     'Day the scheduled backup runs on (0-6 for weekly = Sun-Sat, 1-28 for monthly)'),
  ('backup_schedule_time',      '00:00', 'Time of day scheduled backups run, 24h HH:MM (defaults to midnight)'),
  ('backup_retention_count',    '3',     'Number of backups to retain using grandfather-father-son rotation (max 3) before older ones are removed')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS backup_runs (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger     VARCHAR(20)  NOT NULL CHECK (trigger IN ('scheduled', 'manual', 'test')),
  status      VARCHAR(20)  NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  object_key  TEXT,
  size_bytes  BIGINT,
  error       TEXT,
  started_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_started_at ON backup_runs(started_at DESC);
