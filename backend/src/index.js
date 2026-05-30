import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/database.js';
import { runMigrations } from './db/migrate.js';
import { runSeeds } from './db/seeds/seed.js';

const PORT = process.env.PORT || 3001;

async function startEmailPoller() {
  if (!process.env.AGENTMAIL_API_KEY) return;
  const INTERVAL = parseInt(process.env.EMAIL_POLL_INTERVAL_MS || '60000');
  const { pollInbox } = await import('./modules/email/email.service.js');
  async function poll() {
    try {
      const created = await pollInbox();
      if (created.length) console.log(`Email poll: ${created.length} new ticket(s) created`);
    } catch (err) {
      console.error('Email poll error:', err.message);
    }
  }
  await poll(); // run once at startup
  setInterval(poll, INTERVAL);
  console.log(`Email poller running every ${INTERVAL / 1000}s`);
}

async function start() {
  await connectDB();
  await runMigrations();
  await runSeeds();
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
  await startEmailPoller();
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
