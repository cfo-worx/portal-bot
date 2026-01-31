// client/src/api/subtasks.js
import axios from './index';

export const subtaskService = {
  async getByTask(taskId) {
    const response = await axios.get(`/tasks/${taskId}/subtasks`);
    return response.data;
  },

  async create(subtaskData) {
    const response = await axios.post('/subtasks', subtaskData);
    return response.data;
  },

  async update(id, updates) {
    await axios.patch(`/subtasks/${id}`, updates);
  },

  async delete(id) {
    await axios.delete(`/subtasks/${id}`);
  }
};