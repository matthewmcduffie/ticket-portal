CREATE TABLE IF NOT EXISTS equipment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hire_name VARCHAR(255) NOT NULL,
  hire_department VARCHAR(255) NOT NULL,
  hire_start_date DATE NOT NULL,
  requestor_name VARCHAR(255) NOT NULL,
  items TEXT[] NOT NULL DEFAULT '{}',
  due_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES equipment_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('created', 'status_change', 'field_edit', 'comment')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value, description) VALUES
  ('equipment_requests_enabled', 'false', 'Enable the Equipment Requests module for admins')
ON CONFLICT (key) DO NOTHING;
