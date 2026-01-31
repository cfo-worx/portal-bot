import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class BuySideClient {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        c.*,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        (SELECT COUNT(*) FROM BuySideCampaign WHERE ClientID = c.ClientID AND IsActive = 1) AS CampaignCount
      FROM BuySideClient c
      LEFT JOIN Users u ON c.CreatedBy = u.UserID
      WHERE c.IsActive = 1
      ORDER BY c.ClientName
    `);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          c.*,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM BuySideClient c
        LEFT JOIN Users u ON c.CreatedBy = u.UserID
        WHERE c.ClientID = @ClientID
      `);
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const clientId = data.ClientID || uuidv4();
    
    const result = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientId)
      .input('ClientName', sql.NVarChar, data.ClientName)
      .input('Description', sql.NVarChar(sql.MAX), data.Description || null)
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .query(`
        INSERT INTO BuySideClient (ClientID, ClientName, Description, CreatedBy)
        VALUES (@ClientID, @ClientName, @Description, @CreatedBy);
        SELECT * FROM BuySideClient WHERE ClientID = @ClientID;
      `);
    
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const updates = [];
    const request = pool.request().input('ClientID', sql.UniqueIdentifier, id);
    
    if (data.ClientName !== undefined) {
      updates.push('ClientName = @ClientName');
      request.input('ClientName', sql.NVarChar, data.ClientName);
    }
    
    if (data.Description !== undefined) {
      updates.push('Description = @Description');
      request.input('Description', sql.NVarChar(sql.MAX), data.Description || null);
    }
    
    if (data.IsActive !== undefined) {
      updates.push('IsActive = @IsActive');
      request.input('IsActive', sql.Bit, data.IsActive);
    }
    
    if (updates.length === 0) {
      return await this.getById(id);
    }
    
    updates.push('UpdatedOn = GETDATE()');
    
    const query = `UPDATE BuySideClient SET ${updates.join(', ')} WHERE ClientID = @ClientID; SELECT * FROM BuySideClient WHERE ClientID = @ClientID;`;
    const result = await request.query(query);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, id)
      .query('UPDATE BuySideClient SET IsActive = 0 WHERE ClientID = @ClientID');
    return true;
  }
}

export default BuySideClient;

