// server/controllers/helpdeskController.js
import fs from 'fs';
import path from 'path';
import ITTicket from '../models/ITTicket.js';

function getUserContext(req) {
  const user = req.user || {};
  const rolesArray = Array.isArray(user.roles) ? user.roles : [];
  return {
    userId: user.userId || user.UserID || null,
    role: user.role || user.Role || rolesArray[0] || null,
    roles: rolesArray.length ? rolesArray : (user.role ? [user.role] : []),
  };
}

function isAdminOrManager(roles = []) {
  const set = new Set((roles || []).map((r) => String(r)));
  return set.has('Admin') || set.has('Manager');
}

function badRequest(res, message, details = undefined) {
  return res.status(400).json({ error: message, ...(details ? { details } : {}) });
}

export async function listTickets(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    const canSeeAll = isAdminOrManager(ctx.roles);

    const filters = {
      status: req.query.status || null,
      priority: req.query.priority || null,
      category: req.query.category || null,
      includeClosed: String(req.query.includeClosed || 'false').toLowerCase() === 'true',
      onlyMine: String(req.query.onlyMine || 'false').toLowerCase() === 'true',
      assignedToMe: String(req.query.assignedToMe || 'false').toLowerCase() === 'true',
      search: req.query.search || null,
    };

    // Default: non-admin/managers can only see their own tickets.
    if (!canSeeAll) {
      filters.onlyMine = true;
    }

    const rows = await ITTicket.listTickets(filters, {
      userId: ctx.userId,
      onlyMineUserId: filters.onlyMine ? ctx.userId : null,
      assignedToUserId: filters.assignedToMe ? ctx.userId : null,
      canSeeAll,
    });

    return res.json(rows);
  } catch (err) {
    console.error('listTickets error:', err);
    return res.status(500).json({ error: 'Failed to list tickets' });
  }
}

export async function getTicket(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    const ticketId = req.params.ticketId;
    const canSeeAll = isAdminOrManager(ctx.roles);

    const ticket = await ITTicket.getTicketById(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!canSeeAll && ticket.CreatedByUserID !== ctx.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json(ticket);
  } catch (err) {
    console.error('getTicket error:', err);
    return res.status(500).json({ error: 'Failed to get ticket' });
  }
}

