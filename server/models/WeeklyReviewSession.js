import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

class WeeklyReviewSession {
  /**
   * Get review sessions for a specific week
   * @param {string} weekStartDate - YYYY-MM-DD format
   * @param {string} weekEndDate - YYYY-MM-DD format
   * @param {string|null} clientId - Optional client filter
   * @param {string|null} consultantId - Optional consultant filter
   */
  static async getByWeek(weekStartDate, weekEndDate, clientId = null, consultantId = null) {
    const pool = await poolPromise;
    const request = pool.request()
      .input('WeekStartDate', sql.Date, weekStartDate)
      .input('WeekEndDate', sql.Date, weekEndDate);

    let query = `
      SELECT 
        wrs.*,
        c.ClientName,
        cons.FirstName + ' ' + cons.LastName AS ConsultantName,
        u1.FirstName + ' ' + u1.LastName AS CreatedByName,
        u2.FirstName + ' ' + u2.LastName AS UpdatedByName
      FROM WeeklyReviewSession wrs
      LEFT JOIN Client c ON wrs.ClientID = c.ClientID
      LEFT JOIN Consultant cons ON wrs.ConsultantID = cons.ConsultantID
      LEFT JOIN Users u1 ON wrs.CreatedByUserID = u1.UserID
      LEFT JOIN Users u2 ON wrs.UpdatedByUserID = u2.UserID
      WHERE wrs.WeekStartDate = @WeekStartDate 
        AND wrs.WeekEndDate = @WeekEndDate
    `;

    if (clientId) {
      request.input('ClientID', sql.UniqueIdentifier, clientId);
      query += ` AND wrs.ClientID = @ClientID`;
    } else {
      query += ` AND wrs.ClientID IS NULL`;
    }

    if (consultantId) {
      request.input('ConsultantID', sql.UniqueIdentifier, consultantId);
      query += ` AND wrs.ConsultantID = @ConsultantID`;
    } else {
      query += ` AND wrs.ConsultantID IS NULL`;
    }

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Get review sessions for a specific week (all entities)
   */
  static async getAllByWeek(weekStartDate, weekEndDate) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('WeekStartDate', sql.Date, weekStartDate)
      .input('WeekEndDate', sql.Date, weekEndDate)
      .query(`
        SELECT 
          wrs.*,
          c.ClientName,
          cons.FirstName + ' ' + cons.LastName AS ConsultantName,
          u1.FirstName + ' ' + u1.LastName AS CreatedByName,
          u2.FirstName + ' ' + u2.LastName AS UpdatedByName
        FROM WeeklyReviewSession wrs
        LEFT JOIN Client c ON wrs.ClientID = c.ClientID
        LEFT JOIN Consultant cons ON wrs.ConsultantID = cons.ConsultantID
        LEFT JOIN Users u1 ON wrs.CreatedByUserID = u1.UserID
        LEFT JOIN Users u2 ON wrs.UpdatedByUserID = u2.UserID
        WHERE wrs.WeekStartDate = @WeekStartDate 
          AND wrs.WeekEndDate = @WeekEndDate
        ORDER BY 
          CASE WHEN wrs.ClientID IS NULL THEN 0 ELSE 1 END,
          c.ClientName,
          CASE WHEN wrs.ConsultantID IS NULL THEN 0 ELSE 1 END,
          cons.LastName, cons.FirstName
      `);
    return result.recordset;
  }

