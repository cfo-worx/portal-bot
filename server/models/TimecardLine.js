// backend/models/TimecardLine.js

import { poolPromise, sql } from '../db.js';

class TimecardLine {
  // Fetch all timecard lines
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM TimecardLines');
    return result.recordset;
  }

  // Fetch timecard lines by TimecardID
  static async getByTimecardID(timecardID) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('TimecardID', sql.UniqueIdentifier, timecardID)
      .query(`
        SELECT 
          tl.*,
          c.FirstName,
          c.LastName,
          cl.ClientName
        FROM TimecardLines tl
        JOIN Consultant c ON tl.ConsultantID = c.ConsultantID
        JOIN Client cl ON tl.ClientID = cl.ClientID
        WHERE tl.TimecardID = @TimecardID
      `);
    return result.recordset;
  }

  // Create a new timecard line (for a single day)
  static async create(data) {
    const pool = await poolPromise;
    try {

      const fallbackProjectId = 'B892F250-8A39-4411-BC76-372693828E56';
const safeProjectId = data.ProjectID && data.ProjectID.trim() !== '' ? data.ProjectID : fallbackProjectId;
const safeProjectName = data.ProjectName && data.ProjectName.trim() !== ''
  ? data.ProjectName
  : 'Time Entry';

      await pool
        .request()
        .input('TimecardLineID', sql.UniqueIdentifier, data.TimecardLineID)
        .input('TimecardID', sql.UniqueIdentifier, data.TimecardID)
        .input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID)
        .input('TimesheetDate', sql.Date, data.TimesheetDate)
        .input('ClientID', sql.UniqueIdentifier, data.ClientID)
        .input('ProjectID', sql.UniqueIdentifier, safeProjectId)
        .input('ProjectName', sql.NVarChar(255), safeProjectName)
        .input('ProjectTask', sql.NVarChar(255), data.ProjectTask)
        .input('ClientFacingHours', sql.Decimal(18, 2), data.ClientFacingHours)
        .input('NonClientFacingHours', sql.Decimal(18, 2), data.NonClientFacingHours)
        .input('OtherTaskHours', sql.Decimal(18, 2), data.OtherTaskHours)
        .input('Status', sql.NVarChar(50), data.Status)
        .input('Notes', sql.NVarChar(sql.MAX), data.Notes)
        .input('BenchmarkStatus', sql.NVarChar(50), data.BenchmarkStatus)
        .input('ApprovedBy', sql.NVarChar(255), data.ApprovedBy)
        .input('RejectedNotes', sql.NVarChar(sql.MAX), data.RejectedNotes)
        .input('CreatedOn', sql.DateTime, data.CreatedOn)
        .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
        .query(`
          INSERT INTO TimecardLines (
            TimecardLineID, TimecardID, ConsultantID, TimesheetDate, ClientID,
            ProjectID, ProjectName, ProjectTask, ClientFacingHours, NonClientFacingHours,
            OtherTaskHours, Status, Notes, BenchmarkStatus, ApprovedBy, RejectedNotes,
            CreatedOn, UpdatedOn, WeekStartDate, WeekEndDate
          ) VALUES (
            @TimecardLineID, @TimecardID, @ConsultantID, @TimesheetDate, @ClientID,
            @ProjectID, @ProjectName, 'Time Task', @ClientFacingHours, @NonClientFacingHours,
            @OtherTaskHours, @Status, @Notes, @BenchmarkStatus, @ApprovedBy, @RejectedNotes,
            @CreatedOn, @UpdatedOn, '01/01/1900', '01/01/1900'
          )
        `);

      return { message: 'Timecard line created successfully', TimecardLineID: data.TimecardLineID };
    } catch (error) {
      console.error('Error creating timecard line:', error);
      throw error; 
    }
  }


  
