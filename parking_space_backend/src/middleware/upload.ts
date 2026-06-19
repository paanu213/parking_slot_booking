/**
 * Multer upload middleware — in-memory file handling for images and documents.
 * Used by the uploads routes and by any module that accepts file uploads
 * (admin/vendor space images, KYC documents).
 */
import multer from 'multer';
import { env } from '../config/env.js';
import { ALLOWED_IMAGE_MIMES, ALLOWED_DOC_MIMES } from '../lib/images.js';

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG/PNG/WebP allowed'));
    }
    cb(null, true);
  },
});

export const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_DOC_MIMES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG/PNG/WebP/PDF allowed'));
    }
    cb(null, true);
  },
});
