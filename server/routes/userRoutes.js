// backend/routes/userRoutes.js

import express from 'express';
import {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  sendInvite,
  sendClientInvite,
  setPassword,
  login,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/', getUsers);
router.post('/', addUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/:id/invite', sendInvite);
router.post('/:id/client-invite', sendClientInvite);
router.post('/set-password', setPassword);
router.post('/login', login);

export default router;
