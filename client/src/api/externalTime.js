import api from './index';

export const listExternalTimeLinks = async () => {
  const res = await api.get('/external-time/links');
  return res.data;
};

export const upsertExternalTimeLink = async (payload) => {
  const res = await api.post('/external-time/links', payload);
  return res.data;
};

export const importExternalTimeEntries = async (payload) => {
  const res = await api.post('/external-time/import', payload);
  return res.data;
};

export const listExternalTimeEntries = async (params = {}) => {
  const res = await api.get('/external-time/entries', { params });
  return res.data;
};

