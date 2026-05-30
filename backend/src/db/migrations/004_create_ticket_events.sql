CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255) NOT NULL DEFAULT 'System',
  event_type VARCHAR(100) NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_events_created_at ON ticket_events(created_at DESC);
