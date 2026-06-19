import type { RequestHandler } from 'express';
import * as service from './util.service.js';
import type { LeadInput } from './util.schema.js';

export const getPincode: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.lookupPincode(req.params.pincode));
  } catch (e) {
    next(e);
  }
};

export const submitVendorLead: RequestHandler = async (req, res, next) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.ip;
    await service.createVendorLead(req.body as LeadInput, {
      ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
};
