import { v4 as uuidv4 } from 'uuid';
import sql from 'mssql';
import { poolPromise } from '../db.js';

/**
 * External time tracking (Upwork / Hubstaff)
 *
 * This model is intentionally vendor-agnostic.
 * Brian noted the team still needs to confirm the exact API capabilities and
 * auth model for each vendor, so we store:
 *   - normalized time entries (ExternalTimeEntry)
 *   - a consultant <-> external worker ID mapping (ExternalTimeIntegrationLink)
 *
 * Once vendor APIs are confirmed, the server/controllers layer can call out to
 * the vendor APIs and pass the normalized objects into importTimeEntries().
 */

export default class ExternalTime {
  /**
   * Create or update a mapping between a portal Consultant and an external
   * worker/user identifier.
   */
  static async upsertIntegrationLink({
    consultantId,
    source,
    externalWorkerId,
    externalContractId = null,
    isActive = true,
    createdBy = null,
  }) {
    const pool = await poolPromise;
    const now = new Date();

    const existing = await pool
      .request()
      .input('ConsultantID', sql.UniqueIdentifier, consultantId)
      .input('Source', sql.NVarChar(50), source)
      .input('ExternalWorkerId', sql.NVarChar(100), externalWorkerId)
      .query(`
        SELECT TOP 1 *
        FROM ExternalTimeIntegrationLink
        WHERE ConsultantID = @ConsultantID
          AND Source = @Source
          AND ExternalWorkerId = @ExternalWorkerId
      `);

    if (existing.recordset.length > 0) {
      const row = existing.recordset[0];
      await pool
        .request()
        .input('IntegrationLinkID', sql.UniqueIdentifier, row.IntegrationLinkID)
        .input('ExternalContractId', sql.NVarChar(100), externalContractId)
        .input('IsActive', sql.Bit, isActive)
        .input('UpdatedOn', sql.DateTime, now)
        .query(`
          UPDATE ExternalTimeIntegrationLink
          SET ExternalContractId = @ExternalContractId,
              IsActive = @IsActive,
              UpdatedOn = @UpdatedOn
          WHERE IntegrationLinkID = @IntegrationLinkID
        `);
      return row.IntegrationLinkID;
    }

    const id = uuidv4();
    await pool
      .request()
      .input('IntegrationLinkID', sql.UniqueIdentifier, id)
      .input('ConsultantID', sql.UniqueIdentifier, consultantId)
      .input('Source', sql.NVarChar(50), source)
      .input('ExternalWorkerId', sql.NVarChar(100), externalWorkerId)
      .input('ExternalContractId', sql.NVarChar(100), externalContractId)
      .input('IsActive', sql.Bit, isActive)
      .input('CreatedBy', sql.NVarChar(255), createdBy)
      .input('CreatedOn', sql.DateTime, now)
      .input('UpdatedOn', sql.DateTime, now)
      .query(`
        INSERT INTO ExternalTimeIntegrationLink (
          IntegrationLinkID, ConsultantID, Source, ExternalWorkerId, ExternalContractId,
          IsActive, CreatedBy, CreatedOn, UpdatedOn
        ) VALUES (
          @IntegrationLinkID, @ConsultantID, @Source, @ExternalWorkerId, @ExternalContractId,
          @IsActive, @CreatedBy, @CreatedOn, @UpdatedOn
        )
      `);

    return id;
  }

