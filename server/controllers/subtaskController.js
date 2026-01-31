// server/controllers/subtaskController.js
import Subtask from '../models/Subtask.js';

export const getSubtasksByTask = async (req, res) => {
  try {
    const subtasks = await Subtask.getByTask(req.params.taskId);
    res.json(subtasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createSubtask = async (req, res) => {
  try {
    const subtaskId = await Subtask.create(req.body);
    res.status(201).json({ id: subtaskId });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSubtask = async (req, res) => {
  try {
    await Subtask.update(req.params.id, req.body);
    res.json({ message: 'Subtask updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSubtask = async (req, res) => {
  try {
    await Subtask.delete(req.params.id);
    res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};