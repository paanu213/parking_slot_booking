import type { RequestHandler } from 'express';
import { Forbidden, Unauthorized } from '../lib/http.js';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : (req.cookies?.access_token as string | undefined);
  if (!token) return next(Unauthorized());
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(Unauthorized('Invalid or expired token'));
  }
};

export const requireRole =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role)) return next(Forbidden('Insufficient role'));
    next();
  };
