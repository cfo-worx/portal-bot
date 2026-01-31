// server/utils/uploadTicketAttachment.js
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const uploadDir = path.join(process.cwd(), 'uploads', 'it-tickets');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeOriginal}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
  ];

  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error('Invalid file type. Allowed: png, jpg, webp, gif, pdf, txt'), false);
}

const uploadTicketAttachment = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
});

export default uploadTicketAttachment;

