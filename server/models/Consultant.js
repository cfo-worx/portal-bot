import { poolPromise, sql } from '../db.js';

class Consultant {
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
        SELECT
          c.*,
          tl.LatestTimesheetDate
        FROM Consultant AS c
        LEFT JOIN (
          SELECT
            ConsultantID,
            MAX(TimesheetDate) AS LatestTimesheetDate
          FROM timecardlines
          GROUP BY ConsultantID
        ) AS tl
          ON c.ConsultantID = tl.ConsultantID;
      `);
      return result.recordset;
    } catch (error) {
      console.error('Error loading consultants with last timesheet:', error);
      throw error;
    }
  }
  


   // New function to get only active consultants
   static async getActiveConsultants() {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT * FROM Consultant WHERE Status = 1');
    return result.recordset;
  }
  

  static async create(data) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ConsultantID', sql.UniqueIdentifier, data.ConsultantID)
      .input('FirstName', sql.NVarChar, data.FirstName)
      .input('LastName', sql.NVarChar, data.LastName)
      .input('CompanyEmail', sql.NVarChar, data.CompanyEmail)
      .input('PersonalEmail', sql.NVarChar, data.PersonalEmail)
      .input('PhoneNumber', sql.NVarChar, data.PhoneNumber)
      .input('EmergencyContactName', sql.NVarChar, data.EmergencyContactName)
      .input('EmergencyContactPhone', sql.NVarChar, data.EmergencyContactPhone)
      .input('JobTitle', sql.NVarChar, data.JobTitle)
      .input('HireDate', sql.Date, data.HireDate)
      .input('PayType', sql.NVarChar, data.PayType)
      .input('PayRate', sql.Decimal(18, 2), data.PayRate)
      .input('HourlyRate', sql.Decimal(18, 2), data.HourlyRate || null)
      .input('TimecardCycle', sql.NVarChar, data.TimecardCycle)
      .input('DomesticInternational', sql.Bit, data.DomesticInternational)
      .input('Status', sql.Bit, data.Status)
      .input('Address', sql.NVarChar, data.Address)
      .input('CreatedOn', sql.DateTime, data.CreatedOn)
      .input('UpdatedOn', sql.DateTime, data.UpdatedOn)
      .input('Category', sql.VarChar(500), data.Category)  // <-- NEW FIELD
      .query(`
        INSERT INTO Consultant (
          ConsultantID, FirstName, LastName, CompanyEmail, PersonalEmail, PhoneNumber,
          EmergencyContactName, EmergencyContactPhone, JobTitle, HireDate, PayType,
          PayRate, HourlyRate, TimecardCycle, DomesticInternational, Status, Address, CreatedOn,
          UpdatedOn, Category
        ) VALUES (
          @ConsultantID, @FirstName, @LastName, @CompanyEmail, @PersonalEmail, @PhoneNumber,
          @EmergencyContactName, @EmergencyContactPhone, @JobTitle, @HireDate, @PayType,
          @PayRate, @HourlyRate, @TimecardCycle, @DomesticInternational, @Status, @Address, @CreatedOn,
          @UpdatedOn, @Category
        )
      `);
    return result.recordset[0];
  }

static async update(id, data) {
  const pool = await poolPromise;

  // 1) Update the consultant record
  await pool
    .request()
    .input('ConsultantID',         sql.UniqueIdentifier, id)
    .input('FirstName',            sql.NVarChar,         data.FirstName)
    .input('LastName',             sql.NVarChar,         data.LastName)
    .input('CompanyEmail',         sql.NVarChar,         data.CompanyEmail)
    .input('PersonalEmail',        sql.NVarChar,         data.PersonalEmail)
    .input('PhoneNumber',          sql.NVarChar,         data.PhoneNumber)
    .input('EmergencyContactName', sql.NVarChar,         data.EmergencyContactName)
    .input('EmergencyContactPhone',sql.NVarChar,         data.EmergencyContactPhone)
    .input('JobTitle',             sql.NVarChar,         data.JobTitle)
    .input('HireDate',             sql.Date,             data.HireDate)
    .input('PayType',              sql.NVarChar,         data.PayType)
    .input('PayRate',              sql.Decimal(18, 2),   data.PayRate)
    .input('HourlyRate',           sql.Decimal(18, 2),   data.HourlyRate || null)
    .input('TimecardCycle',        sql.NVarChar,         data.TimecardCycle)
    .input('DomesticInternational',sql.Bit,              data.DomesticInternational)
    .input('Status',               sql.Bit,              data.Status)
    .input('Address',              sql.NVarChar,         data.Address)
    .input('UpdatedOn',            sql.DateTime,         data.UpdatedOn)
    .input('Category',             sql.VarChar(500),     data.Category)
    .query(`
      UPDATE Consultant
      SET
        FirstName            = @FirstName,
        LastName             = @LastName,
        CompanyEmail         = @CompanyEmail,
        PersonalEmail        = @PersonalEmail,
        PhoneNumber          = @PhoneNumber,
        EmergencyContactName = @EmergencyContactName,
        EmergencyContactPhone= @EmergencyContactPhone,
        JobTitle             = @JobTitle,
        HireDate             = @HireDate,
        PayType              = @PayType,
        PayRate              = @PayRate,
        HourlyRate           = @HourlyRate,
        TimecardCycle        = @TimecardCycle,
        DomesticInternational= @DomesticInternational,
        Status               = @Status,
        Address              = @Address,
        UpdatedOn            = @UpdatedOn,
        Category             = @Category
      WHERE ConsultantID = @ConsultantID
    `);

  // 2) If they’ve been deactivated, purge their project assignments
  if (data.Status === false) {
  await pool
    .request()
    .input('ConsultantID', sql.UniqueIdentifier, id)
    .query(`
      DELETE FROM TaskConsultants
      WHERE ConsultantID = @ConsultantID
        AND TaskID IN (
          SELECT t.TaskID
          FROM Tasks AS t
          INNER JOIN Projects AS p ON p.ProjectID = t.ProjectID
          WHERE p.Status = 'Active'
        )
    `);
}


  // 3) Fetch and return the updated consultant row
  const { recordset } = await pool
    .request()
    .input('ConsultantID', sql.UniqueIdentifier, id)
    .query(`
      SELECT *
      FROM Consultant
      WHERE ConsultantID = @ConsultantID
    `);

  return recordset[0];
}

  /**
   * Fetch one consultant by ID
   */
  static async getById(id) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('ConsultantID', sql.UniqueIdentifier, id)
      .query(`
        SELECT *
        FROM Consultant
        WHERE ConsultantID = @ConsultantID
      `);
    return result.recordset[0] || null;
  }



  static async delete(id) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('ConsultantID', sql.UniqueIdentifier, id)
      .query(`DELETE FROM Consultant WHERE ConsultantID = @ConsultantID`);
  }
}

export default Consultant;
