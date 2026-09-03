import type { RequestHandler } from 'express';
import type { LookupInput } from '@ps/types';
import * as service from './scan.service.js';
import type { EmergencyQuery } from './scan.schema.js';

export const lookup: RequestHandler = async (req, res, next) => {
  try {
    const { plate, botToken } = req.body as LookupInput;
    const ip = req.ip ?? 'unknown';
    res.json(await service.lookupPlate(plate, ip, botToken));
  } catch (e) { next(e); }
};

export const emergency: RequestHandler = async (req, res, next) => {
  try {
    const { permit } = req.query as unknown as EmergencyQuery;
    res.json(await service.getEmergencyCard(permit));
  } catch (e) { next(e); }
};
