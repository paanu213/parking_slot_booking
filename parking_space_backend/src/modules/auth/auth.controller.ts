import type { CookieOptions, RequestHandler, Response } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { Unauthorized } from '../../lib/http.js';
import { loginUser, refreshSession, registerUser, revokeRefreshToken } from './auth.service.js';
import { toUserDTO, userDtoSelect } from './auth.dto.js';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_PATH = '/api/auth';

const baseCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  domain: env.COOKIE_DOMAIN,
});

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('access_token', accessToken, { ...baseCookie(), path: '/', maxAge: ACCESS_MAX_AGE_MS });
  res.cookie('refresh_token', refreshToken, {
    ...baseCookie(),
    path: REFRESH_PATH,
    maxAge: REFRESH_MAX_AGE_MS,
  });
};

const clearAuthCookies = (res: Response) => {
  // clearCookie must echo the original domain/path/sameSite/secure or browsers ignore it.
  res.clearCookie('access_token', { ...baseCookie(), path: '/' });
  res.clearCookie('refresh_token', { ...baseCookie(), path: REFRESH_PATH });
};

export const register: RequestHandler = async (req, res, next) => {
  try {
    const { accessToken, refreshToken, user } = await registerUser(req.body);
    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({ user: toUserDTO(user), accessToken });
  } catch (e) {
    next(e);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { accessToken, refreshToken, user } = await loginUser(req.body);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ user: toUserDTO(user), accessToken });
  } catch (e) {
    next(e);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const rt = req.cookies?.refresh_token as string | undefined;
    if (rt) await revokeRefreshToken(rt);
    clearAuthCookies(res);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const rt = req.cookies?.refresh_token as string | undefined;
    if (!rt) throw Unauthorized('Missing refresh token');
    const { accessToken, refreshToken, user } = await refreshSession(rt);
    setAuthCookies(res, accessToken, refreshToken);
    res.json({ user: toUserDTO(user), accessToken });
  } catch (e) {
    // If refresh failed, clear stale cookies so the client doesn't keep retrying with them.
    clearAuthCookies(res);
    next(e);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw Unauthorized();
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: userDtoSelect,
    });
    if (!user) throw Unauthorized();
    res.json({ user: toUserDTO(user) });
  } catch (e) {
    next(e);
  }
};
