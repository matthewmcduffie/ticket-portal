INSERT INTO app_settings (key, value, description) VALUES
  ('discord_webhook_url',       '',      'Discord webhook URL for ticket notifications'),
  ('discord_notify_on_create',  'true',  'Send Discord notification when a ticket is opened'),
  ('discord_notify_on_update',  'false', 'Send Discord notification when ticket status changes')
ON CONFLICT (key) DO NOTHING;
