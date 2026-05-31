INSERT INTO app_settings (key, value, description) VALUES
  ('data_retention_years', '6',  'Years to retain soft-deleted tickets and events before permanent removal (HIPAA minimum: 6)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value, description) VALUES
  ('audit_retention_years', '6', 'Years to retain audit log entries before permanent removal (HIPAA minimum: 6)')
ON CONFLICT (key) DO NOTHING;
