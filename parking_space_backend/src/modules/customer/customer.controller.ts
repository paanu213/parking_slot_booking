import type { RequestHandler } from 'express';
import * as service from './customer.service.js';
import type { UpdateProfileInput } from './customer.schema.js';

export const getProfile: RequestHandler = async (req, res, next) => {
  try {
    res.json({ user: await service.getProfile(req.user!.sub) });
  } catch (e) { next(e); }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    res.json({ user: await service.updateProfile(req.user!.sub, req.body as UpdateProfileInput) });
  } catch (e) { next(e); }
};

export const getSavedSpaces: RequestHandler = async (req, res, next) => {
  try {
    res.json({ items: await service.listSavedSpaces(req.user!.sub) });
  } catch (e) { next(e); }
};

export const getSavedSpaceIds: RequestHandler = async (req, res, next) => {
  try {
    res.json({ ids: await service.listSavedSpaceIds(req.user!.sub) });
  } catch (e) { next(e); }
};

export const toggleSavedSpace: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.toggleSavedSpace(req.user!.sub, req.params.locationId));
  } catch (e) { next(e); }
};

export const getTransactions: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.listMyTransactions(req.user!.sub));
  } catch (e) { next(e); }
};
