CREATE TABLE IF NOT EXISTS ticket_shares (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  shared_with UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  shared_by   UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, shared_with)
);

CREATE INDEX IF NOT EXISTS ticket_shares_ticket_idx ON ticket_shares(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_shares_user_idx   ON ticket_shares(shared_with);
