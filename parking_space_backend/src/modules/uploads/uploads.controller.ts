import type { RequestHandler } from 'express';
import * as service from './uploads.service.js';

export const uploadImage: RequestHandler = async (req, res, next) => {
  try {
    const img = await service.storeImage(req.file);
    res.status(201).json({ url: img.url, width: img.width, height: img.height, size: img.size });
  } catch (e) {
    next(e);
  }
};

export const uploadDocument: RequestHandler = async (req, res, next) => {
  try {
    const result = await service.storeDocument(req.file);
    res.status(201).json({ url: result.url });
  } catch (e) {
    next(e);
  }
};
