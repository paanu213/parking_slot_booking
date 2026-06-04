import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http.js';
import { logger } from '../config/logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: err.flatten(),
      },
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code ?? 'ERROR', message: err.message, details: err.details },
    });
  }

  logger.error({ err }, 'Unhandled error');
  // Belt-and-braces: write directly to stderr so the error shows up even if
  // the pino transport is misconfigured on the host. Cheap diagnostic.
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
};
