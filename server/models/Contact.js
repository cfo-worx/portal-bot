// server/models/Contact.js

import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class Contact {
  /**
   * Fetch all contacts associated with a specific client.
   * @param {string} clientId - The ID of the client.
   * @returns {Promise<Array>} - Array of contact objects.
   */
  static async getByClientId(clientId) {
    const pool = await poolPromise;
    try {
      const result = await pool
        .request()
        .input('ClientID', sql.UniqueIdentifier, clientId)
        .query('SELECT * FROM Contact WHERE ClientID = @ClientID');

      if (result.recordset.length === 0) {
        console.warn('No contacts found for ClientID:', clientId);
        return [];
      }

      return result.recordset;
    } catch (error) {
      console.error('Error in getByClientId:', error);
      throw error;
    }
  }

 /**
   * Create a new contact.
   * @param {Object} data - Contact data.
   * @returns {Promise<Object>} - The created contact.
   */
 static async create(data) {
  const pool = await poolPromise;
  try {
    // Generate a new ContactID if not provided
    const ContactID = data.ContactID || uuidv4();

    console.log('Inserting contact with data:', { ...data, ContactID });

    const result = await pool
      .request()
      .input('ContactID', sql.UniqueIdentifier, ContactID)
      .input('ClientID', sql.UniqueIdentifier, data.ClientID)
      .input('Name', sql.NVarChar(255), data.Name)
      .input('Title', sql.NVarChar(255), data.Title)
      .input('PhoneNumber', sql.NVarChar(50), data.PhoneNumber)
      .input('Email', sql.NVarChar(255), data.Email)
      .input('Role', sql.NVarChar(50), data.Role)
      .input('Timezone', sql.NVarChar(100), data.Timezone || null)
      .input('CreatedOn', sql.DateTime, data.CreatedOn)
      .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
      .query(
        `INSERT INTO Contact (
          ContactID, ClientID, Name, Title, PhoneNumber, Email, Role, Timezone, CreatedOn, UpdatedOn
        ) OUTPUT INSERTED.*
        VALUES (
          @ContactID, @ClientID, @Name, @Title, @PhoneNumber, @Email, @Role, @Timezone, @CreatedOn, @UpdatedOn
        )`
      );

    console.log('Insert Result:', result.recordset);

    if (result.recordset.length === 0) {
      console.warn('No record inserted.');
      return null;
    }

    return result.recordset[0];
  } catch (error) {
    console.error('Error in Contact.create:', error, 'Data:', data);
    throw error;
  }
}

  /**
 * Update an existing contact.
 * @param {string} id - The ID of the contact.
 * @param {Object} data - Updated contact data.
 * @returns {Promise<Object|null>} - The updated contact or null if not found.
 */
static async update(id, data) {
  const pool = await poolPromise;
  try {
    console.log('Updating contact with ID:', id, 'Data:', data);

    // Perform the update
    await pool
      .request()
      .input('ContactID', sql.UniqueIdentifier, id)
      .input('Name', sql.NVarChar(255), data.Name)
      .input('Title', sql.NVarChar(255), data.Title)
      .input('PhoneNumber', sql.NVarChar(50), data.PhoneNumber)
      .input('Email', sql.NVarChar(255), data.Email)
      .input('Role', sql.NVarChar(50), data.Role)
      .input('Timezone', sql.NVarChar(100), data.Timezone || null)
      .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
      .query(`
        UPDATE Contact
        SET 
          Name = @Name,
          Title = @Title,
          PhoneNumber = @PhoneNumber,
          Email = @Email,
          Role = @Role,
          Timezone = @Timezone,
          UpdatedOn = @UpdatedOn
        WHERE ContactID = @ContactID
      `);

    // Fetch the updated record
    const result = await pool
      .request()
      .input('ContactID', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          ContactID, 
          ClientID, 
          Name, 
          Title, 
          PhoneNumber, 
          Email, 
          Role, 
          Timezone,
          CreatedOn, 
          UpdatedOn
        FROM Contact
        WHERE ContactID = @ContactID
      `);

    if (result.recordset.length === 0) {
      console.warn('No record found for ContactID:', id);
      return null;
    }

    console.log('Updated Contact:', result.recordset[0]);
    return result.recordset[0]; // Return the updated contact
  } catch (error) {
    console.error('Error in Contact.update:', error, 'ID:', id, 'Data:', data);
    throw error;
  }
}


  /**
   * Delete a contact.
   * @param {string} id - The ID of the contact.
   * @returns {Promise<boolean>} - True if deleted, false otherwise.
   */
  static async delete(id) {
    const pool = await poolPromise;
    try {
      console.log('Deleting contact with ID:', id);
      const result = await pool
        .request()
        .input('ContactID', sql.UniqueIdentifier, id)
        .query('DELETE FROM Contact WHERE ContactID = @ContactID');

      console.log('Delete Result:', result.rowsAffected);

      if (result.rowsAffected[0] === 0) {
        console.warn('No record found to delete for ID:', id);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in Contact.delete:', error, 'ID:', id);
      throw error;
    }
  }
}

export default Contact;
