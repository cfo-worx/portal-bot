import axios from './index';

export const templateService = {
  async getAll() {
    const res = await axios.get('/templates');
    return res.data;
  },

  async saveFromProject(projectID, templateName) {
    const { data } = await axios.post(`/templates/from-project/${projectID}`, { TemplateName: templateName });
    return data.TemplateID;
  },

  async clone(templateID, cloneData) {
    const { data } = await axios.post(`/templates/${templateID}/clone`, cloneData);
    return data.ProjectID;
  },

  async delete(id){ await axios.delete(`/templates/${id}`); }
  
};


