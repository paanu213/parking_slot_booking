import type { RequestHandler } from 'express';
import * as service from './qrOrders.service.js';
import type { CreateQrOrderInput } from './qrOrders.schema.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const result = await service.createQrOrder(req.user!.sub, req.body as CreateQrOrderInput);
    res.status(201).json(result);
  } catch (e) { next(e); }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listMyQrOrders(req.user!.sub));
  } catch (e) { next(e); }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    res.json({ order: await service.getMyQrOrder(req.user!.sub, req.params.id) });
  } catch (e) { next(e); }
};
