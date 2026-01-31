import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
import { poolPromise } from '../db.js';

/**
 * PayrollRun
 *
 * Provides:
 *   - CRUD for payroll runs
 *   - Calculation of payroll line items from portal timecards and external time (Upwork/Hubstaff) entries
 *   - Exception generation for mismatches / unallocated time / low activity
 *
 * Important: this module is designed to be safe to run even if Upwork/Hubstaff integrations
 * are not configured yet — external time simply comes back as 0.
 */

function toDateOnly(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function sumHours(row) {
  const a = Number(row.ClientFacingHours || 0);
  const b = Number(row.NonClientFacingHours || 0);
  const c = Number(row.OtherTaskHours || 0);
  return a + b + c;
}

export default class PayrollRun {
  static async list({ limit = 50 } = {}) {
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input('Limit', sql.Int, limit)
      .query(`
        SELECT TOP (@Limit)
          PayrollRunID,
          RunType,
          PeriodStart,
          PeriodEnd,
          IncludeSubmitted,
          Status,
          CreatedBy,
          CreatedOn,
          UpdatedOn,
          FinalizedOn
        FROM PayrollRun
        ORDER BY CreatedOn DESC
      `);
    return r.recordset;
  }

  static async getById(payrollRunID) {
    const pool = await poolPromise;
    const run = await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .query(`
        SELECT *
        FROM PayrollRun
        WHERE PayrollRunID = @PayrollRunID
      `);

    const lines = await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .query(`
        SELECT prl.*, c.FirstName, c.LastName, c.WorkEmail, c.PayType, c.PayRate, c.HourlyRate, c.TimecardCycle
        FROM PayrollRunLine prl
        JOIN Consultant c ON c.ConsultantID = prl.ConsultantID
        WHERE prl.PayrollRunID = @PayrollRunID
        ORDER BY c.LastName, c.FirstName
      `);

    const exceptions = await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .query(`
        SELECT pre.*, c.FirstName, c.LastName
        FROM PayrollRunException pre
        JOIN Consultant c ON c.ConsultantID = pre.ConsultantID
        WHERE pre.PayrollRunID = @PayrollRunID
        ORDER BY pre.Severity DESC, pre.WorkDate DESC
      `);

    return {
      run: run.recordset[0] || null,
      lines: lines.recordset,
      exceptions: exceptions.recordset,
    };
  }

  static async create({ runType, periodStart, periodEnd, includeSubmitted = false, createdBy = 'system' }) {
    const pool = await poolPromise;
    const payrollRunID = uuidv4();
    await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .input('RunType', sql.NVarChar(30), runType)
      .input('PeriodStart', sql.Date, toDateOnly(periodStart))
      .input('PeriodEnd', sql.Date, toDateOnly(periodEnd))
      .input('IncludeSubmitted', sql.Bit, includeSubmitted ? 1 : 0)
      .input('Status', sql.NVarChar(30), 'Draft')
      .input('CreatedBy', sql.NVarChar(255), createdBy)
      .query(`
        INSERT INTO PayrollRun (
          PayrollRunID, RunType, PeriodStart, PeriodEnd, IncludeSubmitted, Status, CreatedBy, CreatedOn, UpdatedOn
        ) VALUES (
          @PayrollRunID, @RunType, @PeriodStart, @PeriodEnd, @IncludeSubmitted, @Status, @CreatedBy, GETUTCDATE(), GETUTCDATE()
        )
      `);
    return this.getById(payrollRunID);
  }

  static async update({ payrollRunID, includeSubmitted, status, notes }) {
    const pool = await poolPromise;
    await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .input('IncludeSubmitted', sql.Bit, includeSubmitted === undefined ? null : includeSubmitted ? 1 : 0)
      .input('Status', sql.NVarChar(30), status ?? null)
      .input('Notes', sql.NVarChar(sql.MAX), notes ?? null)
      .query(`
        UPDATE PayrollRun
        SET
          IncludeSubmitted = COALESCE(@IncludeSubmitted, IncludeSubmitted),
          Status = COALESCE(@Status, Status),
          Notes = COALESCE(@Notes, Notes),
          UpdatedOn = GETUTCDATE()
        WHERE PayrollRunID = @PayrollRunID
      `);
    return this.getById(payrollRunID);
  }

  static async finalize(payrollRunID, finalizedBy = 'system') {
    const pool = await poolPromise;
    await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .input('FinalizedBy', sql.NVarChar(255), finalizedBy)
      .query(`
        UPDATE PayrollRun
        SET Status = 'Finalized', FinalizedOn = GETUTCDATE(), UpdatedOn = GETUTCDATE()
        WHERE PayrollRunID = @PayrollRunID
      `);
    return this.getById(payrollRunID);
  }

  static async calculate(payrollRunID, { activityThreshold = 70, mismatchToleranceHours = 0.5 } = {}) {
    const pool = await poolPromise;

    // Read run
    const runR = await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .query(`SELECT * FROM PayrollRun WHERE PayrollRunID = @PayrollRunID`);
    const run = runR.recordset[0];
    if (!run) throw new Error('Payroll run not found');

    // Clear previous calc
    await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .query(`DELETE FROM PayrollRunException WHERE PayrollRunID = @PayrollRunID; DELETE FROM PayrollRunLine WHERE PayrollRunID = @PayrollRunID;`);

    // Resolve the special clients used in CFO Worx operations
    const specialClientsR = await pool.request().query(`
      SELECT ClientID, ClientName
      FROM Client
      WHERE ClientName IN ('X - Time Off', 'X - CFO Worx')
    `);
    const timeOffClient = specialClientsR.recordset.find((c) => c.ClientName === 'X - Time Off');
    const internalClient = specialClientsR.recordset.find((c) => c.ClientName === 'X - CFO Worx');

    // Holidays for the period (unpaid)
    const holidaysR = await pool
      .request()
      .input('StartDate', sql.Date, run.PeriodStart)
      .input('EndDate', sql.Date, run.PeriodEnd)
      .query(`
        SELECT HolidayDate
        FROM HolidayCalendar
        WHERE HolidayDate >= @StartDate AND HolidayDate <= @EndDate
      `);
    const holidays = new Set(holidaysR.recordset.map((h) => new Date(h.HolidayDate).toISOString().slice(0, 10)));

    // Consultants (active)
    const consultantsR = await pool.request().query(`
      SELECT ConsultantID, FirstName, LastName, WorkEmail, PayType, PayRate, HourlyRate, TimecardCycle, Status
      FROM Consultant
      WHERE Status = 'Active'
    `);

    const periodStart = new Date(run.PeriodStart);
    const periodEnd = new Date(run.PeriodEnd);

    const businessDaysInPeriod = (() => {
      let days = 0;
      const d = new Date(periodStart);
      while (d <= periodEnd) {
        const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
        const iso = d.toISOString().slice(0, 10);
        if (dow >= 1 && dow <= 5 && !holidays.has(iso)) days += 1;
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return days;
    })();

    // Portal time totals per consultant
    const portalTotalsR = await pool
      .request()
      .input('StartDate', sql.Date, run.PeriodStart)
      .input('EndDate', sql.Date, run.PeriodEnd)
      .query(`
        SELECT
          ConsultantID,
          Status,
          ClientID,
          TimesheetDate,
          ClientFacingHours,
          NonClientFacingHours,
          OtherTaskHours
        FROM TimecardLines
        WHERE TimesheetDate >= @StartDate AND TimesheetDate <= @EndDate
      `);

    const portalRows = portalTotalsR.recordset;
    const portalByConsultant = new Map();
    for (const row of portalRows) {
      const cid = row.ConsultantID;
      if (!portalByConsultant.has(cid)) portalByConsultant.set(cid, { approved: 0, submitted: 0, all: 0, timeOff: 0, internal: 0 });
      const agg = portalByConsultant.get(cid);
      const h = sumHours(row);
      agg.all += h;
      if (row.Status === 'Approved') agg.approved += h;
      if (row.Status === 'Submitted') agg.submitted += h;
      if (timeOffClient && row.ClientID === timeOffClient.ClientID) agg.timeOff += h;
      if (internalClient && row.ClientID === internalClient.ClientID) agg.internal += h;
    }

    // External time totals per consultant
    const externalR = await pool
      .request()
      .input('StartDate', sql.Date, run.PeriodStart)
      .input('EndDate', sql.Date, run.PeriodEnd)
      .query(`
        SELECT ConsultantID,
               SUM(Hours) AS ExternalHours,
               AVG(NULLIF(ActivityPercent, 0)) AS AvgActivity
        FROM ExternalTimeEntry
        WHERE WorkDate >= @StartDate AND WorkDate <= @EndDate
          AND ConsultantID IS NOT NULL
        GROUP BY ConsultantID
      `);
    const externalByConsultant = new Map(externalR.recordset.map((r) => [r.ConsultantID, { externalHours: Number(r.ExternalHours || 0), avgActivity: r.AvgActivity ? Number(r.AvgActivity) : null }]));

    // External unassigned bucket
    const externalUnassignedR = await pool
      .request()
      .input('StartDate', sql.Date, run.PeriodStart)
      .input('EndDate', sql.Date, run.PeriodEnd)
      .query(`
        SELECT SUM(Hours) AS UnassignedExternalHours
        FROM ExternalTimeEntry
        WHERE WorkDate >= @StartDate AND WorkDate <= @EndDate
          AND ConsultantID IS NULL
      `);
    const unassignedExternalHoursAll = Number(externalUnassignedR.recordset[0]?.UnassignedExternalHours || 0);

    // Adjustments for the run
    const adjustmentsR = await pool
      .request()
      .input('StartDate', sql.Date, run.PeriodStart)
      .input('EndDate', sql.Date, run.PeriodEnd)
      .query(`
        SELECT ConsultantID,
               SUM(CASE WHEN AdjustmentType = 'REIMBURSEMENT' THEN Amount ELSE 0 END) AS Reimbursements,
               SUM(CASE WHEN AdjustmentType = 'DEDUCTION' THEN Amount ELSE 0 END) AS Deductions,
               SUM(CASE WHEN AdjustmentType = 'CATCHUP' THEN Hours ELSE 0 END) AS CatchUpHours
        FROM PayrollAdjustment
        WHERE PeriodStart <= @EndDate AND PeriodEnd >= @StartDate
        GROUP BY ConsultantID
      `);
    const adjustmentsByConsultant = new Map(adjustmentsR.recordset.map((r) => [r.ConsultantID, { reimbursements: Number(r.Reimbursements || 0), deductions: Number(r.Deductions || 0), catchUpHours: Number(r.CatchUpHours || 0) }]));

    // Insert line items + exceptions
    for (const c of consultantsR.recordset) {
      const cid = c.ConsultantID;
      const portalAgg = portalByConsultant.get(cid) || { approved: 0, submitted: 0, all: 0, timeOff: 0, internal: 0 };
      const externalAgg = externalByConsultant.get(cid) || { externalHours: 0, avgActivity: null };
      const adj = adjustmentsByConsultant.get(cid) || { reimbursements: 0, deductions: 0, catchUpHours: 0 };

      const approvedHours = portalAgg.approved;
      const submittedHours = portalAgg.submitted;
      const includedSubmittedHours = run.IncludeSubmitted ? submittedHours : 0;
      const payableHours = approvedHours + includedSubmittedHours;

      // Time off is logged as hours to the X - Time Off client
      const timeOffHours = portalAgg.timeOff;
      const timeOffDays = Math.round((timeOffHours / 8) * 4) / 4; // quarter-day increments
      const holidayDays = (() => {
        let count = 0;
        const d = new Date(periodStart);
        while (d <= periodEnd) {
          const iso = d.toISOString().slice(0, 10);
          const dow = d.getUTCDay();
          if (dow >= 1 && dow <= 5 && holidays.has(iso)) count += 1;
          d.setUTCDate(d.getUTCDate() + 1);
        }
        return count;
      })();

      const expectedWorkDays = businessDaysInPeriod;
      const expectedHours = expectedWorkDays * 8;

      const payType = c.PayType || 'Hourly';
      const hourlyRate = Number(c.HourlyRate || 0) || Number(c.PayRate || 0);
      const flatRate = Number(c.PayRate || 0);

      let grossPay = 0;
      if (payType.toLowerCase() === 'hourly') {
        grossPay = (payableHours + adj.catchUpHours) * hourlyRate;
      } else {
        // Salary/Flat: paid per period, reduced pro-rata for holidays + time off
        const denom = expectedWorkDays || 1;
        const unpaidDays = Math.min(denom, (timeOffDays || 0) + (holidayDays || 0));
        const factor = Math.max(0, (denom - unpaidDays) / denom);
        grossPay = flatRate * factor;
      }

      const netPay = grossPay + adj.reimbursements - adj.deductions;

      const prlID = uuidv4();
      await pool
        .request()
        .input('PayrollRunLineID', sql.UniqueIdentifier, prlID)
        .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
        .input('ConsultantID', sql.UniqueIdentifier, cid)
        .input('ExpectedWorkDays', sql.Decimal(6, 2), expectedWorkDays)
        .input('ExpectedHours', sql.Decimal(8, 2), expectedHours)
        .input('TimeOffDays', sql.Decimal(6, 2), timeOffDays)
        .input('HolidayDays', sql.Decimal(6, 2), holidayDays)
        .input('ApprovedHours', sql.Decimal(8, 2), approvedHours)
        .input('SubmittedHours', sql.Decimal(8, 2), submittedHours)
        .input('ExternalTrackedHours', sql.Decimal(8, 2), externalAgg.externalHours)
        .input('AvgActivityPercent', sql.Decimal(5, 2), externalAgg.avgActivity)
        .input('Reimbursements', sql.Decimal(18, 2), adj.reimbursements)
        .input('Deductions', sql.Decimal(18, 2), adj.deductions)
        .input('CatchUpHours', sql.Decimal(8, 2), adj.catchUpHours)
        .input('GrossPay', sql.Decimal(18, 2), grossPay)
        .input('NetPay', sql.Decimal(18, 2), netPay)
        .query(`
          INSERT INTO PayrollRunLine (
            PayrollRunLineID, PayrollRunID, ConsultantID,
            ExpectedWorkDays, ExpectedHours,
            TimeOffDays, HolidayDays,
            ApprovedHours, SubmittedHours,
            ExternalTrackedHours, AvgActivityPercent,
            Reimbursements, Deductions, CatchUpHours,
            GrossPay, NetPay,
            CreatedOn
          ) VALUES (
            @PayrollRunLineID, @PayrollRunID, @ConsultantID,
            @ExpectedWorkDays, @ExpectedHours,
            @TimeOffDays, @HolidayDays,
            @ApprovedHours, @SubmittedHours,
            @ExternalTrackedHours, @AvgActivityPercent,
            @Reimbursements, @Deductions, @CatchUpHours,
            @GrossPay, @NetPay,
            GETUTCDATE()
          )
        `);

      // Exceptions
      const portalForCompare = run.IncludeSubmitted ? approvedHours + submittedHours : approvedHours;
      if (externalAgg.externalHours > 0 && Math.abs(externalAgg.externalHours - portalForCompare) > mismatchToleranceHours) {
        await this._insertException(pool, {
          payrollRunID,
          consultantID: cid,
          exceptionType: 'HOURS_MISMATCH',
          severity: Math.abs(externalAgg.externalHours - portalForCompare) >= 2 ? 'CRIT' : 'WARN',
          source: 'External',
          portalHours: portalForCompare,
          externalHours: externalAgg.externalHours,
          details: `External vs portal hours differ by ${Math.abs(externalAgg.externalHours - portalForCompare).toFixed(2)} hours for the period.`,
        });
      }

      if (externalAgg.avgActivity !== null && Number(externalAgg.avgActivity) < activityThreshold && externalAgg.externalHours >= 2) {
        await this._insertException(pool, {
          payrollRunID,
          consultantID: cid,
          exceptionType: 'LOW_ACTIVITY',
          severity: 'WARN',
          source: 'External',
          details: `Average activity ${Number(externalAgg.avgActivity).toFixed(1)}% (threshold ${activityThreshold}%).`,
        });
      }

      // Missing portal allocation when external exists
      if (externalAgg.externalHours > 0 && portalAgg.all === 0) {
        await this._insertException(pool, {
          payrollRunID,
          consultantID: cid,
          exceptionType: 'MISSING_PORTAL_ALLOCATION',
          severity: 'WARN',
          source: 'Portal',
          details: 'External time exists but no portal time was entered for the period. Time needs to be allocated to a client / deliverable.',
        });
      }
    }

    if (unassignedExternalHoursAll > 0) {
      // Single run-level exception row
      await this._insertException(pool, {
        payrollRunID,
        consultantID: null,
        exceptionType: 'UNASSIGNED_EXTERNAL_TIME',
        severity: 'WARN',
        source: 'External',
        details: `${unassignedExternalHoursAll.toFixed(2)} external hours are not mapped to a consultant (missing integration link).`,
      });
    }

    await pool
      .request()
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .query(`UPDATE PayrollRun SET Status = 'Calculated', UpdatedOn = GETUTCDATE() WHERE PayrollRunID = @PayrollRunID`);

    return this.getById(payrollRunID);
  }

  static async _insertException(pool, { payrollRunID, consultantID, exceptionType, severity = 'INFO', workDate = null, source = null, portalHours = null, externalHours = null, details = null }) {
    const preID = uuidv4();
    await pool
      .request()
      .input('PayrollRunExceptionID', sql.UniqueIdentifier, preID)
      .input('PayrollRunID', sql.UniqueIdentifier, payrollRunID)
      .input('ConsultantID', sql.UniqueIdentifier, consultantID)
      .input('ExceptionType', sql.NVarChar(50), exceptionType)
      .input('Severity', sql.NVarChar(10), severity)
      .input('WorkDate', sql.Date, workDate)
      .input('Source', sql.NVarChar(50), source)
      .input('PortalHours', sql.Decimal(8, 2), portalHours)
      .input('ExternalHours', sql.Decimal(8, 2), externalHours)
      .input('Details', sql.NVarChar(sql.MAX), details)
      .query(`
        INSERT INTO PayrollRunException (
          PayrollRunExceptionID, PayrollRunID, ConsultantID,
          ExceptionType, Severity, WorkDate, Source,
          PortalHours, ExternalHours,
          Details,
          Resolved, CreatedOn
        ) VALUES (
          @PayrollRunExceptionID, @PayrollRunID, @ConsultantID,
          @ExceptionType, @Severity, @WorkDate, @Source,
          @PortalHours, @ExternalHours,
          @Details,
          0, GETUTCDATE()
        )
      `);
  }
}
