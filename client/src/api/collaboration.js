import api from './index';

export const listSpaces = async () => {
  const res = await api.get('/collaboration/spaces');
  return res.data;
};

export const createSpace = async (payload) => {
  const res = await api.post('/collaboration/spaces', payload);
  return res.data;
};

export const getSpace = async (spaceId) => {
  const res = await api.get(`/collaboration/spaces/${spaceId}`);
  return res.data;
};

export const addSpaceMember = async (spaceId, payload) => {
  const res = await api.post(`/collaboration/spaces/${spaceId}/members`, payload);
  return res.data;
};

export const listTasks = async ({ spaceId, status, assignedToUserId }) => {
  const res = await api.get('/collaboration/tasks', { params: { spaceId, status, assignedToUserId } });
  return res.data;
};

export const createTask = async (payload) => {
  const res = await api.post('/collaboration/tasks', payload);
  return res.data;
};

export const updateTask = async (taskId, patch) => {
  const res = await api.patch(`/collaboration/tasks/${taskId}`, patch);
  return res.data;
};

export const listTaskComments = async (taskId) => {
  const res = await api.get(`/collaboration/tasks/${taskId}/comments`);
  return res.data;
};

export const addTaskComment = async (taskId, payload) => {
  const res = await api.post(`/collaboration/tasks/${taskId}/comments`, payload);
  return res.data;
};
