import CRMDeal from '../models/CRMDeal.js';
import CRMDealNote from '../models/CRMDealNote.js';
import CRMDealActivity from '../models/CRMDealActivity.js';
import CRMDealAttachment from '../models/CRMDealAttachment.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== DEALS ==========
export const getDeals = async (req, res) => {
  try {
    const filters = {
      module: req.query.module || null,
      stageId: req.query.stageId || null,
      ownerId: req.query.ownerId || null,
      search: req.query.search || null,
    };
    
    // Frontend handles role-based filtering and sends ownerId in query if needed
    // Backend just uses the query parameter as-is
    
    const deals = await CRMDeal.getAll(filters);
    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
};

export const getDealById = async (req, res) => {
  try {

    const deal = await CRMDeal.getById(req.params.id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    // Frontend handles permission checks - backend just returns the deal
    // If frontend sends ownerId filter in getDeals, they won't see deals they shouldn't access
    
    res.json(deal);
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({ error: 'Failed to fetch deal' });
  }
};

export const createDeal = async (req, res) => {
  try {
    // CreatedBy should be sent from frontend in req.body
    const dealData = {
      ...req.body,
    };
    const deal = await CRMDeal.create(dealData);
    res.status(201).json(deal);
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ error: 'Failed to create deal' });
  }
};

export const updateDeal = async (req, res) => {
  try {

    const deal = await CRMDeal.getById(req.params.id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    // Frontend handles permission checks - backend just updates the deal
    
    const updatedDeal = await CRMDeal.update(req.params.id, req.body);
    res.json(updatedDeal);
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Failed to update deal' });
  }
};

export const deleteDeal = async (req, res) => {
  try {

    const deal = await CRMDeal.getById(req.params.id);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    await CRMDeal.delete(req.params.id);
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Failed to delete deal' });
  }
};

// ========== DEAL NOTES ==========
export const getDealNotes = async (req, res) => {
  try {
    const notes = await CRMDealNote.getByDeal(req.params.dealId);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching deal notes:', error);
    res.status(500).json({ error: 'Failed to fetch deal notes' });
  }
};

// ========== UNIFIED NOTES & ACTIVITIES ==========
export const getDealNotesAndActivities = async (req, res) => {
  try {
    const dealId = req.params.dealId;
    
    // Get both notes and activities
    const [notes, activities] = await Promise.all([
      CRMDealNote.getByDeal(dealId),
      CRMDealActivity.getByDeal(dealId),
    ]);
    
    // Transform notes to unified format
    const unifiedNotes = notes.map(note => ({
      id: note.NoteID,
      type: 'note',
      activityType: 'Note',
      body: note.NoteText,
      timestamp: note.CreatedOn,
      author: note.CreatedByName || 'Unknown',
      authorId: note.CreatedBy,
      source: 'note',
    }));
    
    // Transform activities to unified format
    const unifiedActivities = activities.map(activity => ({
      id: activity.ActivityID,
      type: 'activity',
      activityType: activity.ActivityType || 'Note',
      body: activity.ActivityDescription || '',
      timestamp: activity.ActivityDate || activity.CreatedOn,
      author: activity.CreatedByName || 'Unknown',
      authorId: activity.CreatedBy,
      source: 'activity',
    }));
    
    // Merge and sort chronologically (most recent first)
    const unified = [...unifiedNotes, ...unifiedActivities].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateB - dateA; // Most recent first
    });
    
    res.json(unified);
  } catch (error) {
    console.error('Error fetching unified notes and activities:', error);
    res.status(500).json({ error: 'Failed to fetch notes and activities' });
  }
};

export const createDealNote = async (req, res) => {
  try {
    // CreatedBy should be sent from frontend in req.body
    const noteData = {
      ...req.body,
      DealID: req.params.dealId,
    };
    const note = await CRMDealNote.create(noteData);
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating deal note:', error);
    res.status(500).json({ error: 'Failed to create deal note' });
  }
};

