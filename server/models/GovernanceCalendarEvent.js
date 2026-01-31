import { poolPromise } from "../db.js";
import sql from "mssql";
import { getGovernanceSettings } from "./GovernanceSettings.js";

function normalizeType(t) {
  const v = String(t || "").trim();
  return v;
}

export async function listGovernanceCalendarEvents(filters = {}) {
  const pool = await poolPromise;

  const {
    clientId,
    status,
    types, // array
    dateFrom,
    dateTo,
    includeInactiveClients = true,
    activeClientsOnly = false,
  } = filters;

  let where = "WHERE 1=1";
  const req = pool.request();

  if (clientId) {
    if (clientId === "INTERNAL") {
      where += " AND e.ClientID IS NULL";
    } else {
      where += " AND e.ClientID = @ClientID";
      req.input("ClientID", sql.UniqueIdentifier, clientId);
    }
  }

  if (status) {
    where += " AND e.Status = @Status";
    req.input("Status", sql.NVarChar(20), status);
  }

  if (types && Array.isArray(types) && types.length) {
    const safeTypes = types.map(normalizeType).filter(Boolean);
    if (safeTypes.length) {
      where += ` AND e.EventType IN (${safeTypes.map((_, i) => `@Type${i}`).join(",")})`;
      safeTypes.forEach((t, i) => req.input(`Type${i}`, sql.NVarChar(50), t));
    }
  }

  if (dateFrom) {
    where += " AND e.DueDate >= @DateFrom";
    req.input("DateFrom", sql.Date, dateFrom);
  }
  if (dateTo) {
    where += " AND e.DueDate <= @DateTo";
    req.input("DateTo", sql.Date, dateTo);
  }

  // If activeClientsOnly, still show internal events (ClientID null).
  let clientJoin = `
    LEFT JOIN dbo.Client c ON e.ClientID = c.ClientID
  `;
  if (activeClientsOnly) {
    where += " AND (e.ClientID IS NULL OR c.ActiveStatus = 1)";
  } else if (!includeInactiveClients) {
    where += " AND (e.ClientID IS NULL OR c.ActiveStatus = 1)";
  }

  const query = `
    SELECT
      e.EventID, e.ClientID, e.EventType, e.Title, e.Category, e.JurisdictionLevel, e.JurisdictionDetail,
      e.VendorOrPolicyName, e.DueDate, e.RecurrenceType, e.RecurrenceInterval, e.LeadTimeDays, e.Status,
      e.CompletedDate, e.AssignedToUserID, e.Notes, e.IsClientVisible, e.CreatedByUserID, e.CreatedAt, e.UpdatedAt,
      c.ClientName, c.ActiveStatus
    FROM dbo.GovernanceCalendarEvent e
    ${clientJoin}
    ${where}
    ORDER BY e.DueDate ASC, e.Title ASC
  `;

  const res = await req.query(query);
  return res.recordset;
}

export async function getGovernanceCalendarEventById(eventId) {
  const pool = await poolPromise;
  const res = await pool.request()
    .input("EventID", sql.UniqueIdentifier, eventId)
    .query(`
      SELECT TOP 1
        e.EventID, e.ClientID, e.EventType, e.Title, e.Category, e.JurisdictionLevel, e.JurisdictionDetail,
        e.VendorOrPolicyName, e.DueDate, e.RecurrenceType, e.RecurrenceInterval, e.LeadTimeDays, e.Status,
        e.CompletedDate, e.AssignedToUserID, e.Notes, e.IsClientVisible, e.CreatedByUserID, e.CreatedAt, e.UpdatedAt,
        c.ClientName, c.ActiveStatus
      FROM dbo.GovernanceCalendarEvent e
      LEFT JOIN dbo.Client c ON e.ClientID = c.ClientID
      WHERE e.EventID=@EventID
    `);
  return res.recordset[0] || null;
}

export async function listGovernanceCalendarEventAttachments(eventId) {
  const pool = await poolPromise;
  const res = await pool.request()
    .input("EventID", sql.UniqueIdentifier, eventId)
    .query(`
      SELECT AttachmentID, EventID, FileName, FilePath, MimeType, FileSizeBytes, UploadedByUserID, UploadedAt
      FROM dbo.GovernanceCalendarEventAttachment
      WHERE EventID=@EventID
      ORDER BY UploadedAt DESC
    `);
  return res.recordset;
}

