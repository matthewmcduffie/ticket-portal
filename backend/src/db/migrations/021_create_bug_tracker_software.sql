CREATE TABLE IF NOT EXISTS bug_tracker_software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_bug_software_id_fkey'
  ) THEN
    ALTER TABLE tickets
      ADD CONSTRAINT tickets_bug_software_id_fkey
      FOREIGN KEY (bug_software_id) REFERENCES bug_tracker_software(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_bug_software_id ON tickets(bug_software_id);
