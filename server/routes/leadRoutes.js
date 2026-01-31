import express from 'express';
import {
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  importLeads,
  getImportBatches,
  getImportBatchErrors,
  getDuplicateGroups,
} from '../controllers/leadController.js';
import uploadLeadFile from '../utils/uploadLeadFile.js';
import { authenticateJWT } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and Admin/Manager role
router.use(authenticateJWT);
router.use(authorizeRoles('Admin', 'Manager'));

// Lead CRUD operations
router.get('/', getLeads);
router.get('/duplicates', getDuplicateGroups);
router.get('/:id', getLeadById);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);

// Import operations
router.post('/import', uploadLeadFile.single('file'), importLeads);
router.get('/import/batches', getImportBatches);
router.get('/import/batches/:batchId/errors', getImportBatchErrors);

export default router;

