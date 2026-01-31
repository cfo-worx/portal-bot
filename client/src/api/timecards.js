import axios from 'axios';
import dayjs from 'dayjs';


/*
// Fetch headers for a given consultant and then filter by month/year
export const getHeaderByConsultantAndMonth = async (consultantID, month, year) => {
  const response = await axios.get('/api/timecardHeaders/consultant', { params: { ConsultantID: consultantID } });
  // Filter headers that match the selected month/year
  const data = response.data.filter(h => {
    const d = dayjs(h.TimesheetDate);
    return d.year() === year && d.month() === (month - 1);
  });
  return data;
};

*/


/*
// Fetch a single header by exact date for a consultant
export const getHeaderByDate = async (consultantID, date) => {
  // Fetch all headers for this consultant
  const response = await axios.get('/api/timecardHeaders', { params: { ConsultantID: consultantID } });
  const allHeaders = response.data;
  
  // Find the header that matches the exact date
  const header = allHeaders.find(h => dayjs(h.TimesheetDate).isSame(dayjs(date), 'day'));

  return header || null;
};

*/


/*

// Create header if it does not exist for a given date
export const createHeaderIfNotExists = async (consultantID, date) => {
  // Check if exists
  const existing = await getHeaderByDate(consultantID, date);
  if (existing) return existing.TimecardID;

  const newHeader = {
    ConsultantID: consultantID,
    TimesheetDate: date,
    TotalHours: 0,
    Status: 'Open',
    Notes: '',
  };
  const response = await axios.post('/api/timecardHeaders', newHeader);
  return response.data.TimecardID;
};

*/

// Fetch lines by TimecardID
export const getLinesByTimecardID = async (timecardID) => {
  const response = await axios.get('/api/timecardLines', { params: { TimecardID: timecardID } });
  return response.data;
};

/*
// Add or update timecard line
export const addOrUpdateTimecardLine = async (lineData) => {
  if (lineData.TimecardLineID) {
    // Update existing
    await axios.put(`/api/timecardLines/${lineData.TimecardLineID}`, lineData);
  } else {
    // Create new
    await axios.post('/api/timecardLines', lineData);
  }
};
*/

// Get all timecard headers
export const getTimecardHeaders = async () => {
  const response = await axios.get('/api/timecardHeaders');
  return response.data;
};

// Update a timecard header by ID
export const updateTimecardHeader = async (id, data) => {
  await axios.put(`/api/timecardHeaders/${id}`, data);
};

// Get timecard lines by header
export const getTimecardLinesByHeader = async (timecardID) => {
  const response = await axios.get('/api/timecardLines', {
    params: { TimecardID: timecardID },
  });
  return response.data;
};

// Update a timecard line by ID
export const updateTimecardLine = async (id, data) => {
  await axios.put(`/api/timecardLines/${id}`, data);
};

// Fetch Timesheet Summary (example additional endpoint)
export const getTimecardLinesSummary = async () => {
  try {
    const response = await axios.get(`/api/timecardLines/summary`);
    return response.data;
  } catch (error) {
    console.error('Error fetching timesheet summary:', error);
    throw error;
  }
};


export const getTimecardLinesWithDetails = async () => {
  try {
    const response = await axios.get('/api/timecards/lines-with-details');
    return response.data;
  } catch (error) {
    console.error('Error fetching timecard lines with details:', error);
    throw error;
  }
};



// Fetch timecard lines for a given consultant and month/year
export const getTimecardLinesByConsultantAndMonth = async (consultantID, month, year) => {
  try {
    const response = await axios.get('/api/timecardLines/month', {
      params: { ConsultantID: consultantID, Month: month, Year: year },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching timecard lines by consultant and month:', error);
    throw error;
  }
};


// Fetch timecard lines for a specific date and consultant
export const getTimecardLinesByDate = async (consultantID, date) => {
  const formattedDate = dayjs(date).format('YYYY-MM-DD');
  const response = await axios.get('/api/timecardLines/date', {
    params: { ConsultantID: consultantID, Date: formattedDate }, // Fix here: use 'Date'
  });
  return response.data;
};


// Add or update timecard line
export const addOrUpdateTimecardLine = async (lineData) => {
  if (lineData.TimecardLineID) {
    // Update existing timecard line
    await axios.put(`/api/timecardLines/${lineData.TimecardLineID}`, lineData);
  } else {
    // Create new timecard line
    await axios.post('/api/timecardLines', lineData);
  }
};



// Submit timesheet for a day
export const submitTimesheetForDay = async (consultantID, date) => {
  try {
    const response = await axios.post(`/api/timecardLines/submit`, {
      consultantID,
      date,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};


// Fetch all timecard lines for a given month (all consultants)
export const getTimecardLinesByMonthAll = async (month, year) => {
  try {
    const response = await axios.get('/api/timecardLines/month/all', {
      params: { Month: month, Year: year },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching timesheet lines by month:', error);
    throw error;
  }
};

// Fetch all timecard lines for a specific date (all consultants)
export const getTimecardLinesByDateAll = async (date) => {
  try {
    const response = await axios.get('/api/timecardLines/date/all', {
      params: { Date: date },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching timesheet lines by date:', error);
    throw error;
  }
};



// Delete a timecard line by ID
export const deleteTimecardLine = async (timecardLineId) => {
  const response = await axios.delete(`/api/timecardLines/${timecardLineId}`);
  return response.data;
};