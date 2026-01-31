import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMDealActivity {
  static async getByDeal(dealId) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('DealID', sql.UniqueIdentifier, dealId)
      .query(`
        SELECT 
          a.*,
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM CRMDealActivity a
        LEFT JOIN Users u ON a.CreatedBy = u.UserID
        WHERE a.DealID = @DealID
        ORDER BY a.ActivityDate DESC
      `);
    return result.recordset;
  }

  static async create(data) {
    const pool = await poolPromise;
    const activityId = data.ActivityID || uuidv4();
    const result = await pool
      .request()
      .input('ActivityID', sql.UniqueIdentifier, activityId)
      .input('DealID', sql.UniqueIdentifier, data.DealID)
      .input('ActivityType', sql.NVarChar, data.ActivityType)
      .input('ActivityDescription', sql.NVarChar, data.ActivityDescription || null)
      .input('ActivityDate', sql.DateTime2, data.ActivityDate || new Date())
      .input('CreatedBy', sql.UniqueIdentifier, data.CreatedBy || null)
      .query(`
        INSERT INTO CRMDealActivity (ActivityID, DealID, ActivityType, ActivityDescription, ActivityDate, CreatedBy)
        VALUES (@ActivityID, @DealID, @ActivityType, @ActivityDescription, @ActivityDate, @CreatedBy);
        SELECT * FROM CRMDealActivity WHERE ActivityID = @ActivityID;
      `);
    
    // Update deal's last activity
    await pool
      .request()
      .input('DealID', sql.UniqueIdentifier, data.DealID)
      .input('LastActivity', sql.NVarChar, data.ActivityDescription || data.ActivityType)
      .input('LastActivityDate', sql.DateTime2, data.ActivityDate || new Date())
      .query(`
        UPDATE CRMDeal
        SET LastActivity = @LastActivity,
            LastActivityDate = @LastActivityDate,
            ActivityCount = ActivityCount + 1,
            UpdatedOn = GETDATE()
        WHERE DealID = @DealID
      `);
    
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('ActivityID', sql.UniqueIdentifier, id)
      .query('DELETE FROM CRMDealActivity WHERE ActivityID = @ActivityID');
    return true;
  }
}

export default CRMDealActivity;

