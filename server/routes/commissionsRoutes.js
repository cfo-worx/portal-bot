import express from 'express';
import {
  listQboCustomerMappings,
  upsertQboCustomerMapping,
  importQboPayments,
  listCommissionAgreements,
  upsertCommissionAgreement,
  calculateCommissionAccruals,
  listCommissionAccruals,
  markCommissionAccrualPaid,
} from '../controllers/commissionsController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateJWT);

// Commissions should be available to Admin, Manager, and Sales
router.use(authorizeRoles('Admin', 'Manager', 'Sales'));

router.get('/qbo/mappings', listQboCustomerMappings);
router.post('/qbo/mappings', upsertQboCustomerMapping);
router.post('/qbo/payments/import', importQboPayments);

router.get('/agreements', listCommissionAgreements);
router.post('/agreements', upsertCommissionAgreement);

router.post('/accruals/calculate', calculateCommissionAccruals);
router.get('/accruals', listCommissionAccruals);
router.post('/accruals/:accrualId/mark-paid', markCommissionAccrualPaid);

export default router;
