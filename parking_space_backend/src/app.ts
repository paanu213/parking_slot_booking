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

export const buildApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