  /**
   * Get prior week sessions for carry-forward
   */
  static async getPriorWeekSessions(weekStartDate, clientId = null, consultantId = null) {
    const pool = await poolPromise;
    const priorWeekStart = new Date(weekStartDate);
    priorWeekStart.setDate(priorWeekStart.getDate() - 7);
    const priorWeekEnd = new Date(priorWeekStart);
    priorWeekEnd.setDate(priorWeekEnd.getDate() + 6);

    const request = pool.request()
      .input('WeekStartDate', sql.Date, priorWeekStart.toISOString().split('T')[0])
      .input('WeekEndDate', sql.Date, priorWeekEnd.toISOString().split('T')[0]);

    let query = `
      SELECT 
        wrs.*,
        c.ClientName,
        cons.FirstName + ' ' + cons.LastName AS ConsultantName
      FROM WeeklyReviewSession wrs
      LEFT JOIN Client c ON wrs.ClientID = c.ClientID
      LEFT JOIN Consultant cons ON wrs.ConsultantID = cons.ConsultantID
      WHERE wrs.WeekStartDate = @WeekStartDate 
        AND wrs.WeekEndDate = @WeekEndDate
    `;

    if (clientId) {
      request.input('ClientID', sql.UniqueIdentifier, clientId);
      query += ` AND wrs.ClientID = @ClientID`;
    } else {
      query += ` AND wrs.ClientID IS NULL`;
    }

    if (consultantId) {
      request.input('ConsultantID', sql.UniqueIdentifier, consultantId);
      query += ` AND wrs.ConsultantID = @ConsultantID`;
    } else {
      query += ` AND wrs.ConsultantID IS NULL`;
    }

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Create or update a review session
   */
  static async upsert(data) {
    const pool = await poolPromise;
    const {
      ReviewSessionID,
      WeekStartDate,
      WeekEndDate,
      ClientID,
      ConsultantID,
      Notes,
      ActionItems,
      Status,
      CreatedByUserID,
      UpdatedByUserID,
      CarriedForwardFromSessionID,
    } = data;

    const sessionId = ReviewSessionID || uuidv4();
    const now = new Date();

    const request = pool.request()
      .input('ReviewSessionID', sql.UniqueIdentifier, sessionId)
      .input('WeekStartDate', sql.Date, WeekStartDate)
      .input('WeekEndDate', sql.Date, WeekEndDate)
      .input('ClientID', sql.UniqueIdentifier, ClientID ?? null)
      .input('ConsultantID', sql.UniqueIdentifier, ConsultantID ?? null)
      .input('Notes', sql.NVarChar(sql.MAX), Notes ?? null)
      .input('ActionItems', sql.NVarChar(sql.MAX), ActionItems ?? null)
      .input('Status', sql.NVarChar(30), Status ?? 'draft')
      .input('CreatedByUserID', sql.UniqueIdentifier, CreatedByUserID ?? null)
      .input('UpdatedByUserID', sql.UniqueIdentifier, UpdatedByUserID ?? null)
      .input('CarriedForwardFromSessionID', sql.UniqueIdentifier, CarriedForwardFromSessionID ?? null)
      .input('UpdatedAt', sql.DateTime2, now);

    await request.query(`
      IF EXISTS (SELECT 1 FROM WeeklyReviewSession WHERE ReviewSessionID = @ReviewSessionID)
      BEGIN
        UPDATE WeeklyReviewSession
        SET WeekStartDate = @WeekStartDate,
            WeekEndDate = @WeekEndDate,
            ClientID = @ClientID,
            ConsultantID = @ConsultantID,
            Notes = @Notes,
            ActionItems = @ActionItems,
            Status = @Status,
            UpdatedByUserID = @UpdatedByUserID,
            UpdatedAt = @UpdatedAt
        WHERE ReviewSessionID = @ReviewSessionID
      END
      ELSE
      BEGIN
        INSERT INTO WeeklyReviewSession (
          ReviewSessionID, WeekStartDate, WeekEndDate, ClientID, ConsultantID,
          Notes, ActionItems, Status, CreatedByUserID, UpdatedByUserID,
          CarriedForwardFromSessionID, CreatedAt, UpdatedAt
        )
        VALUES (
          @ReviewSessionID, @WeekStartDate, @WeekEndDate, @ClientID, @ConsultantID,
          @Notes, @ActionItems, @Status, @CreatedByUserID, @UpdatedByUserID,
          @CarriedForwardFromSessionID, @UpdatedAt, @UpdatedAt
        )
      END
    `);

    const result = await pool.request()
      .input('ReviewSessionID', sql.UniqueIdentifier, sessionId)
      .query(`
        SELECT 
          wrs.*,
          c.ClientName,
          cons.FirstName + ' ' + cons.LastName AS ConsultantName
        FROM WeeklyReviewSession wrs
        LEFT JOIN Client c ON wrs.ClientID = c.ClientID
        LEFT JOIN Consultant cons ON wrs.ConsultantID = cons.ConsultantID
        WHERE wrs.ReviewSessionID = @ReviewSessionID
      `);

    return result.recordset[0];
  }

  /**
   * Delete a review session
   */
  static async delete(sessionId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('ReviewSessionID', sql.UniqueIdentifier, sessionId)
      .query(`DELETE FROM WeeklyReviewSession WHERE ReviewSessionID = @ReviewSessionID`);
    
    return result.rowsAffected[0] > 0;
  }
}

export default WeeklyReviewSession;

