import axios from './index';

// ========== CLIENTS ==========
export const getBuySideClients = async () => {
  try {
    const response = await axios.get('/buyside/clients');
    return response.data;
  } catch (error) {
    console.error('Error fetching buy-side clients:', error);
    throw error;
  }
};

export const getBuySideClientById = async (id) => {
  try {
    const response = await axios.get(`/buyside/clients/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching buy-side client:', error);
    throw error;
  }
};

export const createBuySideClient = async (clientData) => {
  try {
    const response = await axios.post('/buyside/clients', clientData);
    return response.data;
  } catch (error) {
    console.error('Error creating buy-side client:', error);
    throw error;
  }
};

export const updateBuySideClient = async (id, clientData) => {
  try {
    const response = await axios.put(`/buyside/clients/${id}`, clientData);
    return response.data;
  } catch (error) {
    console.error('Error updating buy-side client:', error);
    throw error;
  }
};

export const deleteBuySideClient = async (id) => {
  try {
    await axios.delete(`/buyside/clients/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting buy-side client:', error);
    throw error;
  }
};

// ========== CAMPAIGNS ==========
export const getBuySideCampaigns = async (clientId = null) => {
  try {
    const params = clientId ? `?clientId=${clientId}` : '';
    const response = await axios.get(`/buyside/campaigns${params}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching buy-side campaigns:', error);
    throw error;
  }
};

export const getBuySideCampaignsByClient = async (clientId) => {
  try {
    const response = await axios.get(`/buyside/campaigns/client/${clientId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching campaigns by client:', error);
    throw error;
  }
};

export const getBuySideCampaignById = async (id) => {
  try {
    const response = await axios.get(`/buyside/campaigns/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching buy-side campaign:', error);
    throw error;
  }
};

export const createBuySideCampaign = async (campaignData) => {
  try {
    const response = await axios.post('/buyside/campaigns', campaignData);
    return response.data;
  } catch (error) {
    console.error('Error creating buy-side campaign:', error);
    throw error;
  }
};

export const updateBuySideCampaign = async (id, campaignData) => {
  try {
    const response = await axios.put(`/buyside/campaigns/${id}`, campaignData);
    return response.data;
  } catch (error) {
    console.error('Error updating buy-side campaign:', error);
    throw error;
  }
};

export const deleteBuySideCampaign = async (id) => {
  try {
    await axios.delete(`/buyside/campaigns/${id}`);
    return true;
  } catch (error) {
    console.error('Error deleting buy-side campaign:', error);
    throw error;
  }
};

