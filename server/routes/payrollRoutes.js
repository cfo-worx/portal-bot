import express from 'express';
import {
  listPayrollRuns,
  createPayrollRun,
  getPayrollRun,
  calculatePayrollRun,
  finalizePayrollRun,
  listPayrollRunExceptions,
  upsertPayrollAdjustment,
} from '../controllers/payrollController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Payroll is Admin-only
router.use(authenticateJWT, authorizeRoles('Admin'));

router.get('/runs', listPayrollRuns);
router.post('/runs', createPayrollRun);
router.get('/runs/:payrollRunId', getPayrollRun);
router.post('/runs/:payrollRunId/calculate', calculatePayrollRun);
router.post('/runs/:payrollRunId/finalize', finalizePayrollRun);
router.get('/runs/:payrollRunId/exceptions', listPayrollRunExceptions);
router.post('/adjustments', upsertPayrollAdjustment);

export default router;
