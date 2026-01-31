import express from 'express';
import {
  listIntegrationLinks,
  upsertIntegrationLink,
  importExternalTimeEntries,
  listExternalTimeEntries,
} from '../controllers/externalTimeController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);
router.use(authorizeRoles('Admin'));

router.get('/links', listIntegrationLinks);
router.post('/links', upsertIntegrationLink);
router.post('/import', importExternalTimeEntries);
router.get('/entries', listExternalTimeEntries);

export default router;
