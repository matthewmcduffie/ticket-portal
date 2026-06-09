import { Router } from 'express';
import multer from 'multer';
import { mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import {
  getTickets, getTicket, createTicket, updateTicket, deleteTicket,
  getTicketEvents, getRecentActivity, mergeTickets, addComment,
  uploadAttachment, listAttachments,
  getShares, addShare, removeShare,
} from './tickets.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';
mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip', 'application/x-zip-compressed',
  'text/plain', 'text/csv',
]);

const diskStore = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${randomBytes(16).toString('hex')}${extname(file.originalname)}`),
});

function mimeFilter(req, file, cb) { cb(null, ALLOWED_MIME.has(file.mimetype)); }

async function dynamicUpload(req, res, next) {
  try {
    const { getUploadConfig } = await import('../attachments/attachments.service.js');
    const config = await getUploadConfig();
    if (!config.enabled) {
      return res.status(403).json({ error: 'File uploads are currently disabled.' });
    }
    req.uploadConfig = config;
    multer({
      storage: diskStore,
      limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: 10 },
      fileFilter: mimeFilter,
    }).array('files', 10)(req, res, err => {
      if (err) {
        // Multer emits LIMIT_FILE_SIZE before writing the full file
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: `File exceeds the ${config.maxFileSizeMb} MB per-file limit.` });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Maximum 10 files per upload.' });
        }
        return next(err);
      }
      next();
    });
  } catch (err) {
    next(err);
  }
}

const router = Router();

router.use(requireAuth);

router.get('/activity', requireRole('admin', 'technician'), getRecentActivity);

router.get('/',     getTickets);
router.post('/',    createTicket);

router.get('/:id',           getTicket);
router.patch('/:id',         updateTicket);
router.delete('/:id',        requireRole('admin', 'technician'), deleteTicket);
router.get('/:id/events',       getTicketEvents);
router.post('/:id/comments',    addComment);
router.post('/:id/merge',       requireRole('admin', 'technician'), mergeTickets);
router.get('/:id/attachments',  listAttachments);
router.post('/:id/attachments', dynamicUpload, uploadAttachment);

router.get('/:id/shares',           getShares);
router.post('/:id/shares',          addShare);
router.delete('/:id/shares/:userId', removeShare);

export default router;
