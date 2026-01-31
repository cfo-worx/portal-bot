import express from 'express';
import {
  getBuySideClients,
  getBuySideClientById,
  createBuySideClient,
  updateBuySideClient,
  deleteBuySideClient,
  getBuySideCampaigns,
  getBuySideCampaignById,
  getBuySideCampaignsByClient,
  createBuySideCampaign,
  updateBuySideCampaign,
  deleteBuySideCampaign,
} from '../controllers/buySideController.js';
import { authenticateJWT } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication and Admin/Manager role
router.use(authenticateJWT);
router.use(authorizeRoles('Admin', 'Manager'));

// Client routes
router.get('/clients', getBuySideClients);
router.get('/clients/:id', getBuySideClientById);
router.post('/clients', createBuySideClient);
router.put('/clients/:id', updateBuySideClient);
router.delete('/clients/:id', deleteBuySideClient);

// Campaign routes
router.get('/campaigns', getBuySideCampaigns);
router.get('/campaigns/client/:clientId', getBuySideCampaignsByClient);
router.get('/campaigns/:id', getBuySideCampaignById);
router.post('/campaigns', createBuySideCampaign);
router.put('/campaigns/:id', updateBuySideCampaign);
router.delete('/campaigns/:id', deleteBuySideCampaign);

export default router;

