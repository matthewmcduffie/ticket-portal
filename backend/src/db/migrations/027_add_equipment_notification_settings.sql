INSERT INTO app_settings (key, value, description) VALUES
  ('discord_notify_equipment', 'true', 'Send Discord notification when an equipment request is created'),
  ('slack_notify_equipment',   'true', 'Send Slack notification when an equipment request is created')
ON CONFLICT (key) DO NOTHING;