  static async listIntegrationLinks() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT l.*, c.FirstName, c.LastName, c.CompanyEmail AS WorkEmail
      FROM ExternalTimeIntegrationLink l
      LEFT JOIN Consultant c ON c.ConsultantID = l.ConsultantID
      ORDER BY c.LastName, c.FirstName, l.Source
    `);
    return result.recordset;
  }

  /**
   * Import external time entries.
   *
   * @param {string} source - "Upwork" | "Hubstaff" | other
   * @param {Array<object>} entries - normalized entries
   *     [{ externalWorkerId, externalContractId?, workDate, hours, activityPercent?, rawPayload? }]
   */
  static async importTimeEntries({ source, entries = [], importedBy = null }) {
    const pool = await poolPromise;
    const now = new Date();

    if (!Array.isArray(entries) || entries.length === 0) {
      return { inserted: 0 };
    }

    // Resolve ConsultantID using mapping table (best effort)
    const linksResult = await pool
      .request()
      .input('Source', sql.NVarChar(50), source)
      .query(`
        SELECT ConsultantID, ExternalWorkerId
        FROM ExternalTimeIntegrationLink
        WHERE Source = @Source AND IsActive = 1
      `);
    const linkMap = new Map(
      linksResult.recordset.map((r) => [String(r.ExternalWorkerId), r.ConsultantID])
    );

    let inserted = 0;
    for (const e of entries) {
      const id = uuidv4();
      const consultantId = linkMap.get(String(e.externalWorkerId)) || null;

      // Prevent duplicate imports: enforce unique key (source, worker, date, hours) in DB.
      // If the upstream system provides an immutable entry id, we can use that later.
      await pool
        .request()
        .input('ExternalTimeEntryID', sql.UniqueIdentifier, id)
        .input('Source', sql.NVarChar(50), source)
        .input('ConsultantID', sql.UniqueIdentifier, consultantId)
        .input('ExternalWorkerId', sql.NVarChar(100), e.externalWorkerId)
        .input('ExternalContractId', sql.NVarChar(100), e.externalContractId || null)
        .input('WorkDate', sql.Date, e.workDate)
        .input('Hours', sql.Decimal(8, 2), Number(e.hours || 0))
        .input('ActivityPercent', sql.Decimal(5, 2),
          e.activityPercent === undefined || e.activityPercent === null
            ? null
            : Number(e.activityPercent)
        )
        .input('RawPayload', sql.NVarChar(sql.MAX),
          e.rawPayload ? JSON.stringify(e.rawPayload) : null
        )
        .input('ImportedBy', sql.NVarChar(255), importedBy)
        .input('ImportedOn', sql.DateTime, now)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM ExternalTimeEntry
            WHERE Source = @Source
              AND ExternalWorkerId = @ExternalWorkerId
              AND WorkDate = @WorkDate
              AND ABS(Hours - @Hours) < 0.0001
          )
          BEGIN
            INSERT INTO ExternalTimeEntry (
              ExternalTimeEntryID, Source, ConsultantID, ExternalWorkerId, ExternalContractId,
              WorkDate, Hours, ActivityPercent, RawPayload, ImportedBy, ImportedOn
            ) VALUES (
              @ExternalTimeEntryID, @Source, @ConsultantID, @ExternalWorkerId, @ExternalContractId,
              @WorkDate, @Hours, @ActivityPercent, @RawPayload, @ImportedBy, @ImportedOn
            );
          END
        `);

      inserted += 1;
    }

    return { inserted };
  }

  static async getTotalsByConsultant({ source = null, startDate, endDate }) {
    const pool = await poolPromise;
    const req = pool
      .request()
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate);

    const whereSource = source ? 'AND e.Source = @Source' : '';
    if (source) req.input('Source', sql.NVarChar(50), source);

    const result = await req.query(`
      SELECT
        e.ConsultantID,
        SUM(e.Hours) AS ExternalHours,
        AVG(CASE WHEN e.ActivityPercent IS NULL THEN NULL ELSE e.ActivityPercent END) AS AvgActivityPercent
      FROM ExternalTimeEntry e
      WHERE e.WorkDate >= @StartDate AND e.WorkDate <= @EndDate
        ${whereSource}
      GROUP BY e.ConsultantID
    `);
    return result.recordset;
  }

  static async getTotalsByConsultantByDay({ source = null, startDate, endDate }) {
    const pool = await poolPromise;
    const req = pool
      .request()
      .input('StartDate', sql.Date, startDate)
      .input('EndDate', sql.Date, endDate);

    const whereSource = source ? 'AND e.Source = @Source' : '';
    if (source) req.input('Source', sql.NVarChar(50), source);

    const result = await req.query(`
      SELECT
        e.ConsultantID,
        e.WorkDate,
        SUM(e.Hours) AS ExternalHours,
        AVG(CASE WHEN e.ActivityPercent IS NULL THEN NULL ELSE e.ActivityPercent END) AS AvgActivityPercent
      FROM ExternalTimeEntry e
      WHERE e.WorkDate >= @StartDate AND e.WorkDate <= @EndDate
        ${whereSource}
      GROUP BY e.ConsultantID, e.WorkDate
      ORDER BY e.WorkDate
    `);
    return result.recordset;
  }
}
