import api from "./index";

// Settings
export const fetchGovernanceSettings = async () => {
  const res = await api.get("/governance/calendar/settings");
  return res.data;
};

export const updateGovernanceSettings = async (payload) => {
  const res = await api.put("/governance/calendar/settings", payload);
  return res.data;
};

// Events
export const fetchGovernanceEvents = async (params = {}) => {
  const res = await api.get("/governance/calendar/events", { params });
  return res.data;
};

export const fetchGovernanceEvent = async (eventId) => {
  const res = await api.get(`/governance/calendar/events/${eventId}`);
  return res.data;
};

export const createGovernanceEvent = async (payload) => {
  const res = await api.post("/governance/calendar/events", payload);
  return res.data;
};

export const updateGovernanceEvent = async (eventId, payload) => {
  const res = await api.put(`/governance/calendar/events/${eventId}`, payload);
  return res.data;
};

export const setGovernanceEventStatus = async (eventId, status) => {
  const res = await api.post(`/governance/calendar/events/${eventId}/status`, { status });
  return res.data;
};

export const deleteGovernanceEvent = async (eventId) => {
  const res = await api.delete(`/governance/calendar/events/${eventId}`);
  return res.data;
};

// Attachments
export const uploadGovernanceEventAttachment = async (eventId, file) => {
  const form = new FormData();
  form.append("file", file);

  const res = await api.post(`/governance/calendar/events/${eventId}/attachments`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const downloadGovernanceEventAttachment = async (attachmentId) => {
  const res = await api.get(`/governance/calendar/attachments/${attachmentId}/download`, {
    responseType: "blob",
  });
  return res.data;
};

