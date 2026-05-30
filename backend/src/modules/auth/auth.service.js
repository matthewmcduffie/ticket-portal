import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDB } from '../../config/database.js';

export async function authenticateUser(email, password) {
  const db = getDB();
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1 AND active = true',
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  return valid ? user : null;
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}
