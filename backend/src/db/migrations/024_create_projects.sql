ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_use_projects BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO app_settings (key, value, description) VALUES
  ('projects_enabled', 'false', 'Allow permitted users to create and use Projects')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS projects (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  summary     VARCHAR(500),
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role        VARCHAR(20)  NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id   ON project_members(user_id);

CREATE TABLE IF NOT EXISTS project_tickets (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  status       VARCHAR(50)  NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'closed')),
  priority     VARCHAR(50)  NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  issue_type   VARCHAR(20)  NOT NULL DEFAULT 'ticket' CHECK (issue_type IN ('ticket', 'bug')),
  created_by   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to  UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_tickets_project_id ON project_tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tickets_status     ON project_tickets(status);

CREATE TABLE IF NOT EXISTS project_ticket_events (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_ticket_id  UUID         NOT NULL REFERENCES project_tickets(id) ON DELETE CASCADE,
  user_id            UUID         REFERENCES users(id) ON DELETE SET NULL,
  user_name          VARCHAR(255) NOT NULL DEFAULT 'System',
  event_type         VARCHAR(100) NOT NULL,
  detail             TEXT         NOT NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_ticket_events_ticket_id  ON project_ticket_events(project_ticket_id);
CREATE INDEX IF NOT EXISTS idx_project_ticket_events_created_at ON project_ticket_events(created_at DESC);
