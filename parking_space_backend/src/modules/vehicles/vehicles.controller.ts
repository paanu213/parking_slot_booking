import type { RequestHandler } from 'express';
import type { RegisterVehicleInput } from '@ps/types';
import * as service from './vehicles.service.js';
import * as callsService from '../calls/calls.service.js';
import type { UpdateVehicleInput } from './vehicles.schema.js';

export const list: RequestHandler = async (req, res, next) => {
  try {
    res.json({ items: await service.listVehicles(req.user!.sub) });
  } catch (e) { next(e); }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    res.json({ vehicle: await service.getVehicle(req.user!.sub, req.params.id) });
  } catch (e) { next(e); }
};

export const getByPlate: RequestHandler = async (req, res, next) => {
  try {
    res.json({ vehicle: await service.getVehicleByPlate(req.user!.sub, req.params.plate) });
  } catch (e) { next(e); }
};

export const create: RequestHandler = async (req, res, next) => {
  try {
    const vehicle = await service.registerVehicle(req.user!.sub, req.body as RegisterVehicleInput);
    res.status(201).json({ vehicle });
  } catch (e) { next(e); }
};

export const update: RequestHandler = async (req, res, next) => {
  try {
    const vehicle = await service.updateVehicle(req.user!.sub, req.params.id, req.body as UpdateVehicleInput);
    res.json({ vehicle });
  } catch (e) { next(e); }
};

export const pause: RequestHandler = async (req, res, next) => {
  try {
    res.json({ vehicle: await service.pauseVehicle(req.user!.sub, req.params.id) });
  } catch (e) { next(e); }
};

export const resume: RequestHandler = async (req, res, next) => {
  try {
    res.json({ vehicle: await service.resumeVehicle(req.user!.sub, req.params.id) });
  } catch (e) { next(e); }
};

export const remove: RequestHandler = async (req, res, next) => {
  try {
    res.json(await service.deleteVehicle(req.user!.sub, req.params.id));
  } catch (e) { next(e); }
};

export const calls: RequestHandler = async (req, res, next) => {
  try {
    res.json({ items: await callsService.listCallsForOwner(req.user!.sub, req.params.id) });
  } catch (e) { next(e); }
};

export const blockCaller: RequestHandler = async (req, res, next) => {
  try {
    res.json(await callsService.blockCaller(req.user!.sub, req.params.id, req.params.callId));
  } catch (e) { next(e); }
};
