import express from 'express';
import {
  getDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  getDealNotes,
  createDealNote,
  deleteDealNote,
  getDealActivities,
  createDealActivity,
  deleteDealActivity,
  getDealNotesAndActivities,
  createDealNoteOrActivity,
  getDealAttachments,
  uploadDealAttachment,
  downloadDealAttachment,
  deleteDealAttachment,
} from '../controllers/crmDealController.js';
import { uploadDealAttachment as uploadMiddleware } from '../utils/uploadDealAttachment.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();


// ========== DEALS ==========
router.get('/', getDeals);
router.post('/', createDeal);

// ========== DEAL NOTES ==========
// Note: These routes must come before /:id to avoid route conflicts
router.get('/:dealId/notes', getDealNotes);
router.post('/:dealId/notes', createDealNote);
router.delete('/:dealId/notes/:noteId', deleteDealNote);

// ========== UNIFIED NOTES & ACTIVITIES ==========
router.get('/:dealId/timeline', getDealNotesAndActivities);
router.post('/:dealId/timeline', createDealNoteOrActivity);

// ========== DEAL ATTACHMENTS ==========
router.get('/:dealId/attachments', getDealAttachments);
router.post('/:dealId/attachments', uploadMiddleware.single('file'), uploadDealAttachment);
router.get('/:dealId/attachments/:attachmentId/download', downloadDealAttachment);
router.delete('/:dealId/attachments/:attachmentId', deleteDealAttachment);

// ========== DEAL ACTIVITIES ==========
// Note: These routes must come before /:id to avoid route conflicts
router.get('/:dealId/activities', getDealActivities);
router.post('/:dealId/activities', createDealActivity);
router.delete('/:dealId/activities/:activityId', deleteDealActivity);

// ========== DEAL CRUD ==========
// These parameterized routes must come after the nested routes
router.get('/:id', getDealById);
router.put('/:id', updateDeal);
router.delete('/:id', deleteDeal);

export default router;

