// api/globalSettings.js
import axios from './index';

/* GET current lock status */
export const getCalendarLocked = async () => {
  try {
    const res = await axios.get('/globalSettings/calendarLocked');
    return res.data.calendarLocked;
  } catch (err) {
    console.error(err);
    return true;              // fail-safe = locked
  }
};

/* PUT lock status (admin screen will use) */
export const setCalendarLocked = async (locked) => {
  try {
    const res = await axios.put('/globalSettings/calendarLocked', {
      calendarLocked: locked,
    });
    return res.data.calendarLocked;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

/* Performance Reporting Settings */
export const getPerformanceReportingSettings = async () => {
  try {
    const res = await axios.get('/globalSettings/performanceReporting');
    return res.data;
  } catch (err) {
    console.error('Error fetching performance reporting settings:', err);
    throw err;
  }
};

export const updatePerformanceReportingSettings = async (settings) => {
  try {
    const res = await axios.put('/globalSettings/performanceReporting', settings);
    return res.data;
  } catch (err) {
    console.error('Error updating performance reporting settings:', err);
    throw err;
  }
};

/* Holiday Calendar */
export const getHolidayCalendar = async () => {
  try {
    const res = await axios.get('/globalSettings/holidayCalendar');
    return res.data;
  } catch (err) {
    console.error('Error fetching holiday calendar:', err);
    throw err;
  }
};

export const addHoliday = async (holidayData) => {
  try {
    const res = await axios.post('/globalSettings/holidayCalendar', holidayData);
    return res.data;
  } catch (err) {
    console.error('Error adding holiday:', err);
    throw err;
  }
};

export const deleteHoliday = async (holidayDate) => {
  try {
    const res = await axios.delete(`/globalSettings/holidayCalendar/${holidayDate}`);
    return res.data;
  } catch (err) {
    console.error('Error deleting holiday:', err);
    throw err;
  }
};
