import pg from 'pg';

const { Pool } = pg;

let pool;

export async function connectDB() {
  pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await pool.query('SELECT 1');
  console.log('Database connected');
}

export function getDB() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}
