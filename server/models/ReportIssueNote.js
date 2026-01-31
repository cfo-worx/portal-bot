import { poolPromise, sql } from '../db.js';

class ReportIssueNote {
  static async getByKeys(issueKeys = []) {
    if (!Array.isArray(issueKeys) || issueKeys.length === 0) return [];

    const pool = await poolPromise;

    // Build parameterized IN clause
    const request = pool.request();
    const params = issueKeys.map((k, idx) => {
      const p = `k${idx}`;
      request.input(p, sql.NVarChar(250), k);
      return `@${p}`;
    });

    const result = await request.query(`
      SELECT *
      FROM ReportIssueNotes
      WHERE IssueKey IN (${params.join(',')})
    `);

    return result.recordset;
  }

  static async upsert(note) {
    const pool = await poolPromise;

    const {
      IssueKey,
      IssueType,
      Severity,
      PeriodStart,
      PeriodEnd,
      ClientID,
      ConsultantID,
      Role,
      Status,
      Decision,
      SnoozedUntil,
      Notes,
      AcknowledgedBy,
      AcknowledgedAt,
    } = note;

    const request = pool.request()
      .input('IssueKey', sql.NVarChar(250), IssueKey)
      .input('IssueType', sql.NVarChar(50), IssueType)
      .input('Severity', sql.NVarChar(20), Severity)
      .input('PeriodStart', sql.Date, PeriodStart)
      .input('PeriodEnd', sql.Date, PeriodEnd)
      .input('ClientID', sql.UniqueIdentifier, ClientID ?? null)
      .input('ConsultantID', sql.UniqueIdentifier, ConsultantID ?? null)
      .input('Role', sql.NVarChar(100), Role ?? null)
      .input('Status', sql.NVarChar(30), Status ?? 'open')
      .input('Decision', sql.NVarChar(50), Decision ?? null)
      .input('SnoozedUntil', sql.Date, SnoozedUntil ?? null)
      .input('Notes', sql.NVarChar(sql.MAX), Notes ?? null)
      .input('AcknowledgedBy', sql.NVarChar(200), AcknowledgedBy ?? null)
      .input('AcknowledgedAt', sql.DateTime2, AcknowledgedAt ?? null);

    await request.query(`
      IF EXISTS (SELECT 1 FROM ReportIssueNotes WHERE IssueKey = @IssueKey)
      BEGIN
        UPDATE ReportIssueNotes
        SET IssueType      = @IssueType,
            Severity       = @Severity,
            PeriodStart    = @PeriodStart,
            PeriodEnd      = @PeriodEnd,
            ClientID       = @ClientID,
            ConsultantID   = @ConsultantID,
            Role           = @Role,
            Status         = @Status,
            Decision       = @Decision,
            SnoozedUntil   = @SnoozedUntil,
            Notes          = @Notes,
            AcknowledgedBy = COALESCE(@AcknowledgedBy, AcknowledgedBy),
            AcknowledgedAt = COALESCE(@AcknowledgedAt, AcknowledgedAt),
            UpdatedAt      = SYSUTCDATETIME()
        WHERE IssueKey = @IssueKey
      END
      ELSE
      BEGIN
        INSERT INTO ReportIssueNotes (
          IssueKey, IssueType, Severity, PeriodStart, PeriodEnd,
          ClientID, ConsultantID, Role, Status, Decision, SnoozedUntil,
          Notes, AcknowledgedAt, AcknowledgedBy
        )
        VALUES (
          @IssueKey, @IssueType, @Severity, @PeriodStart, @PeriodEnd,
          @ClientID, @ConsultantID, @Role, @Status, @Decision, @SnoozedUntil,
          @Notes, @AcknowledgedAt, @AcknowledgedBy
        )
      END
    `);

    const after = await pool.request()
      .input('IssueKey', sql.NVarChar(250), IssueKey)
      .query(`SELECT * FROM ReportIssueNotes WHERE IssueKey = @IssueKey`);

    return after.recordset[0];
  }
}

export default ReportIssueNote;
