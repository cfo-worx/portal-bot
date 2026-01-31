// api/consultants.js
import axios from './index';

export const getConsultants = async () => {
  try {
    const response = await axios.get('/consultants');
    return response.data;
  } catch (error) {
    console.error(error);
  }
};


export const getActiveConsultants = async () => {
  try {
    const response = await axios.get('/consultants/active');
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const addConsultant = async (consultantData) => {
  try {
    const response = await axios.post('/consultants', consultantData);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const updateConsultant = async (id, consultantData) => {
  try {
    const response = await axios.put(`/consultants/${id}`, consultantData);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};


export const sendConsultantReminder = async (consultantId) => {
  const response = await axios.post(`/consultants/${consultantId}/reminder`);
  return response.data;
};