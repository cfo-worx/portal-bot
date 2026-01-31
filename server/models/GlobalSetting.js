import { poolPromise, sql } from '../db.js';

class GlobalSetting {
  /* fetch the single row – fail-safe: locked */
  static async getCalendarLocked() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 1 CalendarLocked
      FROM   GlobalSettings
    `);
    return result.recordset[0]?.CalendarLocked ?? true;
  }

  /* update the flag (bool) and return the new value */
  static async setCalendarLocked(locked) {
    const pool = await poolPromise;
    await pool.request()
      .input('CalendarLocked', sql.Bit, locked ? 1 : 0)
      .query(`
        UPDATE GlobalSettings
        SET    CalendarLocked = @CalendarLocked,
               UpdatedAt      = SYSUTCDATETIME()
      `);
    return locked;
  }

  /* Performance reporting settings */
  static async getPerformanceReportingSettings() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT TOP 1
        ISNULL(HoursVarianceWarnPct, 0.0500)      AS HoursVarianceWarnPct,
        ISNULL(HoursVarianceCriticalPct, 0.1500)  AS HoursVarianceCriticalPct,
        ISNULL(BusinessDaysOnlyDefault, 1)        AS BusinessDaysOnlyDefault,
        ISNULL(IncludeSubmittedDefault, 0)        AS IncludeSubmittedDefault,
        ISNULL(WorkdayHoursDefault, 8.00)         AS WorkdayHoursDefault,
        ISNULL(AttentionRiskDays, 7)              AS AttentionRiskDays,
        ISNULL(DefaultDistributionType, 'linear') AS DefaultDistributionType,
        ISNULL(GMVarianceThresholdPct, 0.0500)    AS GMVarianceThresholdPct
      FROM GlobalSettings
    `);

    return result.recordset[0] ?? {
      HoursVarianceWarnPct: 0.05,
      HoursVarianceCriticalPct: 0.15,
      BusinessDaysOnlyDefault: true,
      IncludeSubmittedDefault: false,
      WorkdayHoursDefault: 8,
      AttentionRiskDays: 7,
      DefaultDistributionType: 'linear',
      GMVarianceThresholdPct: 0.05,
    };
  }

  static async setPerformanceReportingSettings(settings) {
    const {
      HoursVarianceWarnPct,
      HoursVarianceCriticalPct,
      BusinessDaysOnlyDefault,
      IncludeSubmittedDefault,
      WorkdayHoursDefault,
      AttentionRiskDays,
      DefaultDistributionType,
      GMVarianceThresholdPct,
    } = settings;

    const pool = await poolPromise;

    await pool.request()
      .input('HoursVarianceWarnPct', sql.Decimal(6, 4), HoursVarianceWarnPct)
      .input('HoursVarianceCriticalPct', sql.Decimal(6, 4), HoursVarianceCriticalPct)
      .input('BusinessDaysOnlyDefault', sql.Bit, BusinessDaysOnlyDefault ? 1 : 0)
      .input('IncludeSubmittedDefault', sql.Bit, IncludeSubmittedDefault ? 1 : 0)
      .input('WorkdayHoursDefault', sql.Decimal(6, 2), WorkdayHoursDefault)
      .input('AttentionRiskDays', sql.Int, AttentionRiskDays)
      .input('DefaultDistributionType', sql.NVarChar(50), DefaultDistributionType)
      .input('GMVarianceThresholdPct', sql.Decimal(6, 4), GMVarianceThresholdPct ?? 0.05)
      .query(`
        UPDATE GlobalSettings
        SET HoursVarianceWarnPct      = @HoursVarianceWarnPct,
            HoursVarianceCriticalPct  = @HoursVarianceCriticalPct,
            BusinessDaysOnlyDefault   = @BusinessDaysOnlyDefault,
            IncludeSubmittedDefault   = @IncludeSubmittedDefault,
            WorkdayHoursDefault       = @WorkdayHoursDefault,
            AttentionRiskDays         = @AttentionRiskDays,
            DefaultDistributionType   = @DefaultDistributionType,
            GMVarianceThresholdPct    = @GMVarianceThresholdPct,
            UpdatedAt                 = SYSUTCDATETIME()
      `);

    return this.getPerformanceReportingSettings();
  }
}

export default GlobalSetting;
