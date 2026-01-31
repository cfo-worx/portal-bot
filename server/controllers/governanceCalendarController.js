import fs from "fs";
import path from "path";
import {
  listGovernanceCalendarEvents,
  getGovernanceCalendarEventById,
  createGovernanceCalendarEvent,
  updateGovernanceCalendarEvent,
  setGovernanceCalendarEventStatus,
  deleteGovernanceCalendarEvent,
  addGovernanceCalendarEventAttachment,
  listGovernanceCalendarEventAttachments,
} from "../models/GovernanceCalendarEvent.js";
import { getGovernanceSettings, updateGovernanceSettings } from "../models/GovernanceSettings.js";
import { poolPromise } from "../db.js";
import sql from "mssql";

/** SETTINGS **/
export const getSettings = async (req, res) => {
  try {
    const settings = await getGovernanceSettings();
    res.json(settings);
  } catch (err) {
    console.error("Error fetching governance settings:", err);
    res.status(500).json({ error: "Failed to fetch governance settings" });
  }
};

export const putSettings = async (req, res) => {
  try {
    const patch = req.body || {};
    const updated = await updateGovernanceSettings(patch);
    res.json(updated);
  } catch (err) {
    console.error("Error updating governance settings:", err);
    res.status(500).json({ error: "Failed to update governance settings" });
  }
};

/** EVENTS **/
export const getEvents = async (req, res) => {
  try {
    const filters = {
      clientId: req.query.clientId,
      status: req.query.status,
      types: req.query.types ? String(req.query.types).split(",").map((x) => x.trim()).filter(Boolean) : undefined,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      activeClientsOnly: req.query.activeClientsOnly === "true",
    };
    const events = await listGovernanceCalendarEvents(filters);
    res.json(events);
  } catch (err) {
    console.error("Error fetching governance calendar events:", err);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await getGovernanceCalendarEventById(req.params.eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const attachments = await listGovernanceCalendarEventAttachments(req.params.eventId);
    res.json({ ...event, attachments });
  } catch (err) {
    console.error("Error fetching calendar event:", err);
    res.status(500).json({ error: "Failed to fetch calendar event" });
  }
};

export const createEvent = async (req, res) => {
  try {
    const userId = req.user?.UserID || req.user?.userId || null;
    const created = await createGovernanceCalendarEvent(req.body, userId);
    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating calendar event:", err);
    res.status(500).json({ error: "Failed to create calendar event" });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const updated = await updateGovernanceCalendarEvent(req.params.eventId, req.body || {});
    res.json(updated);
  } catch (err) {
    console.error("Error updating calendar event:", err);
    res.status(500).json({ error: "Failed to update calendar event" });
  }
};

export const setEventStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: "status is required" });
    const updated = await setGovernanceCalendarEventStatus(req.params.eventId, status);
    res.json(updated);
  } catch (err) {
    console.error("Error setting calendar event status:", err);
    res.status(500).json({ error: "Failed to update event status" });
  }
};

export const removeEvent = async (req, res) => {
  try {
    await deleteGovernanceCalendarEvent(req.params.eventId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting calendar event:", err);
    res.status(500).json({ error: "Failed to delete calendar event" });
  }
};

/** ATTACHMENTS **/
export const uploadEventAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const userId = req.user?.UserID || req.user?.userId || null;
    const attachment = await addGovernanceCalendarEventAttachment(req.params.eventId, req.file, userId);
    res.status(201).json(attachment);
  } catch (err) {
    console.error("Error uploading calendar event attachment:", err);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
};

export const downloadEventAttachment = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("AttachmentID", sql.UniqueIdentifier, req.params.attachmentId)
      .query(`
        SELECT TOP 1 AttachmentID, EventID, FileName, FilePath, MimeType
        FROM dbo.GovernanceCalendarEventAttachment
        WHERE AttachmentID=@AttachmentID
      `);

    const attachment = result.recordset[0];
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    const filePath = attachment.FilePath;
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on server" });

    res.setHeader("Content-Type", attachment.MimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="\${attachment.FileName}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error("Error downloading calendar attachment:", err);
    res.status(500).json({ error: "Failed to download attachment" });
  }
};

