import express from "express";
import { authenticateJWT, authorizeRoles } from "../middleware/auth.js";
import {
  getSettings,
  putSettings,
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  setEventStatus,
  removeEvent,
  uploadEventAttachment,
  downloadEventAttachment,
} from "../controllers/governanceCalendarController.js";
import { uploadGovernanceAttachment } from "../utils/uploadGovernanceAttachment.js";

const router = express.Router();

// Settings
router.get("/settings", authenticateJWT, authorizeRoles("Admin", "Manager"), getSettings);
router.put("/settings", authenticateJWT, authorizeRoles("Admin"), putSettings);

// Events
router.get("/events", authenticateJWT, authorizeRoles("Admin", "Manager"), getEvents);
router.post("/events", authenticateJWT, authorizeRoles("Admin", "Manager"), createEvent);
router.get("/events/:eventId", authenticateJWT, authorizeRoles("Admin", "Manager"), getEventById);
router.put("/events/:eventId", authenticateJWT, authorizeRoles("Admin", "Manager"), updateEvent);
router.post("/events/:eventId/status", authenticateJWT, authorizeRoles("Admin", "Manager"), setEventStatus);
router.delete("/events/:eventId", authenticateJWT, authorizeRoles("Admin"), removeEvent);

// Attachments
router.post(
  "/events/:eventId/attachments",
  authenticateJWT,
  authorizeRoles("Admin", "Manager"),
  uploadGovernanceAttachment.single("file"),
  uploadEventAttachment
);
router.get(
  "/attachments/:attachmentId/download",
  authenticateJWT,
  authorizeRoles("Admin", "Manager"),
  downloadEventAttachment
);

export default router;

