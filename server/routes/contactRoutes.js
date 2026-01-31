// server/routes/contactRoutes.js

import express from 'express';
import {
  getContactsByClient,
  addContact,
  updateContact,
  deleteContact,
} from '../controllers/contactController.js';

const router = express.Router({ mergeParams: true }); // Important: mergeParams allows access to parent params

// GET /api/clients/:clientId/contacts
router.get('/', getContactsByClient);

// POST /api/clients/:clientId/contacts
router.post('/', addContact);

// PUT /api/clients/:clientId/contacts/:contactId
router.put('/:contactId', updateContact);

// DELETE /api/clients/:clientId/contacts/:contactId
router.delete('/:contactId', deleteContact);

export default router;
