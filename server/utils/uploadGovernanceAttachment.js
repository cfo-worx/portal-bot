import multer from "multer";
import path from "path";
import fs from "fs";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const STORAGE_ROOT = path.join(process.cwd(), "uploads", "governance");
ensureDir(STORAGE_ROOT);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, STORAGE_ROOT);
  },
  filename: (req, file, cb) => {
    const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeBase}`);
  },
});

const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

function fileFilter(req, file, cb) {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  cb(new Error("Unsupported file type"), false);
}

export const uploadGovernanceAttachment = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

