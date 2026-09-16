import type { RequestHandler } from 'express';
import type { LookupInput } from '@ps/types';
import * as service from './scan.service.js';
import type { ConfigureStickerInput, RevealEmergencyInput, VerifyPlateInput } from './scan.schema.js';

export const lookup: RequestHandler = async (req, res, next) => {
  try {
    const { plate, botToken } = req.body as LookupInput;
    const ip = req.ip ?? 'unknown';
    res.json(await service.lookupPlate(plate, ip, botToken));
  } catch (e) { next(e); }
};

export const stickerState: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getStickerState(req.params.token));
  } catch (e) { next(e); }
};

export const configureSticker: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json(await service.configureSticker(
      req.params.token,
      req.user!.sub,
      req.body as ConfigureStickerInput,
    ));
  } catch (e) { next(e); }
};

export const verifyStickerPlate: RequestHandler = async (req, res, next) => {
  try {
    const { last4 } = req.body as VerifyPlateInput;
    res.json(await service.verifyStickerPlate(req.params.token, last4, req.ip ?? 'unknown'));
  } catch (e) { next(e); }
};

export const emergency: RequestHandler = async (req, res, next) => {
  try {
    const { permit, callerNumber } = req.body as RevealEmergencyInput;
    res.json(await service.getEmergencyCard(permit, callerNumber, req.ip ?? 'unknown'));
  } catch (e) { next(e); }
};
