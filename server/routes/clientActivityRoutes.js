import express from 'express';
import { getClientActivityReport, exportClientActivityCsv } from '../controllers/clientActivityController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateJWT);
router.use(authorizeRoles('Admin', 'Manager'));

router.get('/report', getClientActivityReport);
router.get('/report.csv', exportClientActivityCsv);

export default router;
