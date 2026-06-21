import type { RequestHandler } from 'express';
import * as service from './bookings.service.js';
import type { CreateBookingInput } from './bookings.schema.js';

export const create: RequestHandler = async (req, res, next) => {
  try {
    const booking = await service.createBooking(req.user!.sub, req.body as CreateBookingInput);
    res.status(201).json(booking);
  } catch (e) {
    next(e);
  }
};

export const listMine: RequestHandler = async (req, res, next) => {
  try {
    res.json({ items: await service.listMyBookings(req.user!.sub) });
  } catch (e) {
    next(e);
  }
};
