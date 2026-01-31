import express from 'express';
import {
  listSpaces,
  createSpace,
  getSpace,
  addSpaceMember,
  listTasks,
  createTask,
  updateTask,
  addTaskComment,
  listTaskComments,
} from '../controllers/collaborationController.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateJWT);
router.use(authorizeRoles('Admin', 'Manager'));

router.get('/spaces', listSpaces);
router.post('/spaces', createSpace);
router.get('/spaces/:id', getSpace);
router.post('/spaces/:id/members', addSpaceMember);

router.get('/tasks', listTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', updateTask);
router.get('/tasks/:id/comments', listTaskComments);
router.post('/tasks/:id/comments', addTaskComment);

export default router;