export async function createGovernanceCalendarEvent(payload, userId) {
  const pool = await poolPromise;
  const settings = await getGovernanceSettings();

  const lead = payload.LeadTimeDays ?? payload.leadTimeDays;
  let leadTimeDays = lead;
  if (leadTimeDays == null) {
    const type = payload.EventType ?? payload.eventType;
    if (type === "Insurance") leadTimeDays = settings?.DefaultInsuranceLeadDays ?? 60;
    else if (type === "VendorContract") leadTimeDays = settings?.DefaultVendorLeadDays ?? 30;
    else leadTimeDays = settings?.DefaultComplianceLeadDays ?? 14;
  }

  const req = pool.request()
    .input("ClientID", sql.UniqueIdentifier, payload.ClientID || payload.clientId || null)
    .input("EventType", sql.NVarChar(50), payload.EventType || payload.eventType)
    .input("Title", sql.NVarChar(200), payload.Title || payload.title)
    .input("Category", sql.NVarChar(120), payload.Category || payload.category || null)
    .input("JurisdictionLevel", sql.NVarChar(30), payload.JurisdictionLevel || payload.jurisdictionLevel || null)
    .input("JurisdictionDetail", sql.NVarChar(120), payload.JurisdictionDetail || payload.jurisdictionDetail || null)
    .input("VendorOrPolicyName", sql.NVarChar(200), payload.VendorOrPolicyName || payload.vendorOrPolicyName || null)
    .input("DueDate", sql.Date, payload.DueDate || payload.dueDate)
    .input("RecurrenceType", sql.NVarChar(20), payload.RecurrenceType || payload.recurrenceType || "none")
    .input("RecurrenceInterval", sql.Int, payload.RecurrenceInterval ?? payload.recurrenceInterval ?? null)
    .input("LeadTimeDays", sql.Int, leadTimeDays)
    .input("Status", sql.NVarChar(20), payload.Status || payload.status || "Open")
    .input("CompletedDate", sql.Date, payload.CompletedDate || payload.completedDate || null)
    .input("AssignedToUserID", sql.UniqueIdentifier, payload.AssignedToUserID || payload.assignedToUserId || null)
    .input("Notes", sql.NVarChar(sql.MAX), payload.Notes || payload.notes || null)
    .input("IsClientVisible", sql.Bit, (payload.IsClientVisible ?? payload.isClientVisible) ? 1 : 0)
    .input("CreatedByUserID", sql.UniqueIdentifier, userId || null);

  const res = await req.query(`
    INSERT INTO dbo.GovernanceCalendarEvent
      (ClientID, EventType, Title, Category, JurisdictionLevel, JurisdictionDetail, VendorOrPolicyName, DueDate,
       RecurrenceType, RecurrenceInterval, LeadTimeDays, Status, CompletedDate, AssignedToUserID, Notes, IsClientVisible, CreatedByUserID)
    OUTPUT INSERTED.EventID
    VALUES
      (@ClientID, @EventType, @Title, @Category, @JurisdictionLevel, @JurisdictionDetail, @VendorOrPolicyName, @DueDate,
       @RecurrenceType, @RecurrenceInterval, @LeadTimeDays, @Status, @CompletedDate, @AssignedToUserID, @Notes, @IsClientVisible, @CreatedByUserID)
  `);

  const id = res.recordset?.[0]?.EventID;
  return await getGovernanceCalendarEventById(id);
}

