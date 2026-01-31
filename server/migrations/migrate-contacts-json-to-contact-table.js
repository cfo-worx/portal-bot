// Migration: Copy ContactsJson data from Client table to Contact table
// This script parses the JSON contacts and inserts them into the Contact table

import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

async function migrateContactsJsonToContactTable() {
  const pool = await poolPromise;
  const transaction = pool.transaction();

  try {
    await transaction.begin();

    console.log('Starting migration: Copy ContactsJson to Contact table...');

    // Fetch all clients with ContactsJson
    const clientsResult = await transaction
      .request()
      .query(`
        SELECT ClientID, ContactsJson
        FROM Client
        WHERE ContactsJson IS NOT NULL 
        AND ContactsJson != ''
        AND ContactsJson != '[]'
      `);

    const clients = clientsResult.recordset;
    console.log(`Found ${clients.length} clients with ContactsJson`);

    let totalContactsProcessed = 0;
    let totalContactsInserted = 0;
    let totalContactsSkipped = 0;
    let errors = [];

    for (const client of clients) {
      try {
        // Parse the JSON
        let contacts = [];
        try {
          contacts = JSON.parse(client.ContactsJson);
          if (!Array.isArray(contacts)) {
            console.warn(`Client ${client.ClientID}: ContactsJson is not an array, skipping`);
            continue;
          }
        } catch (parseError) {
          console.error(`Client ${client.ClientID}: Failed to parse ContactsJson - ${parseError.message}`);
          errors.push({
            clientId: client.ClientID,
            error: `JSON Parse Error: ${parseError.message}`
          });
          continue;
        }

        console.log(`Processing Client ${client.ClientID}: ${contacts.length} contacts found`);

        for (const contact of contacts) {
          totalContactsProcessed++;

          // Extract contact data (handle both camelCase and PascalCase)
          const name = contact.name || '';
          const title = contact.title || null;
          const phoneNumber = contact.phone || null;
          const email = contact.email || null;
          const timezone = contact.tz || null;

          // Insert new contact
          const contactId = uuidv4();
          await transaction
            .request()
            .input('ContactID', sql.UniqueIdentifier, contactId)
            .input('ClientID', sql.UniqueIdentifier, client.ClientID)
            .input('Name', sql.NVarChar(255), name)
            .input('Title', sql.NVarChar(255), title)
            .input('PhoneNumber', sql.NVarChar(50), phoneNumber)
            .input('Email', sql.NVarChar(255), email)
            .input('Role', sql.NVarChar(50), null)
            .input('Timezone', sql.NVarChar(100), timezone)
            .input('CreatedOn', sql.DateTime, new Date())
            .input('UpdatedOn', sql.DateTime, new Date())
            .query(`
              INSERT INTO Contact (
                ContactID, ClientID, Name, Title, PhoneNumber, Email, Role, Timezone, CreatedOn, UpdatedOn
              )
              VALUES (
                @ContactID, @ClientID, @Name, @Title, @PhoneNumber, @Email, @Role, @Timezone, @CreatedOn, @UpdatedOn
              )
            `);

          totalContactsInserted++;
          console.log(`Inserted contact: ${name || email}`);
        }
      } catch (clientError) {
        console.error(`Error processing Client ${client.ClientID}:`, clientError);
        errors.push({
          clientId: client.ClientID,
          error: clientError.message
        });
        // Continue with next client
      }
    }

    // Commit transaction
    await transaction.commit();

    console.log('\n=== Migration Summary ===');
    console.log(`Total contacts processed: ${totalContactsProcessed}`);
    console.log(`Total contacts inserted: ${totalContactsInserted}`);
    console.log(`Total contacts skipped: ${totalContactsSkipped}`);
    
    if (errors.length > 0) {
      console.log(`\nErrors encountered: ${errors.length}`);
      errors.forEach(err => {
        console.log(`  - Client ${err.clientId}: ${err.error}`);
      });
    }

    console.log('\nMigration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if executed directly
if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, '/')) || 
    process.argv[1]?.includes('migrate-contacts-json-to-contact-table.js')) {
  migrateContactsJsonToContactTable()
    .then(() => {
      console.log('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

export default migrateContactsJsonToContactTable;

