// routes/consultantRoutes.js
import express from 'express';
import {
  getConsultants,
  getActiveConsultants,
  addConsultant,
  updateConsultant,
  deleteConsultant,
  sendReminder,
} from '../controllers/consultantController.js';

const router = express.Router();

router.get('/', getConsultants);
router.get('/active', getActiveConsultants);
router.post('/', addConsultant);
router.put('/:id', updateConsultant);
router.delete('/:id', deleteConsultant);
router.post('/:id/reminder', sendReminder);

export default router;
