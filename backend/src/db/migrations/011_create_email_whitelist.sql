CREATE TABLE IF NOT EXISTS email_whitelist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('email', 'domain')),
  value      VARCHAR(255) NOT NULL,
  added_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (value)
);
