import api from "./index";

// -------- Settings --------
export const getClientWorkSettings = (clientId) =>
  api.get(`/client-work/settings`, { params: { clientId } });

export const updateClientWorkSettings = (clientId, settings) =>
  api.put(`/client-work/settings`, { clientId, settings });

// -------- Dashboard --------
export const getClientWorkDashboardSummary = (clientId) =>
  api.get(`/client-work/dashboard-summary`, { params: { clientId } });

// -------- Close --------
export const getOrCreateCloseRun = (clientId, periodKey, templateKey = "default") =>
  api.post(`/client-work/close/runs/get-or-create`, { clientId, periodKey, templateKey });

export const updateCloseChecklistItem = (itemId, payload) =>
  api.put(`/client-work/close/checklist/items/${itemId}`, payload);

export const uploadCloseGL = (formData) =>
  api.post(`/client-work/close/qa/upload-gl`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const runCloseQAScan = (scanRunId, options = {}) =>
  api.post(`/client-work/close/qa/run`, { scanRunId, ...options });

export const getCloseQAFlags = (scanRunId) =>
  api.get(`/client-work/close/qa/flags`, { params: { scanRunId } });

export const updateCloseQAFlag = (flagId, payload) =>
  api.put(`/client-work/close/qa/flags/${flagId}`, payload);

// -------- Cash Forecast --------
export const getCashForecast = (clientId, scenarioName = "Base", startWeekEndingDate = null) =>
  api.get(`/client-work/cash-forecast`, {
    params: { clientId, scenarioName, startWeekEndingDate },
  });

export const listCashForecast = async (clientId, scenarioName = "Base") => {
  const res = await api.get(`/client-work/cash-forecast`, {
    params: { clientId, scenarioName },
  });
  // Map response to expected format
  return {
    ...res,
    data: {
      ...res.data,
      forecast: res.data
    }
  };
};

export const createOrGetCashForecast = (clientId, scenarioName = "Base", startWeekEndingDate = null) =>
  api.post(`/client-work/cash-forecast/create-or-get`, { clientId, scenarioName, startWeekEndingDate });

export const upsertCashForecastLine = (payload) =>
  api.post(`/client-work/cash-forecast/lines`, payload);

export const deleteCashForecastLine = (lineId) =>
  api.delete(`/client-work/cash-forecast/lines/${lineId}`);

// -------- AI Reporting --------
export const listAiRuns = (clientId) => api.get(`/client-work/ai/runs`, { params: { clientId } });

export const getAiRun = (aiRunId) => api.get(`/client-work/ai/runs/${aiRunId}`);

export const createAiRun = (payload) => api.post(`/client-work/ai/runs`, payload);

export const generateAiRun = (aiRunId, payload) => api.post(`/client-work/ai/runs/${aiRunId}/generate`, payload);

export const updateAiRun = (aiRunId, payload) => api.put(`/client-work/ai/runs/${aiRunId}`, payload);

export const publishAiRun = (aiRunId) => api.post(`/client-work/ai/runs/${aiRunId}/publish`);

export const lockAiRun = (aiRunId) => api.post(`/client-work/ai/runs/${aiRunId}/lock`);

// -------- Market Intelligence --------
export const listMarketIntelRuns = (clientId) => api.get(`/client-work/market-intel/runs`, { params: { clientId } });
export const listMarketIntelItems = (clientId) => api.get(`/client-work/market-intel/items`, { params: { clientId } });
export const refreshMarketIntel = (payload) => api.post(`/client-work/market-intel/refresh`, payload);
export const pinMarketIntelItem = (itemId, isPinned) => api.put(`/client-work/market-intel/items/${itemId}/pin`, { isPinned });

// -------- Board Pack Builder --------
export const listBoardPackTemplates = () => api.get(`/client-work/board-pack/templates`);
export const upsertBoardPackTemplate = (payload) => api.post(`/client-work/board-pack/templates`, payload);

// Wrapper functions for component compatibility
export const createBoardPackTemplate = async (payload) => {
  const { name, description, templateJson } = payload;
  const res = await upsertBoardPackTemplate({ 
    templateName: name, 
    description, 
    templateJson 
  });
  // Map response to expected format
  return {
    ...res,
    data: {
      ...res.data,
      template: {
        TemplateID: res.data?.templateId || res.data?.BoardPackTemplateID
      }
    }
  };
};

export const updateBoardPackTemplate = async (templateId, payload) => {
  const { name, description, templateJson } = payload;
  const res = await upsertBoardPackTemplate({ 
    templateId,
    templateName: name, 
    description, 
    templateJson 
  });
  return res;
};

export const deleteBoardPackTemplate = (templateId) => {
  // Note: DELETE endpoint not implemented yet, this is a placeholder
  return Promise.reject(new Error("Delete template not yet implemented"));
};

export const listBoardPacks = (clientId) => api.get(`/client-work/board-pack/packs`, { params: { clientId } });
export const createBoardPack = (payload) => api.post(`/client-work/board-pack/packs`, payload);
export const updateBoardPack = (packId, payload) => api.put(`/client-work/board-pack/packs/${packId}`, payload);

// Wrapper function to get a single board pack
export const getBoardPack = async (packId, clientId) => {
  const res = await listBoardPacks(clientId);
  const packs = res?.data?.packs || [];
  const pack = packs.find((p) => p.BoardPackID === packId);
  if (!pack) {
    throw new Error("Board pack not found");
  }
  return { data: { pack } };
};

// -------- Accounting Staff & Evaluations --------
export const listAccountingStaff = (clientId) => api.get(`/client-work/staff`, { params: { clientId } });
export const upsertAccountingStaff = (payload) => api.post(`/client-work/staff`, payload);
export const listStaffEvaluations = (clientId, staffId = null) => api.get(`/client-work/evaluations`, { params: { clientId, staffId } });
export const createStaffEvaluation = (payload) => api.post(`/client-work/evaluations`, payload);
