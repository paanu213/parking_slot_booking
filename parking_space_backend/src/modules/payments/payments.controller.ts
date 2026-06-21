import type { RequestHandler } from 'express';
import * as service from './payments.service.js';
import type { CreateOrderInput, VerifyInput } from './payments.schema.js';

export const createOrder: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.createOrder(req.user!.sub, (req.body as CreateOrderInput).bookingId));
  } catch (e) {
    next(e);
  }
};

export const verify: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.verifyPayment(req.user!.sub, req.body as VerifyInput));
  } catch (e) {
    next(e);
  }
};
