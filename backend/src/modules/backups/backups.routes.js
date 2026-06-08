import { Router } from 'express';
import multer from 'multer';
import {
  getConfig, updateConfig, listHistory, testAndBackup,
  listCloudObjects, restoreFromCloud, restoreFromUploadJson, restoreFromUploadSql, listRestoreHistory,
} from './backups.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';

// Restore uploads are parsed entirely in memory — they're processed (parsed
// JSON / piped to psql) immediately and never written to disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/',          getConfig);
router.patch('/',        updateConfig);
router.get('/history',   listHistory);
router.post('/test',     testAndBackup);

router.get('/cloud-objects',         listCloudObjects);
router.post('/restore/cloud',        restoreFromCloud);
router.post('/restore/upload-json',  upload.single('file'), restoreFromUploadJson);
router.post('/restore/upload-sql',   upload.single('file'), restoreFromUploadSql);
router.get('/restore/history',       listRestoreHistory);

export default router;
