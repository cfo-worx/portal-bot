// server/routes/helpdeskRoutes.js
import express from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';
import {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
  addComment,
  addWorkLog,
  uploadAttachment,
  downloadAttachment,
} from '../controllers/helpdeskController.js';
import uploadTicketAttachment from '../utils/uploadTicketAttachment.js';

const router = express.Router();

// Require authentication for all helpdesk endpoints
router.use(authenticateJWT);

// Ticket CRUD
router.get('/tickets', listTickets);
router.post('/tickets', createTicket);
router.get('/tickets/:ticketId', getTicket);
router.put('/tickets/:ticketId', updateTicket);

// Comments
router.post('/tickets/:ticketId/comments', addComment);

// Work logs (Admin/Manager only)
router.post('/tickets/:ticketId/worklogs', authorizeRoles('Admin', 'Manager'), addWorkLog);

// Attachments
router.post('/tickets/:ticketId/attachments', uploadTicketAttachment.single('file'), uploadAttachment);
router.get('/tickets/:ticketId/attachments/:attachmentId/download', downloadAttachment);

export default router;

