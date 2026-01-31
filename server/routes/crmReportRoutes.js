import express from 'express';
import {
  getKPISummary,
  getTrailing12Months,
  getSourceProductivity,
  getRepPerformance,
  getStageBreakdown,
  getActivityTrends,
  exportReport,
} from '../controllers/crmReportController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateJWT);

// KPI and reporting endpoints (Admin/Manager only)
router.get('/kpi-summary', authorizeRoles('Admin', 'Manager'), getKPISummary);
router.get('/trailing-12-months', authorizeRoles('Admin', 'Manager'), getTrailing12Months);
router.get('/source-productivity', authorizeRoles('Admin', 'Manager'), getSourceProductivity);
router.get('/rep-performance', authorizeRoles('Admin', 'Manager'), getRepPerformance);
router.get('/stage-breakdown', authorizeRoles('Admin', 'Manager'), getStageBreakdown);
router.get('/activity-trends', authorizeRoles('Admin', 'Manager'), getActivityTrends);
router.get('/export', authorizeRoles('Admin', 'Manager'), exportReport);

export default router;

