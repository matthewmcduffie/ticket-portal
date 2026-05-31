import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, me, refresh, changePassword, resetPassword } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';

// IP-based rate limit: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this IP. Try again in 15 minutes.' },
});

const router = Router();

router.post('/login',           loginLimiter, login);
router.post('/logout',          requireAuth,  logout);
router.get('/me',               requireAuth,  me);
router.post('/refresh',                       refresh);
router.post('/change-password', requireAuth,  changePassword);
router.post('/reset-password',                resetPassword);

export default router;
