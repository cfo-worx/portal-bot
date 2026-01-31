import fs from "fs";
import path from "path";
import {
  listCovenants,
  getCovenantById,
  createCovenant,
  updateCovenant,
  listCovenantSnapshots,
  createCovenantSnapshot,
  listCovenantAttachments,
  addCovenantAttachment,
  listCovenantAlerts,
  acknowledgeCovenantAlert,
  getCovenantDashboardSummary,
} from "../models/CovenantMonitoring.js";
import { poolPromise } from "../db.js";
import sql from "mssql";

/** COVENANTS **/
export const getCovenants = async (req, res) => {
  try {
    const clientId = req.query.clientId;
    const activeOnly = req.query.activeOnly !== "false";
    const covenants = await listCovenants({ clientId, activeOnly });
    res.json(covenants);
  } catch (err) {
    console.error("Error fetching covenants:", err);
    res.status(500).json({ error: "Failed to fetch covenants" });
  }
};

export const getCovenant = async (req, res) => {
  try {
    const covenant = await getCovenantById(req.params.covenantId);
    if (!covenant) return res.status(404).json({ error: "Covenant not found" });

    const attachments = await listCovenantAttachments(req.params.covenantId);
    res.json({ ...covenant, attachments });
  } catch (err) {
    console.error("Error fetching covenant:", err);
    res.status(500).json({ error: "Failed to fetch covenant" });
  }
};

export const postCovenant = async (req, res) => {
  try {
    const userId = req.user?.UserID || req.user?.userId || null;
    const created = await createCovenant(req.body, userId);
    res.status(201).json(created);
  } catch (err) {
    console.error("Error creating covenant:", err);
    res.status(500).json({ error: "Failed to create covenant" });
  }
};

export const putCovenant = async (req, res) => {
  try {
    const updated = await updateCovenant(req.params.covenantId, req.body || {});
    res.json(updated);
  } catch (err) {
    console.error("Error updating covenant:", err);
    res.status(500).json({ error: "Failed to update covenant" });
  }
};

/** SNAPSHOTS **/
export const getSnapshots = async (req, res) => {
  try {
    const snapshots = await listCovenantSnapshots(req.params.covenantId, {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: req.query.limit ? Number(req.query.limit) : 200,
    });
    res.json(snapshots);
  } catch (err) {
    console.error("Error fetching covenant snapshots:", err);
    res.status(500).json({ error: "Failed to fetch covenant snapshots" });
  }
};

export const postSnapshot = async (req, res) => {
  try {
    const userId = req.user?.UserID || req.user?.userId || null;
    const snap = await createCovenantSnapshot(req.params.covenantId, req.body, userId);
    res.status(201).json(snap);
  } catch (err) {
    console.error("Error creating covenant snapshot:", err);
    res.status(500).json({ error: "Failed to create covenant snapshot" });
  }
};

/** ATTACHMENTS **/
export const uploadCovenantAttachment = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const userId = req.user?.UserID || req.user?.userId || null;
    const attachment = await addCovenantAttachment(req.params.covenantId, req.file, userId);
    res.status(201).json(attachment);
  } catch (err) {
    console.error("Error uploading covenant attachment:", err);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
};

export const downloadCovenantAttachment = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("AttachmentID", sql.UniqueIdentifier, req.params.attachmentId)
      .query(`
        SELECT TOP 1 AttachmentID, CovenantID, FileName, FilePath, MimeType
        FROM dbo.ClientCovenantAttachment
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
    console.error("Error downloading covenant attachment:", err);
    res.status(500).json({ error: "Failed to download attachment" });
  }
};

/** ALERTS **/
export const getAlerts = async (req, res) => {
  try {
    const clientId = req.query.clientId;
    const includeAcknowledged = req.query.includeAcknowledged === "true";
    const alerts = await listCovenantAlerts({ clientId, includeAcknowledged });
    res.json(alerts);
  } catch (err) {
    console.error("Error fetching covenant alerts:", err);
    res.status(500).json({ error: "Failed to fetch covenant alerts" });
  }
};

export const acknowledgeAlert = async (req, res) => {
  try {
    const userId = req.user?.UserID || req.user?.userId || null;
    const updated = await acknowledgeCovenantAlert(req.params.alertId, req.body || {}, userId);
    res.json(updated);
  } catch (err) {
    console.error("Error acknowledging covenant alert:", err);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
};

/** DASHBOARD **/
export const getDashboard = async (req, res) => {
  try {
    const clientId = req.query.clientId;
    const rows = await getCovenantDashboardSummary({ clientId });
    res.json(rows);
  } catch (err) {
    console.error("Error fetching covenant dashboard:", err);
    res.status(500).json({ error: "Failed to fetch covenant dashboard" });
  }
};

