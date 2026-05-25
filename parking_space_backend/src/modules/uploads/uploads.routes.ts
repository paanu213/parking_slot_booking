import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { BadRequest } from '../../lib/http.js';
import { ALLOWED_IMAGE_MIMES, ALLOWED_DOC_MIMES, storeImageBuffer, storeDocumentBuffer } from '../../lib/images.js';

const r = Router();

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

// Generic: compress + store image, return public URL
r.post('/images', requireAuth, imageUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw BadRequest('No file uploaded');
    const img = await storeImageBuffer(req.file.buffer);
    res.status(201).json({ url: img.url, width: img.width, height: img.height, size: img.size });
  } catch (e) {
    next(e);
  }
});

// Generic: store document (image or PDF), return public URL
r.post('/documents', requireAuth, docUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw BadRequest('No file uploaded');
    const result = await storeDocumentBuffer(req.file.buffer, req.file.mimetype);
    res.status(201).json({ url: result.url });
  } catch (e) {
    next(e);
  }
});

export default r;
