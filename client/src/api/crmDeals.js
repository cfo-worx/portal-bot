import axios from './index';

// ========== DEALS ==========
export const getDeals = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.module) params.append('module', filters.module);
    if (filters.stageId) params.append('stageId', filters.stageId);
    if (filters.ownerId) params.append('ownerId', filters.ownerId);
    if (filters.search) params.append('search', filters.search);
    
    const response = await axios.get(`/crm/deals?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deals:', error);
    throw error;
  }
};

export const getDealById = async (id) => {
  try {
    const response = await axios.get(`/crm/deals/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deal:', error);
    throw error;
  }
};

export const createDeal = async (dealData) => {
  try {
    const response = await axios.post('/crm/deals', dealData);
    return response.data;
  } catch (error) {
    console.error('Error creating deal:', error);
    throw error;
  }
};

export const updateDeal = async (id, dealData) => {
  try {
    const response = await axios.put(`/crm/deals/${id}`, dealData);
    return response.data;
  } catch (error) {
    console.error('Error updating deal:', error);
    throw error;
  }
};

export const deleteDeal = async (id) => {
  try {
    await axios.delete(`/crm/deals/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting deal:', error);
    throw error;
  }
};

// ========== DEAL NOTES ==========
export const getDealNotes = async (dealId) => {
  try {
    const response = await axios.get(`/crm/deals/${dealId}/notes`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deal notes:', error);
    throw error;
  }
};

export const createDealNote = async (dealId, noteData) => {
  try {
    const response = await axios.post(`/crm/deals/${dealId}/notes`, noteData);
    return response.data;
  } catch (error) {
    console.error('Error creating deal note:', error);
    throw error;
  }
};

export const deleteDealNote = async (dealId, noteId) => {
  try {
    await axios.delete(`/crm/deals/${dealId}/notes/${noteId}`);
    return true;
  } catch (error) {
    console.error('Error deleting deal note:', error);
    throw error;
  }
};

// ========== DEAL ACTIVITIES ==========
export const getDealActivities = async (dealId) => {
  try {
    const response = await axios.get(`/crm/deals/${dealId}/activities`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deal activities:', error);
    throw error;
  }
};

export const createDealActivity = async (dealId, activityData) => {
  try {
    const response = await axios.post(`/crm/deals/${dealId}/activities`, activityData);
    return response.data;
  } catch (error) {
    console.error('Error creating deal activity:', error);
    throw error;
  }
};

export const deleteDealActivity = async (dealId, activityId) => {
  try {
    await axios.delete(`/crm/deals/${dealId}/activities/${activityId}`);
    return true;
  } catch (error) {
    console.error('Error deleting deal activity:', error);
    throw error;
  }
};

// ========== UNIFIED NOTES & ACTIVITIES ==========
export const getDealTimeline = async (dealId) => {
  try {
    const response = await axios.get(`/crm/deals/${dealId}/timeline`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deal timeline:', error);
    throw error;
  }
};

export const createTimelineEntry = async (dealId, entryData) => {
  try {
    const response = await axios.post(`/crm/deals/${dealId}/timeline`, entryData);
    return response.data;
  } catch (error) {
    console.error('Error creating timeline entry:', error);
    throw error;
  }
};

// ========== DEAL ATTACHMENTS ==========
export const getDealAttachments = async (dealId) => {
  try {
    const response = await axios.get(`/crm/deals/${dealId}/attachments`);
    return response.data;
  } catch (error) {
    console.error('Error fetching deal attachments:', error);
    throw error;
  }
};

export const uploadDealAttachment = async (dealId, file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`/crm/deals/${dealId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading attachment:', error);
    throw error;
  }
};

export const downloadDealAttachment = async (dealId, attachmentId) => {
  try {
    const response = await axios.get(`/crm/deals/${dealId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('Error downloading attachment:', error);
    throw error;
  }
};

export const deleteDealAttachment = async (dealId, attachmentId) => {
  try {
    await axios.delete(`/crm/deals/${dealId}/attachments/${attachmentId}`);
    return true;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    throw error;
  }
};