export async function updateGovernanceCalendarEvent(eventId, patch) {
  const pool = await poolPromise;

  const current = await getGovernanceCalendarEventById(eventId);
  if (!current) throw new Error("Calendar event not found");

  const merged = {
    ...current,
    ...patch,
    UpdatedAt: new Date(),
  };

  const req = pool.request()
    .input("EventID", sql.UniqueIdentifier, eventId)
    .input("ClientID", sql.UniqueIdentifier, merged.ClientID ?? null)
    .input("EventType", sql.NVarChar(50), merged.EventType)
    .input("Title", sql.NVarChar(200), merged.Title)
    .input("Category", sql.NVarChar(120), merged.Category ?? null)
    .input("JurisdictionLevel", sql.NVarChar(30), merged.JurisdictionLevel ?? null)
    .input("JurisdictionDetail", sql.NVarChar(120), merged.JurisdictionDetail ?? null)
    .input("VendorOrPolicyName", sql.NVarChar(200), merged.VendorOrPolicyName ?? null)
    .input("DueDate", sql.Date, merged.DueDate)
    .input("RecurrenceType", sql.NVarChar(20), merged.RecurrenceType || "none")
    .input("RecurrenceInterval", sql.Int, merged.RecurrenceInterval ?? null)
    .input("LeadTimeDays", sql.Int, merged.LeadTimeDays ?? null)
    .input("Status", sql.NVarChar(20), merged.Status)
    .input("CompletedDate", sql.Date, merged.CompletedDate ?? null)
    .input("AssignedToUserID", sql.UniqueIdentifier, merged.AssignedToUserID ?? null)
    .input("Notes", sql.NVarChar(sql.MAX), merged.Notes ?? null)
    .input("IsClientVisible", sql.Bit, merged.IsClientVisible ? 1 : 0);

  await req.query(`
    UPDATE dbo.GovernanceCalendarEvent
    SET ClientID=@ClientID,
        EventType=@EventType,
        Title=@Title,
        Category=@Category,
        JurisdictionLevel=@JurisdictionLevel,
        JurisdictionDetail=@JurisdictionDetail,
        VendorOrPolicyName=@VendorOrPolicyName,
        DueDate=@DueDate,
        RecurrenceType=@RecurrenceType,
        RecurrenceInterval=@RecurrenceInterval,
        LeadTimeDays=@LeadTimeDays,
        Status=@Status,
        CompletedDate=@CompletedDate,
        AssignedToUserID=@AssignedToUserID,
        Notes=@Notes,
        IsClientVisible=@IsClientVisible,
        UpdatedAt=SYSUTCDATETIME()
    WHERE EventID=@EventID
  `);

  return await getGovernanceCalendarEventById(eventId);
}

export async function setGovernanceCalendarEventStatus(eventId, status) {
  const pool = await poolPromise;
  const completedDate = status === "Completed" ? new Date() : null;

  await pool.request()
    .input("EventID", sql.UniqueIdentifier, eventId)
    .input("Status", sql.NVarChar(20), status)
    .input("CompletedDate", sql.Date, completedDate)
    .query(`
      UPDATE dbo.GovernanceCalendarEvent
      SET Status=@Status,
          CompletedDate=@CompletedDate,
          UpdatedAt=SYSUTCDATETIME()
      WHERE EventID=@EventID
    `);

  return await getGovernanceCalendarEventById(eventId);
}

export async function deleteGovernanceCalendarEvent(eventId) {
  const pool = await poolPromise;
  await pool.request()
    .input("EventID", sql.UniqueIdentifier, eventId)
    .query(`DELETE FROM dbo.GovernanceCalendarEvent WHERE EventID=@EventID`);
  return { ok: true };
}

export async function addGovernanceCalendarEventAttachment(eventId, file, userId) {
  const pool = await poolPromise;
  const res = await pool.request()
    .input("EventID", sql.UniqueIdentifier, eventId)
    .input("FileName", sql.NVarChar(260), file.originalname)
    .input("FilePath", sql.NVarChar(400), file.path)
    .input("MimeType", sql.NVarChar(120), file.mimetype)
    .input("FileSizeBytes", sql.BigInt, file.size)
    .input("UploadedByUserID", sql.UniqueIdentifier, userId || null)
    .query(`
      INSERT INTO dbo.GovernanceCalendarEventAttachment
        (EventID, FileName, FilePath, MimeType, FileSizeBytes, UploadedByUserID)
      OUTPUT INSERTED.AttachmentID
      VALUES (@EventID, @FileName, @FilePath, @MimeType, @FileSizeBytes, @UploadedByUserID)
    `);

  const attachmentId = res.recordset?.[0]?.AttachmentID;
  const attachments = await listGovernanceCalendarEventAttachments(eventId);
  return attachments.find((a) => a.AttachmentID === attachmentId) || null;
}

