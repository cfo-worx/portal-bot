import express from 'express';
import roiController from '../controllers/roiController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Base auth for all ROI endpoints
router.use(authenticateJWT);

// Settings (Admin only)
router.get('/settings', authorizeRoles('Admin', 'Manager', 'Consultant'), roiController.getSettings);
router.post('/settings/activity-tags', authorizeRoles('Admin'), roiController.upsertActivityTag);
router.put('/settings/activity-tags/:id', authorizeRoles('Admin'), roiController.upsertActivityTag);
router.post('/settings/rejection-reasons', authorizeRoles('Admin'), roiController.upsertRejectionReason);
router.put('/settings/rejection-reasons/:id', authorizeRoles('Admin'), roiController.upsertRejectionReason);

// Wins
router.get('/wins', authorizeRoles('Admin', 'Manager', 'Consultant'), roiController.listWins);
router.get('/wins/:id', authorizeRoles('Admin', 'Manager', 'Consultant'), roiController.getWin);
router.post('/wins', authorizeRoles('Admin', 'Manager', 'Consultant'), roiController.createWin);
router.put('/wins/:id', authorizeRoles('Admin', 'Manager', 'Consultant'), roiController.updateWin);
router.delete('/wins/:id', authorizeRoles('Admin'), roiController.deleteWin);

// Status transitions
router.post('/wins/:id/submit', authorizeRoles('Consultant', 'Manager', 'Admin'), roiController.submitWin);
router.post('/wins/:id/approve', authorizeRoles('Manager', 'Admin'), roiController.approveWin);
router.post('/wins/:id/reject', authorizeRoles('Manager', 'Admin'), roiController.rejectWin);

// Dashboard
router.get('/dashboard', authorizeRoles('Admin', 'Manager', 'Consultant'), roiController.dashboard);

export default router;
