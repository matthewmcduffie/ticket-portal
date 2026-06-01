# Tickets (i'm working on a name)

A self-hosted support ticket system built for small businesses and teams that need something that actually works without paying per seat for it.

Most helpdesk software is built for large enterprise teams. If you just need a clean, secure way to track issues, communicate with users, and stay on top of what needs fixing, this is for you.

---

## What it does

- Users submit support tickets through the web portal or by emailing the support inbox directly
- Admins manage the queue, update statuses, assign tickets, and close issues
- Duplicate or related tickets can be merged together to reduce clutter
- Every ticket has a full activity trail showing who opened it, who replied, and when
- Tickets can be shared with other users who need visibility without full access
- Notifications go out by email when ticket status changes, and to Discord or Slack when new tickets arrive
- File attachments are supported on all tickets, with type and size limits you control
- The whole thing runs in Docker, so you can move it to a different server quickly

---

## Security and compliance

This app is built to handle sensitive communications safely:

- Sessions use short-lived access tokens (30 minutes) that renew automatically in the background, backed by a 7-day refresh token stored in a secure cookie
- Cookies are `httpOnly`, `Secure`, and `SameSite=strict`, which means they cannot be read by JavaScript and will not travel on cross-site requests
- Accounts lock automatically after 5 failed login attempts and unlock after 15 minutes
- All file downloads require verified access to the ticket the file belongs to
- Passwords must be at least 8 characters and include an uppercase letter, a number, and a special character
- All new accounts require a password change on first login
- Admins can unlock locked accounts and send password reset links from the User Management page
- Every login, logout, file download, and ticket view is written to an immutable audit log
- Deleted tickets are soft-deleted and retained in the audit trail; permanent removal happens after the configured retention period (default 6 years, matching HIPAA minimums)
- Inbound emails can be restricted to a whitelist of approved senders and domains
- Content Security Policy headers restrict what browsers are allowed to load

---

## What you need before you start

- A server with Docker and Docker Compose installed
- A domain pointed at that server (the app is designed to run behind Caddy or another reverse proxy)
- An [AgentMail](https://agentmail.to) account and inbox for email in and out
- Optionally, a Discord webhook or a Slack incoming webhook for team notifications

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
DB_PASSWORD            — pick something strong, this is your Postgres password
JWT_SECRET             — generate one with: openssl rand -base64 64
DEFAULT_ADMIN_EMAIL    — the email address for the first admin account
DEFAULT_ADMIN_PASSWORD — set this, then change it immediately after first login
APP_DOMAIN             — the domain where the app will live, e.g. tickets.yourcompany.com
AGENTMAIL_API_KEY      — your AgentMail API key
AGENTMAIL_INBOX_ID     — your AgentMail inbox address (e.g. support@agentmail.to)
WEBHOOK_SECRET         — generate one with: openssl rand -hex 32
```

Discord and Slack webhook URLs are optional. You can add them later through the Settings page.

**3. Configure your reverse proxy**

Add a block to your Caddyfile:

```
tickets.yourcompany.com {
    encode gzip

    request_body {
        max_size 110MB
    }

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

This starts the database, runs migrations, creates your default admin account, and serves the app.

**5. Log in and change the admin password**

Go to your domain, sign in with the credentials from `.env`, then go to **Settings, User Management** and update the password. The system will prompt you to do this on first login.

---

## Adding users

Only admins can create accounts. Go to **Settings, User Management** and fill in the form. New accounts are flagged to require a password change on first login, so temporary passwords are fine.

Users can also be created automatically when someone emails your support inbox for the first time.

---

## Email setup

The app uses [AgentMail](https://agentmail.to) for inbound and outbound email.

Inbound emails sent to your inbox are converted to tickets automatically. The sender gets a confirmation reply with their ticket ID.

Outbound notifications go out when a ticket is opened, when the status changes, and when an admin replies.

The inbox is polled every 60 seconds. You can verify the connection is working from **Settings, Email, Send test email**.

If you want to restrict who can email in, go to **Settings, Email Whitelist** and add approved addresses or domains. An empty whitelist allows everyone through.

**AgentMail webhook:** Set the Authorization header to `Bearer <WEBHOOK_SECRET>` in your AgentMail dashboard to secure the inbound webhook endpoint.

---

## Password requirements

Passwords must be at least 8 characters and contain:
- One uppercase letter
- One number
- One special character (such as ! @ # $ % ^ & *)

The system also blocks a short list of the most commonly used passwords.

---

## Session behavior

Sessions stay active as long as you are using the app. After 8 minutes of no activity, you will see a warning. After 10 minutes of no activity, you are signed out automatically.

---

## Notifications

Both Discord and Slack send a formatted message when a new ticket is opened. Configure them from **Settings, Discord** or **Settings, Slack**. Each integration has a test button.

---

## File uploads

Attachments can be images, PDFs, Word documents, spreadsheets, CSVs, ZIPs, or plain text files. Size limits are configurable from **Settings, Uploads**.

Before uploading a file, read the notice on the upload form. This system may handle sensitive information.

---

## Ports

The app does not expose ports 80 or 443 directly. It sits behind your existing reverse proxy. The only ports that bind to the host are:

| Port | Service              |
|------|----------------------|
| 7003 | Frontend             |
| 7012 | Backend API          |

Both bind to `127.0.0.1` only, so they are not reachable from outside the server without going through the proxy.

---

## License

See [LICENSE](LICENSE).

---

## Author

Matthew McDuffie — www.johnmcduffie.com
