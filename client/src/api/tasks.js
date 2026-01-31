// client/src/api/tasks.js
import axios from './index';

export const taskService = {
  getByProject: async (projectId) => {
    const response = await axios.get(`/projects/${projectId}/tasks`);
    return response.data;
  },

  reorder: async (projectId, taskIds) => {
    await axios.put('/tasks/reorder', { 
      projectId,
      taskIds 
    });
  },

  create: async (taskData) => {
    const response = await axios.post('/tasks', taskData);
    return response.data;
  },

  update: async (id, updates) => {
    await axios.patch(`/tasks/${id}`, updates);
  },

  delete: async (id) => {
    await axios.delete(`/tasks/${id}`);
  },

  assignConsultant: async (taskId, consultantId) => {
    await axios.put(`/tasks/${taskId}/consultants`, { consultantId });
  },

  removeConsultant: async (taskId, consultantId) => {
    await axios.delete(`/tasks/${taskId}/consultants/${consultantId}`);
  }
};