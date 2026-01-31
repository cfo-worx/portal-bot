import express from "express";
import { authenticateJWT, authorizeRoles } from "../middleware/auth.js";
import {
  getCovenants,
  getCovenant,
  postCovenant,
  putCovenant,
  getSnapshots,
  postSnapshot,
  uploadCovenantAttachment,
  downloadCovenantAttachment,
  getAlerts,
  acknowledgeAlert,
  getDashboard,
} from "../controllers/governanceCovenantController.js";
import { uploadGovernanceAttachment } from "../utils/uploadGovernanceAttachment.js";

const router = express.Router();

// Dashboard & alerts
router.get("/dashboard", authenticateJWT, authorizeRoles("Admin", "Manager"), getDashboard);
router.get("/alerts", authenticateJWT, authorizeRoles("Admin", "Manager"), getAlerts);
router.post("/alerts/:alertId/ack", authenticateJWT, authorizeRoles("Admin", "Manager"), acknowledgeAlert);

// Attachments (download)
router.get(
  "/attachments/:attachmentId/download",
  authenticateJWT,
  authorizeRoles("Admin", "Manager"),
  downloadCovenantAttachment
);

// Covenants
router.get("/", authenticateJWT, authorizeRoles("Admin", "Manager"), getCovenants);
router.post("/", authenticateJWT, authorizeRoles("Admin", "Manager"), postCovenant);
router.get("/:covenantId", authenticateJWT, authorizeRoles("Admin", "Manager"), getCovenant);
router.put("/:covenantId", authenticateJWT, authorizeRoles("Admin", "Manager"), putCovenant);

// Snapshots
router.get("/:covenantId/snapshots", authenticateJWT, authorizeRoles("Admin", "Manager"), getSnapshots);
router.post("/:covenantId/snapshots", authenticateJWT, authorizeRoles("Admin", "Manager"), postSnapshot);

// Covenant attachments upload
router.post(
  "/:covenantId/attachments",
  authenticateJWT,
  authorizeRoles("Admin", "Manager"),
  uploadGovernanceAttachment.single("file"),
  uploadCovenantAttachment
);

export default router;

