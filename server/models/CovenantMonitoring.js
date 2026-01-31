import { poolPromise } from "../db.js";
import sql from "mssql";

function computeStatus({ thresholdType, thresholdValue, warnValue, criticalValue, actualValue }) {
  const tType = String(thresholdType || "").toUpperCase();
  const thr = Number(thresholdValue);
  const warn = warnValue != null ? Number(warnValue) : null;
  const crit = criticalValue != null ? Number(criticalValue) : null;
  const actual = Number(actualValue);

  if (!Number.isFinite(actual) || !Number.isFinite(thr)) return { status: "OK", warnLine: warn ?? null, critLine: crit ?? null };

  if (tType === "MIN") {
    const critLine = Number.isFinite(crit) ? crit : thr;
    const warnLine = Number.isFinite(warn) ? warn : critLine * 1.05; // within 5%
    if (actual < critLine) return { status: "CRITICAL", warnLine, critLine };
    if (actual < warnLine) return { status: "WARN", warnLine, critLine };
    return { status: "OK", warnLine, critLine };
  }

  // MAX
  const critLine = Number.isFinite(crit) ? crit : thr;
  const warnLine = Number.isFinite(warn) ? warn : critLine * 0.95; // within 5% of max
  if (actual > critLine) return { status: "CRITICAL", warnLine, critLine };
  if (actual > warnLine) return { status: "WARN", warnLine, critLine };
  return { status: "OK", warnLine, critLine };
}

export async function listCovenants(filters = {}) {
  const pool = await poolPromise;
  const { clientId, activeOnly = true } = filters;

  const req = pool.request();
  let where = "WHERE 1=1";
  if (clientId) {
    where += " AND cov.ClientID=@ClientID";
    req.input("ClientID", sql.UniqueIdentifier, clientId);
  }
  if (activeOnly) where += " AND cov.IsActive = 1";

  const res = await req.query(`
    SELECT cov.CovenantID, cov.ClientID, cov.CovenantName, cov.MetricKey, cov.ThresholdType, cov.ThresholdValue,
           cov.WarnValue, cov.CriticalValue, cov.MeasurementFrequency, cov.TestDayOfWeek, cov.IsActive,
           cov.EffectiveStartDate, cov.EffectiveEndDate, cov.Notes, cov.IsClientVisible, cov.CreatedAt, cov.UpdatedAt,
           c.ClientName, c.ActiveStatus
    FROM dbo.ClientCovenant cov
    INNER JOIN dbo.Client c ON cov.ClientID = c.ClientID
    ${where}
    ORDER BY c.ClientName ASC, cov.CovenantName ASC
  `);

  return res.recordset;
}

export async function getCovenantById(covenantId) {
  const pool = await poolPromise;
  const res = await pool.request()
    .input("CovenantID", sql.UniqueIdentifier, covenantId)
    .query(`
      SELECT TOP 1 cov.*, c.ClientName, c.ActiveStatus
      FROM dbo.ClientCovenant cov
      INNER JOIN dbo.Client c ON cov.ClientID = c.ClientID
      WHERE cov.CovenantID=@CovenantID
    `);
  return res.recordset[0] || null;
}

export async function createCovenant(payload, userId) {
  const pool = await poolPromise;
  const req = pool.request()
    .input("ClientID", sql.UniqueIdentifier, payload.ClientID || payload.clientId)
    .input("CovenantName", sql.NVarChar(200), payload.CovenantName || payload.covenantName)
    .input("MetricKey", sql.NVarChar(50), payload.MetricKey || payload.metricKey)
    .input("ThresholdType", sql.NVarChar(10), (payload.ThresholdType || payload.thresholdType || "MIN").toUpperCase())
    .input("ThresholdValue", sql.Decimal(18, 6), payload.ThresholdValue ?? payload.thresholdValue)
    .input("WarnValue", sql.Decimal(18, 6), payload.WarnValue ?? payload.warnValue ?? null)
    .input("CriticalValue", sql.Decimal(18, 6), payload.CriticalValue ?? payload.criticalValue ?? null)
    .input("MeasurementFrequency", sql.NVarChar(20), payload.MeasurementFrequency || payload.measurementFrequency || "Weekly")
    .input("TestDayOfWeek", sql.Int, payload.TestDayOfWeek ?? payload.testDayOfWeek ?? null)
    .input("IsActive", sql.Bit, (payload.IsActive ?? payload.isActive ?? true) ? 1 : 0)
    .input("EffectiveStartDate", sql.Date, payload.EffectiveStartDate || payload.effectiveStartDate || null)
    .input("EffectiveEndDate", sql.Date, payload.EffectiveEndDate || payload.effectiveEndDate || null)
    .input("Notes", sql.NVarChar(sql.MAX), payload.Notes || payload.notes || null)
    .input("IsClientVisible", sql.Bit, (payload.IsClientVisible ?? payload.isClientVisible) ? 1 : 0)
    .input("CreatedByUserID", sql.UniqueIdentifier, userId || null);

  const res = await req.query(`
    INSERT INTO dbo.ClientCovenant
      (ClientID, CovenantName, MetricKey, ThresholdType, ThresholdValue, WarnValue, CriticalValue,
       MeasurementFrequency, TestDayOfWeek, IsActive, EffectiveStartDate, EffectiveEndDate, Notes, IsClientVisible, CreatedByUserID)
    OUTPUT INSERTED.CovenantID
    VALUES
      (@ClientID, @CovenantName, @MetricKey, @ThresholdType, @ThresholdValue, @WarnValue, @CriticalValue,
       @MeasurementFrequency, @TestDayOfWeek, @IsActive, @EffectiveStartDate, @EffectiveEndDate, @Notes, @IsClientVisible, @CreatedByUserID)
  `);

  const id = res.recordset?.[0]?.CovenantID;
  return await getCovenantById(id);
}

