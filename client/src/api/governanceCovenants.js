import api from "./index";

// Covenants
export const fetchCovenants = async (params = {}) => {
  const res = await api.get("/governance/covenants", { params });
  return res.data;
};

export const fetchCovenant = async (covenantId) => {
  const res = await api.get(`/governance/covenants/${covenantId}`);
  return res.data;
};

export const createCovenant = async (payload) => {
  const res = await api.post("/governance/covenants", payload);
  return res.data;
};

export const updateCovenant = async (covenantId, payload) => {
  const res = await api.put(`/governance/covenants/${covenantId}`, payload);
  return res.data;
};

// Snapshots
export const fetchCovenantSnapshots = async (covenantId, params = {}) => {
  const res = await api.get(`/governance/covenants/${covenantId}/snapshots`, { params });
  return res.data;
};

export const createCovenantSnapshot = async (covenantId, payload) => {
  const res = await api.post(`/governance/covenants/${covenantId}/snapshots`, payload);
  return res.data;
};

// Attachments
export const uploadCovenantAttachment = async (covenantId, file) => {
  const form = new FormData();
  form.append("file", file);

  const res = await api.post(`/governance/covenants/${covenantId}/attachments`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const downloadCovenantAttachment = async (attachmentId) => {
  const res = await api.get(`/governance/covenants/attachments/${attachmentId}/download`, {
    responseType: "blob",
  });
  return res.data;
};

// Dashboard
export const fetchCovenantDashboard = async (params = {}) => {
  const res = await api.get("/governance/covenants/dashboard", { params });
  return res.data;
};

// Alerts
export const fetchCovenantAlerts = async (params = {}) => {
  const res = await api.get("/governance/covenants/alerts", { params });
  return res.data;
};

export const acknowledgeCovenantAlert = async (alertId, payload) => {
  const res = await api.post(`/governance/covenants/alerts/${alertId}/ack`, payload);
  return res.data;
};

