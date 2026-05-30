import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { loadModules } from './config/modules.js';

export async function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || '*',
    credentials: true,
  }));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  await loadModules(app);

  return app;
}
