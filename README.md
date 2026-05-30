# Tickets

A self-hosted support ticket system for small businesses and teams that need something that actually works — without paying $80 a seat per month for it.

Most helpdesk software is built for enterprise teams with enterprise budgets. If you're running a small operation and just need a clean way to track issues, communicate with users, and stay on top of what's broken, this is for you.

---

## What it does

- Users submit support tickets through the web portal or by emailing the support inbox directly
- Admins manage the queue, update statuses, assign tickets, and close issues
- Everyone gets email notifications when something changes on their ticket
- Duplicate or related tickets can be merged together by an admin
- Every ticket has a full activity trail — who opened it, who changed what, and when
- Notifications can be pushed to Discord and Slack channels so your team sees new issues in real time
- The whole thing runs in Docker, so you can move it to a different server in minutes

---

## What you need before you start

- A server with Docker and Docker Compose installed
- A domain pointed at that server (the app is designed to live behind Caddy or another reverse proxy)
- An [AgentMail](https://agentmail.to) account and inbox for email in/out
- Optionally: a Discord webhook and/or a Slack incoming webhook for notifications

---

## Getting it running

**1. Clone the repo and create your environment file**

```bash
git clone https://github.com/matthewmcduffie/ticket-portal.git
cd ticket-portal
cp .env.example .env
```

**2. Fill in `.env`**

Open `.env` and set real values for everything. The important ones:

```
DB_PASSWORD         — pick something strong, this is your Postgres password
JWT_SECRET          — generate one with: openssl rand -base64 64
DEFAULT_ADMIN_EMAIL — the email address for the first admin account
DEFAULT_ADMIN_PASSWORD — set this, then change it immediately after first login
APP_DOMAIN          — the domain where the app will live, e.g. tickets.yourcompany.com
AGENTMAIL_API_KEY   — your AgentMail API key
AGENTMAIL_INBOX_ID  — your AgentMail inbox address (e.g. support@agentmail.to)
```

Discord and Slack webhook URLs are optional — you can add them later through the Settings page.

**3. Configure your reverse proxy**

Add a block to your Caddyfile (or equivalent):

```
tickets.yourcompany.com {
    encode gzip

    handle /api/* {
        reverse_proxy localhost:7012
    }

    handle {
        reverse_proxy localhost:7003
    }
}
```

Then reload: `systemctl reload caddy`

**4. Start the app**

```bash
docker compose up -d --build
```

This will:
- Start a Postgres database
- Run all database migrations automatically
- Create your default admin account
- Start the backend API on port 7012 (internal)
- Build and serve the frontend on port 7003 (internal)

**5. Log in and change the admin password**

Navigate to your domain, log in with the credentials you set in `.env`, go to **Settings → User Management**, and update the admin password. Don't skip this.

---

## Adding users

Only admins can create user accounts. Go to **Settings → User Management** and fill in the form. Set the role to **User** for regular staff and **Admin** for people who need full access.

Users can also be created automatically — if someone emails your support inbox and they're not in the system yet, an account is created for them.

---

## Email setup

The app uses [AgentMail](https://agentmail.to) for both inbound and outbound email.

- **Inbound**: Emails sent to your inbox address are automatically converted to tickets. The sender gets a confirmation reply with their ticket ID.
- **Outbound**: Ticket creators receive email notifications when their ticket is opened and when the status changes.

The inbox is polled every 60 seconds. You can verify the connection is working from **Settings → Email → Send test email**.

---

## Notification integrations

Both Discord and Slack send a formatted message whenever a new ticket is opened (and optionally when statuses change). Configure them from **Settings → Discord** or **Settings → Slack**.

Each integration has a test button that tells you immediately if it's working or not.

For Slack, you'll need to create an incoming webhook app in your Slack workspace. There's a direct link to Slack's setup guide inside the Slack settings drawer.

---

## Ports

The app does not expose ports 80 or 443 directly — it's designed to sit behind your existing reverse proxy. The only ports that bind to the host are:

| Port  | Service          |
|-------|------------------|
| 7003  | Frontend (static files) |
| 7012  | Backend API      |

Both bind to `127.0.0.1` only, so they're not reachable from outside the server.

---

## Moving the app to a different server

1. Copy the repo directory to the new server
2. Copy your `.env` file (keep it out of version control)
3. Export the database: `docker exec tickets-postgres-1 pg_dump -U tickets_user tickets_db > backup.sql`
4. On the new server: `docker compose up -d --build`
5. Import the backup: `docker exec -i tickets-postgres-1 psql -U tickets_user tickets_db < backup.sql`

That's it. No dependency fighting, no config spread across the system.

---

## Modular backend

The backend is built around a module registry in `backend/src/config/modules.js`. Each feature (auth, tickets, users, settings, email, discord, slack) is a separate module that can be disabled by flipping a flag to `false`. The service restarts cleanly without it.

---

## License

See [LICENSE](LICENSE).

---

## Author

John McDuffie — mcduffiejohn@gmail.com
