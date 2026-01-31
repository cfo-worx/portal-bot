import BuySideClient from '../models/BuySideClient.js';
import BuySideCampaign from '../models/BuySideCampaign.js';

// ========== CLIENTS ==========
export const getBuySideClients = async (req, res) => {
  try {
    const clients = await BuySideClient.getAll();
    res.json(clients);
  } catch (error) {
    console.error('Error fetching buy-side clients:', error);
    res.status(500).json({ error: 'Failed to fetch buy-side clients' });
  }
};

export const getBuySideClientById = async (req, res) => {
  try {
    const client = await BuySideClient.getById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: 'Buy-side client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('Error fetching buy-side client:', error);
    res.status(500).json({ error: 'Failed to fetch buy-side client' });
  }
};

export const createBuySideClient = async (req, res) => {
  try {
    const clientData = {
      ...req.body,
      CreatedBy: req.user?.userId || req.user?.user_id || null,
    };
    const client = await BuySideClient.create(clientData);
    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating buy-side client:', error);
    res.status(500).json({ error: 'Failed to create buy-side client' });
  }
};

export const updateBuySideClient = async (req, res) => {
  try {
    const client = await BuySideClient.update(req.params.id, req.body);
    if (!client) {
      return res.status(404).json({ error: 'Buy-side client not found' });
    }
    res.json(client);
  } catch (error) {
    console.error('Error updating buy-side client:', error);
    res.status(500).json({ error: 'Failed to update buy-side client' });
  }
};

export const deleteBuySideClient = async (req, res) => {
  try {
    await BuySideClient.delete(req.params.id);
    res.json({ message: 'Buy-side client deleted successfully' });
  } catch (error) {
    console.error('Error deleting buy-side client:', error);
    res.status(500).json({ error: 'Failed to delete buy-side client' });
  }
};

// ========== CAMPAIGNS ==========
export const getBuySideCampaigns = async (req, res) => {
  try {
    const filters = {
      clientId: req.query.clientId || null,
    };
    const campaigns = await BuySideCampaign.getAll(filters);
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching buy-side campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch buy-side campaigns' });
  }
};

export const getBuySideCampaignById = async (req, res) => {
  try {
    const campaign = await BuySideCampaign.getById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Buy-side campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching buy-side campaign:', error);
    res.status(500).json({ error: 'Failed to fetch buy-side campaign' });
  }
};

export const getBuySideCampaignsByClient = async (req, res) => {
  try {
    const campaigns = await BuySideCampaign.getByClientId(req.params.clientId);
    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns by client:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
};

export const createBuySideCampaign = async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      CreatedBy: req.user?.userId || req.user?.user_id || null,
    };
    const campaign = await BuySideCampaign.create(campaignData);
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating buy-side campaign:', error);
    res.status(500).json({ error: 'Failed to create buy-side campaign' });
  }
};

export const updateBuySideCampaign = async (req, res) => {
  try {
    const campaign = await BuySideCampaign.update(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ error: 'Buy-side campaign not found' });
    }
    res.json(campaign);
  } catch (error) {
    console.error('Error updating buy-side campaign:', error);
    res.status(500).json({ error: 'Failed to update buy-side campaign' });
  }
};

export const deleteBuySideCampaign = async (req, res) => {
  try {
    await BuySideCampaign.delete(req.params.id);
    res.json({ message: 'Buy-side campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting buy-side campaign:', error);
    res.status(500).json({ error: 'Failed to delete buy-side campaign' });
  }
};