export async function updateCovenant(covenantId, patch) {
  const pool = await poolPromise;
  const current = await getCovenantById(covenantId);
  if (!current) throw new Error("Covenant not found");

  const merged = { ...current, ...patch };

  const req = pool.request()
    .input("CovenantID", sql.UniqueIdentifier, covenantId)
    .input("CovenantName", sql.NVarChar(200), merged.CovenantName)
    .input("MetricKey", sql.NVarChar(50), merged.MetricKey)
    .input("ThresholdType", sql.NVarChar(10), (merged.ThresholdType || "MIN").toUpperCase())
    .input("ThresholdValue", sql.Decimal(18, 6), merged.ThresholdValue)
    .input("WarnValue", sql.Decimal(18, 6), merged.WarnValue ?? null)
    .input("CriticalValue", sql.Decimal(18, 6), merged.CriticalValue ?? null)
    .input("MeasurementFrequency", sql.NVarChar(20), merged.MeasurementFrequency || "Weekly")
    .input("TestDayOfWeek", sql.Int, merged.TestDayOfWeek ?? null)
    .input("IsActive", sql.Bit, merged.IsActive ? 1 : 0)
    .input("EffectiveStartDate", sql.Date, merged.EffectiveStartDate ?? null)
    .input("EffectiveEndDate", sql.Date, merged.EffectiveEndDate ?? null)
    .input("Notes", sql.NVarChar(sql.MAX), merged.Notes ?? null)
    .input("IsClientVisible", sql.Bit, merged.IsClientVisible ? 1 : 0);

  await req.query(`
    UPDATE dbo.ClientCovenant
    SET CovenantName=@CovenantName,
        MetricKey=@MetricKey,
        ThresholdType=@ThresholdType,
        ThresholdValue=@ThresholdValue,
        WarnValue=@WarnValue,
        CriticalValue=@CriticalValue,
        MeasurementFrequency=@MeasurementFrequency,
        TestDayOfWeek=@TestDayOfWeek,
        IsActive=@IsActive,
        EffectiveStartDate=@EffectiveStartDate,
        EffectiveEndDate=@EffectiveEndDate,
        Notes=@Notes,
        IsClientVisible=@IsClientVisible,
        UpdatedAt=SYSUTCDATETIME()
    WHERE CovenantID=@CovenantID
  `);

  return await getCovenantById(covenantId);
}

export async function listCovenantSnapshots(covenantId, { startDate, endDate, limit = 200 } = {}) {
  const pool = await poolPromise;
  const req = pool.request()
    .input("CovenantID", sql.UniqueIdentifier, covenantId)
    .input("Limit", sql.Int, limit);

  let where = "WHERE CovenantID=@CovenantID";
  if (startDate) {
    where += " AND SnapshotDate >= @StartDate";
    req.input("StartDate", sql.Date, startDate);
  }
  if (endDate) {
    where += " AND SnapshotDate <= @EndDate";
    req.input("EndDate", sql.Date, endDate);
  }

  const res = await req.query(`
    SELECT TOP (@Limit) SnapshotID, CovenantID, SnapshotDate, ActualValue, Status, Source, Notes, CreatedByUserID, CreatedAt
    FROM dbo.ClientCovenantSnapshot
    ${where}
    ORDER BY SnapshotDate DESC
  `);
  return res.recordset;
}

