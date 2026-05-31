import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadModules } from './config/modules.js';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://tickets.thelastpatch.com';

// CSRF defense-in-depth: reject state-changing requests whose Origin doesn't
// match the allowed origin. SameSite=strict cookies already prevent CSRF
// from cross-site requests, but this is an independent second layer.
function csrfOriginCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin || req.headers.referer;
  if (origin && !origin.startsWith(ALLOWED_ORIGIN)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export async function createApp() {
  const app = express();

  // Trust Caddy reverse proxy so req.ip reflects the real client IP
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:      ["'self'"],
        scriptSrc:       ["'self'"],
        styleSrc:        ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:         ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:          ["'self'", 'data:', 'blob:'],
        connectSrc:      ["'self'"],
        objectSrc:       ["'none'"],
        frameAncestors:  ["'none'"],
        baseUri:         ["'self'"],
        formAction:      ["'self'"],
      },
    },
    // Caddy sets HSTS automatically; add it here too for defense-in-depth
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  }));

  app.use(cors({
    origin: ALLOWED_ORIGIN,
    credentials: true,
  }));
  app.use(csrfOriginCheck);
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  await loadModules(app);

  return app;
}
