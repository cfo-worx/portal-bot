import axios from './index';

// ========== LEADS ==========
export const getLeads = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive);
    if (filters.isDuplicate !== undefined) params.append('isDuplicate', filters.isDuplicate);
    if (filters.search) params.append('search', filters.search);
    if (filters.domain) params.append('domain', filters.domain);
    if (filters.email) params.append('email', filters.email);
    if (filters.industry) params.append('industry', filters.industry);
    
    const response = await axios.get(`/leads?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching leads:', error);
    throw error;
  }
};

export const getLeadById = async (id) => {
  try {
    const response = await axios.get(`/leads/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching lead:', error);
    throw error;
  }
};

export const updateLead = async (id, leadData) => {
  try {
    const response = await axios.put(`/leads/${id}`, leadData);
    return response.data;
  } catch (error) {
    console.error('Error updating lead:', error);
    throw error;
  }
};

export const deleteLead = async (id) => {
  try {
    await axios.delete(`/leads/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting lead:', error);
    throw error;
  }
};

// ========== IMPORT ==========
export const importLeads = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post('/leads/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error importing leads:', error);
    throw error;
  }
};

export const getImportBatches = async () => {
  try {
    const response = await axios.get('/leads/import/batches');
    return response.data;
  } catch (error) {
    console.error('Error fetching import batches:', error);
    throw error;
  }
};

export const getImportBatchErrors = async (batchId) => {
  try {
    const response = await axios.get(`/leads/import/batches/${batchId}/errors`);
    return response.data;
  } catch (error) {
    console.error('Error fetching import errors:', error);
    throw error;
  }
};

// ========== DUPLICATES ==========
export const getDuplicateGroups = async () => {
  try {
    const response = await axios.get('/leads/duplicates');
    return response.data;
  } catch (error) {
    console.error('Error fetching duplicate groups:', error);
    throw error;
  }
};

