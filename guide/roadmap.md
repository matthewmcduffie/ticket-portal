# Tickets — Product Roadmap

**App:** Tickets (branding TBD)
**Domain:** tickets.thelastpatch.com
**Stack:** React + Node/Express + PostgreSQL — fully Dockerized

---

## Phase 1 — Foundation ✅ (Current)

Core scaffold with working auth, ticket management, and settings.

- [x] Project structure with modular backend (features toggle-able via `modules.js`)
- [x] Docker Compose — postgres, backend, frontend, nginx reverse proxy
- [x] PostgreSQL with auto-running migrations and `migrations` tracking table
- [x] JWT authentication — login, session persistence, `/auth/me`
- [x] Admin and User roles with middleware-enforced access control
- [x] Default admin seeded on first boot (credentials via `.env`)
- [x] Dashboard — ticket stats + recent activity panel
- [x] Tickets page — list, filter by status/priority, create, edit
- [x] Settings page — admin-editable key/value app settings
- [x] Responsive layout — fixed sidebar, sticky header, content area
- [x] CSS-only styling — no Tailwind, no inline styles, design token system via CSS variables
- [x] `.env`-driven configuration — no hardcoded URLs or domain names
- [x] `.gitignore` covering all subdirectories with `**/` patterns
- [x] Git initialized at repo root

---

## Phase 2 — Core Usability

Daily-use features that make the system practical for a team.

- [ ] Ticket detail view (full description, metadata, edit history)
- [ ] Comments / activity thread on each ticket
- [ ] File attachments (store in local volume or S3-compatible)
- [ ] Pagination on ticket list (use `tickets_per_page` setting already in DB)
- [ ] Search — full-text across title and description
- [ ] Ticket assignment — assign to any active user
- [ ] User management page (admin: list, invite, deactivate, change role)
- [ ] Password change flow (user self-service)
- [ ] Email notifications via SMTP (toggle-able module)

---

## Phase 3 — Team Features

Collaboration tools for shared queues and visibility.

- [ ] Tags / labels on tickets (filterable)
- [ ] Ticket categories / queues
- [ ] Bulk operations (change status, reassign, close)
- [ ] Kanban board view (toggle-able module alongside list view)
- [ ] CSV export of ticket list
- [ ] Due dates and overdue flagging
- [ ] Ticket watchers — follow without owning
- [ ] Ticket templates for repeatable request types

---

## Phase 4 — Operations & Admin

Confidence, auditability, and production hardening.

- [ ] Audit log — who changed what and when on every ticket
- [ ] Email-based user invite system
- [ ] Branding settings — app name and logo configurable from Settings UI
  - Note: `app_name` is already in `app_settings` table; wire it to the header/title
- [ ] HTTPS support — Certbot/Let's Encrypt integration in Docker
- [ ] Rate limiting on auth endpoints
- [ ] Backup and restore tooling for the postgres volume
- [ ] DB connection pooling tuning
- [ ] Health check dashboard page (uses existing `/api/health` endpoint)

---

## Phase 5 — Integrations

Connect with tools teams already use. All as toggle-able modules.

- [ ] Webhook module — fire on ticket create/update/close
- [ ] Slack notifications module
- [ ] GitHub Issues sync module
- [ ] API key auth (for headless / service integrations)
- [ ] OpenAPI / Swagger docs endpoint

---

## Architecture Notes

### Module System
Each backend feature is a folder under `backend/src/modules/` with its own `routes`, `controller`, and `service` files. The module registry lives in `backend/src/config/modules.js` — set a key to `false` to disable it at startup with no other code changes. New modules register automatically when the key is added and the folder is created.

### Frontend Styling
No framework. Design tokens live in `frontend/src/styles/variables.css` as CSS custom properties. Each component or page imports its own `.css` file. Shared patterns (buttons, badges, form inputs) are in `global.css` and available everywhere.

### Database
Migrations are plain `.sql` files in `backend/src/db/migrations/`, named `001_…`, `002_…` etc. They run in order on every startup — already-applied migrations are tracked in a `migrations` table and skipped. To add a migration, drop a new numbered file; no tooling needed.

### Domain & URLs
`APP_DOMAIN` in `.env` is for documentation only — no code reads it. The API URL is injected at frontend build time via `VITE_API_URL` (defaults to `/api`). Nginx routes `/api/*` to the backend and `/*` to the frontend. Changing domains only requires DNS update + SSL cert.

---

## Deployment Checklist

1. Copy `.env.example` → `.env` and fill in all values
2. Generate a strong `JWT_SECRET`: `openssl rand -base64 64`
3. Set a real `DEFAULT_ADMIN_PASSWORD` — change it again after first login
4. Point DNS for `tickets.thelastpatch.com` to this server (port 80)
5. Run: `docker compose up -d --build`
6. Verify: `curl http://tickets.thelastpatch.com/api/health` → `{"status":"ok"}`
7. Log in with the admin credentials from `.env`
8. Go to Settings and update `app_name` if needed
