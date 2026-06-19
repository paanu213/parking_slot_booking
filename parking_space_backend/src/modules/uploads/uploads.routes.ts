/**
 * Generic upload endpoints — store an image or document, return its public URL.
 * (The multer middleware now lives in middleware/upload.ts so other modules can
 * reuse it without importing this routes file.)
 */
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { imageUpload, docUpload } from '../../middleware/upload.js';
import { uploadImage, uploadDocument } from './uploads.controller.js';

const r = Router();

r.post('/images', requireAuth, imageUpload.single('file'), uploadImage);
r.post('/documents', requireAuth, docUpload.single('file'), uploadDocument);

export default r;
