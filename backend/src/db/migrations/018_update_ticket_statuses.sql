-- 1. Remove the old constraint so the updates below are not blocked
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;

-- 2. Migrate data
UPDATE tickets SET status = 'merged' WHERE merged_into IS NOT NULL AND status IN ('closed', 'resolved');
UPDATE tickets SET status = 'solved' WHERE status IN ('closed', 'resolved');

-- 3. Add the new constraint (all rows now valid)
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'waiting_for_user', 'solved', 'merged'));
