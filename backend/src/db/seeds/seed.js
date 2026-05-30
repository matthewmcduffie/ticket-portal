import bcrypt from 'bcryptjs';
import { getDB } from '../../config/database.js';

export async function runSeeds() {
  const db = getDB();

  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@tickets.local';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin1234!';

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) return;

  const hash = await bcrypt.hash(password, 12);
  await db.query(
    'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)',
    [email, 'Admin', hash, 'admin']
  );
  console.log(`Default admin created: ${email}`);
}
