// client/src/api/projects.js
import axios from './index';

export const projectService = {
  async getAll() {
    const response = await axios.get('/projects');
    return response.data;
  },

  async getById(id) {
    const response = await axios.get(`/projects/${id}`);
    return response.data;
  },

  async create(projectData) {
    const response = await axios.post('/projects', projectData);
    return response.data;
  },

  async update(id, updates) {
    await axios.patch(`/projects/${id}`, updates);
  },

  async delete(id) {
    await axios.delete(`/projects/${id}`);
  },

  async getTasks(projectId) {
    const response = await axios.get(`/projects/${projectId}/tasks`);
    return response.data;
  },

  async clone(id, cloneData) {
    const { data } = await axios.post(`/projects/${id}/clone`, cloneData);
    return data.ProjectID;
  },

    async cloneRecurring(id) {
    const response = await axios.post(`/projects/${id}/clone-recurring`);
    return response.data.ProjectID;
  },

  async saveAsTemplate(id, templateName) {
  const { data } = await axios.post(`/projects/${id}/save-as-template`, { TemplateName: templateName });
  return data.TemplateID;
}


};

