import type { RequestHandler } from 'express';
import type { InitiateCallInput } from '@ps/types';
import * as service from './calls.service.js';

export const initiate: RequestHandler = async (req, res, next) => {
  try {
    const { permit, callerNumber, idempotencyKey } = req.body as InitiateCallInput;
    const ip = req.ip ?? 'unknown';
    res.status(201).json(await service.initiateCall(permit, callerNumber, ip, idempotencyKey));
  } catch (e) { next(e); }
};

export const status: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getCallStatus(req.params.id));
  } catch (e) { next(e); }
};
