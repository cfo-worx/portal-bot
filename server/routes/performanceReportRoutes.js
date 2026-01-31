import express from 'express';
import {
  getPerformanceReport,
  getWeeklyIssues,
  upsertIssueNote,
  getContractsEnding,
  getReportRoles,
  getWeeklyReviewSessions,
  getPriorWeekReviewSessions,
  upsertWeeklyReviewSession,
  deleteWeeklyReviewSession,
  getCapacityPlanning,
} from '../controllers/performanceReportController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// All performance reporting endpoints require at least Manager access
router.use(authenticateJWT, authorizeRoles('Admin', 'Manager'));

router.get('/', getPerformanceReport);
router.get('/issues', getWeeklyIssues);
router.put('/issue-note', upsertIssueNote);
router.get('/contracts-ending', getContractsEnding);
router.get('/roles', getReportRoles);
router.get('/capacity-planning', getCapacityPlanning);

// Weekly Review Session endpoints
router.get('/weekly-review-sessions', getWeeklyReviewSessions);
router.get('/weekly-review-sessions/prior-week', getPriorWeekReviewSessions);
router.post('/weekly-review-sessions', upsertWeeklyReviewSession);
router.put('/weekly-review-sessions/:sessionId', upsertWeeklyReviewSession);
router.delete('/weekly-review-sessions/:sessionId', deleteWeeklyReviewSession);

export default router;
