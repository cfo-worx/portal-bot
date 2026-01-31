import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class CRMRepGoal {
  static async getAll(filters = {}) {
    const pool = await poolPromise;
    let query = `
      SELECT 
        g.*,
        c.FirstName + ' ' + c.LastName AS ConsultantName
      FROM CRMRepGoal g
      LEFT JOIN Consultant c ON g.ConsultantID = c.ConsultantID
      WHERE 1=1
    `;
    const request = pool.request();

    if (filters.consultantId) {
      query += ' AND g.ConsultantID = @ConsultantID';
      request.input('ConsultantID', sql.UniqueIdentifier, filters.consultantId);
    }

    if (filters.periodType) {
      query += ' AND g.PeriodType = @PeriodType';
      request.input('PeriodType', sql.NVarChar, filters.periodType);
    }

    if (filters.periodStart) {
      query += ' AND g.PeriodStart >= @PeriodStart';
      request.input('PeriodStart', sql.Date, filters.periodStart);
    }

    if (filters.periodEnd) {
      query += ' AND g.PeriodEnd <= @PeriodEnd';
      request.input('PeriodEnd', sql.Date, filters.periodEnd);
    }

    query += ' ORDER BY g.PeriodStart DESC, g.ConsultantID';
    const result = await request.query(query);
    return result.recordset;
  }

  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('GoalID', sql.UniqueIdentifier, id)
      .query('SELECT * FROM CRMRepGoal WHERE GoalID = @GoalID');
    return result.recordset[0] || null;
  }

  static async create(data) {
    const pool = await poolPromise;
    const goalId = data.GoalID || uuidv4();
    
    const toDecimalOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    const result = await pool
      .request()
      .input('GoalID', sql.UniqueIdentifier, goalId)
      .input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID)
      .input('PeriodType', sql.NVarChar, data.PeriodType)
      .input('PeriodStart', sql.Date, data.PeriodStart)
      .input('PeriodEnd', sql.Date, data.PeriodEnd)
      .input('CallsBooked', sql.Int, data.CallsBooked || 0)
      .input('CallsAttended', sql.Int, data.CallsAttended || 0)
      .input('QuotesSent', sql.Int, data.QuotesSent || 0)
      .input('TotalQuoteValue', sql.Decimal(18, 2), toDecimalOrNull(data.TotalQuoteValue))
      .input('AvgQuoteValue', sql.Decimal(18, 2), toDecimalOrNull(data.AvgQuoteValue))
      .input('ClosedWon', sql.Int, data.ClosedWon || 0)
      .query(`
        INSERT INTO CRMRepGoal (
          GoalID, ConsultantID, PeriodType, PeriodStart, PeriodEnd,
          CallsBooked, CallsAttended, QuotesSent, TotalQuoteValue,
          AvgQuoteValue, ClosedWon
        )
        VALUES (
          @GoalID, @ConsultantID, @PeriodType, @PeriodStart, @PeriodEnd,
          @CallsBooked, @CallsAttended, @QuotesSent, @TotalQuoteValue,
          @AvgQuoteValue, @ClosedWon
        );
        SELECT * FROM CRMRepGoal WHERE GoalID = @GoalID;
      `);
    return result.recordset[0];
  }

  static async update(id, data) {
    const pool = await poolPromise;
    
    const toDecimalOrNull = (value) => {
      if (value === null || value === undefined || value === '') return null;
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(num) ? null : num;
    };

    // Get existing goal to merge with updates
    const existing = await pool
      .request()
      .input('GoalID', sql.UniqueIdentifier, id)
      .query('SELECT * FROM CRMRepGoal WHERE GoalID = @GoalID');
    
    if (existing.recordset.length === 0) {
      throw new Error('Goal not found');
    }
    
    const existingGoal = existing.recordset[0];
    
    // Merge existing values with updates (only update fields that are provided)
    const updateData = {
      CallsBooked: data.CallsBooked !== undefined ? data.CallsBooked : existingGoal.CallsBooked,
      CallsAttended: data.CallsAttended !== undefined ? data.CallsAttended : existingGoal.CallsAttended,
      QuotesSent: data.QuotesSent !== undefined ? data.QuotesSent : existingGoal.QuotesSent,
      TotalQuoteValue: data.TotalQuoteValue !== undefined ? toDecimalOrNull(data.TotalQuoteValue) : existingGoal.TotalQuoteValue,
      AvgQuoteValue: data.AvgQuoteValue !== undefined ? toDecimalOrNull(data.AvgQuoteValue) : existingGoal.AvgQuoteValue,
      ClosedWon: data.ClosedWon !== undefined ? data.ClosedWon : existingGoal.ClosedWon,
    };

    const result = await pool
      .request()
      .input('GoalID', sql.UniqueIdentifier, id)
      .input('CallsBooked', sql.Int, updateData.CallsBooked || 0)
      .input('CallsAttended', sql.Int, updateData.CallsAttended || 0)
      .input('QuotesSent', sql.Int, updateData.QuotesSent || 0)
      .input('TotalQuoteValue', sql.Decimal(18, 2), toDecimalOrNull(updateData.TotalQuoteValue))
      .input('AvgQuoteValue', sql.Decimal(18, 2), toDecimalOrNull(updateData.AvgQuoteValue))
      .input('ClosedWon', sql.Int, updateData.ClosedWon || 0)
      .query(`
        UPDATE CRMRepGoal
        SET CallsBooked = @CallsBooked,
            CallsAttended = @CallsAttended,
            QuotesSent = @QuotesSent,
            TotalQuoteValue = @TotalQuoteValue,
            AvgQuoteValue = @AvgQuoteValue,
            ClosedWon = @ClosedWon,
            UpdatedOn = GETDATE()
        WHERE GoalID = @GoalID;
        SELECT * FROM CRMRepGoal WHERE GoalID = @GoalID;
      `);
    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('GoalID', sql.UniqueIdentifier, id)
      .query('DELETE FROM CRMRepGoal WHERE GoalID = @GoalID');
    return true;
  }

  // Get or create goal for a consultant and period
  // Note: PeriodStart and PeriodEnd are required by schema but not used in logic
  static async getOrCreate(consultantId, periodType, periodStart, periodEnd) {
    const pool = await poolPromise;
    
    // Try to find existing goal - only check ConsultantID and PeriodType
    // Ignore PeriodStart since we don't need to consider it per requirements
    const existing = await pool
      .request()
      .input('ConsultantID', sql.UniqueIdentifier, consultantId)
      .input('PeriodType', sql.NVarChar, periodType)
      .query(`
        SELECT TOP 1 * FROM CRMRepGoal 
        WHERE ConsultantID = @ConsultantID 
          AND PeriodType = @PeriodType
        ORDER BY CreatedOn DESC
      `);
    
    if (existing.recordset.length > 0) {
      return existing.recordset[0];
    }
    
    // Create new goal with provided periodStart/periodEnd (required by schema)
    return await this.create({
      ConsultantID: consultantId,
      PeriodType: periodType,
      PeriodStart: periodStart,
      PeriodEnd: periodEnd,
    });
  }
}

export default CRMRepGoal;

