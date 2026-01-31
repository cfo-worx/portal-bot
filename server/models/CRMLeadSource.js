import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMLeadSource {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query('SELECT * FROM CRMLeadSource ORDER BY SourceName');
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('LeadSourceID', sql.UniqueIdentifier, id)
      .query('SELECT * FROM CRMLeadSource WHERE LeadSourceID = @LeadSourceID');
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const sourceId = data.LeadSourceID || uuidv4();
    const result = await pool
      .request()
      .input('LeadSourceID', sql.UniqueIdentifier, sourceId)
      .input('SourceName', sql.NVarChar, data.SourceName)
      .query(`
        INSERT INTO CRMLeadSource (LeadSourceID, SourceName)
        VALUES (@LeadSourceID, @SourceName);
        SELECT * FROM CRMLeadSource WHERE LeadSourceID = @LeadSourceID;
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('LeadSourceID', sql.UniqueIdentifier, id)
      .input('SourceName', sql.NVarChar, data.SourceName)
      .query(`
        UPDATE CRMLeadSource
        SET SourceName = @SourceName,
            UpdatedOn = GETDATE()
        WHERE LeadSourceID = @LeadSourceID;
        SELECT * FROM CRMLeadSource WHERE LeadSourceID = @LeadSourceID;
      `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('LeadSourceID', sql.UniqueIdentifier, id)
      .query('DELETE FROM CRMLeadSource WHERE LeadSourceID = @LeadSourceID');
    return true;
  }
}

export default CRMLeadSource;

