// client/src/api/contacts.js

import axios from 'axios';

const API_BASE = '/api/clients'; // Base path for Clients

/**
 * Fetch all contacts for a specific client.
 * @param {string} clientId - The ID of the client.
 * @returns {Promise<Array>} - Array of contact objects.
 */
export const getContactsByClient = async (clientId) => {
  try {
    const response = await axios.get(`${API_BASE}/${clientId}/contacts`);
    return response.data;
  } catch (error) {
    console.error('Error fetching contacts:', error);
    throw error;
  }
};

/**
 * Create a new contact for a specific client.
 * @param {string} clientId - The ID of the client.
 * @param {Object} contactData - The data for the new contact.
 * @returns {Promise<Object>} - The created contact object.
 */
export const createContact = async (clientId, contactData) => {
  try {
    
    
    const response = await axios.post(`${API_BASE}/${clientId}/contacts`, contactData);
    
    return response.data;
  } catch (error) {
    
    throw error;
  }
};


/**
 * Update an existing contact for a specific client.
 * @param {string} clientId - The ID of the client.
 * @param {string} contactId - The ID of the contact to update.
 * @param {Object} contactData - The updated contact data.
 * @returns {Promise<Object>} - The updated contact object.
 */
export const updateContact = async (clientId, contactId, contactData) => {
  try {
    const response = await axios.put(`${API_BASE}/${clientId}/contacts/${contactId}`, contactData);
    return response.data;
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
};

/**
 * Delete a contact for a specific client.
 * @param {string} clientId - The ID of the client.
 * @param {string} contactId - The ID of the contact to delete.
 * @returns {Promise<Object>} - The deletion result.
 */
export const deleteContact = async (clientId, contactId) => {
  try {
    const response = await axios.delete(`${API_BASE}/${clientId}/contacts/${contactId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting contact:', error);
    throw error;
  }
};
