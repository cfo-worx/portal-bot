import axios from './index';

// Get financial reporting data
export const getFinancialData = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.clientIds && filters.clientIds.length > 0) {
      filters.clientIds.forEach(id => params.append('clientIds', id));
    }
    if (filters.consultantIds && filters.consultantIds.length > 0) {
      filters.consultantIds.forEach(id => params.append('consultantIds', id));
    }

    const response = await axios.get(`/financial-reports?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching financial data:', error);
    throw error;
  }
};

