// server/routes/subtaskRoutes.js
import express from 'express';
import {
  getSubtasksByTask,
  createSubtask,
  updateSubtask,
  deleteSubtask
} from '../controllers/subtaskController.js';

const router = express.Router();

router.get('/task/:taskId', getSubtasksByTask);
router.post('/', createSubtask);
router.patch('/:id', updateSubtask);
router.delete('/:id', deleteSubtask);

export default router;