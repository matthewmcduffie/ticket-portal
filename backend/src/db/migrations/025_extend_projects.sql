-- Invitations: members start as 'invited' until they accept; they may also decline (row removed)
ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active'));

-- Uploads: let attachments belong to either a regular ticket or a project ticket
ALTER TABLE ticket_attachments
  ALTER COLUMN ticket_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS project_ticket_id UUID REFERENCES project_tickets(id) ON DELETE CASCADE;

ALTER TABLE ticket_attachments DROP CONSTRAINT IF EXISTS ticket_attachments_target_check;
ALTER TABLE ticket_attachments
  ADD CONSTRAINT ticket_attachments_target_check
  CHECK ((ticket_id IS NOT NULL) <> (project_ticket_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_project_ticket ON ticket_attachments(project_ticket_id);

ALTER TABLE project_ticket_events
  ADD COLUMN IF NOT EXISTS attachment_id UUID REFERENCES ticket_attachments(id) ON DELETE SET NULL;

-- Polls (project-scoped)
CREATE TABLE IF NOT EXISTS project_polls (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question    VARCHAR(500) NOT NULL,
  created_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  closed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_polls_project_id ON project_polls(project_id);

CREATE TABLE IF NOT EXISTS project_poll_options (
  id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID         NOT NULL REFERENCES project_polls(id) ON DELETE CASCADE,
  text      VARCHAR(255) NOT NULL,
  position  INTEGER      NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_project_poll_options_poll_id ON project_poll_options(poll_id);

CREATE TABLE IF NOT EXISTS project_poll_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID        NOT NULL REFERENCES project_polls(id) ON DELETE CASCADE,
  option_id  UUID        NOT NULL REFERENCES project_poll_options(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_poll_votes_poll_id ON project_poll_votes(poll_id);

-- Labels
CREATE TABLE IF NOT EXISTS project_labels (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        VARCHAR(60)  NOT NULL,
  color       VARCHAR(20)  NOT NULL DEFAULT '#6d28d9',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS project_ticket_labels (
  project_ticket_id  UUID NOT NULL REFERENCES project_tickets(id) ON DELETE CASCADE,
  label_id           UUID NOT NULL REFERENCES project_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (project_ticket_id, label_id)
);

-- Milestones + due dates
CREATE TABLE IF NOT EXISTS project_milestones (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  target_date  DATE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);

ALTER TABLE project_tickets
  ADD COLUMN IF NOT EXISTS due_date     DATE,
  ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tickets_milestone_id ON project_tickets(milestone_id);
