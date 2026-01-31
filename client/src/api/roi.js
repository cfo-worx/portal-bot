import api from './index';

export const getROISettings = async () => {
  const response = await api.get('/roi/settings');
  return response.data;
};

export const upsertROIActivityTag = async (payload) => {
  // Use PUT for updates (when activityTagId is provided), POST for creates
  if (payload.activityTagId) {
    // Backend expects activityTagID (capital ID) in body, and ID in URL path
    const response = await api.put(`/roi/settings/activity-tags/${payload.activityTagId}`, {
      activityTagID: payload.activityTagId,
      name: payload.name,
      isActive: payload.isActive,
    });
    return response.data;
  } else {
    const response = await api.post('/roi/settings/activity-tags', payload);
    return response.data;
  }
};

export const upsertROIRejectionReason = async (payload) => {
  const response = await api.post('/roi/settings/rejection-reasons', payload);
  return response.data;
};

export const getROIWins = async (params = {}) => {
  const response = await api.get('/roi/wins', { params });
  return response.data;
};

export const getROIWin = async (winId) => {
  const response = await api.get(`/roi/wins/${winId}`);
  return response.data;
};

export const createROIWin = async (payload) => {
  const response = await api.post('/roi/wins', payload);
  return response.data;
};

export const updateROIWin = async (winId, payload) => {
  const response = await api.put(`/roi/wins/${winId}`, payload);
  return response.data;
};

export const deleteROIWin = async (winId) => {
  const response = await api.delete(`/roi/wins/${winId}`);
  return response.data;
};

export const submitROIWin = async (winId) => {
  const response = await api.post(`/roi/wins/${winId}/submit`);
  return response.data;
};

export const approveROIWin = async (winId) => {
  const response = await api.post(`/roi/wins/${winId}/approve`);
  return response.data;
};

export const rejectROIWin = async (winId, payload) => {
  const response = await api.post(`/roi/wins/${winId}/reject`, payload);
  return response.data;
};

export const getROIDashboard = async (params = {}) => {
  const response = await api.get('/roi/dashboard', { params });
  return response.data;
};
