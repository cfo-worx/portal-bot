// src/api/clients.js
import axios from './index';

export const getClients = async () => {
  try {
    const response = await axios.get('/clients');
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const getActiveClients = async () => {
  try {
    const response = await axios.get('/clients/active');
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const getActiveClientsForConsultant = async (consultantId) => {
  try {
    const response = await axios.get(`/clients/active/${consultantId}`);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const addClient = async (clientData) => {
  try {
    const response = await axios.post('/clients', clientData);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

// ◀️ PARTIAL UPDATE (PATCH) instead of full replace (PUT)
export const updateClient = async (id, updates) => {
  try {
    const response = await axios.patch(`/clients/${id}`, updates);
    return response.data;
  } catch (error) {
    console.error(error);
  }
};

export const getClientOnboardingStatus = async (clientId) => {
  try {
    const response = await axios.get(`/clients/${clientId}/onboarding-step`);
    return response.data.step;
  } catch (error) {
    console.error('Error checking onboarding step:', error);
    return 0;
  }
};

// you can also PATCH just the step if you like:
export const updateClientOnboardingStep = async (clientId, step) => {
  try {
    const response = await axios.put(
      `/clients/${clientId}/onboarding-step`,
      { step }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating onboarding step:', error);
    throw error;
  }
};

export const getClientById = async (id) => {
  try {
    const response = await axios.get(`/clients/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching client:', error);
    throw error;
  }
};

export const deleteClient = async (id) => {
  try {
    await axios.delete(`/clients/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
};
