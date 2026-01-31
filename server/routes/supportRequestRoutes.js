// server/routes/supportRequestRoutes.js
import express from 'express';
import SupportRequest from '../models/SupportRequest.js';

const router = express.Router();

router.get('/project/:projectId', async (req, res) => {
  try {
    const requests = await SupportRequest.getByProject(req.params.projectId);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const requestId = await SupportRequest.create(req.body);
    res.status(201).json({ id: requestId });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    await SupportRequest.updateStatus(req.params.id, req.body.status);
    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;