export async function createCovenantSnapshot(covenantId, payload, userId) {
  const pool = await poolPromise;
  const covenant = await getCovenantById(covenantId);
  if (!covenant) throw new Error("Covenant not found");

  const { status } = computeStatus({
    thresholdType: covenant.ThresholdType,
    thresholdValue: covenant.ThresholdValue,
    warnValue: covenant.WarnValue,
    criticalValue: covenant.CriticalValue,
    actualValue: payload.ActualValue ?? payload.actualValue,
  });

  const req = pool.request()
    .input("CovenantID", sql.UniqueIdentifier, covenantId)
    .input("SnapshotDate", sql.Date, payload.SnapshotDate || payload.snapshotDate)
    .input("ActualValue", sql.Decimal(18, 6), payload.ActualValue ?? payload.actualValue)
    .input("Status", sql.NVarChar(12), status)
    .input("Source", sql.NVarChar(50), payload.Source || payload.source || "Manual")
    .input("Notes", sql.NVarChar(sql.MAX), payload.Notes || payload.notes || null)
    .input("CreatedByUserID", sql.UniqueIdentifier, userId || null);

  const res = await req.query(`
    INSERT INTO dbo.ClientCovenantSnapshot
      (CovenantID, SnapshotDate, ActualValue, Status, Source, Notes, CreatedByUserID)
    OUTPUT INSERTED.SnapshotID
    VALUES (@CovenantID, @SnapshotDate, @ActualValue, @Status, @Source, @Notes, @CreatedByUserID)
  `);

  const snapshotId = res.recordset?.[0]?.SnapshotID;

  // Create alert if WARN/CRITICAL
  if (status === "WARN" || status === "CRITICAL") {
    const msg = `${covenant.CovenantName} (${covenant.MetricKey}) is ${status}: ${Number(payload.ActualValue ?? payload.actualValue).toFixed(3)} vs threshold ${Number(covenant.ThresholdValue).toFixed(3)} (${covenant.ThresholdType})`;
    await pool.request()
      .input("CovenantID", sql.UniqueIdentifier, covenantId)
      .input("SnapshotID", sql.UniqueIdentifier, snapshotId)
      .input("AlertLevel", sql.NVarChar(12), status)
      .input("Message", sql.NVarChar(500), msg)
      .query(`
        INSERT INTO dbo.ClientCovenantAlert (CovenantID, SnapshotID, AlertLevel, Message)
        VALUES (@CovenantID, @SnapshotID, @AlertLevel, @Message)
      `);
  }

  // Return snapshot
  const snapRes = await pool.request()
    .input("SnapshotID", sql.UniqueIdentifier, snapshotId)
    .query(`
      SELECT TOP 1 SnapshotID, CovenantID, SnapshotDate, ActualValue, Status, Source, Notes, CreatedByUserID, CreatedAt
      FROM dbo.ClientCovenantSnapshot
      WHERE SnapshotID=@SnapshotID
    `);
  return snapRes.recordset[0] || null;
}

export async function listCovenantAttachments(covenantId) {
  const pool = await poolPromise;
  const res = await pool.request()
    .input("CovenantID", sql.UniqueIdentifier, covenantId)
    .query(`
      SELECT AttachmentID, CovenantID, FileName, FilePath, MimeType, FileSizeBytes, UploadedByUserID, UploadedAt
      FROM dbo.ClientCovenantAttachment
      WHERE CovenantID=@CovenantID
      ORDER BY UploadedAt DESC
    `);
  return res.recordset;
}

export async function addCovenantAttachment(covenantId, file, userId) {
  const pool = await poolPromise;
  const res = await pool.request()
    .input("CovenantID", sql.UniqueIdentifier, covenantId)
    .input("FileName", sql.NVarChar(260), file.originalname)
    .input("FilePath", sql.NVarChar(400), file.path)
    .input("MimeType", sql.NVarChar(120), file.mimetype)
    .input("FileSizeBytes", sql.BigInt, file.size)
    .input("UploadedByUserID", sql.UniqueIdentifier, userId || null)
    .query(`
      INSERT INTO dbo.ClientCovenantAttachment
        (CovenantID, FileName, FilePath, MimeType, FileSizeBytes, UploadedByUserID)
      OUTPUT INSERTED.AttachmentID
      VALUES (@CovenantID, @FileName, @FilePath, @MimeType, @FileSizeBytes, @UploadedByUserID)
    `);

  const attachmentId = res.recordset?.[0]?.AttachmentID;
  const attachments = await listCovenantAttachments(covenantId);
  return attachments.find((a) => a.AttachmentID === attachmentId) || null;
}

