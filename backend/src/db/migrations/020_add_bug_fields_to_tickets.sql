ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS issue_type VARCHAR(20) NOT NULL DEFAULT 'ticket',
  ADD COLUMN IF NOT EXISTS bug_software_id UUID NULL;

UPDATE tickets
SET issue_type = 'ticket'
WHERE issue_type IS NULL;

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_issue_type_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_issue_type_check
  CHECK (issue_type IN ('ticket', 'bug'));

CREATE INDEX IF NOT EXISTS idx_tickets_issue_type ON tickets(issue_type);