// Unified create endpoint - creates activity with type
export const createDealNoteOrActivity = async (req, res) => {
  try {
    const dealId = req.params.dealId;
    const { activityType, body, timestamp } = req.body;
    
    // ActivityType: 'Note', 'Call', 'Meeting', 'Email', 'Text'
    const activityData = {
      DealID: dealId,
      ActivityType: activityType || 'Note',
      ActivityDescription: body,
      ActivityDate: timestamp ? new Date(timestamp) : new Date(),
      CreatedBy: req.body.CreatedBy || req.user?.userId || null,
    };
    
    const activity = await CRMDealActivity.create(activityData);
    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating note/activity:', error);
    res.status(500).json({ error: 'Failed to create note/activity' });
  }
};

export const deleteDealNote = async (req, res) => {
  try {
    await CRMDealNote.delete(req.params.noteId);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal note:', error);
    res.status(500).json({ error: 'Failed to delete deal note' });
  }
};

// ========== DEAL ACTIVITIES ==========
export const getDealActivities = async (req, res) => {
  try {
    const activities = await CRMDealActivity.getByDeal(req.params.dealId);
    res.json(activities);
  } catch (error) {
    console.error('Error fetching deal activities:', error);
    res.status(500).json({ error: 'Failed to fetch deal activities' });
  }
};

export const createDealActivity = async (req, res) => {
  try {
    // CreatedBy should be sent from frontend in req.body
    const activityData = {
      ...req.body,
      DealID: req.params.dealId,
    };
    const activity = await CRMDealActivity.create(activityData);
    res.status(201).json(activity);
  } catch (error) {
    console.error('Error creating deal activity:', error);
    res.status(500).json({ error: 'Failed to create deal activity' });
  }
};

export const deleteDealActivity = async (req, res) => {
  try {
    await CRMDealActivity.delete(req.params.activityId);
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal activity:', error);
    res.status(500).json({ error: 'Failed to delete deal activity' });
  }
};

// ========== DEAL ATTACHMENTS ==========
export const getDealAttachments = async (req, res) => {
  try {
    const attachments = await CRMDealAttachment.getByDeal(req.params.dealId);
    res.json(attachments);
  } catch (error) {
    console.error('Error fetching deal attachments:', error);
    res.status(500).json({ error: 'Failed to fetch deal attachments' });
  }
};

export const uploadDealAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dealId = req.params.dealId;
    const file = req.file;
    
    // Determine file type
    const ext = path.extname(file.originalname).toLowerCase();
    let fileType = 'other';
    if (ext === '.pdf') fileType = 'pdf';
    else if (ext === '.xls' || ext === '.xlsx') fileType = 'excel';
    else if (ext === '.csv') fileType = 'csv';

    const attachmentData = {
      DealID: dealId,
      FilePath: file.path,
      FileName: file.originalname,
      FileSize: file.size,
      FileType: fileType,
      MimeType: file.mimetype,
      CreatedBy: req.user?.userId || req.body.CreatedBy || null,
    };

    const attachment = await CRMDealAttachment.create(attachmentData);
    res.status(201).json(attachment);
  } catch (error) {
    console.error('Error uploading deal attachment:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
};

export const downloadDealAttachment = async (req, res) => {
  try {
    const attachment = await CRMDealAttachment.getById(req.params.attachmentId);
    
    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const filePath = attachment.FilePath;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Set headers for download/preview
    res.setHeader('Content-Type', attachment.MimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${attachment.FileName}"`);
    
    // Send file
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error downloading deal attachment:', error);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
};

export const deleteDealAttachment = async (req, res) => {
  try {
    const attachment = await CRMDealAttachment.delete(req.params.attachmentId);
    
    // Delete file from filesystem
    if (fs.existsSync(attachment.FilePath)) {
      fs.unlinkSync(attachment.FilePath);
    }
    
    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
};