export async function createTicket(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      title,
      description,
      category,
      priority,
      affectedPage,
      affectedFeature,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      environment,
      browserInfo,
      appVersion,
    } = req.body || {};

    const created = await ITTicket.createTicket({
      title: title ? String(title).trim() : '',
      description: description ? String(description).trim() : '',
      category: category || 'other',
      priority: priority || 'P2',
      affectedPage: affectedPage ? String(affectedPage).trim() : null,
      affectedFeature: affectedFeature ? String(affectedFeature).trim() : null,
      stepsToReproduce: stepsToReproduce ? String(stepsToReproduce).trim() : null,
      expectedBehavior: expectedBehavior ? String(expectedBehavior).trim() : null,
      actualBehavior: actualBehavior ? String(actualBehavior).trim() : null,
      environment: environment ? String(environment).trim() : null,
      browserInfo: browserInfo ? String(browserInfo).trim() : null,
      appVersion: appVersion ? String(appVersion).trim() : null,
      createdByUserID: ctx.userId,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('createTicket error:', err);
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
}

export async function updateTicket(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    const ticketId = req.params.ticketId;
    const canSeeAll = isAdminOrManager(ctx.roles);

    const ticket = await ITTicket.getTicketById(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const isCreator = ticket.CreatedByUserID === ctx.userId;

    // Permission logic:
    // - Admin/Manager can update everything.
    // - Creator can update descriptive fields while ticket is still open/in_progress/blocked.
    const allowedCreatorStatuses = new Set(['open', 'in_progress', 'blocked']);

    if (!canSeeAll && !(isCreator && allowedCreatorStatuses.has(ticket.Status))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const body = req.body || {};

    // Whitelist fields based on role
    const updates = {};

    const creatorFields = [
      'title', 'description', 'category', 'priority',
      'affectedPage', 'affectedFeature',
      'stepsToReproduce', 'expectedBehavior', 'actualBehavior',
      'environment',
    ];

    const adminFields = [...creatorFields, 'status', 'assignedToUserID', 'resolutionSummary', 'estimateMinutes'];

    const fields = canSeeAll ? adminFields : creatorFields;

    for (const key of fields) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // normalize + validate
    if (updates.title !== undefined) {
      if (!updates.title || String(updates.title).trim().length < 5) return badRequest(res, 'Title must be at least 5 chars');
      updates.title = String(updates.title).trim();
    }

    if (updates.description !== undefined) {
      if (!updates.description || String(updates.description).trim().length < 20) return badRequest(res, 'Description must be at least 20 chars');
      updates.description = String(updates.description).trim();
    }

    if (updates.category !== undefined) {
      if (!ITTicket.CATEGORIES.includes(updates.category)) return badRequest(res, 'Invalid category');
    }

    if (updates.priority !== undefined) {
      if (!ITTicket.PRIORITIES.includes(updates.priority)) return badRequest(res, 'Invalid priority');
    }

    if (updates.status !== undefined) {
      if (!ITTicket.STATUSES.includes(updates.status)) return badRequest(res, 'Invalid status');
    }

    if (updates.estimateMinutes !== undefined && updates.estimateMinutes !== null) {
      const n = Number(updates.estimateMinutes);
      if (!Number.isFinite(n) || n < 0) return badRequest(res, 'estimateMinutes must be a non-negative number');
      updates.estimateMinutes = Math.trunc(n);
    }

    const updated = await ITTicket.updateTicket(ticketId, updates, {
      updatedByUserID: ctx.userId,
      closedByUserID: ctx.userId,
    });

    return res.json(updated);
  } catch (err) {
    console.error('updateTicket error:', err);
    return res.status(500).json({ error: 'Failed to update ticket' });
  }
}

export async function addComment(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    const ticketId = req.params.ticketId;
    const { body } = req.body || {};
    if (!body || String(body).trim().length < 2) return badRequest(res, 'Comment body is required');

    const canSeeAll = isAdminOrManager(ctx.roles);
    const ticket = await ITTicket.getTicketById(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!canSeeAll && ticket.CreatedByUserID !== ctx.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const comment = await ITTicket.addComment(ticketId, ctx.userId, String(body).trim(), true);
    return res.status(201).json(comment);
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ error: 'Failed to add comment' });
  }
}

export async function addWorkLog(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!isAdminOrManager(ctx.roles)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const ticketId = req.params.ticketId;
    const { minutes, note } = req.body || {};

    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) return badRequest(res, 'minutes must be a positive number');

    const log = await ITTicket.addWorkLog(ticketId, ctx.userId, Math.trunc(m), note ? String(note).trim() : null);
    return res.status(201).json(log);
  } catch (err) {
    console.error('addWorkLog error:', err);
    return res.status(500).json({ error: 'Failed to add work log' });
  }
}

export async function uploadAttachment(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    const ticketId = req.params.ticketId;
    const canSeeAll = isAdminOrManager(ctx.roles);

    const ticket = await ITTicket.getTicketById(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!canSeeAll && ticket.CreatedByUserID !== ctx.userId) {
      // cleanup uploaded file if user isn't allowed
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!req.file) return badRequest(res, 'No file uploaded');

    const attachment = await ITTicket.addAttachment(ticketId, ctx.userId, {
      filePath: req.file.path,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    return res.status(201).json(attachment);
  } catch (err) {
    console.error('uploadAttachment error:', err);
    return res.status(500).json({ error: 'Failed to upload attachment' });
  }
}

export async function downloadAttachment(req, res) {
  try {
    const ctx = getUserContext(req);
    if (!ctx.userId) return res.status(401).json({ error: 'Unauthorized' });

    const ticketId = req.params.ticketId;
    const attachmentId = req.params.attachmentId;
    const canSeeAll = isAdminOrManager(ctx.roles);

    const ticket = await ITTicket.getTicketById(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    if (!canSeeAll && ticket.CreatedByUserID !== ctx.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const attachment = (ticket.attachments || []).find((a) => a.AttachmentID === attachmentId);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found' });

    const filePath = attachment.FilePath;
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });

    const safeName = attachment.FileName || path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName.replace(/"/g, '')}"`);
    if (attachment.MimeType) res.setHeader('Content-Type', attachment.MimeType);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    console.error('downloadAttachment error:', err);
    return res.status(500).json({ error: 'Failed to download attachment' });
  }
}

