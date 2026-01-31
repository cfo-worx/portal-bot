import express from 'express';
import {
  // Stages
  getStages,
  updateStage,
  // Lead Sources
  getLeadSources,
  createLeadSource,
  updateLeadSource,
  deleteLeadSource,
  // Canned Replies
  getCannedReplies,
  createCannedReply,
  updateCannedReply,
  deleteCannedReply,
  // Rep Goals
  getRepGoals,
  createRepGoal,
  updateRepGoal,
  getOrCreateRepGoal,
  deleteRepGoal,
} from '../controllers/crmSettingsController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ========== STAGES ==========
router.get('/stages', getStages);
router.put('/stages/:id', updateStage);

// ========== LEAD SOURCES ==========
router.get('/lead-sources', getLeadSources);
router.post('/lead-sources', createLeadSource);
router.put('/lead-sources/:id', updateLeadSource);
router.delete('/lead-sources/:id', deleteLeadSource);

// ========== CANNED REPLIES ==========
router.get('/canned-replies', getCannedReplies);
router.post('/canned-replies', createCannedReply);
router.put('/canned-replies/:id', updateCannedReply);
router.delete('/canned-replies/:id', deleteCannedReply);

// ========== REP GOALS ==========
router.get('/rep-goals', getRepGoals);
router.post('/rep-goals', createRepGoal);
router.put('/rep-goals/:id', updateRepGoal);
router.post('/rep-goals/get-or-create', getOrCreateRepGoal);
router.delete('/rep-goals/:id', deleteRepGoal);

export default router;

