// server/controllers/taskController.js
import Task from '../models/Task.js';

export const getTasksByProject = async (req, res) => {
  try {
    const tasks = await Task.getByProject(req.params.projectId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const taskId = await Task.create(req.body);
    res.status(201).json({ id: taskId });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTask = async (req, res) => {
  try {
    await Task.update(req.params.id, req.body);
    res.json({ message: 'Task updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    await Task.delete(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }

  
};


// Add these new controller functions
export const assignConsultant = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { consultantId } = req.body;
    
    await Task.assignConsultant(taskId, consultantId);
    res.json({ message: 'Consultant assigned successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const removeConsultant = async (req, res) => {
  try {
    const { taskId, consultantId } = req.params;
    await Task.removeConsultant(taskId, consultantId);
    res.json({ message: 'Consultant removed successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


export const reorderTasks = async (req, res) => {
  try {
    const { projectId, taskIds } = req.body;
    
    if (!projectId || !Array.isArray(taskIds)) {
      return res.status(400).json({ 
        message: 'Invalid request: projectId and taskIds array required' 
      });
    }

    await Task.reorder(projectId, taskIds);
    res.sendStatus(204);
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ 
      message: error.message.includes('Failed to reorder') 
        ? error.message 
        : 'Internal server error'
    });
  }
}; 