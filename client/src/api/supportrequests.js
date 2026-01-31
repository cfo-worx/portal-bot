// client/src/api/supportrequests.js
import axios from './index';

export const supportRequestService = {
  async getByProject(projectId) {
    const response = await axios.get(`/support-requests/project/${projectId}`);
    return response.data;
  },

  async create(requestData) {
    const response = await axios.post('/support-requests', requestData);
    return response.data;
  },

  async updateStatus(id, status) {
    await axios.patch(`/support-requests/${id}/status`, { status });
  }
};