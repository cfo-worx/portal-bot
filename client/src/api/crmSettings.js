import axios from './index';

// ========== STAGES ==========
export const getStages = async (module = null) => {
  try {
    const url = module ? `/crm/settings/stages?module=${module}` : '/crm/settings/stages';
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching stages:', error);
    throw error;
  }
};

export const updateStage = async (id, stageData) => {
  try {
    const response = await axios.put(`/crm/settings/stages/${id}`, stageData);
    return response.data;
  } catch (error) {
    console.error('Error updating stage:', error);
    throw error;
  }
};

// ========== LEAD SOURCES ==========
export const getLeadSources = async () => {
  try {
    const response = await axios.get('/crm/settings/lead-sources');
    return response.data;
  } catch (error) {
    console.error('Error fetching lead sources:', error);
    throw error;
  }
};

export const createLeadSource = async (sourceData) => {
  try {
    const response = await axios.post('/crm/settings/lead-sources', sourceData);
    return response.data;
  } catch (error) {
    console.error('Error creating lead source:', error);
    throw error;
  }
};

export const updateLeadSource = async (id, sourceData) => {
  try {
    const response = await axios.put(`/crm/settings/lead-sources/${id}`, sourceData);
    return response.data;
  } catch (error) {
    console.error('Error updating lead source:', error);
    throw error;
  }
};

export const deleteLeadSource = async (id) => {
  try {
    await axios.delete(`/crm/settings/lead-sources/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting lead source:', error);
    throw error;
  }
};

// ========== CANNED REPLIES ==========
export const getCannedReplies = async (category = null) => {
  try {
    const url = category ? `/crm/settings/canned-replies?category=${category}` : '/crm/settings/canned-replies';
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching canned replies:', error);
    throw error;
  }
};

export const createCannedReply = async (replyData) => {
  try {
    const response = await axios.post('/crm/settings/canned-replies', replyData);
    return response.data;
  } catch (error) {
    console.error('Error creating canned reply:', error);
    throw error;
  }
};

export const updateCannedReply = async (id, replyData) => {
  try {
    const response = await axios.put(`/crm/settings/canned-replies/${id}`, replyData);
    return response.data;
  } catch (error) {
    console.error('Error updating canned reply:', error);
    throw error;
  }
};

export const deleteCannedReply = async (id) => {
  try {
    await axios.delete(`/crm/settings/canned-replies/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting canned reply:', error);
    throw error;
  }
};

// ========== REP GOALS ==========
export const getRepGoals = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.consultantId) params.append('consultantId', filters.consultantId);
    if (filters.periodType) params.append('periodType', filters.periodType);
    if (filters.periodStart) params.append('periodStart', filters.periodStart);
    if (filters.periodEnd) params.append('periodEnd', filters.periodEnd);
    
    const response = await axios.get(`/crm/settings/rep-goals?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching rep goals:', error);
    throw error;
  }
};

export const createRepGoal = async (goalData) => {
  try {
    const response = await axios.post('/crm/settings/rep-goals', goalData);
    return response.data;
  } catch (error) {
    console.error('Error creating rep goal:', error);
    throw error;
  }
};

export const updateRepGoal = async (id, goalData) => {
  try {
    const response = await axios.put(`/crm/settings/rep-goals/${id}`, goalData);
    return response.data;
  } catch (error) {
    console.error('Error updating rep goal:', error);
    throw error;
  }
};

export const getOrCreateRepGoal = async (consultantId, periodType, periodStart, periodEnd) => {
  try {
    const response = await axios.post('/crm/settings/rep-goals/get-or-create', {
      consultantId,
      periodType,
      periodStart,
      periodEnd,
    });
    return response.data;
  } catch (error) {
    console.error('Error getting or creating rep goal:', error);
    throw error;
  }
};

export const deleteRepGoal = async (id) => {
  try {
    await axios.delete(`/crm/settings/rep-goals/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting rep goal:', error);
    throw error;
  }
};

