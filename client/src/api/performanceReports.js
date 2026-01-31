import axios from './index';

// Get performance report data
export const getPerformanceReport = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.asOfDate) params.append('asOfDate', filters.asOfDate);
    if (filters.role) params.append('role', filters.role);
    if (filters.clientIds && filters.clientIds.length > 0) {
      filters.clientIds.forEach(id => params.append('clientIds', id));
    }
    if (filters.consultantIds && filters.consultantIds.length > 0) {
      filters.consultantIds.forEach(id => params.append('consultantIds', id));
    }
    if (filters.includeSubmitted !== undefined) {
      params.append('includeSubmitted', filters.includeSubmitted);
    }
    if (filters.businessDaysOnly !== undefined) {
      params.append('businessDaysOnly', filters.businessDaysOnly);
    }

    const response = await axios.get(`/performance-reports?${params.toString()}`, { timeout: 20000 });
    return response.data;
  } catch (error) {
    console.error('Error fetching performance report:', error);
    throw error;
  }
};

// Get weekly issues
export const getWeeklyIssues = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.weekStart) params.append('weekStart', filters.weekStart);
    if (filters.weekEnd) params.append('weekEnd', filters.weekEnd);
    if (filters.role) params.append('role', filters.role);
    if (filters.clientIds && filters.clientIds.length > 0) {
      filters.clientIds.forEach(id => params.append('clientIds', id));
    }
    if (filters.consultantIds && filters.consultantIds.length > 0) {
      filters.consultantIds.forEach(id => params.append('consultantIds', id));
    }
    if (filters.includeSubmitted !== undefined) {
      params.append('includeSubmitted', filters.includeSubmitted);
    }
    if (filters.businessDaysOnly !== undefined) {
      params.append('businessDaysOnly', filters.businessDaysOnly);
    }
    if (filters.lookbackWeeks) {
      params.append('lookbackWeeks', filters.lookbackWeeks);
    }

    const response = await axios.get(`/performance-reports/issues?${params.toString()}`, { timeout: 30000 });
    return response.data;
  } catch (error) {
    console.error('Error fetching weekly issues:', error);
    throw error;
  }
};

// Upsert issue note
export const upsertIssueNote = async (noteData) => {
  try {
    const response = await axios.put('/performance-reports/issue-note', noteData, { timeout: 15000 });
    return response.data;
  } catch (error) {
    console.error('Error upserting issue note:', error);
    throw error;
  }
};

// Get contracts ending
export const getContractsEnding = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.asOfDate) params.append('asOfDate', filters.asOfDate);
    if (filters.role) params.append('role', filters.role);
    if (filters.daysAhead) params.append('daysAhead', filters.daysAhead);
    if (filters.clientIds && filters.clientIds.length > 0) {
      filters.clientIds.forEach(id => params.append('clientIds', id));
    }

    const response = await axios.get(`/performance-reports/contracts-ending?${params.toString()}`, { timeout: 15000 });
    return response.data;
  } catch (error) {
    console.error('Error fetching contracts ending:', error);
    throw error;
  }
};

// Get weekly review sessions
export const getWeeklyReviewSessions = async (weekStart, weekEnd) => {
  try {
    const params = new URLSearchParams();
    params.append('weekStart', weekStart);
    params.append('weekEnd', weekEnd);
    
    const response = await axios.get(`/performance-reports/weekly-review-sessions?${params.toString()}`, { timeout: 15000 });
    return response.data.sessions || [];
  } catch (error) {
    console.error('Error fetching weekly review sessions:', error);
    throw error;
  }
};

// Get prior week review sessions for carry-forward
export const getPriorWeekReviewSessions = async (weekStart, clientId = null, consultantId = null) => {
  try {
    const params = new URLSearchParams();
    params.append('weekStart', weekStart);
    if (clientId) params.append('clientId', clientId);
    if (consultantId) params.append('consultantId', consultantId);
    
    const response = await axios.get(`/performance-reports/weekly-review-sessions/prior-week?${params.toString()}`, { timeout: 15000 });
    return response.data.sessions || [];
  } catch (error) {
    console.error('Error fetching prior week review sessions:', error);
    throw error;
  }
};

// Create or update weekly review session
export const upsertWeeklyReviewSession = async (sessionData) => {
  try {
    const method = sessionData.ReviewSessionID ? 'put' : 'post';
    const url = sessionData.ReviewSessionID 
      ? `/performance-reports/weekly-review-sessions/${sessionData.ReviewSessionID}`
      : '/performance-reports/weekly-review-sessions';
    
    const response = await axios[method](url, sessionData, { timeout: 15000 });
    return response.data;
  } catch (error) {
    console.error('Error upserting weekly review session:', error);
    throw error;
  }
};

// Delete weekly review session
export const deleteWeeklyReviewSession = async (sessionId) => {
  try {
    const response = await axios.delete(`/performance-reports/weekly-review-sessions/${sessionId}`, { timeout: 15000 });
    return response.data;
  } catch (error) {
    console.error('Error deleting weekly review session:', error);
    throw error;
  }
};

// Get capacity planning for next month
export const getCapacityPlanning = async (asOfDate) => {
  try {
    const params = new URLSearchParams();
    if (asOfDate) params.append('asOfDate', asOfDate);
    
    // Use longer timeout for capacity planning (15 seconds)
    const response = await axios.get(`/performance-reports/capacity-planning?${params.toString()}`, {
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching capacity planning:', error);
    throw error;
  }
};
