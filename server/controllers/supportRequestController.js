// server/controllers/supportRequestController.js
import SupportRequest from '../models/SupportRequest.js';

export const getSupportRequestsByProject = async (req, res) => {
  try {
    const requests = await SupportRequest.getByProject(req.params.projectId);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createSupportRequest = async (req, res) => {
  try {
    const requestId = await SupportRequest.create(req.body);
    res.status(201).json({ id: requestId });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSupportRequestStatus = async (req, res) => {
  try {
    await SupportRequest.updateStatus(req.params.id, req.body.status);
    res.json({ message: 'Support request status updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};