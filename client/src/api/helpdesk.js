// client/src/api/helpdesk.js
import axios from './index';

export const helpdeskService = {
  listTickets: async (params = {}) => {
    const response = await axios.get('/helpdesk/tickets', { params });
    return response.data;
  },

  getTicket: async (ticketId) => {
    const response = await axios.get(`/helpdesk/tickets/${ticketId}`);
    return response.data;
  },

  createTicket: async (payload) => {
    const response = await axios.post('/helpdesk/tickets', payload);
    return response.data;
  },

  updateTicket: async (ticketId, updates) => {
    const response = await axios.put(`/helpdesk/tickets/${ticketId}`, updates);
    return response.data;
  },

  addComment: async (ticketId, body) => {
    const response = await axios.post(`/helpdesk/tickets/${ticketId}/comments`, { body });
    return response.data;
  },

  addWorkLog: async (ticketId, minutes, note) => {
    const response = await axios.post(`/helpdesk/tickets/${ticketId}/worklogs`, { minutes, note });
    return response.data;
  },

  uploadAttachment: async (ticketId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`/helpdesk/tickets/${ticketId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  downloadAttachment: async (ticketId, attachmentId) => {
    const response = await axios.get(
      `/helpdesk/tickets/${ticketId}/attachments/${attachmentId}/download`,
      { responseType: 'blob' }
    );
    return response;
  },
};