// Update an existing timecard line
static async update(id, data) {
  const pool = await poolPromise;
  const fieldsToUpdate = [];
  const request = pool.request().input('TimecardLineID', sql.UniqueIdentifier, id);

  // Fetch the current status of the timecard
  const currentStatusQuery = `
    SELECT Status FROM TimecardLines WHERE TimecardLineID = @TimecardLineID
  `;
  const { recordset } = await request.query(currentStatusQuery);
  const currentStatus = recordset[0]?.Status;

  // Restrict updates if status is 'Approved' or 'Submitted'
  if (['Approved'].includes(currentStatus)) {
    throw new Error('Cannot update fields for a timecard with status "Approved" or "Submitted".');
  }

  // Dynamically add all fields to update
  if (data.Status !== undefined) {
    fieldsToUpdate.push('Status = @Status');
    request.input('Status', sql.NVarChar(50), data.Status);
  }
  if (data.Notes !== undefined) {
    fieldsToUpdate.push('Notes = @Notes');
    request.input('Notes', sql.NVarChar(sql.MAX), data.Notes);
  }
  if (data.BenchmarkStatus !== undefined) {
    fieldsToUpdate.push('BenchmarkStatus = @BenchmarkStatus');
    request.input('BenchmarkStatus', sql.NVarChar(50), data.BenchmarkStatus);
  }
  if (data.ApprovedBy !== undefined) {
    fieldsToUpdate.push('ApprovedBy = @ApprovedBy');
    request.input('ApprovedBy', sql.NVarChar(255), data.ApprovedBy);
  }
  if (data.RejectedNotes !== undefined) {
    fieldsToUpdate.push('RejectedNotes = @RejectedNotes');
    request.input('RejectedNotes', sql.NVarChar(sql.MAX), data.RejectedNotes);
  }
  if (data.ClientID !== undefined) {
    fieldsToUpdate.push('ClientID = @ClientID');
    request.input('ClientID', sql.UniqueIdentifier, data.ClientID);
  }
 if (data.ProjectID !== undefined) {
  const fallbackProjectId = 'B892F250-8A39-4411-BC76-372693828E56'; 
  const safeProjectId = data.ProjectID && data.ProjectID.trim() !== '' ? data.ProjectID : fallbackProjectId;

  fieldsToUpdate.push('ProjectID = @ProjectID');
  request.input('ProjectID', sql.UniqueIdentifier, safeProjectId);
}

  if (data.ProjectTask !== undefined) {
    fieldsToUpdate.push('ProjectTask = @ProjectTask');
    request.input('ProjectTask', sql.NVarChar(255), data.ProjectTask);
  }
  if (data.ClientFacingHours !== undefined) {
    fieldsToUpdate.push('ClientFacingHours = @ClientFacingHours');
    request.input('ClientFacingHours', sql.Decimal(5, 2), data.ClientFacingHours);
  }
  if (data.NonClientFacingHours !== undefined) {
    fieldsToUpdate.push('NonClientFacingHours = @NonClientFacingHours');
    request.input('NonClientFacingHours', sql.Decimal(5, 2), data.NonClientFacingHours);
  }
  if (data.OtherTaskHours !== undefined) {
    fieldsToUpdate.push('OtherTaskHours = @OtherTaskHours');
    request.input('OtherTaskHours', sql.Decimal(5, 2), data.OtherTaskHours);
  }

  if (data.IsLocked !== undefined) {
    fieldsToUpdate.push('IsLocked = @IsLocked');
    request.input('IsLocked', sql.Bit, data.IsLocked);
  }  

  // Always update UpdatedOn
  fieldsToUpdate.push('UpdatedOn = @UpdatedOn');
  request.input('UpdatedOn', sql.DateTime, new Date());

  if (fieldsToUpdate.length === 0) {
    throw new Error('No fields to update');
  }

  const query = `
    UPDATE TimecardLines SET 
      ${fieldsToUpdate.join(', ')}
    WHERE TimecardLineID = @TimecardLineID
  `;

  await request.query(query);
}



