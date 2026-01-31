import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";

import { authenticateJWT, authorizeRoles } from "../middleware/auth.js";
import {
  getClientWorkSettings,
  updateClientWorkSettings,
  getClientWorkDashboardSummary,
  // Close
  getOrCreateCloseRun,
  updateCloseChecklistItem,
  uploadCloseGL,
  runCloseQAScan,
  listCloseQAFlags,
  updateCloseQAFlag,
  // Cash Forecast
  getCashForecast,
  updateCashForecastHeader,
  upsertCashForecastLine,
  deleteCashForecastLine,
  // AI
  listAiRuns,
  getAiRun,
  createAiRun,
  generateAiRun,
  updateAiRun,
  publishAiRun,
  lockAiRun,
  // Market Intel
  listMarketIntelItems,
  refreshMarketIntel,
  pinMarketIntelItem,
  // Board Pack
  listBoardPackTemplates,
  upsertBoardPackTemplate,
  listBoardPacks,
  upsertBoardPack,
  // Staff Eval
  listAccountingStaff,
  upsertAccountingStaff,
  listStaffEvaluations,
  createStaffEvaluation,
} from "../controllers/clientWorkController.js";

const router = express.Router();

// Require auth for all endpoints
router.use(authenticateJWT);

// Upload configuration (GL exports, budgets, transcripts, etc.)
const uploadDir = path.join(process.cwd(), "uploads", "client-work");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, uniqueSuffix + "-" + safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// ---- Settings & Dashboard --------------------------------------------------
router.get(
  "/settings",
  authorizeRoles("Admin", "Manager", "Consultant"),
  getClientWorkSettings
);
router.put(
  "/settings",
  authorizeRoles("Admin", "Manager"),
  updateClientWorkSettings
);

router.get(
  "/dashboard-summary",
  authorizeRoles("Admin", "Manager", "Consultant"),
  getClientWorkDashboardSummary
);

// ---- Close ----------------------------------------------------------------
router.post(
  "/close/runs/get-or-create",
  authorizeRoles("Admin", "Manager", "Consultant"),
  getOrCreateCloseRun
);

router.put(
  "/close/checklist/items/:itemId",
  authorizeRoles("Admin", "Manager", "Consultant"),
  updateCloseChecklistItem
);

router.post(
  "/close/qa/upload-gl",
  authorizeRoles("Admin", "Manager", "Consultant"),
  upload.single("file"),
  uploadCloseGL
);

router.post(
  "/close/qa/run",
  authorizeRoles("Admin", "Manager", "Consultant"),
  runCloseQAScan
);

router.get(
  "/close/qa/flags",
  authorizeRoles("Admin", "Manager", "Consultant"),
  listCloseQAFlags
);

router.put(
  "/close/qa/flags/:flagId",
  authorizeRoles("Admin", "Manager", "Consultant"),
  updateCloseQAFlag
);

// ---- 13-week Cash Forecast -------------------------------------------------
router.get(
  "/cash-forecast",
  authorizeRoles("Admin", "Manager", "Consultant", "Client"),
  getCashForecast
);

router.post(
  "/cash-forecast/create-or-get",
  authorizeRoles("Admin", "Manager", "Consultant"),
  getCashForecast
);

router.put(
  "/cash-forecast/:cashForecastId",
  authorizeRoles("Admin", "Manager", "Consultant"),
  updateCashForecastHeader
);

router.post(
  "/cash-forecast/lines",
  authorizeRoles("Admin", "Manager", "Consultant", "Client"),
  upsertCashForecastLine
);

router.delete(
  "/cash-forecast/lines/:lineId",
  authorizeRoles("Admin", "Manager", "Consultant"),
  deleteCashForecastLine
);

// ---- AI Reporting ----------------------------------------------------------
router.get(
  "/ai/runs",
  authorizeRoles("Admin", "Manager", "Consultant"),
  listAiRuns
);

router.get(
  "/ai/runs/:aiRunId",
  authorizeRoles("Admin", "Manager", "Consultant"),
  getAiRun
);

router.post(
  "/ai/runs",
  authorizeRoles("Admin", "Manager", "Consultant"),
  createAiRun
);

router.post(
  "/ai/runs/:aiRunId/generate",
  authorizeRoles("Admin", "Manager", "Consultant"),
  generateAiRun
);

router.put(
  "/ai/runs/:aiRunId",
  authorizeRoles("Admin", "Manager", "Consultant"),
  updateAiRun
);

router.post(
  "/ai/runs/:aiRunId/publish",
  authorizeRoles("Admin", "Manager", "Consultant"),
  publishAiRun
);

router.post(
  "/ai/runs/:aiRunId/lock",
  authorizeRoles("Admin", "Manager"),
  lockAiRun
);

// ---- Market Intelligence ---------------------------------------------------
router.get(
  "/market-intel/items",
  authorizeRoles("Admin", "Manager", "Consultant"),
  listMarketIntelItems
);

router.post(
  "/market-intel/refresh",
  authorizeRoles("Admin", "Manager", "Consultant"),
  refreshMarketIntel
);

router.put(
  "/market-intel/items/:itemId/pin",
  authorizeRoles("Admin", "Manager", "Consultant"),
  pinMarketIntelItem
);

// ---- Board Pack ------------------------------------------------------------
router.get(
  "/board-pack/templates",
  authorizeRoles("Admin", "Manager", "Consultant"),
  listBoardPackTemplates
);

router.post(
  "/board-pack/templates",
  authorizeRoles("Admin", "Manager"),
  upsertBoardPackTemplate
);

router.get(
  "/board-pack/packs",
  authorizeRoles("Admin", "Manager", "Consultant"),
  listBoardPacks
);

router.post(
  "/board-pack/packs",
  authorizeRoles("Admin", "Manager", "Consultant"),
  upsertBoardPack
);

router.put(
  "/board-pack/packs/:packId",
  authorizeRoles("Admin", "Manager", "Consultant"),
  upsertBoardPack
);

// ---- Internal Accounting Staff Evaluation ---------------------------------
router.get(
  "/staff",
  authorizeRoles("Admin", "Manager", "Consultant"),
  listAccountingStaff
);

router.post(
  "/staff",
  authorizeRoles("Admin", "Manager"),
  upsertAccountingStaff
);

router.get(
  "/evaluations",
  authorizeRoles("Admin", "Manager", "Consultant"),
  listStaffEvaluations
);

router.post(
  "/evaluations",
  authorizeRoles("Admin", "Manager"),
  createStaffEvaluation
);

export default router;

