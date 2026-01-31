// server/routes/clientRoutes.js

import express from 'express';
import {
  getClients,
  getClientById,
  getActiveClients,
  getActiveClientsForConsultant,
  addClient,
  updateClient,
  deleteClient,
  getOnboardingStep, 
  updateOnboardingStep,
  patchClient,
} from '../controllers/clientController.js';
import contactRoutes from './contactRoutes.js'; // For nested /contacts
import { authenticateJWT } from '../middleware/auth.js'; // <-- Import the middleware

const router = express.Router();

// GET /api/clients/
router.get('/', getClients);

// GET /api/clients/active
// Now requires a valid JWT, and uses consultantId from the token
router.get('/active', getActiveClients);

// 🔥 New route: active clients for a specific consultant
router.get('/active/:consultantId', getActiveClientsForConsultant);

// POST /api/clients/
router.post('/', addClient);

// PUT /api/clients/:id     ← you can leave this if you still want full-replacement...
router.put('/:id', updateClient);

// PATCH /api/clients/:id   ← partial updates: only the fields you send will change
router.patch('/:id', patchClient);

// DELETE /api/clients/:id
router.delete('/:id', deleteClient);

router.get('/:id', getClientById);

// Nested Contacts route
router.use('/:clientId/contacts', contactRoutes);

// GET current step
router.get('/:id/onboarding-step', getOnboardingStep);

// POST new step
router.put('/:clientId/onboarding-step', updateOnboardingStep);
router.patch('/:clientId/onboarding-step', updateOnboardingStep);



export default router;
