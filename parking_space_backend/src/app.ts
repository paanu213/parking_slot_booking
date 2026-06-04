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

import authRoutes from './modules/auth/auth.routes.js';
import oauthRoutes from './modules/auth/oauth.routes.js';
import locationRoutes from './modules/locations/locations.routes.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import vendorRoutes from './modules/vendor/vendor.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
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
  app.use(express.json({ limit: '1mb' }));
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
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/util', utilRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
