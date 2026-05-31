INSERT INTO app_settings (key, value, description) VALUES
  ('uploads_enabled',          'true', 'Allow users to attach files to tickets'),
  ('upload_max_file_size_mb',  '25',   'Maximum size per file in megabytes'),
  ('upload_max_total_size_mb', '100',  'Maximum total upload size per request in megabytes')
ON CONFLICT (key) DO NOTHING;