// Updated method to fetch all timecard lines with consultant and client details including CompanyEmail
static async getAllWithDetails() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      tl.TimecardLineID,
      tl.IsLocked,
      tl.TimecardID,
      tl.ConsultantID,
      c.FirstName,
      c.LastName,
      c.CompanyEmail,
      c.JobTitle,
      tl.TimesheetDate,
      tl.ClientID,
      cl.ClientName,
      tl.ProjectID,
      tl.ProjectName,
      tl.ProjectTask,
      tl.ClientFacingHours,
      tl.NonClientFacingHours,
      tl.OtherTaskHours,
      tl.Status,
      tl.Notes,
      tl.BenchmarkStatus,
      tl.ApprovedBy,
      tl.RejectedNotes
    FROM TimecardLines tl
    JOIN Consultant c ON tl.ConsultantID = c.ConsultantID
    JOIN Client cl ON tl.ClientID = cl.ClientID
  `);
  return result.recordset;
}



  // Delete a timecard line
  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('TimecardLineID', sql.UniqueIdentifier, id)
      .query(`DELETE FROM TimecardLines WHERE TimecardLineID = @TimecardLineID`);
  }

  // Fetch summary data by day (TimesheetDate)
  static async getSummary() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        CONCAT(c.FirstName, ' ', c.LastName) AS ConsultantName,
        tl.ConsultantID,
        tl.TimesheetDate,
        SUM(tl.ClientFacingHours + tl.NonClientFacingHours + tl.OtherTaskHours) AS TotalHours
      FROM TimecardLines tl
      JOIN Consultant c ON tl.ConsultantID = c.ConsultantID
      GROUP BY 
        CONCAT(c.FirstName, ' ', c.LastName), tl.ConsultantID, tl.TimesheetDate
      ORDER BY 
        CONCAT(c.FirstName, ' ', c.LastName), tl.TimesheetDate
    `);
    return result.recordset;
  }



// Fetch timecard lines by ConsultantID and Month/Year
static async getByConsultantAndMonth(consultantID, month, year) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('ConsultantID', sql.UniqueIdentifier, consultantID)
    .input('Month', sql.Int, month)
    .input('Year', sql.Int, year)
    .query(`
      SELECT * 
      FROM TimecardLines
      WHERE ConsultantID = @ConsultantID
      AND YEAR(TimesheetDate) = @Year
      AND MONTH(TimesheetDate) = @Month
    `);
  return result.recordset;
}

// Fetch timecard lines by ConsultantID and Date (with client details)
static async getByConsultantAndDate(consultantID, date) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('ConsultantID', sql.UniqueIdentifier, consultantID)
    .input('Date', sql.Date, date)
    .query(`
      SELECT 
        tcl.TimecardLineID,
        tcl.IsLocked,
        c.ClientName,
        c.ClientID,
        tcl.Notes,
        tcl.ClientFacingHours,
        tcl.NonClientFacingHours,
        tcl.OtherTaskHours,
        tcl.TotalHours,
        tcl.Status,
        tcl.ProjectName,
        tcl.ProjectTask,
        tcl.TimesheetDate
      FROM TimecardLines tcl
      JOIN Client c ON tcl.ClientID = c.ClientID
      WHERE tcl.ConsultantID = @ConsultantID
      AND tcl.TimesheetDate = @Date
    `);
  return result.recordset;
}


// Fetch timecard lines by month and year for all consultants
static async getByMonth(month, year) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('Month', sql.Int, month)
    .input('Year', sql.Int, year)
    .query(`
      SELECT *
      FROM TimecardLines
      WHERE YEAR(TimesheetDate) = @Year
      AND MONTH(TimesheetDate) = @Month
    `);
  return result.recordset;
}


// backend/models/TimecardLine.js

static async getByDate(date) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('Date', sql.Date, date)
    .query(`
      SELECT 
        tl.*,
        c.FirstName,
        c.LastName,
        c.CompanyEmail,
        cl.ClientName,
        p.ProjectName as ProjectNameV2
      FROM TimecardLines tl
      JOIN Consultant c ON tl.ConsultantID = c.ConsultantID
      JOIN Client cl ON tl.ClientID = cl.ClientID
      LEFT JOIN Projects p ON tl.ProjectID = p.ProjectID
      WHERE tl.TimesheetDate = @Date
    `);
  return result.recordset;
}






// Submit timesheet for a day (sets status to 'Submitted' + IsLocked=1)
static async submitTimesheetForDay(consultantID, date) {
  const pool = await poolPromise;
  try {
    const result = await pool.request()
      .input('ConsultantID', sql.UniqueIdentifier, consultantID)
      .input('Date', sql.Date, date)
      .input('UpdatedOn', sql.DateTime, new Date())
      .query(`
        UPDATE TimecardLines
        SET 
          Status = 'Submitted',
          IsLocked = 1,
          UpdatedOn = @UpdatedOn
        WHERE ConsultantID = @ConsultantID
          AND TimesheetDate = @Date
          AND Status IN ('Open', 'Rejected')
      `);
    return result.rowsAffected;
  } catch (error) {
    console.error('Error submitting timesheet for day:', error);
    throw error;
  }
}



}

export default TimecardLine;
