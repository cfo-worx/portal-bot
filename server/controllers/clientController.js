// server/controllers/clientController.js

import Client from '../models/Client.js';
import { v4 as uuidv4 } from 'uuid';

// Fetch ALL clients (already existing)
export const getClients = async (req, res) => {
  try {
    const clients = await Client.getAll();
    res.json(clients);
  } catch (error) {
    res.status(500).send(error.message);
  }
};


export const getActiveClients = async (req, res) => {
  try {
    const clients = await Client.getActiveClients(); // ✅ correct method
    res.json(clients);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

export const getActiveClientsForConsultant = async (req, res) => {
  try {
    const { consultantId } = req.params;
    const clients = await Client.getActiveClientsForConsultant(consultantId);
    res.json(clients);
  } catch (error) {
    console.error('Error fetching active clients for consultant:', error);
    res.status(500).send(error.message);
  }
};



// Add a new client
export const addClient = async (req, res) => {
  try {
    const data = {
      ...req.body,
      ClientID: uuidv4(),
      CreatedOn: new Date(),
      UpdatedOn: new Date(),
    };
    const newClient = await Client.create(data);
    res.status(201).json(newClient);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

// Update client details
export const updateClient = async (req, res) => {
  try {
    const updatedClient = await Client.update(req.params.id, {
      ...req.body,
      UpdatedOn: new Date(),
    });
    res.json(updatedClient);
  } catch (error) {
    res.status(500).send(error.message);
  }
};

export const patchClient = async (req, res) => {
  try {
    const clientId = req.params.id;
    const updates = { ...req.body, UpdatedOn: new Date() };
    const patched = await Client.patch(clientId, updates);
    if (!patched) return res.status(404).send('Client not found');
    res.json(patched);
  } catch (error) {
    console.error('[patchClient]', error);
    res.status(500).send(error.message);
  }
};

// Delete a client
export const deleteClient = async (req, res) => {
  try {
    await Client.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
};


export const getOnboardingStep = async (req, res) => {
  try {
    const step = await Client.getOnboardingStep(req.params.id);
    res.json({ step });
  } catch (error) {
    console.error('[getOnboardingStep]', error);
    res.status(500).send('Failed to get onboarding step');
  }
};

export const updateOnboardingStep = async (req, res) => {
  try {
    await Client.updateOnboardingStep(req.params.clientId, req.body.step);
    res.json({ step: req.body.step }); // return the new value
  } catch (error) {
    console.error('[updateOnboardingStep]', error);
    res.status(500).send('Failed to update onboarding step');
  }
};

export const getClientById = async (req, res) => {
  try {
    const client = await Client.getById(req.params.id);
    if (!client) return res.status(404).send('Client not found');
    res.json(client);
  } catch (error) {
    console.error('[getClientById]', error);
    res.status(500).send(error.message);
  }
};