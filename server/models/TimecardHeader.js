// backend/models/TimecardHeader.js

import { poolPromise, sql } from '../db.js';

class TimecardHeader {
  // Fetch all timecard headers
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM TimecardHeader');
    return result.recordset;
  }

  // Fetch timecard headers by ConsultantID, ordered by TimesheetDate DESC
  static async getByConsultantID(consultantID) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ConsultantID', sql.UniqueIdentifier, consultantID)
      .query(`
        SELECT 
          TimecardID,
          ConsultantID,
          TimesheetDate,
          TotalHours,
          Status,
          Notes,
          CreatedOn,
          UpdatedOn
        FROM TimecardHeader
        WHERE ConsultantID = @ConsultantID
        ORDER BY TimesheetDate DESC
      `);
    return result.recordset;
  }

  // Fetch a specific timecard header by ConsultantID and TimesheetDate
  static async getByConsultantAndDate(consultantID, timesheetDate) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ConsultantID', sql.UniqueIdentifier, consultantID)
      .input('TimesheetDate', sql.Date, timesheetDate)
      .query(`
        SELECT 
          TimecardID,
          ConsultantID,
          TimesheetDate,
          TotalHours,
          Status,
          Notes,
          CreatedOn,
          UpdatedOn
        FROM TimecardHeader
        WHERE ConsultantID = @ConsultantID
          AND TimesheetDate = @TimesheetDate
      `);
    return result.recordset[0]; // Return a single record or undefined
  }

  // Create a new timecard header (for a single day)
  static async create(data) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('TimecardID', sql.UniqueIdentifier, data.TimecardID)
      .input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID)
      .input('TimesheetDate', sql.Date, data.TimesheetDate)
      .input('TotalHours', sql.Decimal(18, 2), data.TotalHours)
      .input('Status', sql.NVarChar(50), data.Status)
      .input('Notes', sql.NVarChar(sql.MAX), data.Notes)
      .input('CreatedOn', sql.DateTime, data.CreatedOn)
      .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
      .query(`
        INSERT INTO TimecardHeader (
          TimecardID, ConsultantID, TimesheetDate, TotalHours, Status, Notes, CreatedOn, UpdatedOn, WeekStartDate, WeekEndDate
        ) VALUES (
          @TimecardID, @ConsultantID, @TimesheetDate, @TotalHours, @Status, @Notes, @CreatedOn, @UpdatedOn, '01/01/1900', '01/01/1900'
        )
      `);
  }

  // Update an existing timecard header
  static async update(id, data) {
    const pool = await poolPromise;
    const fieldsToUpdate = [];
    const request = pool.request().input('TimecardID', sql.UniqueIdentifier, id);

    // Only update allowed fields
    if (data.Status !== undefined) {
      fieldsToUpdate.push('Status = @Status');
      request.input('Status', sql.NVarChar(50), data.Status);
    }
    if (data.Notes !== undefined) {
      fieldsToUpdate.push('Notes = @Notes');
      request.input('Notes', sql.NVarChar(sql.MAX), data.Notes);
    }
    if (data.TotalHours !== undefined) {
      fieldsToUpdate.push('TotalHours = @TotalHours');
      request.input('TotalHours', sql.Decimal(18, 2), data.TotalHours);
    }
    // Always update UpdatedOn
    fieldsToUpdate.push('UpdatedOn = @UpdatedOn');
    request.input('UpdatedOn', sql.DateTime, new Date());

    if (fieldsToUpdate.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE TimecardHeader SET
        ${fieldsToUpdate.join(', ')}
      WHERE TimecardID = @TimecardID
    `;

    await request.query(query);
  }

  // Delete a timecard header
  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('TimecardID', sql.UniqueIdentifier, id)
      .query(`DELETE FROM TimecardHeader WHERE TimecardID = @TimecardID`);
  }
}

export default TimecardHeader;