export async function listCovenantAlerts(filters = {}) {
  const pool = await poolPromise;
  const { clientId, includeAcknowledged = false } = filters;

  const req = pool.request();
  let where = "WHERE 1=1";
  if (clientId) {
    where += " AND cov.ClientID=@ClientID";
    req.input("ClientID", sql.UniqueIdentifier, clientId);
  }
  if (!includeAcknowledged) {
    where += " AND a.IsAcknowledged = 0 AND (a.SnoozeUntil IS NULL OR a.SnoozeUntil <= CAST(GETUTCDATE() AS DATE))";
  }

  const res = await req.query(`
    SELECT a.AlertID, a.CovenantID, a.SnapshotID, a.AlertLevel, a.Message, a.IsAcknowledged, a.SnoozeUntil, a.CreatedAt,
           cov.ClientID, cov.CovenantName, cov.MetricKey, c.ClientName
    FROM dbo.ClientCovenantAlert a
    INNER JOIN dbo.ClientCovenant cov ON a.CovenantID = cov.CovenantID
    INNER JOIN dbo.Client c ON cov.ClientID = c.ClientID
    ${where}
    ORDER BY a.CreatedAt DESC
  `);
  return res.recordset;
}

export async function acknowledgeCovenantAlert(alertId, { notes, snoozeUntil }, userId) {
  const pool = await poolPromise;
  await pool.request()
    .input("AlertID", sql.UniqueIdentifier, alertId)
    .input("Notes", sql.NVarChar(sql.MAX), notes ?? null)
    .input("SnoozeUntil", sql.Date, snoozeUntil ?? null)
    .input("UserID", sql.UniqueIdentifier, userId || null)
    .query(`
      UPDATE dbo.ClientCovenantAlert
      SET IsAcknowledged = 1,
          AcknowledgedByUserID = @UserID,
          AcknowledgedAt = SYSUTCDATETIME(),
          AcknowledgementNotes = @Notes,
          SnoozeUntil = @SnoozeUntil
      WHERE AlertID=@AlertID
    `);

  const res = await pool.request()
    .input("AlertID", sql.UniqueIdentifier, alertId)
    .query(`
      SELECT TOP 1 AlertID, CovenantID, SnapshotID, AlertLevel, Message, IsAcknowledged, SnoozeUntil, CreatedAt
      FROM dbo.ClientCovenantAlert
      WHERE AlertID=@AlertID
    `);

  return res.recordset[0] || null;
}

export async function getCovenantDashboardSummary({ clientId } = {}) {
  const pool = await poolPromise;
  const req = pool.request();
  let where = "WHERE cov.IsActive = 1";
  if (clientId) {
    where += " AND cov.ClientID=@ClientID";
    req.input("ClientID", sql.UniqueIdentifier, clientId);
  }

  // Latest snapshot per covenant
  const res = await req.query(`
    WITH LatestSnap AS (
      SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.CovenantID ORDER BY s.SnapshotDate DESC) AS rn
      FROM dbo.ClientCovenantSnapshot s
    ),
    OpenAlerts AS (
      SELECT CovenantID, COUNT(*) AS OpenAlertCount
      FROM dbo.ClientCovenantAlert
      WHERE IsAcknowledged = 0 AND (SnoozeUntil IS NULL OR SnoozeUntil <= CAST(GETUTCDATE() AS DATE))
      GROUP BY CovenantID
    )
    SELECT cov.CovenantID, cov.ClientID, cov.CovenantName, cov.MetricKey,
           cov.ThresholdType, cov.ThresholdValue, cov.WarnValue, cov.CriticalValue,
           c.ClientName, c.ActiveStatus,
           ls.SnapshotDate AS LatestSnapshotDate, ls.ActualValue AS LatestActualValue, ls.Status AS LatestStatus,
           COALESCE(oa.OpenAlertCount, 0) AS OpenAlertCount
    FROM dbo.ClientCovenant cov
    INNER JOIN dbo.Client c ON cov.ClientID = c.ClientID
    LEFT JOIN LatestSnap ls ON cov.CovenantID = ls.CovenantID AND ls.rn = 1
    LEFT JOIN OpenAlerts oa ON cov.CovenantID = oa.CovenantID
    ${where}
    ORDER BY c.ClientName ASC, cov.CovenantName ASC
  `);

  return res.recordset;
}

