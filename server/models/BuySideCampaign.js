import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class BuySideCampaign {
  static async getAll(filters = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    
    let query = `
      SELECT 
        c.*,
        cl.ClientName,
        u.FirstName + ' ' + u.LastName AS CreatedByName,
        (SELECT COUNT(*) FROM CRMDeal WHERE Module = 'buy' AND DetailsJson LIKE '%"campaignID":"' + CAST(c.CampaignID AS NVARCHAR(36)) + '"%' AND IsActive = 1) AS DealCount
      FROM BuySideCampaign c
      LEFT JOIN BuySideClient cl ON c.ClientID = cl.ClientID
      LEFT JOIN Users u ON c.CreatedBy = u.UserID
      WHERE c.IsActive = 1
    `;
    
    if (filters.clientId) {
      query += ' AND c.ClientID = @ClientID';
      request.input('ClientID', sql.UniqueIdentifier, filters.clientId);
    }
    
    query += ' ORDER BY cl.ClientName, c.CampaignName';
    
    const result = await request.query(query);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('CampaignID', sql.UniqueIdentifier, id)
      .query(`
        SELECT 
          c.*,
          cl.ClientName,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM BuySideCampaign c
        LEFT JOIN BuySideClient cl ON c.ClientID = cl.ClientID
        LEFT JOIN Users u ON c.CreatedBy = u.UserID
        WHERE c.CampaignID = @CampaignID
      `);
    return result.recordset[0] || null;
  }

  static async getByClientId(clientId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ClientID', sql.UniqueIdentifier, clientId)
      .query(`
        SELECT * FROM BuySideCampaign
        WHERE ClientID = @ClientID AND IsActive = 1
        ORDER BY CampaignName
      `);
    return result.recordset;
  }

  static async create(data) {
    const pool = await poolPromise;
    const campaignId = data.CampaignID || uuidv4();
    
    const result = await pool
      .request()
      .input('CampaignID', sql.UniqueIdentifier, campaignId)
      .input('ClientID', sql.UniqueIdentifier, data.ClientID)
      .input('CampaignName', sql.NVarChar, data.CampaignName)
      .input('Description', sql.NVarChar(sql.MAX), data.Description || null)
      .input('Industry', sql.NVarChar, data.Industry || null)
      .input('Location', sql.NVarChar, data.Location || null)
      .input('HeadcountMin', sql.Int, data.HeadcountMin || null)
      .input('HeadcountMax', sql.Int, data.HeadcountMax || null)
      .input('RevenueMin', sql.Decimal(18, 2), data.RevenueMin || null)
      .input('RevenueMax', sql.Decimal(18, 2), data.RevenueMax || null)
      .input('CriteriaJson', sql.NVarChar(sql.MAX), data.CriteriaJson || null)
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .query(`
        INSERT INTO BuySideCampaign (
          CampaignID, ClientID, CampaignName, Description, Industry, Location,
          HeadcountMin, HeadcountMax, RevenueMin, RevenueMax, CriteriaJson, CreatedBy
        )
        VALUES (
          @CampaignID, @ClientID, @CampaignName, @Description, @Industry, @Location,
          @HeadcountMin, @HeadcountMax, @RevenueMin, @RevenueMax, @CriteriaJson, @CreatedBy
        );
        SELECT * FROM BuySideCampaign WHERE CampaignID = @CampaignID;
      `);
    
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const updates = [];
    const request = pool.request().input('CampaignID', sql.UniqueIdentifier, id);
    
    if (data.CampaignName !== undefined) {
      updates.push('CampaignName = @CampaignName');
      request.input('CampaignName', sql.NVarChar, data.CampaignName);
    }
    
    if (data.Description !== undefined) {
      updates.push('Description = @Description');
      request.input('Description', sql.NVarChar(sql.MAX), data.Description || null);
    }
    
    if (data.Industry !== undefined) {
      updates.push('Industry = @Industry');
      request.input('Industry', sql.NVarChar, data.Industry || null);
    }
    
    if (data.Location !== undefined) {
      updates.push('Location = @Location');
      request.input('Location', sql.NVarChar, data.Location || null);
    }
    
    if (data.HeadcountMin !== undefined) {
      updates.push('HeadcountMin = @HeadcountMin');
      request.input('HeadcountMin', sql.Int, data.HeadcountMin || null);
    }
    
    if (data.HeadcountMax !== undefined) {
      updates.push('HeadcountMax = @HeadcountMax');
      request.input('HeadcountMax', sql.Int, data.HeadcountMax || null);
    }
    
    if (data.RevenueMin !== undefined) {
      updates.push('RevenueMin = @RevenueMin');
      request.input('RevenueMin', sql.Decimal(18, 2), data.RevenueMin || null);
    }
    
    if (data.RevenueMax !== undefined) {
      updates.push('RevenueMax = @RevenueMax');
      request.input('RevenueMax', sql.Decimal(18, 2), data.RevenueMax || null);
    }
    
    if (data.CriteriaJson !== undefined) {
      updates.push('CriteriaJson = @CriteriaJson');
      request.input('CriteriaJson', sql.NVarChar(sql.MAX), data.CriteriaJson || null);
    }
    
    if (data.IsActive !== undefined) {
      updates.push('IsActive = @IsActive');
      request.input('IsActive', sql.Bit, data.IsActive);
    }
    
    if (updates.length === 0) {
      return await this.getById(id);
    }
    
    updates.push('UpdatedOn = GETDATE()');
    
    const query = `UPDATE BuySideCampaign SET ${updates.join(', ')} WHERE CampaignID = @CampaignID; SELECT * FROM BuySideCampaign WHERE CampaignID = @CampaignID;`;
    const result = await request.query(query);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('CampaignID', sql.UniqueIdentifier, id)
      .query('UPDATE BuySideCampaign SET IsActive = 0 WHERE CampaignID = @CampaignID');
    return true;
  }
}

export default BuySideCampaign;

