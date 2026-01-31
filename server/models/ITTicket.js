// server/models/ITTicket.js
import { poolPromise, sql } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * ITTicket is an internal helpdesk / IT ticket model.
 *
 * Notes:
 * - Authorization is handled in the controller (creator can see their own; Admin/Manager can see all).
 * - Attachments are stored on disk (uploads/it-tickets) and referenced by FilePath.
 */
class ITTicket {
  static PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
  
  static CATEGORIES = ['bug', 'ui_ux', 'data', 'access', 'integration', 'performance', 'feature_request', 'other'];
  static PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
  static STATUSES = ['open', 'in_progress', 'blocked', 'resolved', 'closed'];

  static async create(ticket) {
    const pool = await poolPromise;
    const id = uuidv4();

    await pool.request()
      .input('TicketID', sql.UniqueIdentifier, id)
      .input('Title', sql.NVarChar(200), ticket.Title)
      .input('Description', sql.NVarChar(sql.MAX), ticket.Description)
      .input('Category', sql.NVarChar(50), ticket.Category)
      .input('Priority', sql.NVarChar(10), ticket.Priority)
      .input('Status', sql.NVarChar(30), ticket.Status || 'open')
      .input('AffectedPage', sql.NVarChar(200), ticket.AffectedPage || null)
      .input('AffectedFeature', sql.NVarChar(200), ticket.AffectedFeature || null)
      .input('StepsToReproduce', sql.NVarChar(sql.MAX), ticket.StepsToReproduce || null)
      .input('ExpectedBehavior', sql.NVarChar(sql.MAX), ticket.ExpectedBehavior || null)
      .input('ActualBehavior', sql.NVarChar(sql.MAX), ticket.ActualBehavior || null)
      .input('Environment', sql.NVarChar(50), ticket.Environment || null)
      .input('BrowserInfo', sql.NVarChar(500), ticket.BrowserInfo || null)
      .input('AppVersion', sql.NVarChar(50), ticket.AppVersion || null)
      .input('CreatedByUserID', sql.UniqueIdentifier, ticket.CreatedByUserID)
      .query(`
        INSERT INTO ITTicket (
          TicketID, Title, Description, Category, Priority, Status,
          AffectedPage, AffectedFeature,
          StepsToReproduce, ExpectedBehavior, ActualBehavior,
          Environment, BrowserInfo, AppVersion,
          CreatedAt, CreatedByUserID, UpdatedAt, UpdatedByUserID,
          TotalTimeSpentMinutes
        ) VALUES (
          @TicketID, @Title, @Description, @Category, @Priority, @Status,
          @AffectedPage, @AffectedFeature,
          @StepsToReproduce, @ExpectedBehavior, @ActualBehavior,
          @Environment, @BrowserInfo, @AppVersion,
          SYSUTCDATETIME(), @CreatedByUserID, SYSUTCDATETIME(), @CreatedByUserID,
          0
        )
      `);

    return id;
  }

  static async getById(ticketId) {
    const pool = await poolPromise;

    const ticketResult = await pool.request()
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .query(`
        SELECT
          t.*, 
          cu.FirstName + ' ' + cu.LastName AS CreatedByName,
          au.FirstName + ' ' + au.LastName AS AssignedToName,
          uu.FirstName + ' ' + uu.LastName AS UpdatedByName,
          cb.FirstName + ' ' + cb.LastName AS ClosedByName
        FROM ITTicket t
        LEFT JOIN Users cu ON cu.UserID = t.CreatedByUserID
        LEFT JOIN Users au ON au.UserID = t.AssignedToUserID
        LEFT JOIN Users uu ON uu.UserID = t.UpdatedByUserID
        LEFT JOIN Users cb ON cb.UserID = t.ClosedByUserID
        WHERE t.TicketID = @TicketID
      `);

    const attachmentsResult = await pool.request()
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .query(`
        SELECT
          a.*, 
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM ITTicketAttachment a
        LEFT JOIN Users u ON u.UserID = a.CreatedByUserID
        WHERE a.TicketID = @TicketID
        ORDER BY a.CreatedAt DESC
      `);

    const commentsResult = await pool.request()
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .query(`
        SELECT
          c.*, 
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM ITTicketComment c
        LEFT JOIN Users u ON u.UserID = c.CreatedByUserID
        WHERE c.TicketID = @TicketID
        ORDER BY c.CreatedAt ASC
      `);

    const workLogsResult = await pool.request()
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .query(`
        SELECT
          w.*, 
          u.FirstName + ' ' + u.LastName AS CreatedByName
        FROM ITTicketWorkLog w
        LEFT JOIN Users u ON u.UserID = w.CreatedByUserID
        WHERE w.TicketID = @TicketID
        ORDER BY w.CreatedAt DESC
      `);

    return {
      ticket: ticketResult.recordset[0] || null,
      attachments: attachmentsResult.recordset,
      comments: commentsResult.recordset,
      workLogs: workLogsResult.recordset,
    };
  }

