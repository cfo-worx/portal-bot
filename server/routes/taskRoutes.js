// server/routes/taskRoutes.js
import express from 'express';
import {
  getTasksByProject,
  createTask,
  updateTask,
  deleteTask,
  assignConsultant, 
  removeConsultant,
  reorderTasks
} from '../controllers/taskController.js';

const router = express.Router();

router.get('/project/:projectId', getTasksByProject);
router.post('/', createTask);
router.put('/reorder',     reorderTasks);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);  

router.put('/:taskId/consultants', assignConsultant);    
router.delete('/:taskId/consultants/:consultantId', removeConsultant); 

export default router;