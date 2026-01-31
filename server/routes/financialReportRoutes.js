import express from 'express';
import { getFinancialData } from '../controllers/financialReportController.js';

const router = express.Router();

// Get financial reporting data
router.get('/', getFinancialData);

export default router;

