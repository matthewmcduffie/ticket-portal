import { Router } from 'express';
import multer from 'multer';
import { mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import {
  listProjects, createProject, getProject, updateProject, deleteProject,
  getMembers, addMember, removeMember,
  listProjectTickets, createProjectTicket, getProjectTicket, updateProjectTicket,
  getProjectTicketEvents, addProjectTicketComment,
  listProjectTicketAttachments, uploadProjectTicketAttachment,
  getMyInvitations, acceptInvitation, declineInvitation,
  listPolls, createPoll, votePoll, closePoll, deletePoll,
  listLabels, createLabel, deleteLabel, setTicketLabels,
  listMilestones, createMilestone, updateMilestone, deleteMilestone,
  getProjectActivity,
} from './projects.controller.js';
import { canUseProjects, projectsEnabled } from './projects.service.js';
import { requireAuth } from '../../middleware/auth.js';

async function requireProjectsAccess(req, res, next) {
  try {
    if (!canUseProjects(req.user)) return res.status(403).json({ error: 'Project access denied' });
    if (!(await projectsEnabled())) return res.status(403).json({ error: 'Projects are currently disabled' });
    next();
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
}

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
router.use(requireProjectsAccess);

// Invitations — must precede '/:id' so 'invitations' isn't treated as a project id
router.get('/invitations',                getMyInvitations);
router.post('/invitations/:id/accept',    acceptInvitation);
router.post('/invitations/:id/decline',   declineInvitation);

router.get('/',  listProjects);
router.post('/', createProject);

router.get('/:id',    getProject);
router.patch('/:id',  updateProject);
router.delete('/:id', deleteProject);

router.get('/:id/members',              getMembers);
router.post('/:id/members',             addMember);
router.delete('/:id/members/:userId',   removeMember);

router.get('/:id/activity', getProjectActivity);

router.get('/:id/labels',             listLabels);
router.post('/:id/labels',            createLabel);
router.delete('/:id/labels/:labelId', deleteLabel);

router.get('/:id/milestones',                 listMilestones);
router.post('/:id/milestones',                createMilestone);
router.patch('/:id/milestones/:milestoneId',  updateMilestone);
router.delete('/:id/milestones/:milestoneId', deleteMilestone);

router.get('/:id/polls',               listPolls);
router.post('/:id/polls',              createPoll);
router.post('/:id/polls/:pollId/vote', votePoll);
router.post('/:id/polls/:pollId/close', closePoll);
router.delete('/:id/polls/:pollId',    deletePoll);

router.get('/:id/tickets',                       listProjectTickets);
router.post('/:id/tickets',                      createProjectTicket);
router.get('/:id/tickets/:ticketId',             getProjectTicket);
router.patch('/:id/tickets/:ticketId',           updateProjectTicket);
router.get('/:id/tickets/:ticketId/events',      getProjectTicketEvents);
router.post('/:id/tickets/:ticketId/comments',   addProjectTicketComment);
router.put('/:id/tickets/:ticketId/labels',      setTicketLabels);
router.get('/:id/tickets/:ticketId/attachments', listProjectTicketAttachments);
router.post('/:id/tickets/:ticketId/attachments', dynamicUpload, uploadProjectTicketAttachment);

export default router;
