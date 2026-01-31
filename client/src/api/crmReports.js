import axios from './index';

export const getKPISummary = async (params = {}) => {
  try {
    const response = await axios.get('/crm/reports/kpi-summary', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching KPI summary:', error);
    throw error;
  }
};

export const getTrailing12Months = async (params = {}) => {
  try {
    const response = await axios.get('/crm/reports/trailing-12-months', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching trailing 12 months:', error);
    throw error;
  }
};

export const getSourceProductivity = async (params = {}) => {
  try {
    const response = await axios.get('/crm/reports/source-productivity', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching source productivity:', error);
    throw error;
  }
};

export const getRepPerformance = async (params = {}) => {
  try {
    const response = await axios.get('/crm/reports/rep-performance', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching rep performance:', error);
    throw error;
  }
};

export const getStageBreakdown = async (params = {}) => {
  try {
    const response = await axios.get('/crm/reports/stage-breakdown', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching stage breakdown:', error);
    throw error;
  }
};

export const getActivityTrends = async (params = {}) => {
  try {
    const response = await axios.get('/crm/reports/activity-trends', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching activity trends:', error);
    throw error;
  }
};

export const exportReport = async (type, params = {}) => {
  try {
    const response = await axios.get('/crm/reports/export', {
      params: { type, ...params },
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `crm-report-${type}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return true;
  } catch (error) {
    console.error('Error exporting report:', error);
    throw error;
  }
};

