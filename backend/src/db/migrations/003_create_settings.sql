CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value, description) VALUES
  ('app_name', 'Tickets', 'Application display name'),
  ('allow_registration', 'false', 'Allow public self-registration'),
  ('default_priority', 'medium', 'Default priority for new tickets'),
  ('tickets_per_page', '20', 'Number of tickets per page')
ON CONFLICT (key) DO NOTHING;
