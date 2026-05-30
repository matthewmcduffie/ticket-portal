INSERT INTO app_settings (key, value, description) VALUES
  ('slack_webhook_url',       '',      'Slack incoming webhook URL for ticket notifications'),
  ('slack_notify_on_create',  'true',  'Send Slack notification when a ticket is opened'),
  ('slack_notify_on_update',  'false', 'Send Slack notification when ticket status changes')
ON CONFLICT (key) DO NOTHING;
