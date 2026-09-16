import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import hpp from 'hpp';
import { pinoHttp } from 'pino-http';
import { env, corsOrigins } from './config/env.js';
import { logger } from './config/logger.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Exact raw request bytes, captured by express.json()'s `verify` below — needed for webhook HMAC checks. */
      rawBody?: Buffer;
    }
  }
}

import authRoutes from './modules/auth/auth.routes.js';
import oauthRoutes from './modules/auth/oauth.routes.js';
import locationRoutes from './modules/locations/locations.routes.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import vendorRoutes from './modules/vendor/vendor.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import customerRoutes from './modules/customer/customer.routes.js';
import vehicleRoutes from './modules/vehicles/vehicles.routes.js';
import scanRoutes from './modules/scan/scan.routes.js';
import callRoutes from './modules/calls/calls.routes.js';
import webhookRoutes from './modules/webhooks/webhooks.routes.js';
import qrOrderRoutes from './modules/qrOrders/qrOrders.routes.js';
import uploadRoutes from './modules/uploads/uploads.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import utilRoutes from './modules/util/util.routes.js';

export const buildApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // Allow our SPA origins (with credentials). For everything else — including
      // top-level navigations like the Google OAuth callback redirect, which
      // arrive with `Origin: https://accounts.google.com` — pass `false` instead
      // of throwing. That skips CORS response headers (so cross-origin XHRs still
      // can't read the response), but lets the request itself reach the handler.
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(
    express.json({
      limit: '1mb',
      // Keep the exact raw bytes alongside the parsed body — the Razorpay
      // webhook signature is an HMAC over the raw request, and re-serialising
      // req.body with JSON.stringify is not guaranteed to byte-match what
      // Razorpay actually sent (key order, spacing), which would make every
      // signature check fail. See modules/webhooks/webhooks.routes.ts.
      verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(hpp());
  app.use(pinoHttp({ logger }));
  app.use(globalLimiter);

  // Health
  app.get('/health', (_req, res) => res.json({ ok: true, env: env.NODE_ENV }));

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', oauthRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/vendor', vendorRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/customer/me', customerRoutes);
  app.use('/api/customer/me/vehicles', vehicleRoutes);
  app.use('/api/c', scanRoutes);
  app.use('/api/c', callRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/customer/me/qr-orders', qrOrderRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/util', utilRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
