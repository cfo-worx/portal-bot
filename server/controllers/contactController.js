// server/controllers/contactController.js

import Contact from '../models/Contact.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fetch all contacts for a specific client.
 */
export const getContactsByClient = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const contacts = await Contact.getByClientId(clientId);
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts.' });
  }
};

/**
 * Add a new contact.
 */
export const addContact = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const data = {
      ...req.body,
      ContactID: req.body.ContactID || uuidv4(), // Generate unique ID
      ClientID: clientId,
      CreatedOn: new Date(),
      UpdatedOn: new Date(),
    };

    const newContact = await Contact.create(data);
    console.log('New Contact Created:', newContact); // Debug log

    if (newContact && newContact.ContactID) {
      res.status(201).json(newContact); // Respond with the new contact
    } else {
      res.status(400).json({ error: 'Failed to create contact. No ContactID returned.' });
    }
  } catch (error) {
    console.error('Error adding contact:', error);
    res.status(500).json({ error: 'Failed to add contact.' });
  }
};


/**
 * Update an existing contact.
 */
export const updateContact = async (req, res) => {
  try {
    const contactId = req.params.contactId;
    const data = {
      ...req.body,
      UpdatedOn: new Date(),
    };
    const updatedContact = await Contact.update(contactId, data);
    if (updatedContact) {
      res.json(updatedContact);
    } else {
      res.status(404).json({ error: 'Contact not found.' });
    }
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact.' });
  }
};

/**
 * Delete a contact.
 */
export const deleteContact = async (req, res) => {
  try {
    const contactId = req.params.contactId;
    const success = await Contact.delete(contactId);
    if (success) {
      res.json({ message: 'Contact deleted successfully.' });
    } else {
      res.status(404).json({ error: 'Contact not found.' });
    }
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact.' });
  }
};
