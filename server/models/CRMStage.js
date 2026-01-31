import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMStage {
  static async getAll(module = null) {
    const pool = await poolPromise;
    let query = 'SELECT * FROM CRMStage WHERE IsActive = 1';
    const request = pool.request();
    
    if (module) {
      query += ' AND Module = @Module';
      request.input('Module', sql.NVarChar, module);
    }
    
    query += ' ORDER BY Module, DisplayOrder';
    const result = await request.query(query);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('StageID', sql.UniqueIdentifier, id)
      .query('SELECT * FROM CRMStage WHERE StageID = @StageID');
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const stageId = data.StageID || uuidv4();
    const result = await pool
      .request()
      .input('StageID', sql.UniqueIdentifier, stageId)
      .input('Module', sql.NVarChar, data.Module)
      .input('StageName', sql.NVarChar, data.StageName)
      .input('DisplayOrder', sql.Int, data.DisplayOrder)
      .input('Probability', sql.Decimal(5, 2), data.Probability || 0)
      .input('StaleThresholdDays', sql.Int, data.StaleThresholdDays || 30)
      .input('IsActive', sql.Bit, data.IsActive !== undefined ? data.IsActive : 1)
      .query(`
        INSERT INTO CRMStage (StageID, Module, StageName, DisplayOrder, Probability, StaleThresholdDays, IsActive)
        VALUES (@StageID, @Module, @StageName, @DisplayOrder, @Probability, @StaleThresholdDays, @IsActive);
        SELECT * FROM CRMStage WHERE StageID = @StageID;
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('StageID', sql.UniqueIdentifier, id)
      .input('StageName', sql.NVarChar, data.StageName)
      .input('DisplayOrder', sql.Int, data.DisplayOrder)
      .input('Probability', sql.Decimal(5, 2), data.Probability)
      .input('StaleThresholdDays', sql.Int, data.StaleThresholdDays)
      .input('IsActive', sql.Bit, data.IsActive)
      .query(`
        UPDATE CRMStage
        SET StageName = @StageName,
            DisplayOrder = @DisplayOrder,
            Probability = @Probability,
            StaleThresholdDays = @StaleThresholdDays,
            IsActive = @IsActive,
            UpdatedOn = GETDATE()
        WHERE StageID = @StageID;
        SELECT * FROM CRMStage WHERE StageID = @StageID;
      `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('StageID', sql.UniqueIdentifier, id)
      .query('UPDATE CRMStage SET IsActive = 0 WHERE StageID = @StageID');
    return true;
  }
}

export default CRMStage;