  static async list({
    status,
    includeClosed,
    createdByUserID,
    assignedToUserID,
    q,
    category,
    priority,
    activeOnly,
  } = {}) {
    const pool = await poolPromise;
    const request = pool.request();

    const where = ['1=1'];

    if (status) {
      // Handle comma-separated status values
      if (status.includes(',')) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          const placeholders = statuses.map((_, i) => `@Status${i}`).join(',');
          where.push(`t.Status IN (${placeholders})`);
          statuses.forEach((s, i) => {
            request.input(`Status${i}`, sql.NVarChar(30), s);
          });
        }
      } else {
        where.push('t.Status = @Status');
        request.input('Status', sql.NVarChar(30), status);
      }
    }

    if (!includeClosed) {
      where.push("t.Status <> 'closed'");
    }

    if (createdByUserID) {
      where.push('t.CreatedByUserID = @CreatedByUserID');
      request.input('CreatedByUserID', sql.UniqueIdentifier, createdByUserID);
    }

    if (assignedToUserID) {
      where.push('t.AssignedToUserID = @AssignedToUserID');
      request.input('AssignedToUserID', sql.UniqueIdentifier, assignedToUserID);
    }

    if (category) {
      where.push('t.Category = @Category');
      request.input('Category', sql.NVarChar(50), category);
    }

    if (priority) {
      where.push('t.Priority = @Priority');
      request.input('Priority', sql.NVarChar(10), priority);
    }

    if (q) {
      where.push('(t.Title LIKE @Q OR t.Description LIKE @Q OR t.AffectedPage LIKE @Q OR t.AffectedFeature LIKE @Q)');
      request.input('Q', sql.NVarChar(260), `%${q}%`);
    }

    // activeOnly is currently unused (placeholder for future: hide closed/resolved if desired)
    if (activeOnly) {
      where.push("t.Status IN ('open','in_progress','blocked','resolved')");
    }

    const result = await request.query(`
      SELECT
        t.TicketID,
        t.Title,
        t.Category,
        t.Priority,
        t.Status,
        t.AffectedPage,
        t.AffectedFeature,
        t.CreatedAt,
        t.UpdatedAt,
        t.ClosedAt,
        t.TotalTimeSpentMinutes,
        cu.FirstName + ' ' + cu.LastName AS CreatedByName,
        au.FirstName + ' ' + au.LastName AS AssignedToName
      FROM ITTicket t
      LEFT JOIN Users cu ON cu.UserID = t.CreatedByUserID
      LEFT JOIN Users au ON au.UserID = t.AssignedToUserID
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE t.Priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
        t.CreatedAt DESC
    `);

    return result.recordset;
  }

  static async update(ticketId, updates, updatedByUserID) {
    const pool = await poolPromise;
    const request = pool.request()
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .input('UpdatedByUserID', sql.UniqueIdentifier, updatedByUserID);

    const set = [];
    const fields = {
      Title: sql.NVarChar(200),
      Description: sql.NVarChar(sql.MAX),
      Category: sql.NVarChar(50),
      Priority: sql.NVarChar(10),
      Status: sql.NVarChar(30),
      AffectedPage: sql.NVarChar(200),
      AffectedFeature: sql.NVarChar(200),
      StepsToReproduce: sql.NVarChar(sql.MAX),
      ExpectedBehavior: sql.NVarChar(sql.MAX),
      ActualBehavior: sql.NVarChar(sql.MAX),
      Environment: sql.NVarChar(50),
      BrowserInfo: sql.NVarChar(500),
      AppVersion: sql.NVarChar(50),
      AssignedToUserID: sql.UniqueIdentifier,
      ResolutionSummary: sql.NVarChar(sql.MAX),
      EstimateMinutes: sql.Int,
      ClosedAt: sql.DateTime2,
      ClosedByUserID: sql.UniqueIdentifier,
    };

    for (const [k, v] of Object.entries(updates || {})) {
      if (!Object.prototype.hasOwnProperty.call(fields, k)) continue;
      set.push(`${k} = @${k}`);
      request.input(k, fields[k], v);
    }

    if (!set.length) throw new Error('No valid fields to update');

    set.push('UpdatedAt = SYSUTCDATETIME()');
    set.push('UpdatedByUserID = @UpdatedByUserID');

    await request.query(`
      UPDATE ITTicket
      SET ${set.join(', ')}
      WHERE TicketID = @TicketID
    `);
  }

  static async addComment(ticketId, createdByUserID, body, isInternal = true) {
    const pool = await poolPromise;
    const id = uuidv4();

    await pool.request()
      .input('CommentID', sql.UniqueIdentifier, id)
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .input('Body', sql.NVarChar(sql.MAX), body)
      .input('IsInternal', sql.Bit, isInternal ? 1 : 0)
      .input('CreatedByUserID', sql.UniqueIdentifier, createdByUserID)
      .query(`
        INSERT INTO ITTicketComment (CommentID, TicketID, Body, IsInternal, CreatedAt, CreatedByUserID)
        VALUES (@CommentID, @TicketID, @Body, @IsInternal, SYSUTCDATETIME(), @CreatedByUserID)
      `);

    return id;
  }

  static async addWorkLog(ticketId, createdByUserID, minutes, note = null) {
    const pool = await poolPromise;
    const id = uuidv4();

    await pool.request()
      .input('WorkLogID', sql.UniqueIdentifier, id)
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .input('Minutes', sql.Int, minutes)
      .input('Note', sql.NVarChar(500), note)
      .input('CreatedByUserID', sql.UniqueIdentifier, createdByUserID)
      .query(`
        INSERT INTO ITTicketWorkLog (WorkLogID, TicketID, Minutes, Note, CreatedAt, CreatedByUserID)
        VALUES (@WorkLogID, @TicketID, @Minutes, @Note, SYSUTCDATETIME(), @CreatedByUserID)
      `);

    // roll-up minutes onto ticket
    await pool.request()
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .input('Minutes', sql.Int, minutes)
      .input('UpdatedByUserID', sql.UniqueIdentifier, createdByUserID)
      .query(`
        UPDATE ITTicket
        SET TotalTimeSpentMinutes = ISNULL(TotalTimeSpentMinutes, 0) + @Minutes,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedByUserID = @UpdatedByUserID
        WHERE TicketID = @TicketID
      `);

    return id;
  }

  static async addAttachment(ticketId, createdByUserID, file) {
    const pool = await poolPromise;
    const id = uuidv4();

    await pool.request()
      .input('AttachmentID', sql.UniqueIdentifier, id)
      .input('TicketID', sql.UniqueIdentifier, ticketId)
      .input('FileName', sql.NVarChar(255), file.originalname || file.fileName)
      .input('FilePath', sql.NVarChar(500), file.path || file.filePath)
      .input('FileSize', sql.Int, file.size || file.fileSize)
      .input('MimeType', sql.NVarChar(100), file.mimetype || file.mimeType)
      .input('CreatedByUserID', sql.UniqueIdentifier, createdByUserID)
      .query(`
        INSERT INTO ITTicketAttachment (
          AttachmentID, TicketID, FileName, FilePath, FileSize, MimeType, CreatedAt, CreatedByUserID
        ) VALUES (
          @AttachmentID, @TicketID, @FileName, @FilePath, @FileSize, @MimeType, SYSUTCDATETIME(), @CreatedByUserID
        )
      `);

    return id;
  }

  static async getAttachmentById(attachmentId) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('AttachmentID', sql.UniqueIdentifier, attachmentId)
      .query(`
        SELECT *
        FROM ITTicketAttachment
        WHERE AttachmentID = @AttachmentID
      `);

    return result.recordset[0] || null;
  }

  // Wrapper methods for controller compatibility
  static async listTickets(filters = {}, options = {}) {
    const {
      status,
      priority,
      category,
      includeClosed,
      onlyMine,
      assignedToMe,
      search,
    } = filters;

    const {
      userId,
      onlyMineUserId,
      assignedToUserId,
      canSeeAll,
    } = options;

    const params = {
      status: status || null,
      priority: priority || null,
      category: category || null,
      includeClosed: includeClosed !== false,
      q: search || null,
    };


    // Apply user filtering
    if (onlyMine && onlyMineUserId) {
      params.createdByUserID = onlyMineUserId;
    } else if (assignedToMe && assignedToUserId) {
      params.assignedToUserID = assignedToUserId;
    } else if (!canSeeAll && userId) {
      // Default: non-admin/managers can only see their own tickets
      params.createdByUserID = userId;
    }

    return await this.list(params);
  }

  static async getTicketById(ticketId) {
    const result = await this.getById(ticketId);
    if (!result.ticket) return null;
    
    // Return ticket with nested data
    return {
      ...result.ticket,
      attachments: result.attachments,
      comments: result.comments,
      workLogs: result.workLogs,
    };
  }

  static async createTicket(ticketData) {
    // Map controller field names to model field names
    const ticket = {
      Title: ticketData.title,
      Description: ticketData.description,
      Category: ticketData.category,
      Priority: ticketData.priority,
      Status: ticketData.status || 'open',
      AffectedPage: ticketData.affectedPage || null,
      AffectedFeature: ticketData.affectedFeature || null,
      StepsToReproduce: ticketData.stepsToReproduce || null,
      ExpectedBehavior: ticketData.expectedBehavior || null,
      ActualBehavior: ticketData.actualBehavior || null,
      Environment: ticketData.environment || null,
      BrowserInfo: ticketData.browserInfo || null,
      AppVersion: ticketData.appVersion || null,
      CreatedByUserID: ticketData.createdByUserID,
    };

    const ticketId = await this.create(ticket);
    return await this.getTicketById(ticketId);
  }

  static async updateTicket(ticketId, updates, options = {}) {
    const { updatedByUserID, closedByUserID } = options;
    
    // Map controller field names to model field names
    const modelUpdates = {};
    const fieldMap = {
      title: 'Title',
      description: 'Description',
      category: 'Category',
      priority: 'Priority',
      status: 'Status',
      affectedPage: 'AffectedPage',
      affectedFeature: 'AffectedFeature',
      stepsToReproduce: 'StepsToReproduce',
      expectedBehavior: 'ExpectedBehavior',
      actualBehavior: 'ActualBehavior',
      environment: 'Environment',
      browserInfo: 'BrowserInfo',
      appVersion: 'AppVersion',
      assignedToUserID: 'AssignedToUserID',
      resolutionSummary: 'ResolutionSummary',
      estimateMinutes: 'EstimateMinutes',
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMap[key]) {
        modelUpdates[fieldMap[key]] = value;
      }
    }

    // Handle closed status
    if (updates.status === 'closed' && closedByUserID) {
      modelUpdates.ClosedAt = new Date();
      modelUpdates.ClosedByUserID = closedByUserID;
    }

    await this.update(ticketId, modelUpdates, updatedByUserID || closedByUserID);
    return await this.getTicketById(ticketId);
  }
}

export default ITTicket;

