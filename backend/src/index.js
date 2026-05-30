import 'dotenv/config';
import { createApp } from './app.js';
import { connectDB } from './config/database.js';
import { runMigrations } from './db/migrate.js';
import { runSeeds } from './db/seeds/seed.js';

const PORT = process.env.PORT || 3001;

async function start() {
  await connectDB();
  await runMigrations();
  await runSeeds();
  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
