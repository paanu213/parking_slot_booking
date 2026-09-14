import type { Request, RequestHandler } from 'express';
import * as service from './qrOrders.service.js';
import type {
  CreateQrOrderInput, VerifyQrPaymentInput, QrPaymentFailedInput, QrPaymentCancelInput, QrDemoCompleteInput,
} from './qrOrders.schema.js';

const attemptMeta = (req: Request) => ({
  ip:        req.ip ?? 'unknown',
  userAgent: req.headers['user-agent'],
});

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

export const checkout: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.createQrCheckout(req.user!.sub, req.params.id, attemptMeta(req)));
  } catch (e) { next(e); }
};

export const verify: RequestHandler = async (req, res, next) => {
  try {
    const order = await service.verifyQrPayment(req.user!.sub, req.params.id, req.body as VerifyQrPaymentInput, attemptMeta(req));
    res.json({ order });
  } catch (e) { next(e); }
};

export const reportFailed: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.reportQrPaymentFailure(req.user!.sub, req.params.id, req.body as QrPaymentFailedInput, attemptMeta(req)));
  } catch (e) { next(e); }
};

export const reportCancelled: RequestHandler = async (req, res, next) => {
  try {
    const { providerOrderId } = req.body as QrPaymentCancelInput;
    res.json(await service.reportQrPaymentCancelled(req.user!.sub, req.params.id, providerOrderId, attemptMeta(req)));
  } catch (e) { next(e); }
};

export const paymentHistory: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listQrPaymentAttempts(req.user!.sub, req.params.id));
  } catch (e) { next(e); }
};

export const events: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listMyQrOrderEvents(req.user!.sub, req.params.id));
  } catch (e) { next(e); }
};

export const demoComplete: RequestHandler = async (req, res, next) => {
  try {
    const { providerOrderId, outcome } = req.body as QrDemoCompleteInput;
    res.json(await service.completeDemoCheckout(req.user!.sub, req.params.id, providerOrderId, outcome, attemptMeta(req)));
  } catch (e) { next(e); }
};
