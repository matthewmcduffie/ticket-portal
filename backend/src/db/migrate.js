import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDB } from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const db = getDB();

  await db.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const dir = join(__dirname, 'migrations');
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const already = await db.query('SELECT id FROM migrations WHERE name = $1', [file]);
    if (already.rows.length) continue;

    const sql = readFileSync(join(dir, file), 'utf8');
    await db.query(sql);
    await db.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    console.log(`Migration applied: ${file}`);
  }
}
