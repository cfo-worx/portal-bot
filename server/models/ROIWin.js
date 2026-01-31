import { poolPromise, sql } from '../db.js';

/**
 * ROI Tracker model
 *
 * NOTE: Assumes migration `create_roi_tracker_tables.sql` has been applied.
 * Core tables expected: Client, Consultant, Users, Contract, Benchmark.
 */

function assertNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function normalizeNullableDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

const ROIWin = {
  async getSettings() {
    const pool = await poolPromise;

    const [categories, tags, reasons] = await Promise.all([
      pool.request().query('SELECT CategoryID, Name, IsActive FROM dbo.ROIImpactCategory ORDER BY Name'),
      pool.request().query('SELECT ActivityTagID, Name, IsActive FROM dbo.ROIActivityTag ORDER BY Name'),
      pool.request().query('SELECT RejectionReasonID, ReasonText, IsActive, SortOrder FROM dbo.ROIRejectionReason ORDER BY SortOrder, ReasonText')
    ]);

    return {
      categories: categories.recordset,
      activityTags: tags.recordset,
      rejectionReasons: reasons.recordset,
    };
  },

  async upsertActivityTag({ activityTagID, name, isActive }) {
    const pool = await poolPromise;
    const req = pool.request();

    req.input('Name', sql.NVarChar(100), name);
    req.input('IsActive', sql.Bit, isActive ? 1 : 0);

    if (activityTagID) {
      req.input('ActivityTagID', sql.Int, activityTagID);
      const result = await req.query(`
        UPDATE dbo.ROIActivityTag
        SET Name = @Name,
            IsActive = @IsActive
        WHERE ActivityTagID = @ActivityTagID;

        SELECT ActivityTagID, Name, IsActive
        FROM dbo.ROIActivityTag
        WHERE ActivityTagID = @ActivityTagID;
      `);
      return result.recordset[0];
    }

    const result = await req.query(`
      INSERT INTO dbo.ROIActivityTag (Name, IsActive)
      VALUES (@Name, @IsActive);

      SELECT ActivityTagID, Name, IsActive
      FROM dbo.ROIActivityTag
      WHERE ActivityTagID = SCOPE_IDENTITY();
    `);

    return result.recordset[0];
  },

  async listWins({
    clientId,
    status,
    fromDate,
    toDate,
    includeDeleted = false,
    scope,
    consultantId,
  }) {
    const pool = await poolPromise;
    const req = pool.request();

    // Filters
    req.input('ClientID', sql.UniqueIdentifier, clientId || null);
    req.input('Status', sql.NVarChar(20), status || null);
    req.input('FromDate', sql.Date, fromDate ? new Date(fromDate) : null);
    req.input('ToDate', sql.Date, toDate ? new Date(toDate) : null);
    req.input('IncludeDeleted', sql.Bit, includeDeleted ? 1 : 0);
    req.input('Scope', sql.NVarChar(20), scope || 'all');
    req.input('ConsultantID', sql.UniqueIdentifier, consultantId || null);

    // Base win rows
    const winsResult = await req.query(`
      ;WITH Base AS (
        SELECT
          w.*, 
          c.ClientName,
          cat.Name AS CategoryName,
          rr.ReasonText AS RejectionReasonText
        FROM dbo.ROIWin w
        INNER JOIN dbo.Client c ON c.ClientID = w.ClientID
        INNER JOIN dbo.ROIImpactCategory cat ON cat.CategoryID = w.CategoryID
        LEFT JOIN dbo.ROIRejectionReason rr ON rr.RejectionReasonID = w.RejectionReasonID
        WHERE ( @IncludeDeleted = 1 OR w.IsDeleted = 0 )
          AND ( @ClientID IS NULL OR w.ClientID = @ClientID )
          AND ( @Status IS NULL OR w.Status = @Status )
          AND ( @FromDate IS NULL OR w.ImpactDate >= @FromDate OR (w.ImpactType = 'Recurring' AND w.RecurringStartDate >= @FromDate) )
          AND ( @ToDate IS NULL OR w.ImpactDate <= @ToDate OR (w.ImpactType = 'Recurring' AND (w.RecurringEndDate IS NULL OR w.RecurringEndDate <= @ToDate)) )
          AND (
              @Scope = 'all'
              OR (@Scope = 'consultant' AND EXISTS (
                    SELECT 1
                    FROM dbo.ROIWinConsultant wc
                    WHERE wc.ROIWinID = w.ROIWinID
                      AND wc.ConsultantID = @ConsultantID
              ))
          )
      )
      SELECT * FROM Base
      ORDER BY LastEditedAt DESC;
    `);

    const wins = winsResult.recordset;

    if (wins.length === 0) return [];

    // Load tags + consultants for all wins in one go
    const winIds = wins.map(w => `'${w.ROIWinID}'`).join(',');

    const tagsRes = await pool.request().query(`
      SELECT
        wat.ROIWinID,
        t.ActivityTagID,
        t.Name
      FROM dbo.ROIWinActivityTag wat
      INNER JOIN dbo.ROIActivityTag t ON t.ActivityTagID = wat.ActivityTagID
      WHERE wat.ROIWinID IN (${winIds})
      ORDER BY t.Name;
    `);

    const consRes = await pool.request().query(`
      SELECT
        wc.ROIWinID,
        wc.ConsultantID,
        wc.PercentSplit,
        wc.IsPrimary,
        c.FirstName + ' ' + c.LastName AS ConsultantName
      FROM dbo.ROIWinConsultant wc
      INNER JOIN dbo.Consultant c ON c.ConsultantID = wc.ConsultantID
      WHERE wc.ROIWinID IN (${winIds})
      ORDER BY c.FirstName, c.LastName;
    `);

    const tagsByWin = new Map();
    for (const r of tagsRes.recordset) {
      if (!tagsByWin.has(r.ROIWinID)) tagsByWin.set(r.ROIWinID, []);
      tagsByWin.get(r.ROIWinID).push({ ActivityTagID: r.ActivityTagID, Name: r.Name });
    }

    const consultantsByWin = new Map();
    for (const r of consRes.recordset) {
      if (!consultantsByWin.has(r.ROIWinID)) consultantsByWin.set(r.ROIWinID, []);
      consultantsByWin.get(r.ROIWinID).push({
        ConsultantID: r.ConsultantID,
        ConsultantName: r.ConsultantName,
        PercentSplit: Number(r.PercentSplit),
        IsPrimary: !!r.IsPrimary,
      });
    }

    return wins.map(w => ({
      ...w,
      ActivityTags: tagsByWin.get(w.ROIWinID) || [],
      Consultants: consultantsByWin.get(w.ROIWinID) || [],
    }));
  },

  async getWinById(roiWinId) {
    const pool = await poolPromise;
    const req = pool.request();
    req.input('ROIWinID', sql.UniqueIdentifier, roiWinId);

    const winRes = await req.query(`
      SELECT
        w.*, 
        c.ClientName,
        cat.Name AS CategoryName,
        rr.ReasonText AS RejectionReasonText
      FROM dbo.ROIWin w
      INNER JOIN dbo.Client c ON c.ClientID = w.ClientID
      INNER JOIN dbo.ROIImpactCategory cat ON cat.CategoryID = w.CategoryID
      LEFT JOIN dbo.ROIRejectionReason rr ON rr.RejectionReasonID = w.RejectionReasonID
      WHERE w.ROIWinID = @ROIWinID;
    `);

    const win = winRes.recordset[0];
    if (!win) return null;

    const tagsRes = await pool.request()
      .input('ROIWinID', sql.UniqueIdentifier, roiWinId)
      .query(`
        SELECT t.ActivityTagID, t.Name
        FROM dbo.ROIWinActivityTag wat
        INNER JOIN dbo.ROIActivityTag t ON t.ActivityTagID = wat.ActivityTagID
        WHERE wat.ROIWinID = @ROIWinID
        ORDER BY t.Name;
      `);

    const consRes = await pool.request()
      .input('ROIWinID', sql.UniqueIdentifier, roiWinId)
      .query(`
        SELECT wc.ConsultantID, wc.PercentSplit, wc.IsPrimary, c.FirstName + ' ' + c.LastName AS ConsultantName
        FROM dbo.ROIWinConsultant wc
        INNER JOIN dbo.Consultant c ON c.ConsultantID = wc.ConsultantID
        WHERE wc.ROIWinID = @ROIWinID
        ORDER BY c.FirstName, c.LastName;
      `);

    return {
      ...win,
      ActivityTags: tagsRes.recordset,
      Consultants: consRes.recordset.map(r => ({
        ConsultantID: r.ConsultantID,
        ConsultantName: r.ConsultantName,
        PercentSplit: Number(r.PercentSplit),
        IsPrimary: !!r.IsPrimary,
      })),
    };
  },

  async validateClientIsActive(clientId) {
    const pool = await poolPromise;
    const req = pool.request();
    req.input('ClientID', sql.UniqueIdentifier, clientId);

    const res = await req.query(`
      SELECT TOP 1 ClientID, ActiveStatus
      FROM dbo.Client
      WHERE ClientID = @ClientID;
    `);

    const row = res.recordset[0];
    if (!row) return { exists: false, isActive: false, activeStatus: null };

    const isActive = (row.ActiveStatus || '').toLowerCase() === 'active';
    return { exists: true, isActive, activeStatus: row.ActiveStatus };
  },

  async validateConsultantAssignedToClient({ consultantId, clientId }) {
    const pool = await poolPromise;
    const req = pool.request();
    req.input('ConsultantID', sql.UniqueIdentifier, consultantId);
    req.input('ClientID', sql.UniqueIdentifier, clientId);

    const res = await req.query(`
      SELECT TOP 1 1 AS IsAssigned
      FROM dbo.Benchmark
      WHERE ConsultantID = @ConsultantID
        AND ClientID = @ClientID;
    `);

    return !!res.recordset[0];
  },

  async createWin({
    clientId,
    title,
    categoryId,
    impactType,
    impactDate,
    recurringMonthlyAmount,
    recurringStartDate,
    recurringEndDate,
    oneTimeTotalValue,
    oneTimeSpreadMonths,
    internalNotes,
    externalNotes,
    clientOwnerUserId,
    activityTagIds = [],
    consultants = [],
    createdByUserId,
  }) {
    const pool = await poolPromise;

    const req = pool.request();
    req.input('ClientID', sql.UniqueIdentifier, clientId);
    req.input('Title', sql.NVarChar(200), title);
    req.input('CategoryID', sql.Int, categoryId);
    req.input('ImpactType', sql.NVarChar(20), impactType);
    req.input('ImpactDate', sql.Date, new Date(impactDate));

    req.input('RecurringMonthlyAmount', sql.Decimal(18, 2), recurringMonthlyAmount ?? null);
    req.input('RecurringStartDate', sql.Date, normalizeNullableDate(recurringStartDate));
    req.input('RecurringEndDate', sql.Date, normalizeNullableDate(recurringEndDate));

    req.input('OneTimeTotalValue', sql.Decimal(18, 2), oneTimeTotalValue ?? null);
    req.input('OneTimeSpreadMonths', sql.Int, oneTimeSpreadMonths ?? null);

    req.input('InternalNotes', sql.NVarChar(sql.MAX), internalNotes ?? null);
    req.input('ExternalNotes', sql.NVarChar(sql.MAX), externalNotes ?? null);
    req.input('ClientOwnerUserID', sql.UniqueIdentifier, clientOwnerUserId ?? null);

    req.input('CreatedByUserID', sql.UniqueIdentifier, createdByUserId ?? null);
    req.input('LastEditedByUserID', sql.UniqueIdentifier, createdByUserId ?? null);

    const insertRes = await req.query(`
      INSERT INTO dbo.ROIWin (
        ClientID,
        Title,
        CategoryID,
        ImpactType,
        ImpactDate,
        RecurringMonthlyAmount,
        RecurringStartDate,
        RecurringEndDate,
        OneTimeTotalValue,
        OneTimeSpreadMonths,
        InternalNotes,
        ExternalNotes,
        ClientOwnerUserID,
        CreatedByUserID,
        LastEditedByUserID
      )
      OUTPUT INSERTED.ROIWinID
      VALUES (
        @ClientID,
        @Title,
        @CategoryID,
        @ImpactType,
        @ImpactDate,
        @RecurringMonthlyAmount,
        @RecurringStartDate,
        @RecurringEndDate,
        @OneTimeTotalValue,
        @OneTimeSpreadMonths,
        @InternalNotes,
        @ExternalNotes,
        @ClientOwnerUserID,
        @CreatedByUserID,
        @LastEditedByUserID
      );
    `);

    const roiWinId = insertRes.recordset[0]?.ROIWinID;

    // Tags
    if (activityTagIds?.length) {
      const tagReq = pool.request();
      const values = activityTagIds.map(id => `('${roiWinId}', ${Number(id)})`).join(',');
      await tagReq.query(`
        INSERT INTO dbo.ROIWinActivityTag (ROIWinID, ActivityTagID)
        VALUES ${values};
      `);
    }

    // Consultants
    if (consultants?.length) {
      const conReq = pool.request();
      const values = consultants.map(c => {
        const split = assertNumber(c.PercentSplit) ? c.PercentSplit : Number(c.PercentSplit);
        const isPrimary = c.IsPrimary ? 1 : 0;
        return `('${roiWinId}', '${c.ConsultantID}', ${split}, ${isPrimary})`;
      }).join(',');

      await conReq.query(`
        INSERT INTO dbo.ROIWinConsultant (ROIWinID, ConsultantID, PercentSplit, IsPrimary)
        VALUES ${values};
      `);
    }

    return roiWinId;
  },

  async updateWin(roiWinId, {
    title,
    categoryId,
    impactType,
    impactDate,
    recurringMonthlyAmount,
    recurringStartDate,
    recurringEndDate,
    oneTimeTotalValue,
    oneTimeSpreadMonths,
    internalNotes,
    externalNotes,
    clientOwnerUserId,
    activityTagIds,
    consultants,
    correctionNote,
    editedByUserId,
    resetToDraft = false,
  }) {
    const pool = await poolPromise;
    const req = pool.request();

    req.input('ROIWinID', sql.UniqueIdentifier, roiWinId);
    req.input('Title', sql.NVarChar(200), title);
    req.input('CategoryID', sql.Int, categoryId);
    req.input('ImpactType', sql.NVarChar(20), impactType);
    req.input('ImpactDate', sql.Date, new Date(impactDate));

    req.input('RecurringMonthlyAmount', sql.Decimal(18, 2), recurringMonthlyAmount ?? null);
    req.input('RecurringStartDate', sql.Date, normalizeNullableDate(recurringStartDate));
    req.input('RecurringEndDate', sql.Date, normalizeNullableDate(recurringEndDate));

    req.input('OneTimeTotalValue', sql.Decimal(18, 2), oneTimeTotalValue ?? null);
    req.input('OneTimeSpreadMonths', sql.Int, oneTimeSpreadMonths ?? null);

    req.input('InternalNotes', sql.NVarChar(sql.MAX), internalNotes ?? null);
    req.input('ExternalNotes', sql.NVarChar(sql.MAX), externalNotes ?? null);
    req.input('ClientOwnerUserID', sql.UniqueIdentifier, clientOwnerUserId ?? null);

    req.input('CorrectionNote', sql.NVarChar(sql.MAX), correctionNote ?? null);
    req.input('EditedByUserID', sql.UniqueIdentifier, editedByUserId ?? null);
    req.input('ResetToDraft', sql.Bit, resetToDraft ? 1 : 0);

    await req.query(`
      UPDATE dbo.ROIWin
      SET
        Title = @Title,
        CategoryID = @CategoryID,
        ImpactType = @ImpactType,
        ImpactDate = @ImpactDate,
        RecurringMonthlyAmount = @RecurringMonthlyAmount,
        RecurringStartDate = @RecurringStartDate,
        RecurringEndDate = @RecurringEndDate,
        OneTimeTotalValue = @OneTimeTotalValue,
        OneTimeSpreadMonths = @OneTimeSpreadMonths,
        InternalNotes = @InternalNotes,
        ExternalNotes = @ExternalNotes,
        ClientOwnerUserID = @ClientOwnerUserID,
        CorrectionNote = @CorrectionNote,
        Revision = Revision + 1,
        Status = CASE WHEN @ResetToDraft = 1 THEN 'Draft' ELSE Status END,
        LastEditedAt = SYSUTCDATETIME(),
        LastEditedByUserID = @EditedByUserID
      WHERE ROIWinID = @ROIWinID;
    `);

    // Replace tags if provided
    if (Array.isArray(activityTagIds)) {
      await pool.request()
        .input('ROIWinID', sql.UniqueIdentifier, roiWinId)
        .query('DELETE FROM dbo.ROIWinActivityTag WHERE ROIWinID = @ROIWinID;');

      if (activityTagIds.length) {
        const values = activityTagIds.map(id => `('${roiWinId}', ${Number(id)})`).join(',');
        await pool.request().query(`
          INSERT INTO dbo.ROIWinActivityTag (ROIWinID, ActivityTagID)
          VALUES ${values};
        `);
      }
    }

    // Replace consultants if provided
    if (Array.isArray(consultants)) {
      await pool.request()
        .input('ROIWinID', sql.UniqueIdentifier, roiWinId)
        .query('DELETE FROM dbo.ROIWinConsultant WHERE ROIWinID = @ROIWinID;');

      if (consultants.length) {
        const values = consultants.map(c => {
          const split = assertNumber(c.PercentSplit) ? c.PercentSplit : Number(c.PercentSplit);
          const isPrimary = c.IsPrimary ? 1 : 0;
          return `('${roiWinId}', '${c.ConsultantID}', ${split}, ${isPrimary})`;
        }).join(',');

        await pool.request().query(`
          INSERT INTO dbo.ROIWinConsultant (ROIWinID, ConsultantID, PercentSplit, IsPrimary)
          VALUES ${values};
        `);
      }
    }

    return true;
  },

  async softDeleteWin({ roiWinId, deletedByUserId }) {
    const pool = await poolPromise;
    const req = pool.request();
    req.input('ROIWinID', sql.UniqueIdentifier, roiWinId);
    req.input('DeletedByUserID', sql.UniqueIdentifier, deletedByUserId ?? null);

    await req.query(`
      UPDATE dbo.ROIWin
      SET IsDeleted = 1,
          DeletedAt = SYSUTCDATETIME(),
          DeletedByUserID = @DeletedByUserID
      WHERE ROIWinID = @ROIWinID;
    `);

    return true;
  },

  async setStatusSubmitted({ roiWinId, submittedByUserId }) {
    const pool = await poolPromise;
    const req = pool.request();

    req.input('ROIWinID', sql.UniqueIdentifier, roiWinId);
    req.input('SubmittedByUserID', sql.UniqueIdentifier, submittedByUserId ?? null);

    await req.query(`
      UPDATE dbo.ROIWin
      SET Status = 'Submitted',
          SubmittedAt = SYSUTCDATETIME(),
          SubmittedByUserID = @SubmittedByUserID,
          LastEditedAt = SYSUTCDATETIME(),
          LastEditedByUserID = @SubmittedByUserID
      WHERE ROIWinID = @ROIWinID
        AND IsDeleted = 0;
    `);

    return true;
  },

  async setStatusApproved({ roiWinId, approvedByUserId }) {
    const pool = await poolPromise;
    const req = pool.request();

    req.input('ROIWinID', sql.UniqueIdentifier, roiWinId);
    req.input('ApprovedByUserID', sql.UniqueIdentifier, approvedByUserId ?? null);

    await req.query(`
      UPDATE dbo.ROIWin
      SET Status = 'Approved',
          ApprovedAt = SYSUTCDATETIME(),
          ApprovedByUserID = @ApprovedByUserID,
          RejectionReasonID = NULL,
          RejectionNote = NULL,
          LastEditedAt = SYSUTCDATETIME(),
          LastEditedByUserID = @ApprovedByUserID
      WHERE ROIWinID = @ROIWinID
        AND IsDeleted = 0;
    `);

    return true;
  },

  async setStatusRejected({ roiWinId, rejectedByUserId, rejectionReasonId, rejectionNote }) {
    const pool = await poolPromise;
    const req = pool.request();

    req.input('ROIWinID', sql.UniqueIdentifier, roiWinId);
    req.input('RejectedByUserID', sql.UniqueIdentifier, rejectedByUserId ?? null);
    req.input('RejectionReasonID', sql.Int, rejectionReasonId ?? null);
    req.input('RejectionNote', sql.NVarChar(sql.MAX), rejectionNote ?? null);

    await req.query(`
      UPDATE dbo.ROIWin
      SET Status = 'Rejected',
          RejectedAt = SYSUTCDATETIME(),
          RejectedByUserID = @RejectedByUserID,
          RejectionReasonID = @RejectionReasonID,
          RejectionNote = @RejectionNote,
          LastEditedAt = SYSUTCDATETIME(),
          LastEditedByUserID = @RejectedByUserID
      WHERE ROIWinID = @ROIWinID
        AND IsDeleted = 0;
    `);

    return true;
  },

  async resetRejectedToDraft({ roiWinId, editedByUserId }) {
    const pool = await poolPromise;
    const req = pool.request();

    req.input('ROIWinID', sql.UniqueIdentifier, roiWinId);
    req.input('EditedByUserID', sql.UniqueIdentifier, editedByUserId ?? null);

    await req.query(`
      UPDATE dbo.ROIWin
      SET Status = 'Draft',
          LastEditedAt = SYSUTCDATETIME(),
          LastEditedByUserID = @EditedByUserID
      WHERE ROIWinID = @ROIWinID
        AND Status IN ('Rejected')
        AND IsDeleted = 0;
    `);

    return true;
  },

  async getClientMRRForMonth({ clientId, monthStart }) {
    // MRR as of month being viewed.
    // Uses Contract.MonthlyFee (preferred) and falls back to Contract.MonthlyRevenue.
    const pool = await poolPromise;
    const req = pool.request();

    const start = new Date(monthStart);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // last day of month

    req.input('ClientID', sql.UniqueIdentifier, clientId);
    req.input('MonthStart', sql.Date, start);
    req.input('MonthEnd', sql.Date, end);

    const res = await req.query(`
      SELECT
        SUM(COALESCE(MonthlyFee, MonthlyRevenue, 0)) AS MRR
      FROM dbo.Contract
      WHERE ClientID = @ClientID
        AND ContractStartDate <= @MonthEnd
        AND (ContractEndDate IS NULL OR ContractEndDate >= @MonthStart);
    `);

    const mrr = res.recordset?.[0]?.MRR;
    return Number(mrr || 0);
  },

  async listApprovedWinsForDashboard({
    rangeStart,
    rangeEnd,
    clientId,
    consultantId,
    userContext,
  }) {
    const pool = await poolPromise;
    const req = pool.request();

    // Filters
    req.input('RangeStart', sql.Date, rangeStart ? new Date(rangeStart) : null);
    req.input('RangeEnd', sql.Date, rangeEnd ? new Date(rangeEnd) : null);
    req.input('ClientID', sql.UniqueIdentifier, clientId || null);
    req.input('ConsultantID', sql.UniqueIdentifier, consultantId || null);

    // Base query: only approved, non-deleted wins that overlap the date range
    const winsResult = await req.query(`
      ;WITH Base AS (
        SELECT
          w.*, 
          c.ClientName,
          cat.Name AS CategoryName
        FROM dbo.ROIWin w
        INNER JOIN dbo.Client c ON c.ClientID = w.ClientID
        INNER JOIN dbo.ROIImpactCategory cat ON cat.CategoryID = w.CategoryID
        WHERE w.Status = 'Approved'
          AND w.IsDeleted = 0
          AND ( @ClientID IS NULL OR w.ClientID = @ClientID )
          AND (
            @RangeStart IS NULL OR @RangeEnd IS NULL
            OR (
              -- Recurring: overlaps if start <= rangeEnd AND (end IS NULL OR end >= rangeStart)
              (w.ImpactType = 'Recurring' AND w.RecurringStartDate <= @RangeEnd AND (w.RecurringEndDate IS NULL OR w.RecurringEndDate >= @RangeStart))
              OR
              -- OneTime: include if ImpactDate is within range or spread period overlaps range
              -- The computeMonthlyAllocations function will handle the actual allocation
              (w.ImpactType = 'OneTime' AND w.ImpactDate <= @RangeEnd)
            )
          )
          AND (
            @ConsultantID IS NULL
            OR EXISTS (
              SELECT 1
              FROM dbo.ROIWinConsultant wc
              WHERE wc.ROIWinID = w.ROIWinID
                AND wc.ConsultantID = @ConsultantID
            )
          )
      )
      SELECT * FROM Base
      ORDER BY ImpactDate DESC, LastEditedAt DESC;
    `);

    const wins = winsResult.recordset;

    if (wins.length === 0) return [];

    // Load consultants for all wins
    const winIds = wins.map(w => `'${w.ROIWinID}'`).join(',');

    const consRes = await pool.request().query(`
      SELECT
        wc.ROIWinID,
        wc.ConsultantID,
        wc.PercentSplit,
        wc.IsPrimary,
        c.FirstName + ' ' + c.LastName AS ConsultantName
      FROM dbo.ROIWinConsultant wc
      INNER JOIN dbo.Consultant c ON c.ConsultantID = wc.ConsultantID
      WHERE wc.ROIWinID IN (${winIds})
      ORDER BY c.FirstName, c.LastName;
    `);

    const consultantsByWin = new Map();
    for (const r of consRes.recordset) {
      if (!consultantsByWin.has(r.ROIWinID)) consultantsByWin.set(r.ROIWinID, []);
      consultantsByWin.get(r.ROIWinID).push({
        ConsultantID: r.ConsultantID,
        ConsultantName: r.ConsultantName,
        PercentSplit: Number(r.PercentSplit),
        IsPrimary: !!r.IsPrimary,
      });
    }

    // Return with lowercase 'consultants' property for dashboard compatibility
    return wins.map(w => ({
      ...w,
      consultants: consultantsByWin.get(w.ROIWinID) || [],
    }));
  },
};

export default ROIWin;
