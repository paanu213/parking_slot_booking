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

  // Database briefly unreachable (connect timeout, pool exhausted, connection
  // dropped): a temporary condition, not a bug. Say so, so people retry.
  const prismaCode = (err as { errorCode?: string; code?: string })?.errorCode ?? (err as { code?: string })?.code;
  const isDbDown =
    (err as Error)?.constructor?.name === 'PrismaClientInitializationError' ||
    ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(prismaCode ?? '');
  if (isDbDown) {
    logger.warn({ code: prismaCode }, 'Database temporarily unavailable');
    return res.status(503).json({
      error: { code: 'DB_UNAVAILABLE', message: 'The database is not responding right now. Please try again in a few seconds.' },
    });
  }

  logger.error({ err }, 'Unhandled error');
  // Belt-and-braces: write directly to stderr so the error shows up even if
  // the pino transport is misconfigured on the host. Cheap diagnostic.
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
};
