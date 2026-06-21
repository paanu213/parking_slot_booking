import type { RequestHandler } from 'express';
import * as service from './locations.service.js';
import type { SearchInput, AvailabilityInput } from './locations.schema.js';

export const search: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.searchLocations(req.query as unknown as SearchInput));
  } catch (e) {
    next(e);
  }
};

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.getLocation(req.params.id));
  } catch (e) {
    next(e);
  }
};

export const getAvailability: RequestHandler = async (req, res, next) => {
  try {
    const { startAt, endAt } = req.query as unknown as AvailabilityInput;
    res.json({ items: await service.getAvailability(req.params.id, startAt, endAt) });
  } catch (e) {
    next(e);
  }
};
